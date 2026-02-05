import { bitrix24Api } from './bitrix24Api';
import { toDateValue } from '../utils/date';

import type { Resource } from '../models/resource.model';
import type { Booking, BookingApiItem, WeeklyResourceBookings, DayBookings } from '../models/booking.model';
import type { WeekStartDay } from '../models/config.model';

function extractApiItems(data: any): BookingApiItem[] {
    if (!data) return [];
    // BX24.callMethod returns result.data(); depending on the method this may be:
    // - { result: [...] }
    // - { bookings: [...] }
    // - { booking: [...] }
    // - [...] (already an array)
    if (Array.isArray(data)) return data as BookingApiItem[];
    if (Array.isArray((data as any).result)) return (data as any).result as BookingApiItem[];
    if (Array.isArray((data as any).bookings)) return (data as any).bookings as BookingApiItem[];
    if (Array.isArray((data as any).booking)) return (data as any).booking as BookingApiItem[];
    if ((data as any).result) {
        const r = (data as any).result;
        if (Array.isArray(r.items)) return r.items as BookingApiItem[];
        if (Array.isArray(r.bookings)) return r.bookings as BookingApiItem[];
        if (Array.isArray(r.booking)) return r.booking as BookingApiItem[];
    }
    return [];
}

function extractApiItem(data: any): BookingApiItem | null {
    if (!data) return null;
    if ((data as any).booking) return (data as any).booking as BookingApiItem;
    if ((data as any).result) return (data as any).result as BookingApiItem;
    return data as BookingApiItem;
}

function parseDateRaw(val: any): Date {
    if (!val) return new Date(0);
    if (val instanceof Date) return val;
    if (typeof val === 'string') return new Date(val);
    if (typeof val === 'object') {
        if (typeof val.timestamp === 'number') return new Date(val.timestamp * 1000);
        // Try common fields for date objects
        const v = val.value ?? val.date ?? val.iso ?? val;
        // If it resolved to a string, parse it
        if (typeof v === 'string') return new Date(v);
        // If it's still an object (e.g. datePeriod.from might be { ... }), try to JSON stringify or just fallback
    }
    return new Date(0);
}

function toBooking(item: any): Booking {
    // Support both API-style (UPPERCASE) and any future camelCase shape.
    const id = Number(item.ID ?? item.id ?? 0);

    // Resource IDs: prefer array (RESOURCE_IDS / resourceIds)
    let ids: number[] | undefined;
    const rawIds = item.RESOURCE_IDS ?? item.resourceIds ?? item.resource_ids;
    if (Array.isArray(rawIds)) {
        ids = rawIds.map((x: any) => Number(x));
    }

    // Single Resource ID: fallback to first item of array if missing
    let resourceId = Number(item.RESOURCE_ID ?? item.resourceId ?? item.resource_id ?? 0);
    if (!resourceId && ids && ids.length > 0) {
        resourceId = ids[0];
    }

    const dateFromRaw = item.DATE_FROM ?? item.dateFrom ?? item.date_from ?? item.datePeriod?.from;
    const dateToRaw = item.DATE_TO ?? item.dateTo ?? item.date_to ?? item.datePeriod?.to;

    const dateFrom = parseDateRaw(dateFromRaw);
    const dateTo = parseDateRaw(dateToRaw);

    return {
        id,
        resourceId,
        resourceIds: ids,
        dateFrom,
        dateTo,
        clientId: item.CLIENT_ID ? Number(item.CLIENT_ID) : undefined,
        clientName: String(item.CLIENT_NAME ?? item.clientName ?? ''),
        clientPhone: String(item.CLIENT_PHONE ?? item.clientPhone ?? ''),
        serviceId: item.SERVICE_ID ? Number(item.SERVICE_ID) : undefined,
        serviceName: item.SERVICE_NAME ? String(item.SERVICE_NAME) : undefined,
        confirmed: String(item.IS_CONFIRMED ?? item.confirmed ?? 'N') === 'Y',
        notes: item.NOTES ? String(item.NOTES) : undefined,
        dealId: item.DEAL_ID ? Number(item.DEAL_ID) : undefined
    };
}

function startOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function endOfDayExclusive(d: Date): Date {
    const x = startOfDay(d);
    x.setDate(x.getDate() + 1);
    return x;
}

