export enum CanonicalIntent {
    // Personal Information
    FIRST_NAME = "personal.firstName",
    LAST_NAME = "personal.lastName",
    FULL_NAME = "personal.fullName",
    PREFERRED_NAME = "personal.preferredName",
    EMAIL = "personal.email",
    PHONE = "personal.phone",
    CITY = "personal.city",
    STATE = "personal.state",
    COUNTRY = "personal.country",
    ZIP_CODE = "personal.zipCode",
    ADDRESS = "personal.address",
    LINKEDIN = "personal.linkedin",
    GITHUB = "personal.github",
    PORTFOLIO = "personal.portfolio",

    // Work Authorization
    AUTHORIZED_US = "workAuthorization.authorizedUS",
    CITIZENSHIP_STATUS = "workAuthorization.citizenshipStatus",
    NEEDS_SPONSORSHIP = "workAuthorization.needsSponsorship",
    NEEDS_FUTURE_SPONSORSHIP = "workAuthorization.needsFutureSponsorship",

    // Application Questions
    PREVIOUSLY_APPLIED = "application.previouslyApplied",
    PREVIOUSLY_EMPLOYED = "application.previouslyEmployed",
    CONFLICT_OF_INTEREST = "application.conflictOfInterest",
    GOVERNMENT_BACKGROUND = "application.governmentBackground",

    // EEO/Compliance (NEVER use AI for these)
    GENDER = "eeo.gender",
    RACE = "eeo.race",
    HISPANIC = "eeo.hispanic",
    VETERAN = "eeo.veteran",
    DISABILITY = "eeo.disability",
    LGBTQ = "eeo.lgbtq",
    SEXUAL_ORIENTATION = "eeo.sexualOrientation",

    // Education
    SCHOOL = "education.school",
    DEGREE = "education.degree",
    MAJOR = "education.major",
    GPA = "education.gpa",
    GRADUATION_DATE = "education.graduationDate",
    START_DATE_EDUCATION = "education.startDate",

    // Experience
    COMPANY = "experience.company",
    JOB_TITLE = "experience.title",
    START_DATE_WORK = "experience.startDate",
    END_DATE_WORK = "experience.endDate",
    WORK_LOCATION = "experience.location",

    // Skills & Preferences
    SKILLS = "skills",
    YEARS_OF_EXPERIENCE = "yearsOfExperience",
    EMPLOYMENT_TYPE = "preferences.employmentTypes",
    REMOTE_PREFERENCE = "preferences.remoteOk",
    PREFERRED_LOCATION = "preferences.locations",
    PREFERRED_LOCATION_MULTI = "preferences.locationsMulti",  // For multi-select location preferences
    NOTICE_PERIOD = "preferences.noticePeriod",
    AVAILABILITY_DATE = "preferences.availabilityDate",
    REASON_LEAVING = "application.reasonLeaving",
    HAS_DIPLOMA = "education.hasDiploma",
    HAS_NON_COMPETE = "application.hasNonCompete",
    HAS_RELATIVES = "application.hasRelatives",
    WORKED_FOR_COMPANY = "application.workedForCompany",
    SIGNED_AGREEMENT = "application.signedAgreement",
    PROVIDING_SERVICES = "application.providingServices",
    WORKED_FOR_US_GOV = "application.workedForUSGov",
    MILITARY_HOUSEHOLD = "eeo.militaryHousehold",
    DATE_OF_BIRTH = "personal.dateOfBirth",
    AGE = "personal.age",
    NATIONALITY = "personal.nationality",
    MARITAL_STATUS = "personal.maritalStatus",
    SALARY_EXPECTATIONS = "preferences.salaryExpectations",
    SALARY_RANGE_ACKNOWLEDGMENT = "application.salaryRangeAcknowledgment",  // Acknowledge posted salary range
    SECURITY_CLEARANCE = "workAuthorization.securityClearance",
    REFERENCE_NAME = "application.referenceName",
    REFERENCE_PHONE = "application.referencePhone",
    DRIVER_LICENSE = "workAuthorization.driverLicense",
    DEBARRED_SUSPENDED = "application.debarredSuspended",
    RETAINED_BY_US_GOV = "application.retainedByUSGov",
    TOP_SECRET_CLEARANCE = "workAuthorization.topSecretClearance",
    APPLICANT_SIGNATURE = "personal.applicantSignature",
    AUTHORIZE_RESUME_USE = "application.authorizeResumeUse",
    CAPABLE_OF_DUTIES = "application.capableOfDuties",
    ALLOW_SMS = "application.allowSmsMessages",
    AGREE_TO_TERMS = "application.agreeToTerms",
    CONSENT_TO_CALLS = "application.consentToPhoneCalls",
    MARYLAND_RESIDENT = "personal.marylandResident",
    OPEN_TO_W2 = "preferences.openToW2Contract",
    CURRENT_COMPENSATION = "preferences.currentCompensation",
    PROJECT_HIGHLIGHTS = "personal.keyProjectHighlights",
    OVERALL_SUMMARY = "personal.overallSummary",
    PROFILE_BULLETS = "personal.profileBulletPoints",
    SKILLS_CAPABILITIES = "personal.skillsAndCapabilities",
    CORE_COMPETENCIES = "personal.coreCompetencies",
    RESUME = "documents.resume.base64",
    COVER_LETTER = "documents.coverLetter.base64",

