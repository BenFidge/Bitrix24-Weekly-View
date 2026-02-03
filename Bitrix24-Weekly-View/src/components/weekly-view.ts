/**
 * Weekly View Component
 * Main component that composes all sub-components for the weekly booking view
 */

import { createElement, clearElement, setLoading } from '../utils/dom.utils.js';
import { getWeekDays, formatDateShort, isToday } from '../utils/date.utils.js';
import { NavigationComponent } from './navigation.js';
import { ResourceRowComponent } from './resource-row.js';
import { BookingFormComponent } from './booking-form.js';
import { bookingService } from '../api/booking.service.js';
import { resourceService } from '../api/resource.service.js';
import { cultureService } from '../api/culture.service.js';
import type { WeeklyResourceBookings, Booking } from '../models/booking.model.js';
import type { Resource } from '../models/resource.model.js';
import type { ViewMode, WeekStartDay } from '../models/config.model.js';

export interface WeeklyViewOptions {
    container: HTMLElement;
    onViewModeChange?: (mode: ViewMode) => void;
}

export class WeeklyViewComponent {
    private container: HTMLElement;
    private options: WeeklyViewOptions;

    // Sub-components
    private navigationComponent: NavigationComponent | null = null;
    private resourceRowComponents: Map<number, ResourceRowComponent> = new Map();
    private bookingForm: BookingFormComponent | null = null;

    // State
    private currentWeekStart: Date = new Date();
    private weekStartsOn: WeekStartDay = 1;
    private locale: string = 'en-US';
    private use24Hour: boolean = true;
    private resources: Resource[] = [];
    private weeklyBookings: WeeklyResourceBookings[] = [];
    private isLoading: boolean = false;

    // DOM references
    private gridContainer: HTMLElement | null = null;
    private headerRow: HTMLElement | null = null;

    constructor(options: WeeklyViewOptions) {
        this.container = options.container;
        this.options = options;
    }

    /**
     * Initialize and render the weekly view
     */
    async init(): Promise<void> {
        try {
            setLoading(this.container, true);
            
            // Load culture settings
            const culture = await cultureService.getCultureSettings();
            this.weekStartsOn = culture.weekStartsOn;
            this.locale = culture.locale;
            this.use24Hour = culture.timeFormat === '24h';

            // Set initial week
            this.currentWeekStart = this.getWeekStart(new Date());

            // Load resources
            this.resources = await resourceService.getActiveResources();

            // Render the view structure
            this.render();

            // Load bookings for current week
            await this.loadBookings();

            // Subscribe to booking events for real-time updates
            this.subscribeToEvents();

        } catch (error) {
            console.error('[WeeklyView] Initialization failed:', error);
            this.renderError('Failed to initialize weekly view. Please refresh the page.');
        } finally {
            setLoading(this.container, false);
        }
    }

    /**
     * Render the main view structure
     */
    private render(): void {
        clearElement(this.container);
        this.container.className = 'bx-booking-weekly-view';

        // Navigation section
        const navContainer = createElement('div', { className: 'bx-booking-weekly-view__nav' });
        this.navigationComponent = new NavigationComponent(navContainer, {
            initialDate: this.currentWeekStart,
            weekStartsOn: this.weekStartsOn,
            locale: this.locale,
            viewMode: 'weekly',
            onWeekChange: (weekStart) => this.handleWeekChange(weekStart),
            onViewModeChange: (mode) => this.handleViewModeChange(mode),
            onDateSelect: (date) => this.handleDateSelect(date)
        });

        // Grid header (day names)
        this.headerRow = this.renderGridHeader();

        // Grid container for resource rows
        this.gridContainer = createElement('div', { className: 'bx-booking-weekly-view__grid' });

        // Assemble view
        this.container.appendChild(navContainer);
        this.container.appendChild(this.headerRow);
        this.container.appendChild(this.gridContainer);
    }

    /**
     * Render grid header with day names and dates
     */
    private renderGridHeader(): HTMLElement {
        const header = createElement('div', { className: 'bx-booking-grid-header' });

        // Empty cell for resource column
        const resourceHeader = createElement('div', {
            className: 'bx-booking-grid-header__resource',
            text: 'Resources'
        });
        header.appendChild(resourceHeader);

        // Day headers
        const daysContainer = createElement('div', { className: 'bx-booking-grid-header__days' });
        const weekDays = getWeekDays(this.currentWeekStart, this.weekStartsOn);

        for (const day of weekDays) {
            const dayHeader = createElement('div', {
                className: `bx-booking-grid-header__day ${isToday(day) ? 'bx-booking-grid-header__day--today' : ''}`,
                html: `
                    <span class="bx-booking-grid-header__day-name">${formatDateShort(day, this.locale)}</span>
                    <span class="bx-booking-grid-header__day-date">${day.getDate()}</span>
                `
            });
            daysContainer.appendChild(dayHeader);
        }

        header.appendChild(daysContainer);
        return header;
    }

    /**
     * Load bookings for the current week
     */
    private async loadBookings(): Promise<void> {
        if (this.isLoading || !this.gridContainer) return;

        try {
            this.isLoading = true;
            setLoading(this.gridContainer, true);

            this.weeklyBookings = await bookingService.getWeeklyBookings(
                this.currentWeekStart,
                this.resources,
                this.weekStartsOn
            );

            this.renderResourceRows();

        } catch (error) {
            console.error('[WeeklyView] Failed to load bookings:', error);
        } finally {
            this.isLoading = false;
            if (this.gridContainer) {
                setLoading(this.gridContainer, false);
            }
        }
    }

