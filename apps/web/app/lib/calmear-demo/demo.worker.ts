/**
 * CalmEar demo worker: owns the ONNX session and runs the whole pipeline off
 * the main thread.
 *
 * Model loading mirrors calmear_extension/extension/inference_worker.js
 * (commit b17fb4b): onnxruntime-web 1.27.0, WebGPU alone first and WASM
 * (single-threaded) as the fallback, graphOptimizationLevel 'all', and a
 * warm-up run on zeros. Unlike the extension, the model is fetched with
 * progress and kept in Cache Storage so a returning visitor does not download
 * it again.
 */
import * as ort from 'onnxruntime-web'
import { NUM_MEL_BINS, WARMUP_FRAMES, WARMUP_TIMEOUT_MS } from './constants'
import { PipelineCancelled, processAudio } from './pipeline'
import type { WorkerRequest, WorkerResponse } from './protocol'

const MODEL_CACHE_NAME = 'calmear-demo-model'

let session: ort.InferenceSession | null = null
let loading: Promise<void> | null = null
const cancelled = new Set<number>()

function post(msg: WorkerResponse, transfer: Transferable[] = []) {
  self.postMessage(msg, { transfer })
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

async function openCache(): Promise<Cache | null> {
  try {
    return typeof caches !== 'undefined' ? await caches.open(MODEL_CACHE_NAME) : null
  }
  catch {
    return null
  }
}

async function fetchModel(url: string): Promise<Uint8Array<ArrayBuffer>> {
  const cache = await openCache()
  const cached = cache ? await cache.match(url).catch(() => undefined) : undefined
  if (cached) {
    post({ type: 'model-progress', loaded: 1, total: 1, fromCache: true })
    return new Uint8Array(await cached.arrayBuffer())
  }

  const res = await fetch(url)
  if (!res.ok || !res.body) throw new Error(`model_http_${res.status}`)
  const total = Number(res.headers.get('content-length')) || 0
  const bytes = total > 0 ? new Uint8Array(total) : null
  const chunks: Uint8Array[] = []
  let loaded = 0
  let lastPost = 0
  const reader = res.body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (bytes && loaded + value.length <= bytes.length) bytes.set(value, loaded)
    else chunks.push(value)
    loaded += value.length
    const now = performance.now()
    if (now - lastPost > 100) {
      lastPost = now
      post({ type: 'model-progress', loaded, total, fromCache: false })
    }
  }
  post({ type: 'model-progress', loaded, total: total || loaded, fromCache: false })

  let model: Uint8Array<ArrayBuffer>
  if (bytes && chunks.length === 0 && loaded === bytes.length) {
    model = bytes
  }
  else {
    // Unknown or wrong content-length (e.g. compressed transfer): concatenate.
    model = new Uint8Array(loaded)
    let off = 0
    if (bytes) {
      const head = Math.min(bytes.length, loaded)
      model.set(bytes.subarray(0, head), 0)
      off = head
    }
    for (const c of chunks) { model.set(c, off); off += c.length }
  }

  if (cache) {
    // A full quota only means the next visit downloads the model again.
    await cache.put(url, new Response(model, { headers: { 'content-type': 'application/octet-stream' } })).catch(() => {})
  }
  return model
}

/** WebGPU alone first, WASM only if WebGPU is unavailable or fails (inference_worker.js doInit). */
async function createSession(model: Uint8Array): Promise<{ session: ort.InferenceSession, backend: 'webgpu' | 'wasm' }> {
  const hasGpu = typeof navigator !== 'undefined' && 'gpu' in navigator && !!(navigator as Navigator & { gpu?: unknown }).gpu
  // logSeverityLevel 3 (errors only) keeps ORT's node-placement warnings out of the console.
  const commonOpts: ort.InferenceSession.SessionOptions = { graphOptimizationLevel: 'all', logSeverityLevel: 3 }
  try {
    if (!hasGpu) throw new Error('navigator.gpu unavailable in worker')
    return { session: await ort.InferenceSession.create(model, { executionProviders: ['webgpu'], ...commonOpts }), backend: 'webgpu' }
  }
  catch {
    return { session: await ort.InferenceSession.create(model, { executionProviders: ['wasm'], ...commonOpts }), backend: 'wasm' }
  }
}

async function loadModel(modelUrl: string, wasmPaths: string): Promise<void> {
  // Extension: ort.env.wasm.numThreads = 1 (no cross-origin isolation here either).
  ort.env.wasm.numThreads = 1
  ort.env.wasm.wasmPaths = wasmPaths
  ort.env.logLevel = 'error'

  // The downloaded bytes are only referenced by this call, so they can be
  // garbage-collected once ORT has its own copy.
  const model = await fetchModel(modelUrl)
  post({ type: 'model-initialising' })
  const created = await createSession(model)
  session = created.session
  const backend = created.backend

  try {
    const warmup = new ort.Tensor('float32', new Float32Array(WARMUP_FRAMES * NUM_MEL_BINS), [1, WARMUP_FRAMES, NUM_MEL_BINS])
    await withTimeout(session.run({ fbank: warmup }), WARMUP_TIMEOUT_MS)
  }
  catch {
    // Extension: a failed or slow warm-up is not fatal.
  }
  post({ type: 'model-ready', backend })
}

async function infer(fbank: Float32Array, numFrames: number, batch: number): Promise<Float32Array> {
  if (!session) throw new Error('session_not_ready')
  const results = await session.run({ fbank: new ort.Tensor('float32', fbank, [batch, numFrames, NUM_MEL_BINS]) })
  const output = results.probs ?? Object.values(results)[0]!
  const raw = output.data as Float32Array
  const probs = new Float32Array(batch)
  // [smack_0, neg_0, smack_1, neg_1, ...]; class 0 = mouth smack
  for (let i = 0; i < batch; i++) probs[i] = raw[i * 2]!
  return probs
}

// Jobs run one at a time, as in the extension (no overlapping session.run()).
let queue: Promise<void> = Promise.resolve()

async function runJob(msg: Extract<WorkerRequest, { type: 'process' }>) {
  const { jobId } = msg
  try {
    if (!session) {
      loading ??= loadModel(msg.modelUrl, msg.wasmPaths)
      try {
        await loading
      }
      catch (err) {
        loading = null
        session = null
        const message = err instanceof Error ? err.message : ''
        post({ type: 'error', jobId, code: message.startsWith('model_http_') || err instanceof TypeError ? 'model-download' : 'model-init' })
        return
      }
    }
    if (cancelled.has(jobId)) return

    const result = await processAudio(
      msg.channels,
      msg.sampleRate,
      infer,
      p => post({ type: 'progress', jobId, ...p }),
      () => cancelled.has(jobId),
    )
    for (const ch of result.channels) {
      for (let i = 0; i < ch.length; i++) {
        if (!Number.isFinite(ch[i]!)) throw new Error('non_finite_output')
      }
    }
    post({ type: 'result', jobId, channels: result.channels, events: result.events }, result.channels.map(c => c.buffer as ArrayBuffer))
  }
  catch (err) {
    if (err instanceof PipelineCancelled) return
    post({ type: 'error', jobId, code: 'processing' })
  }
  finally {
    cancelled.delete(jobId)
  }
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data
  if (msg.type === 'cancel') {
    cancelled.add(msg.jobId)
    return
  }
  if (msg.type === 'process') {
    queue = queue.then(() => runJob(msg))
  }
}
