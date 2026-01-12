// extension/src/content/autofillRunner.ts
/**
 * Main autofill orchestrator - receives answers from Selenium scan and fills current tab
 * Production architecture: Selenium READ-ONLY → Extension fills EVERYTHING
 */

import { fillField } from './actions/fieldFiller';
import { DetectedField, FieldType, QuestionSection } from '../types/fieldDetection';
import { detectFieldsInCurrentDOM, bestMatchField, Detected } from './fieldMatching';

const LOG_PREFIX = "[AutofillRunner]";

export type ResolvedField = {
    questionId?: string;
    questionText: string;
    canonicalKey?: string;
    fieldType: "TEXT" | "TEXTAREA" | "EMAIL" | "PHONE" | "NUMBER" | "DATE" | "RADIO" | "CHECKBOX" | "SELECT_NATIVE" | "DROPDOWN_CUSTOM" | "FILE";
    value: any;
    confidence?: number;
    selector?: string;
    options?: string[];
    fileName?: string; // For file uploads
};

export type FillPayload = {
    url: string;
    fields: ResolvedField[];
    jobId?: string;
    runId: string;
};

declare global {
    interface WindowEventMap {
        'START_AUTOFILL_EVENT': CustomEvent<FillPayload>;
    }
}

/**
 * Initialize autofill runner - listens for START_AUTOFILL messages
 */
export function initAutofillRunner() {
    window.addEventListener('START_AUTOFILL_EVENT', (event: CustomEvent<FillPayload>) => {
        (async () => {
            await runAutofill(event.detail);
        })();
    });

    console.log(`${LOG_PREFIX} ✅ Initialized and listening for START_AUTOFILL_EVENT`);
}

/**
 * Main autofill execution
 */
async function runAutofill(payload: FillPayload) {
    console.log(`${LOG_PREFIX} 🚀 START_AUTOFILL`, payload);

    // Step 1: Detect fields in current DOM
    const detected = detectFieldsInCurrentDOM();
    console.log(`${LOG_PREFIX} 🔎 Detected ${detected.length} fields in current tab`);

    const results: any[] = [];
    let successes = 0;
    let failures = 0;

    // Step 2: Match and fill each resolved field
    for (const rf of payload.fields) {
        // Find matching DOM element
        const match = bestMatchField(detected, rf.questionText, rf.canonicalKey);

        if (!match) {
            console.warn(`${LOG_PREFIX} ⚠️ No DOM match for: ${rf.questionText}`);
            results.push({ questionText: rf.questionText, ok: false, reason: "No DOM match" });
            await reportFieldFailed(payload, rf, "NO_DOM_MATCH");
            failures++;
            continue;
        }

        // Fill the matched field
        const ok = await fillMatchedField(match, rf);
        results.push({ questionText: rf.questionText, ok });

        if (ok) {
            console.log(`${LOG_PREFIX} ✅ Filled: ${rf.questionText}`);
            successes++;
        } else {
            console.error(`${LOG_PREFIX} ❌ Failed: ${rf.questionText}`);
            await reportFieldFailed(payload, rf, "FILL_VERIFY_FAILED");
            failures++;
        }

        // Small delay between fields
        await sleep(150);
    }

    console.log(`${LOG_PREFIX} ✅ AUTOFILL COMPLETE: ${successes} success, ${failures} failed`);

    // Dispatch completion event for UI timer
    window.dispatchEvent(new CustomEvent('AUTOFILL_COMPLETE_EVENT', {
        detail: { successes, failures }
    }));
}

/**
 * Fill a matched field using appropriate strategy
 */
async function fillMatchedField(match: Detected, rf: ResolvedField): Promise<boolean> {
    try {
        // Create DetectedField compatible with existing fillField
        // IMPORTANT: Use the fieldType from Selenium (in rf) instead of detected kind
        // because Selenium has accurate type detection for complex dropdowns
        const field: DetectedField = {
            element: match.element as any,
            questionText: match.questionText,
            fieldType: mapSeleniumTypeToFieldType(rf.fieldType), // Use Selenium's type!
            isRequired: false,
            options: rf.options,
            section: QuestionSection.PERSONAL,
            canonicalKey: rf.canonicalKey || '',
            confidence: rf.confidence || 1.0,
            filled: false,
            filledValue: String(rf.value),
            skipped: false
        };

        // Use existing fillField from fieldFiller.ts
        // Pass fileName if it's a file upload
        const result = await fillField(field, String(rf.value), rf.fileName);
        return result.success;
    } catch (e) {
        console.error(`${LOG_PREFIX} ❌ Fill error:`, e);
        return false;
    }
}

/**
 * Map Selenium field type string to FieldType enum
 * Selenium provides accurate type detection for complex dropdowns
 */
function mapSeleniumTypeToFieldType(seleniumType: string): FieldType {
    const type = String(seleniumType).toLowerCase();

    if (type.includes('dropdown') || type.includes('select') || type === 'dropdown_custom') {
        return FieldType.DROPDOWN_CUSTOM;
    }
    if (type === 'select_native') return FieldType.SELECT_NATIVE;
    if (type === 'textarea') return FieldType.TEXTAREA;
    if (type === 'email') return FieldType.EMAIL;
    if (type === 'phone') return FieldType.PHONE;
    if (type === 'number') return FieldType.NUMBER;
    if (type === 'radio' || type === 'radio_group') return FieldType.RADIO_GROUP;
    if (type === 'checkbox') return FieldType.CHECKBOX;
    if (type === 'date') return FieldType.DATE;
    if (type === 'file' || type === 'file_upload') return FieldType.FILE_UPLOAD;
    if (type === 'multiselect') return FieldType.MULTISELECT;

    // Default to text
    return FieldType.TEXT;
}

/**
 * Map detected field kind to FieldType enum (kept for reference, now unused)
 */
function mapFieldType(kind: string): FieldType {
    switch (kind) {
        case "TEXT": return FieldType.TEXT;
        case "TEXTAREA": return FieldType.TEXTAREA;
        case "SELECT_NATIVE": return FieldType.SELECT_NATIVE;
        case "DROPDOWN_CUSTOM": return FieldType.DROPDOWN_CUSTOM;
        case "RADIO": return FieldType.RADIO_GROUP;
        case "CHECKBOX": return FieldType.CHECKBOX;
        case "DATE": return FieldType.DATE;
        case "FILE": return FieldType.FILE_UPLOAD;
        default: return FieldType.TEXT;
    }
}

/**
 * Report field fill failure to background for Selenium fallback
 */
async function reportFieldFailed(payload: FillPayload, rf: ResolvedField, code: string) {
    try {
        await chrome.runtime.sendMessage({
            type: "FIELD_FILL_FAILED",
            payload: {
                runId: payload.runId,
                url: payload.url,
                jobId: payload.jobId,
                code,
                field: rf
            }
        });
    } catch (e) {
        console.warn(`${LOG_PREFIX} Failed to report field failure:`, e);
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
