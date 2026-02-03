/**
 * Configuration Models
 */

export interface AppConfig {
    culture: CultureSettings;
    view: ViewSettings;
    api: ApiSettings;
}

export interface CultureSettings {
    locale: string;
    weekStartsOn: WeekStartDay;
    dateFormat: string;
    timeFormat: TimeFormat;
    timezone: string;
}

export type WeekStartDay = 0 | 1; // 0 = Sunday, 1 = Monday
export type TimeFormat = '12h' | '24h';
export type ViewMode = 'daily' | 'weekly';

export interface ViewSettings {
    mode: ViewMode;
    showWeekends: boolean;
    defaultTimeSlotMinutes: number;
    workDayStart: string; // HH:mm
    workDayEnd: string;   // HH:mm
}

export interface ApiSettings {
    baseUrl: string;
    accessToken?: string;
    refreshToken?: string;
}

export interface NavigationState {
    currentDate: Date;
    weekStart: Date;
    weekEnd: Date;
    viewMode: ViewMode;
}

export interface CellClickEvent {
    resourceId: number;
    date: Date;
    element: HTMLElement;
}

export interface BookingClickEvent {
    bookingId: number;
    element: HTMLElement;
}
