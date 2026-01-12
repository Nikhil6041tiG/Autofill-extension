// extension/src/content/actions/dropdownInteractions.ts
/* ============================================================
   JOBRIGHT-STYLE DROPDOWN INTERACTION LAYERS
   Purpose:
   - Fix dropdown selection issues on Greenhouse, Workday,
     Lever, iCIMS
   - Keyboard + ARIA first, mouse click last
   - Deterministic, no AI, no guessing
   ============================================================ */

/* ------------------------
   GLOBAL UTILITY
------------------------- */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for React state to commit (async verification)
 * Polls condition until it returns true or timeout is reached
 */
export async function waitForCommit(
    condition: () => boolean,
    timeout = 1000
): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (condition()) return true;
        await sleep(50);
    }
    return false;
}

/**
 * Wait for element to appear in DOM using MutationObserver
 * Used to wait for dropdown menus to render before interacting with them
 */
export function waitForElement(selector: string, timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
        // Check if element already exists
        if (document.querySelector(selector)) {
            resolve(true);
            return;
        }

        // Use MutationObserver to watch for element appearing
        const observer = new MutationObserver(() => {
            if (document.querySelector(selector)) {
                observer.disconnect();
                resolve(true);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Timeout fallback
        setTimeout(() => {
            observer.disconnect();
            resolve(false);
        }, timeout);
    });
}

/**
 * Resolve the correct target element for combobox interactions
 * For Greenhouse/React-Select: returns .select__control wrapper
 * For generic ARIA: returns the element itself
 */
export function resolveComboboxTarget(el: HTMLElement): HTMLElement {
    // Greenhouse / React-Select
    const control = el.closest(".select__control");
    if (control) return control as HTMLElement;

    // Workday / generic ARIA
    return el;
}

/**
 * Simulates a high-realism interaction using Trusted CDP events if possible, 
 * falling back to surgical DOM events.
 */
export async function simulateSurgicalClick(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    const x = Math.round(rect.left + rect.width / 2);
    const y = Math.round(rect.top + rect.height / 2);

    try {
        // Attempt trusted click via background debugger
        const response = await chrome.runtime.sendMessage({
            action: "trustedClick",
            x, y
        });

        if (response?.success) return;
    } catch (e) {
        console.warn("[Autofill] Trusted click failed, falling back to DOM events", e);
    }

    // Fallback: Surgical DOM Event Sequence
    const events = ['mousedown', 'mouseup', 'click'];
    events.forEach(evt => {
        element.dispatchEvent(new MouseEvent(evt, {
            bubbles: true,
            cancelable: true,
            view: window,
            buttons: 1
        }));
    });
}

/**
 * Normalizes text for comparison
 */
function normalizeText(text: string): string {
    return text.toLowerCase().trim().replace(/\s+/g, " ");
}

/* ============================================================
   LAYER 1 — ARIA + KEYBOARD SELECTION (PRIMARY)
   Works for: Workday, Lever, iCIMS
============================================================ */
export async function selectByAria(
    combobox: HTMLElement,
    optionText: string
): Promise<boolean> {
    try {
        console.log(`[Autofill] Attempting ARIA selection for: ${optionText}`);

        // Resolve to correct target element
        const target = resolveComboboxTarget(combobox);

        // Open the menu first
        simulateSurgicalClick(target);
        target.focus();

        // Trigger the listbox to appear/update
        target.dispatchEvent(
            new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
        );
        await sleep(500); // Increased from 300ms - wait for menu to render

        for (let i = 0; i < 15; i++) {
            const activeId = target.getAttribute("aria-activedescendant");

            if (activeId) {
                const activeOption = document.getElementById(activeId);
                if (
                    activeOption &&
                    normalizeText(activeOption.textContent || "").includes(normalizeText(optionText))
                ) {
                    target.dispatchEvent(
                        new KeyboardEvent("keydown", {
                            key: "Enter",
                            bubbles: true,
                            keyCode: 13,
                            which: 13
                        })
                    );

                    // Wait for selection to commit
                    const success = await waitForCommit(() => {
                        const selected = target.getAttribute("aria-activedescendant");
                        return selected === activeId;
                    }, 500);

                    if (success) {
                        console.log(`[Autofill] ✅ ARIA selection successful: ${optionText}`);
                        return true;
                    }
                }
            }

            target.dispatchEvent(
                new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
            );
            await sleep(150); // Increased from 100ms - slower navigation for stability
        }
    } catch (e) {
        console.error("[Autofill] ARIA selection error:", e);
    }

    return false;
}

/* ============================================================
   LAYER 2 — REACT-SELECT FORCED STATE UPDATE (PRIMARY FOR GREENHOUSE)
   Works for: Greenhouse (React-Select), any React-controlled dropdown
============================================================ */

/**
 * Force React-Select dropdown to select a value by triggering React's internal state
 * This is the CORRECT way to interact with React-controlled inputs
 */
export async function forceSelectReactDropdown(
    comboboxInput: HTMLInputElement,
    value: string
): Promise<boolean> {
    try {
        console.log(`[Autofill] 🎯 Force React state update for: ${value}`);

        // 1️⃣ Find the real control React listens to
        const control = comboboxInput.closest(".select__control") as HTMLElement;
        if (!control) {
            console.warn("[Autofill] No .select__control found");
            return false;
        }

        // 2️⃣ Open dropdown and wait for menu to appear
        control.scrollIntoView({ block: "center" });
        control.click();
        comboboxInput.focus();

        // WAIT for menu to appear using MutationObserver
        console.log('[Autofill] Waiting for dropdown menu...');
        const menuAppeared = await waitForElement('.select__menu', 2000);
        if (!menuAppeared) {
            console.error('[Autofill] ❌ Dropdown menu never appeared');
            return false;
        }
        console.log('[Autofill] ✅ Menu appeared');

        await sleep(100);

        // 3️⃣ Type value to filter options (helps narrow down options)
        const nativeSetter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value"
        )!.set;

        if (!nativeSetter) {
            console.error("[Autofill] Could not get native value setter");
            return false;
        }

        // Clear and type
        nativeSetter.call(comboboxInput, "");
        comboboxInput.dispatchEvent(new Event("input", { bubbles: true }));
        await sleep(50);

        console.log(`[Autofill] Typing to filter: ${value}`);
        nativeSetter.call(comboboxInput, value);
        comboboxInput.dispatchEvent(new Event("input", { bubbles: true }));

        await sleep(300); // Wait for React to filter options

        // 4️⃣ Find and CLICK the matching option (CRITICAL FIX!)
        const menu = document.querySelector('.select__menu');
        if (!menu) {
            console.error('[Autofill] ❌ Menu disappeared after typing');
            return false;
        }

        const options = Array.from(menu.querySelectorAll('[role="option"]'));
        console.log(`[Autofill] Found ${options.length} options in menu`);

        const normalizedValue = normalizeText(value);
        const matchingOption = options.find(opt => {
            const optText = normalizeText(opt.textContent || '');
            return optText === normalizedValue || optText.includes(normalizedValue);
        });

        if (!matchingOption) {
            console.error(`[Autofill] ❌ No option found matching: ${value}`);
            console.log('[Autofill] Available options:', options.map(o => o.textContent?.trim()));
            return false;
        }

        // CLICK the option (this is what React-Select needs!)
        console.log(`[Autofill] Clicking option: ${matchingOption.textContent?.trim()}`);
        (matchingOption as HTMLElement).scrollIntoView({ block: 'nearest' });
        await sleep(50);
        (matchingOption as HTMLElement).click();

        // 5️⃣ VERIFY selection actually committed with STRICT check
        await sleep(200);
        const success = await waitForCommit(() => {
            const selectedDiv = control.querySelector(".select__single-value");
            if (!selectedDiv) return false;

            const displayedText = normalizeText(selectedDiv.textContent || '');
            const matches = displayedText === normalizedValue || displayedText.includes(normalizedValue);

            if (matches) {
                console.log(`[Autofill] ✅ Verified display shows: ${selectedDiv.textContent?.trim()}`);
            }
            return matches;
        }, 1500);

        if (success) {
            console.log(`[Autofill] ✅ React dropdown committed: ${value}`);
        } else {
            console.error(`[Autofill] ❌ Dropdown verification failed: ${value}`);
            const selectedDiv = control.querySelector(".select__single-value");
            console.error(`[Autofill] Display shows: ${selectedDiv?.textContent || 'Select...'}`);
        }

        return success;
    } catch (e) {
        console.error("[Autofill] Error in forceSelectReactDropdown:", e);
        return false;
    }
}

