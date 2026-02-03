/**
 * Date Utilities for Weekly View
 */

import type { WeekStartDay } from '../models/config.model.js';

/**
 * Get the start of the week for a given date
 */
export function getWeekStart(date: Date, weekStartsOn: WeekStartDay): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

/**
 * Get the end of the week for a given date
 */
export function getWeekEnd(date: Date, weekStartsOn: WeekStartDay): Date {
    const weekStart = getWeekStart(date, weekStartsOn);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    return weekEnd;
}

/**
 * Get all days in a week
 */
export function getWeekDays(date: Date, weekStartsOn: WeekStartDay): Date[] {
    const weekStart = getWeekStart(date, weekStartsOn);
    const days: Date[] = [];
    
    for (let i = 0; i < 7; i++) {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + i);
        days.push(day);
    }
    
    return days;
}

/**
 * Navigate to previous week
 */
export function getPreviousWeek(date: Date): Date {
    const prev = new Date(date);
    prev.setDate(prev.getDate() - 7);
    return prev;
}

/**
 * Navigate to next week
 */
export function getNextWeek(date: Date): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + 7);
    return next;
}

/**
 * Format date for display (short format)
 */
export function formatDateShort(date: Date, locale: string): string {
    return date.toLocaleDateString(locale, {
        weekday: 'short',
        day: 'numeric'
    });
}

/**
 * Format date for display (full format)
 */
export function formatDateFull(date: Date, locale: string): string {
    return date.toLocaleDateString(locale, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Format week range for header
 */
export function formatWeekRange(startDate: Date, endDate: Date, locale: string): string {
    const startMonth = startDate.toLocaleDateString(locale, { month: 'short' });
    const endMonth = endDate.toLocaleDateString(locale, { month: 'short' });
    const startDay = startDate.getDate();
    const endDay = endDate.getDate();
    const year = endDate.getFullYear();

    if (startMonth === endMonth) {
        return `${startMonth} ${startDay} - ${endDay}, ${year}`;
    }
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
}

/**
 * Format time for display
 */
export function formatTime(date: Date, locale: string, use24Hour: boolean = true): string {
    return date.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: !use24Hour
    });
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}

/**
 * Check if a date is today
 */
export function isToday(date: Date): boolean {
    return isSameDay(date, new Date());
}

/**
 * Check if a date is in the past
 */
export function isPast(date: Date): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
}

/**
 * Parse ISO date string to Date
 */
export function parseISODate(isoString: string): Date {
    return new Date(isoString);
}

/**
 * Convert Date to ISO string for API
 */
export function toISOString(date: Date): string {
    return date.toISOString();
}

/**
 * Get week number of the year
 */
export function getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Get day name
 */
export function getDayName(date: Date, locale: string, format: 'long' | 'short' = 'short'): string {
    return date.toLocaleDateString(locale, { weekday: format });
}

/**
 * Check if date is a weekend
 */
export function isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6;
}
