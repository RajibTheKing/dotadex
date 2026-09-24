<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FilterBar from '@/components/FilterBar.vue'
import HeroPortrait from '@/components/HeroPortrait.vue'
import HeroTile from '@/components/HeroTile.vue'
import ProgressRing from '@/components/ProgressRing.vue'
import { fetchHeroMatchups } from '@/api/opendota'
import type { HeroMetaStats } from '@/types/opendota'
import { useDexStore } from '@/stores/dex'
import { usePlayerStore } from '@/stores/player'
import { useRosterStore } from '@/stores/roster'
import { useToast } from '@/composables/useToast'
import { createDexFilters, SORT_OPTIONS } from '@/utils/filters'
import { attrInfo, bracketWinRate, formatDate, formatPercent, winRatePercent } from '@/utils/heroes'
import { worstMatchupsFor } from '@/utils/suggest'

const dex = useDexStore()
const player = usePlayerStore()
const roster = useRosterStore()
const toast = useToast()
const route = useRoute()
const router = useRouter()

const filters = reactive(createDexFilters())
const selectedId = ref<number | null>(null)
const matchups = ref<Awaited<ReturnType<typeof fetchHeroMatchups>>>([])

const selectedHero = computed<HeroMetaStats | null>(() =>
  selectedId.value === null ? null : (roster.heroById(selectedId.value) ?? null),
)
const selectedRecord = computed(() =>
  selectedId.value === null ? null : (player.recordById.get(selectedId.value) ?? null),
)
const selectedAttr = computed(() => attrInfo(selectedHero.value?.primary_attr ?? 'all'))
const selectedWinrate = computed(() =>
  selectedRecord.value ? winRatePercent(selectedRecord.value.win, selectedRecord.value.games) : null,
)
const selectedThreats = computed(() => worstMatchupsFor(matchups.value, 5, 120))
const playedCount = computed(() => player.playedIds.size)

function recordOf(hero: HeroMetaStats) {
  return player.recordById.get(hero.id) ?? null
}

const filtered = computed(() => {
  const search = filters.search.trim().toLowerCase()
  const list = roster.heroes.filter((hero) => {
    if (search && !hero.localized_name.toLowerCase().includes(search)) return false
    if (filters.attrs.length > 0 && !filters.attrs.includes(hero.primary_attr)) return false
    if (filters.attackType !== 'all' && hero.attack_type !== filters.attackType) return false
    if (filters.roles.length > 0 && !filters.roles.some((role) => hero.roles.includes(role))) {
      return false
    }
    if (filters.hideBanned && dex.isBanned(hero.id)) return false
    const played = player.playedIds.has(hero.id)
    if (filters.onlyUntouched && played) return false
    if (filters.onlyTouched && !played) return false
    return true
  })

  return list.sort((a, b) => {
    switch (filters.sort) {
      case 'games':
        return (recordOf(b)?.games ?? 0) - (recordOf(a)?.games ?? 0)
      case 'winrate': {
        const wa = winRatePercent(recordOf(a)?.win ?? 0, recordOf(a)?.games ?? 0) ?? -1
        const wb = winRatePercent(recordOf(b)?.win ?? 0, recordOf(b)?.games ?? 0) ?? -1
        return wb - wa
      }
      case 'recent':
        return (recordOf(b)?.last_played ?? 0) - (recordOf(a)?.last_played ?? 0)
      case 'meta':
        return (bracketWinRate(b, player.bracket) ?? 0) - (bracketWinRate(a, player.bracket) ?? 0)
      default:
        return a.localized_name.localeCompare(b.localized_name)
    }
  })
})

function select(hero: HeroMetaStats): void {
  selectedId.value = hero.id
  void router.replace({ query: { ...route.query, hero: String(hero.id) } })
}

function closeDetail(): void {
  selectedId.value = null
  const query = { ...route.query }
  delete query.hero
  void router.replace({ query })
}

