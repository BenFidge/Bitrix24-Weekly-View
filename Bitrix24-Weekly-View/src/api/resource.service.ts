/**
 * Resource Service
 * Handles resource-related API operations
 */

import { bitrix24Api } from './bitrix24.api.js';
import type { Resource, ResourceApiItem, ResourceType } from '../models/resource.model.js';

export class ResourceService {
    private resourceCache: Map<number, Resource> = new Map();
    private allResourcesCache: Resource[] | null = null;
    private cacheTimestamp: number = 0;
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    /**
     * Get all resources (with caching)
     * Tries multiple API endpoints as Bitrix24 Booking API varies by version
     */
    async getResources(forceRefresh = false): Promise<Resource[]> {
        const now = Date.now();

        if (!forceRefresh && this.allResourcesCache && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
            return this.allResourcesCache;
        }

        // Bitrix24 Booking API v1 methods
        // Documentation: https://apidocs.bitrix24.com/api-reference/booking/
        try {
            console.log('[ResourceService] Calling booking.v1.resource.list');
            const resources = await this.fetchResourcesFromApi();

            if (resources.length > 0) {
                this.allResourcesCache = resources;
                this.cacheTimestamp = now;

                for (const resource of this.allResourcesCache) {
                    this.resourceCache.set(resource.id, resource);
                }

                console.log(`[ResourceService] ✓ Loaded ${resources.length} resources`);
                return this.allResourcesCache;
            }
        } catch (error) {
            console.error('[ResourceService] booking.v1.resource.list failed:', error);
        }

        // If API fails, fall back to users as resources
        console.log('[ResourceService] Falling back to users as resources');
        return this.getUsersAsResources();
    }

    /**
     * Fetch resources from Bitrix24 Booking API v1
     */
    private async fetchResourcesFromApi(): Promise<Resource[]> {
        // Call with filter parameter (Bitrix24 uses uppercase FILTER)
        const response = await bitrix24Api.callMethod<BookingResourceListResponse>('booking.v1.resource.list', {
            filter: {}  // Get all resources
        });

        // Log the raw response for debugging
        console.log('[ResourceService] Raw API response:', JSON.stringify(response, null, 2));

        // Handle various response formats from Bitrix24
        let items: BookingResourceItem[] = [];

        if (response && typeof response === 'object') {
            // Format: { resources: [...] }
            if ('resources' in response && Array.isArray(response.resources)) {
                items = response.resources;
                console.log('[ResourceService] Found resources in response.resources');
            }
            // Format: direct array
            else if (Array.isArray(response)) {
                items = response as unknown as BookingResourceItem[];
                console.log('[ResourceService] Response is direct array');
            }
            // Format: { result: { resources: [...] } } or { result: [...] }
            else if ('result' in response) {
                const result = (response as { result: unknown }).result;
                if (Array.isArray(result)) {
                    items = result as BookingResourceItem[];
                    console.log('[ResourceService] Found resources in response.result (array)');
                } else if (result && typeof result === 'object' && 'resources' in (result as object)) {
                    items = (result as { resources: BookingResourceItem[] }).resources;
                    console.log('[ResourceService] Found resources in response.result.resources');
                }
            }
            // Format: Check for any array property
            else {
                for (const key of Object.keys(response)) {
                    const value = (response as Record<string, unknown>)[key];
                    if (Array.isArray(value)) {
                        items = value as BookingResourceItem[];
                        console.log(`[ResourceService] Found resources in response.${key} (${items.length} items)`);
                        break;
                    }
                }
            }
        }

        if (items.length === 0) {
            console.log('[ResourceService] No resources returned from API. Have you added resources in Bitrix24 Booking settings?');
        }

        console.log(`[ResourceService] Parsed ${items.length} resource items`);
        return items.map(item => this.mapBookingResourceToResource(item));
    }

