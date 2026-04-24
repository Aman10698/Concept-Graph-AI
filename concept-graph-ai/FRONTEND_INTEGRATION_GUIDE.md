## Frontend Integration Guide

This guide covers how to integrate the frontend components with the backend pipeline API.

### Project Structure

```
frontend/
├── src/
│   ├── App.js (✅ CREATED)
│   ├── components/
│   │   ├── DocumentUpload.js (✅ CREATED)
│   │   ├── Quiz.js (✅ CREATED)
│   │   └── ProgressDashboard.js (✅ CREATED)
│   ├── hooks/
│   │   └── usePipeline.js (✅ CREATED)
│   ├── styles/
│   │   ├── App.css (✅ CREATED)
│   │   ├── DocumentUpload.css (✅ CREATED)
│   │   ├── Quiz.css (✅ CREATED)
│   │   └── ProgressDashboard.css (✅ CREATED)
│   └── index.js
└── package.json
```

---

## Installation & Setup

### 1. Install Dependencies

```bash
cd frontend
npm install
npm install axios
```

### 2. Environment Configuration

Create a `.env` file in the frontend directory:

```env
REACT_APP_API_URL=http://localhost:5000/api
```

For production:

```env
REACT_APP_API_URL=https://your-api-domain.com/api
```

### 3. Update App.js

Make sure your main App.js in `src/index.js` imports the new App component:

```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

---

## Component Usage

### 1. **App Component** - Main Navigation Hub

**File:** `src/App.js`

**Features:**
- Main home view with feature cards
- Navigation between upload, quiz, and dashboard
- User greeting and ID management
- Local storage integration

**Usage:**
The App component is the root and automatically handles all navigation and state.

### 2. **DocumentUpload Component**

**File:** `src/components/DocumentUpload.js`

**Props:**
```typescript
{
  userId: string,           // Required: User identifier
  onGraphCreated?: (graph: any) => void  // Callback when graph created
}
```

**Features:**
- Drag & drop file upload
- File validation (type, size)
- Processing progress indicator
- Graph summary display
- Error handling

**Usage:**
```jsx
<DocumentUpload 
  userId="user123"
  onGraphCreated={(graph) => console.log('Graph:', graph)}
/>
```

**Supported File Types:**
- PDF (.pdf)
- Text (.txt)
- HTML (.html)
- Word (.docx)
- Images (.png, .jpg, .jpeg)

**Max File Size:** 10MB

### 3. **Quiz Component**

**File:** `src/components/Quiz.js`

**Props:**
```typescript
{
  userId: string,              // Required: User identifier
  graphId?: string,           // Optional: Specific graph for quiz
  onAnswerSubmitted?: (evaluation: any) => void  // Callback
}
```

**Features:**
- Dynamic question generation
- Multiple choice or text input
- Confidence level slider
- Real-time AI evaluation
- Feedback with correct answers
- Quiz completion with scoring
- Answer review
- Retake functionality

**Usage:**
```jsx
<Quiz 
  userId="user123"
  graphId="graph456"
  onAnswerSubmitted={(result) => console.log('Result:', result)}
/>
```

### 4. **ProgressDashboard Component**

**File:** `src/components/ProgressDashboard.js`

**Props:**
```typescript
{
  userId: string  // Required: User identifier
}
```

**Features:**
- Overall progress percentage
- Topics categorized by mastery level
- Accuracy statistics
- Topic-based breakdown
- Learning recommendations
- Weakness identification
- Tabbed interface (Overview, Statistics, Recommendations)

**Usage:**
```jsx
<ProgressDashboard userId="user123" />
```

---

## usePipeline Hook

**File:** `src/hooks/usePipeline.js`

Complete hook for API communication with the backend pipeline.

### Hook State

```javascript
const {
  // State
  loading,              // Boolean - is operation in progress
  error,               // String - error message if any
  currentGraph,        // Object - last processed graph
  currentQuiz,         // Object - current quiz data
  progress,            // Object - user progress data
  statistics,          // Object - user statistics
  recommendations,     // Object - learning recommendations
  
  // Methods
  processDocument,     // Async - upload and process document
  generateQuiz,        // Async - generate quiz from topics
  submitAnswer,        // Async - submit and evaluate answer
  getStatistics,       // Async - fetch user statistics
  getProgress,         // Async - fetch user progress
  getRecommendations,  // Async - get learning recommendations
  
  // Utilities
  clearError           // Function - clear error message
} = usePipeline();
```

### Method Signatures

```javascript
// Process Document
const result = await processDocument(file, userId);
// Returns: { success, data, summary }