/* ============================================================
   LAYER 3 — KEYBOARD SEARCH + ENTER (FALLBACK)
   Works for: searchable dropdowns, legacy systems
============================================================ */
export async function keyboardSearchSelect(
    element: HTMLElement,
    value: string
): Promise<boolean> {
    try {
        console.log(`[Autofill] Attempting Keyboard Search for: ${value}`);
        element.focus();

        // Clear if possible
        if (element instanceof HTMLInputElement) {
            element.value = "";
            element.dispatchEvent(new Event("input", { bubbles: true }));
        }

        for (const char of value) {
            element.dispatchEvent(
                new KeyboardEvent("keydown", { key: char, bubbles: true })
            );
            element.dispatchEvent(
                new Event("input", { bubbles: true })
            );
            await sleep(50);
        }

        await sleep(500);

        element.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
        );

        return true;
    } catch (e) {
        console.error("[Autofill] Keyboard search error:", e);
        return false;
    }
}

/* ============================================================
   LAYER 3 — PORTAL ROOT DISCOVERY
   React portals render options outside normal DOM
============================================================ */
export function getAllSearchRoots(): ParentNode[] {
    const roots: ParentNode[] = [document];

    document.querySelectorAll(
        '[role="listbox"], [data-floating-ui-portal], [id*="portal"], [role="presentation"], .select__menu, [class*="MenuList"]'
    ).forEach(el => roots.push(el));

    return roots;
}

