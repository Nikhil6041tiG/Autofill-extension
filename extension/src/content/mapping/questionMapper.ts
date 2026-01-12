/**
 * QuestionMapper - Maps scanned questions to answers
 * Uses canonical matching, learned patterns, fuzzy matching, and AI fallback
 */

import { loadProfile } from '../../core/storage/profileStorage';
import { askAI } from '../../core/ai/aiService';
import { patternStorage } from '../../core/storage/patternStorage';

export interface ScannedQuestion {
    questionText: string;
    fieldType: string;
    options: string[] | undefined;
    required: boolean;
    selector: string;
}

export interface MappedAnswer {
    selector: string;
    questionText: string;
    answer: string;
    source: 'canonical' | 'learned' | 'fuzzy' | 'AI';
    confidence: number;
    required: boolean;
    fieldType: string;
    canonicalKey?: string;
    options?: string[];
    fileName?: string; // For file uploads - the original filename
}

export class QuestionMapper {

    /**
     * Process all scanned questions and return fill plan
     */
    async processQuestions(questions: ScannedQuestion[]): Promise<MappedAnswer[]> {
        console.log(`\n========== SCANNED QUESTIONS (${questions.length}) ==========`);
        questions.forEach((q, index) => {
            console.log(`\n${index + 1}. "${q.questionText}"`);
            console.log(`   Type: ${q.fieldType}`);
            console.log(`   Required: ${q.required ? 'Yes' : 'No'}`);
            if (q.options && q.options.length > 0) {
                console.log(`   Options: [${q.options.join(', ')}]`);
            } else {
                console.log(`   Options: None (text field)`);
            }
            console.log(`   Selector: ${q.selector}`);
        });
        console.log(`\n========== STARTING MAPPING ==========\n`);

        const profile = await loadProfile();
        if (!profile) {
            throw new Error('No profile found. Please complete onboarding.');
        }

        const mappedAnswers: MappedAnswer[] = [];
        const unmappedForAI: ScannedQuestion[] = [];

        // Phase 1: Try canonical, learned, then fuzzy matching
        for (const q of questions) {
            const result = await this.tryMapping(q, profile);

            if (result && result.confidence >= 0.85) {
                // High confidence - use this answer
                mappedAnswers.push({
                    selector: q.selector,
                    questionText: q.questionText,
                    answer: result.answer,
                    source: result.source as any,
                    confidence: result.confidence,
                    required: q.required,
                    fieldType: q.fieldType,
                    options: q.options || undefined,
                    fileName: result.fileName // Include fileName if present
                });

                console.log(`[QuestionMapper] ✓ Mapped "${q.questionText}" → "${result.answer}" (${result.source}, ${(result.confidence * 100).toFixed(0)}%)`);
            } else {
                // Low confidence or no match - queue for AI
                unmappedForAI.push(q);
                console.log(`[QuestionMapper] ⏭️ Queued for AI: "${q.questionText}" (confidence: ${result ? (result.confidence * 100).toFixed(0) + '%' : '0%'})`);
            }
        }

        // Phase 2: Send unmapped questions to AI and LEARN from responses
        if (unmappedForAI.length > 0) {
            console.log(`[QuestionMapper] Sending ${unmappedForAI.length} questions to AI...`);

            const aiAnswers = await this.requestAIAnswers(unmappedForAI, profile);

            // Learn from each AI response
            for (let i = 0; i < unmappedForAI.length; i++) {
                const question = unmappedForAI[i];
                const answer = aiAnswers[i];

                if (answer) {
                    await this.learnFromAIResponse(question, answer, profile);
                }
            }

            mappedAnswers.push(...aiAnswers);
        }

        console.log(`[QuestionMapper] Complete: ${mappedAnswers.length} answers ready`);
        return mappedAnswers;
    }

