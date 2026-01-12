from .input_text import fill_input_text
from .textarea import fill_textarea
from .input_file import fill_input_file
from .radio import fill_radio
from .checkbox import fill_checkbox
from .dropdown_native import fill_dropdown_native
from .dropdown_custom import fill_dropdown_custom
from .click import click_element

# Executor mapping
EXECUTORS = {
    "input_text": fill_input_text,
    "textarea": fill_textarea,
    "input_file": fill_input_file,
    "radio": fill_radio,
    "checkbox": fill_checkbox,
    "dropdown_native": fill_dropdown_native,
    "dropdown_custom": fill_dropdown_custom,
    "click": click_element,
}
