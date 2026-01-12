from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
import time

def fill_radio(driver: WebDriver, selector: str, value: str, max_retries: int = 3) -> tuple[bool, str]:
    """
    Selects a radio button.
    
    Strategy:
    1. Find all radio inputs in the group (by name attribute)
    2. Match by value or associated label text
    3. Click the matching radio button
    
    Args:
        driver: Selenium WebDriver instance
        selector: CSS selector for the radio group or specific input
        value: Value to select (matches value attribute or label text)
        max_retries: Number of retry attempts
        
    Returns:
        (success: bool, error_message: str)
    """
    for attempt in range(max_retries):
        try:
            wait = WebDriverWait(driver, 10)
            
            # Find the radio button element
            element = wait.until(
                EC.presence_of_element_located((By.CSS_SELECTOR, selector))
            )
            
            # Get the name attribute to find all radios in the group
            name = element.get_attribute("name")
            
            if name:
                # Find all radio buttons with this name
                radios = driver.find_elements(By.CSS_SELECTOR, f'input[type="radio"][name="{name}"]')
                
                # Try to match by value attribute first
                for radio in radios:
                    if radio.get_attribute("value") == value:
                        # Scroll into view
                        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", radio)
                        time.sleep(0.3)
                        
                        # Click (use JavaScript if element is not interactable)
                        try:
                            radio.click()
                        except:
                            driver.execute_script("arguments[0].click();", radio)
                        
                        time.sleep(0.3)
                        
                        # Verify selection
                        if radio.is_selected():
                            return True, ""
                        else:
                            if attempt < max_retries - 1:
                                continue
                            return False, "Radio button not selected after click"
                
                # Try to match by associated label text
                for radio in radios:
                    radio_id = radio.get_attribute("id")
                    if radio_id:
                        try:
                            label = driver.find_element(By.CSS_SELECTOR, f'label[for="{radio_id}"]')
                            if value.lower() in label.text.lower():
                                driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", radio)
                                time.sleep(0.3)
                                
                                try:
                                    radio.click()
                                except:
                                    driver.execute_script("arguments[0].click();", radio)
                                
                                time.sleep(0.3)
                                
                                if radio.is_selected():
                                    return True, ""
                        except:
                            continue
                
                if attempt < max_retries - 1:
                    continue
                return False, f"No radio button found matching value: {value}"
            else:
                # Single radio, just click it
                driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
                time.sleep(0.3)
                
                try:
                    element.click()
                except:
                    driver.execute_script("arguments[0].click();", element)
                
                time.sleep(0.3)
                
                if element.is_selected():
                    return True, ""
                else:
                    if attempt < max_retries - 1:
                        continue
                    return False, "Radio button not selected"
                
        except TimeoutException:
            if attempt < max_retries - 1:
                time.sleep(0.5)
                continue
            return False, f"Radio button not found: {selector}"
            
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(0.5)
                continue
            return False, f"Error: {str(e)}"
    
    return False, "Max retries exceeded"
