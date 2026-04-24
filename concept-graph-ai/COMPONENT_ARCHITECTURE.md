# Component Architecture & Development Guide

## Frontend Architecture Overview

### Component Hierarchy

```
App
├── Navigation
│   ├── Logo
│   ├── Menu
│   └── UserProfile
├── Routes
│   ├── Home
│   ├── Dashboard
│   │   ├── StatsCard (x4)
│   │   ├── RecentActivity
│   │   ├── WeakTopicsSection
│   │   └── ProgressChart
│   ├── Learn
│   │   ├── DocumentUpload
│   │   ├── ConceptGraph
│   │   └── TopicDetail
│   ├── Quiz
│   │   ├── QuizSelector
│   │   ├── QuizInterface
│   │   │   ├── QuestionDisplay
│   │   │   ├── AnswerInput
│   │   │   ├── ConfidenceSlider
│   │   │   └── SubmitButton
│   │   └── ResultsView
│   └── Profile
│       ├── UserSettings
│       ├── LearningStats
│       └── DataManagement
└── Footer
```

---

## Core Components

### 1. DocumentUpload Component

**Purpose**: Handle document file uploads and processing

**Props**:
```typescript
interface DocumentUploadProps {
  onUploadStart?: () => void;
  onUploadSuccess?: (data: ExtractedData) => void;
  onUploadError?: (error: Error) => void;
  autoExtractTopics?: boolean;
  maxFileSize?: number;
}
```

**State Management**:
```javascript
const [file, setFile] = useState<File | null>(null);
const [uploading, setUploading] = useState(false);
const [progress, setProgress] = useState(0);
const [error, setError] = useState<string | null>(null);
```

**Key Features**:
- Drag-and-drop upload
- File type validation
- Progress indicator
- Error handling & retry
- Success confirmation

**Hook Usage**:
```javascript
const { extractedText, isLoading } = useDocumentExtraction(file);
```

**Example Usage**:
```jsx
<DocumentUpload
  onUploadSuccess={(data) => {
    console.log('Topics extracted:', data.topics);
    saveGraph(data);
  }}
  autoExtractTopics={true}
/>
```

---

### 2. ConceptGraph Component

**Purpose**: Visualize concept relationships as interactive graph

**Props**:
```typescript
interface ConceptGraphProps {
  topics: Topic[];
  relationships: Relationship[];
  onNodeClick?: (topic: string) => void;
  onNodeHover?: (topic: string) => void;
  interactive?: boolean;
  height?: number;
  width?: number;
}
```

**Dependencies**:
- D3.js for rendering
- Framer Motion for animations
- Custom hooks for graph logic

**Key Features**:
- Interactive node visualization
- Relationship visualization with arrows
- Zoom and pan controls
- Node highlighting
- Sidebar topic details
- Responsive sizing

**Hooks Used**:
```javascript
const { nodesData, linksData } = useGraphData(topics, relationships);
const { selectedNode, setSelectedNode } = useGraphSelection();
const { transform, setTransform } = useGraphTransform();
```

**Example Usage**:
```jsx
<ConceptGraph
  topics={topics}
  relationships={relationships}
  onNodeClick={(topic) => setSelectedTopic(topic)}
  interactive={true}
  height={600}
/>
```

**D3 Implementation**:
```javascript
// Force simulation
const simulation = d3.forceSimulation(nodes)
  .force('link', d3.forceLink(links).distance(100))
  .force('charge', d3.forceManyBody().strength(-200))
  .force('center', d3.forceCenter(width / 2, height / 2));

// Node rendering
const node = svg.selectAll('circle')
  .data(nodes)
  .enter()
  .append('circle')
  .attr('r', 8)
  .attr('fill', (d) => d.color);

// Link rendering
const link = svg.selectAll('line')
  .data(links)
  .enter()
  .append('line')
  .attr('stroke', '#999')
  .attr('stroke-width', 2);
```

---

### 3. QuizInterface Component

**Purpose**: Provide interactive quiz experience with answer evaluation

**Props**:
```typescript
interface QuizInterfaceProps {
  questions: Question[];
  onComplete?: (results: QuizResult[]) => void;
  onExit?: () => void;
  autoSave?: boolean;
  showFeedback?: boolean;
}
```

