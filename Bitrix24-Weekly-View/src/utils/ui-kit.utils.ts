/**
 * Bitrix24 UI Kit Loader
 * 
 * For iframe-based apps, the full BX object (with UI components) lives in the parent window.
 * This module attempts to access parent.BX.loadExt() to load official UI Kit components.
 * 
 * If parent.BX is not accessible (cross-origin restrictions, etc.), fallback components
 * from bx24-ui.utils.ts will be used instead.
 * 
 * Usage:
 *   await loadUiKit(['ui.buttons', 'ui.dialogs']);
 *   const btn = new BX.UI.Button({ text: 'Click me', color: BX.UI.Button.Color.PRIMARY });
 */

/**
 * Available UI Kit extensions that are commonly used
 */
export const UI_KIT_EXTENSIONS = {
    BUTTONS: 'ui.buttons',
    DIALOGS: 'ui.dialogs',
    NOTIFICATION: 'ui.notification',
    FORMS: 'ui.forms',
    ICONS: 'ui.icons',
    BUTTONS_ICONS: 'ui.buttons.icons',
    ENTITY_SELECTOR: 'ui.entity-selector',
    LABEL: 'ui.label',
    ALERTS: 'ui.alerts',
    HINT: 'ui.hint',
    PROGRESSBAR: 'ui.progressbar',
    SIDEPANEL: 'sidepanel'
} as const;

/**
 * Default extensions to load for most apps
 */
export const DEFAULT_UI_KIT_EXTENSIONS = [
    UI_KIT_EXTENSIONS.BUTTONS,
    UI_KIT_EXTENSIONS.DIALOGS,
    UI_KIT_EXTENSIONS.NOTIFICATION,
    UI_KIT_EXTENSIONS.FORMS,
    UI_KIT_EXTENSIONS.ICONS
];

/**
 * Track which extensions have been loaded
 */
const loadedExtensions = new Set<string>();

/**
 * Reference to the BX object (either from current window or parent)
 */
let bxRef: typeof BX | null = null;
let bxLoadPromise: Promise<typeof BX | null> | null = null;

/**
 * Get reference to BX object (tries current window, then parent window)
 */
function getBX(): typeof BX | null {
    if (bxRef) return bxRef;

    // Try current window first
    if (typeof BX !== 'undefined' && typeof BX.loadExt === 'function') {
        bxRef = BX;
        console.log('[UI Kit] Found BX in current window');
        return bxRef;
    }

    // Try parent window (for iframe apps)
    try {
        const parentBX = (window.parent as typeof window & { BX?: typeof BX }).BX;
        if (parentBX && typeof parentBX.loadExt === 'function') {
            bxRef = parentBX;
            console.log('[UI Kit] Found BX in parent window');
            return bxRef;
        }
    } catch (e) {
        // Cross-origin access denied - this is expected for some configurations
        console.warn('[UI Kit] Cannot access parent.BX (cross-origin restriction)');
    }

    return null;
}

/**
 * Ensure BX core is available in the current window (for iframe apps)
 */
async function ensureBXLoaded(): Promise<typeof BX | null> {
    const existing = getBX();
    if (existing) {
        return existing;
    }

    if (bxLoadPromise) {
        return bxLoadPromise;
    }

    if (typeof BX24 === 'undefined') {
        return null;
    }

    bxLoadPromise = new Promise((resolve) => {
        const domain = BX24.getDomain(true);
        if (!domain) {
            resolve(null);
            return;
        }

        const trimmedDomain = domain.replace(/\/$/, '');
        const normalizedDomain = trimmedDomain.includes('://') ? trimmedDomain : `https://${trimmedDomain}`;
        const coreUrl = `${normalizedDomain}/bitrix/js/main/core/core.js`;

        const script = document.createElement('script');
        script.src = coreUrl;
        script.async = true;

        script.onload = () => {
            if (typeof BX !== 'undefined' && typeof BX.loadExt === 'function') {
                bxRef = BX;
                console.log('[UI Kit] Loaded BX core in current window');
                resolve(bxRef);
            } else {
                resolve(null);
            }
        };

        script.onerror = () => {
            console.warn('[UI Kit] Failed to load BX core script:', coreUrl);
            resolve(null);
        };

        document.head.appendChild(script);
    });

    return bxLoadPromise;
}

/**
 * Check if BX.loadExt is available (either in current window or parent)
 */
export function isUiKitAvailable(): boolean {
    return getBX() !== null;
}

/**
 * Get the BX object for direct usage
 */
export function getUiKit(): typeof BX | null {
    return getBX();
}

/**
 * Load one or more Bitrix UI Kit extensions
 * 
 * @param extensions - Single extension name or array of extension names
 * @returns Promise that resolves when all extensions are loaded
 * 
 * @example
 * await loadUiKit('ui.buttons');
 * await loadUiKit(['ui.buttons', 'ui.dialogs', 'ui.notification']);
 */
