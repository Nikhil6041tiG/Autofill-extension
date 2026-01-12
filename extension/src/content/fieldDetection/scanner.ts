// extension/src/content/fileDetection/scanner.ts

import { FieldType } from "../../types/fieldDetection";
import { detectPlatform, JobPlatform, getPlatformSelectors } from "../utils/platformDetection";

/**
 * Scan DOM for all interactive form fields
 * Handles: inputs, textareas, selects, radio groups, checkboxes, custom controls
 */
export function scanFormFields(): HTMLElement[] {
    const fields: HTMLElement[] = [];
    const seenElements = new Map<HTMLElement, number>(); // Map element to its index in fields array
    const platform = detectPlatform();

    // Helper function to add or replace elements
    // Prioritizes elements with role="combobox" over plain inputs
    const addUnique = (elements: HTMLElement[], priority: number = 0) => {
        elements.forEach(el => {
            // Check if this element or a related element is already added
            const existingIndex = seenElements.get(el);
            const tagName = el.tagName.toLowerCase();
            const role = el.getAttribute('role');

            if (existingIndex === undefined) {
                // New element - add it
                const index = fields.length;
                fields.push(el);
                seenElements.set(el, index);
                console.log(`[Scanner] ➕ Added ${tagName}${role ? `[role="${role}"]` : ''} at index ${index} (priority ${priority})`);
            } else {
                // Element already exists
                const existingRole = fields[existingIndex]?.getAttribute('role');
                console.log(`[Scanner] ⏭️  Skipped duplicate: ${tagName}${role ? `[role="${role}"]` : ''} already at index ${existingIndex}`);

                if (priority > 0 && role === 'combobox' && existingRole !== 'combobox') {
                    console.log(`[Scanner] ⬆️  Upgrading element at index ${existingIndex} to combobox version`);
                    fields[existingIndex] = el;
                    seenElements.set(el, existingIndex);
                }
            }
        });
    };

    // Native inputs (priority 0 - base)
    // CRITICAL: Exclude inputs inside .select__control - they'll be picked up by ARIA scan
    const inputs = document.querySelectorAll<HTMLInputElement>(
        'input[type="text"], input[type="email"], input[type="tel"], input[type="number"], ' +
        'input[type="radio"], input[type="checkbox"], input[type="date"], input[type="url"], input[type="file"]'
        // Removed: input:not([type]) - catches React-Select combobox inputs
    );
    const filteredInputs = Array.from(inputs).filter(input => {
        // Skip ALL inputs inside React-Select containers - the ARIA scan will find the correct combobox version
        if (input.closest('.select__control, .select__container, [class*="select__"]')) {
            console.log(`[Scanner] 🚫 Skipping input inside select container: ${input.className}`);
            return false;
        }
        return true;
    });
    console.log(`[Scanner] Filtered ${inputs.length - filteredInputs.length} React-Select inputs from native scan`);
    addUnique(filteredInputs, 0);

    // Textareas
    const textareas = document.querySelectorAll<HTMLTextAreaElement>("textarea");
    addUnique(Array.from(textareas), 0);

    // Native selects
    const selects = document.querySelectorAll<HTMLSelectElement>("select");
    addUnique(Array.from(selects), 0);

    // Platform-specific ARIA custom controls (priority 1 - higher)
    const platformSelectors = getPlatformSelectors();
    const comboboxSelector = platformSelectors.combobox.join(", ");
    const ariaBaseSelector = '[role="combobox"], [role="listbox"], [role="radiogroup"], [role="textbox"]';

    // Combine platform-specific and generic selectors
    const finalSelector = platform !== JobPlatform.GENERIC
        ? `${comboboxSelector}, ${ariaBaseSelector}`
        : ariaBaseSelector;

    const ariaElements = document.querySelectorAll<HTMLElement>(finalSelector);
    // CRITICAL: Only include actual form inputs, not container divs with ARIA roles
    const ariaInputs = Array.from(ariaElements).filter(el => {
        const tag = el.tagName.toLowerCase();
        const role = el.getAttribute('role');
        const isFormInput = tag === 'input' || tag === 'select' || tag === 'textarea';

        // Allow divs/spans with specific roles as they might be the main interaction point
        const isInteractiveRole = role === 'combobox' || role === 'listbox' || role === 'radiogroup' || role === 'checkbox';

        if (!isFormInput && !isInteractiveRole) {
            console.log(`[Scanner] 🚫 Skipping non-input/non-interactive ARIA element: ${tag}[role="${role}"]`);
            return false;
        }
        return true;
    });
    addUnique(ariaInputs, 1); // Higher priority

    // For Greenhouse, also scan for React-Select components (priority 1)
    if (platform === JobPlatform.GREENHOUSE) {
        const reactSelectInputs = document.querySelectorAll<HTMLElement>(
            '.select__control input[role="combobox"], .select__input[role="combobox"]'
        );
        addUnique(Array.from(reactSelectInputs), 1); // Higher priority
    }

    // Scan shadow DOM
    const shadowRoots = findShadowRoots(document.body);
    for (const shadowRoot of shadowRoots) {
        const shadowFields = scanShadowRoot(shadowRoot);
        addUnique(shadowFields, 0);
    }

    // Filter out hidden/disabled fields
    const visibleFields = fields.filter(isVisibleAndEnabled);
    const duplicatesRemoved = fields.length - visibleFields.length;
    console.log(`[Scanner] Total elements found: ${fields.length}, Visible: ${visibleFields.length}, Duplicates removed: ${duplicatesRemoved}`);
    return visibleFields;
}

