// extension/src/content/scanner/formScanner.ts
/**
 * FormScanner - Scans the current page for form fields
 * Replaces Selenium-based scanning with extension-based scanning
 * 
 * Architecture:
 * - Scans current tab directly (no new window needed)
 * - Detects all form fields (text, dropdown, radio, checkbox, etc.)
 * - Extracts dropdown options using DropdownScanner
 * - Returns same data structure as Selenium for compatibility
 */

import { extractDropdownOptions } from './dropdownScanner';

const LOG_PREFIX = "[FormScanner]";

export interface ScannedQuestion {
    questionText: string;
    fieldType: string;
    options?: string[];
    required: boolean;
    selector: string;
}

/**
 * FormScanner class
 */
export class FormScanner {

    /**
     * Main scan function - scans all form fields on current page
     */
    async scan(): Promise<ScannedQuestion[]> {
        console.log(`${LOG_PREFIX} 🔍 Starting scan of current page...`);

        let questions: ScannedQuestion[] = [];

        try {
            // Find all form fields
            const fields = this.findAllFormFields();
            console.log(`${LOG_PREFIX} Found ${fields.length} form fields`);

            // Process each field
            for (let i = 0; i < fields.length; i++) {
                const field = fields[i];
                console.log(`${LOG_PREFIX} Processing field ${i + 1}/${fields.length}...`);

                const question = await this.processField(field);
                if (question) {
                    questions.push(question);
                }
            }

            // Deduplicate by question text
            questions = this.deduplicateQuestions(questions);

            console.log(`${LOG_PREFIX} ✅ Scan complete: ${questions.length} unique questions found`);

        } catch (error) {
            console.error(`${LOG_PREFIX} ❌ Scan error:`, error);
        }

        return questions;
    }

