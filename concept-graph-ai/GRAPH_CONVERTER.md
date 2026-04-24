# Graph Converter Documentation

## Overview

The Graph Converter system transforms AI-extracted topics into hierarchical graph structures with explicit parent-child relationships.

## Data Structure

### Topics Input Format
```javascript
{
  topics: [
    {
      name: "Topic Name",
      subtopics: ["Subtopic 1", "Subtopic 2", "Subtopic 3"]
    }
  ]
}
```

### Graph Output Format
```javascript
{
  nodes: [
    {
      id: "root-topic",
      label: "Concept Root",
      type: "root",
      parent: null,
      data: { level: 0, isRoot: true }
    },
    {
      id: "topic-0",
      label: "Machine Learning",
      type: "topic",
      parent: "root-topic",
      data: { level: 1, topicIndex: 0, subtopicCount: 3 }
    },
    {
      id: "subtopic-0-0",
      label: "Neural Networks",
      type: "subtopic",
      parent: "topic-0",
      data: { level: 2, parentTopic: "Machine Learning" }
    }
  ],
  edges: [
    {
      id: "edge-root-topic-topic-0",
      source: "root-topic",
      target: "topic-0",
      type: "parent-child",
      data: { relationship: "parent-child" }
    }
  ],
  stats: {
    totalNodes: 11,
    topicCount: 3,
    totalSubtopics: 8,
    levels: 3
  }
}
```

## Graph Hierarchy

### Node Types

#### Root Node
- **Purpose**: Single entry point for the entire graph
- **Count**: 1
- **Level**: 0
- **Color**: Red
- **ID Format**: `root-topic` or `root`

#### Topic Nodes (Main Concepts)
- **Purpose**: Primary concepts extracted from text
- **Level**: 1
- **Color**: Blue
- **ID Format**: `topic-{index}`
- **Parent**: Root node
- **Children**: Subtopic nodes

#### Subtopic Nodes (Related Concepts)
- **Purpose**: Detailed concepts related to topics
- **Level**: 2
- **Color**: Teal
- **ID Format**: `subtopic-{topicIndex}-{subIndex}`
- **Parent**: Topic node
- **Children**: None (leaf nodes)

### Relationships

Every node except the root has exactly one parent:
```
Root
├── Topic 1
│   ├── Subtopic 1.1
│   ├── Subtopic 1.2
│   └── Subtopic 1.3
├── Topic 2
│   ├── Subtopic 2.1
│   └── Subtopic 2.2
└── Topic 3
    └── Subtopic 3.1
```

## API Endpoints

### Backend

#### Convert Topics to Graph
```
POST /api/graph/convert
Content-Type: application/json

Request Body:
{
  "topics": [...]  // Array of topic objects
}

Response:
{
  "success": true,
  "data": {
    "nodes": [...],
    "edges": [...],
    "hierarchy": {...},
    "stats": {...}
  }
}
```

#### Get Graph Statistics
```
POST /api/graph/stats
Content-Type: application/json

Request Body:
{
  "nodes": [...],
  "edges": [...]
}

Response:
{
  "success": true,
  "data": {
    "totalNodes": 11,
    "totalEdges": 10,
    "nodeTypes": {
      "root": 1,
      "topic": 3,
      "subtopic": 7
    },
    "levels": 3
  }
}
```

## Frontend Services

### `graphService.js` Functions

#### `convertTopicsToGraphLocal(topics)`
Convert topics locally without API call.
```javascript
import { convertTopicsToGraphLocal } from '../services/graphService';

const graph = convertTopicsToGraphLocal(topics);
// Returns: { success: true, data: { nodes, edges, stats } }
```

#### `convertTopicsToGraphAPI(topics)`
Convert topics using backend API.
```javascript
const result = await convertTopicsToGraphAPI(topics);
// Returns: API response with nodes, edges, hierarchy, stats
```

#### `exportGraphAsJSON(graph, filename)`
Export graph as JSON file.
```javascript
exportGraphAsJSON(graph, 'my-graph.json');
// Downloads file to user's system
```

#### `exportGraphAsCSV(graph, filename)`
Export graph as CSV file.
```javascript
exportGraphAsCSV(graph, 'my-graph.csv');
// CSV format: id, label, type, parent, level
```

## React Hooks

### `useGraph()`
Complete graph management hook.

```javascript
import { useGraph } from '../hooks/useGraph';

function MyComponent() {
  const {
    graph,           // Current graph data
    stats,           // Graph statistics
    isConverting,    // Loading state
    error,           // Error message
    convertTopicsToGraph,  // Convert function
    exportAsJSON,    // Export to JSON
    exportAsCSV,     // Export to CSV
    clearGraph,      // Clear graph data
  } = useGraph();

  const handleConvert = () => {
    const result = convertTopicsToGraph(topicData.topics);
    if (result) {
      console.log('Graph created:', result);
    }
  };

  return (
    <>
      <button onClick={handleConvert}>Convert Graph</button>
      {graph && <GraphViewer graph={graph} stats={stats} />}
    </>
  );
}
```

## Graph Utilities (Frontend)

### `graphConverter.js` Functions

#### `topicsToGraph(topicsData)`
Main conversion function.
```javascript
const graph = topicsToGraph(topics);
// Returns: { nodes, edges, nodeMap, stats }
```

#### `getParentNode(nodeId, nodeMap)`
Get parent of a node.
```javascript
const parent = getParentNode('subtopic-0-0', graph.nodeMap);
// Returns parent topic node
```