/**
 * Find all open shadow roots
 */
function findShadowRoots(root: Element): ShadowRoot[] {
    const shadowRoots: ShadowRoot[] = [];

    if (root.shadowRoot && root.shadowRoot.mode === "open") {
        shadowRoots.push(root.shadowRoot);

        // Recursively search within shadow root
        const children = root.shadowRoot.querySelectorAll("*");
        children.forEach((child) => {
            shadowRoots.push(...findShadowRoots(child));
        });
    }

    // Check children
    const children = root.children;
    for (let i = 0; i < children.length; i++) {
        shadowRoots.push(...findShadowRoots(children[i]));
    }

    return shadowRoots;
}

/**
 * Scan shadow root for form fields
 */
function scanShadowRoot(shadowRoot: ShadowRoot): HTMLElement[] {
    const fields: HTMLElement[] = [];

    const inputs = shadowRoot.querySelectorAll<HTMLInputElement>(
        "input, textarea, select"
    );
    fields.push(...Array.from(inputs));

    const ariaElements = shadowRoot.querySelectorAll<HTMLElement>(
        '[role="combobox"], [role="listbox"], [role="radiogroup"], [role="textbox"]'
    );
    fields.push(...Array.from(ariaElements));

    return fields;
}

/**
 * Check if element is visible and enabled
 */
function isVisibleAndEnabled(element: HTMLElement): boolean {
    // Check disabled attribute
    if (element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true") {
        return false;
    }

    // Check visibility
    const style = window.getComputedStyle(element);
    if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.opacity === "0"
    ) {
        return false;
    }

    // Check if element has dimensions
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
        return false;
    }

    return true;
}

/**
 * Classify field type
 */