    /**
     * Try canonical, learned, and fuzzy matching
     */
    private async tryMapping(question: ScannedQuestion, profile: any): Promise<{ answer: string; source: 'canonical' | 'learned' | 'fuzzy'; confidence: number; fileName?: string } | null> {

        // 1. Try canonical matching first
        const canonicalResult = this.tryCanonical(question, profile);
        if (canonicalResult) {
            return canonicalResult;
        }

        // 2. Try learned patterns
        const learnedResult = await this.tryLearned(question, profile);
        if (learnedResult) {
            return learnedResult;
        }

        // 3. Try fuzzy matching with options
        if (question.options && question.options.length > 0) {
            const fuzzyResult = this.tryFuzzy(question, profile);
            if (fuzzyResult) {
                return fuzzyResult;
            }
        }

        return null;
    }

    /**
     * Try learned patterns from storage
     */
    private async tryLearned(question: ScannedQuestion, profile: any): Promise<{ answer: string; source: 'learned'; confidence: number } | null> {
        const pattern = await patternStorage.findPattern(question.questionText);

        if (!pattern) {
            return null;
        }

        // Get canonical value from profile (optional - may not exist)
        const canonicalValue = this.getValueFromProfile(profile, pattern.intent);

        // INFINITE LEARNING MODE:
        // Try to match stored variants against current options
        // This works even if profile doesn't have this value!
        if (pattern.answerMappings && pattern.answerMappings.length > 0 && question.options) {
            // Try to find variant that matches current options
            for (const mapping of pattern.answerMappings) {
                for (const variant of mapping.variants) {
                    const match = question.options.find(opt =>
                        opt.toLowerCase() === variant.toLowerCase() ||
                        opt.toLowerCase().includes(variant.toLowerCase()) ||
                        variant.toLowerCase().includes(opt.toLowerCase())
                    );

                    if (match) {
                        console.log(`[QuestionMapper] 🎯 Matched stored variant "${variant}" → "${match}"`);
                        return { answer: match, source: 'learned', confidence: pattern.confidence };
                    }
                }
            }
        }

        // Fallback: Use canonical value from profile if available
        if (canonicalValue) {
            // For generic fields with answer mappings, find best variant
            if (pattern.answerMappings && pattern.answerMappings.length > 0) {
                const answer = this.findBestVariant(canonicalValue, pattern.answerMappings, question.options);
                if (answer) {
                    return { answer, source: 'learned', confidence: pattern.confidence };
                }
                // findBestVariant returned null - variant doesn't match options
                // Fall through to let AI handle it
            } else {
                // For personal fields (pattern-only), validate against options if they exist
                if (question.options && question.options.length > 0) {
                    // Check if canonical value matches any option
                    const match = question.options.find(opt =>
                        opt.toLowerCase() === canonicalValue.toLowerCase() ||
                        opt.toLowerCase().includes(canonicalValue.toLowerCase()) ||
                        canonicalValue.toLowerCase().includes(opt.toLowerCase())
                    );
                    if (match) {
                        console.log(`[QuestionMapper] 🔍 Canonical value "${canonicalValue}" matches option "${match}"`);
                        return { answer: match, source: 'learned', confidence: pattern.confidence };
                    }
                    // No match - let AI handle it
                    console.log(`[QuestionMapper] ⚠️ Canonical value "${canonicalValue}" not in options, will use AI`);
                } else {
                    // No options to validate against, return canonical value as-is
                    return { answer: canonicalValue, source: 'learned', confidence: pattern.confidence };
                }
            }
        }

        // No match found and no profile value - pattern exists but can't use it
        return null;
    }

    /**
     * Get value from profile using intent path
     */
    private getValueFromProfile(profile: any, intent: string): string | null {
        const parts = intent.split('.');
        let value = profile;

        for (const part of parts) {
            value = value?.[part];
            if (value === undefined) return null;
        }

        // Convert booleans to strings
        if (typeof value === 'boolean') {
            return value ? 'Yes' : 'No';
        }

        return value ? String(value) : null;
    }

