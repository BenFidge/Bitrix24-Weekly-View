/**
 * Slot Service
 * Handles time slot calculations for resources
 */

import { bitrix24Api } from './bitrix24.api.js';

export interface TimeSlot {
    startTime: string;  // HH:MM format
    endTime: string;    // HH:MM format
    available: boolean;
    resourceIds: number[];  // Resources available for this slot
}

export interface ResourceSlotConfig {
    resourceId: number;
    workStart: string;  // HH:MM
    workEnd: string;    // HH:MM
    slotDuration: number;  // minutes
    blockedSlots: Array<{ start: string; end: string }>;
}

interface BookingItem {
    id: number;
    resourceId: number;
    dateFrom: string;
    dateTo: string;
}

interface SlotApiResponse {
    slots?: Array<{
        from?: string;
        to?: string;
        duration?: number;
    }>;
}

interface BusyTimeItem {
    dateFrom?: string;
    dateTo?: string;
    DATE_FROM?: string;
    DATE_TO?: string;
    from?: string;
    to?: string;
}

// Response can be either an array or an object with busyTimes array
type BusyTimeResponse = BusyTimeItem[] | { busyTimes: BusyTimeItem[] };

export class SlotService {
    private readonly DEFAULT_SLOT_DURATION = 60; // minutes
    private readonly DEFAULT_START_TIME = '08:00';
    private readonly DEFAULT_END_TIME = '20:00';

    /**
     * Get available time slots for given resources on a specific date
     */
    async getAvailableSlots(
        resourceIds: number[],
        date: Date,
        slotDuration = this.DEFAULT_SLOT_DURATION
    ): Promise<TimeSlot[]> {
        console.log('[SlotService] Getting slots for resources:', resourceIds, 'date:', date);

        if (resourceIds.length === 0) {
            return this.generateDefaultSlots(slotDuration, [], []);
        }

        try {
            // Fetch resource slot configurations (working hours, blocked times)
            const resourceConfigs = await this.getResourceConfigs(resourceIds, date);

            // Fetch existing bookings for this date
            const existingBookings = await this.getBookingsForDate(resourceIds, date);
            console.log('[SlotService] Found existing bookings:', existingBookings.length);

            // Generate slots based on configs and bookings
            const slots = this.generateSlots(
                resourceIds,
                date,
                resourceConfigs,
                existingBookings,
                slotDuration
            );

            return slots;
        } catch (error) {
            console.error('[SlotService] Failed to get available slots:', error);
            return this.generateDefaultSlots(slotDuration, resourceIds, []);
        }
    }

