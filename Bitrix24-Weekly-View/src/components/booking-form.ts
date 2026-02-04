import type { Resource } from '../models/resource.model';
import type { Booking } from '../models/booking.model';
import { bookingService } from '../services/bookingService';
import { contactService, type Contact } from '../services/contactService';
import { slotService, type TimeSlot } from '../services/slotService';
import { bitrix24Api } from '../services/bitrix24Api';

export interface BookingFormOptions {
    mode: 'create' | 'edit';
    bookingId?: number;
    initialBooking?: Booking;
    date: Date | string;
    resources: Resource[];
    locale: string;
    preselectedResourceId?: number;
    onSuccess?: () => void;
    onCancel?: () => void;
}

interface BookingFormState {
    date: Date;
    selectedResourceIds: number[];
    selectedResourceId: number | null;
    selectedSlot: TimeSlot | null;
    leadName: string;
    leadPhone: string;
    leadEmail: string;
    contactEntityId: number | null;
    contactEntityType: 'contact' | 'lead' | 'company' | null;
    ages: string[];
    loadingSlots: boolean;
    saving: boolean;
    error: string;
}

interface BookingFormElements {
    dateInput?: HTMLInputElement;
    slotList?: HTMLDivElement;
    resourceList?: HTMLDivElement;
    resourceSelect?: HTMLSelectElement;
    leadNameInput?: HTMLInputElement;
    leadPhoneInput?: HTMLInputElement;
    leadEmailInput?: HTMLInputElement;
    agesList?: HTMLDivElement;
    addAgeButton?: HTMLButtonElement;
    statusText?: HTMLParagraphElement;
    saveButton?: HTMLButtonElement;
}

export class BookingFormComponent {
    private options: BookingFormOptions;
    private host: HTMLElement | null = null;
    private root: HTMLDivElement | null = null;
    private listeners: Array<{ target: EventTarget; type: string; handler: EventListenerOrEventListenerObject }> = [];
    private state: BookingFormState;
    private elements: BookingFormElements = {};
    private availableSlots: TimeSlot[] = [];

    constructor(options: BookingFormOptions) {
        this.options = options;
        this.state = this.buildInitialState();
    }

    render(host: HTMLElement): void {
        this.host = host;
        this.root = document.createElement('div');
        this.root.className = 'booking-form';

        const header = document.createElement('div');
        header.className = 'booking-form__header';

        const title = document.createElement('h2');
        title.textContent = this.options.mode === 'edit' ? 'Edit booking' : 'Create booking';

        const subtitle = document.createElement('p');
        subtitle.className = 'booking-form__subtitle';
        subtitle.textContent = 'Select resources, date, and an available time slot.';

        header.appendChild(title);
        header.appendChild(subtitle);

        const body = document.createElement('div');
        body.className = 'booking-form__body';

        body.appendChild(this.buildResourceSection());
        body.appendChild(this.buildDateSection());
        body.appendChild(this.buildLeadSection());
        body.appendChild(this.buildStudentAgesSection());
        body.appendChild(this.buildSlotSection());

        const footer = document.createElement('div');
        footer.className = 'booking-form__footer';

        const statusText = document.createElement('p');
        statusText.className = 'booking-form__status';
        this.elements.statusText = statusText;

        const actions = document.createElement('div');
        actions.className = 'booking-form__actions';

        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.textContent = 'Cancel';
        cancelButton.className = 'booking-form__button is-secondary';
        this.addListener(cancelButton, 'click', () => this.options.onCancel?.());

        const saveButton = document.createElement('button');
        saveButton.type = 'button';
        saveButton.textContent = this.options.mode === 'edit' ? 'Save changes' : 'Create booking';
        saveButton.className = 'booking-form__button is-primary';
        this.addListener(saveButton, 'click', () => void this.handleSave());
        this.elements.saveButton = saveButton;

        actions.appendChild(cancelButton);
        actions.appendChild(saveButton);

        footer.appendChild(statusText);
        footer.appendChild(actions);

        this.root.appendChild(header);
        this.root.appendChild(body);
        this.root.appendChild(footer);

        this.host.innerHTML = '';
        this.host.appendChild(this.root);

        if (this.state.ages.length > 0) {
            this.rebuildAges();
        }

        void this.loadSlots();
        void this.loadContactDetails();
        this.syncFormState();
    }

    destroy(): void {
        this.clearListeners();
        if (this.host) {
            this.host.innerHTML = '';
        }

        this.root = null;
        this.host = null;
    }

