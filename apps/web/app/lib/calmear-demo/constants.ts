/**
 * CalmEar detection / suppression constants.
 *
 * Source of truth: calmear_extension/extension (commit b17fb4b). Every value
 * below is copied from the extension and must be kept in sync with it; the
 * parity test (tests/calmear-demo/parity.test.ts) checks the ported code
 * against the extension's own files when that repository is available.
 */

// offscreen.js:23-27: analysis windows and detection
export const WINDOW_DURATION_S = 0.200
export const HOP_DURATION_S = 0.100
export const DETECTION_THRESHOLD = 0.95
export const MERGE_GAP_S = 0.150
export const MODEL_INPUT_SAMPLE_RATE = 22050

// offscreen.js:39: windows per batched ONNX call
export const BATCH_SIZE = 8

// offscreen.js:1170: decoded (and ERSM) sample rate. The extension decodes
// YouTube Opus with WebCodecs at 48 kHz and hardcodes this rate for ERSM.
export const DECODE_SAMPLE_RATE = 48000

// offscreen.js:45-60: ERSM suppression
export const ERSM_FFT_SIZE = 256
export const ERSM_HOP_SIZE = 64
export const ERSM_THRESHOLD = 1.5
export const ERSM_ATT_DB = -60
export const ERSM_CONTEXT_MS = 100
export const ERSM_REGION_PAD_MS = 20
export const ERSM_STRENGTH = 1.0
export const CLIP_FADE_SAMPLES = 240

// preprocessing.js:32-48: BEATs preprocessing
export const DATASET_SR = 22050
export const BACKBONE_SR = 16000
export const CLIP_SAMPLES = 4410
export const NUM_MEL_BINS = 128
export const FRAME_LENGTH_MS = 25
export const FRAME_SHIFT_MS = 10
export const FBANK_MEAN = 15.41663
export const FBANK_STD = 6.55582

// inference_worker.js:94-95: warm-up input shape, as in the extension. (A real
// 200 ms window gives 18 fbank frames; the model's frame dimension is dynamic.)
export const WARMUP_FRAMES = 19
export const WARMUP_TIMEOUT_MS = 8000
