<script setup lang="ts">
import { ref } from 'vue'
import { EXCUSES, pickRandom } from '@/utils/fun'

const excuse = ref('')

function generate(): void {
  let next = pickRandom(EXCUSES)
  let guard = 0
  while (next === excuse.value && guard < 6) {
    next = pickRandom(EXCUSES)
    guard += 1
  }
  excuse.value = next
}
</script>

<template>
  <div class="panel">
    <div class="panel-title">🗣️ Excuse generator</div>
    <p class="tiny muted">
      For the post-loss all-chat. Legally distinct from lying, spiritually identical.
    </p>
    <p v-if="excuse" class="excuse">“{{ excuse }}”</p>
    <button type="button" class="primary" @click="generate">
      {{ excuse ? 'Another one' : 'Generate excuse' }}
    </button>
  </div>
</template>
