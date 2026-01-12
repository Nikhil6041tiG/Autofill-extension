// extension/src/content/scanner/dropdownScanner.ts
/**
 * DropdownScanner - Extracts all options from dropdown fields
 * Uses ProductionDropdown's PROVEN keyboard-first logic
 */

const LOG_PREFIX = "[DropdownScanner]";

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Dispatch keyboard event (SAME AS ProductionDropdown)
 */
function dispatchKeyEvent(element: HTMLElement, key: string, code: string) {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, code, bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keypress', { key, code, bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keyup', { key, code, bubbles: true }));
}

/**
 * Get dropdown menu element
 */
function getDropdownMenu(): Element | null {
    const menuSelectors = [
        '.select__menu',
        '[role="listbox"]',
        '[role="menu"]',
        '.dropdown-menu'
    ];

    for (const selector of menuSelectors) {
        const menu = document.querySelector(selector);
        if (menu) return menu;
    }

    return null;
}

/**
 * Wait for dropdown menu to appear using MutationObserver
 */
function waitForDropdownMenu(timeout: number = 2000): Promise<boolean> {
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
 * Find input element within dropdown control
 */
function findDropdownInput(element: HTMLElement): HTMLInputElement | null {
    // If element itself is an input
    if (element instanceof HTMLInputElement) {
        return element;
    }

    // Look for input with role="combobox"
    let input = element.querySelector('input[role="combobox"]') as HTMLInputElement;
    if (input) return input;

    // Look for any input
    input = element.querySelector('input') as HTMLInputElement;
    if (input) return input;

    // Look in parent
    const parent = element.closest('[role="combobox"]');
    if (parent) {
        input = parent.querySelector('input') as HTMLInputElement;
        if (input) return input;
    }

    return null;
}

/**
 * Check if dropdown menu is currently open (SAME AS ProductionDropdown)
 */
async function isMenuOpen(): Promise<boolean> {
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
 * Open dropdown using keyboard (SAME AS ProductionDropdown - PROVEN TO WORK!)
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
 * Close dropdown using Escape key
 */
async function closeDropdown(input: HTMLInputElement): Promise<void> {
    try {
        dispatchKeyEvent(input, 'Escape', 'Escape');
        await sleep(100);
    } catch (error) {
        console.error(`${LOG_PREFIX} Error closing dropdown:`, error);
    }
}

/**
 * Extract options from native <select> element
 */
export function extractNativeOptions(select: HTMLSelectElement): string[] {
    const options: string[] = [];

    for (const option of Array.from(select.options)) {
        const text = option.textContent?.trim();
        if (text && text !== '' && text !== '--' && text.toLowerCase() !== 'select') {
            options.push(text);
        }
    }

    console.log(`${LOG_PREFIX} 📋 Extracted ${options.length} native options`);
    return options;
}

/**
 * Extract options from custom dropdown (React-Select, etc.)
 * Uses ProductionDropdown's PROVEN opening logic
 */
export async function extractCustomOptions(element: HTMLElement): Promise<string[]> {
    const options: string[] = [];

    try {
        // Find the input element
        const input = findDropdownInput(element);
        if (!input) {
            console.warn(`${LOG_PREFIX} ⚠️ Could not find dropdown input`);
            return options;
        }

        console.log(`${LOG_PREFIX} 🔍 Opening dropdown to extract options...`);

        // Focus first
        input.focus();
        await sleep(100);

        // Open the dropdown using ProductionDropdown's proven method
        const opened = await openDropdownWithKeyboard(input);
        if (!opened) {
            console.warn(`${LOG_PREFIX} ⚠️ Failed to open dropdown`);
            return options;
        }

        // Wait for menu to appear
        const menuAppeared = await waitForDropdownMenu(2000);
        if (!menuAppeared) {
            console.warn(`${LOG_PREFIX} ⚠️ Menu did not appear after opening`);
            await closeDropdown(input);
            return options;
        }

        // Wait a bit for options to render
        await sleep(300);

        // Get the menu element
        const menu = getDropdownMenu();
        if (!menu) {
            console.warn(`${LOG_PREFIX} ⚠️ Menu not found after opening`);
            await closeDropdown(input);
            return options;
        }

        // Extract option text from menu items
        const optionElements = menu.querySelectorAll('[role="option"], .select__option, .Select-option, [class*="option"]');

        for (const optionEl of Array.from(optionElements)) {
            const text = optionEl.textContent?.trim();
            if (text && text !== '' && !options.includes(text)) {
                options.push(text);
            }
        }

        console.log(`${LOG_PREFIX} ✅ Extracted ${options.length} custom dropdown options`);

        // Close the dropdown
        await closeDropdown(input);

    } catch (error) {
        console.error(`${LOG_PREFIX} Error extracting custom options:`, error);
    }

    return options;
}

/**
 * Main function to extract options from any dropdown
 */
export async function extractDropdownOptions(element: HTMLElement): Promise<string[]> {
    // Check if it's a native select
    if (element instanceof HTMLSelectElement) {
        return extractNativeOptions(element);
    }

    // Look for select in children
    const select = element.querySelector('select');
    if (select) {
        return extractNativeOptions(select as HTMLSelectElement);
    }

    // Otherwise, treat as custom dropdown
    return await extractCustomOptions(element);
}
