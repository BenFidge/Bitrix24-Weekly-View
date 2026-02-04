import type { WeekStartDay } from '../models/config.model';

export const getWeekDays = (date: Date, weekStartsOn: WeekStartDay): Date[] => {
    const start = new Date(date);
    const dayIndex = start.getDay();
    const diff = (dayIndex - weekStartsOn + 7) % 7;
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, index) => {
        const day = new Date(start);
        day.setDate(start.getDate() + index);
        return day;
    });
};

export const isSameDay = (left: Date, right: Date): boolean => {
    return left.getFullYear() === right.getFullYear()
        && left.getMonth() === right.getMonth()
        && left.getDate() === right.getDate();
};

export const toISOString = (date: Date): string => {
    return date.toISOString();
};