function markPlayed(): void {
  if (selectedId.value === null) return
  dex.markPlayed(selectedId.value)
  toast.push(`${roster.heroName(selectedId.value)} logged as played.`, 'success')
}

function unmarkPlayed(): void {
  if (selectedId.value === null) return
  dex.unmarkPlayed(selectedId.value)
  toast.push(`${roster.heroName(selectedId.value)} unlogged. Back to the mystery pile.`, 'info')
}

function toggleBan(): void {
  if (selectedId.value === null) return
  if (dex.isBanned(selectedId.value)) {
    dex.unban(selectedId.value)
    toast.push(`${roster.heroName(selectedId.value)} is allowed back in your life.`, 'info')
  } else {
    dex.ban(selectedId.value)
    toast.push(`${roster.heroName(selectedId.value)} added to the trauma list.`, 'warn')
  }
}

watch(selectedId, async (heroId) => {
  matchups.value = []
  if (heroId === null) return
  try {
    matchups.value = await fetchHeroMatchups(heroId)
  } catch {
    matchups.value = []
  }
})

onMounted(() => {
  const fromQuery = Number(route.query.hero)
  if (Number.isFinite(fromQuery) && fromQuery > 0) selectedId.value = fromQuery
})

watch(
  () => route.query.hero,
  (value) => {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0 && parsed !== selectedId.value) {
      selectedId.value = parsed
    }
  },
)

</script>