**State Management**:
```javascript
const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
const [answers, setAnswers] = useState<Record<string, string>>({});
const [evaluations, setEvaluations] = useState<QuizEvaluation[]>([]);
const [isEvaluating, setIsEvaluating] = useState(false);
const [confidence, setConfidence] = useState(50);
```

**Sub-components**:
- `QuestionDisplay`: Shows question text
- `AnswerInput`: Textarea for answer input
- `ConfidenceSlider`: Confidence rating input
- `FeedbackCard`: Shows evaluation results
- `ProgressBar`: Quiz progress indicator

**Key Features**:
- Question navigation
- Answer history
- Confidence rating
- Real-time evaluation
- Detailed feedback
- Score calculation
- Auto-save to Firestore

**Hooks Used**:
```javascript
const { evaluateAnswer, isEvaluating } = useQuizEvaluation();
const { saveResults } = useQuizStorage();
const { updateProgress } = useProgressTracking();
```

**Example Usage**:
```jsx
<QuizInterface
  questions={questions}
  onComplete={(results) => {
    showResults(results);
    updateProgress(results);
  }}
  showFeedback={true}
  autoSave={true}
/>
```

---

### 4. Dashboard Component

**Purpose**: Display learning statistics and progress overview

**Props**:
```typescript
interface DashboardProps {
  userId: string;
  timeframe?: 'week' | 'month' | 'all';
  onTopicClick?: (topic: string) => void;
}
```

**Sub-components**:
- `StatsCard`: Metric display card
- `ProgressChart`: Line chart of progress over time
- `WeakTopicsCard`: List of topics needing improvement
- `RecentActivity`: Timeline of recent actions
- `TopicsGrid`: Grid of all topics with mastery levels

**Data Loading**:
```javascript
const { stats, loading } = useQuizStatistics(userId, timeframe);
const { progress, loading: progressLoading } = useProgressTracking();
```

**Charts**:
```javascript
// Using Recharts
<LineChart data={progressData}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="date" />
  <YAxis />
  <Tooltip />
  <Line type="monotone" dataKey="accuracy" stroke="#3b82f6" />
</LineChart>
```

**Example Usage**:
```jsx
<Dashboard
  userId={currentUser.uid}
  timeframe="month"
  onTopicClick={(topic) => generateQuiz([topic])}
/>
```

---

### 5. ProgressChart Component

**Purpose**: Visualize learning progress over time

**Features**:
- Weekly/monthly view toggle
- Multiple metrics (accuracy, confidence, mastery)
- Tooltips with detailed info
- Responsive design
- Trend indicator

**Implementation**:
```javascript
const ProgressChart = ({ data, metric = 'accuracy' }) => {
  return (
    <LineChart width={600} height={300} data={data}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="week" />
      <YAxis domain={[0, 100]} />
      <Tooltip 
        contentStyle={styles.tooltip}
        formatter={(value) => `${value}%`}
      />
      <Legend />
      <Line
        type="monotone"
        dataKey={metric}
        stroke="#3b82f6"
        strokeWidth={2}
        dot={{ fill: '#3b82f6', r: 4 }}
        activeDot={{ r: 6 }}
      />
    </LineChart>
  );
};
```

---

## Custom Hooks

### useGraphStorage

**Purpose**: Manage graph data persistence

```javascript
const useGraphStorage = () => {
  const [graphs, setGraphs] = useState<Graph[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveGraph = async (graphData: Graph, docName?: string) => {
    setLoading(true);
    try {
      const graphId = doc(db, `users/${userId}/graphs`, docName);
      await setDoc(graphId, {
        ...graphData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setError(null);
      return { success: true, graphId: graphId.id };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const loadGraphs = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, `users/${userId}/graphs`),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setGraphs(data);
      return data;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  return { saveGraph, loadGraphs, graphs, loading, error };
};
```

### useQuizStorage

**Purpose**: Manage quiz results persistence

