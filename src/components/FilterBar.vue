<script setup lang="ts">
import { ATTRS, ROLES } from '@/utils/heroes'
import { toggleIn, type DexFilters } from '@/utils/filters'

const props = withDefaults(
  defineProps<{
    filters: DexFilters
    showDexOnly?: boolean
  }>(),
  { showDexOnly: false },
)

function toggleRole(role: string): void {
  props.filters.roles = toggleIn(props.filters.roles, role)
}

function toggleAttr(attr: string): void {
  props.filters.attrs = toggleIn(props.filters.attrs, attr)
}

function clearAll(): void {
  props.filters.roles = []
  props.filters.attrs = []
  props.filters.attackType = 'all'
  props.filters.onlyUntouched = false
  props.filters.onlyTouched = false
  props.filters.hideBanned = false
}

function clearRolesAndAttrs(): void {
  props.filters.roles = []
  props.filters.attrs = []
}
</script>

<template>
  <div class="stack" style="gap: 10px">
    <input
      v-model="filters.search"
      type="search"
      placeholder="Filter heroes by name…"
      aria-label="Filter heroes by name"
    />

    <div class="row tight">
      <button
        v-for="attr in ATTRS"
        :key="attr.key"
        type="button"
        class="chip"
        :class="{ active: filters.attrs.includes(attr.key) }"
        :style="filters.attrs.includes(attr.key) ? { borderColor: attr.color, color: attr.color } : undefined"
        @click="toggleAttr(attr.key)"
      >
        {{ attr.label }}
      </button>
      <span class="spacer" />
      <select v-model="filters.attackType" style="max-width: 150px">
        <option value="all">Any range</option>
        <option value="Melee">Melee</option>
        <option value="Ranged">Ranged</option>
      </select>
    </div>

    <div class="row tight">
      <button
        v-for="role in ROLES"
        :key="role"
        type="button"
        class="chip"
        :class="{ active: filters.roles.includes(role) }"
        @click="toggleRole(role)"
      >
        {{ role }}
      </button>
    </div>

    <div class="row tight">
      <button
        v-if="showDexOnly"
        type="button"
        class="chip"
        :class="{ active: filters.onlyUntouched }"
        @click="filters.onlyUntouched = !filters.onlyUntouched"
      >
        🆕 Untouched only
      </button>
      <button
        v-if="showDexOnly"
        type="button"
        class="chip"
        :class="{ active: filters.onlyTouched }"
        @click="filters.onlyTouched = !filters.onlyTouched"
      >
        ✅ Have played
      </button>
      <button
        v-if="showDexOnly"
        type="button"
        class="chip"
        :class="{ active: filters.hideBanned }"
        @click="filters.hideBanned = !filters.hideBanned"
      >
        🚫 Hide trauma list
      </button>
      <span class="spacer" />
      <button type="button" class="chip" @click="clearAll">Reset</button>
      <button
        v-if="filters.roles.length > 0 || filters.attrs.length > 0"
        type="button"
        class="chip"
        @click="clearRolesAndAttrs"
      >
        Clear roles/attrs
      </button>
      <slot name="extra" />
    </div>
  </div>
</template>
