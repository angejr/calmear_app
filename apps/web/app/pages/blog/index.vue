<script setup lang="ts">
/**
 * Blog index: posts from content/blog, newest first (server/utils/blog.ts).
 */
useSeoMeta({
  title: 'CalmEar blog: living with misophonia',
  description: 'Practical help for people sensitive to mouth sounds and other misophonia triggers, from someone who has misophonia.',
  ogTitle: 'CalmEar blog: living with misophonia',
  ogDescription: 'Practical help for people sensitive to mouth sounds and other misophonia triggers, from someone who has misophonia.',
  ogType: 'website',
})

const { data: posts } = await useFetch('/api/blog', { default: () => [] })

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}
</script>

<template>
  <div class="py-16 sm:py-24">
    <div class="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
      <header class="mb-12">
        <h1 class="text-4xl font-bold text-neutral-900 mb-4">Blog</h1>
        <p class="text-lg text-neutral-600">
          Practical help for living with misophonia and sensitivity to mouth sounds, written by Ange, CalmEar's founder, who has misophonia.
        </p>
      </header>

      <div v-if="posts.length" class="space-y-6">
        <article v-for="post in posts" :key="post.slug" class="card p-6 transition-shadow hover:shadow-md">
          <NuxtLink :to="`/blog/${post.slug}`" class="group block">
            <p class="text-xs text-neutral-500">
              <time :datetime="post.date">{{ formatDate(post.date) }}</time> · {{ post.readingMinutes }} min read
              <span v-if="post.draft" class="ml-2 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">Draft (dev only)</span>
            </p>
            <h2 class="mt-2 text-xl font-semibold text-neutral-900 group-hover:text-primary-700">{{ post.title }}</h2>
            <p class="mt-2 text-neutral-600">{{ post.description }}</p>
            <p class="mt-3 text-sm font-semibold text-primary-700">Read the article →</p>
          </NuxtLink>
        </article>
      </div>
      <div v-else class="card p-8 text-center text-neutral-600">
        The first articles are on their way.
      </div>
    </div>
  </div>
</template>