#### `getChildNodes(nodeId, nodes)`
Get all children of a node.
```javascript
const children = getChildNodes('topic-0', graph.nodes);
// Returns all subtopics of topic-0
```

#### `getNodePath(nodeId, nodeMap)`
Get path from root to node.
```javascript
const path = getNodePath('subtopic-0-0', graph.nodeMap);
// Returns: [rootNode, topicNode, subtopicNode]
```

#### `searchNodes(searchTerm, nodes)`
Search nodes by name.
```javascript
const results = searchNodes('learning', nodes);
// Returns nodes containing 'learning'
```

#### `getGraphStats(nodes, edges)`
Calculate graph statistics.
```javascript
const stats = getGraphStats(nodes, edges);
// Returns: { totalNodes, totalEdges, rootNodes, topicNodes, ... }
```

## Components

### `GraphViewer`
Displays hierarchical graph with:
- **Expandable tree view** of all nodes
- **Node statistics** (counts by type)
- **Detailed node table** with properties
- **Export functionality** (JSON/CSV)

```jsx
<GraphViewer 
  graph={graph}
  stats={stats}
  onExport={(format) => {
    if (format === 'json') exportAsJSON(graph);
    else exportAsCSV(graph);
  }}
/>
```

## Examples

### Example 1: Convert Topics in React Component
```javascript
import { useGraph } from '../hooks/useGraph';

function ConceptAnalyzer() {
  const graph = useGraph();

  useEffect(() => {
    if (topicsData && topicsData.topics) {
      graph.convertTopicsToGraph(topicsData.topics);
    }
  }, [topicsData]);

  return (
    <>
      {graph.error && <p>Error: {graph.error}</p>}
      {graph.graph && (
        <GraphViewer graph={graph.graph} stats={graph.stats} />
      )}
    </>
  );
}
```

### Example 2: Export Graph
```javascript
const { graph, exportAsJSON, exportAsCSV } = useGraph();

const handleExport = (format) => {
  if (format === 'json') {
    exportAsJSON(graph, 'concepts.json');
  } else {
    exportAsCSV(graph, 'concepts.csv');
  }
};
```

### Example 3: Search in Graph
```javascript
import { searchNodes } from '../utils/graphConverter';

const results = searchNodes('algorithm', graph.nodes);
console.log(`Found ${results.length} nodes containing 'algorithm'`);
results.forEach(node => {
  const parent = graph.nodeMap.get(node.parent);
  console.log(`${node.label} (under ${parent?.label})`);
});
```

## Backend Utilities

### `graphConverter.js` - Node.js

#### `topicsToGraph(topicsData)`
Convert to hierarchical structure.

#### `getNodeHierarchy(nodes)`
Organize nodes by type.

#### `findNodeById(id, nodes)`
Find node by ID.

#### `findChildren(parentId, nodes)`
Find all children of a node.

#### `buildAdjacencyList(edges)`
Create adjacency list for graph algorithms.

#### `toAdjacencyMatrix(nodes, edges)`
Convert to matrix representation for algorithms.

## Visualization

### Mind Map View
- Circular layout
- Animated edges
- Interactive drag/zoom
- Shows visual relationships

### Graph Hierarchy View
- Tree structure
- Expandable nodes
- Statistics panel
- Export options
- Detailed table

## Performance

| Operation | Time | Notes |
|-----------|------|-------|
| Conversion (100 nodes) | < 50ms | Client-side |
| Export to JSON | < 10ms | File download |
| Export to CSV | < 10ms | File download |
| Search (100 nodes) | < 5ms | String matching |

## Export Formats

### JSON
```json
{
  "nodes": [...],
  "edges": [...],
  "stats": {...},
  "exportedAt": "2026-04-09T12:00:00Z"
}
```

### CSV
```
id,label,type,parent,level
"root","Concept Root","root","",0
"topic-0","Machine Learning","topic","root",1
"subtopic-0-0","Neural Networks","subtopic","topic-0",2
```

## Algorithms

### Depth Calculation
```javascript
depth = max(node.level) + 1
```

### Path Finding
Traverses parent pointers from node to root.

### Search
Linear search with case-insensitive matching.

## Future Enhancements

- [ ] Graph algorithms (shortest path, clustering)
- [ ] Layout algorithms (force-directed, hierarchical)
- [ ] Multiple export formats (GraphML, Gexf)
- [ ] Graph comparison
- [ ] Subgraph extraction
- [ ] Cycle detection
- [ ] Performance profiling

## Troubleshooting

### Issue: Graph not converting
- Check topics data format
- Verify `topicsData.topics` exists
- Check browser console for errors

### Issue: Missing nodes/edges
- Verify subtopics array exists
- Check for empty or null values
- Validate data structure

### Issue: Export fails
- Check browser permissions
- Verify node data is serializable
- Check for circular references

## Testing

```javascript
// Test data
const testTopics = [
  {
    name: "AI",
    subtopics: ["ML", "NLP", "CV"]
  },
  {
    name: "Web",
    subtopics: ["Frontend", "Backend"]
  }
];

// Convert
const graph = topicsToGraph(testTopics);

// Verify
console.assert(graph.nodes.length === 7, 'Should have 7 nodes');
console.assert(graph.edges.length === 6, 'Should have 6 edges');
console.assert(graph.nodes[0].type === 'root', 'First should be root');
```

## References

- [Graph Theory Basics](https://en.wikipedia.org/wiki/Graph_(discrete_mathematics))
- [Tree Data Structures](https://en.wikipedia.org/wiki/Tree_(data_structure))
- [Hierarchical Graphs](https://en.wikipedia.org/wiki/Hierarchical_graph)
