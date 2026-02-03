/**
 * Bitrix24 API Wrapper
 * Handles all communication with Bitrix24 REST API
 */

// Types are declared globally in src/types/bitrix24.d.ts

export class Bitrix24Api {
    private initialized = false;
    private initPromise: Promise<void> | null = null;

    /**
     * Initialize BX24 SDK
     */
    async init(): Promise<void> {
        if (this.initialized) {
            return;
        }

        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = new Promise<void>((resolve, reject) => {
            if (typeof BX24 === 'undefined') {
                reject(new Error('BX24 SDK not loaded. Ensure the script is loaded from Bitrix24.'));
                return;
            }

            BX24.init(() => {
                this.initialized = true;
                console.log('[Bitrix24Api] SDK initialized');
                resolve();
            });
        });

        return this.initPromise;
    }

    /**
     * Call a single REST API method
     */
    async callMethod<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
        await this.init();

        return new Promise((resolve, reject) => {
            BX24.callMethod(method, params, (result: BX24Result) => {
                const error = result.error();
                if (error) {
                    reject(new Error(`${error.error}: ${error.error_description}`));
                    return;
                }
                resolve(result.data() as T);
            });
        });
    }

    /**
     * Call multiple REST API methods in batch
     */
    async callBatch<T extends Record<string, unknown>>(
        calls: Record<string, [string, Record<string, unknown>?]>,
        haltOnError = false
    ): Promise<T> {
        await this.init();

        return new Promise((resolve, reject) => {
            BX24.callBatch(calls, (results: Record<string, BX24Result>) => {
                const data: Record<string, unknown> = {};
                
                for (const [key, result] of Object.entries(results)) {
                    const error = result.error();
                    if (error && haltOnError) {
                        reject(new Error(`${key}: ${error.error} - ${error.error_description}`));
                        return;
                    }
                    data[key] = result.data();
                }
                
                resolve(data as T);
            }, haltOnError);
        });
    }

    /**
     * Fetch all results using pagination
     */
    async fetchAll<T>(method: string, params?: Record<string, unknown>): Promise<T[]> {
        await this.init();

        const allResults: T[] = [];
        let start = 0;
        const pageSize = 50;

        while (true) {
            const response = await this.callMethod<{ result: T[]; total: number; next?: number }>(
                method,
                { ...params, start }
            );

            if (Array.isArray(response)) {
                allResults.push(...response);
                break;
            }

            if (response.result) {
                allResults.push(...response.result);
            }

            if (!response.next || response.next <= start) {
                break;
            }

            start = response.next;

            // Safety limit to prevent infinite loops
            if (allResults.length >= 10000) {
                console.warn('[Bitrix24Api] Reached safety limit of 10000 records');
                break;
            }
        }

        return allResults;
    }

    /**
     * Get current authentication
     */
    async getAuth(): Promise<BX24Auth> {
        await this.init();
        return BX24.getAuth();
    }

    /**
     * Refresh authentication token
     */
    async refreshAuth(): Promise<BX24Auth> {
        await this.init();
        return new Promise((resolve) => {
            BX24.refreshAuth((auth: BX24Auth) => {
                resolve(auth);
            });
        });
    }

    /**
     * Get current user language
     */
    async getLanguage(): Promise<string> {
        await this.init();
        return BX24.getLang();
    }

    /**
     * Get domain
     */
    async getDomain(): Promise<string> {
        await this.init();
        return BX24.getDomain(true);
    }

    /**
     * Check if current user is admin
     */
    async isAdmin(): Promise<boolean> {
        await this.init();
        return BX24.isAdmin();
    }

    /**
     * Open application slider
     */
    async openApplication(params: Record<string, unknown>): Promise<void> {
        await this.init();
        return new Promise((resolve) => {
            BX24.openApplication(params, () => resolve());
        });
    }

    /**
     * Resize application window
     */
    async resizeWindow(width: number, height: number): Promise<void> {
        await this.init();
        return new Promise((resolve) => {
            BX24.resizeWindow(width, height, () => resolve());
        });
    }

    /**
     * Fit window to content
     */
    async fitWindow(): Promise<void> {
        await this.init();
        BX24.fitWindow();
    }

    /**
     * Get app option
     */
    async getAppOption(name: string): Promise<string | null> {
        await this.init();
        return BX24.appOption.get(name);
    }

    /**
     * Set app option
     */
    async setAppOption(name: string, value: string): Promise<void> {
        await this.init();
        return new Promise((resolve) => {
            BX24.appOption.set(name, value, () => resolve());
        });
    }

    /**
     * Get user option
     */
    async getUserOption(name: string): Promise<string | null> {
        await this.init();
        return BX24.userOption.get(name);
    }

    /**
     * Set user option
     */
    async setUserOption(name: string, value: string): Promise<void> {
        await this.init();
        return new Promise((resolve) => {
            BX24.userOption.set(name, value, () => resolve());
        });
    }

    /**
     * Get placement info (when running as a placement)
     */
    async getPlacementInfo(): Promise<{ placement: string; options: Record<string, unknown> }> {
        await this.init();
        return BX24.placement.info();
    }

    /**
     * Select CRM entities
     */
    async selectCRM(entityTypes: ('lead' | 'contact' | 'company' | 'deal')[]): Promise<Array<{ id: string; type: string; title: string }>> {
        await this.init();
        return new Promise((resolve) => {
            BX24.selectCRM({ entityType: entityTypes }, (items) => {
                resolve(items);
            });
        });
    }

    /**
     * Select single user
     */
    async selectUser(): Promise<{ id: string; name: string; photo?: string }> {
        await this.init();
        return new Promise((resolve) => {
            BX24.selectUser((user) => {
                resolve(user);
            });
        });
    }

    /**
     * Select multiple users
     */
    async selectUsers(): Promise<Array<{ id: string; name: string; photo?: string }>> {
        await this.init();
        return new Promise((resolve) => {
            BX24.selectUsers((users) => {
                resolve(users);
            });
        });
    }

    /**
     * Open application in a slider/popup with custom parameters
     * This is the OFFICIAL way to open larger UI from an iframe app
     * 
     * @param params - Custom data to pass to the opened application
     * @param options - Slider options (width, height, title)
     */
    async openApplicationSlider(
        params: Record<string, unknown> = {},
        options: {
            width?: number;
            height?: number;
            title?: string;
        } = {}
    ): Promise<void> {
        await this.init();

        const sliderParams: Record<string, unknown> = {
            ...params,
            bx24_width: options.width || 800,
            bx24_title: options.title || ''
        };

        if (options.height) {
            sliderParams.bx24_height = options.height;
        }

        return new Promise((resolve) => {
            BX24.openApplication(sliderParams, () => resolve());
        });
    }

    /**
     * Open a Bitrix24 path in a slider (e.g., CRM entity, user profile)
     * 
     * @param path - The Bitrix24 path (e.g., "/crm/contact/details/123/")
     */
    async openSliderPath(path: string): Promise<void> {
        await this.init();
        return new Promise((resolve) => {
            BX24.openPath(path, () => resolve());
        });
    }

    /**
     * Close the current application slider
     */
    async closeApplication(): Promise<void> {
        await this.init();
        BX24.closeApplication();
    }

    /**
     * Get scroll position of parent window
     */
    async getScrollPosition(): Promise<{ scrollTop: number }> {
        await this.init();
        return new Promise((resolve) => {
            // Use placement interface to get scroll info
            BX24.placement.call('getScrollPosition', {}, (result) => {
                resolve(result as { scrollTop: number });
            });
        });
    }

    /**
     * Bind to placement events (useful for slider interactions)
     */
    bindPlacementEvent(eventName: string, callback: (data: unknown) => void): void {
        BX24.placement.bindEvent(eventName, callback);
    }

    /**
     * Call placement method (for interacting with parent UI)
     */
    async callPlacementMethod(method: string, params?: Record<string, unknown>): Promise<unknown> {
        await this.init();
        return new Promise((resolve) => {
            BX24.placement.call(method, params, (result) => {
                resolve(result);
            });
        });
    }

    /**
     * Discover available API methods for a module
     * Tries common method patterns to find what's available
     */
    async discoverMethods(module: string): Promise<string[]> {
        const availableMethods: string[] = [];
        const methodSuffixes = ['list', 'get', 'getList', 'getlist'];

        for (const suffix of methodSuffixes) {
            const method = `${module}.${suffix}`;
            try {
                await this.callMethod(method);
                availableMethods.push(method);
            } catch {
                // Method not available
            }
        }

        console.log(`[Bitrix24Api] Discovered methods for ${module}:`, availableMethods);
        return availableMethods;
    }

    /**
     * Try calling a method, return result or null if failed
     */
    async tryCallMethod<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T | null> {
        try {
            return await this.callMethod<T>(method, params);
        } catch (error) {
            console.warn(`[Bitrix24Api] Method ${method} failed:`, error);
            return null;
        }
    }

    /**
     * Get available scopes for this app
     */
    async getScope(): Promise<string[]> {
        await this.init();
        try {
            const result = await this.callMethod<{ scope: string[] }>('scope');
            return result?.scope || [];
        } catch {
            return [];
        }
    }

    /**
     * Get all available methods (uses methods API if available)
     */
    async getMethods(): Promise<string[]> {
        try {
            const result = await this.callMethod<string[]>('methods');
            if (Array.isArray(result)) {
                // Filter to booking-related methods
                const bookingMethods = result.filter(m => 
                    m.toLowerCase().includes('booking') || 
                    m.toLowerCase().includes('resource')
                );
                console.log('[Bitrix24Api] Available booking-related methods:', bookingMethods);
                return bookingMethods;
            }
            return [];
        } catch {
            return [];
        }
    }
}

// Export singleton instance
export const bitrix24Api = new Bitrix24Api();
