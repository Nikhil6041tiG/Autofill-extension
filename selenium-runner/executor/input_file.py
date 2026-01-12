import base64
import tempfile
import os
import time
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException

def fill_input_file(driver: WebDriver, selector: str, value: str, max_retries: int = 3, fileName: str = None) -> tuple[bool, str]:
    """
    Uploads a file via <input type="file">.
    Handles both direct file paths and Base64 encoded data.
    """
    file_path = value
    temp_dir = None
    
    # Check if value is Base64 data
    if isinstance(value, str) and value.startswith("data:") and ";base64," in value:
        try:
            # Extract header and data
            header, encoded = value.split(",", 1)
            file_data = base64.b64decode(encoded)
            
            # Determine extension from mime type
            mime_type = header.split(";")[0].split(":")[1]
            suffix = ".pdf"
            if "word" in mime_type:
                suffix = ".docx"
            elif "text" in mime_type:
                suffix = ".txt"
            
            # Use provided fileName if available, otherwise generic
            final_name = fileName if fileName else f"upload_{int(time.time())}{suffix}"
            
            # Ensure it has the correct extension
            if not final_name.endswith(suffix):
                final_name += suffix
            
            # Create a temporary directory to host the file with correct name
            temp_dir = tempfile.mkdtemp()
            file_path = os.path.join(temp_dir, final_name)
            
            with open(file_path, "wb") as f:
                f.write(file_data)
                
        except Exception as e:
            return False, f"Failed to decode Base64 file data: {str(e)}"

    # Validate file exists
    if not os.path.exists(file_path):
        return False, f"File not found: {file_path}"
    
    # Convert to absolute path
    abs_path = os.path.abspath(file_path)
    
    try:
        for attempt in range(max_retries):
            try:
                wait = WebDriverWait(driver, 10)
                
                try:
                    # Wait for element or fallback for Greenhouse
                    element = wait.until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, selector))
                    )
                except TimeoutException:
                    # Greenhouse fallback
                    if "resume" in selector.lower():
                        # Try all common Greenhouse IDs
                        for gid in ["resume", "resume_upload", "file_resume"]:
                            try:
                                element = driver.find_element(By.ID, gid)
                                break
                            except: continue
                    elif "cover" in selector.lower():
                        for gid in ["cover_letter", "cover_letter_upload", "file_cover_letter"]:
                            try:
                                element = driver.find_element(By.ID, gid)
                                break
                            except: continue
                    
                    if not 'element' in locals():
                        raise
                
                # Make visible if hidden (EXTREMELY Aggressive version)
                driver.execute_script(
                    """
                    var el = arguments[0];
                    el.style.display = 'block';
                    el.style.visibility = 'visible';
                    el.style.opacity = '1';
                    el.style.width = '100px';
                    el.style.height = '100px';
                    el.style.position = 'fixed';
                    el.style.top = '0';
                    el.style.left = '0';
                    el.style.zIndex = '1000000';
                    el.style.clip = 'auto';
                    el.style.overflow = 'visible';
                    el.classList.remove('visually-hidden');
                    el.classList.remove('hidden');
                    """,
                    element
                )
                time.sleep(0.5)
                
                # Send file path directly
                element.send_keys(abs_path)
                time.sleep(1.0)
                
                # Trigger change event (Crucial for Greenhouse)
                driver.execute_script("arguments[0].dispatchEvent(new Event('change', { bubbles: true }));", element)
                
                # Wait for upload to complete (Greenhouse can be slow)
                time.sleep(3.0)
                
                return True, ""
                    
            except TimeoutException:
                if attempt < max_retries - 1:
                    time.sleep(0.5)
                    continue
                return False, f"File input not found: {selector}"
                
            except Exception as e:
                if attempt < max_retries - 1:
                    time.sleep(0.5)
                    continue
                return False, f"Error: {str(e)}"
    finally:
        # Clean up temporary file and directory
        if temp_dir:
            try:
                import shutil
                shutil.rmtree(temp_dir)
            except:
                pass
    
    return False, "Max retries exceeded"

