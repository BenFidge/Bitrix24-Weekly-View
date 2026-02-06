<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
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
const initError = ref<string | null>(null)

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

const slotItems = computed(() => {
  return slots.value.map(s => ({
    label: `${s.startTime} - ${s.endTime}${s.available ? '' : ' (busy)'}`,
    value: s.startTime,
    disabled: !s.available
  }))
})

const isResourceChecked = (id: number) => form.value.resources.includes(id)
const toggleResource = (id: number, checked: boolean) => {
  const set = new Set(form.value.resources)
  if (checked) set.add(id)
  else set.delete(id)
  form.value.resources = Array.from(set)
}


const loadResources = async (allowDefault: boolean) => {
  resources.value = await resourceService.getActiveResources()
  if (allowDefault && form.value.resources.length === 0 && resources.value.length > 0) {
    form.value.resources = [resources.value[0].id]
  }
}

onMounted(async () => {
  // Do NOT access window.top in a Bitrix iframe (cross-origin). The slider controls sizing.
  // A best-effort fit keeps the iframe content sized correctly.
  void bitrix24Api.fitWindow()

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
  } catch (e) {
    initError.value = e instanceof Error ? e.message : String(e)
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
  // Use the native Bitrix CRM selector dialog.
  const items = await bitrix24Api.selectCRM(['contact', 'company'])
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
    if (!selectedSlot || !selectedSlot.available || form.value.resources.length === 0 || !form.value.date) {
      return
    }

    const dateFrom = `${form.value.date}T${selectedSlot.startTime}:00`
    const dateTo = `${form.value.date}T${selectedSlot.endTime}:00`
    const payload = {
      resourceIds: form.value.resources,
      resourceId: form.value.resources[0],
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
  } catch (e) {
    initError.value = e instanceof Error ? e.message : String(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="booking-form">
    <B24Alert
      v-if="loading"
      color="air-primary-warning"
      title="Loading…"
      description="Loading booking form."
    />

    <B24Alert
      v-else-if="initError"
      color="air-primary-alert"
      title="Unable to load booking"
      :description="initError"
    />

    <B24Card v-else>
      <template #header>
        <div class="booking-form__header">
          <ProseH2>{{ modeTitle }}</ProseH2>
          <ProseP class="m-0">Complete the details to reserve the selected resource.</ProseP>
        </div>
      </template>

      <div class="booking-form__body">
        <section>
          <ProseH4>Schedule</ProseH4>

          <B24FormField label="Date" required>
            <B24InputDate v-model="form.date" />
          </B24FormField>

          <div class="booking-form__field">
            <ProseH4>Resources</ProseH4>
            <ProseP class="m-0">Choose one or more resources for this booking.</ProseP>

            <div class="booking-form__resource-list">
              <B24Checkbox
                v-for="r in resources"
                :key="r.id"
                :label="r.name"
                :model-value="isResourceChecked(r.id)"
                @update:modelValue="(v) => toggleResource(r.id, Boolean(v))"
              />
            </div>
          </div>

          <div class="booking-form__field">
            <ProseH4>Available slots</ProseH4>
            <B24FormField label="Slots">
              <B24Select
                v-model="form.slot"
                :items="slotItems"
                value-key="value"
                placeholder="Select a slot"
                class="w-[320px]"
              />
            </B24FormField>
            <ProseP class="m-0">
              Slots are available only when <strong>all selected resources</strong> are free.
            </ProseP>
          </div>
        </section>

        <section>
          <ProseH4>Customer</ProseH4>

          <B24FormField label="Customer" required>
            <B24Input v-model="form.leadName" placeholder="Customer name" />
          </B24FormField>

          <div class="booking-form__grid">
            <B24FormField label="Phone">
              <B24Input v-model="form.phone" placeholder="+66..." />
            </B24FormField>

            <B24FormField label="Email">
              <B24Input v-model="form.email" placeholder="name@example.com" />
            </B24FormField>
          </div>
        </section>

        <section>
          <ProseH4>Notes</ProseH4>
          <B24Textarea v-model="notes" placeholder="Notes (optional)" />
        </section>
      </div>

      <template #footer>
        <div class="booking-form__actions">
          <B24Button
            color="air-primary"
            :loading="saving"
            :disabled="saving"
            @click="submit"
          >
            {{ modeButtonText }}
          </B24Button>

          <B24Button
            color="air-secondary-no-accent"
            :disabled="saving"
            @click="cancel"
          >
            Cancel
          </B24Button>
        </div>
      </template>
    </B24Card>
  </div>
</template>