    private buildInitialState(): BookingFormState {
        const initialDate = typeof this.options.date === 'string'
            ? new Date(this.options.date)
            : new Date(this.options.date);

        const fallbackDate = Number.isNaN(initialDate.getTime()) ? new Date() : initialDate;
        const preselectedResourceIds = this.options.preselectedResourceId
            ? [this.options.preselectedResourceId]
            : this.options.resources.slice(0, 1).map(resource => resource.id);

        const initialBooking = this.options.initialBooking;
        const initialAges = initialBooking?.notes ? this.parseAgesFromNotes(initialBooking.notes) : [];

        const selectedResourceId = initialBooking?.resourceId
            ?? this.options.preselectedResourceId
            ?? preselectedResourceIds[0]
            ?? null;

        const selectedResourceIds = initialBooking?.resourceId
            ? [initialBooking.resourceId]
            : preselectedResourceIds;

        const selectedSlot = initialBooking
            ? {
                startTime: this.formatTime(initialBooking.dateFrom),
                endTime: this.formatTime(initialBooking.dateTo),
                available: true,
                resourceIds: [initialBooking.resourceId]
            }
            : null;

        return {
            date: initialBooking?.dateFrom ? new Date(initialBooking.dateFrom) : fallbackDate,
            selectedResourceIds: selectedResourceIds.filter(Boolean),
            selectedResourceId,
            selectedSlot,
            leadName: initialBooking?.clientName ?? '',
            leadPhone: initialBooking?.clientPhone ?? '',
            leadEmail: '',
            contactEntityId: initialBooking?.clientId ?? null,
            contactEntityType: initialBooking?.clientId ? 'contact' : null,
            ages: initialAges,
            loadingSlots: false,
            saving: false,
            error: ''
        };
    }

    private buildSection(titleText: string): HTMLDivElement {
        const section = document.createElement('div');
        section.className = 'booking-form__section';

        const title = document.createElement('h3');
        title.textContent = titleText;

        section.appendChild(title);
        return section;
    }

    private buildResourceSection(): HTMLDivElement {
        const section = this.buildSection('Resources');
        const list = document.createElement('div');
        list.className = 'booking-form__resource-list';
        this.elements.resourceList = list;

        for (const resource of this.options.resources) {
            const item = document.createElement('label');
            item.className = 'booking-form__resource-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = String(resource.id);
            checkbox.checked = this.state.selectedResourceIds.includes(resource.id);

            this.addListener(checkbox, 'change', () => {
                this.toggleResource(resource.id, checkbox.checked);
            });

            const name = document.createElement('span');
            name.textContent = resource.name;

            item.appendChild(checkbox);
            item.appendChild(name);
            list.appendChild(item);
        }

        section.appendChild(list);
        return section;
    }

    private buildDateSection(): HTMLDivElement {
        const section = this.buildSection('Date');
        const input = document.createElement('input');
        input.type = 'date';
        input.className = 'booking-form__input';
        input.value = this.toDateValue(this.state.date);

        this.addListener(input, 'change', () => {
            this.state.date = new Date(input.value);
            void this.loadSlots();
        });

        section.appendChild(input);
        this.elements.dateInput = input;
        return section;
    }

    private buildLeadSection(): HTMLDivElement {
        const section = this.buildSection('Lead student');

        const helper = document.createElement('p');
        helper.className = 'booking-form__hint';
        helper.textContent = 'Use the CRM selector to attach an existing contact, or enter details to create a new one.';
        section.appendChild(helper);

        const selectButton = document.createElement('button');
        selectButton.type = 'button';
        selectButton.className = 'booking-form__button is-secondary';
        selectButton.textContent = 'Select contact';
        this.addListener(selectButton, 'click', () => void this.handleContactSelect());

        section.appendChild(selectButton);

        const nameInput = this.createLabeledInput(section, 'Name', this.state.leadName);
        const phoneInput = this.createLabeledInput(section, 'Phone', this.state.leadPhone);
        const emailInput = this.createLabeledInput(section, 'Email', this.state.leadEmail, 'email');

        this.elements.leadNameInput = nameInput;
        this.elements.leadPhoneInput = phoneInput;
        this.elements.leadEmailInput = emailInput;

        this.addListener(nameInput, 'input', () => {
            this.state.leadName = nameInput.value;
            this.syncFormState();
        });
        this.addListener(phoneInput, 'input', () => {
            this.state.leadPhone = phoneInput.value;
            this.syncFormState();
        });
        this.addListener(emailInput, 'input', () => {
            this.state.leadEmail = emailInput.value;
            this.syncFormState();
        });

        return section;
    }

