"""
AI Service for Greenhouse Job Applications
Previously 'selenium-runner', now refined to only handle AI predictions.

Key Features:
- AWS Bedrock Integration for Question Answering
- Connection to Pattern Learning API for "Memory"
- Stateless and lightweight

Environment Variables:
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- AWS_REGION
- PATTERN_API_URL (e.g., http://localhost:5000/api/patterns)
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models import AIRequest, AIResponse
import logging
import os
import requests
import json
import boto3
from dotenv import load_dotenv

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(dotenv_path)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Service",
    description="AI Prediction Engine for Job Applications",
    version="2.0.0"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
PATTERN_API_URL = os.environ.get('PATTERN_API_URL', 'http://localhost:3001/api/patterns')

def check_pattern_memory(question: str) -> dict | None:
    """
    Check if we have already learned this question.
    Returns the pattern dict if found, else None.
    """
    try:
        if not PATTERN_API_URL:
            return None
            
        # Search for the specific question
        response = requests.get(
            f"{PATTERN_API_URL}/search",
            params={'q': question},
            timeout=2.0
        )
        
        if response.status_code == 200:
            results = response.json().get('patterns', [])
            if results and len(results) > 0:
                # Basic exact match check or high confidence check could go here
                # For now, return the first valid match if it looks relevant
                # In a real system, we'd want stronger similarity checking
                first_match = results[0]
                # If the question text is very similar, trust it
                return first_match
                
    except Exception as e:
        logger.warning(f"Failed to check pattern memory: {str(e)}")
        
    return None

def save_learned_pattern(question: str, answer: str, intent: str, confidence: float):
    """
    Save the AI's prediction to the pattern memory for future use.
    """
    try:
        if not PATTERN_API_URL:
            return
            
        payload = {
            "pattern": {
                "question": question,
                "type": "text", # Defaulting to text, could refine
                "answer": answer,
                "intent": intent,
                "confidence": confidence,
                "source": "ai_prediction"
            }
        }
        
        requests.post(
            f"{PATTERN_API_URL}/upload",
            json=payload,
            timeout=2.0
        )
        logger.info(f"💾 [AI Service] Saved to memory: '{question}' -> '{answer}' (Intent: {intent})")
        
    except Exception as e:
        logger.warning(f"Failed to save pattern: {str(e)}")

@app.post("/predict", response_model=AIResponse)
async def predict_answer(request: AIRequest):
    """
    Predict answer using Pattern Memory (1st) or AWS Bedrock (2nd).
    """
    logger.info(f"Prediction requested for: {request.question}")

    # 1. Check Memory
    memory_match = check_pattern_memory(request.question)
    if memory_match:
        logger.info(f"Found in memory: {memory_match.get('answer')}")
        return AIResponse(
            answer=memory_match.get('answer', ''),
            confidence=0.95, # High confidence for memorized answers
            reasoning="Retrieved from Pattern Memory"
        )

    # 2. Ask AI (AWS Bedrock)
    try:
        aws_region = os.environ.get('AWS_REGION', 'us-east-1')
        aws_access_key = os.environ.get('AWS_ACCESS_KEY_ID')
        aws_secret_key = os.environ.get('AWS_SECRET_ACCESS_KEY')
        
        if not aws_access_key or not aws_secret_key:
            return AIResponse(answer="", confidence=0, reasoning="AWS Credentials Missing")

        bedrock = boto3.client(
            service_name='bedrock-runtime',
            region_name=aws_region,
            aws_access_key_id=aws_access_key,
            aws_secret_access_key=aws_secret_key
        )
        
        options_str = f"Available Options: {', '.join(request.options)}" if request.options else "Free text input"
        
        # Define canonical intents
        canonical_intents = """
        AVAILABLE INTENTS:
        personal.firstName, personal.lastName, personal.email, personal.phone, personal.linkedin, 
        personal.city, personal.state, personal.country,
        workAuthorization.authorizedUS, workAuthorization.needsSponsorship,
        eeo.gender, eeo.race, eeo.veteran, eeo.disability
        """
        
        prompt = f"""
        You are a job application assistant.
        USER PROFILE: {json.dumps(request.userProfile, indent=2)}
        QUESTION: {request.question}
        {options_str}
        {canonical_intents}
        
        INSTRUCTIONS:
        1. Select the BEST option or write the answer.
        2. Identify the intent.
        
        RESPONSE FORMAT (JSON ONLY):
        {{
            "answer": "value",
            "confidence": 0.0-1.0,
            "reasoning": "why",
            "intent": "intent.name"
        }}
        """
        
        body = json.dumps({
            "inferenceConfig": {"max_new_tokens": 1000},
            "messages": [{"role": "user", "content": [{"text": prompt}]}]
        })
        
        model_id = "us.amazon.nova-lite-v1:0"
        
        response = bedrock.invoke_model(
            body=body,
            modelId=model_id,
            accept="application/json",
            contentType="application/json"
        )
        
        response_body = json.loads(response.get("body").read())
        content_text = response_body["output"]["message"]["content"][0]["text"]
        
        # Parse JSON from AI response
        try:
            # Clean up potential markdown formatting
            clean_text = content_text.replace("```json", "").replace("```", "").strip()
            ai_data = json.loads(clean_text)
            
            # 3. Save to Memory
            save_learned_pattern(
                request.question, 
                ai_data.get('answer'), 
                ai_data.get('intent', 'unknown'),
                ai_data.get('confidence', 0.5)
            )
            
            return AIResponse(
                answer=ai_data.get('answer', ''),
                confidence=ai_data.get('confidence', 0.0),
                reasoning=ai_data.get('reasoning', ''),
                intent=ai_data.get('intent')
            )
            
        except json.JSONDecodeError:
            logger.error("Failed to parse AI JSON response")
            return AIResponse(answer="", confidence=0, reasoning="AI JSON Parse Error")
            
    except Exception as e:
        logger.error(f"AWS Bedrock error: {str(e)}")
        return AIResponse(answer="", confidence=0, reasoning=f"AWS Error: {str(e)}")

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "ai-service"}
