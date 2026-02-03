/**
 * Bitrix24 UI Utilities - FALLBACK COMPONENTS
 * 
 * PREFERRED: Use `ui-kit.utils.ts` which loads official Bitrix24 UI Kit via BX.loadExt()
 * 
 * This module provides fallback Bitrix24-styled components for:
 * - Custom layouts (calendar grid, booking blocks)
 * - Situations where UI Kit fails to load
 * - Local development/testing without Bitrix24
 * 
 * For official interactions like opening sliders, selecting users/CRM entities,
 * use the BX24 SDK methods in bitrix24.api.ts instead.
 * 
 * @see ui-kit.utils.ts for official UI Kit integration
 */

import { createElement, addEvent } from './dom.utils.js';

// ============================================================================
// BUTTON COMPONENTS (Fallback - prefer BX.UI.Button from ui-kit.utils.ts)
// ============================================================================

export type ButtonColor = 'primary' | 'success' | 'danger' | 'light' | 'link';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonOptions {
    text: string;
    color?: ButtonColor;
    size?: ButtonSize;
    icon?: string;
    disabled?: boolean;
    loading?: boolean;
    className?: string;
    onClick?: (e: MouseEvent) => void;
}
/**
 * Create a Bitrix24-styled button
 */
export function createButton(options: ButtonOptions): HTMLButtonElement {
    const {
        text,
        color = 'primary',
        size = 'md',
        icon,
        disabled = false,
        loading = false,
        className = '',
        onClick
    } = options;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = `ui-btn ui-btn-${color} ui-btn-${size} ${className}`.trim();
    button.disabled = disabled || loading;

    if (loading) {
        button.classList.add('ui-btn-wait');
    }

    if (icon) {
        const iconEl = createElement('span', { className: `ui-btn-icon ${icon}` });
        button.appendChild(iconEl);
    }

    const textSpan = createElement('span', { text });
    button.appendChild(textSpan);

    if (onClick) {
        addEvent(button, 'click', onClick);
    }

    return button;
}

/**
 * Set button loading state
 */
export function setButtonLoading(button: HTMLButtonElement, loading: boolean): void {
    button.disabled = loading;
    if (loading) {
        button.classList.add('ui-btn-wait');
    } else {
        button.classList.remove('ui-btn-wait');
    }
}

// ============================================================================
// DIALOG/MODAL COMPONENTS
// ============================================================================

export interface DialogOptions {
    title?: string;
    content: HTMLElement | string;
    width?: number;
    buttons?: DialogButton[];
    closeOnOverlay?: boolean;
    onClose?: () => void;
}

export interface DialogButton {
    text: string;
    color?: ButtonColor;
    onClick?: (dialog: Dialog) => void;
    closeOnClick?: boolean;
}

export class Dialog {
    private overlay: HTMLElement;
    private dialog: HTMLElement;
    private options: DialogOptions;

    constructor(options: DialogOptions) {
        this.options = {
            closeOnOverlay: true,
            ...options
        };

        this.overlay = this.createOverlay();
        this.dialog = this.createDialog();
        this.overlay.appendChild(this.dialog);
    }

    private createOverlay(): HTMLElement {
        const overlay = createElement('div', {
            className: 'bx-dialog-overlay'
        });

        if (this.options.closeOnOverlay) {
            addEvent(overlay, 'click', (e) => {
                if (e.target === overlay) {
                    this.close();
                }
            });
        }

        return overlay;
    }

    private createDialog(): HTMLElement {
        const dialog = createElement('div', {
            className: 'bx-dialog'
        });

        if (this.options.width) {
            dialog.style.width = `${this.options.width}px`;
        }

        // Header
        if (this.options.title) {
            const header = createElement('div', { className: 'bx-dialog__header' });
            const title = createElement('div', {
                className: 'bx-dialog__title',
                text: this.options.title
            });
            const closeBtn = createElement('button', {
                className: 'bx-dialog__close',
                attributes: { type: 'button', 'aria-label': 'Close' }
            });
            addEvent(closeBtn, 'click', () => this.close());

            header.appendChild(title);
            header.appendChild(closeBtn);
            dialog.appendChild(header);
        }

        // Content
        const content = createElement('div', { className: 'bx-dialog__content' });
        if (typeof this.options.content === 'string') {
            content.innerHTML = this.options.content;
        } else {
            content.appendChild(this.options.content);
        }
        dialog.appendChild(content);

        // Footer with buttons
        if (this.options.buttons && this.options.buttons.length > 0) {
            const footer = createElement('div', { className: 'bx-dialog__footer' });

            for (const btnConfig of this.options.buttons) {
                const btn = createButton({
                    text: btnConfig.text,
                    color: btnConfig.color || 'primary',
                    onClick: () => {
                        btnConfig.onClick?.(this);
                        if (btnConfig.closeOnClick !== false) {
                            this.close();
                        }
                    }
                });
                footer.appendChild(btn);
            }

            dialog.appendChild(footer);
        }

        return dialog;
    }

    show(): void {
        document.body.appendChild(this.overlay);
        requestAnimationFrame(() => {
            this.overlay.classList.add('bx-dialog-overlay--visible');
            this.dialog.classList.add('bx-dialog--visible');
        });
    }

    close(): void {
        this.overlay.classList.remove('bx-dialog-overlay--visible');
        this.dialog.classList.remove('bx-dialog--visible');

        setTimeout(() => {
            this.overlay.remove();
            this.options.onClose?.();
        }, 200);
    }

