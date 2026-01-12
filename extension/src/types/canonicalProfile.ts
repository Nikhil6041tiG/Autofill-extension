import {
    YesNoDecline,
    Gender,
    Race,
    SexualOrientation,
    EmploymentType,
} from "./canonicalEnums";

export interface Education {
    school: string;
    degree: string;
    major?: string;
    startDate?: string;
    endDate?: string;
    gpa?: string;
}

export interface Experience {
    company: string;
    title: string;
    startDate?: string;
    endDate?: string;
    location?: string;
    bullets?: string[];
}

export interface Project {
    name: string;
    description?: string;
    url?: string;
}

export interface CanonicalProfile {
    personal: {
        firstName: string;
        lastName: string;
        preferredName?: string;
        email: string;
        phone?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
        addressLine?: string;
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
        title: string;
        company: string;
        location?: string;
        startDate?: string;
        endDate?: string;
        currentlyWorking?: boolean;
        jobType?: string; // Full-time, Part-time, etc.
        bullets?: string[];
    }>;
    projects?: Array<{
        name: string;
        description?: string;
        url?: string;
    }>;
    skills: string[];
    certifications?: string[];
    languages?: string[];

    preferences: {
        employmentTypes?: EmploymentType[];
        willingToRelocate?: boolean;
    };

    workAuthorization: {
        authorizedUS: boolean;
        needsSponsorship: boolean;
        needsFutureSponsorship?: boolean;
        citizenshipStatus?: string;
        driverLicense?: boolean;
    };

    eeo: {
        gender: Gender;
        race: Race;
        hispanic: YesNoDecline;
        veteran: YesNoDecline;
        disability: YesNoDecline;
        lgbtq: YesNoDecline;
        sexualOrientation: SexualOrientation;
    };

    consent: {
        agreedToAutofill: boolean;
        agreedAt?: string;
    };
    application?: {
        previouslyApplied?: boolean;
        previouslyEmployed?: boolean;
        hasRelatives?: boolean;
        governmentBackground?: boolean;
    };
    metadata?: {
        resumeRawText?: string;
        apwId?: string;
        apiData?: {
            lead: any;
            extractedData: any;
            vercelClient?: any;
            vercelInfo?: any;
            lastFetched?: string;
        };
    };
    documents?: {
        resume?: {
            base64: string;
            fileName: string;
        };
        coverLetter?: {
            base64: string;
            fileName: string;
        };
    };
    apiFields?: Record<string, any>;
    customAnswers?: Record<string, string>;
}

// Initial empty profile template
export const EMPTY_PROFILE: CanonicalProfile = {
    personal: {
        firstName: "",
        lastName: "",
        email: "",
    },
    education: [],
    experience: [],
    skills: [],
    preferences: {},
    workAuthorization: {
        authorizedUS: true,
        needsSponsorship: false,
        citizenshipStatus: "citizen",
    },
    eeo: {
        gender: Gender.DECLINE,
        race: Race.DECLINE,
        hispanic: YesNoDecline.DECLINE,
        veteran: YesNoDecline.DECLINE,
        disability: YesNoDecline.DECLINE,
        lgbtq: YesNoDecline.DECLINE,
        sexualOrientation: SexualOrientation.DECLINE,
    },
    consent: {
        agreedToAutofill: false,
    },
    application: {
        previouslyApplied: false,
        previouslyEmployed: false,
        hasRelatives: false,
        governmentBackground: false,
    },
    metadata: {
        apwId: "",
    },
    apiFields: {},
    customAnswers: {},
};
