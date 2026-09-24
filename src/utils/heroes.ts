import type { HeroMetaStats, HeroStats } from '@/types/opendota'
import { STEAM_CDN } from '@/api/opendota'

export interface AttrInfo {
  key: 'str' | 'agi' | 'int' | 'all'
  label: string
  short: string
  color: string
}

export const ATTRS: AttrInfo[] = [
  { key: 'str', label: 'Strength', short: 'STR', color: '#e5573f' },
  { key: 'agi', label: 'Agility', short: 'AGI', color: '#4ec98f' },
  { key: 'int', label: 'Intelligence', short: 'INT', color: '#5fa8e8' },
  { key: 'all', label: 'Universal', short: 'UNI', color: '#d79ad4' },
]

export function attrInfo(attr: string): AttrInfo {
  return ATTRS.find((entry) => entry.key === attr) ?? ATTRS[3]
}

/** Role order roughly follows the OpenDota role list. */
export const ROLES = [
  'Carry',
  'Support',
  'Nuker',
  'Disabler',
  'Initiator',
  'Durable',
  'Escape',
  'Pusher',
  'Jungler',
] as const

export type Role = (typeof ROLES)[number]

export const RANKS: { tier: number; name: string }[] = [
  { tier: 1, name: 'Herald' },
  { tier: 2, name: 'Guardian' },
  { tier: 3, name: 'Crusader' },
  { tier: 4, name: 'Archon' },
  { tier: 5, name: 'Legend' },
  { tier: 6, name: 'Ancient' },
  { tier: 7, name: 'Divine' },
  { tier: 8, name: 'Immortal' },
]

export function rankTierToBracket(rankTier: number | null | undefined): number {
  if (!rankTier) return 3 // default to Crusader-ish pub stats when unranked
  return Math.min(8, Math.max(1, Math.floor(rankTier / 10) || 1))
}

export function rankLabel(rankTier: number | null | undefined): string {
  if (!rankTier) return 'Unranked'
  const bracket = Math.floor(rankTier / 10)
  const stars = rankTier % 10
  const meta = RANKS.find((entry) => entry.tier === bracket)
  if (!meta) return 'Unranked'
  if (bracket === 8) return `${meta.name}${stars > 0 ? ` ${stars}` : ''}`
  return `${meta.name} ${stars === 0 ? '★' : '★'.repeat(stars)}`.trim()
}

export function ladderCountLabel(rankTier: number | null | undefined): string {
  if (!rankTier) return ''
  const bracket = Math.floor(rankTier / 10)
  const meta = RANKS.find((entry) => entry.tier === bracket)
  return meta ? meta.name : ''
}

function cdnUrl(path: string | undefined): string {
  if (!path) return ''
  const clean = path.replace(/\?+$/, '')
  return `${STEAM_CDN}${clean}`
}

/** Full-size hero portrait. */
export function heroImageUrl(hero: HeroStats | undefined | null): string {
  return cdnUrl(hero?.img)
}

/** Small square hero icon (used in dense lists). */
export function heroIconUrl(hero: HeroStats | undefined | null): string {
  return cdnUrl(hero?.icon) || heroImageUrl(hero)
}

export function winRatePercent(wins: number | null, games: number | null): number | null {
  if (!games || games <= 0 || wins === null) return null
  return (wins / games) * 100
}

export function formatPercent(value: number | null, digits = 1): string {
  if (value === null || Number.isNaN(value)) return '—'
  return `${value.toFixed(digits)}%`
}

export function formatDate(timestamp: number | null | undefined): string {
  if (!timestamp) return 'never'
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatRelative(timestamp: number | null | undefined): string {
  if (!timestamp) return 'never'
  const diff = Date.now() - timestamp * 1000
  const days = Math.floor(diff / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`
  const years = (days / 365).toFixed(1)
  return `${years} years ago`
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds < 0) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export const LANE_ROLES: Record<number, string> = {
  1: 'Safe lane',
  2: 'Mid lane',
  3: 'Off lane',
  4: 'Jungle',
}

/** Bracket meta winrate used by the "Meta Slaves" suggestion mode. */
export function bracketWinRate(hero: HeroMetaStats | undefined, bracket: number): number | null {
  if (!hero) return null
  const record = hero as unknown as Record<string, number | undefined>
  const picks = record[`${bracket}_pick`]
  const wins = record[`${bracket}_win`]
  if (picks && wins !== undefined) return (wins / picks) * 100
  if (hero.pub_pick && hero.pub_win !== undefined) return (hero.pub_win / hero.pub_pick) * 100
  return null
}

export function pubPickCount(hero: HeroMetaStats | undefined): number {
  return hero?.pub_pick ?? 0
}