    private buildStudentAgesSection(): HTMLDivElement {
        const section = this.buildSection('Other student ages');

        const list = document.createElement('div');
        list.className = 'booking-form__ages';
        this.elements.agesList = list;

        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.className = 'booking-form__button is-secondary';
        addButton.textContent = 'Add age';
        this.addListener(addButton, 'click', () => this.addAgeField());

        this.elements.addAgeButton = addButton;

        section.appendChild(list);
        section.appendChild(addButton);

        return section;
    }

    private buildSlotSection(): HTMLDivElement {
        const section = this.buildSection('Available slots');

        const resourceSelect = document.createElement('select');
        resourceSelect.className = 'booking-form__select';
        this.elements.resourceSelect = resourceSelect;

        this.addListener(resourceSelect, 'change', () => {
            const selected = Number.parseInt(resourceSelect.value, 10);
            this.state.selectedResourceId = Number.isNaN(selected) ? null : selected;
            this.syncFormState();
        });

        const slotList = document.createElement('div');
        slotList.className = 'booking-form__slots';
        this.elements.slotList = slotList;

        section.appendChild(resourceSelect);
        section.appendChild(slotList);

        return section;
    }

    private createLabeledInput(
        container: HTMLElement,
        labelText: string,
        value: string,
        type: string = 'text'
    ): HTMLInputElement {
        const wrapper = document.createElement('label');
        wrapper.className = 'booking-form__field';

        const label = document.createElement('span');
        label.textContent = labelText;

        const input = document.createElement('input');
        input.type = type;
        input.className = 'booking-form__input';
        input.value = value;

        wrapper.appendChild(label);
        wrapper.appendChild(input);
        container.appendChild(wrapper);

        return input;
    }

    private addAgeField(): void {
        if (!this.elements.agesList) {
            return;
        }

        if (this.state.ages.length >= 5) {
            return;
        }

        const index = this.state.ages.length;
        this.state.ages.push('');

        const row = document.createElement('div');
        row.className = 'booking-form__age-row';
        row.dataset.index = String(index);

        const input = document.createElement('input');
        input.type = 'number';
        input.min = '1';
        input.max = '120';
        input.placeholder = 'Age';
        input.className = 'booking-form__input';

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.textContent = 'Remove';
        removeButton.className = 'booking-form__button is-tertiary';

        this.addListener(input, 'input', () => {
            this.state.ages[index] = input.value;
        });

        this.addListener(removeButton, 'click', () => {
            this.state.ages.splice(index, 1);
            row.remove();
            this.rebuildAges();
        });

        row.appendChild(input);
        row.appendChild(removeButton);

        this.elements.agesList.appendChild(row);
    }

    private rebuildAges(): void {
        if (!this.elements.agesList) {
            return;
        }

        this.elements.agesList.innerHTML = '';
        const ages = [...this.state.ages];
        this.state.ages = [];

        for (const age of ages) {
            this.addAgeField();
            const lastRow = this.elements.agesList.lastElementChild as HTMLDivElement | null;
            const input = lastRow?.querySelector('input');
            if (input) {
                input.value = age;
                this.state.ages[this.state.ages.length - 1] = age;
            }
        }
    }

    private async loadSlots(): Promise<void> {
        this.state.loadingSlots = true;
        this.syncStatus('Loading slots...');
        try {
            this.availableSlots = await slotService.getAvailableSlots(
                this.state.selectedResourceIds,
                this.state.date
            );
        } catch (error) {
            console.error('[BookingForm] Failed to load slots:', error);
            this.state.error = error instanceof Error ? error.message : 'Failed to load slots.';
        } finally {
            this.state.loadingSlots = false;
            this.renderSlots();
            this.syncFormState();
        }
    }

