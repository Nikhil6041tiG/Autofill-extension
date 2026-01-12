/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/core/storage/profileStorage.ts"
/*!********************************************!*\
  !*** ./src/core/storage/profileStorage.ts ***!
  \********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   clearProfile: () => (/* binding */ clearProfile),
/* harmony export */   exportProfile: () => (/* binding */ exportProfile),
/* harmony export */   hasCompleteProfile: () => (/* binding */ hasCompleteProfile),
/* harmony export */   importProfile: () => (/* binding */ importProfile),
/* harmony export */   loadProfile: () => (/* binding */ loadProfile),
/* harmony export */   saveProfile: () => (/* binding */ saveProfile),
/* harmony export */   updateProfileField: () => (/* binding */ updateProfileField)
/* harmony export */ });
const STORAGE_KEY = "autofill_canonical_profile";
const VERSION_KEY = "autofill_profile_version";
const CURRENT_VERSION = "1.0.0";
/**
 * Save canonical profile to chrome.storage.local
 */
async function saveProfile(profile) {
    try {
        await chrome.storage.local.set({
            [STORAGE_KEY]: profile,
            [VERSION_KEY]: CURRENT_VERSION,
        });
    }
    catch (error) {
        console.error("Failed to save profile:", error);
        throw new Error("Could not save profile to storage");
    }
}
/**
 * Load canonical profile from chrome.storage.local
 */
async function loadProfile() {
    try {
        const result = await chrome.storage.local.get([STORAGE_KEY, VERSION_KEY]);
        if (!result[STORAGE_KEY]) {
            return null;
        }
        // Version migration logic can go here in future
        const storedVersion = result[VERSION_KEY] || "1.0.0";
        return result[STORAGE_KEY];
    }
    catch (error) {
        console.error("Failed to load profile:", error);
        return null;
    }
}
/**
 * Check if profile exists and is complete
 */
async function hasCompleteProfile() {
    const profile = await loadProfile();
    if (!profile)
        return false;
    // Check required fields
    return !!(profile.personal.firstName &&
        profile.personal.lastName &&
        profile.personal.email &&
        profile.consent.agreedToAutofill);
}
/**
 * Clear profile (for testing or reset)
 */
async function clearProfile() {
    await chrome.storage.local.remove([STORAGE_KEY, VERSION_KEY]);
}
/**
 * Export profile as JSON string
 */
async function exportProfile() {
    const profile = await loadProfile();
    if (!profile) {
        throw new Error("No profile to export");
    }
    return JSON.stringify(profile, null, 2);
}
/**
 * Import profile from JSON string
 */
async function importProfile(jsonString) {
    try {
        const profile = JSON.parse(jsonString);
        // Basic validation
        if (!profile.personal || !profile.eeo || !profile.workAuthorization) {
            throw new Error("Invalid profile structure");
        }
        await saveProfile(profile);
    }
    catch (error) {
        console.error("Failed to import profile:", error);
        throw new Error("Invalid profile JSON");
    }
}
/**
 * Update specific profile field
 */
async function updateProfileField(path, value) {
    const profile = await loadProfile();
    if (!profile) {
        throw new Error("No profile exists");
    }
    // Navigate to field and update
    const parts = path.split(".");
    let current = profile;
    for (let i = 0; i < parts.length - 1; i++) {
        current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
    await saveProfile(profile);
}


/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Check if module exists (development only)
/******/ 		if (__webpack_modules__[moduleId] === undefined) {
/******/ 			var e = new Error("Cannot find module '" + moduleId + "'");
/******/ 			e.code = 'MODULE_NOT_FOUND';
/******/ 			throw e;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!*********************************!*\
  !*** ./src/background/index.ts ***!
  \*********************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _core_storage_profileStorage__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../core/storage/profileStorage */ "./src/core/storage/profileStorage.ts");
/**
 * Background service worker for Chrome Extension
 * Handles extension lifecycle, messaging, and profile management
 */

// Install/update handler
chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === "install") {
        console.log("[Autofill] Extension installed");
        // Check if profile exists
        const hasProfile = await (0,_core_storage_profileStorage__WEBPACK_IMPORTED_MODULE_0__.hasCompleteProfile)();
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
        (0,_core_storage_profileStorage__WEBPACK_IMPORTED_MODULE_0__.hasCompleteProfile)().then((exists) => {
            sendResponse({ exists });
        });
        return true; // Async response
    }
    if (message.action === "getProfile") {
        (0,_core_storage_profileStorage__WEBPACK_IMPORTED_MODULE_0__.loadProfile)().then((profile) => {
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
        const aiUrl = "http://localhost:8001" || 0;
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
            }
            catch (e) {
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
async function handleStartAutofill(payload) {
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
    }
    catch (error) {
        console.error("[Background] START_AUTOFILL Error:", error);
        return { success: false, error: error.message };
    }
}
/**
 * Handle field fill failures - optionally trigger Selenium fallback for specific field
 */
async function handleFieldFillFailed(payload) {
    try {
        console.log('[Background] Field fill failed:', payload);
        // Optional: Call Selenium fallback for this specific field
        // For now, just log it
        // Future: POST /fallback-fill with field details
        return { success: true, noted: true };
    }
    catch (error) {
        console.error("[Background] FIELD_FILL_FAILED Error:", error);
        return { success: false, error: error.message };
    }
}
/**
 * Handle AI prediction requests by calling the Selenium Runner's /predict endpoint
 */
async function handleAIRequest(payload) {
    try {
        const aiUrl = "http://localhost:8001" || 0;
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
    }
    catch (error) {
        console.error("[Background] AI Request Error:", error);
        return { success: false, error: error.message };
    }
}
/**
 * Cache for scan results to prevent repeated scans
 */
const scanCache = new Map();
const SCAN_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
/**
 * Handle scan application requests by calling Selenium scanner
 */
async function handleScanApplication(url) {
    try {
        // Check cache first (Issue #4: prevent repeated scans)
        const cached = scanCache.get(url);
        if (cached && (Date.now() - cached.timestamp) < SCAN_CACHE_DURATION) {
            console.log('[Background] ⚡ Using cached scan results for:', url);
            return { success: true, data: cached.data };
        }
        console.log('[Background] Triggering Selenium scan for:', url);
        const aiUrl = "http://localhost:8001" || 0;
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
    }
    catch (error) {
        console.error("[Background] Scan Error:", error);
        return { success: false, error: error.message };
    }
}
/**
 * Handle answer mapping by delegating to content script
 */
async function handleMapAnswers(questions) {
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
    }
    catch (error) {
        console.error("[Background] Mapping Error:", error);
        return { success: false, error: error.message };
    }
}
/**
 * CDP Trusted Click Implementation
 */
async function handleTrustedClick(tabId, x, y) {
    if (!tabId)
        return { success: false, error: "No tab ID" };
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
    }
    catch (e) {
        console.error("[Debugger] Click failed", e);
        try {
            await chrome.debugger.detach(target);
        }
        catch { }
        return { success: false, error: e.message };
    }
}
/**
 * CDP Trusted Type Implementation
 */
async function handleTrustedType(tabId, text) {
    if (!tabId)
        return { success: false, error: "No tab ID" };
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
    }
    catch (e) {
        console.error("[Debugger] Type failed", e);
        try {
            await chrome.debugger.detach(target);
        }
        catch { }
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
            }
            catch (error) {
                // Content script might not be ready yet, ignore
            }
        }
    }
});
/**
 * Detect if URL is likely a job application site
 * Can be expanded with more patterns
 */
async function isJobApplicationSite(url) {
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

})();

/******/ })()
;