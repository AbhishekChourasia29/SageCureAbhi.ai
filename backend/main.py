import os
import sqlite3
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
import re
from groq import Groq

# --- Configuration ---
DATABASE_FILE = "sagecureabhi.db"
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "YOUR_SECRETE_GROQ_API_KEY")

# --- Initialize Groq API Client ---
try:
    client = Groq(api_key=GROQ_API_KEY)
except Exception as e:
    print(f"Error initializing Groq API client: {e}")
    client = None

# --- Simulated Doctor Database ---
DOCTOR_DATABASE = {
    "indore": {
        "cardiologist": [
            "Dr. Anil Bharani, M.D., D.M. (Cardiology) - Known for interventional cardiology at Apollo Hospitals.",
            "Dr. Sarita Rao, M.D., D.N.B. (Cardiology) - A respected cardiologist at Bombay Hospital, Indore."
        ],
        "dermatologist": [
            "Dr. Narendra Gokhale, M.D. (Skin & VD) - Runs the well-regarded Gokhale Skin Clinic.",
            "Dr. Sunil M Jain, M.D. - Specialist in skin and cosmetic treatments at Dr. Jain's Skin Clinic."
        ],
        "pediatrician": [
            "Dr. Hemant Jain, M.D. (Pediatrics) - Highly recommended for child care, associated with CHL Hospitals.",
            "Dr. Shailesh Thora, D.N.B., D.C.H. - Known for his expertise at Apple Hospital."
        ],
        "general physician": [
            "Dr. V. P. Singh, M.D. (Medicine) - A senior consultant at Choithram Hospital and Research Centre.",
            "Dr. Ravi Dosi, M.D. - An expert in internal and critical care medicine at Sri Aurobindo Hospital."
        ]
    }
}

