<script setup lang="ts">
/**
 * Landing-page demo ("CalmEar in Action", <Demo> / <LazyDemo>). It opens on a real example
 * (waveform from the precomputed manifest; its audio is fetched on the first
 * play), the sign-up call to action right under it, and a "test your own
 * clip" link below. The demo client (and, through its
 * worker, the ONNX runtime and the model) is only loaded when the visitor
 * plays the example or uploads a clip.
 */
import examplesManifest from '../../../public/demo/examples/manifest.json'
import type { DemoErrorCode, DemoExample, DemoProcessor, DemoResult } from '~/lib/calmear-demo/client'

type ClientModule = typeof import('~/lib/calmear-demo/client')
type Stage = 'idle' | 'selected' | 'working' | 'result' | 'error'
type WorkStep = 'reading' | 'model-download' | 'model-init' | 'analyzing'

const config = useRuntimeConfig()
const modelUrl = config.public.demoModelUrl as string

const examples = (examplesManifest as { examples: DemoExample[] }).examples
const exampleIndex = ref(0)
const example = computed(() => examples[exampleIndex.value] ?? null)

const stage = ref<Stage>('idle')
const step = ref<WorkStep>('reading')
const file = shallowRef<File | null>(null)
const result = shallowRef<DemoResult | null>(null)
const errorCode = ref<DemoErrorCode | null>(null)
const modelProgress = ref(0)
const windowsDone = ref(0)
const windowsTotal = ref(0)
const modelInfo = ref<{ cached: boolean, bytes: number | null } | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

let client: ClientModule | null = null
let processor: DemoProcessor | null = null
const exampleAudio = new Map<string, { original: AudioBuffer, processed: AudioBuffer }>()

async function loadClient(): Promise<ClientModule> {
  client ??= await import('~/lib/calmear-demo/client')
  return client
}

/** Fetches and decodes the current example's two versions (once per example). */
async function loadExampleAudio() {
  const ex = example.value!
  const cached = exampleAudio.get(ex.id)
  if (cached) return cached
  const c = await loadClient()
  const { original, processed } = await c.loadExample(ex)
  exampleAudio.set(ex.id, { original, processed })
  return { original, processed }
}

function reducedLabel(count: number): string {
  return `${count} mouth ${count === 1 ? 'sound' : 'sounds'} reduced`
}

const errorMessage = computed(() => (errorCode.value && client ? client.DEMO_ERROR_MESSAGES[errorCode.value] : 'Something went wrong. Please try again.'))

const canRetry = computed(() => errorCode.value === 'model-download' || errorCode.value === 'model-init' || errorCode.value === 'processing')

const modelSizeLabel = computed(() => {
  const bytes = modelInfo.value?.bytes
  return bytes ? `about ${Math.round(bytes / 1_000_000)} MB` : 'a few hundred MB'
})

const progressLabel = computed(() => {
  switch (step.value) {
    case 'reading': return 'Reading the audio...'
    case 'model-download': return `Loading the CalmEar model... ${modelProgress.value}%`
    case 'model-init': return 'Starting CalmEar...'
    case 'analyzing': return 'Detecting mouth sounds...'
    default: return ''
  }
})

const progressPercent = computed(() => {
  if (step.value === 'model-download') return modelProgress.value
  if (step.value === 'analyzing' && windowsTotal.value > 0) return Math.round((windowsDone.value / windowsTotal.value) * 100)
  return null
})

function showError(code: DemoErrorCode) {
  errorCode.value = code
  stage.value = 'error'
}

function handleFailure(err: unknown) {
  if (client && err instanceof client.DemoCancelled) return
  showError(client && err instanceof client.DemoError ? err.code : 'processing')
}

async function chooseFile() {
  const c = await loadClient()
  if (!c.isBrowserSupported()) {
    showError('unsupported-browser')
    return
  }
  fileInput.value?.click()
}

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const picked = input.files?.[0]
  input.value = ''
  if (!picked) return
  const c = await loadClient()
  processor?.cancel()
  result.value = null
  file.value = picked
  const invalid = await c.precheckFile(picked)
  if (file.value !== picked) return
  if (invalid) {
    file.value = null
    showError(invalid)
    return
  }
  stage.value = 'selected'
  trackEvent('demo_upload_selected')
  modelInfo.value = null
  c.modelDownloadInfo(modelUrl).then((info) => {
    if (file.value === picked) modelInfo.value = info
  })
}

