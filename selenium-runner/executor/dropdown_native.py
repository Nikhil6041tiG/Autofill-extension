from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
import time

def fill_dropdown_native(driver: WebDriver, selector: str, value: str, max_retries: int = 3) -> tuple[bool, str]:
    """
    Selects an option from a native <select> dropdown.
    
    Used for:
    - Standard HTML <select> elements
    - Simple dropdowns
    
    Args:
        driver: Selenium WebDriver instance
        selector: CSS selector for the <select> element
        value: Option text or value to select
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
            
            # Create Select object
            select = Select(element)
            
            # Try selecting by visible text first
            try:
                select.select_by_visible_text(value)
                time.sleep(0.3)
                
                # Verify selection
                selected_option = select.first_selected_option
                if selected_option.text == value or selected_option.get_attribute("value") == value:
                    return True, ""
            except:
                pass
            
            # Try selecting by value
            try:
                select.select_by_value(value)
                time.sleep(0.3)
                
                # Verify selection
                selected_option = select.first_selected_option
                if selected_option.text == value or selected_option.get_attribute("value") == value:
                    return True, ""
            except:
                pass
            
            # Try partial match on visible text
            for option in select.options:
                if value.lower() in option.text.lower():
                    select.select_by_visible_text(option.text)
                    time.sleep(0.3)
                    
                    # Verify
                    selected_option = select.first_selected_option
                    if selected_option.text == option.text:
                        return True, ""
            
            if attempt < max_retries - 1:
                continue
            return False, f"No option found matching: {value}"
                
        except TimeoutException:
            if attempt < max_retries - 1:
                time.sleep(0.5)
                continue
            return False, f"Dropdown not found: {selector}"
            
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(0.5)
                continue
            return False, f"Error: {str(e)}"
    
    return False, "Max retries exceeded"