```javascript
const useQuizStorage = () => {
  const [results, setResults] = useState<QuizResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveResult = async (result: QuizResult) => {
    try {
      await addDoc(collection(db, `users/${userId}/quizResults`), {
        ...result,
        answeredAt: serverTimestamp()
      });
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const loadResults = async (options?: LoadResultsOptions) => {
    setLoading(true);
    try {
      let q = query(
        collection(db, `users/${userId}/quizResults`),
        orderBy('answeredAt', 'desc')
      );
      
      if (options?.topic) {
        q = query(q, where('topic', '==', options.topic));
      }
      
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setResults(data);
      return data;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const getStats = async (): Promise<QuizStats> => {
    const allResults = await loadResults();
    return {
      totalQuestions: allResults.length,
      strongAnswers: allResults.filter(r => r.rating === 'strong').length,
      partialAnswers: allResults.filter(r => r.rating === 'partial').length,
      weakAnswers: allResults.filter(r => r.rating === 'weak').length,
      averageConfidence: allResults.reduce((sum, r) => sum + r.confidence, 0) / allResults.length || 0,
      topicBreakdown: groupBy(allResults, 'topic')
    };
  };

  return { saveResult, loadResults, getStats, results, loading, error };
};
```

### useProgressTracking

**Purpose**: Track and update learning progress

```javascript
const useProgressTracking = () => {
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(false);

  const loadProgress = async () => {
    setLoading(true);
    try {
      const docSnap = await getDoc(
        doc(db, `users/${userId}/progress`, 'current')
      );
      if (docSnap.exists()) {
        setProgress(docSnap.data());
        return docSnap.data();
      }
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateMastery = async (
    topic: string,
    level: string,
    confidence: number
  ) => {
    await updateDoc(doc(db, `users/${userId}/progress`, 'current'), {
      [`topics.${topic}`]: {
        masteryLevel: level,
        confidence,
        lastUpdated: serverTimestamp()
      }
    });
  };

  const markWeakTopic = async (topic: string, rootCause: string) => {
    await updateDoc(doc(db, `users/${userId}/progress`, 'current'), {
      weakTopics: arrayUnion({
        topic,
        rootCause,
        identifiedAt: serverTimestamp()
      })
    });
  };

  return { 
    loadProgress, 
    updateMastery, 
    markWeakTopic,
    progress,
    loading 
  };
};
```

---

## State Management with Zustand

### App Store

```javascript
import create from 'zustand';

const useAppStore = create((set) => ({
  // User state
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),
  
  // UI state
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  
  // Learning state
  currentTopics: [],
  setCurrentTopics: (topics) => set({ currentTopics: topics }),
  
  // Quiz state
  currentQuizzes: [],
  setCurrentQuizzes: (quizzes) => set({ currentQuizzes: quizzes }),
  
  // Graph state
  currentGraph: null,
  setCurrentGraph: (graph) => set({ currentGraph: graph }),
  
  // Combined setters
  reset: () => set({
    currentUser: null,
    sidebarOpen: true,
    currentTopics: [],
    currentQuizzes: [],
    currentGraph: null
  })
}));

export default useAppStore;
```

**Usage in Components**:
```javascript
const MyComponent = () => {
  const { currentUser, sidebarOpen, setSidebarOpen } = useAppStore();
  
  return (
    <div>
      <button onClick={() => setSidebarOpen(!sidebarOpen)}>
        Toggle Sidebar
      </button>
    </div>
  );
};
```

---

## API Integration

### useApi Hook

```javascript
const useApi = (endpoint, options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          ...options.headers
        },
        body: params.body ? JSON.stringify(params.body) : undefined
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      
      const result = await response.json();
      setData(result.data);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [endpoint, options, authToken]);

  return { data, loading, error, fetchData };
};
```

---

## Best Practices

### 1. Component Organization

✅ **DO**:
```javascript
// Group related components in folders
components/
  Quiz/
    QuizInterface.jsx
    QuestionDisplay.jsx
    AnswerInput.jsx
  Dashboard/
    Dashboard.jsx
    StatsCard.jsx
    ProgressChart.jsx
```

❌ **DON'T**:
```javascript
// Flat, unorganized structure
components/
  QuizInterface.jsx
  QuestionDisplay.jsx
  Dashboard.jsx
  StatsCard.jsx
```

### 2. State Management

✅ **DO**:
```javascript
// Use Zustand for global state
const store = useAppStore();

// Use hooks for local state
const [answers, setAnswers] = useState({});
```

❌ **DON'T**:
```javascript
// Prop drilling through many levels
<Component1 data={data} onUpdate={onUpdate}>
  <Component2 data={data} onUpdate={onUpdate}>
    <Component3 data={data} onUpdate={onUpdate} />
  </Component2>
</Component1>
```

### 3. Custom Hooks

