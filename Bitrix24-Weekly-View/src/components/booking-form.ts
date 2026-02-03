/**
 * Booking Form Component
 * A Bitrix24-styled form for creating bookings
 */

import { createElement, addEvent, clearElement } from '../utils/dom.utils.js';
import { showUiAlert } from '../utils/ui-kit.utils.js';
import { formatDateFull } from '../utils/date.utils.js';
import { bookingService } from '../api/booking.service.js';
import { contactService, type Contact } from '../api/contact.service.js';
import { slotService, type TimeSlot } from '../api/slot.service.js';
import type { Resource } from '../models/resource.model.js';

export interface BookingFormOptions {
    date: Date;
    resources: Resource[];
    preselectedResourceId?: number;
    locale: string;
    onSuccess: (bookingId: number) => void;
    onCancel: () => void;
}

interface FormState {
    date: Date;
    selectedResourceIds: number[];
    selectedSlot: TimeSlot | null;
    contact: Contact | null;
    studentName: string;
    studentPhone: string;
    studentEmail: string;
    isNewContact: boolean;
}

export class BookingFormComponent {
    private element: HTMLElement;
    private options: BookingFormOptions;
    private state: FormState;
    private overlay: HTMLElement | null = null;
    
    // Form elements
    private dateInput: HTMLInputElement | null = null;
    private resourceCheckboxes: Map<number, HTMLInputElement> = new Map();
    private slotContainer: HTMLElement | null = null;
    private contactInput: HTMLInputElement | null = null;
    private contactSuggestions: HTMLElement | null = null;
    private phoneInput: HTMLInputElement | null = null;
    private emailInput: HTMLInputElement | null = null;
    private submitButton: UIButtonInstance | null = null;

    private searchTimeout: ReturnType<typeof setTimeout> | null = null;

    constructor(options: BookingFormOptions) {
        this.options = options;
        this.state = {
            date: options.date,
            selectedResourceIds: options.preselectedResourceId ? [options.preselectedResourceId] : [],
            selectedSlot: null,
            contact: null,
            studentName: '',
            studentPhone: '',
            studentEmail: '',
            isNewContact: true
        };

        this.element = this.render();
    }

    /**
     * Show the form as a modal/slider
     */
    show(): void {
        // Create overlay
        this.overlay = createElement('div', {
            className: 'bx-booking-form-overlay'
        });

        addEvent(this.overlay, 'click', (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });

        this.overlay.appendChild(this.element);
        document.body.appendChild(this.overlay);

        // Animate in
        requestAnimationFrame(() => {
            this.overlay?.classList.add('bx-booking-form-overlay--visible');
            this.element.classList.add('bx-booking-form--visible');
        });

        // Load initial slots
        this.loadSlots();
    }

    /**
     * Close the form
     */
    close(): void {
        this.element.classList.remove('bx-booking-form--visible');
        this.overlay?.classList.remove('bx-booking-form-overlay--visible');

        setTimeout(() => {
            this.overlay?.remove();
            this.overlay = null;
        }, 300);

        this.options.onCancel();
    }

    /**
     * Render the form
     */
    private render(): HTMLElement {
        const form = createElement('div', {
            className: 'bx-booking-form'
        });

        // Header
        const header = this.renderHeader();
        form.appendChild(header);

        // Form body
        const body = createElement('div', { className: 'bx-booking-form__body' });

        // Date field
        body.appendChild(this.renderDateField());

        // Trainers/Resources field
        body.appendChild(this.renderResourcesField());

        // Time slots field
        body.appendChild(this.renderSlotsField());

        // Student details section
        body.appendChild(this.renderStudentSection());

        form.appendChild(body);

        // Footer with buttons
        const footer = this.renderFooter();
        form.appendChild(footer);

        return form;
    }

    /**
     * Render form header
     */
    private renderHeader(): HTMLElement {
        const header = createElement('div', { className: 'bx-booking-form__header' });

        const title = createElement('h2', {
            className: 'bx-booking-form__title',
            text: 'Create Booking'
        });

        header.appendChild(title);
        const closeBtn = new BX.UI!.Button({
            className: 'bx-booking-form__close',
            text: '×',
            color: BX.UI!.Button.Color.LIGHT_BORDER,
            size: BX.UI!.Button.Size.EXTRA_SMALL,
            round: true,
            onclick: () => this.close()
        });

        closeBtn.renderTo(header);

        return header;
    }

