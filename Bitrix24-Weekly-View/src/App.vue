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
      const url = new URL(window.location.href)
      const isSlider =
        url.searchParams.get('IFRAME_TYPE') === 'SIDE_SLIDER' ||
        url.searchParams.get('IFRAME') === 'Y'

      const isBookingView =
        view === 'booking-create' || view === 'booking-edit'

      if (window.top && window.top !== window.self && !isSlider && !isBookingView) {
        url.searchParams.delete('IFRAME')
        url.searchParams.delete('IFRAME_TYPE')
        window.top.location.href = url.toString()
        return
      }
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
   <div v-if="initError" class="p-6 text-red-600">{{ initError }}</div>
   <div v-else-if="!ready" class="p-6 text-gray-500">Loading…</div>
   <RouterView v-else />
</template>
