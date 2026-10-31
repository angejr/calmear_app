<script setup lang="ts">
/**
 * One blog post (content/blog/<slug>.md), with SEO tags, Article structured
 * data, the CalmEar call to action and links to other posts.
 */
const route = useRoute()
const slug = route.params.slug as string
const { data } = await useFetch(`/api/blog/${slug}`)
if (!data.value) throw createError({ statusCode: 404, statusMessage: 'Post not found', fatal: true })

const post = computed(() => data.value!.post)
const related = computed(() => data.value!.related)
const appUrl = (useRuntimeConfig().public.appUrl as string).replace(/\/$/, '')
const url = `${appUrl}/blog/${slug}`

useSeoMeta({
  title: () => post.value.title,
  description: () => post.value.description,
  ogTitle: () => post.value.title,
  ogDescription: () => post.value.description,
  ogType: 'article',
  ogUrl: url,
  articlePublishedTime: () => post.value.date,
  articleModifiedTime: () => post.value.updated ?? post.value.date,
  articleAuthor: () => [post.value.author],
  robots: () => (post.value.draft ? 'noindex' : undefined),
})

useHead({
  script: [{
    type: 'application/ld+json',
    key: 'article-ld',
    innerHTML: () => JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      'headline': post.value.title,
      'description': post.value.description,
      'datePublished': post.value.date,
      'dateModified': post.value.updated ?? post.value.date,
      'author': { '@type': 'Person', 'name': post.value.author },
      'publisher': { '@type': 'Organization', 'name': 'CalmEar', 'url': appUrl },
      'mainEntityOfPage': url,
    }),
  }],
})

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}
</script>

<template>
  <div class="py-16 sm:py-24">
    <article class="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
      <NuxtLink to="/blog" class="text-sm font-medium text-primary-700 hover:underline">← All articles</NuxtLink>

      <header class="mt-6 mb-10">
        <p v-if="post.draft" class="mb-4 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
          Draft: only visible in development
        </p>
        <h1 class="text-3xl font-bold leading-tight text-neutral-900 sm:text-4xl">{{ post.title }}</h1>
        <p class="mt-4 text-sm text-neutral-500">
          By {{ post.author }} · <time :datetime="post.date">{{ formatDate(post.date) }}</time>
          <template v-if="post.updated"> · Updated <time :datetime="post.updated">{{ formatDate(post.updated) }}</time></template>
          · {{ post.readingMinutes }} min read
        </p>
      </header>

      <!-- Post content: Markdown from content/blog, written by us (trusted) -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div
        class="prose prose-neutral max-w-none prose-headings:font-semibold prose-a:text-primary-700 prose-a:underline-offset-2 hover:prose-a:text-primary-800 prose-blockquote:border-primary-300 prose-img:rounded-2xl"
        v-html="post.html"
      />

      <p class="mt-10 rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-600">
        This article shares personal experience and general information. It isn't medical advice: if sounds affect
        your daily life, a doctor, audiologist or therapist familiar with misophonia can help.
      </p>

      <div class="mt-10">
        <BlogCta />
      </div>

      <section v-if="related.length" class="mt-14">
        <h2 class="text-lg font-semibold text-neutral-900 mb-4">More articles</h2>
        <ul class="space-y-3">
          <li v-for="item in related" :key="item.slug">
            <NuxtLink :to="`/blog/${item.slug}`" class="block rounded-2xl border border-neutral-100 p-4 transition-colors hover:bg-neutral-50">
              <span class="font-medium text-neutral-900">{{ item.title }}</span>
              <span class="mt-1 block text-sm text-neutral-600">{{ item.description }}</span>
            </NuxtLink>
          </li>
        </ul>
      </section>
    </article>
  </div>
</template>
