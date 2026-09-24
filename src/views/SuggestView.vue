<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import FilterBar from '@/components/FilterBar.vue'
import RollReveal from '@/components/RollReveal.vue'
import SuggestionCard from '@/components/SuggestionCard.vue'
import QueueList from '@/components/QueueList.vue'
import { fetchHeroMatchups } from '@/api/opendota'
import type { HeroMatchup, HeroMetaStats } from '@/types/opendota'
import { useDexStore } from '@/stores/dex'
import { usePlayerStore } from '@/stores/player'
import { useRosterStore } from '@/stores/roster'
import { useToast } from '@/composables/useToast'
import { createDexFilters } from '@/utils/filters'
import { COACH_QUIPS, ROLL_BUTTON_LABELS, pickRandom } from '@/utils/fun'
import {
  SUGGEST_MODES,
  rouletteStrip,
  suggestHeroes,
  worstMatchupsFor,
  type SuggestFilters,
  type SuggestMode,
  type Suggestion,
} from '@/utils/suggest'

const dex = useDexStore()
const player = usePlayerStore()
const roster = useRosterStore()
const toast = useToast()

const mode = ref<SuggestMode>('fresh')
const filters = reactive(createDexFilters())
const enemyHeroId = ref<number | null>(null)
const enemyMatchups = ref<HeroMatchup[]>([])

const spinning = ref(false)
const spinningHero = ref<HeroMetaStats | null>(null)
const picks = ref<Suggestion[]>([])
const note = ref('')
const poolSize = ref(0)
const threats = ref<{ heroId: number; winrate: number; games: number }[]>([])
const threatsHeroId = ref<number | null>(null)
const coachQuip = ref(pickRandom(COACH_QUIPS))
const rollLabel = ref(pickRandom(ROLL_BUTTON_LABELS))

const primaryPick = computed(() => picks.value[0] ?? null)
const alternatives = computed(() => picks.value.slice(1))
const activeMode = computed(
  () => SUGGEST_MODES.find((entry) => entry.key === mode.value) ?? SUGGEST_MODES[0],
)
const heroesSorted = computed(() => roster.alphabetized)

/** Untouched AND not yet served this cycle - the honest "how much is left" number. */
const freshRemaining = computed(
  () =>
    player.neverPlayed.filter(
      (hero) => !dex.seenIds.includes(hero.id) && !dex.banned.includes(hero.id),
    ).length,
)

const revealHero = computed(
  () => (spinning.value ? spinningHero.value : primaryPick.value?.hero) ?? null,
)

function buildFilters(): SuggestFilters {
  return {
    roles: [...filters.roles],
    attrs: [...filters.attrs],
    attackType: filters.attackType,
    banned: [...dex.banned],
    seen: [...dex.seenIds],
    locallyPlayed: [...dex.markedPlayed],
  }
}

/** All heroes passing the current UI filters - used for the spin animation. */
function stripPool(): HeroMetaStats[] {
  return roster.heroes.filter((hero) => {
    if (filters.attrs.length > 0 && !filters.attrs.includes(hero.primary_attr)) return false
    if (filters.attackType !== 'all' && hero.attack_type !== filters.attackType) return false
    if (filters.roles.length > 0 && !filters.roles.some((role) => hero.roles.includes(role))) {
      return false
    }
    return true
  })
}

function animateStrip(pool: HeroMetaStats[]): Promise<void> {
  return new Promise((resolve) => {
    const strip = rouletteStrip(pool.length > 0 ? pool : roster.heroes, Math.random, 30)
    let index = 0
    const timer = window.setInterval(() => {
      spinningHero.value = strip[index % strip.length] ?? null
      index += 1
    }, 70)
    window.setTimeout(() => {
      window.clearInterval(timer)
      resolve()
    }, 1500)
  })
}

