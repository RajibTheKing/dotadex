<script setup lang="ts">
import { computed } from 'vue'
import AwardGrid from '@/components/AwardGrid.vue'
import ExcuseGenerator from '@/components/ExcuseGenerator.vue'
import HeroPortrait from '@/components/HeroPortrait.vue'
import ProgressRing from '@/components/ProgressRing.vue'
import { rateLimit } from '@/api/opendota'
import { useDailyHero } from '@/composables/useDailyHero'
import { useDexStore } from '@/stores/dex'
import { usePlayerStore } from '@/stores/player'
import { useRosterStore } from '@/stores/roster'
import { ACHIEVEMENTS, computeAwards, dexRank, playstyleTitle } from '@/utils/fun'
import {
  ATTRS,
  formatDuration,
  formatPercent,
  formatRelative,
  heroIconUrl,
  winRatePercent,
} from '@/utils/heroes'

const dex = useDexStore()
const player = usePlayerStore()
const roster = useRosterStore()
const { cursedHero, cursedNote } = useDailyHero()

const awards = computed(() => computeAwards(roster.heroes, player.heroRecords, dex.markedPlayed))
const playstyle = computed(() => playstyleTitle(player.heroRecords, roster.heroes))
const rankInfo = computed(() => dexRank(player.completion))

const attrBreakdown = computed(() => {
  const totals = ATTRS.map((attr) => {
    const heroes = roster.heroes.filter((hero) => hero.primary_attr === attr.key)
    const games = heroes.reduce(
      (sum, hero) => sum + (player.recordById.get(hero.id)?.games ?? 0), 0,
    )
    return { ...attr, heroes: heroes.length, games }
  })
  const grand = totals.reduce((sum, entry) => sum + entry.games, 0)
  return totals.map((entry) => ({
    ...entry,
    share: grand > 0 ? (entry.games / grand) * 100 : 0,
  }))
})

const topHeroes = computed(() => player.topHeroes.slice(0, 10))
const recentRows = computed(() => player.recentResults.slice(0, 20))

const achievementStates = computed(() =>
  ACHIEVEMENTS.map((achievement) => ({
    ...achievement,
    unlocked: achievement.unlocked(dex.counters),
    current: achievement.progress(dex.counters),
    done: achievement.unlocked(dex.counters),
  })),
)

const unlockedCount = computed(
  () => achievementStates.value.filter((entry) => entry.unlocked).length,
)
</script>

