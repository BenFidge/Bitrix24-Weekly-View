import type { Booking } from '../models/booking.model';
import type { TimeFormat } from '../models/config.model';

export interface BookingCellOptions {
    booking: Booking;
    locale: string;
    timeFormat: TimeFormat;
    onClick?: (bookingId: number) => void;
}

export class BookingCell {
    private options: BookingCellOptions;
    private element: HTMLDivElement | null = null;
    private clickHandler: ((event: MouseEvent) => void) | null = null;

    constructor(options: BookingCellOptions) {
        this.options = options;
    }

    render(): HTMLDivElement {
        if (this.element) {
            return this.element;
        }

        const booking = this.options.booking;
        const element = document.createElement('div');
        element.className = 'booking-cell';
        element.dataset.bookingId = String(booking.id);

        const timeElement = document.createElement('div');
        timeElement.className = 'booking-cell__time';
        timeElement.textContent = this.formatTimeRange(booking);

        const clientElement = document.createElement('div');
        clientElement.className = 'booking-cell__client';
        clientElement.textContent = booking.clientName || 'Customer';

        element.appendChild(timeElement);
        element.appendChild(clientElement);

        if (booking.serviceName) {
            const serviceElement = document.createElement('div');
            serviceElement.className = 'booking-cell__service';
            serviceElement.textContent = booking.serviceName;
            element.appendChild(serviceElement);
        }

        if (this.options.onClick) {
            this.clickHandler = (event) => {
                event.stopPropagation();
                this.options.onClick?.(booking.id);
            };
            element.addEventListener('click', this.clickHandler);
        }

        this.element = element;
        return element;
    }

    destroy(): void {
        if (this.element && this.clickHandler) {
            this.element.removeEventListener('click', this.clickHandler);
        }

        this.clickHandler = null;
        this.element = null;
    }

    private formatTimeRange(booking: Booking): string {
        const formatter = new Intl.DateTimeFormat(this.options.locale, {
            hour: '2-digit',
            minute: '2-digit',
            hour12: this.options.timeFormat === '12h'
        });

        return `${formatter.format(booking.dateFrom)} - ${formatter.format(booking.dateTo)}`;
    }
}
