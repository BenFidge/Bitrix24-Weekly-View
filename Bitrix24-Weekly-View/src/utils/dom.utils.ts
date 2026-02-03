/**
 * DOM Utility Functions
 */

/**
 * Create an element with optional classes and attributes
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    options?: {
        className?: string;
        id?: string;
        attributes?: Record<string, string>;
        dataset?: Record<string, string>;
        text?: string;
        html?: string;
        children?: Node[];
    }
): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    
    if (options?.className) {
        element.className = options.className;
    }
    
    if (options?.id) {
        element.id = options.id;
    }
    
    if (options?.attributes) {
        for (const [key, value] of Object.entries(options.attributes)) {
            element.setAttribute(key, value);
        }
    }
    
    if (options?.dataset) {
        for (const [key, value] of Object.entries(options.dataset)) {
            element.dataset[key] = value;
        }
    }
    
    if (options?.text) {
        element.textContent = options.text;
    }
    
    if (options?.html) {
        element.innerHTML = options.html;
    }
    
    if (options?.children) {
        for (const child of options.children) {
            element.appendChild(child);
        }
    }
    
    return element;
}

/**
 * Query selector with type safety
 */
export function $(selector: string, parent: ParentNode = document): HTMLElement | null {
    return parent.querySelector<HTMLElement>(selector);
}

/**
 * Query selector all with type safety
 */
export function $$(selector: string, parent: ParentNode = document): HTMLElement[] {
    return Array.from(parent.querySelectorAll<HTMLElement>(selector));
}

/**
 * Add event listener with automatic cleanup support
 */
export function addEvent<K extends keyof HTMLElementEventMap>(
    element: HTMLElement,
    type: K,
    listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
): () => void {
    element.addEventListener(type, listener, options);
    return () => element.removeEventListener(type, listener, options);
}

/**
 * Remove all children from an element
 */
export function clearElement(element: HTMLElement): void {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

/**
 * Show element
 */
export function showElement(element: HTMLElement): void {
    element.style.display = '';
    element.removeAttribute('hidden');
}

/**
 * Hide element
 */
export function hideElement(element: HTMLElement): void {
    element.style.display = 'none';
}

/**
 * Toggle element visibility
 */
export function toggleElement(element: HTMLElement, show?: boolean): void {
    const shouldShow = show ?? element.style.display === 'none';
    if (shouldShow) {
        showElement(element);
    } else {
        hideElement(element);
    }
}

/**
 * Add loading state to element
 */
export function setLoading(element: HTMLElement, loading: boolean): void {
    if (loading) {
        element.classList.add('bx-booking-loading');
        element.setAttribute('aria-busy', 'true');
    } else {
        element.classList.remove('bx-booking-loading');
        element.setAttribute('aria-busy', 'false');
    }
}

/**
 * Scroll element into view smoothly
 */
export function scrollIntoView(element: HTMLElement): void {
    element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Get element position relative to document
 */
export function getElementPosition(element: HTMLElement): { top: number; left: number } {
    const rect = element.getBoundingClientRect();
    return {
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX
    };
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout>;
    
    return function (this: unknown, ...args: Parameters<T>) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: Parameters<T>) => void>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle = false;
    
    return function (this: unknown, ...args: Parameters<T>) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}
