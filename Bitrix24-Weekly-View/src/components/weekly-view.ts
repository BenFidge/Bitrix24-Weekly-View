import type { TimeFormat, ViewMode, WeekStartDay } from '../models/config.model';
import type { Resource } from '../models/resource.model';
import type { Booking, WeeklyResourceBookings } from '../models/booking.model';
import { bookingService } from '../services/bookingService';
import { resourceService } from '../services/resourceService';
import { cultureService } from '../services/cultureService';
import { bitrix24Api } from '../services/bitrix24Api';
import { BookingCell } from './booking-cell';

export interface WeeklyViewOptions {
    container: HTMLElement;
    onViewModeChange?: (mode: ViewMode) => void;
    onOpenSlotFinder?: (date: string) => void;
}

export class WeeklyViewComponent {
    private container: HTMLElement;
    private onViewModeChange?: (mode: ViewMode) => void;
    private onOpenSlotFinder?: (date: string) => void;
    private initialized = false;
    private currentDate = new Date();
    private weekStartsOn: WeekStartDay = 1;
    private locale = 'en-US';
    private timeFormat: TimeFormat = '24h';
    private resources: Resource[] = [];
    private weeklyBookings: WeeklyResourceBookings[] = [];
    private listeners: Array<{ target: EventTarget; type: string; handler: EventListenerOrEventListenerObject }> = [];
    private bookingCells: BookingCell[] = [];

    constructor(options: WeeklyViewOptions) {
        this.container = options.container;
        this.onViewModeChange = options.onViewModeChange;
        this.onOpenSlotFinder = options.onOpenSlotFinder;
    }

    async init(): Promise<void> {
        if (this.initialized) {
            return;
        }

        this.initialized = true;
        await this.loadInitialData();
        await this.refresh();
    }

    destroy(): void {
        if (!this.initialized) {
            return;
        }

        this.clearListeners();
        this.bookingCells.forEach(cell => cell.destroy());
        this.bookingCells = [];
        this.container.innerHTML = '';
        this.initialized = false;
    }

    private async loadInitialData(): Promise<void> {
        const [culture, resources] = await Promise.all([
            cultureService.getCultureSettings(),
            resourceService.getActiveResources()
        ]);

        this.locale = culture.locale;
        this.weekStartsOn = culture.weekStartsOn;
        this.timeFormat = culture.timeFormat;
        this.resources = resources;
    }

    private async refresh(): Promise<void> {
        await this.loadBookings();
        this.render();
        void this.fitWindow();
    }

    private async loadBookings(): Promise<void> {
        if (this.resources.length === 0) {
            this.weeklyBookings = [];
            return;
        }

        const weekStart = this.getWeekStart(this.currentDate);
        this.weeklyBookings = await bookingService.getWeeklyBookings(weekStart, this.resources, this.weekStartsOn);
    }

    private render(): void {
        this.clearListeners();
        this.bookingCells.forEach(cell => cell.destroy());
        this.bookingCells = [];
        this.container.innerHTML = '';

        const root = document.createElement('div');
        root.className = 'weekly-view';

        const weekStart = this.getWeekStart(this.currentDate);
        const weekDays = this.getWeekDays(weekStart);

        root.appendChild(this.createHeader(weekDays));
        root.appendChild(this.createGrid(weekDays));

        this.container.appendChild(root);
    }

    private createHeader(weekDays: Date[]): HTMLElement {
        const header = document.createElement('div');
        header.className = 'weekly-view__header';

        const nav = document.createElement('div');
        nav.className = 'weekly-view__nav';

        const prevButton = this.createButton('Prev', () => this.shiftWeek(-1));
        const nextButton = this.createButton('Next', () => this.shiftWeek(1));
        const todayButton = this.createButton('Today', () => this.goToToday());

        nav.appendChild(prevButton);
        nav.appendChild(nextButton);
        nav.appendChild(todayButton);

        const range = document.createElement('div');
        range.className = 'weekly-view__range';
        range.textContent = this.formatDateRange(weekDays);

        const viewToggle = document.createElement('div');
        viewToggle.className = 'weekly-view__toggle';

        const dayButton = this.createButton('Day', () => this.onViewModeChange?.('daily'));
        const weekButton = this.createButton('Week', () => this.onViewModeChange?.('weekly'));
        weekButton.classList.add('is-active');

        viewToggle.appendChild(dayButton);
        viewToggle.appendChild(weekButton);

        header.appendChild(nav);
        header.appendChild(range);
        header.appendChild(viewToggle);

        return header;
    }

    private createGrid(weekDays: Date[]): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.className = 'weekly-view__grid';

        if (this.resources.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'weekly-view__empty';
            emptyState.textContent = 'No resources available.';
            wrapper.appendChild(emptyState);
            return wrapper;
        }

