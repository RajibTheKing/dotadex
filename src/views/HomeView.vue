<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import ConnectPlayer from '@/components/ConnectPlayer.vue'
import PlayerCard from '@/components/PlayerCard.vue'
import HeroTile from '@/components/HeroTile.vue'
import HeroPortrait from '@/components/HeroPortrait.vue'
import AwardGrid from '@/components/AwardGrid.vue'
import { useDailyHero } from '@/composables/useDailyHero'
import { useDexStore } from '@/stores/dex'
import { usePlayerStore } from '@/stores/player'
import { useRosterStore } from '@/stores/roster'
import { computeAwards, dexRank, playstyleTitle } from '@/utils/fun'
import { FRESH_WINDOW_DAYS } from '@/utils/fresh'
import { formatPercent, heroIconUrl } from '@/utils/heroes'
import type { HeroMetaStats } from '@/types/opendota'

const player = usePlayerStore()
const roster = useRosterStore()
const dex = useDexStore()
const router = useRouter()
const { cursedHero, cursedNote, dailyUntouched, dailyEmptyReason, dayKey } = useDailyHero()

const awards = computed(() => computeAwards(roster.heroes, player.heroRecords, dex.markedPlayed))
const awardTeaser = computed(() => awards.value.slice(0, 4))
const dexRankInfo = computed(() => dexRank(player.completion))
const playstyle = computed(() => playstyleTitle(player.heroRecords, roster.heroes))

function openHero(hero: HeroMetaStats): void {
  void router.push({ path: '/dex', query: { hero: String(hero.id) } })
}
</script>