    /**
     * Find best answer variant for available options
     */
    private findBestVariant(canonicalValue: string, answerMappings: any[], options?: string[]): string | null {
        // Find the mapping for this canonical value
        const mapping = answerMappings.find(m => m.canonicalValue === canonicalValue);
        if (!mapping) return null; // No mapping exists

        if (!options || options.length === 0) {
            // No options available, return first variant
            return mapping.variants[0] || canonicalValue;
        }

        // Find matching variant in options
        for (const variant of mapping.variants) {
            const match = options.find(opt =>
                opt.toLowerCase() === variant.toLowerCase() ||
                opt.toLowerCase().includes(variant.toLowerCase()) ||
                variant.toLowerCase().includes(opt.toLowerCase())
            );
            if (match) {
                console.log(`[QuestionMapper] 🎯 Matched learned variant "${variant}" → "${match}"`);
                return match;
            }
        }

        // No match found - return null so AI can learn correct mapping
        console.log(`[QuestionMapper] ⚠️ No learned variant matches options, will use AI`);
        return null;
    }

    /**
     * Learn from AI response
     */
    private async learnFromAIResponse(question: ScannedQuestion, answer: MappedAnswer, profile: any): Promise<void> {
        // Primary: Use AI-provided intent if available
        let intent: string | null = null;

        if (answer.canonicalKey || (answer as any).intent) {
            // AI provided an intent classification
            intent = answer.canonicalKey || (answer as any).intent;
            console.log(`[QuestionMapper] ✓ Using AI-provided intent: ${intent}`);

            // Handle new intent creation
            if ((answer as any).isNewIntent) {
                console.log(`[QuestionMapper] 🆕 AI suggested new intent: ${intent} ("${(answer as any).suggestedIntentName}")`);
                // Store as a custom intent pattern for future use
                const pattern: any = {
                    questionPattern: this.normalizeQuestion(question.questionText),
                    intent,
                    canonicalKey: intent,
                    fieldType: question.fieldType,
                    confidence: answer.confidence || 0.8,
                    source: 'AI-new',
                    isCustomIntent: true
                };

                if (question.options) {
                    pattern.answerMappings = [{
                        canonicalValue: answer.answer,
                        variants: [answer.answer],
                        contextOptions: question.options
                    }];
                }

                await patternStorage.addPattern(pattern);
                return;
            }
        } else {
            // Fallback: Try to detect intent from question and answer using keywords
            intent = this.detectIntent(question.questionText, answer.answer, profile);
            if (intent) {
                console.log(`[QuestionMapper] ⚠️ Using fallback keyword detection: ${intent}`);
            }
        }

        if (!intent) {
            console.log(`[QuestionMapper] Cannot determine intent for: "${question.questionText}"`);
            return;
        }

        // INFINITE LEARNING MODE:
        // Store the AI's answer as a variant for this intent
        // Build up a knowledge base of answers for each intent over time

        // Try to get canonical value from profile (optional - used as base if available)
        const canonicalValue = this.getValueFromProfile(profile, intent);

        // Use AI's answer as the canonical value if profile doesn't have it
        const valueToStore = canonicalValue || answer.answer;

        console.log(`[QuestionMapper] 📚 Learning variant "${answer.answer}" for intent: ${intent}`);

        // Create pattern with answer variant
        const pattern: any = {
            questionPattern: this.normalizeQuestion(question.questionText),
            intent,
            canonicalKey: intent,
            fieldType: question.fieldType,
            confidence: answer.confidence || 0.8,
            source: 'AI'
        };

        // ALWAYS store answer mappings to build variant knowledge base
        pattern.answerMappings = [{
            canonicalValue: valueToStore,  // The "base" answer (from profile or AI)
            variants: [answer.answer],      // Specific variant used this time
            contextOptions: question.options || []  // Options available when this was used
        }];

        await patternStorage.addPattern(pattern);
        console.log(`[QuestionMapper] ✅ Pattern stored with variant: "${answer.answer}"`);
    }

