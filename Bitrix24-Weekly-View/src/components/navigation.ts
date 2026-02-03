/**
 * Navigation Component
 * Handles week navigation and view switching
 */

import { createElement } from '../utils/dom.utils.js';
import { formatWeekRange, getPreviousWeek, getNextWeek, getWeekStart, getWeekEnd } from '../utils/date.utils.js';
import type { ViewMode, WeekStartDay, NavigationState } from '../models/config.model.js';

export interface NavigationOptions {
    initialDate: Date;
    weekStartsOn: WeekStartDay;
    locale: string;
    viewMode: ViewMode;
    onWeekChange: (weekStart: Date, weekEnd: Date) => void;
    onViewModeChange: (mode: ViewMode) => void;
    onDateSelect: (date: Date) => void;
}

export class NavigationComponent {
    private container: HTMLElement;
    private state: NavigationState;
    private options: NavigationOptions;
    private calendarPopup: HTMLElement | null = null;

    constructor(container: HTMLElement, options: NavigationOptions) {
        this.container = container;
        this.options = options;
        
        this.state = {
            currentDate: options.initialDate,
            weekStart: getWeekStart(options.initialDate, options.weekStartsOn),
            weekEnd: getWeekEnd(options.initialDate, options.weekStartsOn),
            viewMode: options.viewMode
        };

        this.render();
    }

    /**
     * Render the navigation component
     */
    private render(): void {
        this.container.innerHTML = '';
        this.container.className = 'bx-booking-nav';

        // Create navigation elements
        const nav = createElement('div', { className: 'bx-booking-nav__container' });

        // Left section: Title and week info
        const leftSection = this.createLeftSection();
        
        // Center section: Navigation arrows and date
        const centerSection = this.createCenterSection();
        
        // Right section: View mode switcher
        const rightSection = this.createRightSection();

        nav.appendChild(leftSection);
        nav.appendChild(centerSection);
        nav.appendChild(rightSection);
        
        this.container.appendChild(nav);
    }

    /**
     * Create left section with title
     */
    private createLeftSection(): HTMLElement {
        const section = createElement('div', { className: 'bx-booking-nav__left' });
        
        const title = createElement('h1', {
            className: 'bx-booking-nav__title',
            text: 'Booking'
        });
        
        const weekRange = createElement('span', {
            className: 'bx-booking-nav__week-range',
            text: formatWeekRange(this.state.weekStart, this.state.weekEnd, this.options.locale)
        });

        section.appendChild(title);
        section.appendChild(weekRange);

        return section;
    }

    /**
     * Create center section with navigation
     */
    private createCenterSection(): HTMLElement {
        const section = createElement('div', { className: 'bx-booking-nav__center' });

        const prevBtn = new BX.UI!.Button({
            className: 'bx-booking-nav__btn bx-booking-nav__btn--prev',
            icon: BX.UI!.Button.Icon.CHEVRON_LEFT,
            color: BX.UI!.Button.Color.LIGHT_BORDER,
            size: BX.UI!.Button.Size.SMALL,
            round: true,
            onclick: () => this.navigateToPreviousWeek()
        });

        const todayBtn = new BX.UI!.Button({
            className: 'bx-booking-nav__btn bx-booking-nav__btn--today',
            text: 'Today',
            color: BX.UI!.Button.Color.LIGHT_BORDER,
            size: BX.UI!.Button.Size.SMALL,
            round: true,
            onclick: () => this.navigateToToday()
        });

        const nextBtn = new BX.UI!.Button({
            className: 'bx-booking-nav__btn bx-booking-nav__btn--next',
            icon: BX.UI!.Button.Icon.CHEVRON_RIGHT,
            color: BX.UI!.Button.Color.LIGHT_BORDER,
            size: BX.UI!.Button.Size.SMALL,
            round: true,
            onclick: () => this.navigateToNextWeek()
        });

        const calendarBtn = new BX.UI!.Button({
            className: 'bx-booking-nav__btn bx-booking-nav__btn--calendar',
            icon: BX.UI!.Button.Icon.CALENDAR,
            color: BX.UI!.Button.Color.LIGHT_BORDER,
            size: BX.UI!.Button.Size.SMALL,
            round: true,
            onclick: (_button, event) => this.toggleCalendar(event)
        });

        prevBtn.renderTo(section);
        todayBtn.renderTo(section);
        nextBtn.renderTo(section);
        calendarBtn.renderTo(section);

        return section;
    }

