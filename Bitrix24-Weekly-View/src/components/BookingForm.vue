<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { Resource } from '../models/resource.model'
import type { Booking } from '../models/booking.model'
import { slotService, type TimeSlot } from '../services/slotService'
import { bookingService } from '../services/bookingService'
import { bitrix24Api } from '../services/bitrix24Api'
import { contactService } from '../services/contactService'

type Mode = 'create' | 'edit'

const props = defineProps<{
  mode: Mode
  resources: Resource[]
  locale: string
  date: Date
  preselectedResourceId?: number
  bookingId?: number
  initialBooking?: Booking | null
}>()

const emit = defineEmits<{
  (e: 'success'): void
  (e: 'cancel'): void
}>()

// --- form state ---
const selectedResourceIds = ref<number[]>([])
const dayValue = ref<string>('')
const selectedSlot = ref<string>('') // "HH:mm"
const slotDurationMinutes = ref<number>(60)

const leadName = ref<string>('')
const leadPhone = ref<string>('')
const leadEmail = ref<string>('')
const otherAges = ref<string[]>(['', '', '', '']) // max 4 others

const selectedContactId = ref<number | null>(null)
const selectedContactTitle = ref<string>('')

const loadingSlots = ref(false)
const slots = ref<TimeSlot[]>([])
const saving = ref(false)
const errorMessage = ref<string | null>(null)

const dateLabel = computed(() => {
  try {
    return new Intl.DateTimeFormat(props.locale, { year: 'numeric', month: 'short', day: '2-digit' }).format(new Date(dayValue.value))
  } catch {
    return dayValue.value
  }
})

const slotOptions = computed(() => {
  const chosen = selectedResourceIds.value
  return slots.value.map(s => {
    const availableForChosen = chosen.length === 0
      ? s.resourceIds
      : s.resourceIds.filter(id => chosen.includes(id))

    const label = `${s.startTime} - ${s.endTime} (${availableForChosen.length} available)`
    return {
      value: s.startTime,
      label,
      availableResourceIds: availableForChosen
    }
  })
})

const canSave = computed(() => {
  return selectedResourceIds.value.length > 0
    && !!dayValue.value
    && !!selectedSlot.value
    && !!leadName.value.trim()
})

const buildNotes = (): string => {
  const ages = otherAges.value.map(a => a.trim()).filter(Boolean)
  const parts: string[] = []
  parts.push(`Lead: ${leadName.value.trim()}`)
  if (leadPhone.value.trim()) parts.push(`Phone: ${leadPhone.value.trim()}`)
  if (leadEmail.value.trim()) parts.push(`Email: ${leadEmail.value.trim()}`)
  if (ages.length) parts.push(`Other student ages: ${ages.join(', ')}`)
  return parts.join('\n')
}

const parseExistingNotes = (notes?: string) => {
  if (!notes) return
  // very light parsing (safe): attempt to populate lead fields if they look like our format
  const lines = notes.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  for (const line of lines) {
    if (line.toLowerCase().startsWith('lead:')) leadName.value = line.slice(5).trim()
    if (line.toLowerCase().startsWith('phone:')) leadPhone.value = line.slice(6).trim()
    if (line.toLowerCase().startsWith('email:')) leadEmail.value = line.slice(6).trim()
    if (line.toLowerCase().startsWith('other student ages:')) {
      const rest = line.split(':').slice(1).join(':').trim()
      const items = rest.split(',').map(x => x.trim()).filter(Boolean)
      for (let i = 0; i < 4; i++) otherAges.value[i] = items[i] ?? ''
    }
  }
}

const computeDateFromTo = (): { dateFrom: string; dateTo: string } => {
  const [hh, mm] = selectedSlot.value.split(':').map(n => Number(n))
  const start = new Date(dayValue.value)
  start.setHours(hh || 0, mm || 0, 0, 0)
  const end = new Date(start)
  end.setMinutes(end.getMinutes() + (slotDurationMinutes.value || 60))
  return { dateFrom: start.toISOString(), dateTo: end.toISOString() }
}

