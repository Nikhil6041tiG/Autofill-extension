export interface ParsedResume {
    personal: {
        firstName: string;
        lastName: string;
        email: string;
        phone?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
        linkedin?: string;
        github?: string;
        portfolio?: string;
    };
    education: Array<{
        school: string;
        degree: string;
        major?: string;
        startDate?: string;
        endDate?: string;
        gpa?: string;
        currentlyStudying?: boolean;
    }>;
    experience: Array<{
        company: string;
        title: string;
        startDate?: string;
        endDate?: string;
        location?: string;
        currentlyWorking?: boolean;
        jobType?: string;
        bullets?: string[];
    }>;
    skills: string[];
    projects?: Array<{
        name: string;
        description?: string;
        url?: string;
    }>;
    certifications?: string[];
    languages?: string[];
    rawText?: string;
}