    /**
     * Create right section with view mode switcher
     */
    private createRightSection(): HTMLElement {
        const section = createElement('div', { className: 'bx-booking-nav__right' });

        const viewSwitcher = createElement('div', { className: 'bx-booking-nav__view-switcher' });

        // Daily view button
        const dailyBtn = new BX.UI!.Button({
            className: `bx-booking-nav__view-btn ${this.state.viewMode === 'daily' ? 'bx-booking-nav__view-btn--active' : ''}`,
            text: 'Day',
            color: BX.UI!.Button.Color.LIGHT_BORDER,
            size: BX.UI!.Button.Size.SMALL,
            dataset: { view: 'daily' },
            onclick: () => this.setViewMode('daily')
        });

        const weeklyBtn = new BX.UI!.Button({
            className: `bx-booking-nav__view-btn ${this.state.viewMode === 'weekly' ? 'bx-booking-nav__view-btn--active' : ''}`,
            text: 'Week',
            color: BX.UI!.Button.Color.LIGHT_BORDER,
            size: BX.UI!.Button.Size.SMALL,
            dataset: { view: 'weekly' },
            onclick: () => this.setViewMode('weekly')
        });

        dailyBtn.renderTo(viewSwitcher);
        weeklyBtn.renderTo(viewSwitcher);
        section.appendChild(viewSwitcher);

        return section;
    }

    /**
     * Navigate to previous week
     */
    private navigateToPreviousWeek(): void {
        const newDate = getPreviousWeek(this.state.currentDate);
        this.setCurrentDate(newDate);
    }

    /**
     * Navigate to next week
     */
    private navigateToNextWeek(): void {
        const newDate = getNextWeek(this.state.currentDate);
        this.setCurrentDate(newDate);
    }

    /**
     * Navigate to today
     */
    private navigateToToday(): void {
        this.setCurrentDate(new Date());
    }

    /**
     * Set current date and update week
     */
    public setCurrentDate(date: Date): void {
        this.state.currentDate = date;
        this.state.weekStart = getWeekStart(date, this.options.weekStartsOn);
        this.state.weekEnd = getWeekEnd(date, this.options.weekStartsOn);

        this.updateWeekRangeDisplay();
        this.options.onWeekChange(this.state.weekStart, this.state.weekEnd);
    }

    /**
     * Set view mode
     */
    private setViewMode(mode: ViewMode): void {
        if (this.state.viewMode === mode) return;

        this.state.viewMode = mode;
        this.updateViewSwitcherDisplay();
        this.options.onViewModeChange(mode);
    }

    /**
     * Update week range display
     */
    private updateWeekRangeDisplay(): void {
        const weekRangeEl = this.container.querySelector('.bx-booking-nav__week-range');
        if (weekRangeEl) {
            weekRangeEl.textContent = formatWeekRange(
                this.state.weekStart,
                this.state.weekEnd,
                this.options.locale
            );
        }
    }

    /**
     * Update view switcher display
     */
    private updateViewSwitcherDisplay(): void {
        const buttons = this.container.querySelectorAll('.bx-booking-nav__view-btn');
        buttons.forEach(btn => {
            const isActive = btn.getAttribute('data-view') === this.state.viewMode;
            btn.classList.toggle('bx-booking-nav__view-btn--active', isActive);
        });
    }

    /**
     * Toggle calendar popup
     */
    private toggleCalendar(event: Event): void {
        event.stopPropagation();
        
        if (this.calendarPopup) {
            this.closeCalendar();
            return;
        }

        this.openCalendar();
    }

    /**
     * Open calendar popup
     */
    private openCalendar(): void {
        this.calendarPopup = this.createCalendarPopup();
        this.container.appendChild(this.calendarPopup);

        // Close on outside click
        const closeHandler = (e: MouseEvent) => {
            if (this.calendarPopup && !this.calendarPopup.contains(e.target as Node)) {
                this.closeCalendar();
                document.removeEventListener('click', closeHandler);
            }
        };

        setTimeout(() => {
            document.addEventListener('click', closeHandler);
        }, 0);
    }

    /**
     * Close calendar popup
     */
    private closeCalendar(): void {
        if (this.calendarPopup) {
            this.calendarPopup.remove();
            this.calendarPopup = null;
        }
    }

    /**
     * Create calendar popup (mini calendar)
     */
    private createCalendarPopup(): HTMLElement {
        const popup = createElement('div', { className: 'bx-booking-calendar-popup' });
        
        const calendar = this.createMiniCalendar(this.state.currentDate);
        popup.appendChild(calendar);

        return popup;
    }