// Generate Quiz
const result = await generateQuiz(userId, graphId, topicFilter);
// Returns: { success, data }

// Submit Answer
const result = await submitAnswer(userId, question, userAnswer, topic, confidence);
// Returns: { success, data, summary }

// Get Statistics
const result = await getStatistics(userId);
// Returns: { success, data }

// Get Progress
const result = await getProgress(userId);
// Returns: { success, data }

// Get Recommendations
const result = await getRecommendations(userId);
// Returns: { success, data }
```

---

## API Endpoints Reference

All endpoints are prefixed with `http://localhost:5000/api/pipeline`

### 1. Process Document

**Endpoint:** `POST /pipeline/process-document`

**Request:**
```
Form Data:
- document: File (required)
- userId: string (required)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "graph_id",
    "topics": [
      { "name": "Topic 1", "frequency": 5 },
      { "name": "Topic 2", "frequency": 3 }
    ],
    "relationships": [
      { "source": "Topic 1", "target": "Topic 2", "type": "related" }
    ],
    "summary": "Brief document summary",
    "createdAt": "2024-04-09T10:00:00Z"
  }
}
```

### 2. Generate Quiz

**Endpoint:** `POST /pipeline/generate-quiz`

**Request:**
```json
{
  "userId": "string",
  "graphId": "string (optional)",
  "topicFilter": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "questions": [
      {
        "question": "What is...",
        "topic": "Topic 1",
        "options": ["Option 1", "Option 2", "Option 3"],
        "difficulty": "medium"
      }
    ],
    "graphId": "graph_id",
    "totalQuestions": 5
  }
}
```

### 3. Submit Answer

**Endpoint:** `POST /pipeline/submit-answer`

**Request:**
```json
{
  "userId": "string",
  "question": "string",
  "userAnswer": "string",
  "topic": "string",
  "confidence": "number (0-100)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rating": "strong|partial|weak",
    "ratingLabel": "Excellent|Good|Needs Work",
    "feedback": "Detailed feedback message",
    "correctAnswer": "Expected answer",
    "masteryLevelUpdated": "advanced|intermediate|beginner",
    "progressUpdated": true
  }
}
```

### 4. Get Statistics

**Endpoint:** `GET /pipeline/statistics/:userId`

**Response:**
```json
{
  "success": true,
  "data": {
    "totalAnswered": 25,
    "correctAnswers": 20,
    "accuracy": 80,
    "currentStreak": 3,
    "accuracyByTopic": {
      "Topic 1": 90,
      "Topic 2": 75
    },
    "weakTopics": [
      { "name": "Topic 3", "accuracy": 50 }
    ]
  }
}
```

### 5. Get Progress

**Endpoint:** `GET /pipeline/progress/:userId`

**Response:**
```json
{
  "success": true,
  "data": {
    "overallProgress": 65,
    "masteredTopics": [
      { "name": "Topic 1", "masteryLevel": "advanced" }
    ],
    "inProgressTopics": [
      { "name": "Topic 2", "masteryLevel": "intermediate" }
    ],
    "weakTopics": [
      { "name": "Topic 3", "masteryLevel": "beginner" }
    ]
  }
}
```

### 6. Get Recommendations

**Endpoint:** `GET /pipeline/recommendations/:userId`

**Response:**
```json
{
  "success": true,
  "data": {
    "focusTopics": [
      {
        "name": "Topic 3",
        "reason": "Low accuracy rate",
        "suggestedAction": "Review basics"
      }
    ],
    "reviewTopics": [
      {
        "name": "Topic 2",
        "reason": "Not practiced recently",
        "suggestedAction": "Take a refresh quiz"
      }
    ],
    "insights": [
      "You're doing great with foundational concepts!",
      "Focus on advanced topics next"
    ]
  }
}
```

---

## Error Handling

The `usePipeline` hook automatically handles errors and provides them via the `error` state.

```javascript
const { error, clearError } = usePipeline();

if (error) {
  return <ErrorMessage message={error} onDismiss={clearError} />;
}
```

Common error scenarios:
- File too large (>10MB)
- Invalid file type
- Network error
- Missing required fields
- Firebase initialization error

---

## Component Integration Example

