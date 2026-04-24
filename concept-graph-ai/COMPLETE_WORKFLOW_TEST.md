## Complete Pipeline Testing Guide

This guide provides step-by-step instructions to test the entire STEP 17 workflow from document upload through progress tracking.

---

## Prerequisites

✅ Backend server running on `http://localhost:5000`
✅ Firebase credentials configured in backend `.env`
✅ Frontend development server (or can test via curl/Postman)
✅ Sample documents ready for testing

---

## Test Environment Setup

### 1. Verify Backend is Running

```bash
cd backend
npm run dev
```

Expected output:
```
🚀 Server running on port 5000
🔥 Firebase initialized successfully
📝 Available endpoints:
  - POST /api/pipeline/process-document
  - POST /api/pipeline/generate-quiz
  - POST /api/pipeline/submit-answer
  - GET /api/pipeline/statistics/:userId
  - GET /api/pipeline/progress/:userId
  - GET /api/pipeline/recommendations/:userId
```

### 2. Create Test User ID

```bash
# Use this format for consistent testing
USER_ID="test_user_$(date +%s)"
echo $USER_ID  # Store this for later use
```

Or use a static ID for manual testing:
```bash
USER_ID="test_user_20240409"
```

---

## Complete Workflow Test

### ✅ STEP 1: Upload & Process Document

**Test Goal:** Verify document processing pipeline (upload → extract text → analyze topics → create graph)

**Using cURL:**

```bash
# Create a test document (or use existing PDF/text file)
curl -X POST http://localhost:5000/api/pipeline/process-document \
  -F "document=@/path/to/test.pdf" \
  -F "userId=test_user_20240409" \
  -v
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "graph_abc123",
    "topics": [
      {"name": "Machine Learning", "frequency": 12},
      {"name": "Neural Networks", "frequency": 8}
    ],
    "relationships": [
      {"source": "Machine Learning", "target": "Neural Networks", "type": "related"}
    ],
    "summary": "Document discusses ML concepts...",
    "createdAt": "2024-04-09T10:00:00Z"
  },
  "message": "Document processed successfully"
}
```

**Validation Checklist:**
- [ ] Response has `success: true`
- [ ] `data.id` exists (graph ID)
- [ ] `topics` array has at least 1 topic
- [ ] `topics[].name` is not empty
- [ ] `relationships` array structured correctly
- [ ] `summary` provides content overview
- [ ] `createdAt` is valid ISO timestamp

**Common Issues:**

| Issue | Solution |
|-------|----------|
| 413 Payload Too Large | Document exceeds 10MB, use smaller file |
| 400 unsupported file type | Use PDF, TXT, DOCX, PNG, JPG instead |
| 500 Firebase error | Check Firebase credentials in .env |
| 500 OpenAI error | Verify OpenAI API key is set correctly |

**Store Graph ID for next tests:**
```bash
GRAPH_ID="graph_abc123"  # Save from response
```

---

### ✅ STEP 2: Generate Quiz Questions

**Test Goal:** Verify quiz generation from extracted topics

**Using cURL:**

```bash
curl -X POST http://localhost:5000/api/pipeline/generate-quiz \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user_20240409",
    "graphId": "graph_abc123"
  }' \
  -v
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "questions": [
      {
        "question": "What is machine learning?",
        "topic": "Machine Learning",
        "options": [
          "A subset of AI",
          "A programming language",
          "A database",
          "A network protocol"
        ],
        "difficulty": "beginner"
      }
    ],
    "graphId": "graph_abc123",
    "totalQuestions": 5
  },
  "message": "Quiz generated successfully"
}
```

**Validation Checklist:**
- [ ] Response has `success: true`
- [ ] `questions` array has 1-5 items
- [ ] Each question has `question`, `topic`, `options`, `difficulty`
- [ ] Each question has 3-4 answer options
- [ ] `difficulty` is one of: beginner, intermediate, advanced
- [ ] `totalQuestions` matches questions array length

**Store First Question for next test:**
```bash
QUESTION="What is machine learning?"
TOPIC="Machine Learning"
```

---

### ✅ STEP 3: Submit Answer & Get Evaluation

**Test Goal:** Verify answer evaluation with AI feedback

**Using cURL:**

```bash
curl -X POST http://localhost:5000/api/pipeline/submit-answer \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user_20240409",
    "question": "What is machine learning?",
    "userAnswer": "A subset of artificial intelligence",
    "topic": "Machine Learning",
    "confidence": 75
  }' \
  -v
```

