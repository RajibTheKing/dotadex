import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  fetchPlayer,
  fetchPlayerHeroes,
  fetchPlayerWL,
  fetchRecentMatches,
} from '@/api/opendota'
import type { PlayerHero, PlayerSummary, PlayerWL, RecentMatch } from '@/types/opendota'
import { useDexStore } from '@/stores/dex'
import { useRosterStore } from '@/stores/roster'
import { rankTierToBracket, winRatePercent } from '@/utils/heroes'

/**
 * Everything OpenDota knows about the connected player, plus the derived dex
 * stats (completion, never-played list, recent form).
 */
export const usePlayerStore = defineStore('player', () => {
  const dex = useDexStore()
  const roster = useRosterStore()

  const summary = ref<PlayerSummary | null>(null)
  const heroRecords = ref<PlayerHero[]>([])
  const wl = ref<PlayerWL | null>(null)
  const recent = ref<RecentMatch[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const loadedAt = ref<number | null>(null)

  const accountId = computed(() => dex.accountId)
  const isConnected = computed(() => summary.value !== null && summary.value.profile.account_id === dex.accountId)
  const profile = computed(() => summary.value?.profile ?? null)
  const bracket = computed(() => rankTierToBracket(summary.value?.rank_tier ?? null))
  const recordById = computed(() => new Map(heroRecords.value.map((record) => [record.hero_id, record])))
  const totalGames = computed(() => heroRecords.value.reduce((sum, record) => sum + record.games, 0))
  const winrate = computed(() => {
    if (!wl.value) return null
    return winRatePercent(wl.value.win, wl.value.win + wl.value.lose)
  })

  const serverPlayedIds = computed(
    () => new Set(heroRecords.value.filter((record) => record.games > 0).map((record) => record.hero_id)),
  )
  /** Heroes logged locally that OpenDota cannot see yet. */
  const locallyOnlyPlayedIds = computed(() =>
    dex.markedPlayed.filter((id) => !serverPlayedIds.value.has(id)),
  )
  const playedIds = computed(() => new Set<number>([...serverPlayedIds.value, ...dex.markedPlayed]))
  const neverPlayed = computed(() => roster.alphabetized.filter((hero) => !playedIds.value.has(hero.id)))
  const completion = computed(() => {
    if (roster.heroes.length === 0) return 0
    return (playedIds.value.size / roster.heroes.length) * 100
  })
  const topHeroes = computed(() => [...heroRecords.value].sort((a, b) => b.games - a.games))

  /** Last 20 results, newest first - "recent form" for the home page. */
  const recentResults = computed(() =>
    recent.value.slice(0, 20).map((match) => {
      const isRadiant = match.player_slot < 128
      return {
        matchId: match.match_id,
        heroId: match.hero_id,
        won: isRadiant === match.radiant_win,
        kills: match.kills,
        deaths: match.deaths,
        assists: match.assists,
        startTime: match.start_time,
        duration: match.duration,
        gameMode: match.game_mode,
        laneRole: match.lane_role,
      }
    }),
  )

  const recentWinrate = computed(() => {
    if (recentResults.value.length === 0) return null
    const wins = recentResults.value.filter((entry) => entry.won).length
    return (wins / recentResults.value.length) * 100
  })

  async function load(force = false): Promise<void> {
    const id = dex.accountId
    if (!id || loading.value) return
    loading.value = true
    error.value = null
    try {
      const options = force ? { noCache: true } : {}
      const [player, heroes, winLose, matches] = await Promise.all([
        fetchPlayer(id, options),
        fetchPlayerHeroes(id, options),
        fetchPlayerWL(id, options).catch(() => null),
        fetchRecentMatches(id, options).catch(() => [] as RecentMatch[]),
      ])
      summary.value = player
      heroRecords.value = heroes
      wl.value = winLose
      recent.value = matches
      loadedAt.value = Date.now()
    } catch (caught) {
      summary.value = null
      heroRecords.value = []
      error.value =
        caught instanceof Error
          ? caught.message
          : 'Could not load that profile. Double-check the account id.'
    } finally {
      loading.value = false
    }
  }

  async function connect(id: number): Promise<void> {
    dex.setAccountId(id)
    summary.value = null
    heroRecords.value = []
    await load(true)
  }

  function disconnect(): void {
    dex.setAccountId(null)
    summary.value = null
    heroRecords.value = []
    wl.value = null
    recent.value = []
    error.value = null
    loadedAt.value = null
  }

  return {
    summary,
    heroRecords,
    wl,
    recent,
    loading,
    error,
    loadedAt,
    accountId,
    isConnected,
    profile,
    bracket,
    recordById,
    totalGames,
    winrate,
    serverPlayedIds,
    locallyOnlyPlayedIds,
    playedIds,
    neverPlayed,
    completion,
    topHeroes,
    recentResults,
    recentWinrate,
    load,
    connect,
    disconnect,
  }
})

