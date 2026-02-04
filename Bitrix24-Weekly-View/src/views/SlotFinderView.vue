<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { BookingFormComponent } from '../components/booking-form';
import { cultureService } from '../services/cultureService';
import { resourceService } from '../services/resourceService';

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

const getDateValue = (): Date => {
    const dateValue = getQueryValue(route.query.date);
    if (!dateValue) {
        return new Date();
    }

    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) {
        return new Date();
    }

    return parsed;
};

onMounted(async () => {
    if (!host.value) {
        return;
    }

    const [resources, culture] = await Promise.all([
        resourceService.getActiveResources(),
        cultureService.getCultureSettings()
    ]);

    const resourceIdValue = getQueryValue(route.query.resourceId);
    const preselectedResourceId = resourceIdValue ? Number.parseInt(resourceIdValue, 10) : undefined;

    bookingForm = new BookingFormComponent({
        date: getDateValue(),
        resources,
        locale: culture.locale,
        preselectedResourceId: Number.isNaN(preselectedResourceId ?? NaN) ? undefined : preselectedResourceId,
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
