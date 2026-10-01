/**
 * Behaviour of the demo's offline pipeline around the (injected) model:
 * window grid, batching, threshold, merging and output. Numerical parity of
 * each stage with the extension is covered by parity.test.ts.
 */
import { describe, expect, it } from 'vitest'
import { BATCH_SIZE, NUM_MEL_BINS } from '../../app/lib/calmear-demo/constants'
import { PipelineCancelled, planWindows, processAudio, type InferBatch } from '../../app/lib/calmear-demo/pipeline'

const SR = 48000

function tone(duration_s: number, channels = 2): Float32Array[] {
  const len = Math.round(duration_s * SR)
  return Array.from({ length: channels }, (_, c) =>
    Float32Array.from({ length: len }, (_, i) => 0.1 * Math.sin((2 * Math.PI * (220 + 110 * c) * i) / SR)))
}

/** Fake model: returns the probability given for each window start (by grid index). */
function fakeModel(probFor: (windowIndex: number) => number) {
  const calls: number[] = []
  let index = 0
  const infer: InferBatch = async (fbank, numFrames, batch) => {
    expect(fbank.length).toBe(batch * numFrames * NUM_MEL_BINS)
    expect(numFrames).toBe(18) // 3200 samples at 16 kHz, 400-sample frames, 160 hop
    calls.push(batch)
    return Float32Array.from({ length: batch }, () => probFor(index++))
  }
  return { infer, calls }
}

describe('planWindows', () => {
  it('uses 200 ms windows on a 100 ms grid that fit in the clip', () => {
    expect(planWindows(1)).toHaveLength(9)
    expect(planWindows(0.19)).toHaveLength(0)
    const starts = planWindows(15)
    expect(starts).toHaveLength(149)
    expect(starts[0]).toBe(0)
    expect(starts.at(-1)! + 0.2).toBeLessThanOrEqual(15)
  })
})

describe('processAudio', () => {
  it('batches windows by 8 and reports progress', async () => {
    const { infer, calls } = fakeModel(() => 0)
    const progress: number[] = []
    await processAudio(tone(2.05), SR, infer, p => progress.push(p.windowsDone))
    expect(calls.reduce((a, b) => a + b, 0)).toBe(19)
    expect(calls).toEqual([BATCH_SIZE, BATCH_SIZE, 3])
    expect(progress).toEqual([0, 8, 16, 19])
  })

  it('leaves the audio untouched when nothing is detected', async () => {
    const input = tone(1.5)
    const { infer } = fakeModel(() => 0.949)
    const result = await processAudio(input, SR, infer)
    expect(result.events).toEqual([])
    expect(result.detected).toEqual([])
    result.channels.forEach((ch, c) => expect(ch).toEqual(input[c]))
    expect(result.channels[0]).not.toBe(input[0])
  })

  it('applies the 0.95 threshold and merges neighbouring windows', async () => {
    // Windows 5, 6 (overlapping) and 8 (gap 0.1 s <= 150 ms) form one event; 20 is separate.
    // Window 3 is float32(0.95) = 0.9499999881: below the threshold, as in the
    // extension, whose worker also returns probabilities as a Float32Array.
    const probs: Record<number, number> = { 3: 0.95, 5: 0.9501, 6: 0.99, 8: 0.97, 20: 0.96 }
    const { infer } = fakeModel(i => probs[i] ?? 0.1)
    const result = await processAudio(tone(3), SR, infer)
    expect(result.events).toHaveLength(2)
    expect(result.events[0]!.startPts_s).toBeCloseTo(0.5, 9)
    expect(result.events[0]!.endPts_s).toBeCloseTo(1.0, 9)
    expect(result.events[0]!.confidence).toBeCloseTo(0.99, 6)
    expect(result.events[1]!.startPts_s).toBeCloseTo(2.0, 9)
    expect(result.detected).toHaveLength(2)
  })

  it('only changes the audio around detected events and keeps every channel', async () => {
    const input = tone(3)
    const { infer } = fakeModel(i => (i === 12 ? 0.99 : 0))
    const result = await processAudio(input, SR, infer)
    expect(result.channels).toHaveLength(2)
    // Event 1.2–1.4 s; clip = event ± (20 ms region pad + 5 ms fade pad).
    const lo = Math.floor((1.2 - 0.025) * SR) - 1
    const hi = Math.ceil((1.4 + 0.025) * SR) + 1
    for (let c = 0; c < 2; c++) {
      for (let i = 0; i < input[c]!.length; i++) {
        if (i < lo || i > hi) {
          if (result.channels[c]![i] !== input[c]![i]) throw new Error(`channel ${c} changed outside the clip at ${i}`)
        }
      }
    }
  })

  it('reports only suppressed events (an event at 0 s has no room for the region padding)', async () => {
    const { infer } = fakeModel(i => (i === 0 || i === 10 ? 0.99 : 0))
    const result = await processAudio(tone(2), SR, infer)
    expect(result.detected).toHaveLength(2)
    expect(result.events).toHaveLength(1)
    expect(result.events[0]!.startPts_s).toBeCloseTo(1.0, 9)
  })

  it('handles mono input', async () => {
    const { infer } = fakeModel(i => (i === 4 ? 0.99 : 0))
    const result = await processAudio(tone(1.2, 1), SR, infer)
    expect(result.channels).toHaveLength(1)
    expect(result.events).toHaveLength(1)
  })

  it('requires 48 kHz audio, like the extension', async () => {
    const { infer } = fakeModel(() => 0)
    await expect(processAudio(tone(1), 44100, infer)).rejects.toThrow('48000')
  })

  it('stops between batches when cancelled', async () => {
    const { infer, calls } = fakeModel(() => 0)
    let cancel = false
    const run = processAudio(tone(5), SR, infer, (p) => { if (p.windowsDone >= 16) cancel = true }, () => cancel)
    await expect(run).rejects.toBeInstanceOf(PipelineCancelled)
    expect(calls).toHaveLength(2)
  })
})