**Expected Response - Correct Answer:**
```json
{
  "success": true,
  "data": {
    "rating": "strong",
    "ratingLabel": "Excellent",
    "feedback": "Correct! Machine learning is indeed...",
    "correctAnswer": "A subset of AI",
    "masteryLevelUpdated": "advanced",
    "progressUpdated": true
  }
}
```

**Expected Response - Partial Answer:**
```json
{
  "success": true,
  "data": {
    "rating": "partial",
    "ratingLabel": "Good",
    "feedback": "You have the right idea but...",
    "correctAnswer": "A subset of AI",
    "masteryLevelUpdated": "intermediate",
    "progressUpdated": true
  }
}
```

**Validation Checklist:**
- [ ] `success: true`
- [ ] `rating` is one of: strong, partial, weak
- [ ] `ratingLabel` matches rating
- [ ] `feedback` is non-empty string
- [ ] `correctAnswer` provided
- [ ] `masteryLevelUpdated` is one of: beginner, intermediate, advanced
- [ ] `progressUpdated: true`

**Test Different Confidence Levels:**

```bash
# Test with low confidence (should be evaluated as tentative)
curl -X POST http://localhost:5000/api/pipeline/submit-answer \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user_20240409",
    "question": "What is machine learning?",
    "userAnswer": "A programming language",
    "topic": "Machine Learning",
    "confidence": 25
  }'

# Test with high confidence but wrong answer
curl -X POST http://localhost:5000/api/pipeline/submit-answer \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user_20240409",
    "question": "What is machine learning?",
    "userAnswer": "A database",
    "topic": "Machine Learning",
    "confidence": 95
  }'
```

---

### ✅ STEP 4: Verify Progress Gets Updated

**Test Goal:** Confirm user progress data is stored and updated

**Using cURL:**

```bash
curl -X GET http://localhost:5000/api/pipeline/progress/test_user_20240409 \
  -H "Content-Type: application/json" \
  -v
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "overallProgress": 45,
    "masteredTopics": [
      {"name": "Machine Learning", "masteryLevel": "advanced"}
    ],
    "inProgressTopics": [
      {"name": "Neural Networks", "masteryLevel": "intermediate"}
    ],
    "weakTopics": [],
    "lastUpdated": "2024-04-09T10:05:00Z"
  }
}
```

**Validation Checklist:**
- [ ] `success: true`
- [ ] `overallProgress` is 0-100 percentage
- [ ] `masteredTopics` array includes answered topics
- [ ] `inProgressTopics` array includes partially understood topics
- [ ] `weakTopics` array for areas needing improvement
- [ ] Each category topic has `masteryLevel`
- [ ] Topics match those from earlier steps

**Verify Data Persists:**
```bash
# Wait 5 seconds, then query again
sleep 5
curl -X GET http://localhost:5000/api/pipeline/progress/test_user_20240409
```

Expected: Same progress data should persist

---

### ✅ STEP 5: Get Learning Statistics

**Test Goal:** Verify statistics aggregation and accuracy calculations

**Using cURL:**

```bash
curl -X GET http://localhost:5000/api/pipeline/statistics/test_user_20240409 \
  -H "Content-Type: application/json" \
  -v
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "totalAnswered": 3,
    "correctAnswers": 2,
    "accuracy": 66.67,
    "currentStreak": 1,
    "accuracyByTopic": {
      "Machine Learning": 100,
      "Neural Networks": 50
    },
    "weakTopics": [
      {"name": "Neural Networks", "accuracy": 50}
    ]
  }
}
```

**Validation Checklist:**
- [ ] `totalAnswered` >= number of questions submitted
- [ ] `correctAnswers` <= `totalAnswered`
- [ ] `accuracy` = (correctAnswers / totalAnswered) * 100
- [ ] `currentStreak` is integer >= 0
- [ ] `accuracyByTopic` has entries for answered topics
- [ ] `weakTopics` includes topics with < 70% accuracy
- [ ] All statistics are numeric

**Accuracy Verification:**
```bash
# Manual calculation example:
# 3 questions answered: 2 strong, 1 weak
# Accuracy = (2/3) * 100 = 66.67%
# This should match the API response
```

---

### ✅ STEP 6: Get Learning Recommendations

**Test Goal:** Verify recommendation engine provides personalized suggestions

**Using cURL:**

