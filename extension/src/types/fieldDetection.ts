export enum FieldType {
    TEXT = "text",
    TEXTAREA = "textarea",
    EMAIL = "email",
    PHONE = "phone",
    NUMBER = "number",
    RADIO_GROUP = "radio_group",
    CHECKBOX = "checkbox",
    SELECT_NATIVE = "select_native",
    DROPDOWN_CUSTOM = "dropdown_custom",
    MULTISELECT = "multiselect",
    DATE = "date",
    FILE_UPLOAD = "file_upload",
}

export enum QuestionSection {
    PERSONAL = "personal",
    EDUCATION = "education",
    EXPERIENCE = "experience",
    SKILLS = "skills",
    WORK_AUTHORIZATION = "work_authorization",
    EEO = "eeo",
    PREFERENCES = "preferences",
    OTHER = "other",
}

export interface DetectedField {
    // DOM reference
    element: HTMLElement;

    // Extracted metadata
    questionText: string;
    fieldType: FieldType;
    isRequired: boolean;

    // For select/radio - available options
    options?: string[];

    // Classification
    section: QuestionSection;

    // Mapping result
    canonicalKey?: string;
    confidence: number;

    // Fill status
    filled: boolean;
    skipped: boolean;
    skipReason?: string;
    filledValue?: any;
    fileName?: string;
}

export interface FieldDetectionResult {
    fields: DetectedField[];
    requiredCount: number;
    optionalCount: number;
    requiredFilledCount: number;
    optionalFilledCount: number;
}
