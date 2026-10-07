/**
 * Waveform bars for the demo player: RMS level per bar, scaled so the loudest
 * bar is 1. Pure; used by the browser (uploads) and by
 * scripts/build-demo-examples.ts (precomputed into the examples manifest, so
 * the example's waveform renders before any audio is downloaded).
 */
export const WAVEFORM_BARS = 96

export function computePeaks(channels: Float32Array[], bars = WAVEFORM_BARS): number[] {
  const len = channels[0]?.length ?? 0
  const per = Math.max(1, Math.floor(len / bars))
  const levels: number[] = []
  for (let b = 0; b < bars; b++) {
    const start = b * per
    const end = b === bars - 1 ? len : Math.min(len, start + per)
    let sum = 0
    let n = 0
    for (const ch of channels) {
      for (let i = start; i < end; i++) sum += ch[i]! * ch[i]!
      n += Math.max(0, end - start)
    }
    levels.push(n > 0 ? Math.sqrt(sum / n) : 0)
  }
  const max = Math.max(...levels, 1e-9)
  return levels.map(v => Math.round((v / max) * 1000) / 1000)
}
