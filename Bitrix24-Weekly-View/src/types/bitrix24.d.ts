/**
 * Bitrix24 Type Definitions
 * BX24 JavaScript SDK type declarations
 */

interface BX24SDK {
    /**
     * Initialize the application
     */
    init(callback: () => void): void;

    /**
     * Call Bitrix24 REST API method
     */
    callMethod(
        method: string,
        params?: Record<string, unknown>,
        callback?: (result: BX24Result) => void
    ): void;

    /**
     * Batch call multiple REST API methods
     */
    callBatch(
        calls: Record<string, [string, Record<string, unknown>?]>,
        callback?: (results: Record<string, BX24Result>) => void,
        bHaltOnError?: boolean
    ): void;

    /**
     * Get current user info
     */
    getAuth(): BX24Auth;

    /**
     * Refresh authentication
     */
    refreshAuth(callback: (auth: BX24Auth) => void): void;

    /**
     * Get application options
     */
    appOption: {
        get(name: string): string | null;
        set(name: string, value: string, callback?: () => void): void;
    };

    /**
     * Get user options
     */
    userOption: {
        get(name: string): string | null;
        set(name: string, value: string, callback?: () => void): void;
    };

    /**
     * Placement utilities
     */
    placement: {
        info(): PlacementInfo;
        getInterface(callback: (data: PlacementInterface) => void): void;
        call(method: string, params?: Record<string, unknown>, callback?: (result: unknown) => void): void;
        bindEvent(eventName: string, callback: (data: unknown) => void): void;
    };

    /**
     * Open application slider
     */
    openApplication(params: OpenApplicationParams, callback?: () => void): void;

    /**
     * Open path in slider
     */
    openPath(path: string, callback?: () => void): void;

    /**
     * Fit window to content
     */
    fitWindow(): void;

    /**
     * Resize window
     */
    resizeWindow(width: number, height: number, callback?: () => void): void;

    /**
     * Scroll parent window
     */
    scrollParentWindow(scroll: number, callback?: () => void): void;

    /**
     * Check if running in slider
     */
    isAdmin(): boolean;

    /**
     * Get domain
     */
    getDomain(includeProtocol?: boolean): string;

    /**
     * Get current language
     */
    getLang(): string;

    /**
     * Install application
     */
    install(callback?: () => void): void;

    /**
     * Uninstall application
     */
    installFinish(): void;

    /**
     * Close application
     */
    closeApplication(): void;

    /**
     * Select user
     */
    selectUser(callback: (user: BX24User) => void): void;

    /**
     * Select users
     */
    selectUsers(callback: (users: BX24User[]) => void): void;

    /**
     * Select CRM entity
     */
    selectCRM(params: SelectCRMParams, callback: (items: CRMItem[]) => void): void;
}

interface BXCore {
    /**
     * Load UI Kit extensions dynamically
     * This is the OFFICIAL way to load Bitrix24 UI components
     */
    loadExt(extensions: string | string[]): Promise<void>;

    /**
     * Core BX object for UI interactions
     */
    SidePanel: {
        Instance: {
            open(url: string, options?: SidePanelOptions): void;
            close(): void;
        };
    };

    /**
     * Booking module specific
     */
    Booking?: {
        Slider: {
            open(params: BookingSliderParams): void;
        };
    };

    /**
     * UI Kit Components (loaded via BX.loadExt)
     */
    UI?: {
        /**
         * Button component
         * Load with: BX.loadExt('ui.buttons')
         */
        Button: {
            new(options: UIButtonOptions): UIButtonInstance;
            Color: {
                PRIMARY: unknown;
                SUCCESS: unknown;
                DANGER: unknown;
                SECONDARY: unknown;
                LINK: unknown;
                LIGHT_BORDER: unknown;
            };
            Size: {
                EXTRA_SMALL: unknown;
                SMALL: unknown;
                MEDIUM: unknown;
                LARGE: unknown;
            };
            Icon: {
                ADD: unknown;
                CALENDAR: unknown;
                CHEVRON_LEFT: unknown;
                CHEVRON_RIGHT: unknown;
            };
            State: {
                DISABLED: unknown;
                WAITING: unknown;
            };
        };

        /**
         * Dialogs component
         * Load with: BX.loadExt('ui.dialogs')
         */
        Dialogs?: {
            MessageBox: {
                alert(message: string, title?: string, callback?: () => void): void;
                confirm(
                    message: string,
                    title: string,
                    onConfirm: (messageBox: { close: () => void }) => void,
                    confirmText?: string,
                    onCancel?: (messageBox: { close: () => void }) => void,
                    cancelText?: string
                ): void;
                show(options: MessageBoxOptions): void;
            };
        };

        /**
         * Notification component
         * Load with: BX.loadExt('ui.notification')
         */
        Notification?: {
            Center: {
                notify(options: NotificationOptions): void;
            };
        };

        /**
         * Label component
         * Load with: BX.loadExt('ui.label')
         */
        Label?: {
            new(options: UILabelOptions): UILabelInstance;
            Color: Record<string, unknown>;
            Size: Record<string, unknown>;
        };

        /**
         * Icons
         * Load with: BX.loadExt('ui.icons')
         */
        Icons?: Record<string, unknown>;
    };