    /**
     * Detect intent from question and answer
     */
    private detectIntent(questionText: string, answer: string, profile: any): string | null {
        const qLower = questionText.toLowerCase();

        // Check by matching answer to profile values
        if (answer === profile.eeo?.gender) return 'eeo.gender';
        if (answer === profile.eeo?.hispanic) return 'eeo.hispanic';
        if (answer === profile.eeo?.veteran) return 'eeo.veteran';
        if (answer === profile.eeo?.disability) return 'eeo.disability';
        if (answer === profile.eeo?.race) return 'eeo.race';
        if (answer === profile.personal?.firstName) return 'personal.firstName';
        if (answer === profile.personal?.lastName) return 'personal.lastName';
        if (answer === profile.personal?.email) return 'personal.email';
        if (answer === profile.personal?.phone) return 'personal.phone';
        if (answer === profile.personal?.city) return 'personal.city';
        if (answer === profile.personal?.state) return 'personal.state';
        if (answer === profile.personal?.country) return 'personal.country';
        if (answer === profile.social?.linkedin) return 'social.linkedin';
        if (answer === profile.social?.website) return 'social.website';

        // Keyword-based fallback
        if (qLower.includes('gender') || qLower.includes('sex')) return 'eeo.gender';
        if (qLower.includes('hispanic') || qLower.includes('latino')) return 'eeo.hispanic';
        if (qLower.includes('veteran')) return 'eeo.veteran';
        if (qLower.includes('disability')) return 'eeo.disability';
        if (qLower.includes('race') || qLower.includes('ethnicity')) return 'eeo.race';
        if (qLower.includes('sponsor')) return 'workAuth.needsSponsorship';
        if (qLower.includes('authorized') && qLower.includes('work')) return 'workAuth.authorizedUS';
        if (qLower.includes('driver') && qLower.includes('license')) return 'workAuth.driverLicense';
        if (qLower.includes('linkedin')) return 'social.linkedin';
        if (qLower.includes('website') || qLower.includes('portfolio')) return 'social.website';
        if (qLower.includes('first name') || qLower.includes('given name')) return 'personal.firstName';
        if (qLower.includes('last name') || qLower.includes('family name') || qLower.includes('surname')) return 'personal.lastName';
        if (qLower.includes('email')) return 'personal.email';
        if (qLower.includes('phone') || qLower.includes('mobile')) return 'personal.phone';

        return null;
    }

    /**
     * Check if intent is generic (shareable)
     */
    private isGenericIntent(intent: string): boolean {
        const genericIntents = [
            'eeo.gender', 'eeo.hispanic', 'eeo.veteran', 'eeo.disability', 'eeo.race',
            'workAuth.sponsorship', 'workAuth.usAuthorized', 'workAuth.driverLicense',
            'location.country', 'location.state', 'application.hasRelatives'
        ];
        return genericIntents.includes(intent);
    }

    /**
     * Normalize question text for pattern matching
     */
    private normalizeQuestion(questionText: string): string {
        return questionText.toLowerCase()
            .replace(/[*?!]/g, '') // Remove special chars
            .trim();
    }

