/**
 * Contact Service
 * Handles CRM Contact operations for booking
 */

import { bitrix24Api } from './bitrix24.api.js';

export interface Contact {
    id: number;
    name: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
}

interface ContactApiItem {
    ID: string;
    NAME?: string;
    LAST_NAME?: string;
    PHONE?: Array<{ VALUE: string; VALUE_TYPE: string }>;
    EMAIL?: Array<{ VALUE: string; VALUE_TYPE: string }>;
}

export class ContactService {
    /**
     * Search contacts by name, phone, or email
     */
    async searchContacts(query: string, limit = 10): Promise<Contact[]> {
        if (!query || query.length < 2) {
            return [];
        }

        try {
            const response = await bitrix24Api.callMethod<ContactApiItem[]>('crm.contact.list', {
                filter: {
                    '%NAME': query,
                    'LOGIC': 'OR',
                    '%LAST_NAME': query,
                    '%PHONE': query,
                    '%EMAIL': query
                },
                select: ['ID', 'NAME', 'LAST_NAME', 'PHONE', 'EMAIL'],
                order: { 'NAME': 'ASC' },
                start: 0
            });

            if (!Array.isArray(response)) {
                return [];
            }

            return response.slice(0, limit).map(item => this.mapContactApiToContact(item));
        } catch (error) {
            console.error('[ContactService] Search failed:', error);
            
            // Try simpler search
            return this.searchContactsSimple(query, limit);
        }
    }

    /**
     * Simple search fallback
     */
    private async searchContactsSimple(query: string, limit: number): Promise<Contact[]> {
        try {
            const response = await bitrix24Api.callMethod<ContactApiItem[]>('crm.contact.list', {
                filter: { '%NAME': query },
                select: ['ID', 'NAME', 'LAST_NAME', 'PHONE', 'EMAIL'],
                start: 0
            });

            if (!Array.isArray(response)) {
                return [];
            }

            return response.slice(0, limit).map(item => this.mapContactApiToContact(item));
        } catch (error) {
            console.error('[ContactService] Simple search failed:', error);
            return [];
        }
    }

    /**
     * Get a single contact by ID
     */
    async getContact(contactId: number): Promise<Contact | null> {
        try {
            const response = await bitrix24Api.callMethod<ContactApiItem>('crm.contact.get', {
                id: contactId
            });

            return response ? this.mapContactApiToContact(response) : null;
        } catch (error) {
            console.error('[ContactService] Get contact failed:', error);
            return null;
        }
    }

    /**
     * Create a new contact
     */
    async createContact(data: {
        firstName: string;
        lastName?: string;
        phone?: string;
        email?: string;
    }): Promise<Contact | null> {
        try {
            const fields: Record<string, unknown> = {
                NAME: data.firstName,
                LAST_NAME: data.lastName || ''
            };

            if (data.phone) {
                fields['PHONE'] = [{ VALUE: data.phone, VALUE_TYPE: 'MOBILE' }];
            }

            if (data.email) {
                fields['EMAIL'] = [{ VALUE: data.email, VALUE_TYPE: 'WORK' }];
            }

            const response = await bitrix24Api.callMethod<number>('crm.contact.add', {
                fields
            });

            if (response) {
                return this.getContact(response);
            }

            return null;
        } catch (error) {
            console.error('[ContactService] Create contact failed:', error);
            return null;
        }
    }

    /**
     * Update an existing contact
     */
    async updateContact(contactId: number, data: {
        phone?: string;
        email?: string;
    }): Promise<boolean> {
        try {
            const fields: Record<string, unknown> = {};

            if (data.phone) {
                fields['PHONE'] = [{ VALUE: data.phone, VALUE_TYPE: 'MOBILE' }];
            }

            if (data.email) {
                fields['EMAIL'] = [{ VALUE: data.email, VALUE_TYPE: 'WORK' }];
            }

            await bitrix24Api.callMethod('crm.contact.update', {
                id: contactId,
                fields
            });

            return true;
        } catch (error) {
            console.error('[ContactService] Update contact failed:', error);
            return false;
        }
    }

    /**
     * Map API response to Contact model
     */
    private mapContactApiToContact(item: ContactApiItem): Contact {
        const phone = item.PHONE?.[0]?.VALUE || '';
        const email = item.EMAIL?.[0]?.VALUE || '';
        const firstName = item.NAME || '';
        const lastName = item.LAST_NAME || '';

        return {
            id: parseInt(item.ID, 10),
            name: `${firstName} ${lastName}`.trim() || `Contact ${item.ID}`,
            firstName,
            lastName,
            phone,
            email
        };
    }
}

// Export singleton
export const contactService = new ContactService();
