/**
 * Main-thread side of the "See how it works" demo. Loaded with a dynamic
 * import() only when a visitor starts using the demo, so the landing page
 * never downloads the ML code, the ONNX runtime or the model otherwise.
 */
import { DECODE_SAMPLE_RATE } from './constants'
import type { SmackEvent } from './pipeline'
import type { WorkerErrorCode, WorkerRequest, WorkerResponse } from './protocol'

export const DEMO_LIMITS = {
  maxBytes: 50 * 1024 * 1024,
  minDuration_s: 1,
  maxDuration_s: 15,
  extensions: ['.mp4', '.webm'],
  mimeTypes: ['video/mp4', 'video/webm'],
} as const

/** Same-origin copies of the onnxruntime-web 1.27.0 WASM files (scripts/sync-demo-assets.mjs). */
const WASM_PATHS = '/demo/ort/'
const MODEL_CACHE_NAME = 'calmear-demo-model'
const SILENCE_PEAK = 1e-4

export type DemoErrorCode =
  | 'unsupported-browser'
  | 'unsupported-file'
  | 'file-too-large'
  | 'too-long'
  | 'too-short'
  | 'no-audio'
  | 'silent'
  | WorkerErrorCode

export const DEMO_ERROR_MESSAGES: Record<DemoErrorCode, string> = {
  'unsupported-browser': 'Your browser can\'t run this demo. Please try a recent version of Chrome, Edge or Firefox on a computer.',
  'unsupported-file': 'Please choose an MP4 or WebM video.',
  'file-too-large': 'This file is too large. Please choose a video under 50 MB.',
  'too-long': 'This clip is too long. Please choose a video of 15 seconds or less.',
  'too-short': 'This clip is too short. Please choose a video of at least 1 second.',
  'no-audio': 'We couldn\'t find any audio we can play in this video. Please try another clip.',
  'silent': 'This clip seems to be silent. Please choose a video with sound.',
  'model-download': 'We couldn\'t download the CalmEar model. Please check your connection and try again.',
  'model-init': 'CalmEar couldn\'t start on this device. It works best in a recent desktop browser with enough free memory.',
  'processing': 'Something went wrong while processing your clip. Please try again or choose another clip.',
}

export class DemoError extends Error {
  constructor(public readonly code: DemoErrorCode) {
    super(code)
    this.name = 'DemoError'
  }
}

/** Thrown by DemoProcessor.process() when the job was cancelled or replaced. */
export class DemoCancelled extends Error {
  constructor() {
    super('cancelled')
    this.name = 'DemoCancelled'
  }
}

export interface DemoResult {
  original: AudioBuffer
  processed: AudioBuffer
  events: SmackEvent[]
}

export interface DemoExample {
  id: string
  title: string
  description: string
  original: string
  processed: string
  /** Precomputed by scripts/build-demo-examples.ts so the waveform shows before the audio loads. */
  duration_s?: number
  peaks?: number[]
  events: SmackEvent[]
}

export function isBrowserSupported(): boolean {
  return typeof window !== 'undefined'
    && typeof window.AudioContext === 'function'
    && typeof window.OfflineAudioContext === 'function'
    && typeof window.Worker === 'function'
    && typeof WebAssembly === 'object'
    && typeof ReadableStream === 'function'
}

/** Cheap checks before anything is read. Returns null when the file may be processed. */
export function validateFile(file: File): DemoErrorCode | null {
  const name = file.name.toLowerCase()
  const typeOk = (DEMO_LIMITS.mimeTypes as readonly string[]).includes(file.type)
  const extOk = DEMO_LIMITS.extensions.some(ext => name.endsWith(ext))
  if (!typeOk && !extOk) return 'unsupported-file'
  if (file.size > DEMO_LIMITS.maxBytes) return 'file-too-large'
  return null
}

function checkDuration(duration_s: number): DemoErrorCode | null {
  if (duration_s > DEMO_LIMITS.maxDuration_s + 0.05) return 'too-long'
  if (duration_s < DEMO_LIMITS.minDuration_s) return 'too-short'
  return null
}

/** Duration from the container metadata, without decoding (null if the browser can't tell). */
function probeDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    const done = (value: number | null) => {
      video.removeAttribute('src')
      video.load()
      URL.revokeObjectURL(url)
      resolve(value)
    }
    video.preload = 'metadata'
    video.muted = true
    video.onloadedmetadata = () => done(Number.isFinite(video.duration) ? video.duration : null)
    video.onerror = () => done(null)
    video.src = url
  })
}

/** Decode audio at 48 kHz, the rate the extension decodes and processes at. */
async function decodeAt48k(data: ArrayBuffer): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(1, 1, DECODE_SAMPLE_RATE)
  return await ctx.decodeAudioData(data)
}

function peak(buffer: AudioBuffer): number {
  let max = 0
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < data.length; i++) {
      const v = Math.abs(data[i]!)
      if (v > max) max = v
    }
  }
  return max
}

/**
 * Checks run as soon as a file is picked: type, size and (from the container
 * metadata, without decoding) duration. Returns null when it may be processed.
 */
export async function precheckFile(file: File): Promise<DemoErrorCode | null> {
  const invalid = validateFile(file)
  if (invalid) return invalid
  const probed = await probeDuration(file)
  return probed === null ? null : checkDuration(probed)
}

