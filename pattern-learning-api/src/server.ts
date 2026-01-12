import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';

const app = express();
const PORT = 3001; // Different port from main backend

app.use(cors());
app.use(express.json());

// Storage file path
const PATTERNS_FILE = path.join(__dirname, '../data/patterns.json');
const STATS_FILE = path.join(__dirname, '../data/pattern-stats.json');

// Ensure data directory exists
async function ensureDataDir() {
    const dataDir = path.join(__dirname, '../data');
    try {
        await fs.mkdir(dataDir, { recursive: true });
    } catch (err) {
        console.error('Error creating data directory:', err);
    }
}

// Initialize storage files
async function initializeStorage() {
    await ensureDataDir();

    // Initialize patterns file
    try {
        await fs.access(PATTERNS_FILE);
    } catch {
        await fs.writeFile(PATTERNS_FILE, JSON.stringify({ patterns: [] }));
    }

    // Initialize stats file
    try {
        await fs.access(STATS_FILE);
    } catch {
        await fs.writeFile(STATS_FILE, JSON.stringify({
            totalPatterns: 0,
            aiCallsSaved: 0,
            lastUpdated: new Date().toISOString()
        }));
    }
}

// Shareable intents (privacy-safe)
const SHAREABLE_INTENTS = [
    'eeo.gender',
    'eeo.hispanic',
    'eeo.veteran',
    'eeo.disability',
    'eeo.race',
    'eeo.lgbtq',
    'workAuth.sponsorship',
    'workAuth.usAuthorized',
    'workAuth.driverLicense',
    'workAuth.visaType',
    'location.country',
    'location.state',
    'application.hasRelatives',
    'application.previouslyApplied',
    'application.ageVerification',
    'application.willingToRelocate',
    'application.willingToTravel',
    'application.workArrangement',
    // Pattern-only sharing (no answers)
    'personal.firstName',
    'personal.lastName',
    'personal.email',
    'personal.phone',
    'personal.city',
    'education.degree',
    'education.school',
    'education.major',
    'experience.company',
    'experience.title'
];

function isShareableIntent(intent: string): boolean {
    return SHAREABLE_INTENTS.includes(intent);
}

