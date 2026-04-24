# Testing & Quality Assurance Guide

## Overview

This guide covers all aspects of testing and quality assurance for the Concept Graph AI application, including unit tests, integration tests, E2E tests, and QA procedures.

---

## Testing Framework Setup

### Install Dependencies

```bash
# Backend testing
cd backend
npm install --save-dev jest supertest @testing-library/react ts-jest

# Frontend testing
cd frontend
npm install --save-dev @testing-library/react @testing-library/jest-dom vitest
```

### Configuration Files

**backend/jest.config.js**:
```javascript
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js', '**/?(*.)+(spec|test).js'],
  collectCoverageFrom: [
    'controllers/**/*.js',
    'services/**/*.js',
    'middleware/**/*.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

**frontend/vitest.config.js**:
```javascript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/setupTests.js']
    }
  }
});
```

---

## Unit Testing

### Backend Unit Tests

#### Topic Extraction Service

```javascript
// backend/__tests__/services/topicService.test.js
const { extractTopics, validateTopics } = require('../../services/topicService');

describe('Topic Extraction Service', () => {
  describe('extractTopics', () => {
    it('should extract topics from text', async () => {
      const text = 'React is a JavaScript library for building UIs...';
      const result = await extractTopics(text);

      expect(result.topics).toBeDefined();
      expect(Array.isArray(result.topics)).toBe(true);
      expect(result.topics.length).toBeGreaterThan(0);
    });

    it('should identify topic relationships', async () => {
      const text = 'Binary trees are a prerequisite for BST...';
      const result = await extractTopics(text);

      expect(result.relationships).toBeDefined();
      expect(Array.isArray(result.relationships)).toBe(true);
    });

    it('should handle empty input', async () => {
      const result = await extractTopics('');
      expect(result.topics).toEqual([]);
    });

    it('should throw error on invalid input', async () => {
      await expect(extractTopics(null)).rejects.toThrow();
    });
  });

  describe('validateTopics', () => {
    it('should validate correct topic structure', () => {
      const topic = {
        name: 'React Hooks',
        description: 'Functions for functional components',
        keywords: ['hooks', 'state', 'effect']
      };
      expect(validateTopics([topic])).toBe(true);
    });

    it('should reject invalid topic structure', () => {
      const invalidTopic = { name: 'React' }; // Missing required fields
      expect(validateTopics([invalidTopic])).toBe(false);
    });
  });
});
```

#### Answer Evaluation Service

```javascript
// backend/__tests__/services/evaluationService.test.js
const { evaluateAnswer, calculateScores } = require('../../services/evaluationService');

describe('Answer Evaluation Service', () => {
  describe('evaluateAnswer', () => {
    it('should rate strong answers correctly', async () => {
      const question = 'What is a closure?';
      const answer = 'A closure is a function that has access to variables from its outer scope';
      const guidelines = 'Should mention function and outer scope';

      const result = await evaluateAnswer({
        question,
        answer,
        guidelines
      });

      expect(result.rating).toBe('strong');
      expect(result.scores.understanding).toBeGreaterThan(75);
    });

    it('should rate partial answers correctly', async () => {
      const question = 'What is a closure?';
      const answer = 'A function in JavaScript';
      const guidelines = 'Should mention function and outer scope';

      const result = await evaluateAnswer({
        question,
        answer,
        guidelines
      });

      expect(result.rating).toBe('partial');
      expect(result.scores.understanding).toBeLessThan(75);
      expect(result.scores.understanding).toBeGreaterThan(40);
    });

    it('should rate weak answers correctly', async () => {
      const question = 'What is a closure?';
      const answer = 'No idea';
      const guidelines = 'Should mention function and outer scope';

      const result = await evaluateAnswer({
        question,
        answer,
        guidelines
      });

      expect(result.rating).toBe('weak');
      expect(result.scores.understanding).toBeLessThan(40);
    });
  });

  describe('calculateScores', () => {
    it('should calculate keyword match score', () => {
      const score = calculateScores.keyword(
        'function access outer scope',
        ['function', 'scope']
      );
      expect(score).toBeGreaterThan(50);
    });

    it('should calculate length score', () => {
      const shortAnswer = 'Yes';
      const longAnswer = 'This is a comprehensive answer that covers all aspects of the topic';

      const shortScore = calculateScores.length(shortAnswer);
      const longScore = calculateScores.length(longAnswer);

      expect(longScore).toBeGreaterThan(shortScore);
    });

    it('should calculate understanding score', () => {
      const wellStructured = 'A closure is 1) a function 2) that has access 3) to outer scope';
      const poorlyStructured = 'function scope access';

      const wellScore = calculateScores.understanding(wellStructured);
      const poorScore = calculateScores.understanding(poorlyStructured);

      expect(wellScore).toBeGreaterThan(poorScore);
    });
  });
});
```

#### API Route Tests

```javascript
// backend/__tests__/routes/topics.test.js
const request = require('supertest');
const app = require('../../server');
const { mockAuthToken } = require('../mocks');

