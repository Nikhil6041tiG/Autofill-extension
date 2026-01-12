import { CanonicalProfile } from "../../types/canonicalProfile";

/**
 * AI Service for answering unmapped job application questions
 * Uses AWS Bedrock (Nova/Claude) to predict answers based on user profile
 */

interface AIQuestionRequest {
    question: string;
    options?: string[];
    fieldType: string;
    userProfile: CanonicalProfile;
}

interface AIQuestionResponse {
    answer: string;
    confidence: number;
    reasoning?: string;
    intent?: string;  // Canonical intent path (e.g., "social.linkedin")
    isNewIntent?: boolean;  // True if AI suggested a new intent
    suggestedIntentName?: string;  // Suggested name if creating new intent
}

/**
 * Call AWS Bedrock to get an answer for an unmapped question
 */
export async function askAI(request: AIQuestionRequest): Promise<AIQuestionResponse> {
    try {
        // Send request to background script which will call AWS Bedrock
        const response: any = await new Promise((resolve) => {
            chrome.runtime.sendMessage(
                {
                    action: "askAI",
                    payload: request
                },
                (response) => resolve(response)
            );
        });

        if (!response || !response.success) {
            throw new Error(response?.error || "AI request failed");
        }

        return response.data;
    } catch (error) {
        console.error("[AI Service] Error:", error);
        return {
            answer: "",
            confidence: 0,
            reasoning: `AI Error: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}

/**
 * Build context string from user profile for AI
 */
export function buildProfileContext(profile: CanonicalProfile): string {
    const context = [];

    // Personal Info
    if (profile.personal.firstName || profile.personal.lastName) {
        context.push(`Name: ${profile.personal.firstName} ${profile.personal.lastName}`);
    }
    if (profile.personal.email) context.push(`Email: ${profile.personal.email}`);
    if (profile.personal.phone) context.push(`Phone: ${profile.personal.phone}`);
    if (profile.personal.city || profile.personal.state) {
        context.push(`Location: ${profile.personal.city}, ${profile.personal.state}`);
    }

    // Education
    if (profile.education && profile.education.length > 0) {
        const edu = profile.education[0];
        context.push(`Education: ${edu.degree} in ${edu.major || 'N/A'} from ${edu.school}`);
        if (edu.gpa) context.push(`GPA: ${edu.gpa}`);
    }

    // Experience
    if (profile.experience && profile.experience.length > 0) {
        const exp = profile.experience[0];
        context.push(`Current/Recent Role: ${exp.title} at ${exp.company}`);
    }

    // Skills
    if (profile.skills && profile.skills.length > 0) {
        context.push(`Skills: ${profile.skills.slice(0, 10).join(', ')}`);
    }

    // Work Authorization
    if (profile.workAuthorization) {
        context.push(`US Work Authorization: ${profile.workAuthorization.authorizedUS ? 'Yes' : 'No'}`);
        context.push(`Needs Sponsorship: ${profile.workAuthorization.needsSponsorship ? 'Yes' : 'No'}`);
    }

    // EEO / Demographic info
    if (profile.eeo) {
        if (profile.eeo.gender) context.push(`Gender: ${profile.eeo.gender}`);
        if (profile.eeo.race) context.push(`Race/Ethnicity: ${profile.eeo.race}`);
        if (profile.eeo.hispanic !== undefined) context.push(`Hispanic/Latino: ${profile.eeo.hispanic ? 'Yes' : 'No'}`);
        if (profile.eeo.veteran) context.push(`Veteran Status: ${profile.eeo.veteran}`);
        if (profile.eeo.disability) context.push(`Disability Status: ${profile.eeo.disability}`);
    }

    // API Fields (additional data from lead-details and vercel)
    if (profile.apiFields) {
        const apiContext = [];

        // Education details
        if (profile.apiFields.highest_education) {
            apiContext.push(`Highest Education: ${profile.apiFields.highest_education}`);
        }
        if (profile.apiFields.cumulative_gpa) {
            apiContext.push(`Cumulative GPA: ${profile.apiFields.cumulative_gpa}`);
        }
        if (profile.apiFields.graduation_year) {
            apiContext.push(`Graduation Year: ${profile.apiFields.graduation_year}`);
        }

        // Work preferences
        if (profile.apiFields.work_preferences) {
            apiContext.push(`Work Preferences: ${profile.apiFields.work_preferences}`);
        }
        if (profile.apiFields.willing_to_relocate !== undefined) {
            apiContext.push(`Willing to Relocate: ${profile.apiFields.willing_to_relocate ? 'Yes' : 'No'}`);
        }
        if (profile.apiFields.can_work_3_days_in_office !== undefined) {
            apiContext.push(`Can Work 3 Days in Office: ${profile.apiFields.can_work_3_days_in_office ? 'Yes' : 'No'}`);
        }

        // Background check related
        if (profile.apiFields.convicted_of_felony !== undefined) {
            apiContext.push(`Convicted of Felony: ${profile.apiFields.convicted_of_felony ? 'Yes' : 'No'}`);
        }
        if (profile.apiFields.willing_background_check !== undefined) {
            apiContext.push(`Willing to Undergo Background Check: ${profile.apiFields.willing_background_check ? 'Yes' : 'No'}`);
        }
        if (profile.apiFields.willing_drug_screen !== undefined) {
            apiContext.push(`Willing to Undergo Drug Screen: ${profile.apiFields.willing_drug_screen ? 'Yes' : 'No'}`);
        }

        if (apiContext.length > 0) {
            context.push(...apiContext);
        }
    }

    return context.join('\n');
}
