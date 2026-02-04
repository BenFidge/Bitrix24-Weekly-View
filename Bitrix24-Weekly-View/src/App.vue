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

   onMounted(async () => {
      try {
         await bitrix24Api.init()
         const placementInfo = await bitrix24Api.getPlacementInfo()
         if (placementInfo?.placement === 'LEFT_MENU') {
            const currentUrl = new URL(window.location.href)
            const isSlider = currentUrl.searchParams.get('IFRAME') === 'Y'
               || currentUrl.searchParams.get('IFRAME_TYPE') === 'SIDE_SLIDER'

            if (window.top && window.top !== window.self && isSlider) {
               currentUrl.searchParams.delete('IFRAME')
               currentUrl.searchParams.delete('IFRAME_TYPE')
               window.top.location.href = currentUrl.toString()
               return
            }
         }
         ready.value = true

         const placementOptions = placementInfo?.options ?? {}
         const viewParam = getQueryValue(route.query.view)
            ?? (typeof placementOptions.view === 'string' ? placementOptions.view : undefined)
         if (viewParam === 'slot-finder') {
            const query: Record<string, string> = {}
            const date = getQueryValue(route.query.date)
               ?? (typeof placementOptions.date === 'string' ? placementOptions.date : undefined)
            const resourceId = getQueryValue(route.query.resourceId)
               ?? (typeof placementOptions.resourceId === 'string'
                  ? placementOptions.resourceId
                  : typeof placementOptions.resourceId === 'number'
                     ? String(placementOptions.resourceId)
                     : undefined)
            const bookingId = getQueryValue(route.query.bookingId)
               ?? (typeof placementOptions.bookingId === 'string'
                  ? placementOptions.bookingId
                  : typeof placementOptions.bookingId === 'number'
                     ? String(placementOptions.bookingId)
                     : undefined)

            if (date) {
               query.date = date
            }

            if (resourceId) {
               query.resourceId = resourceId
            }

            if (bookingId) {
               query.bookingId = bookingId
            }

            await router.replace({ name: 'slot-finder', query })
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
