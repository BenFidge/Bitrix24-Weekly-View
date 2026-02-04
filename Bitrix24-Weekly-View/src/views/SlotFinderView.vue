<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useSlotFinder } from '../composables/useSlotFinder';
import { bookingService } from '../services/bookingService';
import { contactService, type Contact } from '../services/contactService';
import { bitrix24Api } from '../services/bitrix24Api';
import type { TimeSlot } from '../services/slotService';

const route = useRoute();

const getQueryValue = (value: unknown): string | undefined => {
    if (Array.isArray(value)) {
        return value[0];
    }

    if (typeof value === 'string') {
        return value;
    }

    return undefined;
};

const parseDate = (value?: string): Date | undefined => {
    if (!value) {
        return undefined;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return undefined;
    }

    return parsed;
};

const initialDate = parseDate(getQueryValue(route.query.date)) ?? new Date();
const initialResourceIdValue = getQueryValue(route.query.resourceId);
const initialResourceId = initialResourceIdValue ? Number.parseInt(initialResourceIdValue, 10) : undefined;
const bookingIdValue = getQueryValue(route.query.bookingId);
const initialBookingId = bookingIdValue ? Number.parseInt(bookingIdValue, 10) : undefined;

const {
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
    toggleResource
} = useSlotFinder({
    initialDate,
    initialResourceIds: initialResourceId ? [initialResourceId] : undefined,
    bookingId: Number.isNaN(initialBookingId ?? NaN) ? undefined : initialBookingId
});

const leadName = ref('');
const leadPhone = ref('');
const leadEmail = ref('');
const otherStudentAges = ref<Array<number | ''>>([]);
const selectedContact = ref<Contact | null>(null);
const selectedSlot = ref<TimeSlot | null>(null);
const bookingResourceId = ref<number | null>(initialResourceId ?? null);
const saving = ref(false);
const saveError = ref('');
const saveSuccess = ref('');

const availableResourceOptions = computed(() =>
    resources.value.filter(resource => selectedResourceIds.value.includes(resource.id))
);

const canAddStudentAge = computed(() => otherStudentAges.value.length < 4);

const resolveBookingResourceId = (slot: TimeSlot): number | null => {
    if (bookingResourceId.value && slot.resourceIds.includes(bookingResourceId.value)) {
        return bookingResourceId.value;
    }

    const nextResourceId = slot.resourceIds[0] ?? null;
    bookingResourceId.value = nextResourceId;
    return nextResourceId;
};

const selectSlot = (slot: TimeSlot) => {
    selectedSlot.value = slot;
    resolveBookingResourceId(slot);
};

const addStudentAge = () => {
    if (!canAddStudentAge.value) {
        return;
    }

    otherStudentAges.value = [...otherStudentAges.value, ''];
};

const removeStudentAge = (index: number) => {
    otherStudentAges.value = otherStudentAges.value.filter((_, idx) => idx !== index);
};

const handleContactSelect = async () => {
    try {
        const items = await bitrix24Api.selectCRM(['contact']);
        const contactItem = items?.[0];
        if (!contactItem?.id) {
            return;
        }

        const contactId = Number.parseInt(contactItem.id, 10);
        if (!Number.isNaN(contactId)) {
            const contact = await contactService.getContact(contactId);
            if (contact) {
                selectedContact.value = contact;
                leadName.value = contact.name;
                leadPhone.value = contact.phone ?? '';
                leadEmail.value = contact.email ?? '';
            }
        }
    } catch (err) {
        console.error('[SlotFinder] Failed to open contact selector:', err);
    }
};

const resolveContact = async (): Promise<Contact | null> => {
    if (selectedContact.value) {
        return selectedContact.value;
    }

    const query = leadPhone.value || leadEmail.value || leadName.value;
    if (!query) {
        return null;
    }

    const matches = await contactService.searchContacts(query, 5);
    const exactMatch = matches.find(match =>
        (leadPhone.value && match.phone === leadPhone.value) ||
        (leadEmail.value && match.email === leadEmail.value)
    );

    if (exactMatch) {
        return exactMatch;
    }

    const nameParts = leadName.value.trim().split(' ');
    const firstName = nameParts.shift() ?? leadName.value;
    const lastName = nameParts.join(' ');

    return contactService.createContact({
        firstName: firstName || 'Student',
        lastName,
        phone: leadPhone.value || undefined,
        email: leadEmail.value || undefined
    });
};

const buildNotes = () => {
    const ages = otherStudentAges.value.filter(age => age !== '' && age !== null);
    if (ages.length === 0) {
        return undefined;
    }

    return `Other student ages: ${ages.join(', ')}`;
};

