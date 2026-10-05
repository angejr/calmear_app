/**
 * Parity between the landing-page demo port (app/lib/calmear-demo) and the
 * CalmEar extension, which is the source of truth for detection and
 * suppression. The extension's own files are loaded in a node:vm sandbox with
 * chrome/worker APIs stubbed out, and both implementations are run on the
 * same seeded signals. Results must be bit-identical.
 *
 * One deliberate difference: the demo uses its own ERSM_ATT_DB (see
 * constants.ts), so the extension's value is replaced by the demo's before
 * its code is loaded. Everything else is the extension's code as shipped.
 *
 * Skipped when the extension repository is not next to this one (e.g. in the
 * Docker build). Point CALMEAR_EXTENSION_DIR at calmear_extension/extension to
 * run it from elsewhere.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import { ERSM_ATT_DB } from '../../app/lib/calmear-demo/constants'
import { applyErsm } from '../../app/lib/calmear-demo/ersm'
import {
  applyReplacementClips,
  buildReplacementClip,
  extractWindow,
  mergeEvents,
  planWindows,
  toMono,
  type ReplacementClip,
  type SmackEvent,
} from '../../app/lib/calmear-demo/pipeline'
import { preprocessClip, resample } from '../../app/lib/calmear-demo/preprocessing'

const here = dirname(fileURLToPath(import.meta.url))
const EXT_DIR = process.env.CALMEAR_EXTENSION_DIR
  || resolve(here, '..', '..', '..', '..', '..', 'calmear_extension', 'extension')
const hasExtension = existsSync(join(EXT_DIR, 'offscreen.js'))

const SR = 48000

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Stereo background noise with short loud click bursts (smack-like transients). */
function syntheticClip(seed: number, duration_s: number, clickTimes: number[]): Float32Array[] {
  const rand = rng(seed)
  const len = Math.round(duration_s * SR)
  const left = new Float32Array(len)
  const right = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    const n = (rand() * 2 - 1) * 0.02
    left[i] = n + 0.05 * Math.sin((2 * Math.PI * 220 * i) / SR)
    right[i] = n * 0.8 + 0.04 * Math.sin((2 * Math.PI * 330 * i) / SR)
  }
  for (const t of clickTimes) {
    const start = Math.round(t * SR)
    for (let i = 0; i < 480 && start + i < len; i++) {
      const burst = (rand() * 2 - 1) * 0.6 * Math.exp(-i / 90)
      left[start + i]! += burst
      right[start + i]! += burst * 0.9
    }
  }
  return [left, right]
}

function expectSameFloats(actual: ArrayLike<number>, expected: ArrayLike<number>) {
  expect(actual.length).toBe(expected.length)
  let firstDiff = -1
  for (let i = 0; i < actual.length; i++) {
    if (!Object.is(actual[i], expected[i])) { firstDiff = i; break }
  }
  expect(firstDiff, firstDiff >= 0 ? `first difference at ${firstDiff}: ${actual[firstDiff]} vs ${expected[firstDiff]}` : '').toBe(-1)
}

function base64ToFloat32(b64: string): Float32Array {
  const buf = Buffer.from(b64, 'base64')
  return new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
}

/** The clip as one decoded segment, the way offscreen.js stores PCM (_pcmSegments). */
function toSegment(channels: Float32Array[]) {
  const len = channels[0]!.length
  const ch = channels.length
  const samples = new Float32Array(len * ch)
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) samples[i * ch + c] = channels[c]![i]!
  return {
    startPts_s: 0,
    endPts_s: len / SR,
    sampleRate: SR,
    channels: ch,
    samples,
    frames: [{ pts_s: 0, duration_s: len / SR, sampleOffset: 0, sampleCount: len }],
  }
}

// ---------------------------------------------------------------------------
// Extension sandboxes
// ---------------------------------------------------------------------------

interface OffscreenSandbox {
  ctx: vm.Context
  messages: Array<Record<string, unknown>>
  run: <T>(code: string) => T
}

