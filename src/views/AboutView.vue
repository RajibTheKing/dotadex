<script setup lang="ts">
import { rateLimit, API_BASE, OPENDOTA_SITE } from '@/api/opendota'
import { useDexStore } from '@/stores/dex'

const dex = useDexStore()

const nameIdeas = [
  { name: 'DotaDex', blurb: 'The one we shipped: a Pokédex for the Dota roster. One favorite per hero slot.' },
  { name: 'Hero Roulette', blurb: 'Honest about what it does. Says nothing about the trauma.' },
  { name: 'Roshan’s Roulette', blurb: 'Same thing, but with an angry bear branding.' },
  { name: 'Fifth Pick Prophet', blurb: 'For the player who always has to fill the last slot.' },
  { name: 'Aegis Odds', blurb: 'Sounds like a betting app. It is not a betting app. Probably.' },
  { name: 'Draft Gremlin', blurb: 'For the friend who locks something unhinged at minute zero.' },
  { name: 'All Hero Challenge (Unofficial)', blurb: 'Accurate, but Valve has enough lawyers already.' },
]
</script>

<template>
  <div class="stack">
    <section class="panel gold">
      <h1 style="margin-bottom: 4px">🎯 DotaDex</h1>
      <p class="muted" style="max-width: 780px">
        A tiny Vue app with one very specific job: stop you from picking the same five heroes until the
        heat death of the universe. It reads your OpenDota history, keeps a queue of every hero it has
        already offered you, and refuses to repeat itself until the whole roster has had a turn.
      </p>
      <div class="row tight">
        <span class="badge gold">Vue 3 + Vite + TypeScript</span>
        <span class="badge">Pinia</span>
        <span class="badge">Vue Router</span>
        <span class="badge">No backend</span>
      </div>
    </section>

    <div class="grid-2">
      <section class="panel">
        <div class="panel-title">🎲 What it actually does</div>
        <ul class="reason-list">
          <li><strong>Dex tracking:</strong> every hero marked as played or untouched, from your OpenDota data.</li>
          <li><strong>New Hero Only mode:</strong> suggests heroes you have never played, with no repeats inside a cycle.</li>
          <li><strong>Cycle queue:</strong> rolled heroes are parked and excluded until the queue empties, then a new lap starts.</li>
          <li><strong>Six suggestion modes:</strong> new only, pure roulette, comfort zone, chaos mode, meta slaves and counter pick.</li>
          <li><strong>Filters:</strong> role, attribute, melee/ranged — for when the draft needs a support and your heart wants a carry.</li>
          <li><strong>Counter data:</strong> OpenDota matchups show which heroes ruin your pick before you commit.</li>
          <li><strong>Trauma list:</strong> ban a hero from the engine forever (or until you forgive it).</li>
          <li><strong>Silly extras:</strong> cursed hero of the day, awards, playstyle titles, achievements.</li>
        </ul>
      </section>

      <section class="panel">
        <div class="panel-title">🧠 How the no-repeat rule works</div>
        <ol class="reason-list">
          <li>Your played heroes come from <code>/players/{account_id}/heroes</code>.</li>
          <li>Each roll pushes the hero into a persisted queue in this browser.</li>
          <li>The engine filters out everything in that queue, so a reroll cannot return the same hero.</li>
          <li>“I played it” removes it from the queue and logs it as played locally.</li>
          <li>“Skip” keeps it in the queue with a dodge count, so the shame is recorded.</li>
          <li>When the queue is empty, cycle {{ dex.cycle + 1 }} starts and the pool resets.</li>
        </ol>
      </section>
    </div>

    <section class="panel">
      <div class="panel-title">🏷️ Name candidates</div>
      <p class="tiny muted">
        The folder was already called <code>dotadex</code>, so the pun won. Runners-up, in case you ever
        rename it:
      </p>
      <table class="data">
        <thead>
          <tr><th>Name</th><th>Vibe</th></tr>
        </thead>
        <tbody>
          <tr v-for="idea in nameIdeas" :key="idea.name">
            <td><strong>{{ idea.name }}</strong></td>
            <td class="muted">{{ idea.blurb }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <div class="grid-2">
      <section class="panel">
        <div class="panel-title">🔌 Data source</div>
        <p class="tiny muted">
          Everything comes from the community-run OpenDota API:
          <a :href="OPENDOTA_SITE" target="_blank" rel="noreferrer">{{ OPENDOTA_SITE }}</a>. Hero
          portraits are served from Valve’s Steam CDN.
        </p>
        <table class="data">
          <tbody>
            <tr><th>Base URL</th><td><code>{{ API_BASE }}</code></td></tr>
            <tr>
              <th>Requests left (minute)</th>
              <td>
                {{ rateLimit.minuteRemaining ?? '—' }}
                <span v-if="rateLimit.minuteLimit" class="muted">/ {{ rateLimit.minuteLimit }}</span>
              </td>
            </tr>
            <tr>
              <th>Requests left (day)</th>
              <td>
                {{ rateLimit.dayRemaining ?? '—' }}
                <span v-if="rateLimit.dayLimit" class="muted">/ {{ rateLimit.dayLimit }}</span>
              </td>
            </tr>
          </tbody>
        </table>
        <p class="tiny muted" style="margin-top: 8px">
          The free tier allows about 60 requests/minute and 2 000/day. Responses are cached (hero stats
          for 6 hours, matchups for a day), so browsing the dex stays cheap.
        </p>
      </section>

      <section class="panel">
        <div class="panel-title">🔒 Privacy &amp; storage</div>
        <p class="tiny muted">
          There is no backend. Your account id, cycle queue, trauma list, logged heroes and achievement
          counters live in <code>localStorage</code> under the <code>dotadex:</code> prefix. Clearing
          browser data removes everything. Requests go straight from your browser to OpenDota.
        </p>
        <div class="panel-title" style="margin-top: 14px">🧭 Roadmap ideas</div>
        <ul class="reason-list">
          <li>All Hero Challenge mode: only advance when you actually win with the hero.</li>
          <li>Turbo and bracket aware meta weighting, plus patch diff tracking.</li>
          <li>Party mode: share a roll link so friends can see and mock your assignment.</li>
          <li>Draft helper: enemy lineup in, full counter plan out.</li>
          <li>Winrate goals per hero with progress bars and bragging rights.</li>
        </ul>
      </section>
    </div>

    <section class="panel">
      <div class="panel-title">⚠️ Fine print</div>
      <p class="tiny muted" style="margin: 0">
        DotaDex is an unofficial fan project. Dota 2 and all hero assets belong to Valve. Data belongs
        to OpenDota and the community. Suggestions are statistical opinions offered by a JavaScript
        file — if you lose with the hero it gave you, that is exactly the intended experience.
      </p>
    </section>

  </div>
</template>

