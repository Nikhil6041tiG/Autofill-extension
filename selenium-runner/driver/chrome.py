from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
import os
import logging

logger = logging.getLogger(__name__)

def create_driver(headless: bool = False, use_existing_browser: bool = True) -> webdriver.Chrome:
    """
    Creates a Chrome WebDriver with anti-detection settings.
    
    Args:
        headless: Run in headless mode (default: False for Greenhouse)
        use_existing_browser: Connect to existing Chrome instance via CDP (default: True)
        
    Returns:
        Configured Chrome WebDriver instance
    """
    options = Options()
    
    if use_existing_browser:
        # Connect to existing Chrome browser running with --remote-debugging-port=9222
        # User must start Chrome with: chrome.exe --remote-debugging-port=9222
        logger.info("Attempting to connect to existing Chrome browser on port 9222...")
        
        try:
            # Test if port 9222 is accessible
            import socket
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            result = sock.connect_ex(('127.0.0.1', 9222))
            sock.close()
            
            if result == 0:
                # Port is open, connect to existing browser
                options.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
                
                # Anti-detection flags (still needed)
                options.add_experimental_option("excludeSwitches", ["enable-automation"])
                options.add_experimental_option("useAutomationExtension", False)
                options.add_argument("--disable-blink-features=AutomationControlled")
                
                logger.info("✅ Connected to existing Chrome browser on port 9222")
                
                # Create driver without chromedriver path (uses existing browser)
                driver_path = ChromeDriverManager().install()
                driver_path = os.path.normpath(driver_path)
                
                if os.path.isdir(driver_path):
                    driver_path = os.path.join(driver_path, "chromedriver.exe")
                elif not driver_path.lower().endswith(".exe"):
                    parent_dir = os.path.dirname(driver_path)
                    potential_exe = os.path.join(parent_dir, "chromedriver.exe")
                    if os.path.exists(potential_exe):
                        driver_path = potential_exe
                
                service = Service(executable_path=driver_path)
                driver = webdriver.Chrome(service=service, options=options)
                
                # Remove webdriver property
                driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
                driver.implicitly_wait(0)
                driver.set_page_load_timeout(30)
                
                return driver
            else:
                logger.warning("⚠️ Port 9222 not accessible. Chrome not started with --remote-debugging-port=9222")
                logger.warning("Falling back to separate Chrome profile...")
        except Exception as e:
            logger.warning(f"⚠️ Failed to connect to existing browser: {e}")
            logger.warning("Falling back to separate Chrome profile...")
    
    # Fallback: Use persistent profile for session persistence (old method)
    logger.info("Starting Chrome with separate profile...")
    user_data_dir = os.path.join(os.getcwd(), "chrome_profile")
    options.add_argument(f"--user-data-dir={user_data_dir}")
    
    # Anti-detection flags
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)
    options.add_argument("--disable-blink-features=AutomationControlled")
    
    # Performance & stability
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-gpu")
    
    # Window size for proper rendering
    options.add_argument("--window-size=1920,1080")
    
    if headless:
        options.add_argument("--headless=new")
    
    # Create driver with webdriver-manager for auto-updates
    try:
        driver_path = ChromeDriverManager().install()
        driver_path = os.path.normpath(driver_path)
        
        if os.path.isdir(driver_path):
            driver_path = os.path.join(driver_path, "chromedriver.exe")
        elif not driver_path.lower().endswith(".exe"):
            parent_dir = os.path.dirname(driver_path)
            potential_exe = os.path.join(parent_dir, "chromedriver.exe")
            if os.path.exists(potential_exe):
                driver_path = potential_exe
        
        logger.info(f"Starting Chrome with driver at: {driver_path}")
        service = Service(executable_path=driver_path)
        driver = webdriver.Chrome(service=service, options=options)
    except Exception as e:
        logger.error(f"CRITICAL: Failed to start Chrome. Error: {e}")
        raise e
    
    # Remove webdriver property
    driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    
    # Set timeouts
    driver.implicitly_wait(0)  # We use explicit waits only
    driver.set_page_load_timeout(30)
    
    return driver

