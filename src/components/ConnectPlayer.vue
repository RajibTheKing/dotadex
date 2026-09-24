<script setup lang="ts">
import { computed, ref } from 'vue'
import { searchPlayers } from '@/api/opendota'
import type { SearchResult } from '@/types/opendota'
import { usePlayerStore } from '@/stores/player'
import { useToast } from '@/composables/useToast'
import { looksLikeVanityUrl, parseAccountInput } from '@/utils/account'

const player = usePlayerStore()
const toast = useToast()

const accountInput = ref('')
const query = ref('')
const results = ref<SearchResult[]>([])
const searching = ref(false)
const searchError = ref<string | null>(null)

const parsedAccountId = computed(() => parseAccountInput(accountInput.value))

async function connect(id: number): Promise<void> {
  await player.connect(id)
  if (player.error) {
    toast.push(player.error, 'error')
    return
  }
  toast.push(`Connected. ${player.neverPlayed.length} heroes still untouched.`, 'success')
  results.value = []
  accountInput.value = ''
  query.value = ''
}

async function submitAccount(): Promise<void> {
  if (looksLikeVanityUrl(accountInput.value)) {
    toast.push(
      'Vanity profile URLs need the Steam API. Use the account id (OpenDota profile URL) or search by name instead.',
      'warn',
    )
    return
  }
  const id = parsedAccountId.value
  if (id === null) {
    toast.push('That does not look like an account id, SteamID64 or profile URL.', 'error')
    return
  }
  await connect(id)
}

async function runSearch(): Promise<void> {
  const value = query.value.trim()
  if (value.length < 2) {
    toast.push('Type at least two characters to search players.', 'warn')
    return
  }
  searching.value = true
  searchError.value = null
  try {
    const found = await searchPlayers(value)
    results.value = found.slice(0, 8)
    if (results.value.length === 0) {
      toast.push('No players matched that name. Try the account id instead.', 'info')
    }
  } catch (caught) {
    searchError.value = caught instanceof Error ? caught.message : 'Player search failed.'
    toast.push(searchError.value, 'error')
  } finally {
    searching.value = false
  }
}

function useDemo(): void {
  accountInput.value = '86745912'
  void submitAccount()
}

function accountIdFromUrl(value: string): string | null {
  const match = value.match(/players\/(\d{5,20})/)
  return match ? match[1] : null
}

function connectResult(result: SearchResult): void {
  void connect(result.account_id)
}
</script>

<template>
  <div class="stack" style="gap: 14px">
    <div>
      <label class="field" for="account">Account id, SteamID64 or OpenDota profile URL</label>
      <div class="inline-form">
        <input
          id="account"
          v-model="accountInput"
          placeholder="e.g. 86745912 or 76561198047011640"
          @keyup.enter="submitAccount"
        />
        <button type="button" class="primary" :disabled="player.loading" @click="submitAccount">
          {{ player.loading ? 'Connecting…' : 'Connect' }}
        </button>
        <button type="button" class="ghost" @click="useDemo">Try a demo account</button>
      </div>
      <p v-if="accountInput && parsedAccountId !== null" class="tiny muted" style="margin-top: 6px">
        Resolves to account id <strong>{{ parsedAccountId }}</strong>
        <template v-if="accountIdFromUrl(accountInput)"> (pulled out of that URL)</template>
      </p>
    </div>

    <details>
      <summary class="muted tiny" style="cursor: pointer">Don’t know your account id? Search by name</summary>
      <div class="inline-form" style="margin-top: 10px">
        <input v-model="query" placeholder="Dota nickname…" @keyup.enter="runSearch" />
        <button type="button" :disabled="searching" @click="runSearch">
          {{ searching ? 'Searching…' : 'Search' }}
        </button>
      </div>
      <ul v-if="results.length > 0" class="queue-list" style="margin-top: 10px">
        <li v-for="result in results" :key="result.account_id" class="queue-item">
          <img v-if="result.avatarfull" :src="result.avatarfull" alt="" />
          <span class="spacer">
            <strong>{{ result.personaname || 'Unknown' }}</strong>
            <span class="tiny muted" style="display: block">account id {{ result.account_id }}</span>
          </span>
          <button type="button" class="chip" @click="connectResult(result)">Connect</button>
        </li>
      </ul>
    </details>
  </div>
</template>
