"""
FormScanner - Selenium-based form scanner
Physically interacts with job application forms to extract ALL questions and options
"""

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import time
import logging

logger = logging.getLogger(__name__)


class FormScanner:
    """
    Selenium-driven form scanner that physically clicks dropdowns
    to collect complete question and option data
    """
    
    def __init__(self, driver):
        self.driver = driver
        self.questions = []
        self.wait = WebDriverWait(driver, 10)
    
    def scan_application(self, url: str) -> dict:
        """
        Main entry point: scan entire application form
        
        Args:
            url: Job application URL
            
        Returns:
            {
                'url': str,
                'questions': list,
                'total': int
            }
        """
        logger.info(f"Starting scan of application: {url}")
        
        self.driver.get(url)
        time.sleep(2)  # Initial page load
        
        # Scroll to trigger lazy loading
        self._scroll_entire_page()
        
        # Scan all field types
        self._scan_text_inputs()
        self._scan_textareas()
        self._scan_file_inputs()  # NEW: Scan resume/CV upload fields
        self._scan_dropdowns()
        self._scan_radio_groups()
        self._scan_checkboxes()
        
        # Handle multi-step forms
        self._handle_multistep_forms()
        
        logger.info(f"Scan complete: {len(self.questions)} questions found")
        
        return {
            'url': url,
            'questions': self.questions,
            'total': len(self.questions)
        }
    
    def _scroll_entire_page(self):
        """Scroll to bottom to trigger lazy-loaded content"""
        logger.debug("Scrolling page to load lazy content")
        
        last_height = self.driver.execute_script("return document.body.scrollHeight")
        
        while True:
            self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(1)
            
            new_height = self.driver.execute_script("return document.body.scrollHeight")
            if new_height == last_height:
                break
            last_height = new_height
        
        # Scroll back to top
        self.driver.execute_script("window.scrollTo(0, 0);")
        time.sleep(0.5)
    
    def _scan_text_inputs(self):
        """Scan text, email, tel, number inputs"""
        logger.debug("Scanning text inputs")
        
        selectors = [
            'input[type="text"]',
            'input[type="email"]',
            'input[type="tel"]',
            'input[type="number"]',
            'input[type="url"]',
            'input:not([type])'  # Inputs without type default to text
        ]
        
        for selector in selectors:
            try:
                inputs = self.driver.find_elements(By.CSS_SELECTOR, selector)
                
                for inp in inputs:
                    if not self._is_visible(inp):
                        continue
                    
                    # Skip if inside React-Select (will be handled as dropdown)
                    if self._is_inside_dropdown(inp):
                        continue
                    
                    label = self._get_label(inp)
                    if not label:
                        continue
                    
                    element_selector = self._get_selector(inp)
                    required = self._is_required(inp)
                    field_type = inp.get_attribute('type') or 'text'
                    
                    self.questions.append({
                        'questionText': label,
                        'fieldType': field_type,
                        'options': None,
                        'required': required,
                        'selector': element_selector
                    })
                    
                    logger.debug(f"Found text input: {label}")
                    
            except Exception as e:
                logger.warning(f"Error scanning text inputs with selector {selector}: {e}")
    
    def _scan_textareas(self):
        """Scan textarea elements"""
        logger.debug("Scanning textareas")
        
        try:
            textareas = self.driver.find_elements(By.TAG_NAME, 'textarea')
            
            for textarea in textareas:
                if not self._is_visible(textarea):
                    continue
                
                label = self._get_label(textarea)
                if not label:
                    continue
                
                element_selector = self._get_selector(textarea)
                required = self._is_required(textarea)
                
                self.questions.append({
                    'questionText': label,
                    'fieldType': 'textarea',
                    'options': None,
                    'required': required,
                    'selector': element_selector
                })
                
                logger.debug(f"Found textarea: {label}")
                
        except Exception as e:
            logger.warning(f"Error scanning textareas: {e}")
    
    def _scan_file_inputs(self):
        """
        Scan file upload fields (Resume/CV, Cover Letter)
        Handles both standard <input type="file"> and Greenhouse custom upload widgets
        """
        logger.debug("Scanning file inputs")
        
        try:
            # 1. Standard HTML5 file inputs
            file_inputs = self.driver.find_elements(By.CSS_SELECTOR, 'input[type="file"]')
            
            for file_input in file_inputs:
                label = self._get_label(file_input)
                if not label:
                    # Try to get label from surrounding div or parent
                    try:
                        parent = file_input.find_element(By.XPATH, './ancestor::div[contains(@class, "field")]')
                        label_elem = parent.find_element(By.CSS_SELECTOR, 'label, .field-label, [class*="label"]')
                        label = label_elem.text.strip()
                    except:
                        # Fallback to ID-based label detection
                        file_id = file_input.get_attribute('id')
                        if 'resume' in (file_id or '').lower():
                            label = 'Resume/CV'
                        elif 'cover' in (file_id or '').lower():
                            label = 'Cover Letter'
                        else:
                            continue
                
                element_selector = self._get_selector(file_input)
                required = self._is_required(file_input)
                
                self.questions.append({
                    'questionText': label,
                    'fieldType': 'file',
                    'options': None,
                    'required': required,
                    'selector': element_selector
                })
                
                logger.debug(f"Found file input: {label}")
            
            # 2. Greenhouse custom file upload widgets
            # Look for characteristic Greenhouse upload sections
            greenhouse_selectors = [
                'div[data-source="resume"]',
                'div[data-source="cover_letter"]',
                'div.field[id*="resume"]',
                'div.field[id*="cover"]',
                '#resume_section',
                '#cover_letter_section'
            ]
            
            for selector in greenhouse_selectors:
                try:
                    sections = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    for section in sections:
                        if not self._is_visible(section):
                            continue
                        
                        # Get label from section
                        try:
                            label_elem = section.find_element(By.CSS_SELECTOR, 'label, .field-label, h3, h4')
                            label = label_elem.text.strip()
                        except:
                            # Determine from selector
                            if 'resume' in selector.lower():
                                label = 'Resume/CV'
                            elif 'cover' in selector.lower():
                                label = 'Cover Letter'
                            else:
                                continue
                        
                        # Find the actual hidden file input within this section
                        try:
                            hidden_input = section.find_element(By.CSS_SELECTOR, 'input[type="file"]')
                            element_selector = self._get_selector(hidden_input)
                        except:
                            # Fallback to section-based selector
                            section_id = section.get_attribute('id')
                            if section_id:
                                element_selector = f'#{section_id} input[type="file"]'
                            else:
                                continue
                        
                        # Check if already added
                        if any(q['questionText'] == label for q in self.questions):
                            continue
                        
                        # Greenhouse file fields are usually required
                        required = 'required' in label.lower() or '*' in label
                        
                        self.questions.append({
                            'questionText': label,
                            'fieldType': 'file',
                            'options': None,
                            'required': required,
                            'selector': element_selector
                        })
                        
                        logger.debug(f"Found Greenhouse file upload: {label}")
                
                except Exception as e:
                    logger.debug(f"Error checking Greenhouse selector {selector}: {e}")
                    continue
            
        except Exception as e:
            logger.warning(f"Error scanning file inputs: {e}")
    
    def _scan_dropdowns(self):
        """
        CRITICAL: Click dropdowns to see ALL options
        Handles both native <select> and custom ARIA dropdowns
        """
        logger.debug("Scanning dropdowns")
        
        # Native select elements
        self._scan_native_selects()
        
        # Custom ARIA dropdowns
        self._scan_custom_dropdowns()
    
    def _scan_native_selects(self):
        """Scan native <select> elements"""
        try:
            selects = self.driver.find_elements(By.TAG_NAME, 'select')
            
            for select in selects:
                if not self._is_visible(select):
                    continue
                
                label = self._get_label(select)
                if not label:
                    continue
                
                # Get options directly
                options = []
                option_elements = select.find_elements(By.TAG_NAME, 'option')
                
                for opt in option_elements:
                    text = opt.text.strip()
                    # Skip placeholder options
                    if text and text not in ['Select...', 'Choose...', '--', 'Please select']:
                        options.append(text)
                
                if not options:
                    logger.debug(f"Skipping select with no valid options: {label}")
                    continue
                
                element_selector = self._get_selector(select)
                required = self._is_required(select)
                
                self.questions.append({
                    'questionText': label,
                    'fieldType': 'select',
                    'options': options,
                    'required': required,
                    'selector': element_selector
                })
                
                logger.debug(f"Found select: {label} with {len(options)} options")
                
        except Exception as e:
            logger.warning(f"Error scanning native selects: {e}")
    
    def _scan_custom_dropdowns(self):
        """
        Scan custom ARIA dropdowns by physically clicking them
        This is the KEY feature that makes this approach robust
        """
        try:
            # Find all elements with role="combobox" or aria-haspopup="listbox"
            dropdown_selectors = [
                '[role="combobox"]',
                '[aria-haspopup="listbox"]',
                '.select__control',  # React-Select
                '[class*="dropdown"]'
            ]
            
            for selector in dropdown_selectors:
                dropdowns = self.driver.find_elements(By.CSS_SELECTOR, selector)
                
                for dropdown in dropdowns:
                    if not self._is_visible(dropdown):
                        continue
                    
                    label = self._get_label(dropdown)
                    if not label:
                        continue
                    
                    # PHYSICALLY CLICK to open dropdown
                    options = self._click_and_extract_options(dropdown, label)
                    
                    if not options:
                        logger.debug(f"No options extracted for: {label}")
                        continue
                    
                    element_selector = self._get_selector(dropdown)
                    required = self._is_required(dropdown)
                    
                    self.questions.append({
                        'questionText': label,
                        'fieldType': 'dropdown_custom',
                        'options': options,
                        'required': required,
                        'selector': element_selector
                    })
                    
                    logger.debug(f"Found custom dropdown: {label} with {len(options)} options")
                    
        except Exception as e:
            logger.warning(f"Error scanning custom dropdowns: {e}")
    
    def _click_and_extract_options(self, dropdown, label):
        """
        Click dropdown and wait for options to render
        Returns list of option texts
        """
        try:
            # Scroll into view
            self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", dropdown)
            time.sleep(0.3)
            
            # Click to open
            dropdown.click()
            time.sleep(0.8)  # Wait for options to render
            
            # Try multiple selectors for options
            option_selectors = [
                '[role="option"]',
                'li[role="option"]',
                '.select__option',
                '[id*="option"]',
                '[class*="option"]',
                'li[data-value]',
                'div[role="option"]'
            ]
            
            options = []
            for selector in option_selectors:
                try:
                    option_elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    
                    if option_elements:
                        for opt in option_elements:
                            if self._is_visible(opt):
                                text = opt.text.strip()
                                if text and text not in options:
                                    options.append(text)
                        
                        if options:
                            break  # Found options, stop trying other selectors
                            
                except:
                    continue
            
            # Close dropdown (click outside or press Escape)
            try:
                self.driver.find_element(By.TAG_NAME, 'body').click()
                time.sleep(0.3)
            except:
                pass
            
            return options
            
        except Exception as e:
            logger.debug(f"Error clicking dropdown '{label}': {e}")
            return []
    
    def _scan_radio_groups(self):
        """Scan radio button groups"""
        logger.debug("Scanning radio groups")
        
        try:
            radios = self.driver.find_elements(By.CSS_SELECTOR, 'input[type="radio"]')
            processed_names = set()
            
            for radio in radios:
                name = radio.get_attribute('name')
                if not name or name in processed_names:
                    continue
                
                processed_names.add(name)
                
                # Find all radios with same name
                group = self.driver.find_elements(By.CSS_SELECTOR, f'input[type="radio"][name="{name}"]')
                
                if not group:
                    continue
                
                # Get label from first radio or parent
                label = self._get_label(group[0])
                if not label:
                    continue
                
                # Get options from each radio's label
                options = []
                for r in group:
                    opt_label = self._get_radio_option_label(r)
                    if opt_label and opt_label != label:
                        options.append(opt_label)
                
                if not options:
                    continue
                
                element_selector = f'input[type="radio"][name="{name}"]'
                required = self._is_required(group[0])
                
                self.questions.append({
                    'questionText': label,
                    'fieldType': 'radio',
                    'options': options,
                    'required': required,
                    'selector': element_selector
                })
                
                logger.debug(f"Found radio group: {label} with {len(options)} options")
                
        except Exception as e:
            logger.warning(f"Error scanning radio groups: {e}")
    
    def _scan_checkboxes(self):
        """Scan checkbox elements"""
        logger.debug("Scanning checkboxes")
        
        try:
            checkboxes = self.driver.find_elements(By.CSS_SELECTOR, 'input[type="checkbox"]')
            
            for checkbox in checkboxes:
                if not self._is_visible(checkbox):
                    continue
                
                label = self._get_label(checkbox)
                if not label:
                    continue
                
                element_selector = self._get_selector(checkbox)
                required = self._is_required(checkbox)
                
                self.questions.append({
                    'questionText': label,
                    'fieldType': 'checkbox',
                    'options': ['Yes', 'No'],  # Checkboxes are binary
                    'required': required,
                    'selector': element_selector
                })
                
                logger.debug(f"Found checkbox: {label}")
                
        except Exception as e:
            logger.warning(f"Error scanning checkboxes: {e}")
    
    def _handle_multistep_forms(self):
        """
        Detect and navigate multi-step forms
        Clicks "Next"/"Continue" buttons and scans each step
        """
        logger.debug("Checking for multi-step form")
        
        step = 1
        max_steps = 10
        
        while step < max_steps:
            try:
                # Look for Next/Continue buttons
                next_button = None
                
                next_selectors = [
                    "//button[contains(translate(text(), 'NEXT', 'next'), 'next')]",
                    "//button[contains(translate(text(), 'CONTINUE', 'continue'), 'continue')]",
                    "//input[@type='submit' and contains(@value, 'Next')]",
                    "[data-testid*='next']",
                    ".next-button"
                ]
                
                for selector in next_selectors:
                    try:
                        if selector.startswith('//'):
                            buttons = self.driver.find_elements(By.XPATH, selector)
                        else:
                            buttons = self.driver.find_elements(By.CSS_SELECTOR, selector)
                        
                        for btn in buttons:
                            if self._is_visible(btn):
                                next_button = btn
                                break
                        
                        if next_button:
                            break
                    except:
                        continue
                
                if not next_button:
                    logger.debug("No next button found, single-step form")
                    break
                
                # Click Next
                logger.info(f"Found multi-step form, navigating to step {step + 1}")
                self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", next_button)
                time.sleep(0.5)
                next_button.click()
                time.sleep(2)  # Wait for next step to load
                
                # Scan this step
                self._scan_text_inputs()
                self._scan_textareas()
                self._scan_dropdowns()
                self._scan_radio_groups()
                self._scan_checkboxes()
                
                step += 1
                
            except Exception as e:
                logger.debug(f"Multi-step navigation ended: {e}")
                break
    
    # ===== Helper Methods =====
    
    def _get_label(self, element):
        """Extract label text for an element"""
        # Try aria-label
        aria_label = element.get_attribute('aria-label')
        if aria_label and aria_label.strip():
            return aria_label.strip()
        
        # Try aria-labelledby
        labelledby = element.get_attribute('aria-labelledby')
        if labelledby:
            try:
                label_el = self.driver.find_element(By.ID, labelledby)
                text = label_el.text.strip()
                if text:
                    return text
            except:
                pass
        
        # Try <label for="...">
        element_id = element.get_attribute('id')
        if element_id:
            try:
                label_el = self.driver.find_element(By.CSS_SELECTOR, f'label[for="{element_id}"]')
                text = label_el.text.strip()
                if text:
                    return text
            except:
                pass
        
        # Try parent label
        try:
            parent = element.find_element(By.XPATH, '..')
            if parent.tag_name == 'label':
                text = parent.text.strip()
                if text:
                    return text
        except:
            pass
        
        # Try nearest preceding text
        try:
            parent = element.find_element(By.XPATH, '..')
            # Look for label-like elements in parent
            label_candidates = parent.find_elements(By.CSS_SELECTOR, 'label, [class*="label"], [class*="question"]')
            for candidate in label_candidates:
                text = candidate.text.strip()
                if text and len(text) < 300:
                    return text
        except:
            pass
        
        return None
    
    def _get_radio_option_label(self, radio_element):
        """Get the specific label for a radio option (not the group label)"""
        # Check immediate label
        try:
            parent = radio_element.find_element(By.XPATH, '..')
            if parent.tag_name == 'label':
                return parent.text.strip()
        except:
            pass
        
        # Check for adjacent label
        element_id = radio_element.get_attribute('id')
        if element_id:
            try:
                label = self.driver.find_element(By.CSS_SELECTOR, f'label[for="{element_id}"]')
                return label.text.strip()
            except:
                pass
        
        # Check sibling text
        try:
            parent = radio_element.find_element(By.XPATH, '..')
            siblings = parent.find_elements(By.XPATH, './/*')
            for sib in siblings:
                if sib.tag_name in ['span', 'div', 'label']:
                    text = sib.text.strip()
                    if text and len(text) < 100:
                        return text
        except:
            pass
        
        return None
    
    def _get_selector(self, element):
        """Generate CSS selector for element"""
        element_id = element.get_attribute('id')
        if element_id:
            # Check if ID contains special characters that need escaping
            # Common special chars: [] () {} . : , ; / \ @ ! # $ % ^ & * + = ~ ` " ' < > ?
            special_chars = ['[', ']', '(', ')', '{', '}', '.', ':', ',', ';', '/', '\\', 
                           '@', '!', '#', '$', '%', '^', '&', '*', '+', '=', '~', '`', 
                           '"', "'", '<', '>', '?']
            
            has_special_char = any(char in element_id for char in special_chars)
            
            if has_special_char:
                # Use attribute selector for IDs with special characters
                # This works for all special chars without escaping
                return f'[id="{element_id}"]'
            else:
                # Use standard ID selector for normal IDs (faster)
                return f'#{element_id}'
        
        # Try name attribute
        name = element.get_attribute('name')
        if name:
            tag = element.tag_name.lower()
            return f'{tag}[name="{name}"]'
        
        # Fallback to class-based selector
        try:
            tag = element.tag_name.lower()
            classes = element.get_attribute('class')
            if classes:
                class_list = classes.strip().split()[:2]  # First 2 classes
                return f'{tag}.{".".join(class_list)}'
            return tag
        except:
            return 'input'
    
    def _is_visible(self, element):
        """Check if element is visible and enabled"""
        try:
            return element.is_displayed() and element.is_enabled()
        except:
            return False
    
    def _is_required(self, element):
        """Check if field is required"""
        try:
            return (element.get_attribute('required') is not None or 
                    element.get_attribute('aria-required') == 'true')
        except:
            return False
    
    def _is_inside_dropdown(self, element):
        """Check if element is inside a dropdown container (React-Select pattern)"""
        try:
            parent_classes = element.find_element(By.XPATH, '../..').get_attribute('class') or ''
            return 'select__' in parent_classes.lower() or 'dropdown' in parent_classes.lower()
        except:
            return False
