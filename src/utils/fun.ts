/**
 * The silly part of DotaDex: flavour text, awards, playstyle titles,
 * dex ranks and the excuse generator.
 */

import type { HeroMetaStats, PlayerHero } from '@/types/opendota'
import { ATTRS, pubPickCount } from '@/utils/heroes'

export function pickRandom<T>(items: readonly T[], rng: () => number = Math.random): T {
  return items[Math.floor(rng() * items.length) % items.length]
}

export const LOADING_QUIPS: string[] = [
  'Consulting the ancient tomes (and a JSON endpoint)…',
  'Waking up the courier…',
  'Asking Roshan for his opinion…',
  'Rolling dice made of cheese…',
  'Checking whether this hero is still bad…',
  'Muting all chat for the duration of this load…',
  'Bribing the RNG with mana…',
  'Rebuilding the hero grid out of spite…',
]

export const COACH_QUIPS: string[] = [
  'Buy a sentry. Yes, this is generic advice. Yes, you needed it.',
  'Die once and it is their fault. Twice is lag. Three times is a patch issue.',
  'The best hero is the one your teammates cannot blame.',
  'Your MMR is not a personality. Hero variety sort of is.',
  'Mid or feed? Mid. Feed anyway. That is the way.',
  'Play the hero once, then complain about the hero. Full cycle complete.',
  'A hero you have never played is a hero you cannot be judged on. Use this power.',
  'Rotate. Counter-rotate. Apologise. Repeat.',
  'If the pick does not work out, quote the patch notes loudly.',
  'Try a support. Short queue, free moral high ground.',
]

export const CURSED_NOTES: string[] = [
  'This pick was decided before you woke up. Accept it.',
  'The Dice Gods made this choice. You merely execute it.',
  'Do not question the cursed hero. Play the cursed hero.',
  'Same hero, all day. That is the arrangement.',
  'Fate has a lane assignment for you today.',
]

export const EXCUSES: string[] = [
  'The creeps aggro\u2019d me. Check the replay.',
  'My mouse double-clicked. Twice. On my own hero.',
  'The internet was doing a thing.',
  'I was casting. Yes, on the ground. On purpose.',
  'The enemy support was camping. That is basically cheating.',
  'I was baiting. The team did not take the bait. Communication issue.',
  'My upgrade finished mid-fight. Real life has bad timing.',
  'I was checking winrates and forgot to play.',
  'Someone stepped on my keyboard. Possibly me. Unexplained.',
  'It was a smoke play. Everyone else was smoking.',
]

export const ROLL_BUTTON_LABELS: string[] = [
  'Roll the dice',
  'Summon a hero',
  'Consult the dex',
  'Spin fate',
  'Pick my fate',
]

export const DEX_BADGES: string[] = [
  'Gotta play \u2019em all.',
  'No hero left behind.',
  'Variety is the only stat that matters.',
]

export interface DexRank {
  title: string
  emoji: string
  blurb: string
}

const DEX_RANKS: { min: number; rank: DexRank }[] = [
  {
    min: 100,
    rank: {
      title: 'Dex Completionist',
      emoji: '\u{1F3C6}',
      blurb: 'Every hero played. Unranked in spirit, legendary in data.',
    },
  },
  {
    min: 75,
    rank: {
      title: 'Aegis Bearer',
      emoji: '\u{1F6E1}\u{FE0F}',
      blurb: 'Three quarters of the roster. You have opinions on 90+ heroes.',
    },
  },
  {
    min: 50,
    rank: {
      title: 'Draft Veteran',
      emoji: '\u{1F9F1}',
      blurb: 'Half the hero pool cleared. Drafts are mostly arguments now.',
    },
  },
  {
    min: 25,
    rank: {
      title: 'Roster Tourist',
      emoji: '\u{1F9F3}',
      blurb: 'A quarter done. Your comfort heroes are getting nervous.',
    },
  },
  {
    min: 10,
    rank: {
      title: 'Hatchling',
      emoji: '\u{1F95A}',
      blurb: 'The dex has begun. The dex always remembers.',
    },
  },
  {
    min: 0,
    rank: {
      title: 'Unhatched Larva',
      emoji: '\u{1F41B}',
      blurb: 'Everyone starts somewhere. Usually in the safe lane. Badly.',
    },
  },
]

export function dexRank(completionPercent: number): DexRank {
  return (
    DEX_RANKS.find((entry) => completionPercent >= entry.min)?.rank ??
    DEX_RANKS[DEX_RANKS.length - 1].rank
  )
}

export interface PlaystyleTitle {
  title: string
  blurb: string
  color: string
}

