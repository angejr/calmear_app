/**
 * CalmEar offline pipeline for a fully decoded clip.
 *
 * Reproduces the extension's streaming pipeline (calmear_extension/extension,
 * commit b17fb4b) on a buffer that is decoded up front:
 *
 *   offscreen.js   extractWindow / prepareOneBatch / drainInference
 *                  → 200 ms windows on a 100 ms grid, mono, 48k → 22.05k,
 *                    BEATs fbank, batches of 8, prob >= 0.95 → events
 *   offscreen.js   mergeEvents → merge events within 150 ms
 *   offscreen.js   sendReplacementClips / applyErsm → ERSM replacement clips
 *   smack-processor.js (AudioWorklet) → clips spliced into every channel
 *                  with the same crossfade
 *
 * Differences that only exist because the input is a file, not a stream:
 * the whole clip is available (no look-ahead, backpressure or clock anchor),
 * the PTS shift is 0 (sample i is at i / sampleRate), and every event is final
 * (no waiting for an event to stop growing).
 *
 * Pure code: no DOM, no ONNX runtime, no Nuxt. Inference is injected so the
 * browser worker, the example build script and the tests share it.
 */
import {
  BATCH_SIZE,
  CLIP_FADE_SAMPLES,
  DECODE_SAMPLE_RATE,
  DETECTION_THRESHOLD,
  ERSM_CONTEXT_MS,
  ERSM_REGION_PAD_MS,
  HOP_DURATION_S,
  MERGE_GAP_S,
  MODEL_INPUT_SAMPLE_RATE,
  NUM_MEL_BINS,
  WINDOW_DURATION_S,
} from './constants'
import { applyErsm } from './ersm'
import { preprocessClip, resample } from './preprocessing'

/** Web Audio render quantum: the worklet computes media time once per quantum. */
const RENDER_QUANTUM_FRAMES = 128

export interface SmackEvent {
  startPts_s: number
  endPts_s: number
  confidence: number
}

export interface ReplacementClip {
  startPts_s: number
  endPts_s: number
  samples: Float32Array
  sampleRate: number
  fadeSamples: number
}

/** Runs the model on B packed fbank windows; returns p(mouth smack) per window. */
export type InferBatch = (fbank: Float32Array, numFrames: number, batch: number) => Promise<Float32Array>

export interface PipelineProgress {
  windowsDone: number
  windowsTotal: number
}

export interface PipelineResult {
  channels: Float32Array[]
  /** Detected events that were suppressed (the extension skips a few edge cases). */
  events: SmackEvent[]
  /** Every detected event, merged. */
  detected: SmackEvent[]
}

export class PipelineCancelled extends Error {
  constructor() {
    super('cancelled')
    this.name = 'PipelineCancelled'
  }
}

/** Channel average, as the extension downmixes (offscreen.js extractWindow / extractPcmMono). */
export function toMono(channels: Float32Array[]): Float32Array {
  const ch = channels.length
  const len = channels[0]?.length ?? 0
  if (ch === 1) return channels[0]!
  const mono = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    let sum = 0
    for (let c = 0; c < ch; c++) sum += channels[c]![i]!
    mono[i] = sum / ch
  }
  return mono
}

/**
 * Window start times, in the order the extension analyses them: from the
 * first grid position (0) while the whole window is decoded, advancing the
 * cursor by HOP_DURATION_S (offscreen.js prepareOneBatch).
 */
export function planWindows(duration_s: number): number[] {
  const starts: number[] = []
  let cursor = 0
  while (cursor + WINDOW_DURATION_S <= duration_s) {
    starts.push(cursor)
    cursor += HOP_DURATION_S
  }
  return starts
}

/**
 * Model input for one window (offscreen.js extractWindow): mono samples from
 * startPts_s for duration_s, linearly resampled to 22 050 Hz. A window that
 * would read past the end of the clip is cut short (preprocessClip zero-pads).
 */
export function extractWindow(mono: Float32Array, sampleRate: number, startPts_s: number, duration_s: number): Float32Array {
  const srcStart = Math.round(startPts_s * sampleRate)
  const needed = Math.round(duration_s * sampleRate)
  const window = mono.slice(srcStart, Math.min(mono.length, srcStart + needed))
  if (sampleRate !== MODEL_INPUT_SAMPLE_RATE) {
    return resample(window, sampleRate, MODEL_INPUT_SAMPLE_RATE)
  }
  return window
}

