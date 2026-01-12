/**
 * DropdownWaiter - MutationObserver-based dropdown option scanner
 * Waits for dropdown options to render before capturing them
 * Handles React portals, Vue teleport, shadow DOM
 */

import { DebugLogger } from '../../utils/debugLogger';

const PORTAL_ROOT_SELECTORS = [
    '#portal',
    '#modals',
    '#modal-root',
    '#__next',
    '#root',
    '[data-portal-root]',
    '[id*="portal"]',
    '[class*="portal"]',
    '.MuiModal-root',
    '.ant-modal-root',
    '[role="presentation"]'
];

const OPTION_SELECTORS = [
    '[role="option"]',
    'li[aria-selected]',
    'li[role="option"]',
    'div[role="option"]',
    '[data-value]',
    'option',
    '.select__option',
    '.dropdown-item',
    '.menu-item',
    'li'
];

const OPTION_VISIBILITY_MIN_PX = 2;

export interface DropdownWaiterConfig {
    timeout?: number;       // default: 5000ms
    retries?: number;       // default: 3
    minOptions?: number;    // default: 1
}

interface DropdownOption {
    element: HTMLElement;
    text: string;
    value?: string;
}

function isElementVisible(el: HTMLElement): boolean {
    if (!el || !(el instanceof Element)) return false;

    const rect = el.getBoundingClientRect();
    if (rect.width < OPTION_VISIBILITY_MIN_PX || rect.height < OPTION_VISIBILITY_MIN_PX) {
        return false;
    }

    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') {
        return false;
    }

    return true;
}

function getPortalRoots(doc: Document): Element[] {
    const roots: Element[] = [doc.body, doc.documentElement].filter(Boolean);

    for (const selector of PORTAL_ROOT_SELECTORS) {
        doc.querySelectorAll(selector).forEach(node => {
            if (!roots.includes(node)) {
                roots.push(node);
            }
        });
    }

    return roots;
}

function collectOptions(doc: Document): HTMLElement[] {
    const optionElements: HTMLElement[] = [];

    for (const selector of OPTION_SELECTORS) {
        doc.querySelectorAll<HTMLElement>(selector).forEach(el => {
            if (!optionElements.includes(el)) {
                optionElements.push(el);
            }
        });
    }

    // Filter: must be inside a list-like container
    const filtered = optionElements.filter(el => {
        const role = el.getAttribute('role') || '';
        const text = (el.textContent || '').trim();
        if (!text) return false;

        // Check if inside listbox/menu/dropdown container
        const inList = !!el.closest(
            '[role="listbox"],[role="menu"],[class*="menu"],[class*="list"],[class*="dropdown"],[id*="listbox"]'
        );

        return role === 'option' || inList || el.hasAttribute('data-value') || el.tagName.toLowerCase() === 'option';
    });

    // Filter visible only
    return filtered.filter(isElementVisible);
}

function findShadowRoots(root: Element): ShadowRoot[] {
    const shadowRoots: ShadowRoot[] = [];

    const walker = root.ownerDocument.createTreeWalker(
        root,
        NodeFilter.SHOW_ELEMENT,
        null
    );

    let node: Node | null;
    while ((node = walker.nextNode())) {
        if (node instanceof Element && node.shadowRoot) {
            DebugLogger.debug('SHADOW_ROOT_FOUND', {
                host: node.tagName,
                mode: node.shadowRoot.mode
            });
            shadowRoots.push(node.shadowRoot);
        }
    }

    return shadowRoots;
}

export class DropdownWatcher {
    private observers: MutationObserver[] = [];
    private shadowObservers: MutationObserver[] = [];
    private mutationCount: number = 0;

    private observeNode(node: Element, onMutation: () => void): void {
        if (!node || !(node instanceof Element)) return;

        const observer = new MutationObserver((mutations) => {
            this.mutationCount += mutations.length;
            DebugLogger.debug('DROPDOWN_MUTATION', {
                count: mutations.length,
                total: this.mutationCount
            });
            onMutation();
        });

        observer.observe(node, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: false
        });

