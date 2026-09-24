<script setup lang="ts">
import HeroPortrait from '@/components/HeroPortrait.vue'
import type { HeroStats } from '@/types/opendota'

withDefaults(
  defineProps<{
    hero?: HeroStats | null
    spinning: boolean
    headline?: string
  }>(),
  { hero: null, headline: '' },
)
</script>

<template>
  <div class="roulette" :class="{ spinning }">
    <HeroPortrait :hero="hero" :alt="spinning ? 'Rolling…' : hero?.localized_name || 'No hero yet'" />
    <div class="reveal-name">
      <template v-if="spinning">Rolling…</template>
      <template v-else-if="hero">{{ hero.localized_name }}</template>
      <template v-else>Ready when you are</template>
    </div>
    <p v-if="headline" class="muted tiny center" style="margin: 0">{{ headline }}</p>
  </div>
</template>
