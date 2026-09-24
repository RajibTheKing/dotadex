/**
 * Safety net for OpenDota's "significant matches" blind spot.
 *
 * The app asks for every game mode by sending `significant=0` (see
 * api/opendota.ts), which turns off OpenDota's `isSignificant()` filter - the
 * check that hides Turbo (game_mode 23), Ability Draft (18) and the event modes
 * from `/wl`, `/heroes` and `/counts`. With that in place the aggregates already
 * cover everything and the helpers below are a no-op.
 *
 * They stay as a fallback: if OpenDota ever stops honouring the flag, `/counts`
 * comes back without those modes and the merge picks up whatever it can from
 * `/recentMatches` - the one endpoint that never filters - flagging those rows
 * as recent-only so the UI stays honest about how far back the data goes. If
 * `/counts` fails entirely the merge adds nothing rather than risk double
 * counting.
 */

import type { PlayerCounts, PlayerHero, PlayerWL, RecentMatch } from '@/types/opendota'

/** Radiant owns player_slot 0-127, Dire 128-255. */
export function didPlayerWin(match: RecentMatch): boolean {
  return (match.player_slot < 128) === match.radiant_win
}

/**
 * The recent matches OpenDota's lifetime endpoints never counted.
 *
 * `/counts` is OpenDota's own split of exactly the same data, so a game mode
 * missing from it was never aggregated in the first place - that is how Turbo
 * shows up here but not in `/wl` or `/heroes`. Without `/counts` we cannot tell
 * a skipped mode from an already-counted one, so we stay conservative and add
 * nothing rather than risk double counting.
 */
export function unrecountedRecentMatches(
  counts: PlayerCounts | null,
  recent: RecentMatch[],
): RecentMatch[] {
  const byGameMode = counts?.game_mode
  if (!byGameMode) return []
  const aggregated = new Set(Object.keys(byGameMode).map(Number))
  return recent.filter((match) => !aggregated.has(match.game_mode))
}

function emptyRecord(heroId: number): PlayerHero {
  return {
    hero_id: heroId,
    last_played: 0,
    games: 0,
    win: 0,
    with_games: 0,
    with_win: 0,
    against_games: 0,
    against_win: 0,
  }
}

/** Folds the unrecounted recent matches into the per-hero records. */
export function mergeHeroRecords(records: PlayerHero[], extras: RecentMatch[]): PlayerHero[] {
  if (extras.length === 0) return records
  const merged = new Map<number, PlayerHero>(records.map((record) => [record.hero_id, { ...record }]))
  for (const match of extras) {
    const record = merged.get(match.hero_id) ?? emptyRecord(match.hero_id)
    record.games += 1
    if (didPlayerWin(match)) record.win += 1
    record.last_played = Math.max(record.last_played ?? 0, match.start_time)
    merged.set(match.hero_id, record)
  }
  return [...merged.values()]
}

/** Folds the unrecounted recent matches into the lifetime win/loss. */
export function mergeWl(wl: PlayerWL | null, extras: RecentMatch[]): PlayerWL | null {
  if (!wl || extras.length === 0) return wl
  const wins = extras.filter((match) => didPlayerWin(match)).length
  return { win: wl.win + wins, lose: wl.lose + (extras.length - wins) }
}

/** One row of the "games by mode" table. */
export interface GameModeStat {
  gameModeId: number
  games: number
  win: number
  lose: number
  winrate: number | null
  /** OpenDota has no lifetime data for this mode, so only recent matches count. */
  recentOnly: boolean
}

/**
 * Per-mode breakdown: OpenDota's own `/counts` plus the modes it refuses to
 * aggregate. Rows only reachable from recent matches are flagged `recentOnly`
 * so the UI can be honest about how far back they go.
 */
export function buildModeBreakdown(
  counts: PlayerCounts | null,
  extras: RecentMatch[],
): GameModeStat[] {
  const rows = new Map<number, GameModeStat>()

  const put = (gameModeId: number, games: number, win: number, recentOnly: boolean): void => {
    rows.set(gameModeId, {
      gameModeId,
      games,
      win,
      lose: Math.max(games - win, 0),
      winrate: games > 0 ? (win / games) * 100 : null,
      recentOnly,
    })
  }

  Object.entries(counts?.game_mode ?? {}).forEach(([key, bucket]) => {
    const gameModeId = Number(key)
    if (Number.isNaN(gameModeId)) return
    put(gameModeId, bucket?.games ?? 0, bucket?.win ?? 0, false)
  })

  for (const match of extras) {
    const existing = rows.get(match.game_mode)
    const won = didPlayerWin(match) ? 1 : 0
    if (existing) {
      put(existing.gameModeId, existing.games + 1, existing.win + won, existing.recentOnly)
    } else {
      put(match.game_mode, 1, won, true)
    }
  }

  return [...rows.values()].sort((a, b) => b.games - a.games || a.gameModeId - b.gameModeId)
}