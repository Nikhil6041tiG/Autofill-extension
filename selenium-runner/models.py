from pydantic import BaseModel
from typing import List, Literal

class Action(BaseModel):
    """Represents a single field action in the fill plan"""
    id: str
    type: Literal[
        "input_text",
        "textarea", 
        "input_file",
        "radio",
        "checkbox",
        "dropdown_native",
        "dropdown_custom",
        "click"
    ]
    selector: str
    value: str | bool | None
    required: bool
    fileName: str | None = None

class FillPlan(BaseModel):
    """The complete fill plan sent by the Chrome extension"""
    jobUrl: str
    actions: List[Action]

class ExecutionResponse(BaseModel):
    """Response after executing the fill plan"""
    status: Literal["completed", "failed"]
    results: dict[str, Literal["success", "failed", "skipped"]]
    errors: dict[str, str] = {}

class AIRequest(BaseModel):
    """Request to predict an answer for a job question"""
    question: str
    options: List[str] | None = None
    fieldType: str
    userProfile: dict

class AIResponse(BaseModel):
    """AI predicted answer"""
    answer: str
    confidence: float
    reasoning: str | None = None
    intent: str | None = None  # Canonical intent path (e.g., "social.linkedin")
    isNewIntent: bool = False  # True if AI suggested a new intent
    suggestedIntentName: str | None = None  # If creating new intent, suggested name
