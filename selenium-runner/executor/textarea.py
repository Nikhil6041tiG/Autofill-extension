from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, StaleElementReferenceException
import time

def fill_textarea(driver: WebDriver, selector: str, value: str, max_retries: int = 3) -> tuple[bool, str]:
    """
    Fills a <textarea> element.
    
    Used for:
    - Cover letters
    - Additional information
    - Multi-line text fields
    
    Args:
        driver: Selenium WebDriver instance
        selector: CSS selector
        value: Text value to fill (can contain newlines)
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
            
            # Wait for element to be clickable
            element = wait.until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
            )
            
            # Clear and fill
            element.clear()
            time.sleep(0.2)
            element.send_keys(value)
            time.sleep(0.3)
            
            # Verify
            actual_value = element.get_attribute("value")
            if actual_value == value:
                return True, ""
            else:
                if attempt < max_retries - 1:
                    continue
                return False, f"Verification failed: expected '{value[:50]}...', got '{actual_value[:50]}...'"
                
        except TimeoutException:
            if attempt < max_retries - 1:
                time.sleep(0.5)
                continue
            return False, f"Element not found: {selector}"
            
        except StaleElementReferenceException:
            if attempt < max_retries - 1:
                time.sleep(0.5)
                continue
            return False, "Element became stale"
            
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(0.5)
                continue
            return False, f"Error: {str(e)}"
    
    return False, "Max retries exceeded"
