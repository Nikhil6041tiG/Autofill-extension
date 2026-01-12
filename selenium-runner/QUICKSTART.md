# 🚀 Quick Start Guide - Selenium Execution Engine

## ✅ What You Now Have

A **production-ready Selenium automation service** that fills Greenhouse job applications using keyboard-driven interactions.

## 📁 Project Structure Created

```
selenium-runner/
├── app.py                      # FastAPI server (main entry point)
├── models.py                   # Data models
├── requirements.txt            # Python dependencies
├── example-fill-plan.json      # Example request
├── README.md                   # Full documentation
├── driver/
│   ├── __init__.py
│   └── chrome.py              # WebDriver with anti-detection
├── executor/
│   ├── __init__.py
│   ├── input_text.py          # Text fields
│   ├── textarea.py            # Textareas
│   ├── input_file.py          # File uploads
│   ├── radio.py               # Radio buttons
│   ├── checkbox.py            # Checkboxes
│   ├── dropdown_native.py     # HTML <select>
│   └── dropdown_custom.py     # React-Select ⭐ CRITICAL
└── verifier/
    ├── __init__.py
    └── verify.py              # Field verification
```

## 🎯 Installation Steps

### 1. Install Python Dependencies

```bash
cd "d:\auto-apply-nikhil - Copy\selenium-runner"
pip install -r requirements.txt
```

This installs:
- FastAPI (web server)
- Selenium 4 (browser automation)
- Uvicorn (ASGI server)
- Pydantic (data validation)
- WebDriver Manager (auto ChromeDriver updates)

### 2. Start the Selenium Server

```bash
python app.py
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
```

Server is now ready at: **http://localhost:8000**

## 🧪 Test the Service

### Health Check

```bash
curl http://localhost:8000/health
```

Response:
```json
{
  "status": "healthy",
  "browser_running": false
}
```

### Test Fill Plan

```bash
curl -X POST http://localhost:8000/run ^
  -H "Content-Type: application/json" ^
  -d @example-fill-plan.json
```

Expected behavior:
1. Chrome browser opens (headful)
2. Navigates to job URL
3. Fills fields one by one
4. Returns results

Response:
```json
{
  "status": "completed",
  "results": {
    "first_name": "success",
    "last_name": "success",
    "email": "success",
    ...
  },
  "errors": {}
}
```

## 🔗 Integration Architecture

```
┌─────────────────────┐
│  Chrome Extension   │
│                     │
│  1. Parse Resume    │
│  2. Detect Fields   │
│  3. Build Plan      │
└──────────┬──────────┘
           │ HTTP POST
           ▼
┌─────────────────────┐
│  Selenium Runner    │  ← You are here
│  (localhost:8000)   │
│                     │
│  4. Execute Plan    │
│  5. Fill Fields     │
│  6. Return Results  │
└──────────┬──────────┘
           │ Keyboard
           ▼
┌─────────────────────┐
│  Greenhouse Form    │
│  (React-Select)     │
└─────────────────────┘
```

## 🎹 React-Select Dropdown Strategy

### The Problem
Greenhouse uses React-Select for all dropdown fields:
- Options NOT in DOM until dropdown opens
- Options are virtualized (only visible ones rendered)
- Clicking `<li>` is unreliable

### The Solution (Keyboard-Only)
```python
# ✅ CORRECT WAY (implemented in dropdown_custom.py)
combobox = driver.find_element(By.CSS_SELECTOR, "#question_123")
combobox.click()                    # Open dropdown
combobox.send_keys("Yes")           # Type option text
combobox.send_keys(Keys.ENTER)      # Select

# ❌ WRONG WAY (won't work)
option = driver.find_element(By.XPATH, "//li[text()='Yes']")
option.click()  # Fails! Not in DOM
```

## 📋 API Endpoints

### POST /run
Execute a fill plan

**Request:**
```json
{
  "jobUrl": "https://boards.greenhouse.io/.../jobs/12345",
  "actions": [
    {
      "id": "first_name",
      "type": "input_text",
      "selector": "#first_name",
      "value": "John",
      "required": true
    }
  ]
}
```

### POST /navigate
```bash
curl -X POST "http://localhost:8000/navigate?url=https://example.com"
```

### POST /close
Close browser
```bash
curl -X POST http://localhost:8000/close
```

### GET /health
Health check

## 🛠️ Field Types Supported

| Type | Usage |
|------|-------|
| `input_text` | Name, email, phone |
| `textarea` | Cover letter, additional info |
| `input_file` | Resume upload (provide absolute path) |
| `radio` | Single choice questions |
| `checkbox` | Consent, preferences |
| `dropdown_native` | Standard HTML `<select>` |
| `dropdown_custom` | React-Select / Greenhouse dropdowns |

## 🔁 Retry & Error Handling

Every field action:
- ✅ Retries 3 times on failure
- ✅ Uses WebDriverWait (no hard sleeps)
- ✅ Scrolls element into view
- ✅ Verifies after filling
- ✅ Continues on failure (doesn't crash)

## 🔐 Browser Features

- **Persistent Profile**: Login sessions maintained
- **Anti-Detection**: Removes automation flags
- **Headful Mode**: Visible browser (allows manual login)
- **Session Reuse**: Browser stays open between requests

## 📝 Example Fill Plan

See `example-fill-plan.json` for a complete example with all field types.

## ⚠️ Important Notes

### Hidden Required Inputs
Greenhouse adds hidden validation inputs:
```html
<input required tabindex="-1" aria-hidden="true">
```
**Don't fill these!** They auto-validate when visible field is filled.

### File Paths
Must be **absolute paths**:
```json
{
  "type": "input_file",
  "value": "C:\\Users\\User\\Documents\\resume.pdf"
}
```

### Option Text Matching
Must match **exactly** (case-insensitive):
```json
{
  "type": "dropdown_custom",
  "value": "I don't wish to answer"  // ✅ Exact match
}
```

## 🎯 Next Steps

1. **Update your Chrome Extension** to send fill plans to `http://localhost:8000/run`
2. **Test with real Greenhouse forms**
3. **Monitor logs** for any field failures
4. **Adjust selectors** if needed

## 🐛 Troubleshooting

**Browser doesn't open:**
- Check ChromeDriver: `pip install --upgrade selenium webdriver-manager`

**Dropdown not filling:**
- Verify exact option text in fill plan
- Check console logs for aria-expanded changes

**File upload fails:**
- Use absolute path
- Verify file exists

**Element not found:**
- Check selector is correct
- Increase timeout in executor files

## 📖 Full Documentation

See `README.md` for complete documentation.

## ✅ Success!

You now have a bulletproof Selenium execution engine ready to fill Greenhouse applications!
```