async function processFile() {
  const picked = file.value
  if (!picked) return
  const c = await loadClient()
  stage.value = 'working'
  step.value = 'reading'
  modelProgress.value = 0
  windowsDone.value = 0
  windowsTotal.value = 0
  try {
    const decoded = await c.decodeUpload(picked)
    if (file.value !== picked || stage.value !== 'working') return
    processor ??= new c.DemoProcessor(modelUrl)
    const res = await processor.process(decoded, {
      onModelProgress: (loaded, total) => {
        step.value = 'model-download'
        modelProgress.value = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0
      },
      onModelInitialising: () => { step.value = 'model-init' },
      onProgress: (done, total) => {
        step.value = 'analyzing'
        windowsDone.value = done
        windowsTotal.value = total
      },
    })
    if (file.value !== picked) return
    result.value = res
    stage.value = 'result'
    trackEvent('demo_upload_processed', { mouth_sounds: res.events.length })
  }
  catch (err) {
    if (file.value === picked) handleFailure(err)
  }
}

function cancelProcessing() {
  processor?.cancel()
  stage.value = file.value ? 'selected' : 'idle'
}

/** Back to the example (initial state). */
function reset() {
  processor?.cancel()
  file.value = null
  result.value = null
  errorCode.value = null
  modelInfo.value = null
  stage.value = 'idle'
}

onBeforeUnmount(() => {
  processor?.dispose()
  processor = null
  result.value = null
  exampleAudio.clear()
})
</script>

