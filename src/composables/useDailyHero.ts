import { computed } from 'vue'
import { useRosterStore } from '@/stores/roster'
import { usePlayerStore } from '@/stores/player'
import { hashSeed, seededRandom } from '@/utils/suggest'
import { CURSED_NOTES, pickRandom } from '@/utils/fun'
import { pickFreshFaces } from '@/utils/fresh'

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

  /**
   * "Fresh faces for today" - always FRESH_FACES_COUNT heroes that have gone
   * stale. Never-played heroes lead (still shuffled daily), then the played
   * heroes whose last game is oldest. Anything played inside FRESH_WINDOW_DAYS,
   * or still sitting in the last 20 matches, is kept out so a hero you just
   * picked never turns up here.
   */
  const dailyUntouched = computed(() =>
    pickFreshFaces(roster.heroes, {
      playedIds: player.playedIds,
      lastPlayedOf: (heroId) => player.recordById.get(heroId)?.last_played ?? 0,
      recentHeroIds: player.recentResults.map((match) => match.heroId),
      now: Date.now(),
      rng: seededRandom(hashSeed(`${seedBase}:untouched`)),
    }),
  )

  /** Why the strip is empty - there is always a reason, even a smug one. */
  const dailyEmptyReason = computed<'complete' | 'all-recent' | null>(() => {
    if (dailyUntouched.value.length > 0) return null
    if (roster.heroes.length > 0 && player.playedIds.size >= roster.heroes.length) return 'complete'
    return 'all-recent'
  })

  const cursedNote = computed(() => {
    const rng = seededRandom(hashSeed(`${seedBase}:note`))
    return pickRandom(CURSED_NOTES, rng)
  })

  return { dayKey, cursedHero, cursedNote, dailyUntouched, dailyEmptyReason }
}
