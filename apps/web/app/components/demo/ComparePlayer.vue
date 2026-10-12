<script setup lang="ts">
/**
 * A/B player: both versions play in sync from one Web Audio clock and only
 * the selected one is audible, so switching keeps the exact position.
 *
 * The waveform renders from `peaks` (precomputed for examples) before any
 * audio exists; `loadAudio` is called on the first play when the buffers are
 * not provided yet. Highlighted regions are the mouth sounds CalmEar reduced.
 */
import type { SmackEvent } from '~/lib/calmear-demo/pipeline'
import { computePeaks } from '~/lib/calmear-demo/waveform'

type Track = 'original' | 'processed'
interface Buffers { original: AudioBuffer, processed: AudioBuffer }

const props = defineProps<{
  events: SmackEvent[]
  original?: AudioBuffer | null
  processed?: AudioBuffer | null
  peaks?: number[]
  duration?: number
  loadAudio?: () => Promise<Buffers>
  /** Sent with the tracking events: 'example:<id>' or 'upload'. */
  source?: string
}>()

/** Funnel steps, sent to the GTM dataLayer once per player. */
const tracked = new Set<string>()
function trackOnce(event: string) {
  if (tracked.has(event)) return
  tracked.add(event)
  trackEvent(event, { demo_source: props.source ?? 'example' })
}

const SWITCH_RAMP_S = 0.01
const NUDGE_AFTER_S = 2.5
/** "Hear it up close": audio kept on each side of a mouth sound (~1 s in total). */
const CLOSEUP_PAD_S = 0.4
const CLOSEUP_GAP_MS = 350

const active = ref<Track>('original')
const playing = ref(false)
const loading = ref(false)
const loadFailed = ref(false)
const position = ref(0)
const hasSwitched = ref(false)
/** Close-up being played: which mouth sound, and which version right now. */
const closeup = ref<{ index: number, phase: Track } | null>(null)
let closeupRun = 0

const buffers = shallowRef<Buffers | null>(props.original && props.processed ? { original: props.original, processed: props.processed } : null)
watch(() => [props.original, props.processed] as const, ([o, p]) => {
  stop()
  buffers.value = o && p ? { original: o, processed: p } : null
  position.value = 0
})

const duration = computed(() => buffers.value?.original.duration ?? props.duration ?? 0)
const bars = computed(() => props.peaks ?? (buffers.value
  ? computePeaks(Array.from({ length: buffers.value.original.numberOfChannels }, (_, c) => buffers.value!.original.getChannelData(c)))
  : []))

/** Bar indexes inside a reduced mouth sound. */
const eventBars = computed(() => {
  const set = new Set<number>()
  const n = bars.value.length
  if (!n || !duration.value) return set
  for (const e of props.events) {
    const from = Math.floor((Math.max(0, e.startPts_s) / duration.value) * n)
    const to = Math.min(n - 1, Math.floor((e.endPts_s / duration.value) * n))
    for (let i = from; i <= to; i++) set.add(i)
  }
  return set
})

const progress = computed(() => (duration.value ? position.value / duration.value : 0))
const nudge = computed(() => playing.value && active.value === 'original' && !hasSwitched.value && position.value >= NUDGE_AFTER_S)

let ctx: AudioContext | null = null
let nodes: { sources: AudioBufferSourceNode[], gains: Record<Track, GainNode> } | null = null
let startedAt = 0
let startOffset = 0
let raf = 0
/** Resolves the promise returned by play(): true when it ended on its own. */
let pendingEnd: ((completed: boolean) => void) | null = null

function currentTime(): number {
  if (!ctx || !playing.value) return position.value
  return Math.min(duration.value, startOffset + (ctx.currentTime - startedAt))
}

function tick() {
  position.value = currentTime()
  if (playing.value) raf = requestAnimationFrame(tick)
}

function stopNodes() {
  if (!nodes) return
  for (const s of nodes.sources) {
    s.onended = null
    try {
      s.stop()
    }
    catch {
      // already stopped
    }
    s.disconnect()
  }
  nodes.gains.original.disconnect()
  nodes.gains.processed.disconnect()
  nodes = null
  const end = pendingEnd
  pendingEnd = null
  end?.(false)
}

function stop() {
  playing.value = false
  cancelAnimationFrame(raf)
  stopNodes()
}

async function ensureBuffers(): Promise<Buffers | null> {
  if (buffers.value) return buffers.value
  if (!props.loadAudio) return null
  loading.value = true
  loadFailed.value = false
  try {
    buffers.value = await props.loadAudio()
  }
  catch {
    loadFailed.value = true
  }
  finally {
    loading.value = false
  }
  return buffers.value
}

/**
 * Plays both versions in sync from `from` (to the end, or for `length` s).
 * Resolves true when playback ended on its own, false when it was stopped.
 */