/** offscreen.js mergeEvents: merge into the first event within MERGE_GAP_S or overlapping. */
export function mergeEvents(events: SmackEvent[], newEvents: SmackEvent[]): void {
  for (const e of newEvents) {
    let merged = false
    for (const existing of events) {
      if (Math.abs(e.startPts_s - existing.endPts_s) <= MERGE_GAP_S
        || Math.abs(existing.startPts_s - e.endPts_s) <= MERGE_GAP_S
        || (e.startPts_s <= existing.endPts_s && e.endPts_s >= existing.startPts_s)) {
        existing.startPts_s = Math.min(existing.startPts_s, e.startPts_s)
        existing.endPts_s = Math.max(existing.endPts_s, e.endPts_s)
        existing.confidence = Math.max(existing.confidence, e.confidence)
        merged = true
        break
      }
    }
    if (!merged) events.push(e)
  }
  events.sort((a, b) => a.startPts_s - b.startPts_s)
}

/**
 * Mono PCM for [startPts_s, startPts_s + duration_s] with a mask of real
 * samples (offscreen.js extractPcmMono). The clip is one decoded frame at PTS 0.
 */
function extractPcmMono(mono: Float32Array, sampleRate: number, startPts_s: number, duration_s: number) {
  const len = Math.round(duration_s * sampleRate)
  const samples = new Float32Array(len)
  const mask = new Uint8Array(len)
  const d0 = Math.round((0 - startPts_s) * sampleRate)
  for (let j = Math.max(0, -d0); j < mono.length; j++) {
    const d = d0 + j
    if (d >= len) break
    samples[d] = mono[j]!
    mask[d] = 1
  }
  return { samples, mask }
}

/**
 * ERSM replacement clip for one event (offscreen.js sendReplacementClips).
 * Returns null where the extension skips the event: region starting before
 * the audio, region not fully covered by audio, or non-finite output.
 */
export function buildReplacementClip(mono: Float32Array, sampleRate: number, e: SmackEvent): ReplacementClip | null {
  const ctxDur_s = ERSM_CONTEXT_MS / 1000
  const regPad_s = ERSM_REGION_PAD_MS / 1000
  const rawStart = e.startPts_s - regPad_s
  const rawEnd = e.endPts_s + regPad_s
  if (rawStart < 0) return null // 'pcm_gone'

  const blockStart = rawStart - ctxDur_s
  const blockDur = (rawEnd - rawStart) + 2 * ctxDur_s
  const { samples: block, mask } = extractPcmMono(mono, sampleRate, blockStart, blockDur)

  const regStartSamp = Math.round(ctxDur_s * DECODE_SAMPLE_RATE)
  const regEndSamp = regStartSamp + Math.round((rawEnd - rawStart) * DECODE_SAMPLE_RATE)
  const regLen = regEndSamp - regStartSamp

  let regionCovered = regEndSamp <= block.length
  for (let i = regStartSamp; regionCovered && i < regEndSamp; i++) if (!mask[i]) regionCovered = false
  if (!regionCovered) return null // 'pcm_incomplete'

  let head = 0
  while (head < regStartSamp && mask[regStartSamp - 1 - head]) head++
  let tail = 0
  while (regEndSamp + tail < block.length && mask[regEndSamp + tail]) tail++

  const trimmed = block.subarray(regStartSamp - head, regEndSamp + tail)
  const processedRegion = applyErsm(trimmed, head, head + regLen)
  for (let i = 0; i < processedRegion.length; i++) {
    if (!Number.isFinite(processedRegion[i]!)) return null // 'non_finite'
  }

  const pad = Math.min(CLIP_FADE_SAMPLES, head, tail)
  const samples = new Float32Array(regLen + 2 * pad)
  samples.set(trimmed.subarray(head - pad, head), 0)
  samples.set(processedRegion, pad)
  samples.set(trimmed.subarray(head + regLen, head + regLen + pad), pad + regLen)

  const padS = pad / sampleRate + regPad_s
  return {
    startPts_s: e.startPts_s - padS,
    endPts_s: e.endPts_s + padS,
    samples,
    sampleRate,
    fadeSamples: pad,
  }
}

/**
 * Splice replacement clips into every channel exactly as the AudioWorklet
 * does (smack-processor.js process): one clip at a time, latched once it
 * starts, crossfaded over its unprocessed padding; out = in·(1−a) + clip·a.
 * Media time follows the worklet clock anchored at 0: each 128-frame render
 * quantum starts at frame / sampleRate and advances by 1 / sampleRate per
 * sample. Element volume is 1 and there is no attenuation (the extension
 * schedules it with gain 1.0).
 */