function overlapsDay(b: Booking, day: Date): boolean {
    const s = startOfDay(day);
    const e = endOfDayExclusive(day);
    // booking overlaps day if starts before end and ends after start
    return b.dateFrom < e && b.dateTo > s;
}

function buildWeekDays(weekStart: Date): Date[] {
    const days: Date[] = [];
    const base = startOfDay(weekStart);
    for (let i = 0; i < 7; i++) {
        const d = new Date(base);
        d.setDate(base.getDate() + i);
        days.push(d);
    }
    return days;
}

export const bookingService = {
    async getBooking(bookingId: number | string): Promise<BookingApiItem> {
        const data = await bitrix24Api.callMethod<any>('booking.v1.booking.get', {
            bookingId: String(bookingId)
        });
        const booking = extractApiItem(data);
        if (!booking) {
            throw new Error('Booking not found');
        }
        return booking;
    },

    async createBookingViaApi(payload: { resourceId: number; dateFrom: string; dateTo: string; clientId?: number; serviceId?: number; notes?: string; }): Promise<void> {
        await bitrix24Api.callMethod('booking.v1.booking.add', {
            fields: {
                resourceId: payload.resourceId,
                dateFrom: payload.dateFrom,
                dateTo: payload.dateTo,
                clientId: payload.clientId,
                serviceId: payload.serviceId,
                notes: payload.notes
            }
        });
    },

    async updateBookingViaApi(bookingId: number | string, payload: { resourceId: number; dateFrom: string; dateTo: string; clientId?: number; serviceId?: number; notes?: string; }): Promise<void> {
        await bitrix24Api.callMethod('booking.v1.booking.update', {
            bookingId: String(bookingId),
            fields: {
                resourceId: payload.resourceId,
                dateFrom: payload.dateFrom,
                dateTo: payload.dateTo,
                clientId: payload.clientId,
                serviceId: payload.serviceId,
                notes: payload.notes
            }
        });
    },

    /**
     * Loads bookings for a week and shapes them into the UI structure expected by weekly-view.ts.
     */
    async getWeeklyBookings(weekStart: Date, resources: Resource[], _weekStartsOn?: WeekStartDay): Promise<WeeklyResourceBookings[]> {
        const weekDays = buildWeekDays(weekStart);

        // Use ISO-8601 for Bitrix booking API filters per spec
        const fromDate = new Date(weekDays[0]);
        fromDate.setHours(0, 0, 0, 0);

        const toDate = new Date(fromDate);
        toDate.setDate(toDate.getDate() + 7); // +7 days covers the full week

        const from = fromDate.toISOString();
        const to = toDate.toISOString();

        // Note: method name is per Bitrix booking REST.
        // We filter by date range server-side, then group client-side by resource.
        const data = await bitrix24Api.callMethod<any>('booking.v1.booking.list', {
            filter: {
                '>=dateFrom': from,
                '<dateFrom': to
            }
        });
        console.log('booking.v1.booking.list', { from, to, data });

        const apiItems = extractApiItems(data);
        const allBookings = apiItems.map(toBooking).filter(b => b.id && (b.resourceId || (b.resourceIds && b.resourceIds.length > 0)));

        return resources.map((r) => {
            const resourceBookings = allBookings.filter(b => 
                b.resourceId === r.id || (b.resourceIds && b.resourceIds.includes(r.id))
            );

            const days: DayBookings[] = weekDays.map((day) => ({
                date: day,
                bookings: resourceBookings.filter(b => overlapsDay(b, day))
            }));

            return {
                resourceId: r.id,
                resourceName: r.name,
                resourceAvatar: r.avatar,
                resourceType: r.type,
                days
            };
        });
    },

    async openNativeCreate(resourceId: number, day: Date): Promise<void> {
        await bitrix24Api.openApplicationInSlider({
            view: 'booking-create',
            date: toDateValue(day),
            resourceId: String(resourceId)
        }, 750);
    },

    async openNativeEdit(bookingId: number | string): Promise<void> {
        await bitrix24Api.openApplicationInSlider({
            view: 'booking-edit',
            bookingId: String(bookingId)
        }, 750);
    }
};