<template>
  <div class="stack">
    <section class="panel gold">
      <div class="row" style="align-items: flex-start; gap: 18px">
        <div class="spacer">
          <h1 style="margin-bottom: 4px">🏆 Wall of Fame (and Shame)</h1>
          <p class="muted tiny" style="max-width: 720px">
            Everything silly DotaDex can work out from your OpenDota history plus your own clicking.
            No judgement. Some judgement.
          </p>
          <div class="row tight">
            <span class="badge gold">{{ rankInfo.emoji }} {{ rankInfo.title }}</span>
            <span class="badge">{{ player.completion.toFixed(1) }}% dex complete</span>
            <span class="badge">{{ awards.length }} awards</span>
            <span class="badge">{{ unlockedCount }} / {{ achievementStates.length }} achievements</span>
          </div>
          <p class="tiny muted" style="margin-top: 8px">{{ rankInfo.blurb }}</p>
        </div>
        <ProgressRing :percent="player.completion" :size="128" label="complete" />
      </div>
    </section>

    <section v-if="!player.profile" class="panel">
      <div class="panel-title">Connect a player</div>
      <p class="muted" style="margin: 0">
        OpenDota needs an account id before DotaDex can be rude about your hero pool. Connect one on
        the <RouterLink to="/">home page</RouterLink>.
      </p>
    </section>

    <template v-else>
      <section class="panel" :style="{ borderColor: playstyle.color }">
        <div class="panel-title">🎭 Playstyle</div>
        <h2 style="margin: 0 0 4px; color: var(--gold-soft)">{{ playstyle.title }}</h2>
        <p class="muted tiny" style="margin: 0">{{ playstyle.blurb }}</p>
      </section>

      <section class="panel">
        <div class="panel-title">🏅 Award cabinet</div>
        <AwardGrid :awards="awards" />
      </section>

      <div class="grid-2">
        <section class="panel">
          <div class="panel-title">🎨 Attribute split</div>
          <div v-for="entry in attrBreakdown" :key="entry.key" style="margin-bottom: 10px">
            <div class="row tight" style="justify-content: space-between">
              <span class="tiny" :style="{ color: entry.color }">
                {{ entry.label }} · {{ entry.heroes }} heroes
              </span>
              <span class="tiny muted">
                {{ entry.games }} games · {{ entry.share.toFixed(1) }}%
              </span>
            </div>
            <div class="bar">
              <span :style="{ width: `${Math.max(1, entry.share)}%`, background: entry.color }" />
            </div>
          </div>
          <p class="tiny muted" style="margin: 6px 0 0">
            Based on games played per attribute — the honest mirror.
          </p>
        </section>

        <section class="panel">
          <div class="panel-title">🥇 Top 10 most played</div>
          <table class="data">
            <thead>
              <tr>
                <th>Hero</th>
                <th>Games</th>
                <th>Winrate</th>
                <th>Last played</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="record in topHeroes" :key="record.hero_id">
                <td>
                  <img
                    :src="heroIconUrl(roster.heroById(record.hero_id) ?? null)"
                    :alt="roster.heroName(record.hero_id)"
                    class="award-icon"
                    style="vertical-align: middle; margin-right: 6px"
                  />
                  {{ roster.heroName(record.hero_id) }}
                </td>
                <td>{{ record.games }}</td>
                <td>{{ formatPercent(winRatePercent(record.win, record.games)) }}</td>
                <td class="muted">{{ formatRelative(record.last_played) }}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>

      <div class="grid-2">
        <section class="panel">
          <div class="panel-title">🎖️ DotaDex achievements</div>
          <p class="tiny muted">
            These are about your behaviour in the app, not your MMR (mercifully).
          </p>
          <div class="stack" style="gap: 10px">
            <article
              v-for="achievement in achievementStates"
              :key="achievement.key"
              class="award"
              :class="achievement.unlocked ? 'glory' : 'locked'"
            >
              <div class="row tight">
                <span class="award-emoji">{{ achievement.emoji }}</span>
                <strong>{{ achievement.title }}</strong>
                <span class="spacer" />
                <span class="badge" :class="achievement.unlocked ? 'good' : ''">
                  {{ achievement.unlocked ? 'Unlocked' : 'Locked' }}
                </span>
              </div>
              <p class="tiny muted" style="margin: 6px 0 0">{{ achievement.detail }}</p>
              <p class="tiny muted" style="margin: 4px 0 0">Progress: {{ achievement.current }}</p>
            </article>
          </div>
        </section>

        <div class="stack">
          <section class="panel gold">
            <div class="panel-title">🔮 Cursed hero of the day</div>
            <div class="row" style="align-items: flex-start; gap: 14px">
              <div style="width: 92px; flex: 0 0 92px">
                <HeroPortrait :hero="cursedHero" icon />
              </div>
              <div class="spacer">
                <h3 style="margin-bottom: 2px">{{ cursedHero?.localized_name ?? 'Loading…' }}</h3>
                <p class="tiny muted" style="margin: 0">{{ cursedNote }}</p>
              </div>
            </div>
          </section>

          <section class="panel">
            <div class="panel-title">📊 DotaDex counters</div>
            <table class="data">
              <tbody>
                <tr><th>Rolls</th><td>{{ dex.counters.rolls }}</td></tr>
                <tr><th>Heroes logged as played</th><td>{{ dex.counters.newHeroes }}</td></tr>
                <tr><th>Suggestions dodged</th><td>{{ dex.counters.skips }}</td></tr>
                <tr><th>Heroes banished</th><td>{{ dex.counters.bans }}</td></tr>
                <tr><th>Cycles completed</th><td>{{ dex.counters.cycles }}</td></tr>
                <tr><th>Current cycle</th><td>{{ dex.cycle }}</td></tr>
                <tr>
                  <th>OpenDota requests left (minute)</th>
                  <td>
                    {{ rateLimit.minuteRemaining ?? '—' }}
                    <span v-if="rateLimit.minuteLimit" class="muted">/ {{ rateLimit.minuteLimit }}</span>
                  </td>
                </tr>
                <tr>
                  <th>OpenDota requests left (day)</th>
                  <td>
                    {{ rateLimit.dayRemaining ?? '—' }}
                    <span v-if="rateLimit.dayLimit" class="muted">/ {{ rateLimit.dayLimit }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>
      </div>

      <section class="panel">
        <div class="panel-title">🕹️ Recent matches</div>
        <table class="data">
          <thead>
            <tr>
              <th>Hero</th>
              <th>Result</th>
              <th>K / D / A</th>
              <th>Mode</th>
              <th>Duration</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="match in recentRows" :key="match.matchId">
              <td>
                <img
                  :src="heroIconUrl(roster.heroById(match.heroId) ?? null)"
                  :alt="roster.heroName(match.heroId)"
                  class="award-icon"
                  style="vertical-align: middle; margin-right: 6px"
                />
                {{ roster.heroName(match.heroId) }}
              </td>
              <td :style="{ color: match.won ? 'var(--radiant)' : 'var(--dire)' }">
                {{ match.won ? 'Win' : 'Loss' }}
              </td>
              <td>{{ match.kills }} / {{ match.deaths }} / {{ match.assists }}</td>
              <td class="muted">{{ roster.gameModeName(match.gameMode) }}</td>
              <td class="muted">{{ formatDuration(match.duration) }}</td>
              <td class="muted">{{ formatRelative(match.startTime) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <ExcuseGenerator />

    </template>
  </div>
</template>

