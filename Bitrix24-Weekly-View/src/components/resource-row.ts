/**
 * Resource Row Component
 * Renders a single resource row with all its day cells
 */

import { createElement } from '../utils/dom.utils.js';
import { BookingCellComponent } from './booking-cell.js';
import type { WeeklyResourceBookings, Booking } from '../models/booking.model.js';
import type { Resource } from '../models/resource.model.js';
import { resourceService } from '../api/resource.service.js';

export interface ResourceRowOptions {
    weeklyBookings: WeeklyResourceBookings;
    resource: Resource;
    locale: string;
    use24Hour: boolean;
    onCellClick: (resourceId: number, date: Date, element: HTMLElement) => void;
    onBookingClick: (booking: Booking, element: HTMLElement) => void;
}

export class ResourceRowComponent {
    private element: HTMLElement;
    private options: ResourceRowOptions;
    private cellComponents: BookingCellComponent[] = [];

    constructor(options: ResourceRowOptions) {
        this.options = options;
        this.element = this.render();
    }

    /**
     * Render the resource row
     */
    private render(): HTMLElement {
        const { resource, weeklyBookings } = this.options;

        const row = createElement('div', {
            className: 'bx-booking-row',
            dataset: {
                resourceId: resource.id.toString()
            }
        });

        // Resource header (left column)
        const header = this.renderResourceHeader(resource);
        row.appendChild(header);

        // Day cells
        const cells = createElement('div', { className: 'bx-booking-row__cells' });
        
        this.cellComponents = [];
        for (const dayBookings of weeklyBookings.days) {
            const cellComponent = new BookingCellComponent({
                dayBookings,
                resourceId: resource.id,
                locale: this.options.locale,
                use24Hour: this.options.use24Hour,
                onCellClick: this.options.onCellClick,
                onBookingClick: this.options.onBookingClick
            });
            
            this.cellComponents.push(cellComponent);
            cells.appendChild(cellComponent.getElement());
        }

        row.appendChild(cells);

        return row;
    }

    /**
     * Render resource header
     */
    private renderResourceHeader(resource: Resource): HTMLElement {
        const header = createElement('div', { className: 'bx-booking-row__header' });

        // Avatar
        const avatarContainer = createElement('div', { className: 'bx-booking-row__avatar' });
        
        if (resource.avatar) {
            const avatar = createElement('img', {
                className: 'bx-booking-row__avatar-img',
                attributes: {
                    src: resource.avatar,
                    alt: resource.name,
                    loading: 'lazy'
                }
            });
            avatarContainer.appendChild(avatar);
        } else {
            // Default avatar with initials
            const initials = this.getInitials(resource.name);
            const defaultAvatar = createElement('div', {
                className: 'bx-booking-row__avatar-default',
                text: initials,
                attributes: {
                    style: `background-color: ${resourceService.getResourceColor(resource)}`
                }
            });
            avatarContainer.appendChild(defaultAvatar);
        }

        // Resource info
        const info = createElement('div', { className: 'bx-booking-row__info' });
        
        const name = createElement('div', {
            className: 'bx-booking-row__name',
            text: resource.name
        });
        
        const type = createElement('div', {
            className: 'bx-booking-row__type',
            text: this.formatResourceType(resource.type)
        });

        info.appendChild(name);
        info.appendChild(type);

        header.appendChild(avatarContainer);
        header.appendChild(info);

        return header;
    }

    /**
     * Get initials from name
     */
    private getInitials(name: string): string {
        return name
            .split(' ')
            .map(part => part[0])
            .filter(Boolean)
            .slice(0, 2)
            .join('')
            .toUpperCase();
    }

    /**
     * Format resource type for display
     */
    private formatResourceType(type: string): string {
        const typeLabels: Record<string, string> = {
            'employee': 'Expert',
            'room': 'Room',
            'equipment': 'Equipment',
            'other': 'Resource'
        };
        return typeLabels[type] ?? type;
    }

    /**
     * Get the rendered element
     */
    public getElement(): HTMLElement {
        return this.element;
    }

    /**
     * Update the row with new booking data
     */
    public update(weeklyBookings: WeeklyResourceBookings): void {
        this.options.weeklyBookings = weeklyBookings;
        
        // Update each cell
        for (let i = 0; i < this.cellComponents.length; i++) {
            const dayBookings = weeklyBookings.days[i];
            const cellComponent = this.cellComponents[i];
            if (dayBookings && cellComponent) {
                cellComponent.update(dayBookings);
            }
        }
    }

    /**
     * Destroy component
     */
    public destroy(): void {
        for (const cell of this.cellComponents) {
            cell.destroy();
        }
        this.cellComponents = [];
        this.element.remove();
    }
}