    /**
     * Event manager
     */
    Event?: {
        EventEmitter: {
            subscribe(target: unknown, eventName: string, callback: (event: unknown) => void): void;
            emit(target: unknown, eventName: string, data?: unknown): void;
        };
    };

    /**
     * AJAX utilities
     */
    ajax?: {
        runAction(action: string, config: AjaxConfig): Promise<unknown>;
        runComponentAction(component: string, action: string, config: AjaxConfig): Promise<unknown>;
    };

    /**
     * Message/localization
     */
    message(code: string): string;

    /**
     * Date utilities
     */
    date?: {
        format(format: string, date: Date): string;
    };
}

interface BX24Result {
    data(): unknown;
    error(): BX24Error | null;
    more(): boolean;
    total(): number;
    next(callback: (result: BX24Result) => void): void;
}

interface BX24Error {
    error: string;
    error_description: string;
}

interface BX24Auth {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    domain: string;
    member_id: string;
}

interface BX24User {
    id: string;
    name: string;
    photo?: string;
    position?: string;
}

interface PlacementInfo {
    placement: string;
    options: Record<string, unknown>;
}

interface PlacementInterface {
    [key: string]: unknown;
}

interface OpenApplicationParams {
    /** Width of the slider window */
    bx24_width?: number;
    /** Height of the slider window */
    bx24_height?: number;
    /** Labels for buttons/actions */
    bx24_label?: Record<string, string>;
    /** Title of the slider window */
    bx24_title?: string;
    /** Left title area content */
    bx24_leftBoundary?: number;
    /** Additional custom data to pass to the opened app */
    [key: string]: unknown;
}

/**
 * Parameters for opening a slider to a specific path
 */
interface OpenPathParams {
    /** Whether to close the current slider before opening */
    closeOnFinish?: boolean;
}

/**
 * Slider event types
 */
interface SliderEventData {
    slider: {
        url: string;
        getData(): Record<string, unknown>;
    };
}

interface SelectCRMParams {
    entityType: ('lead' | 'contact' | 'company' | 'deal')[];
}

interface CRMItem {
    id: string;
    type: string;
    title: string;
}

interface SidePanelOptions {
    width?: number;
    allowChangeHistory?: boolean;
    cacheable?: boolean;
    events?: {
        onClose?: () => void;
        onLoad?: () => void;
    };
}

interface BookingSliderParams {
    resourceId?: number;
    date?: string;
    clientId?: number;
    serviceId?: number;
    bookingId?: number;
}

interface AjaxConfig {
    data?: Record<string, unknown>;
    analyticsLabel?: string;
}

// ============================================================================
// UI KIT COMPONENT INTERFACES
// These are loaded via BX.loadExt()
// ============================================================================

interface UIButtonOptions {
    text?: string;
    color?: unknown;
    size?: unknown;
    icon?: unknown;
    disabled?: boolean;
    className?: string;
    onclick?: (button: UIButtonInstance, event: MouseEvent) => void;
    round?: boolean;
    dropdown?: boolean;
    menu?: unknown;
    tag?: 'button' | 'a' | 'span';
    link?: string;
    id?: string;
    dataset?: Record<string, string>;
}

interface UIButtonInstance {
    render(): HTMLElement;
    renderTo(container: HTMLElement): void;
    getContainer(): HTMLElement;
    setText(text: string): void;
    getText(): string;
    setDisabled(disabled: boolean): void;
    isDisabled(): boolean;
    setWaiting(waiting: boolean): void;
    isWaiting(): boolean;
    setColor(color: unknown): void;
    setSize(size: unknown): void;
    setIcon(icon: unknown): void;
    addClass(className: string): void;
    removeClass(className: string): void;
}

interface UILabelOptions {
    text?: string;
    color?: unknown;
    size?: unknown;
    fill?: boolean;
    customClass?: string;
}

interface UILabelInstance {
    render(): HTMLElement;
    renderTo(container: HTMLElement): void;
    getContainer(): HTMLElement;
    setText(text: string): void;
}

interface MessageBoxOptions {
    title?: string;
    message?: string | HTMLElement;
    modal?: boolean;
    buttons?: unknown[];
    onCancel?: () => void;
    onClose?: () => void;
    popupOptions?: Record<string, unknown>;
}

interface NotificationOptions {
    content: string | HTMLElement;
    autoHideDelay?: number;
    category?: string;
    position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
    actions?: Array<{
        title: string;
        events?: {
            click?: () => void;
        };
    }>;
}

// Global declarations
declare const BX24: BX24SDK;
declare const BX: BXCore;

/**
 * Message event data from parent window
 */
interface Bitrix24MessageEvent {
    method: string;
    params?: Record<string, unknown>;
}

/**
 * Extended Window interface for Bitrix24 context
 */
interface Window {
    BX24: BX24SDK;
    BX?: BXCore;
}
