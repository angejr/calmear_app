/**
 * Builds the pre-processed "Try an example" clips for the landing-page demo.
 *
 *   npm run demo:examples [-- --config <examples.json>] [--out <dir>] [--model <model.onnx>]
 *   npm run demo:examples -- --peaks-only   # only (re)compute duration_s and the
 *                                           # waveform peaks of the examples already
 *                                           # in <out>/manifest.json (no model run)
 *
 * For each example listed in demo-examples/examples.json:
 *   1. ffmpeg decodes the source recording to 48 kHz stereo float PCM
 *      (the rate the extension decodes and processes at);
 *   2. the demo pipeline (app/lib/calmear-demo, a port of the extension that
 *      parity.test.ts checks against it) runs the extension's model with
 *      onnxruntime-web 1.27.0 (WASM backend, as the browser fallback);
 *   3. the original and the processed PCM are both encoded with the same AAC
 *      settings, so the comparison is fair, and the manifest is written.
 *
 * examples.json:
 *   { "examples": [ { "id": "chewing", "title": "Chewing", "description": "...",
 *                     "source": "src/chewing.mp4", "start": 0, "duration": 12 } ] }
 * `source` is relative to the config file. `start` / `duration` are optional (seconds).
 * Only use recordings CalmEar has the right to publish.
 *
 * Requires ffmpeg on PATH.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as ort from 'onnxruntime-web'
import { DECODE_SAMPLE_RATE, NUM_MEL_BINS } from '../app/lib/calmear-demo/constants'
import { processAudio } from '../app/lib/calmear-demo/pipeline'
import { computePeaks } from '../app/lib/calmear-demo/waveform'

const MAX_DURATION_S = 15
const AAC_BITRATE = '192k'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const configPath = resolve(arg('config') ?? join(root, 'demo-examples', 'examples.json'))
const outDir = resolve(arg('out') ?? join(root, 'public', 'demo', 'examples'))
const modelPath = resolve(arg('model') ?? process.env.CALMEAR_MODEL_PATH ?? [
  join(root, 'public', 'demo', 'model', 'model.onnx'),
  resolve(root, '..', '..', '..', 'calmear_extension', 'extension', 'model', 'model.onnx'),
].find(p => existsSync(p)) ?? 'model.onnx')

interface ExampleConfig {
  id: string
  title: string
  description: string
  source: string
  start?: number
  duration?: number
}

function run(cmd: string, args: string[], input?: Buffer): Promise<Buffer> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    const out: Buffer[] = []
    const err: Buffer[] = []
    child.stdout.on('data', d => out.push(d))
    child.stderr.on('data', d => err.push(d))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolvePromise(Buffer.concat(out))
      else reject(new Error(`${cmd} exited with ${code}: ${Buffer.concat(err).toString().trim()}`))
    })
    if (input) child.stdin.end(input)
    else child.stdin.end()
  })
}

/** Waveform shown before the audio is downloaded: duration and bar levels of the original. */
function waveformInfo(channels: Float32Array[]) {
  return {
    duration_s: Math.round((channels[0]!.length / DECODE_SAMPLE_RATE) * 1000) / 1000,
    peaks: computePeaks(channels),
  }
}

async function updatePeaksOnly() {
  const manifestPath = join(outDir, 'manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { examples: Array<{ id: string, original: string }> }
  for (const ex of manifest.examples) {
    const file = join(outDir, ex.id, 'original.m4a')
    console.warn(`[${ex.id}] waveform from ${relative(process.cwd(), file)}`)
    Object.assign(ex, waveformInfo(await decode(file)))
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  console.warn(`Updated ${manifest.examples.length} example(s) in ${relative(process.cwd(), manifestPath)}`)
}

async function decode(source: string, start?: number, duration?: number): Promise<Float32Array[]> {
  const args = ['-v', 'error']
  if (start !== undefined) args.push('-ss', String(start))
  if (duration !== undefined) args.push('-t', String(duration))
  args.push('-i', source, '-vn', '-ac', '2', '-ar', String(DECODE_SAMPLE_RATE), '-f', 'f32le', 'pipe:1')
  const pcm = await run('ffmpeg', args)
  const interleaved = new Float32Array(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength))
  const len = interleaved.length / 2
  const left = new Float32Array(len)
  const right = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    left[i] = interleaved[i * 2]!
    right[i] = interleaved[i * 2 + 1]!
  }
  return [left, right]
}