    /**
     * Canonical matching - exact profile field mapping
     */
    private tryCanonical(question: ScannedQuestion, profile: any): { answer: string; source: 'canonical'; confidence: number; fileName?: string } | null {
        const qLower = question.questionText.toLowerCase();

        // ===== PERSONAL INFO =====

        // First name
        if ((qLower.includes('first name') || qLower === 'first name') && profile.personal?.firstName) {
            return { answer: profile.personal.firstName, source: 'canonical', confidence: 1.0 };
        }

        // Last name
        if ((qLower.includes('last name') || qLower === 'last name') && profile.personal?.lastName) {
            return { answer: profile.personal.lastName, source: 'canonical', confidence: 1.0 };
        }

        // Email
        if ((qLower.includes('email') || qLower === 'email') && profile.personal?.email) {
            return { answer: profile.personal.email, source: 'canonical', confidence: 1.0 };
        }

        // Phone
        if ((qLower.includes('phone') || qLower === 'phone') && profile.personal?.phone) {
            return { answer: profile.personal.phone, source: 'canonical', confidence: 1.0 };
        }

        // Country
        if (qLower.includes('country') && profile.personal?.country) {
            console.log(`[QuestionMapper] 🌍 Country field detected. Profile value: "${profile.personal.country}"`);
            if (question.options) {
                console.log(`[QuestionMapper] 🌍 Available country options: [${question.options.join(', ')}]`);
            }
            const countryMatch = this.matchInOptions(profile.personal.country, question.options || undefined, 1.0);
            if (countryMatch) {
                console.log(`[QuestionMapper] ✓ Country matched: "${countryMatch.answer}"`);
            } else {
                console.log(`[QuestionMapper] ⚠️ Country "${profile.personal.country}" not matched in options - will use AI`);
            }
            return countryMatch;
        }

        // City
        if (qLower.includes('city') && profile.personal?.city) {
            return { answer: profile.personal.city, source: 'canonical', confidence: 1.0 };
        }

        // State
        if (qLower.includes('state') && !qLower.includes('united') && profile.personal?.state) {
            return { answer: profile.personal.state, source: 'canonical', confidence: 1.0 };
        }

        // LinkedIn - comprehensive matching
        if ((qLower.includes('linkedin') ||
            qLower.includes('linked in') ||
            qLower.includes('linkedin profile') ||
            qLower.includes('linkedin url') ||
            qLower.includes('professional profile') ||
            qLower === 'linkedin') && profile.social?.linkedin) {
            return { answer: profile.social.linkedin, source: 'canonical', confidence: 1.0 };
        }

        // Website / portfolio - comprehensive matching
        if ((qLower.includes('website') ||
            qLower.includes('portfolio') ||
            qLower.includes('personal website') ||
            qLower.includes('online portfolio') ||
            qLower === 'website') && profile.social?.website) {
            return { answer: profile.social.website, source: 'canonical', confidence: 1.0 };
        }

        // ===== FILE UPLOADS =====

        // Resume/CV
        if ((question.fieldType === 'file' && question.selector.includes('resume')) ||
            qLower.includes('resume') ||
            qLower.includes('cv') ||
            (question.fieldType === 'file' && qLower === 'attach' && question.selector.includes('resume'))) {

            if (profile.documents?.resume?.base64) {
                // Return base64 data URL format that Selenium expects
                const base64Data = profile.documents.resume.base64;
                // If base64Data already includes the data URL prefix, use as-is
                const dataUrl = base64Data.startsWith('data:') ? base64Data : `data:application/pdf;base64,${base64Data}`;
                const fileName = profile.documents.resume.fileName ||
                    (profile.personal?.firstName && profile.personal?.lastName
                        ? `${profile.personal.firstName}_${profile.personal.lastName}_Resume.pdf`
                        : 'resume.pdf');
                return { answer: dataUrl, source: 'canonical', confidence: 1.0, fileName };
            }
        }

        // Cover Letter
        if ((question.fieldType === 'file' && question.selector.includes('cover')) ||
            qLower.includes('cover letter') ||
            qLower.includes('cover_letter') ||
            (question.fieldType === 'file' && qLower === 'attach' && question.selector.includes('cover'))) {

            if (profile.documents?.coverLetter?.base64) {
                // Return base64 data URL format that Selenium expects
                const base64Data = profile.documents.coverLetter.base64;
                // If base64Data already includes the data URL prefix, use as-is
                const dataUrl = base64Data.startsWith('data:') ? base64Data : `data:application/pdf;base64,${base64Data}`;
                const fileName = profile.documents.coverLetter.fileName || 'cover_letter.pdf';
                return { answer: dataUrl, source: 'canonical', confidence: 1.0, fileName };
            }
        }

        // ===== WORK AUTHORIZATION =====

        // Driver's License
        if (qLower.includes('driver') && qLower.includes('license')) {
            if (profile.workAuthorization?.driverLicense !== undefined) {
                const answer = this.booleanToYesNo(profile.workAuthorization.driverLicense, question.options || undefined);
                return { answer, source: 'canonical', confidence: 1.0 };
            }
        }

        // Sponsorship
        if (qLower.includes('sponsor') && (qLower.includes('visa') || qLower.includes('work') || qLower.includes('government'))) {
            if (profile.workAuthorization?.needsSponsorship !== undefined) {
                const answer = this.booleanToYesNo(profile.workAuthorization.needsSponsorship, question.options || undefined);
                return { answer, source: 'canonical', confidence: 1.0 };
            }
        }

        // US Authorization - comprehensive matching
        if ((qLower.includes('authorized') || qLower.includes('legally')) &&
            qLower.includes('work') &&
            (qLower.includes('united states') || qLower.includes('u.s.') || qLower.includes('us') || qLower.includes('america'))) {
            if (profile.workAuthorization?.authorizedUS !== undefined) {
                const answer = this.booleanToYesNo(profile.workAuthorization.authorizedUS, question.options || undefined);
                return { answer, source: 'canonical', confidence: 1.0 };
            }
        }

        // ===== APPLICATION QUESTIONS =====

        // Related to Employee
        if ((qLower.includes('relat') && qLower.includes('employee')) || (qLower.includes('friend') && qLower.includes('work'))) {
            if (profile.application?.hasRelatives !== undefined) {
                const answer = this.booleanToYesNo(profile.application.hasRelatives, question.options || undefined);
                return { answer, source: 'canonical', confidence: 1.0 };
            }
        }

        // Previously Applied
        if (qLower.includes('previously') && qLower.includes('appl')) {
            if (profile.application?.previouslyApplied !== undefined) {
                const answer = this.booleanToYesNo(profile.application.previouslyApplied, question.options || undefined);
                return { answer, source: 'canonical', confidence: 1.0 };
            }
        }

        // ===== EEO QUESTIONS =====

        // Gender
        if (qLower.includes('gender') && profile.eeo?.gender) {
            return this.matchInOptions(profile.eeo.gender, question.options || undefined, 1.0);
        }

        // Hispanic/Latino
        if ((qLower.includes('hispanic') || qLower.includes('latino')) && profile.eeo?.hispanic) {
            return this.matchInOptions(profile.eeo.hispanic, question.options || undefined, 1.0);
        }

        // Veteran Status
        if (qLower.includes('veteran') && profile.eeo?.veteran) {
            return this.matchInOptions(profile.eeo.veteran, question.options || undefined, 1.0);
        }

        // Disability
        if (qLower.includes('disability') && profile.eeo?.disability) {
            return this.matchInOptions(profile.eeo.disability, question.options || undefined, 1.0);
        }

        // Race
        if (qLower.includes('race') && profile.eeo?.race) {
            return this.matchInOptions(profile.eeo.race, question.options || undefined, 1.0);
        }

        return null;
    }

