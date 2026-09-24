<script setup lang="ts">
import { useRosterStore } from '@/stores/roster'
import type { Award } from '@/utils/fun'
import { heroIconUrl } from '@/utils/heroes'

defineProps<{ awards: Award[] }>()

const roster = useRosterStore()

function iconFor(heroId: number | null): string {
  if (heroId === null) return ''
  return heroIconUrl(roster.heroById(heroId) ?? null)
}
</script>

<template>
  <div class="award-grid">
    <article v-for="award in awards" :key="award.key" class="award" :class="award.tone">
      <div class="row tight">
        <span class="award-emoji">{{ award.emoji }}</span>
        <strong>{{ award.title }}</strong>
        <span class="spacer" />
        <img v-if="award.heroId !== null" :src="iconFor(award.heroId)" :alt="roster.heroName(award.heroId)" class="award-icon" />
      </div>
      <p class="tiny muted" style="margin: 6px 0 0">{{ award.detail }}</p>
    </article>
  </div>
</template>
