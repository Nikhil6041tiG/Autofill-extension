// extension/src/content/actions/autofillActions.ts
/**
 * Form interaction utilities for autofilling fields
 * Simulates human-like interactions with proper event dispatching
 */

import { jobrightSelectDropdown } from "./dropdownInteractions";

/**
 * Type text into an input field character-by-character
 */
export async function typeLikeHuman(
    element: HTMLInputElement | HTMLTextAreaElement,
    value: string
): Promise<boolean> {
    try {
        element.focus();

        // Clear existing value
        element.value = "";
        element.dispatchEvent(new Event("input", { bubbles: true }));

        // Type character by character
        try {
            const response = await chrome.runtime.sendMessage({
                action: "trustedType",
                text: value
            });
            if (response?.success) return verifyInputValue(element, value);
        } catch (e) {
            console.warn("[Autofill] Trusted typing failed, falling back to DOM simulation", e);
        }

        // Fallback: Type character by character simulation
        for (const char of value) {
            element.value += char;
            element.dispatchEvent(new Event("input", { bubbles: true }));
            await sleep(30); // Small delay between characters
        }

        // Dispatch change event
        element.dispatchEvent(new Event("change", { bubbles: true }));
        element.blur();

        return verifyInputValue(element, value);
    } catch (error) {
        console.error("Failed to type into field:", error);
        return false;
    }
}

/**
 * Fill input field instantly (faster alternative)
 */
export async function fillInput(
    element: HTMLInputElement | HTMLTextAreaElement,
    value: string
): Promise<boolean> {
    try {
        element.focus();

        // Set value using multiple methods to ensure it works
        element.value = value;

        // Trigger React/Vue/Angular change detection
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            "value"
        )?.set;

        if (nativeInputValueSetter) {
            nativeInputValueSetter.call(element, value);
        }

        // Dispatch events
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        element.blur();

        return verifyInputValue(element, value);
    } catch (error) {
        console.error("Failed to fill input:", error);
        return false;
    }
}

/**
 * Select a radio button by label text
 */
export async function selectRadioByLabel(
    name: string,
    labelText: string
): Promise<boolean> {
    try {
        const radios = Array.from(document.querySelectorAll<HTMLInputElement>(
            `input[type="radio"][name="${name}"]`
        ));

        for (const radio of radios) {
            const label = getRadioLabel(radio);
            if (label && normalizeText(label) === normalizeText(labelText)) {
                // Get label element for React-safe clicking
                const labelElement = getLabelElement(radio);
                const target = labelElement ?? radio;

                // Dispatch full mouse event sequence
                target.dispatchEvent(
                    new MouseEvent("mousedown", { bubbles: true, cancelable: true })
                );
                target.dispatchEvent(
                    new MouseEvent("mouseup", { bubbles: true, cancelable: true })
                );
                target.dispatchEvent(
                    new MouseEvent("click", { bubbles: true, cancelable: true })
                );

                // Wait for state to commit
                const success = await waitForCommit(() => radio.checked, 500);

                if (success) {
                    console.log(`[Autofill] ✅ Radio button selected: ${labelText}`);
                    return true;
                } else {
                    console.warn(`[Autofill] ⚠️ Radio button may not have committed: ${labelText}`);
                }

                return success;
            }
        }

        return false;
    } catch (error) {
        console.error("Failed to select radio:", error);
        return false;
    }
}

// Helper to wait for state commit (used in radio selection)
async function waitForCommit(
    condition: () => boolean,
    timeout = 500
): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (condition()) return true;
        await sleep(30);
    }
    return false;
}

/**
 * Set checkbox state
 */
export async function setCheckbox(
    element: HTMLInputElement,
    checked: boolean
): Promise<boolean> {
    try {
        const currentState = element.checked;

        if (currentState !== checked) {
            // Click to toggle
            const label = getLabelElement(element);
            if (label) {
                label.click();
            } else {
                element.click();
            }

            await sleep(50);
        }

        return element.checked === checked;
    } catch (error) {
        console.error("Failed to set checkbox:", error);
        return false;
    }
}

/**
 * Select option from native <select> element
 */
export async function selectNativeOption(
    element: HTMLSelectElement,
    optionText: string
): Promise<boolean> {
    try {
        element.focus();

        // Find matching option
        for (let i = 0; i < element.options.length; i++) {
            const option = element.options[i];
            if (normalizeText(option.text) === normalizeText(optionText)) {
                element.selectedIndex = i;
                element.dispatchEvent(new Event("change", { bubbles: true }));
                element.blur();

                return element.selectedIndex === i;
            }
        }

        return false;
    } catch (error) {
        console.error("Failed to select native option:", error);
        return false;
    }
}

/**
 * Select option from custom dropdown (ARIA combobox/listbox)
 */
export async function selectCustomDropdown(
    element: HTMLElement,
    optionText: string
): Promise<boolean> {
    console.log(`[Autofill] Delegating to Jobright-style interaction for: ${optionText}`);
    return await jobrightSelectDropdown(element, optionText);
}

/**
 * Fill date field
 */
export async function fillDate(
    element: HTMLInputElement,
    dateString: string
): Promise<boolean> {
    try {
        element.focus();
        element.value = dateString; // Expects YYYY-MM-DD format
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        element.blur();

        return verifyInputValue(element, dateString);
    } catch (error) {
        console.error("Failed to fill date:", error);
        return false;
    }
}

/**
 * Upload file from base64 data
 * Converts base64 to File object and sets it on the input element
 */
export async function triggerFileUpload(
    element: HTMLInputElement,
    base64Data?: string,
    fileName?: string
): Promise<boolean> {
    try {
        // If we have base64 data, convert it to a File object
        if (base64Data && base64Data.startsWith('data:')) {
            console.log(`[Autofill] 📎 Uploading file from base64 data: ${fileName || 'resume.pdf'}`);

            // Extract MIME type and base64 content
            const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
            if (!matches) {
                console.error(`[Autofill] Invalid base64 data format`);
                return false;
            }

            const mimeType = matches[1];
            const base64Content = matches[2];

            // Convert base64 to binary
            const binaryString = atob(base64Content);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            // Create File object
            const blob = new Blob([bytes], { type: mimeType });
            const file = new File([blob], fileName || 'resume.pdf', { type: mimeType });

            // Create DataTransfer to set files
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);

            // Set files on input element
            element.files = dataTransfer.files;

            // Trigger events
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));

            console.log(`[Autofill] ✅ File uploaded successfully: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
            return true;

        } else {
            // Fallback: Open file picker (manual selection)
            console.log(`[Autofill] ⚠️ No base64 data, opening file picker for: ${element.name || element.id}`);
            element.focus();
            element.click();
            return true;
        }
    } catch (error) {
        console.error("Failed to trigger file upload:", error);
        return false;
    }
}

// Helper functions

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeText(text: string): string {
    return text.toLowerCase().trim().replace(/\s+/g, " ");
}

function getRadioLabel(radio: HTMLInputElement): string | null {
    const label = getLabelElement(radio);
    if (label) {
        return label.textContent?.trim() || null;
    }

    const ariaLabel = radio.getAttribute("aria-label");
    if (ariaLabel) {
        return ariaLabel.trim();
    }

    return null;
}

export function getLabelElement(element: HTMLElement): HTMLLabelElement | null {
    const id = element.id;
    if (id) {
        return document.querySelector<HTMLLabelElement>(`label[for="${id}"]`);
    }

    return element.closest("label");
}

function verifyInputValue(
    element: HTMLInputElement | HTMLTextAreaElement,
    expectedValue: string
): boolean {
    const actualValue = element.value;
    return actualValue === expectedValue;
}