<template>
  <section id="demo" class="relative overflow-hidden bg-white pb-20 pt-14 sm:pb-28 sm:pt-20">
    <!-- Soft glow behind the player -->
    <div class="pointer-events-none absolute left-1/2 top-36 h-80 w-[40rem] max-w-full -translate-x-1/2 rounded-full bg-primary-200/40 blur-3xl" aria-hidden="true" />

    <div class="relative mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
      <div class="mb-8 text-center">
        <h2 class="text-3xl font-bold text-neutral-900 sm:text-4xl">CalmEar in Action</h2>
      </div>

      <div class="rounded-3xl border border-primary-100 bg-white/90 p-5 shadow-xl shadow-primary-900/5 ring-1 ring-black/[0.02] backdrop-blur sm:p-8" aria-live="polite">
        <input
          ref="fileInput"
          type="file"
          accept="video/mp4,video/webm,.mp4,.webm"
          class="hidden"
          @change="onFileChange"
        >

        <!-- Initial state: the example -->
        <div v-if="stage === 'idle'">
          <template v-if="example">
            <div v-if="examples.length > 1" class="mb-5 flex flex-wrap justify-center gap-2">
              <button
                v-for="(ex, i) in examples"
                :key="ex.id"
                type="button"
                class="rounded-full px-3 py-1 text-sm font-medium transition-colors"
                :class="i === exampleIndex ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'"
                @click="exampleIndex = i"
              >
                {{ ex.title }}
              </button>
            </div>
            <div class="mb-6 flex flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
              <div>
                <div class="text-xs font-semibold uppercase tracking-widest text-primary-600">Real example</div>
                <div class="mt-1 font-semibold text-neutral-900">{{ example.description }}</div>
              </div>
              <span v-if="example.events.length" class="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 ring-1 ring-inset ring-primary-100">
                <span class="h-1.5 w-1.5 rounded-full bg-primary-500" />
                {{ reducedLabel(example.events.length) }}
              </span>
            </div>
            <DemoComparePlayer
              :key="example.id"
              :events="example.events"
              :peaks="example.peaks"
              :duration="example.duration_s"
              :load-audio="loadExampleAudio"
              :source="`example:${example.id}`"
            />
            <DemoTrialCta />
            <p class="mt-5 text-center text-sm text-neutral-500">
              Have a clip of your own?
              <button type="button" class="font-medium text-primary-700 underline-offset-4 hover:underline" @click="chooseFile">Test it here</button>
              <span class="block text-xs text-neutral-400">MP4 or WebM, up to 15 seconds. Processed on your device, never uploaded.</span>
            </p>
          </template>
          <div v-else class="text-center">
            <button type="button" class="btn-primary px-8 py-4 text-base" @click="chooseFile">Test your own clip</button>
            <p class="mt-4 text-sm text-neutral-500">MP4 or WebM, up to 15 seconds. Processed on your device, never uploaded.</p>
          </div>
        </div>

        <!-- File selected -->
        <div v-else-if="stage === 'selected' && file" class="text-center">
          <div class="mx-auto mb-6 inline-flex max-w-full items-center gap-3 rounded-xl bg-neutral-50 px-4 py-3">
            <svg class="h-5 w-5 shrink-0 text-primary-600" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" /></svg>
            <span class="truncate font-medium text-neutral-800">{{ file.name }}</span>
          </div>
          <div class="flex flex-col justify-center gap-3 sm:flex-row">
            <button type="button" class="btn-primary px-8 py-4 text-base" @click="processFile">Process with CalmEar</button>
            <button type="button" class="btn-secondary px-8 py-4 text-base" @click="chooseFile">Choose another file</button>
          </div>
          <p v-if="modelInfo && !modelInfo.cached" class="mx-auto mt-5 max-w-md text-sm text-neutral-500">
            The first time, your browser downloads the CalmEar model ({{ modelSizeLabel }}). It stays on your device for next time. Works best on a computer.
          </p>
          <button type="button" class="mt-5 text-sm font-medium text-neutral-500 hover:text-neutral-700" @click="reset">Back to the example</button>
        </div>

        <!-- Processing -->
        <div v-else-if="stage === 'working'" class="py-4 text-center">
          <div class="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-4 border-primary-100 border-t-primary-600" aria-hidden="true" />
          <h3 class="text-lg font-semibold text-neutral-900">Analyzing your clip...</h3>
          <p class="mt-1 text-sm text-neutral-600">{{ progressLabel }}</p>
          <div v-if="progressPercent !== null" class="mx-auto mt-5 h-2 max-w-sm overflow-hidden rounded-full bg-neutral-200">
            <div class="h-full rounded-full bg-primary-500 transition-[width] duration-200" :style="{ width: `${progressPercent}%` }" />
          </div>
          <button type="button" class="mt-6 text-sm font-medium text-neutral-500 hover:text-neutral-700" @click="cancelProcessing">Cancel</button>
        </div>

        <!-- Upload result -->
        <div v-else-if="stage === 'result' && result">
          <div class="mb-6 flex flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
            <div>
              <div class="text-xs font-semibold uppercase tracking-widest text-primary-600">Your clip</div>
              <div class="mt-1 font-semibold text-neutral-900">
                <template v-if="result.events.length">Here is your clip with CalmEar.</template>
                <template v-else>No mouth sounds detected, so both versions sound the same.</template>
              </div>
            </div>
            <span v-if="result.events.length" class="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 ring-1 ring-inset ring-primary-100">
              <span class="h-1.5 w-1.5 rounded-full bg-primary-500" />
              {{ reducedLabel(result.events.length) }}
            </span>
          </div>
          <DemoComparePlayer :original="result.original" :processed="result.processed" :events="result.events" source="upload" />
          <DemoTrialCta />
          <p class="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
            <button type="button" class="font-medium text-primary-700 underline-offset-4 hover:underline" @click="chooseFile">Try another clip</button>
            <button v-if="example" type="button" class="font-medium text-neutral-500 underline-offset-4 hover:underline" @click="reset">Back to the example</button>
          </p>
        </div>

        <!-- Error -->
        <div v-else-if="stage === 'error'" class="py-2 text-center">
          <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0 3.75h.008M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <p class="mx-auto max-w-md text-neutral-700">{{ errorMessage }}</p>
          <div class="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button v-if="file && canRetry" type="button" class="btn-primary" @click="processFile">Try again</button>
            <button v-else-if="errorCode !== 'unsupported-browser'" type="button" class="btn-primary" @click="chooseFile">Choose another file</button>
            <button type="button" class="btn-secondary" @click="reset">{{ example ? 'Back to the example' : 'Back' }}</button>
          </div>
        </div>
      </div>

    </div>
  </section>
</template>