describe('Topics API Routes', () => {
  describe('POST /api/topics/extract', () => {
    it('should extract topics from text', async () => {
      const response = await request(app)
        .post('/api/topics/extract')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({
          text: 'React is a JavaScript library...',
          userId: 'user123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.topics).toBeDefined();
      expect(Array.isArray(response.body.data.topics)).toBe(true);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/topics/extract')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({ userId: 'user123' }); // Missing text

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle unauthorized access', async () => {
      const response = await request(app)
        .post('/api/topics/extract')
        .send({
          text: 'React is...',
          userId: 'user123'
        });

      expect(response.status).toBe(401);
    });

    it('should handle server errors gracefully', async () => {
      // Mock error in service
      jest.spyOn(topicService, 'extract').mockRejectedValueOnce(
        new Error('AI service error')
      );

      const response = await request(app)
        .post('/api/topics/extract')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({
          text: 'React is...',
          userId: 'user123'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });
});
```

### Frontend Unit Tests

#### Component Tests

```javascript
// frontend/src/__tests__/components/QuestionDisplay.test.jsx
import { render, screen } from '@testing-library/react';
import QuestionDisplay from '../../components/QuestionDisplay';
import '@testing-library/jest-dom';

describe('QuestionDisplay Component', () => {
  const mockQuestion = {
    id: '1',
    text: 'What is React?',
    topic: 'React',
    difficulty: 'beginner'
  };

  it('should render question text', () => {
    render(<QuestionDisplay question={mockQuestion} />);
    expect(screen.getByText('What is React?')).toBeInTheDocument();
  });

  it('should display question number', () => {
    render(
      <QuestionDisplay 
        question={mockQuestion} 
        questionNumber={1}
        totalQuestions={10}
      />
    );
    expect(screen.getByText(/1 of 10/i)).toBeInTheDocument();
  });

  it('should show difficulty badge', () => {
    render(<QuestionDisplay question={mockQuestion} />);
    expect(screen.getByText('beginner')).toHaveClass('badge-beginner');
  });

  it('should render without difficulty if not provided', () => {
    const question = { ...mockQuestion, difficulty: null };
    const { container } = render(<QuestionDisplay question={question} />);
    expect(container.querySelector('.badge')).not.toBeInTheDocument();
  });
});
```

#### Hook Tests

```javascript
// frontend/src/__tests__/hooks/useQuizStorage.test.js
import { renderHook, act, waitFor } from '@testing-library/react';
import { useQuizStorage } from '../../hooks/useDataStorage';

// Mock Firebase
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  addDoc: jest.fn(),
  query: jest.fn(),
  getDocs: jest.fn(),
  orderBy: jest.fn()
}));

describe('useQuizStorage Hook', () => {
  it('should save quiz result', async () => {
    const { result } = renderHook(() => useQuizStorage());
    const mockResult = {
      question: 'Test?',
      userAnswer: 'Test answer',
      rating: 'strong',
      confidence: 85
    };

    await act(async () => {
      const response = await result.current.saveResult(mockResult);
      expect(response.success).toBe(true);
    });
  });

  it('should load quiz results', async () => {
    const { result } = renderHook(() => useQuizStorage());

    await act(async () => {
      const results = await result.current.loadResults();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  it('should calculate statistics', async () => {
    const { result } = renderHook(() => useQuizStorage());

    await act(async () => {
      const stats = await result.current.getStats();
      expect(stats.totalQuestions).toBeGreaterThanOrEqual(0);
      expect(stats.averageConfidence).toBeLessThanOrEqual(100);
    });
  });
});
```

---

## Integration Testing

### Backend Integration Tests

```javascript
// backend/__tests__/integration/quiz.integration.test.js
const request = require('supertest');
const app = require('../../server');

describe('Quiz Integration Tests', () => {
  const userId = 'test-user-123';
  const authToken = 'valid-token';

  describe('Complete Quiz Workflow', () => {
    it('should complete full quiz workflow', async () => {
      // Step 1: Generate quiz
      const genResponse = await request(app)
        .post('/api/quiz/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          topics: ['React', 'Hooks'],
          userId,
          count: 2
        });

      expect(genResponse.status).toBe(200);
      const questions = genResponse.body.data.questions;

      // Step 2: Evaluate first answer
      const evalResponse = await request(app)
        .post('/api/quiz/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          question: questions[0].question,
          topic: questions[0].topic,
          userAnswer: 'React is a JavaScript library',
          userId,
          confidence: 75
        });

      expect(evalResponse.status).toBe(200);
      expect(evalResponse.body.data.rating).toBeDefined();

      // Step 3: Check progress updated
      const progressResponse = await request(app)
        .get('/api/progress/get')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ userId });

      expect(progressResponse.status).toBe(200);
      expect(progressResponse.body.data.topicBreakdown).toBeDefined();
    });
  });

  describe('Data Persistence', () => {
    it('should save and retrieve quiz results', async () => {
      // Save result
      const saveResponse = await request(app)
        .post('/api/quiz/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          question: 'Test question?',
          topic: 'React',
          userAnswer: 'Test answer',
          userId
        });

      expect(saveResponse.status).toBe(200);

      // Retrieve result
      const retrieveResponse = await request(app)
        .get('/api/results/list')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ userId, topic: 'React' });

      expect(retrieveResponse.status).toBe(200);
      expect(retrieveResponse.body.data.results.length).toBeGreaterThan(0);
    });
  });
});
```

### Frontend Integration Tests

```javascript
// frontend/src/__tests__/integration/QuizFlow.integration.test.jsx
import { render, screen, userEvent, waitFor } from '@testing-library/react';
import QuizFlow from '../../components/QuizFlow';

