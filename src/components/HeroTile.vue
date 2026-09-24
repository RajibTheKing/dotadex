<script setup lang="ts">
import { computed } from 'vue'
import HeroPortrait from '@/components/HeroPortrait.vue'
import type { HeroMetaStats, PlayerHero } from '@/types/opendota'
import { attrInfo, formatRelative, formatPercent, winRatePercent } from '@/utils/heroes'

const props = withDefaults(
  defineProps<{
    hero: HeroMetaStats
    record?: PlayerHero | null
    locallyPlayed?: boolean
    banned?: boolean
    suggested?: boolean
    skips?: number
    selected?: boolean
  }>(),
  {
    record: null,
    locallyPlayed: false,
    banned: false,
    suggested: false,
    skips: 0,
    selected: false,
  },
)

const emit = defineEmits<{ (event: 'select', hero: HeroMetaStats): void }>()

const games = computed(() => props.record?.games ?? 0)
const played = computed(() => games.value > 0 || props.locallyPlayed)
const winrate = computed(() =>
  props.record ? winRatePercent(props.record.win, props.record.games) : null,
)
const attr = computed(() => attrInfo(props.hero.primary_attr))
</script>

<template>
  <button
    type="button"
    class="hero-tile"
    :class="{
      untouched: !played,
      played,
      extra: selected || suggested,
    }"
    :title="`${hero.localized_name} · ${hero.roles.join(', ') || 'no roles listed'}`"
    @click="emit('select', hero)"
  >
    <HeroPortrait :hero="hero" />
    <span class="tile-body">
      <span class="tile-name">{{ hero.localized_name }}</span>
      <span class="row tight" style="gap: 4px">
        <span class="badge" :style="{ borderColor: attr.color, color: attr.color }">
          {{ attr.short }}
        </span>
        <span v-if="!played" class="badge new">New</span>
        <span v-else-if="locallyPlayed && games === 0" class="badge gold">Logged</span>
        <span v-else class="badge">{{ games }} games</span>
        <span v-if="banned" class="badge bad">Banned</span>
        <span v-else-if="skips > 0" class="badge gold">{{ skips }}× dodged</span>
      </span>
      <span class="tiny muted" style="display: block; margin-top: 4px">
        <template v-if="winrate !== null">{{ formatPercent(winrate) }} WR · </template>
        {{ record?.last_played ? formatRelative(record.last_played) : 'never played' }}
      </span>
    </span>
  </button>
</template>
