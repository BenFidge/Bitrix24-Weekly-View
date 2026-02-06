<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { bitrix24Api } from './services/bitrix24Api'

const ready = ref(false)
const initError = ref<string | null>(null)
const router = useRouter()
const route = useRoute()

const getQueryValue = (value: unknown): string | undefined => {
  if (Array.isArray(value)) return value[0]
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return undefined
}

const readWindowSearchParams = (): Record<string, string> => {
  const params: Record<string, string> = {}
  try {
    const url = new URL(window.location.href)
    url.searchParams.forEach((v, k) => v && (params[k] = v))
  } catch {}
  return params
}

const coerceStringRecord = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== 'object') return {}
  const result: Record<string, string> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const s = getQueryValue(v)
    if (s) result[k] = s
  }
  return result
}

const getMergedParams = async (): Promise<Record<string, string>> => {
  const fromRoute = coerceStringRecord(route.query)
  const fromWindow = readWindowSearchParams()
  let fromPlacement: Record<string, string> = {}

  try {
    const placementInfo = await bitrix24Api.getPlacementInfo()
    fromPlacement = coerceStringRecord(placementInfo?.options)
  } catch {}

  return { ...fromWindow, ...fromPlacement, ...fromRoute }
}

onMounted(async () => {
  try {
    await bitrix24Api.init()

    const placementInfo = await bitrix24Api.getPlacementInfo()
    const params = await getMergedParams()
    const view = params.view

    if (placementInfo?.placement === 'LEFT_MENU') {
      // Do NOT touch window.top inside an iframe app (cross-origin).
      // If this app needs to be opened as a full page, use BX24.openApplication/openPath from the portal.
    }

    ready.value = true

    if (view === 'booking-create') {
      await router.replace({ name: 'booking-create', query: params })
    } else if (view === 'booking-edit') {
      await router.replace({ name: 'booking-edit', query: params })
    }
  } catch (e) {
    initError.value = e instanceof Error ? e.message : String(e)
  }
})
</script>

<template>
  <div class="p-4">
    <B24Alert
      v-if="initError"
      color="air-primary-alert"
      title="App failed to start"
      :description="initError"
    />
    <B24Alert
      v-else-if="!ready"
      color="air-primary-warning"
      title="Loading…"
      description="Initializing Bitrix24 SDK and app context."
    />
    <RouterView v-else />
  </div>
</template>