/* ============================================================
   GREENHOUSE (React-Select) DETECTION
============================================================ */
export function isGreenhouseDropdown(el: HTMLElement): boolean {
    return Boolean(
        el.closest(".select__control") ||
        el.classList.contains("select__input")
    );
}

/* ============================================================
   GREENHOUSE DROPDOWN HANDLER (KEYBOARD-DRIVEN)
============================================================ */
export async function fillGreenhouseDropdown(
    input: HTMLInputElement,
    value: string
): Promise<boolean> {
    console.log(`[Autofill] 🏢 Greenhouse dropdown handler for: ${value}`);

    // PRIMARY: Try React state-based approach first (CORRECT way for React-Select)
    if (input.getAttribute("role") === "combobox") {
        console.log(`[Autofill] Using React state update approach`);
        const success = await forceSelectReactDropdown(input, value);
        if (success) return true;

        console.log(`[Autofill] React state approach failed, falling back to menu clicking`);
    }

    // FALLBACK: Menu-clicking approach
    try {
        const control = input.closest(".select__control") as HTMLElement;
        if (!control) {
            console.warn("[Autofill] No .select__control found");
            return false;
        }

        // 1️⃣ Open dropdown by clicking control (with increased wait time)
        control.scrollIntoView({ block: "center" });
        await sleep(300); // Increased from 200ms

        control.click();
        await sleep(600); // Increased from 400ms - wait for menu to render

        // 2️⃣ Find the menu that appears (with retry logic)
        let menu: HTMLElement | null = null;

        // Try different selectors for the menu with multiple attempts
        const menuSelectors = [
            '.select__menu',
            '[class*="select__menu"]',
            '[class*="MenuList"]',
            '[role="listbox"]'
        ];

        // Retry up to 3 times to find the menu
        for (let attempt = 0; attempt < 3; attempt++) {
            for (const selector of menuSelectors) {
                const found = Array.from(document.querySelectorAll<HTMLElement>(selector))
                    .find(el => el.offsetParent !== null); // visible only
                if (found) {
                    menu = found;
                    break;
                }
            }
            if (menu) break;

            console.log(`[Autofill] Menu not found, retry attempt ${attempt + 1}/3`);
            await sleep(200); // Wait before retry
        }

        if (!menu) {
            console.warn("[Autofill] Could not find dropdown menu after clicking");
            return false;
        }

        console.log(`[Autofill] Menu found successfully`);

        // 3️⃣ Find all options in the menu
        const options = Array.from(
            menu.querySelectorAll<HTMLElement>('[role="option"], .select__option, [class*="option"]')
        );

        console.log(`[Autofill] Found ${options.length} options in menu`);

        // 4️⃣ Find matching option by text content
        const normalizedValue = normalizeText(value);
        const matchingOption = options.find(option => {
            const optionText = normalizeText(option.textContent || "");
            return optionText === normalizedValue || optionText.includes(normalizedValue);
        });

        if (!matchingOption) {
            console.warn(`[Autofill] No matching option found for: ${value}`);
            // Close menu by clicking control again
            control.click();
            return false;
        }

        // 5️⃣ Click the matching option
        console.log(`[Autofill] Clicking option: ${matchingOption.textContent?.trim()}`);
        matchingOption.scrollIntoView({ block: "nearest" });
        await sleep(150); // Increased from 100ms

        // Dispatch full mouse event sequence for maximum compatibility
        matchingOption.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        matchingOption.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
        matchingOption.click();

        await sleep(300); // Increased from 200ms - wait for selection to commit

        // 6️⃣ Verify selection with enhanced check
        const success = await waitForCommit(() => {
            const selectedValue = control.querySelector(".select__single-value");
            if (!selectedValue) return false;

            const selectedText = selectedValue.textContent?.trim() || "";
            // Verify the selected text matches what we wanted to select
            return selectedText.length > 0 && normalizeText(selectedText).includes(normalizedValue);
        }, 1500); // Increased timeout from 1000ms to 1500ms

        if (success) {
            console.log(`[Autofill] ✅ Greenhouse dropdown selected: ${value}`);
        } else {
            console.warn(`[Autofill] ⚠️ Selection verification failed for: ${value}`);
        }

        return success;
    } catch (e) {
        console.error("[Autofill] Greenhouse dropdown error:", e);
        return false;
    }
}

