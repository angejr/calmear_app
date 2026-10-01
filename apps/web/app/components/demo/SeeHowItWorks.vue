<script setup lang="ts">
/**
 * "See how it works" landing-page demo. The section itself is static; the
 * demo client (and, through its worker, the ONNX runtime and the model) is
 * only loaded once the visitor starts using it.
 */
import { PRICING } from '../../../config/pricing'
import examplesManifest from '../../../public/demo/examples/manifest.json'
import type { DemoErrorCode, DemoExample, DemoProcessor, DemoResult } from '~/lib/calmear-demo/client'

type ClientModule = typeof import('~/lib/calmear-demo/client')
type Stage = 'idle' | 'examples' | 'selected' | 'working' | 'result' | 'error'
type WorkStep = 'reading' | 'model-download' | 'model-init' | 'analyzing' | 'example'

const { isSignedIn } = useUser()
const config = useRuntimeConfig()
const modelUrl = config.public.demoModelUrl as string

const examples = (examplesManifest as { examples: DemoExample[] }).examples

const stage = ref<Stage>('idle')
const step = ref<WorkStep>('reading')
const file = shallowRef<File | null>(null)
const result = shallowRef<DemoResult | null>(null)
const errorCode = ref<DemoErrorCode | null>(null)
const modelProgress = ref(0)
const windowsDone = ref(0)
const windowsTotal = ref(0)
const modelInfo = ref<{ cached: boolean, bytes: number | null } | null>(null)
const resultSource = ref<'upload' | 'example'>('upload')
const fileInput = ref<HTMLInputElement | null>(null)

let client: ClientModule | null = null
let processor: DemoProcessor | null = null

async function loadClient(): Promise<ClientModule> {
  client ??= await import('~/lib/calmear-demo/client')
  return client
}

const errorMessage = computed(() => (errorCode.value && client ? client.DEMO_ERROR_MESSAGES[errorCode.value] : 'Something went wrong. Please try again.'))

const canRetry = computed(() => errorCode.value === 'model-download' || errorCode.value === 'model-init' || errorCode.value === 'processing')

const modelSizeLabel = computed(() => {
  const bytes = modelInfo.value?.bytes
  return bytes ? `about ${Math.round(bytes / 1_000_000)} MB` : 'a few hundred MB'
})

const progressLabel = computed(() => {
  switch (step.value) {
    case 'reading': return { title: 'Analyzing your clip...', detail: 'Reading the audio...' }
    case 'model-download': return { title: 'Analyzing your clip...', detail: `Loading the CalmEar model... ${modelProgress.value}%` }
    case 'model-init': return { title: 'Analyzing your clip...', detail: 'Starting CalmEar...' }
    case 'analyzing': return { title: 'Analyzing your clip...', detail: 'Detecting mouth sounds...' }
    case 'example': return { title: 'Loading the example...', detail: 'Preparing both versions...' }
    default: return { title: 'Analyzing your clip...', detail: '' }
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

async function ensureSupported(): Promise<boolean> {
  const c = await loadClient()
  if (!c.isBrowserSupported()) {
    showError('unsupported-browser')
    return false
  }
  return true
}

async function chooseFile() {
  if (!(await ensureSupported())) return
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
    resultSource.value = 'upload'
    result.value = res
    stage.value = 'result'
  }
  catch (err) {
    if (file.value === picked) handleFailure(err)
  }
}

function cancelProcessing() {
  processor?.cancel()
  stage.value = file.value ? 'selected' : 'idle'
}

async function openExamples() {
  if (!(await ensureSupported())) return
  if (examples.length === 1) {
    await playExample(examples[0]!)
    return
  }
  stage.value = 'examples'
}

async function playExample(example: DemoExample) {
  const c = await loadClient()
  processor?.cancel()
  file.value = null
  stage.value = 'working'
  step.value = 'example'
  try {
    const res = await c.loadExample(example)
    if (stage.value !== 'working' || step.value !== 'example') return
    resultSource.value = 'example'
    result.value = res
    stage.value = 'result'
  }
  catch (err) {
    handleFailure(err)
  }
}

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
})
</script>

