import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { DexCounters } from '@/utils/fun'
import { readJson, writeJson, clearAll } from '@/utils/storage'
import { setApiKey as setApiKeyHeader } from '@/api/opendota'
import type { SuggestMode } from '@/utils/suggest'

export interface QueueEntry {
  heroId: number
  addedAt: number
  mode: SuggestMode
  /** How many times this hero has been dodged in the current cycle. */
  skips: number
}

export interface HistoryEntry {
  heroId: number
  mode: SuggestMode
  at: number
  outcome: 'pending' | 'played' | 'skipped' | 'rerolled' | 'banned'
}

const EMPTY_COUNTERS: DexCounters = { rolls: 0, newHeroes: 0, skips: 0, bans: 0, cycles: 0 }

/**
 * Everything the browser remembers between visits: connected account, API key,
 * the cycle queue that guarantees no hero repeats, the trauma list and the
 * silly stat counters.
 */
export const useDexStore = defineStore('dex', () => {
  const accountId = ref<number | null>(readJson<number | null>('accountId', null))
  const apiKey = ref<string>(readJson<string>('apiKey', ''))
  const queue = ref<QueueEntry[]>(readJson<QueueEntry[]>('queue', []))
  const markedPlayed = ref<number[]>(readJson<number[]>('markedPlayed', []))
  const banned = ref<number[]>(readJson<number[]>('banned', []))
  const history = ref<HistoryEntry[]>(readJson<HistoryEntry[]>('history', []))
  const cycle = ref<number>(readJson<number>('cycle', 1))
  const counters = ref<DexCounters>(readJson<DexCounters>('counters', { ...EMPTY_COUNTERS }))

  // Persist every slice of state automatically.
  watch(accountId, (value) => writeJson('accountId', value))
  watch(apiKey, (value) => {
    writeJson('apiKey', value)
    setApiKeyHeader(value)
  })
  watch(queue, (value) => writeJson('queue', value), { deep: true })
  watch(markedPlayed, (value) => writeJson('markedPlayed', value), { deep: true })
  watch(banned, (value) => writeJson('banned', value), { deep: true })
  watch(history, (value) => writeJson('history', value), { deep: true })
  watch(cycle, (value) => writeJson('cycle', value))
  watch(counters, (value) => writeJson('counters', value), { deep: true })

  // Apply a previously stored API key once at start-up.
  setApiKeyHeader(apiKey.value)

  const seenIds = computed(() => queue.value.map((entry) => entry.heroId))
  const bannedIds = computed(() => banned.value)
  const locallyPlayedIds = computed(() => markedPlayed.value)

  function setAccountId(value: number | null): void {
    accountId.value = value
  }

  function setApiKey(value: string): void {
    apiKey.value = value.trim()
  }

  function pushHistory(entry: HistoryEntry): void {
    history.value = [entry, ...history.value].slice(0, 120)
  }

  /** Records a hero as served this cycle - this is what prevents repeats. */
  function registerRoll(heroId: number, mode: SuggestMode): void {
    counters.value.rolls += 1
    const existing = queue.value.find((entry) => entry.heroId === heroId)
    if (existing) {
      existing.addedAt = Date.now()
    } else {
      queue.value = [...queue.value, { heroId, addedAt: Date.now(), mode, skips: 0 }]
    }
    pushHistory({ heroId, mode, at: Date.now(), outcome: 'pending' })
  }

  function markPlayed(heroId: number): void {
    queue.value = queue.value.filter((entry) => entry.heroId !== heroId)
    if (!markedPlayed.value.includes(heroId)) {
      markedPlayed.value = [...markedPlayed.value, heroId]
      counters.value.newHeroes += 1
    }
    history.value = history.value.map((entry) =>
      entry.heroId === heroId && entry.outcome === 'pending'
        ? { ...entry, outcome: 'played' }
        : entry,
    )
    pushHistory({ heroId, mode: 'fresh', at: Date.now(), outcome: 'played' })
  }

  function unmarkPlayed(heroId: number): void {
    markedPlayed.value = markedPlayed.value.filter((id) => id !== heroId)
  }

  /** Dodged heroes stay in the queue but collect shame badges. */
  function skip(heroId: number): void {
    counters.value.skips += 1
    queue.value = queue.value.map((entry) =>
      entry.heroId === heroId ? { ...entry, skips: entry.skips + 1 } : entry,
    )
    pushHistory({ heroId, mode: 'fresh', at: Date.now(), outcome: 'skipped' })
  }

  function reroll(heroId: number): void {
    pushHistory({ heroId, mode: 'fresh', at: Date.now(), outcome: 'rerolled' })
  }

  function ban(heroId: number): void {
    if (!banned.value.includes(heroId)) {
      banned.value = [...banned.value, heroId]
      counters.value.bans += 1
    }
    queue.value = queue.value.filter((entry) => entry.heroId !== heroId)
    pushHistory({ heroId, mode: 'fresh', at: Date.now(), outcome: 'banned' })
  }

  function unban(heroId: number): void {
    banned.value = banned.value.filter((id) => id !== heroId)
  }

  function isBanned(heroId: number): boolean {
    return banned.value.includes(heroId)
  }

  /** Called when the fresh pool runs dry: everyone gets a new lap. */
  function startNewCycle(): void {
    cycle.value += 1
    counters.value.cycles += 1
    queue.value = []
  }

  /** Hero of the day changes at midnight, so no need to store it. */
  function resetLocal(): void {
    clearAll()
    queue.value = []
    markedPlayed.value = []
    banned.value = []
    history.value = []
    cycle.value = 1
    counters.value = { ...EMPTY_COUNTERS }
  }

  return {
    accountId,
    apiKey,
    queue,
    markedPlayed,
    banned,
    history,
    cycle,
    counters,
    seenIds,
    bannedIds,
    locallyPlayedIds,
    setAccountId,
    setApiKey,
    registerRoll,
    markPlayed,
    unmarkPlayed,
    skip,
    reroll,
    ban,
    unban,
    isBanned,
    startNewCycle,
    resetLocal,
  }
})
