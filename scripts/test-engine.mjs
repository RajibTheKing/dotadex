/**
 * Engine test for DotaDex.
 *
 * Bundles src/utils/suggest.ts with esbuild (aliases included) into a temp file
 * and runs the assertion suite against it, so the pure suggestion logic can be
 * tested without a browser.
 *
 *   npm test
 */
import { build } from 'esbuild'
import { mkdir, rm } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = join(root, 'node_modules', '.dotadex-test')
const outputFile = join(outputDir, 'suggest.mjs')
const statsOutputFile = join(outputDir, 'stats.mjs')
const freshOutputFile = join(outputDir, 'fresh.mjs')

await mkdir(outputDir, { recursive: true })
const bundleOptions = {
  bundle: true,
  format: 'esm',
  platform: 'node',
  alias: { '@': join(root, 'src') },
  logLevel: 'warning',
}
await build({
  ...bundleOptions,
  entryPoints: [join(root, 'src', 'utils', 'suggest.ts')],
  outfile: outputFile,
})
await build({
  ...bundleOptions,
  entryPoints: [join(root, 'src', 'utils', 'stats.ts')],
  outfile: statsOutputFile,
})
await build({
  ...bundleOptions,
  entryPoints: [join(root, 'src', 'utils', 'fresh.ts')],
  outfile: freshOutputFile,
})

const { suggestHeroes, seededRandom, hashSeed, rouletteStrip, worstMatchupsFor } = await import(
  pathToFileURL(outputFile).href
)
const { didPlayerWin, unrecountedRecentMatches, mergeHeroRecords, mergeWl, buildModeBreakdown } =
  await import(pathToFileURL(statsOutputFile).href)
const { pickFreshFaces, FRESH_FACES_COUNT, FRESH_WINDOW_DAYS } = await import(
  pathToFileURL(freshOutputFile).href
)

let failures = 0
function check(label, condition, extra = '') {
  if (condition) {
    console.log(`  \u2713 ${label}`)
  } else {
    failures += 1
    console.log(`  \u2717 ${label} ${extra}`)
  }
}

const ATTRS = ['str', 'agi', 'int']
const heroes = Array.from({ length: 10 }, (_, index) => ({
  id: index + 1,
  name: `npc_dota_hero_${index + 1}`,
  localized_name: `Hero ${index + 1}`,
  primary_attr: ATTRS[index % 3],
  attack_type: index % 2 === 0 ? 'Melee' : 'Ranged',
  roles: index % 2 === 0 ? ['Carry', 'Escape'] : ['Support', 'Disabler'],
  img: '',
  icon: '',
  pub_pick: 10000,
  pub_win: 5200,
  pro_pick: 5,
  pro_win: 2,
  pro_ban: 1,
  turbo_picks: 100,
  turbo_wins: 50,
  '3_pick': 1000,
  '3_win': 520,
}))

/** Nobody has touched heroes 8, 9 and 10. */
const played = heroes.slice(0, 7).map((hero) => ({
  hero_id: hero.id,
  last_played: 1700000000,
  games: 12,
  win: 5,
  with_games: 3,
  with_win: 1,
  against_games: 4,
  against_win: 2,
}))

const filters = { roles: [], attrs: [], attackType: 'all', banned: [], seen: [], locallyPlayed: [] }
const rng = seededRandom(hashSeed('dotadex-test'))
const roll = (overrides = {}) =>
  suggestHeroes({ mode: 'fresh', heroes, playerHeroes: played, filters, bracket: 3, rng, ...overrides })

console.log('\nDotaDex engine test\n')
console.log('New Hero Only only serves untouched heroes')
const first = roll()
check('returns picks', first.picks.length > 0)
check('every pick is untouched', first.picks.every((pick) => pick.hero.id >= 8))
check('pool size is reported', first.poolSize === 3, `poolSize=${first.poolSize}`)