    /**
     * Fuzzy matching - match profile values to available options
     */
    private tryFuzzy(question: ScannedQuestion, profile: any): { answer: string; source: 'canonical' | 'fuzzy'; confidence: number } | null {
        if (!question.options) return null;

        const qLower = question.questionText.toLowerCase();

        // Gender matching (fallback if not in eeo)
        if (qLower.includes('gender') && profile.personal?.gender) {
            return this.matchInOptions(profile.personal.gender, question.options || undefined, 0.9);
        }

        return null;
    }

    /**
     * Fuzzy match a value to the closest option in the list
     * Used to validate AI responses against available options
     */
    private fuzzyMatchOption(value: string, options: string[]): string | null {
        const result = this.matchInOptions(value, options, 0.9);
        return result ? result.answer : null;
    }

    /**
     * Convert boolean to Yes/No based on available options
     */
    private booleanToYesNo(value: boolean, options?: string[]): string {
        if (!options || options.length === 0) {
            return value ? 'Yes' : 'No';
        }

        // Find Yes option
        if (value) {
            const yesOption = options.find(opt =>
                opt.toLowerCase().includes('yes') ||
                opt.toLowerCase() === 'y' ||
                opt.toLowerCase().includes('true') ||
                opt.toLowerCase() === 'i do'
            );
            return yesOption || 'Yes';
        }

        // Find No option
        const noOption = options.find(opt =>
            opt.toLowerCase().includes('no') ||
            opt.toLowerCase() === 'n' ||
            opt.toLowerCase().includes('false') ||
            opt.toLowerCase() === 'i do not' ||
            opt.toLowerCase() === `i don't` ||
            opt.toLowerCase().includes('prefer not')
        );
        return noOption || 'No';
    }

