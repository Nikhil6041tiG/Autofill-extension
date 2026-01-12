from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
import time

def fill_dropdown_custom(driver: WebDriver, selector: str, value: str, max_retries: int = 3) -> tuple[bool, str]:
    """
    Fills a React-Select / Greenhouse custom dropdown using KEYBOARD ONLY.
    
    ⚠️ CRITICAL: This is the most important function for Greenhouse forms.
    
    Greenhouse dropdowns:
    - Use React-Select library
    - Have <input role="combobox">
    - Options are NOT in DOM until opened
    - Options are virtualized (only visible ones rendered)
    - Use aria-expanded to indicate open/closed state
    
    STRATEGY (KEYBOARD-DRIVEN):
    1. Focus the combobox input
    2. Click to activate (triggers aria-expanded="true")
    3. Type the exact option text
    4. Wait for React to filter/highlight the option
    5. Press ENTER to select
    6. Verify selection via input value or visible label
    
    ❌ DO NOT:
    - Click <li> elements (they're virtualized)
    - Query option lists (not in DOM)
    - Use XPath for values
    
    ✅ DO:
    - Use keyboard navigation only
    - Type exact match text
    - Wait for aria-expanded changes
    - Verify via input value or aria attributes
    
    Args:
        driver: Selenium WebDriver instance
        selector: CSS selector for the combobox input (e.g., #question_61968829)
        value: Exact option text to select (e.g., "No", "Yes", "I don't wish to answer")
        max_retries: Number of retry attempts
        
    Returns:
        (success: bool, error_message: str)
    """
    for attempt in range(max_retries):
        try:
            wait = WebDriverWait(driver, 10)
            
            # Find the combobox input
            # Greenhouse uses: <input id="question_XXX" role="combobox" aria-expanded="false">
            combobox = wait.until(
                EC.presence_of_element_located((By.CSS_SELECTOR, selector))
            )
            
            # Verify it's actually a combobox
            role = combobox.get_attribute("role")
            if role != "combobox":
                # Might be an ID on a wrapper, try to find combobox inside
                try:
                    parent = driver.find_element(By.CSS_SELECTOR, selector)
                    combobox = parent.find_element(By.CSS_SELECTOR, 'input[role="combobox"]')
                except:
                    return False, f"Element is not a combobox (role={role})"
            
            # Scroll into view
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", combobox)
            time.sleep(0.3)
            
            # Clear any existing value
            combobox.clear()
            time.sleep(0.2)
            
            # Focus the combobox
            combobox.click()
            time.sleep(0.4)
            
            # Wait for dropdown to open (aria-expanded="true")
            try:
                WebDriverWait(driver, 3).until(
                    lambda d: combobox.get_attribute("aria-expanded") == "true"
                )
            except TimeoutException:
                # Try clicking again if it didn't open
                combobox.click()
                time.sleep(0.4)
            
            
            # Type the exact option text
            # React-Select will filter options as we type
            combobox.send_keys(value)
            time.sleep(0.5)  # Wait for React to filter options
            
            # Press ENTER to select the highlighted/filtered option
            combobox.send_keys(Keys.ENTER)
            time.sleep(0.4)
            
            # Check if selection worked
            aria_expanded = combobox.get_attribute("aria-expanded")
            input_value = combobox.get_attribute("value")
            
            # If dropdown is still open, try partial matching (for phone country selectors)
            if aria_expanded == "true" and not input_value:
                # Clear what we typed
                combobox.send_keys(Keys.CONTROL + "a")
                time.sleep(0.1)
                combobox.send_keys(Keys.BACKSPACE)
                time.sleep(0.3)
                
                # For phone country selectors, try typing just first few chars
                # e.g., "United States" → type "United" and press ENTER
                short_value = value.split()[0] if ' ' in value else value[:min(len(value), 6)]
                combobox.send_keys(short_value)
                time.sleep(0.5)
                combobox.send_keys(Keys.ENTER)
                time.sleep(0.4)
            
            # Verify selection
            # Method 1: Check if input value matches
            input_value = combobox.get_attribute("value")
            if input_value and value.lower() in input_value.lower():
                return True, ""
            
            # Method 2: Check if aria-expanded is now false (dropdown closed = selection made)
            aria_expanded = combobox.get_attribute("aria-expanded")
            if aria_expanded == "false":
                # Dropdown closed, likely selected
                # Double-check by reading the value again
                time.sleep(0.2)
                input_value = combobox.get_attribute("value")
                if input_value and value.lower() in input_value.lower():
                    return True, ""
            
            # Method 3: Look for selected value display in parent container
            try:
                parent = combobox.find_element(By.XPATH, "./ancestor::div[contains(@class, 'css-')]")
                parent_text = parent.text
                if value in parent_text:
                    return True, ""
            except:
                pass
            
            # Method 4: Check aria-activedescendant
            active_id = combobox.get_attribute("aria-activedescendant")
            if active_id:
                try:
                    active_option = driver.find_element(By.ID, active_id)
                    if value.lower() in active_option.text.lower():
                        return True, ""
                except:
                    pass
            
            # If we got here and dropdown is closed, assume success
            if aria_expanded == "false":
                return True, ""
            
            # Otherwise retry
            if attempt < max_retries - 1:
                # Clear and try again
                try:
                    combobox.send_keys(Keys.ESCAPE)  # Close dropdown
                    time.sleep(0.3)
                except:
                    pass
                continue
                
            return False, f"Could not verify selection of '{value}'"
                
        except TimeoutException:
            if attempt < max_retries - 1:
                time.sleep(0.5)
                continue
            return False, f"Combobox not found: {selector}"
            
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(0.5)
                # Try to close dropdown before retry
                try:
                    driver.find_element(By.CSS_SELECTOR, selector).send_keys(Keys.ESCAPE)
                except:
                    pass
                continue
            return False, f"Error: {str(e)}"
    
    return False, "Max retries exceeded"
