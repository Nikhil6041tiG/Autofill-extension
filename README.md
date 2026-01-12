
Commands Used to Run the Project:
Backend Server:
powershell
Set-Location 'c:\Users\Nikhil''s personal\Desktop\auto-apply-nikhil - Copy\backend'; node dist/server.js
- This starts the resume parsing server on http://localhost:3000
Chrome Extension:
powershell
Set-Location 'c:\Users\Nikhil''s personal\Desktop\auto-apply-nikhil - Copy\extension'; npm run build
- This builds the Chrome extension to the /extension/dist folder
Selenium Runner:
powershell
Set-Location 'c:\Users\Nikhil''s personal\Desktop\auto-apply-nikhil - Copy\selenium-runner'; python -m uvicorn app:app --host 0.0.0.0 --port 8001
- This starts the selenium runner service on http://0.0.0.0:8001
System Status:
✅ Backend: Running on http://localhost:3000
✅ Chrome Extension: Built and ready in /extension/dist
✅ Selenium Runner: Running on http://0.0.0.0:8001
All components are now running successfully and the system is ready to use. To load the extension in Chrome, go to chrome://extensions/, enable Developer mode, and load the unpacked extension from the /extension/dist folder.


# Job Application Autofill Extension

A production-grade Chrome Extension that intelligently autofills job applications using deterministic canonical mapping, AI only as a last resort, with strict safety and consent requirements.

## Features

- ✅ **Resume Parsing**: Upload PDF/DOCX resume and extract structured data
- ✅ **Smart Field Detection**: Detects form fields across Workday, Greenhouse, Lever, iCIMS, and more
- ✅ **Deterministic Mapping**: Rule-based intent detection with confidence scoring
- ✅ **Safety First**: Never infers EEO/protected fields, always uses explicit profile values
- ✅ **Transparency**: UI panel shows what's filled, skipped, and why
- ✅ **User Control**: Profile is immutable unless user edits it

## Architecture

### Extension (Chrome MV3)
- **Content Script**: Scans DOM, detects fields, maps to canonical intents, autofills
- **Background Worker**: Manages lifecycle, opens onboarding on first install
- **Onboarding Flow**: Multi-step wizard to upload resume and confirm data
- **Settings Page**: Edit profile, export/import JSON

### Backend (Node.js)
- **Resume Parser**: Parses PDF/DOCX and extracts personal info, education, experience, skills
- **API**: Single endpoint `POST /parse-resume`

## Setup Instructions

### 1. Backend Setup

```bash
cd backend
npm install
npm run dev
```

Backend runs on `http://localhost:3000`

### 2. Extension Setup

```bash
cd extension
npm install
npm run build
```

### 3. Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/dist` folder

### 4. Quick Start with Scripts (Recommended)

We've provided convenient scripts to run the entire project:

**PowerShell:**
```powershell
./run-project.ps1
```

**Command Prompt:**
```cmd
run-project.bat
```

These scripts will:
- Build and start the backend server (port 3000)
- Install dependencies and build the Chrome extension
- Start the selenium runner (port 8000)

### 5. First Run

- Extension will automatically open onboarding page
- Upload your resume (PDF or DOCX)
- Review and edit extracted data
- Answer work authorization questions
- Set EEO preferences (defaults to "Decline to state")
- Agree to consent terms

## Usage

1. Navigate to any job application site (Workday, Greenhouse, Lever, etc.)
2. Extension automatically detects form fields
3. Fields are filled based on your canonical profile
4. UI panel shows completion status and field-by-field breakdown
5. Click on any field in the panel to focus it for manual review

## Project Structure

```
extension/
├── src/
│   ├── types/           # TypeScript type definitions
│   ├── core/
│   │   ├── mapping/     # Intent detection, enum matching
│   │   ├── resolution/  # Value resolution from profile
│   │   └── storage/     # Chrome storage wrapper
│   ├── content/
│   │   ├── fieldDetection/  # DOM/ARIA field scanning
│   │   ├── actions/         # Form interaction (fill, click, select)
│   │   └── ui/              # React overlay panel
│   ├── pages/
│   │   ├── onboarding/  # Onboarding wizard
│   │   └── settings/    # Settings page
│   └── background/      # Service worker
├── manifest.json
├── package.json
└── webpack.config.js

backend/
├── src/
│   ├── parsers/      # PDF/DOCX parsing
│   ├── extractors/   # Data extraction from text
│   └── server.ts     # Express server
└── package.json
```

## Safety & Consent

### Non-Negotiable Rules

1. **NO inference** of demographic or legal/compliance fields from resume
2. **NEVER use AI** for: work authorization, visa, gender, race, ethnicity, disability, veteran, LGBTQ+, sexual orientation, DOB, SSN
3. **Only use values** explicitly stored in user's canonical profile
4. **Default to "Decline to state"** for all EEO fields
5. **Skip when unsure** - never guess or hallucinate

### Consent

- User must explicitly agree to autofill consent during onboarding
- Profile is immutable unless user edits it in settings
- User can export/import profile JSON for backup

## Supported Portals

- Workday (custom dropdowns, multi-step forms)
- Greenhouse (native inputs/selects)
- Lever (custom fields)
- iCIMS (mixed controls)
- SmartRecruiters
- Generic job application forms

## Development

### Build Commands

```bash
# Development build with watch
npm run dev

# Production build
npm run build

# Unit tests
npm run test:unit

# E2E tests
npm run test:e2e
```

### Adding New Field Intents

1. Add new canonical intent to `src/core/mapping/intentDictionary.ts`
2. Add regex patterns for detection
3. Mark as `isProtected` if it's an EEO/sensitive field
4. Update profile schema in `src/types/canonicalProfile.ts` if needed

## Limitations

- Cannot access closed shadow DOM
- Some heavily obfuscated sites may require custom handling
- AI fallback is NOT implemented for non-sensitive free-text (optional feature)
- Resume parsing is heuristic-based and may require manual corrections

## License

Personal use only (for you and your brother)

## Credits

Built following Jobright-style deterministic autofill principles with strict safety gating.
