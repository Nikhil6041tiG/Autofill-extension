/**
 * DynamicScanner - TreeWalker-based form scanner with question block detection
 * Handles multi-step forms, portals, and spatial question-input mapping
 */

import { DebugLogger } from '../../utils/debugLogger';
import { FieldType } from '../../types/fieldDetection';
import { getDropdownOptions } from './dropdownWaiter';

export interface QuestionBlock {
    q_hash: string;
    questionText: string;
    inputType: FieldType;
    inputNode: HTMLElement;
    dropdownNode?: HTMLElement;
    required: boolean;
    stepIndex: number;
    blockRoot: HTMLElement;
    options?: string[];
}

const INPUT_SELECTORS = `
  input:not([type="hidden"]):not([disabled]),
  textarea:not([disabled]),
  select:not([disabled]),
  [contenteditable="true"]
`.trim();

const COMBOBOX_SELECTORS = `
  [role="combobox"],
  [aria-haspopup="listbox"],
  [aria-expanded]
`.trim();

const REQUIRED_HINT_SELECTORS = `
  [aria-required="true"],
  [required]
`.trim();

const SCAN_MAX_NODES = 12000;
const SCAN_IDLE_BUDGET_MS = 30;

function isElementVisible(el: HTMLElement): boolean {
    if (!el || !(el instanceof Element)) return false;

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;

    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') {
        return false;
    }

    return true;
}

function normalizeText(s: string): string {
    return (s || '')
        .replace(/\s+/g, ' ')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .trim()
        .toLowerCase();
}

function stableHash(str: string): string {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return (h >>> 0).toString(16);
}

