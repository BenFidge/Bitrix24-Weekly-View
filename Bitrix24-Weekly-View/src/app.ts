/**
 * Bitrix24 Weekly Booking View Application
 * Entry point for the application
 */

import { WeeklyViewComponent } from './components/weekly-view.js';
import { bitrix24Api } from './api/bitrix24.api.js';
import { loadDefaultUiKit, isUiKitAvailable } from './utils/ui-kit.utils.js';
// CSS is loaded via <link> tag in index.html

class BookingWeeklyViewApp {
    private weeklyView: WeeklyViewComponent | null = null;

    /**
     * Initialize the application
     */
    async init(): Promise<void> {
        console.log('[BookingWeeklyViewApp] Starting initialization...');

        try {
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                await new Promise<void>(resolve => {
                    document.addEventListener('DOMContentLoaded', () => resolve());
                });
            }

            // Initialize Bitrix24 API (must be first)
            await bitrix24Api.init();
            console.log('[BookingWeeklyViewApp] Bitrix24 API initialized');

            // Load Bitrix24 UI Kit components (after BX24.init)
            // This loads: buttons, dialogs, notifications, forms, icons
            await loadDefaultUiKit();
            if (isUiKitAvailable()) {
                console.log('[BookingWeeklyViewApp] UI Kit loaded');
            } else {
                console.log('[BookingWeeklyViewApp] UI Kit not available - using fallback components');
            }

            // Discover available booking methods (for debugging)
            await this.discoverAvailableMethods();

            // Get or create the container
            const container = this.getContainer();
            if (!container) {
                throw new Error('Container element not found');
            }

            // Create and initialize the weekly view
            this.weeklyView = new WeeklyViewComponent({
                container,
                onViewModeChange: (mode) => {
                    console.log('[BookingWeeklyViewApp] View mode changed to:', mode);
                    // Handle navigation to daily view
                    if (mode === 'daily') {
                        this.navigateToDailyView();
                    }
                }
            });

            await this.weeklyView.init();
            console.log('[BookingWeeklyViewApp] Weekly view initialized');

            // Fit the window to content if in Bitrix24 frame
            await this.adjustWindowSize();

        } catch (error) {
            console.error('[BookingWeeklyViewApp] Initialization failed:', error);
            this.showError('Failed to initialize the booking view. Please refresh the page.');
        }
    }

    /**
     * Discover available API methods for debugging
     */
    private async discoverAvailableMethods(): Promise<void> {
        try {
            // Get available scopes
            const scopes = await bitrix24Api.getScope();
            console.log('[BookingWeeklyViewApp] Available scopes:', scopes);

            // Try to find booking-related methods
            const methods = await bitrix24Api.getMethods();
            if (methods.length > 0) {
                console.log('[BookingWeeklyViewApp] Booking-related methods:', methods);
            }
        } catch (error) {
            console.warn('[BookingWeeklyViewApp] Could not discover methods:', error);
        }
    }

    /**
     * Get or create the application container
     */
    private getContainer(): HTMLElement | null {
        // Try to find existing container
        let container = document.getElementById('booking-weekly-view');
        
        if (!container) {
            // Create container if not found
            container = document.createElement('div');
            container.id = 'booking-weekly-view';
            document.body.appendChild(container);
        }

        return container;
    }

    /**
     * Adjust window size for Bitrix24 frame
     */
    private async adjustWindowSize(): Promise<void> {
        try {
            await bitrix24Api.fitWindow();
        } catch {
            // Ignore if not in Bitrix24 context
        }
    }

    /**
     * Navigate to daily view
     */
    private navigateToDailyView(): void {
        const bookingUrl = '/booking/';
        
        if (typeof BX24 !== 'undefined') {
            BX24.openPath(bookingUrl);
        } else {
            window.location.href = bookingUrl;
        }
    }

    /**
     * Show error message
     */
    private showError(message: string): void {
        const container = this.getContainer();
        if (container) {
            container.innerHTML = `
                <div style="
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    font-family: 'Open Sans', sans-serif;
                    color: #525C69;
                    text-align: center;
                    padding: 24px;
                ">
                    <h2 style="color: #FF5752; margin-bottom: 16px;">Error</h2>
                    <p style="margin-bottom: 24px;">${message}</p>
                    <button onclick="location.reload()" style="
                        padding: 10px 24px;
                        background: #2FC6F6;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 14px;
                    ">Retry</button>
                </div>
            `;
        }
    }

    /**
     * Destroy the application
     */
    destroy(): void {
        this.weeklyView?.destroy();
        this.weeklyView = null;
    }
}

// Create and initialize the app
const app = new BookingWeeklyViewApp();

// Initialize when BX24 is ready or immediately if not in Bitrix24 context
if (typeof BX24 !== 'undefined') {
    BX24.init(() => {
        app.init();
    });
} else {
    // Development mode - initialize directly
    app.init();
}

// Export for potential use elsewhere
export { app as BookingWeeklyViewApp };
