# 🎓 AI Study Buddy (NotebookLM RAG & MCP Edition)
> **Your Intelligent, Model Context Protocol (MCP) Powered Learning Companion, Document Grounded RAG Research Hub & Visual Architecture Studio.**
> *A full-stack, enterprise-grade learning platform featuring Grounded RAG with NotebookLM-style citations, Tiered Hybrid Memory Architecture, interactive Canvas Whiteboard modeling with Excalidraw export, high-fidelity Mermaid vector diagrams, spaced repetition, audio synthesis, and an enterprise safety suite.*

[![FastAPI](https://img.shields.io/badge/FastAPI-0.128-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React 19](https://img.shields.io/badge/React-19.0-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/TailwindCSS-v4.0-38B2AC?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![RAG Engine](https://img.shields.io/badge/RAG-NotebookLM_Citations-orange?style=flat&logo=openai)](https://github.com/Arjit005/AI_Powered_StudyBuddy)
[![Model Context Protocol](https://img.shields.io/badge/Model_Context_Protocol-JSON--RPC_2.0-8A2BE2?style=flat)](https://modelcontextprotocol.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon_%2F_Render-4169E1?style=flat&logo=postgresql&logoColor=white)](https://neon.tech/)
[![Mermaid](https://img.shields.io/badge/Mermaid.js-Vector_SVG-FF69B4?style=flat)](https://mermaid.js.org/)
[![Excalidraw](https://img.shields.io/badge/Excalidraw-Compatible-6965DB?style=flat)](https://excalidraw.com/)
[![JWT Auth](https://img.shields.io/badge/Auth-Server--Validated_JWT_%2B_Bcrypt-blue?style=flat)](https://pyjwt.readthedocs.io/)
[![Deploy on Render](https://img.shields.io/badge/Render-Live_Deployment-success?style=flat&logo=render&logoColor=white)](https://studybuddy-poweredby-ai.onrender.com)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat)](LICENSE)

---

## 🌐 Live Production Demo
- **Production Web Application**: [https://studybuddy-poweredby-ai.onrender.com](https://studybuddy-poweredby-ai.onrender.com)
- **Interactive Swagger API Docs**: [https://studybuddy-poweredby-ai.onrender.com/docs](https://studybuddy-poweredby-ai.onrender.com/docs)
- **MCP Endpoint**: [https://studybuddy-poweredby-ai.onrender.com/api/mcp](https://studybuddy-poweredby-ai.onrender.com/api/mcp)

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph Client ["Frontend Client (React 19 + Tailwind CSS v4)"]
        UI["🖥️ Modern Emerald Glassmorphic UI"]
        CanvasStudio["🎨 Visual Canvas Studio\n(Draggable Nodes + SVG Connectors)"]
        RAGHub["📚 Grounded Sources Hub\n(PDF/Web Upload + NotebookLM Badges)"]
        LibraryHub["🗂️ Persistent Study Library"]
        Flashcards["🗃️ Spaced Repetition (Anki/Leitner)"]
        CmdPalette["⚡ Command Palette (Ctrl+K)"]
    end

    subgraph Gateway ["Production Gateway & Security Shield (FastAPI)"]
        SecHeaders["🛡️ SecurityHeadersMiddleware\n(nosniff, DENY clickjack, Server masking)"]
        RateLimiter["⏱️ Sliding-Window Rate Limiter & Brute-Force Lockout"]
        AuthGuard["🔐 Server-Side JWT Validation (/api/auth/me)"]
        UploadGuard["📦 20MB Streaming File Size Guard"]
        SPAServer["📦 Static SPA Server\n(Dist directory-traversal safe fallback)"]
    end

    subgraph RAGCore ["NotebookLM Grounded RAG Engine"]
        Extractor["📄 PDF / Web Text Extractor (PyMuPDF, trafilatura)"]
        Chunker["✂️ Semantic Recursive Chunker (500 tokens, 10% overlap)"]
        VectorDB["🌲 Pinecone Vector DB / Local Dense Embeddings"]
        CitationEngine["📌 Citation Indexer & Source Attribution Linker"]
    end

    subgraph MCPBus ["Model Context Protocol (MCP) Layer"]
        MCPEndpoint["🔌 HTTP JSON-RPC 2.0 (/api/mcp)"]
        MCPStdio["💻 Standalone STDIO Server\n(Claude Desktop / Cursor)"]
        ToolsRegistry["🛠️ Registered MCP Tools\n(generate_canvas, query_sources, hybrid_memory)"]
    end

    subgraph AIOrchestrator ["Multi-Model Failover Pipeline"]
        Gemini["🥇 Primary: Google Gemini 2.5 Flash / Pro"]
        HF["🥈 Secondary: Hugging Face Mistral-7B"]
        Fallback["🥉 Tertiary: Deterministic Academic Engine"]
        HybridMem["🧠 Tiered Hybrid Memory\n(Tier-1 Working Buffer + Tier-2 Episodic Summary)"]
    end

    subgraph Persistence ["Persistence Layer (SQLAlchemy 2.0)"]
        DB[("PostgreSQL (Neon / Render) or SQLite\nUsers, Conversations, ChatHistory,\nSources, Chunks, Citations, Quizzes")]
    end

    UI -->|"REST / SSE Stream"| Gateway
    Gateway --> SecHeaders --> RateLimiter --> AuthGuard
    AuthGuard --> SPAServer
    AuthGuard --> RAGCore
    AuthGuard --> AIOrchestrator
    
    RAGHub -->|"Upload Docs"| UploadGuard --> Extractor --> Chunker --> VectorDB
    VectorDB --> CitationEngine --> DB
    
    UI -->|"Query + Sources"| AIOrchestrator
    AIOrchestrator --> HybridMem <--> DB
    RAGCore -->|"Grounded Context"| AIOrchestrator
    
    CanvasStudio -->|"Generate Graph"| MCPEndpoint
    MCPStdio --> ToolsRegistry
    MCPEndpoint --> ToolsRegistry
    ToolsRegistry --> AIOrchestrator
```

---

## 💎 Key Features & Capabilities

### 1. 📚 NotebookLM-Style Grounded RAG (`/sources`)
- **Document & Web Ingestion**: Upload academic PDFs, lecture slides, research papers, or paste web URLs.
- **Semantic Chunking**: Automatically slices documents into coherent 500-token chunks with 10% contextual overlap.
- **Dense Vector Search**: Powered by Pinecone vector index with automatic user namespace isolation (`user_{id}`) or local mathematical fallbacks.
- **In-Text Citation Badges**: AI responses automatically insert verifiable `[1]`, `[2]` citation pills that reveal the exact source excerpt and page number on hover.
- **Grounded Chat**: Toggle source grounding on or off per conversation with deterministic attribution.

### 2. 🔌 Model Context Protocol (MCP) Integration
- **Full JSON-RPC 2.0 Standard Compliance**: Allows external agents (Claude Desktop, Cursor IDE, Obsidian, Antigravity) to access Study Buddy capabilities.
- **Registered MCP Tools**:
  1. `generate_canvas_diagram`: Produces multi-tier visual nodes, geometry, and Excalidraw-compatible element arrays.
  2. `export_to_canvas_json`: Converts raw notes and concept hierarchies into visual canvas elements.
  3. `generate_mermaid_spec`: Generates validated Mermaid flowchart and sequence definitions.
  4. `query_study_memory`: Exposes SQLite/PostgreSQL hybrid memory context to external tools.
  5. `create_study_flashcards`: Generates active recall study cards.
- **Standalone STDIO Runner**: Launch `python backend/mcp_server.py` to hook into any local MCP client configuration.

### 3. 🎨 Visual Canvas Studio (`/canvas`)
- **Infinite Interactive Canvas**: Smooth pan, zoom (40% to 220%), fit-to-view, and drag-and-drop nodes.
- **Dynamic Bezier Curves**: Real-time curved SVG arrows connecting concept nodes that dynamically re-route when moved.
- **Excalidraw Integration**: 1-click **"Copy Excalidraw"** exports ready-to-paste JSON compatible with [excalidraw.com](https://excalidraw.com).
- **Mermaid Vector Synchronizer**: View and copy synchronized Mermaid.js code for any canvas graph.
- **Export to SVG / PNG**: High-resolution vector and image exports for assignments and documentation.

### 4. 🧠 Tiered Hybrid Memory Architecture
- **Tier-1 (Short-Term Working Buffer)**: Retains recent verbatim dialogue turns for sharp immediate conversational context.
- **Tier-2 (Episodic Long-Term Summary)**: Automatically condenses earlier turns when discussions exceed 10 messages, preserving conceptual knowledge without token bloat.
- **Live Memory Inspector**: Real-time modal in chat showing active buffer counts and long-term summary status.

### 5. 🗂️ Spaced Repetition & Focus Studio
- **Active Recall Flashcards (`/flashcards`)**: Anki/Leitner-style 3D flip cards with self-grading (🔴 Hard, 🟡 Good, 🟢 Mastered) and keyboard hotkeys (Space/1/2/3).
- **Pomodoro Focus Timer (`/timer`)**: Drift-free web worker timer with customizable work/break intervals, ambient audio, and session persistence.
- **Persistent Study Library (`/library`)**: Centralized repository for saved summaries, flashcard decks, diagrams, and quizzes with search and starring.

### 6. 🛡️ Enterprise Safety & Security Suite
- **Server-Side Protected Routes**: React routes verify JWT validity with `/api/auth/me` on mount, preventing token tampering or spoofed localStorage.
- **Sliding-Window Rate Limiter**: 60 req/min per client IP with bounded LRU eviction and brute-force lockout on repeated login failures.
- **PromptGuard Jailbreak Defense**: Regex heuristic filter intercepting prompt injection, role confusion, and system prompt leakage attempts.
- **Security Headers Middleware**: Enforces `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, and server technology masking (`Server: StudyBuddy-Gateway`).
- **20MB Streaming File Upload Limits**: Strict payload bounds on file and document ingestion with `HTTP 413` protection.

---

## 📁 Project Directory Organization

```
Internship_project_study_buddy/
├── backend/
│   ├── ai_service.py              # Multi-model inference (Gemini, HF, fallback)
│   ├── analytics.py               # Session analytics & progress metrics
│   ├── auth.py                    # Bcrypt password hashing & JWT token verification
│   ├── database.py                # Universal SQLAlchemy pool (PostgreSQL / SQLite)
│   ├── embedding_service.py      # Pinecone & Gemini vector embeddings
│   ├── guardrails.py             # Input / output safety filters
│   ├── main.py                    # FastAPI gateway, RAG endpoints, & SPA server
│   ├── maps.py                    # Concept graph network analysis
│   ├── mcp_server.py              # Standalone STDIO Model Context Protocol server
│   ├── mcp_service.py             # MCP JSON-RPC 2.0 processor & tool registry
│   ├── models.py                  # SQLAlchemy ORM schemas & migrations
│   ├── rag_service.py             # NotebookLM RAG engine (chunking, retrieval, citations)
│   ├── requirements.txt           # Python dependencies
│   └── security.py                # Rate limiting, PromptGuard, & security middleware
├── dist/                          # Production-compiled React SPA assets (served by FastAPI)
├── docs/                          # Architectural audits, evaluation benchmarks, checklists
├── public/                        # Static public assets
├── src/
│   ├── components/
│   │   ├── ui/
│   │   │   ├── FlipCard3D.jsx     # 3D interactive flashcard with CSS perspective
│   │   │   └── SpotlightCard.jsx  # Glassmorphic spotlight hover card
│   │   ├── ChatInterface.jsx      # Multi-session chat with hybrid memory inspector
│   │   ├── CommandPalette.jsx     # Global Ctrl+K spotlight navigation
│   │   ├── FeatureGrid.jsx        # Landing page feature matrix
│   │   ├── FeedbackWidget.jsx     # In-app user rating & feedback modal
│   │   ├── Header.jsx             # Glassmorphic navbar with telemetry badge
│   │   ├── Hero.jsx               # Landing page hero section
│   │   ├── Layout.jsx             # Base app container
│   │   ├── MermaidViewer.jsx      # Interactive vector SVG diagram renderer
│   │   └── StructuredMessage.jsx  # Markdown parser with code copy & citations
│   ├── pages/
│   │   ├── CanvasStudio.jsx       # Visual Canvas whiteboard with Excalidraw export
│   │   ├── Chat.jsx               # AI tutor chat page
│   │   ├── Flashcards.jsx         # Spaced repetition active recall cards
│   │   ├── Home.jsx               # Dashboard entrypoint
│   │   ├── Library.jsx            # Unified Study Library & saved notes
│   │   ├── LoginPage.jsx          # Secure login with lockout handling
│   │   ├── Maps.jsx               # Concept & architecture diagrams
│   │   ├── Pricing.jsx            # Glassmorphic subscription plans
│   │   ├── Progress.jsx           # Analytics & learning milestones
│   │   ├── Quiz.jsx               # Interactive MCQ quiz generator
│   │   ├── SignupPage.jsx         # Registration with 5-checkpoint password meter
│   │   ├── Sources.jsx            # NotebookLM RAG document upload & management
│   │   ├── Summarize.jsx          # Topic summarizer with TTS audio playback
│   │   ├── Timer.jsx              # Pomodoro focus timer with drift elimination
│   │   └── Voice.jsx              # Speech-to-text / voice study companion
│   ├── App.jsx                    # Route definitions with server-validated ProtectedRoute
│   ├── index.css                  # Emerald dark glassmorphic styling & scrollbars
│   └── main.jsx                   # React 19 root entrypoint
├── package.json                   # Frontend npm dependencies (React 19, Mermaid, Lucide)
├── render.yaml                    # Infrastructure-as-code blueprint for Render
└── vite.config.js                 # Vite configuration with proxy to port 8000
```

---

## ⚙️ Environment Variables

Create a `.env` file in the project root or configure these variables in your cloud hosting dashboard (Render / Railway / Fly.io):

| Variable | Required | Description | Example |
| :--- | :---: | :--- | :--- |
| `GEMINI_API_KEY` | Optional | Google Gemini Pro / Flash API key for primary AI reasoning | `AIzaSy...` |
| `HUGGINGFACE_API_KEY` | Optional | Hugging Face token for secondary LLM failover | `hf_...` |
| `PINECONE_API` | Optional | Pinecone key for fast dense vector RAG retrieval (`PINECONE_API_KEY` is also accepted) | `pcsk_...` |
| `PINECONE_INDEX_NAME` | Optional | Pinecone vector index name (defaults to `study-buddy-kb`) | `study-buddy-kb` |
| `DATABASE_URL` | Required in production; optional locally | PostgreSQL connection string (local development defaults to SQLite) | `postgresql://user:pass@ep-xyz.neon.tech/neondb` |
| `JWT_SECRET_KEY` | Required outside development | Secret used to sign application JWT session tokens | Generate a long random value |
| `CORS_ORIGINS` | Optional | Comma-separated list of allowed web origins | `https://my-domain.com,http://localhost:5173` |

---

## 🚀 Getting Started

### 1. Prerequisites
- Python 3.11+
- Node.js 18+

### 2. Local Backend Setup
```bash
# Navigate to project directory
cd Internship_project_study_buddy

# Activate virtual environment
# Windows:
.\.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Launch FastAPI backend
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

- **Backend API**: `http://127.0.0.1:8000`  
- **Interactive Swagger Docs**: `http://127.0.0.1:8000/docs`

### 3. Local Frontend Setup
```bash
# In a new terminal window
npm install
npm run dev
```

- **Frontend Application**: `http://localhost:5173`

---

## ☁️ Cloud Deployment (Render Blueprint)

The [Render blueprint](render.yaml) deploys a Python backend and a separate static frontend on [Render](https://render.com).

1. Push your repository to GitHub.
2. In Render, create a Blueprint instance from the repository and review both services.
3. Set `DATABASE_URL` for the backend to a persistent PostgreSQL database before deploying. The backend refuses to start in production without it.
4. Render generates `JWT_SECRET_KEY` from the blueprint. Add `GEMINI_API_KEY` and any optional provider keys as needed.
5. Confirm the frontend URL matches the backend's `CORS_ORIGINS` value.

Private study data (sources, conversations, chat history, library materials, and progress) requires a signed-in account. Stateless AI generation endpoints remain available without signing in.

---

## 🔌 Hooking MCP into Claude Desktop / Cursor

To connect AI Study Buddy's visual studio and memory tools into Claude Desktop, add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ai-study-buddy": {
      "command": "python",
      "args": ["c:/absolute/path/to/Internship_project_study_buddy/backend/mcp_server.py"]
    }
  }
}
```

The standalone STDIO server supports stateless generation tools. Account-specific `query_study_memory` calls require an authenticated HTTP MCP request with the account's Bearer token; the STDIO server has no account session and cannot read private conversations.

---

## 🧪 Testing & Quality Assurance

Run the comprehensive test suite locally:

```bash
# Run production integrity and safety evaluations
pytest tests/ -v
```

---

## 📜 License
MIT License. Built for students, engineers, and lifelong learners.
