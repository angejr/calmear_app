/**
 * Dev-only handler (registered through `devServerHandlers` in nuxt.config.ts)
 * that serves the extension's model at /demo/model/model.onnx straight from
 * the calmear_extension checkout, without copying ~360 MB into public/ (which
 * `nuxt build` would then copy again into .output/).
 *
 * Production never uses this: the model comes from NUXT_PUBLIC_DEMO_MODEL_URL.
 * Override the location with CALMEAR_MODEL_PATH.
 */
import { createReadStream, existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineEventHandler, sendStream, setResponseHeaders, setResponseStatus } from 'h3'

export const DEMO_MODEL_DEV_ROUTE = '/demo/model/model.onnx'

export function demoModelDevHandler(rootDir: string) {
  const modelPath = process.env.CALMEAR_MODEL_PATH
    || resolve(rootDir, '..', '..', '..', 'calmear_extension', 'extension', 'model', 'model.onnx')
  let warned = false

  return defineEventHandler((event) => {
    // Under 1 MB it is a Git LFS pointer, not the model.
    if (!existsSync(modelPath) || statSync(modelPath).size < 1024 * 1024) {
      if (!warned) {
        warned = true
        console.warn(`[demo] Model not found at ${modelPath}. Set CALMEAR_MODEL_PATH, or run "git lfs pull" in calmear_extension.`)
      }
      setResponseStatus(event, 404)
      return ''
    }
    setResponseHeaders(event, {
      'content-type': 'application/octet-stream',
      'content-length': statSync(modelPath).size,
      'cache-control': 'no-cache',
    })
    if (event.method === 'HEAD') {
      event.node.res.end()
      return
    }
    return sendStream(event, createReadStream(modelPath))
  })
}
