/**
 * BEATs preprocessing, ported line for line from
 * calmear_extension/extension/preprocessing.js (commit b17fb4b).
 *
 *   Float32Array (22050 Hz, 200 ms = 4410 samples)
 *     → resampleTo16k()      → Float32Array (16000 Hz, ~3200 samples)
 *     → computeKaldiFbank()  → Float32Array (T_frames × 128)
 *     → normalizeFbank()     → Float32Array (T_frames × 128)  ← ONNX input
 *
 * Do not "improve" this code: it must stay numerically identical to the
 * extension (checked by tests/calmear-demo/parity.test.ts).
 */
import {
  BACKBONE_SR,
  CLIP_SAMPLES,
  DATASET_SR,
  FBANK_MEAN,
  FBANK_STD,
  FRAME_LENGTH_MS,
  FRAME_SHIFT_MS,
  NUM_MEL_BINS,
} from './constants'

const SAMPLE_FREQ = BACKBONE_SR

/** Linear-interpolation resampler (preprocessing.js:68-84). */
export function resample(samples: Float32Array, srcSR: number, dstSR: number): Float32Array {
  if (srcSR === dstSR) return samples

  const ratio = srcSR / dstSR
  const outLen = Math.round(samples.length * dstSR / srcSR)
  const out = new Float32Array(outLen)
  const inLen = samples.length

  for (let i = 0; i < outLen; i++) {
    const src = i * ratio
    const lo = Math.floor(src)
    const hi = Math.min(lo + 1, inLen - 1)
    const frac = src - lo
    out[i] = samples[lo]! * (1 - frac) + samples[hi]! * frac
  }
  return out
}

export function resampleTo16k(samples: Float32Array): Float32Array {
  return resample(samples, DATASET_SR, BACKBONE_SR)
}

/** Kaldi-compatible mel filterbank, flat (numMelBins × fftBins), row-major. */
function buildMelFilterbank(numMelBins: number, fftSize: number, sampleRate: number, fLow = 20.0, fHigh = sampleRate / 2): Float32Array {
  const fftBins = fftSize / 2 + 1

  const hzToMel = (hz: number) => 1127.0 * Math.log(1.0 + hz / 700.0)
  const melToHz = (mel: number) => 700.0 * (Math.exp(mel / 1127.0) - 1.0)

  const melLow = hzToMel(fLow)
  const melHigh = hzToMel(fHigh)

  const melPoints = new Float32Array(numMelBins + 2)
  for (let i = 0; i < numMelBins + 2; i++) {
    melPoints[i] = melLow + (melHigh - melLow) * i / (numMelBins + 1)
  }

  const binFreqs = new Float32Array(numMelBins + 2)
  for (let i = 0; i < numMelBins + 2; i++) {
    binFreqs[i] = melToHz(melPoints[i]!)
  }

  const matrix = new Float32Array(numMelBins * fftBins)
  const hzPerBin = sampleRate / fftSize

  for (let m = 0; m < numMelBins; m++) {
    const fLower = binFreqs[m]!
    const fCenter = binFreqs[m + 1]!
    const fUpper = binFreqs[m + 2]!

    for (let k = 0; k < fftBins; k++) {
      const freq = k * hzPerBin
      let weight = 0.0

      if (freq >= fLower && freq <= fCenter) {
        weight = (freq - fLower) / (fCenter - fLower)
      }
      else if (freq > fCenter && freq <= fUpper) {
        weight = (fUpper - freq) / (fUpper - fCenter)
      }
      matrix[m * fftBins + k] = weight
    }
  }
  return matrix
}

let melFilterbankCache: Float32Array | null = null
let fftSizeCache = 0

function getMelFilterbank(fftSize: number): Float32Array {
  if (melFilterbankCache === null || fftSizeCache !== fftSize) {
    melFilterbankCache = buildMelFilterbank(NUM_MEL_BINS, fftSize, SAMPLE_FREQ)
    fftSizeCache = fftSize
  }
  return melFilterbankCache
}

