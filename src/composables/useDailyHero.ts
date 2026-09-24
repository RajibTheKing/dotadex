import { computed } from 'vue'
import { useRosterStore } from '@/stores/roster'
import { usePlayerStore } from '@/stores/player'
import { hashSeed, seededRandom } from '@/utils/suggest'
import { CURSED_NOTES, pickRandom } from '@/utils/fun'

/**
 * "Cursed Hero of the Day" - deterministic per player + calendar day, so it
 * stays the same all day and changes at midnight without any storage.
 */
export function useDailyHero() {
  const roster = useRosterStore()
  const player = usePlayerStore()
  const dayKey = new Date().toISOString().slice(0, 10)
  const seedBase = `${player.accountId ?? 'anon'}:${dayKey}`

  const cursedHero = computed(() => {
    if (roster.heroes.length === 0) return null
    const rng = seededRandom(hashSeed(seedBase))
    return roster.heroes[Math.floor(rng() * roster.heroes.length)] ?? null
  })

  /** A fresh-looking slice of untouched heroes for the day. */
  const dailyUntouched = computed(() => {
    const pool = player.neverPlayed
    if (pool.length === 0) return []
    const rng = seededRandom(hashSeed(`${seedBase}:untouched`))
    const shuffled = [...pool]
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled.slice(0, 8)
  })

  const cursedNote = computed(() => {
    const rng = seededRandom(hashSeed(`${seedBase}:note`))
    return pickRandom(CURSED_NOTES, rng)
  })

  return { dayKey, cursedHero, cursedNote, dailyUntouched }
}
