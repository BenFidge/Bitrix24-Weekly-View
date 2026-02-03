/**
 * Booking Service
 * Handles all booking-related API operations
 * Note: Bitrix24 Booking module REST API may not be publicly available
 * This service attempts multiple approaches to fetch booking data
 */

import { bitrix24Api } from './bitrix24.api.js';
import type { Booking, BookingApiItem, BookingCreateRequest, WeeklyResourceBookings, DayBookings } from '../models/booking.model.js';
import type { Resource } from '../models/resource.model.js';
import { getWeekDays, isSameDay, toISOString } from '../utils/date.utils.js';
import type { WeekStartDay } from '../models/config.model.js';

export class BookingService {
    private apiAvailable: boolean | null = null;

    /**
     * Get bookings for a date range
     * Uses Bitrix24 Booking API v1: https://apidocs.bitrix24.com/api-reference/booking/
     */
    async getBookings(startDate: Date, endDate: Date, resourceIds?: number[]): Promise<Booking[]> {
        try {
            console.log('[BookingService] Calling booking.v1.booking.list');
            return await this.fetchBookingsFromApi(startDate, endDate, resourceIds);
        } catch (error) {
            console.error('[BookingService] booking.v1.booking.list failed:', error);
            return [];
        }
    }

    /**
     * Fetch bookings from Bitrix24 Booking API v1
     */
    private async fetchBookingsFromApi(startDate: Date, endDate: Date, resourceIds?: number[]): Promise<Booking[]> {
        // Try different filter formats as the API documentation is unclear
        const filter: Record<string, unknown> = {
            '>=dateFrom': toISOString(startDate),
            '<=dateFrom': toISOString(endDate)  // Filter by start date within range
        };

        if (resourceIds && resourceIds.length > 0) {
            filter['resourceId'] = resourceIds;
        }

        console.log('[BookingService] Calling booking.v1.booking.list with filter:', JSON.stringify(filter));

        const response = await bitrix24Api.callMethod<BookingListResponse>('booking.v1.booking.list', {
            filter
        });

        console.log('[BookingService] Raw API response:', JSON.stringify(response, null, 2));

        // Handle response - API returns { booking: [...] } with datePeriod objects
        let items: BookingApiResponseItem[] = [];

        if (response && typeof response === 'object') {
            // Check for 'booking' key (actual API format)
            if ('booking' in response && Array.isArray((response as { booking: BookingApiResponseItem[] }).booking)) {
                items = (response as { booking: BookingApiResponseItem[] }).booking;
            } else if ('bookings' in response && Array.isArray(response.bookings)) {
                items = response.bookings;
            } else if ('result' in response && Array.isArray(response.result)) {
                // Handle { result: [...] } format
                items = response.result as unknown as BookingApiResponseItem[];
            } else if (Array.isArray(response)) {
                items = response as unknown as BookingApiResponseItem[];
            }
        }

        console.log(`[BookingService] ✓ Loaded ${items.length} bookings`);
        console.log('[BookingService] Parsed items:', items.map(i => ({ id: i.id, resourceIds: (i as unknown as Record<string, unknown>).resourceIds })));

        return items.map(item => this.mapBookingApiResponse(item));
    }

