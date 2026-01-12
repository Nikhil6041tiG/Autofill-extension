import { CanonicalProfile } from "../../types/canonicalProfile";
import { Gender, Race, YesNoDecline, SexualOrientation } from "../../types/canonicalEnums";

/**
 * Maps multi-source API responses to CanonicalProfile.
 * Source 1 (Local): lead-details (education, experience, location, phone, email, skills)
 * Source 2 (Vercel): get-client-details (everything else: EEO, Work Auth, etc.)
 */
export function mapMultiSourceToProfile(
    localData: { lead?: any; extractedData?: any[] },
    vercelData: { client?: any; additional_information?: any },
    currentProfile: CanonicalProfile
): CanonicalProfile {
    const profile: CanonicalProfile = JSON.parse(JSON.stringify(currentProfile));
    profile.apiFields = profile.apiFields || {};

    const localExtracted = localData.extractedData?.[0] || {};
    const localLead = localData.lead || {};
    const client = vercelData.client || {};
    const info = vercelData.additional_information || {};

    // --- 1. POPULATE RAW API FIELDS (for direct resolution) ---
    // Flatten all sources into apiFields
    const allFields = {
        ...localLead,
        ...localExtracted,
        ...client,
        ...info
    };

    Object.entries(allFields).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
            profile.apiFields![key] = val;
        }
    });

    // Handle special case: work_auth_details string
    if (client.work_auth_details) {
        const authStr = client.work_auth_details as string;
        profile.apiFields!.over18 = authStr.includes("Over 18: yes");
        profile.apiFields!.eligibleUS = authStr.includes("Eligible in US: yes");
        profile.apiFields!.authWithoutVisa = authStr.includes("Authorized w/o Visa: yes");
        profile.apiFields!.needsSponsorship = authStr.includes("Needs Sponsorship: yes");
    }

    // --- 2. MAP TO CANONICAL FIELDS ---

    // Personal Info (Local takes priority for contact, Client for name)
    profile.personal.email = localExtracted.email || localLead.email || client.personal_email || profile.personal.email;
    profile.personal.phone = localExtracted.phone || localLead.phone || info.primary_phone || profile.personal.phone;
    profile.personal.addressLine = localExtracted.location || localLead.location || info.full_address || profile.personal.addressLine;
    profile.personal.city = info.full_address || profile.personal.city;
    profile.personal.state = info.state_of_residence || profile.personal.state;
    profile.personal.postalCode = info.zip_or_country || profile.personal.postalCode;
    profile.personal.linkedin = info.linked_in_url || localExtracted.linkedInUrl || profile.personal.linkedin;
    profile.personal.github = info.github_url || profile.personal.github;

    const fullName = (localExtracted.fullName || client.full_name || "").trim();
    if (fullName) {
        const parts = fullName.split(/\s+/);
        if (parts.length >= 2) {
            profile.personal.firstName = parts[0];
            profile.personal.lastName = parts.slice(1).join(" ");
        } else if (parts.length === 1) {
            profile.personal.firstName = parts[0];
        }
    }

    // Education (Local takes priority)
    if (localExtracted.education) {
        let eduData = localExtracted.education;
        if (typeof eduData === 'string' && eduData.trim().startsWith('[')) {
            try { eduData = JSON.parse(eduData); } catch (e) { console.error("EDU Parse Error", e); }
        }
        if (Array.isArray(eduData)) {
            profile.education = eduData.map((e: any) => {
                let startDate = "", endDate = "";
                if (e.year) {
                    const years = e.year.split(/[-\u2013\u2014]/).map((s: string) => s.trim());
                    startDate = years[0] || "";
                    endDate = years[1] || "";
                }
                return {
                    school: e.institution || e.school || "",
                    degree: e.degree || "",
                    startDate,
                    endDate,
                    gpa: e.GPA || e.gpa || "",
                    currentlyStudying: endDate.toLowerCase().includes("present")
                };
            });
        }
    }

    // Experience (Local takes priority)
    if (localExtracted.workExperience) {
        let workData = localExtracted.workExperience;
        if (typeof workData === 'string' && workData.trim().startsWith('[')) {
            try { workData = JSON.parse(workData); } catch (e) { console.error("Work Parse Error", e); }
        }
        if (Array.isArray(workData)) {
            profile.experience = workData.map((w: any) => {
                let startDate = "", endDate = "";
                if (w.duration) {
                    const dates = w.duration.split(/[-\u2013\u2014]/).map((s: string) => s.trim());
                    startDate = dates[0] || "";
                    endDate = dates[1] || "";
                }
                return {
                    title: w.position || w.title || w.role || "",
                    company: w.company || "",
                    startDate,
                    endDate,
                    currentlyWorking: endDate.toLowerCase().includes("present"),
                    bullets: w.responsibilities ? [w.responsibilities] : []
                };
            });
        }
    }

    // Skills (Local takes priority)
    if (localExtracted.skills) {
        const skillsStr = localExtracted.skills as string;
        // Split by both commas and colons
        const skillParts = skillsStr.split(/[,:]+/).map(s => s.trim()).filter(Boolean);

        const headersToIgnore = [
            "analytics & modeling", "programming & tools", "professional soft skills",
            "data analytics & modeling", "soft skills", "technical skills", "key skills"
        ];

        const cleanedSkills = skillParts.filter(s => {
            const lowerS = s.toLowerCase();
            if (headersToIgnore.includes(lowerS)) return false;
            if (s.length > 50) return false;
            return true;
        });

        profile.skills = Array.from(new Set([...profile.skills, ...cleanedSkills]));
    }

    // Helper for boolean strings
    const isYes = (val: any) => val === true || (typeof val === 'string' && val.toLowerCase() === 'yes');

    // Work Authorization (Vercel Info)
    profile.workAuthorization.authorizedUS = isYes(info.eligible_to_work_in_us);
    profile.workAuthorization.needsSponsorship = isYes(info.require_future_sponsorship);
    profile.workAuthorization.driverLicense = isYes(info.has_valid_driver_license);
    profile.preferences.willingToRelocate = isYes(info.willing_to_relocate);

    // EEO Mapping (Vercel Info)
    if (info.gender) {
        const g = info.gender.toLowerCase();
        if (g.includes("male") && !g.includes("female")) profile.eeo.gender = Gender.MALE;
        else if (g.includes("female")) profile.eeo.gender = Gender.FEMALE;
        else profile.eeo.gender = Gender.DECLINE;
    }

    if (info.is_hispanic_latino) {
        const h = info.is_hispanic_latino.toLowerCase();
        profile.eeo.hispanic = h === "yes" ? YesNoDecline.YES : (h === "no" ? YesNoDecline.NO : YesNoDecline.DECLINE);
    }

    if (info.race_ethnicity) {
        const r = info.race_ethnicity.toLowerCase();
        if (r.includes("asian")) profile.eeo.race = Race.ASIAN;
        else if (r.includes("black")) profile.eeo.race = Race.BLACK;
        else if (r.includes("white")) profile.eeo.race = Race.WHITE;
        else if (r.includes("hispanic")) profile.eeo.race = Race.HISPANIC;
        else profile.eeo.race = Race.DECLINE;
    }

    if (info.disability_status) {
        const d = info.disability_status.toLowerCase();
        profile.eeo.disability = d.includes("yes") ? YesNoDecline.YES : (d.includes("no") ? YesNoDecline.NO : YesNoDecline.DECLINE);
    }

    if (info.veteran_status) {
        const v = info.veteran_status.toLowerCase();
        profile.eeo.veteran = (v.includes("am not") || v.includes("not a")) ? YesNoDecline.NO : YesNoDecline.YES;
    }

    // Application specific mappings
    profile.application = {
        previouslyEmployed: info.worked_for_company_before === true,
        governmentBackground: false,
        previouslyApplied: false,
        hasRelatives: info.has_relatives_in_company === true || info.has_relatives_in_company === "yes"
    };

    // Metadata
    profile.metadata = {
        ...profile.metadata,
        apiData: {
            lead: localLead,
            extractedData: localExtracted,
            vercelClient: client,
            vercelInfo: info,
            lastFetched: new Date().toISOString()
        }
    };

    return profile;
}

export function mapApiToProfile(apiResponse: { lead: any; extractedData: any[] }, currentProfile: CanonicalProfile): CanonicalProfile {
    return mapMultiSourceToProfile(apiResponse, {}, currentProfile);
}