/** In-place radix-2 Cooley-Tukey FFT (preprocessing.js fftInPlace). */
function fftInPlace(re: Float32Array, im: Float32Array): void {
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
    const ang = -2 * Math.PI / len
    const wRe = Math.cos(ang)
    const wIm = Math.sin(ang)
    for (let i = 0; i < N; i += len) {
      let cRe = 1.0, cIm = 0.0
      for (let k = 0; k < (len >> 1); k++) {
        const uRe = re[i + k]!
        const uIm = im[i + k]!
        const vRe = re[i + k + (len >> 1)]! * cRe - im[i + k + (len >> 1)]! * cIm
        const vIm = re[i + k + (len >> 1)]! * cIm + im[i + k + (len >> 1)]! * cRe
        re[i + k] = uRe + vRe
        im[i + k] = uIm + vIm
        re[i + k + (len >> 1)] = uRe - vRe
        im[i + k + (len >> 1)] = uIm - vIm
        const nr = cRe * wRe - cIm * wIm
        cIm = cRe * wIm + cIm * wRe
        cRe = nr
      }
    }
  }
}

function nextPow2(n: number): number {
  let p = 1
  while (p < n) p <<= 1
  return p
}

/**
 * Kaldi-compatible log mel filterbank, mirroring
 * torchaudio.compliance.kaldi.fbank(waveform * 2^15, num_mel_bins=128,
 * sample_frequency=16000, frame_length=25, frame_shift=10).
 */
export function computeKaldiFbank(samples16k: Float32Array): Float32Array {
  const SCALE = 32768.0

  const frameLenSamples = Math.round(FRAME_LENGTH_MS / 1000 * SAMPLE_FREQ)
  const frameShiftSamples = Math.round(FRAME_SHIFT_MS / 1000 * SAMPLE_FREQ)
  const fftSize = nextPow2(frameLenSamples)

  const numFrames = Math.max(
    0,
    Math.floor((samples16k.length - frameLenSamples) / frameShiftSamples) + 1,
  )

  if (numFrames === 0) {
    return new Float32Array(0)
  }

  const melFilter = getMelFilterbank(fftSize)
  const fftBins = fftSize / 2 + 1

  const fbank = new Float32Array(numFrames * NUM_MEL_BINS)

  const re = new Float32Array(fftSize)
  const im = new Float32Array(fftSize)

  // Povey window: w[n] = (0.5 - 0.5*cos(2π n/(N-1)))^0.85
  const window = new Float32Array(frameLenSamples)
  for (let i = 0; i < frameLenSamples; i++) {
    const hamming = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (frameLenSamples - 1))
    window[i] = Math.pow(hamming, 0.85)
  }

  for (let f = 0; f < numFrames; f++) {
    const start = f * frameShiftSamples

    re.fill(0)
    im.fill(0)

    const scaledPrev = (start > 0 ? samples16k[start - 1]! : 0.0) * SCALE
    for (let i = 0; i < frameLenSamples; i++) {
      const raw = samples16k[start + i]! * SCALE
      const prev = (i === 0) ? scaledPrev : samples16k[start + i - 1]! * SCALE
      const preEmp = raw - 0.97 * prev
      re[i] = preEmp * window[i]!
    }

    fftInPlace(re, im)

    for (let m = 0; m < NUM_MEL_BINS; m++) {
      let energy = 0.0
      const rowOffset = m * fftBins
      for (let k = 0; k < fftBins; k++) {
        const power = re[k]! * re[k]! + im[k]! * im[k]!
        energy += melFilter[rowOffset + k]! * power
      }
      fbank[f * NUM_MEL_BINS + m] = Math.log(Math.max(energy, 1.0))
    }
  }

  return fbank
}

/** BEATs normalisation, in place: (fbank - mean) / (2 * std). */
export function normalizeFbank(fbank: Float32Array): Float32Array {
  const denom = 2.0 * FBANK_STD
  for (let i = 0; i < fbank.length; i++) {
    fbank[i] = (fbank[i]! - FBANK_MEAN) / denom
  }
  return fbank
}

/** Full pipeline: 22 050 Hz clip (padded/truncated to 4410) → normalised fbank. */
export function preprocessClip(samples22k: Float32Array): { fbank: Float32Array, numFrames: number } {
  let clip = samples22k
  if (clip.length < CLIP_SAMPLES) {
    const padded = new Float32Array(CLIP_SAMPLES)
    padded.set(clip)
    clip = padded
  }
  else if (clip.length > CLIP_SAMPLES) {
    clip = clip.subarray(0, CLIP_SAMPLES)
  }

  const samples16k = resampleTo16k(clip)
  const fbank = computeKaldiFbank(samples16k)
  normalizeFbank(fbank)

  const numFrames = fbank.length / NUM_MEL_BINS
  return { fbank, numFrames }
}
