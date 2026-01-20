# 🎓 AI Study Buddy

An intelligent study companion powered by AI that helps students learn more effectively through interactive quizzes, flashcards, concept maps, and personalized chat assistance.

![AI Study Buddy](https://img.shields.io/badge/AI-Powered-blue) ![React](https://img.shields.io/badge/React-18.3-61dafb) ![Python](https://img.shields.io/badge/Python-3.8+-3776ab) ![FastAPI](https://img.shields.io/badge/FastAPI-Latest-009688)

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Endpoints](#-api-endpoints)
- [Project Structure](#-project-structure)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

### 🧠 AI-Powered Learning Tools

1. **Quiz Generator**
   - Generate 10-question multiple-choice quizzes on any topic
   - Instant feedback and scoring
   - Adaptive difficulty based on topic complexity

2. **Flashcard Creator**
   - Create 10 flashcards per topic with questions and answers
   - Interactive flip animation
   - Perfect for memorization and quick review

3. **Concept Map Visualizer**
   - Generate hierarchical concept maps showing relationships
   - Interactive zoom and pan functionality
   - Compact, screen-friendly layout (13x9 format)
   - Hardcoded high-quality map for "Indian Judiciary System"

4. **AI Chat Assistant**
   - Real-time conversational AI for study help
   - Context-aware responses
   - Supports follow-up questions

5. **Topic Summarizer**
   - Generate concise summaries (under 300 words)
   - Key concepts and main details highlighted
   - Clean paragraph formatting

AI Provider Strategy

The system is designed with extensibility in mind.
Google Gemini API is used as the primary AI provider.

The architecture allows integration of additional AI providers in the future to improve availability and reliability.

Currently, Gemini API handles all AI-generated responses.

---

## 🛠️ Tech Stack

### Frontend
- **React 18.3** - UI framework
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **CSS3** - Styling with modern features

### Backend
- **Python 3.8+** - Core language
- **FastAPI** - High-performance web framework
- **Uvicorn** - ASGI server
- **SQLite** - Database for analytics and user data

### AI & APIs
- **Google Gemini API** - Primary AI provider
- **Hugging Face API** - Fallback AI provider (Mistral-7B-Instruct-v0.3)
- **Pollinations.ai** - Free public AI fallback

### Visualization
- **Matplotlib** - Concept map generation
- **NetworkX** - Graph structure for maps

---

## 🏗️ Architecture

```
┌─────────────────┐
│   React Frontend│
│   (Vite + React)│
└────────┬────────┘
         │ HTTP/REST
         ▼
┌─────────────────┐
│  FastAPI Backend│
│   (Python 3.8+) │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌──────────┐
│ SQLite │ │ AI Service│
│   DB   │ │  (Multi-  │
└────────┘ │  Provider)│
           └─────┬─────┘
                 │
        ┌────────┼────────┐
        ▼        ▼        ▼
    ┌──────┐ ┌────┐ ┌──────────┐
    │Gemini│ │ HF │ │Pollinations│
    └──────┘ └────┘ └──────────┘
```

---

## 📦 Installation

### Prerequisites

- **Node.js** 16+ and npm
- **Python** 3.8+
- **Git**

### Step 1: Clone the Repository

```bash
git clone https://github.com/Arjit005/AI_Powered_StudyBuddy.git
cd AI_Powered_StudyBuddy
```

### Step 2: Backend Setup

```bash
# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt
```

### Step 3: Frontend Setup

```bash
# Install dependencies
npm install
```

### Step 4: Environment Configuration

Create a `.env` file in the root directory:

```env
GEMINI_API_KEY=your_gemini_api_key_here
HUGGINGFACE_API_KEY=your_huggingface_api_key_here
```

**How to get API keys:**

1. **Gemini API Key**: Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. **Hugging Face API Key**: Visit [Hugging Face Settings](https://huggingface.co/settings/tokens)

---

## ⚙️ Configuration

### Backend Configuration

Edit `backend/main.py` to configure:
- CORS settings
- Database path
- API rate limits

### Frontend Configuration

Edit `vite.config.js` to configure:
- Dev server port (default: 5173)
- Proxy settings
- Build output directory

---

## 🚀 Usage

### Development Mode

**Terminal 1 - Backend:**
```bash
cd AI_Powered_StudyBuddy
uvicorn backend.main:app --reload
```
Backend runs on: `http://localhost:8000`

**Terminal 2 - Frontend:**
```bash
npm run dev
```
Frontend runs on: `http://localhost:5173`

### Production Build

```bash
# Build frontend
npm run build

# Serve with backend
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

### Using the Application

1. **Home Page** (`/`)
   - Chat with AI assistant
   - Ask questions about any topic

2. **Quiz Generator** (`/quiz`)
   - Enter a topic (e.g., "Photosynthesis")
   - Click "Generate Quiz"
   - Answer 10 multiple-choice questions
   - View your score

3. **Flashcards** (`/flashcards`)
   - Enter a topic
   - Generate 10 flashcards
   - Click cards to flip and reveal answers

4. **Concept Maps** (`/maps`)
   - Enter a topic (try "Indian Judiciary System")
   - View hierarchical concept map
   - Click to zoom and scroll

---

## 🔌 API Endpoints

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Send message to AI assistant |
| POST | `/api/generate-quiz` | Generate quiz for topic |
| POST | `/api/generate-flashcards` | Create flashcards |
| POST | `/api/generate-concept-map` | Generate concept map image |
| POST | `/api/summarize` | Get topic summary |
| GET | `/api/analytics` | Retrieve usage analytics |

### Request Examples

**Generate Quiz:**
```json
POST /api/generate-quiz
{
  "topic": "Photosynthesis"
}
```

**Response:**
```json
{
  "topic": "Photosynthesis",
  "questions": [
    {
      "id": 1,
      "question": "What is photosynthesis?",
      "options": ["A", "B", "C", "D"],
      "answer": "A"
    }
    // ... 9 more questions
  ]
}
```

---

## 📁 Project Structure

```
AI_Powered_StudyBuddy/
├── backend/
│   ├── __pycache__/          # Python bytecode (gitignored)
│   ├── ai_service.py          # AI provider logic & fallback chain
│   ├── analytics.py           # Usage tracking
│   ├── database.py            # SQLite connection
│   ├── main.py                # FastAPI app & routes
│   ├── maps.py                # Concept map generation
│   ├── models.py              # Database models
│   └── requirements.txt       # Python dependencies
├── public/
│   └── vite.svg               # Vite logo
├── src/
│   ├── components/            # React components
│   ├── pages/                 # Page components
│   │   ├── Chat.jsx           # AI chat interface
│   │   ├── Flashcards.jsx     # Flashcard generator
│   │   ├── Maps.jsx           # Concept map viewer
│   │   ├── Quiz.jsx           # Quiz generator
│   │   └── ...
│   ├── App.jsx                # Main app component
│   ├── main.jsx               # React entry point
│   └── index.css              # Global styles
├── .env                       # API keys (gitignored)
├── .gitignore                 # Git ignore rules
├── eslint.config.js           # ESLint configuration
├── index.html                 # HTML template
├── package.json               # Node dependencies
├── README.md                  # This file
├── study_buddy.db             # SQLite database
└── vite.config.js             # Vite configuration
```

---

## 🐛 Troubleshooting

### Common Issues

**1. "All AI Providers Failed" Error**

**Cause:** API keys are invalid or quota exceeded

**Solution:**
- Check `.env` file has valid API keys
- Verify Gemini API quota at [Google AI Studio](https://makersuite.google.com)
- Wait 24 hours for quota reset
- Generate new API key from different Google account

**2. Backend Not Starting**

**Cause:** Port 8000 already in use or dependencies missing

**Solution:**
```bash
# Kill existing process
# Windows:
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Reinstall dependencies
pip install -r backend/requirements.txt
```

**3. Frontend Build Errors**

**Cause:** Node modules corrupted or version mismatch

**Solution:**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

**4. Concept Maps Not Generating**

**Cause:** Matplotlib backend issues

**Solution:**
```bash
# Install required system dependencies
# Windows: Install Visual C++ Redistributable
# Linux: sudo apt-get install python3-tk
```

**5. CORS Errors**

**Cause:** Frontend and backend on different origins

**Solution:** Ensure `backend/main.py` has correct CORS settings:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Guidelines

- Follow PEP 8 for Python code
- Use ESLint rules for JavaScript/React
- Write descriptive commit messages
- Add comments for complex logic
- Test all features before submitting PR

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🙏 Acknowledgments

- **Google Gemini** for powerful AI capabilities
- **Hugging Face** for open-source AI models
- **Pollinations.ai** for free public AI access
- **FastAPI** for excellent Python web framework
- **React** and **Vite** for modern frontend development

---

## 📧 Contact

**Project Maintainer:** Arjit005

**GitHub:** [https://github.com/Arjit005/AI_Powered_StudyBuddy](https://github.com/Arjit005/AI_Powered_StudyBuddy)

---

## 🎯 Future Enhancements

- [ ] User authentication and profiles
- [ ] Save quiz results and progress tracking
- [ ] Export flashcards to PDF
- [ ] Mobile app (React Native)
- [ ] Collaborative study rooms
- [ ] Spaced repetition algorithm for flashcards
- [ ] Voice input for chat
- [ ] Multi-language support

---

**Made with ❤️ for students, by students**
