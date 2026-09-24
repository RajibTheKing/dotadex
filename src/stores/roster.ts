import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchGameModes, fetchHeroStats, prettyGameModeName } from '@/api/opendota'
import type { HeroMetaStats } from '@/types/opendota'

/** The global hero roster (all 127 heroes + meta stats). Loaded once per session. */
export const useRosterStore = defineStore('roster', () => {
  const heroes = ref<HeroMetaStats[]>([])
  const gameModes = ref<Record<number, string>>({})
  const loading = ref(false)
  const error = ref<string | null>(null)

  const byId = computed(() => new Map(heroes.value.map((hero) => [hero.id, hero])))
  const alphabetized = computed(() =>
    [...heroes.value].sort((a, b) => a.localized_name.localeCompare(b.localized_name)),
  )
  const loadFailed = computed(() => !loading.value && heroes.value.length === 0)

  async function load(force = false): Promise<void> {
    if (loading.value) return
    loading.value = true
    error.value = null
    try {
      heroes.value = await fetchHeroStats(force ? { noCache: true } : {})
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Could not load the hero roster.'
    } finally {
      loading.value = false
    }
  }

  async function loadGameModes(): Promise<void> {
    if (Object.keys(gameModes.value).length > 0) return
    try {
      const constants = await fetchGameModes()
      const mapped: Record<number, string> = {}
      Object.values(constants).forEach((entry) => {
        mapped[entry.id] = prettyGameModeName(entry.name)
      })
      gameModes.value = mapped
    } catch {
      /* game mode names are cosmetic - silently ignore failures */
    }
  }

  function heroById(id: number): HeroMetaStats | undefined {
    return byId.value.get(id)
  }

  function heroName(id: number): string {
    return byId.value.get(id)?.localized_name ?? `Hero #${id}`
  }

  function gameModeName(id: number): string {
    return gameModes.value[id] ?? `Mode ${id}`
  }

  return {
    heroes,
    loading,
    error,
    byId,
    alphabetized,
    loadFailed,
    load,
    loadGameModes,
    heroById,
    heroName,
    gameModeName,
  }
})
