# Data Storage & Persistence System

## Overview

The Concept Graph AI application now includes a comprehensive data storage system that automatically saves:
- **Graph Data** - Topics and concept relationships
- **Quiz Results** - Answers, scores, and evaluations
- **User Progress** - Mastery levels and learning state

All data is stored in **Firebase Firestore** for cloud persistence and cross-device syncing.

## Architecture

### Database Structure

```
Firestore
└── users/
    ├── {userId}/
    │   ├── graphs/
    │   │   ├── graph_{timestamp}/
    │   │   │   ├── topics: [...]
    │   │   │   ├── relationships: [...]
    │   │   │   ├── createdAt: timestamp
    │   │   │   └── updatedAt: timestamp
    │   ├── quizResults/
    │   │   ├── result_{timestamp}/
    │   │   │   ├── question: string
    │   │   │   ├── topic: string
    │   │   │   ├── userAnswer: string
    │   │   │   ├── rating: 'strong' | 'partial' | 'weak'
    │   │   │   ├── confidence: number (0-100)
    │   │   │   ├── scores: { keyword, length, understanding }
    │   │   │   ├── feedback: string
    │   │   │   └── answeredAt: timestamp
    │   ├── progress/
    │   │   └── current/
    │   │       ├── topics: {
    │   │       │   "Topic Name": {
    │   │       │     masteryLevel: string,
    │   │       │     confidence: number,
    │   │       │     lastUpdated: timestamp
    │   │       │   },
    │   │       │   ...
    │   │       }
    │   │       ├── weakTopics: [
    │   │       │   { topic, rootCause, identifiedAt },
    │   │       │   ...
    │   │       ]
    │   │       └── updatedAt: timestamp
    │   └── backups/
    │       └── backup_{timestamp}/
    │           ├── graphs: [...]
    │           ├── quizResults: [...]
    │           ├── progress: {...}
    │           └── backupAt: timestamp
```

## Key Features

### 1. Graph Data Storage

**When**: Automatically saved when topics are extracted from a document

**What's Stored**:
- List of topics extracted
- Topic relationships and dependencies
- Extracted text (first 10KB)
- Count of topics
- Timestamp

**Usage**:
```javascript
import { useGraphStorage } from '../hooks/useDataStorage';

const MyComponent = () => {
  const { saveGraph, loadGraphs } = useGraphStorage();
  
  // Save graph
  const result = await saveGraph(graphData, 'my_graph');
  
  // Load graphs
  const graphs = await loadGraphs();
};
```

### 2. Quiz Results Storage

**When**: Automatically saved when an answer is evaluated in practice mode

**What's Stored**:
- Question text and topic
- User's answer
- Evaluation rating (strong/partial/weak)
- Confidence score
- Individual component scores (keyword match, length, understanding)
- Feedback message
- Answer timestamp

**Usage**:
```javascript
import { useQuizStorage } from '../hooks/useDataStorage';

const MyComponent = () => {
  const { saveResult, loadResults, getStats } = useQuizStorage();
  
  // Save result
  await saveResult(quizResult);
  
  // Load results (optional filter by topic)
  const results = await loadResults({ topic: 'Algorithms' });
  
  // Get statistics
  const stats = await getStats();
};
```

**Statistics Returned**:
```javascript
{
  totalQuestions: number,
  strongAnswers: number,
  partialAnswers: number,
  weakAnswers: number,
  averageConfidence: number (0-100),
  topicBreakdown: {
    "Topic Name": {
      total: number,
      strong: number,
      partial: number,
      weak: number
    },
    ...
  }
}
```

### 3. User Progress Tracking

**When**: Updated whenever quiz results are evaluated

**What's Tracked**:
- Mastery level for each topic
- Confidence percentage for each topic
- Last time topic was evaluated
- Identified weak topics with root causes

**Usage**:
```javascript
import { useProgressTracking } from '../hooks/useDataStorage';

const MyComponent = () => {
  const { saveProgress, loadProgress, updateMastery, markWeakTopic } = useProgressTracking();
  
  // Load progress
  const progress = await loadProgress();
  
  // Update topic mastery automatically happens when answers are saved
  
  // Manually mark a topic as weak
  await markWeakTopic('Recursion', 'Functions');
};
```

## Data Flow

### Quiz Answer Workflow

```
User Answers Question
        ↓
Answer Evaluated by AI
        ↓
Evaluation Result Created
        ↓
persistQuizResult() called
        ↓
┌─────────────────────────────────────────┐
│ 1. Save to Firestore (Quiz Results)    │
│ 2. Update User Progress (Mastery)      │
│ 3. Update Local State                   │
└─────────────────────────────────────────┘
        ↓
Display Feedback to User
```

