import { reactive } from 'vue'
import type {
  GameModeConstant,
  HeroMatchup,
  HeroMetaStats,
  PlayerCounts,
  PlayerHero,
  PlayerSummary,
  PlayerWL,
  RecentMatch,
  SearchResult,
} from '@/types/opendota'
import { readJson, writeJson } from '@/utils/storage'

export const API_BASE = 'https://api.opendota.com/api'
/** Hero portraits live on the Steam CDN; OpenDota returns relative paths. */
export const STEAM_CDN = 'https://cdn.cloudflare.steamstatic.com'
export const OPENDOTA_SITE = 'https://www.opendota.com'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export class OpenDotaError extends Error {
  status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'OpenDotaError'
    this.status = status
  }
}

/** Live rate-limit info scraped from OpenDota response headers (nerd stat). */
export const rateLimit = reactive({
  minuteLimit: null as number | null,
  minuteRemaining: null as number | null,
  dayLimit: null as number | null,
  dayRemaining: null as number | null,
})

interface GetOptions {
  /** How long a cached response stays fresh. */
  ttlMs?: number
  /** Mirror the response into localStorage so reloads are instant. */
  persist?: boolean
  /** Skip caches entirely (used by the manual refresh button). */
  noCache?: boolean
}

interface MemoryEntry {
  at: number
  data: unknown
}

const memoryCache = new Map<string, MemoryEntry>()
const PERSIST_PREFIX = 'cache:'

function cacheKey(path: string, params: Record<string, string | number>): string {
  const search = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')
  return search ? `${path}?${search}` : path
}

function captureRateLimit(headers: Headers): void {
  const read = (name: string): number | null => {
    const raw = headers.get(name)
    if (raw === null) return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  }
  rateLimit.minuteLimit = read('x-ratelimit-limit-minute') ?? rateLimit.minuteLimit
  rateLimit.minuteRemaining = read('x-ratelimit-remaining-minute') ?? rateLimit.minuteRemaining
  rateLimit.dayLimit = read('x-ratelimit-limit-day') ?? rateLimit.dayLimit
  rateLimit.dayRemaining = read('x-ratelimit-remaining-day') ?? rateLimit.dayRemaining
}

async function get<T>(
  path: string,
  params: Record<string, string | number> = {},
  options: GetOptions = {},
): Promise<T> {
  const { ttlMs = 5 * MINUTE, persist = false, noCache = false } = options
  const key = cacheKey(path, params)

  if (!noCache) {
    const cached = memoryCache.get(key)
    if (cached && Date.now() - cached.at < ttlMs) return cached.data as T

    if (persist) {
      const stored = readJson<MemoryEntry | null>(PERSIST_PREFIX + key, null)
      if (stored && Date.now() - stored.at < ttlMs) {
        memoryCache.set(key, stored)
        return stored.data as T
      }
    }
  }

  const url = new URL(`${API_BASE}${path}`)
  Object.entries(params).forEach(([name, value]) => url.searchParams.set(name, String(value)))

  let response: Response
  try {
    response = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
  } catch {
    throw new OpenDotaError(
      'Could not reach api.opendota.com. Check your connection, VPN or ad-blocker, then try again.',
    )
  }

  captureRateLimit(response.headers)

  if (!response.ok) {
    if (response.status === 429) {
      throw new OpenDotaError(
        'OpenDota rate limit reached (free tier allows 60 requests per minute). Wait a few seconds, then try again.',
        429,
      )
    }
    if (response.status === 404) {
      throw new OpenDotaError('OpenDota has no data for that request (404).', 404)
    }
    throw new OpenDotaError(`OpenDota request failed (HTTP ${response.status}).`, response.status)
  }

  const data = (await response.json()) as T
  const entry: MemoryEntry = { at: Date.now(), data }
  memoryCache.set(key, entry)
  if (persist) writeJson(PERSIST_PREFIX + key, entry)
  return data
}

/** Full hero roster + global meta stats (one call powers the whole dex). */
export function fetchHeroStats(options: GetOptions = {}): Promise<HeroMetaStats[]> {
  return get<HeroMetaStats[]>('/heroStats', {}, { ttlMs: 6 * HOUR, persist: true, ...options })
}

export function fetchPlayer(accountId: number, options: GetOptions = {}): Promise<PlayerSummary> {
  return get<PlayerSummary>(`/players/${accountId}`, {}, { ttlMs: 2 * MINUTE, ...options })
}

/**
 * Query params that switch off OpenDota's "significant matches" filter.
 *
 * By default every lifetime endpoint (`/wl`, `/heroes`, `/counts`, `/matches`)
 * runs through `isSignificant()`, which rejects any match whose `game_mode` or
 * `lobby_type` is not marked "balanced" in dotaconstants - precisely where
 * Turbo (23), Ability Draft (18) and the event modes live. A player with 20 000
 * Turbo games would otherwise report 278 matches. Passing `significant=0`
 * disables the check so every game mode the player has actually played counts.
 */
const ALL_GAME_MODES: Record<string, string | number> = { significant: 0 }

export function fetchPlayerHeroes(
  accountId: number,
  options: GetOptions = {},
): Promise<PlayerHero[]> {
  return get<PlayerHero[]>(
    `/players/${accountId}/heroes`,
    ALL_GAME_MODES,
    { ttlMs: 5 * MINUTE, ...options },
  )
}

export function fetchPlayerWL(accountId: number, options: GetOptions = {}): Promise<PlayerWL> {
  return get<PlayerWL>(`/players/${accountId}/wl`, ALL_GAME_MODES, {
    ttlMs: 5 * MINUTE,
    ...options,
  })
}

/**
 * Lifetime counts grouped by game mode, lobby type, patch, region, ...
 *
 * This is how DotaDex works out which modes OpenDota actually aggregates: Turbo
 * (23), Ability Draft (18) and the other unbalanced modes never appear here, so
 * a recent match in one of them was never counted by /wl or /heroes either.
 */
export function fetchPlayerCounts(
  accountId: number,
  options: GetOptions = {},
): Promise<PlayerCounts> {
  return get<PlayerCounts>(`/players/${accountId}/counts`, ALL_GAME_MODES, {
    ttlMs: 5 * MINUTE,
    ...options,
  })
}

export function fetchRecentMatches(
  accountId: number,
  options: GetOptions = {},
): Promise<RecentMatch[]> {
  return get<RecentMatch[]>(`/players/${accountId}/recentMatches`, {}, { ttlMs: MINUTE, ...options })
}

export function fetchHeroMatchups(heroId: number, options: GetOptions = {}): Promise<HeroMatchup[]> {
  return get<HeroMatchup[]>(`/heroes/${heroId}/matchups`, {}, { ttlMs: DAY, persist: true, ...options })
}

export function searchPlayers(query: string, options: GetOptions = {}): Promise<SearchResult[]> {
  return get<SearchResult[]>('/search', { q: query }, { ttlMs: 5 * MINUTE, ...options })
}

export function fetchGameModes(options: GetOptions = {}): Promise<Record<string, GameModeConstant>> {
  return get<Record<string, GameModeConstant>>('/constants/game_mode', {}, {
    ttlMs: 7 * DAY,
    persist: true,
    ...options,
  })
}

/** "game_mode_all_pick" -> "All Pick" */
export function prettyGameModeName(name: string): string {
  return name
    .replace(/^game_mode_/, '')
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function clearApiCache(): void {
  memoryCache.clear()
}