    /**
     * Get resource configurations (working hours, blocked slots)
     */
    private async getResourceConfigs(resourceIds: number[], date: Date): Promise<ResourceSlotConfig[]> {
        const configs: ResourceSlotConfig[] = [];
        const dateStr = this.formatDateForApi(date);

        for (const resourceId of resourceIds) {
            try {
                // Get resource slot configuration
                const slotsResponse = await bitrix24Api.callMethod<SlotApiResponse>(
                    'booking.v1.resource.slots.list',
                    { resourceId }
                );

                console.log(`[SlotService] Slot config for resource ${resourceId}:`, JSON.stringify(slotsResponse, null, 2));

                // Parse the response to extract working hours
                const config: ResourceSlotConfig = {
                    resourceId,
                    workStart: this.DEFAULT_START_TIME,
                    workEnd: this.DEFAULT_END_TIME,
                    slotDuration: this.DEFAULT_SLOT_DURATION,
                    blockedSlots: []
                };

                if (slotsResponse?.slots && Array.isArray(slotsResponse.slots)) {
                    // Find slot config for this day of week
                    for (const slot of slotsResponse.slots) {
                        if (slot.from) {
                            config.workStart = slot.from;
                        }
                        if (slot.to) {
                            config.workEnd = slot.to;
                        }
                        if (slot.duration) {
                            config.slotDuration = slot.duration;
                        }
                    }
                }

                // Get busy/blocked times for this resource on this date
                // Note: This endpoint may not be available in all Bitrix24 instances
                // We'll fall back to using booking data if it fails
                try {
                    const busyResponse = await bitrix24Api.callMethod<BusyTimeResponse>(
                        'booking.v1.resourceBusyTime.list',
                        { 
                            resourceId,
                            dateFrom: `${dateStr}T00:00:00`,
                            dateTo: `${dateStr}T23:59:59`
                        }
                    );

                    console.log(`[SlotService] Busy times for resource ${resourceId}:`, JSON.stringify(busyResponse, null, 2));

                    // Parse busy times into blocked slots
                    let busyItems: BusyTimeItem[] = [];

                    if (Array.isArray(busyResponse)) {
                        busyItems = busyResponse;
                    } else if (busyResponse && 'busyTimes' in busyResponse && Array.isArray(busyResponse.busyTimes)) {
                        busyItems = busyResponse.busyTimes;
                    }

                    for (const busy of busyItems) {
                        const from = busy.dateFrom ?? busy.DATE_FROM ?? busy.from;
                        const to = busy.dateTo ?? busy.DATE_TO ?? busy.to;
                        if (from && to) {
                            // Extract time portion
                            const startTime = new Date(from);
                            const endTime = new Date(to);
                            config.blockedSlots.push({
                                start: `${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}`,
                                end: `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`
                            });
                        }
                    }

                    console.log(`[SlotService] Parsed blocked slots for resource ${resourceId}:`, config.blockedSlots);
                } catch {
                    // resourceBusyTime.list may not be available - this is expected
                    // Busy times will be derived from actual bookings in getBookingsForDate
                    console.log(`[SlotService] resourceBusyTime.list not available for resource ${resourceId} - using booking data instead`);
                }


                configs.push(config);
            } catch (error) {
                console.warn(`[SlotService] Could not get config for resource ${resourceId}:`, error);
                // Use default config
                configs.push({
                    resourceId,
                    workStart: this.DEFAULT_START_TIME,
                    workEnd: this.DEFAULT_END_TIME,
                    slotDuration: this.DEFAULT_SLOT_DURATION,
                    blockedSlots: []
                });
            }
        }

        return configs;
    }