```bash
curl -X GET http://localhost:5000/api/pipeline/recommendations/test_user_20240409 \
  -H "Content-Type: application/json" \
  -v
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "focusTopics": [
      {
        "name": "Neural Networks",
        "reason": "Low accuracy (50%)",
        "suggestedAction": "Review neural network basics"
      }
    ],
    "reviewTopics": [
      {
        "name": "Machine Learning",
        "reason": "Not practiced in last 24 hours",
        "suggestedAction": "Take a refresher quiz"
      }
    ],
    "insights": [
      "You're excelling in foundational ML concepts!",
      "Focus on applying concepts to complex scenarios"
    ]
  }
}
```

**Validation Checklist:**
- [ ] `success: true`
- [ ] `focusTopics` array with < 70% accuracy topics
- [ ] Each focus topic has `name`, `reason`, `suggestedAction`
- [ ] `reviewTopics` for practiced topics
- [ ] `insights` array with 1-3 motivational messages
- [ ] Recommendations are relevant to user's actual performance

---

## Complete Workflow Test (Frontend)

### Alternative: Test via React UI

```bash
# Terminal 1: Start backend
cd backend && npm run dev

# Terminal 2: Start frontend
cd frontend && npm start
```

Then in browser:

1. **Navigate to Home Page**
   - See feature cards and action buttons
   - Confirm UI loads without errors

2. **Upload Document**
   - Click "Upload Document" button
   - Drag & drop a test file or select one
   - Wait for processing progress
   - Confirm success message with topics

3. **Take Quiz**
   - Click "Take a Quiz" button
   - See generated questions
   - Answer each question
   - Adjust confidence slider
   - Submit answer and see feedback
   - Complete all questions
   - View final score

4. **View Progress**
   - Click "View Dashboard"
   - See overall progress percentage
   - Verify topics are categorized correctly
   - Switch to Statistics tab
   - Switch to Recommendations tab
   - Confirm all data matches API responses

---

## Batch Testing Script

Create `test_pipeline.sh` to automate testing:

```bash
#!/bin/bash

echo "🧪 Concept Graph AI - Pipeline Testing"
echo "========================================"

# Test configuration
BASE_URL="http://localhost:5000/api/pipeline"
USER_ID="test_user_$(date +%s)"
TEMP_FILE="test_document.txt"

# Create test document
cat > $TEMP_FILE << 'EOF'
Machine learning is a subset of artificial intelligence that focuses on 
developing algorithms and statistical models that enable computers to learn 
from data without being explicitly programmed. Neural networks are a key 
technology in modern machine learning, inspired by biological neural systems.
EOF

echo "📄 Using USER_ID: $USER_ID"

# Test 1: Upload & Process
echo -e "\n✅ TEST 1: Upload & Process Document"
RESPONSE=$(curl -s -X POST $BASE_URL/process-document \
  -F "document=@$TEMP_FILE" \
  -F "userId=$USER_ID")
GRAPH_ID=$(echo $RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "Graph ID: $GRAPH_ID"

# Test 2: Generate Quiz
echo -e "\n✅ TEST 2: Generate Quiz"
RESPONSE=$(curl -s -X POST $BASE_URL/generate-quiz \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_ID\", \"graphId\": \"$GRAPH_ID\"}")
echo "Questions generated: $(echo $RESPONSE | grep -o '"totalQuestions":[0-9]*')"

# Test 3: Submit Answers
echo -e "\n✅ TEST 3: Submit Answers"
curl -s -X POST $BASE_URL/submit-answer \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"$USER_ID\",
    \"question\": \"What is machine learning?\",
    \"userAnswer\": \"A subset of AI\",
    \"topic\": \"Machine Learning\",
    \"confidence\": 85
  }" | grep -o '"rating":"[^"]*'

# Test 4: Get Statistics
echo -e "\n✅ TEST 4: Get Statistics"
curl -s -X GET $BASE_URL/statistics/$USER_ID | grep -o '"accuracy":[0-9.]*'

# Test 5: Get Progress
echo -e "\n✅ TEST 5: Get Progress"
curl -s -X GET $BASE_URL/progress/$USER_ID | grep -o '"overallProgress":[0-9]*'

# Test 6: Get Recommendations
echo -e "\n✅ TEST 6: Get Recommendations"
curl -s -X GET $BASE_URL/recommendations/$USER_ID | grep -o '"focusTopics":\[\|"reviewTopics":\['

# Cleanup
rm $TEMP_FILE

echo -e "\n✅ All tests completed!"
```

Run the test:
```bash
chmod +x test_pipeline.sh
./test_pipeline.sh
```

---

## Performance Testing

### Measure Response Times

