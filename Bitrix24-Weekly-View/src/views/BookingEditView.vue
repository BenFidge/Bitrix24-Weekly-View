<script setup lang="ts">
import { useRoute } from 'vue-router'
import BookingForm from '../components/BookingForm.vue'

const route = useRoute()

const getQueryValue = (value: unknown): string | undefined => {
  if (Array.isArray(value)) return value[0]
  if (typeof value === 'string' && value.length > 0) return value
  return undefined
}

const bookingId = getQueryValue(route.query.bookingId)
</script>

<template>
   <BookingForm mode="edit" :bookingId="bookingId" />
</template>