    /**
     * Get existing bookings for a date
     */
    private async getBookingsForDate(resourceIds: number[], date: Date): Promise<BookingItem[]> {
        const dateStr = this.formatDateForApi(date);

        try {
            // Try to get bookings from the API
            const filter = {
                resourceId: resourceIds,
                '>=dateFrom': `${dateStr}T00:00:00`,
                '<=dateFrom': `${dateStr}T23:59:59`
            };

            console.log('[SlotService] Fetching bookings with filter:', JSON.stringify(filter));

            interface BookingApiResponse {
                booking?: Array<Record<string, unknown>>;
                bookings?: BookingItem[];
                result?: BookingItem[];
            }

            const response = await bitrix24Api.callMethod<BookingApiResponse | BookingItem[]>(
                'booking.v1.booking.list',
                { filter }
            );

            console.log('[SlotService] Raw bookings response:', JSON.stringify(response, null, 2));

            // Handle various response formats
            let rawItems: Array<Record<string, unknown>> = [];

            if (Array.isArray(response)) {
                rawItems = response as unknown as Array<Record<string, unknown>>;
            } else if (response && typeof response === 'object') {
                // Check for 'booking' key (actual API format)
                if ('booking' in response && Array.isArray(response.booking)) {
                    rawItems = response.booking;
                } else if ('bookings' in response && Array.isArray(response.bookings)) {
                    rawItems = response.bookings as unknown as Array<Record<string, unknown>>;
                } else if ('result' in response && Array.isArray(response.result)) {
                    rawItems = response.result as unknown as Array<Record<string, unknown>>;
                }
            }

            // Normalize field names - handle datePeriod timestamps and resourceIds array
            const normalizedItems: BookingItem[] = [];

            for (const rawItem of rawItems) {
                // Handle datePeriod format: { from: { timestamp, timezone }, to: { timestamp, timezone } }
                let dateFromStr = '';
                let dateToStr = '';

                const datePeriod = rawItem.datePeriod as { from?: { timestamp?: number }; to?: { timestamp?: number } } | undefined;
                if (datePeriod?.from?.timestamp) {
                    dateFromStr = new Date(datePeriod.from.timestamp * 1000).toISOString();
                } else {
                    dateFromStr = (rawItem.dateFrom ?? rawItem.DATE_FROM ?? rawItem.date_from ?? '') as string;
                }

                if (datePeriod?.to?.timestamp) {
                    dateToStr = new Date(datePeriod.to.timestamp * 1000).toISOString();
                } else {
                    dateToStr = (rawItem.dateTo ?? rawItem.DATE_TO ?? rawItem.date_to ?? '') as string;
                }

                // Handle resourceIds array - a booking can span multiple resources
                let bookingResourceIds: number[] = [];
                const resourceIdsArray = rawItem.resourceIds as number[] | undefined;
                if (resourceIdsArray && Array.isArray(resourceIdsArray)) {
                    bookingResourceIds = resourceIdsArray;
                } else {
                    bookingResourceIds = [(rawItem.resourceId ?? rawItem.RESOURCE_ID ?? rawItem.resource_id ?? 0) as number];
                }

                // Filter to only include requested resource IDs, and create a booking item for each matching resource
                const matchingResourceIds = bookingResourceIds.filter(rid => resourceIds.includes(rid));

                for (const resourceId of matchingResourceIds) {
                    normalizedItems.push({
                        id: (rawItem.id ?? rawItem.ID ?? 0) as number,
                        resourceId,
                        dateFrom: dateFromStr,
                        dateTo: dateToStr
                    });
                }
            }

            console.log('[SlotService] Normalized bookings:', normalizedItems);
            return normalizedItems;
        } catch (error) {
            console.warn('[SlotService] Could not fetch existing bookings:', error);
            return [];
        }
    }

