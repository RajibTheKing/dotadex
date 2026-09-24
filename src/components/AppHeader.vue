<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { usePlayerStore } from '@/stores/player'
import { rankLabel } from '@/utils/heroes'

const player = usePlayerStore()

const links = [
  { to: '/', label: 'Home' },
  { to: '/suggest', label: 'Roll a hero' },
  { to: '/dex', label: 'The Dex' },
  { to: '/stats', label: 'Wall of Fame' },
  { to: '/about', label: 'About' },
]
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
      </div>
    </div>
  </header>
</template>
