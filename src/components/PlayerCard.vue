<script setup lang="ts">
import { computed } from 'vue'
import ProgressRing from '@/components/ProgressRing.vue'
import { usePlayerStore } from '@/stores/player'
import { useRosterStore } from '@/stores/roster'
import { useToast } from '@/composables/useToast'
import { formatPercent, rankLabel } from '@/utils/heroes'
import { dexRank } from '@/utils/fun'

const player = usePlayerStore()
const roster = useRosterStore()
const toast = useToast()

const profile = computed(() => player.profile)
const rank = computed(() => rankLabel(player.summary?.rank_tier ?? null))
const rankTitle = computed(() => dexRank(player.completion))
/** Human-readable list of the modes OpenDota left out of its lifetime totals. */
const extraModeNames = computed(
  () =>
    [...new Set(player.extraMatches.map((match) => roster.gameModeName(match.game_mode)))]
      .sort()
      .join(' / '),
)

async function refresh(): Promise<void> {
  await player.load(true)
  if (player.error) {
    toast.push(player.error, 'error')
    return
  }
  toast.push('Profile refreshed from OpenDota.', 'success')
}

function disconnect(): void {
  player.disconnect()
  toast.push('Player disconnected. Your dex memories remain.', 'info')
}
</script>

<template>
  <section class="panel gold player-card">
    <template v-if="profile">
      <div class="row" style="gap: 16px; align-items: flex-start">
        <img v-if="profile.avatarfull || profile.avatar" :src="profile.avatarfull || profile.avatar || ''" alt="" class="avatar-lg" />
        <div class="spacer">
          <h2 style="margin-bottom: 2px">{{ profile.personaname || 'Anonymous player' }}</h2>
          <div class="row tight">
            <span class="badge gold">{{ rank }}</span>
            <span v-if="player.summary?.leaderboard_rank" class="badge">
              Leaderboard #{{ player.summary.leaderboard_rank }}
            </span>
            <span v-if="player.summary?.computed_mmr" class="badge">
              ~{{ player.summary.computed_mmr }} MMR
            </span>
            <span class="badge">{{ player.totalGames.toLocaleString() }} games tracked</span>
            <span v-if="player.wl" class="badge good">{{ player.wl.win }} W</span>
            <span v-if="player.wl" class="badge bad">{{ player.wl.lose }} L</span>
            <span v-if="player.winrate !== null" class="badge">
              {{ formatPercent(player.winrate) }} lifetime
            </span>
            <span
              class="badge new"
              title="Turbo, Ability Draft, event modes and everything else are counted. OpenDota hides them behind its 'significant matches' filter by default; DotaDex asks for them with significant=0."
            >
              🎮 all modes
            </span>
          </div>
          <p class="tiny muted" style="margin: 8px 0 0">
            Account {{ profile.account_id }} · dex rank {{ rankTitle.emoji }} {{ rankTitle.title }} ·
            {{ player.neverPlayed.length }} heroes still untouched (out of {{ roster.heroes.length }}).
            <span v-if="player.extraMatches.length > 0">
              Totals cover every game mode: {{ player.extraMatches.length }} recent
              {{ extraModeNames }} match{{ player.extraMatches.length === 1 ? '' : 'es' }} that
              OpenDota omits from its lifetime stats were folded in.
            </span>
          </p>
        </div>
        <ProgressRing :percent="player.completion" :size="128" label="dex complete" />
      </div>

      <div class="row tight" style="margin-top: 14px">
        <button type="button" @click="refresh" :disabled="player.loading">
          {{ player.loading ? 'Refreshing…' : '🔄 Refresh' }}
        </button>
        <a class="btn" :href="`https://www.opendota.com/players/${profile.account_id}`" target="_blank" rel="noreferrer">
          OpenDota profile ↗
        </a>
        <button type="button" class="ghost" @click="disconnect">Disconnect</button>
      </div>
    </template>
    <template v-else>
      <div class="panel-title">No player connected</div>
      <p class="muted" style="margin: 0">Connect an account on the home page to unlock dex tracking.</p>
    </template>
  </section>
</template>