async function play(from: number, length?: number): Promise<boolean> {
  ctx ??= new AudioContext()
  // Resume within the click, before any await, so browsers allow the audio.
  const resumed = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve()
  const b = await ensureBuffers()
  await resumed
  if (!b || !ctx) return false
  stopNodes()
  const offset = from >= duration.value - 0.01 ? 0 : from
  const gains = { original: ctx.createGain(), processed: ctx.createGain() }
  gains.original.gain.value = active.value === 'original' ? 1 : 0
  gains.processed.gain.value = active.value === 'processed' ? 1 : 0
  const sources = (['original', 'processed'] as const).map((key) => {
    const s = ctx!.createBufferSource()
    s.buffer = b[key]
    s.connect(gains[key]).connect(ctx!.destination)
    return s
  })
  const when = ctx.currentTime + 0.02
  for (const s of sources) {
    if (length) s.start(when, offset, length)
    else s.start(when, offset)
  }
  const finished = new Promise<boolean>((resolve) => { pendingEnd = resolve })
  sources[0]!.onended = () => {
    const end = pendingEnd
    pendingEnd = null
    stop()
    position.value = length ? Math.min(duration.value, offset + length) : 0
    end?.(true)
  }
  nodes = { sources, gains }
  trackOnce('demo_play')
  startedAt = when
  startOffset = offset
  playing.value = true
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(tick)
  return finished
}

function pause() {
  position.value = currentTime()
  stop()
}

function togglePlay() {
  if (loading.value) return
  cancelCloseup()
  if (playing.value) pause()
  else play(position.value)
}

function select(track: Track) {
  cancelCloseup()
  if (track !== active.value) hasSwitched.value = true
  if (track === 'processed') trackOnce('demo_switch_calmear')
  setTrack(track)
}

/** Makes `track` the audible version (10 ms crossfade if playing). */
function setTrack(track: Track) {
  active.value = track
  if (nodes && ctx) {
    const t = ctx.currentTime
    for (const key of ['original', 'processed'] as const) {
      const g = nodes.gains[key].gain
      g.cancelScheduledValues(t)
      g.setValueAtTime(g.value, t)
      g.linearRampToValueAtTime(key === track ? 1 : 0, t + SWITCH_RAMP_S)
    }
  }
}

function cancelCloseup() {
  closeupRun++
  closeup.value = null
}

/**
 * Plays ~1 s around mouth sound `index`: first the original, then, after a
 * short pause, the same second with CalmEar.
 */
async function playCloseup(index: number) {
  const e = props.events[index]
  if (!e || loading.value) return
  const run = ++closeupRun
  trackOnce('demo_closeup')
  const from = Math.max(0, e.startPts_s - CLOSEUP_PAD_S)
  const to = e.endPts_s + CLOSEUP_PAD_S
  for (const phase of ['original', 'processed'] as const) {
    if (run !== closeupRun) return
    closeup.value = { index, phase }
    setTrack(phase)
    const completed = await play(from, Math.min(duration.value || to, to) - from)
    if (run !== closeupRun || !completed) return
    if (phase === 'original') await new Promise(resolve => setTimeout(resolve, CLOSEUP_GAP_MS))
  }
  if (run === closeupRun) closeup.value = null
}

function seekTo(t: number) {
  cancelCloseup()
  position.value = Math.max(0, Math.min(duration.value, t))
  if (playing.value) play(position.value)
}

function seek(event: MouseEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  seekTo(((event.clientX - rect.left) / rect.width) * duration.value)
}

