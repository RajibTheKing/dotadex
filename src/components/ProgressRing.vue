<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    percent: number
    size?: number
    thickness?: number
    label?: string
    caption?: string
  }>(),
  { size: 132, thickness: 11, label: '', caption: '' },
)

const radius = computed(() => (props.size - props.thickness) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
const clamped = computed(() => Math.max(0, Math.min(100, props.percent)))
const dashOffset = computed(() => circumference.value * (1 - clamped.value / 100))
const center = computed(() => props.size / 2)
</script>

<template>
  <div class="ring-wrap">
    <svg :width="size" :height="size" role="img" :aria-label="`${clamped.toFixed(1)} percent complete`">
      <circle
        :cx="center"
        :cy="center"
        :r="radius"
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        :stroke-width="thickness"
      />
      <circle
        :cx="center"
        :cy="center"
        :r="radius"
        fill="none"
        stroke="url(#ringGradient)"
        :stroke-width="thickness"
        stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="dashOffset"
        :transform="`rotate(-90 ${center} ${center})`"
      />
      <defs>
        <linearGradient id="ringGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#8f6b12" />
          <stop offset="1" stop-color="#f1cd74" />
        </linearGradient>
      </defs>
    </svg>
    <div class="ring-center">
      <strong>{{ clamped.toFixed(1) }}%</strong>
      <span v-if="label" class="tiny muted">{{ label }}</span>
      <span v-if="caption" class="tiny muted">{{ caption }}</span>
    </div>
  </div>
</template>

<style scoped>
.ring-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.ring-center {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  line-height: 1.2;
}

.ring-center strong {
  font-size: 1.35rem;
  color: #f1cd74;
}
</style>