const refreshSlots = async () => {
  if (selectedResourceIds.value.length === 0 || !dayValue.value) {
    slots.value = []
    selectedSlot.value = ''
    return
  }

  loadingSlots.value = true
  try {
    slots.value = await slotService.getAvailableSlots(
      selectedResourceIds.value,
      new Date(dayValue.value),
      slotDurationMinutes.value
    )

    // auto-select: keep existing selection if still valid; else pick first available
    const stillValid = slots.value.find(s => s.startTime === selectedSlot.value && s.available)
    if (!stillValid) {
      const first = slots.value.find(s => s.available)
      selectedSlot.value = first?.startTime ?? ''
    }
  } catch (e) {
    console.error(e)
    slots.value = []
    selectedSlot.value = ''
  } finally {
    loadingSlots.value = false
  }
}

const pickContact = async () => {
  errorMessage.value = null
  try {
    const items = await bitrix24Api.selectCRM(['contact'])
    const first = items?.[0]
    if (!first) return
    selectedContactId.value = Number.parseInt(first.id, 10)
    selectedContactTitle.value = first.title ?? `Contact ${first.id}`
  } catch (e) {
    errorMessage.value = 'Could not open Contact selector. You can still enter phone/email and save.'
  }
}

const findOrCreateContact = async (): Promise<number | null> => {
  if (selectedContactId.value) return selectedContactId.value

  // Try to find existing by phone/email
  const phone = leadPhone.value.trim()
  const email = leadEmail.value.trim()
  const name = leadName.value.trim()

  const tryQuery = async (q: string) => {
    const results = await contactService.searchContacts(q, 10)
    // pick first strong match if possible
    if (phone) {
      const byPhone = results.find(r => (r.phone ?? '').replace(/\s+/g, '') === phone.replace(/\s+/g, ''))
      if (byPhone) return byPhone
    }
    if (email) {
      const byEmail = results.find(r => (r.email ?? '').toLowerCase() === email.toLowerCase())
      if (byEmail) return byEmail
    }
    return results[0] ?? null
  }

  let existing = null as Awaited<ReturnType<typeof tryQuery>>
  if (phone) existing = await tryQuery(phone)
  if (!existing && email) existing = await tryQuery(email)
  if (!existing && name) existing = await tryQuery(name)

  if (existing?.id) {
    // optionally update missing fields
    await contactService.updateContact(existing.id, { phone: phone || undefined, email: email || undefined })
    return existing.id
  }

  // Create new contact
  const parts = name.split(' ').filter(Boolean)
  const firstName = parts[0] ?? name
  const lastName = parts.slice(1).join(' ')
  const created = await contactService.createContact({
    firstName,
    lastName: lastName || undefined,
    phone: phone || undefined,
    email: email || undefined
  })

  return created?.id ?? null
}

const save = async () => {
  if (!canSave.value) {
    errorMessage.value = 'Please pick at least one resource, a slot, and enter lead student name.'
    return
  }

  saving.value = true
  errorMessage.value = null

  try {
    const { dateFrom, dateTo } = computeDateFromTo()
    const notes = buildNotes()

    if (props.mode === 'create') {
      // For now: create one booking on the first selected resource (Bitrix booking = one resource)
      const resourceId = selectedResourceIds.value[0]
      const created = await bookingService.createBooking({
        resourceId,
        dateFrom,
        dateTo,
        notes
      })
      if (!created?.id) throw new Error('Booking was not created (no ID returned).')

      const contactId = await findOrCreateContact()
      if (contactId) {
        await bookingService.setBookingClient(created.id, contactId, 'contact')
      }

      emit('success')
      return
    }

    // edit
    if (!props.bookingId) throw new Error('Missing bookingId for edit mode.')
    const ok = await bookingService.updateBookingViaApi(props.bookingId, {
      resourceId: selectedResourceIds.value[0],
      dateFrom,
      dateTo,
      notes
    })
    if (!ok) throw new Error('Booking update failed.')

    const contactId = await findOrCreateContact()
    if (contactId) {
      await bookingService.setBookingClient(props.bookingId, contactId, 'contact')
    }

    emit('success')
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : String(e)
  } finally {
    saving.value = false
  }
}

const cancel = () => emit('cancel')

