# Troubleshooting & Common Issues Guide

## Table of Contents

1. [Backend Issues](#backend-issues)
2. [Frontend Issues](#frontend-issues)
3. [Firebase Issues](#firebase-issues)
4. [AI API Issues](#ai-api-issues)
5. [Database Issues](#database-issues)
6. [Deployment Issues](#deployment-issues)
7. [Performance Issues](#performance-issues)
8. [Security Issues](#security-issues)

---

## Backend Issues

### Issue: "Cannot find module" errors

**Symptoms**:
```
Error: Cannot find module 'express'
```

**Solutions**:
1. Install dependencies:
```bash
cd backend
npm install
```

2. Clear npm cache:
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

3. Check Node version:
```bash
node --version  # Should be 16.0.0 or higher
```

---

### Issue: "Port 3001 already in use"

**Symptoms**:
```
Error: listen EADDRINUSE: address already in use :::3001
```

**Solutions**:

**macOS/Linux**:
```bash
# Find process using port 3001
lsof -i :3001

# Kill process
kill -9 <PID>

# Or kill by name
pkill -f "node server.js"
```

**Windows**:
```powershell
# Find process using port 3001
netstat -ano | findstr :3001

# Kill process
taskkill /PID <PID> /F

# Or use GUI
wmic process where "commandline like '%node%'" delete
```

---

### Issue: "Firebase authentication failed"

**Symptoms**:
```
Error: Invalid service account credentials
Error: Failed to initialize Firebase
```

**Solutions**:

1. Verify `.env` file exists:
```bash
cd backend
cat .env  # Should show Firebase config
```

2. Check credential format:
```javascript
// .env should contain:
FIREBASE_PROJECT_ID=your-project
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-email@appspot.gserviceaccount.com
```

3. Escape newlines in private key:
```javascript
// If error about newlines:
// Replace actual newlines with \n in .env file
```

4. Verify Firebase project:
```bash
# Go to Firebase Console
# Project Settings > Service Accounts > Generate New Private Key
# Copy the entire JSON and extract values
```

---

### Issue: "CORS error when accessing API"

**Symptoms**:
```
Access to XMLHttpRequest at 'http://localhost:3001/api/...' 
blocked by CORS policy
```

**Solutions**:

1. Check CORS middleware (backend/server.js):
```javascript
const cors = require('cors');

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

2. Update `.env`:
```
CORS_ORIGIN=http://localhost:3000  # Or your frontend URL
```

3. Check frontend API URL (frontend/.env):
```
REACT_APP_API_URL=http://localhost:3001/api
```

---

### Issue: "Request timeout on /api/topics/extract"

**Symptoms**:
```
Error: Request timeout after 30000ms
Error: 504 Gateway Timeout
```

**Solutions**:

1. Check OpenAI API status:
```bash
curl https://status.openai.com/api/v2/status.json
```

2. Increase timeout in backend:
```javascript
// routes/topics.js
app.post('/topics/extract', async (req, res) => {
  res.setTimeout(60000); // 60 seconds
  // ... handler code
});
```

3. Optimize text processing:
```javascript
// Don't process extremely long documents at once
const MAX_TEXT_LENGTH = 100000; // 100KB limit

if (req.body.text.length > MAX_TEXT_LENGTH) {
  return res.status(400).json({
    success: false,
    error: 'Text too long. Maximum 100KB.'
  });
}
```

---

### Issue: "Rate limit exceeded" from OpenAI

**Symptoms**:
```
Error: Rate limit exceeded. Please retry after 60 seconds
Error 429: Too Many Requests
```

**Solutions**:

1. Implement request queuing:
```javascript
const queue = [];
let processing = false;

async function processQueue() {
  if (processing || queue.length === 0) return;
  processing = true;

  const { req, res } = queue.shift();
  try {
    const result = await callOpenAI(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }

  processing = false;
  setTimeout(processQueue, 1000); // 1 second between requests
}
```

2. Add rate limiting middleware:
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10 // limit each IP to 10 requests per windowMs
});

app.post('/api/topics/extract', limiter, topicController.extract);
```

3. Upgrade OpenAI plan if persistent issue

---

## Frontend Issues

### Issue: "Cannot find module '@components/...'" 

**Symptoms**:
```
Module not found: Can't resolve '@components/DocumentUpload'
```

**Solutions**:

1. Check `jsconfig.json` or `tsconfig.json`:
```json
{
  "compilerOptions": {
    "baseUrl": "src",
    "paths": {
      "@components/*": ["components/*"],
      "@hooks/*": ["hooks/*"],
      "@pages/*": ["pages/*"]
    }
  }
}
```

2. Restart dev server:
```bash
cd frontend
npm start
```

---

### Issue: "React hook warnings"

**Symptoms**:
```
Warning: Missing dependency 'update' in useEffect hook
Warning: setState called on unmounted component
```

**Solutions**:

1. Add missing dependencies:
```javascript
// ❌ Wrong
useEffect(() => {
  fetchData();
}, []); // Missing 'fetchData' in dependencies

// ✅ Correct
useEffect(() => {
  fetchData();
}, [fetchData]); // Or move fetchData outside
```

2. Cleanup subscriptions:
```javascript
useEffect(() => {
  const unsubscribe = db.collection('data').onSnapshot(handleUpdate);
  
  return () => {
    unsubscribe(); // Cleanup on unmount
  };
}, []);
```

---

### Issue: "Infinite re-renders"

**Symptoms**:
- React DevTools shows component rendering repeatedly
- Browser gets slow
- Memory usage increases

**Solutions**:

1. Check for state updates in render:
```javascript
// ❌ Wrong - causes infinite loop
const MyComponent = () => {
  const [data, setData] = useState(null);
  setData(newData); // This runs every render!
  return <div>{data}</div>;
};

// ✅ Correct
const MyComponent = () => {
  const [data, setData] = useState(null);
  useEffect(() => {
    setData(newData);
  }, []);
  return <div>{data}</div>;
};
```

2. Check for object/array dependencies:
```javascript
// ❌ Wrong
useEffect(() => {
  // Only runs when config changes
}, [{ key: 'value' }]); // New object every render!

// ✅ Correct
const config = useMemo(() => ({ key: 'value' }), []);
useEffect(() => {
  // Now only runs when config actually changes
}, [config]);
```

---

### Issue: "State not updating"

**Symptoms**:
- Component doesn't re-render after setState
- Old data displayed

**Solutions**:

1. Don't mutate state directly:
```javascript
// ❌ Wrong
state.array.push(newItem);
setState(state);

// ✅ Correct
setState([...state.array, newItem]);

// Or
setState(prevState => [...prevState.array, newItem]);
```

2. Use useCallback for callbacks:
```javascript
const handleUpdate = useCallback((newData) => {
  setData(newData);
}, []); // Dependencies
```

---

### Issue: "Blank screen on page load"

**Symptoms**:
- White/blank screen
- No error messages
- DevTools shows nothing

**Solutions**:

1. Check browser console for errors (F12)
2. Check network tab for failed requests
3. Check React DevTools for component tree
4. Add console.log to trace execution:
```javascript
console.log('App mounted');
return <div>Content</div>;
```

5. Check for JavaScript errors:
```javascript
window.addEventListener('error', (event) => {
  console.error('Error:', event.error);
});
```

---

## Firebase Issues

### Issue: "Firestore rules prevented access"

**Symptoms**:
```
Error: Missing or insufficient permissions
Error: Permission denied for 'read' on document
```

**Solutions**:

1. Check Firestore rules:
```bash
# Firebase Console > Firestore > Rules
# Should allow user to access their own data
```

2. Update rules:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      // Allow users to read/write their own data
      allow read, write: if request.auth.uid == userId;
      
      match /{document=**} {
        allow read, write: if request.auth.uid == userId;
      }
    }
  }
}
```

3. Deploy rules:
```bash
firebase deploy --only firestore:rules
```

---

### Issue: "Firebase not initialized"

**Symptoms**:
```
Error: Firebase app not initialized
Error: No Firebase app '[DEFAULT]' has been created
```

**Solutions**:

1. Check Firebase initialization in App.jsx:
```javascript
import { initializeApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  // ... other config
};

const app = initializeApp(firebaseConfig);
export default app;
```

2. Verify .env variables are set:
```bash
cat .env  # frontend/.env
# Should contain all REACT_APP_FIREBASE_* variables
```

3. Restart dev server after changing .env

---

### Issue: "Authentication failed"

**Symptoms**:
```
Error: The email address is incorrectly formatted
Error: An internal error has occurred. [ Auth: -2 ]
```

**Solutions**:

1. Enable authentication method:
```
Firebase Console > Authentication > Sign-in method > Email/Password (Enable)
```

2. Check auth setup in code:
```javascript
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

const auth = getAuth();
try {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
} catch (error) {
  console.error('Auth error:', error.code);
}
```

---

## AI API Issues

### Issue: "OpenAI API key invalid"

**Symptoms**:
```
Error: Invalid authentication
Error: Incorrect API key provided
```

**Solutions**:

1. Verify API key:
```bash
# backend/.env
echo $OPENAI_API_KEY  # Should start with sk-

# Test API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

2. Check for typos in .env:
```bash
# Copy fresh key from OpenAI dashboard
# Make sure no extra spaces
```

3. Ensure key has proper permissions:
- Go to [OpenAI Dashboard](https://platform.openai.com/account/api-keys)
- Key should be active and not revoked

---

### Issue: "Response exceeds token limit"

**Symptoms**:
```
Error: This model's maximum context length is 4096 tokens
Error: Tokens exceeded
```

**Solutions**:

1. Limit input text:
```javascript
const MAX_TOKENS = 3000; // Leave room for response

if (tokens.count > MAX_TOKENS) {
  text = text.substring(0, text.length * (MAX_TOKENS / tokens.count));
}
```

2. Use smaller model:
```javascript
// Use gpt-3.5-turbo instead of gpt-4 for longer texts
const response = await openai.createChatCompletion({
  model: "gpt-3.5-turbo",
  messages: [...],
  max_tokens: 500
});
```

---

## Database Issues

### Issue: "Firestore read/write limit exceeded"

**Symptoms**:
```
Error: 429 Too Many Requests
Database quota exceeded
```

**Solutions**:

1. Enable auto-scaling in Firebase
2. Batch write operations:
```javascript
const batch = db.batch();

docs.forEach(doc => {
  batch.set(doc.ref, doc.data());
});

await batch.commit();
```

3. Use bulk write API instead of individual writes

---

### Issue: "Firestore document too large"

**Symptoms**:
```
Error: Document size exceeds 1MB
```

**Solutions**:

1. Split data into subcollections:
```javascript
// Instead of storing large array in document
// ❌ Wrong: userData.allResults = [...1000 items]

// ✅ Correct: Use subcollection
const resultsRef = collection(db, `users/${userId}/quizResults`);
```

2. Archive old data:
```javascript
const oldResults = results.filter(r => 
  r.date < oneMonthAgo
);

// Archive to separate collection
oldResults.forEach(r => {
  addDoc(collection(db, 'archived-results'), r);
});
```

---

## Deployment Issues

### Issue: "Build fails on Vercel/Heroku"

**Symptoms**:
```
Build error in functions
Error during build
```

**Solutions**:

1. Check environment variables:
```bash
# Vercel Dashboard > Settings > Environment Variables
# Ensure all required variables are set
```

2. Check build command:
```json
{
  "build": "npm run build"
}
```

3. Check Node version:
```
Specify in vercel.json or package.json:
"engines": {
  "node": "16.x"
}
```

---

### Issue: "502 Bad Gateway error"

**Symptoms**:
```
Error 502: Bad Gateway
Error 504: Gateway Timeout
```

**Solutions**:

1. Check server logs:
```bash
# Heroku
heroku logs --tail

# Google Cloud Run
gcloud run logs read --service my-service
```

2. Check for crashes:
```bash
curl -X GET https://your-api.com/api/health
```

3. Increase timeout:
```javascript
// For Vercel Functions
export const config = {
  maxDuration: 60, // 60 seconds
};
```

---

## Performance Issues

### Issue: "API responses too slow"

**Symptoms**:
- API calls take > 5 seconds
- Quiz generation delayed

**Solutions**:

1. Add response caching:
```javascript
const cache = new Map();

app.get('/api/topics/:id', (req, res) => {
  const cacheKey = req.params.id;
  if (cache.has(cacheKey)) {
    return res.json(cache.get(cacheKey));
  }

  // ... fetch data
  cache.set(cacheKey, data);
  res.json(data);
});
```

2. Optimize database queries:
```javascript
// Add indexes to Firestore
// Collection: quizResults
// Field: userId, topic (Composite index)
```

3. Use pagination:
```javascript
// Load results in batches
const query = collection(db, 'quizResults');
const first = query.limit(20);
const snapshot = await getDocs(first);
```

---

### Issue: "Bundle size too large"

**Symptoms**:
- Slow initial load
- Lighthouse score low

**Solutions**:

1. Analyze bundle:
```bash
npm install --save-dev webpack-bundle-analyzer
npm run build -- --analyze
```

2. Code split:
```javascript
const QuizComponent = React.lazy(() => 
  import('./components/Quiz')
);
```

3. Remove unused dependencies:
```bash
npm install --save-dev depcheck
depcheck  # Find unused packages
```

---

## Security Issues

### Issue: "Sensitive data exposed in logs"

**Symptoms**:
- API keys visible in console logs
- Passwords in error messages

**Solutions**:

1. Filter sensitive data:
```javascript
const sanitize = (obj) => {
  const sensitiveKeys = ['password', 'token', 'key', 'secret'];
  const clone = { ...obj };
  
  sensitiveKeys.forEach(key => {
    if (clone[key]) {
      clone[key] = '***REDACTED***';
    }
  });
  
  return clone;
};

console.log(sanitize(userData));
```

2. Use environment variables:
```javascript
// ❌ Wrong
const apiKey = "sk-xxxxx";

// ✅ Correct
const apiKey = process.env.OPENAI_API_KEY;
```

---

### Issue: "CSRF token validation failed"

**Symptoms**:
```
Error: Invalid CSRF token
```

**Solutions**:

1. Add CSRF protection:
```javascript
const csrf = require('csurf');
const cookieParser = require('cookie-parser');

app.use(cookieParser());
app.use(csrf({ cookie: true }));
```

2. Include token in requests:
```javascript
const response = await fetch('/api/data', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': csrfToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(data)
});
```

---

## Getting More Help

### Debug Mode

Enable debug logging:
```javascript
// backend/.env
DEBUG=*

// Then run
DEBUG=* npm start
```

### Common Debug Commands

```bash
# Check all running ports
lsof -i -P -n

# Check Node processes
ps aux | grep node

# Monitor system resources
top
```

### Error Codes Reference

| Code | Meaning | Solution |
|------|---------|----------|
| 400 | Bad Request | Check request format |
| 401 | Unauthorized | Check authentication |
| 403 | Forbidden | Check permissions |
| 404 | Not Found | Check URL/resource |
| 500 | Server Error | Check logs |
| 503 | Service Unavailable | Check service status |

---

## Support Resources

- **Stack Overflow**: Tag questions with `react` `firebase` `nodejs`
- **GitHub Issues**: Search existing issues first
- **Firebase Docs**: https://firebase.google.com/docs
- **OpenAI Docs**: https://platform.openai.com/docs
- **Discord Community**: Community server for quick help

---

**Last Updated**: January 2024
**Version**: 1.0.0

*Feel free to add more troubleshooting entries as you encounter issues!*
