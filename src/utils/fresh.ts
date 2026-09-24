/**
 * The "Fresh faces for today" picker.
 *
 * Two rules, both hard:
 *  1. Always hand back FRESH_FACES_COUNT heroes whenever the roster allows it.
 *  2. Never show a hero you played recently - the strip is for heroes that have
 *     gone stale, not the ones still warm from your last game.
 *
 * Never-played heroes always lead (they are the freshest faces of all) and are
 * shuffled with the day seed so the pick still rotates at midnight. Once those
 * run out, played heroes are appended oldest-last-game first, so the top of the
 * stale block is genuinely "not played for a while".
 */

import type { HeroMetaStats } from '@/types/opendota'

/** How many heroes the strip always tries to show. */
export const FRESH_FACES_COUNT = 10

/** A hero whose last game is inside this window counts as recently played. */
export const FRESH_WINDOW_DAYS = 7

const SECONDS_PER_DAY = 86_400

export interface FreshFaceOptions {
  /** Heroes the player has picked at least once (server + locally logged). */
  playedIds: Set<number>
  /** Unix seconds of the hero's last game, 0 when unknown. */
  lastPlayedOf: (heroId: number) => number
  /** Heroes sitting in the player's most recent matches. */
  recentHeroIds: number[]
  /** Unix seconds "now", injected so the rule is testable. */
  now: number
  /** Day-seeded RNG so the untouched picks still rotate daily. */
  rng: () => number
  count?: number
  windowDays?: number
}

export function pickFreshFaces(
  heroes: HeroMetaStats[],
  options: FreshFaceOptions,
): HeroMetaStats[] {
  const {
    playedIds,
    lastPlayedOf,
    recentHeroIds,
    now,
    rng,
    count = FRESH_FACES_COUNT,
    windowDays = FRESH_WINDOW_DAYS,
  } = options

  const recent = new Set(recentHeroIds)
  const cutoff = now - windowDays * SECONDS_PER_DAY

  const untouched: HeroMetaStats[] = []
  const stale: HeroMetaStats[] = []

  for (const hero of heroes) {
    if (!playedIds.has(hero.id)) {
      untouched.push(hero)
      continue
    }
    // Still in the last 20 matches, or played inside the window: not fresh face material.
    if (recent.has(hero.id)) continue
    if (lastPlayedOf(hero.id) > cutoff) continue
    stale.push(hero)
  }

  for (let i = untouched.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[untouched[i], untouched[j]] = [untouched[j], untouched[i]]
  }

  stale.sort((a, b) => lastPlayedOf(a.id) - lastPlayedOf(b.id))

  return [...untouched, ...stale].slice(0, count)
}