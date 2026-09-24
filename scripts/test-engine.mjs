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

await mkdir(outputDir, { recursive: true })
await build({
  entryPoints: [join(root, 'src', 'utils', 'suggest.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: outputFile,
  alias: { '@': join(root, 'src') },
  logLevel: 'warning',
})

const { suggestHeroes, seededRandom, hashSeed, rouletteStrip, worstMatchupsFor } = await import(
  pathToFileURL(outputFile).href
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

await rm(outputDir, { recursive: true, force: true })

console.log(failures === 0 ? '\nAll engine checks passed.\n' : `\n${failures} engine check(s) failed.\n`)
process.exit(failures === 0 ? 0 : 1)
