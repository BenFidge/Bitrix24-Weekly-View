/**
 * Bitrix24 Resource Models
 */

export interface Resource {
    id: number;
    name: string;
    type: ResourceType;
    avatar?: string;
    color?: string;
    description?: string;
    isActive: boolean;
    workSchedule?: WorkSchedule;
}

export type ResourceType = 'employee' | 'room' | 'equipment' | 'other';

export interface WorkSchedule {
    monday?: DaySchedule;
    tuesday?: DaySchedule;
    wednesday?: DaySchedule;
    thursday?: DaySchedule;
    friday?: DaySchedule;
    saturday?: DaySchedule;
    sunday?: DaySchedule;
}

export interface DaySchedule {
    isWorkDay: boolean;
    startTime?: string; // HH:mm format
    endTime?: string;   // HH:mm format
    breaks?: BreakPeriod[];
}

export interface BreakPeriod {
    startTime: string;
    endTime: string;
}

export interface ResourceApiItem {
    ID: string;
    NAME: string;
    TYPE: string;
    AVATAR?: string;
    COLOR?: string;
    DESCRIPTION?: string;
    ACTIVE: string;
}

export interface ResourceListResponse {
    result: ResourceApiItem[];
    total: number;
    next?: number;
}
