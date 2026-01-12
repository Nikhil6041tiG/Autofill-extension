import React, { useState } from "react";
import { CanonicalProfile, EMPTY_PROFILE } from "../../types/canonicalProfile";
import { Gender, Race, YesNoDecline, SexualOrientation } from "../../types/canonicalEnums";
import { saveProfile } from "../../core/storage/profileStorage";
import { mapMultiSourceToProfile } from "../../core/mapping/apiMapper";
import "./Onboarding.css";

const Onboarding: React.FC = () => {
    const [step, setStep] = useState(1);
    const [profile, setProfile] = useState<CanonicalProfile>(EMPTY_PROFILE);
    const [fetching, setFetching] = useState(false);
    const [apwId, setApwId] = useState("");

    const handleApiFetch = async () => {
        if (!apwId.trim()) {
            alert("Please enter a valid APW ID");
            return;
        }

        const normalizedId = apwId.trim().toUpperCase();
        setApwId(normalizedId);

        setFetching(true);
        try {
            // 1. Fetch from Local Lead Details API
            let localData = {};
            let isLocalSuccess = false;
            try {
                // Changed to use configurable Backend URL (defaulting to port 3000 which proxies to 8000)
                const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3000';
                const localResponse = await fetch(`${backendUrl}/api/lead-details/${normalizedId}`);
                if (!localResponse.ok) {
                    console.warn(`Local API Error: ${localResponse.status}`);
                } else {
                    localData = await localResponse.json();
                    isLocalSuccess = true;
                }
            } catch (e) {
                console.warn("Local API unreachable, skipping:", e);
                // Continue execution to try Vercel API
            }

            // 2. Fetch from Vercel Client Details API
            const vercelResponse = await fetch(`https://ticketingtoolapplywizz.vercel.app/api/get-client-details?applywizz_id=${normalizedId}`);
            if (!vercelResponse.ok) {
                console.warn(`Vercel API Error: ${vercelResponse.status}`);
            }
            const vercelData = vercelResponse.ok ? await vercelResponse.json() : {};

            if (!isLocalSuccess && !vercelResponse.ok) {
                throw new Error("Failed to fetch data from both sources.");
            }

            // 3. Map multi-source data to profile
            const mappedProfile = mapMultiSourceToProfile(localData, vercelData, profile);

            // Set the apwId in metadata
            mappedProfile.metadata = {
                ...mappedProfile.metadata,
                apwId: normalizedId
            };

            setProfile(mappedProfile);
            await saveProfile(mappedProfile);
            alert("Profile successfully fetched from both API sources!");
        } catch (error) {
            console.error("API Fetch Error:", error);
            alert("Failed to fetch data from APIs. Please fill out manually.");
        } finally {
            setFetching(false);
        }
    };

    const handleSaveProfile = async () => {
        try {
            await saveProfile(profile);
            window.close();
        } catch (error) {
            alert("Failed to save profile");
        }
    };

    const updateProfile = (updates: Partial<CanonicalProfile>) => {
        setProfile({ ...profile, ...updates });
    };

    const totalSteps = 5;

    return (
        <div className="onboarding-container">
            <div className="onboarding-progress">
                <div className="progress-steps">
                    <div className={`progress-step ${step >= 1 ? "active" : ""}`}>1. Personal</div>
                    <div className={`progress-step ${step >= 2 ? "active" : ""}`}>2. Education</div>
                    <div className={`progress-step ${step >= 3 ? "active" : ""}`}>3. Work Experience</div>
                    <div className={`progress-step ${step >= 4 ? "active" : ""}`}>4. Skills</div>
                    <div className={`progress-step ${step >= 5 ? "active" : ""}`}>5. Equal Employment</div>
                </div>
                <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${(step / totalSteps) * 100}%` }} />
                </div>
            </div>

            <div className="onboarding-content">
                {step === 1 && (
                    <StepPersonal
                        profile={profile}
                        updateProfile={updateProfile}
                        apwId={apwId}
                        setApwId={setApwId}
                        onApiFetch={handleApiFetch}
                        fetching={fetching}
                        onNext={() => setStep(2)}
                    />
                )}
                {step === 2 && (
                    <StepEducation profile={profile} updateProfile={updateProfile} onNext={() => setStep(3)} onBack={() => setStep(1)} />
                )}
                {step === 3 && (
                    <StepExperience profile={profile} updateProfile={updateProfile} onNext={() => setStep(4)} onBack={() => setStep(2)} />
                )}
                {step === 4 && (
                    <StepSkills profile={profile} updateProfile={updateProfile} onNext={() => setStep(5)} onBack={() => setStep(3)} />
                )}
                {step === 5 && (
                    <StepEqualEmployment profile={profile} updateProfile={updateProfile} onFinish={handleSaveProfile} onBack={() => setStep(4)} />
                )}
            </div>
        </div>
    );
};

// Step Components

const StepPersonal: React.FC<{
    profile: CanonicalProfile;
    updateProfile: (u: Partial<CanonicalProfile>) => void;
    apwId: string;
    setApwId: (id: string) => void;
    onApiFetch: () => void;
    fetching: boolean;
    onNext: () => void
}> = ({ profile, updateProfile, apwId, setApwId, onApiFetch, fetching, onNext }) => {
    const hasData = profile.personal.firstName || profile.personal.email || profile.metadata?.apiData;

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'resume' | 'coverLetter') => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== "application/pdf") {
            alert("Please upload a PDF file");
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64 = event.target?.result as string;
            updateProfile({
                documents: {
                    ...profile.documents,
                    [type]: {
                        base64,
                        fileName: file.name
                    }
                }
            });
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="step">
            <div className="step-header">
                <h1>🎉 Great! Let's get started with your basic info.</h1>
            </div>

            <div className="step-header" style={{ marginTop: '10px', marginBottom: '20px', background: '#f0f4ff', padding: '15px', borderRadius: '12px', border: '1px solid #d0d7f7' }}>
                <h2 style={{ color: '#3f51b5', fontSize: '18px', margin: '0 0 10px 0' }}>📄 Application Documents</h2>
                <p style={{ color: '#666', fontSize: '13px', margin: '0 0 15px 0' }}>Upload your latest Resume and Cover Letter (PDF only) to be used for automated applications.</p>
                <div className="form-row" style={{ marginBottom: '0' }}>
                    <div className="form-field" style={{ marginBottom: '0' }}>
                        <label style={{ fontSize: '12px', fontWeight: '600' }}>Resume (PDF)</label>
                        <div className="file-upload-wrapper">
                            <input
                                type="file"
                                accept=".pdf,application/pdf"
                                onChange={(e) => handleFileUpload(e, 'resume')}
                                id="resume-upload"
                                style={{ display: 'none' }}
                            />
                            <label htmlFor="resume-upload" className="file-upload-label" style={{ padding: '10px', fontSize: '13px' }}>
                                {profile.documents?.resume ? `✅ ${profile.documents.resume.fileName}` : "Upload Resume"}
                            </label>
                        </div>
                    </div>
                    <div className="form-field" style={{ marginBottom: '0' }}>
                        <label style={{ fontSize: '12px', fontWeight: '600' }}>Cover Letter (PDF)</label>
                        <div className="file-upload-wrapper">
                            <input
                                type="file"
                                accept=".pdf,application/pdf"
                                onChange={(e) => handleFileUpload(e, 'coverLetter')}
                                id="coverletter-upload"
                                style={{ display: 'none' }}
                            />
                            <label htmlFor="coverletter-upload" className="file-upload-label" style={{ padding: '10px', fontSize: '13px' }}>
                                {profile.documents?.coverLetter ? `✅ ${profile.documents.coverLetter.fileName}` : "Upload Cover Letter"}
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            {!hasData && (
                <div className="onboarding-source-options">
                    <div className="api-fetch-section">
                        <h3>Fetch from Portfolio ID</h3>
                        <div className="api-input-group">
                            <input
                                type="text"
                                value={apwId}
                                onChange={(e) => setApwId(e.target.value.toUpperCase())}
                                placeholder="e.g. AWL-1712"
                                className="apw-id-input"
                            />
                            <button
                                onClick={onApiFetch}
                                disabled={fetching || !apwId}
                                className="api-fetch-btn"
                            >
                                {fetching ? "Fetching..." : "Fetch Data"}
                            </button>
                        </div>
                    </div>

                    <p className="or-divider">— OR —</p>
                    <p className="manual-info">Fill out your profile manually below</p>
                </div>
            )}

            <div className="form-row">
                <div className="form-field">
                    <label>* First Name</label>
                    <input type="text" value={profile.personal.firstName} onChange={(e) => updateProfile({ personal: { ...profile.personal, firstName: e.target.value } })} />
                </div>
                <div className="form-field">
                    <label>* Last Name</label>
                    <input type="text" value={profile.personal.lastName} onChange={(e) => updateProfile({ personal: { ...profile.personal, lastName: e.target.value } })} />
                </div>
            </div>

            <div className="form-field">
                <label>Preferred Name</label>
                <input type="text" value={profile.personal.preferredName || ""} onChange={(e) => updateProfile({ personal: { ...profile.personal, preferredName: e.target.value } })} placeholder="How should we call you?" />
            </div>

            <div className="form-row">
                <div className="form-field">
                    <label>* Email</label>
                    <input type="email" value={profile.personal.email} onChange={(e) => updateProfile({ personal: { ...profile.personal, email: e.target.value } })} />
                </div>
                <div className="form-field">
                    <label>* Phone</label>
                    <input type="tel" value={profile.personal.phone || ""} onChange={(e) => updateProfile({ personal: { ...profile.personal, phone: e.target.value } })} />
                </div>
            </div>

            <div className="form-row">
                <div className="form-field">
                    <label>City</label>
                    <input type="text" value={profile.personal.city || ""} onChange={(e) => updateProfile({ personal: { ...profile.personal, city: e.target.value } })} placeholder="San Francisco" />
                </div>
                <div className="form-field">
                    <label>State / Province</label>
                    <input type="text" value={profile.personal.state || ""} onChange={(e) => updateProfile({ personal: { ...profile.personal, state: e.target.value } })} placeholder="CA" />
                </div>
            </div>

            <div className="form-row">
                <div className="form-field">
                    <label>Country</label>
                    <input type="text" value={profile.personal.country || ""} onChange={(e) => updateProfile({ personal: { ...profile.personal, country: e.target.value } })} placeholder="United States" />
                </div>
                <div className="form-field">
                    <label>Postal Code</label>
                    <input type="text" value={profile.personal.postalCode || ""} onChange={(e) => updateProfile({ personal: { ...profile.personal, postalCode: e.target.value } })} />
                </div>
            </div>

            <div className="form-row">
                <div className="form-field">
                    <label>* LinkedIn URL</label>
                    <input type="url" value={profile.personal.linkedin || ""} onChange={(e) => updateProfile({ personal: { ...profile.personal, linkedin: e.target.value } })} placeholder="https://linkedin.com/in/yourprofile" />
                </div>
                <div className="form-field">
                    <label>Github URL</label>
                    <input type="url" value={profile.personal.github || ""} onChange={(e) => updateProfile({ personal: { ...profile.personal, github: e.target.value } })} placeholder="https://github.com/yourusername" />
                </div>
            </div>

            <button className="next-btn" onClick={onNext}>Next</button>
        </div >
    );
};

const StepEducation: React.FC<{ profile: CanonicalProfile; updateProfile: (u: Partial<CanonicalProfile>) => void; onNext: () => void; onBack: () => void }> = ({ profile, updateProfile, onNext, onBack }) => {
    const addEducation = () => {
        updateProfile({
            education: [...profile.education, { school: "", degree: "", major: "", startDate: "", endDate: "", gpa: "" }]
        });
    };

    const removeEducation = (index: number) => {
        const updated = profile.education.filter((_, i) => i !== index);
        updateProfile({ education: updated });
    };

    const updateEducation = (index: number, field: string, value: string | boolean) => {
        const updated = [...profile.education];
        updated[index] = { ...updated[index], [field]: value };
        updateProfile({ education: updated });
    };

    return (
        <div className="step">
            <div className="step-header">
                <h1>📚 Next, please review and confirm your education history.</h1>
            </div>

            {profile.education.map((edu, idx) => (
                <div key={idx} className="entry-box">
                    <div className="entry-header">
                        <h3>Education {idx + 1}</h3>
                        {profile.education.length > 1 && (
                            <button className="remove-icon-btn" onClick={() => removeEducation(idx)}>🗑️</button>
                        )}
                    </div>

                    <div className="form-field">
                        <label>* School Name</label>
                        <input type="text" value={edu.school} onChange={(e) => updateEducation(idx, "school", e.target.value)} />
                    </div>

                    <div className="form-row">
                        <div className="form-field">
                            <label>* Major</label>
                            <input type="text" value={edu.major || ""} onChange={(e) => updateEducation(idx, "major", e.target.value)} placeholder="Computer Science" />
                        </div>
                        <div className="form-field">
                            <label>* Degree Type</label>
                            <select value={edu.degree} onChange={(e) => updateEducation(idx, "degree", e.target.value)}>
                                <option value="">Select...</option>
                                <option value="Bachelor of Science">Bachelor of Science</option>
                                <option value="Bachelor of Arts">Bachelor of Arts</option>
                                <option value="Master of Science">Master of Science</option>
                                <option value="Master of Arts">Master of Arts</option>
                                <option value="MBA">MBA</option>
                                <option value="PhD">PhD</option>
                                <option value="Associate">Associate</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-field">
                            <label>Start Date</label>
                            <input type="text" value={edu.startDate || ""} onChange={(e) => updateEducation(idx, "startDate", e.target.value)} placeholder="2023-01" />
                        </div>
                        <div className="form-field">
                            <label>End Date</label>
                            <input type="text" value={edu.endDate || ""} onChange={(e) => updateEducation(idx, "endDate", e.target.value)} placeholder="2024-12" />
                        </div>
                    </div>

                    <div className="form-field">
                        <label>
                            <input type="checkbox" checked={edu.currentlyStudying || false} onChange={(e) => updateEducation(idx, "currentlyStudying", e.target.checked)} />
                            I currently study here
                        </label>
                    </div>

                    <div className="form-field">
                        <label>GPA</label>
                        <input type="text" value={edu.gpa || ""} onChange={(e) => updateEducation(idx, "gpa", e.target.value)} placeholder="3.8" style={{ width: "100px" }} />
                    </div>
                </div>
            ))}

            <button className="add-btn" onClick={addEducation}>+ Add Education</button>

            <div className="button-row">
                <button onClick={onBack}>Back</button>
                <button className="next-btn" onClick={onNext}>Next</button>
            </div>
        </div>
    );
};

const StepExperience: React.FC<{ profile: CanonicalProfile; updateProfile: (u: Partial<CanonicalProfile>) => void; onNext: () => void; onBack: () => void }> = ({ profile, updateProfile, onNext, onBack }) => {
    const addExperience = () => {
        updateProfile({
            experience: [...profile.experience, { company: "", title: "", startDate: "", endDate: "", location: "", bullets: [] }]
        });
    };

    const removeExperience = (index: number) => {
        const updated = profile.experience.filter((_, i) => i !== index);
        updateProfile({ experience: updated });
    };

    const updateExperience = (index: number, field: string, value: string | string[] | boolean) => {
        const updated = [...profile.experience];
        updated[index] = { ...updated[index], [field]: value };
        updateProfile({ experience: updated });
    };

    return (
        <div className="step">
            <div className="step-header">
                <h1>🔍 Halfway there! Let's double-check your work experience.</h1>
            </div>

            {profile.experience.map((exp, idx) => (
                <div key={idx} className="entry-box">
                    <div className="entry-header">
                        <h3>Work Experience {idx + 1}</h3>
                        {profile.experience.length > 1 && (
                            <button className="remove-icon-btn" onClick={() => removeExperience(idx)}>🗑️</button>
                        )}
                    </div>

                    <div className="form-field">
                        <label>* Job Title</label>
                        <input type="text" value={exp.title} onChange={(e) => updateExperience(idx, "title", e.target.value)} />
                    </div>

                    <div className="form-field">
                        <label>* Company</label>
                        <input type="text" value={exp.company} onChange={(e) => updateExperience(idx, "company", e.target.value)} />
                    </div>

                    <div className="form-row">
                        <div className="form-field">
                            <label>* Job Type</label>
                            <select value={exp.jobType || ""} onChange={(e) => updateExperience(idx, "jobType", e.target.value)}>
                                <option value="">Select...</option>
                                <option value="Full-time">Full-time</option>
                                <option value="Part-time">Part-time</option>
                                <option value="Contract">Contract</option>
                                <option value="Internship">Internship</option>
                            </select>
                        </div>
                        <div className="form-field">
                            <label>Location</label>
                            <input type="text" value={exp.location || ""} onChange={(e) => updateExperience(idx, "location", e.target.value)} placeholder="Hyderabad, India" />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-field">
                            <label>Start Date</label>
                            <input type="text" value={exp.startDate || ""} onChange={(e) => updateExperience(idx, "startDate", e.target.value)} placeholder="2021-08" />
                        </div>
                        <div className="form-field">
                            <label>End Date</label>
                            <input type="text" value={exp.endDate || ""} onChange={(e) => updateExperience(idx, "endDate", e.target.value)} placeholder="2023-01" />
                        </div>
                    </div>

                    <div className="form-field">
                        <label>
                            <input type="checkbox" checked={exp.currentlyWorking || false} onChange={(e) => updateExperience(idx, "currentlyWorking", e.target.checked)} />
                            I currently work here
                        </label>
                    </div>

                    <div className="form-field">
                        <label>Responsibilities / Summary</label>
                        <textarea
                            value={exp.bullets?.join('\n') || ""}
                            onChange={(e) => updateExperience(idx, "bullets", e.target.value.split('\n'))}
                            rows={5}
                            placeholder="Describe your key achievements and responsibilities..."
                        />
                    </div>
                </div>
            ))}

            <button className="add-btn" onClick={addExperience}>+ Add Experience</button>

            <div className="button-row">
                <button onClick={onBack}>Back</button>
                <button className="next-btn" onClick={onNext}>Next</button>
            </div>
        </div>
    );
};

const StepSkills: React.FC<{ profile: CanonicalProfile; updateProfile: (u: Partial<CanonicalProfile>) => void; onNext: () => void; onBack: () => void }> = ({ profile, updateProfile, onNext, onBack }) => {
    const [skillInput, setSkillInput] = useState("");

    const addSkill = () => {
        if (skillInput.trim()) {
            updateProfile({ skills: [...profile.skills, skillInput.trim()] });
            setSkillInput("");
        }
    };

    const removeSkill = (index: number) => {
        updateProfile({ skills: profile.skills.filter((_, i) => i !== index) });
    };

    return (
        <div className="step">
            <div className="step-header">
                <h1>💼 Add your skills</h1>
            </div>

            <div className="skills-container">
                {profile.skills.map((skill, idx) => (
                    <div key={idx} className="skill-tag">
                        {skill}
                        <button className="skill-remove" onClick={() => removeSkill(idx)}>×</button>
                    </div>
                ))}
            </div>

            <div className="skill-input-row">
                <input
                    type="text"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && addSkill()}
                    placeholder="Type a skill and press Enter"
                />
                <button onClick={addSkill}>Add</button>
            </div>

            <div className="button-row">
                <button onClick={onBack}>Back</button>
                <button className="next-btn" onClick={onNext}>Next</button>
            </div>
        </div>
    );
};

const StepEqualEmployment: React.FC<{ profile: CanonicalProfile; updateProfile: (u: Partial<CanonicalProfile>) => void; onFinish: () => void; onBack: () => void }> = ({ profile, updateProfile, onFinish, onBack }) => {
    const [agreed, setAgreed] = useState(false);

    const handleFinish = async () => {
        if (!agreed) {
            alert("Please agree to the consent terms");
            return;
        }

        // Create final profile with consent fixed
        const finalProfile = {
            ...profile,
            consent: {
                agreedToAutofill: true,
                agreedAt: new Date().toISOString()
            }
        };

        try {
            await saveProfile(finalProfile);
            window.close();
        } catch (error) {
            alert("Failed to save profile");
        }
    };

    return (
        <div className="step">
            <div className="step-header">
                <h1>🎊 Last step! Share your equal employment info for a faster application process.</h1>
            </div>

            <div className="eeo-section">
                <div className="eeo-question">
                    <label>* Are You Authorized To Work In The US?</label>
                    <div className="radio-group">
                        <label><input type="radio" checked={profile.workAuthorization.authorizedUS === true} onChange={() => updateProfile({ workAuthorization: { ...profile.workAuthorization, authorizedUS: true } })} /> Yes</label>
                        <label><input type="radio" checked={profile.workAuthorization.authorizedUS === false} onChange={() => updateProfile({ workAuthorization: { ...profile.workAuthorization, authorizedUS: false } })} /> No</label>
                    </div>
                </div>

                <div className="eeo-question">
                    <label>* Will You Now Or In The Future Require Sponsorship For Employment Visa Status?</label>
                    <div className="radio-group">
                        <label><input type="radio" checked={profile.workAuthorization.needsSponsorship === true} onChange={() => updateProfile({ workAuthorization: { ...profile.workAuthorization, needsSponsorship: true } })} /> Yes</label>
                        <label><input type="radio" checked={profile.workAuthorization.needsSponsorship === false} onChange={() => updateProfile({ workAuthorization: { ...profile.workAuthorization, needsSponsorship: false } })} /> No</label>
                    </div>
                </div>

                <div className="eeo-question">
                    <label>* Citizenship / Export Control Status</label>
                    <select value={profile.workAuthorization.citizenshipStatus || ""} onChange={(e) => updateProfile({ workAuthorization: { ...profile.workAuthorization, citizenshipStatus: e.target.value } })}>
                        <option value="">Select...</option>
                        <option value="citizen">US Citizen or National</option>
                        <option value="permanent_resident">Permanent Resident (Green Card)</option>
                        <option value="refugee">Refugee</option>
                        <option value="asylee">Asylee</option>
                        <option value="other_visa">Other / None of the above</option>
                    </select>
                </div>

                <div className="eeo-question">
                    <label>Do You Have A Valid Driver's License?</label>
                    <div className="radio-group">
                        <label><input type="radio" checked={profile.workAuthorization.driverLicense === true} onChange={() => updateProfile({ workAuthorization: { ...profile.workAuthorization, driverLicense: true } })} /> Yes</label>
                        <label><input type="radio" checked={profile.workAuthorization.driverLicense === false} onChange={() => updateProfile({ workAuthorization: { ...profile.workAuthorization, driverLicense: false } })} /> No</label>
                    </div>
                </div>

                <div className="eeo-question">
                    <label>* Do You Have A Disability?</label>
                    <div className="radio-group">
                        <label><input type="radio" checked={profile.eeo.disability === YesNoDecline.YES} onChange={() => updateProfile({ eeo: { ...profile.eeo, disability: YesNoDecline.YES } })} /> Yes</label>
                        <label><input type="radio" checked={profile.eeo.disability === YesNoDecline.NO} onChange={() => updateProfile({ eeo: { ...profile.eeo, disability: YesNoDecline.NO } })} /> No</label>
                        <label><input type="radio" checked={profile.eeo.disability === YesNoDecline.DECLINE} onChange={() => updateProfile({ eeo: { ...profile.eeo, disability: YesNoDecline.DECLINE } })} /> Decline to state</label>
                    </div>
                </div>

                <div className="eeo-question">
                    <label>* Are You A Veteran?</label>
                    <div className="radio-group">
                        <label><input type="radio" checked={profile.eeo.veteran === YesNoDecline.YES} onChange={() => updateProfile({ eeo: { ...profile.eeo, veteran: YesNoDecline.YES } })} /> Yes</label>
                        <label><input type="radio" checked={profile.eeo.veteran === YesNoDecline.NO} onChange={() => updateProfile({ eeo: { ...profile.eeo, veteran: YesNoDecline.NO } })} /> No</label>
                        <label><input type="radio" checked={profile.eeo.veteran === YesNoDecline.DECLINE} onChange={() => updateProfile({ eeo: { ...profile.eeo, veteran: YesNoDecline.DECLINE } })} /> Decline to state</label>
                    </div>
                </div>

                <div className="eeo-question">
                    <label>* What Is Your Gender?</label>
                    <div className="radio-group">
                        <label><input type="radio" checked={profile.eeo.gender === Gender.MALE} onChange={() => updateProfile({ eeo: { ...profile.eeo, gender: Gender.MALE } })} /> Male</label>
                        <label><input type="radio" checked={profile.eeo.gender === Gender.FEMALE} onChange={() => updateProfile({ eeo: { ...profile.eeo, gender: Gender.FEMALE } })} /> Female</label>
                        <label><input type="radio" checked={profile.eeo.gender === Gender.NON_BINARY} onChange={() => updateProfile({ eeo: { ...profile.eeo, gender: Gender.NON_BINARY } })} /> Non-Binary</label>
                        <label><input type="radio" checked={profile.eeo.gender === Gender.DECLINE} onChange={() => updateProfile({ eeo: { ...profile.eeo, gender: Gender.DECLINE } })} /> Decline to state</label>
                    </div>
                </div>

                <div className="eeo-question">
                    <label>* Do You Identify As LGBTQ+?</label>
                    <div className="radio-group">
                        <label><input type="radio" checked={profile.eeo.lgbtq === YesNoDecline.YES} onChange={() => updateProfile({ eeo: { ...profile.eeo, lgbtq: YesNoDecline.YES } })} /> Yes</label>
                        <label><input type="radio" checked={profile.eeo.lgbtq === YesNoDecline.NO} onChange={() => updateProfile({ eeo: { ...profile.eeo, lgbtq: YesNoDecline.NO } })} /> No</label>
                        <label><input type="radio" checked={profile.eeo.lgbtq === YesNoDecline.DECLINE} onChange={() => updateProfile({ eeo: { ...profile.eeo, lgbtq: YesNoDecline.DECLINE } })} /> Decline to state</label>
                    </div>
                </div>

                <div className="eeo-question">
                    <label>* Are You Hispanic or Latino?</label>
                    <div className="radio-group">
                        <label><input type="radio" checked={profile.eeo.hispanic === YesNoDecline.YES} onChange={() => updateProfile({ eeo: { ...profile.eeo, hispanic: YesNoDecline.YES } })} /> Yes</label>
                        <label><input type="radio" checked={profile.eeo.hispanic === YesNoDecline.NO} onChange={() => updateProfile({ eeo: { ...profile.eeo, hispanic: YesNoDecline.NO } })} /> No</label>
                        <label><input type="radio" checked={profile.eeo.hispanic === YesNoDecline.DECLINE} onChange={() => updateProfile({ eeo: { ...profile.eeo, hispanic: YesNoDecline.DECLINE } })} /> Decline to state</label>
                    </div>
                </div>

                <div className="eeo-question">
                    <label>* How would you identify your race?</label>
                    <select value={profile.eeo.race} onChange={(e) => updateProfile({ eeo: { ...profile.eeo, race: e.target.value as Race } })}>
                        <option value={Race.DECLINE}>Decline to state</option>
                        <option value={Race.ASIAN}>Asian</option>
                        <option value={Race.BLACK}>Black or African American</option>
                        <option value={Race.HISPANIC}>Hispanic or Latino</option>
                        <option value={Race.WHITE}>White</option>
                        <option value={Race.AMERICAN_INDIAN}>American Indian or Alaska Native</option>
                        <option value={Race.PACIFIC_ISLANDER}>Native Hawaiian or Other Pacific Islander</option>
                        <option value={Race.TWO_OR_MORE}>Two or More Races</option>
                    </select>
                </div>

                <div className="step-header" style={{ marginTop: '20px' }}>
                    <h2>📋 Common Application Questions</h2>
                </div>

                <div className="eeo-question">
                    <label>Have you previously applied to this company?</label>
                    <div className="radio-group">
                        <label><input type="radio" checked={profile.application?.previouslyApplied === true} onChange={() => updateProfile({ application: { ...profile.application, previouslyApplied: true } })} /> Yes</label>
                        <label><input type="radio" checked={profile.application?.previouslyApplied === false} onChange={() => updateProfile({ application: { ...profile.application, previouslyApplied: false } })} /> No</label>
                    </div>
                </div>

                <div className="eeo-question">
                    <label>Have you previously been employed by this company?</label>
                    <div className="radio-group">
                        <label><input type="radio" checked={profile.application?.previouslyEmployed === true} onChange={() => updateProfile({ application: { ...profile.application, previouslyEmployed: true } })} /> Yes</label>
                        <label><input type="radio" checked={profile.application?.previouslyEmployed === false} onChange={() => updateProfile({ application: { ...profile.application, previouslyEmployed: false } })} /> No</label>
                    </div>
                </div>

                <div className="eeo-question">
                    <label>Do you have any relatives working at this company?</label>
                    <div className="radio-group">
                        <label><input type="radio" checked={profile.application?.hasRelatives === true} onChange={() => updateProfile({ application: { ...profile.application, hasRelatives: true } })} /> Yes</label>
                        <label><input type="radio" checked={profile.application?.hasRelatives === false} onChange={() => updateProfile({ application: { ...profile.application, hasRelatives: false } })} /> No</label>
                    </div>
                </div>

                <div className="eeo-question">
                    <label>Do you have a background in government or public office?</label>
                    <div className="radio-group">
                        <label><input type="radio" checked={profile.application?.governmentBackground === true} onChange={() => updateProfile({ application: { ...profile.application, governmentBackground: true } })} /> Yes</label>
                        <label><input type="radio" checked={profile.application?.governmentBackground === false} onChange={() => updateProfile({ application: { ...profile.application, governmentBackground: false } })} /> No</label>
                    </div>
                </div>

                <div className="eeo-question">
                    <label>* How would you describe your sexual orientation?</label>
                    <select value={profile.eeo.sexualOrientation} onChange={(e) => updateProfile({ eeo: { ...profile.eeo, sexualOrientation: e.target.value as SexualOrientation } })}>
                        <option value={SexualOrientation.DECLINE}>Decline to state</option>
                        <option value={SexualOrientation.HETEROSEXUAL}>Heterosexual</option>
                        <option value={SexualOrientation.GAY}>Gay</option>
                        <option value={SexualOrientation.LESBIAN}>Lesbian</option>
                        <option value={SexualOrientation.BISEXUAL}>Bisexual</option>
                        <option value={SexualOrientation.PANSEXUAL}>Pansexual</option>
                        <option value={SexualOrientation.ASEXUAL}>Asexual</option>
                        <option value={SexualOrientation.QUEER}>Queer</option>
                        <option value={SexualOrientation.QUESTIONING}>Questioning</option>
                        <option value={SexualOrientation.NOT_LISTED}>Not Listed</option>
                    </select>
                </div>
            </div>

            <div className="consent-section">
                <label className="consent-checkbox">
                    <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                    I agree to autofill job applications using my profile data
                </label>
            </div>

            <div className="button-row">
                <button onClick={onBack}>Back</button>
                <button className="finish-btn" onClick={handleFinish}>Finish Setup</button>
            </div>
        </div>
    );
};

export default Onboarding;