    getContentElement(): HTMLElement {
        return this.dialog.querySelector('.bx-dialog__content') as HTMLElement;
    }
}

// ============================================================================
// MESSAGE BOX (Alert/Confirm)
// ============================================================================

/**
 * Show an alert message box
 */
export function showAlert(message: string, title = 'Notice'): Promise<void> {
    return new Promise((resolve) => {
        const dialog = new Dialog({
            title,
            content: message,
            width: 400,
            buttons: [
                { text: 'OK', color: 'primary' }
            ],
            onClose: () => resolve()
        });
        dialog.show();
    });
}

/**
 * Show a confirmation dialog
 */
export function showConfirm(message: string, title = 'Confirm'): Promise<boolean> {
    return new Promise((resolve) => {
        let confirmed = false;
        const dialog = new Dialog({
            title,
            content: message,
            width: 400,
            closeOnOverlay: false,
            buttons: [
                {
                    text: 'Cancel',
                    color: 'light',
                    onClick: () => { confirmed = false; }
                },
                {
                    text: 'Confirm',
                    color: 'primary',
                    onClick: () => { confirmed = true; }
                }
            ],
            onClose: () => resolve(confirmed)
        });
        dialog.show();
    });
}

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
    message: string;
    type?: ToastType;
    duration?: number;
}

let toastContainer: HTMLElement | null = null;

function getToastContainer(): HTMLElement {
    if (!toastContainer) {
        toastContainer = createElement('div', { className: 'bx-toast-container' });
        document.body.appendChild(toastContainer);
    }
    return toastContainer;
}

/**
 * Show a toast notification
 */
export function showToast(options: ToastOptions): void {
    const { message, type = 'info', duration = 3000 } = options;

    const container = getToastContainer();
    const toast = createElement('div', {
        className: `bx-toast bx-toast--${type}`,
        text: message
    });

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('bx-toast--visible');
    });

    setTimeout(() => {
        toast.classList.remove('bx-toast--visible');
        setTimeout(() => toast.remove(), 200);
    }, duration);
}

// ============================================================================
// LOADING INDICATOR
// ============================================================================

let globalLoader: HTMLElement | null = null;

/**
 * Show global loading indicator
 */
export function showLoading(message = 'Loading...'): void {
    if (globalLoader) return;

    globalLoader = createElement('div', { className: 'bx-loading-overlay' });
    const spinner = createElement('div', { className: 'bx-loading-spinner' });
    const text = createElement('div', {
        className: 'bx-loading-text',
        text: message
    });

    globalLoader.appendChild(spinner);
    globalLoader.appendChild(text);
    document.body.appendChild(globalLoader);
}

/**
 * Hide global loading indicator
 */
export function hideLoading(): void {
    if (globalLoader) {
        globalLoader.remove();
        globalLoader = null;
    }
}

// ============================================================================
// DROPDOWN MENU
// ============================================================================

export interface DropdownItem {
    text: string;
    icon?: string;
    disabled?: boolean;
    separator?: boolean;
    onClick?: () => void;
}

export interface DropdownOptions {
    items: DropdownItem[];
    trigger: HTMLElement;
    position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
}

/**
 * Create and show a dropdown menu
 */
export function showDropdown(options: DropdownOptions): void {
    const { items, trigger, position = 'bottom-left' } = options;

    // Remove any existing dropdown
    document.querySelector('.bx-dropdown')?.remove();

    const dropdown = createElement('div', { className: `bx-dropdown bx-dropdown--${position}` });

    for (const item of items) {
        if (item.separator) {
            dropdown.appendChild(createElement('div', { className: 'bx-dropdown__separator' }));
            continue;
        }

        const menuItem = createElement('button', {
            className: `bx-dropdown__item ${item.disabled ? 'bx-dropdown__item--disabled' : ''}`,
            attributes: { type: 'button' }
        });

        if (item.disabled) {
            (menuItem as HTMLButtonElement).disabled = true;
        }

        if (item.icon) {
            menuItem.appendChild(createElement('span', { className: `bx-dropdown__icon ${item.icon}` }));
        }

        menuItem.appendChild(createElement('span', { text: item.text }));

        if (item.onClick && !item.disabled) {
            addEvent(menuItem, 'click', () => {
                dropdown.remove();
                item.onClick?.();
            });
        }

        dropdown.appendChild(menuItem);
    }

    // Position the dropdown
    const rect = trigger.getBoundingClientRect();
    dropdown.style.position = 'fixed';

    if (position.includes('bottom')) {
        dropdown.style.top = `${rect.bottom + 4}px`;
    } else {
        dropdown.style.bottom = `${window.innerHeight - rect.top + 4}px`;
    }

    if (position.includes('left')) {
        dropdown.style.left = `${rect.left}px`;
    } else {
        dropdown.style.right = `${window.innerWidth - rect.right}px`;
    }

    document.body.appendChild(dropdown);

    // Close on outside click
    const closeHandler = (e: MouseEvent) => {
        if (!dropdown.contains(e.target as Node) && e.target !== trigger) {
            dropdown.remove();
            document.removeEventListener('click', closeHandler);
        }
    };

    // Delay to prevent immediate close
    setTimeout(() => {
        document.addEventListener('click', closeHandler);
    }, 0);
}
