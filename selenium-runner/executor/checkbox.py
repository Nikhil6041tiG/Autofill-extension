from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
import time

def fill_checkbox(driver: WebDriver, selector: str, value: bool, max_retries: int = 3) -> tuple[bool, str]:
    """
    Toggles a checkbox to the desired state.
    
    Args:
        driver: Selenium WebDriver instance
        selector: CSS selector for the checkbox
        value: True to check, False to uncheck
        max_retries: Number of retry attempts
        
    Returns:
        (success: bool, error_message: str)
    """
    for attempt in range(max_retries):
        try:
            wait = WebDriverWait(driver, 10)
            element = wait.until(
                EC.presence_of_element_located((By.CSS_SELECTOR, selector))
            )
            
            # Scroll into view
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
            time.sleep(0.3)
            
            # Check current state
            is_selected = element.is_selected()
            
            # Click only if state needs to change
            if (value and not is_selected) or (not value and is_selected):
                try:
                    element.click()
                except:
                    driver.execute_script("arguments[0].click();", element)
                
                time.sleep(0.3)
            
            # Verify final state
            final_state = element.is_selected()
            if final_state == value:
                return True, ""
            else:
                if attempt < max_retries - 1:
                    continue
                return False, f"Checkbox state mismatch: expected {value}, got {final_state}"
                
        except TimeoutException:
            if attempt < max_retries - 1:
                time.sleep(0.5)
                continue
            return False, f"Checkbox not found: {selector}"
            
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(0.5)
                continue
            return False, f"Error: {str(e)}"
    
    return False, "Max retries exceeded"
