# 🎯 DotaDex

A small Vue 3 web app that pulls a Dota 2 profile from the [OpenDota API](https://docs.opendota.com/)
and turns it into a **hero collection tracker** (a Pokédex for the roster) plus a **match-to-match
hero suggestion engine** whose party trick is simple:

> It only suggests heroes you have never played, and it **never repeats a hero** until you have been
> served every hero once.

## Name ideas

The shipped name is **DotaDex** (the folder was already called `dotadex`, the pun won).
Runners-up, in case you rename it: *Hero Roulette*, *Roshan’s Roulette*, *Fifth Pick Prophet*,
*Aegis Odds*, *Draft Gremlin*, *All Hero Challenge (Unofficial)*.

## Tech stack

| Piece | Choice |
| --- | --- |
| Framework | Vue 3 (`<script setup lang="ts">`) |
| Build | Vite 6 |
| State | Pinia (setup stores) |
| Routing | Vue Router 4 (hash history) |
| Styling | Hand-rolled CSS, no UI framework |
| Data | OpenDota public API (browser → API, CORS verified, no backend) |
| Persistence | `localStorage` (`dotadex:` prefix) |

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # vue-tsc --noEmit && vite build
npm run preview
npm test         # engine test for the no-repeat cycle logic
```

`npm test` bundles `src/utils/suggest.ts` with esbuild and runs the assertion suite for the
suggestion engine (untouched-only picks, no repeats inside a lap, lap completion, filters, bans,
counter ranking, daily seed) — no browser required.

## Core feature: the no-repeat cycle

- `New Hero Only` mode (the default) offers **untouched heroes only**.
- Every roll is **parked in a cycle queue**; queued heroes are excluded from the pool, so rerolls,
  skips and bans can never hand you the same hero twice in a lap.
- When the queue empties, **cycle N+1** starts and the roster resets. Progress is visible on screen.
- `I played it` removes the hero from the queue and logs it locally (OpenDota can lag behind your
  most recent match).
- `Skip` keeps it queued and counts a dodge (public shame in the queue list).
- `Never again` adds a hero to the **trauma list**, banned from the engine forever-ish.

### Suggestion modes

| Mode | Logic |
| --- | --- |
| 🆕 New Hero Only | untouched heroes, no repeats per cycle |
| 🎲 Pure Roulette | uniform random from the filtered pool |
| 🛋️ Comfort Zone | your highest winrate heroes |
| 🔥 Chaos Mode | your *worst* heroes, for science |
| 📈 Meta Slaves | highest public winrate in your rank bracket (`/heroStats`) |
| 🎯 Counter Pick | given an enemy hero, the statistically worst matchup from `/heroes/{id}/matchups` |

Filters cover role, attribute and melee/ranged. Each pick comes with **reasons**, your own record and
a **danger list** of counters.

## The dex

- All 127 heroes with your games / winrate / last played; untouched heroes are greyed out.
- Filters plus sorting (name, most played, best winrate, recently played, patch winrate).
- Detail panel with base stats, your record, counters to fear, log/unlog, ban and an OpenDota link.

## Funny features

- 🔮 **Cursed Hero of the Day** — deterministic per account + calendar day, changes at midnight.
- 🏆 **Award cabinet** — The One True Main, Certified Feeder, Dust Collector, Meta Sheep,
  Professional Hipster, New Toy, Hero of the People, Freshly Registered.
- 🎭 **Playstyle title** — e.g. *Agility Gremlin · Escape*, derived from your attribute/role mix.
- 🎖️ **Achievements** with progress (First Roll, Roulette Veteran, Explorer of the Roster, Purist,
  Trauma Surgeon, Second Lap).
- 🧠 **Coach’s corner** quips, rotating roll-button labels, dex ranks (Larva → Completionist).
- 📋 **Copy for the party** — share your assignment with your teammates.
- 📚 Suggestion history, dodge counts and an OpenDota rate-limit meter.

## API endpoints used

| Endpoint | Purpose |
| --- | --- |
| `GET /heroStats` | roster + patch pick/win rates per bracket (cached 6 h) |
| `GET /players/{id}` | profile, rank tier, MMR |
| `GET /players/{id}/heroes` | games/winrate per hero → dex status |
| `GET /players/{id}/wl` | lifetime win/loss |
| `GET /players/{id}/counts` | per-mode/per-patch lifetime counts → the all-mode merge |
| `GET /players/{id}/recentMatches` | recent form strip + match table |
| `GET /heroes/{id}/matchups` | counters (cached 24 h) |
| `GET /search?q=` | find a player by nickname |
| `GET /constants/game_mode` | readable game mode names (cached 7 d) |

Rate limits are roughly **60 requests/minute and 2 000/day**. Responses are cached in memory (and
`localStorage` for the large ones), and the remaining quota is shown on the stats page.

> **Turbo / all-modes note.** OpenDota runs every lifetime endpoint through an `isSignificant()`
> check that rejects any match whose `game_mode`/`lobby_type` is not marked "balanced" — exactly
> where Turbo (23), Ability Draft (18) and the event modes live. The defaults therefore report only
> normal + ranked games: a **20 000-Turbo-game account showed up as 278 matches**. DotaDex sends
> `significant=0` on `/wl`, `/heroes` and `/counts` to switch that filter off, which brings every
> mode back at full depth (the same account now reports 20 595). That flag also lets in a few
> matches with no recorded winner or hero, so totals can differ by a handful of games. As a
> fallback, `/counts` is used to spot any mode OpenDota still omits and fold in whatever
> `/recentMatches` (the one endpoint that never filters) can supply — those rows are flagged
> **"last 20 matches"** in the *Games by mode* table, and the merge is skipped entirely if
> `/counts` fails so nothing can be double counted.

Account input accepts a raw `account_id`, a **SteamID64** (`7656119…`), or an
`opendota.com/players/<id>` / `steamcommunity.com/profiles/<id>` URL. Vanity URLs (`/id/name`) need the
Steam API, so use the account id or the built-in name search instead.

## Project layout

```
src/
  api/opendota.ts        # typed fetch client + rate-limit capture + caching
  components/            # AppHeader, PlayerCard, HeroTile/Portrait, FilterBar, SuggestionCard,
                         # QueueList, RollReveal, AwardGrid, ProgressRing, ConnectPlayer,
                         # ToastHost
  composables/           # useToast, useDailyHero
  router/index.ts        # /, /suggest, /dex, /stats, /about
  stores/                # player, roster, dex (queue/bans/counters/history)
  utils/                 # suggest.ts (engine), stats.ts (all-mode merge), fun.ts (silly bits),
                         # heroes.ts, filters.ts, account.ts, storage.ts
  views/                 # HomeView, SuggestView, DexView, StatsView, AboutView
```

## Privacy

No backend, no accounts, no analytics. Your account id, cycle queue, trauma list, logged heroes and
counters live in `localStorage` under the `dotadex:` prefix, so clearing browser data wipes them.

## Roadmap

- All Hero Challenge mode (only advance on a win).
- Turbo/bracket aware weighting and patch diff tracking.
- Party mode with shareable roll links.
- Draft helper: enemy lineup in, counter plan out.

DotaDex is an unofficial fan project. Dota 2 and all hero assets belong to Valve; data belongs to
OpenDota and its contributors.

