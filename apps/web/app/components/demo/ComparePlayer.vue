<script setup lang="ts">
/**
 * A/B player: both versions play in sync from one Web Audio clock and only
 * the selected one is audible, so switching keeps the exact position.
 */
import type { SmackEvent } from '~/lib/calmear-demo/pipeline'

const props = defineProps<{
  original: AudioBuffer
  processed: AudioBuffer
  events: SmackEvent[]
}>()

type Track = 'original' | 'processed'

const SWITCH_RAMP_S = 0.01

const active = ref<Track>('processed')
const playing = ref(false)
const position = ref(0)
const duration = computed(() => props.original.duration)

let ctx: AudioContext | null = null
let nodes: { sources: AudioBufferSourceNode[], gains: Record<Track, GainNode> } | null = null
let startedAt = 0
let startOffset = 0
let raf = 0

const tracks: { key: Track, label: string }[] = [
  { key: 'original', label: 'Original' },
  { key: 'processed', label: 'With CalmEar' },
]

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
}

async function play(from: number) {
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') await ctx.resume()
  stopNodes()
  const offset = from >= duration.value - 0.01 ? 0 : from
  const gains = { original: ctx.createGain(), processed: ctx.createGain() }
  gains.original.gain.value = active.value === 'original' ? 1 : 0
  gains.processed.gain.value = active.value === 'processed' ? 1 : 0
  const sources = (['original', 'processed'] as const).map((key) => {
    const s = ctx!.createBufferSource()
    s.buffer = key === 'original' ? props.original : props.processed
    s.connect(gains[key]).connect(ctx!.destination)
    return s
  })
  const when = ctx.currentTime + 0.02
  for (const s of sources) s.start(when, offset)
  sources[0]!.onended = () => {
    stopNodes()
    playing.value = false
    cancelAnimationFrame(raf)
    position.value = 0
  }
  nodes = { sources, gains }
  startedAt = when
  startOffset = offset
  playing.value = true
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(tick)
}

function pause() {
  position.value = currentTime()
  playing.value = false
  cancelAnimationFrame(raf)
  stopNodes()
}

function select(track: Track) {
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

function onTrackButton(track: Track) {
  if (playing.value && active.value === track) {
    pause()
    return
  }
  select(track)
  if (!playing.value) play(position.value)
}

function seek(event: MouseEvent) {
  const el = event.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  const t = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * duration.value
  position.value = t
  if (playing.value) play(t)
}

function seekBy(delta: number) {
  const t = Math.max(0, Math.min(duration.value, currentTime() + delta))
  position.value = t
  if (playing.value) play(t)
}

function formatTime(s: number): string {
  const whole = Math.floor(s)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

const markers = computed(() => props.events.map(e => ({
  left: `${(Math.max(0, e.startPts_s) / duration.value) * 100}%`,
  width: `${Math.max(0.6, ((e.endPts_s - e.startPts_s) / duration.value) * 100)}%`,
})))

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  stopNodes()
  ctx?.close().catch(() => {})
  ctx = null
})
</script>

<template>
  <div class="space-y-3">
    <div
      v-for="track in tracks"
      :key="track.key"
      class="flex items-center gap-4 rounded-xl border px-4 py-3 transition-colors"
      :class="active === track.key ? 'border-primary-200 bg-primary-50' : 'border-neutral-100 bg-white'"
    >
      <button
        type="button"
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors"
        :class="active === track.key ? 'bg-primary-600 text-white hover:bg-primary-700' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'"
        :aria-label="playing && active === track.key ? `Pause ${track.label}` : `Play ${track.label}`"
        @click="onTrackButton(track.key)"
      >
        <svg v-if="playing && active === track.key" class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></svg>
        <svg v-else class="h-5 w-5 translate-x-0.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z" /></svg>
      </button>
      <div class="min-w-0 flex-1">
        <div class="mb-2 flex items-baseline justify-between text-sm">
          <span class="font-semibold" :class="active === track.key ? 'text-primary-700' : 'text-neutral-700'">{{ track.label }}</span>
          <span class="tabular-nums text-xs text-neutral-500">{{ formatTime(position) }} / {{ formatTime(duration) }}</span>
        </div>
        <div
          class="relative h-2 cursor-pointer rounded-full bg-neutral-200"
          role="slider"
          tabindex="0"
          :aria-label="`${track.label} position`"
          :aria-valuemin="0"
          :aria-valuemax="Math.round(duration)"
          :aria-valuenow="Math.round(position)"
          @click="seek"
          @keydown.left.prevent="seekBy(-1)"
          @keydown.right.prevent="seekBy(1)"
        >
          <template v-if="track.key === 'processed'">
            <span
              v-for="(m, i) in markers"
              :key="i"
              class="absolute inset-y-0 rounded-full bg-amber-400/70"
              :style="{ left: m.left, width: m.width }"
            />
          </template>
          <span
            class="absolute inset-y-0 left-0 rounded-full"
            :class="active === track.key ? 'bg-primary-500' : 'bg-neutral-400'"
            :style="{ width: `${(position / duration) * 100}%`, opacity: 0.85 }"
          />
        </div>
      </div>
    </div>
    <p class="text-center text-xs text-neutral-500">
      Switch between the two while it plays: both stay in sync.
      <template v-if="events.length">
        <span class="mx-1 inline-block h-2 w-3 rounded-full bg-amber-400/70 align-middle" /> marks where CalmEar reduced a mouth sound.
      </template>
    </p>
  </div>
</template>
