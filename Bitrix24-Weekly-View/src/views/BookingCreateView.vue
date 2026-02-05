<script setup lang="ts">
import { useRoute } from 'vue-router'
import BookingForm from '../components/BookingForm.vue'

const route = useRoute()

const getQueryValue = (value: unknown): string | undefined => {
  if (Array.isArray(value)) return value[0]
  if (typeof value === 'string' && value.length > 0) return value
  return undefined
}

const resourceId = getQueryValue(route.query.resourceId)
const date = getQueryValue(route.query.date)
</script>

<template>
   <BookingForm
      mode="create"
      :resourceId="resourceId"
      :date="date"
   />
</template>
