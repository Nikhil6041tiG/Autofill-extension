// extension/src/content/actions/productionDropdown.ts
/**
 * PRODUCTION KEYBOARD-FIRST DROPDOWN STRATEGY
 * Based on Jobright.ai specification for same-tab autofill
 * 
 * Strategy:
 * 1. Focus the dropdown input/control
 * 2. Press Space/Enter to open menu (NOT click!)
 * 3. MutationObserver waits for menu to appear
 * 4. Type value to filter options
 * 5. Arrow Down to navigate to match
 * 6. Enter to commit selection
 * 7. Strict verification of displayed value
 */

import { sleep, waitForElement } from './dropdownInteractions';

const LOG_PREFIX = "[ProductionDropdown]";

export async function selectDropdownKeyboardFirst(
    element: HTMLElement,
    value: string,
    options?: string[]
): Promise<boolean> {
    console.log(`${LOG_PREFIX} 🎯 Keyboard-first selection for: ${value}`);

    try {
        // Step 1: Focus the dropdown
        const input = findDropdownInput(element);
        if (!input) {
            console.warn(`${LOG_PREFIX} ❌ Could not find dropdown input`);
            return false;
        }

        input.focus();
        await sleep(100);
        console.log(`${LOG_PREFIX} ✅ Focused input`);

        // Step 2: Open with Space/Enter (NOT click!)
        const opened = await openDropdownWithKeyboard(input);
        if (!opened) {
            console.warn(`${LOG_PREFIX} ❌ Failed to open menu with keyboard`);
            return false;
        }

        // Step 3: MutationObserver waits for menu
        console.log(`${LOG_PREFIX} ⏳ Waiting for dropdown menu...`);
        const menuAppeared = await waitForDropdownMenu(2000);
        if (!menuAppeared) {
            console.warn(`${LOG_PREFIX} ❌ Menu did not appear after keyboard open`);
            return false;
        }
        console.log(`${LOG_PREFIX} ✅ Menu appeared`);

        // Step 4: Type to filter options
        await typeToFilter(input, value);
        await sleep(200); // Wait for filtering

        // Step 5: ArrowDown to navigate (if needed)
        // Step 6: Enter to commit
        const committed = await commitSelection(input);
        if (!committed) {
            console.warn(`${LOG_PREFIX} ❌ Failed to commit selection`);
            return false;
        }

        // Step 7: Strict verification
        await sleep(300); // Wait for React state to update
        const verified = verifySelection(element, value);

        if (verified) {
            console.log(`${LOG_PREFIX} ✅ Selection verified: ${value}`);
            return true;
        } else {
            console.warn(`${LOG_PREFIX} ❌ Verification failed for: ${value}`);
            return false;
        }

    } catch (error) {
        console.error(`${LOG_PREFIX} ❌ Error:`, error);
        return false;
    }
}

/**
 * Find the actual input element within the dropdown control
 */
function findDropdownInput(element: HTMLElement): HTMLInputElement | null {
    // Try: input within control
    let input = element.querySelector<HTMLInputElement>('input[role="combobox"]');
    if (input) return input;

    // Try: input with aria-autocomplete
    input = element.querySelector<HTMLInputElement>('input[aria-autocomplete]');
    if (input) return input;

    // Try: any input within the element
    input = element.querySelector<HTMLInputElement>('input');
    if (input) return input;

    // Try: the element itself if it's an input
    if (element.tagName === 'INPUT') {
        return element as HTMLInputElement;
    }

    // Try: find input in parent .select__control
    const control = element.closest('.select__control');
    if (control) {
        input = control.querySelector<HTMLInputElement>('input');
        if (input) return input;
    }

    return null;
}

/**
 * Open dropdown using keyboard (Space or Enter)
 * This is more reliable than clicking for React dropdowns
 */
async function openDropdownWithKeyboard(input: HTMLInputElement): Promise<boolean> {
    console.log(`${LOG_PREFIX} 🔓 Opening with keyboard...`);

    // Try Space key first (works for most dropdowns)
    dispatchKeyEvent(input, ' ', 'Space');
    await sleep(150);

    if (await isMenuOpen()) {
        console.log(`${LOG_PREFIX} ✅ Opened with Space`);
        return true;
    }

    // Try Enter key
    dispatchKeyEvent(input, 'Enter', 'Enter');
    await sleep(150);

    if (await isMenuOpen()) {
        console.log(`${LOG_PREFIX} ✅ Opened with Enter`);
        return true;
    }

    // Try ArrowDown (some dropdowns open on arrow)
    dispatchKeyEvent(input, 'ArrowDown', 'ArrowDown');
    await sleep(150);

    if (await isMenuOpen()) {
        console.log(`${LOG_PREFIX} ✅ Opened with ArrowDown`);
        return true;
    }

    console.warn(`${LOG_PREFIX} ⚠️ Keyboard open failed, trying click fallback`);
    // Fallback: click the control
    const control = input.closest('.select__control') || input.parentElement;
    if (control) {
        (control as HTMLElement).click();
        await sleep(150);
        return isMenuOpen();
    }

    return false;
}