```bash
# Document upload
time curl -X POST http://localhost:5000/api/pipeline/process-document \
  -F "document=@test.pdf" \
  -F "userId=test_user"

# Quiz generation
time curl -X POST http://localhost:5000/api/pipeline/generate-quiz \
  -H "Content-Type: application/json" \
  -d '{"userId":"test_user"}'

# Statistics retrieval
time curl -X GET http://localhost:5000/api/pipeline/statistics/test_user
```

**Expected Response Times:**
- Document upload: 5-15 seconds (depends on file size)
- Quiz generation: 2-5 seconds
- Statistics: < 500ms
- Progress: < 500ms

---

## Error Scenario Testing

### Test 1: File Size Limit

```bash
# Create large file (>10MB)
dd if=/dev/zero of=large.bin bs=1M count=15

# Try to upload
curl -X POST http://localhost:5000/api/pipeline/process-document \
  -F "document=@large.bin" \
  -F "userId=test_user"

# Expected: 413 Payload Too Large or 400 Bad Request
```

### Test 2: Missing Required Fields

```bash
# Missing userId
curl -X POST http://localhost:5000/api/pipeline/process-document \
  -F "document=@test.pdf"
# Expected: 400 Bad Request, "userId is required"

# Missing question in answer submission
curl -X POST http://localhost:5000/api/pipeline/submit-answer \
  -H "Content-Type: application/json" \
  -d '{"userId":"test_user"}'
# Expected: 400 Bad Request, "question is required"
```

### Test 3: Invalid User ID Format

```bash
curl -X GET http://localhost:5000/api/pipeline/progress/invalid#user@id
# Expected: 400 Bad Request or handled gracefully
```

---

## Data Persistence Verification

### Verify Firebase Storage

After running tests, check Firebase Firestore:

1. Go to Firebase Console
2. Navigate to Firestore Database
3. Check for collection: `users/test_user_20240409/`
4. Verify subcollections:
   - `graphs/` - contains graph documents
   - `quizResults/` - contains answer evaluations
   - `progress/current` - contains user progress

Expected structure:
```
users
└── test_user_20240409
    ├── graphs
    │   └── graph_abc123
    │       ├── topics: [...]
    │       ├── relationships: [...]
    │       └── summary: "..."
    ├── quizResults
    │   └── result_001
    │       ├── question: "..."
    │       ├── userAnswer: "..."
    │       ├── rating: "strong"
    │       └── timestamp: ...
    └── progress
        └── current
            ├── masteredTopics: [...]
            ├── inProgressTopics: [...]
            ├── overallProgress: ...
            └── lastUpdated: ...
```

---

## Checklist & Sign-Off

When all tests pass, mark items as complete:

- [ ] Document upload processes without errors
- [ ] Graph is created with topics and relationships
- [ ] Quiz questions generate from topics
- [ ] Answers are evaluated correctly
- [ ] User progress updates after each answer
- [ ] Statistics are calculated accurately
- [ ] Recommendations are personalized
- [ ] Data persists in Firebase
- [ ] Response times are acceptable
- [ ] Frontend components work correctly
- [ ] Error handling catches validation errors
- [ ] File upload validation works

---

## Common Test Issues

| Issue | Solution |
|-------|----------|
| "Cannot POST /api/pipeline/process-document" | Start backend server: `npm run dev` |
| "Firebase not initialized" | Set FIREBASE_SERVICE_ACCOUNT_KEY in .env |
| "OpenAI API key not found" | Add OPENAI_API_KEY to backend .env |
| "No routes registered" | Check pipelineRoutes are imported in server.js |
| "CORS error" | Backend CORS should allow localhost:3000 |
| "Multer error: File field was not found" | Ensure form-data has document field |
| "404 Not Found" | Use correct endpoint path |
| "Connection refused" | Backend not running on port 5000 |

---

## Next Steps After Testing

✅ **If all tests pass:**
1. Deploy backend to production
2. Deploy frontend to hosting
3. Configure production Firebase database
4. Set up monitoring and error tracking
5. Create user documentation

❌ **If tests fail:**
1. Check error logs in console
2. Review backend server output
3. Verify .env configuration
4. Check Firebase credentials
5. Review API response data types
6. Adjust component error handling

---

## Documentation References

- [Backend API Documentation](../API_DOCUMENTATION.md)
- [Pipeline Architecture](../COMPONENT_ARCHITECTURE.md)
- [Workflow Service Details](../backend/services/workflowService.js)
- [Pipeline Controller Implementation](../backend/controllers/pipelineController.js)
- [Firebase Service Setup](../backend/services/firebaseService.js)