async function roll(): Promise<void> {
  if (roster.heroes.length === 0) {
    toast.push(roster.error ?? 'Hero roster is still loading. One moment.', 'warn')
    return
  }
  if (spinning.value) return

  if (mode.value === 'counter' && !enemyHeroId.value) {
    toast.push('Pick the enemy hero first, then roll.', 'warn')
    return
  }

  spinning.value = true
  picks.value = []
  threats.value = []
  note.value = ''
  coachQuip.value = pickRandom(COACH_QUIPS)
  rollLabel.value = pickRandom(ROLL_BUTTON_LABELS)

  if (mode.value === 'counter' && enemyHeroId.value) {
    try {
      enemyMatchups.value = await fetchHeroMatchups(enemyHeroId.value)
    } catch (caught) {
      spinning.value = false
      toast.push(caught instanceof Error ? caught.message : 'Could not load matchup data.', 'error')
      return
    }
  }

  await animateStrip(stripPool())

  let result = suggestHeroes({
    mode: mode.value,
    heroes: roster.heroes,
    playerHeroes: player.heroRecords,
    filters: buildFilters(),
    bracket: player.bracket,
    enemyHeroId: enemyHeroId.value,
    enemyMatchups: enemyMatchups.value,
    count: 5,
  })

  if (result.lapComplete && dex.queue.length > 0) {
    // Every untouched hero had been served: clear the queue so cycle N+1 begins
    // and the "untouched & unqueued" counter stays honest.
    dex.startNewCycle()
  }

  picks.value = result.picks
  note.value = result.note
  poolSize.value = result.poolSize

  const winner = result.picks[0]
  if (!winner) {
    spinning.value = false
    spinningHero.value = null
    toast.push(result.note || 'No hero matched those filters.', 'warn')
    return
  }

  spinningHero.value = winner.hero
  spinning.value = false
  dex.registerRoll(winner.hero.id, mode.value)
  void loadThreats(winner.hero.id)
}

async function loadThreats(heroId: number): Promise<void> {
  threatsHeroId.value = heroId
  threats.value = []
  try {
    const matchups = await fetchHeroMatchups(heroId)
    threats.value = worstMatchupsFor(matchups, 5, 120)
  } catch {
    threats.value = []
  }
}

function markPlayed(heroId: number): void {
  dex.markPlayed(heroId)
  picks.value = picks.value.filter((pick) => pick.hero.id !== heroId)
  toast.push(`${roster.heroName(heroId)} logged in the dex. Progress is progress.`, 'success')
}

function skipHero(heroId: number): void {
  dex.skip(heroId)
  picks.value = picks.value.filter((pick) => pick.hero.id !== heroId)
  toast.push(`${roster.heroName(heroId)} dodged. It will remember.`, 'warn')
}

function banHero(heroId: number): void {
  dex.ban(heroId)
  picks.value = picks.value.filter((pick) => pick.hero.id !== heroId)
  toast.push(`${roster.heroName(heroId)} banished from the dex. Forever-ish.`, 'info')
}

async function copyPartyMessage(): Promise<void> {
  const hero = primaryPick.value
  if (!hero) return
  const roles = hero.hero.roles.slice(0, 2).join('/') || hero.hero.attack_type
  const text = `🎲 DotaDex says I am locking ${hero.hero.localized_name} (${roles}). Cycle ${dex.cycle}. Pray for me.`
  try {
    await navigator.clipboard.writeText(text)
    toast.push('Copied. Paste it in all-chat for emotional support.', 'success')
  } catch {
    toast.push(text, 'info', 9000)
  }
}

watch(
  () => [filters.roles, filters.attrs, filters.attackType],
  () => {
    picks.value = []
    note.value = ''
  },
  { deep: true },
)

watch(mode, () => {
  picks.value = []
  note.value = ''
})

</script>

