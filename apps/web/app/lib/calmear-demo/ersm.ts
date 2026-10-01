/**
 * Energy-Ratio Spectral Masking (ERSM), ported line for line from
 * calmear_extension/extension/offscreen.js:972-1263 (commit b17fb4b).
 *
 * Do not "improve" this code: it must stay numerically identical to the
 * extension (checked by tests/calmear-demo/parity.test.ts).
 */
import {
  DECODE_SAMPLE_RATE,
  ERSM_ATT_DB,
  ERSM_CONTEXT_MS,
  ERSM_FFT_SIZE,
  ERSM_HOP_SIZE,
  ERSM_STRENGTH,
  ERSM_THRESHOLD,
} from './constants'

interface StftFrame { mag: Float32Array, phase: Float32Array }

function hannWindow(N: number): Float32Array {
  const w = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)))
  }
  return w
}

function fft(re: Float32Array, im: Float32Array): void {
  const N = re.length
  let j = 0
  for (let i = 1; i < N; i++) {
    let bit = N >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      let t = re[i]!; re[i] = re[j]!; re[j] = t
      t = im[i]!; im[i] = im[j]!; im[j] = t
    }
  }
  for (let len = 2; len <= N; len <<= 1) {
    const ang = (2 * Math.PI) / len
    const wRe = Math.cos(ang)
    const wIm = -Math.sin(ang)
    for (let i = 0; i < N; i += len) {
      let curRe = 1, curIm = 0
      for (let k = 0; k < len / 2; k++) {
        const uRe = re[i + k]!, uIm = im[i + k]!
        const vRe = re[i + k + len / 2]! * curRe - im[i + k + len / 2]! * curIm
        const vIm = re[i + k + len / 2]! * curIm + im[i + k + len / 2]! * curRe
        re[i + k] = uRe + vRe
        im[i + k] = uIm + vIm
        re[i + k + len / 2] = uRe - vRe
        im[i + k + len / 2] = uIm - vIm
        const nextRe = curRe * wRe - curIm * wIm
        curIm = curRe * wIm + curIm * wRe
        curRe = nextRe
      }
    }
  }
}

function ifft(re: Float32Array, im: Float32Array): void {
  for (let i = 0; i < im.length; i++) im[i] = -im[i]!
  fft(re, im)
  for (let i = 0; i < re.length; i++) {
    re[i] = re[i]! / re.length
    im[i] = -im[i]! / im.length
  }
}

function stft(signal: Float32Array, fftSize: number, hopSize: number): StftFrame[] {
  const win = hannWindow(fftSize)
  const K = fftSize / 2 + 1
  const frames: StftFrame[] = []
  for (let start = 0; start + fftSize <= signal.length; start += hopSize) {
    const reArr = new Float32Array(fftSize)
    const imArr = new Float32Array(fftSize)
    for (let i = 0; i < fftSize; i++) reArr[i] = (signal[start + i] || 0) * win[i]!
    fft(reArr, imArr)
    const mag = new Float32Array(K)
    const phase = new Float32Array(K)
    for (let k = 0; k < K; k++) {
      mag[k] = Math.sqrt(reArr[k]! * reArr[k]! + imArr[k]! * imArr[k]!)
      phase[k] = Math.atan2(imArr[k]!, reArr[k]!)
    }
    frames.push({ mag, phase })
  }
  return frames
}

function istft(frames: StftFrame[], fftSize: number, hopSize: number, outputLength: number): Float32Array {
  const win = hannWindow(fftSize)
  const output = new Float32Array(outputLength)
  const norm = new Float32Array(outputLength)
  const K = fftSize / 2 + 1
  frames.forEach((fr, fi) => {
    const reArr = new Float32Array(fftSize)
    const imArr = new Float32Array(fftSize)
    for (let k = 0; k < K; k++) {
      reArr[k] = fr.mag[k]! * Math.cos(fr.phase[k]!)
      imArr[k] = fr.mag[k]! * Math.sin(fr.phase[k]!)
      if (k > 0 && k < K - 1) {
        reArr[fftSize - k] = reArr[k]!
        imArr[fftSize - k] = -imArr[k]!
      }
    }
    ifft(reArr, imArr)
    const start = fi * hopSize
    for (let i = 0; i < fftSize && start + i < outputLength; i++) {
      output[start + i]! += reArr[i]! * win[i]!
      norm[start + i]! += win[i]! * win[i]!
    }
  })
  for (let i = 0; i < outputLength; i++) {
    if (norm[i]! > 1e-8) output[i] = output[i]! / norm[i]!
  }
  return output
}

