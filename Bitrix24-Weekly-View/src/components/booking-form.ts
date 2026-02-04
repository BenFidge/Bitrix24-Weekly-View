import type { Resource } from '../models/resource.model';

export interface BookingFormOptions {
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
        this.root.textContent = 'Booking form will render here.';

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