<template>
  <div class="stack">
    <section class="panel gold">
      <h1 style="margin-bottom: 4px">🎲 Roll me a hero</h1>
      <p class="muted tiny" style="max-width: 780px">
        Default mode is <strong>New Hero Only</strong>: DotaDex serves heroes you have never played,
        and anything it already served is locked out until the queue empties. Rerolls, skips and bans
        all feed the same queue, so you cannot be handed the same hero twice in a lap.
      </p>

      <div class="row tight" style="margin-top: 8px">
        <button
          v-for="entry in SUGGEST_MODES"
          :key="entry.key"
          type="button"
          class="chip"
          :class="{ active: mode === entry.key }"
          @click="mode = entry.key"
        >
          {{ entry.emoji }} {{ entry.label }}
        </button>
      </div>
      <p class="tiny muted" style="margin: 8px 0 0">{{ activeMode.blurb }}</p>

      <div v-if="mode === 'counter'" class="row tight" style="margin-top: 10px">
        <label class="field" style="margin: 0">Enemy hero</label>
        <select v-model="enemyHeroId" style="max-width: 260px">
          <option :value="null">Choose the enemy…</option>
          <option v-for="hero in heroesSorted" :key="hero.id" :value="hero.id">
            {{ hero.localized_name }}
          </option>
        </select>
      </div>

      <div style="margin-top: 12px">
        <FilterBar :filters="filters" />
      </div>

      <div class="row tight" style="margin-top: 14px">
        <button type="button" class="primary big-roll" :disabled="spinning" @click="roll">
          {{ spinning ? 'Rolling…' : rollLabel }}
        </button>
        <button type="button" class="ghost" :disabled="spinning || !primaryPick" @click="roll">
          🔄 Reroll
        </button>
        <button
          type="button"
          class="ghost"
          :disabled="!primaryPick"
          @click="copyPartyMessage"
        >
          📋 Copy for the party
        </button>
        <span class="spacer" />
        <span class="badge">Cycle {{ dex.cycle }}</span>
        <span class="badge gold">Queue: {{ dex.queue.length }}</span>
        <span class="badge new">Untouched &amp; unqueued: {{ freshRemaining }}</span>
        <span class="badge">{{ player.neverPlayed.length }} never played</span>
      </div>

      <p v-if="note" class="tiny" style="margin: 10px 0 0; color: var(--gold-soft)">{{ note }}</p>
      <p v-if="!player.profile" class="tiny muted" style="margin: 10px 0 0">
        No account connected: DotaDex cannot tell which heroes you own, so everyone counts as new. The
        cycle queue still keeps rolls from repeating.
      </p>
    </section>

    <div class="grid-2">
      <div class="stack">
        <RollReveal
          :hero="revealHero"
          :spinning="spinning"
          :headline="
            primaryPick
              ? `${poolSize} candidates passed your filters for this roll.`
              : 'Filter by role, attribute or range, then roll.'
          "
        />
        <div class="panel">
          <div class="panel-title">🧠 Coach’s corner</div>
          <p class="tiny" style="margin: 0">{{ coachQuip }}</p>
        </div>
      </div>

      <QueueList
        :entries="dex.queue"
        :cycle="dex.cycle"
        @played="markPlayed"
        @skip="skipHero"
        @ban="banHero"
      />
    </div>

    <section v-if="primaryPick" class="stack">
      <SuggestionCard
        :suggestion="primaryPick"
        :primary="true"
        :threats="threatsHeroId === primaryPick.hero.id ? threats : []"
        :banned="dex.isBanned(primaryPick.hero.id)"
        @played="markPlayed(primaryPick.hero.id)"
        @skip="skipHero(primaryPick.hero.id)"
        @ban="banHero(primaryPick.hero.id)"
        @unban="dex.unban(primaryPick.hero.id)"
      />

      <section v-if="alternatives.length > 0" class="panel">
        <div class="panel-title">🎯 Backups (same roll)</div>
        <p class="tiny muted">
          The engine ranked these next. Marking one as played removes it from the pool; skipping keeps
          it in the cycle queue with a dodge badge.
        </p>
        <div class="stack">
          <SuggestionCard
            v-for="pick in alternatives"
            :key="pick.hero.id"
            :suggestion="pick"
            :banned="dex.isBanned(pick.hero.id)"
            @played="markPlayed(pick.hero.id)"
            @skip="skipHero(pick.hero.id)"
            @ban="banHero(pick.hero.id)"
            @unban="dex.unban(pick.hero.id)"
          />
        </div>
      </section>
    </section>

    <section class="panel">
      <div class="panel-title">📚 Suggestion history (this browser)</div>
      <p v-if="dex.history.length === 0" class="tiny muted" style="margin: 0">
        Nothing yet. Roll something and DotaDex will keep receipts.
      </p>
      <table v-else class="data">
        <thead>
          <tr>
            <th>Hero</th>
            <th>Mode</th>
            <th>Outcome</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in dex.history.slice(0, 12)" :key="`${entry.heroId}-${entry.at}`">
            <td>{{ roster.heroName(entry.heroId) }}</td>
            <td>{{ entry.mode }}</td>
            <td>{{ entry.outcome }}</td>
            <td class="muted">{{ new Date(entry.at).toLocaleString() }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="dex.banned.length > 0" class="panel">
      <div class="panel-title">🚫 Trauma list</div>
      <p class="tiny muted">Heroes the engine will never hand you again (unless you unban them).</p>
      <div class="row tight">
        <button
          v-for="heroId in dex.banned"
          :key="heroId"
          type="button"
          class="chip"
          @click="dex.unban(heroId)"
        >
          {{ roster.heroName(heroId) }} ✕
        </button>
      </div>
    </section>

  </div>
</template>

