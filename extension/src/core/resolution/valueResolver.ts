import { CanonicalProfile } from "../../types/canonicalProfile";
import { matchEnumToOption, matchBooleanToOption } from "../mapping/enumMatcher";

export interface ResolvedValue {
    value: any;
    displayValue: string;
    canFill: boolean;
    reason?: string;
}

/**
 * Resolve value from canonical profile for a given canonical key
 * Handles nested paths, arrays, and enum matching
 */
export function resolveValue(
    canonicalKey: string,
    profile: CanonicalProfile,
    availableOptions?: string[]
): ResolvedValue {
    // 1. Check API fields first for deterministic mapping (Requirement: Priority)
    const apiPart = canonicalKey.includes(".") ? canonicalKey.split(".").pop() : canonicalKey;
    let current: any = undefined;

    if (profile.apiFields && apiPart && profile.apiFields[apiPart] !== undefined && profile.apiFields[apiPart] !== null && profile.apiFields[apiPart] !== "") {
        current = profile.apiFields[apiPart];
        console.log(`[Resolver] 🎯 Found in apiFields["${apiPart}"]:`, current);
    } else {
        // 2. Fall back to standard profile navigation
        const parts = canonicalKey.split(".");
        current = profile;
        console.log(`[Resolver] 🔍 Navigating canonical path: ${canonicalKey}`);

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (current === undefined || current === null) {
                current = undefined;
                break;
            }
            current = current[part];
        }
        console.log(`[Resolver] 📍 Result at ${canonicalKey}:`, current);
    }

    // Handle missing values
    if (current === undefined || current === null || current === "") {
        console.log(`[Resolver] ⚠️ Value missing for ${canonicalKey}`);
        return {
            value: null,
            displayValue: "",
            canFill: false,
            reason: `Profile value for "${canonicalKey}" is empty`,
        };
    }

    // Handle arrays (e.g., skills, education)
    if (Array.isArray(current)) {
        if (current.length === 0) {
            return {
                value: null,
                displayValue: "",
                canFill: false,
                reason: "Empty array in profile",
            };
        }

        // For single-value fields expecting first item
        // (More complex array handling would be field-specific)
        const firstValue = current[0];
        return {
            value: firstValue,
            displayValue: typeof firstValue === "string" ? firstValue : JSON.stringify(firstValue),
            canFill: true,
        };
    }

    // Handle booleans with enum options
    if (typeof current === "boolean") {
        const options = availableOptions && availableOptions.length > 0 ? availableOptions : ["Yes", "No", "Yes, I am", "No, I am not"];
        const matched = matchBooleanToOption(current, options);
        if (matched) {
            return {
                value: matched,
                displayValue: matched,
                canFill: true,
            };
        }

        // Fallback for UI display if matching failed
        return {
            value: current,
            displayValue: current ? "Yes" : "No",
            canFill: true, // Allow attempt with normalized Yes/No
        };
    }

    // Handle enums (need to match to form options)
    if (typeof current === "string") {
        // Determine enum type from canonical key
        const enumType = getEnumType(canonicalKey);

        // If we have options, try to match
        if (availableOptions && availableOptions.length > 0 && enumType) {
            const matched = matchEnumToOption(current, availableOptions, enumType);
            if (matched) {
                return {
                    value: matched,
                    displayValue: matched,
                    canFill: true,
                };
            } else {
                // If matching failed, still return the original value for "blind" filling
                // The fieldFiller might be able to find it via fuzzy search or UI interaction
                console.log(`[Resolver] ⚠️ Option matching failed for "${current}". Returning raw value.`);
                return {
                    value: current,
                    displayValue: current,
                    canFill: true, // changed from false to true to allow blind attempt
                    reason: `Blind fill: Could not match "${current}" to known options`,
                };
            }
        } else if (enumType) {
            // If no options were scanned (e.g. lazy loaded), return raw value for runtime search
            console.log(`[Resolver] ⚠️ Empty options provided for "${current}". Returning raw value for runtime search.`);
            return {
                value: current,
                displayValue: current,
                canFill: true,
                reason: "Runtime search: No options scanned upfront",
            };
        }
    }

    // Direct value
    return {
        value: current,
        displayValue: current.toString(),
        canFill: true,
    };
}

/**
 * Determine enum type from canonical key
 */
function getEnumType(
    canonicalKey: string
):
    | "gender"
    | "race"
    | "yesNoDecline"
    | "sexualOrientation"
    | "employmentType"
    | "citizenship"
    | null {
    if (canonicalKey === "eeo.gender") return "gender";
    if (canonicalKey === "eeo.race") return "race";
    if (canonicalKey === "eeo.sexualOrientation") return "sexualOrientation";
    if (
        canonicalKey === "eeo.hispanic" ||
        canonicalKey === "eeo.veteran" ||
        canonicalKey === "eeo.disability" ||
        canonicalKey === "eeo.lgbtq"
    ) {
        return "yesNoDecline";
    }
    if (canonicalKey === "preferences.employmentTypes") return "employmentType";
    if (canonicalKey === "workAuthorization.citizenshipStatus") return "citizenship";
    if (canonicalKey.startsWith("application.")) return "yesNoDecline";
    if (canonicalKey === "workAuthorization.driverLicense") return "yesNoDecline";

    return null;
}

/**
 * Get value from education array (most recent by default)
 */
export function getEducationValue(
    profile: CanonicalProfile,
    field: "school" | "degree" | "major" | "gpa",
    index: number = 0
): string | null {
    if (!profile.education || profile.education.length === 0) {
        return null;
    }

    const edu = profile.education[index];
    return edu ? edu[field] || null : null;
}

/**
 * Get value from experience array (most recent by default)
 */
export function getExperienceValue(
    profile: CanonicalProfile,
    field: "company" | "title" | "location",
    index: number = 0
): string | null {
    if (!profile.experience || profile.experience.length === 0) {
        return null;
    }

    const exp = profile.experience[index];
    return exp ? exp[field] || null : null;
}