function formatTime(s: number): string {
  const whole = Math.floor(s)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

function barClass(i: number): string {
  const played = (i + 0.5) / bars.value.length <= progress.value
  if (eventBars.value.has(i)) {
    return active.value === 'original'
      ? (played ? 'fill-amber-500' : 'fill-amber-300')
      : (played ? 'fill-primary-600' : 'fill-primary-300')
  }
  return played ? 'fill-neutral-700' : 'fill-neutral-300'
}

onBeforeUnmount(() => {
  cancelCloseup()
  stop()
  ctx?.close().catch(() => {})
  ctx = null
})
</script>

<template>
  <div>
    <!-- A/B switch -->
    <div class="flex justify-center">
      <div class="inline-flex rounded-full bg-neutral-100 p-1 ring-1 ring-inset ring-neutral-200" role="group" aria-label="Choose which version you hear">
        <button
          type="button"
          class="rounded-full px-4 py-2 text-sm font-semibold transition-all sm:px-5"
          :class="active === 'original' ? 'bg-primary-600 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-800'"
          :aria-pressed="active === 'original'"
          @click="select('original')"
        >
          Original
        </button>
        <button
          type="button"
          class="relative flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all sm:px-5"
          :class="[
            active === 'processed' ? 'bg-primary-600 text-white shadow-sm' : 'text-primary-700 hover:text-primary-800',
            nudge ? 'bg-primary-50 ring-2 ring-primary-400' : '',
          ]"
          :aria-pressed="active === 'processed'"
          @click="select('processed')"
        >
          <span v-if="nudge" class="absolute inset-0 animate-ping rounded-full bg-primary-300/40" aria-hidden="true" />
          With CalmEar
        </button>
      </div>
    </div>
    <p class="mt-3 h-5 text-center text-sm" :class="closeup || nudge ? 'font-medium text-primary-700' : 'text-neutral-500'">
      <template v-if="closeup">Sound {{ closeup.index + 1 }}: {{ closeup.phase === 'original' ? 'original' : 'with CalmEar' }}</template>
      <template v-else-if="nudge">Now switch to "With CalmEar" and listen again.</template>
    </p>

    <!-- Player -->
    <div class="mt-5 flex items-center gap-4 sm:gap-5">
      <button
        type="button"
        class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg shadow-primary-600/30 transition-transform hover:scale-105 hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 sm:h-16 sm:w-16"
        :aria-label="playing ? 'Pause' : 'Play'"
        @click="togglePlay"
      >
        <span v-if="loading" class="h-6 w-6 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
        <svg v-else-if="playing" class="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></svg>
        <svg v-else class="h-6 w-6 translate-x-0.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z" /></svg>
      </button>

      <div class="min-w-0 flex-1">
        <div
          class="relative h-16 cursor-pointer sm:h-20"
          role="slider"
          tabindex="0"
          aria-label="Playback position"
          :aria-valuemin="0"
          :aria-valuemax="Math.round(duration)"
          :aria-valuenow="Math.round(position)"
          :aria-valuetext="`${formatTime(position)} of ${formatTime(duration)}`"
          @click="seek"
          @keydown.left.prevent="seekTo(position - 1)"
          @keydown.right.prevent="seekTo(position + 1)"
        >
          <svg v-if="bars.length" class="h-full w-full" :viewBox="`0 0 ${bars.length * 4} 100`" preserveAspectRatio="none" aria-hidden="true">
            <rect
              v-for="(level, i) in bars"
              :key="i"
              :x="i * 4 + 0.6"
              :y="50 - Math.max(3, Math.sqrt(level) * 48)"
              width="2.8"
              :height="Math.max(6, Math.sqrt(level) * 96)"
              rx="1.4"
              class="transition-colors duration-200"
              :class="barClass(i)"
            />
          </svg>
          <div v-else class="flex h-full items-center"><div class="h-1 w-full rounded-full bg-neutral-200" /></div>
        </div>
        <div class="mt-2 flex items-center justify-between gap-3 text-xs">
          <span v-if="events.length" class="flex items-center gap-1.5" :class="active === 'original' ? 'text-amber-700' : 'text-primary-700'">
            <span class="inline-block h-2.5 w-2.5 rounded-sm" :class="active === 'original' ? 'bg-amber-400' : 'bg-primary-500'" />
            {{ active === 'original' ? 'Mouth sounds' : 'Reduced by CalmEar' }}
          </span>
          <span v-else />
          <span class="tabular-nums text-neutral-500">{{ formatTime(position) }} / {{ formatTime(duration) }}</span>
        </div>
      </div>
    </div>
    <!-- Hear it up close: each mouth sound, original then with CalmEar -->
    <div v-if="events.length" class="mt-6 rounded-2xl bg-neutral-50 p-4 ring-1 ring-inset ring-neutral-100">
      <div class="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <p class="text-sm font-semibold text-neutral-900">Hear each mouth sound up close</p>
        <p class="text-xs text-neutral-500">1 second of the original, then the same second with CalmEar</p>
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        <button
          v-for="(e, i) in events"
          :key="i"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors"
          :class="closeup?.index === i
            ? (closeup.phase === 'original' ? 'bg-amber-50 text-amber-800 ring-amber-300' : 'bg-primary-50 text-primary-800 ring-primary-300')
            : 'bg-white text-neutral-700 ring-neutral-200 hover:bg-neutral-100'"
          :aria-label="`Hear mouth sound ${i + 1} at ${formatTime(e.startPts_s)}, original then with CalmEar`"
          @click="playCloseup(i)"
        >
          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z" /></svg>
          Sound {{ i + 1 }}
          <span class="tabular-nums text-neutral-400">{{ formatTime(e.startPts_s) }}</span>
        </button>
      </div>
    </div>
    <p v-if="loadFailed" class="mt-3 text-center text-sm text-amber-700">The audio could not be loaded. Please check your connection and press play again.</p>
  </div>
</template>
