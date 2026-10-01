/** Messages between the demo client (main thread) and demo.worker.ts. */
import type { SmackEvent } from './pipeline'

export type WorkerRequest =
  | {
    type: 'process'
    jobId: number
    channels: Float32Array[]
    sampleRate: number
    modelUrl: string
    wasmPaths: string
  }
  | { type: 'cancel', jobId: number }

export type WorkerErrorCode = 'model-download' | 'model-init' | 'processing'

export type WorkerResponse =
  | { type: 'model-progress', loaded: number, total: number, fromCache: boolean }
  | { type: 'model-initialising' }
  | { type: 'model-ready', backend: 'webgpu' | 'wasm' }
  | { type: 'progress', jobId: number, windowsDone: number, windowsTotal: number }
  | { type: 'result', jobId: number, channels: Float32Array[], events: SmackEvent[] }
  | { type: 'error', jobId: number, code: WorkerErrorCode }
