/**
 * The suggestion engine - the heart of DotaDex.
 *
 * The "New Hero Only" mode implements the rule this app was built for:
 * a hero that has already been served stays out of the pool until you have
 * played your way through every hero once. Only when the pool runs dry does a
 * fresh cycle start.
 */

import type { HeroMatchup, HeroMetaStats, HeroStats, PlayerHero } from '@/types/opendota'
import { bracketWinRate, winRatePercent } from '@/utils/heroes'

export type SuggestMode = 'fresh' | 'roulette' | 'comfort' | 'chaos' | 'meta' | 'counter'

export interface SuggestModeInfo {
  key: SuggestMode
  label: string
  emoji: string
  blurb: string
}

export const SUGGEST_MODES: SuggestModeInfo[] = [
  {
    key: 'fresh',
    label: 'New Hero Only',
    emoji: '🆕',
    blurb: 'Only heroes you have never played. No repeats until the dex is complete.',
  },
  {
    key: 'roulette',
    label: 'Pure Roulette',
    emoji: '🎲',
    blurb: 'Anything goes. Your comfort zone is not invited.',
  },
  {
    key: 'comfort',
    label: 'Comfort Zone',
    emoji: '🛋️',
    blurb: 'Your highest winrate heroes. Boring. Effective. Boring.',
  },
  {
    key: 'chaos',
    label: 'Chaos Mode',
    emoji: '🔥',
    blurb: 'Your worst heroes. Your teammates will understand. They will not.',
  },
  {
    key: 'meta',
    label: 'Meta Slaves',
    emoji: '📈',
    blurb: 'Highest public winrate in your bracket. Blame the patch, not yourself.',
  },
  {
    key: 'counter',
    label: 'Counter Pick',
    emoji: '🎯',
    blurb: 'Name an enemy hero and get the statistically annoying answer.',
  },
]

export interface SuggestFilters {
  roles: string[]
  attrs: string[]
  attackType: 'all' | 'Melee' | 'Ranged'
  /** Heroes the player never wants to see again ("trauma list"). */
  banned: number[]
  /** Heroes already served this cycle - kept out to guarantee no repeats. */
  seen: number[]
  /** Locally marked as played but not yet visible on OpenDota. */
  locallyPlayed: number[]
}

export interface Suggestion {
  hero: HeroMetaStats
  score: number
  reasons: string[]
  /** Your own record on the hero, null when untouched. */
  record: PlayerHero | null
  winrate: number | null
  bracketWinrate: number | null
  /** Opponents that statistically ruin this hero. */
  threats: { heroId: number; winrate: number; games: number }[]
}

export interface SuggestResult {
  picks: Suggestion[]
  /** True when no unseen untouched hero was available for this roll. */
  cycleExhausted: boolean
  /** True when every untouched hero in this filter had been served: a new lap starts. */
  lapComplete: boolean
  /** True when nothing untouched is left in this filter, so repeats are allowed. */
  repeatsAllowed: boolean
  poolSize: number
  note: string
}

/* ------------------------------------------------------------------ *
 * Deterministic RNG helpers (powers the "Cursed Hero of the Day")
 * ------------------------------------------------------------------ */

/** cyrb128-style string hash. */
export function hashSeed(input: string): number {
  let h1 = 1779033703
  let h2 = 3144134277
  let h3 = 1013904242
  let h4 = 2773480762
  for (let i = 0; i < input.length; i += 1) {
    const k = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ k, 597399067)
    h2 = Math.imul(h2 ^ k, 2869860233)
    h3 = Math.imul(h3 ^ k, 951274213)
    h4 = Math.imul(h4 ^ k, 2716044179)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
  return (h1 ^ h2 ^ h3 ^ h4) >>> 0
}

/** mulberry32 - tiny, fast, good enough for hero roulette. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randomFrom<T>(items: T[], rng: () => number): T | null {
  if (items.length === 0) return null
  return items[Math.floor(rng() * items.length) % items.length]
}

/* ------------------------------------------------------------------ *
 * Pool building + scoring
 * ------------------------------------------------------------------ */

export function passesFilters(hero: HeroStats, filters: SuggestFilters): boolean {
  if (filters.banned.includes(hero.id)) return false
  if (filters.attrs.length > 0 && !filters.attrs.includes(hero.primary_attr)) return false
  if (filters.attackType !== 'all' && hero.attack_type !== filters.attackType) return false
  if (filters.roles.length > 0 && !filters.roles.some((role) => hero.roles.includes(role))) {
    return false
  }
  return true
}

export function recordMap(records: PlayerHero[]): Map<number, PlayerHero> {
  return new Map(records.map((record) => [record.hero_id, record]))
}

interface ScoreInput {
  hero: HeroStats | HeroMatchup
  mode: SuggestMode
  record: PlayerHero | null
  bracket: number
  rng: () => number
}