```javascript
import React, { useState } from 'react';
import DocumentUpload from './components/DocumentUpload';
import Quiz from './components/Quiz';
import ProgressDashboard from './components/ProgressDashboard';

function LearningApp() {
  const [userId] = useState('user_123');
  const [currentView, setCurrentView] = useState('home');
  const [currentGraph, setCurrentGraph] = useState(null);

  return (
    <div>
      {currentView === 'home' && (
        <div>
          <button onClick={() => setCurrentView('upload')}>
            Upload Document
          </button>
          <button onClick={() => setCurrentView('quiz')}>Take Quiz</button>
          <button onClick={() => setCurrentView('dashboard')}>
            View Progress
          </button>
        </div>
      )}

      {currentView === 'upload' && (
        <DocumentUpload
          userId={userId}
          onGraphCreated={(graph) => {
            setCurrentGraph(graph);
            setCurrentView('home');
          }}
        />
      )}

      {currentView === 'quiz' && (
        <Quiz
          userId={userId}
          graphId={currentGraph?.id}
          onAnswerSubmitted={(result) => console.log(result)}
        />
      )}

      {currentView === 'dashboard' && (
        <ProgressDashboard userId={userId} />
      )}
    </div>
  );
}

export default LearningApp;
```

---

## Development Workflow

### 1. Start Backend Server

```bash
cd backend
npm run dev
# Server runs on http://localhost:5000
```

### 2. Start Frontend Development Server

```bash
cd frontend
npm start
# Frontend runs on http://localhost:3000
```

### 3. Test the Complete Flow

1. **Upload Document**
   - Navigate to Document Upload page
   - Drag and drop a file or select one
   - Wait for processing
   - See extracted topics and relationships

2. **Generate Quiz**
   - Click on Quiz section
   - Questions auto-generate from uploaded topics
   - Answer questions with confidence level
   - See AI evaluation and feedback

3. **Check Progress**
   - Go to Progress Dashboard
   - View overall mastery percentage
   - See topics by level (Mastered, In Progress, Weak)
   - Check accuracy statistics
   - Get learning recommendations

---

## Styling & Customization

### CSS Structure

Each component has its own CSS file:

- **App.css** - Main layout, hero section, feature cards
- **DocumentUpload.css** - File upload UI, drop zone, progress
- **Quiz.css** - Question display, answer options, feedback
- **ProgressDashboard.css** - Charts, statistics, recommendations

### Color Scheme

Primary gradient: **#667eea to #764ba2** (Purple gradient)

Override in CSS:
```css
:root {
  --primary-color: #667eea;
  --secondary-color: #764ba2;
  --success-color: #48bb78;
  --warning-color: #ed8936;
  --error-color: #f56565;
}
```

### Customizing Colors

Edit color variables in respective CSS files:

```css
.primary-button {
  background: linear-gradient(135deg, YOUR_COLOR_1 0%, YOUR_COLOR_2 100%);
}
```

---

## Troubleshooting

### Issue: "Cannot find module 'axios'"

**Solution:** Install axios
```bash
npm install axios
```

### Issue: CORS Error

**Solution:** Ensure backend CORS is configured (should be in Express setup)

### Issue: "API URL not found"

**Solution:** Check `.env` file has correct API URL

### Issue: File upload fails with "Form-Data" error

**Solution:** Ensure Multer is properly configured in backend

### Issue: Quiz questions not generating

**Solution:** 
1. Check if document was uploaded first
2. Verify Firebase is initialized
3. Check OpenAI API key in backend `.env`

---

## Performance Optimization Tips

1. **Implement Response Caching:**
   ```javascript
   const cache = new Map();
   const cachedGetStatistics = async (userId) => {
     if (cache.has(userId)) return cache.get(userId);
     const result = await getStatistics(userId);
     cache.set(userId, result);
     return result;
   };
   ```

2. **Lazy Load Components:**
   ```javascript
   const Quiz = React.lazy(() => import('./components/Quiz'));
   ```

3. **Paginate Large Results:**
   - Implement pagination for quiz results
   - Load topics in batches

4. **Optimize Images:**
   - Compress document previews
   - Use WebP format for better performance

---

## Next Steps

1. ✅ Frontend components created
2. ✅ usePipeline hook created
3. ⏭️ Configure Firebase credentials in backend
4. ⏭️ Test complete workflow
5. ⏭️ Deploy to production
6. ⏭️ Monitor performance and errors
7. ⏭️ Gather user feedback
8. ⏭️ Iterate on UI/UX

---

## Support & Documentation

For more information:
- [Backend API Documentation](../DOCUMENTATION_INDEX.md)
- [API Endpoints Reference](../API_DOCUMENTATION.md)
- [Component Architecture](../COMPONENT_ARCHITECTURE.md)