export function classifyFieldType(element: HTMLElement): FieldType {
    const tagName = element.tagName.toLowerCase();
    const type = element.getAttribute("type")?.toLowerCase();
    const role = element.getAttribute("role");

    // CRITICAL: Check ARIA roles FIRST before checking input types
    // Greenhouse uses <input role="combobox"> which must be treated as dropdown
    if (role === "combobox" || role === "listbox") {
        return FieldType.DROPDOWN_CUSTOM;
    }

    if (role === "radiogroup") {
        return FieldType.RADIO_GROUP;
    }

    if (role === "textbox") {
        return FieldType.TEXT;
    }

    // Native inputs
    if (tagName === "input") {
        if (type === "email") return FieldType.EMAIL;
        if (type === "tel") return FieldType.PHONE;
        if (type === "number") return FieldType.NUMBER;
        if (type === "radio") return FieldType.RADIO_GROUP;
        if (type === "checkbox") return FieldType.CHECKBOX;
        if (type === "date") return FieldType.DATE;
        if (type === "file") return FieldType.FILE_UPLOAD;
        return FieldType.TEXT;
    }

    if (tagName === "textarea") return FieldType.TEXTAREA;

    if (tagName === "select") {
        const isMultiple = element.hasAttribute("multiple");
        return isMultiple ? FieldType.MULTISELECT : FieldType.SELECT_NATIVE;
    }

    return FieldType.TEXT;
}

/**
 * Get radio group options (for radio inputs with same name)
 */
export function getRadioGroupOptions(radioElement: HTMLInputElement): string[] {
    const name = radioElement.name;
    if (!name) return [];

    const radios = document.querySelectorAll<HTMLInputElement>(
        `input[type="radio"][name="${name}"]`
    );

    const options: string[] = [];
    radios.forEach((radio) => {
        const label = getLabelForElement(radio);
        if (label) {
            options.push(label);
        }
    });

    return options;
}

/**
 * Get select/dropdown options
 */
export function getSelectOptions(selectElement: HTMLSelectElement): string[] {
    const options: string[] = [];

    for (let i = 0; i < selectElement.options.length; i++) {
        const optionText = selectElement.options[i].text.trim();
        if (optionText) {
            options.push(optionText);
        }
    }

    return options;
}

/**
 * Get options for custom dropdown (ARIA listbox)
 */
export function getCustomDropdownOptions(element: HTMLElement): string[] {
    // 1. Try ARIA controls (standard accessibility pattern)
    const listboxId = element.getAttribute("aria-controls") || element.getAttribute("aria-owns");

    if (listboxId) {
        const listbox = document.getElementById(listboxId);
        if (listbox) {
            const optionElements = listbox.querySelectorAll('[role="option"]');
            if (optionElements.length > 0) {
                return Array.from(optionElements).map((opt) => opt.textContent?.trim() || "");
            }
        }
    }

    // 2. Try direct descendant options (uncommon for comboboxes, but possible)
    const options = element.querySelectorAll('[role="option"]');
    if (options.length > 0) {
        return Array.from(options).map((opt) => opt.textContent?.trim() || "");
    }

    // 3. Fallback: Search for a correlated hidden <select> (Common in Greenhouse/React-Select)
    // Look up to the closest logical field container
    const container = element.closest('.field, .input-wrapper, .field-wrapper, .form-field, div[class*="container"], [class*="control"]');
    if (container) {
        // Find a select that is NOT the element itself (though element is usually an input here)
        // We look for any select in the container.
        const hiddenSelect = container.querySelector('select');
        if (hiddenSelect && hiddenSelect.options.length > 0) {
            // Filter out empty/generic options
            const extractedOptions = Array.from(hiddenSelect.options)
                .map(o => o.text.trim())
                .filter(t => t && !isGenericText(t));

            if (extractedOptions.length > 0) {
                // console.log(`[Scanner] Found hidden select options for custom dropdown:`, extractedOptions);
                return extractedOptions;
            }
        }
    }

    return [];
}

/**
 * Get label text for an element
 */