/** Scores one candidate and explains itself in plain language. */
function scoreHero({ hero, mode, record, bracket, rng }: ScoreInput): {
  score: number
  reasons: string[]
} {
  const stats = hero as HeroMetaStats
  const reasons: string[] = []
  const games = record?.games ?? 0
  const personalWinrate = record ? winRatePercent(record.win, record.games) : null
  const metaWinrate = bracketWinRate(stats, bracket)
  // A little jitter keeps repeated rolls from telling the same story twice.
  const jitter = rng() * 6
  let score = jitter

  switch (mode) {
    case 'fresh': {
      const untouched = games === 0
      score += untouched ? 100 : 55 - Math.min(45, games * 2)
      reasons.push(
        untouched
          ? 'Never played. Genuinely new. The dex needs this.'
          : `Only ${games} game${games === 1 ? '' : 's'} played. Basically new.`,
      )
      if (stats.pub_pick > 0) {
        reasons.push(
          `Public winrate is ${((stats.pub_win / stats.pub_pick) * 100).toFixed(1)}% this patch.`,
        )
      }
      break
    }
    case 'roulette': {
      score += rng() * 100
      reasons.push('Chosen by the Dice Gods. No logic was harmed in this decision.')
      break
    }
    case 'comfort': {
      if (personalWinrate === null) {
        score -= 60
        reasons.push('No data on this one, so "comfort" is a stretch.')
      } else {
        score += personalWinrate * 1.6 + Math.min(20, games)
        reasons.push(`${personalWinrate.toFixed(1)}% winrate across ${games} games.`)
      }
      break
    }
    case 'chaos': {
      if (personalWinrate === null) {
        score += 60
        reasons.push('Zero experience. Maximum chaos. The plan is vibes.')
      } else {
        score += (100 - personalWinrate) * 1.6 + Math.min(20, games)
        reasons.push(`${games} games, ${personalWinrate.toFixed(1)}% winrate. Brave.`)
      }
      break
    }
    case 'meta': {
      const wr = metaWinrate ?? 50
      score += (wr - 50) * 12
      reasons.push(
        metaWinrate === null
          ? 'Patch data unavailable, defaulting to vibes.'
          : `${metaWinrate.toFixed(1)}% winrate in your bracket right now.`,
      )
      if (stats.pub_pick) {
        reasons.push(`Picked ${stats.pub_pick.toLocaleString()} times by strangers this patch.`)
      }
      break
    }
    case 'counter': {
      const matchup = hero as HeroMatchup
      const enemyWinrate = matchup.games_played ? (matchup.wins / matchup.games_played) * 100 : 50
      score += (60 - enemyWinrate) * 6
      reasons.push(
        `That enemy hero only wins ${enemyWinrate.toFixed(1)}% of ${matchup.games_played.toLocaleString()} games against this pick.`,
      )
      break
    }
    default:
      break
  }

  if (personalWinrate !== null && personalWinrate >= 60 && games >= 5 && mode !== 'comfort') {
    reasons.push(`You already win ${personalWinrate.toFixed(0)}% with it. Nice excuse to pick it.`)
  }

  return { score, reasons }
}

/* ------------------------------------------------------------------ *
 * Main entry point
 * ------------------------------------------------------------------ */

export interface SuggestArgs {
  mode: SuggestMode
  heroes: HeroMetaStats[]
  playerHeroes: PlayerHero[]
  filters: SuggestFilters
  bracket: number
  count?: number
  enemyHeroId?: number | null
  /** Matchups of the enemy hero (only needed for counter mode). */
  enemyMatchups?: HeroMatchup[]
  rng?: () => number
  /** Allow already-played heroes (used when the fresh pool is empty). */
  allowPlayed?: boolean
}

