<script setup lang="ts">
   import { onMounted, ref } from 'vue'
   import { useRoute, useRouter } from 'vue-router'
   import { bitrix24Api } from './services/bitrix24Api'

   const ready = ref(false)
   const initError = ref<string | null>(null)
   const router = useRouter()
   const route = useRoute()

   const getQueryValue = (value: unknown): string | undefined => {
      if (Array.isArray(value)) {
         return value[0]
      }

      if (typeof value === 'string') {
         return value
      }

      return undefined
   }

   const readWindowSearchParams = (): Record<string, string> => {
      const params: Record<string, string> = {}
      try {
         const currentUrl = new URL(window.location.href)
         currentUrl.searchParams.forEach((value, key) => {
            if (value) params[key] = value
         })
      } catch {
         // ignore
      }
      return params
   }

   const coerceStringRecord = (value: unknown): Record<string, string> => {
      if (!value || typeof value !== 'object') return {}
      const record = value as Record<string, unknown>
      const result: Record<string, string> = {}
      for (const [k, v] of Object.entries(record)) {
         const s = getQueryValue(v)
         if (s) result[k] = s
      }
      return result
   }

   const getMergedParams = async (): Promise<Record<string, string>> => {
      // 1) Hash router query (/#/path?view=...)
      const fromRoute = coerceStringRecord(route.query)
      // 2) Window search params (?view=... before #)
      const fromWindow = readWindowSearchParams()
      // 3) Bitrix24 placement options (most reliable for BX24.openApplication)
      let fromPlacement: Record<string, string> = {}
      try {
         const placementInfo = await bitrix24Api.getPlacementInfo()
         fromPlacement = coerceStringRecord(placementInfo?.options)
      } catch {
         // ignore
      }

      return {
         ...fromWindow,
         ...fromPlacement,
         ...fromRoute
      }
   }

   onMounted(async () => {
      try {
         await bitrix24Api.init()

         const placementInfo = await bitrix24Api.getPlacementInfo()
         const params = await getMergedParams()
         const view = params.view

         // In LEFT_MENU Bitrix apps, we sometimes "break out" of nested iframes.
         // BUT if we're being opened inside a slider to show booking-create/edit,
         // we must NOT redirect the top window.
         if (placementInfo?.placement === 'LEFT_MENU') {
            const currentUrl = new URL(window.location.href)
            const isSlider = currentUrl.searchParams.get('IFRAME') === 'Y'
               || currentUrl.searchParams.get('IFRAME_TYPE') === 'SIDE_SLIDER'

            const isCustomView = view === 'booking-create' || view === 'booking-edit' || view === 'slot-finder'

            if (window.top && window.top !== window.self && !isSlider && !isCustomView) {
               // Open the weekly view in the main window (not nested)
               currentUrl.searchParams.delete('IFRAME')
               currentUrl.searchParams.delete('IFRAME_TYPE')
               window.top.location.href = currentUrl.toString()
               return
            }
         }

         ready.value = true


         if (view === 'booking-create' || view === 'slot-finder') {
            const query: Record<string, string> = {}
            const date = params.date
            const resourceId = params.resourceId

            if (date) {
               query.date = date
            }

            if (resourceId) {
               query.resourceId = resourceId
            }

            await router.replace({ name: 'booking-create', query })
         }

         if (view === 'booking-edit') {
            const query: Record<string, string> = {}
            const bookingId = params.bookingId

            if (bookingId) {
               query.bookingId = bookingId
            }

            await router.replace({ name: 'booking-edit', query })
         }
      } catch (error) {
         initError.value = error instanceof Error ? error.message : String(error)
      }
   })
</script>

<template>
   <div v-if="initError"
        class="mx-auto max-w-xl px-4 py-10 text-center text-red-600">
      {{ initError }}
   </div>
   <div v-else-if="!ready"
        class="mx-auto max-w-xl px-4 py-10 text-center text-slate-500">
      Loading Bitrix24...
   </div>
   <RouterView v-else />
</template>