// Read patterns from file
async function readPatterns(): Promise<any[]> {
    try {
        const data = await fs.readFile(PATTERNS_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        return parsed.patterns || [];
    } catch (err) {
        console.error('Error reading patterns:', err);
        return [];
    }
}

// Write patterns to file
async function writePatterns(patterns: any[]): Promise<void> {
    try {
        await fs.writeFile(PATTERNS_FILE, JSON.stringify({ patterns }, null, 2));
    } catch (err) {
        console.error('Error writing patterns:', err);
    }
}

// Read stats
async function readStats(): Promise<any> {
    try {
        const data = await fs.readFile(STATS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        return {
            totalPatterns: 0,
            aiCallsSaved: 0,
            lastUpdated: new Date().toISOString()
        };
    }
}

// Write stats
async function writeStats(stats: any): Promise<void> {
    try {
        await fs.writeFile(STATS_FILE, JSON.stringify(stats, null, 2));
    } catch (err) {
        console.error('Error writing stats:', err);
    }
}

/**
 * POST /api/patterns/upload
 * Upload a new learned pattern
 */
app.post('/api/patterns/upload', async (req: Request, res: Response) => {
    try {
        const pattern = req.body;

        // Validate intent is shareable
        if (!isShareableIntent(pattern.intent)) {
            return res.status(403).json({
                success: false,
                error: 'This intent is not shareable for privacy reasons'
            });
        }

        console.log(`\n🎓 [Pattern Learning] Received new pattern:`);
        console.log(`   Question: "${pattern.questionPattern}"`);
        console.log(`   Intent:   ${pattern.intent}`);
        console.log(`   Answer:   "${pattern.answerMappings?.[0]?.canonicalValue || 'N/A'}"`);


        const patterns = await readPatterns();

        // Check if pattern already exists
        const existingIndex = patterns.findIndex((p: any) =>
            p.intent === pattern.intent &&
            p.questionPattern.toLowerCase() === pattern.questionPattern.toLowerCase()
        );

        if (existingIndex >= 0) {
            // Merge answer mappings
            const existing = patterns[existingIndex];
            if (pattern.answerMappings && existing.answerMappings) {
                // Merge variants for each canonical value
                pattern.answerMappings.forEach((newMapping: any) => {
                    const existingMapping = existing.answerMappings.find(
                        (m: any) => m.canonicalValue === newMapping.canonicalValue
                    );
                    if (existingMapping) {
                        // Add new variants
                        newMapping.variants.forEach((v: string) => {
                            if (!existingMapping.variants.includes(v)) {
                                existingMapping.variants.push(v);
                            }
                        });
                    } else {
                        existing.answerMappings.push(newMapping);
                    }
                });
            }
            existing.usageCount++;
            existing.lastUsed = new Date().toISOString();
            patterns[existingIndex] = existing;
        } else {
            // Add new pattern
            patterns.push({
                ...pattern,
                id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                usageCount: 1,
                createdAt: new Date().toISOString(),
                lastUsed: new Date().toISOString()
            });
        }

        await writePatterns(patterns);

        // Update stats
        const stats = await readStats();
        stats.totalPatterns = patterns.length;
        stats.lastUpdated = new Date().toISOString();
        await writeStats(stats);

        res.json({ success: true, message: 'Pattern uploaded successfully' });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * POST /api/patterns/batch-upload
 * Upload multiple patterns at once
 */
app.post('/api/patterns/batch-upload', async (req: Request, res: Response) => {
    try {
        const { patterns: newPatterns } = req.body;

        if (!Array.isArray(newPatterns)) {
            return res.status(400).json({ success: false, error: 'Invalid request' });
        }

        const patterns = await readPatterns();
        let uploaded = 0;
        let skipped = 0;

        for (const pattern of newPatterns) {
            if (!isShareableIntent(pattern.intent)) {
                skipped++;
                continue;
            }

            // Check if pattern already exists
            const existingIndex = patterns.findIndex((p: any) =>
                p.intent === pattern.intent &&
                p.questionPattern.toLowerCase() === pattern.questionPattern.toLowerCase()
            );

            if (existingIndex >= 0) {
                // Merge answer mappings
                const existing = patterns[existingIndex];
                if (pattern.answerMappings && existing.answerMappings) {
                    pattern.answerMappings.forEach((newMapping: any) => {
                        const existingMapping = existing.answerMappings.find(
                            (m: any) => m.canonicalValue === newMapping.canonicalValue
                        );
                        if (existingMapping) {
                            newMapping.variants.forEach((v: string) => {
                                if (!existingMapping.variants.includes(v)) {
                                    existingMapping.variants.push(v);
                                }
                            });
                        } else {
                            existing.answerMappings.push(newMapping);
                        }
                    });
                }
                existing.usageCount++;
                existing.lastUsed = new Date().toISOString();
                patterns[existingIndex] = existing;
            } else {
                // Add new pattern
                patterns.push({
                    ...pattern,
                    id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    usageCount: 1,
                    createdAt: new Date().toISOString(),
                    lastUsed: new Date().toISOString()
                });
            }
            uploaded++;
        }

        await writePatterns(patterns);

        // Update stats
        const stats = await readStats();
        stats.totalPatterns = patterns.length;
        stats.lastUpdated = new Date().toISOString();
        await writeStats(stats);

        res.json({
            success: true,
            uploaded,
            skipped,
            message: `Uploaded ${uploaded} patterns, skipped ${skipped}`
        });
    } catch (error) {
        console.error('Batch upload error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * GET /api/patterns/search?q=question
 * Search for matching patterns
 */
app.get('/api/patterns/search', async (req: Request, res: Response) => {
    try {
        const query = (req.query.q as string || '').toLowerCase();

        if (!query) {
            return res.status(400).json({ success: false, error: 'Query required' });
        }

        const patterns = await readPatterns();

        // Find matching patterns
        const matches = patterns.filter((p: any) => {
            const questionLower = p.questionPattern.toLowerCase();

            // Fuzzy match - at least 70% word overlap
            const qWords = query.split(/\s+/);
            const pWords = questionLower.split(/\s+/);

            const matchedWords = qWords.filter(w => pWords.includes(w)).length;
            const similarity = matchedWords / Math.max(qWords.length, pWords.length);

            return similarity >= 0.7;
        });

        // Sort by usage count (most used first)
        matches.sort((a: any, b: any) => b.usageCount - a.usageCount);

        res.json({ success: true, matches });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * GET /api/patterns/sync?since=timestamp
 * Get all patterns updated since timestamp
 */
app.get('/api/patterns/sync', async (req: Request, res: Response) => {
    try {
        const since = req.query.since as string;
        const patterns = await readPatterns();

        let filteredPatterns = patterns;

        if (since) {
            const sinceDate = new Date(since);
            filteredPatterns = patterns.filter((p: any) =>
                new Date(p.lastUsed) > sinceDate || new Date(p.createdAt) > sinceDate
            );
        }

        res.json({
            success: true,
            patterns: filteredPatterns,
            total: filteredPatterns.length
        });
    } catch (error) {
        console.error('Sync error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * GET /api/patterns/stats
 * Get global statistics
 */
app.get('/api/patterns/stats', async (req: Request, res: Response) => {
    try {
        const stats = await readStats();
        const patterns = await readPatterns();

        // Calculate additional stats
        const intentBreakdown: any = {};
        patterns.forEach((p: any) => {
            intentBreakdown[p.intent] = (intentBreakdown[p.intent] || 0) + 1;
        });

        res.json({
            success: true,
            stats: {
                ...stats,
                totalPatterns: patterns.length,
                intentBreakdown,
                topPatterns: patterns
                    .sort((a: any, b: any) => b.usageCount - a.usageCount)
                    .slice(0, 10)
                    .map((p: any) => ({
                        intent: p.intent,
                        questionPattern: p.questionPattern,
                        usageCount: p.usageCount
                    }))
            }
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * POST /api/patterns/usage
 * Increment usage count for a pattern
 */
app.post('/api/patterns/usage', async (req: Request, res: Response) => {
    try {
        const { patternId } = req.body;

        const patterns = await readPatterns();
        const pattern = patterns.find((p: any) => p.id === patternId);

        if (!pattern) {
            return res.status(404).json({ success: false, error: 'Pattern not found' });
        }

        pattern.usageCount++;
        pattern.lastUsed = new Date().toISOString();

        await writePatterns(patterns);

        // Update AI calls saved stat
        const stats = await readStats();
        stats.aiCallsSaved++;
        await writeStats(stats);

        res.json({ success: true, message: 'Usage recorded' });
    } catch (error) {
        console.error('Usage error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Health check
app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'pattern-learning-api' });
});

// Initialize and start server
initializeStorage().then(() => {
    app.listen(PORT, () => {
        console.log(`🎓 Pattern Learning API running on http://localhost:${PORT}`);
        console.log(`📊 Endpoints:`);
        console.log(`   POST /api/patterns/upload - Upload single pattern`);
        console.log(`   POST /api/patterns/batch-upload - Upload multiple patterns`);
        console.log(`   GET  /api/patterns/search?q=... - Search patterns`);
        console.log(`   GET  /api/patterns/sync?since=... - Sync patterns`);
        console.log(`   GET  /api/patterns/stats - Get statistics`);
        console.log(`   POST /api/patterns/usage - Record pattern usage`);
    });
});

export default app;
