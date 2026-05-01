# ConceptGraphAI — Major Project Report

**Project Title:** ConceptGraphAI — An AI-Powered Adaptive Learning Platform  
**Technology Domain:** Artificial Intelligence, Web Development, Educational Technology  
**Platform Type:** Full-Stack Web Application (MERN + Firebase + Ollama/Gemini)

---

## Table of Contents

1. [Abstract](#1-abstract)
2. [Introduction & Problem Statement](#2-introduction--problem-statement)
3. [Objectives](#3-objectives)
4. [System Architecture Overview](#4-system-architecture-overview)
5. [Technology Stack](#5-technology-stack)
6. [Frontend — Module Descriptions](#6-frontend--module-descriptions)
7. [Backend — Module Descriptions](#7-backend--module-descriptions)
8. [Database Design](#8-database-design)
9. [API Reference](#9-api-reference)
10. [AI Pipeline](#10-ai-pipeline)
11. [Bloom's Taxonomy Integration](#11-blooms-taxonomy-integration)
12. [Dependency Graph Engine](#12-dependency-graph-engine)
13. [User Workflow](#13-user-workflow)
14. [Security & Authentication](#14-security--authentication)
15. [Key Features Summary](#15-key-features-summary)
16. [Future Scope](#16-future-scope)
17. [File & Folder Structure](#17-file--folder-structure)

---

## 1. Abstract

ConceptGraphAI is a full-stack, AI-driven adaptive learning platform designed to help students master academic subjects through intelligent document processing, concept graph generation, and Bloom's Taxonomy-based assessment. The system accepts PDF documents (syllabuses, textbooks, notes), extracts topics and subtopics using large language models, constructs a hierarchical concept graph, and then provides personalized quiz sessions — both subjective and objective (MCQ) — evaluated by AI. After each quiz, an Ollama-powered dependency graph is generated, visually mapping which prerequisite concepts the student is weak in and what to study next. The platform integrates Firebase for authentication, MongoDB for persistent progress tracking, and supports both local (Ollama/llama3.1) and cloud (Google Gemini) AI backends.

---

## 2. Introduction & Problem Statement

Traditional learning systems present content linearly without understanding a student's conceptual gaps. Students often struggle with topics not because of the topic itself, but because they lack foundational prerequisite knowledge. Existing quiz platforms provide generic feedback without diagnosing *why* a student is underperforming.

**ConceptGraphAI** solves this by:
- Parsing the student's own curriculum documents (PDF)
- Generating a knowledge graph of concepts and their relationships
- Assessing mastery at each Bloom's Taxonomy cognitive level
- Diagnosing prerequisite gaps using AI after every quiz
- Visualising the dependency chain as an interactive graph

---

## 3. Objectives

| # | Objective |
|---|-----------|
| 1 | Upload and intelligently parse PDF syllabuses/textbooks |
| 2 | Extract hierarchical topics and subtopics using LLM |
| 3 | Generate a visual concept mind map from extracted topics |
| 4 | Provide Bloom's Taxonomy-aligned quiz questions (6 cognitive levels) |
| 5 | Support both Subjective (open-ended) and Objective (MCQ) quiz modes |
| 6 | AI-evaluate subjective answers with detailed rubric feedback |
| 7 | Track per-concept mastery progress across Bloom levels |
| 8 | Generate AI-powered prerequisite dependency graphs after quizzes |
| 9 | Provide a personalised dashboard with study analytics |
| 10 | Support multi-syllabus management per user |

---

## 4. System Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                   │
│  LandingPage → Login/Signup → Dashboard → ConceptGraph  │
│           → PracticePage (Quiz + BloomPanel)            │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API (HTTP/JSON)
┌──────────────────────▼──────────────────────────────────┐
│               BACKEND (Node.js / Express)               │
│  Routes → Controllers → Services → AI Layer             │
│  Upload │ Topics │ Graph │ Questions │ Bloom │ Deps      │
└────┬─────────────────────────────┬───────────────────────┘
     │                             │
┌────▼────────┐          ┌─────────▼──────────┐
│  MongoDB    │          │   AI Backends       │
│  (Progress, │          │  Ollama (llama3.1)  │
│   Graphs,   │          │  Google Gemini API  │
│   Sessions) │          └────────────────────┘
└─────────────┘
     │
┌────▼────────────┐
│  Firebase Auth  │
│  (User identity)│
└─────────────────┘
```

**Data Flow:**
1. User uploads PDF → `multer` stores file → text extracted via `pdf-parse` / `tesseract.js`
2. Extracted text → Ollama/Gemini → structured topic tree (JSON)
3. Topic tree → MongoDB → rendered as interactive mind map (Canvas)
4. User clicks a concept → Bloom Panel opens → quiz type selected
5. Ollama generates questions → user answers → AI evaluates
6. After last answer → Ollama generates dependency tree → rendered as SVG graph

---

## 5. Technology Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 19.2.5 | UI framework |
| React Router DOM | 7.14.0 | Client-side routing |
| Firebase (client) | 12.11.0 | Authentication |
| Recharts | 3.8.1 | Progress charts |
| React Flow Renderer | 10.3.17 | Graph visualisation |
| Axios | 1.15.0 | HTTP client |
| Vanilla CSS | — | Custom design system |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Node.js / Express | 5.2.1 | REST API server |
| Mongoose | 9.4.1 | MongoDB ODM |
| Multer | 2.1.1 | File upload handling |
| pdf-parse | 1.1.1 | PDF text extraction |
| tesseract.js | 7.0.0 | OCR for scanned PDFs |
| Firebase Admin | 13.8.0 | Server-side auth verification |
| dotenv | 17.4.1 | Environment config |
| nodemon | 3.1.14 | Dev hot-reload |

### AI & Data
| Technology | Purpose |
|---|---|
| Ollama (llama3.1) | Local LLM for all AI tasks |
| Google Gemini API (`@google/generative-ai` ^0.24.1) | Cloud LLM fallback |
| MongoDB Atlas / Local | Persistent data storage |
| Firebase Authentication | User identity & sessions |

---

## 6. Frontend — Module Descriptions

### Pages

| Page | Route | Description |
|---|---|---|
| `LandingPage.jsx` | `/` | Marketing page, platform overview, CTA to login |
| `LoginPage.jsx` | `/login` | Firebase email/password login |
| `SignupPage.jsx` | `/signup` | New user registration |
| `Dashboard` | `/dashboard` | Analytics overview — topic stats, quiz history, weak areas |
| `ConceptGraphPage.jsx` | `/concept-graph` | PDF upload → topic extraction → mind map visualisation |
| `PracticePage.jsx` | `/practice` | Quiz interface — Bloom Panel + concept mind map |
| `MySyllabusesPage.jsx` | `/syllabuses` | Manage uploaded syllabuses |
| `ProfilePage.jsx` | `/profile` | User profile settings |
| `AboutPage.jsx` | `/about` | Project information |

### Key Components

| Component | Description |
|---|---|
| `AppLayout.jsx` | Persistent sidebar + navigation wrapper for all authenticated pages |
| `BloomPanel.jsx` | Core quiz engine — level picker, question display, MCQ/subjective modes, dep graph |
| `DependencyGraph.jsx` | SVG tree renderer for AI-generated prerequisite dependency graphs |
| `QuizMindMap.jsx` | Interactive canvas mind map of concepts; clicking a node opens BloomPanel |
| `Dashboard.jsx` | Stats cards, topic progress, recent activity, weak area analysis |
| `GraphViewer.jsx` | Visualises concept relationship graph (nodes & edges) |
| `RootCauseGraph.jsx` | Canvas-based root cause / prerequisite graph from quiz performance |
| `FileUpload.jsx` | Drag-and-drop PDF upload with progress indicator |
| `QuestionPractice.jsx` | Question display with answer submission and AI feedback |
| `LearningPathPanel.jsx` | Step-by-step study plan based on Bloom level progress |
| `DependencyViewer.jsx` | Displays dependency relationships for a selected concept |

---

## 7. Backend — Module Descriptions

### Controllers

| Controller | Responsibility |
|---|---|
| `uploadController.js` | Handles PDF file upload via multer |
| `extractionController.js` | Triggers text extraction from uploaded file |
| `topicController.js` | Invokes LLM to extract topics from text; stores result |
| `graphController.js` | Builds and retrieves concept graph (nodes + edges) |
| `questionController.js` | Generates context-aware quiz questions per topic |
| `evaluationController.js` | AI-evaluates subjective answers with rubric scoring |
| `bloomController.js` | Full Bloom Taxonomy engine — progress, questions, evaluation, dependency analysis |
| `dependencyController.js` | Prerequisite dependency management |
| `weaknessController.js` | Analyses quiz history to identify weak areas |
| `pipelineController.js` | Orchestrates the full upload → extract → graph pipeline |

### Services

| Service | Responsibility |
|---|---|
| `ollamaService.js` | All Ollama API calls — topic extraction, question generation, evaluation |
| `bloomService.js` | Bloom-specific: question generation (subjective + MCQ), answer evaluation, dependency tree generation |
| `textExtractionService.js` | pdf-parse + tesseract.js OCR pipeline |
| `topicExtractionService.js` | Parses LLM output into structured topic hierarchy |
| `questionGenerationService.js` | Topic-scoped question generation helpers |
| `answerEvaluationService.js` | Rubric-based answer scoring helpers |
| `dependencyAnalysisService.js` | Prerequisite relationship computation |
| `weaknessAnalysisService.js` | Aggregates quiz results to identify knowledge gaps |
| `workflowService.js` | End-to-end workflow orchestration |
| `mongoService.js` | MongoDB connection management |
| `firebaseService.js` | Firebase Admin SDK — token verification |

### Routes

All routes are mounted at `/api` in `server.js`:

| Route Group | Base Path | Key Endpoints |
|---|---|---|
| Upload | `/api/upload` | `POST /upload` |
| Extraction | `/api/extract` | `POST /extract` |
| Topics | `/api/topics` | `POST /topics`, `GET /topics/:id` |
| Graph | `/api/graph` | `POST /graph`, `GET /graph/:id` |
| Questions | `/api/questions` | `POST /questions` |
| Evaluation | `/api/evaluate` | `POST /evaluate` |
| Bloom | `/api/bloom/*` | See Section 9 |
| Dependency | `/api/dependency` | `GET /dependency/:concept` |
| Weakness | `/api/weakness` | `GET /weakness/:userId` |
| Progress | `/api/progress` | `GET/POST /progress` |
| Session | `/api/session` | `POST /session` |
| Pipeline | `/api/pipeline` | `POST /pipeline/run` |

---

## 8. Database Design

### MongoDB Collections

#### `BloomProgress`
Stores per-user, per-concept Bloom mastery state.

| Field | Type | Description |
|---|---|---|
| `userId` | String | Firebase UID |
| `concept` | String | Concept/topic name |
| `syllabusId` | String | Source syllabus |
| `status` | Enum | `not_started / weak / partial / strong` |
| `bloomLevelReached` | Enum | Highest passed Bloom level |
| `bloom.remember` | Object | `{ achieved, score, attempts, lastAttempt }` |
| `bloom.understand` | Object | Same structure |
| `bloom.apply` | Object | Same structure |
| `bloom.analyze` | Object | Same structure |
| `bloom.evaluate` | Object | Same structure |
| `bloom.create` | Object | Same structure |
| `questionHistory` | Array | Each entry: question, answer, score, feedback, timestamp |
| `dependencies` | [String] | Prerequisite concept names |

**Index:** `{ userId, concept }` — unique compound index for fast lookup.

**Auto-computed fields** (via `.recompute()` method):
- `bloomLevelReached` — highest level where score ≥ pass threshold
- `status` — derived from `bloomLevelReached` index position

#### `Graph`
| Field | Type | Description |
|---|---|---|
| `userId` | String | Owner |
| `nodes` | Array | `{ id, label, type, parentId }` |
| `edges` | Array | `{ source, target, relation }` |
| `syllabusId` | String | Source document |

#### `QuizResult`
| Field | Type | Description |
|---|---|---|
| `userId` | String | Firebase UID |
| `concept` | String | Topic |
| `score` | Number | 0–100 |
| `bloomLevel` | String | Bloom level practiced |
| `timestamp` | Date | When taken |

#### `Session`
| Field | Type | Description |
|---|---|---|
| `userId` | String | Firebase UID |
| `syllabusId` | String | Active syllabus |
| `startTime` | Date | Session start |
| `endTime` | Date | Session end |
| `topicsStudied` | [String] | Topics visited |

#### `Progress`
| Field | Type | Description |
|---|---|---|
| `userId` | String | Firebase UID |
| `concept` | String | Topic |
| `mastery` | Number | 0–100 |
| `lastUpdated` | Date | Last activity |

---

## 9. API Reference

### Bloom Taxonomy API (`/api/bloom/`)

| Method | Endpoint | Body / Params | Response |
|---|---|---|---|
| `GET` | `/bloom/:concept?userId=` | — | `{ success, data: BloomProgress }` |
| `GET` | `/bloom/all?userId=` | — | `{ success, data: [] }` |
| `POST` | `/bloom/questions` | `{ userId, concept, bloomLevel, parentTopic, quizType, n }` | `{ success, questions: [] }` |
| `POST` | `/bloom/evaluate` | `{ userId, concept, bloomLevel, question, answer }` | `{ success, result, bloomProgress }` |
| `POST` | `/bloom/analyze-deps` | `{ concept, bloomLevel, parentTopic, quizResults[] }` | `{ success, score, nodes[] }` |
| `GET` | `/bloom/diagnose/:concept?userId=` | — | `{ success, issues[] }` |
| `GET` | `/bloom/path/:concept?userId=&targetLevel=` | — | `{ success, steps[] }` |

### Question Formats

**Subjective question:**
```json
{ "question": "Explain how recursion works.", "type": "subjective" }
```

**MCQ question:**
```json
{
  "question": "What is the primary purpose of an Expert System?",
  "type": "mcq",
  "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "correct": "B",
  "explanation": "Expert Systems mimic human decision-making..."
}
```

**Dependency node (from `/bloom/analyze-deps`):**
```json
{ "name": "Knowledge Representation", "parent": "Expert Systems",
  "status": "weak", "reason": "Student could not identify storage formats." }
```

### Core Pipeline API

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/upload` | Upload PDF file |
| `POST` | `/api/extract` | Extract text from uploaded file |
| `POST` | `/api/topics` | LLM topic extraction |
| `POST` | `/api/graph` | Build concept graph |
| `POST` | `/api/questions` | Generate questions for a topic |
| `POST` | `/api/evaluate` | Evaluate a student answer |
| `GET` | `/api/weakness/:userId` | Get weak areas from quiz history |
| `GET` | `/health` | Server health check |

---

## 10. AI Pipeline

### 10.1 Text Extraction
1. PDF uploaded via `multer`
2. `pdf-parse` attempts text extraction
3. If text is insufficient (scanned PDF), `tesseract.js` OCR runs on page images via `pdf-to-png-converter`
4. Cleaned text stored for LLM processing

### 10.2 Topic Extraction (Ollama / Gemini)
- Prompt: structured hierarchical extraction — subject → topics → subtopics
- Output: JSON tree of concepts with parent-child relationships
- Fallback: rule-based keyword extraction if LLM fails

### 10.3 Question Generation

**Subjective (Bloom-aligned):**
- Prompt explicitly references Bloom level descriptor
- `numPredict: 800`, `temperature: 0.6`
- Each question is open-ended requiring higher-order thinking

**MCQ (Objective):**
- Prompt uses strict line-based format: `Q: / A: / B: / C: / D: / ANSWER: / EXPLAIN:`
- Parser: splits by `Q:` prefix, extracts each field by line prefix
- `numPredict: 1000`, `temperature: 0.5`
- Resilient to Ollama formatting deviations

### 10.4 Answer Evaluation
- Rubric: Accuracy (25pts) + Depth (25pts) + Clarity (25pts) + Application (25pts) = 100
- Prompt includes the original question, student answer, and Bloom level
- Returns: `total`, `demonstratedLevel`, `feedback`, `improvements[]`
- On success: `BloomProgress` document updated with new score via `.recompute()`

### 10.5 Dependency Analysis
- Triggered automatically after all quiz questions answered
- Prompt: provides concept name, Bloom level, quiz score, and each Q&A result
- Output format: `NODE / PARENT / STATUS / REASON` blocks (blank-line separated)
- Parser: splits on `\n\n`, extracts fields by line prefix
- Status values: `current / strong / partial / weak / not_started`
- Root node always injected if missing
- `temperature: 0.3`, `numPredict: 650` — optimised for structured output

---

## 11. Bloom's Taxonomy Integration

Bloom's Taxonomy (Revised, 2001) classifies cognitive skills into six levels:

| Level | Verb Examples | Pass Score | Color |
|---|---|---|---|
| **Remember** | Define, list, recall | 70% | Slate |
| **Understand** | Explain, summarise, classify | 70% | Blue |
| **Apply** | Solve, use, demonstrate | 65% | Green |
| **Analyze** | Compare, differentiate, examine | 65% | Amber |
| **Evaluate** | Judge, critique, justify | 60% | Orange |
| **Create** | Design, construct, formulate | 60% | Purple |

### Progress Tracking Logic
```
bloomLevelReached = highest level where score ≥ pass threshold (sequential)
status:
  none/remember → 'not_started'
  understand     → 'weak'
  apply/analyze  → 'partial'
  evaluate/create → 'strong'
```

### Quiz Flow
1. User clicks a concept on the Mind Map → `BloomPanel` opens
2. User clicks a Bloom level row → quiz type picker appears (Subjective / MCQ)
3. User selects type → `loadQuestions()` called → questions generated
4. **Subjective:** textarea → Submit → AI evaluates → score + feedback shown
5. **MCQ:** 4 options shown → click to reveal correct/wrong → explanation shown
6. After ALL questions answered → `loadDepGraph()` triggers Ollama analysis
7. Dependency graph renders as SVG tree

---

## 12. Dependency Graph Engine

### `DependencyGraph.jsx` — SVG Tree Renderer

**Algorithm:**
1. Build adjacency list from flat `nodes[]` array (parent-child by name matching)
2. Compute subtree widths recursively
3. Position each node: `x = offsetX + subtreeWidth/2 - NODE_W/2`
4. Recurse into children, advancing `offsetX`
5. Draw bezier curves from `(parentCenter, parentBottom)` → `(childCenter, childTop)`

**Visual Design:**
- Node size: 172×60px, rounded rect with drop shadow
- Status badge: coloured circle (top-right) with symbol
- Arrow colours match child node status
- Dashed arrows for `not_started` nodes
- Legend row: Strong / Partial / Weak / Not Started
- Hover `<title>` tooltip shows reason text

**Status Colour Mapping:**

| Status | Node BG | Border | Badge | Symbol |
|---|---|---|---|---|
| current | `#eef2ff` | `#a5b4fc` | — | — |
| strong | `#f0fdf4` | `#86efac` | `#22c55e` | ✓ |
| partial | `#fffbeb` | `#fcd34d` | `#f59e0b` | ! |
| weak | `#fef2f2` | `#fca5a5` | `#ef4444` | ✗ |
| not_started | `#f8fafc` | `#cbd5e1` | `#94a3b8` | ○ |

---

## 13. User Workflow

```
Register / Login (Firebase)
        │
        ▼
Upload PDF Syllabus
        │
        ▼
AI Extracts Topics & Subtopics
        │
        ▼
View Interactive Mind Map
        │
  Click a Concept Node
        │
        ▼
BloomPanel Opens
  ├── Progress Tab → see current mastery per Bloom level
  └── Practice Tab
            │
      Select Bloom Level
            │
      Pick Quiz Type (Subjective / MCQ)
            │
      Answer All Questions
            │
            ▼
      AI Generates Dependency Graph
      (Shows: prerequisites weak/partial/not_started)
            │
            ▼
      Study Identified Gaps → Retry Quiz
```

---

## 14. Security & Authentication

| Layer | Mechanism |
|---|---|
| User Identity | Firebase Authentication (Email/Password) |
| Session Tokens | Firebase ID tokens (JWT), verified server-side via Firebase Admin SDK |
| Protected Routes | `ProtectedRoute.jsx` wrapper — redirects unauthenticated users to `/login` |
| API Security | All sensitive endpoints check `userId` from request body/query |
| File Storage | Uploaded files stored in `backend/uploads/` — served via static route |
| Environment Secrets | `.env` files excluded via `.gitignore` — API keys never committed |

---

## 15. Key Features Summary

| Feature | Status |
|---|---|
| PDF Upload & Text Extraction (OCR support) | ✅ |
| AI-Powered Topic Hierarchy Extraction | ✅ |
| Interactive Canvas Mind Map | ✅ |
| Bloom's Taxonomy 6-Level Assessment | ✅ |
| Subjective Quiz with AI Rubric Evaluation | ✅ |
| Objective (MCQ) Quiz with Instant Feedback | ✅ |
| Per-Concept Bloom Progress Persistence | ✅ |
| AI Dependency Graph after Quiz | ✅ |
| SVG Tree Dependency Visualisation | ✅ |
| Multi-Syllabus Management | ✅ |
| Dashboard with Analytics & Weak Areas | ✅ |
| Firebase Authentication | ✅ |
| Loading Spinners for All AI Operations | ✅ |
| Responsive Layout with Dark-Mode Design | ✅ |

---

## 16. Future Scope

| Enhancement | Description |
|---|---|
| **Spaced Repetition** | Schedule concept reviews based on Ebbinghaus forgetting curve |
| **Collaborative Study** | Shared syllabuses and group quiz sessions |
| **Voice Input** | Speech-to-text for subjective answer submission |
| **Mobile App** | React Native wrapper for the same backend |
| **Question Caching** | Cache generated MCQs in MongoDB to reduce Ollama latency |
| **Gamification** | Streaks, badges, leaderboards per syllabus |
| **Offline Mode** | PWA with service workers for offline quiz access |
| **Export Report** | PDF export of per-user Bloom progress reports |
| **LMS Integration** | Export/import via SCORM for Moodle/Canvas |
| **Multi-language** | Hindi/regional language PDF support via multilingual OCR |

---

## 17. File & Folder Structure

```
concept-graph-ai/
├── backend/
│   ├── server.js                   # Express app entry point
│   ├── config/                     # DB & Firebase config
│   ├── controllers/
│   │   ├── bloomController.js      # Bloom API handlers
│   │   ├── pipelineController.js   # Upload-extract-graph pipeline
│   │   ├── questionController.js   # Question generation
│   │   ├── evaluationController.js # Answer evaluation
│   │   └── ...
│   ├── models/
│   │   ├── BloomProgress.js        # Bloom mastery schema
│   │   ├── Graph.js                # Concept graph schema
│   │   ├── QuizResult.js           # Quiz result schema
│   │   └── Session.js              # Session schema
│   ├── routes/                     # Express routers (one per domain)
│   ├── services/
│   │   ├── bloomService.js         # Core Bloom AI logic
│   │   ├── ollamaService.js        # Ollama/Gemini API integration
│   │   ├── textExtractionService.js# PDF + OCR extraction
│   │   └── ...
│   └── uploads/                    # Uploaded PDFs (gitignored)
│
├── src/
│   ├── App.js                      # Router + AuthProvider
│   ├── components/
│   │   ├── BloomPanel.jsx          # Quiz engine component
│   │   ├── DependencyGraph.jsx     # SVG tree graph renderer
│   │   ├── QuizMindMap.jsx         # Concept mind map
│   │   ├── Dashboard.jsx           # Analytics dashboard
│   │   └── ...
│   ├── pages/
│   │   ├── ConceptGraphPage.jsx    # Upload + mind map page
│   │   ├── PracticePage.jsx        # Practice hub
│   │   ├── LandingPage.jsx         # Public landing page
│   │   └── ...
│   ├── context/
│   │   └── AuthContext.jsx         # Firebase auth context
│   ├── index.css                   # Global styles
│   └── theme.css                   # Design tokens
│
├── public/                         # Static assets
├── package.json                    # Frontend dependencies
└── .env                            # Environment variables
```

---

*Report generated: April 2026 | ConceptGraphAI v1.0 | Major Project Submission*
