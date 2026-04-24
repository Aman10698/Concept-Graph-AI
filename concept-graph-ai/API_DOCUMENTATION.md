# API Documentation

## Overview

This document describes the HTTP API endpoints and data formats used by the Concept Graph AI application.

## Base URL

```
http://localhost:3001/api
```

In production:
```
https://api.conceptgraph.ai/api
```

## Authentication

All API requests must include authentication headers:

```javascript
headers: {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${authToken}`
}
```

The `authToken` is obtained from Firebase Authentication.

## Endpoints

### Document Processing

#### `/documents/process`

**Method**: POST

**Description**: Process a document (image or PDF) and extract text

**Request Body**:
```javascript
{
  file: File,           // The document file (image or PDF)
  userId: string,       // User ID from Firebase Auth
}
```

**Response**:
```javascript
{
  success: boolean,
  data: {
    text: string,                    // Extracted text
    length: number,                  // Character count
    documentName: string,            // Original filename
    extractedAt: timestamp,
    pages?: number                   // For PDFs
  },
  error?: string                     // Error message if failed
}
```

**Status Codes**:
- `200`: Success
- `400`: Invalid file format
- `401`: Unauthorized
- `413`: File too large

---

### Topic Extraction

#### `/topics/extract`

**Method**: POST

**Description**: Extract topics from text using AI

**Request Body**:
```javascript
{
  text: string,                      // Text to analyze
  userId: string,                    // User ID from Firebase Auth
  documentName?: string,             // Optional document name
}
```

**Response**:
```javascript
{
  success: boolean,
  data: {
    topics: [
      {
        name: string,
        description: string,
        keywords: string[],
        relatedTopics?: string[]
      },
      ...
    ],
    relationships: [
      {
        from: string,
        to: string,
        relationship: string          // e.g., "prerequisite", "related"
      },
      ...
    ],
    difficulty: 'beginner' | 'intermediate' | 'advanced',
    estimatedTime: number,            // minutes
    extractedAt: timestamp
  },
  error?: string
}
```

**Status Codes**:
- `200`: Success
- `400`: Empty text
- `401`: Unauthorized
- `500`: AI processing error

---

### Quiz Generation

#### `/quiz/generate`

**Method**: POST

**Description**: Generate quiz questions from topics

**Request Body**:
```javascript
{
  topics: string[],                  // Topic names
  userId: string,                    // User ID
  difficulty?: 'beginner' | 'intermediate' | 'advanced',
  count?: number                     // Number of questions (default: 5)
}
```

**Response**:
```javascript
{
  success: boolean,
  data: {
    questions: [
      {
        id: string,
        topic: string,
        question: string,
        difficulty: string,
        answerGuidelines: string      // What a good answer should include
      },
      ...
    ],
    estimatedTime: number,            // minutes
    generatedAt: timestamp
  },
  error?: string
}
```

**Status Codes**:
- `200`: Success
- `400`: No topics provided
- `401`: Unauthorized
- `500`: AI generation error

---

### Answer Evaluation

#### `/quiz/evaluate`

**Method**: POST

**Description**: Evaluate a user's answer to a quiz question

**Request Body**:
```javascript
{
  question: string,
  topic: string,
  userAnswer: string,
  userId: string,
  answerGuidelines?: string,         // Expected answer guidelines
  confidence?: number                // User's confidence 0-100
}
```

**Response**:
```javascript
{
  success: boolean,
  data: {
    rating: 'strong' | 'partial' | 'weak',
    confidence: number,               // 0-100
    scores: {
      keyword: number,                // 0-100
      length: number,                 // 0-100
      understanding: number           // 0-100
    },
    feedback: string,                 // Detailed feedback
    suggestions: string[],            // How to improve
    references?: string[]             // Relevant topics to study
  },
  error?: string
}
```

**Status Codes**:
- `200`: Success
- `400`: Missing required fields
- `401`: Unauthorized
- `500`: AI evaluation error

---

### User Progress

#### `/progress/get`

**Method**: GET

**Description**: Get current user's progress

**Query Parameters**:
```javascript
userId: string  // User ID from Firebase Auth
```

**Response**:
```javascript
{
  success: boolean,
  data: {
    topics: {
      "Topic Name": {
        masteryLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert',
        confidence: number,            // 0-100
        questionsAttempted: number,
        correctAnswers: number,
        lastUpdated: timestamp
      },
      ...
    },
    weakTopics: [
      {
        topic: string,
        rootCause: string,             // Why it's weak
        identifiedAt: timestamp,
        suggestedActions: string[]
      },
      ...
    ],
    overallProgress: number,           // 0-100 average
    updatedAt: timestamp
  },
  error?: string
}
```

**Status Codes**:
- `200`: Success
- `401`: Unauthorized

---

#### `/progress/update`

**Method**: POST

**Description**: Manually update user progress (usually done automatically)

**Request Body**:
```javascript
{
  userId: string,
  topic: string,
  masteryLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert',
  confidence: number                 // 0-100
}
```

**Response**:
```javascript
{
  success: boolean,
  data: {
    topic: string,
    masteryLevel: string,
    updatedAt: timestamp
  },
  error?: string
}
```

**Status Codes**:
- `200`: Success
- `400`: Invalid mastery level
- `401`: Unauthorized

---

### Quiz Results

#### `/results/list`

**Method**: GET

**Description**: Get user's quiz results

**Query Parameters**:
```javascript
userId: string,                      // Required
topic?: string,                      // Optional filter
limit?: number,                      // Default: 20
offset?: number                      // Default: 0
```

**Response**:
```javascript
{
  success: boolean,
  data: {
    results: [
      {
        id: string,
        question: string,
        topic: string,
        userAnswer: string,
        rating: string,
        confidence: number,
        scores: { keyword, length, understanding },
        feedback: string,
        answeredAt: timestamp
      },
      ...
    ],
    total: number,
    hasMore: boolean
  },
  error?: string
}
```

**Status Codes**:
- `200`: Success
- `401`: Unauthorized

---

#### `/results/statistics`

**Method**: GET

**Description**: Get user's quiz statistics

**Query Parameters**:
```javascript
userId: string,                      // Required
timeframe?: 'week' | 'month' | 'all' // Default: 'all'
```

**Response**:
```javascript
{
  success: boolean,
  data: {
    totalQuestions: number,
    strongAnswers: number,
    partialAnswers: number,
    weakAnswers: number,
    averageConfidence: number,        // 0-100
    topicBreakdown: {
      "Topic Name": {
        total: number,
        strong: number,
        partial: number,
        weak: number,
        accuracy: number               // percentage
      },
      ...
    },
    streak: number,                   // Consecutive correct answers
    recentTrend: 'improving' | 'stable' | 'declining',
    generatedAt: timestamp
  },
  error?: string
}
```

**Status Codes**:
- `200`: Success
- `401`: Unauthorized

---

### Graphs (Mind Maps)

#### `/graphs/save`

**Method**: POST

**Description**: Save a graph/mind map

**Request Body**:
```javascript
{
  userId: string,
  topics: Array,                     // Array of topic objects
  relationships: Array,              // Array of relationship objects
  title?: string,
  description?: string
}
```

**Response**:
```javascript
{
  success: boolean,
  data: {
    graphId: string,
    title: string,
    createdAt: timestamp,
    nodeCount: number,
    edgeCount: number
  },
  error?: string
}
```

**Status Codes**:
- `200`: Success
- `400`: Invalid graph structure
- `401`: Unauthorized

---

#### `/graphs/list`

**Method**: GET

**Description**: Get user's saved graphs

**Query Parameters**:
```javascript
userId: string,                      // Required
limit?: number,                      // Default: 10
offset?: number                      // Default: 0
```

**Response**:
```javascript
{
  success: boolean,
  data: {
    graphs: [
      {
        id: string,
        title: string,
        nodeCount: number,
        edgeCount: number,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      ...
    ],
    total: number,
    hasMore: boolean
  },
  error?: string
}
```

**Status Codes**:
- `200`: Success
- `401`: Unauthorized

---

#### `/graphs/:graphId`

**Method**: GET

**Description**: Get a specific graph

**Path Parameters**:
```javascript
graphId: string                      // Graph ID
```

**Query Parameters**:
```javascript
userId: string                       // Required for auth
```

**Response**:
```javascript
{
  success: boolean,
  data: {
    id: string,
    title: string,
    topics: Array,
    relationships: Array,
    createdAt: timestamp,
    updatedAt: timestamp
  },
  error?: string
}
```

**Status Codes**:
- `200`: Success
- `401`: Unauthorized
- `404`: Graph not found

---

### Backups

#### `/backups/create`

**Method**: POST

**Description**: Create a backup of all user data

**Request Body**:
```javascript
{
  userId: string
}
```

**Response**:
```javascript
{
  success: boolean,
  data: {
    backupId: string,
    graphsCount: number,
    resultsCount: number,
    createdAt: timestamp
  },
  error?: string
}
```

**Status Codes**:
- `200`: Success
- `401`: Unauthorized

---

#### `/backups/export`

**Method**: GET

**Description**: Export all user data as JSON

**Query Parameters**:
```javascript
userId: string                       // Required
format?: 'json' | 'csv'             // Default: 'json'
```

**Response**: File download (JSON or CSV)

**Status Codes**:
- `200`: Success
- `401`: Unauthorized

---

## Error Responses

All error responses follow this format:

```javascript
{
  success: false,
  error: {
    code: string,                    // Error code
    message: string,                 // Human-readable message
    details?: object                 // Additional error details
  }
}
```

### Common Error Codes

| Code | Message | HTTP Status |
|------|---------|------------|
| `UNAUTHORIZED` | No valid authentication | 401 |
| `FORBIDDEN` | User not allowed | 403 |
| `INVALID_INPUT` | Request validation failed | 400 |
| `NOT_FOUND` | Resource not found | 404 |
| `SERVER_ERROR` | Internal server error | 500 |
| `AI_ERROR` | AI processing failed | 500 |
| `FILE_ERROR` | File processing failed | 400 |

---

## Rate Limiting

API requests are rate-limited per user:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/documents/process` | 10 | hour |
| `/topics/extract` | 20 | hour |
| `/quiz/generate` | 30 | hour |
| `/quiz/evaluate` | 100 | hour |
| `/progress/*` | 50 | hour |
| `/results/*` | 50 | hour |
| `/graphs/*` | 50 | hour |

**Rate Limit Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
```

---

## Data Types

### Topic Object

```javascript
{
  name: string,
  description: string,
  keywords: string[],
  difficulty: 'beginner' | 'intermediate' | 'advanced',
  relatedTopics?: string[],
  prerequisites?: string[]
}
```

### Relationship Object

```javascript
{
  from: string,                      // Topic name
  to: string,                        // Topic name
  relationship: 'prerequisite' | 'related' | 'extends' | 'depends',
  strength: number                   // 0-100, importance
}
```

### Quiz Result Object

```javascript
{
  id: string,
  question: string,
  topic: string,
  userAnswer: string,
  rating: 'strong' | 'partial' | 'weak',
  confidence: number,
  scores: {
    keyword: number,
    length: number,
    understanding: number
  },
  feedback: string,
  answeredAt: timestamp
}
```

---

## Pagination

Endpoints that return lists support pagination:

**Query Parameters**:
```javascript
limit: number      // Default: 20, Max: 100
offset: number     // Default: 0
```

**Response**:
```javascript
{
  data: [...],
  total: number,
  limit: number,
  offset: number,
  hasMore: boolean
}
```

---

## Webhooks (Future)

Webhooks can be configured to receive notifications for:

- Quiz results completed
- Progress milestones reached
- Weak topics identified
- New graphs created

Configuration endpoint: `/webhooks/configure`

---

## SDK & Client Libraries

### JavaScript/TypeScript

```bash
npm install @conceptgraph/api
```

```javascript
import { ConceptGraphAPI } from '@conceptgraph/api';

const api = new ConceptGraphAPI({
  apiKey: 'your-api-key',
  authToken: 'your-auth-token'
});

// Extract topics
const topics = await api.topics.extract({
  text: 'Your text here...'
});

// Generate quiz
const questions = await api.quiz.generate({
  topics: ['Algorithms', 'Data Structures']
});

// Evaluate answer
const evaluation = await api.quiz.evaluate({
  question: 'What is a binary tree?',
  userAnswer: 'A tree with at most 2 children per node'
});
```

---

## Versioning

The API follows semantic versioning:

- **v1**: Current version (endpoints: `/api/v1/...`)
- **v2**: Planned for Q4 2024

Version can be specified in:
1. URL path: `/api/v1/topics/extract`
2. Header: `Accept-Version: 1.0`

---

## Best Practices

1. **Always include userId**: Required for all authenticated endpoints
2. **Handle rate limits**: Check `X-RateLimit-Remaining` header
3. **Implement retry logic**: Use exponential backoff for failed requests
4. **Cache responses**: Minimize API calls
5. **Use batch endpoints**: When available, for multiple operations
6. **Monitor errors**: Log and track error codes
7. **Validate input**: Check data before sending to API

---

## Examples

### Complete Quiz Workflow

```javascript
import { ConceptGraphAPI } from '@conceptgraph/api';

const api = new ConceptGraphAPI({ authToken: 'token' });

// 1. Extract topics from document
const extraction = await api.topics.extract({
  text: documentText
});

// 2. Generate quiz questions
const quiz = await api.quiz.generate({
  topics: extraction.data.topics.map(t => t.name),
  count: 5
});

// 3. Evaluate answers
const evaluations = [];
for (const question of quiz.data.questions) {
  const evaluation = await api.quiz.evaluate({
    question: question.question,
    topic: question.topic,
    userAnswer: userAnswers[question.id],
    answerGuidelines: question.answerGuidelines
  });
  evaluations.push(evaluation);
}

// 4. Get updated progress
const progress = await api.progress.get();
```

---

## Support

For API support, issues, or feature requests:

- **Email**: api-support@conceptgraph.ai
- **Discord**: [Community Server](https://discord.gg/conceptgraph)
- **GitHub Issues**: [Repository](https://github.com/conceptgraph/api)

---

## Changelog

### v1.0.0 (Current)
- Initial API release
- Topic extraction
- Quiz generation and evaluation
- Progress tracking
- Graph storage
- Results management
