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

🔹 Topic Explanation

- Explains academic topics in simple language
- Uses bullet points and structured format
- Suitable for quick learning and revision

🔹 Topic Summarizer

- Generates concise summaries of study material
- Highlights key concepts and important points
- Useful for last-minute revision

🔹 Quiz Generator

- Automatically generates multiple-choice quizzes
- Helps students test their understanding
- Instant response generation using AI

🔹 Flashcard Generator

- Creates question–answer flashcards for a given topic
- Designed for memorization and quick review

🔹 Concept Visualization (Limited Scope)

- Displays structured visual representations for selected topics
- Currently demonstrated using predefined mappings
- Designed to be extended in future versions

🛠️ Tech Stack

**Frontend**

- React – User interface
- Vite – Development and build tool
- CSS3 – Styling

**Backend**

- Python 3.8+
- FastAPI – High-performance backend framework
- Uvicorn – ASGI server

**AI**

- Google Gemini API – Primary Generative AI engine

**Database (Optional / Basic)**

- SQLite – Used for simple data storage (if enabled)

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

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Chat with AI assistant |
| POST | `/api/explain` | Explain a topic |
| POST | `/api/summarize` | Summarize content |
| POST | `/api/generate-quiz` | Generate quiz |
| POST | `/api/generate-flashcards` | Generate flashcards |

📁 Project Structure

```
AI_Powered_StudyBuddy/
│
├── backend/
│   ├── main.py          # FastAPI app
│   ├── ai_service.py    # Gemini API logic
│   ├── requirements.txt
│
├── src/
│   ├── components/
│   ├── pages/
│   ├── App.jsx
│   ├── main.jsx
│
├── public/
├── .env
├── package.json
├── README.md
└── vite.config.js
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

- User authentication and profiles
- Save quiz results and learning history
- Voice-based interaction
- Multi-language support
- Mobile application
- Advanced concept visualization
- Spaced repetition for flashcards

📄 License

This project is licensed under the MIT License.

📌 Project Note

This project is developed as a capstone and learning-oriented prototype.
Some advanced features are conceptual and intended for future expansion.

🙌 Made with passion for learning and AI

**GitHub:** https://github.com/Arjit005/AI_Powered_StudyBuddy