console.log('\nRerolls cannot repeat a served hero')
const seen = [first.picks[0].hero.id]
const second = roll({ filters: { ...filters, seen } })
check('primary pick changed', second.picks[0].hero.id !== seen[0])
check('served hero is nowhere in the list', second.picks.every((pick) => !seen.includes(pick.hero.id)))

console.log('\nA full lap covers every untouched hero exactly once')
const served = []
for (let index = 0; index < 3; index += 1) {
  const result = roll({ filters: { ...filters, seen: served } })
  served.push(result.picks[0].hero.id)
}
check('three distinct heroes', new Set(served).size === 3, JSON.stringify(served))
check('cover 8, 9 and 10', served.slice().sort((a, b) => a - b).join(',') === '8,9,10')

console.log('\nLap completion starts a new cycle instead of repeating')
const fourth = roll({ filters: { ...filters, seen: served } })
check('cycle exhaustion flagged', fourth.cycleExhausted === true)
check('lap completion flagged', fourth.lapComplete === true)
check('repeats stay blocked while untouched heroes exist', fourth.repeatsAllowed === false)
check('new lap still serves untouched heroes', fourth.picks.every((pick) => pick.hero.id >= 8))

console.log('\nFilters, bans and local logs')
const banned = roll({ filters: { ...filters, banned: [8, 9, 10] } })
check('banned heroes are never served', banned.picks.every((pick) => ![8, 9, 10].includes(pick.hero.id)))
check('falls back to repeats with an explanation', banned.repeatsAllowed === true && banned.note.includes('trauma list'))
const supports = roll({ filters: { ...filters, roles: ['Support'] } })
check('role filter narrows the pool', supports.poolSize === 2, `poolSize=${supports.poolSize}`)
check('role filter respected', supports.picks.every((pick) => pick.hero.roles.includes('Support')))
const ranged = suggestHeroes({ mode: 'roulette', heroes, playerHeroes: played, filters: { ...filters, attackType: 'Ranged' }, bracket: 3, rng })
check('range filter respected', ranged.picks.every((pick) => pick.hero.attack_type === 'Ranged'))
const empty = roll({ filters: { ...filters, attrs: ['str'], banned: [1, 4, 7, 10] } })
check('impossible filter returns nothing', empty.picks.length === 0)
check('impossible filter explains itself', empty.note.includes('filters'), empty.note)

console.log('\nModes and matchup helpers')
const counterMatchups = heroes.map((hero) => ({ hero_id: hero.id, games_played: 500, wins: hero.id === 8 ? 100 : 300 }))
const counter = suggestHeroes({
  mode: 'counter',
  heroes,
  playerHeroes: played,
  filters,
  bracket: 3,
  rng,
  enemyHeroId: 1,
  enemyMatchups: counterMatchups,
})
check('counter mode ranks the worst enemy matchup first', counter.picks[0].hero.id === 8, `got ${counter.picks[0].hero.id}`)
const threats = worstMatchupsFor(counterMatchups, 3, 60)
check('worstMatchupsFor lists the lowest own-winrate opponent first', threats[0].heroId === 8 && threats[0].winrate === 20)
check('rouletteStrip keeps the hero type', rouletteStrip(heroes, rng, 5).length === 5)
check('daily seed is stable per day and changes daily', hashSeed('a:2026-01-01') === hashSeed('a:2026-01-01') && hashSeed('a:2026-01-01') !== hashSeed('a:2026-01-02'))

/* ------------------------------------------------------------------ *
 * All-mode stats: OpenDota drops Turbo/Ability Draft from its lifetime
 * endpoints, so the store folds the ones it does hand back in.
 * ------------------------------------------------------------------ */

console.log('\nAll-mode stats merge\n')

