import React, { useState, useEffect } from "react";
import { CanonicalProfile } from "../../types/canonicalProfile";
import {
    loadProfile,
    saveProfile,
    exportProfile,
    importProfile,
    clearProfile,
} from "../../core/storage/profileStorage";
import "./Settings.css";

const Settings: React.FC = () => {
    const [profile, setProfile] = useState<CanonicalProfile | null>(null);
    const [tab, setTab] = useState<"profile" | "export">("profile");

    useEffect(() => {
        loadProfileData();
    }, []);

    const loadProfileData = async () => {
        const data = await loadProfile();
        setProfile(data);
    };

    const handleSaveProfile = async () => {
        if (!profile) return;

        try {
            await saveProfile(profile);
            alert("Profile saved successfully!");
        } catch (error) {
            alert("Failed to save profile");
        }
    };

    const handleExport = async () => {
        try {
            const json = await exportProfile();
            const blob = new Blob([json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "autofill-profile.json";
            a.click();
        } catch (error) {
            alert("Failed to export profile");
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const json = event.target?.result as string;
                await importProfile(json);
                await loadProfileData();
                alert("Profile imported successfully!");
            } catch (error) {
                alert("Failed to import profile");
            }
        };
        reader.readAsText(file);
    };

    const handleClear = async () => {
        if (!confirm("Are you sure you want to clear your profile? This cannot be undone.")) {
            return;
        }

        await clearProfile();
        setProfile(null);
        alert("Profile cleared");
    };

    if (!profile) {
        return (
            <div className="settings-container">
                <h1>Settings</h1>
                <p>No profile found. Please complete onboarding first.</p>
                <button onClick={() => chrome.runtime.sendMessage({ action: "openOnboarding" })}>
                    Start Onboarding
                </button>
            </div>
        );
    }

    return (
        <div className="settings-container">
            <h1>⚙️ Autofill Settings</h1>

            <div className="tabs">
                <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}>
                    Profile
                </button>
                <button className={tab === "export" ? "active" : ""} onClick={() => setTab("export")}>
                    Export/Import
                </button>
            </div>

            {tab === "profile" && (
                <div className="tab-content">
                    <h2>Edit Profile</h2>

                    <section>
                        <h3>Personal Information</h3>
                        <input
                            type="text"
                            placeholder="First Name"
                            value={profile.personal.firstName}
                            onChange={(e) =>
                                setProfile({
                                    ...profile,
                                    personal: { ...profile.personal, firstName: e.target.value },
                                })
                            }
                        />
                        <input
                            type="text"
                            placeholder="Last Name"
                            value={profile.personal.lastName}
                            onChange={(e) =>
                                setProfile({
                                    ...profile,
                                    personal: { ...profile.personal, lastName: e.target.value },
                                })
                            }
                        />
                        <input
                            type="email"
                            placeholder="Email"
                            value={profile.personal.email}
                            onChange={(e) =>
                                setProfile({
                                    ...profile,
                                    personal: { ...profile.personal, email: e.target.value },
                                })
                            }
                        />
                    </section>

                    <button className="save-btn" onClick={handleSaveProfile}>
                        Save Changes
                    </button>
                </div>
            )}

            {tab === "export" && (
                <div className="tab-content">
                    <h2>Export/Import Profile</h2>

                    <section>
                        <h3>Export</h3>
                        <p>Download your profile as JSON for backup or transfer.</p>
                        <button onClick={handleExport}>Export Profile</button>
                    </section>

                    <section>
                        <h3>Import</h3>
                        <p>Upload a previously exported profile JSON file.</p>
                        <input type="file" accept=".json" onChange={handleImport} />
                    </section>

                    <section>
                        <h3>Danger Zone</h3>
                        <button className="danger-btn" onClick={handleClear}>
                            Clear All Data
                        </button>
                    </section>
                </div>
            )}
        </div>
    );
};

export default Settings;