        this.observers.push(observer);
    }

    private observeShadowRoots(root: Element, onMutation: () => void): void {
        const shadowRoots = findShadowRoots(root);

        for (const shadowRoot of shadowRoots) {
            const observer = new MutationObserver((mutations) => {
                this.mutationCount += mutations.length;
                onMutation();
            });

            observer.observe(shadowRoot, {
                childList: true,
                subtree: true,
                attributes: true
            });

            this.shadowObservers.push(observer);
        }
    }

    async waitForOptions(
        doc: Document,
        config: DropdownWaiterConfig = {}
    ): Promise<HTMLElement[]> {
        const {
            timeout = 5000,
            minOptions = 1
        } = config;

        const started = performance.now();
        const portalRoots = getPortalRoots(doc);

        DebugLogger.info('DROPDOWN_WAIT_START', {
            timeout,
            minOptions,
            portalRoots: portalRoots.length
        });

        // Try initial collection
        let latestOptions = collectOptions(doc);

        DebugLogger.debug('DROPDOWN_OPTION_COLLECT', {
            reason: 'initial',
            count: latestOptions.length,
            dt: Math.round(performance.now() - started)
        });

        if (latestOptions.length >= minOptions) {
            DebugLogger.info('DROPDOWN_OPTIONS_READY', {
                count: latestOptions.length,
                dt: Math.round(performance.now() - started),
                source: 'immediate'
            });
            return latestOptions;
        }

        // Setup mutation watching
        return new Promise<HTMLElement[]>((resolve, reject) => {
            let resolved = false;
            let rafId: number | null = null;

            const cleanup = () => {
                if (rafId) cancelAnimationFrame(rafId);
                this.cleanup();
            };

            const tryResolve = (reason: string) => {
                if (resolved) return;

                const opts = collectOptions(doc);

                DebugLogger.debug('DROPDOWN_OPTION_COLLECT', {
                    reason,
                    count: opts.length,
                    dt: Math.round(performance.now() - started),
                    mutationCount: this.mutationCount
                });

                if (opts.length >= minOptions) {
                    resolved = true;
                    cleanup();

                    DebugLogger.info('DROPDOWN_OPTIONS_READY', {
                        count: opts.length,
                        dt: Math.round(performance.now() - started),
                        source: reason
                    });

                    resolve(opts);
                }
            };

            // Watch portal roots and shadows
            portalRoots.forEach(root => {
                this.observeNode(root, () => tryResolve('mutation'));
                this.observeShadowRoots(root, () => tryResolve('shadow-mutation'));
            });

            // RAF polling for visibility changes
            const rafLoop = () => {
                if (resolved) return;
                tryResolve('raf');
                rafId = requestAnimationFrame(rafLoop);
            };
            rafId = requestAnimationFrame(rafLoop);

            // Timeout
            setTimeout(() => {
                if (resolved) return;
                resolved = true;
                cleanup();

                const finalOpts = collectOptions(doc);
                DebugLogger.warn('DROPDOWN_WAIT_TIMEOUT', {
                    timeout,
                    foundOptions: finalOpts.length,
                    dt: Math.round(performance.now() - started)
                });

                // Resolve with whatever we found (might be empty)
                resolve(finalOpts);
            }, timeout);
        });
    }

    cleanup(): void {
        for (const obs of this.observers) obs.disconnect();
        for (const obs of this.shadowObservers) obs.disconnect();
        this.observers = [];
        this.shadowObservers = [];

        DebugLogger.debug('DROPDOWN_WATCHER_CLEANUP', {
            mutationCount: this.mutationCount
        });

        this.mutationCount = 0;
    }
}

/**
 * Get dropdown options with automatic retry and portal detection
 */
export async function getDropdownOptions(
    element: HTMLElement,
    config: DropdownWaiterConfig = {}
): Promise<string[]> {
    const { retries = 3 } = config;
    const doc = element.ownerDocument;

    // Check if it's a native select first
    if (element.tagName.toLowerCase() === 'select') {
        const options = Array.from(element.querySelectorAll<HTMLOptionElement>('option'))
            .map(opt => opt.textContent?.trim() || '')
            .filter(Boolean);

        DebugLogger.info('DROPDOWN_NATIVE_SELECT', { count: options.length });
        return options;
    }

    // For custom dropdowns, try with retries
    for (let attempt = 0; attempt < retries; attempt++) {
        const watcher = new DropdownWatcher();

        try {
            DebugLogger.info('DROPDOWN_OPTIONS_ATTEMPT', {
                attempt: attempt + 1,
                retries
            });

            const elements = await watcher.waitForOptions(doc, config);
            const options = elements
                .map(el => el.textContent?.trim() || '')
                .filter(Boolean);

            if (options.length > 0) {
                DebugLogger.info('DROPDOWN_OPTIONS_SUCCESS', {
                    attempt: attempt + 1,
                    count: options.length
                });
                return options;
            }

            DebugLogger.warn('DROPDOWN_OPTIONS_EMPTY', { attempt: attempt + 1 });

            // Wait before retry (exponential backoff)
            if (attempt < retries - 1) {
                const delay = Math.pow(2, attempt) * 200;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        } catch (error) {
            DebugLogger.error('DROPDOWN_OPTIONS_ERROR', {
                attempt: attempt + 1,
                error: error instanceof Error ? error.message : String(error)
            });

            if (attempt === retries - 1) {
                throw error;
            }
        } finally {
            watcher.cleanup();
        }
    }

    return [];
}
