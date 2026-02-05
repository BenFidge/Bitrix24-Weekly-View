/**
 * Slot Service
 * Handles time slot calculations for resources
 */

import { bitrix24Api } from './bitrix24Api';

export interface TimeSlot {
    startTime: string;
    endTime: string;
    available: boolean;
    resourceIds: number[];
}

export interface ResourceSlotConfig {
    resourceId: number;
    workStart: string;
    workEnd: string;
    slotDuration: number;
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
        from?: unknown;
        to?: unknown;
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

type BusyTimeResponse = BusyTimeItem[] | { busyTimes: BusyTimeItem[] };

export class SlotService {
    private readonly DEFAULT_SLOT_DURATION = 60;
    private readonly DEFAULT_START_TIME = '08:00';
    private readonly DEFAULT_END_TIME = '20:00';

    private coerceTime(value: unknown): string | null {
        if (typeof value === 'string') {
            // Sometimes Bitrix returns HH:MM:SS; keep HH:MM
            return value.length >= 5 ? value.substring(0, 5) : value;
        }

        if (value && typeof value === 'object') {
            const v = value as Record<string, unknown>;

            const formatted = v.formatted ?? v.value ?? v.time;
            if (typeof formatted === 'string') {
                return formatted.length >= 5 ? formatted.substring(0, 5) : formatted;
            }

            const ts = v.timestamp;
            if (typeof ts === 'number' && Number.isFinite(ts)) {
                const d = new Date(ts * 1000);
                return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            }
        }

        return null;
    }