describe('Quiz Flow Integration', () => {
  it('should complete full quiz flow', async () => {
    render(<QuizFlow topics={['React']} />);

    // Wait for questions to load
    await waitFor(() => {
      expect(screen.getByText(/What/)).toBeInTheDocument();
    });

    // Enter answer
    const input = screen.getByPlaceholderText(/Your answer/i);
    await userEvent.type(input, 'React is a JavaScript library');

    // Set confidence
    const slider = screen.getByRole('slider');
    await userEvent.click(slider);

    // Submit answer
    const submitBtn = screen.getByText(/Submit/i);
    await userEvent.click(submitBtn);

    // Check feedback displayed
    await waitFor(() => {
      expect(screen.getByText(/Feedback/i)).toBeInTheDocument();
    });

    // Check progress updated
    expect(screen.getByText(/Question 1 of/)).toBeInTheDocument();
  });

  it('should handle network errors gracefully', async () => {
    // Mock API error
    global.fetch = jest.fn(() =>
      Promise.reject(new Error('Network error'))
    );

    render(<QuizFlow topics={['React']} />);

    await waitFor(() => {
      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    });
  });
});
```

---

## End-to-End Testing

### Cypress Setup

```bash
npm install --save-dev cypress
npx cypress open
```

### E2E Test Cases

```javascript
// cypress/e2e/quiz.cy.js
describe('Quiz E2E Tests', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000');
    cy.login('test@example.com', 'password123');
  });

  it('should complete full quiz workflow', () => {
    // Upload document
    cy.visit('/learn');
    cy.get('[data-testid="upload"]').click();
    cy.get('input[type="file"]').selectFile('cypress/fixtures/sample.pdf');

    // Wait for topics extraction
    cy.contains('Topics Extracted', { timeout: 10000 }).should('be.visible');

    // Navigate to quiz
    cy.get('[data-testid="generate-quiz"]').click();
    cy.get('[data-testid="topic-select"]').click();
    cy.contains('React').click();

    // Answer questions
    for (let i = 0; i < 3; i++) {
      cy.get('[data-testid="answer-input"]').type('React is a library');
      cy.get('[data-testid="confidence-slider"]').invoke('val', 75).trigger('change');
      cy.get('[data-testid="submit-btn"]').click();

      // Check feedback displayed
      cy.contains(/Feedback|Evaluation/i).should('be.visible');

      // Next question (if not last)
      if (i < 2) {
        cy.get('[data-testid="next-btn"]').click();
      }
    }

    // Check results
    cy.contains(/Quiz Complete|Results/i).should('be.visible');
    cy.contains(/Accuracy|Score/i).should('be.visible');
  });

  it('should display progress on dashboard', () => {
    cy.visit('/dashboard');

    cy.contains(/Progress|Statistics/i).should('be.visible');
    cy.get('[data-testid="stat-card"]').should('have.length.at.least', 3);
    cy.contains('Topics Mastered').should('be.visible');
  });

  it('should handle document upload errors', () => {
    cy.visit('/learn');
    cy.get('[data-testid="upload"]').click();

    // Try to upload oversized file
    cy.get('input[type="file"]').selectFile('cypress/fixtures/large-file.pdf');

    cy.contains(/File too large|Size limit/i).should('be.visible');
  });
});
```

---

## Performance Testing

### Lighthouse Audit

```bash
# Install Lighthouse
npm install --save-dev lighthouse