export function getLabelForElement(element: HTMLElement): string | null {
    // Check for <label for="id">
    const id = element.id;
    if (id) {
        const label = document.querySelector<HTMLLabelElement>(`label[for="${id}"]`);
        if (label) {
            const labelText = label.textContent?.trim() || null;
            // For file inputs, "Attach" is a generic label that we should skip if possible
            const isWeakLabel = labelText?.toLowerCase() === 'attach' || labelText?.toLowerCase() === 'upload';
            if (labelText && !isGenericText(labelText) && !isWeakLabel) {
                return labelText;
            }
        }
    }

    // Check for wrapping label
    const parentLabel = element.closest("label");
    if (parentLabel) {
        const labelText = parentLabel.textContent?.trim() || null;
        if (labelText && !isGenericText(labelText)) {
            return labelText;
        }
    }

    // Check ARIA label
    const ariaLabel = element.getAttribute("aria-label");
    if (ariaLabel && !isGenericText(ariaLabel.trim())) {
        return ariaLabel.trim();
    }

    // Check ARIA labelledby
    const ariaLabelledBy = element.getAttribute("aria-labelledby");
    if (ariaLabelledBy) {
        const labelElement = document.getElementById(ariaLabelledBy);
        if (labelElement) {
            const labelText = labelElement.textContent?.trim() || null;
            if (labelText && !isGenericText(labelText)) {
                return labelText;
            }
        }
    }

    // Check parent for aria-labelledby (Greenhouse pattern)
    const parentWithLabel = element.closest('[aria-labelledby]');
    if (parentWithLabel) {
        const labelledBy = parentWithLabel.getAttribute('aria-labelledby');
        if (labelledBy) {
            const labelElement = document.getElementById(labelledBy);
            if (labelElement) {
                const labelText = labelElement.textContent?.trim() || null;
                if (labelText && !isGenericText(labelText)) {
                    return labelText;
                }
            }
        }
    }

    // For dropdowns, check parent container for labels/headings before falling back to placeholder
    const containerLabel = findContainerLabel(element);
    if (containerLabel && !isGenericText(containerLabel)) {
        return containerLabel;
    }

    // Check nearest preceding text (but skip if it's generic)
    const nearestText = findNearestPrecedingText(element);
    if (nearestText && !isGenericText(nearestText)) {
        return nearestText;
    }

    // LAST RESORT: Check placeholder
    const placeholder = element.getAttribute("placeholder");
    if (placeholder && !isGenericText(placeholder.trim())) {
        return placeholder.trim();
    }

    // FINAL FALLBACK: Use ID as label hint if nothing else found
    if (id && id.length > 2) {
        return id.replace(/[-_]/g, ' ');
    }

    return null;
}

/**
 * Check if text is too generic to be useful (like "Select...", "Choose", etc.)
 */
function isGenericText(text: string): boolean {
    const genericPatterns = [
        /^select/i,
        /^choose/i,
        /^pick/i,
        /^-+$/,
        /^\.\.\.$/,
        /^please select/i,
        /^please choose/i
    ];

    const trimmed = text.trim();
    if (trimmed.length === 0 || trimmed.length > 300) return true;

    return genericPatterns.some(pattern => pattern.test(trimmed));
}

/**
 * Find label text from parent container (for dropdowns in fieldsets, divs, etc.)
 */
function findContainerLabel(element: HTMLElement): string | null {
    // Check parent containers up to 3 levels
    let current = element.parentElement;
    let depth = 0;

    while (current && depth < 5) {
        // Check for legend in parent fieldset
        if (current.tagName === 'FIELDSET') {
            const legend = current.querySelector('legend');
            if (legend) {
                const legendText = legend.textContent?.trim();
                if (legendText) return legendText;
            }
        }

        // Check for label element in container
        const containerLabel = current.querySelector('label');
        if (containerLabel && !containerLabel.contains(element)) {
            const labelText = containerLabel.textContent?.trim();
            if (labelText) return labelText;
        }

        // Check for heading (h1-h6) in container
        for (let i = 1; i <= 6; i++) {
            const heading = current.querySelector(`h${i}`);
            if (heading && !heading.contains(element)) {
                const headingText = heading.textContent?.trim();
                if (headingText) return headingText;
            }
        }

        // Check for span/div with specific classes that might contain label
        const possibleLabel = current.querySelector('[class*="label"], [class*="question"], [class*="title"]');
        if (possibleLabel && !possibleLabel.contains(element)) {
            const text = possibleLabel.textContent?.trim();
            if (text && text.length < 200) return text;
        }

        current = current.parentElement;
        depth++;
    }

    return null;
}

