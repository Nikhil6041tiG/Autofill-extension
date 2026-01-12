import { CanonicalProfile, EMPTY_PROFILE } from "../../types/canonicalProfile";

const STORAGE_KEY = "autofill_canonical_profile";
const VERSION_KEY = "autofill_profile_version";
const CURRENT_VERSION = "1.0.0";

/**
 * Save canonical profile to chrome.storage.local
 */
export async function saveProfile(profile: CanonicalProfile): Promise<void> {
    try {
        await chrome.storage.local.set({
            [STORAGE_KEY]: profile,
            [VERSION_KEY]: CURRENT_VERSION,
        });
    } catch (error) {
        console.error("Failed to save profile:", error);
        throw new Error("Could not save profile to storage");
    }
}

/**
 * Load canonical profile from chrome.storage.local
 */
export async function loadProfile(): Promise<CanonicalProfile | null> {
    try {
        const result = await chrome.storage.local.get([STORAGE_KEY, VERSION_KEY]);

        if (!result[STORAGE_KEY]) {
            return null;
        }

        // Version migration logic can go here in future
        const storedVersion = result[VERSION_KEY] || "1.0.0";

        return result[STORAGE_KEY] as CanonicalProfile;
    } catch (error) {
        console.error("Failed to load profile:", error);
        return null;
    }
}

/**
 * Check if profile exists and is complete
 */
export async function hasCompleteProfile(): Promise<boolean> {
    const profile = await loadProfile();

    if (!profile) return false;

    // Check required fields
    return !!(
        profile.personal.firstName &&
        profile.personal.lastName &&
        profile.personal.email &&
        profile.consent.agreedToAutofill
    );
}

/**
 * Clear profile (for testing or reset)
 */
export async function clearProfile(): Promise<void> {
    await chrome.storage.local.remove([STORAGE_KEY, VERSION_KEY]);
}

/**
 * Export profile as JSON string
 */
export async function exportProfile(): Promise<string> {
    const profile = await loadProfile();
    if (!profile) {
        throw new Error("No profile to export");
    }

    return JSON.stringify(profile, null, 2);
}

/**
 * Import profile from JSON string
 */
export async function importProfile(jsonString: string): Promise<void> {
    try {
        const profile = JSON.parse(jsonString) as CanonicalProfile;

        // Basic validation
        if (!profile.personal || !profile.eeo || !profile.workAuthorization) {
            throw new Error("Invalid profile structure");
        }

        await saveProfile(profile);
    } catch (error) {
        console.error("Failed to import profile:", error);
        throw new Error("Invalid profile JSON");
    }
}

/**
 * Update specific profile field
 */
export async function updateProfileField(
    path: string,
    value: any
): Promise<void> {
    const profile = await loadProfile();
    if (!profile) {
        throw new Error("No profile exists");
    }

    // Navigate to field and update
    const parts = path.split(".");
    let current: any = profile;

    for (let i = 0; i < parts.length - 1; i++) {
        current = current[parts[i]];
    }

    current[parts[parts.length - 1]] = value;

    await saveProfile(profile);
}
