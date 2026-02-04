<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { BookingFormComponent } from '../components/booking-form';
import { cultureService } from '../services/cultureService';
import { resourceService } from '../services/resourceService';
import { bookingService } from '../services/bookingService';

const host = ref<HTMLElement | null>(null);
const route = useRoute();
let bookingForm: BookingFormComponent | null = null;

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
    if (!host.value) {
        return;
    }

    const [resources, culture, booking] = await Promise.all([
        resourceService.getActiveResources(),
        cultureService.getCultureSettings(),
        bookingId.value ? bookingService.getBooking(bookingId.value) : Promise.resolve(null)
    ]);

    bookingForm = new BookingFormComponent({
        mode: 'edit',
        bookingId: bookingId.value ?? undefined,
        initialBooking: booking,
        date: booking?.dateFrom ?? new Date(),
        resources,
        locale: culture.locale,
        preselectedResourceId: booking?.resourceId,
        onSuccess: () => undefined,
        onCancel: () => undefined
    });

    bookingForm.render(host.value);
});

onUnmounted(() => {
    bookingForm?.destroy();
    bookingForm = null;
});
</script>

<template>
    <div ref="host" class="min-h-screen" />
</template>