function loadOffscreen(): OffscreenSandbox {
  const noop = () => {}
  const messages: Array<Record<string, unknown>> = []
  class WorkerStub {
    onmessage = null
    onerror = null
    postMessage() {}
    terminate() {}
    addEventListener() {}
  }
  const ctx = vm.createContext({
    console: { log: noop, warn: noop, error: noop, info: noop, debug: noop },
    CalmEarLogger: { create: () => ({ log: noop, warn: noop, error: noop, info: noop, debug: noop }) },
    CALMEAR_CONFIG: {},
    chrome: {
      runtime: {
        onMessage: { addListener: noop },
        sendMessage: (m: Record<string, unknown>) => { messages.push(m); return Promise.resolve() },
        getURL: (p: string) => p,
      },
    },
    Worker: WorkerStub,
    setInterval: () => 0,
    clearInterval: noop,
    setTimeout: () => 0,
    clearTimeout: noop,
    performance,
    btoa,
    atob,
  })
  vm.runInContext(readFileSync(join(EXT_DIR, 'preprocessing.js'), 'utf8'), ctx, { filename: 'preprocessing.js' })
  const offscreen = readFileSync(join(EXT_DIR, 'offscreen.js'), 'utf8')
  const attPattern = /const ERSM_ATT_DB(\s*)= -?\d+(\.\d+)?;/
  if (!attPattern.test(offscreen)) throw new Error('ERSM_ATT_DB not found in offscreen.js')
  vm.runInContext(offscreen.replace(attPattern, `const ERSM_ATT_DB$1= ${ERSM_ATT_DB};`), ctx, { filename: 'offscreen.js' })
  return { ctx, messages, run: <T>(code: string) => vm.runInContext(code, ctx) as T }
}