    private renderSlots(): void {
        if (!this.elements.slotList) {
            return;
        }

        this.elements.slotList.innerHTML = '';

        if (this.availableSlots.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'booking-form__hint';
            empty.textContent = 'No slots available for the selected resources.';
            this.elements.slotList.appendChild(empty);
            return;
        }

        for (const slot of this.availableSlots) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'booking-form__slot';
            button.textContent = `${slot.startTime} - ${slot.endTime}`;

            if (!slot.available) {
                button.disabled = true;
                button.classList.add('is-disabled');
            }

            if (this.state.selectedSlot
                && this.state.selectedSlot.startTime === slot.startTime
                && this.state.selectedSlot.endTime === slot.endTime) {
                button.classList.add('is-selected');
            }

            this.addListener(button, 'click', () => {
                this.state.selectedSlot = slot;
                this.syncResourceSelect(slot.resourceIds);
                this.renderSlots();
                this.syncFormState();
            });

            const meta = document.createElement('span');
            meta.className = 'booking-form__slot-meta';
            meta.textContent = slot.available
                ? `${slot.resourceIds.length} resource(s)`
                : 'Unavailable';

            button.appendChild(meta);
            this.elements.slotList.appendChild(button);
        }
    }

    private syncResourceSelect(availableResourceIds: number[]): void {
        if (!this.elements.resourceSelect) {
            return;
        }

        const select = this.elements.resourceSelect;
        select.innerHTML = '';

        const candidates = this.options.resources.filter(resource =>
            this.state.selectedResourceIds.includes(resource.id)
        );

        const filtered = availableResourceIds.length
            ? candidates.filter(resource => availableResourceIds.includes(resource.id))
            : candidates;

        if (filtered.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No resource available';
            select.appendChild(option);
            this.state.selectedResourceId = null;
            return;
        }

        for (const resource of filtered) {
            const option = document.createElement('option');
            option.value = String(resource.id);
            option.textContent = resource.name;
            select.appendChild(option);
        }

        const preferred = this.state.selectedResourceId
            ? filtered.find(resource => resource.id === this.state.selectedResourceId)
            : null;

        const selected = preferred ?? filtered[0];
        this.state.selectedResourceId = selected?.id ?? null;
        select.value = selected ? String(selected.id) : '';
    }

    private toggleResource(resourceId: number, selected: boolean): void {
        if (selected) {
            if (!this.state.selectedResourceIds.includes(resourceId)) {
                this.state.selectedResourceIds = [...this.state.selectedResourceIds, resourceId];
            }
        } else {
            this.state.selectedResourceIds = this.state.selectedResourceIds.filter(id => id !== resourceId);
        }

        if (this.state.selectedResourceIds.length === 0) {
            this.state.selectedResourceIds = [resourceId];
        }

        if (!this.state.selectedResourceId || !this.state.selectedResourceIds.includes(this.state.selectedResourceId)) {
            this.state.selectedResourceId = this.state.selectedResourceIds[0] ?? null;
        }

        void this.loadSlots();
    }

    private async handleContactSelect(): Promise<void> {
        try {
            const selection = await bitrix24Api.selectCRM(['contact', 'lead']);
            const first = selection?.[0];
            if (!first) {
                return;
            }

            const entityId = Number.parseInt(first.id, 10);
            if (Number.isNaN(entityId)) {
                return;
            }

            this.state.contactEntityId = entityId;
            const type = first.type?.toLowerCase();
            this.state.contactEntityType = type === 'lead' ? 'lead' : 'contact';

            if (this.state.contactEntityType === 'contact') {
                const contact = await contactService.getContact(entityId);
                if (contact) {
                    this.applyContact(contact);
                }
            } else {
                this.state.leadName = first.title;
                this.syncFormState();
            }
        } catch (error) {
            console.error('[BookingForm] Failed to open CRM selector:', error);
        }
    }

    private async loadContactDetails(): Promise<void> {
        if (!this.state.contactEntityId || this.state.contactEntityType !== 'contact') {
            return;
        }

        const contact = await contactService.getContact(this.state.contactEntityId);
        if (contact) {
            this.applyContact(contact);
        }
    }

    private applyContact(contact: Contact): void {
        this.state.leadName = contact.name;
        this.state.leadPhone = contact.phone ?? '';
        this.state.leadEmail = contact.email ?? '';
        this.syncFormState();
    }

    private async handleSave(): Promise<void> {
        if (this.state.saving) {
            return;
        }

        if (!this.state.selectedSlot || !this.state.selectedResourceId) {
            this.syncStatus('Select a slot and resource before saving.');
            return;
        }

        if (!this.state.leadPhone && !this.state.leadEmail && !this.state.contactEntityId) {
            this.syncStatus('Provide a phone or email for the lead student.');
            return;
        }

        this.state.saving = true;
        this.syncFormState();

        const dateStr = this.toDateValue(this.state.date);
        const dateFrom = `${dateStr}T${this.state.selectedSlot.startTime}:00`;
        const dateTo = `${dateStr}T${this.state.selectedSlot.endTime}:00`;
        const notes = this.buildNotes();

        try {
            const clientInfo = await this.resolveClient();

            if (this.options.mode === 'edit' && this.options.bookingId) {
                await bookingService.updateBookingViaApi(this.options.bookingId, {
                    resourceId: this.state.selectedResourceId,
                    dateFrom,
                    dateTo,
                    notes
                });

                if (clientInfo) {
                    await bookingService.setBookingClient(
                        this.options.bookingId,
                        clientInfo.entityId,
                        clientInfo.entityType
                    );
                }
            } else {
                const created = await bookingService.createBookingViaApi({
                    resourceId: this.state.selectedResourceId,
                    dateFrom,
                    dateTo,
                    notes
                });

                if (created?.id && clientInfo) {
                    await bookingService.setBookingClient(
                        created.id,
                        clientInfo.entityId,
                        clientInfo.entityType
                    );
                }
            }

            this.syncStatus('Booking saved.');
            this.options.onSuccess?.();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to save booking.';
            this.syncStatus(message);
        } finally {
            this.state.saving = false;
            this.syncFormState();
        }
    }

    private async resolveClient(): Promise<{ entityId: number; entityType: 'contact' | 'company' | 'lead' } | null> {
        if (this.state.contactEntityId && this.state.contactEntityType) {
            return { entityId: this.state.contactEntityId, entityType: this.state.contactEntityType };
        }

        const query = this.state.leadPhone || this.state.leadEmail || this.state.leadName;
        if (!query) {
            return null;
        }

        const matches = await contactService.searchContacts(query);
        if (matches.length > 0) {
            const match = matches[0];
            this.state.contactEntityId = match.id;
            this.state.contactEntityType = 'contact';
            await contactService.updateContact(match.id, {
                phone: this.state.leadPhone,
                email: this.state.leadEmail
            });
            return { entityId: match.id, entityType: 'contact' };
        }

        const created = await contactService.createContact({
            firstName: this.state.leadName || 'New',
            phone: this.state.leadPhone,
            email: this.state.leadEmail
        });

        if (created) {
            this.state.contactEntityId = created.id;
            this.state.contactEntityType = 'contact';
            return { entityId: created.id, entityType: 'contact' };
        }

        return null;
    }

    private buildNotes(): string | undefined {
        const ages = this.state.ages
            .map(age => age.trim())
            .filter(age => age.length > 0);

        if (ages.length === 0) {
            return undefined;
        }

        return `Other student ages: ${ages.join(', ')}`;
    }

    private parseAgesFromNotes(notes: string): string[] {
        const match = notes.match(/Other student ages:\\s*(.+)/i);
        if (!match?.[1]) {
            return [];
        }

        return match[1]
            .split(',')
            .map(value => value.trim())
            .filter(value => value.length > 0)
            .slice(0, 5);
    }

    private syncFormState(): void {
        if (this.elements.leadNameInput) {
            this.elements.leadNameInput.value = this.state.leadName;
        }
        if (this.elements.leadPhoneInput) {
            this.elements.leadPhoneInput.value = this.state.leadPhone;
        }
        if (this.elements.leadEmailInput) {
            this.elements.leadEmailInput.value = this.state.leadEmail;
        }

        if (this.elements.saveButton) {
            const canSave = Boolean(
                this.state.selectedSlot
                && this.state.selectedResourceId
                && (this.state.leadPhone || this.state.leadEmail || this.state.contactEntityId)
            );
            this.elements.saveButton.disabled = this.state.saving || !canSave;
        }

        this.syncStatus(this.state.error);
        this.syncResourceSelect(this.state.selectedSlot?.resourceIds ?? []);
    }

    private syncStatus(message: string): void {
        if (!this.elements.statusText) {
            return;
        }

        this.elements.statusText.textContent = message;
    }

    private formatTime(date: Date): string {
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }

    private toDateValue(date: Date): string {
        return date.toISOString().split('T')[0] ?? '';
    }

    private addListener(target: EventTarget, type: string, handler: EventListenerOrEventListenerObject): void {
        target.addEventListener(type, handler);
        this.listeners.push({ target, type, handler });
    }

    private clearListeners(): void {
        this.listeners.forEach(({ target, type, handler }) => {
            target.removeEventListener(type, handler);
        });
        this.listeners = [];
    }
}
