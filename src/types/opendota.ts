/**
 * Shape of the OpenDota API responses used by DotaDex.
 * Docs: https://docs.opendota.com
 */

export interface OpenDotaProfile {
  account_id: number
  personaname: string | null
  name: string | null
  plus: boolean
  cheese: number
  steamid: string | null
  avatar: string | null
  avatarmedium: string | null
  avatarfull: string | null
  profileurl?: string | null
  last_login?: string | null
  loccountrycode?: string | null
  is_contributor?: boolean
  is_subscriber?: boolean
}

/** GET /players/{account_id} */
export interface PlayerSummary {
  profile: OpenDotaProfile
  rank_tier: number | null
  leaderboard_rank: number | null
  computed_mmr?: number | null
  computed_mmr_turbo?: number | null
  aliases?: string[]
}

/** GET /players/{account_id}/heroes */
export interface PlayerHero {
  hero_id: number
  last_played: number | null
  games: number
  win: number
  with_games: number
  with_win: number
  against_games: number
  against_win: number
}

/** GET /players/{account_id}/wl */
export interface PlayerWL {
  win: number
  lose: number
}

/** GET /players/{account_id}/counts - one bucket per value of a grouping field. */
export interface PlayerCountsBucket {
  games: number
  win: number
}

/**
 * GET /players/{account_id}/counts, e.g. `counts.game_mode["22"]` -> games/win.
 *
 * OpenDota never lists Turbo (game_mode 23), Ability Draft (18) or the other
 * unbalanced modes here: its lifetime endpoints skip them entirely, while
 * /recentMatches does return them. See src/utils/stats.ts for how DotaDex
 * folds that sliver of all-mode data back into the totals.
 */
export type PlayerCounts = Record<string, Record<string, PlayerCountsBucket>>

/** GET /players/{account_id}/recentMatches */
export interface RecentMatch {
  match_id: number
  player_slot: number
  radiant_win: boolean
  hero_id: number
  start_time: number
  duration: number
  game_mode: number
  lobby_type: number
  kills: number
  deaths: number
  assists: number
  xp_per_min: number | null
  gold_per_min: number | null
  hero_damage: number | null
  tower_damage: number | null
  hero_healing: number | null
  last_hits: number | null
  lane: number | null
  lane_role: number | null
  is_roaming: boolean | null
  party_size: number | null
}

/**
 * GET /heroStats (also /constants/heroes).
 * `img` / `icon` are relative Steam CDN paths - use heroImageUrl()/heroIconUrl().
 */
export interface HeroStats {
  id: number
  name: string
  localized_name: string
  primary_attr: 'str' | 'agi' | 'int' | 'all'
  attack_type: 'Melee' | 'Ranged'
  roles: string[]
  img: string
  icon: string
  base_health: number
  base_health_regen: number | null
  base_mana: number
  base_mana_regen: number | null
  base_armor: number
  base_mr: number
  base_attack_min: number
  base_attack_max: number
  base_str: number
  base_agi: number
  base_int: number
  str_gain: number
  agi_gain: number
  int_gain: number
  attack_range: number
  projectile_speed: number
  attack_rate: number
  base_attack_time: number
  attack_point: number
  move_speed: number
  turn_rate: number | null
  cm_enabled: boolean
  legs: number
  day_vision: number
  night_vision: number
  /** Pub winrate/pickrate per rank bracket (1 = Herald ... 8 = Immortal). */
  [bracket: `${number}`]: unknown
}

export interface HeroMetaStats extends HeroStats {
  pub_pick: number
  pub_win: number
  pro_pick: number
  pro_win: number
  pro_ban: number
  turbo_picks: number
  turbo_wins: number
}

/** GET /heroes/{hero_id}/matchups */
export interface HeroMatchup {
  hero_id: number
  games_played: number
  wins: number
}

/** GET /search?q= */
export interface SearchResult {
  account_id: number
  avatarfull: string | null
  personaname: string | null
  last_match_time?: string | null
  similarity?: number
}

/** GET /constants/game_mode */
export interface GameModeConstant {
  id: number
  name: string
  balanced: boolean
}