    /**
     * Create mini calendar for month
     */
    private createMiniCalendar(forDate: Date): HTMLElement {
        const container = createElement('div', { className: 'bx-booking-mini-calendar' });

        // Header with month navigation
        const header = createElement('div', { className: 'bx-booking-mini-calendar__header' });
        
        const prevMonth = new BX.UI!.Button({
            className: 'bx-booking-mini-calendar__nav',
            icon: BX.UI!.Button.Icon.CHEVRON_LEFT,
            color: BX.UI!.Button.Color.LIGHT_BORDER,
            size: BX.UI!.Button.Size.SMALL,
            round: true,
            onclick: (_button, event) => {
                event.stopPropagation();
                const newDate = new Date(forDate);
                newDate.setMonth(newDate.getMonth() - 1);
                container.replaceWith(this.createMiniCalendar(newDate));
            }
        });
        
        const monthLabel = createElement('span', {
            className: 'bx-booking-mini-calendar__month',
            text: forDate.toLocaleDateString(this.options.locale, { month: 'long', year: 'numeric' })
        });
        
        const nextMonth = new BX.UI!.Button({
            className: 'bx-booking-mini-calendar__nav',
            icon: BX.UI!.Button.Icon.CHEVRON_RIGHT,
            color: BX.UI!.Button.Color.LIGHT_BORDER,
            size: BX.UI!.Button.Size.SMALL,
            round: true,
            onclick: (_button, event) => {
                event.stopPropagation();
                const newDate = new Date(forDate);
                newDate.setMonth(newDate.getMonth() + 1);
                container.replaceWith(this.createMiniCalendar(newDate));
            }
        });

        prevMonth.renderTo(header);
        header.appendChild(monthLabel);
        nextMonth.renderTo(header);

        // Days grid
        const grid = createElement('div', { className: 'bx-booking-mini-calendar__grid' });
        
        // Day headers
        const dayNames = this.getDayHeaders();
        for (const dayName of dayNames) {
            grid.appendChild(createElement('div', {
                className: 'bx-booking-mini-calendar__day-name',
                text: dayName
            }));
        }

        // Days
        const days = this.getCalendarDays(forDate);
        for (const day of days) {
            const dayEl = new BX.UI!.Button({
                className: `bx-booking-mini-calendar__day ${day.isCurrentMonth ? '' : 'bx-booking-mini-calendar__day--other'} ${day.isToday ? 'bx-booking-mini-calendar__day--today' : ''}`,
                text: day.date.getDate().toString(),
                color: BX.UI!.Button.Color.LIGHT_BORDER,
                size: BX.UI!.Button.Size.SMALL,
                round: true,
                onclick: () => {
                    this.setCurrentDate(day.date);
                    this.options.onDateSelect(day.date);
                    this.closeCalendar();
                }
            });

            dayEl.renderTo(grid);
        }

        container.appendChild(header);
        container.appendChild(grid);

        return container;
    }

    /**
     * Get day headers based on week start
     */
    private getDayHeaders(): string[] {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        if (this.options.weekStartsOn === 1) {
            return [...days.slice(1), days[0] ?? 'Sun'];
        }
        return days;
    }

    /**
     * Get calendar days for a month
     */
    private getCalendarDays(forDate: Date): CalendarDay[] {
        const days: CalendarDay[] = [];
        const year = forDate.getFullYear();
        const month = forDate.getMonth();
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        // Adjust start day based on week start
        let startDayOfWeek = firstDay.getDay();
        if (this.options.weekStartsOn === 1) {
            startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Days from previous month
        for (let i = startDayOfWeek - 1; i >= 0; i--) {
            const date = new Date(year, month, -i);
            days.push({
                date,
                isCurrentMonth: false,
                isToday: date.getTime() === today.getTime()
            });
        }

        // Days of current month
        for (let i = 1; i <= lastDay.getDate(); i++) {
            const date = new Date(year, month, i);
            days.push({
                date,
                isCurrentMonth: true,
                isToday: date.getTime() === today.getTime()
            });
        }

        // Days from next month to complete grid
        const remaining = 42 - days.length; // 6 rows * 7 days
        for (let i = 1; i <= remaining; i++) {
            const date = new Date(year, month + 1, i);
            days.push({
                date,
                isCurrentMonth: false,
                isToday: date.getTime() === today.getTime()
            });
        }

        return days;
    }

    /**
     * Get current state
     */
    public getState(): NavigationState {
        return { ...this.state };
    }

    /**
     * Destroy component
     */
    public destroy(): void {
        this.closeCalendar();
        this.container.innerHTML = '';
    }
}

interface CalendarDay {
    date: Date;
    isCurrentMonth: boolean;
    isToday: boolean;
}