    async getAvailableSlots(
        resourceIds: number[],
        date: Date,
        slotDuration = this.DEFAULT_SLOT_DURATION
    ): Promise<TimeSlot[]> {
        if (resourceIds.length === 0) {
            return this.generateDefaultSlots(slotDuration, [], []);
        }

        try {
            const resourceConfigs = await this.getResourceConfigs(resourceIds, date);
            const existingBookings = await this.getBookingsForDate(resourceIds, date);

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

    private async getResourceConfigs(resourceIds: number[], date: Date): Promise<ResourceSlotConfig[]> {
        const configs: ResourceSlotConfig[] = [];
        const dateStr = this.formatDateForApi(date);

        for (const resourceId of resourceIds) {
            try {
                const slotsResponse = await bitrix24Api.callMethod<SlotApiResponse>(
                    'booking.v1.resource.slots.list',
                    { resourceId }
                );

                const config: ResourceSlotConfig = {
                    resourceId,
                    workStart: this.DEFAULT_START_TIME,
                    workEnd: this.DEFAULT_END_TIME,
                    slotDuration: this.DEFAULT_SLOT_DURATION,
                    blockedSlots: []
                };

                if (slotsResponse?.slots && Array.isArray(slotsResponse.slots)) {
                    for (const slot of slotsResponse.slots) {
                        const from = this.coerceTime(slot.from);
                        const to = this.coerceTime(slot.to);
                        if (from) {
                            config.workStart = from;
                        }
                        if (to) {
                            config.workEnd = to;
                        }
                        if (slot.duration) {
                            config.slotDuration = slot.duration;
                        }
                    }
                }

                try {
                    const busyResponse = await bitrix24Api.callMethod<BusyTimeResponse>(
                        'booking.v1.resourceBusyTime.list',
                        {
                            resourceId,
                            dateFrom: `${dateStr}T00:00:00`,
                            dateTo: `${dateStr}T23:59:59`
                        }
                    );

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
                            const startTime = new Date(from);
                            const endTime = new Date(to);
                            config.blockedSlots.push({
                                start: `${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}`,
                                end: `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`
                            });
                        }
                    }
                } catch {
                    console.log(`[SlotService] resourceBusyTime.list not available for resource ${resourceId} - using booking data instead`);
                }

                configs.push(config);
            } catch (error) {
                console.warn(`[SlotService] Could not get config for resource ${resourceId}:`, error);
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

    private async getBookingsForDate(resourceIds: number[], date: Date): Promise<BookingItem[]> {
        const dateStr = this.formatDateForApi(date);

        try {
            const filter = {
                resourceId: resourceIds,
                '>=dateFrom': `${dateStr}T00:00:00`,
                '<=dateFrom': `${dateStr}T23:59:59`
            };

            interface BookingApiResponse {
                booking?: Array<Record<string, unknown>>;
                bookings?: BookingItem[];
                result?: BookingItem[];
            }

            const response = await bitrix24Api.callMethod<BookingApiResponse | BookingItem[]>(
                'booking.v1.booking.list',
                { filter }
            );

            let rawItems: Array<Record<string, unknown>> = [];

            if (Array.isArray(response)) {
                rawItems = response as unknown as Array<Record<string, unknown>>;
            } else if (response && typeof response === 'object') {
                if ('booking' in response && Array.isArray(response.booking)) {
                    rawItems = response.booking;
                } else if ('bookings' in response && Array.isArray(response.bookings)) {
                    rawItems = response.bookings as unknown as Array<Record<string, unknown>>;
                } else if ('result' in response && Array.isArray(response.result)) {
                    rawItems = response.result as unknown as Array<Record<string, unknown>>;
                }
            }

            return rawItems.map(item => this.mapBookingItem(item));
        } catch (error) {
            console.warn('[SlotService] Failed to load bookings for date:', error);
            return [];
        }
    }

    private mapBookingItem(item: Record<string, unknown>): BookingItem {
        return {
            id: parseInt(String(item.id ?? item.ID ?? 0), 10),
            resourceId: parseInt(String(item.resourceId ?? item.RESOURCE_ID ?? 0), 10),
            dateFrom: String(item.dateFrom ?? item.DATE_FROM ?? ''),
            dateTo: String(item.dateTo ?? item.DATE_TO ?? '')
        };
    }

    private generateSlots(
        resourceIds: number[],
        date: Date,
        configs: ResourceSlotConfig[],
        bookings: BookingItem[],
        slotDuration: number
    ): TimeSlot[] {
        const availableSlots: TimeSlot[] = [];

        const configByResource = new Map<number, ResourceSlotConfig>();
        for (const cfg of configs) {
            configByResource.set(cfg.resourceId, cfg);
        }

        // Determine global time bounds (union): earliest start -> latest end
        const starts = configs.map(c => c.workStart).filter(Boolean);
        const ends = configs.map(c => c.workEnd).filter(Boolean);
        const globalStart = starts.length ? starts.sort()[0] : this.DEFAULT_START_TIME;
        const globalEnd = ends.length ? ends.sort().slice(-1)[0] : this.DEFAULT_END_TIME;

        const [startHour, startMinute] = globalStart.split(':').map(Number);
        const [endHour, endMinute] = globalEnd.split(':').map(Number);

        let currentMinutes = (startHour || 0) * 60 + (startMinute || 0);
        const endMinutes = (endHour || 0) * 60 + (endMinute || 0);

        const toDateTime = (time: string): Date => {
            const [hh, mm] = time.split(':').map(Number);
            const d = new Date(date);
            d.setHours(hh || 0, mm || 0, 0, 0);
            return d;
        };

        const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean => {
            return aStart < bEnd && aEnd > bStart;
        };

        const bookingRanges = bookings
            .map(b => ({
                resourceId: b.resourceId,
                start: new Date(b.dateFrom),
                end: new Date(b.dateTo)
            }))
            .filter(b => !Number.isNaN(b.start.getTime()) && !Number.isNaN(b.end.getTime()));

        while (currentMinutes + slotDuration <= endMinutes) {
            const startTime = this.formatTime(currentMinutes);
            const endTime = this.formatTime(currentMinutes + slotDuration);
            const slotStart = toDateTime(startTime);
            const slotEnd = toDateTime(endTime);

            const availableResourceIds: number[] = [];

            for (const resourceId of resourceIds) {
                const cfg = configByResource.get(resourceId);

                // Resource work window constraint
                const rStart = cfg ? toDateTime(cfg.workStart) : toDateTime(this.DEFAULT_START_TIME);
                const rEnd = cfg ? toDateTime(cfg.workEnd) : toDateTime(this.DEFAULT_END_TIME);
                if (!(slotStart >= rStart && slotEnd <= rEnd)) {
                    continue;
                }

                // Busy/blocked times
                const blocked = (cfg?.blockedSlots ?? []).some(b => {
                    const bStart = toDateTime(b.start);
                    const bEnd = toDateTime(b.end);
                    return overlaps(slotStart, slotEnd, bStart, bEnd);
                });
                if (blocked) {
                    continue;
                }

                // Existing bookings (overlap)
                const hasOverlap = bookingRanges.some(b => b.resourceId === resourceId && overlaps(slotStart, slotEnd, b.start, b.end));
                if (hasOverlap) {
                    continue;
                }

                availableResourceIds.push(resourceId);
            }

            availableSlots.push({
                startTime,
                endTime,
                available: availableResourceIds.length > 0,
                resourceIds: availableResourceIds
            });

            currentMinutes += slotDuration;
        }

        return availableSlots;
    }

    private generateDefaultSlots(
        slotDuration: number,
        resourceIds: number[],
        blockedSlots: Array<{ start: string; end: string }>
    ): TimeSlot[] {
        const slots: TimeSlot[] = [];

        const [startHour, startMinute] = this.DEFAULT_START_TIME.split(':').map(Number);
        const [endHour, endMinute] = this.DEFAULT_END_TIME.split(':').map(Number);

        let currentMinutes = (startHour || 0) * 60 + (startMinute || 0);
        const endMinutes = (endHour || 0) * 60 + (endMinute || 0);

        while (currentMinutes + slotDuration <= endMinutes) {
            const start = this.formatTime(currentMinutes);
            const end = this.formatTime(currentMinutes + slotDuration);

            const isBlocked = blockedSlots.some(blocked => blocked.start === start);

            slots.push({
                startTime: start,
                endTime: end,
                available: !isBlocked,
                resourceIds: isBlocked ? [] : resourceIds
            });

            currentMinutes += slotDuration;
        }

        return slots;
    }

    private formatDateForApi(date: Date): string {
        return date.toISOString().split('T')[0] ?? '';
    }

    private formatTime(totalMinutes: number): string {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
}

export const slotService = new SlotService();