export async function loadUiKit(extensions: string | string[]): Promise<void> {
    const list = Array.isArray(extensions) ? extensions : [extensions];

    // Filter out already loaded extensions
    const toLoad = list.filter(ext => !loadedExtensions.has(ext));

    if (toLoad.length === 0) {
        return;
    }

    const bx = await ensureBXLoaded();
    if (!bx) {
        // UI Kit not available - fallback components will be used
        console.warn('[UI Kit] BX.loadExt not available - using fallback components.');
        return;
    }

    try {
        await bx.loadExt(toLoad);
        toLoad.forEach(ext => loadedExtensions.add(ext));
        console.log('[UI Kit] Loaded extensions:', toLoad);
    } catch (error) {
        console.error('[UI Kit] Failed to load extensions:', error);
        // Don't reject - just warn and continue with fallbacks
        console.warn('[UI Kit] Continuing with fallback components');
    }
}

/**
 * Check if an extension has been loaded
 */
export function isExtensionLoaded(extension: string): boolean {
    return loadedExtensions.has(extension);
}

/**
 * Load default UI Kit extensions (buttons, dialogs, notifications, forms, icons)
 * Gracefully handles cases where UI Kit is not available (local dev, etc.)
 */
export function loadDefaultUiKit(): Promise<void> {
    return loadUiKit(DEFAULT_UI_KIT_EXTENSIONS);
}

// ============================================================================
// UI KIT COMPONENT HELPERS
// These provide type-safe wrappers around BX.UI components
// ============================================================================

/**
 * Create a Bitrix24 UI Button
 */
export function createUiButton(options: {
    text: string;
    color?: 'primary' | 'success' | 'danger' | 'secondary' | 'link' | 'light';
    size?: 'xs' | 'sm' | 'md' | 'lg';
    icon?: string;
    disabled?: boolean;
    onclick?: () => void;
}): unknown {
    const bx = getBX();
    if (!bx?.UI?.Button) {
        console.warn('[UI Kit] BX.UI.Button not loaded. Call loadUiKit("ui.buttons") first.');
        return null;
    }

    const colorMap: Record<string, unknown> = {
        primary: bx.UI.Button.Color.PRIMARY,
        success: bx.UI.Button.Color.SUCCESS,
        danger: bx.UI.Button.Color.DANGER,
        secondary: bx.UI.Button.Color.SECONDARY,
        link: bx.UI.Button.Color.LINK,
        light: bx.UI.Button.Color.LIGHT_BORDER
    };

    const sizeMap: Record<string, unknown> = {
        xs: bx.UI.Button.Size.EXTRA_SMALL,
        sm: bx.UI.Button.Size.SMALL,
        md: bx.UI.Button.Size.MEDIUM,
        lg: bx.UI.Button.Size.LARGE
    };

    return new bx.UI.Button({
        text: options.text,
        color: colorMap[options.color || 'primary'],
        size: sizeMap[options.size || 'md'],
        icon: options.icon,
        disabled: options.disabled,
        onclick: options.onclick
    });
}

/**
 * Show a confirmation dialog using Bitrix24 UI Kit
 */
export function showUiConfirm(
    message: string,
    title = 'Confirm'
): Promise<boolean> {
    return new Promise((resolve) => {
        const bx = getBX();
        if (!bx?.UI?.Dialogs?.MessageBox) {
            console.warn('[UI Kit] BX.UI.Dialogs not loaded. Call loadUiKit("ui.dialogs") first.');
            // Fallback to native confirm
            resolve(window.confirm(message));
            return;
        }

        bx.UI.Dialogs.MessageBox.confirm(
            message,
            title,
            (messageBox: { close: () => void }) => {
                messageBox.close();
                resolve(true);
            },
            'Confirm',
            (messageBox: { close: () => void }) => {
                messageBox.close();
                resolve(false);
            },
            'Cancel'
        );
    });
}

/**
 * Show an alert dialog using Bitrix24 UI Kit
 */
export function showUiAlert(message: string, title = 'Notice'): Promise<void> {
    return new Promise((resolve) => {
        const bx = getBX();
        if (!bx?.UI?.Dialogs?.MessageBox) {
            console.warn('[UI Kit] BX.UI.Dialogs not loaded. Call loadUiKit("ui.dialogs") first.');
            window.alert(message);
            resolve();
            return;
        }

        bx.UI.Dialogs.MessageBox.alert(message, title, () => {
            resolve();
        });
    });
}

/**
 * Show a toast notification using Bitrix24 UI Kit
 */
export function showUiNotification(options: {
    content: string;
    autoHideDelay?: number;
    category?: string;
}): void {
    const bx = getBX();
    if (!bx?.UI?.Notification?.Center) {
        console.warn('[UI Kit] BX.UI.Notification not loaded. Call loadUiKit("ui.notification") first.');
        console.log('[Notification]', options.content);
        return;
    }

    bx.UI.Notification.Center.notify({
        content: options.content,
        autoHideDelay: options.autoHideDelay ?? 3000,
        category: options.category
    });
}

/**
 * Show a success notification
 */
export function showSuccessNotification(message: string): void {
    showUiNotification({ content: message, autoHideDelay: 3000 });
}

/**
 * Show an error notification
 */
export function showErrorNotification(message: string): void {
    showUiNotification({ content: message, autoHideDelay: 5000 });
}