onMounted(() => {
  dayValue.value = props.date.toISOString().split('T')[0] ?? new Date().toISOString().split('T')[0]!

  if (props.preselectedResourceId) {
    selectedResourceIds.value = [props.preselectedResourceId]
  } else {
    selectedResourceIds.value = []
  }

  if (props.initialBooking) {
    // prefill from booking
    if (props.initialBooking.resourceId) selectedResourceIds.value = [props.initialBooking.resourceId]
    dayValue.value = props.initialBooking.dateFrom.toISOString().split('T')[0] ?? dayValue.value
    selectedSlot.value = props.initialBooking.dateFrom.toISOString().substring(11, 16)
    parseExistingNotes(props.initialBooking.notes)
    // if booking has client fields, use them as defaults
    if (!leadName.value && props.initialBooking.clientName) leadName.value = props.initialBooking.clientName
    if (!leadPhone.value && props.initialBooking.clientPhone) leadPhone.value = props.initialBooking.clientPhone
  }
})

watch([selectedResourceIds, dayValue, slotDurationMinutes], () => {
  void refreshSlots()
})

</script>

<template>
  <div class="p-4" style="font-family: var(--ui-font-family-primary, system-ui, -apple-system, Segoe UI, Roboto, Arial)">
    <h2 class="text-xl font-semibold mb-3">
      {{ props.mode === 'edit' ? 'Edit Booking' : 'Add Booking' }}
    </h2>

    <div v-if="errorMessage" class="mb-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
      {{ errorMessage }}
    </div>

    <div class="grid gap-4" style="max-width: 720px">
      <!-- Resources -->
      <div>
        <div class="font-medium mb-2">Resources</div>
        <div class="grid gap-2" style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))">
          <label v-for="r in props.resources" :key="r.id" class="flex items-center gap-2 rounded border p-2">
            <input
              type="checkbox"
              :value="r.id"
              v-model="selectedResourceIds"
            />
            <span>{{ r.name }}</span>
          </label>
        </div>
        <div class="text-xs text-slate-500 mt-1">(For now we create/update the booking on the first selected resource.)</div>
      </div>

      <!-- Date -->
      <div>
        <div class="font-medium mb-2">Date</div>
        <div class="flex items-center gap-3">
          <input type="date" v-model="dayValue" class="rounded border px-3 py-2" />
          <div class="text-sm text-slate-600">{{ dateLabel }}</div>
        </div>
      </div>

      <!-- Slots -->
      <div>
        <div class="font-medium mb-2">Available slots</div>
        <div class="flex items-center gap-3 flex-wrap">
          <select v-model="selectedSlot" class="rounded border px-3 py-2" :disabled="loadingSlots || slotOptions.length === 0">
            <option value="" disabled>Select a slot</option>
            <option
              v-for="s in slotOptions"
              :key="s.value"
              :value="s.value"
            >{{ s.label }}</option>
          </select>

          <label class="flex items-center gap-2 text-sm">
            Duration
            <input type="number" min="15" step="15" v-model.number="slotDurationMinutes" class="w-24 rounded border px-2 py-2" />
            min
          </label>

          <span v-if="loadingSlots" class="text-sm text-slate-500">Loading slots…</span>
        </div>
      </div>

      <!-- Lead student -->
      <div>
        <div class="font-medium mb-2">Lead student</div>
        <div class="grid gap-3" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr))">
          <input v-model="leadName" placeholder="Full name" class="rounded border px-3 py-2" />
          <input v-model="leadPhone" placeholder="Phone" class="rounded border px-3 py-2" />
          <input v-model="leadEmail" placeholder="Email" class="rounded border px-3 py-2" />
        </div>

        <div class="mt-2 flex items-center gap-2">
          <button type="button" class="rounded border px-3 py-2" @click="pickContact">
            Select contact
          </button>
          <span v-if="selectedContactId" class="text-sm text-slate-600">
            Linked contact: {{ selectedContactTitle || ('Contact #' + selectedContactId) }}
          </span>
        </div>
      </div>

      <!-- Other students -->
      <div>
        <div class="font-medium mb-2">Other student ages (max 4)</div>
        <div class="grid gap-3" style="grid-template-columns: repeat(auto-fit, minmax(120px, 1fr))">
          <input v-for="(age, idx) in otherAges" :key="idx" v-model="otherAges[idx]" placeholder="Age" class="rounded border px-3 py-2" />
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-2">
        <button type="button" class="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50" :disabled="saving || !canSave" @click="save">
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
        <button type="button" class="rounded border px-4 py-2" :disabled="saving" @click="cancel">Cancel</button>
      </div>
    </div>
  </div>
</template>
