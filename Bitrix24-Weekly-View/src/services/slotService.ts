import { bitrix24Api } from './bitrix24Api';

export interface TimeSlot {
  startTime: string;
  endTime: string;
  available: boolean;
}

type Interval = { startMin: number; endMin: number };

const toTimeString = (minutes: number): string => {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
};

const startOfDayLocal = (d: Date): Date => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const addDays = (d: Date, days: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
};

const overlaps = (a: Interval, b: Interval) => a.startMin < b.endMin && b.startMin < a.endMin;

const parseMinutes = (value: unknown): number => {
  if (!value) return 0;
  if (typeof value === 'string') {
    // Accept ISO or HH:mm
    const d = value.includes('T') ? new Date(value) : null;
    if (d && !Number.isNaN(d.getTime())) {
      return d.getHours() * 60 + d.getMinutes();
    }
    const t = value.includes('T') ? value.split('T')[1] : value;
    const hhmm = t?.slice(0, 5);
    if (!hhmm) return 0;
    const [h, m] = hhmm.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }
  if (value instanceof Date) {
    return value.getHours() * 60 + value.getMinutes();
  }
  if (typeof value === 'object') {
    const obj = value as any;
    if (typeof obj.timestamp === 'number') {
      const d = new Date(obj.timestamp * 1000);
      return d.getHours() * 60 + d.getMinutes();
    }
  }
  return 0;
};

const extractItems = (data: any): any[] => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.result)) return data.result;
  if (Array.isArray(data.items)) return data.items;
  if (data.result && Array.isArray(data.result.items)) return data.result.items;
  if (data.bookings && Array.isArray(data.bookings)) return data.bookings;
  return [];
};

export const slotService = {
  /**
   * Returns ALL slots for the day, marking each as available/unavailable.
   *
   * Rule: for group bookings, a slot is available only if it is free for ALL selected resources.
   */
  async getAvailableSlots(resourceIds: number[], date: Date): Promise<TimeSlot[]> {
    if (!date || resourceIds.length === 0) return [];

    // Build a local-day range and query bookings within it.
    const dayStart = startOfDayLocal(date);
    const dayEnd = addDays(dayStart, 1);

    // Prefer the server filter for dateFrom range, then filter resources client-side.
    const data = await bitrix24Api.callMethod<any>('booking.v1.booking.list', {
      filter: {
        '>=dateFrom': dayStart.toISOString(),
        '<dateFrom': dayEnd.toISOString(),
      }
    });

    const items = extractItems(data);

    // Build busy intervals per resource
    const busyByResource: Record<number, Interval[]> = {};
    for (const rid of resourceIds) busyByResource[rid] = [];

    for (const b of items) {
      const bResourceIds: number[] = Array.isArray(b.RESOURCE_IDS)
        ? b.RESOURCE_IDS.map((x: any) => Number(x))
        : (Array.isArray(b.resourceIds) ? b.resourceIds.map((x: any) => Number(x)) : []);

      const singleRid = Number(b.RESOURCE_ID ?? b.resourceId ?? 0);
      if (singleRid) bResourceIds.push(singleRid);

      // Only consider bookings that touch one of the selected resources
      const relevant = bResourceIds.filter((rid) => resourceIds.includes(rid));
      if (relevant.length === 0) continue;

      const startMin = parseMinutes(b.DATE_FROM ?? b.dateFrom ?? b.SLOT_START ?? b.slotStart);
      const endMin = parseMinutes(b.DATE_TO ?? b.dateTo ?? b.SLOT_END ?? b.slotEnd);
      if (!startMin && !endMin) continue;

      const interval: Interval = { startMin, endMin: Math.max(endMin, startMin + 1) };
      for (const rid of relevant) {
        busyByResource[rid] ??= [];
        busyByResource[rid].push(interval);
      }
    }

    const slotDurationMin = 60;
    const slots: TimeSlot[] = [];

    // TODO: later pull working hours per resource/service.
    const dayOpenMin = 8 * 60;
    const dayCloseMin = 19 * 60;

    for (let m = dayOpenMin; m <= dayCloseMin - slotDurationMin; m += slotDurationMin) {
      const slot: Interval = { startMin: m, endMin: m + slotDurationMin };
      const available = resourceIds.every((rid) => {
        const busy = busyByResource[rid] ?? [];
        return !busy.some((i) => overlaps(slot, i));
      });

      slots.push({
        startTime: toTimeString(m),
        endTime: toTimeString(m + slotDurationMin),
        available,
      });
    }

    return slots;
  }
};
