<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { bookingService } from '../services/bookingService'
import { slotService, type TimeSlot } from '../services/slotService'
import { bitrix24Api } from '../services/bitrix24Api'
import { resourceService } from '../services/resourceService'
import type { Resource } from '../models/resource.model'

const props = defineProps<{
  mode: 'create' | 'edit'
  bookingId?: string
  resourceId?: string | number
  date?: string
}>()

const loading = ref(true)
const saving = ref(false)

const form = ref({
  date: '',
  resources: [] as number[],
  leadName: '',
  clientId: null as number | null,
  phone: '',
  email: '',
  ages: ['', '', '', ''],
  slot: ''
})

const resources = ref<Resource[]>([])
const slots = ref<TimeSlot[]>([])

const loadResources = async (allowDefault: boolean) => {
  resources.value = await resourceService.getActiveResources()
  if (allowDefault && form.value.resources.length === 0 && resources.value.length > 0) {
    form.value.resources = [resources.value[0].id]
  }
}

onMounted(async () => {
  const baseWidth = (() => {
    try {
      return window.top && window.top !== window ? window.top.innerWidth : window.innerWidth
    } catch {
      return window.innerWidth
    }
  })()
  const baseHeight = (() => {
    try {
      return window.top && window.top !== window ? window.top.innerHeight : window.innerHeight
    } catch {
      return window.innerHeight
    }
  })()

  const width = Math.max(360, Math.floor(baseWidth * 0.25))
  const height = Math.max(500, Math.floor(baseHeight * 0.9))
  void bitrix24Api.resizeWindow(width, height)

  try {
    if (props.mode === 'create') {
      if (props.date) {
        form.value.date = String(props.date)
      }
      if (props.resourceId !== undefined && props.resourceId !== null && String(props.resourceId).length > 0) {
        const parsed = Number(props.resourceId)
        if (!Number.isNaN(parsed)) {
          form.value.resources = [parsed]
        }
      }
    }

    await loadResources(props.mode === 'create')

    if (props.mode === 'edit' && props.bookingId && props.bookingId !== 'undefined') {
      const booking = await bookingService.getBooking(props.bookingId)
      const bookingDate = booking.DATE_FROM ?? booking.dateFrom ?? booking.date
      const dateValue = bookingDate ? new Date(bookingDate).toISOString().split('T')[0] : ''
      form.value.date = dateValue

      const bookingResources = booking.RESOURCE_IDS ?? booking.resourceIds ?? booking.resources
      if (Array.isArray(bookingResources)) {
        form.value.resources = bookingResources.map((id: string | number) => Number(id))
      } else if (booking.RESOURCE_ID ?? booking.resourceId) {
        form.value.resources = [Number(booking.RESOURCE_ID ?? booking.resourceId)]
      }

      const startTime = booking.DATE_FROM ?? booking.dateFrom
      if (startTime) {
        const timeValue = new Date(startTime).toISOString().split('T')[1]?.slice(0, 5)
        if (timeValue) {
          form.value.slot = timeValue
        }
      }

      form.value.leadName = booking.CLIENT_NAME ?? booking.client?.name ?? ''
      form.value.phone = booking.CLIENT_PHONE ?? booking.client?.phone ?? ''
      form.value.email = booking.CLIENT_EMAIL ?? booking.client?.email ?? ''
      form.value.clientId = booking.CLIENT_ID ? Number(booking.CLIENT_ID) : form.value.clientId
    }

    if (form.value.date && form.value.resources.length > 0) {
      await loadSlots()
    }
  } finally {
    loading.value = false
  }
})

const loadSlots = async () => {
  if (!form.value.date || form.value.resources.length === 0) {
    slots.value = []
    return
  }

  const dateValue = new Date(form.value.date)
  slots.value = await slotService.getAvailableSlots(
    form.value.resources,
    dateValue
  )
}

const selectContact = async () => {
  const items = await bitrix24Api.selectCRM(['contact', 'lead'])
  const selected = items[0]
  if (selected) {
    form.value.leadName = selected.title
    const selectedId = Number(selected.id)
    form.value.clientId = Number.isNaN(selectedId) ? null : selectedId
  }
}

const save = async () => {
  saving.value = true
  try {
    const selectedSlot = slots.value.find(slot => slot.startTime === form.value.slot)
    const resourceId = form.value.resources[0]
    if (!selectedSlot || !resourceId || !form.value.date) {
      return
    }

    const dateFrom = `${form.value.date}T${selectedSlot.startTime}:00`
    const dateTo = `${form.value.date}T${selectedSlot.endTime}:00`
    const payload = {
      resourceId,
      dateFrom,
      dateTo,
      clientId: form.value.clientId ?? undefined
    }

    if (props.mode === 'create') {
      await bookingService.createBookingViaApi(payload)
    } else {
      await bookingService.updateBookingViaApi(props.bookingId!, payload)
    }
    await bitrix24Api.closeApplication()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="loading" class="p-6">Loading booking form…</div>

  <div v-else class="booking-form">
    <header class="booking-form__header">
      <h2>{{ mode === 'create' ? 'Add Booking' : 'Edit Booking' }}</h2>
      <p class="booking-form__subtitle">Complete the details to reserve the selected resource.</p>
    </header>

    <div class="booking-form__body">
      <section class="booking-form__section">
        <h3>Schedule</h3>
        <label class="booking-form__field">
          <span>Date</span>
          <input type="date" class="booking-form__input" v-model="form.date" @change="loadSlots" />
        </label>
      </section>

      <section class="booking-form__section">
        <h3>Resources</h3>
        <p class="booking-form__hint">Choose one or more resources for this booking.</p>
        <div class="booking-form__resource-list">
          <label v-for="resource in resources" :key="resource.id" class="booking-form__resource-item">
            <input
              type="checkbox"
              :value="resource.id"
              v-model="form.resources"
              @change="loadSlots"
            />
            <span>{{ resource.name }}</span>
          </label>
        </div>
      </section>

      <section class="booking-form__section">
        <h3>Available slots</h3>
        <label class="booking-form__field">
          <span>Slots</span>
          <select class="booking-form__select" v-model="form.slot">
            <option v-for="s in slots" :key="s.startTime" :value="s.startTime">
              {{ s.startTime }} - {{ s.endTime }}
            </option>
          </select>
        </label>
      </section>

      <section class="booking-form__section">
        <h3>Client details</h3>
        <label class="booking-form__field">
          <span>Lead name</span>
          <input class="booking-form__input" v-model="form.leadName" />
        </label>
        <button type="button" class="booking-form__button is-secondary" @click="selectContact">
          Select Contact/Lead
        </button>
        <label class="booking-form__field">
          <span>Phone</span>
          <input class="booking-form__input" v-model="form.phone" />
        </label>
        <label class="booking-form__field">
          <span>Email</span>
          <input class="booking-form__input" v-model="form.email" />
        </label>
      </section>

      <section class="booking-form__section">
        <h3>Other student ages</h3>
        <div class="booking-form__ages">
          <div class="booking-form__age-row" v-for="(_, i) in form.ages" :key="i">
            <input class="booking-form__input" v-model="form.ages[i]" />
          </div>
        </div>
      </section>
    </div>

    <footer class="booking-form__footer">
      <div class="booking-form__actions">
        <button class="booking-form__button is-primary" :disabled="saving" @click="save">
          {{ saving ? 'Saving…' : 'Save booking' }}
        </button>
      </div>
    </footer>
  </div>
</template>