### Graph Extraction Workflow

```
User Uploads Document
        ↓
Text Extracted (OCR)
        ↓
Topics Extracted (AI)
        ↓
persistGraphData() called
        ↓
Save to Firestore
        ↓
Display Mind Map
```

## React Hooks

### useGraphStorage()

```javascript
const {
  saveGraph,      // (graphData, docName?) => Promise
  loadGraphs,     // () => Promise
  isLoading,      // boolean
  error           // string | null
} = useGraphStorage();
```

### useQuizStorage()

```javascript
const {
  saveResult,     // (result) => Promise
  loadResults,    // (options?) => Promise
  getStats,       // () => Promise
  isLoading,      // boolean
  error           // string | null
} = useQuizStorage();
```

### useProgressTracking()

```javascript
const {
  saveProgress,   // (progress) => Promise
  loadProgress,   // () => Promise
  updateMastery,  // (topic, level, confidence) => Promise
  markWeakTopic,  // (topic, rootCause) => Promise
  isLoading,      // boolean
  error           // string | null
} = useProgressTracking();
```

### useDataBackup()

```javascript
const {
  backup,         // () => Promise
  exportData,     // () => Promise (downloads JSON)
  isLoading,      // boolean
  error           // string | null
} = useDataBackup();
```

## Automatic Data Persistence

Data is automatically saved in these scenarios:

1. **Quiz Answers**: When an answer is evaluated
2. **Graph Data**: When topics are extracted from a document
3. **Progress**: Automatically updated when quiz results are saved

No manual intervention needed - the system handles all persistence automatically.

## Data Retrieval

### Loading Dashboard Data

The Dashboard automatically loads data from Firestore:

```javascript
const { success, data: stats } = await getQuizStatistics(userId);

// stats contains:
// - Total questions answered
// - Breakdown by rating (strong/partial/weak)
// - Average confidence
// - Topic-wise breakdown
```

### Querying Results by Topic

```javascript
const { success, data: results } = await loadResults({ 
  topic: 'Algorithms' 
});
```

Results are automatically sorted by date (newest first).

## Backup & Export

### Create Backup

```javascript
const { backup } = useDataBackup();
await backup(); // Creates complete backup in Firestore
```

### Export Data as JSON

```javascript
const { exportData } = useDataBackup();
await exportData(); // Downloads JSON file with all data
```

Exported JSON includes:
- All graphs
- All quiz results
- Current progress
- Statistics
- Timestamp

## Security & Privacy

- **User Isolation**: Each user only sees their own data
- **Authentication**: Only authenticated users can access data
- **Firestore Security Rules**: Configured to enforce user ownership

### Firestore Security Rules

```javascript
match /users/{userId} {
  allow read, write: if request.auth.uid == userId;
  
  match /graphs/{document=**} {
    allow read, write: if request.auth.uid == userId;
  }
  
  match /quizResults/{document=**} {
    allow read, write: if request.auth.uid == userId;
  }
  
  match /progress/{document=**} {
    allow read, write: if request.auth.uid == userId;
  }
}
```

## Storage Limits

- **Text Storage**: First 10KB of extracted text (to reduce storage costs)
- **Documents**: Unlimited (within Firestore quotas)
- **Document Size**: Max 1MB per document (enforced by Firestore)

## Performance Considerations

- **Async Operations**: All database operations are async to prevent blocking
- **Batch Operations**: Multiple results saved in parallel
- **Timestamps**: Server-side timestamps ensure consistency
- **Indexing**: Firestore auto-indexes on common queries

## Troubleshooting

### Data Not Saving

1. **Check Authentication**: User must be logged in
2. **Check Firebase Credentials**: Ensure .env has correct Firebase config
3. **Check Browser Console**: Look for error messages
4. **Check Firestore Rules**: Ensure user has write permissions

### Data Not Loading

1. **Check Authentication**: User must be logged in with correct UID
2. **Check Firestore Data**: Verify data exists in Firestore console
3. **Check Network**: Ensure internet connection is active

### Performance Issues

1. **Large Queries**: Limit number of results with pagination
2. **Too Many Listeners**: Close listeners when component unmounts
3. **Batch Operations**: Group writes together

## Next Steps

1. **Implement Real-time Updates**: Use Firestore listeners for live updates
2. **Add Offline Support**: Implement Firestore offline persistence
3. **Create Data Analytics**: Dashboard showing learning trends
4. **Add Data Sharing**: Share progress with mentors/instructors
5. **Implement Firestore Security Rules**: Enhance data protection