export function applyReplacementClips(channels: Float32Array[], sampleRate: number, clips: ReplacementClip[]): Float32Array[] {
  const out = channels.map(c => c.slice())
  const sorted = [...clips].sort((a, b) => a.startPts_s - b.startPts_s)
  const len = channels[0]?.length ?? 0
  const dt = 1 / sampleRate

  let active: ReplacementClip | null = null
  let pos = 0
  let entry = 0
  let mediaTime = 0
  for (let n = 0; n < len; n++, mediaTime += dt) {
    if (n % RENDER_QUANTUM_FRAMES === 0) mediaTime = n / sampleRate
    if (!active) {
      for (const c of sorted) {
        if (c.startPts_s > mediaTime) break
        if (mediaTime < c.endPts_s) {
          pos = Math.round((mediaTime - c.startPts_s) * c.sampleRate)
          entry = pos
          active = c
          break
        }
      }
    }
    if (!active) continue

    const clipLen = active.samples.length
    const clipIdx = Math.floor(pos)
    if (clipIdx >= 0 && clipIdx < clipLen) {
      const frac = pos - clipIdx
      const v0 = active.samples[clipIdx]!
      const v = frac > 0 && clipIdx + 1 < clipLen ? v0 + (active.samples[clipIdx + 1]! - v0) * frac : v0
      const fade = active.fadeSamples > 0 ? active.fadeSamples : 1
      const a = Math.min(1, (pos - entry + 1) / fade, (clipLen - pos) / fade)
      // The worklet stores these in Float32Arrays (mixScale / mixAdd).
      const scale = Math.fround(1 - a)
      const add = Math.fround(v * a)
      for (let c = 0; c < out.length; c++) out[c]![n] = channels[c]![n]! * scale + add
    }
    pos = pos + active.sampleRate / sampleRate
    if (pos >= clipLen) active = null
  }
  return out
}

/**
 * Detect mouth smacks and produce the CalmEar-processed channels.
 * `channels` must be decoded at DECODE_SAMPLE_RATE (48 kHz), as in the extension.
 */
export async function processAudio(
  channels: Float32Array[],
  sampleRate: number,
  infer: InferBatch,
  onProgress?: (p: PipelineProgress) => void,
  isCancelled?: () => boolean,
): Promise<PipelineResult> {
  if (sampleRate !== DECODE_SAMPLE_RATE) {
    throw new Error(`Audio must be decoded at ${DECODE_SAMPLE_RATE} Hz`)
  }
  const mono = toMono(channels)
  const starts = planWindows(mono.length / sampleRate)
  const events: SmackEvent[] = []

  onProgress?.({ windowsDone: 0, windowsTotal: starts.length })
  for (let b = 0; b < starts.length; b += BATCH_SIZE) {
    if (isCancelled?.()) throw new PipelineCancelled()
    const batchStarts = starts.slice(b, b + BATCH_SIZE)
    const fbanks = batchStarts.map(s => preprocessClip(extractWindow(mono, sampleRate, s, WINDOW_DURATION_S)))
    const numFrames = fbanks[0]!.numFrames
    const packed = new Float32Array(fbanks.length * numFrames * NUM_MEL_BINS)
    fbanks.forEach((f, i) => packed.set(f.fbank, i * numFrames * NUM_MEL_BINS))

    const probs = await infer(packed, numFrames, fbanks.length)

    const newEvents: SmackEvent[] = []
    for (let i = 0; i < batchStarts.length; i++) {
      const prob = probs[i]!
      if (prob >= DETECTION_THRESHOLD) {
        const start = batchStarts[i]!
        newEvents.push({ startPts_s: start, endPts_s: start + WINDOW_DURATION_S, confidence: prob })
      }
    }
    if (newEvents.length > 0) mergeEvents(events, newEvents)
    onProgress?.({ windowsDone: Math.min(b + BATCH_SIZE, starts.length), windowsTotal: starts.length })
  }

  if (isCancelled?.()) throw new PipelineCancelled()
  const clips: ReplacementClip[] = []
  const suppressed: SmackEvent[] = []
  for (const e of events) {
    const clip = buildReplacementClip(mono, sampleRate, e)
    if (clip) {
      clips.push(clip)
      suppressed.push({ ...e })
    }
  }

  return {
    channels: applyReplacementClips(channels, sampleRate, clips),
    events: suppressed,
    detected: events.map(e => ({ ...e })),
  }
}
