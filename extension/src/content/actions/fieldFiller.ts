import { DetectedField, FieldType } from "../../types/fieldDetection";
import {
    fillInput,
    selectRadioByLabel,
    setCheckbox,
    selectNativeOption,
    selectCustomDropdown,
    fillDate,
    triggerFileUpload,
} from "./autofillActions";
// STATIC IMPORT - avoids CSP chunk loading error
import { selectDropdownKeyboardFirst } from './productionDropdown';

export interface FillResult {
    success: boolean;
    filled: boolean;
    skipped: boolean;
    reason?: string;
    value?: string;
}

/**
 * Orchestrate filling a single field based on its type and value
 */
export async function fillField(
    field: DetectedField,
    value: any,
    fileName?: string // Optional filename for file uploads
): Promise<FillResult> {
    console.log(`\n[Autofill] 🔄 Attempting to fill field:`, {
        question: field.questionText,
        type: field.fieldType,
        value: value,
        canonicalKey: field.canonicalKey,
        fileName: fileName
    });

    if (!value || value === "") {
        console.log(`[Autofill] ⚠️ No value to fill for: ${field.questionText}`);
        return {
            success: false,
            filled: false,
            skipped: true,
            reason: "No value to fill",
        };
    }

    try {
        let success = false;

        switch (field.fieldType) {
            case FieldType.TEXT:
            case FieldType.EMAIL:
            case FieldType.PHONE:
            case FieldType.NUMBER:
            case FieldType.TEXTAREA:
                console.log(`[Autofill] 📝 Filling input field: ${field.questionText}`);
                success = await fillInput(
                    field.element as HTMLInputElement | HTMLTextAreaElement,
                    String(value)
                );
                break;

            case FieldType.SELECT_NATIVE:
                console.log(`[Autofill] 📋 Selecting from native dropdown: ${field.questionText}`);
                success = await selectNativeOption(
                    field.element as HTMLSelectElement,
                    String(value)
                );
                break;

            case FieldType.DROPDOWN_CUSTOM:
                console.log(`[Autofill] 🎯 Selecting from custom dropdown: ${field.questionText} → ${value}`);
                // Use PRODUCTION keyboard-first dropdown strategy (static import to avoid CSP)
                const dropdownResult = await selectDropdownKeyboardFirst(
                    field.element,
                    String(value),
                    field.options
                );
                if (dropdownResult) {
                    console.log(`[Autofill] ✅ Custom dropdown result: ${dropdownResult}`);
                    return { success: true, filled: true, skipped: false };
                } else {
                    console.warn(`[Autofill] ❌ Custom dropdown failed for: ${field.questionText}`);
                    return { success: false, filled: false, skipped: false };
                }

            case FieldType.RADIO_GROUP:
                const radioInput = field.element as HTMLInputElement;
                const radioName = radioInput.name;
                if (radioName) {
                    console.log(`[Autofill] 🔘 Selecting radio: ${field.questionText} → ${value}`);
                    success = await selectRadioByLabel(radioName, String(value));
                }
                break;

            case FieldType.CHECKBOX:
                const checkboxValue = value === true || value === "true" || value === "yes";
                console.log(`[Autofill] ☑️ Setting checkbox: ${field.questionText} → ${checkboxValue}`);
                success = await setCheckbox(
                    field.element as HTMLInputElement,
                    checkboxValue
                );
                break;

            case FieldType.DATE:
                console.log(`[Autofill] 📅 Filling date: ${field.questionText} → ${value}`);
                success = await fillDate(field.element as HTMLInputElement, String(value));
                break;

            case FieldType.FILE_UPLOAD:
                console.log(`[Autofill] 📎 Triggering file upload: ${field.questionText}`);
                // Upload file from base64 data if available, with fallback to file picker
                success = await triggerFileUpload(
                    field.element as HTMLInputElement,
                    String(value), // base64 data
                    fileName || 'resume.pdf'  // use provided filename or default
                );
                if (success) {
                    return {
                        success: true,
                        filled: true,
                        skipped: false,
                        reason: "Resume uploaded successfully",
                    };
                } else {
                    return {
                        success: false,
                        filled: false,
                        skipped: false,
                        reason: "File upload failed",
                    };
                }

            default:
                console.warn(`[Autofill] ❓ Unsupported field type: ${field.fieldType} for ${field.questionText}`);
                return {
                    success: false,
                    filled: false,
                    skipped: true,
                    reason: `Unsupported field type: ${field.fieldType}`,
                };
        }

        if (success) {
            console.log(`[Autofill] ✅ Successfully filled: ${field.questionText}`);
            return {
                success: true,
                filled: true,
                skipped: false,
                value: String(value),
            };
        } else {
            console.warn(`[Autofill] ⚠️ Failed to fill: ${field.questionText}`);
            return {
                success: false,
                filled: false,
                skipped: true,
                reason: "Fill action failed verification",
            };
        }
    } catch (error) {
        console.error(`[Autofill] ❌ Error filling field "${field.questionText}":`, error);
        return {
            success: false,
            filled: false,
            skipped: true,
            reason: `Error: ${error}`,
        };
    }
}

/**
 * Fill all provided fields with their resolved values
 */
export async function fillAllFields(
    fields: DetectedField[]
): Promise<Map<DetectedField, FillResult>> {
    const results = new Map<DetectedField, FillResult>();

    for (const field of fields) {
        if (field.filled || field.skipped) {
            // Already processed
            continue;
        }

        // Only fill if we have a canonical key and high confidence
        if (!field.canonicalKey || field.confidence < 0.8) {
            results.set(field, {
                success: false,
                filled: false,
                skipped: true,
                reason: field.canonicalKey
                    ? `Low confidence (${field.confidence.toFixed(2)})`
                    : "No canonical mapping found",
            });
            continue;
        }

        // Fill the field
        const result = await fillField(field, field.filledValue);
        results.set(field, result);

        // Small delay between fields to avoid overwhelming the page
        await sleep(300);
    }

    return results;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