    /**
     * Render date field
     */
    private renderDateField(): HTMLElement {
        const field = createElement('div', { className: 'bx-form-field' });

        const label = createElement('label', {
            className: 'bx-form-field__label',
            text: 'Date'
        });

        this.dateInput = document.createElement('input');
        this.dateInput.type = 'date';
        this.dateInput.className = 'bx-form-field__input';
        this.dateInput.value = this.state.date.toISOString().split('T')[0] || '';

        addEvent(this.dateInput, 'change', () => {
            if (this.dateInput?.value) {
                this.state.date = new Date(this.dateInput.value);
                this.loadSlots();
            }
        });

        field.appendChild(label);
        field.appendChild(this.dateInput);

        return field;
    }

    /**
     * Render resources/trainers field
     */
    private renderResourcesField(): HTMLElement {
        const field = createElement('div', { className: 'bx-form-field' });

        const label = createElement('label', {
            className: 'bx-form-field__label',
            text: 'Trainers'
        });

        const checkboxGroup = createElement('div', { className: 'bx-form-checkbox-group' });

        for (const resource of this.options.resources) {
            const item = createElement('label', { className: 'bx-form-checkbox' });

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'bx-form-checkbox__input';
            checkbox.value = resource.id.toString();
            checkbox.checked = this.state.selectedResourceIds.includes(resource.id);

            addEvent(checkbox, 'change', () => {
                if (checkbox.checked) {
                    this.state.selectedResourceIds.push(resource.id);
                } else {
                    this.state.selectedResourceIds = this.state.selectedResourceIds.filter(
                        id => id !== resource.id
                    );
                }
                this.loadSlots();
            });

            this.resourceCheckboxes.set(resource.id, checkbox);

            const text = createElement('span', {
                className: 'bx-form-checkbox__label',
                text: resource.name
            });

            item.appendChild(checkbox);
            item.appendChild(text);
            checkboxGroup.appendChild(item);
        }

        field.appendChild(label);
        field.appendChild(checkboxGroup);

        return field;
    }

    /**
     * Render time slots field
     */
    private renderSlotsField(): HTMLElement {
        const field = createElement('div', { className: 'bx-form-field' });

        const label = createElement('label', {
            className: 'bx-form-field__label',
            text: 'Time Slot'
        });

        this.slotContainer = createElement('div', {
            className: 'bx-form-slots',
            html: '<div class="bx-form-slots__loading">Loading available slots...</div>'
        });

        field.appendChild(label);
        field.appendChild(this.slotContainer);

        return field;
    }

    /**
     * Render student details section
     */
    private renderStudentSection(): HTMLElement {
        const section = createElement('div', { className: 'bx-form-section' });

        const sectionTitle = createElement('h3', {
            className: 'bx-form-section__title',
            text: 'Student Details'
        });
        section.appendChild(sectionTitle);

        // Name field with auto-suggest
        const nameField = createElement('div', { className: 'bx-form-field' });
        const nameLabel = createElement('label', {
            className: 'bx-form-field__label',
            text: 'Name'
        });

        const nameWrapper = createElement('div', { className: 'bx-form-field__autocomplete' });

        this.contactInput = document.createElement('input');
        this.contactInput.type = 'text';
        this.contactInput.className = 'bx-form-field__input';
        this.contactInput.placeholder = 'Start typing to search contacts...';
        this.contactInput.autocomplete = 'off';

        addEvent(this.contactInput, 'input', () => this.handleContactSearch());
        addEvent(this.contactInput, 'blur', () => {
            // Delay hiding to allow click on suggestion
            setTimeout(() => this.hideSuggestions(), 200);
        });

        this.contactSuggestions = createElement('div', {
            className: 'bx-form-suggestions'
        });

        nameWrapper.appendChild(this.contactInput);
        nameWrapper.appendChild(this.contactSuggestions);
        nameField.appendChild(nameLabel);
        nameField.appendChild(nameWrapper);
        section.appendChild(nameField);

        // Phone field
        const phoneField = createElement('div', { className: 'bx-form-field' });
        const phoneLabel = createElement('label', {
            className: 'bx-form-field__label',
            text: 'Phone'
        });

        this.phoneInput = document.createElement('input');
        this.phoneInput.type = 'tel';
        this.phoneInput.className = 'bx-form-field__input';
        this.phoneInput.placeholder = '+66 XX XXX XXXX';

        addEvent(this.phoneInput, 'input', () => {
            this.state.studentPhone = this.phoneInput?.value || '';
        });

        phoneField.appendChild(phoneLabel);
        phoneField.appendChild(this.phoneInput);
        section.appendChild(phoneField);

        // Email field
        const emailField = createElement('div', { className: 'bx-form-field' });
        const emailLabel = createElement('label', {
            className: 'bx-form-field__label',
            text: 'Email'
        });

        this.emailInput = document.createElement('input');
        this.emailInput.type = 'email';
        this.emailInput.className = 'bx-form-field__input';
        this.emailInput.placeholder = 'email@example.com';

        addEvent(this.emailInput, 'input', () => {
            this.state.studentEmail = this.emailInput?.value || '';
        });

        emailField.appendChild(emailLabel);
        emailField.appendChild(this.emailInput);
        section.appendChild(emailField);

        return section;
    }