export function suggestHeroes(args: SuggestArgs): SuggestResult {
  const {
    mode,
    heroes,
    playerHeroes,
    filters,
    bracket,
    count = 5,
    enemyHeroId = null,
    enemyMatchups = [],
    rng = Math.random,
    allowPlayed = false,
  } = args

  const records = recordMap(playerHeroes)
  const playedLocally = new Set(filters.locallyPlayed)

  const isUntouched = (hero: HeroStats): boolean =>
    (records.get(hero.id)?.games ?? 0) === 0 && !playedLocally.has(hero.id)

  /** Heroes allowed by the user's filters (ban list, role, attribute, range). */
  const filterMatched = heroes.filter((hero) => passesFilters(hero, filters))

  let pool: HeroMetaStats[] = []
  let cycleExhausted = false
  let lapComplete = false
  let repeatsAllowed = false
  let note = ''

  if (mode !== 'fresh' || allowPlayed) {
    pool = filterMatched
  } else {
    const unplayed = filterMatched.filter(isUntouched)
    const unseenUnplayed = unplayed.filter((hero) => !filters.seen.includes(hero.id))

    if (unseenUnplayed.length > 0) {
      pool = unseenUnplayed
    } else if (unplayed.length > 0) {
      // Every untouched hero in this filter has been served once: new lap.
      cycleExhausted = true
      lapComplete = true
      pool = unplayed
      note = 'Cycle complete: every untouched hero has been served once, so a fresh lap starts now.'
    } else if (filterMatched.length > 0) {
      // Nothing new left in this filter at all - repeats are back on the menu.
      cycleExhausted = true
      repeatsAllowed = true
      pool = filterMatched
      const blockedByBans = heroes.filter(
        (hero) => filters.banned.includes(hero.id) && isUntouched(hero),
      ).length
      note =
        blockedByBans > 0
          ? `Every untouched hero that fits is on your trauma list (${blockedByBans} banned). Repeats are allowed again — or go unban something.`
          : 'Every hero in this filter has been played. Repeats are officially allowed again.'
    } else {
      pool = []
      note =
        'Your filters (or the trauma list) are stricter than your hero pool. Loosen a role, an attribute or clear a ban.'
    }
  }

  const poolSize = pool.length
  if (poolSize === 0) {
    return { picks: [], cycleExhausted, lapComplete, repeatsAllowed, poolSize, note }
  }

  if (mode === 'counter') {
    const enemyStats = new Map(enemyMatchups.map((entry) => [entry.hero_id, entry]))
    const scored = pool
      .filter((hero) => enemyStats.has(hero.id))
      .map((hero) => {
        const { score, reasons } = scoreHero({
          hero: enemyStats.get(hero.id) as HeroMatchup,
          mode,
          record: records.get(hero.id) ?? null,
          bracket,
          rng,
        })
        return { hero, score, reasons }
      })
      .sort((a, b) => b.score - a.score)

    if (scored.length === 0) {
      return {
        picks: [],
        cycleExhausted,
        lapComplete,
        repeatsAllowed,
        poolSize,
        note: enemyHeroId
          ? 'OpenDota has no matchup sample for that enemy against your filtered picks.'
          : 'Pick an enemy hero first, then roll the dice.',
      }
    }

    return {
      picks: buildSuggestions(scored, records, bracket),
      cycleExhausted,
      lapComplete,
      repeatsAllowed,
      poolSize: scored.length,
      note,
    }
  }

  const scored = pool.map((hero) => {
    const { score, reasons } = scoreHero({
      hero,
      mode,
      record: records.get(hero.id) ?? null,
      bracket,
      rng,
    })
    if (mode === 'fresh' && !records.get(hero.id)?.last_played) {
      reasons.push('Dust levels: theoretical.')
    }
    return { hero, score, reasons }
  })

  // Weighted shuffle of the top slice: the strongest candidates stay likely,
  // but the same hero does not win on every single roll.
  const topSlice = scored.sort((a, b) => b.score - a.score).slice(0, Math.max(count * 4, 12))
  const ordered = weightedShuffle(topSlice, rng)

  return {
    picks: buildSuggestions(ordered, records, bracket),
    cycleExhausted,
    lapComplete,
    repeatsAllowed,
    poolSize,
    note,
  }
}

/** Weighted random ordering - higher score means a higher chance of ranking first. */
function weightedShuffle<T extends { score: number }>(items: T[], rng: () => number): T[] {
  if (items.length === 0) return []
  const min = Math.min(...items.map((entry) => entry.score))
  return items
    .map((item) => {
      const weight = Math.max(0.5, item.score - min + 1)
      return { item, key: -Math.log(rng() || 1e-9) / weight }
    })
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.item)
}

function buildSuggestions(
  scored: { hero: HeroStats; score: number; reasons: string[] }[],
  records: Map<number, PlayerHero>,
  bracket: number,
): Suggestion[] {
  return scored.slice(0, 5).map(({ hero, score, reasons }) => {
    const meta = hero as HeroMetaStats
    const record = records.get(hero.id) ?? null
    return {
      hero: meta,
      score,
      reasons,
      record,
      winrate: record ? winRatePercent(record.win, record.games) : null,
      bracketWinrate: bracketWinRate(meta, bracket),
      threats: [],
    }
  })
}

/** Shuffled hero strip used while the roulette spins (keeps the input hero type). */
export function rouletteStrip<T extends HeroStats>(pool: T[], rng: () => number, size = 24): T[] {
  const shuffled = [...pool]
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, Math.min(size, shuffled.length))
}

/**
 * The heroes that beat this pick most often.
 * OpenDota's matchup rows record the wins of `hero_id` against each opponent, so the
 * *lowest* winrate first gives the opponents that ruin your hero.
 */
export function worstMatchupsFor(
  matchups: HeroMatchup[],
  limit = 5,
  minGames = 60,
): { heroId: number; winrate: number; games: number }[] {
  return matchups
    .filter((entry) => entry.games_played >= minGames)
    .map((entry) => ({
      heroId: entry.hero_id,
      winrate: (entry.wins / entry.games_played) * 100,
      games: entry.games_played,
    }))
    .sort((a, b) => a.winrate - b.winrate)
    .slice(0, limit)
}

/** The opponents this hero farms most reliably (highest own winrate first). */
export function bestMatchupsFor(
  matchups: HeroMatchup[],
  limit = 3,
  minGames = 60,
): { heroId: number; winrate: number; games: number }[] {
  return matchups
    .filter((entry) => entry.games_played >= minGames)
    .map((entry) => ({
      heroId: entry.hero_id,
      winrate: (entry.wins / entry.games_played) * 100,
      games: entry.games_played,
    }))
    .sort((a, b) => b.winrate - a.winrate)
    .slice(0, limit)
}