const recentMatch = (overrides = {}) => ({
  match_id: 1,
  player_slot: 0,
  radiant_win: true,
  hero_id: 1,
  start_time: 1700000000,
  duration: 1500,
  game_mode: 22,
  lobby_type: 0,
  kills: 5,
  deaths: 2,
  assists: 10,
  xp_per_min: null,
  gold_per_min: null,
  hero_damage: null,
  tower_damage: null,
  hero_healing: null,
  last_hits: null,
  lane: null,
  lane_role: null,
  is_roaming: null,
  party_size: null,
  ...overrides,
})

/** OpenDota aggregates Ranked All Pick (22) only: Turbo (23) / AD (18) never appear. */
const counts = { game_mode: { 22: { games: 100, win: 60 } } }
const recent = [
  recentMatch({ match_id: 1, hero_id: 1, game_mode: 22 }), // already in the aggregate
  recentMatch({ match_id: 2, hero_id: 2, game_mode: 23 }), // Turbo win
  recentMatch({ match_id: 3, hero_id: 2, game_mode: 23, radiant_win: false }), // Turbo loss
  recentMatch({ match_id: 4, hero_id: 3, game_mode: 18, player_slot: 128 }), // AD loss
]

check('win detection reads player_slot against radiant_win',
  didPlayerWin(recent[0]) === true
  && didPlayerWin(recent[2]) === false
  && didPlayerWin(recent[3]) === false)

const extras = unrecountedRecentMatches(counts, recent)
check('modes missing from /counts are flagged as uncounted', extras.length === 3, `got ${extras.length}`)
check('already-aggregated modes are left alone', extras.every((m) => m.game_mode !== 22))
check('no /counts means no guesses (avoids double counting)', unrecountedRecentMatches(null, recent).length === 0)

const baseWl = { win: 60, lose: 40 }
const mergedWl = mergeWl(baseWl, extras)
check('win/loss absorbs the missed matches', mergedWl.win === 61 && mergedWl.lose === 42, JSON.stringify(mergedWl))
check('games tracked stays consistent with the hero total', mergedWl.win + mergedWl.lose === 100 + extras.length)
check('a missing /wl is never fabricated', mergeWl(null, extras) === null)

const records = [1, 2, 3].map((heroId) => ({
  hero_id: heroId,
  last_played: 1600000000,
  games: 10,
  win: 5,
  with_games: 0,
  with_win: 0,
  against_games: 0,
  against_win: 0,
}))
const mergedRecords = mergeHeroRecords(records, extras)
const byId = new Map(mergedRecords.map((record) => [record.hero_id, record]))
check('untouched hero is unchanged', byId.get(1).games === 10 && byId.get(1).win === 5)
check('turbo hero gains both games', byId.get(2).games === 12 && byId.get(2).win === 6, JSON.stringify(byId.get(2)))
check('ability draft hero gains one loss', byId.get(3).games === 11 && byId.get(3).win === 5)
check('newer match refreshes last_played', byId.get(2).last_played === 1700000000)
check('input records are not mutated', records[1].games === 10 && records[1].win === 5)
check(
  'merged hero total equals the base games plus the folded-in matches',
  mergedRecords.reduce((sum, record) => sum + record.games, 0) === 30 + extras.length,
  `got ${mergedRecords.reduce((sum, record) => sum + record.games, 0)}`,
)

const breakdown = buildModeBreakdown(counts, extras)
const rowFor = (id) => breakdown.find((row) => row.gameModeId === id)
check('aggregated mode is complete history', rowFor(22).games === 100 && rowFor(22).recentOnly === false)
check('turbo row is flagged recent-only', rowFor(23).recentOnly === true && rowFor(23).games === 2)
check('turbo row records both sides', rowFor(23).win === 1 && rowFor(23).lose === 1 && rowFor(23).winrate === 50)
check('ability draft row exists', rowFor(18).games === 1 && rowFor(18).win === 0)
check('rows sort by games desc', breakdown.map((row) => row.gameModeId).join(',') === '22,23,18')

