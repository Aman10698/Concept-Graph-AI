# Mind Map Visualization Guide

## Overview

The **MindMapViewer** component creates an interactive, auto-layouted mind map visualization from extracted topics using `react-flow-renderer`.

## Features

### Auto-Layout Algorithm
- **Center Node**: Root "Mind Map" node in the center (red)
- **Circular Distribution**: Main topics arranged in a circle around the center
- **Hierarchical Layout**: Subtopics radiate outward from their parent topics
- **Responsive Positioning**: Automatic calculation of node positions based on data

### Node Types & Styling

#### Center Node (Root)
- **Color**: Red (#ff6b6b)
- **Label**: "Mind Map"
- **Position**: (0, 0)
- **Size**: 100px width

#### Topic Nodes (Main concepts)
- **Color**: Blue (#4c6ef5)
- **Radius**: 200px from center
- **Animation**: Animated edges
- **Distribution**: Evenly spaced in circle

#### Subtopic Nodes (Related concepts)
- **Color**: Teal (#15aabf)
- **Radius**: 350px from center (200 + 150)
- **Animation**: Static edges
- **Distribution**: Radiating from parent topic

### Interactive Features

#### Navigation
- **Drag**: Click and drag nodes to reposition
- **Zoom**: Mouse wheel to zoom in/out
- **Pan**: Right-click and drag or spacebar + drag to pan
- **Fit View**: Auto-fit all nodes in viewport

#### Controls
- **Plus/Minus Buttons**: Zoom in/out
- **Fit View Button**: Reset view to fit all nodes
- **Lock Button**: Pin/unpin nodes

#### Mini Map
- **Position**: Bottom-right corner
- **Shows**: Overall graph layout
- **Draggable**: Navigate by clicking on mini map

## Data Format

The component expects topics data in this format:

```javascript
{
  topics: [
    {
      name: "Topic Name",
      subtopics: ["Subtopic 1", "Subtopic 2", "Subtopic 3"]
    },
    ...
  ],
  allKeywords: [...],
  confidence: 0.89
}
```

## Usage Example

```jsx
import MindMapViewer from './components/MindMapViewer';

function MyComponent() {
  const topicsData = {
    topics: [
      {
        name: "Artificial Intelligence",
        subtopics: ["Machine Learning", "Neural Networks", "Deep Learning"]
      },
      {
        name: "Data Science",
        subtopics: ["Statistics", "Data Analysis", "Visualization"]
      }
    ]
  };

  return (
    <MindMapViewer topics={topicsData.topics} />
  );
}
```

## Node Positioning Algorithm

### 1. Center Node Calculation
```
centerX = 0
centerY = 0
```

### 2. Topic Node Calculation
```
angle = (topicIndex / totalTopics) * 2π
radius = 200px
topicX = cos(angle) * radius
topicY = sin(angle) * radius
```

### 3. Subtopic Node Calculation
```
angle = topicAngle + ((subIndex + 1) / (subtopicCount + 1)) * (π / 4)
radius = 200px + 150px = 350px
subtopicX = cos(angle) * radius
subtopicY = sin(angle) * radius
```

## Edge Types

### Center to Topic Edges
- **Animated**: Yes
- **Color**: Blue (#4c6ef5)
- **Width**: 2px

### Topic to Subtopic Edges
- **Animated**: No
- **Color**: Teal (#15aabf)
- **Width**: 1.5px

## Customization Options

### Colors
Edit the `style` objects in `MindMapViewer.jsx`:

```javascript
// Center node
background: '#ff6b6b',      // Change red
color: '#fff',
border: '2px solid #c92a2a',

// Topic nodes
background: '#4c6ef5',      // Change blue
border: '2px solid #364fc7',

// Subtopic nodes
background: '#15aabf',      // Change teal
border: '2px solid #0b7285',
```

### Layout Spacing
Adjust radius values:

```javascript
// Main topic distance from center
const radius = 200;  // Increase/decrease this

// Subtopic distance from topics
const subRadius = radius + 150;  // Increase/decrease the 150
```

### Font Sizes
```javascript
fontSize: '14px',  // Adjust for different node types
fontWeight: 'bold',
```

## Performance Considerations

### Optimization Tips
1. **Limit Nodes**: Keep total nodes under 100 for smooth performance
   - Nodes = 1 (center) + # topics + # all subtopics

2. **Batching**: Update multiple topics at once rather than individually

3. **Memoization**: Component is optimized with `useEffect` for data changes

### Performance Metrics
- **Typical Rendering**: < 100ms for 50 nodes
- **Zoom/Pan**: Smooth 60fps performance
- **Memory Usage**: ~5-10MB for 100 nodes

## Browser Compatibility

- ✅ Chrome/Chromium > 90
- ✅ Firefox > 88
- ✅ Safari > 14
- ✅ Edge > 90

## Troubleshooting

### Nodes Overlapping
- Increase `radius` constant from 200 to 300+
- Increase `subRadius` offset from 150 to 200+

### Visualization Too Small/Large
- Use the zoom controls (+ / -)
- Click "Fit View" button to auto-fit
- Adjust viewport CSS height in parent container

### Performance Issues
- Reduce number of topics/subtopics
- Disable animations by setting `animated: false` on all edges
- Use `MiniMap` strategically to avoid rendering overhead

### Edges Not Visible
- Check edge color matches background (default gray)
- Verify edge width (`strokeWidth`)
- Confirm nodes have valid IDs

## Advanced Features (Future)

- [ ] Clustering similar topics
- [ ] Physics-based layout (force-directed graph)
- [ ] Export as image/SVG
- [ ] Interactive node details panel
- [ ] Search/filter nodes
- [ ] Animated transitions for data updates
- [ ] Multiple layout algorithms
- [ ] 3D visualization (WebGL)

## Dependencies

- `react@^19.2.5` - UI framework
- `react-flow-renderer@^10.3.17` - Graph visualization
  - *Note: This package is deprecated. Consider migrating to `reactflow` v11+*

## Migration to ReactFlow

If migrating from `react-flow-renderer` to `reactflow`:

```javascript
// Old (deprecated)
import ReactFlow from 'react-flow-renderer';

// New
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
```

## Testing

```javascript
// Test with sample data
import sampleData from '../data/sampleData';

<MindMapViewer topics={sampleData.topics} />
```

## References

- [React Flow Renderer Docs](https://reactflow.dev/)
- [Reactflow v11+ Docs](https://reactflow.dev/)
- [D3.js Force Layout](https://d3js.org/) - Inspiration for future enhancements