    /**
     * Render form footer
     */
    private renderFooter(): HTMLElement {
        const footer = createElement('div', { className: 'bx-booking-form__footer' });

        const cancelBtn = new BX.UI!.Button({
            className: 'bx-btn bx-btn--link',
            text: 'Cancel',
            color: BX.UI!.Button.Color.LINK,
            size: BX.UI!.Button.Size.MEDIUM,
            onclick: () => this.close()
        });

        this.submitButton = new BX.UI!.Button({
            className: 'bx-btn bx-btn--primary',
            text: 'Create Booking',
            color: BX.UI!.Button.Color.PRIMARY,
            size: BX.UI!.Button.Size.MEDIUM,
            round: true,
            onclick: () => this.handleSubmit()
        });

        cancelBtn.renderTo(footer);
        this.submitButton.renderTo(footer);

        return footer;
    }

    /**
     * Load available time slots
     */
    private async loadSlots(): Promise<void> {
        if (!this.slotContainer) return;

        this.slotContainer.innerHTML = '<div class="bx-form-slots__loading">Loading slots...</div>';

        const slots = await slotService.getAvailableSlots(
            this.state.selectedResourceIds,
            this.state.date
        );

        this.renderSlots(slots);
    }

    /**
     * Render time slots
     */
    private renderSlots(slots: TimeSlot[]): void {
        if (!this.slotContainer) return;

        clearElement(this.slotContainer);

        if (slots.length === 0) {
            this.slotContainer.innerHTML = '<div class="bx-form-slots__empty">No slots available</div>';
            return;
        }

        const grid = createElement('div', { className: 'bx-form-slots__grid' });

        for (const slot of slots) {
            const slotBtn = new BX.UI!.Button({
                className: `bx-form-slot ${!slot.available ? 'bx-form-slot--unavailable' : ''} ${
                    this.state.selectedSlot?.startTime === slot.startTime ? 'bx-form-slot--selected' : ''
                }`,
                text: `${slot.startTime} - ${slot.endTime}`,
                color: BX.UI!.Button.Color.LIGHT_BORDER,
                size: BX.UI!.Button.Size.SMALL,
                round: true,
                disabled: !slot.available,
                onclick: () => this.selectSlot(slot, slotBtn.getContainer())
            });

            slotBtn.renderTo(grid);
        }

        this.slotContainer.appendChild(grid);
    }

    /**
     * Select a time slot
     */
    private selectSlot(slot: TimeSlot, button: HTMLElement): void {
        // Remove previous selection
        this.slotContainer?.querySelectorAll('.bx-form-slot--selected').forEach(el => {
            el.classList.remove('bx-form-slot--selected');
        });

        // Select new slot
        button.classList.add('bx-form-slot--selected');
        this.state.selectedSlot = slot;
    }

    /**
     * Handle contact search
     */
    private handleContactSearch(): void {
        const query = this.contactInput?.value || '';
        this.state.studentName = query;
        this.state.isNewContact = true;
        this.state.contact = null;

        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }

        if (query.length < 2) {
            this.hideSuggestions();
            return;
        }

