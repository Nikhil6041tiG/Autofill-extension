/**
 * Pattern Storage Service
 * Manages learned patterns with hybrid local/global storage
 */

export interface LearnedPattern {
    id: string;
    questionPattern: string;
    intent: string;
    canonicalKey: string;
    answerMappings?: AnswerMapping[];
    fieldType: string;
    confidence: number;
    usageCount: number;
    lastUsed: string;
    createdAt: string;
    source: 'AI' | 'manual';
    synced?: boolean;
}

export interface AnswerMapping {
    canonicalValue: string;
    variants: string[];
    contextOptions?: string[];
}

const API_BASE_URL = 'http://localhost:3001/api/patterns';

// Shareable intents (must match backend)
const SHAREABLE_INTENTS = [
    'eeo.gender', 'eeo.hispanic', 'eeo.veteran', 'eeo.disability', 'eeo.race', 'eeo.lgbtq',
    'workAuth.sponsorship', 'workAuth.usAuthorized', 'workAuth.driverLicense', 'workAuth.visaType',
    'location.country', 'location.state',
    'application.hasRelatives', 'application.previouslyApplied', 'application.ageVerification',
    'application.willingToRelocate', 'application.willingToTravel', 'application.workArrangement',
    // Pattern-only (no answer sharing)
    'personal.firstName', 'personal.lastName', 'personal.email', 'personal.phone', 'personal.city',
    'education.degree', 'education.school', 'education.major',
    'experience.company', 'experience.title'
];

export class PatternStorage {

    /**
     * Get all local patterns
     */
    async getLocalPatterns(): Promise<LearnedPattern[]> {
        try {
            const result = await chrome.storage.local.get('learnedPatterns');
            return result.learnedPatterns || [];
        } catch (error) {
            console.error('[PatternStorage] Error getting local patterns:', error);
            return [];
        }
    }

    /**
     * Save patterns locally
     */
    async saveLocalPatterns(patterns: LearnedPattern[]): Promise<void> {
        try {
            await chrome.storage.local.set({ learnedPatterns: patterns });
        } catch (error) {
            console.error('[PatternStorage] Error saving local patterns:', error);
        }
    }

    /**
     * Add a new pattern
     */
    async addPattern(pattern: Omit<LearnedPattern, 'id' | 'createdAt' | 'usageCount' | 'lastUsed'>): Promise<void> {
        const patterns = await this.getLocalPatterns();

        // Check if pattern already exists
        const existing = patterns.find(p =>
            p.intent === pattern.intent &&
            p.questionPattern.toLowerCase() === pattern.questionPattern.toLowerCase()
        );

        if (existing) {
            // Merge answer mappings
            if (pattern.answerMappings && existing.answerMappings) {
                pattern.answerMappings.forEach(newMapping => {
                    const existingMapping = existing.answerMappings!.find(
                        m => m.canonicalValue === newMapping.canonicalValue
                    );
                    if (existingMapping) {
                        newMapping.variants.forEach(v => {
                            if (!existingMapping.variants.includes(v)) {
                                existingMapping.variants.push(v);
                            }
                        });
                    } else {
                        existing.answerMappings!.push(newMapping);
                    }
                });
            }
            existing.lastUsed = new Date().toISOString();
            existing.synced = false; // Mark for re-sync
        } else {
            // Add new pattern
            const newPattern: LearnedPattern = {
                ...pattern,
                id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                usageCount: 0,
                createdAt: new Date().toISOString(),
                lastUsed: new Date().toISOString(),
                synced: false
            };
            patterns.push(newPattern);
            console.log(`[PatternStorage] 🎓 Learned new pattern: "${pattern.questionPattern}" → ${pattern.intent}`);
        }

        await this.saveLocalPatterns(patterns);

        // Note: Pattern sharing removed - all patterns stored locally only
        // This ensures 100% reliability without network dependency
    }

    async findPattern(questionText: string): Promise<LearnedPattern | null> {
        // Search local patterns only (no network calls)
        const localPatterns = await this.getLocalPatterns();
        const localMatch = this.searchPatterns(localPatterns, questionText);

        if (localMatch) {
            console.log(`[PatternStorage] 🎓 Found local pattern for "${questionText}"`);
            await this.incrementUsage(localMatch.id);
            return localMatch;
        }

        return null;
    }

    /**
     * Search patterns locally
     */
    private searchPatterns(patterns: LearnedPattern[], questionText: string): LearnedPattern | null {
        const qLower = questionText.toLowerCase();

        for (const pattern of patterns) {
            // Exact match
            if (pattern.questionPattern.toLowerCase() === qLower) {
                return pattern;
            }

            // Fuzzy match - 70% word overlap
            if (this.calculateSimilarity(qLower, pattern.questionPattern.toLowerCase()) >= 0.7) {
                return pattern;
            }
        }

        return null;
    }

    /**
     * Calculate similarity between two strings
     */
    private calculateSimilarity(str1: string, str2: string): number {
        const words1 = str1.split(/\s+/);
        const words2 = str2.split(/\s+/);

        const matchedWords = words1.filter(w => words2.includes(w)).length;
        return matchedWords / Math.max(words1.length, words2.length);
    }

    /**
     * Cache a pattern locally
     */
    private async cachePattern(pattern: LearnedPattern): Promise<void> {
        const patterns = await this.getLocalPatterns();

        // Check if already cached
        if (patterns.some(p => p.id === pattern.id)) {
            return;
        }

        patterns.push({ ...pattern, synced: true });
        await this.saveLocalPatterns(patterns);
    }

    /**
     * Increment usage count
     */
    async incrementUsage(patternId: string): Promise<void> {
        const patterns = await this.getLocalPatterns();
        const pattern = patterns.find(p => p.id === patternId);

        if (pattern) {
            pattern.usageCount++;
            pattern.lastUsed = new Date().toISOString();
            await this.saveLocalPatterns(patterns);
        }
    }





    /**
     * Get storage statistics
     */
    async getStats(): Promise<any> {
        const patterns = await this.getLocalPatterns();

        const intentBreakdown: any = {};
        patterns.forEach(p => {
            intentBreakdown[p.intent] = (intentBreakdown[p.intent] || 0) + 1;
        });

        return {
            totalPatterns: patterns.length,
            syncedPatterns: patterns.filter(p => p.synced).length,
            unsyncedPatterns: patterns.filter(p => !p.synced).length,
            totalUsage: patterns.reduce((sum, p) => sum + p.usageCount, 0),
            intentBreakdown
        };
    }
}

// Singleton instance
export const patternStorage = new PatternStorage();