# Run audit
lighthouse http://localhost:3000 --view

# Generate report
lighthouse http://localhost:3000 --output=html --output-path=./report.html
```

### Load Testing

```bash
# Install Apache Bench
brew install httpd  # macOS
apt-get install apache2-utils  # Linux

# Run load test
ab -n 1000 -c 10 http://localhost:3001/api/health

# Results:
# Requests per second: [#.##] (mean)
# Time per request: [#.##] ms
# Failed requests: 0
```

### Memory Profiling

```javascript
// backend/tests/performance.test.js
const { performance } = require('perf_hooks');

describe('Performance Tests', () => {
  it('should extract topics efficiently', async () => {
    const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    const startTime = performance.now();

    const result = await extractTopics(largeText);

    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;

    const executionTime = endTime - startTime;
    const memoryUsed = endMemory - startMemory;

    console.log(`Execution time: ${executionTime}ms`);
    console.log(`Memory used: ${memoryUsed}MB`);

    expect(executionTime).toBeLessThan(5000); // Should complete in 5s
    expect(memoryUsed).toBeLessThan(500); // Should use less than 500MB
  });
});
```

---

## Security Testing

### Input Validation Tests

```javascript
// backend/__tests__/security/validation.test.js
describe('Input Validation Security', () => {
  it('should reject SQL injection attempts', async () => {
    const malicious = "'; DROP TABLE users; --";
    const response = await request(app)
      .post('/api/topics/extract')
      .send({ text: malicious });

    expect(response.status).toBe(400);
  });

  it('should reject XSS attempts', async () => {
    const xss = '<script>alert("XSS")</script>';
    const response = await request(app)
      .post('/api/topics/extract')
      .send({ text: xss });

    expect(response.status).toBe(400);
  });

  it('should sanitize HTML tags', async () => {
    const html = '<p>This is <b>bold</b></p>';
    const response = await request(app)
      .post('/api/topics/extract')
      .send({ text: html });

    expect(response.body.data.text).not.toContain('<');
  });
});
```

### Authentication Tests

```javascript
// backend/__tests__/security/auth.test.js
describe('Authentication Security', () => {
  it('should reject invalid tokens', async () => {
    const response = await request(app)
      .post('/api/topics/extract')
      .set('Authorization', 'Bearer invalid-token')
      .send({ text: 'Test', userId: 'user123' });

    expect(response.status).toBe(401);
  });

  it('should reject expired tokens', async () => {
    const expiredToken = jwt.sign({ userId: 'user123' }, 'secret', {
      expiresIn: '-1h'
    });

    const response = await request(app)
      .post('/api/topics/extract')
      .set('Authorization', `Bearer ${expiredToken}`)
      .send({ text: 'Test', userId: 'user123' });

    expect(response.status).toBe(401);
  });

  it('should isolate user data', async () => {
    const user1Response = await request(app)
      .get('/api/results/list')
      .set('Authorization', `Bearer ${user1Token}`)
      .query({ userId: 'user1' });

    const user2Response = await request(app)
      .get('/api/results/list')
      .set('Authorization', `Bearer ${user1Token}`)
      .query({ userId: 'user2' }); // Trying to access different user's data

    expect(user2Response.status).toBe(403);
  });
});
```

---

## Test Coverage

### Generate Coverage Report

```bash
# Backend
cd backend
npm test -- --coverage

