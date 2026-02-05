<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BookingForm from '../components/BookingForm.vue';
import { cultureService } from '../services/cultureService';
import { resourceService } from '../services/resourceService';
import { bitrix24Api } from '../services/bitrix24Api';
import type { Resource } from '../models/resource.model';

const route = useRoute();
const router = useRouter();

const resources = ref<Resource[]>([]);
const locale = ref('en');

const getQueryValue = (value: unknown): string | undefined => {
    if (Array.isArray(value)) {
        return value[0];
    }

    if (typeof value === 'string') {
        return value;
    }

    return undefined;
};

const dateValue = computed((): Date => {
    const dateValue = getQueryValue(route.query.date);
    if (!dateValue) {
        return new Date();
    }

    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) {
        return new Date();
    }

    return parsed;
});

const preselectedResourceId = computed(() => {
    const resourceIdValue = getQueryValue(route.query.resourceId);
    const parsed = resourceIdValue ? Number.parseInt(resourceIdValue, 10) : NaN;
    return Number.isNaN(parsed) ? undefined : parsed;
});

onMounted(async () => {
    // When this view is opened in a SidePanel slider, request a wider iframe.
    // (If we were opened via BX.SidePanel.Instance.open, that width controls the slider.)
    try {
        await bitrix24Api.resizeWindow(900, 850);
    } catch {
        // ignore
    }

    const [loadedResources, culture] = await Promise.all([
        resourceService.getActiveResources(),
        cultureService.getCultureSettings()
    ]);

    resources.value = loadedResources;
    locale.value = culture.locale;
});

const onSuccess = async () => {
    // After save, go back to weekly view
    await router.replace({ name: 'weekly-view' });
};

const onCancel = async () => {
    await router.replace({ name: 'weekly-view' });
};
</script>

<template>
    <BookingForm
        v-if="resources.length"
        mode="create"
        :resources="resources"
        :locale="locale"
        :date="dateValue"
        :preselected-resource-id="preselectedResourceId"
        @success="onSuccess"
        @cancel="onCancel"
    />
    <div v-else class="p-4 text-slate-500">Loading…</div>
</template>
