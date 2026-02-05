/**
 * Booking Service
 * Handles all booking-related API operations
 */

import { bitrix24Api } from './bitrix24Api';
import type { Booking, BookingApiItem, BookingCreateRequest, WeeklyResourceBookings, DayBookings } from '../models/booking.model';
import type { Resource } from '../models/resource.model';
import { getWeekDays, isSameDay, toISOString } from '../utils/date.utils';
import type { WeekStartDay } from '../models/config.model';

export class BookingService {
    private getBx(): typeof BX | undefined {
        if (typeof BX !== 'undefined') {
            return BX;
        }

        if (typeof window !== 'undefined' && window.top && window.top !== window.self) {
            try {
                const topWindow = window.top as Window & { BX?: typeof BX };
                void topWindow.location.href;
                return topWindow.BX;
            } catch {
                return undefined;
            }
        }

        return undefined;
    }
    async getBookings(startDate: Date, endDate: Date, resourceIds?: number[]): Promise<Booking[]> {
        try {
            console.log('[BookingService] Calling booking.v1.booking.list');
            return await this.fetchBookingsFromApi(startDate, endDate, resourceIds);
        } catch (error) {
            console.error('[BookingService] booking.v1.booking.list failed:', error);
            return [];
        }
    }

    private async fetchBookingsFromApi(startDate: Date, endDate: Date, resourceIds?: number[]): Promise<Booking[]> {
        const filter: Record<string, unknown> = {
            '>=dateFrom': toISOString(startDate),
            '<=dateFrom': toISOString(endDate)
        };

        if (resourceIds && resourceIds.length > 0) {
            filter['resourceId'] = resourceIds;
        }

        const response = await bitrix24Api.callMethod<BookingListResponse>('booking.v1.booking.list', {
            filter
        });

        let items: BookingApiResponseItem[] = [];

        if (response && typeof response === 'object') {
            if ('booking' in response && Array.isArray((response as { booking: BookingApiResponseItem[] }).booking)) {
                items = (response as { booking: BookingApiResponseItem[] }).booking;
            } else if ('bookings' in response && Array.isArray(response.bookings)) {
                items = response.bookings;
            } else if ('result' in response && Array.isArray(response.result)) {
                items = response.result as unknown as BookingApiResponseItem[];
            } else if (Array.isArray(response)) {
                items = response as unknown as BookingApiResponseItem[];
            }
        }

        return items.map(item => this.mapBookingApiResponse(item));
    }

    private mapBookingApiResponse(item: BookingApiResponseItem): Booking {
        const rawItem = item as unknown as Record<string, unknown>;

        let dateFrom: Date;
        let dateTo: Date;

        const datePeriod = rawItem.datePeriod as { from?: { timestamp?: number }; to?: { timestamp?: number } } | undefined;
        if (datePeriod?.from?.timestamp) {
            dateFrom = new Date(datePeriod.from.timestamp * 1000);
        } else {
            dateFrom = new Date((rawItem.dateFrom ?? rawItem.DATE_FROM ?? rawItem.date_from ?? '') as string);
        }

        if (datePeriod?.to?.timestamp) {
            dateTo = new Date(datePeriod.to.timestamp * 1000);
        } else {
            dateTo = new Date((rawItem.dateTo ?? rawItem.DATE_TO ?? rawItem.date_to ?? '') as string);
        }

        let resourceId = 0;
        const resourceIds = rawItem.resourceIds as number[] | undefined;
        if (resourceIds && Array.isArray(resourceIds) && resourceIds.length > 0) {
            resourceId = resourceIds[0];
        } else {
            resourceId = (rawItem.resourceId ?? rawItem.RESOURCE_ID ?? rawItem.resource_id ?? 0) as number;
        }

        return {
            id: (rawItem.id ?? rawItem.ID ?? 0) as number,
            resourceId,
            resourceIds: resourceIds ?? [resourceId],
            dateFrom,
            dateTo,
            clientName: (rawItem.clientName ?? rawItem.CLIENT_NAME ?? rawItem.client_name ?? rawItem.name ?? 'Customer') as string,
            clientPhone: (rawItem.clientPhone ?? rawItem.CLIENT_PHONE ?? rawItem.client_phone ?? '') as string,
            clientId: (rawItem.clientId ?? rawItem.CLIENT_ID ?? rawItem.client_id) as number | undefined,
            serviceId: (rawItem.serviceId ?? rawItem.SERVICE_ID ?? rawItem.service_id) as number | undefined,
            serviceName: (rawItem.serviceName ?? rawItem.SERVICE_NAME ?? rawItem.service_name) as string | undefined,
            confirmed: Boolean(rawItem.isConfirmed ?? rawItem.IS_CONFIRMED ?? rawItem.is_confirmed ?? true),
            notes: (rawItem.notes ?? rawItem.NOTES ?? rawItem.description) as string | undefined
        };
    }