/** Derives a silly-but-informative title from the attribute/role mix you actually play. */
export function playstyleTitle(playerHeroes: PlayerHero[], heroes: HeroMetaStats[]): PlaystyleTitle {
  const byId = new Map(heroes.map((hero) => [hero.id, hero]))
  const attrGames: Record<string, number> = { str: 0, agi: 0, int: 0, all: 0 }
  const roleGames = new Map<string, number>()
  let total = 0

  playerHeroes.forEach((record) => {
    const hero = byId.get(record.hero_id)
    if (!hero || record.games <= 0) return
    total += record.games
    attrGames[hero.primary_attr] = (attrGames[hero.primary_attr] ?? 0) + record.games
    hero.roles.forEach((role) => roleGames.set(role, (roleGames.get(role) ?? 0) + record.games))
  })

  if (total === 0) {
    return {
      title: 'Blank Slate',
      blurb: 'No matches on record. Technically the most versatile player alive.',
      color: '#8b93a1',
    }
  }

  const topAttr = Object.entries(attrGames).sort((a, b) => b[1] - a[1])[0]
  const topRole = [...roleGames.entries()].sort((a, b) => b[1] - a[1])[0]
  const attrShare = Math.round((topAttr[1] / total) * 100)
  const attr = ATTRS.find((entry) => entry.key === topAttr[0]) ?? ATTRS[0]

  const titles: Record<string, string> = {
    str: 'Strength Enjoyer',
    agi: 'Agility Gremlin',
    int: 'Intelligence Librarian',
    all: 'Universal Chaos Agent',
  }

  const roleFlavour: Record<string, string> = {
    Carry: 'Farms first, asks questions later.',
    Support: 'Buys the wards, carries the blame.',
    Nuker: 'Burst damage is a lifestyle.',
    Disabler: 'Nobody moves without permission.',
    Initiator: 'Jumps in first, explains later.',
    Durable: 'Absorbs damage, absorbs criticism.',
    Escape: 'Never dies. Never commits either.',
    Pusher: 'Towers are just objectives with opinions.',
    Jungler: 'Allegedly in the jungle. Nobody has checked.',
  }

  return {
    title: `${titles[topAttr[0]] ?? 'Hero Enthusiast'} \u00b7 ${topRole[0]}`,
    blurb: `${attrShare}% of your games are ${attr.label} heroes. Most played role: ${topRole[0]}. ${
      roleFlavour[topRole[0]] ?? ''
    }`,
    color: attr.color,
  }
}

export interface Award {
  key: string
  emoji: string
  title: string
  detail: string
  heroId: number | null
  tone: 'glory' | 'shame' | 'weird'
}

