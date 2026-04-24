# Deployment & Configuration Guide

## Environment Setup

### Development Environment

#### 1. Prerequisites

- **Node.js**: v16.0.0 or higher
- **npm**: v7.0.0 or higher (or yarn)
- **Git**: For version control
- **Firebase Account**: For backend services
- **OpenAI API Key**: For AI features

#### 2. Install Dependencies

```bash
# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install
```

#### 3. Environment Variables

Create `.env` files in both frontend and backend directories:

**backend/.env**:
```
# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com

# API Keys
OPENAI_API_KEY=sk-xxxxx
GOOGLE_VISION_API_KEY=your-key

# Server
PORT=3001
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:3000

# File Upload
MAX_FILE_SIZE=10485760  # 10MB
UPLOAD_DIR=./uploads

# JWT (for API authentication)
JWT_SECRET=your-secret-key
JWT_EXPIRY=7d

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

**frontend/.env**:
```
# Firebase
REACT_APP_FIREBASE_API_KEY=your-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
REACT_APP_FIREBASE_APP_ID=your-app-id

# API
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_API_VERSION=v1

# Features
REACT_APP_ENABLE_OCR=true
REACT_APP_ENABLE_ANALYTICS=true

# Environment
REACT_APP_ENV=development
```

#### 4. Start Development Servers

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm start
```

Access the application at: `http://localhost:3000`

---

## Frontend Deployment

### Building for Production

```bash
cd frontend
npm run build
```

This creates an optimized production build in the `build/` directory.

### Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Deploy with production settings
vercel --prod
```

**vercel.json**:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "build",
  "env": [
    "REACT_APP_FIREBASE_API_KEY",
    "REACT_APP_FIREBASE_AUTH_DOMAIN",
    "REACT_APP_FIREBASE_PROJECT_ID",
    "REACT_APP_API_URL",
    "REACT_APP_API_VERSION"
  ]
}
```

### Deploy to Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=build
```

**netlify.toml**:
```toml
[build]
  command = "npm run build"
  publish = "build"

[env.production]
  REACT_APP_API_URL = "https://api.conceptgraph.ai/api"
  REACT_APP_ENV = "production"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Deploy to Docker

**Dockerfile(frontend)**:
```dockerfile
# Build stage
FROM node:16-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage
FROM node:16-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/build ./build
EXPOSE 3000
CMD ["serve", "-s", "build", "-l", "3000"]
```

Build and run:
```bash
docker build -t conceptgraph-frontend .
docker run -p 3000:3000 conceptgraph-frontend
```

---

## Backend Deployment

### Hosting Options

#### 1. Heroku (Recommended for beginners)

```bash
# Install Heroku CLI
npm install -g heroku

# Login to Heroku
heroku login

# Create app
heroku create your-app-name

# Set environment variables
heroku config:set FIREBASE_PROJECT_ID=xxx
heroku config:set OPENAI_API_KEY=xxx
# ... set all other env vars

# Deploy
git push heroku main
```

**Procfile**:
```
web: node server.js
```

#### 2. Google Cloud Run

```bash
# Install Cloud SDK
gcloud init

# Build and deploy
gcloud run deploy conceptgraph-api \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

**Dockerfile (backend)**:
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["node", "server.js"]
```

#### 3. AWS Lambda

```bash
# Install Serverless Framework
npm install -g serverless

# Initialize serverless project
serverless create --template aws-nodejs-http-api

# Deploy
serverless deploy
```

#### 4. DigitalOcean App Platform

```bash
# Install doctl
brew install doctl

# Create app spec
doctl apps create --spec app.yaml

# Monitor deployment
doctl apps logs --app-id xxx
```

### Docker Deployment

**docker-compose.yml**:
```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - redis
    volumes:
      - ./uploads:/app/uploads

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_API_URL=http://backend:3001/api
    depends_on:
      - backend

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  mongodb:
    image: mongo:5
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
```

Deploy:
```bash
docker-compose up -d
```

---

## Firebase Configuration

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create Project"
3. Enter project details
4. Enable Google Analytics (optional)

### 2. Enable Services

**Firestore Database**:
- Go to Firestore > Create Database
- Choose production mode
- Select region (us-central1 recommended)

**Authentication**:
- Go to Authentication > Sign-in method
- Enable Email/Password
- Enable Google Sign-In

**Storage**:
- Go to Storage > Create Bucket
- Set security rules

### 3. Setup Security Rules

**Firestore Rules** (`firestore.rules`):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
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
  }
}
```

Deploy rules:
```bash
firebase deploy --only firestore:rules
```

**Storage Rules** (`storage.rules`):
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth.uid == userId;
      allow read, write: if request.auth.uid == userId && 
                          resource.size < 10485760; // 10MB
    }
  }
}
```

### 4. Get Credentials

1. Go to Project Settings > Service Accounts
2. Click "Generate New Private Key"
3. Save the JSON file securely
4. Extract values for backend `.env`

---

## Database Configuration

### MongoDB Setup (Optional)

**Local Setup**:
```bash
# Install MongoDB Community Edition
# See: https://docs.mongodb.com/manual/installation/

# Start MongoDB
mongod

# Connect via Node
const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/conceptgraph');
```

