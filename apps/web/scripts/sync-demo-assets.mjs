#!/usr/bin/env node
/**
 * Copies the onnxruntime-web 1.27.0 WASM files the landing-page demo loads at
 * runtime (ort.env.wasm.wasmPaths = '/demo/ort/') into public/demo/ort/. They are
 * byte-identical to the ones the extension ships in extension/lib/.
 *
 * Runs before `nuxt dev` and `nuxt build`. The destination is git-ignored.
 * (The model itself is not copied: see scripts/demo-model-dev-handler.ts.)
 */
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function copyIfChanged(src, dest) {
  if (existsSync(dest) && statSync(dest).size === statSync(src).size && statSync(dest).mtimeMs >= statSync(src).mtimeMs) {
    return false
  }
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(src, dest)
  return true
}

const ortDist = join(root, 'node_modules', 'onnxruntime-web', 'dist')
// ort.min.mjs (like the extension's lib/ort.min.js) only loads the JSEP build,
// for both the WebGPU and the WASM execution providers.
const ortFiles = [
  'ort-wasm-simd-threaded.jsep.wasm',
  'ort-wasm-simd-threaded.jsep.mjs',
]
for (const f of ortFiles) {
  const src = join(ortDist, f)
  if (!existsSync(src)) {
    console.error(`[sync-demo-assets] Missing ${src}. Run npm install first.`)
    process.exit(1)
  }
  copyIfChanged(src, join(root, 'public', 'demo', 'ort', f))
}
