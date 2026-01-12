/**
 * Background service worker for Chrome Extension
 * Handles extension lifecycle, messaging, and profile management
 */

import { loadProfile, hasCompleteProfile } from "../core/storage/profileStorage";

// Install/update handler
chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === "install") {
        console.log("[Autofill] Extension installed");

        // Check if profile exists
        const hasProfile = await hasCompleteProfile();

        if (!hasProfile) {
            // Open onboarding page
            chrome.tabs.create({
                url: chrome.runtime.getURL("onboarding.html"),
            });
        }
    }

    if (details.reason === "update") {
        console.log("[Autofill] Extension updated");
    }
});

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
    // Open settings/options page
    chrome.runtime.openOptionsPage();
});

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "checkProfile") {
        hasCompleteProfile().then((exists) => {
            sendResponse({ exists });
        });
        return true; // Async response
    }

    if (message.action === "getProfile") {
        loadProfile().then((profile) => {
            sendResponse({ profile });
        });
        return true;
    }

    if (message.action === "openOnboarding") {
        chrome.tabs.create({
            url: chrome.runtime.getURL("onboarding.html"),
        });
        sendResponse({ success: true });
        return false;
    }

    if (message.action === "trustedClick") {
        handleTrustedClick(sender.tab?.id, message.x, message.y).then(sendResponse);
        return true;
    }

    if (message.action === "trustedType") {
        handleTrustedType(sender.tab?.id, message.text).then(sendResponse);
        return true;
    }

    if (message.action === "runSelenium") {
        const aiUrl = process.env.REACT_APP_AI_URL || 'http://localhost:8001';
        fetch(`${aiUrl}/run`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(message.plan)
        })
            .then(async (res) => {
                const text = await res.text();
                console.log('[Background] Selenium response status:', res.status);
                console.log('[Background] Selenium response body:', text);

                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}: ${text.substring(0, 200)}`);
                }


                try {
                    const data = JSON.parse(text);
                    sendResponse({ success: true, data });
                } catch (e) {
                    throw new Error(`Invalid JSON response: ${text.substring(0, 200)}`);
                }
            })
            .catch(err => {
                console.error('[Background] Selenium error:', err);
                sendResponse({ success: false, error: err.message });
            });
        return true;
    }

    if (message.action === "askAI") {
        handleAIRequest(message.payload).then(sendResponse);
        return true;
    }

    if (message.action === "scanApplication") {
        handleScanApplication(message.url).then(sendResponse);
        return true;
    }

    if (message.action === "mapAnswers") {
        handleMapAnswers(message.questions).then(sendResponse);
        return true;
    }

    // Production scan-and-fill architecture
    if (message.action === "START_AUTOFILL") {
        handleStartAutofill(message.payload).then(sendResponse);
        return true;
    }

    if (message.action === "FIELD_FILL_FAILED") {
        handleFieldFillFailed(message.payload).then(sendResponse);
        return true;
    }

    return false;
});

/**
 * Forward resolved answers to active tab content script for filling
 */
async function handleStartAutofill(payload: any) {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]?.id) {
            throw new Error('No active tab found');
        }

        console.log('[Background] Forwarding START_AUTOFILL to tab', tabs[0].id);

        const response = await chrome.tabs.sendMessage(tabs[0].id, {
            type: 'START_AUTOFILL',
            payload
        });

        return { success: true, data: response };
    } catch (error: any) {
        console.error("[Background] START_AUTOFILL Error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Handle field fill failures - optionally trigger Selenium fallback for specific field
 */
async function handleFieldFillFailed(payload: any) {
    try {
        console.log('[Background] Field fill failed:', payload);

        // Optional: Call Selenium fallback for this specific field
        // For now, just log it
        // Future: POST /fallback-fill with field details

        return { success: true, noted: true };
    } catch (error: any) {
        console.error("[Background] FIELD_FILL_FAILED Error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Handle AI prediction requests by calling the Selenium Runner's /predict endpoint
 */
async function handleAIRequest(payload: any) {
    try {
        const aiUrl = process.env.REACT_APP_AI_URL || 'http://localhost:8001';
        const response = await fetch(`${aiUrl}/predict`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`AI prediction failed (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        return { success: true, data };
    } catch (error: any) {
        console.error("[Background] AI Request Error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Cache for scan results to prevent repeated scans
 */
const scanCache = new Map<string, { data: any; timestamp: number }>();
const SCAN_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Handle scan application requests by calling Selenium scanner
 */
async function handleScanApplication(url: string) {
    try {
        // Check cache first (Issue #4: prevent repeated scans)
        const cached = scanCache.get(url);
        if (cached && (Date.now() - cached.timestamp) < SCAN_CACHE_DURATION) {
            console.log('[Background] ⚡ Using cached scan results for:', url);
            return { success: true, data: cached.data };
        }

        console.log('[Background] Triggering Selenium scan for:', url);

        const aiUrl = process.env.REACT_APP_AI_URL || 'http://localhost:8001';
        const response = await fetch(`${aiUrl}/api/selenium/scan`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Scan failed (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        console.log('[Background] Scan complete:', data);

        // Cache the scan result
        scanCache.set(url, { data: data.data, timestamp: Date.now() });
        console.log('[Background] ✅ Scan cached for 5 minutes');

        return { success: true, data: data.data };
    } catch (error: any) {
        console.error("[Background] Scan Error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Handle answer mapping by delegating to content script
 */
async function handleMapAnswers(questions: any[]) {
    try {
        console.log('[Background] Processing', questions.length, 'questions through mapper');

        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]?.id) {
            throw new Error('No active tab found');
        }

        const response = await chrome.tabs.sendMessage(tabs[0].id, {
            action: 'processQuestions',
            questions
        });

        return response;
    } catch (error: any) {
        console.error("[Background] Mapping Error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * CDP Trusted Click Implementation
 */
async function handleTrustedClick(tabId: number | undefined, x: number, y: number) {
    if (!tabId) return { success: false, error: "No tab ID" };
    const target = { tabId };

    try {
        await chrome.debugger.attach(target, "1.3");

        // Mouse Press
        await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
            type: "mousePressed",
            x, y,
            button: "left",
            clickCount: 1
        });

        // Mouse Release
        await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
            type: "mouseReleased",
            x, y,
            button: "left",
            clickCount: 1
        });

        await chrome.debugger.detach(target);
        return { success: true };
    } catch (e: any) {
        console.error("[Debugger] Click failed", e);
        try { await chrome.debugger.detach(target); } catch { }
        return { success: false, error: e.message };
    }
}

/**
 * CDP Trusted Type Implementation
 */
async function handleTrustedType(tabId: number | undefined, text: string) {
    if (!tabId) return { success: false, error: "No tab ID" };
    const target = { tabId };

    try {
        await chrome.debugger.attach(target, "1.3");

        for (const char of text) {
            await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", {
                type: "keyDown",
                text: char,
            });
            await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", {
                type: "keyUp",
                text: char,
            });
        }

        await chrome.debugger.detach(target);
        return { success: true };
    } catch (e: any) {
        console.error("[Debugger] Type failed", e);
        try { await chrome.debugger.detach(target); } catch { }
        return { success: false, error: e.message };
    }
}

// Listen for tab updates to inject content script if needed
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.url) {
        // Check if this is a job application site
        const isJobSite = await isJobApplicationSite(tab.url);

        if (isJobSite) {
            // Content script is already injected via manifest
            // but we can send a message to trigger rescan
            try {
                await chrome.tabs.sendMessage(tabId, { action: "rescan" });
            } catch (error) {
                // Content script might not be ready yet, ignore
            }
        }
    }
});

/**
 * Detect if URL is likely a job application site
 * Can be expanded with more patterns
 */
async function isJobApplicationSite(url: string): Promise<boolean> {
    const jobSitePatterns = [
        /workday\.com/i,
        /greenhouse\.io/i,
        /lever\.co/i,
        /icims\.com/i,
        /smartrecruiters\.com/i,
        /jobvite\.com/i,
        /taleo\.net/i,
        /apply/i, // Generic "apply" in URL
        /careers/i,
        /jobs/i,
    ];

    return jobSitePatterns.some((pattern) => pattern.test(url));
}

console.log("[Autofill] Background service worker loaded");