/** The Wall of Fame / Wall of Shame, computed from your own OpenDota record. */
export function computeAwards(
  heroes: HeroMetaStats[],
  playerHeroes: PlayerHero[],
  locallyPlayed: number[],
): Award[] {
  const byId = new Map(heroes.map((hero) => [hero.id, hero]))
  const played = playerHeroes.filter((record) => record.games > 0)
  if (played.length === 0) return []

  const nameOf = (heroId: number): string => byId.get(heroId)?.localized_name ?? `Hero #${heroId}`
  const awards: Award[] = []

  const mostPlayed = [...played].sort((a, b) => b.games - a.games)[0]
  awards.push({
    key: 'main',
    emoji: '\u{1F451}',
    title: 'The One True Main',
    detail: `${mostPlayed.games} games on ${nameOf(mostPlayed.hero_id)}. At this point it is a personality.`,
    heroId: mostPlayed.hero_id,
    tone: 'glory',
  })

  const sample = played.filter((record) => record.games >= 10)
  if (sample.length > 0) {
    const best = [...sample].sort((a, b) => b.win / b.games - a.win / a.games)[0]
    awards.push({
      key: 'best',
      emoji: '\u{1F31F}',
      title: 'Hero of the People',
      detail: `${((best.win / best.games) * 100).toFixed(1)}% winrate on ${nameOf(
        best.hero_id,
      )} over ${best.games} games. Quietly your best decision.`,
      heroId: best.hero_id,
      tone: 'glory',
    })

    const worst = [...sample].sort((a, b) => a.win / a.games - b.win / b.games)[0]
    awards.push({
      key: 'worst',
      emoji: '\u{1F4A9}',
      title: 'Certified Feeder',
      detail: `${worst.games} games, ${((worst.win / worst.games) * 100).toFixed(
        1,
      )}% winrate on ${nameOf(worst.hero_id)}. You keep queueing it. Respect.`,
      heroId: worst.hero_id,
      tone: 'shame',
    })
  }

  const dustiest = [...played]
    .filter((record) => record.last_played)
    .sort((a, b) => (a.last_played ?? 0) - (b.last_played ?? 0))[0]
  if (dustiest) {
    awards.push({
      key: 'dust',
      emoji: '\u{1F9F9}',
      title: 'Dust Collector',
      detail: `${nameOf(dustiest.hero_id)} has not been touched in ages. It watches. It waits.`,
      heroId: dustiest.hero_id,
      tone: 'weird',
    })
  }

  const freshest = [...played].sort((a, b) => (b.last_played ?? 0) - (a.last_played ?? 0))[0]
  if (freshest && freshest.games <= 3) {
    awards.push({
      key: 'fresh',
      emoji: '\u{1F423}',
      title: 'New Toy',
      detail: `${nameOf(freshest.hero_id)} with ${freshest.games} game${
        freshest.games === 1 ? '' : 's'
      }. The honeymoon phase is real.`,
      heroId: freshest.hero_id,
      tone: 'weird',
    })
  }

  const popularIds = new Set(
    [...heroes]
      .sort((a, b) => pubPickCount(b) - pubPickCount(a))
      .slice(0, 12)
      .map((hero) => hero.id),
  )
  const sheep = played
    .filter((record) => popularIds.has(record.hero_id))
    .sort((a, b) => b.games - a.games)[0]
  if (sheep) {
    awards.push({
      key: 'sheep',
      emoji: '\u{1F411}',
      title: 'Meta Sheep',
      detail: `${sheep.games} games on ${nameOf(
        sheep.hero_id,
      )}, one of this patch\u2019s most picked heroes. Blending in beautifully.`,
      heroId: sheep.hero_id,
      tone: 'weird',
    })
  }

  const obscureIds = new Set(
    [...heroes]
      .sort((a, b) => pubPickCount(a) - pubPickCount(b))
      .slice(0, 25)
      .map((hero) => hero.id),
  )
  const hipster = played
    .filter((record) => obscureIds.has(record.hero_id) && record.games >= 3)
    .sort((a, b) => b.games - a.games)[0]
  if (hipster) {
    awards.push({
      key: 'hipster',
      emoji: '\u{1F9F8}',
      title: 'Professional Hipster',
      detail: `${hipster.games} games on ${nameOf(
        hipster.hero_id,
      )}, a hero almost nobody else picks. Ahead of the curve or behind the meta?`,
      heroId: hipster.hero_id,
      tone: 'weird',
    })
  }

  if (locallyPlayed.length > 0) {
    const names = locallyPlayed
      .map((id) => nameOf(id))
      .slice(0, 4)
      .join(', ')
    awards.push({
      key: 'dex-momentum',
      emoji: '\u{1F4D6}',
      title: 'Freshly Registered',
      detail: `${locallyPlayed.length} hero${
        locallyPlayed.length === 1 ? '' : 'es'
      } logged in DotaDex but not yet on OpenDota: ${names}. Go win a game with them.`,
      heroId: locallyPlayed[0] ?? null,
      tone: 'glory',
    })
  }

  return awards
}

/* ------------------------------------------------------------------ *
 * Local achievements (based on what you did inside DotaDex)
 * ------------------------------------------------------------------ */

export interface DexCounters {
  rolls: number
  newHeroes: number
  skips: number
  bans: number
  cycles: number
}

export interface AchievementDef {
  key: string
  emoji: string
  title: string
  detail: string
  unlocked: (counters: DexCounters) => boolean
  progress: (counters: DexCounters) => number
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    key: 'first-roll',
    emoji: '\u{1F3B2}',
    title: 'First Roll',
    detail: 'Let a website decide your hero. Congratulations on the leap of faith.',
    unlocked: (c) => c.rolls >= 1,
    progress: (c) => Math.min(1, c.rolls),
  },
  {
    key: 'roulette-veteran',
    emoji: '\u{1F3AF}',
    title: 'Roulette Veteran',
    detail: 'Roll 25 heroes. The dice know you now.',
    unlocked: (c) => c.rolls >= 25,
    progress: (c) => Math.min(25, c.rolls),
  },
  {
    key: 'explorer',
    emoji: '\u{1F9ED}',
    title: 'Explorer of the Roster',
    detail: 'Log 10 new heroes as played.',
    unlocked: (c) => c.newHeroes >= 10,
    progress: (c) => Math.min(10, c.newHeroes),
  },
  {
    key: 'purist',
    emoji: '\u{1F9F2}',
    title: 'Purist',
    detail: 'Skip 10 suggestions. Brave, but the dex is patient.',
    unlocked: (c) => c.skips >= 10,
    progress: (c) => Math.min(10, c.skips),
  },
  {
    key: 'triage',
    emoji: '\u{1FA79}',
    title: 'Trauma Surgeon',
    detail: 'Ban 5 heroes forever. Some heroes must simply be avoided.',
    unlocked: (c) => c.bans >= 5,
    progress: (c) => Math.min(5, c.bans),
  },
  {
    key: 'second-lap',
    emoji: '\u{1F501}',
    title: 'Second Lap',
    detail: 'Complete a full cycle of suggestions.',
    unlocked: (c) => c.cycles >= 1,
    progress: (c) => Math.min(1, c.cycles),
  },
]