    async getWeeklyBookings(
        weekStartDate: Date,
        resources: Resource[],
        weekStartsOn: WeekStartDay
    ): Promise<WeeklyResourceBookings[]> {
        const weekDays = getWeekDays(weekStartDate, weekStartsOn);
        const weekEndDate = weekDays[6];

        if (!weekEndDate) {
            return [];
        }

        const endDate = new Date(weekEndDate);
        endDate.setHours(23, 59, 59, 999);

        const resourceIds = resources.map(r => r.id);
        const allBookings = await this.getBookings(weekStartDate, endDate, resourceIds);

        return resources.map(resource => {
            const resourceBookings = allBookings.filter(b =>
                (b.resourceIds && b.resourceIds.includes(resource.id)) ||
                b.resourceId === resource.id
            );

            const days: DayBookings[] = weekDays.map(day => ({
                date: day,
                bookings: resourceBookings
                    .filter(b => isSameDay(b.dateFrom, day))
                    .sort((a, b) => a.dateFrom.getTime() - b.dateFrom.getTime())
            }));

            return {
                resourceId: resource.id,
                resourceName: resource.name,
                resourceAvatar: resource.avatar,
                resourceType: resource.type,
                days
            };
        });
    }

    async getBooking(bookingId: number): Promise<Booking | null> {
        try {
            // The v1 namespace is the current Booking API.
            // Calling the legacy method name can 404 on some portals.
            const result = await bitrix24Api.callMethod<BookingApiItem>('booking.v1.booking.get', {
                id: bookingId
            });

            return result ? this.mapApiToBooking(result) : null;
        } catch (error) {
            console.error(`[BookingService] Failed to get booking ${bookingId}:`, error);
            return null;
        }
    }

    openCreateBookingDialog(resourceId: number, date: Date): void {
        const dateStr = date.toISOString().split('T')[0];
        const bx = this.getBx();

        if (bx?.SidePanel?.Instance) {
            const url = `/booking/resource/${resourceId}/?date=${dateStr}&action=add`;
            const width = typeof window !== 'undefined'
                ? Math.min(900, Math.max(360, window.innerWidth - 40))
                : 900;

            bx.SidePanel.Instance.open(url, {
                width,
                cacheable: false,
                allowChangeHistory: false
            });
            return;
        }

        if (bx?.SidePanel?.open) {
            const url = `/booking/resource/${resourceId}/?date=${dateStr}&action=add`;
            const width = typeof window !== 'undefined'
                ? Math.min(900, Math.max(360, window.innerWidth - 40))
                : 900;

            bx.SidePanel.open(url, {
                width,
                cacheable: false,
                allowChangeHistory: false
            });
            return;
        }

        if (bx?.Booking?.Slider) {
            bx.Booking.Slider.open({
                resourceId,
                date: dateStr
            });
            return;
        }

        // Fallback for iframe apps where `BX` is not accessible due to cross-origin.
        // BX24.openPath opens the internal Bitrix24 page in a slider.
        const url = `/booking/resource/${resourceId}/?date=${dateStr}&action=add`;
        void bitrix24Api.openPath(url).catch((error) => {
            console.warn('[BookingService] Failed to open create booking via BX24.openPath:', error);
        });
    }

    openNativeCreate(resourceId: number, date: Date): void {
        const dateStr = date.toISOString().split('T')[0];

        if (typeof BX !== 'undefined' && BX.Booking?.Slider?.open) {
            BX.Booking.Slider.open({
                resourceId,
                date: dateStr
            });
            return;
        }

        bitrix24Api.openApplication({
            view: 'booking-create',
            resourceId,
            date: dateStr
        });
    }

    openEditBookingDialog(bookingId: number): void {
        if (typeof BX !== 'undefined' && BX.Booking?.Slider) {
            BX.Booking.Slider.open({
                bookingId
            });
            return;
        }

        if (typeof BX !== 'undefined' && BX.SidePanel?.Instance) {
            const url = `/booking/booking/${bookingId}/`;
            BX.SidePanel.Instance.open(url, {
                width: typeof window !== 'undefined'
                    ? Math.min(900, Math.max(360, window.innerWidth - 40))
                    : 900,
                cacheable: false,
                allowChangeHistory: false
            });
            return;
        }

        // Fallback for iframe apps
        const url = `/booking/booking/${bookingId}/`;
        void bitrix24Api.openPath(url).catch((error) => {
            console.warn('[BookingService] Failed to open edit booking via BX24.openPath:', error);
        });
    }

    openNativeEdit(bookingId: number): void {
        if (typeof BX !== 'undefined' && BX.Booking?.Slider?.open) {
            BX.Booking.Slider.open({
                bookingId
            });
            return;
        }

        void bitrix24Api.openApplication({
            view: 'booking-edit',
            bookingId
        });
    }

    async createBooking(request: BookingCreateRequest): Promise<Booking | null> {
        const result = await this.createBookingViaApi({
            resourceId: request.resourceId,
            dateFrom: request.dateFrom,
            dateTo: request.dateTo,
            clientId: request.clientId,
            serviceId: request.serviceId,
            notes: request.notes
        });

        if (result?.id) {
            return this.getBooking(result.id);
        }
        return null;
    }