<template>
  <section id="demo" class="bg-gradient-to-b from-primary-50 to-white py-20 sm:py-28">
    <div class="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-10">
        <h2 class="text-3xl sm:text-4xl font-bold text-neutral-900">Hear the difference</h2>
        <p class="mt-2 text-neutral-600">Try an example or upload a short clip containing a sound that bothers you.</p>
      </div>

      <div class="card p-6 sm:p-10" aria-live="polite">
        <input
          ref="fileInput"
          type="file"
          accept="video/mp4,video/webm,.mp4,.webm"
          class="hidden"
          @change="onFileChange"
        >

        <!-- Initial state -->
        <div v-if="stage === 'idle'" class="text-center">
          <div class="flex flex-col sm:flex-row gap-4 justify-center">
            <button v-if="examples.length" type="button" class="btn-primary text-base px-8 py-4" @click="openExamples">Try an example</button>
            <button type="button" :class="examples.length ? 'btn-secondary' : 'btn-primary'" class="text-base px-8 py-4" @click="chooseFile">Upload your own</button>
          </div>
          <p class="mt-5 text-sm text-neutral-500">MP4 or WebM, up to 15 seconds. Your clip is processed on your device and never uploaded.</p>
        </div>

        <!-- Example picker -->
        <div v-else-if="stage === 'examples'">
          <h3 class="text-lg font-semibold text-neutral-900 mb-4 text-center">Choose an example</h3>
          <div class="grid gap-3 sm:grid-cols-2">
            <button
              v-for="example in examples"
              :key="example.id"
              type="button"
              class="rounded-xl border border-neutral-200 bg-white p-4 text-left transition-colors hover:border-primary-300 hover:bg-primary-50"
              @click="playExample(example)"
            >
              <div class="font-semibold text-neutral-900">{{ example.title }}</div>
              <div class="mt-1 text-sm text-neutral-600">{{ example.description }}</div>
            </button>
          </div>
          <div class="mt-6 text-center">
            <button type="button" class="text-sm font-medium text-primary-600 hover:text-primary-700" @click="reset">Back</button>
          </div>
        </div>

        <!-- File selected -->
        <div v-else-if="stage === 'selected' && file" class="text-center">
          <div class="mx-auto mb-6 inline-flex max-w-full items-center gap-3 rounded-xl bg-neutral-50 px-4 py-3">
            <svg class="h-5 w-5 shrink-0 text-primary-600" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" /></svg>
            <span class="truncate font-medium text-neutral-800">{{ file.name }}</span>
          </div>
          <div class="flex flex-col sm:flex-row gap-3 justify-center">
            <button type="button" class="btn-primary text-base px-8 py-4" @click="processFile">Process with CalmEar</button>
            <button type="button" class="btn-secondary text-base px-8 py-4" @click="chooseFile">Choose another file</button>
          </div>
          <p v-if="modelInfo && !modelInfo.cached" class="mx-auto mt-5 max-w-md text-sm text-neutral-500">
            The first time, your browser downloads the CalmEar model ({{ modelSizeLabel }}). It stays on your device for next time. Works best on a computer.
          </p>
        </div>

        <!-- Processing -->
        <div v-else-if="stage === 'working'" class="text-center py-4">
          <div class="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-4 border-primary-100 border-t-primary-600" aria-hidden="true" />
          <h3 class="text-lg font-semibold text-neutral-900">{{ progressLabel.title }}</h3>
          <p class="mt-1 text-sm text-neutral-600">{{ progressLabel.detail }}</p>
          <div v-if="progressPercent !== null" class="mx-auto mt-5 h-2 max-w-sm overflow-hidden rounded-full bg-neutral-200">
            <div class="h-full rounded-full bg-primary-500 transition-[width] duration-200" :style="{ width: `${progressPercent}%` }" />
          </div>
          <button v-if="step !== 'example'" type="button" class="mt-6 text-sm font-medium text-neutral-500 hover:text-neutral-700" @click="cancelProcessing">Cancel</button>
        </div>

        <!-- Result -->
        <div v-else-if="stage === 'result' && result">
          <div class="text-center mb-6">
            <h3 class="text-xl font-semibold text-neutral-900">{{ resultSource === 'upload' ? 'Your result' : 'The result' }}</h3>
            <p class="mt-1 text-sm text-neutral-600">
              <template v-if="result.events.length">CalmEar reduced {{ result.events.length }} mouth {{ result.events.length === 1 ? 'sound' : 'sounds' }} in this clip.</template>
              <template v-else>CalmEar didn't detect any mouth sounds in this clip, so both versions sound the same.</template>
            </p>
          </div>
          <DemoComparePlayer :original="result.original" :processed="result.processed" :events="result.events" />
          <div class="mt-6 text-center">
            <button type="button" class="btn-secondary" @click="reset">Try another clip</button>
          </div>
        </div>

        <!-- Error -->
        <div v-else-if="stage === 'error'" class="text-center py-2">
          <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0 3.75h.008M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <p class="mx-auto max-w-md text-neutral-700">{{ errorMessage }}</p>
          <div class="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <button v-if="file && canRetry" type="button" class="btn-primary" @click="processFile">Try again</button>
            <button v-else-if="errorCode !== 'unsupported-browser'" type="button" class="btn-primary" @click="chooseFile">Choose another file</button>
            <button type="button" class="btn-secondary" @click="reset">Back</button>
          </div>
        </div>
      </div>

      <!-- Conversion -->
      <div v-if="stage === 'result'" class="mt-10 text-center">
        <h3 class="text-2xl font-bold text-neutral-900">Liked the difference?</h3>
        <p class="mt-2 text-neutral-600">CalmEar can do this automatically while you watch YouTube.</p>
        <div class="mt-6">
          <NuxtLink v-if="isSignedIn" to="/dashboard" class="btn-primary text-base px-8 py-4">Go to Dashboard</NuxtLink>
          <SignUpButton v-else mode="modal"><button class="btn-primary text-base px-8 py-4">Try CalmEar free</button></SignUpButton>
        </div>
        <p class="mt-3 text-sm text-neutral-500">{{ PRICING.trial.durationDays }}-day free trial · No credit card required</p>
      </div>
    </div>
  </section>
</template>
