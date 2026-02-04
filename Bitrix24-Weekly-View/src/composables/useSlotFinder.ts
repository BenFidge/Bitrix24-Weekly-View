import { computed, ref } from 'vue';
import { slotService, type TimeSlot } from '../services/slotService';
import { bookingService } from '../services/bookingService';
import { resourceService } from '../services/resourceService';
import type { Resource } from '../models/resource.model';

interface SlotFinderOptions {
    initialDate?: Date;
    initialResourceIds?: number[];
    bookingId?: number;
}

export function useSlotFinder(options: SlotFinderOptions = {}) {
    const date = ref(options.initialDate ?? new Date());
    const resources = ref<Resource[]>([]);
    const selectedResourceIds = ref<number[]>(options.initialResourceIds ?? []);
    const slots = ref<TimeSlot[]>([]);
    const loading = ref(false);
    const error = ref('');
    const bookingId = ref<number | null>(options.bookingId ?? null);

    const formattedDate = computed(() => date.value.toISOString().split('T')[0] ?? '');

    const loadResources = async () => {
        resources.value = await resourceService.getActiveResources();
        if (selectedResourceIds.value.length === 0) {
            selectedResourceIds.value = resources.value.slice(0, 1).map((resource: Resource) => resource.id);
        }
    };

    const loadSlots = async () => {
        loading.value = true;
        error.value = '';
        try {
            slots.value = await slotService.getAvailableSlots(selectedResourceIds.value, date.value);
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Failed to load slots.';
        } finally {
            loading.value = false;
        }
    };

    const selectDate = async (value: string) => {
        date.value = new Date(value);
        await loadSlots();
    };

    const toggleResource = async (resourceId: number) => {
        if (selectedResourceIds.value.includes(resourceId)) {
            selectedResourceIds.value = selectedResourceIds.value.filter((id: number) => id !== resourceId);
        } else {
            selectedResourceIds.value = [...selectedResourceIds.value, resourceId];
        }
        await loadSlots();
    };

    const saveBooking = async (slot: TimeSlot, resourceId: number) => {
        const dateStr = formattedDate.value;
        const dateFrom = `${dateStr}T${slot.startTime}:00`;
        const dateTo = `${dateStr}T${slot.endTime}:00`;

        if (bookingId.value) {
            return bookingService.updateBookingViaApi(bookingId.value, {
                resourceId,
                dateFrom,
                dateTo
            });
        }

        const created = await bookingService.createBookingViaApi({
            resourceId,
            dateFrom,
            dateTo
        });

        if (created?.id) {
            bookingId.value = created.id;
        }

        return Boolean(created?.id);
    };

    return {
        date,
        resources,
        selectedResourceIds,
        slots,
        loading,
        error,
        formattedDate,
        bookingId,
        loadResources,
        loadSlots,
        selectDate,
        toggleResource,
        saveBooking
    };
}
