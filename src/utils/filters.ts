import type { HeroMetaStats } from '@/types/opendota'

export type SortKey = 'name' | 'games' | 'winrate' | 'recent' | 'meta'

export interface DexFilters {
  search: string
  roles: string[]
  attrs: string[]
  attackType: 'all' | 'Melee' | 'Ranged'
  onlyUntouched: boolean
  onlyTouched: boolean
  hideBanned: boolean
  sort: SortKey
}

export function createDexFilters(): DexFilters {
  return {
    search: '',
    roles: [],
    attrs: [],
    attackType: 'all',
    onlyUntouched: false,
    onlyTouched: false,
    hideBanned: false,
    sort: 'name',
  }
}

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'A → Z' },
  { key: 'games', label: 'Most played' },
  { key: 'winrate', label: 'Best winrate' },
  { key: 'recent', label: 'Recently played' },
  { key: 'meta', label: 'Patch winrate' },
]

export function toggleIn(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value]
}