# Frontend
cd frontend
npm test -- --coverage

# Expected output:
# ===== Coverage summary =====
# Statements   : XX.XX%
# Branches     : XX.XX%
# Functions    : XX.XX%
# Lines        : XX.XX%
```

### Coverage Thresholds

```json
{
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "functions": 80,
      "lines": 80,
      "statements": 80
    },
    "./backend/services/": {
      "branches": 90,
      "functions": 90,
      "lines": 90,
      "statements": 90
    }
  }
}
```

---

## Continuous Integration

### GitHub Actions CI

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '16'
      
      - name: Install backend dependencies
        run: cd backend && npm ci
      
      - name: Run backend tests
        run: cd backend && npm test -- --coverage
      
      - name: Upload backend coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage/lcov.info
      
      - name: Install frontend dependencies
        run: cd frontend && npm ci
      
      - name: Run frontend tests
        run: cd frontend && npm test -- --coverage
      
      - name: Upload frontend coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./frontend/coverage/lcov.info
```

---

## QA Checklist

### Pre-Release QA

- [ ] All tests passing (unit, integration, E2E)
- [ ] Code coverage > 80%
- [ ] No console errors or warnings
- [ ] Performance benchmarks met
- [ ] Security scan passed
- [ ] Accessibility audit passed
- [ ] Cross-browser testing done
- [ ] Mobile responsive verified
- [ ] Documentation up to date
- [ ] API endpoints tested
- [ ] Database queries optimized
- [ ] Error handling verified
- [ ] Rate limiting tested
- [ ] CORS configured correctly
- [ ] SSL/TLS configured

### Manual Testing Scenarios

1. **Happy Path**
   - Upload document → Extract topics → Generate quiz → Answer → Get feedback

2. **Error Handling**
   - Upload oversized file → Get error message
   - Invalid auth → Get 401
   - Network timeout → Retry mechanism

3. **Edge Cases**
   - Empty document
   - Special characters in text
   - Very long answers
   - Multiple rapid requests

---

## Bug Reporting Template

```markdown
## Bug Report

**Title**: Brief description of issue

**Severity**: (Critical/High/Medium/Low)

**Environment**: 
- OS: 
- Browser: 
- App Version: 

**Steps to Reproduce**:
1.
2.
3.

**Expected Behavior**:

**Actual Behavior**:

**Screenshots/Logs**:

**Additional Context**:
```

---

## Testing Best Practices

✅ **DO**:
- Test business logic, not implementation
- Use descriptive test names
- Keep tests isolated and independent
- Mock external services
- Test edge cases
- Maintain high coverage for critical paths
- Run tests before commit

❌ **DON'T**:
- Test UI details (exact spacing)
- Create interdependent tests
- Mock unnecessarily
- Ignore flaky tests
- Test framework code
- Copy-paste test code

---

**Last Updated**: January 2024
**Version**: 1.0.0
