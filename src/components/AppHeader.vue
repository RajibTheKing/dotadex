<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useDexStore } from '@/stores/dex'
import { usePlayerStore } from '@/stores/player'
import { useToast } from '@/composables/useToast'
import { rankLabel } from '@/utils/heroes'

const dex = useDexStore()
const player = usePlayerStore()
const toast = useToast()
const router = useRouter()

const settingsOpen = ref(false)
const keyDraft = ref(dex.apiKey)

const links = [
  { to: '/', label: 'Home' },
  { to: '/suggest', label: 'Roll a hero' },
  { to: '/dex', label: 'The Dex' },
  { to: '/stats', label: 'Wall of Fame' },
  { to: '/about', label: 'About' },
]

function saveKey(): void {
  dex.setApiKey(keyDraft.value)
  toast.push(
    dex.apiKey
      ? 'API key saved. The rate limiter fears you now.'
      : 'API key cleared. Back to the free tier, brave soul.',
    'success',
  )
}

function resetData(): void {
  const confirmed = window.confirm(
    'Wipe everything DotaDex stored locally (cycle queue, trauma list, logged heroes, achievements)?',
  )
  if (!confirmed) return
  dex.resetLocal()
  player.disconnect()
  toast.push('Local data wiped. Fresh dex, same MMR.', 'success')
  router.push('/')
}
</script>

<template>
  <header class="app-header">
    <div class="container header-inner">
      <RouterLink to="/" class="brand">
        <span class="brand-mark">◈</span>
        <span>
          <strong>DotaDex</strong>
        </span>
      </RouterLink>

      <nav class="nav">
        <RouterLink v-for="link in links" :key="link.to" :to="link.to" class="nav-link">
          {{ link.label }}
        </RouterLink>
      </nav>

      <div class="row tight">
        <RouterLink v-if="!player.profile" to="/" class="badge">Connect a player</RouterLink>
        <RouterLink v-else to="/" class="account-chip">
          <img v-if="player.profile.avatar" :src="player.profile.avatar" alt="" class="avatar" />
          <span class="tiny">
            <strong>{{ player.profile.personaname || 'Anonymous' }}</strong>
            <br />
            <span class="muted">{{ rankLabel(player.summary?.rank_tier ?? null) }}</span>
          </span>
        </RouterLink>
        <button type="button" class="chip" @click="settingsOpen = !settingsOpen">
          ⚙️ Settings
        </button>
      </div>
    </div>

    <div v-if="settingsOpen" class="container">
      <div class="panel settings-panel">
        <div class="panel-title">⚙️ Settings</div>
        <div class="grid-2">
          <div>
            <label class="field" for="api-key">OpenDota API key (optional)</label>
            <div class="inline-form">
              <input id="api-key" v-model="keyDraft" placeholder="paste a free key from opendota.com/api-keys" />
              <button type="button" class="primary" @click="saveKey">Save</button>
            </div>
            <p class="tiny muted" style="margin-top: 6px">
              Without a key you get roughly 60 requests per minute and 2 000 per day, which is plenty
              for normal use. A key bumps that to 1 200/min.
            </p>
          </div>
          <div>
            <label class="field">Local data</label>
            <p class="tiny muted">
              Everything DotaDex knows lives in this browser: your account id, the cycle queue, the
              trauma list, logged heroes and achievements. No server, no accounts, no tracking.
            </p>
            <button type="button" class="danger" @click="resetData">Nuke my local data</button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
