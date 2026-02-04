<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { WeeklyViewComponent } from '../components/weekly-view';

const weeklyContainer = ref<HTMLElement | null>(null);
let weeklyView: WeeklyViewComponent | null = null;

const handlers = {
    onViewModeChange: (mode) => {
        if (mode === 'daily') {
            window.location.href = '/booking/';
        }
    }
};

onMounted(async () => {
    if (!weeklyContainer.value) {
        return;
    }

    weeklyView = new WeeklyViewComponent({
        container: weeklyContainer.value,
        ...handlers
    });

    await weeklyView.init();
});

onUnmounted(() => {
    if (weeklyView) {
        weeklyView.destroy();
        weeklyView = null;
    }
});
</script>

<template>
    <div ref="weeklyContainer" class="weekly-view-host" />
</template>

<style scoped>
.weekly-view-host {
    min-height: 600px;
}
</style>
