<script setup lang="ts">
import { computed } from 'vue'
import HeroPortrait from '@/components/HeroPortrait.vue'
import { useRosterStore } from '@/stores/roster'
import type { Suggestion } from '@/utils/suggest'
import { attrInfo, formatPercent } from '@/utils/heroes'

const props = withDefaults(
  defineProps<{
    suggestion: Suggestion
    primary?: boolean
    /** Heroes that statistically ruin this pick. */
    threats?: { heroId: number; winrate: number; games: number }[]
    banned?: boolean
  }>(),
  { primary: false, threats: () => [], banned: false },
)

const emit = defineEmits<{
  (event: 'played'): void
  (event: 'skip'): void
  (event: 'ban'): void
  (event: 'unban'): void
}>()

const roster = useRosterStore()
const hero = computed(() => props.suggestion.hero)
const attr = computed(() => attrInfo(hero.value.primary_attr))
const games = computed(() => props.suggestion.record?.games ?? 0)
</script>

<template>
  <article class="panel suggestion" :class="{ primary }" :style="{ borderColor: primary ? attr.color : undefined }">
    <div class="row" style="align-items: flex-start; gap: 14px">
      <div class="suggestion-portrait">
        <HeroPortrait :hero="hero" />
      </div>
      <div class="spacer">
        <div class="row tight">
          <h3 style="margin: 0">{{ hero.localized_name }}</h3>
          <span class="badge" :style="{ borderColor: attr.color, color: attr.color }">{{ attr.label }}</span>
          <span class="badge">{{ hero.attack_type }}</span>
          <span v-if="banned" class="badge bad">On your trauma list</span>
        </div>
        <p class="tiny muted" style="margin: 4px 0 6px">
          {{ hero.roles.join(' · ') || 'No roles listed' }}
        </p>
        <div class="row tight">
          <span v-if="games === 0" class="badge new">Never played</span>
          <span v-else class="badge">{{ games }} games with you</span>
          <span v-if="suggestion.winrate !== null" class="badge good">
            {{ formatPercent(suggestion.winrate) }} your winrate
          </span>
          <span v-if="suggestion.bracketWinrate !== null" class="badge gold">
            {{ formatPercent(suggestion.bracketWinrate) }} bracket WR
          </span>
        </div>
        <ul class="reason-list" style="margin-top: 8px">
          <li v-for="reason in suggestion.reasons" :key="reason">{{ reason }}</li>
        </ul>

        <div v-if="threats.length > 0" style="margin-top: 8px">
          <span class="tiny muted">Danger list — against these heroes you almost never win: </span>
          <span
            v-for="threat in threats"
            :key="threat.heroId"
            class="badge bad"
            style="margin-right: 4px"
          >
            {{ roster.heroName(threat.heroId) }} you win {{ threat.winrate.toFixed(1) }}%
          </span>
        </div>

        <div class="row tight" style="margin-top: 10px">
          <button type="button" class="primary" @click="emit('played')">✅ I played it</button>
          <button type="button" @click="emit('skip')">⏭️ Skip</button>
          <button v-if="!banned" type="button" class="danger" @click="emit('ban')">🚫 Never again</button>
          <button v-else type="button" @click="emit('unban')">↩️ Unban</button>
        </div>
      </div>
    </div>
  </article>
</template>
