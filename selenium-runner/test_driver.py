from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
import os

print("Testing Chrome driver startup FIX...")
try:
    options = Options()
    options.add_argument("--headless=new")
    driver_path = ChromeDriverManager().install()
    driver_path = os.path.normpath(driver_path)
    
    if os.path.isdir(driver_path):
        driver_path = os.path.join(driver_path, "chromedriver.exe")
    elif not driver_path.lower().endswith(".exe"):
        parent_dir = os.path.dirname(driver_path)
        potential_exe = os.path.join(parent_dir, "chromedriver.exe")
        if os.path.exists(potential_exe):
            driver_path = potential_exe
            
    print(f"Final Driver path: {driver_path}")
    service = Service(executable_path=driver_path)
    driver = webdriver.Chrome(service=service, options=options)
    print("Success! Driver started with fix.")
    driver.quit()
except Exception as e:
    print(f"FAILED: {e}")
