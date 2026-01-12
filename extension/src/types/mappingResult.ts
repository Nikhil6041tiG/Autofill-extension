export interface MappingResult {
    canonicalKey?: string;
    confidence: number;
    evidence: string[];
    method: "rule_based" | "semantic" | "ai_fallback" | "unknown";
}

export interface IntentMatch {
    intent: string;
    confidence: number;
    pattern?: string;
}