✅ **DO**:
```javascript
// Extract complex logic into custom hooks
const useGraphData = (topics, relationships) => {
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  
  useEffect(() => {
    // Process data
  }, [topics, relationships]);
  
  return { nodes, links };
};
```

❌ **DON'T**:
```javascript
// Put complex logic directly in components
const MyComponent = () => {
  // 200 lines of logic here
  return <div>...</div>;
};
```

### 4. Performance Optimization

✅ **DO**:
```javascript
// Memoize expensive components
const MemoizedGraph = React.memo(ConceptGraph);

// Use useMemo for calculations
const processedData = useMemo(
  () => expensiveCalculation(data),
  [data]
);

// Use useCallback for event handlers
const handleClick = useCallback(() => {
  // handler code
}, [dependencies]);
```

❌ **DON'T**:
```javascript
// Create functions in render
const handleClick = () => { /* ... */ };

// Use inline object literals
const config = { /* large object */ };
```

### 5. Error Handling

✅ **DO**:
```javascript
// Handle errors gracefully
const [error, setError] = useState(null);

try {
  const result = await evaluateAnswer(answer);
  setResults(result);
} catch (err) {
  setError('Failed to evaluate answer');
  console.error(err);
}

// Show error to user
{error && <ErrorAlert message={error} />}
```

❌ **DON'T**:
```javascript
// Ignore errors
const result = await evaluateAnswer(answer);
setResults(result);
```

### 6. Accessibility

✅ **DO**:
```jsx
// Use semantic HTML
<button onClick={handleClick} aria-label="Submit answer">
  Submit
</button>

// Include alt text
<img src={icon} alt="Topic icon" />

// Use proper heading hierarchy
<h1>Quiz Title</h1>
<h2>Question</h2>
```

❌ **DON'T**:
```jsx
// Generic divs
<div onClick={handleClick}>Submit</div>

// Missing alt text
<img src={icon} />

// Improper heading hierarchy
<h3>Quiz Title</h3>
<h4>Question</h4>
```

---

## Testing Components

### Unit Tests

```javascript
// QuestionDisplay.test.jsx
import { render, screen } from '@testing-library/react';
import QuestionDisplay from './QuestionDisplay';

describe('QuestionDisplay', () => {
  it('renders question text', () => {
    const question = 'What is React?';
    render(<QuestionDisplay question={question} />);
    expect(screen.getByText(question)).toBeInTheDocument();
  });

  it('displays question number', () => {
    render(<QuestionDisplay questionNumber={1} totalQuestions={10} />);
    expect(screen.getByText('1/10')).toBeInTheDocument();
  });
});
```

### Integration Tests

```javascript
// Quiz.test.jsx
import { render, screen, userEvent } from '@testing-library/react';
import Quiz from './Quiz';

describe('Quiz Workflow', () => {
  it('completes full quiz workflow', async () => {
    render(<Quiz questions={mockQuestions} />);
    
    // Answer questions
    const input = screen.getByPlaceholderText('Your answer');
    await userEvent.type(input, 'Test answer');
    
    // Submit answer
    const submitBtn = screen.getByText('Submit');
    await userEvent.click(submitBtn);
    
    // Check feedback displayed
    expect(screen.getByText(/feedback/i)).toBeInTheDocument();
  });
});
```

---

## Performance Metrics

### Key Metrics to Monitor

```javascript
// Component render time
console.time('ComponentRender');
// ... component renders
console.timeEnd('ComponentRender');

// API response time
const start = performance.now();
const result = await api.evaluateAnswer(answer);
const duration = performance.now() - start;
```

### Lighthouse Audit

```bash
# Run Lighthouse
npm install -g lighthouse
lighthouse https://your-site.com

# Check performance score target: >90
```

---

## Deployment Checklist

- [ ] All components have PropTypes or TypeScript types
- [ ] Components are tested (>80% coverage)
- [ ] Performance optimized (Lighthouse score >90)
- [ ] Accessibility compliant (WCAG AA)
- [ ] Error handling implemented
- [ ] Loading states handled
- [ ] Responsive design tested
- [ ] Security validated
- [ ] Build size optimized

---

## Resources

- [React Documentation](https://react.dev)
- [D3.js Documentation](https://d3js.org)
- [Tailwind CSS](https://tailwindcss.com)
- [Zustand](https://github.com/pmndrs/zustand)
- [Testing Library](https://testing-library.com)

---

**Last Updated**: January 2024
**Version**: 1.0.0
