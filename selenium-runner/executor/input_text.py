from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, StaleElementReferenceException
import time

def fill_input_text(driver: WebDriver, selector: str, value: str, max_retries: int = 3) -> tuple[bool, str]:
    """
    Fills a standard text input field.
    
    Handles:
    - Standard <input type="text">
    - Email, phone, URL inputs
    - Name fields
    
    Args:
        driver: Selenium WebDriver instance
        selector: CSS selector (usually an ID like #first_name)
        value: Text value to fill
        max_retries: Number of retry attempts
        
    Returns:
        (success: bool, error_message: str)
    """
    for attempt in range(max_retries):
        try:
            # Wait for element to be present and interactable
            wait = WebDriverWait(driver, 10)
            element = wait.until(
                EC.presence_of_element_located((By.CSS_SELECTOR, selector))
            )
            
            # Scroll into view
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
            time.sleep(0.3)  # Brief pause for scroll
            
            # Wait for element to be clickable
            element = wait.until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
            )
            
            # Clear existing value
            element.clear()
            time.sleep(0.2)
            
            # Fill new value
            element.send_keys(value)
            time.sleep(0.3)
            
            # Verify the value was set
            actual_value = element.get_attribute("value")
            if actual_value == value:
                return True, ""
            else:
                if attempt < max_retries - 1:
                    continue
                return False, f"Verification failed: expected '{value}', got '{actual_value}'"
                
        except TimeoutException:
            if attempt < max_retries - 1:
                time.sleep(0.5)
                continue
            return False, f"Element not found or not interactable: {selector}"
            
        except StaleElementReferenceException:
            if attempt < max_retries - 1:
                time.sleep(0.5)
                continue
            return False, "Element became stale during interaction"
            
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(0.5)
                continue
            return False, f"Unexpected error: {str(e)}"
    
    return False, "Max retries exceeded"
