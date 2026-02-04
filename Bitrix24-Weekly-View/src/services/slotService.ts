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

type BusyTimeResponse = BusyTimeItem[] | { busyTimes: BusyTimeItem[] };

export class SlotService {
    private readonly DEFAULT_SLOT_DURATION = 60;
    private readonly DEFAULT_START_TIME = '08:00';
    private readonly DEFAULT_END_TIME = '20:00';

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
        configs: ResourceSlotConfig[],
        bookings: BookingItem[],
        slotDuration: number
    ): TimeSlot[] {
        const availableSlots: TimeSlot[] = [];
        const resourceConfigs = configs.length > 0
            ? configs
            : resourceIds.map(resourceId => ({
                resourceId,
                workStart: this.DEFAULT_START_TIME,
                workEnd: this.DEFAULT_END_TIME,
                slotDuration: this.DEFAULT_SLOT_DURATION,
                blockedSlots: []
            }));

        const startMinutes = Math.min(...resourceConfigs.map(config => this.parseTime(config.workStart)));
        const endMinutes = Math.max(...resourceConfigs.map(config => this.parseTime(config.workEnd)));

        let currentMinutes = startMinutes;

        while (currentMinutes + slotDuration <= endMinutes) {
            const start = this.formatTime(currentMinutes);
            const end = this.formatTime(currentMinutes + slotDuration);

            const availableResourceIds = resourceConfigs
                .filter(config => this.isSlotAvailableForResource(config, bookings, start, end))
                .map(config => config.resourceId);

            availableSlots.push({
                startTime: start,
                endTime: end,
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

    private parseTime(time: string): number {
        const [hours, minutes] = time.split(':').map(Number);
        return (hours || 0) * 60 + (minutes || 0);
    }

    private isSlotAvailableForResource(
        config: ResourceSlotConfig,
        bookings: BookingItem[],
        start: string,
        end: string
    ): boolean {
        const slotStart = this.parseTime(start);
        const slotEnd = this.parseTime(end);
        const workStart = this.parseTime(config.workStart);
        const workEnd = this.parseTime(config.workEnd);

        if (slotStart < workStart || slotEnd > workEnd) {
            return false;
        }

        const blocked = config.blockedSlots.some(block => {
            const blockedStart = this.parseTime(block.start);
            const blockedEnd = this.parseTime(block.end);
            return slotStart < blockedEnd && slotEnd > blockedStart;
        });

        if (blocked) {
            return false;
        }

        return !bookings.some(booking => {
            if (booking.resourceId !== config.resourceId) {
                return false;
            }
            const bookingStart = this.parseTime(booking.dateFrom.split('T')[1]?.substring(0, 5) ?? '00:00');
            const bookingEnd = this.parseTime(booking.dateTo.split('T')[1]?.substring(0, 5) ?? '00:00');
            return slotStart < bookingEnd && slotEnd > bookingStart;
        });
    }
}

export const slotService = new SlotService();
