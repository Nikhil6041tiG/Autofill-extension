import { DetectedField, QuestionSection } from "../types/fieldDetection";
import { renderOverlayPanel } from "./ui/OverlayPanel";
import { loadProfile } from "../core/storage/profileStorage";
import { QuestionMapper } from "./mapping/questionMapper";
import { initAutofillRunner } from "./autofillRunner";

/**
 * Production content script with scan-and-fill architecture
 * Selenium READ-ONLY scan → Extension fills in current tab
 */

console.log("[Autofill] Content script loaded - Production scan-and-fill mode");

// Initialize autofill runner (listens for START_AUTOFILL messages)
initAutofillRunner();


// Suppress Greenhouse's own 401 errors to prevent console noise
const originalFetch = window.fetch;
window.fetch = function (...args) {
    return originalFetch.apply(this, args).catch(error => {
        // Suppress 401 errors from Greenhouse API
        if (error.message && error.message.includes('401')) {
            console.debug('[Autofill] Suppressed Greenhouse 401 error (not logged in)');
            return Promise.reject(error);
        }
        return Promise.reject(error);
    });
};

// Initialize on page load - just show overlay icon
(async function initialize() {
    try {
        // Check if profile exists
        const profile = await loadProfile();
        if (!profile || !profile.consent.agreedToAutofill) {
            console.log("[Autofill] No profile found or consent not given");
            return;
        }

        console.log("[Autofill] Profile loaded, showing overlay icon");

        // Small delay to ensure DOM is fully ready
        setTimeout(() => {
            try {
                // Render overlay panel with empty fields (icon state)
                // User will trigger scan manually via "Scan Application" button
                const noOpAutoFill = async () => {
                    console.log("[Autofill] No auto-fill in Selenium-only mode");
                };
                const noOpFieldUpdate = (index: number, field: DetectedField) => {
                    console.log("[Autofill] Field update:", index, field);
                };

                renderOverlayPanel([], noOpAutoFill, noOpFieldUpdate);
                console.log("[Autofill] Overlay panel rendered");
            } catch (error) {
                console.error("[Autofill] Error rendering overlay:", error);
            }
        }, 500);
    } catch (error) {
        console.error("[Autofill] Initialization error:", error);
    }
})();

/**
 * Listen for messages from background script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle question mapping for Selenium scan results
    if (message.action === 'processQuestions') {
        try {
            console.log('[Content] Processing', message.questions.length, 'questions through mapper');

            const mapper = new QuestionMapper();
            mapper.processQuestions(message.questions).then(answers => {
                console.log('[Content] Mapping complete:', answers.length, 'answers');
                sendResponse({ success: true, data: answers });
            }).catch(error => {
                console.error('[Content] Mapping error:', error);
                sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
            });
        } catch (error) {
            console.error('[Content] Mapping error:', error);
            sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
        }
        return true; // Async response
    }

    return false;
});

/**
 * Helper function to classify section from canonical key
 */
export function classifySection(canonicalKey?: string): QuestionSection {
    if (!canonicalKey) return QuestionSection.OTHER;

    if (canonicalKey.startsWith("personal.")) return QuestionSection.PERSONAL;
    if (canonicalKey.startsWith("education.")) return QuestionSection.EDUCATION;
    if (canonicalKey.startsWith("experience.")) return QuestionSection.EXPERIENCE;
    if (canonicalKey.startsWith("skills")) return QuestionSection.SKILLS;
    if (canonicalKey.startsWith("workAuthorization."))
        return QuestionSection.WORK_AUTHORIZATION;
    if (canonicalKey.startsWith("eeo.")) return QuestionSection.EEO;
    if (canonicalKey.startsWith("preferences."))
        return QuestionSection.PREFERENCES;

    return QuestionSection.OTHER;
}