# --- Application Initialization ---
app = FastAPI(title="SageCureAbhi API (Doctor Persona)")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# --- Database Setup ---
def init_db():
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_logs (
            user_id TEXT PRIMARY KEY,
            messages TEXT,
            created_at TEXT
        )
    """)
    conn.commit()
    conn.close()

@app.on_event("startup")
async def startup_event():
    init_db()

# --- Pydantic Models ---
class Prescription(BaseModel):
    disease: str
    symptoms: str
    duration: str
    medications: List[str]
    advice: str

class ChatMessage(BaseModel):
    role: str
    content: str
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    prescription: Optional[Prescription] = None

class ChatResponse(BaseModel):
    bot_message: ChatMessage

class ChatRequest(BaseModel):
    user_id: str
    message: str

class HistoryRequest(BaseModel):
    user_id: str

class DeleteItemRequest(BaseModel):
    user_id: str
    timestamp: str

# --- Safety & Logic ---
RED_FLAG_KEYWORDS = [
    "chest pain", "crushing pain", "not breathing", "severe bleeding", 
    "face drooping", "slurred speech", "suicide", "self-harm", "want to die"
]

def check_for_red_flags(text: str) -> str | None:
    for keyword in RED_FLAG_KEYWORDS:
        if re.search(r'\b' + re.escape(keyword) + r'\b', text.lower()):
            return "This sounds like a medical emergency. Please contact your local emergency services immediately."
    return None

def get_bot_response(message: str, history: List[Dict[str, Any]]) -> ChatMessage:
    red_flag_response = check_for_red_flags(message)
    if red_flag_response:
        return ChatMessage(role="bot", content=red_flag_response)

    doctor_match = re.search(r'(?:suggest|find|recommend)\s(?:a|an)?\s(.+?)\s(?:doctor|specialist)\s(?:in|near)\s(.+)', message, re.IGNORECASE)
    if doctor_match:
        specialty = doctor_match.group(1).lower().strip()
        location = doctor_match.group(2).lower().strip()
        if location in DOCTOR_DATABASE and specialty in DOCTOR_DATABASE[location]:
            doctors = DOCTOR_DATABASE[location][specialty]
            response_text = f"Certainly. Based on your request, here are some highly regarded {specialty}s in {location.title()}:\n\n" + "\n".join([f"• {doc}" for doc in doctors])
            response_text += "\n\nPlease note, this is for informational purposes. It's always best to verify their availability."
            return ChatMessage(role="bot", content=response_text)
        else:
            return ChatMessage(role="bot", content=f"While I don't have a specific list for {specialty}s in {location.title()}, I recommend using online healthcare directories like Practo or Justdial to find a qualified specialist near you.")

    if not client:
        return ChatMessage(role="bot", content="I apologize, my AI connection is currently unavailable.")

    try:
        intent_messages = [
            {"role": "system", "content": "Analyze the user's message. Is the user describing a medical symptom or asking a general conversational question? Respond with only one word: 'SYMPTOM' or 'GENERAL'."},
            {"role": "user", "content": message}
        ]
        intent_completion = client.chat.completions.create(messages=intent_messages, model="gemma2-9b-it", temperature=0)
        intent = intent_completion.choices[0].message.content.strip().upper()

        groq_history = [{"role": "user" if msg["role"] == "user" else "assistant", "content": msg["content"]} for msg in history]
        groq_history.append({"role": "user", "content": message})

        if "SYMPTOM" in intent:
            system_prompt = (
                "You are Dr. SageCureAbhi, an AI doctor. The user is describing medical symptoms. Provide a response in a structured JSON format with two keys: 'conversational_response' and 'prescription'. "
                "The 'prescription' object must contain: 'disease', 'symptoms', 'duration', 'medications' (a list of 2-3 suggestions), and 'advice'. "
                "Your 'conversational_response' must be reassuring and end with the disclaimer: 'This is a preliminary AI consultation and not a substitute for professional medical advice.'"
            )
            messages_for_api = [{"role": "system", "content": system_prompt}] + groq_history
            chat_completion = client.chat.completions.create(messages=messages_for_api, model="gemma2-9b-it", temperature=0.7, response_format={"type": "json_object"})
            response_data = json.loads(chat_completion.choices[0].message.content)
            
            prescription_obj = Prescription(**response_data['prescription']) if 'prescription' in response_data else None
            return ChatMessage(role="bot", content=response_data.get('conversational_response', "Could you describe that in more detail?"), prescription=prescription_obj)
        
        else: # GENERAL intent
            system_prompt = (
                "You are Dr. SageCureAbhi, a friendly and empathetic AI health assistant. Your name is SageCureAbhi. Answer the user's general, non-medical question conversationally and concisely. Do not diagnose."
            )
            messages_for_api = [{"role": "system", "content": system_prompt}] + groq_history
            chat_completion = client.chat.completions.create(messages=messages_for_api, model="gemma2-9b-it", temperature=0.7)
            return ChatMessage(role="bot", content=chat_completion.choices[0].message.content)

    except Exception as e:
        print(f"API Error: {e}")
        return ChatMessage(role="bot", content="I'm having trouble connecting to my knowledge base. Please try again.")

# --- API Endpoints ---
@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    conn = sqlite3.connect(DATABASE_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT messages FROM chat_logs WHERE user_id = ?", (request.user_id,))
    row = cursor.fetchone()
    
    messages = []
    if row and row["messages"]:
        messages = json.loads(row["messages"])

    if not messages:
        greeting = ChatMessage(role="bot", content="Hello! I'm Dr. SageCureAbhi. How can I help you today? Please describe your symptoms.")
        messages.append(greeting.dict())

    bot_response_message = get_bot_response(request.message, messages)
    user_message = ChatMessage(role="user", content=request.message)
    
    messages.append(user_message.dict())
    messages.append(bot_response_message.dict())
    
    updated_messages_json = json.dumps(messages, default=str)
    
    if row:
        cursor.execute("UPDATE chat_logs SET messages = ? WHERE user_id = ?", (updated_messages_json, request.user_id))
    else:
        cursor.execute("INSERT INTO chat_logs (user_id, messages, created_at) VALUES (?, ?, ?)", (request.user_id, updated_messages_json, datetime.utcnow().isoformat()))
    
    conn.commit()
    conn.close()
    
    return ChatResponse(bot_message=bot_response_message)

@app.post("/history", response_model=List[ChatMessage])
async def get_history(request: HistoryRequest):
    conn = sqlite3.connect(DATABASE_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT messages FROM chat_logs WHERE user_id = ?", (request.user_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row and row["messages"]:
        return json.loads(row["messages"])
        
    greeting = ChatMessage(role="bot", content="Hello! I'm Dr. SageCureAbhi. How can I help you today? Please describe your symptoms.")
    return [greeting.dict()]

@app.post("/history/delete", response_model=List[ChatMessage])
async def delete_history_item(request: DeleteItemRequest):
    conn = sqlite3.connect(DATABASE_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT messages FROM chat_logs WHERE user_id = ?", (request.user_id,))
    row = cursor.fetchone()

    if not row or not row["messages"]:
        conn.close()
        raise HTTPException(status_code=404, detail="User history not found")

    messages = json.loads(row["messages"])
    updated_messages = [msg for msg in messages if msg.get("timestamp") != request.timestamp]
    
    updated_messages_json = json.dumps(updated_messages, default=str)
    cursor.execute("UPDATE chat_logs SET messages = ? WHERE user_id = ?", (updated_messages_json, request.user_id))
    conn.commit()
    conn.close()

    return updated_messages

# --- NEW ENDPOINT TO CLEAR ENTIRE HISTORY ---
@app.post("/history/clear", response_model=List[ChatMessage])
async def clear_history(request: HistoryRequest):
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()

    # Delete the entire record for the user
    cursor.execute("DELETE FROM chat_logs WHERE user_id = ?", (request.user_id,))
    
    conn.commit()
    conn.close()

    # Return the initial greeting message to signal a fresh start
    greeting = ChatMessage(role="bot", content="Hello! I'm Dr. SageCureAbhi. How can I help you today? Please describe your symptoms.")
    return [greeting.dict()]

