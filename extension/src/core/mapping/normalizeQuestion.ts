/**
 * Normalize question text for intent matching
 * - Lowercase
 * - Trim whitespace
 * - Remove extra spaces
 * - Remove punctuation (except hyphens in words)
 */
export function normalizeQuestion(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ") // Collapse multiple spaces
        .replace(/[^\w\s-]/g, "") // Remove punctuation except hyphens
        .replace(/\s-\s/g, " "); // Remove standalone hyphens
}

/**
 * Remove common stopwords (optional, can improve matching)
 */
const STOPWORDS = new Set([
    "a",
    "an",
    "the",
    "of",
    "to",
    "in",
    "for",
    "on",
    "with",
    "is",
    "are",
    "was",
    "were",
    "your",
    "you",
    "please",
    "enter",
    "select",
    "provide",
]);

export function removeStopwords(text: string): string {
    return text
        .split(" ")
        .filter((word) => !STOPWORDS.has(word))
        .join(" ");
}
