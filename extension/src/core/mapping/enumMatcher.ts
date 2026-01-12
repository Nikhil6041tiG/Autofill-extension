import {
    Gender,
    Race,
    YesNoDecline,
    SexualOrientation,
    EmploymentType,
} from "../../types/canonicalEnums";

/**
 * String similarity using Levenshtein distance (normalized 0-1)
 */
function stringSimilarity(a: string, b: string): number {
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;

    if (longer.length === 0) return 1.0;

    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

/**
 * Normalize option text for comparison
 */
function normalizeOption(text: string): string {
    return text.toLowerCase().trim().replace(/[^\w\s]/g, "");
}

/**
 * Match canonical enum value to form option label
 */
export function matchEnumToOption(
    canonicalValue: string,
    availableOptions: string[],
    enumType:
        | "gender"
        | "race"
        | "yesNoDecline"
        | "sexualOrientation"
        | "employmentType"
        | "citizenship"
): string | null {
    // Map canonical values to possible label variants
    const labelVariants = getEnumLabelVariants(canonicalValue, enumType);

    // Try exact match first
    for (const variant of labelVariants) {
        const normalized = normalizeOption(variant);
        for (const option of availableOptions) {
            if (normalizeOption(option) === normalized) {
                return option;
            }
        }
    }

    // Try similarity matching
    let bestMatch: string | null = null;
    let bestScore = 0.7; // Minimum similarity threshold

    for (const variant of labelVariants) {
        for (const option of availableOptions) {
            const score = stringSimilarity(
                normalizeOption(variant),
                normalizeOption(option)
            );
            if (score > bestScore) {
                bestScore = score;
                bestMatch = option;
            }
        }
    }

    return bestMatch;
}

function getEnumLabelVariants(
    value: string,
    enumType: string
): string[] {
    // Normalize the input value to a lookup key (e.g., "Male" -> "male", "Decline to state" -> "decline")
    let lookupKey = value.toLowerCase().trim();
    if (lookupKey.includes("decline")) lookupKey = "decline";
    if (lookupKey === "american indian or alaska native") lookupKey = "american_indian";
    if (lookupKey === "native hawaiian or other pacific islander") lookupKey = "pacific_islander";
    if (lookupKey === "black or african american") lookupKey = "black";
    if (lookupKey === "hispanic or latino") lookupKey = "hispanic";
    if (lookupKey === "two or more races") lookupKey = "two_or_more";
    if (lookupKey === "non-binary") lookupKey = "non_binary";

    const variants: Record<string, string[]> = {
        // Gender
        male: ["Male", "M", "Man", "Identify as male"],
        female: ["Female", "F", "Woman", "Identify as female"],
        non_binary: ["Non-Binary", "Non Binary", "Nonbinary", "Other", "Gender Diverse"],

        // Yes/No/Decline
        yes: ["Yes", "Y", "Yes, I am", "I am", "True"],
        no: ["No", "N", "No, I am not", "I am not", "False"],
        decline: [
            "Decline to Answer",
            "Decline to State",
            "Prefer not to say",
            "Prefer not to answer",
            "I do not wish to answer",
            "Decline to self-identify",
            "I prefer not to self-identify",
            "I do not wish to provide this information"
        ],

        // Race
        american_indian: [
            "American Indian or Alaska Native",
            "Native American",
            "American Indian",
            "Alaska Native",
        ],
        asian: ["Asian", "Asian American", "Chinese", "Japanese", "Korean", "Indian"],
        black: [
            "Black or African American",
            "Black",
            "African American",
            "African-American",
        ],
        hispanic: ["Hispanic or Latino", "Hispanic", "Latino", "Latina", "Latinx", "Spanish"],
        white: ["White", "Caucasian", "White (Not Hispanic or Latino)"],
        pacific_islander: [
            "Native Hawaiian or Pacific Islander",
            "Pacific Islander",
            "Native Hawaiian",
            "Other Pacific Islander",
        ],
        two_or_more: ["Two or More Races", "Two or more", "Multiracial", "More than one race"],

        // Sexual Orientation
        asexual: ["Asexual", "Ace"],
        bisexual: ["Bisexual", "Bi"],
        gay: ["Gay"],
        heterosexual: ["Heterosexual", "Straight"],
        lesbian: ["Lesbian"],
        pansexual: ["Pansexual", "Pan"],
        queer: ["Queer"],
        self_describe: ["Self-describe", "Other", "Prefer to self-describe"],

        // Employment Type
        full_time: ["Full-time", "Full Time", "FT", "Permanent", "Regular"],
        part_time: ["Part-time", "Part Time", "PT"],
        contract: ["Contract", "Contractor", "Temporary", "Temp"],
        intern: ["Intern", "Internship", "Trainee"],

        // Citizenship
        citizen: ["A United States citizen or national", "United States Citizen", "Citizen", "US Citizen"],
        permanent_resident: ["A person lawfully admitted for permanent residence", "Green Card holder", "Permanent Resident"],
        refugee: ["A person admitted as a refugee"],
        asylee: ["A person admitted as an asylee"],
        other_visa: ["Other", "Non-citizen", "None of the above", "No, I am not authorized"],
    };

    // Add specific Greenhouse variants for Disability and Veteran status
    if (lookupKey === "yes" && enumType === "yesNoDecline") {
        return [...variants.yes, "Yes, I possess a disability", "I have a disability", "I am a protected veteran"];
    }
    if (lookupKey === "no" && enumType === "yesNoDecline") {
        return [...variants.no, "No, I do not possess a disability", "I don't have a disability", "I am not a protected veteran"];
    }

    return variants[lookupKey] || [value];
}

/**
 * Match boolean to Yes/No options
 */
export function matchBooleanToOption(
    value: boolean,
    availableOptions: string[]
): string | null {
    const targetValue = value ? "yes" : "no";
    return matchEnumToOption(targetValue, availableOptions, "yesNoDecline");
}