    /**
     * Render all resource rows
     */
    private renderResourceRows(): void {
        if (!this.gridContainer) return;

        // Clear existing rows
        this.destroyResourceRows();
        clearElement(this.gridContainer);

        // Create row for each resource
        for (const weeklyBooking of this.weeklyBookings) {
            const resource = this.resources.find(r => r.id === weeklyBooking.resourceId);
            if (!resource) continue;

            const rowComponent = new ResourceRowComponent({
                weeklyBookings: weeklyBooking,
                resource,
                locale: this.locale,
                use24Hour: this.use24Hour,
                onCellClick: (resourceId, date, element) => this.handleCellClick(resourceId, date, element),
                onBookingClick: (booking, element) => this.handleBookingClick(booking, element)
            });

            this.resourceRowComponents.set(resource.id, rowComponent);
            this.gridContainer.appendChild(rowComponent.getElement());
        }

        // Empty state if no resources
        if (this.weeklyBookings.length === 0) {
            const emptyState = createElement('div', {
                className: 'bx-booking-weekly-view__empty',
                html: `
                    <p>No resources available.</p>
                    <p>Add resources in the Booking settings to see them here.</p>
                `
            });
            this.gridContainer.appendChild(emptyState);
        }
    }

    /**
     * Handle week navigation
     */
    private async handleWeekChange(weekStart: Date): Promise<void> {
        this.currentWeekStart = weekStart;
        
        // Update header
        if (this.headerRow) {
            const newHeader = this.renderGridHeader();
            this.headerRow.replaceWith(newHeader);
            this.headerRow = newHeader;
        }

        // Reload bookings
        await this.loadBookings();
    }

    /**
     * Handle view mode change
     */
    private handleViewModeChange(mode: ViewMode): void {
        if (mode === 'daily') {
            // Navigate to daily view
            this.navigateToDailyView();
        }
        
        this.options.onViewModeChange?.(mode);
    }

    /**
     * Handle date selection from calendar
     */
    private handleDateSelect(date: Date): void {
        // Week will be changed via navigation component
        console.log('[WeeklyView] Date selected:', date);
    }

    /**
     * Handle cell click (create new booking) - Opens our custom booking form
     */
    private handleCellClick(resourceId: number, date: Date, _element: HTMLElement): void {
        console.log('[WeeklyView] Cell clicked:', { resourceId, date });
        this.openBookingForm(date, resourceId);
    }

    /**
     * Open the booking form
     */
    private openBookingForm(date: Date, preselectedResourceId?: number): void {
        this.bookingForm = new BookingFormComponent({
            date,
            resources: this.resources,
            preselectedResourceId,
            locale: this.locale,
            onSuccess: (bookingId) => {
                console.log('[WeeklyView] Booking created:', bookingId);
                this.refreshBookings();
            },
            onCancel: () => {
                console.log('[WeeklyView] Booking form cancelled');
                this.bookingForm = null;
            }
        });

        this.bookingForm.show();
    }

    /**
     * Handle booking click (edit existing booking)
     */
    private handleBookingClick(booking: Booking, _element: HTMLElement): void {
        console.log('[WeeklyView] Booking clicked:', booking);
        bookingService.openEditBookingDialog(booking.id);
    }

    /**
     * Navigate to daily view
     */
    private navigateToDailyView(): void {
        // Try to use Bitrix24 navigation
        const dateStr = this.currentWeekStart.toISOString().split('T')[0];
        
        if (typeof BX !== 'undefined' && BX.SidePanel?.Instance) {
            BX.SidePanel.Instance.close();
        }

        // Navigate to the native booking view
        const bookingUrl = `/booking/?date=${dateStr}`;
        
        if (typeof BX24 !== 'undefined') {
            BX24.openPath(bookingUrl);
        } else {
            window.location.href = bookingUrl;
        }
    }

    /**
     * Subscribe to booking events
     */
    private subscribeToEvents(): void {
        bookingService.subscribeToBookingEvents({
            onBookingCreated: () => this.refreshBookings(),
            onBookingUpdated: () => this.refreshBookings(),
            onBookingDeleted: () => this.refreshBookings()
        });

        // Listen for side panel close to refresh data
        if (typeof BX !== 'undefined' && BX.Event?.EventEmitter) {
            BX.Event.EventEmitter.subscribe(window, 'SidePanel.Slider:onClose', () => {
                this.refreshBookings();
            });
        }
    }

    /**
     * Refresh bookings (debounced)
     */
    private refreshBookings(): void {
        // Simple debounce
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
        }
        this.refreshTimeout = setTimeout(() => {
            this.loadBookings();
        }, 500);
    }
    private refreshTimeout: ReturnType<typeof setTimeout> | null = null;

    /**
     * Get week start date
     */
    private getWeekStart(date: Date): Date {
        const d = new Date(date);
        const day = d.getDay();
        const diff = (day < this.weekStartsOn ? 7 : 0) + day - this.weekStartsOn;
        d.setDate(d.getDate() - diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    /**
     * Render error state
     */
    private renderError(message: string): void {
        clearElement(this.container);
        const error = createElement('div', {
            className: 'bx-booking-weekly-view__error',
            html: `
                <div class="bx-booking-error">
                    <h3>Error</h3>
                    <p>${message}</p>
                    <button type="button" onclick="location.reload()">Retry</button>
                </div>
            `
        });
        this.container.appendChild(error);
    }

    /**
     * Destroy resource row components
     */
    private destroyResourceRows(): void {
        for (const component of this.resourceRowComponents.values()) {
            component.destroy();
        }
        this.resourceRowComponents.clear();
    }

    /**
     * Destroy the component
     */
    public destroy(): void {
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
        }
        
        this.navigationComponent?.destroy();
        this.destroyResourceRows();
        clearElement(this.container);
    }
}