    async createBookingViaApi(request: {
        resourceId: number;
        dateFrom: string;
        dateTo: string;
        clientId?: number;
        serviceId?: number;
        notes?: string;
    }): Promise<{ id: number } | null> {
        const params: Record<string, unknown> = {
            resourceId: request.resourceId,
            dateFrom: request.dateFrom,
            dateTo: request.dateTo
        };

        if (request.notes) {
            params.description = request.notes;
        }

        const result = await bitrix24Api.callMethod<{ id?: number; booking?: { id: number } }>(
            'booking.v1.booking.add',
            params
        );

        if (result?.id) {
            return { id: result.id };
        }
        if (result?.booking?.id) {
            return { id: result.booking.id };
        }
        if (typeof result === 'number') {
            return { id: result };
        }

        return null;
    }

    async updateBookingViaApi(bookingId: number, request: {
        resourceId?: number;
        dateFrom?: string;
        dateTo?: string;
        clientId?: number;
        serviceId?: number;
        notes?: string;
        isConfirmed?: boolean;
    }): Promise<boolean> {
        const params: Record<string, unknown> = {
            id: bookingId,
            ...request
        };

        if (request.notes) {
            params.description = request.notes;
        }

        try {
            await bitrix24Api.callMethod('booking.v1.booking.update', params);
            return true;
        } catch (error) {
            console.error('[BookingService] Failed to update booking:', error);
            return false;
        }
    }

    async setBookingClient(
        bookingId: number,
        entityId: number,
        entityType: 'contact' | 'company' | 'lead' = 'contact'
    ): Promise<boolean> {
        try {
            await bitrix24Api.callMethod('booking.v1.booking.client.set', {
                bookingId,
                clients: [{
                    entityId,
                    entityType: entityType.toUpperCase()
                }]
            });
            return true;
        } catch (error) {
            console.error('[BookingService] Failed to set booking client:', error);
            return false;
        }
    }

    async deleteBooking(bookingId: number): Promise<boolean> {
        try {
            await bitrix24Api.callMethod('booking.v1.booking.delete', {
                id: bookingId
            });
            return true;
        } catch (error) {
            console.error(`[BookingService] Failed to delete booking ${bookingId}:`, error);
            return false;
        }
    }

    async confirmBooking(bookingId: number): Promise<boolean> {
        try {
            await bitrix24Api.callMethod('booking.v1.booking.update', {
                id: bookingId,
                isConfirmed: true
            });
            return true;
        } catch (error) {
            console.error(`[BookingService] Failed to confirm booking ${bookingId}:`, error);
            return false;
        }
    }

    subscribeToBookingEvents(callbacks: BookingEventCallbacks): void {
        if (typeof BX !== 'undefined' && BX.Event?.EventEmitter) {
            if (callbacks.onBookingCreated) {
                BX.Event.EventEmitter.subscribe(
                    window,
                    'booking:created',
                    callbacks.onBookingCreated
                );
            }
            if (callbacks.onBookingUpdated) {
                BX.Event.EventEmitter.subscribe(
                    window,
                    'booking:updated',
                    callbacks.onBookingUpdated
                );
            }
            if (callbacks.onBookingDeleted) {
                BX.Event.EventEmitter.subscribe(
                    window,
                    'booking:deleted',
                    callbacks.onBookingDeleted
                );
            }
        }
    }

    private mapApiToBooking(item: BookingApiItem): Booking {
        return {
            id: parseInt(item.ID, 10),
            resourceId: parseInt(item.RESOURCE_ID, 10),
            dateFrom: new Date(item.DATE_FROM),
            dateTo: new Date(item.DATE_TO),
            clientName: item.CLIENT_NAME ?? 'Unknown',
            clientPhone: item.CLIENT_PHONE ?? '',
            clientId: item.CLIENT_ID ? parseInt(item.CLIENT_ID, 10) : undefined,
            serviceId: item.SERVICE_ID ? parseInt(item.SERVICE_ID, 10) : undefined,
            serviceName: item.SERVICE_NAME,
            confirmed: item.IS_CONFIRMED === 'Y' || item.IS_CONFIRMED === '1',
            notes: item.NOTES,
            dealId: item.DEAL_ID ? parseInt(item.DEAL_ID, 10) : undefined
        };
    }
}

interface BookingListResponse {
    bookings?: BookingApiResponseItem[];
}

interface BookingApiResponseItem {
    id: number;
    resourceId: number;
    dateFrom: string;
    dateTo: string;
    clientId?: number;
    clientName?: string;
    clientPhone?: string;
    serviceId?: number;
    serviceName?: string;
    isConfirmed?: boolean;
    notes?: string;
}

interface BookingEventCallbacks {
    onBookingCreated?: (event: unknown) => void;
    onBookingUpdated?: (event: unknown) => void;
    onBookingDeleted?: (event: unknown) => void;
}

export const bookingService = new BookingService();