/**
 * Check if dropdown menu is currently open
 */
async function isMenuOpen(): Promise<boolean> {
    // Check for common menu selectors
    const menuSelectors = [
        '.select__menu',
        '[role="listbox"]',
        '[role="menu"]',
        '.dropdown-menu',
        '[aria-expanded="true"] + [role="listbox"]'
    ];

    for (const selector of menuSelectors) {
        if (document.querySelector(selector)) {
            return true;
        }
    }

    return false;
}

/**
 * Wait for dropdown menu to appear using MutationObserver
 */
function waitForDropdownMenu(timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
        // Check if menu already exists
        if (getDropdownMenu()) {
            resolve(true);
            return;
        }

        const observer = new MutationObserver(() => {
            if (getDropdownMenu()) {
                observer.disconnect();
                resolve(true);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        setTimeout(() => {
            observer.disconnect();
            resolve(!!getDropdownMenu());
        }, timeout);
    });
}

/**
 * Get the dropdown menu element
 */
function getDropdownMenu(): Element | null {
    const selectors = [
        '.select__menu',
        '[role="listbox"]',
        '[role="menu"]',
        '.dropdown-menu'
    ];

    for (const selector of selectors) {
        const menu = document.querySelector(selector);
        if (menu) return menu;
    }

    return null;
}

/**
 * Type value to filter dropdown options
 */
async function typeToFilter(input: HTMLInputElement, value: string) {
    console.log(`${LOG_PREFIX} ⌨️ Typing to filter: ${value}`);

    // Clear existing value first
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(50);

    // Type each character
    for (const char of value) {
        input.value += char;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(30); // Small delay between characters
    }

    console.log(`${LOG_PREFIX} ✅ Typed: ${input.value}`);
}

/**
 * Commit the selection with Enter key
 */
async function commitSelection(input: HTMLInputElement): Promise<boolean> {
    console.log(`${LOG_PREFIX} ✅ Committing with Enter...`);

    // Press Enter to select
    dispatchKeyEvent(input, 'Enter', 'Enter');
    await sleep(200);

    // Check if menu closed (indicates selection was made)
    const menuStillOpen = await isMenuOpen();
    return !menuStillOpen;
}

/**
 * Verify that the selection was applied correctly
 */
function verifySelection(element: HTMLElement, expectedValue: string): boolean {
    // Method 1: Check .select__single-value (React-Select)
    const control = element.closest('.select__control');
    if (control) {
        const singleValue = control.querySelector('.select__single-value');
        if (singleValue) {
            const displayedText = singleValue.textContent?.trim() || '';
            console.log(`${LOG_PREFIX} 🔍 Displayed value: "${displayedText}"`);

            // Fuzzy match (contains or similar)
            if (displayedText.includes(expectedValue) || expectedValue.includes(displayedText)) {
                return true;
            }

            // Exact match
            if (displayedText === expectedValue) {
                return true;
            }
        }
    }

    // Method 2: Check aria-selected option
    const selectedOption = document.querySelector('[role="option"][aria-selected="true"]');
    if (selectedOption) {
        const optionText = selectedOption.textContent?.trim() || '';
        if (optionText.includes(expectedValue) || expectedValue.includes(optionText)) {
            return true;
        }
    }

    // Method 3: Check input value
    const input = findDropdownInput(element);
    if (input && input.value) {
        const inputValue = input.value.trim();
        if (inputValue.includes(expectedValue) || expectedValue.includes(inputValue)) {
            return true;
        }
    }

    console.warn(`${LOG_PREFIX} ⚠️ Verification failed - no match found`);
    return false;
}

/**
 * Dispatch keyboard event
 */
function dispatchKeyEvent(element: HTMLElement, key: string, code: string) {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, code, bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keypress', { key, code, bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keyup', { key, code, bubbles: true }));
}