    /**
     * Find all form fields in the DOM
     */
    private findAllFormFields(): HTMLElement[] {
        const fields: HTMLElement[] = [];

        // Find all input fields (text, email, tel, file, etc.)
        const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])');
        inputs.forEach(input => {
            if (this.isVisible(input as HTMLElement)) {
                fields.push(input as HTMLElement);
            }
        });

        // Find all textareas
        const textareas = document.querySelectorAll('textarea');
        textareas.forEach(textarea => {
            if (this.isVisible(textarea as HTMLElement)) {
                fields.push(textarea as HTMLElement);
            }
        });

        // Find all native select elements
        const selects = document.querySelectorAll('select');
        selects.forEach(select => {
            if (this.isVisible(select as HTMLElement)) {
                fields.push(select as HTMLElement);
            }
        });

        // Find custom dropdowns (React-Select, etc.)
        // Look for elements with role="combobox" or common React-Select classes
        const customDropdowns = document.querySelectorAll('[role="combobox"], [aria-haspopup="listbox"]');
        customDropdowns.forEach(dropdown => {
            if (!this.isVisible(dropdown as HTMLElement)) return;

            // Only add if not already added (avoid duplicates with inputs)
            const input = dropdown.querySelector('input');
            if (!input || !fields.includes(input as HTMLElement)) {
                fields.push(dropdown as HTMLElement);
            }
        });

        return fields;
    }

    /**
     * Process a single field and extract information
     */
    private async processField(field: HTMLElement): Promise<ScannedQuestion | null> {
        try {
            const fieldType = this.detectFieldType(field);
            const questionText = this.getQuestionText(field);
            const required = this.isRequired(field);
            const selector = this.generateSelector(field);

            // Skip if no question text found
            if (!questionText) {
                console.warn(`${LOG_PREFIX} ⚠️ No question text found for field, skipping`);
                return null;
            }

            // Extract options for dropdown fields
            let options: string[] | undefined = undefined;
            if (fieldType === 'dropdown_custom' || fieldType === 'select') {
                console.log(`${LOG_PREFIX} 📋 Extracting options for: "${questionText}"`);
                options = await extractDropdownOptions(field);
                if (options.length === 0) {
                    console.warn(`${LOG_PREFIX} ⚠️ No options extracted for dropdown: "${questionText}"`);
                }
            }

            return {
                questionText,
                fieldType,
                options,
                required,
                selector
            };

        } catch (error) {
            console.error(`${LOG_PREFIX} Error processing field:`, error);
            return null;
        }
    }

    /**
     * Detect the type of form field
     */
    private detectFieldType(element: HTMLElement): string {
        // Custom dropdown detection MUST come first (before HTMLInputElement check)
        // Because Greenhouse dropdowns are <input type="text" role="combobox">
        if (element.getAttribute('role') === 'combobox' ||
            element.getAttribute('aria-haspopup') === 'listbox' ||
            element.closest('[role="combobox"]') ||
            element.querySelector('[role="combobox"]') ||
            element.querySelector('input[role="combobox"]')) {
            return 'dropdown_custom';
        }

        // Native select
        if (element instanceof HTMLSelectElement) {
            return 'select';
        }

        // Check for select in children
        if (element.querySelector('select')) {
            return 'select';
        }

        // Textarea
        if (element instanceof HTMLTextAreaElement) {
            return 'textarea';
        }

        // Input fields (checked AFTER dropdown detection)
        if (element instanceof HTMLInputElement) {
            const type = element.type.toLowerCase();

            switch (type) {
                case 'email':
                    return 'email';
                case 'tel':
                    return 'tel';
                case 'number':
                    return 'number';
                case 'date':
                    return 'date';
                case 'file':
                    return 'file';
                case 'radio':
                    return 'radio';
                case 'checkbox':
                    return 'checkbox';
                default:
                    return 'text';
            }
        }

        // Default to text
        return 'text';
    }

    /**
     * Extract question text from field's label or aria-label
     * Uses multiple fallback strategies for reliability
     */
    private getQuestionText(element: HTMLElement): string {
        // Method 1: Check aria-label
        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel && ariaLabel.trim()) {
            return ariaLabel.trim();
        }

        // Method 2: Check associated label using for/id
        if (element.id) {
            const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
            if (label && label.textContent) {
                return this.cleanLabelText(label.textContent);
            }
        }

        // Method 3: Check parent label (label wrapping input)
        const parentLabel = element.closest('label');
        if (parentLabel && parentLabel.textContent) {
            return this.cleanLabelText(parentLabel.textContent);
        }

        // Method 4: Check aria-labelledby
        const labelledBy = element.getAttribute('aria-labelledby');
        if (labelledBy) {
            const labelElement = document.getElementById(labelledBy);
            if (labelElement && labelElement.textContent) {
                return this.cleanLabelText(labelElement.textContent);
            }
        }

        // Method 5: Check previous sibling (common pattern: <label>Text</label><input>)
        let prevSibling = element.previousElementSibling;
        while (prevSibling) {
            if (prevSibling.tagName === 'LABEL' && prevSibling.textContent) {
                return this.cleanLabelText(prevSibling.textContent);
            }
            // Also check divs/spans that act as labels
            if ((prevSibling.tagName === 'DIV' || prevSibling.tagName === 'SPAN') &&
                prevSibling.textContent &&
                prevSibling.textContent.trim().length > 0 &&
                prevSibling.textContent.trim().length < 100) {
                return this.cleanLabelText(prevSibling.textContent);
            }
            prevSibling = prevSibling.previousElementSibling;
        }

        // Method 6: Check closest container with common field wrapper classes
        const container = element.closest('[role="group"], .field, .form-field, .question, .form-group');
        if (container && container.textContent) {
            // Get first line as question text
            const lines = container.textContent.trim().split('\n');
            if (lines.length > 0 && lines[0].trim()) {
                return this.cleanLabelText(lines[0]);
            }
        }

        // Method 7: Check name or id attribute as last resort
        const name = element.getAttribute('name');
        if (name) {
            // Convert names like "first_name" to "First Name"
            return name.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
        }

        return '';
    }

    /**
     * Clean label text by removing input values and extra whitespace
     */
    private cleanLabelText(text: string): string {
        return text.trim()
            .split('\n')[0] // Take first line
            .trim()
            .replace(/\s+/g, ' '); // Normalize whitespace
    }

    /**
     * Check if field is required
     */
    private isRequired(element: HTMLElement): boolean {
        // Check required attribute
        if (element.hasAttribute('required')) {
            return true;
        }

        // Check aria-required
        if (element.getAttribute('aria-required') === 'true') {
            return true;
        }

        // Check for asterisk (*) in label
        const questionText = this.getQuestionText(element);
        if (questionText.includes('*')) {
            return true;
        }

        return false;
    }

    /**
     * Check if element is visible
     */
    private isVisible(element: HTMLElement): boolean {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);

        return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0'
        );
    }

    /**
     * Deduplicate questions by question text
     */
    private deduplicateQuestions(questions: ScannedQuestion[]): ScannedQuestion[] {
        const seen = new Set<string>();
        return questions.filter(q => {
            const key = q.questionText.toLowerCase().trim();
            if (seen.has(key)) {
                console.log(`${LOG_PREFIX} 🔍 Skipping duplicate: "${q.questionText}"`);
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    /**
     * Generate unique CSS selector for field
     */
    private generateSelector(element: HTMLElement): string {
        // Prefer ID
        if (element.id) {
            return `#${element.id}`;
        }

        // Use name attribute
        const name = element.getAttribute('name');
        if (name) {
            const tagName = element.tagName.toLowerCase();
            return `${tagName}[name="${name}"]`;
        }

        // Generate path-based selector
        const path: string[] = [];
        let current: Element | null = element;

        while (current && current !== document.body) {
            let selector = current.tagName.toLowerCase();

            // Add class if available
            if (current.className && typeof current.className === 'string') {
                const classes = current.className.split(' ')
                    .filter(c => c && !c.startsWith('css-')) // Exclude dynamic CSS-in-JS classes
                    .slice(0, 2) // Take max 2 classes
                    .join('.');

                if (classes) {
                    selector += `.${classes}`;
                }
            }

            path.unshift(selector);
            current = current.parentElement;

            // Stop if we have a unique enough path
            if (path.length >= 3) {
                break;
            }
        }

        return path.join(' > ');
    }
}