/* ============================================================
   UNIVERSAL DROPDOWN EXECUTION ORDER (JOBRIGHT STYLE)
   CALL THIS FROM YOUR EXISTING selectCustomDropdown()
============================================================ */
export async function jobrightSelectDropdown(
    element: HTMLElement,
    optionText: string
): Promise<boolean> {

    // 1️⃣ Greenhouse (React-Select)
    if (isGreenhouseDropdown(element)) {
        if (await fillGreenhouseDropdown(element as HTMLInputElement, optionText))
            return true;
    }

    // 2️⃣ ARIA-based selection (Workday, Lever, iCIMS)
    if (await selectByAria(element, optionText)) return true;

    // 3️⃣ Keyboard search fallback
    if (await keyboardSearchSelect(element, optionText)) return true;

    // 4️⃣ LAST fallback: portal-aware surgical mouse click
    console.log(`[Autofill] Falling back to Portal Discovery for: ${optionText}`);
    for (const root of getAllSearchRoots()) {
        const options = Array.from(
            root.querySelectorAll<HTMLElement>('[role="option"], li, div.select__option, [class*="-option"]')
        );

        for (const opt of options) {
            if (normalizeText(opt.textContent || "").includes(normalizeText(optionText))) {
                console.log(`[Autofill] Found matching option in portal: ${opt.textContent}`);
                opt.scrollIntoView({ block: 'nearest' });
                simulateSurgicalClick(opt);
                await sleep(100);
                return true;
            }
        }
    }

    // ❌ Nothing worked → skip safely
    return false;
}