/**
 * Find nearest preceding text node (heuristic for labels)
 */
function findNearestPrecedingText(element: HTMLElement): string | null {
    // Check previous sibling
    let prev = element.previousElementSibling;
    while (prev) {
        const text = prev.textContent?.trim();
        if (text && text.length > 0 && text.length < 200) {
            return text;
        }
        prev = prev.previousElementSibling;
    }

    // Check parent's text
    const parent = element.parentElement;
    if (parent) {
        // Get direct text nodes of parent (not from descendants)
        const textNodes: string[] = [];
        for (let i = 0; i < parent.childNodes.length; i++) {
            const node = parent.childNodes[i];
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent?.trim();
                if (text) {
                    textNodes.push(text);
                }
            }
        }

        if (textNodes.length > 0) {
            return textNodes.join(" ");
        }
    }

    return null;
}

/**
 * Check if field is required
 */
export function isFieldRequired(element: HTMLElement): boolean {
    // Check required attribute
    if (element.hasAttribute("required")) {
        return true;
    }

    // Check ARIA
    if (element.getAttribute("aria-required") === "true") {
        return true;
    }

    // Check for indicator elements in parent container
    const container = element.closest('.input-wrapper, .file-upload, [role="group"]');
    if (container) {
        if (container.getAttribute('aria-required') === 'true' || container.hasAttribute('data-required')) {
            return true;
        }
        const requiredIndicator = container.querySelector('.required, .asterisk, [class*="required"], [aria-hidden="true"]');
        if (requiredIndicator && requiredIndicator.textContent?.includes("*")) return true;

        // Final broad check in container text
        if (container.textContent?.includes("*")) return true;
    }

    // Fallback: Check label text for indicators
    const label = getLabelForElement(element);
    if (label) {
        if (
            label.includes("*") ||
            /\brequired\b/i.test(label) ||
            /\bmandatory\b/i.test(label)
        ) {
            return true;
        }
    }

    return false;
}

/**
 * Find the most likely submission button on the page
 */
export function findSubmitButton(): HTMLElement | null {
    const selectors = [
        'input[type="submit"]',
        'button[type="submit"]',
        '#submit_app',
        '#submit_application',
        '.submit-button',
        '.apply-button',
        'button.submit',
        'input.submit',
        '[data-automation-id="submit-button"]',
        '[aria-label="Submit Application"]',
        '[aria-label="Submit application"]',
        'button:contains("Submit Application")',
        'button:contains("Submit application")',
        'button:contains("Submit Application")',
        'button:contains("Apply")',
        'button:contains("Apply Now")'
    ];

    for (const selector of selectors) {
        if (selector.includes(':contains')) {
            const textMatch = selector.match(/:contains\("(.+)"\)/);
            if (textMatch) {
                const text = textMatch[1].toLowerCase();
                const tagName = selector.split(':')[0];
                const elements = document.querySelectorAll(tagName);
                for (const el of Array.from(elements)) {
                    if (el.textContent?.toLowerCase().includes(text)) {
                        return el as HTMLElement;
                    }
                }
            }
            continue;
        }

        const el = document.querySelector<HTMLElement>(selector);
        if (el && el.offsetParent !== null) {
            return el;
        }
    }

    // Heuristic: Last button in the form
    const forms = document.querySelectorAll('form');
    if (forms.length > 0) {
        const lastForm = forms[forms.length - 1];
        const buttons = lastForm.querySelectorAll('button, input[type="button"]');
        if (buttons.length > 0) {
            return buttons[buttons.length - 1] as HTMLElement;
        }
    }

    return null;
}
