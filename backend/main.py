
import time
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
from sqlalchemy.orm import Session
from pydantic import BaseModel

from . import models, database, ai_service, analytics, maps, auth

# Create Database Tables
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(
    title="AI Study Buddy API",
    description="FastAPI backend for AI Study Buddy featuring JWT Authentication and Context-Aware AI Tutoring.",
    version="1.1.0"
)

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
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = f"{process_time:.4f}s"
    return response

# Pydantic Schemas
class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str

class LoginRequest(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: str

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

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

# Database dependency
get_db = database.get_db

# --- Root & Health Endpoints ---
@app.get("/")
def read_root():
    return {
        "message": "Welcome to AI Study Buddy Backend! 🎓",
        "docs": "/docs",
        "version": "1.1.0"
    }

# --- Authentication Endpoints ---
@app.post("/api/auth/register", response_model=AuthResponse, tags=["Authentication"])
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    clean_username = req.username.strip()
    clean_email = req.email.strip().lower()

    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")

    if db.query(models.User).filter(models.User.username == clean_username).first():
        raise HTTPException(status_code=400, detail="Username already taken. Please choose another.")
    
    if db.query(models.User).filter(models.User.email == clean_email).first():
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    hashed_pw = auth.hash_password(req.password)
    user = models.User(
        username=clean_username,
        email=clean_email,
        hashed_password=hashed_pw
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = auth.create_access_token({"sub": str(user.id), "email": user.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email
        }
    }

@app.post("/api/auth/login", response_model=AuthResponse, tags=["Authentication"])
def login(req: LoginRequest, db: Session = Depends(get_db)):
    identifier = (req.email or req.username or "").strip()
    if not identifier:
        raise HTTPException(status_code=400, detail="Email or username is required.")

    user = None
    if "@" in identifier:
        user = db.query(models.User).filter(models.User.email == identifier.lower()).first()
    if not user:
        user = db.query(models.User).filter(models.User.username == identifier).first()

    if not user or not auth.verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials. Please check your email/username and password.")

    token = auth.create_access_token({"sub": str(user.id), "email": user.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email
        }
    }

@app.get("/api/auth/me", response_model=UserResponse, tags=["Authentication"])
def get_current_user_profile(user: models.User = Depends(auth.get_current_user_required)):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email
    }

# --- Core Learning & Chat Endpoints ---
@app.post("/api/chat", response_model=ChatResponse, tags=["AI Learning"])
def chat_endpoint(
    request: ChatRequest, 
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(auth.get_current_user_optional)
):
    user_id = current_user.id if current_user else None

    # 1. Fetch recent conversation history for genuine context awareness
    query = db.query(models.ChatHistory)
    if user_id:
        query = query.filter(models.ChatHistory.user_id == user_id)
    recent_chats = query.order_by(models.ChatHistory.id.desc()).limit(8).all()
    recent_chats.reverse()

    chat_history = [{"role": c.role, "content": c.content} for c in recent_chats]

    # 2. Generate AI response grounded with conversation history
    ai_response = ai_service.AIService.generate_response(request.message, chat_history=chat_history)

    # 3. Save to database with user association
    db_user_msg = models.ChatHistory(role="user", content=request.message, user_id=user_id)
    db.add(db_user_msg)
    db_ai_msg = models.ChatHistory(role="ai", content=ai_response, user_id=user_id)
    db.add(db_ai_msg)
    db.commit()

    return {"response": ai_response}

@app.post("/api/generate-quiz", tags=["AI Learning"])
def quiz_endpoint(
    request: QuizRequest, 
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(auth.get_current_user_optional)
):
    quiz_data = ai_service.AIService.generate_quiz(request.topic)
    return quiz_data

@app.post("/api/summarize", tags=["AI Learning"])
def summarize_endpoint(request: SummarizeRequest):
    summary = ai_service.AIService.summarize_topic(request.topic)
    return {"summary": summary}

@app.post("/api/generate-flashcards", tags=["AI Learning"])
def flashcards_endpoint(request: FlashcardRequest):
    data = ai_service.AIService.generate_flashcards(request.topic)
    return data

@app.post("/api/generate-map", tags=["AI Learning"])
def map_endpoint(request: MapRequest):
    structure_data = ai_service.AIService.generate_concept_map_data(request.topic)
    image_base64 = maps.generate_network_graph(structure_data)
    return {"map_image": image_base64}

# --- Activity Tracking & Analytics ---
@app.post("/api/track-activity", tags=["Analytics"])
def track_activity(
    request: ActivityRequest, 
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(auth.get_current_user_optional)
):
    user_id = current_user.id if current_user else None
    session = models.StudySession(
        user_id=user_id,
        activity_type=request.activity_type,
        duration_seconds=request.duration_seconds
    )
    db.add(session)
    db.commit()
    return {"status": "success"}

@app.get("/api/progress", tags=["Analytics"])
def get_progress(
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(auth.get_current_user_optional)
):
    try:
        user_id = current_user.id if current_user else None
        query = db.query(models.StudySession)
        if user_id:
            query = query.filter(models.StudySession.user_id == user_id)

        # Calculate total study hours
        timer_query = query.filter(models.StudySession.activity_type == "timer_focus")
        total_seconds = timer_query.with_entities(func.sum(models.StudySession.duration_seconds)).scalar() or 0
        total_hours = round(total_seconds / 3600, 1)

        # Calculate Quizzes Taken
        quizzes_count = query.filter(models.StudySession.activity_type == "quiz").count()
        
        # Total recorded study sessions
        streak_days = query.count()

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

@app.delete("/api/chat", tags=["AI Learning"])
def clear_chat_history(
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(auth.get_current_user_optional)
):
    query = db.query(models.ChatHistory)
    if current_user:
        query = query.filter(models.ChatHistory.user_id == current_user.id)
    query.delete(synchronize_session=False)
    db.commit()
    return {"status": "cleared"}

@app.delete("/api/progress", tags=["Analytics"])
def reset_progress(
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(auth.get_current_user_optional)
):
    query = db.query(models.StudySession)
    if current_user:
        query = query.filter(models.StudySession.user_id == current_user.id)
    query.delete(synchronize_session=False)
    db.commit()
    return {"status": "reset"}

@app.get("/api/analytics/dashboard", tags=["Analytics"])
def get_analytics_dashboard(db: Session = Depends(get_db)):
    chart_base64 = analytics.generate_study_chart(db)
    return {"chart": chart_base64}