    /**
     * Match stored value to best option
     */
    private matchInOptions(value: string, options?: string[], confidence: number = 1.0): { answer: string; source: 'canonical'; confidence: number } | null {
        if (!options || options.length === 0) {
            return { answer: value, source: 'canonical', confidence };
        }

        const valueLower = value.toLowerCase().trim();

        // 1. Exact match
        const exactMatch = options.find(opt => opt.toLowerCase().trim() === valueLower);
        if (exactMatch) {
            return { answer: exactMatch, source: 'canonical', confidence };
        }

        // 1.5 Synonym match (Male matched to Man, etc.)
        const synonyms: Record<string, string[]> = {
            'male': ['man'],
            'female': ['woman'],
            'man': ['male'],
            'woman': ['female']
        };

        if (synonyms[valueLower]) {
            for (const synonym of synonyms[valueLower]) {
                const synonymMatch = options.find(opt => opt.toLowerCase().trim() === synonym);
                if (synonymMatch) {
                    console.log(`[QuestionMapper] 🔄 Synonym matched "${value}" → "${synonymMatch}"`);
                    return { answer: synonymMatch, source: 'canonical', confidence };
                }
            }
        }

        // 2. Partial match (contains)
        const partialMatch = options.find(opt =>
            opt.toLowerCase().includes(valueLower) ||
            valueLower.includes(opt.toLowerCase())
        );
        if (partialMatch) {
            console.log(`[QuestionMapper] 🔍 Fuzzy matched "${value}" → "${partialMatch}"`);
            return { answer: partialMatch, source: 'canonical', confidence };
        }

        // 3. Word-level matching (for country names, etc.)
        // "USA" should match "United States +1"
        // "India" should match "India +91"
        const valueWords = valueLower.split(/\s+/);
        const wordMatch = options.find(opt => {
            const optLower = opt.toLowerCase();
            // Check if option starts with the value
            if (optLower.startsWith(valueLower)) return true;

            // Check if any word in value matches the start of option
            for (const word of valueWords) {
                if (optLower.startsWith(word) && word.length >= 3) return true;
            }
            return false;
        });
        if (wordMatch) {
            console.log(`[QuestionMapper] 🔍 Word matched "${value}" → "${wordMatch}"`);
            return { answer: wordMatch, source: 'canonical', confidence };
        }

        // 4. Country abbreviation mapping (common cases)
        const countryMap: Record<string, string> = {
            'usa': 'united states',
            'us': 'united states',
            'uk': 'united kingdom',
            'uae': 'united arab emirates'
        };

        if (countryMap[valueLower]) {
            const mappedName = countryMap[valueLower];
            const countryMatch = options.find(opt =>
                opt.toLowerCase().includes(mappedName)
            );
            if (countryMatch) {
                console.log(`[QuestionMapper] 🌍 Country abbreviation "${value}" → "${countryMatch}"`);
                return { answer: countryMatch, source: 'canonical', confidence };
            }
        }

        // No match found - return null so we can try AI with context
        console.log(`[QuestionMapper] ⚠️ Canonical value "${value}" not in options, will use AI`);
        return null;
    }