    /**
     * Map Booking API resource to our Resource model
     * Handles both camelCase and other naming conventions from API
     */
    private mapBookingResourceToResource(item: BookingResourceItem): Resource {
        // Log item for debugging
        console.log('[ResourceService] Mapping resource item:', item);

        // Cast to unknown first to handle various property names
        const obj = item as unknown as Record<string, unknown>;

        // Handle various property name formats
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

    /**
     * Get users as resources (fallback when booking API not available)
     */
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
            console.log(`[ResourceService] Loaded ${this.allResourcesCache.length} users as resources`);

            return this.allResourcesCache;
        } catch (error) {
            console.error('[ResourceService] Failed to load users as resources:', error);
            return [];
        }
    }

    /**
     * Map any API response item to Resource
     */
    private mapAnyToResource(item: unknown, index: number): Resource {
        const obj = item as Record<string, unknown>;
        const avatar = obj['AVATAR'] || obj['avatar'] || obj['PERSONAL_PHOTO'];
        const color = obj['COLOR'] || obj['color'];
        const description = obj['DESCRIPTION'] || obj['description'];

        return {
            id: parseInt(String(obj['ID'] || obj['id'] || index + 1), 10),
            name: String(obj['NAME'] || obj['name'] || obj['TITLE'] || obj['title'] || `Resource ${index + 1}`),
            type: this.mapResourceType(String(obj['TYPE'] || obj['type'] || 'employee')),
            avatar: typeof avatar === 'string' ? avatar : undefined,
            color: typeof color === 'string' ? color : undefined,
            description: typeof description === 'string' ? description : undefined,
            isActive: obj['ACTIVE'] !== 'N' && obj['ACTIVE'] !== false
        };
    }

    /**
     * Get a single resource by ID
     */
    async getResource(resourceId: number): Promise<Resource | null> {
        // Check cache first
        if (this.resourceCache.has(resourceId)) {
            return this.resourceCache.get(resourceId) ?? null;
        }

        // Resource not in cache, try to load all resources
        await this.getResources();
        return this.resourceCache.get(resourceId) ?? null;
    }

    /**
     * Get multiple resources by IDs
     */
    async getResourcesByIds(resourceIds: number[]): Promise<Resource[]> {
        await this.getResources();
        return resourceIds
            .map(id => this.resourceCache.get(id))
            .filter((r): r is Resource => r !== undefined);
    }

    /**
     * Get active resources for booking view
     */
    async getActiveResources(): Promise<Resource[]> {
        const allResources = await this.getResources();
        return allResources.filter(r => r.isActive);
    }

    /**
     * Get resources by type
     */
    async getResourcesByType(type: ResourceType): Promise<Resource[]> {
        const allResources = await this.getResources();
        return allResources.filter(r => r.type === type);
    }

    /**
     * Search resources by name
     */
    async searchResources(query: string): Promise<Resource[]> {
        const allResources = await this.getResources();
        const lowerQuery = query.toLowerCase();
        return allResources.filter(r => 
            r.name.toLowerCase().includes(lowerQuery) ||
            r.description?.toLowerCase().includes(lowerQuery)
        );
    }

    /**
     * Map API response to Resource model
     */
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

    /**
     * Map API type string to ResourceType
     */
    private mapResourceType(type: string): ResourceType {
        const typeMap: Record<string, ResourceType> = {
            'employee': 'employee',
            'user': 'employee',
            'room': 'room',
            'location': 'room',
            'equipment': 'equipment',
            'resource': 'equipment'
        };

        return typeMap[type?.toLowerCase()] ?? 'employee';
    }

    /**
     * Clear resource cache
     */
    clearCache(): void {
        this.resourceCache.clear();
        this.allResourcesCache = null;
        this.cacheTimestamp = 0;
    }

    /**
     * Get resource avatar URL with fallback
     */
    getResourceAvatarUrl(resource: Resource): string {
        if (resource.avatar) {
            return resource.avatar;
        }

        // Return a default avatar based on type
        const defaultAvatars: Record<ResourceType, string> = {
            employee: '/bitrix/images/booking/default-user.svg',
            room: '/bitrix/images/booking/default-room.svg',
            equipment: '/bitrix/images/booking/default-equipment.svg',
            other: '/bitrix/images/booking/default-resource.svg'
        };

        return defaultAvatars[resource.type];
    }

    /**
     * Get resource display color
     */
    getResourceColor(resource: Resource): string {
        if (resource.color) {
            return resource.color;
        }

        // Default colors by type
        const defaultColors: Record<ResourceType, string> = {
            employee: '#2FC6F6',
            room: '#9DCF00',
            equipment: '#FFA900',
            other: '#A8A8A8'
        };

        return defaultColors[resource.type];
    }
}

interface UserApiItem {
    ID: string;
    NAME?: string;
    LAST_NAME?: string;
    PERSONAL_PHOTO?: string;
    WORK_POSITION?: string;
}

// Bitrix24 Booking API v1 response types
interface BookingResourceListResponse {
    resources?: BookingResourceItem[];
}

interface BookingResourceItem {
    id: number;
    name?: string;
    typeId?: number;
    avatarUrl?: string;
    color?: string;
    description?: string;
    isActive?: boolean;
}

// Export singleton instance
export const resourceService = new ResourceService();