        this.searchTimeout = setTimeout(async () => {
            const contacts = await contactService.searchContacts(query);
            this.showSuggestions(contacts);
        }, 300);
    }

    /**
     * Show contact suggestions
     */
    private showSuggestions(contacts: Contact[]): void {
        if (!this.contactSuggestions) return;

        clearElement(this.contactSuggestions);

        if (contacts.length === 0) {
            const noResults = createElement('div', {
                className: 'bx-form-suggestion bx-form-suggestion--new',
                html: `<span>Create new contact: "${this.state.studentName}"</span>`
            });

            addEvent(noResults, 'click', () => {
                this.state.isNewContact = true;
                this.hideSuggestions();
            });

            this.contactSuggestions.appendChild(noResults);
        } else {
            for (const contact of contacts) {
                const item = createElement('div', {
                    className: 'bx-form-suggestion',
                    html: `
                        <span class="bx-form-suggestion__name">${contact.name}</span>
                        ${contact.phone ? `<span class="bx-form-suggestion__detail">${contact.phone}</span>` : ''}
                        ${contact.email ? `<span class="bx-form-suggestion__detail">${contact.email}</span>` : ''}
                    `
                });

                addEvent(item, 'click', () => this.selectContact(contact));

                this.contactSuggestions.appendChild(item);
            }

            // Add "create new" option at the end
            const createNew = createElement('div', {
                className: 'bx-form-suggestion bx-form-suggestion--new',
                html: `<span>+ Create new contact</span>`
            });

            addEvent(createNew, 'click', () => {
                this.state.isNewContact = true;
                this.state.contact = null;
                this.hideSuggestions();
            });

            this.contactSuggestions.appendChild(createNew);
        }

        this.contactSuggestions.classList.add('bx-form-suggestions--visible');
    }

    /**
     * Hide contact suggestions
     */
    private hideSuggestions(): void {
        this.contactSuggestions?.classList.remove('bx-form-suggestions--visible');
    }

    /**
     * Select a contact from suggestions
     */
    private selectContact(contact: Contact): void {
        this.state.contact = contact;
        this.state.isNewContact = false;
        this.state.studentName = contact.name;
        this.state.studentPhone = contact.phone || '';
        this.state.studentEmail = contact.email || '';

        if (this.contactInput) {
            this.contactInput.value = contact.name;
        }
        if (this.phoneInput) {
            this.phoneInput.value = contact.phone || '';
        }
        if (this.emailInput) {
            this.emailInput.value = contact.email || '';
        }

        this.hideSuggestions();
    }

    /**
     * Handle form submission
     */
    private async handleSubmit(): Promise<void> {
        // Validate form
        if (!this.validateForm()) {
            return;
        }

        if (!this.submitButton) return;

        this.submitButton.setDisabled(true);
        this.submitButton.setWaiting(true);
        this.submitButton.setText('Creating...');

        try {
            // Create or update contact
            let contactId = this.state.contact?.id;

            if (this.state.isNewContact && this.state.studentName) {
                const nameParts = this.state.studentName.split(' ');
                const firstName = nameParts[0] || '';
                const lastName = nameParts.slice(1).join(' ');

                const newContact = await contactService.createContact({
                    firstName,
                    lastName,
                    phone: this.state.studentPhone,
                    email: this.state.studentEmail
                });

                if (newContact) {
                    contactId = newContact.id;
                }
            } else if (this.state.contact) {
                // Update existing contact if phone/email changed
                const phoneChanged = this.state.studentPhone !== this.state.contact.phone;
                const emailChanged = this.state.studentEmail !== this.state.contact.email;

                if (phoneChanged || emailChanged) {
                    await contactService.updateContact(this.state.contact.id, {
                        phone: this.state.studentPhone,
                        email: this.state.studentEmail
                    });
                }
            }

            // Create booking for each selected resource
            const dateStr = this.state.date.toISOString().split('T')[0];
            const startTime = this.state.selectedSlot?.startTime || '09:00';
            const endTime = this.state.selectedSlot?.endTime || '10:00';

            let lastBookingId = 0;

            for (const resourceId of this.state.selectedResourceIds) {
                const booking = await bookingService.createBookingViaApi({
                    resourceId,
                    dateFrom: `${dateStr}T${startTime}:00`,
                    dateTo: `${dateStr}T${endTime}:00`,
                    clientId: contactId,
                    notes: `Student: ${this.state.studentName}\nPhone: ${this.state.studentPhone}\nEmail: ${this.state.studentEmail}`
                });

                if (booking?.id) {
                    lastBookingId = booking.id;

                    // Link contact to booking if we have a contact ID
                    if (contactId) {
                        await this.linkContactToBooking(booking.id, contactId);
                    }
                }
            }

            // Success
            this.close();
            this.options.onSuccess(lastBookingId);

        } catch (error) {
            console.error('[BookingForm] Submit failed:', error);
            void showUiAlert('Failed to create booking. Please try again.');

            this.submitButton.setDisabled(false);
            this.submitButton.setWaiting(false);
            this.submitButton.setText('Create Booking');
        }
    }

    /**
     * Link a contact to a booking
     */
    private async linkContactToBooking(bookingId: number, contactId: number): Promise<void> {
        try {
            await bookingService.setBookingClient(bookingId, contactId, 'contact');
        } catch (error) {
            console.warn('[BookingForm] Failed to link contact to booking:', error);
        }
    }

    /**
     * Validate form before submission
     */
    private validateForm(): boolean {
        const errors: string[] = [];

        if (this.state.selectedResourceIds.length === 0) {
            errors.push('Please select at least one trainer');
        }

        if (!this.state.selectedSlot) {
            errors.push('Please select a time slot');
        }

        if (!this.state.studentName.trim()) {
            errors.push('Please enter the student name');
        }

        if (errors.length > 0) {
            void showUiAlert(errors.join('\n'));
            return false;
        }

        return true;
    }
}