        const table = document.createElement('table');
        table.className = 'weekly-view__table';

        const headerRow = document.createElement('tr');
        headerRow.appendChild(document.createElement('th'));

        const dayFormatter = new Intl.DateTimeFormat(this.locale, { weekday: 'short', day: 'numeric' });

        for (const day of weekDays) {
            const cell = document.createElement('th');
            cell.textContent = dayFormatter.format(day);
            headerRow.appendChild(cell);
        }

        const thead = document.createElement('thead');
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        const bookingLookup = new Map<number, WeeklyResourceBookings>(
            this.weeklyBookings.map(entry => [entry.resourceId, entry])
        );

        for (const resource of this.resources) {
            const row = document.createElement('tr');
            row.appendChild(this.createResourceCell(resource));

            const resourceBookings = bookingLookup.get(resource.id);
            weekDays.forEach((day, index) => {
                const dayBookings = resourceBookings?.days?.[index]?.bookings ?? [];
                row.appendChild(this.createDayCell(resource, day, dayBookings));
            });

            tbody.appendChild(row);
        }

        table.appendChild(tbody);
        wrapper.appendChild(table);
        return wrapper;
    }

    private createResourceCell(resource: Resource): HTMLTableCellElement {
        const cell = document.createElement('th');
        cell.className = 'weekly-view__resource';

        const wrapper = document.createElement('div');
        wrapper.className = 'weekly-view__resource-content';

        if (resource.avatar) {
            const avatar = document.createElement('img');
            avatar.className = 'weekly-view__resource-avatar';
            avatar.src = resource.avatar;
            avatar.alt = resource.name;
            wrapper.appendChild(avatar);
        }

        const name = document.createElement('div');
        name.className = 'weekly-view__resource-name';
        name.textContent = resource.name;
        wrapper.appendChild(name);

        cell.appendChild(wrapper);
        return cell;
    }

    private createDayCell(resource: Resource, day: Date, bookings: Booking[]): HTMLTableCellElement {
        const cell = document.createElement('td');
        cell.className = 'weekly-view__cell';
        cell.dataset.resourceId = String(resource.id);
        cell.dataset.date = this.toDateValue(day);

        const handler = () => this.handleCellClick(resource, day);
        this.addListener(cell, 'click', handler);

        for (const booking of bookings) {
            const bookingCell = new BookingCell({
                booking,
                locale: this.locale,
                timeFormat: this.timeFormat,
                // Use the app's own editor in a slider (BX24.openApplication fallback)
                onClick: (bookingId) => bookingService.openNativeEdit(bookingId)
            });

            this.bookingCells.push(bookingCell);
            cell.appendChild(bookingCell.render());
        }

        return cell;
    }

    private handleCellClick(resource: Resource, day: Date): void {
        // Prefer our own booking flow (slot-finder) opened in a slider.
        // This works even when `BX` is not accessible inside the iframe.
        bookingService.openNativeCreate(resource.id, day);
    }

    private createButton(label: string, onClick: () => void): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        this.addListener(button, 'click', onClick);
        return button;
    }

    private async shiftWeek(direction: number): Promise<void> {
        const nextDate = new Date(this.currentDate);
        nextDate.setDate(this.currentDate.getDate() + direction * 7);
        this.currentDate = nextDate;
        await this.refresh();
    }

    private async goToToday(): Promise<void> {
        this.currentDate = new Date();
        await this.refresh();
    }

    private getWeekStart(date: Date): Date {
        const start = new Date(date);
        const dayIndex = start.getDay();
        const diff = (dayIndex - this.weekStartsOn + 7) % 7;
        start.setDate(start.getDate() - diff);
        start.setHours(0, 0, 0, 0);
        return start;
    }

    private getWeekDays(weekStart: Date): Date[] {
        return Array.from({ length: 7 }, (_, index) => {
            const day = new Date(weekStart);
            day.setDate(weekStart.getDate() + index);
            return day;
        });
    }

    private formatDateRange(weekDays: Date[]): string {
        const start = weekDays[0];
        const end = weekDays[weekDays.length - 1];
        if (!start || !end) {
            return '';
        }

        const sameYear = start.getFullYear() === end.getFullYear();
        const startFormatter = new Intl.DateTimeFormat(this.locale, {
            month: 'short',
            day: 'numeric',
            year: sameYear ? undefined : 'numeric'
        });
        const endFormatter = new Intl.DateTimeFormat(this.locale, {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        return `${startFormatter.format(start)} - ${endFormatter.format(end)}`;
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

    private async fitWindow(): Promise<void> {
        try {
            await bitrix24Api.fitWindow();
        } catch (error) {
            console.warn('[WeeklyView] Failed to fit window:', error);
        }
    }
}