const saveBooking = async () => {
    saveError.value = '';
    saveSuccess.value = '';

    if (!selectedSlot.value) {
        saveError.value = 'Select an available slot first.';
        return;
    }

    const resourceId = resolveBookingResourceId(selectedSlot.value);
    if (!resourceId) {
        saveError.value = 'Select a resource for this booking.';
        return;
    }

    saving.value = true;

    const dateStr = formattedDate.value;
    const dateFrom = `${dateStr}T${selectedSlot.value.startTime}:00`;
    const dateTo = `${dateStr}T${selectedSlot.value.endTime}:00`;
    const notes = buildNotes();

    try {
        let activeBookingId = bookingId.value ?? null;
        if (activeBookingId) {
            await bookingService.updateBookingViaApi(activeBookingId, {
                resourceId,
                dateFrom,
                dateTo,
                notes
            });
        } else {
            const created = await bookingService.createBookingViaApi({
                resourceId,
                dateFrom,
                dateTo,
                notes
            });
            if (created?.id) {
                bookingId.value = created.id;
                activeBookingId = created.id;
            }
        }

        if (activeBookingId) {
            const contact = await resolveContact();
            if (contact) {
                await bookingService.setBookingClient(activeBookingId, contact.id, 'contact');
            }
        }

        saveSuccess.value = bookingId.value ? 'Booking updated.' : 'Booking created.';
    } catch (err) {
        saveError.value = err instanceof Error ? err.message : 'Failed to save booking.';
    } finally {
        saving.value = false;
    }
};

watch(selectedResourceIds, () => {
    if (selectedResourceIds.value.length === 0) {
        bookingResourceId.value = null;
    } else if (!bookingResourceId.value || !selectedResourceIds.value.includes(bookingResourceId.value)) {
        bookingResourceId.value = selectedResourceIds.value[0] ?? null;
    }
});

onMounted(async () => {
    await loadResources();

    if (initialResourceId && !selectedResourceIds.value.includes(initialResourceId)) {
        selectedResourceIds.value = [initialResourceId];
    }

    if (bookingId.value) {
        const booking = await bookingService.getBooking(bookingId.value);
        if (booking) {
            date.value = booking.dateFrom;
            if (!selectedResourceIds.value.includes(booking.resourceId)) {
                selectedResourceIds.value = [booking.resourceId];
            }
            bookingResourceId.value = booking.resourceId;
            leadName.value = booking.clientName || '';
            leadPhone.value = booking.clientPhone || '';

            if (booking.clientId) {
                const contact = await contactService.getContact(booking.clientId);
                if (contact) {
                    selectedContact.value = contact;
                    leadEmail.value = contact.email ?? leadEmail.value;
                }
            }
        }
    }

    await loadSlots();
});
</script>

