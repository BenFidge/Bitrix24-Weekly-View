import type { Resource } from '../models/resource.model';
import type { Booking } from '../models/booking.model';

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

export class BookingFormComponent {
    private options: BookingFormOptions;
    private host: HTMLElement | null = null;
    private root: HTMLDivElement | null = null;

    constructor(options: BookingFormOptions) {
        this.options = options;
    }

    render(host: HTMLElement): void {
        this.host = host;
        this.root = document.createElement('div');
        this.root.className = 'booking-form';

        const title = document.createElement('h2');
        title.textContent = this.options.mode === 'edit' ? 'Edit booking' : 'Create booking';

        const details = document.createElement('pre');
        details.textContent = JSON.stringify({
            mode: this.options.mode,
            bookingId: this.options.bookingId,
            date: this.options.date,
            preselectedResourceId: this.options.preselectedResourceId,
            initialBooking: this.options.initialBooking ?? null
        }, null, 2);

        this.root.appendChild(title);
        this.root.appendChild(details);

        this.host.innerHTML = '';
        this.host.appendChild(this.root);
    }

    destroy(): void {
        if (this.host) {
            this.host.innerHTML = '';
        }

        this.root = null;
        this.host = null;
    }
}
