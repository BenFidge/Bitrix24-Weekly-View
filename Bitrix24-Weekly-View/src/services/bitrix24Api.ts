/**
 * Bitrix24 API Wrapper
 * Handles all communication with Bitrix24 REST API
 */

// Types are declared globally in src/types/bitrix24.d.ts

export class Bitrix24Api {
    private initialized = false;
    private initPromise: Promise<void> | null = null;

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

    async fetchAll<T>(method: string, params?: Record<string, unknown>): Promise<T[]> {
        await this.init();

        const allResults: T[] = [];
        let start = 0;

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

            if (allResults.length >= 10000) {
                console.warn('[Bitrix24Api] Reached safety limit of 10000 records');
                break;
            }
        }

        return allResults;
    }

    async getAuth(): Promise<BX24Auth> {
        await this.init();
        return BX24.getAuth();
    }

    async refreshAuth(): Promise<BX24Auth> {
        await this.init();
        return new Promise((resolve) => {
            BX24.refreshAuth((auth: BX24Auth) => {
                resolve(auth);
            });
        });
    }

    async getLanguage(): Promise<string> {
        await this.init();
        return BX24.getLang();
    }

    async getDomain(): Promise<string> {
        await this.init();
        return BX24.getDomain(true);
    }

    async isAdmin(): Promise<boolean> {
        await this.init();
        return BX24.isAdmin();
    }

    async openApplication(params: Record<string, unknown>): Promise<void> {
        await this.init();
        return new Promise((resolve) => {
            BX24.openApplication(params, () => resolve());
        });
    }

    /**
     * Opens a Bitrix24 internal path in a slider (SidePanel) from inside an iframe app.
     *
     * This is the recommended fallback when `BX` is not available due to cross-origin iframe isolation.
     */
    async openPath(path: string): Promise<void> {
        await this.init();
        return new Promise((resolve, reject) => {
            // BX24.openPath can call back with an object like {result: 'error', errorCode: '...'}
            // depending on whether the path can be opened in a slider.
            (BX24 as unknown as { openPath: (p: string, cb: (res?: { result?: string; errorCode?: string }) => void) => void }).openPath(
                path,
                (res) => {
                    if (res?.result === 'error') {
                        reject(new Error(`BX24.openPath failed: ${res.errorCode ?? 'unknown error'}`));
                        return;
                    }
                    resolve();
                }
            );
        });
    }

    async resizeWindow(width: number, height: number): Promise<void> {
        await this.init();
        return new Promise((resolve) => {
            BX24.resizeWindow(width, height, () => resolve());
        });
    }

    async fitWindow(): Promise<void> {
        await this.init();
        BX24.fitWindow();
    }

    async getAppOption(name: string): Promise<string | null> {
        await this.init();
        return BX24.appOption.get(name);
    }

    async setAppOption(name: string, value: string): Promise<void> {
        await this.init();
        return new Promise((resolve) => {
            BX24.appOption.set(name, value, () => resolve());
        });
    }

    async getUserOption(name: string): Promise<string | null> {
        await this.init();
        return BX24.userOption.get(name);
    }

    async setUserOption(name: string, value: string): Promise<void> {
        await this.init();
        return new Promise((resolve) => {
            BX24.userOption.set(name, value, () => resolve());
        });
    }

    async getPlacementInfo(): Promise<{ placement: string; options: Record<string, unknown> }> {
        await this.init();
        return BX24.placement.info();
    }

    async selectCRM(entityTypes: ('lead' | 'contact' | 'company' | 'deal')[]): Promise<Array<{ id: string; type: string; title: string }>> {
        await this.init();
        return new Promise((resolve) => {
            BX24.selectCRM({ entityType: entityTypes }, (items) => {
                resolve(items);
            });
        });
    }

    async selectUser(): Promise<{ id: string; name: string; photo?: string }> {
        await this.init();
        return new Promise((resolve) => {
            BX24.selectUser((user) => {
                resolve(user);
            });
        });
    }
}

export const bitrix24Api = new Bitrix24Api();