async function encodeAac(channels: Float32Array[], dest: string): Promise<void> {
  const len = channels[0]!.length
  const interleaved = new Float32Array(len * channels.length)
  for (let i = 0; i < len; i++) for (let c = 0; c < channels.length; c++) interleaved[i * channels.length + c] = channels[c]![i]!
  await run('ffmpeg', [
    '-v', 'error', '-y',
    '-f', 'f32le', '-ar', String(DECODE_SAMPLE_RATE), '-ac', String(channels.length), '-i', 'pipe:0',
    '-c:a', 'aac', '-b:a', AAC_BITRATE, '-movflags', '+faststart', dest,
  ], Buffer.from(interleaved.buffer))
}

async function main() {
  if (process.argv.includes('--peaks-only')) return updatePeaksOnly()
  if (!existsSync(configPath)) {
    console.error(`No example config at ${configPath}. See the header of this script for the format.`)
    process.exit(1)
  }
  if (!existsSync(modelPath)) {
    console.error(`Model not found at ${modelPath}. Pass --model or set CALMEAR_MODEL_PATH.`)
    process.exit(1)
  }
  const config = JSON.parse(readFileSync(configPath, 'utf8')) as { examples: ExampleConfig[] }

  ort.env.wasm.numThreads = 1
  console.warn(`Loading ${relative(process.cwd(), modelPath)}...`)
  const session = await ort.InferenceSession.create(new Uint8Array(readFileSync(modelPath)), {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  })
  const infer = async (fbank: Float32Array, numFrames: number, batch: number) => {
    const results = await session.run({ fbank: new ort.Tensor('float32', fbank, [batch, numFrames, NUM_MEL_BINS]) })
    const raw = (results.probs ?? Object.values(results)[0]!).data as Float32Array
    return Float32Array.from({ length: batch }, (_, i) => raw[i * 2]!)
  }

  const manifest: { examples: unknown[] } = { examples: [] }
  for (const ex of config.examples) {
    if (!/^[a-z0-9-]+$/.test(ex.id)) throw new Error(`Invalid example id "${ex.id}" (use a-z, 0-9, -)`)
    const source = resolve(dirname(configPath), ex.source)
    console.warn(`[${ex.id}] decoding ${relative(process.cwd(), source)}`)
    const channels = await decode(source, ex.start, ex.duration)
    const duration_s = channels[0]!.length / DECODE_SAMPLE_RATE
    if (duration_s > MAX_DURATION_S + 0.05) throw new Error(`[${ex.id}] ${duration_s.toFixed(1)} s is longer than ${MAX_DURATION_S} s; set "duration"`)

    const result = await processAudio(channels, DECODE_SAMPLE_RATE, infer)
    console.warn(`[${ex.id}] ${duration_s.toFixed(2)} s, ${result.detected.length} detected, ${result.events.length} suppressed`)

    const dir = join(outDir, ex.id)
    mkdirSync(dir, { recursive: true })
    await encodeAac(channels, join(dir, 'original.m4a'))
    await encodeAac(result.channels, join(dir, 'processed.m4a'))

    const urlBase = `/demo/examples/${ex.id}`
    manifest.examples.push({
      id: ex.id,
      title: ex.title,
      description: ex.description,
      original: `${urlBase}/original.m4a`,
      processed: `${urlBase}/processed.m4a`,
      ...waveformInfo(channels),
      events: result.events.map(e => ({
        startPts_s: Math.round(e.startPts_s * 1000) / 1000,
        endPts_s: Math.round(e.endPts_s * 1000) / 1000,
        confidence: Math.round(e.confidence * 10000) / 10000,
      })),
    })
  }

  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  console.warn(`Wrote ${manifest.examples.length} example(s) to ${relative(process.cwd(), outDir)}`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