    /**
     * Request AI answers for unmapped questions
     * ⚡ PARALLEL PROCESSING - all AI calls happen simultaneously
     */
    private async requestAIAnswers(questions: ScannedQuestion[], profile: any): Promise<MappedAnswer[]> {
        console.log(`[QuestionMapper] ⚡ Processing ${questions.length} AI questions in PARALLEL...`);
        const startTime = Date.now();

        // Create all AI request promises at once (parallel execution)
        const aiPromises = questions.map(async (q) => {
            try {
                const aiResponse = await askAI({
                    question: q.questionText,
                    fieldType: q.fieldType,
                    // Limit options sent to AI - only send if <= 20 options
                    // This prevents overwhelming the prompt with long lists (like Country)
                    // but ensures we send options for small sets (Gender, Race, etc.)
                    options: (q.options && q.options.length <= 20) ? q.options : [],
                    userProfile: profile
                });

                if (aiResponse.answer) {
                    const intentInfo = aiResponse.intent
                        ? `, intent: ${aiResponse.intent}${aiResponse.isNewIntent ? ' (NEW)' : ''}`
                        : '';
                    console.log(`[QuestionMapper] 🤖 AI answered \"${q.questionText}\" → \"${aiResponse.answer}\" (${(aiResponse.confidence * 100).toFixed(0)}%${intentInfo})`);

                    // CRITICAL: Validate AI answer against available options
                    let finalAnswer = aiResponse.answer;
                    if (q.options && q.options.length > 0) {
                        // Check if AI answer exists in options (exact match)
                        const exactMatch = q.options.find(opt =>
                            opt.toLowerCase().trim() === aiResponse.answer.toLowerCase().trim()
                        );

                        if (!exactMatch) {
                            console.warn(`[QuestionMapper] ⚠️ AI answer "${aiResponse.answer}" not in options, trying fuzzy match...`);

                            // Try fuzzy matching to find closest option
                            const fuzzyMatch = this.fuzzyMatchOption(aiResponse.answer, q.options);
                            if (fuzzyMatch) {
                                console.log(`[QuestionMapper] ✅ Fuzzy matched "${aiResponse.answer}" → "${fuzzyMatch}"`);
                                finalAnswer = fuzzyMatch;
                            } else {
                                console.error(`[QuestionMapper] ❌ AI answer "${aiResponse.answer}" not found in options for "${q.questionText}"`);
                                return null; // Skip this question if we can't match
                            }
                        } else {
                            finalAnswer = exactMatch; // Use the exact match from options
                        }
                    }

                    return {
                        selector: q.selector,
                        questionText: q.questionText,
                        answer: finalAnswer,  // Use validated answer
                        source: 'AI' as const,
                        confidence: aiResponse.confidence || 0.8,
                        required: q.required,
                        fieldType: q.fieldType,
                        options: q.options || undefined,
                        canonicalKey: aiResponse.intent,  // Pass intent to learning method
                        ...(aiResponse.isNewIntent && { isNewIntent: aiResponse.isNewIntent, suggestedIntentName: aiResponse.suggestedIntentName })
                    } as MappedAnswer;
                } else {
                    console.warn(`[QuestionMapper] ⚠️ AI returned no answer for: \"${q.questionText}\"`);
                    return null;
                }
            } catch (error) {
                console.error(`[QuestionMapper] ❌ AI error for \"${q.questionText}\":`, error);
                return null;
            }
        });

        // Wait for ALL AI requests to complete simultaneously
        const results = await Promise.all(aiPromises);

        // Filter out null results
        const aiAnswers: MappedAnswer[] = results.filter((answer) => answer !== null) as MappedAnswer[];

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(1);
        console.log(`[QuestionMapper] ⚡ Parallel AI complete: ${aiAnswers.length}/${questions.length} answered in ${duration}s`);

        return aiAnswers;
    }

    /**
     * Convert mapped answers to Selenium fill plan format
     */
    async convertToFillPlan(answers: MappedAnswer[], jobUrl: string): Promise<any> {
        // Load profile to get file names
        const profile = await loadProfile();

        console.log(`\n[QuestionMapper] Converting ${answers.length} answers to fill plan...`);

        return {
            jobUrl,
            actions: answers.map(a => {
                const actionType = this.mapFieldTypeToAction(a.fieldType);
                const action: any = {
                    id: a.selector,
                    type: actionType,
                    selector: a.selector,
                    value: a.answer,
                    required: a.required
                };

                console.log(`[QuestionMapper] 📋 "${a.questionText}" → ${actionType} = "${a.answer}"`);

                // Add fileName for file uploads
                if (a.fieldType === 'file' && profile) {
                    if (a.selector.includes('resume') && profile.documents?.resume?.fileName) {
                        action.fileName = profile.documents.resume.fileName;
                    } else if (a.selector.includes('cover') && profile.documents?.coverLetter?.fileName) {
                        action.fileName = profile.documents.coverLetter.fileName;
                    }
                }

                return action;
            })
        };
    }

    private mapFieldTypeToAction(fieldType: string): string {
        const typeMap: Record<string, string> = {
            'text': 'input_text',
            'email': 'input_text',
            'tel': 'input_text',
            'number': 'input_text',
            'textarea': 'input_text',
            'select': 'dropdown_native',          // Native HTML <select> elements
            'dropdown_custom': 'dropdown_custom',  // React-Select / Greenhouse dropdowns
            'radio': 'radio',
            'checkbox': 'checkbox',
            'date': 'input_text',
            'file': 'input_file'
        };

        return typeMap[fieldType] || 'input_text';
    }
}
