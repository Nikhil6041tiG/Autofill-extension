# Selenium Execution Engine for Greenhouse Job Applications

A production-ready Selenium automation service that fills Greenhouse job application forms using keyboard-driven interactions.

## 🎯 Purpose

This service receives **Fill Plans** from a Chrome extension and executes them on Greenhouse job boards. It specializes in handling React-Select custom dropdowns and other complex form elements.

## 🏗️ Architecture

```
Chrome Extension → HTTP POST → Selenium Runner → Greenhouse Form
                  (Fill Plan)   (This Service)   (Keyboard Input)
```

**NOT** handled by this service:
- Resume parsing
- Question detection
- Answer inference
- DOM scanning

**ONLY** handled by this service:
- Executing pre-built fill plans
- Keyboard-driven form interactions
- Field verification
- Error reporting

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd selenium-runner
pip install -r requirements.txt
```

### 2. Start the Server

```bash
python app.py
```

Server runs on: `http://localhost:8000`

### 3. Send a Fill Plan

```bash
curl -X POST http://localhost:8000/run \
  -H "Content-Type: application/json" \
  -d '{
    "jobUrl": "https://boards.greenhouse.io/company/jobs/12345",
    "actions": [
      {
        "id": "first_name",
        "type": "input_text",
        "selector": "#first_name",
        "value": "John",
        "required": true
      },
      {
        "id": "question_61968829",
        "type": "dropdown_custom",
        "selector": "#question_61968829",
        "value": "No",
        "required": true
      }
    ]
  }'
```

### 4. Response

```json
{
  "status": "completed",
  "results": {
    "first_name": "success",
    "question_61968829": "success"
  },
  "errors": {}
}
```

## 📋 Supported Field Types

| Type | Description | Example |
|------|-------------|---------|
| `input_text` | Text inputs (name, email, phone) | `<input type="text">` |
| `textarea` | Multi-line text fields | `<textarea>` |
| `input_file` | File uploads (resume, cover letter) | `<input type="file">` |
| `radio` | Radio button groups | `<input type="radio">` |
| `checkbox` | Checkboxes | `<input type="checkbox">` |
| `dropdown_native` | Standard HTML select | `<select>` |
| `dropdown_custom` | React-Select / Greenhouse dropdowns | `<input role="combobox">` |

## 🎹 React-Select Strategy (CRITICAL)

Greenhouse uses React-Select for all custom dropdowns. These have special requirements:

### Why Keyboard-Only?

- ❌ Options are NOT in DOM until dropdown opens
- ❌ Options are virtualized (only visible ones rendered)
- ❌ Clicking `<li>` elements is unreliable
- ✅ Keyboard input is the ONLY reliable method

### How It Works

```python
# 1. Focus the combobox
combobox.click()

# 2. Wait for dropdown to open
# aria-expanded="false" → "true"

# 3. Type the exact option text
combobox.send_keys("No")

# 4. React filters options automatically

# 5. Press ENTER to select
combobox.send_keys(Keys.ENTER)

# 6. Verify selection
# aria-expanded="true" → "false"
# Input value matches
```

### Verification Methods

1. **Input Value**: Check if `value` attribute contains expected text
2. **Aria Expanded**: `false` means dropdown closed (selection made)
3. **Aria Active Descendant**: Check currently highlighted option
4. **Parent Text**: Read container text for selected value display

## 🔄 Retry & Error Handling

Every action includes:
- ✅ 3 retry attempts
- ✅ WebDriverWait for element presence
- ✅ Scroll into view
- ✅ Post-fill verification
- ✅ Detailed error messages

**Required fields that fail:**
- Are marked as `"failed"` in results
- Do NOT stop execution
- Are reported in errors object

## 🌐 Browser Configuration

### Anti-Detection Features

- Persistent Chrome profile (maintains login sessions)
- Disabled automation flags
- Removed `navigator.webdriver` property
- Headful mode (visible browser)

### Session Persistence

The browser stays open between requests:
- Maintains login state
- Faster subsequent fills
- Allows manual intervention

Close browser:
```bash
curl -X POST http://localhost:8000/close
```

## 📁 Project Structure

```
selenium-runner/
├── app.py                    # FastAPI server & main logic
├── models.py                 # Pydantic models
├── requirements.txt          # Python dependencies
├── driver/
│   ├── __init__.py
│   └── chrome.py            # WebDriver factory
├── executor/
│   ├── __init__.py
│   ├── input_text.py        # Text input filler
│   ├── textarea.py          # Textarea filler
│   ├── input_file.py        # File upload handler
│   ├── radio.py             # Radio button selector
│   ├── checkbox.py          # Checkbox toggler
│   ├── dropdown_native.py   # HTML select handler
│   └── dropdown_custom.py   # React-Select handler ⭐
└── verifier/
    ├── __init__.py
    └── verify.py            # Field verification
```

## 🧪 Testing

### Health Check
```bash
curl http://localhost:8000/health
```

### Manual Navigation
```bash
curl -X POST "http://localhost:8000/navigate?url=https://boards.greenhouse.io/..."
```

### Full Fill Plan Example

See `example-fill-plan.json` for a complete Greenhouse application example.

## ⚠️ Important Notes

### Hidden Required Inputs

Greenhouse injects hidden validation inputs:
```html
<input required tabindex="-1" aria-hidden="true">
```

**DO NOT** fill these directly. They auto-validate when the visible field is filled.

### Dropdown Options

Never try to:
- Query the options list
- Click `<li>` elements
- Use XPath for option values

Always use keyboard input.

### Retry Logic

If a field fails:
1. Logs warning
2. Marks as "failed"
3. Continues to next field
4. Never crashes entire run

## 🔧 Configuration

### Change Port

Edit `app.py`:
```python
uvicorn.run("app:app", host="0.0.0.0", port=8000)
```

### Headless Mode

Edit `driver/chrome.py`:
```python
driver = create_driver(headless=True)
```

### Timeout Settings

Edit individual executor files to adjust `WebDriverWait` timeout (default: 10s).

## 📊 API Reference

### POST /run

Execute a fill plan.

**Request Body:**
```typescript
{
  jobUrl: string
  actions: Array<{
    id: string
    type: "input_text" | "textarea" | "input_file" | "radio" | "checkbox" | "dropdown_native" | "dropdown_custom"
    selector: string
    value: string | boolean
    required: boolean
  }>
}
```

**Response:**
```typescript
{
  status: "completed" | "failed"
  results: Record<string, "success" | "failed" | "skipped">
  errors: Record<string, string>
}
```

### POST /navigate

Navigate to a URL.

**Query Params:** `url`

### POST /close

Close the browser.

### GET /health

Health check.

## 🤝 Integration with Chrome Extension

Your extension should:

1. **Parse the resume** (not Selenium's job)
2. **Detect all form fields** (not Selenium's job)
3. **Build the Fill Plan** JSON
4. **POST to** `http://localhost:8000/run`
5. **Handle the response** and show status to user

## 🎯 Success Criteria

A successful implementation:
- ✅ Fills 95%+ of Greenhouse forms correctly
- ✅ Handles React-Select dropdowns reliably
- ✅ Never crashes on individual field failures
- ✅ Provides clear error messages
- ✅ Maintains login sessions
- ✅ Uses only keyboard interactions for dropdowns

## 📝 License

MIT

## 🙋 Support

For issues related to:
- **Selenium execution:** Check executor logs
- **Browser not starting:** Check ChromeDriver installation
- **Dropdowns not filling:** Verify exact option text in Fill Plan
- **Required fields failing:** Check selector and field visibility