<template>
  <div class="stack">
    <section class="panel gold hero-banner">
      <h1>🎯 DotaDex</h1>
      <p class="muted" style="max-width: 760px">
        Enter your Dota account and DotaDex turns OpenDota data into a hero-collection tracker plus a
        match-by-match suggestion engine: it only hands you heroes you have never played, and it never
        repeats itself until the whole roster has been served once.
      </p>

      <div v-if="!player.profile" class="connect-block">
        <ConnectPlayer />
      </div>

      <div v-else class="row tight" style="margin-top: 10px">
        <RouterLink to="/suggest" class="btn primary big-roll">Roll my next hero</RouterLink>
        <RouterLink to="/dex" class="btn">Browse the dex</RouterLink>
        <RouterLink to="/stats" class="btn ghost">Wall of Fame</RouterLink>
        <span class="spacer" />
        <span class="badge gold">{{ player.neverPlayed.length }} heroes never played</span>
      </div>

      <div v-if="player.error" class="panel" style="margin-top: 12px; border-color: #d0523a">
        <strong>OpenDota said no:</strong>
        <p class="tiny" style="margin: 4px 0 0">{{ player.error }}</p>
      </div>
    </section>

    <PlayerCard v-if="player.profile" />

    <div v-if="player.profile" class="grid-2">
      <section class="panel">
        <div class="panel-title">🎲 Your next match</div>
        <p class="muted tiny">
          New Hero Only mode: untouched heroes first, then the next cycle. You have
          <strong>{{ dex.queue.length }}</strong> hero{{ dex.queue.length === 1 ? '' : 'es' }} parked in
          the cycle-{{ dex.cycle }} queue right now.
        </p>
        <div class="row tight">
          <RouterLink to="/suggest" class="btn primary">Roll a hero</RouterLink>
          <span class="badge">Dex rank: {{ dexRankInfo.emoji }} {{ dexRankInfo.title }}</span>
        </div>
        <p class="tiny muted" style="margin-top: 10px">{{ dexRankInfo.blurb }}</p>
        <div class="bar" style="margin-top: 8px">
          <span :style="{ width: `${Math.max(2, player.completion)}%` }" />
        </div>
        <p class="tiny muted" style="margin-top: 6px">
          {{ player.playedIds.size }} / {{ roster.heroes.length }} heroes played ·
          {{ player.completion.toFixed(1) }}% complete
        </p>
      </section>

      <section class="panel gold">
        <div class="panel-title">🔮 Cursed hero of the day</div>
        <div class="row" style="align-items: flex-start; gap: 14px">
          <div style="width: 92px; flex: 0 0 92px">
            <HeroPortrait :hero="cursedHero" icon />
          </div>
          <div class="spacer">
            <h3 style="margin-bottom: 2px">{{ cursedHero?.localized_name ?? 'Loading…' }}</h3>
            <p class="tiny muted" style="margin: 0 0 6px">{{ cursedNote }}</p>
            <p class="tiny muted" style="margin: 0">
              Fixed for {{ dayKey }}. Changes at midnight, because chaos needs a schedule.
            </p>
          </div>
        </div>
      </section>
    </div>

    <div v-if="player.profile" class="grid-2">
      <section class="panel">
        <div class="panel-title">🆕 Fresh faces for today</div>
        <p v-if="dailyUntouched.length > 0" class="tiny muted">
          {{ dailyUntouched.length }} heroes with no game in the last {{ FRESH_WINDOW_DAYS }} days —
          anything you played recently is kept out of this row.
        </p>
        <p v-if="dailyUntouched.length === 0" class="muted tiny">
          <template v-if="dailyEmptyReason === 'complete'">
            Every hero in the roster has been played. Unbelievable. Go touch grass, then come back for
            cycle {{ dex.cycle + 1 }}.
          </template>
          <template v-else>
            Every hero was played in the last {{ FRESH_WINDOW_DAYS }} days, so nothing is stale enough
            to offer. Rotate a few cold heroes and this row fills straight back up.
          </template>
        </p>
        <div v-else class="hero-grid">
          <HeroTile
            v-for="hero in dailyUntouched"
            :key="hero.id"
            :hero="hero"
            :record="player.recordById.get(hero.id) ?? null"
            :locally-played="player.locallyOnlyPlayedIds.includes(hero.id)"
            :banned="dex.isBanned(hero.id)"
            :suggested="dex.seenIds.includes(hero.id)"
            :skips="dex.queue.find((entry) => entry.heroId === hero.id)?.skips ?? 0"
            @select="openHero"
          />
        </div>
      </section>

      <section class="panel">
        <div class="panel-title">📉 Recent form (last {{ player.recentResults.length }})</div>
        <p class="tiny muted">
          <template v-if="player.recentWinrate !== null">
            {{ formatPercent(player.recentWinrate) }} winrate lately.
          </template>
          <template v-else>No recent matches on record.</template>
        </p>
        <div class="form-strip">
          <span
            v-for="match in player.recentResults"
            :key="match.matchId"
            class="form-chip"
            :class="match.won ? 'win' : 'loss'"
            :title="`${roster.heroName(match.heroId)} · ${match.kills}/${match.deaths}/${match.assists}`"
          >
            <img
              :src="heroIconUrl(roster.heroById(match.heroId) ?? null)"
              :alt="roster.heroName(match.heroId)"
            />
          </span>
        </div>
        <p class="tiny muted" style="margin-top: 10px">
          Playstyle: <strong :style="{ color: playstyle.color }">{{ playstyle.title }}</strong> —
          {{ playstyle.blurb }}
        </p>
      </section>
    </div>

    <section v-if="player.profile && awardTeaser.length > 0" class="panel">
      <div class="panel-title">🏆 Awards unlocked</div>
      <AwardGrid :awards="awardTeaser" />
      <p class="tiny muted" style="margin-top: 10px">
        <RouterLink to="/stats">See the full Wall of Fame →</RouterLink>
      </p>
    </section>

    <div class="grid-2">
      <section class="panel">
        <div class="panel-title">🧭 How the anti-repeat rule works</div>
        <ol class="reason-list">
          <li>DotaDex reads your hero history from OpenDota (games per hero).</li>
          <li>Rolling a hero parks it in the cycle queue kept in this browser.</li>
          <li>Queued heroes stay out of the pool, so a reroll cannot return the same hero.</li>
          <li>Mark heroes as played once you have actually played them.</li>
          <li>When the queue clears, cycle {{ dex.cycle + 1 }} begins and everyone is fair game again.</li>
        </ol>
      </section>
    </div>
  </div>
</template>