function getNearestText(node: HTMLElement, maxChars: number = 220): string {
    if (!node) return '';

    // Check aria-label, aria-labelledby first
    if (node instanceof Element) {
        const ariaLabel = node.getAttribute('aria-label');
        if (ariaLabel) return ariaLabel.slice(0, maxChars);

        const labelledBy = node.getAttribute('aria-labelledby');
        if (labelledBy) {
            const ids = labelledBy.split(/\s+/).filter(Boolean);
            const texts = ids.map(id => {
                const el = node.ownerDocument.getElementById(id);
                return el?.textContent || '';
            }).join(' ');
            if (texts.trim()) return texts.trim().slice(0, maxChars);
        }
    }

    // Look for associated <label for=...>
    if (node instanceof Element && node.id) {
        const label = node.ownerDocument.querySelector<HTMLLabelElement>(
            `label[for="${CSS.escape(node.id)}"]`
        );
        if (label?.textContent?.trim()) {
            return label.textContent.trim().slice(0, maxChars);
        }
    }

    // Try closest label ancestor
    if (node instanceof Element) {
        const label = node.closest('label');
        if (label?.textContent?.trim()) {
            return label.textContent.trim().slice(0, maxChars);
        }
    }

    // Nearby text nodes in parent container
    const parent = node.parentElement;
    if (!parent) return '';

    const texts: string[] = [];
    const walker = node.ownerDocument.createTreeWalker(
        parent,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (textNode) => {
                const value = textNode.nodeValue?.trim();
                if (!value || value.length < 2) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    let textNode: Node | null;
    while ((textNode = walker.nextNode())) {
        const text = textNode.nodeValue?.trim();
        if (text) {
            texts.push(text);
            if (texts.join(' ').length > maxChars) break;
        }
    }

    return texts.join(' ').trim().slice(0, maxChars);
}

function isLikelyRequired(blockEl: HTMLElement, inputEl: HTMLElement): boolean {
    // Check semantic attributes
    if (inputEl?.matches?.(REQUIRED_HINT_SELECTORS)) return true;
    if (blockEl?.querySelector?.(REQUIRED_HINT_SELECTORS)) return true;

    // Check for asterisk in label text
    const labelText = normalizeText(blockEl?.textContent || '');
    if (labelText.includes('*')) return true;

    return false;
}

function inferInputType(inputEl: HTMLElement): FieldType {
    if (!inputEl) return FieldType.TEXT;

    const tag = (inputEl.tagName || '').toLowerCase();
    const type = (inputEl.getAttribute('type') || 'text').toLowerCase();
    const role = inputEl.getAttribute('role');

    // Check ARIA roles first (Greenhouse pattern)
    if (role === 'combobox' || role === 'listbox') {
        return FieldType.DROPDOWN_CUSTOM;
    }

    if (tag === 'textarea') return FieldType.TEXTAREA;
    if (tag === 'select') return FieldType.SELECT_NATIVE;

    if (tag === 'input') {
        switch (type) {
            case 'email': return FieldType.EMAIL;
            case 'tel': return FieldType.PHONE;
            case 'number': return FieldType.NUMBER;
            case 'radio': return FieldType.RADIO_GROUP;
            case 'checkbox': return FieldType.CHECKBOX;
            case 'date': return FieldType.DATE;
            case 'file': return FieldType.FILE_UPLOAD;
            case 'url': return FieldType.TEXT;
            default: return FieldType.TEXT;
        }
    }

    if (inputEl.getAttribute('contenteditable') === 'true') {
        return FieldType.TEXTAREA;
    }

    // Custom combobox patterns
    const hasPopup = inputEl.getAttribute('aria-haspopup');
    if (hasPopup === 'listbox') return FieldType.DROPDOWN_CUSTOM;

    return FieldType.TEXT;
}

function inferStepIndex(): number {
    // Multi-step heuristic: look for visible step indicator
    const stepEl =
        document.querySelector('[aria-current="step"], .step.active, [data-step].active, [class*="step"][class*="active"]') ||
        document.querySelector('[data-testid*="step"][aria-selected="true"]');

    const txt = stepEl?.textContent?.trim();
    if (!txt) return 0;

    const match = txt.match(/(\d+)/);
    return match ? Number(match[1]) : 0;
}

export class DynamicScanner {
    private isInteractive(el: HTMLElement): boolean {
        if (!(el instanceof Element)) return false;

        const tag = el.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
        if (el.matches(COMBOBOX_SELECTORS)) return true;
        if (el.getAttribute('contenteditable') === 'true') return true;

        return false;
    }

    private findBlockRoot(el: HTMLElement): HTMLElement | null {
        if (!(el instanceof Element)) return null;

        // Prefer semantic groups first
        const group = el.closest(
            '[role="group"], fieldset, [data-testid*="question"], [class*="question"], [class*="field"], [class*="form"]'
        );
        if (group) return group as HTMLElement;

        // Otherwise climb until container has enough text context
        let current = el.parentElement;
        let lastGood = el.parentElement;

        for (let i = 0; i < 7 && current; i++) {
            const txt = normalizeText(current.textContent || '');
            if (txt.length > 15) lastGood = current;
            if (txt.length > 900) break; // Stop if too large
            current = current.parentElement;
        }

        return lastGood || el.parentElement || el;
    }

    private pickPrimaryField(blockEl: HTMLElement): HTMLElement | null {
        if (!blockEl) return null;

        const candidates: HTMLElement[] = [];

        // Collect all potential inputs
        blockEl.querySelectorAll<HTMLElement>(INPUT_SELECTORS).forEach(el => {
            candidates.push(el);
        });

        blockEl.querySelectorAll<HTMLElement>(COMBOBOX_SELECTORS).forEach(el => {
            candidates.push(el);
        });

        // Filter out hidden/offscreen and dropdown menus
        const filtered = candidates.filter(el => {
            if (!isElementVisible(el)) return false;
            // Ignore if inside listbox/menu options area
            if (el.closest('[role="listbox"],[role="menu"],[class*="menu"],[class*="dropdown"]')) {
                return false;
            }
            return true;
        });

        if (filtered.length === 0) return null;

        // Score candidates
        const scored = filtered.map(el => {
            const label = getNearestText(el);
            let score = label ? 10 : 0;

            if (el.matches('input[type="radio"], input[type="checkbox"]')) score += 3;
            if (el.matches('select')) score += 5;
            if (el.getAttribute('role') === 'combobox') score += 6;

            return { el, score };
        });

        scored.sort((a, b) => b.score - a.score);
        return scored[0]?.el || null;
    }

    private detectRadioCheckboxGroup(blockEl: HTMLElement): { type: FieldType; nodes: HTMLInputElement[] } | null {
        const radios = blockEl.querySelectorAll<HTMLInputElement>('input[type="radio"]');
        const checks = blockEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');

        if (radios.length > 1) {
            return { type: FieldType.RADIO_GROUP, nodes: Array.from(radios) };
        }

        if (checks.length > 1) {
            return { type: FieldType.CHECKBOX, nodes: Array.from(checks) };
        }

        return null;
    }

    async scanDocument(doc: Document = document): Promise<QuestionBlock[]> {
        const results: QuestionBlock[] = [];
        const seenHashes = new Set<string>();

        const walker = doc.createTreeWalker(
            doc.body,
            NodeFilter.SHOW_ELEMENT,
            {
                acceptNode: (node) => {
                    if (!(node instanceof Element)) return NodeFilter.FILTER_SKIP;
                    if (!isElementVisible(node as HTMLElement)) return NodeFilter.FILTER_SKIP;
                    if (this.isInteractive(node as HTMLElement)) return NodeFilter.FILTER_ACCEPT;
                    return NodeFilter.FILTER_SKIP;
                }
            }
        );

        let count = 0;
        let node: Node | null;

        const processChunk = () => {
            const start = performance.now();

            while ((node = walker.nextNode())) {
                count++;
                if (count > SCAN_MAX_NODES) break;

                const inputEl = node as HTMLElement;
                const blockRoot = this.findBlockRoot(inputEl);
                if (!blockRoot) continue;

                const group = this.detectRadioCheckboxGroup(blockRoot);
                const primary = group ? null : this.pickPrimaryField(blockRoot);
                const fieldEl = group ? group.nodes[0] : (primary || inputEl);

                const qText = getNearestText(fieldEl) || getNearestText(blockRoot) || '';
                const questionText = qText.trim();

                if (!questionText || normalizeText(questionText).length < 2) continue;

                const inputType = group ? group.type : inferInputType(fieldEl);
                const required = isLikelyRequired(blockRoot, fieldEl);
                const stepIndex = inferStepIndex();

                // Determine dropdown node
                let dropdownNode: HTMLElement | undefined = undefined;
                if (inputType === FieldType.SELECT_NATIVE || inputType === FieldType.DROPDOWN_CUSTOM) {
                    dropdownNode = fieldEl;
                }
                if (fieldEl.getAttribute('aria-haspopup') === 'listbox') {
                    dropdownNode = fieldEl;
                }

                // Generate stable hash
                const q_hash = stableHash(
                    `${location.href}|${stepIndex}|${normalizeText(questionText)}|${inputType}`
                );

                // De-duplicate
                if (seenHashes.has(q_hash)) continue;
                seenHashes.add(q_hash);

                const block: QuestionBlock = {
                    q_hash,
                    questionText,
                    inputType,
                    inputNode: fieldEl,
                    dropdownNode,
                    required,
                    stepIndex,
                    blockRoot
                };

                results.push(block);

                DebugLogger.debug('BLOCK_FOUND', {
                    q_hash,
                    stepIndex,
                    inputType,
                    required,
                    questionText: questionText.slice(0, 140)
                });

                // Yield if taking too long
                if (performance.now() - start > SCAN_IDLE_BUDGET_MS) break;
            }
        };

        // Use requestIdleCallback to avoid blocking main thread
        await new Promise<void>((resolve) => {
            const loop = () => {
                if (count > SCAN_MAX_NODES || !node) {
                    DebugLogger.info('SCAN_DONE', { total: results.length, nodes: count });
                    return resolve();
                }

                processChunk();

                if (typeof requestIdleCallback === 'function') {
                    requestIdleCallback(loop, { timeout: 250 });
                } else {
                    setTimeout(loop, 0);
                }
            };

            loop();
        });

        // Sort by DOM order (approximate via bounding box position)
        results.sort((a, b) => {
            const ra = a.blockRoot.getBoundingClientRect();
            const rb = b.blockRoot.getBoundingClientRect();
            return (ra.top - rb.top) || (ra.left - rb.left);
        });

        // Collect dropdown options if needed
        for (const block of results) {
            if (block.dropdownNode && (block.inputType === FieldType.SELECT_NATIVE || block.inputType === FieldType.DROPDOWN_CUSTOM)) {
                try {
                    block.options = await getDropdownOptions(block.dropdownNode, { timeout: 3000, retries: 2 });

                    DebugLogger.debug('BLOCK_OPTIONS_COLLECTED', {
                        q_hash: block.q_hash,
                        optionCount: block.options.length
                    });
                } catch (error) {
                    DebugLogger.warn('BLOCK_OPTIONS_FAILED', {
                        q_hash: block.q_hash,
                        error: error instanceof Error ? error.message : String(error)
                    });
                    block.options = [];
                }
            }
        }

        return results;
    }
}

/**
 * Observe form mutations for multi-step forms
 */
export function observeFormMutations(
    callback: (newBlocks: QuestionBlock[]) => void
): MutationObserver {
    let debounceTimer: number | null = null;

    const observer = new MutationObserver((mutations) => {
        const hasSignificantChanges = mutations.some(mutation => {
            // Ignore changes to our own UI elements
            const target = mutation.target;
            if (target instanceof Element && target.closest('#autofill-overlay-root, #awl-dock-btn, #awl-dock-panel')) {
                return false;
            }

            const hasAdded = mutation.addedNodes.length > 0;
            const hasRemoved = mutation.removedNodes.length > 0;

            return hasAdded || hasRemoved;
        });

        if (hasSignificantChanges) {
            if (debounceTimer) clearTimeout(debounceTimer);

            debounceTimer = window.setTimeout(async () => {
                DebugLogger.info('FORM_MUTATION_DETECTED', { url: location.href });

                const scanner = new DynamicScanner();
                const newBlocks = await scanner.scanDocument();
                callback(newBlocks);
            }, 500);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    DebugLogger.info('FORM_MUTATION_OBSERVER_STARTED', {});

    return observer;
}
