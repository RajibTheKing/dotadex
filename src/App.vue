<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import ToastHost from '@/components/ToastHost.vue'
import { usePlayerStore } from '@/stores/player'
import { useRosterStore } from '@/stores/roster'

const roster = useRosterStore()
const player = usePlayerStore()

onMounted(async () => {
  await roster.load()
  void roster.loadGameModes()
  if (player.accountId) await player.load()
})
</script>

<template>
  <div class="app-shell">
    <AppHeader />
    <main class="page">
      <div class="container">
        <RouterView />
      </div>
    </main>
    <footer class="app-footer">
      <div class="container row">
        <span>
          DotaDex · unofficial fan tool. Data from
          <a href="https://www.opendota.com" target="_blank" rel="noreferrer">OpenDota</a>, hero art ©
          Valve. Nothing is stored on a server.
        </span>
        <span class="spacer" />
        <span v-if="roster.error" class="muted">{{ roster.error }}</span>
      </div>
    </footer>
    <ToastHost />
  </div>
</template>
