# Concept Graph AI

An intelligent document analysis tool that extracts concepts from PDFs and images, identifies relationships, and visualizes them as interactive mind maps.

## Features

- **📄 Multi-format Support**: Upload PDF documents or images (JPEG, PNG)
- **🔍 OCR & Text Extraction**: 
  - PDFs: Uses `pdf-parse` for text extraction
  - Images: Uses `tesseract.js` for OCR
- **🧠 Topic Analysis**: Automatically identifies main topics and subtopics
- **🗺️ Mind Map Visualization**: Interactive concept graph using React Flow
- **⚡ Real-time Progress**: Upload progress tracking and processing updates
- **🛡️ Error Handling**: Comprehensive error validation and recovery

## Quick Start

### Backend Setup
```bash
cd backend
npm install
npm start
# Server runs on http://localhost:5000
```

### Frontend Setup
```bash
npm install
npm start
# App runs on http://localhost:3000
```

## Project Structure

```
concept-graph-ai/
├── src/
│   ├── components/          # React components
│   │   ├── FileUpload.jsx
│   │   ├── TopicDisplay.jsx
│   │   ├── MindMapViewer.jsx
│   │   └── ErrorDisplay.jsx
│   ├── pages/               # Page components
│   │   └── ConceptGraphPage.jsx
│   ├── services/            # API services
│   ├── hooks/               # Custom React hooks
│   └── utils/               # Utilities
├── backend/
│   ├── routes/              # API routes
│   ├── controllers/         # Route handlers
│   ├── services/            # Business logic
│   ├── utils/               # Utilities
│   ├── uploads/             # Temporary file storage
│   └── server.js
└── README.md
```

## API Endpoints

- `POST /api/upload` - Upload file
- `POST /api/extract` - Extract text from file
- `POST /api/topics` - Extract topics from text
- `GET /health` - Health check

## Technology Stack

- **Frontend**: React, React Flow, Axios, Tailwind CSS
- **Backend**: Express.js, Multer, pdf-parse, Tesseract.js

## Documentation

- [ERROR_HANDLING.md](./ERROR_HANDLING.md) - Error handling and validation documentation

## License

MIT