    /**
     * Map Booking API response to Booking model
     * Handles both camelCase (v1 API) and UPPERCASE (legacy) field names
     * Also handles datePeriod.from/to with timestamp format
     */
    private mapBookingApiResponse(item: BookingApiResponseItem): Booking {
        // Handle both camelCase and UPPERCASE field names from API
        const rawItem = item as unknown as Record<string, unknown>;

        // Handle datePeriod format: { from: { timestamp, timezone }, to: { timestamp, timezone } }
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

        // Handle resourceIds array - return first resource or 0
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

    /**
     * Get bookings for a specific week organized by resource and day
     */
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

        // Extend end date to include full day
        const endDate = new Date(weekEndDate);
        endDate.setHours(23, 59, 59, 999);

        // Get all bookings for the week
        const resourceIds = resources.map(r => r.id);
        const allBookings = await this.getBookings(weekStartDate, endDate, resourceIds);

        // Organize bookings by resource and day
        return resources.map(resource => {
            // Filter bookings where resourceIds includes this resource, or fallback to resourceId match
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

    /**
     * Get a single booking by ID
     */
    async getBooking(bookingId: number): Promise<Booking | null> {
        try {
            const result = await bitrix24Api.callMethod<BookingApiItem>('booking.booking.get', {
                id: bookingId
            });

            return result ? this.mapApiToBooking(result) : null;
        } catch (error) {
            console.error(`[BookingService] Failed to get booking ${bookingId}:`, error);
            return null;
        }
    }

    /**
     * Create a new booking using the native Bitrix24 dialog
     */
    openCreateBookingDialog(resourceId: number, date: Date): void {
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
        console.log('[BookingService] Opening create booking dialog:', { resourceId, date: dateStr });

        // Method 1: Try native Bitrix24 booking slider
        if (typeof BX !== 'undefined' && BX.Booking?.Slider) {
            console.log('[BookingService] Using BX.Booking.Slider');
            BX.Booking.Slider.open({
                resourceId,
                date: dateStr
            });
            return;
        }

        // Method 2: Try BX.SidePanel for native booking page
        if (typeof BX !== 'undefined' && BX.SidePanel?.Instance) {
            console.log('[BookingService] Using BX.SidePanel');
            const url = `/booking/resource/${resourceId}/?date=${dateStr}&action=add`;
            BX.SidePanel.Instance.open(url, {
                width: 500,
                cacheable: false,
                allowChangeHistory: false
            });
        }
    }

    /**
     * Open an existing booking for editing
     */
    openEditBookingDialog(bookingId: number): void {
        console.log('[BookingService] Opening edit booking dialog:', { bookingId });

        // Try native slider first
        if (typeof BX !== 'undefined' && BX.Booking?.Slider) {
            console.log('[BookingService] Using BX.Booking.Slider for edit');
            BX.Booking.Slider.open({
                bookingId
            });
            return;
        }

        // Fallback: Use BX.SidePanel if Booking slider is unavailable
        if (typeof BX !== 'undefined' && BX.SidePanel?.Instance) {
            console.log('[BookingService] Using BX.SidePanel for edit');
            const url = `/booking/booking/${bookingId}/`;
            BX.SidePanel.Instance.open(url, {
                width: 500,
                cacheable: false,
                allowChangeHistory: false
            });
        }
    }

    /**
     * Create a booking via API (programmatic)
     * Uses booking.v1.booking.add
     */
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

    /**
     * Create a booking via API
     */
    async createBookingViaApi(request: {
        resourceId: number;
        dateFrom: string;
        dateTo: string;
        clientId?: number;
        serviceId?: number;
        notes?: string;
    }): Promise<{ id: number } | null> {
        try {
            console.log('[BookingService] Creating booking via API:', request);

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

            console.log('[BookingService] Booking created:', result);

            // Handle various response formats
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
        } catch (error) {
            console.error('[BookingService] Failed to create booking:', error);
            throw error;
        }
    }

    /**
     * Set client for a booking
     * Uses booking.v1.booking.client.set
     */
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

    /**
     * Delete a booking
     * Uses booking.v1.booking.delete
     */
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

    /**
     * Confirm a booking
     */
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

    /**
     * Get booking statistics for a date range
     */
    async getBookingStats(startDate: Date, endDate: Date): Promise<BookingStats> {
        const bookings = await this.getBookings(startDate, endDate);

        return {
            total: bookings.length,
            confirmed: bookings.filter(b => b.confirmed).length,
            unconfirmed: bookings.filter(b => !b.confirmed).length,
            byResource: this.groupByResource(bookings)
        };
    }

    /**
     * Group bookings by resource
     */
    private groupByResource(bookings: Booking[]): Map<number, number> {
        const grouped = new Map<number, number>();
        
        for (const booking of bookings) {
            const count = grouped.get(booking.resourceId) ?? 0;
            grouped.set(booking.resourceId, count + 1);
        }
        
        return grouped;
    }

    /**
     * Map API response to Booking model
     */
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

    /**
     * Subscribe to booking events
     */
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
}

interface BookingStats {
    total: number;
    confirmed: number;
    unconfirmed: number;
    byResource: Map<number, number>;
}

interface BookingEventCallbacks {
    onBookingCreated?: (event: unknown) => void;
    onBookingUpdated?: (event: unknown) => void;
    onBookingDeleted?: (event: unknown) => void;
}

interface CalendarEvent {
    ID: string;
    OWNER_ID?: string;
    NAME?: string;
    DESCRIPTION?: string;
    DATE_FROM: string;
    DATE_TO: string;
}

interface CrmActivity {
    ID: string;
    SUBJECT?: string;
    START_TIME: string;
    END_TIME: string;
    RESPONSIBLE_ID?: string;
    COMMUNICATIONS?: CrmCommunication[];
}

interface CrmCommunication {
    TYPE?: string;
    VALUE?: string;
}

// Bitrix24 Booking API response types
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

// Export singleton instance
export const bookingService = new BookingService();
