import time
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, ElementClickInterceptedException

def click_element(driver: WebDriver, selector: str, value: str = None, max_retries: int = 3) -> tuple[bool, str]:
    """
    Clicks an element (button, link, etc.).
    """
    try:
        for attempt in range(max_retries):
            try:
                wait = WebDriverWait(driver, 10)
                
                # Wait for element to be present and clickable
                element = wait.until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, selector))
                )
                
                # Scroll into view
                driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
                time.sleep(0.5)
                
                # Make sure it's visible
                driver.execute_script("arguments[0].style.visibility = 'visible'; arguments[0].style.opacity = '1';", element)
                
                try:
                    # Method 1: Standard Click
                    element.click()
                except Exception as e:
                    # Fallback for Greenhouse/Generic: Find button by text or type if selector failed
                    try:
                        if "submit" in selector.lower() or "apply" in selector.lower():
                            potential_buttons = driver.find_elements(By.TAG_NAME, "button") + driver.find_elements(By.CSS_SELECTOR, "input[type='submit']")
                            for btn in potential_buttons:
                                if any(txt in btn.text.lower() for txt in ["submit", "apply", "finish"]):
                                    element = btn
                                    break
                        
                        # Method 2: ActionChains Click
                        from selenium.webdriver.common.action_chains import ActionChains
                        ActionChains(driver).move_to_element(element).click().perform()
                    except Exception as fallback_err:
                        # Method 3: JS Click
                        driver.execute_script("arguments[0].click();", element)
                
                # Wait for navigation or change
                time.sleep(2)
                return True, ""
                    
            except TimeoutException:
                # If selection failed, try one last time with generic button search
                if attempt == max_retries - 1:
                    try:
                        btn = driver.find_element(By.CSS_SELECTOR, "button[type='submit'], .btn-primary, .submit-button")
                        driver.execute_script("arguments[0].click();", btn)
                        return True, "Clicked via generic fallback"
                    except:
                        pass
                
                if attempt < max_retries - 1:
                    time.sleep(0.5)
                    continue
                return False, f"Element not found: {selector}"
                
            except Exception as e:
                if attempt < max_retries - 1:
                    time.sleep(0.5)
                    continue
                return False, f"Error: {str(e)}"
    except Exception as e:
        return False, str(e)
    
    return False, "Max retries exceeded"
