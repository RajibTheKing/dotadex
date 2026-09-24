<script setup lang="ts">
import { useRosterStore } from '@/stores/roster'
import type { QueueEntry } from '@/stores/dex'
import { heroIconUrl } from '@/utils/heroes'
import type { HeroMetaStats } from '@/types/opendota'

const props = defineProps<{
  entries: QueueEntry[]
  cycle: number
}>()

const emit = defineEmits<{
  (event: 'played', heroId: number): void
  (event: 'skip', heroId: number): void
  (event: 'ban', heroId: number): void
}>()

const roster = useRosterStore()

function heroOf(heroId: number): HeroMetaStats | null {
  return roster.heroById(heroId) ?? null
}

function iconFor(heroId: number): string {
  return heroIconUrl(heroOf(heroId))
}

void props
</script>

<template>
  <div class="panel">
    <div class="panel-title">📜 Cycle {{ cycle }} queue</div>
    <p class="tiny muted">
      Every hero you roll is parked here so it cannot come back until the queue is empty. That is the
      whole "no repeats" promise.
    </p>

    <p v-if="entries.length === 0" class="muted tiny" style="margin: 0">
      Empty queue. The entire hero pool is fair game again.
    </p>

    <ul v-else class="queue-list">
      <li v-for="entry in entries" :key="entry.heroId" class="queue-item">
        <img :src="iconFor(entry.heroId)" :alt="roster.heroName(entry.heroId)" />
        <span class="spacer">
          <span style="display: block">{{ roster.heroName(entry.heroId) }}</span>
          <span class="tiny muted">
            served {{ new Date(entry.addedAt).toLocaleDateString() }} ·
            <template v-if="entry.skips > 0">{{ entry.skips }}× dodged</template>
            <template v-else>behaving so far</template>
          </span>
        </span>
        <span class="row tight" style="gap: 4px">
          <button type="button" class="chip" title="Mark as played" @click="emit('played', entry.heroId)">
            ✅
          </button>
          <button type="button" class="chip" title="Dodge (counts as cowardice)" @click="emit('skip', entry.heroId)">
            ⏭️
          </button>
          <button type="button" class="chip" title="Add to trauma list" @click="emit('ban', entry.heroId)">
            🚫
          </button>
        </span>
      </li>
    </ul>
  </div>
</template>
