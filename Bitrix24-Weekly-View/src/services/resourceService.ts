/**
 * Resource Service
 * Handles resource-related API operations
 */

import { bitrix24Api } from './bitrix24Api';
import type { Resource, ResourceApiItem, ResourceType } from '../models/resource.model';

export class ResourceService {
    private resourceCache: Map<number, Resource> = new Map();
    private allResourcesCache: Resource[] | null = null;
    private cacheTimestamp = 0;
    private readonly CACHE_DURATION = 5 * 60 * 1000;

    async getResources(forceRefresh = false): Promise<Resource[]> {
        const now = Date.now();

        if (!forceRefresh && this.allResourcesCache && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
            return this.allResourcesCache;
        }

        try {
            const resources = await this.fetchResourcesFromApi();

            if (resources.length > 0) {
                this.allResourcesCache = resources;
                this.cacheTimestamp = now;

                for (const resource of this.allResourcesCache) {
                    this.resourceCache.set(resource.id, resource);
                }

                return this.allResourcesCache;
            }
        } catch (error) {
            console.error('[ResourceService] booking.v1.resource.list failed:', error);
        }

        return this.getUsersAsResources();
    }

    private async fetchResourcesFromApi(): Promise<Resource[]> {
        const response = await bitrix24Api.callMethod<BookingResourceListResponse>('booking.v1.resource.list', {
            filter: {}
        });

        let items: BookingResourceItem[] = [];

        if (response && typeof response === 'object') {
            if ('resources' in response && Array.isArray(response.resources)) {
                items = response.resources;
            } else if (Array.isArray(response)) {
                items = response as unknown as BookingResourceItem[];
            } else if ('result' in response) {
                const result = (response as { result: unknown }).result;
                if (Array.isArray(result)) {
                    items = result as BookingResourceItem[];
                } else if (result && typeof result === 'object' && 'resources' in (result as object)) {
                    items = (result as { resources: BookingResourceItem[] }).resources;
                }
            } else {
                for (const key of Object.keys(response)) {
                    const value = (response as Record<string, unknown>)[key];
                    if (Array.isArray(value)) {
                        items = value as BookingResourceItem[];
                        break;
                    }
                }
            }
        }

        return items.map(item => this.mapBookingResourceToResource(item));
    }

    private mapBookingResourceToResource(item: BookingResourceItem): Resource {
        const obj = item as unknown as Record<string, unknown>;

        const id = item.id ?? obj['ID'] ?? 0;
        const name = item.name ?? obj['NAME'] ?? obj['title'] ?? `Resource ${id}`;
        const typeId = item.typeId ?? obj['type_id'] ?? obj['TYPE_ID'];
        const avatar = item.avatarUrl ?? obj['avatar_url'] ?? obj['AVATAR'];
        const color = item.color ?? obj['COLOR'];
        const description = item.description ?? obj['DESCRIPTION'];
        const isActive = item.isActive ?? obj['is_active'] ?? obj['ACTIVE'];

        return {
            id: typeof id === 'number' ? id : parseInt(String(id), 10),
            name: String(name),
            type: this.mapResourceType(String(typeId || 'employee')),
            avatar: typeof avatar === 'string' ? avatar : undefined,
            color: typeof color === 'string' ? color : undefined,
            description: typeof description === 'string' ? description : undefined,
            isActive: isActive !== false && isActive !== 'N'
        };
    }

    private async getUsersAsResources(): Promise<Resource[]> {
        try {
            const users = await bitrix24Api.fetchAll<UserApiItem>('user.get', {
                filter: { 'ACTIVE': true },
                select: ['ID', 'NAME', 'LAST_NAME', 'PERSONAL_PHOTO', 'WORK_POSITION']
            });

            this.allResourcesCache = users.map(user => ({
                id: parseInt(user.ID, 10),
                name: `${user.NAME || ''} ${user.LAST_NAME || ''}`.trim() || `User ${user.ID}`,
                type: 'employee' as ResourceType,
                avatar: user.PERSONAL_PHOTO,
                description: user.WORK_POSITION,
                isActive: true
            }));

            this.cacheTimestamp = Date.now();
            return this.allResourcesCache;
        } catch (error) {
            console.error('[ResourceService] Failed to load users as resources:', error);
            return [];
        }
    }

    async getResource(resourceId: number): Promise<Resource | null> {
        if (this.resourceCache.has(resourceId)) {
            return this.resourceCache.get(resourceId) ?? null;
        }

        await this.getResources();
        return this.resourceCache.get(resourceId) ?? null;
    }

    async getResourcesByIds(resourceIds: number[]): Promise<Resource[]> {
        await this.getResources();
        return resourceIds
            .map(id => this.resourceCache.get(id))
            .filter((r): r is Resource => r !== undefined);
    }

    async getActiveResources(): Promise<Resource[]> {
        const allResources = await this.getResources();
        return allResources.filter(r => r.isActive);
    }

    async getResourcesByType(type: ResourceType): Promise<Resource[]> {
        const allResources = await this.getResources();
        return allResources.filter(r => r.type === type);
    }

    async searchResources(query: string): Promise<Resource[]> {
        const allResources = await this.getResources();
        const lowerQuery = query.toLowerCase();
        return allResources.filter(r =>
            r.name.toLowerCase().includes(lowerQuery) ||
            r.description?.toLowerCase().includes(lowerQuery)
        );
    }

    private mapApiToResource(item: ResourceApiItem): Resource {
        return {
            id: parseInt(item.ID, 10),
            name: item.NAME,
            type: this.mapResourceType(item.TYPE),
            avatar: item.AVATAR,
            color: item.COLOR,
            description: item.DESCRIPTION,
            isActive: item.ACTIVE === 'Y' || item.ACTIVE === '1'
        };
    }

    private mapResourceType(type: string): ResourceType {
        const normalized = type.toLowerCase();
        if (normalized.includes('room')) return 'room';
        if (normalized.includes('equip')) return 'equipment';
        if (normalized.includes('employee')) return 'employee';
        return 'other';
    }
}

interface BookingResourceListResponse {
    resources?: BookingResourceItem[];
}

interface BookingResourceItem {
    id?: number;
    name?: string;
    typeId?: string;
    avatarUrl?: string;
    color?: string;
    description?: string;
    isActive?: boolean;
}

interface UserApiItem {
    ID: string;
    NAME?: string;
    LAST_NAME?: string;
    PERSONAL_PHOTO?: string;
    WORK_POSITION?: string;
}

export const resourceService = new ResourceService();
