/**
 * Platform Detection Utility
 * Detects job application platforms based on URL patterns
 */

export enum JobPlatform {
    GREENHOUSE = "greenhouse",
    WORKDAY = "workday",
    ICIMS = "icims",
    LEVER = "lever",
    GENERIC = "generic"
}

/**
 * Detect the current job application platform based on URL
 */
export function detectPlatform(): JobPlatform {
    const url = window.location.href.toLowerCase();
    const hostname = window.location.hostname.toLowerCase();

    // Greenhouse detection
    if (hostname.includes("greenhouse.io") || url.includes("greenhouse")) {
        return JobPlatform.GREENHOUSE;
    }

    // Workday detection
    if (hostname.includes("myworkdayjobs.com") || url.includes("workday")) {
        return JobPlatform.WORKDAY;
    }

    // iCIMS detection
    if (hostname.includes("icims.com") || url.includes("icims")) {
        return JobPlatform.ICIMS;
    }

    // Lever detection
    if (hostname.includes("lever.co") || url.includes("lever")) {
        return JobPlatform.LEVER;
    }

    return JobPlatform.GENERIC;
}

/**
 * Check if current page is Greenhouse
 */
export function isGreenhousePage(): boolean {
    return detectPlatform() === JobPlatform.GREENHOUSE;
}

/**
 * Check if current page is Workday
 */
export function isWorkdayPage(): boolean {
    return detectPlatform() === JobPlatform.WORKDAY;
}

/**
 * Check if current page is iCIMS
 */
export function isICIMSPage(): boolean {
    return detectPlatform() === JobPlatform.ICIMS;
}

/**
 * Check if current page is Lever
 */
export function isLeverPage(): boolean {
    return detectPlatform() === JobPlatform.LEVER;
}

/**
 * Get platform-specific selector patterns
 */
export function getPlatformSelectors(): {
    combobox: string[];
    dropdown: string[];
    radioGroup: string[];
} {
    const platform = detectPlatform();

    switch (platform) {
        case JobPlatform.GREENHOUSE:
            return {
                combobox: [
                    'input[role="combobox"].select__input',
                    '.select__control input',
                    '[class*="select__input"]'
                ],
                dropdown: [
                    '.select__control',
                    '[class*="select__control"]'
                ],
                radioGroup: [
                    'input[type="radio"]',
                    '[role="radiogroup"]'
                ]
            };

        case JobPlatform.WORKDAY:
            return {
                combobox: [
                    '[role="combobox"]',
                    '[data-automation-id*="dropdown"]',
                    'input[aria-autocomplete="list"]'
                ],
                dropdown: [
                    '[role="listbox"]',
                    '[data-automation-id*="menu"]'
                ],
                radioGroup: [
                    '[role="radiogroup"]',
                    'input[type="radio"]'
                ]
            };

        case JobPlatform.ICIMS:
            return {
                combobox: [
                    '[role="combobox"]',
                    'select',
                    'input[list]'
                ],
                dropdown: [
                    '[role="listbox"]',
                    'datalist'
                ],
                radioGroup: [
                    'input[type="radio"]',
                    '[role="radiogroup"]'
                ]
            };

        default:
            return {
                combobox: [
                    '[role="combobox"]',
                    '[role="listbox"]'
                ],
                dropdown: [
                    '[role="listbox"]',
                    'select'
                ],
                radioGroup: [
                    'input[type="radio"]',
                    '[role="radiogroup"]'
                ]
            };
    }
}
