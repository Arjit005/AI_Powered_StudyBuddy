
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from . import models, database, ai_service, analytics, maps

# Create Database Tables
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI()

# CORS Configuration
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_process_time_header(request, call_next):
    import time
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    print(f"Request: {request.url.path} took {process_time:.4f} seconds")
    response.headers["X-Process-Time"] = str(process_time)
    return response

# Pydantic Schemas
class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str

class QuizRequest(BaseModel):
    topic: str

class SummarizeRequest(BaseModel):
    topic: str

class ActivityRequest(BaseModel):
    activity_type: str
    duration_seconds: int = 0

class FlashcardRequest(BaseModel):
    topic: str

class MapRequest(BaseModel):
    topic: str

# Dependency
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"message": "Welcome to AI Study Buddy Backend!"}

@app.post("/api/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest, db: Session = Depends(get_db)):
    # 1. Generate AI Response
    ai_response = ai_service.AIService.generate_response(request.message)
    
    # 2. Save to Database
    db_chat = models.ChatHistory(role="user", content=request.message)
    db.add(db_chat)
    db_chat_response = models.ChatHistory(role="ai", content=ai_response)
    db.add(db_chat_response)
    db.commit()
    
    return {"response": ai_response}

@app.post("/api/generate-quiz")
def quiz_endpoint(request: QuizRequest, db: Session = Depends(get_db)):
    quiz_data = ai_service.AIService.generate_quiz(request.topic)
    return quiz_data

@app.post("/api/summarize")
def summarize_endpoint(request: SummarizeRequest):
    summary = ai_service.AIService.summarize_topic(request.topic)
    return {"summary": summary}

@app.post("/api/track-activity")
def track_activity(request: ActivityRequest, db: Session = Depends(get_db)):
    session = models.StudySession(
        activity_type=request.activity_type,
        duration_seconds=request.duration_seconds
    )
    db.add(session)
    db.commit()
    return {"status": "success"}

@app.post("/api/generate-flashcards")
def flashcards_endpoint(request: FlashcardRequest):
    data = ai_service.AIService.generate_flashcards(request.topic)
    return data

@app.post("/api/generate-map")
def map_endpoint(request: MapRequest):

    # 1. Get Structure from AI
    structure_data = ai_service.AIService.generate_concept_map_data(request.topic)
    
    # 2. Convert to Image using Python NetworkX
    image_base64 = maps.generate_network_graph(structure_data)
    
    return {"map_image": image_base64}

@app.get("/api/progress")
def get_progress(db: Session = Depends(get_db)):
    try:
        # Calculate Total Study Hours (from timer sessions)
        total_seconds = db.query(func.sum(models.StudySession.duration_seconds))\
            .filter(models.StudySession.activity_type == "timer_focus").scalar() or 0
        total_hours = round(total_seconds / 3600, 1)

        # Calculate Quizzes Taken
        quizzes_count = db.query(models.StudySession)\
            .filter(models.StudySession.activity_type == "quiz").count()
        
        # Simple count for now to avoid distinct errors
        streak_days = db.query(models.StudySession).count()

        return {
            "study_hours": total_hours,
            "quizzes_taken": quizzes_count,
            "streak_days": streak_days
        }
    except Exception as e:
        print(f"ERROR calculating progress: {e}")
        return {
            "study_hours": 0,
            "quizzes_taken": 0,
            "streak_days": 0
        }

@app.delete("/api/chat")
def clear_chat_history(db: Session = Depends(get_db)):
    db.query(models.ChatHistory).delete()
    db.commit()
    return {"status": "cleared"}

@app.delete("/api/progress")
def reset_progress(db: Session = Depends(get_db)):
    db.query(models.StudySession).delete()
    db.commit()
    return {"status": "reset"}

@app.get("/api/analytics/dashboard")
def get_analytics_dashboard(db: Session = Depends(get_db)):
    chart_base64 = analytics.generate_study_chart(db)
    return {"chart": chart_base64}
