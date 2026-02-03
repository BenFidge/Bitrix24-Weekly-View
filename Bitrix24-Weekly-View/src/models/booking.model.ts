/**
 * Bitrix24 Booking Models
 */

export interface Booking {
    id: number;
    resourceId: number;
    resourceIds?: number[];  // Booking can span multiple resources
    dateFrom: Date;
    dateTo: Date;
    clientName: string;
    clientPhone: string;
    clientId?: number;
    serviceId?: number;
    serviceName?: string;
    confirmed: boolean;
    notes?: string;
    dealId?: number;
}

export interface BookingCreateRequest {
    resourceId: number;
    dateFrom: string; // ISO format
    dateTo: string;   // ISO format
    clientId?: number;
    serviceId?: number;
    notes?: string;
}

export interface BookingListResponse {
    result: BookingApiItem[];
    total: number;
    next?: number;
}

export interface BookingApiItem {
    ID: string;
    RESOURCE_ID: string;
    DATE_FROM: string;
    DATE_TO: string;
    CLIENT_ID?: string;
    CLIENT_NAME?: string;
    CLIENT_PHONE?: string;
    SERVICE_ID?: string;
    SERVICE_NAME?: string;
    IS_CONFIRMED: string;
    NOTES?: string;
    DEAL_ID?: string;
}

export interface DayBookings {
    date: Date;
    bookings: Booking[];
}

export interface WeeklyResourceBookings {
    resourceId: number;
    resourceName: string;
    resourceAvatar?: string;
    resourceType: string;
    days: DayBookings[];
}