function loadWorklet() {
  let Processor: (new (options: unknown) => {
    _onMessage: (msg: unknown) => void
    process: (inputs: Float32Array[][], outputs: Float32Array[][]) => boolean
  }) | null = null
  const noop = () => {}
  const ctx = vm.createContext({
    console: { log: noop, warn: noop, error: noop },
    AudioWorkletProcessor: class { port = { postMessage: noop, onmessage: null as unknown } },
    registerProcessor: (_name: string, cls: typeof Processor) => { Processor = cls },
    currentTime: 0,
    sampleRate: SR,
  })
  vm.runInContext(readFileSync(join(EXT_DIR, 'worklet', 'smack-processor.js'), 'utf8'), ctx, { filename: 'smack-processor.js' })
  return { ctx, Processor: Processor! }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(!hasExtension)('CalmEar demo port matches the extension', () => {
  const ext = hasExtension ? loadOffscreen() : (null as unknown as OffscreenSandbox)
  const extPre = hasExtension
    ? ext.run<{ preprocessClip: typeof preprocessClip, resample: typeof resample }>('Preprocessing')
    : null!

  it('resample (48 kHz → 22.05 kHz window)', () => {
    const rand = rng(1)
    const x = Float32Array.from({ length: 9600 }, () => rand() * 2 - 1)
    expectSameFloats(resample(x, 48000, 22050), extPre.resample(x, 48000, 22050))
  })

  it('preprocessClip (BEATs kaldi fbank + normalisation)', () => {
    for (const [seed, len] of [[2, 4410], [3, 4410], [4, 4000], [5, 5000]] as const) {
      const rand = rng(seed)
      const x = Float32Array.from({ length: len }, () => (rand() * 2 - 1) * 0.3)
      const ours = preprocessClip(x)
      const theirs = extPre.preprocessClip(x)
      expect(ours.numFrames).toBe(theirs.numFrames)
      expectSameFloats(ours.fbank, theirs.fbank)
    }
  })

  it('extractWindow (mono downmix + resample on the 100 ms grid)', () => {
    const channels = syntheticClip(6, 2.05, [0.4, 1.3])
    ext.ctx.__seg = toSegment(channels)
    ext.run('_pcmSegments = [__seg]; _ptsToVideoShift_s = 0;')
    const mono = toMono(channels)
    const starts = planWindows(channels[0]!.length / SR)
    expect(starts.length).toBe(19)
    for (const s of starts) {
      ext.ctx.__s = s
      expectSameFloats(extractWindow(mono, SR, s, 0.2), ext.run<Float32Array>('extractWindow(__s, WINDOW_DURATION_S)'))
    }
  })

  it('mergeEvents (150 ms gap, first match wins)', () => {
    for (let seed = 10; seed < 30; seed++) {
      const rand = rng(seed)
      const batches: SmackEvent[][] = []
      let t = 0
      for (let b = 0; b < 12; b++) {
        const batch: SmackEvent[] = []
        for (let i = 0; i < 8; i++, t += 0.1) {
          if (rand() < 0.3) batch.push({ startPts_s: t, endPts_s: t + 0.2, confidence: 0.95 + rand() * 0.05 })
        }
        batches.push(batch)
      }
      const ours: SmackEvent[] = []
      for (const b of batches) mergeEvents(ours, b.map(e => ({ ...e })))
      ext.ctx.__batches = JSON.parse(JSON.stringify(batches))
      const theirs = ext.run<SmackEvent[]>('_smackEvents = []; for (const b of __batches) mergeEvents(b); JSON.parse(JSON.stringify(_smackEvents))')
      expect(ours).toEqual(theirs)
    }
  })

  it('applyErsm (energy-ratio spectral masking)', () => {
    const channels = syntheticClip(7, 0.5, [0.2])
    const block = toMono(channels)
    const cases: Array<[number, number]> = [[4800, 4800 + 11520], [2000, 9000], [0, 5000], [4800, block.length]]
    for (const [a, b] of cases) {
      ext.ctx.__block = block
      ext.ctx.__a = a
      ext.ctx.__b = b
      expectSameFloats(applyErsm(block, a, b), ext.run<Float32Array>('applyErsm(__block, __a, __b)'))
    }
  })

  it('replacement clips (region padding, context, fade padding, skips)', () => {
    const duration = 4
    const channels = syntheticClip(8, duration, [0.05, 0.9, 2.2, 3.85])
    const mono = toMono(channels)
    const events: SmackEvent[] = [
      { startPts_s: 0, endPts_s: 0.2, confidence: 0.99 }, // starts at 0: skipped (region before the audio)
      { startPts_s: 0.1, endPts_s: 0.30000000000000004, confidence: 0.97 }, // short head context
      { startPts_s: 0.8, endPts_s: 1.1, confidence: 0.99 },
      { startPts_s: 2.1000000000000005, endPts_s: 2.5000000000000004, confidence: 0.96 },
      { startPts_s: 3.6999999999999997, endPts_s: 3.9, confidence: 0.98 }, // short tail context
      { startPts_s: 3.8, endPts_s: 4.0, confidence: 0.98 }, // region past the end: skipped
    ]

    ext.ctx.__seg = toSegment(channels)
    ext.ctx.__events = JSON.parse(JSON.stringify(events))
    ext.ctx.__duration = duration
    ext.messages.length = 0
    ext.run(`
      _pcmSegments = [__seg]; _ptsToVideoShift_s = 0; _pendingPcmBuffer = [];
      _ersmProcessed = new Set(); _ersmCache = new Map(); _ersmSkipLogged = new Set();
      _inflightBatches = []; _drainPendingMinStart = null; _analyzedUpToPts = __duration;
      _latestMetrics.playbackCurrentTime_s = 0;
      sendReplacementClips(__events, true);
    `)
    const sent = ext.messages.filter(m => m.type === 'replacement_clip')

    const ours = events.map(e => buildReplacementClip(mono, SR, e)).filter((c): c is ReplacementClip => c !== null)
    expect(ours.length).toBe(4)
    expect(sent.length).toBe(ours.length)
    ours.forEach((clip, i) => {
      const m = sent[i]!
      expect(clip.startPts_s).toBe(m.startPts_s)
      expect(clip.endPts_s).toBe(m.endPts_s)
      expect(clip.sampleRate).toBe(m.sampleRate)
      expect(clip.fadeSamples).toBe(m.fadeSamples)
      expectSameFloats(clip.samples, base64ToFloat32(m.samples as string))
    })
  })

  it('clip splice (AudioWorklet crossfade, stereo preserved)', () => {
    const duration = 3
    const channels = syntheticClip(9, duration, [0.7, 1.9])
    const mono = toMono(channels)
    const clips = [
      { startPts_s: 0.6000000000000001, endPts_s: 0.9, confidence: 0.99 },
      { startPts_s: 1.8, endPts_s: 2.2, confidence: 0.99 },
    ].map(e => buildReplacementClip(mono, SR, e)!)

    const ours = applyReplacementClips(channels, SR, clips)

    const { ctx, Processor } = loadWorklet()
    const proc = new Processor({ processorOptions: { pageSampleRate: SR } })
    proc._onMessage({ type: 'clock_anchor', videoTime_s: 0 })
    for (const c of clips) {
      proc._onMessage({ type: 'replacement_clip', startPts_s: c.startPts_s, endPts_s: c.endPts_s, samples: c.samples, sampleRate: c.sampleRate, fadeSamples: c.fadeSamples })
    }
    const len = channels[0]!.length
    const theirs = channels.map(() => new Float32Array(len))
    for (let f = 0; f < len; f += 128) {
      ctx.currentTime = f / SR
      const n = Math.min(128, len - f)
      const inputs = [channels.map((ch) => {
        const q = new Float32Array(128)
        q.set(ch.subarray(f, f + n))
        return q
      })]
      const outputs = [channels.map(() => new Float32Array(128))]
      proc.process(inputs, outputs)
      outputs[0]!.forEach((q, c) => theirs[c]!.set(q.subarray(0, n), f))
    }

    ours.forEach((ch, c) => expectSameFloats(ch, theirs[c]!))
    // Sanity: the splice changed the audio inside the clips only.
    let changed = 0
    for (let i = 0; i < len; i++) if (ours[0]![i] !== channels[0]![i]) changed++
    expect(changed).toBeGreaterThan(0)
    expect(changed).toBeLessThanOrEqual(clips.reduce((s, c) => s + c.samples.length, 0))
  })
})