<template>
    <div class="slot-finder">
        <header class="slot-finder__header">
            <h1>Add / Edit Booking</h1>
            <p>Select resources, date, and an available slot.</p>
        </header>

        <section class="slot-finder__panel">
            <h2>Resources</h2>
            <div class="slot-finder__resources">
                <label v-for="resource in resources"
                       :key="resource.id"
                       class="slot-finder__resource">
                    <input type="checkbox"
                           :value="resource.id"
                           :checked="selectedResourceIds.includes(resource.id)"
                           @change="toggleResource(resource.id)" />
                    <span>{{ resource.name }}</span>
                </label>
            </div>
        </section>

        <section class="slot-finder__panel">
            <h2>Date</h2>
            <input type="date"
                   :value="formattedDate"
                   class="slot-finder__input"
                   @change="selectDate(($event.target as HTMLInputElement).value)" />
        </section>

        <section class="slot-finder__panel">
            <h2>Lead Student</h2>
            <div class="slot-finder__field">
                <label>Name</label>
                <input v-model="leadName" class="slot-finder__input" placeholder="Lead student name" />
            </div>
            <div class="slot-finder__field">
                <label>Phone</label>
                <input v-model="leadPhone" class="slot-finder__input" placeholder="Phone number" />
            </div>
            <div class="slot-finder__field">
                <label>Email</label>
                <input v-model="leadEmail" class="slot-finder__input" placeholder="Email address" />
            </div>
            <button type="button" class="slot-finder__button" @click="handleContactSelect">
                Select Contact
            </button>
            <p v-if="selectedContact" class="slot-finder__hint">
                Linked contact: {{ selectedContact.name }}
            </p>
        </section>

        <section class="slot-finder__panel">
            <h2>Other Student Ages (max 4)</h2>
            <div class="slot-finder__ages">
                <div v-for="(age, index) in otherStudentAges" :key="index" class="slot-finder__age-row">
                    <input v-model.number="otherStudentAges[index]"
                           type="number"
                           min="1"
                           max="120"
                           class="slot-finder__input"
                           placeholder="Age" />
                    <button type="button" class="slot-finder__button slot-finder__button--ghost" @click="removeStudentAge(index)">
                        Remove
                    </button>
                </div>
                <button type="button"
                        class="slot-finder__button"
                        :disabled="!canAddStudentAge"
                        @click="addStudentAge">
                    Add Student Age
                </button>
            </div>
        </section>

        <section class="slot-finder__panel">
            <h2>Available Slots</h2>
            <div class="slot-finder__field">
                <label>Booking Resource</label>
                <select v-model.number="bookingResourceId" class="slot-finder__input">
                    <option v-for="resource in availableResourceOptions" :key="resource.id" :value="resource.id">
                        {{ resource.name }}
                    </option>
                </select>
            </div>

            <div v-if="loading" class="slot-finder__hint">Loading slots...</div>
            <div v-else-if="error" class="slot-finder__error">{{ error }}</div>
            <div v-else class="slot-finder__slots">
                <button v-for="slot in slots"
                        :key="`${slot.startTime}-${slot.endTime}`"
                        type="button"
                        class="slot-finder__slot"
                        :class="{ 'is-selected': selectedSlot?.startTime === slot.startTime && selectedSlot?.endTime === slot.endTime }"
                        :disabled="!slot.available"
                        @click="selectSlot(slot)">
                    <div class="slot-finder__slot-time">
                        {{ slot.startTime }} - {{ slot.endTime }}
                    </div>
                    <div class="slot-finder__slot-resources">
                        Available: {{ resources.filter(resource => slot.resourceIds.includes(resource.id)).map(resource => resource.name).join(', ') || 'N/A' }}
                    </div>
                </button>
            </div>
        </section>

        <section class="slot-finder__panel slot-finder__panel--actions">
            <button type="button" class="slot-finder__button slot-finder__button--primary" :disabled="saving" @click="saveBooking">
                {{ bookingId ? 'Update Booking' : 'Create Booking' }}
            </button>
            <p v-if="saveError" class="slot-finder__error">{{ saveError }}</p>
            <p v-if="saveSuccess" class="slot-finder__success">{{ saveSuccess }}</p>
        </section>
    </div>
</template>

<style scoped>
.slot-finder {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 24px;
    max-width: 960px;
    margin: 0 auto;
    color: #1f2937;
}

.slot-finder__header h1 {
    margin: 0 0 6px;
    font-size: 24px;
}

.slot-finder__header p {
    margin: 0;
    color: #6b7280;
}

.slot-finder__panel {
    background: #ffffff;
    border-radius: 12px;
    padding: 16px 20px;
    box-shadow: 0 1px 6px rgba(15, 23, 42, 0.08);
}

.slot-finder__panel h2 {
    margin: 0 0 12px;
    font-size: 18px;
}

.slot-finder__resources {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 20px;
}

.slot-finder__resource {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
}

.slot-finder__field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 12px;
}

.slot-finder__input {
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid #d1d5db;
    font-size: 14px;
}

.slot-finder__button {
    border: 1px solid #cbd5f5;
    background: #f8fafc;
    padding: 8px 14px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    transition: background 0.2s ease;
}

.slot-finder__button:hover {
    background: #eef2ff;
}

.slot-finder__button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.slot-finder__button--primary {
    background: #2563eb;
    border-color: #2563eb;
    color: #ffffff;
}

.slot-finder__button--primary:hover {
    background: #1d4ed8;
}

.slot-finder__button--ghost {
    background: transparent;
    border-color: transparent;
    color: #6b7280;
}

.slot-finder__ages {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.slot-finder__age-row {
    display: flex;
    gap: 12px;
    align-items: center;
}

.slot-finder__slots {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
}

.slot-finder__slot {
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 12px;
    background: #f9fafb;
    text-align: left;
}

.slot-finder__slot.is-selected {
    border-color: #2563eb;
    background: #eff6ff;
}

.slot-finder__slot-time {
    font-weight: 600;
    margin-bottom: 4px;
}

.slot-finder__slot-resources {
    font-size: 12px;
    color: #6b7280;
}

.slot-finder__hint {
    font-size: 13px;
    color: #6b7280;
}

.slot-finder__error {
    color: #b91c1c;
    margin-top: 8px;
}

.slot-finder__success {
    color: #047857;
    margin-top: 8px;
}

.slot-finder__panel--actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
</style>