<template>
  <div class="stack">
    <section class="panel gold">
      <div class="row" style="align-items: flex-start; gap: 18px">
        <div class="spacer">
          <h1 style="margin-bottom: 4px">📖 The Dex</h1>
          <p class="muted tiny" style="max-width: 720px">
            Every hero in the game with your own record attached. Greyed-out heroes are still
            untouched — those are the ones the suggestion engine hunts for first.
          </p>
          <div class="row tight">
            <span class="badge good">{{ playedCount }} played</span>
            <span class="badge new">{{ roster.heroes.length - playedCount }} untouched</span>
            <span class="badge gold">{{ dex.queue.length }} queued this cycle</span>
            <span class="badge bad">{{ dex.banned.length }} on the trauma list</span>
            <span v-if="player.locallyOnlyPlayedIds.length > 0" class="badge">
              {{ player.locallyOnlyPlayedIds.length }} logged locally
            </span>
          </div>
        </div>
        <ProgressRing :percent="player.completion" :size="128" label="complete" />
      </div>
    </section>

    <section class="panel">
      <FilterBar :filters="filters" :show-dex-only="true">
        <template #extra>
          <select v-model="filters.sort" style="max-width: 190px">
            <option v-for="option in SORT_OPTIONS" :key="option.key" :value="option.key">
              Sort: {{ option.label }}
            </option>
          </select>
        </template>
      </FilterBar>
      <p class="tiny muted" style="margin: 10px 0 0">
        Showing {{ filtered.length }} of {{ roster.heroes.length }} heroes.
      </p>
    </section>

    <section v-if="selectedHero" class="panel" :style="{ borderColor: selectedAttr.color }">
      <div class="row" style="align-items: flex-start; gap: 16px">
        <div style="width: 190px; flex: 0 0 190px">
          <HeroPortrait :hero="selectedHero" />
        </div>
        <div class="spacer">
          <div class="row tight">
            <h2 style="margin: 0">{{ selectedHero.localized_name }}</h2>
            <span
              class="badge"
              :style="{ borderColor: selectedAttr.color, color: selectedAttr.color }"
            >
              {{ selectedAttr.label }}
            </span>
            <span class="badge">{{ selectedHero.attack_type }}</span>
            <span v-if="dex.isBanned(selectedHero.id)" class="badge bad">Trauma list</span>
          </div>
          <p class="tiny muted" style="margin: 6px 0 8px">
            {{ selectedHero.roles.join(' · ') || 'No roles listed' }} ·
            {{ selectedHero.legs }} legs · {{ selectedHero.move_speed }} ms ·
            {{ selectedHero.attack_range }} attack range
          </p>

          <div class="row tight">
            <span class="badge">{{ selectedRecord?.games ?? 0 }} games</span>
            <span v-if="selectedWinrate !== null" class="badge good">
              {{ formatPercent(selectedWinrate) }} your winrate
            </span>
            <span v-if="selectedRecord?.last_played" class="badge">
              last played {{ formatDate(selectedRecord.last_played) }}
            </span>
            <span v-if="bracketWinRate(selectedHero, player.bracket) !== null" class="badge gold">
              {{ formatPercent(bracketWinRate(selectedHero, player.bracket)) }} bracket WR
            </span>
          </div>

          <table class="data" style="margin-top: 10px; max-width: 540px">
            <tbody>
              <tr>
                <th>Str / Agi / Int</th>
                <td>
                  {{ selectedHero.base_str }} (+{{ selectedHero.str_gain }}) /
                  {{ selectedHero.base_agi }} (+{{ selectedHero.agi_gain }}) /
                  {{ selectedHero.base_int }} (+{{ selectedHero.int_gain }})
                </td>
              </tr>
              <tr>
                <th>Damage</th>
                <td>
                  {{ selectedHero.base_attack_min }}–{{ selectedHero.base_attack_max }} ·
                  {{ selectedHero.base_attack_time }} attack time
                </td>
              </tr>
              <tr>
                <th>Health / Mana</th>
                <td>
                  {{ selectedHero.base_health }} hp · {{ selectedHero.base_mana }} mana ·
                  {{ selectedHero.base_armor }} armour
                </td>
              </tr>
            </tbody>
          </table>

          <div v-if="selectedThreats.length > 0" style="margin-top: 10px">
            <span class="tiny muted">Counters to fear (games your hero wins against them): </span>
            <span
              v-for="threat in selectedThreats"
              :key="threat.heroId"
              class="badge bad"
              style="margin-right: 4px"
            >
              {{ roster.heroName(threat.heroId) }} {{ threat.winrate.toFixed(1) }}%
            </span>
          </div>

          <div class="row tight" style="margin-top: 12px">
            <button
              v-if="!selectedRecord || selectedRecord.games === 0"
              type="button"
              @click="markPlayed"
            >
              ✅ Log as played
            </button>
            <button
              v-else
              type="button"
              :disabled="!player.locallyOnlyPlayedIds.includes(selectedHero.id)"
              @click="unmarkPlayed"
            >
              ↩️ Unlog local entry
            </button>
            <button
              type="button"
              :class="dex.isBanned(selectedHero.id) ? '' : 'danger'"
              @click="toggleBan"
            >
              {{ dex.isBanned(selectedHero.id) ? '↩️ Unban' : '🚫 Never again' }}
            </button>
            <a
              class="btn ghost"
              :href="`https://www.opendota.com/heroes/${selectedHero.id}`"
              target="_blank"
              rel="noreferrer"
            >
              OpenDota hero page ↗
            </a>
            <button type="button" class="ghost" @click="closeDetail">Close</button>
          </div>
        </div>
      </div>
    </section>

    <section class="panel">
      <div v-if="filtered.length === 0" class="muted">
        No hero matches those filters. Fewer roles, more mercy.
      </div>
      <div v-else class="hero-grid">
        <HeroTile
          v-for="hero in filtered"
          :key="hero.id"
          :hero="hero"
          :record="player.recordById.get(hero.id) ?? null"
          :locally-played="player.locallyOnlyPlayedIds.includes(hero.id)"
          :banned="dex.isBanned(hero.id)"
          :suggested="dex.seenIds.includes(hero.id)"
          :skips="dex.queue.find((entry) => entry.heroId === hero.id)?.skips ?? 0"
          :selected="selectedId === hero.id"
          @select="select"
        />
      </div>
    </section>

  </div>
</template>