    /**
     * Format date for API (YYYY-MM-DD)
     */
    private formatDateForApi(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Generate time slots
     */
    private generateSlots(
        resourceIds: number[],
        date: Date,
        configs: ResourceSlotConfig[],
        existingBookings: BookingItem[],
        slotDuration: number
    ): TimeSlot[] {
        const slots: TimeSlot[] = [];
        const dateStr = this.formatDateForApi(date);

        // Find the common working hours across all selected resources
        let earliestStart = '23:59';
        let latestEnd = '00:00';

        for (const config of configs) {
            if (config.workStart < earliestStart) {
                earliestStart = config.workStart;
            }
            if (config.workEnd > latestEnd) {
                latestEnd = config.workEnd;
            }
        }

        // Use defaults if no configs found
        if (earliestStart === '23:59') earliestStart = this.DEFAULT_START_TIME;
        if (latestEnd === '00:00') latestEnd = this.DEFAULT_END_TIME;

        // Parse start and end times
        const [startHour, startMin] = earliestStart.split(':').map(Number);
        const [endHour, endMin] = latestEnd.split(':').map(Number);

        // Generate slots
        let currentHour = startHour;
        let currentMin = startMin || 0;

        while (currentHour < endHour || (currentHour === endHour && currentMin < (endMin || 0))) {
            const startTime = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;

            // Calculate end time
            let endMinTotal = currentMin + slotDuration;
            let endHourCalc = currentHour + Math.floor(endMinTotal / 60);
            let endMinCalc = endMinTotal % 60;

            const endTime = `${String(endHourCalc).padStart(2, '0')}:${String(endMinCalc).padStart(2, '0')}`;

            // Don't create slot if it extends past working hours
            if (endHourCalc > endHour || (endHourCalc === endHour && endMinCalc > (endMin || 0))) {
                break;
            }

            // Check which resources are available for this slot
            const availableResourceIds = resourceIds.filter(resourceId => {
                // Check if resource is booked during this slot
                const isBooked = this.isResourceBooked(resourceId, dateStr, startTime, endTime, existingBookings);

                // Check if slot is within resource's working hours
                const config = configs.find(c => c.resourceId === resourceId);
                const isWithinWorkingHours = config ? 
                    this.isWithinWorkingHours(startTime, endTime, config) : true;

                // Check if slot is blocked (busy time)
                const isBlocked = config ?
                    this.isSlotBlocked(startTime, endTime, config.blockedSlots) : false;

                return !isBooked && isWithinWorkingHours && !isBlocked;
            });

            slots.push({
                startTime,
                endTime,
                available: availableResourceIds.length > 0,
                resourceIds: availableResourceIds
            });

            // Move to next slot
            currentMin += slotDuration;
            if (currentMin >= 60) {
                currentHour += Math.floor(currentMin / 60);
                currentMin = currentMin % 60;
            }
        }

        return slots;
    }

    /**
     * Check if a slot is within resource's working hours
     */
    private isWithinWorkingHours(startTime: string, endTime: string, config: ResourceSlotConfig): boolean {
        return startTime >= config.workStart && endTime <= config.workEnd;
    }

    /**
     * Check if a slot is blocked by busy times
     */
    private isSlotBlocked(startTime: string, endTime: string, blockedSlots: Array<{ start: string; end: string }>): boolean {
        for (const blocked of blockedSlots) {
            // Check if slot overlaps with blocked time
            // Overlap exists if: slotStart < blockedEnd AND slotEnd > blockedStart
            if (startTime < blocked.end && endTime > blocked.start) {
                console.log(`[SlotService] Slot ${startTime}-${endTime} blocked by busy time ${blocked.start}-${blocked.end}`);
                return true;
            }
        }
        return false;
    }

    /**
     * Check if a resource is booked during a time slot
     */
    private isResourceBooked(
        resourceId: number,
        dateStr: string,
        startTime: string,
        endTime: string,
        existingBookings: BookingItem[]
    ): boolean {
        const slotStart = new Date(`${dateStr}T${startTime}:00`);
        const slotEnd = new Date(`${dateStr}T${endTime}:00`);

        for (const booking of existingBookings) {
            if (booking.resourceId !== resourceId) continue;

            const bookingStart = new Date(booking.dateFrom);
            const bookingEnd = new Date(booking.dateTo);

            // Check for overlap: slot overlaps booking if slot starts before booking ends AND slot ends after booking starts
            if (slotStart < bookingEnd && slotEnd > bookingStart) {
                console.log(`[SlotService] Slot ${startTime}-${endTime} blocked by booking ${booking.id}`);
                return true;
            }
        }

        return false;
    }

    /**
     * Generate default slots when no specific settings available
     */
    private generateDefaultSlots(
        slotDuration: number, 
        resourceIds: number[],
        existingBookings: BookingItem[]
    ): TimeSlot[] {
        const slots: TimeSlot[] = [];
        const [startHour] = this.DEFAULT_START_TIME.split(':').map(Number);
        const [endHour] = this.DEFAULT_END_TIME.split(':').map(Number);

        for (let hour = startHour; hour < endHour; hour++) {
            for (let minute = 0; minute < 60; minute += slotDuration) {
                const startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                const endMinute = minute + slotDuration;
                const endHourCalc = hour + Math.floor(endMinute / 60);
                const endMinuteCalc = endMinute % 60;

                if (endHourCalc > endHour) continue;

                const endTime = `${String(endHourCalc).padStart(2, '0')}:${String(endMinuteCalc).padStart(2, '0')}`;

                slots.push({
                    startTime,
                    endTime,
                    available: true,
                    resourceIds: resourceIds
                });
            }
        }

        return slots;
    }
}

// Export singleton
export const slotService = new SlotService();
