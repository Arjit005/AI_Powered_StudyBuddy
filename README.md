🎓 AI Study Buddy

AI Study Buddy is an intelligent, web-based learning assistant powered by Google Gemini Generative AI.
It helps students study more effectively by providing explanations, summaries, quizzes, flashcards, and interactive chat-based assistance.

This project is built as a capstone project and product-style prototype, focusing on practical use of Generative AI in education.

📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [System Architecture](#-system-architecture)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Endpoints](#-api-endpoints)
- [Project Structure](#-project-structure)
- [Troubleshooting](#-troubleshooting)
- [Future Enhancements](#-future-enhancements)
- [License](#-license)

✨ Features

🧠 AI-Powered Learning Tools

🔹 AI Chat Assistant

- Chat-based interface for asking study-related questions
- Generates clear, structured answers using Gemini AI
- Supports follow-up questions for better understanding

🔹 Topic Summarizer

- Generates concise summaries of study material
- Highlights key concepts and important points
- Useful for last-minute revision

🔹 Quiz Generator

- Automatically generates multiple-choice quizzes
- Helps students test their understanding
- Instant response generation using AI
- Track quiz completion in progress dashboard

🔹 Flashcard Generator

- Creates question–answer flashcards for a given topic
- Interactive flip animation
- Designed for memorization and quick review

🔹 Concept Map Visualizer

- Displays structured visual representations for selected topics
- Interactive network graphs showing topic relationships
- Generated using NetworkX and Matplotlib
- Designed to be extended in future versions

📊 Productivity Features

🔹 Study Timer

- Focus timer for study sessions
- Track study duration
- Activity logging for analytics

🔹 Progress Tracking

- Monitor total study hours
- Track quizzes taken
- View study streak days
- Visual analytics dashboard

🔹 Analytics Dashboard

- Study activity charts and visualizations
- Performance insights
- Session history tracking

🔐 User Management

🔹 Authentication System

- User login and signup pages
- Secure account management
- Session persistence

🎤 Additional Features

🔹 Voice Assistant (Experimental)

- Voice-based interaction capabilities
- Enhanced accessibility

🔹 Pricing Page

- Feature comparison
- Subscription tiers (if applicable)

🛠️ Tech Stack

**Frontend**

- React 18.3 – User interface
- Vite – Development and build tool
- React Router – Client-side routing
- CSS3 – Modern styling

**Backend**

- Python 3.8+
- FastAPI – High-performance backend framework
- Uvicorn – ASGI server
- SQLAlchemy – ORM for database operations

**AI**

- Google Gemini API – Primary Generative AI engine

**Database**

- SQLite – User data, chat history, study sessions, and analytics

**Visualization & Analytics**

- NetworkX – Graph structure for concept maps
- Matplotlib – Chart generation and visualizations

🏗️ System Architecture

```
Frontend (React + Vite)
        |
        | REST API
        |
Backend (FastAPI - Python)
        |
        |
Google Gemini API
```

**Flow:**

1. User enters a topic or query
2. Frontend sends request to backend
3. Backend constructs a structured prompt
4. Prompt is sent to Gemini API
5. AI-generated response is returned and displayed

📦 Installation

**Prerequisites**

- Node.js 16+
- Python 3.8+
- Git

**Step 1: Clone Repository**

```bash
git clone https://github.com/Arjit005/AI_Powered_StudyBuddy.git
cd AI_Powered_StudyBuddy
```

**Step 2: Backend Setup**

```bash
python -m venv .venv

# Activate virtual environment
# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r backend/requirements.txt
```

**Step 3: Frontend Setup**

```bash
npm install
```

⚙️ Configuration

Create a `.env` file in the root directory:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

You can generate the API key from [Google AI Studio](https://makersuite.google.com/app/apikey).

🚀 Usage

**Development Mode**

**Terminal 1 – Backend**

```bash
uvicorn backend.main:app --reload
```

Backend runs on: http://localhost:8000

**Terminal 2 – Frontend**

```bash
npm run dev
```

Frontend runs on: http://localhost:5173

🔌 API Endpoints

### Core AI Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Chat with AI assistant |
| POST | `/api/summarize` | Summarize a topic |
| POST | `/api/generate-quiz` | Generate quiz for a topic |
| POST | `/api/generate-flashcards` | Generate flashcards |
| POST | `/api/generate-map` | Generate concept map visualization |

### Progress & Analytics Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/track-activity` | Track study session activity |
| GET | `/api/progress` | Get user progress statistics |
| GET | `/api/analytics/dashboard` | Get analytics chart visualization |
| DELETE | `/api/chat` | Clear chat history |
| DELETE | `/api/progress` | Reset progress data |

### Request/Response Examples

**Generate Quiz:**
```json
POST /api/generate-quiz
{
  "topic": "Photosynthesis"
}
```

**Track Study Activity:**
```json
POST /api/track-activity
{
  "activity_type": "quiz",
  "duration_seconds": 300
}
```

**Get Progress:**
```json
GET /api/progress

Response:
{
  "study_hours": 12.5,
  "quizzes_taken": 8,
  "streak_days": 5
}
```

📁 Project Structure

```
AI_Powered_StudyBuddy/
│
├── backend/
│   ├── main.py              # FastAPI app & routes
│   ├── ai_service.py        # Gemini API logic & AI service
│   ├── models.py            # Database models
│   ├── database.py          # SQLite connection
│   ├── analytics.py         # Analytics & chart generation
│   ├── maps.py              # Concept map visualization
│   └── requirements.txt     # Python dependencies
│
├── src/
│   ├── components/          # Reusable React components
│   ├── pages/
│   │   ├── LoginPage.jsx    # User login
│   │   ├── SignupPage.jsx   # User registration
│   │   ├── Home.jsx         # Landing page
│   │   ├── Chat.jsx         # AI chat interface
│   │   ├── Quiz.jsx         # Quiz generator
│   │   ├── Flashcards.jsx   # Flashcard creator
│   │   ├── Maps.jsx         # Concept map viewer
│   │   ├── Summarize.jsx    # Topic summarizer
│   │   ├── Timer.jsx        # Study timer
│   │   ├── Progress.jsx     # Progress tracking
│   │   ├── Voice.jsx        # Voice assistant
│   │   └── Pricing.jsx      # Pricing information
│   ├── App.jsx              # Main app component
│   ├── main.jsx             # React entry point
│   └── index.css            # Global styles
│
├── public/
├── .env                     # API keys (gitignored)
├── .gitignore
├── package.json             # Node dependencies
├── README.md
├── study_buddy.db           # SQLite database
└── vite.config.js           # Vite configuration
```

🐛 Troubleshooting

**1. Gemini API Error**

- Check API key in `.env`
- Verify API quota in Google AI Studio

**2. Backend Not Starting**

- Ensure port 8000 is free
- Reinstall dependencies

```bash
pip install -r backend/requirements.txt
```

**3. Frontend Errors**

```bash
rm -rf node_modules package-lock.json
npm install
```

🎯 Future Enhancements

- ✅ ~~User authentication~~ (Already implemented)
- ✅ ~~Progress tracking~~ (Already implemented)
- Enhanced voice interaction with speech recognition
- Multi-language support
- Mobile application (React Native)
- Advanced AI-generated concept maps for more topics
- Spaced repetition algorithm for flashcards
- Export study materials to PDF
- Collaborative study rooms
- Integration with calendar apps
- Gamification and achievement badges

📄 License

This project is licensed under the MIT License.

📌 Project Note

This project is developed as a capstone and learning-oriented prototype.
Some advanced features are conceptual and intended for future expansion.

🙌 Made with passion for learning and AI

**GitHub:** https://github.com/Arjit005/AI_Powered_StudyBuddy
