/**
 * Culture Service
 * Handles locale, timezone, and week start settings from Bitrix24
 */

import { bitrix24Api } from './bitrix24Api';
import type { CultureSettings, WeekStartDay } from '../models/config.model';

export class CultureService {
    private settings: CultureSettings | null = null;

    async getCultureSettings(): Promise<CultureSettings> {
        if (this.settings) {
            return this.settings;
        }

        try {
            const [userInfo, appSettings] = await Promise.all([
                bitrix24Api.callMethod<UserInfoResponse>('user.current'),
                this.fetchAppSettings()
            ]);

            const locale = this.mapLanguageToLocale(userInfo.LANGUAGE_ID ?? await bitrix24Api.getLanguage());
            const weekStartsOn = this.determineWeekStart(locale, appSettings);

            this.settings = {
                locale,
                weekStartsOn,
                dateFormat: this.getDateFormat(locale),
                timeFormat: this.getTimeFormat(locale),
                timezone: userInfo.TIME_ZONE ?? Intl.DateTimeFormat().resolvedOptions().timeZone
            };

            return this.settings;

        } catch (error) {
            console.error('[CultureService] Failed to load culture settings, using defaults:', error);

            this.settings = {
                locale: 'en-US',
                weekStartsOn: 0,
                dateFormat: 'MM/DD/YYYY',
                timeFormat: '12h',
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            };

            return this.settings;
        }
    }

    async getWeekStartDay(): Promise<WeekStartDay> {
        const settings = await this.getCultureSettings();
        return settings.weekStartsOn;
    }

    async getLocale(): Promise<string> {
        const settings = await this.getCultureSettings();
        return settings.locale;
    }

    async is24HourFormat(): Promise<boolean> {
        const settings = await this.getCultureSettings();
        return settings.timeFormat === '24h';
    }

    private async fetchAppSettings(): Promise<AppSettings> {
        try {
            const weekStartPref = await bitrix24Api.getAppOption('weekStartDay');
            return {
                weekStartOverride: weekStartPref ? parseInt(weekStartPref, 10) as WeekStartDay : undefined
            };
        } catch {
            return {};
        }
    }

    async saveWeekStartPreference(weekStartsOn: WeekStartDay): Promise<void> {
        await bitrix24Api.setAppOption('weekStartDay', weekStartsOn.toString());
        if (this.settings) {
            this.settings.weekStartsOn = weekStartsOn;
        }
    }

    private mapLanguageToLocale(languageId: string): string {
        const localeMap: Record<string, string> = {
            'en': 'en-US',
            'de': 'de-DE',
            'la': 'es-419',
            'br': 'pt-BR',
            'fr': 'fr-FR',
            'it': 'it-IT',
            'pl': 'pl-PL',
            'ru': 'ru-RU',
            'ua': 'uk-UA',
            'tr': 'tr-TR',
            'sc': 'zh-CN',
            'tc': 'zh-TW',
            'ja': 'ja-JP',
            'vn': 'vi-VN',
            'id': 'id-ID',
            'ms': 'ms-MY',
            'th': 'th-TH',
            'hi': 'hi-IN'
        };

        return localeMap[languageId.toLowerCase()] ?? 'en-US';
    }

    private determineWeekStart(locale: string, appSettings: AppSettings): WeekStartDay {
        if (appSettings.weekStartOverride !== undefined) {
            return appSettings.weekStartOverride;
        }

        const sundayStartCountries = [
            'en-US', 'en-CA', 'en-AU', 'en-NZ', 'en-PH',
            'he-IL', 'ar-SA', 'ar-AE', 'ar-EG',
            'ja-JP', 'ko-KR', 'zh-CN', 'zh-TW',
            'pt-BR', 'hi-IN', 'th-TH'
        ];

        const isSundayStart = sundayStartCountries.some(country =>
            locale.toLowerCase() === country.toLowerCase() ||
            locale.toLowerCase().startsWith(country.split('-')[0]?.toLowerCase() ?? '')
        );

        return isSundayStart ? 0 : 1;
    }

    private getDateFormat(locale: string): string {
        if (locale.startsWith('en-US')) {
            return 'MM/DD/YYYY';
        }

        if (locale.startsWith('de') || locale.startsWith('ru')) {
            return 'DD.MM.YYYY';
        }

        if (locale.startsWith('ja') || locale.startsWith('zh') || locale.startsWith('ko')) {
            return 'YYYY/MM/DD';
        }

        return 'DD/MM/YYYY';
    }

    private getTimeFormat(locale: string): '12h' | '24h' {
        const twelveHourCountries = ['en-US', 'en-AU', 'en-CA', 'en-PH'];

        const uses12Hour = twelveHourCountries.some(country =>
            locale.toLowerCase() === country.toLowerCase()
        );

        return uses12Hour ? '12h' : '24h';
    }

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

export const cultureService = new CultureService();