**MongoDB Atlas** (Cloud):
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a cluster
3. Create database user
4. Get connection string
5. Set as `MONGODB_URI` in `.env`

### Firebase Realtime Database

Already enabled when creating Firestore. Access via:
```bash
firebase database:get / --pretty
```

---

## CI/CD Pipeline

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '16'
      
      - name: Install dependencies
        run: |
          cd backend
          npm ci
      
      - name: Run tests
        run: |
          cd backend
          npm test
      
      - name: Build
        run: |
          cd backend
          npm run build
      
      - name: Deploy to Heroku
        uses: akhileshns/heroku-deploy@v3.12.12
        with:
          heroku_api_key: ${{ secrets.HEROKU_API_KEY }}
          heroku_app_name: "your-app-name"
          heroku_email: "your-email@example.com"

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '16'
      
      - name: Install dependencies
        run: |
          cd frontend
          npm ci
      
      - name: Build
        run: |
          cd frontend
          npm run build
        env:
          REACT_APP_API_URL: ${{ secrets.REACT_APP_API_URL }}
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

### GitLab CI/CD

Create `.gitlab-ci.yml`:

```yaml
stages:
  - test
  - build
  - deploy

test_backend:
  stage: test
  image: node:16
  script:
    - cd backend
    - npm ci
    - npm test

build_backend:
  stage: build
  image: node:16
  script:
    - cd backend
    - npm run build
  artifacts:
    paths:
      - backend/dist/

deploy_backend:
  stage: deploy
  image: docker:latest
  script:
    - docker build -t registry.gitlab.com/yourname/conceptgraph:$CI_COMMIT_SHA backend
    - docker push registry.gitlab.com/yourname/conceptgraph:$CI_COMMIT_SHA
```

---

## Monitoring & Logging

### Sentry (Error Tracking)

```bash
npm install @sentry/react @sentry/tracing
```

**Frontend (main.js)**:
```javascript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_DSN,
  environment: process.env.REACT_APP_ENV,
  tracesSampleRate: 1.0,
});
```

**Backend (server.js)**:
```javascript
const Sentry = require("@sentry/node");

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

### Logging

**Winston Logger**:
```bash
npm install winston
```

**logger.js**:
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

module.exports = logger;
```

### Performance Monitoring

**Google Analytics**:
```bash
npm install react-ga4
```

```javascript
import ReactGA from "react-ga4";

ReactGA.initialize(process.env.REACT_APP_GA_ID);
ReactGA.send({ hitType: "pageview", page: window.location.pathname });
```

---

## Security Checklist

- [ ] Set strong Firebase security rules
- [ ] Enable HTTPS everywhere
- [ ] Set secure HTTP headers (CORS, CSP, etc.)
- [ ] Implement rate limiting
- [ ] Use environment variables for secrets
- [ ] Validate and sanitize all inputs
- [ ] Implement proper authentication
- [ ] Use JWT for API authentication
- [ ] Setup logging and monitoring
- [ ] Regular security audits
- [ ] Keep dependencies updated
- [ ] Use HTTPS for all API calls

---

## Performance Optimization

### Frontend

```bash
# Build optimization
npm run build

# Analyze bundle size
npm install -g webpack-bundle-analyzer
npm run build -- --analyze

# Lighthouse audit
npm install -g lighthouse
lighthouse https://your-site.com
```

### Backend

- Enable caching (Redis)
- Use database indexes
- Implement pagination
- Compress responses (gzip)
- Optimize AI API calls
- Use connection pooling

---

## Troubleshooting

### Common Issues

**Port already in use**:
```bash
# Find and kill process using port
lsof -i :3000
kill -9 <PID>
```

**Firebase authentication fails**:
1. Check `.env` variables
2. Verify Firebase project setup
3. Check Firestore rules

**API timeout**:
1. Increase timeout in backend
2. Optimize database queries
3. Check OpenAI API status

**Build fails**:
1. Clear node_modules: `rm -rf node_modules && npm install`
2. Check Node version
3. Review build logs for errors

---

## Scaling Considerations

1. **Database**: Use Firestore auto-scaling
2. **API**: Use API rate limiting
3. **Storage**: Archive old data
4. **Cache**: Implement Redis caching
5. **CDN**: Serve static files via CDN
6. **Load Balancing**: Use load balancers for multiple instances

---

## Backup & Recovery

### Automatic Backups

**Firestore**: Enabled by default
**Storage**: Set backup retention policy

### Manual Export

```bash
# Export Firestore data
firebase firestore:export gs://your-bucket/backup

# Import Firestore data
firebase firestore:import gs://your-bucket/backup
```

### Recovery Procedure

1. Contact Firebase support for recovery
2. Restore from backup
3. Verify data integrity
4. Notify users if needed

---

## Cost Optimization

- **Firebase**: Use Spark plan for development
- **Storage**: Implement archival strategy
- **API**: Cache responses to reduce calls
- **Computing**: Use serverless for variable load
- **Database**: Use appropriate indexes

---

## Next Steps

1. Set up CI/CD pipeline
2. Configure monitoring
3. Implement backup strategy
4. Plan for scaling
5. Regular security audits
