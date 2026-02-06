<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { bookingService } from '../services/bookingService'
import { resourceService } from '../services/resourceService'
import { cultureService } from '../services/cultureService'
import { bitrix24Api } from '../services/bitrix24Api'
import { openBookingCreateSlider, openBookingEditSlider } from '../utils/slider'

import type { Resource } from '../models/resource.model'
import type { WeeklyResourceBookings, Booking } from '../models/booking.model'
import type { WeekStartDay, TimeFormat } from '../models/config.model'

const loading = ref(true)
const error = ref<string | null>(null)

const currentDate = ref(new Date())

const locale = ref('en-US')
const timeFormat = ref<TimeFormat>('24h')
const weekStartsOn = ref<WeekStartDay>(1)

const resources = ref<Resource[]>([])
const weekly = ref<WeeklyResourceBookings[]>([])

const startOfWeek = (date: Date, startsOn: number) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)

  // JS: 0 = Sunday ... 6 = Saturday
  const day = d.getDay()
  // Convert Bitrix WeekStartDay (0..6) to JS
  const diff = (day - startsOn + 7) % 7
  d.setDate(d.getDate() - diff)
  return d
}

const addDays = (d: Date, days: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + days)
  return x
}

const weekStart = computed(() => startOfWeek(currentDate.value, Number(weekStartsOn.value)))
const weekDays = computed(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart.value, i)))

const rangeLabel = computed(() => {
  const from = weekDays.value[0]
  const to = weekDays.value[6]
  const fmt = new Intl.DateTimeFormat(locale.value, { month: 'short', day: 'numeric', year: 'numeric' })
  return `${fmt.format(from)} - ${fmt.format(to)}`
})

const dayHeader = (d: Date) => {
  const fmt = new Intl.DateTimeFormat(locale.value, { weekday: 'short', day: 'numeric' })
  return fmt.format(d)
}

const toIsoDate = (d: Date) => d.toISOString().slice(0, 10)

const load = async () => {
  loading.value = true
  error.value = null
  try {
    void bitrix24Api.fitWindow()

    const culture = await cultureService.getCultureSettings()
    locale.value = culture.locale ?? locale.value
    timeFormat.value = culture.timeFormat ?? timeFormat.value
    weekStartsOn.value = culture.weekStartsOn ?? weekStartsOn.value

    resources.value = await resourceService.getActiveResources()
    weekly.value = await bookingService.getWeeklyBookings(weekStart.value, resources.value, weekStartsOn.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

onMounted(load)

const prev = async () => {
  currentDate.value = addDays(currentDate.value, -7)
  await load()
}
const next = async () => {
  currentDate.value = addDays(currentDate.value, 7)
  await load()
}
const today = async () => {
  currentDate.value = new Date()
  await load()
}

const openCreate = async (date: Date, resourceId: number) => {
  await openBookingCreateSlider(resourceId, date)
}

const openEdit = async (booking: Booking) => {
  await openBookingEditSlider(booking.id)
}
</script>

<template>
  <div class="weekly-view-host">
    <B24Alert
      v-if="error"
      color="air-primary-alert"
      title="Failed to load bookings"
      :description="error"
      class="m-4"
    />
    <B24Alert
      v-else-if="loading"
      color="air-primary-warning"
      title="Loading…"
      description="Fetching resources and bookings."
      class="m-4"
    />

    <div v-else class="weekly-view">
      <div class="weekly-view__header">
        <div class="weekly-view__nav">
          <B24Button size="xs" color="air-secondary-no-accent" @click="prev">Prev</B24Button>
          <B24Button size="xs" color="air-secondary-no-accent" @click="next">Next</B24Button>
          <B24Button size="xs" color="air-secondary-no-accent" @click="today">Today</B24Button>
        </div>

        <div class="weekly-view__range">{{ rangeLabel }}</div>

        <div class="weekly-view__toggle">
          <B24Button size="xs" color="air-secondary-no-accent" disabled>Day</B24Button>
          <B24Button size="xs" color="air-primary" variant="outline" disabled>Week</B24Button>
        </div>
      </div>

      <!-- NOTE: We intentionally avoid B24TableWrapper here.
           In Bitrix24 iframe/Sandbox (SES lockdown), TableWrapper's DOM helpers can throw
           (e.g. querySelectorAll on undefined / clipboard copy helpers). We render a plain
           table and keep the look & feel via B24UI tokens + minimal CSS. -->
      <div class="weekly-view__grid">
        <div class="weekly-view__table-scroll">
          <table class="weekly-view__table">
            <thead>
              <tr>
                <th class="weekly-view__corner"></th>
                <th v-for="d in weekDays" :key="toIsoDate(d)">{{ dayHeader(d) }}</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="row in weekly" :key="row.resourceId">
                <th class="weekly-view__resource">
                  <div class="weekly-view__resource-content">
                    <div class="weekly-view__resource-name">{{ row.resourceName }}</div>
                  </div>
                </th>

                <td
                  v-for="day in row.days"
                  :key="toIsoDate(day.date)"
                  class="weekly-view__cell"
                  @click="day.bookings.length === 0 && openCreate(day.date, row.resourceId)"
                >
                  <div v-if="day.bookings.length === 0" class="weekly-view__empty">
                    <span class="weekly-view__empty-text">+</span>
                  </div>

                  <div v-else class="weekly-view__bookings">
                    <button
                      v-for="b in day.bookings"
                      :key="b.id"
                      type="button"
                      class="booking-pill"
                      @click.stop="openEdit(b)"
                      :title="b.clientName"
                    >
                      <div class="booking-pill__time">
                        {{ new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(b.dateFrom) }}
                        -
                        {{ new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(b.dateTo) }}
                      </div>
                      <div class="booking-pill__client">{{ b.clientName || 'Customer' }}</div>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.weekly-view__range {
  font-weight: 600;
}

.weekly-view__grid {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.9);
}

.weekly-view__table-scroll {
  overflow: auto;
  max-height: calc(100vh - 220px);
}

.weekly-view__table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}

.weekly-view__table thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: rgba(255, 255, 255, 0.95);
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  font-weight: 600;
}

.weekly-view__corner {
  position: sticky;
  left: 0;
  z-index: 3;
}

.weekly-view__resource {
  position: sticky;
  left: 0;
  z-index: 2;
  background: rgba(255, 255, 255, 0.95);
  padding: 10px 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  border-right: 1px solid rgba(0, 0, 0, 0.08);
  white-space: nowrap;
}

.weekly-view__cell {
  cursor: pointer;
  min-width: 140px;
  vertical-align: top;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  border-right: 1px solid rgba(0, 0, 0, 0.06);
}

.weekly-view__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 56px;
  opacity: 0.5;
}

.weekly-view__empty-text {
  font-size: 20px;
  line-height: 1;
}

.weekly-view__bookings {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.booking-pill {
  width: 100%;
  text-align: left;
  border-radius: 10px;
  padding: 8px 10px;
  background: var(--ui-color-bg-content-secondary);
  border: 1px solid var(--ui-color-design-outline-stroke);
}

.booking-pill:hover {
  border-color: var(--b24ui-border-color);
}

.booking-pill__time {
  font-weight: 600;
  font-size: 12px;
}

.booking-pill__client {
  opacity: 0.85;
  font-size: 12px;
}
</style>
