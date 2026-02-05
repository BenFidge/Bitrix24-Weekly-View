<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BookingForm from '../components/BookingForm.vue';
import { cultureService } from '../services/cultureService';
import { resourceService } from '../services/resourceService';
import { bookingService } from '../services/bookingService';
import { bitrix24Api } from '../services/bitrix24Api';
import type { Resource } from '../models/resource.model';
import type { Booking } from '../models/booking.model';

const route = useRoute();
const router = useRouter();

const resources = ref<Resource[]>([]);
const locale = ref('en');
const booking = ref<Booking | null>(null);

const getQueryValue = (value: unknown): string | undefined => {
    if (Array.isArray(value)) {
        return value[0];
    }

    if (typeof value === 'string') {
        return value;
    }

    return undefined;
};

const bookingId = computed(() => {
    const value = getQueryValue(route.query.bookingId);
    if (!value) {
        return null;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
});

onMounted(async () => {
    // When this view is opened in a SidePanel slider, request a wider iframe.
    try {
        await bitrix24Api.resizeWindow(900, 850);
    } catch {
        // ignore
    }

    const [loadedResources, culture, loadedBooking] = await Promise.all([
        resourceService.getActiveResources(),
        cultureService.getCultureSettings(),
        bookingId.value ? bookingService.getBooking(bookingId.value) : Promise.resolve(null)
    ]);

    resources.value = loadedResources;
    locale.value = culture.locale;
    booking.value = loadedBooking;
});

const onSuccess = async () => {
    await router.replace({ name: 'weekly-view' });
};

const onCancel = async () => {
    await router.replace({ name: 'weekly-view' });
};
</script>

<template>
    <BookingForm
        v-if="resources.length"
        mode="edit"
        :resources="resources"
        :locale="locale"
        :date="booking?.dateFrom ?? new Date()"
        :preselected-resource-id="booking?.resourceId"
        :booking-id="bookingId ?? undefined"
        :initial-booking="booking"
        @success="onSuccess"
        @cancel="onCancel"
    />
    <div v-else class="p-4 text-slate-500">Loading…</div>
</template>
