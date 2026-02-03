/**
 * Booking Cell Component
 * Renders a single day cell with its bookings for a resource
 */

import { createElement, addEvent } from '../utils/dom.utils.js';
import { formatTime, isToday, isPast, isWeekend } from '../utils/date.utils.js';
import type { Booking, DayBookings } from '../models/booking.model.js';

export interface BookingCellOptions {
    dayBookings: DayBookings;
    resourceId: number;
    locale: string;
    use24Hour: boolean;
    onCellClick: (resourceId: number, date: Date, element: HTMLElement) => void;
    onBookingClick: (booking: Booking, element: HTMLElement) => void;
}

export class BookingCellComponent {
    private element: HTMLElement;
    private options: BookingCellOptions;

    constructor(options: BookingCellOptions) {
        this.options = options;
        this.element = this.render();
    }

    /**
     * Render the booking cell
     */
    private render(): HTMLElement {
        const { dayBookings, resourceId } = this.options;
        const { date, bookings } = dayBookings;

        const cell = createElement('div', {
            className: this.getCellClasses(date),
            dataset: {
                resourceId: resourceId.toString(),
                date: date.toISOString().split('T')[0] ?? ''
            }
        });

        // Click handler for empty cell or cell background
        addEvent(cell, 'click', (e) => {
            // Only trigger if clicking directly on the cell, not on a booking
            if (e.target === cell || (e.target as HTMLElement).classList.contains('bx-booking-cell__empty')) {
                this.options.onCellClick(resourceId, date, cell);
            }
        });

        // Render bookings or empty state
        if (bookings.length === 0) {
            const emptyIndicator = createElement('div', {
                className: 'bx-booking-cell__empty',
                html: '<span class="bx-booking-cell__add-icon">+</span>'
            });
            cell.appendChild(emptyIndicator);
        } else {
            const bookingsList = this.renderBookings(bookings);
            cell.appendChild(bookingsList);
        }

        return cell;
    }

    /**
     * Get CSS classes for the cell
     */
    private getCellClasses(date: Date): string {
        const classes = ['bx-booking-cell'];

        if (isToday(date)) {
            classes.push('bx-booking-cell--today');
        }

        if (isPast(date)) {
            classes.push('bx-booking-cell--past');
        }

        if (isWeekend(date)) {
            classes.push('bx-booking-cell--weekend');
        }

        return classes.join(' ');
    }

    /**
     * Render bookings list
     */
    private renderBookings(bookings: Booking[]): HTMLElement {
        const list = createElement('div', { className: 'bx-booking-cell__list' });

        for (const booking of bookings) {
            const bookingEl = this.renderBookingItem(booking);
            list.appendChild(bookingEl);
        }

        // Add "add more" button if there's space
        const addBtn = new BX.UI!.Button({
            className: 'bx-booking-cell__add-btn',
            icon: BX.UI!.Button.Icon.ADD,
            color: BX.UI!.Button.Color.LIGHT_BORDER,
            size: BX.UI!.Button.Size.SMALL,
            round: true,
            onclick: (_button, event) => {
                event.stopPropagation();
                this.options.onCellClick(
                    this.options.resourceId,
                    this.options.dayBookings.date,
                    this.element
                );
            }
        });

        addBtn.renderTo(list);

        return list;
    }

    /**
     * Render a single booking item
     */
    private renderBookingItem(booking: Booking): HTMLElement {
        const item = createElement('div', {
            className: `bx-booking-item ${booking.confirmed ? 'bx-booking-item--confirmed' : 'bx-booking-item--unconfirmed'}`,
            dataset: {
                bookingId: booking.id.toString()
            }
        });

        // Time
        const time = createElement('div', {
            className: 'bx-booking-item__time',
            text: formatTime(booking.dateFrom, this.options.locale, this.options.use24Hour)
        });

        // Customer name
        const name = createElement('div', {
            className: 'bx-booking-item__name',
            text: booking.clientName || 'No name'
        });

        // Phone number
        const phone = createElement('div', {
            className: 'bx-booking-item__phone',
            text: booking.clientPhone || ''
        });

        // Confirmation indicator
        if (!booking.confirmed) {
            const indicator = createElement('span', {
                className: 'bx-booking-item__unconfirmed-badge',
                text: '!'
            });
            item.appendChild(indicator);
        }

        item.appendChild(time);
        item.appendChild(name);
        if (booking.clientPhone) {
            item.appendChild(phone);
        }

        // Click handler to open booking details
        addEvent(item, 'click', (e) => {
            e.stopPropagation();
            this.options.onBookingClick(booking, item);
        });

        return item;
    }

    /**
     * Get the rendered element
     */
    public getElement(): HTMLElement {
        return this.element;
    }

    /**
     * Update the cell with new data
     */
    public update(dayBookings: DayBookings): void {
        this.options.dayBookings = dayBookings;
        const newElement = this.render();
        this.element.replaceWith(newElement);
        this.element = newElement;
    }

    /**
     * Destroy component
     */
    public destroy(): void {
        this.element.remove();
    }
}
