import { bitrix24Api } from './bitrix24Api'

export interface TimeSlot {
   startTime: string;
   endTime: string;
}

const toMinutes = (value: unknown): number => {
   if (typeof value === 'string') {
      const timePart = value.includes('T') ? value.split('T')[1] : value;
      if (!timePart) return 0;
      const [h, m] = timePart.slice(0, 5).split(':').map(Number);
      return h * 60 + m;
   }
   return 0;
};

const toTimeString = (minutes: number): string => {
   const h = String(Math.floor(minutes / 60)).padStart(2, '0');
   const m = String(minutes % 60).padStart(2, '0');
   return `${h}:${m}`;
};

const extractBookingItems = (response: unknown): Array<Record<string, unknown>> => {
   if (Array.isArray(response)) {
      return response as Array<Record<string, unknown>>;
   }

   if (response && typeof response === 'object') {
      const obj = response as Record<string, unknown>;
      if (Array.isArray(obj.items)) {
         return obj.items as Array<Record<string, unknown>>;
      }
      if (Array.isArray(obj.result)) {
         return obj.result as Array<Record<string, unknown>>;
      }
      if (obj.result && typeof obj.result === 'object') {
         const nested = obj.result as Record<string, unknown>;
         if (Array.isArray(nested.items)) {
            return nested.items as Array<Record<string, unknown>>;
         }
      }
   }

   return [];
};

export const slotService = {
   async getAvailableSlots(resourceIds: number[], date: Date): Promise<TimeSlot[]> {
      if (!date || resourceIds.length === 0) return [];

      const dateValue = date.toISOString().split('T')[0] ?? '';
      if (!dateValue) return [];

      const bookingsResponse = await bitrix24Api.callMethod(
         'booking.v1.booking.list',
         { filter: { DATE_FROM: dateValue, RESOURCE_ID: resourceIds } }
      );

      const bookingItems = extractBookingItems(bookingsResponse);
      const taken = bookingItems.map((booking) => {
         const startValue = booking['slotStart'] ?? booking['SLOT_START'] ?? booking['DATE_FROM'] ?? booking['dateFrom'];
         const endValue = booking['slotEnd'] ?? booking['SLOT_END'] ?? booking['DATE_TO'] ?? booking['dateTo'];
         return {
            start: toMinutes(startValue),
            end: toMinutes(endValue)
         };
      });

      const slots: TimeSlot[] = [];
      const slotDuration = 60;

      for (let m = 8 * 60; m <= 18 * 60; m += slotDuration) {
         const overlap = taken.some(t => m < t.end && m + slotDuration > t.start);
         if (!overlap) {
            slots.push({
               startTime: toTimeString(m),
               endTime: toTimeString(m + slotDuration)
            });
         }
      }

      return slots;
   }
};