/* ------------------------------------------------------------------ *
 * Fresh faces: always >= 10 heroes, and never one you just played.
 * ------------------------------------------------------------------ */

console.log('\nFresh faces picker\n')

const NOW = 1_800_000_000
const DAY = 86_400
const freshRoster = Array.from({ length: 30 }, (_, index) => ({ id: index + 1 }))
const freshLastPlayed = new Map([
  [4, NOW - 1 * DAY], // played yesterday -> too recent
  [5, NOW - 3 * DAY], // played this week -> too recent
  [6, NOW - 16 * DAY], // stale by date, but still sitting in the last 20 matches
])
for (let id = 7; id <= 30; id += 1) {
  freshLastPlayed.set(id, NOW - (10 + id) * DAY) // 17d .. 40d ago
}
const freshPlayedIds = new Set(freshRoster.map((hero) => hero.id).filter((id) => id > 3))
const freshOptions = {
  playedIds: freshPlayedIds,
  lastPlayedOf: (heroId) => freshLastPlayed.get(heroId) ?? 0,
  recentHeroIds: [6],
  now: NOW,
}
const staleBlock = '30,29,28,27,26,25,24'

check('the strip always aims for 10 heroes', FRESH_FACES_COUNT === 10, `${FRESH_FACES_COUNT}`)
check('the recent window is a week', FRESH_WINDOW_DAYS === 7, `${FRESH_WINDOW_DAYS}`)

const faces = pickFreshFaces(freshRoster, {
  ...freshOptions,
  rng: seededRandom(hashSeed('fresh-faces-test')),
})
check('always hands back the full set', faces.length === FRESH_FACES_COUNT, `got ${faces.length}`)
check(
  'never-played heroes lead the strip',
  faces.slice(0, 3).every((hero) => hero.id <= 3),
  JSON.stringify(faces.slice(0, 3).map((hero) => hero.id)),
)
check(
  'stale heroes follow, oldest game first',
  faces.slice(3).map((hero) => hero.id).join(',') === staleBlock,
  faces.slice(3).map((hero) => hero.id).join(','),
)
check('hero played yesterday is left out', faces.every((hero) => hero.id !== 4 && hero.id !== 5))
check('hero from the last 20 matches is left out', faces.every((hero) => hero.id !== 6))

const facesOtherDay = pickFreshFaces(freshRoster, {
  ...freshOptions,
  rng: seededRandom(hashSeed('another-day')),
})
check(
  'untouched heroes still lead on a different day',
  facesOtherDay.slice(0, 3).every((hero) => hero.id <= 3),
  JSON.stringify(facesOtherDay.slice(0, 3).map((hero) => hero.id)),
)
check(
  'stale block is stable across days',
  facesOtherDay.slice(3).map((hero) => hero.id).join(',') === staleBlock,
  facesOtherDay.slice(3).map((hero) => hero.id).join(','),
)

const tiny = pickFreshFaces([{ id: 1 }, { id: 2 }, { id: 3 }], {
  playedIds: new Set(),
  lastPlayedOf: () => 0,
  recentHeroIds: [],
  now: NOW,
  rng: seededRandom(hashSeed('tiny')),
})
check('returns everything when the roster is smaller than the target', tiny.length === 3, `got ${tiny.length}`)

const noStaleLeft = pickFreshFaces(freshRoster, {
  playedIds: new Set(freshRoster.map((hero) => hero.id)),
  lastPlayedOf: () => NOW - 1 * DAY,
  recentHeroIds: [],
  now: NOW,
  rng: seededRandom(hashSeed('no-stale')),
})
check('empty strip when every hero was played this week', noStaleLeft.length === 0, `got ${noStaleLeft.length}`)

await rm(outputDir, { recursive: true, force: true })

console.log(failures === 0 ? '\nAll engine checks passed.\n' : `\n${failures} engine check(s) failed.\n`)
process.exit(failures === 0 ? 0 : 1)
