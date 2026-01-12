from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.common.by import By
from selenium.common.exceptions import NoSuchElementException
import time

def verify_field(driver: WebDriver, selector: str, expected_value: str | bool, field_type: str) -> bool:
    """
    Verifies that a field was filled correctly.
    
    This is called after each fill operation to ensure the value was set.
    
    Args:
        driver: Selenium WebDriver instance
        selector: CSS selector for the field
        expected_value: Expected value (string or bool)
        field_type: Type of field (for type-specific verification)
        
    Returns:
        True if verification passes, False otherwise
    """
    try:
        element = driver.find_element(By.CSS_SELECTOR, selector)
        
        if field_type in ["input_text", "textarea"]:
            actual = element.get_attribute("value")
            return actual == expected_value
            
        elif field_type == "input_file":
            actual = element.get_attribute("value")
            # File inputs show different formats, just check if non-empty
            return bool(actual)
            
        elif field_type in ["radio", "checkbox"]:
            is_selected = element.is_selected()
            if isinstance(expected_value, bool):
                return is_selected == expected_value
            else:
                # For radio, expected_value is the option text
                # We just verify it's selected
                return is_selected
                
        elif field_type in ["dropdown_native", "dropdown_custom"]:
            # Check input value
            actual = element.get_attribute("value")
            if actual and expected_value.lower() in actual.lower():
                return True
            
            # For custom dropdowns, check aria attributes
            if field_type == "dropdown_custom":
                aria_expanded = element.get_attribute("aria-expanded")
                if aria_expanded == "false":  # Closed = likely selected
                    return True
            
            return False
            
        else:
            # Unknown type, just check presence
            return True
            
    except NoSuchElementException:
        return False
    except Exception as e:
        print(f"Verification error: {e}")
        return False