function buildFrameWeights(nFrames: number, rampFrames: number, wet: number): Float32Array {
  const w = new Float32Array(nFrames)
  const ramp = Math.max(1, Math.min(rampFrames, Math.floor(nFrames / 2)))
  for (let fi = 0; fi < nFrames; fi++) {
    const dist = Math.min(fi, nFrames - 1 - fi)
    const alpha = dist >= ramp ? 1.0 : 0.5 * (1 - Math.cos(Math.PI * dist / ramp))
    w[fi] = alpha * wet
  }
  return w
}

function spliceCrossfade(processed: Float32Array, original: Float32Array, fadeSamples: number): void {
  const n = processed.length
  for (let i = 0; i < fadeSamples && i < n; i++) {
    const alpha = i / fadeSamples
    processed[i] = processed[i]! * alpha + original[i]! * (1 - alpha)
    const tail = n - 1 - i
    processed[tail] = processed[tail]! * alpha + original[tail]! * (1 - alpha)
  }
}

/**
 * Apply ERSM to a mono 48 kHz block (offscreen.js applyErsm). regStartSamp /
 * regEndSamp are indices within `block`; the audio around them is context
 * used to estimate the background spectrum. Returns only the processed region.
 */
export function applyErsm(block: Float32Array, regStartSamp: number, regEndSamp: number): Float32Array {
  const fftSize = ERSM_FFT_SIZE
  const hopSize = ERSM_HOP_SIZE
  const energyRatioThreshold = ERSM_THRESHOLD
  const attGain = Math.pow(10, ERSM_ATT_DB / 20)
  const maskingStrength = ERSM_STRENGTH
  const contextSamp = Math.round((ERSM_CONTEXT_MS / 1000) * DECODE_SAMPLE_RATE)

  const regLen = regEndSamp - regStartSamp
  const regionSig = block.slice(regStartSamp, regEndSamp)

  const ctxBefore = block.slice(Math.max(0, regStartSamp - contextSamp), regStartSamp)
  const ctxAfter = block.slice(regEndSamp, Math.min(block.length, regEndSamp + contextSamp))

  const K = fftSize / 2 + 1

  function meanBinEnergy(sig: Float32Array): Float32Array {
    const frames = stft(sig, fftSize, hopSize)
    const energy = new Float32Array(K)
    if (frames.length === 0) return energy
    for (const fr of frames) {
      for (let k = 0; k < K; k++) energy[k]! += fr.mag[k]! * fr.mag[k]!
    }
    for (let k = 0; k < K; k++) energy[k]! /= frames.length
    return energy
  }

  const ctxEnergy = new Float32Array(K)
  const ebefore = meanBinEnergy(ctxBefore)
  const eafter = meanBinEnergy(ctxAfter)
  let ctxCount = 0
  if (ctxBefore.length >= fftSize) { for (let k = 0; k < K; k++) ctxEnergy[k]! += ebefore[k]!; ctxCount++ }
  if (ctxAfter.length >= fftSize) { for (let k = 0; k < K; k++) ctxEnergy[k]! += eafter[k]!; ctxCount++ }
  if (ctxCount === 0) {
    for (let k = 0; k < K; k++) ctxEnergy[k] = 1e-8
    ctxCount = 1
  }
  for (let k = 0; k < K; k++) ctxEnergy[k]! /= ctxCount

  const frames = stft(regionSig, fftSize, hopSize)
  if (frames.length === 0) return regionSig.slice()

  const weights = buildFrameWeights(frames.length, 3, maskingStrength)
  for (let fi = 0; fi < frames.length; fi++) {
    const fr = frames[fi]!
    const wet = weights[fi]!
    const dry = 1 - wet
    for (let k = 0; k < K; k++) {
      const smackE = fr.mag[k]! * fr.mag[k]!
      const ctxE = ctxEnergy[k]! + 1e-10
      const ratio = smackE / ctxE
      const gain = ratio > energyRatioThreshold ? attGain : 1.0
      fr.mag[k] = fr.mag[k]! * (dry + wet * gain)
    }
  }

  const processed = istft(frames, fftSize, hopSize, regLen)
  spliceCrossfade(processed, regionSig, Math.min(64, Math.floor(regLen / 8)))
  return processed
}
