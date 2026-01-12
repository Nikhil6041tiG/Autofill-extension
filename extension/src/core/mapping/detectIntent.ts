import { INTENT_PATTERNS, CanonicalIntent } from "./intentDictionary";
import { normalizeQuestion } from "./normalizeQuestion";
import { MappingResult } from "../../types/mappingResult";

const CONFIDENCE_THRESHOLD = 0.8;

/**
 * Detect canonical intent from question text using rule-based pattern matching
 * Returns intent with confidence score
 */
export function detectIntent(questionText: string): MappingResult {
    const normalized = normalizeQuestion(questionText);
    const evidence: string[] = [];

    // Try exact pattern matching
    for (const entry of INTENT_PATTERNS) {
        for (const pattern of entry.patterns) {
            if (pattern.test(normalized)) {
                evidence.push(`Matched pattern: ${pattern.source}`);

                return {
                    canonicalKey: entry.intent,
                    confidence: 0.95, // High confidence for direct pattern match
                    evidence,
                    method: "rule_based",
                };
            }
        }
    }

    // Try partial matching (contains keywords)
    for (const entry of INTENT_PATTERNS) {
        for (const pattern of entry.patterns) {
            // Extract keywords from pattern
            const patternStr = pattern.source.toLowerCase();
            const keywords = patternStr
                .replace(/[^a-z\s]/g, "")
                .split(/\s+/)
                .filter((w) => w.length > 2);

            const matchCount = keywords.filter((keyword) =>
                normalized.includes(keyword)
            ).length;

            if (matchCount > 0) {
                const confidence = Math.min(0.7, (matchCount / keywords.length) * 0.9);

                if (confidence >= 0.5) {
                    evidence.push(
                        `Partial match: ${matchCount}/${keywords.length} keywords`
                    );

                    return {
                        canonicalKey: entry.intent,
                        confidence,
                        evidence,
                        method: "rule_based",
                    };
                }
            }
        }
    }

    // No match found
    return {
        confidence: 0,
        evidence: ["No matching pattern found"],
        method: "unknown",
    };
}

/**
 * Check if an intent is a protected EEO/sensitive field
 */
export function isProtectedField(canonicalKey?: string): boolean {
    if (!canonicalKey) return false;

    const entry = INTENT_PATTERNS.find((e) => e.intent === canonicalKey);
    return entry?.isProtected === true;
}

/**
 * Determine if confidence is high enough to autofill
 */
export function shouldAutofill(mappingResult: MappingResult): boolean {
    return mappingResult.confidence >= CONFIDENCE_THRESHOLD;
}
