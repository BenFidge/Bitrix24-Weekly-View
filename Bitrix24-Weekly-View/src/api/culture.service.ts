/**
 * Culture Service
 * Handles locale, timezone, and week start settings from Bitrix24
 */

import { bitrix24Api } from './bitrix24.api.js';
import type { CultureSettings, WeekStartDay } from '../models/config.model.js';

export class CultureService {
    private settings: CultureSettings | null = null;

    /**
     * Get culture settings from Bitrix24
     */
    async getCultureSettings(): Promise<CultureSettings> {
        if (this.settings) {
            return this.settings;
        }

        try {
            // Fetch culture-related settings from Bitrix24
            const [userInfo, appSettings] = await Promise.all([
                bitrix24Api.callMethod<UserInfoResponse>('user.current'),
                this.fetchAppSettings()
            ]);

            // Determine locale from user's language
            const locale = this.mapLanguageToLocale(userInfo.LANGUAGE_ID ?? await bitrix24Api.getLanguage());
            
            // Determine week start based on locale/culture
            const weekStartsOn = this.determineWeekStart(locale, appSettings);

            this.settings = {
                locale,
                weekStartsOn,
                dateFormat: this.getDateFormat(locale),
                timeFormat: this.getTimeFormat(locale),
                timezone: userInfo.TIME_ZONE ?? Intl.DateTimeFormat().resolvedOptions().timeZone
            };

            console.log('[CultureService] Culture settings loaded:', this.settings);
            return this.settings;

        } catch (error) {
            console.error('[CultureService] Failed to load culture settings, using defaults:', error);
            
            // Return sensible defaults
            this.settings = {
                locale: 'en-US',
                weekStartsOn: 0, // Sunday
                dateFormat: 'MM/DD/YYYY',
                timeFormat: '12h',
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            };
            
            return this.settings;
        }
    }

    /**
     * Get the first day of week based on culture settings
     */
    async getWeekStartDay(): Promise<WeekStartDay> {
        const settings = await this.getCultureSettings();
        return settings.weekStartsOn;
    }

    /**
     * Get locale string for Intl APIs
     */
    async getLocale(): Promise<string> {
        const settings = await this.getCultureSettings();
        return settings.locale;
    }

    /**
     * Check if 24-hour time format is used
     */
    async is24HourFormat(): Promise<boolean> {
        const settings = await this.getCultureSettings();
        return settings.timeFormat === '24h';
    }

    /**
     * Fetch app-specific settings that might override culture defaults
     */
    private async fetchAppSettings(): Promise<AppSettings> {
        try {
            // Try to get saved week start preference
            const weekStartPref = await bitrix24Api.getAppOption('weekStartDay');
            return {
                weekStartOverride: weekStartPref ? parseInt(weekStartPref, 10) as WeekStartDay : undefined
            };
        } catch {
            return {};
        }
    }

    /**
     * Save week start preference
     */
    async saveWeekStartPreference(weekStartsOn: WeekStartDay): Promise<void> {
        await bitrix24Api.setAppOption('weekStartDay', weekStartsOn.toString());
        if (this.settings) {
            this.settings.weekStartsOn = weekStartsOn;
        }
    }

    /**
     * Map Bitrix24 language code to locale string
     */
    private mapLanguageToLocale(languageId: string): string {
        const localeMap: Record<string, string> = {
            'en': 'en-US',
            'de': 'de-DE',
            'la': 'es-419', // Latin America Spanish
            'br': 'pt-BR',
            'fr': 'fr-FR',
            'it': 'it-IT',
            'pl': 'pl-PL',
            'ru': 'ru-RU',
            'ua': 'uk-UA',
            'tr': 'tr-TR',
            'sc': 'zh-CN', // Simplified Chinese
            'tc': 'zh-TW', // Traditional Chinese
            'ja': 'ja-JP',
            'vn': 'vi-VN',
            'id': 'id-ID',
            'ms': 'ms-MY',
            'th': 'th-TH',
            'hi': 'hi-IN'
        };

        return localeMap[languageId.toLowerCase()] ?? 'en-US';
    }

    /**
     * Determine week start day based on locale and settings
     * Some countries use Sunday, most use Monday
     */
    private determineWeekStart(locale: string, appSettings: AppSettings): WeekStartDay {
        // If there's an explicit override, use it
        if (appSettings.weekStartOverride !== undefined) {
            return appSettings.weekStartOverride;
        }

        // Countries that traditionally start the week on Sunday
        const sundayStartCountries = [
            'en-US', 'en-CA', 'en-AU', 'en-NZ', 'en-PH',
            'he-IL', 'ar-SA', 'ar-AE', 'ar-EG',
            'ja-JP', 'ko-KR', 'zh-CN', 'zh-TW',
            'pt-BR', 'hi-IN', 'th-TH'
        ];

        // Check if locale starts week on Sunday
        const isSundayStart = sundayStartCountries.some(country => 
            locale.toLowerCase() === country.toLowerCase() ||
            locale.toLowerCase().startsWith(country.split('-')[0]?.toLowerCase() ?? '')
        );

        return isSundayStart ? 0 : 1;
    }

    /**
     * Get appropriate date format for locale
     */
    private getDateFormat(locale: string): string {
        // US-style: MM/DD/YYYY
        if (locale.startsWith('en-US')) {
            return 'MM/DD/YYYY';
        }
        
        // Most European and international: DD/MM/YYYY or DD.MM.YYYY
        if (locale.startsWith('de') || locale.startsWith('ru')) {
            return 'DD.MM.YYYY';
        }

        // ISO style for Asian locales
        if (locale.startsWith('ja') || locale.startsWith('zh') || locale.startsWith('ko')) {
            return 'YYYY/MM/DD';
        }

        return 'DD/MM/YYYY';
    }

    /**
     * Get time format preference based on locale
     */
    private getTimeFormat(locale: string): '12h' | '24h' {
        // Countries that commonly use 12-hour format
        const twelveHourCountries = ['en-US', 'en-AU', 'en-CA', 'en-PH'];
        
        const uses12Hour = twelveHourCountries.some(country =>
            locale.toLowerCase() === country.toLowerCase()
        );

        return uses12Hour ? '12h' : '24h';
    }

    /**
     * Clear cached settings
     */
    clearCache(): void {
        this.settings = null;
    }
}

interface UserInfoResponse {
    ID: string;
    LANGUAGE_ID?: string;
    TIME_ZONE?: string;
    TIME_ZONE_OFFSET?: number;
}

interface AppSettings {
    weekStartOverride?: WeekStartDay;
}

// Export singleton instance
export const cultureService = new CultureService();