    // NEW: Application source tracking
    REFERRAL_SOURCE = "application.referralSource",  // Who referred you
    HOW_HEARD_ABOUT_US = "application.howHeardAboutUs",  // "I found you" vs "You found me"
    WHERE_HEARD_ABOUT_US = "application.whereHeardAboutUs",  // LinkedIn, Indeed, etc.

    // NEW: Company-specific questions
    CONSULTING_FIRM = "application.consultingFirm",  // Which consulting firm
    PREVIOUS_COMPANY = "experience.previousCompany",
}

export const INTENT_PATTERNS: {
    intent: CanonicalIntent;
    patterns: RegExp[];
    isProtected?: boolean; // EEO fields
}[] = [
        // Personal Information
        {
            intent: CanonicalIntent.FIRST_NAME,
            patterns: [/first\s*name/i, /given\s*name/i, /^name$/i],
        },
        {
            intent: CanonicalIntent.LAST_NAME,
            patterns: [/last\s*name/i, /surname/i, /family\s*name/i],
        },
        {
            intent: CanonicalIntent.FULL_NAME,
            patterns: [/full\s*name/i, /legal\s*name/i],
        },
        {
            intent: CanonicalIntent.PREFERRED_NAME,
            patterns: [/preferred\s*name/i, /nickname/i, /called/i],
        },
        {
            intent: CanonicalIntent.EMAIL,
            patterns: [/email/i, /e-mail/i],
        },
        {
            intent: CanonicalIntent.PHONE,
            patterns: [
                /^phone$/i,
                /phone\s*number/i,
                /mobile\s*phone/i,
                /^mobile$/i,
                /cell\s*phone/i,
                /telephone/i,
                /contact\s*number/i,
                /daytime\s*phone/i,
            ],
        },
        {
            intent: CanonicalIntent.CITY,
            patterns: [/\bcity\b/i],
        },
        {
            intent: CanonicalIntent.STATE,
            patterns: [/\bstate\b/i, /province/i],
        },
        {
            intent: CanonicalIntent.COUNTRY,
            patterns: [/country/i],
        },
        {
            intent: CanonicalIntent.ZIP_CODE,
            patterns: [/zip\s*code/i, /postal\s*code/i, /postcode/i],
        },
        {
            intent: CanonicalIntent.ADDRESS,
            patterns: [/address/i, /street/i],
        },
        {
            intent: CanonicalIntent.LINKEDIN,
            patterns: [/linkedin/i, /linked\s*in/i],
        },
        {
            intent: CanonicalIntent.GITHUB,
            patterns: [/github/i],
        },
        {
            intent: CanonicalIntent.PORTFOLIO,
            patterns: [/portfolio/i, /website/i, /personal\s*site/i],
        },

        // Work Authorization
        {
            intent: CanonicalIntent.AUTHORIZED_US,
            patterns: [
                /authorized.*work/i,
                /legally.*work/i,
                /right.*work/i,
                /work.*authorization/i,
                /eligible.*work/i,
            ],
            isProtected: true,
        },
        {
            intent: CanonicalIntent.CITIZENSHIP_STATUS,
            patterns: [
                /citizen/i,
                /national/i,
                /permanent\s*resident/i,
                /green\s*card/i,
                /export\s*controls/i,
                /protected\s*individual/i,
                /8\s*U\.S\.C\.\s*1324b/i,
            ],
            isProtected: true,
        },
        {
            intent: CanonicalIntent.NEEDS_SPONSORSHIP,
            patterns: [
                /visa.*sponsor/i,
                /sponsor.*visa/i,
                /require.*sponsor/i,
                /need.*sponsor/i,
                /h1b/i,
            ],
            isProtected: true,
        },
        {
            intent: CanonicalIntent.PREVIOUSLY_APPLIED,
            patterns: [/previously\s*applied/i, /applied.*before/i, /prior\s*application/i],
        },
        {
            intent: CanonicalIntent.PREVIOUSLY_EMPLOYED,
            patterns: [/previously\s*employed/i, /worked.*before/i, /former\s*employee/i, /employed\s*by/i],
        },
        {
            intent: CanonicalIntent.CONFLICT_OF_INTEREST,
            patterns: [/conflict\s*of\s*interest/i, /competing\s*interest/i],
        },
        {
            intent: CanonicalIntent.GOVERNMENT_BACKGROUND,
            patterns: [/government\s*employee/i, /worked.*government/i, /public\s*official/i, /legislative/i, /congressional/i],
        },
        {
            intent: CanonicalIntent.NEEDS_FUTURE_SPONSORSHIP,
            patterns: [/future.*sponsor/i, /sponsor.*future/i],
            isProtected: true,
        },

        {
            intent: CanonicalIntent.GENDER,
            patterns: [/\bgender\b/i, /sex\b/i, /identify.+\bgender\b/i],
            isProtected: true,
        },
        {
            intent: CanonicalIntent.RACE,
            patterns: [/\brace\b/i, /ethnicity/i, /ethnic/i, /racial.*group/i],
            isProtected: true,
        },
        {
            intent: CanonicalIntent.HISPANIC,
            patterns: [/hispanic/i, /latino/i, /latina/i, /latinx/i, /spanish.*origin/i],
            isProtected: true,
        },
        {
            intent: CanonicalIntent.VETERAN,
            patterns: [/veteran/i, /military/i, /armed\s*forces/i, /discharge/i],
            isProtected: true,
        },
        {
            intent: CanonicalIntent.DISABILITY,
            patterns: [/disability/i, /disabled/i, /handicap/i, /mental.*physical.*impairment/i],
            isProtected: true,
        },
        {
            intent: CanonicalIntent.LGBTQ,
            patterns: [/transgender/i, /lgbtq/i, /lgbt/i, /queer/i],
            isProtected: true,
        },
        {
            intent: CanonicalIntent.SEXUAL_ORIENTATION,
            patterns: [/sexual\s*orientation/i, /straight/i, /gay/i, /lesbian/i, /bisexual/i],
            isProtected: true,
        },

        // Education
        {
            intent: CanonicalIntent.SCHOOL,
            patterns: [
                /school/i,
                /university/i,
                /college/i,
                /institution/i,
                /alma\s*mater/i,
            ],
        },
        {
            intent: CanonicalIntent.DEGREE,
            patterns: [/degree/i, /qualification/i, /education\s*level/i],
        },
        {
            intent: CanonicalIntent.MAJOR,
            patterns: [/major/i, /field\s*of\s*study/i, /area\s*of\s*study/i, /subject/i],
        },
        {
            intent: CanonicalIntent.GPA,
            patterns: [/gpa/i, /grade\s*point/i],
        },
        {
            intent: CanonicalIntent.GRADUATION_DATE,
            patterns: [
                /graduation/i,
                /graduated/i,
                /completion\s*date/i,
                /end\s*date.*education/i,
            ],
        },

        // Experience
        {
            intent: CanonicalIntent.COMPANY,
            patterns: [
                /company/i,
                /employer/i,
                /organization/i,
                /current.*company/i,
                /previous.*company/i,
            ],
        },
        {
            intent: CanonicalIntent.JOB_TITLE,
            patterns: [
                /job\s*title/i,
                /position/i,
                /role/i,
                /current\s*title/i,
                /previous\s*title/i,
            ],
        },
        {
            intent: CanonicalIntent.START_DATE_WORK,
            patterns: [/start\s*date/i, /from\s*date/i, /began/i],
        },
        {
            intent: CanonicalIntent.END_DATE_WORK,
            patterns: [/end\s*date/i, /to\s*date/i, /until/i],
        },

        // Skills & Preferences
        {
            intent: CanonicalIntent.SKILLS,
            patterns: [/skills/i, /technical\s*skills/i, /competencies/i],
        },
        {
            intent: CanonicalIntent.YEARS_OF_EXPERIENCE,
            patterns: [
                /years.*experience/i,
                /experience.*years/i,
                /how\s*long.*worked/i,
            ],
        },
        {
            intent: CanonicalIntent.EMPLOYMENT_TYPE,
            patterns: [
                /employment\s*type/i,
                /job\s*type/i,
                /full.*time/i,
                /part.*time/i,
                /contract/i,
            ],
        },
        {
            intent: CanonicalIntent.REMOTE_PREFERENCE,
            patterns: [/remote/i, /work\s*from\s*home/i, /hybrid/i, /on.*site/i],
        },
        {
            intent: CanonicalIntent.PREFERRED_LOCATION,
            patterns: [
                /preferred\s*location/i,
                /willing.*relocate/i,
                /location\s*preference/i,
            ],
        },
        {
            intent: CanonicalIntent.NOTICE_PERIOD,
            patterns: [/notice\s*period/i, /availability/i, /when.*start/i],
        },
        {
            intent: CanonicalIntent.REASON_LEAVING,
            patterns: [/reason.*leaving/i, /why.*left/i, /why.*leave/i],
        },
        {
            intent: CanonicalIntent.HAS_DIPLOMA,
            patterns: [/high\s*school\s*diploma/i, /ged/i],
        },
        {
            intent: CanonicalIntent.HAS_NON_COMPETE,
            patterns: [/non-compete/i, /restrictive\s*covenant/i],
        },
        {
            intent: CanonicalIntent.HAS_RELATIVES,
            patterns: [/relatives.*working/i, /family.*member.*company/i, /related.*to.*employee/i, /relationship.*to.*employee/i],
        },
        {
            intent: CanonicalIntent.SIGNED_AGREEMENT,
            patterns: [/signed.*agreement/i, /accept.*terms/i],
        },
        {
            intent: CanonicalIntent.PROVIDING_SERVICES,
            patterns: [/providing\s*services/i, /independent\s*contractor/i],
        },
        {
            intent: CanonicalIntent.WORKED_FOR_US_GOV,
            patterns: [/worked.*us\s*government/i, /federal.*employee/i],
        },
        {
            intent: CanonicalIntent.MILITARY_HOUSEHOLD,
            patterns: [/military\s*household/i, /military\s*spouse/i],
            isProtected: true,
        },
        {
            intent: CanonicalIntent.DATE_OF_BIRTH,
            patterns: [/date\s*of\s*birth/i, /birth\s*date/i, /dob/i],
        },
        {
            intent: CanonicalIntent.AGE,
            patterns: [/\bage\b/i, /18\s*years\s*or\s*older/i],
        },
        {
            intent: CanonicalIntent.NATIONALITY,
            patterns: [/nationality/i, /country\s*of\s*origin/i],
        },
        {
            intent: CanonicalIntent.MARITAL_STATUS,
            patterns: [/marital\s*status/i],
        },
        {
            intent: CanonicalIntent.SALARY_EXPECTATIONS,
            patterns: [/expected.*salary/i, /salary.*expectations/i, /desired.*compensation/i],
        },
        {
            intent: CanonicalIntent.SECURITY_CLEARANCE,
            patterns: [/security\s*clearance/i, /active\s*clearance/i],
        },
        {
            intent: CanonicalIntent.REFERENCE_NAME,
            patterns: [/reference\s*name/i, /referee/i],
        },
        {
            intent: CanonicalIntent.REFERENCE_PHONE,
            patterns: [/reference\s*phone/i],
        },
        {
            intent: CanonicalIntent.DRIVER_LICENSE,
            patterns: [/drivers?\s*license/i, /driving\s*license/i, /valid\s*dl\b/i, /have.*valid.*license/i],
        },
        {
            intent: CanonicalIntent.DEBARRED_SUSPENDED,
            patterns: [/debarred/i, /suspended.*government/i],
        },
        {
            intent: CanonicalIntent.RETAINED_BY_US_GOV,
            patterns: [/retained.*us\s*government/i],
        },
        {
            intent: CanonicalIntent.TOP_SECRET_CLEARANCE,
            patterns: [/top\s*secret/i, /sci\b/i],
        },
        {
            intent: CanonicalIntent.APPLICANT_SIGNATURE,
            patterns: [/applicant\s*signature/i, /type.*name.*sign/i],
        },
        {
            intent: CanonicalIntent.AUTHORIZE_RESUME_USE,
            patterns: [/authorize.*use.*resume/i],
        },
        {
            intent: CanonicalIntent.CAPABLE_OF_DUTIES,
            patterns: [/capable.*duties/i, /perform.*essential.*functions/i],
        },
        {
            intent: CanonicalIntent.ALLOW_SMS,
            patterns: [/sms\s*messages/i, /text\s*messages/i, /opt-in.*text/i],
        },
        {
            intent: CanonicalIntent.CONSENT_TO_CALLS,
            patterns: [/consent.*phone\s*calls/i],
        },
        {
            intent: CanonicalIntent.MARYLAND_RESIDENT,
            patterns: [/maryland\s*resident/i],
        },
        {
            intent: CanonicalIntent.OPEN_TO_W2,
            patterns: [/w2\s*contract/i, /open.*to\s*w2/i],
        },
        {
            intent: CanonicalIntent.CURRENT_COMPENSATION,
            patterns: [/current\s*base\s*salary/i, /current\s*compensation/i],
        },
        {
            intent: CanonicalIntent.RESUME,
            patterns: [/resume/i, /cv\b/i, /curriculum\s*vitae/i, /attach\s*your\s*resume/i],
        },
        {
            intent: CanonicalIntent.COVER_LETTER,
            patterns: [/cover\s*letter/i, /supporting\s*document/i, /additional\s*file/i],
        },
    ];
