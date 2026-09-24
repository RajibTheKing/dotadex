<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { HeroStats } from '@/types/opendota'
import { heroIconUrl, heroImageUrl } from '@/utils/heroes'

const props = withDefaults(
  defineProps<{
    hero?: HeroStats | null
    /** Use the square icon instead of the wide portrait. */
    icon?: boolean
    alt?: string
  }>(),
  { hero: null, icon: false, alt: '' },
)

const failed = ref(false)
const src = computed(() => (props.icon ? heroIconUrl(props.hero) : heroImageUrl(props.hero)))
const fallback = computed(() => (props.hero?.localized_name ?? '?').slice(0, 2).toUpperCase())

watch(src, () => {
  failed.value = false
})
</script>

<template>
  <img
    v-if="src && !failed"
    :src="src"
    :alt="alt || hero?.localized_name || 'hero portrait'"
    loading="lazy"
    @error="failed = true"
  />
  <span v-else class="portrait-fallback" :title="hero?.localized_name || 'unknown hero'">
    {{ fallback }}
  </span>
</template>