/** Validate and decode an uploaded video's audio track. Throws DemoError. */
export async function decodeUpload(file: File): Promise<AudioBuffer> {
  const invalid = validateFile(file)
  if (invalid) throw new DemoError(invalid)

  const probed = await probeDuration(file)
  if (probed !== null) {
    const bad = checkDuration(probed)
    if (bad) throw new DemoError(bad)
  }

  let buffer: AudioBuffer
  try {
    buffer = await decodeAt48k(await file.arrayBuffer())
  }
  catch {
    throw new DemoError('no-audio')
  }
  if (buffer.length === 0) throw new DemoError('no-audio')
  const bad = checkDuration(buffer.duration)
  if (bad) throw new DemoError(bad)
  if (peak(buffer) < SILENCE_PEAK) throw new DemoError('silent')
  return buffer
}

export async function isModelCached(modelUrl: string): Promise<boolean> {
  try {
    if (typeof caches === 'undefined') return false
    const cache = await caches.open(MODEL_CACHE_NAME)
    return !!(await cache.match(modelUrl))
  }
  catch {
    return false
  }
}

/** Whether the model still has to be downloaded, and its size when the server reports it. */
export async function modelDownloadInfo(modelUrl: string): Promise<{ cached: boolean, bytes: number | null }> {
  if (await isModelCached(modelUrl)) return { cached: true, bytes: null }
  try {
    const res = await fetch(modelUrl, { method: 'HEAD' })
    const bytes = Number(res.headers.get('content-length'))
    return { cached: false, bytes: res.ok && bytes > 0 ? bytes : null }
  }
  catch {
    return { cached: false, bytes: null }
  }
}

export interface ProcessCallbacks {
  onModelProgress?: (loaded: number, total: number) => void
  onModelInitialising?: () => void
  onProgress?: (windowsDone: number, windowsTotal: number) => void
}

/**
 * Owns the demo worker. The worker (and the loaded model) is reused across
 * clips; dispose() terminates it.
 */
export class DemoProcessor {
  private worker: Worker | null = null
  private nextJobId = 1
  private current: {
    jobId: number
    resolve: (r: { channels: Float32Array[], events: SmackEvent[] }) => void
    reject: (e: unknown) => void
    callbacks: ProcessCallbacks
  } | null = null

  constructor(private readonly modelUrl: string) {}

  private getWorker(): Worker {
    if (this.worker) return this.worker
    const worker = new Worker(new URL('./demo.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => this.onMessage(e.data)
    worker.onerror = () => {
      this.current?.reject(new DemoError('model-init'))
      this.current = null
      this.worker?.terminate()
      this.worker = null
    }
    this.worker = worker
    return worker
  }

  private onMessage(msg: WorkerResponse) {
    const job = this.current
    if (!job) return
    switch (msg.type) {
      case 'model-progress':
        job.callbacks.onModelProgress?.(msg.loaded, msg.total)
        break
      case 'model-initialising':
        job.callbacks.onModelInitialising?.()
        break
      case 'progress':
        if (msg.jobId === job.jobId) job.callbacks.onProgress?.(msg.windowsDone, msg.windowsTotal)
        break
      case 'result':
        if (msg.jobId !== job.jobId) return
        this.current = null
        job.resolve({ channels: msg.channels, events: msg.events })
        break
      case 'error':
        if (msg.jobId !== job.jobId) return
        this.current = null
        job.reject(new DemoError(msg.code))
        break
    }
  }

  async process(original: AudioBuffer, callbacks: ProcessCallbacks = {}): Promise<DemoResult> {
    this.cancel()
    const worker = this.getWorker()
    const jobId = this.nextJobId++
    // Copies: the original stays playable while the worker owns these.
    const channels = Array.from({ length: original.numberOfChannels }, (_, c) => original.getChannelData(c).slice())

    const { channels: out, events } = await new Promise<{ channels: Float32Array[], events: SmackEvent[] }>((resolve, reject) => {
      this.current = { jobId, resolve, reject, callbacks }
      const msg: WorkerRequest = {
        type: 'process',
        jobId,
        channels,
        sampleRate: original.sampleRate,
        modelUrl: this.modelUrl,
        wasmPaths: WASM_PATHS,
      }
      worker.postMessage(msg, channels.map(c => c.buffer as ArrayBuffer))
    })

    const processed = new AudioBuffer({ length: original.length, numberOfChannels: original.numberOfChannels, sampleRate: original.sampleRate })
    out.forEach((data, c) => processed.copyToChannel(data as Float32Array<ArrayBuffer>, c))
    return { original, processed, events }
  }

  /** Abandon the running job: its promise rejects with DemoCancelled and the worker stops it. */
  cancel() {
    const job = this.current
    if (!job) return
    this.current = null
    const msg: WorkerRequest = { type: 'cancel', jobId: job.jobId }
    this.worker?.postMessage(msg)
    job.reject(new DemoCancelled())
  }

  dispose() {
    this.cancel()
    this.worker?.terminate()
    this.worker = null
  }
}

/** Pre-processed example: both versions were produced offline by scripts/build-demo-examples.ts. */
export async function loadExample(example: DemoExample): Promise<DemoResult> {
  const fetchDecode = async (url: string) => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`example_http_${res.status}`)
    return decodeAt48k(await res.arrayBuffer())
  }
  try {
    const [original, processed] = await Promise.all([fetchDecode(example.original), fetchDecode(example.processed)])
    return { original, processed, events: example.events }
  }
  catch {
    throw new DemoError('processing')
  }
}
