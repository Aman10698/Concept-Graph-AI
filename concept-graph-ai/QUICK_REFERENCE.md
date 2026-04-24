# Quick Reference Guide

## 📚 Documentation Overview

| Document | Purpose | Audience |
|----------|---------|----------|
| [PROJECT_README.md](./PROJECT_README.md) | **START HERE** - Project overview & setup | Everyone |
| [DATA_STORAGE_GUIDE.md](./DATA_STORAGE_GUIDE.md) | Data persistence & Firebase setup | Developers, Architects |
| [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) | REST API endpoints & integration | Backend devs, Integrators |
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | Production deployment & DevOps | DevOps, Backend |
| [COMPONENT_ARCHITECTURE.md](./COMPONENT_ARCHITECTURE.md) | React components & hooks | Frontend devs |
| [TESTING_QA_GUIDE.md](./TESTING_QA_GUIDE.md) | Testing strategies & QA | QA engineers, Devs |
| [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md) | Common issues & solutions | All |

---

## 🚀 Quick Start (5 minutes)

### 1. Prerequisites
```bash
# Verify installation
node --version    # v16.0.0+
npm --version     # v7.0.0+
git --version
```

### 2. Setup Backend
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with Firebase & OpenAI keys
npm run dev
```

### 3. Setup Frontend
```bash
cd frontend
npm install
cp .env.example .env
# Edit .env with Firebase config
npm start
```

### 4. Access Application
```
Frontend: http://localhost:3000
Backend:  http://localhost:3001
```

---

## 🔑 Key Environment Variables

### Backend (.env)
```
# Firebase
FIREBASE_PROJECT_ID=your-project
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...

# APIs
OPENAI_API_KEY=sk-...
GOOGLE_VISION_API_KEY=...

# Server
PORT=3001
NODE_ENV=development
```

### Frontend (.env)
```
# Firebase
REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_AUTH_DOMAIN=...
REACT_APP_FIREBASE_PROJECT_ID=...

# API
REACT_APP_API_URL=http://localhost:3001/api
```

---

## 🏗️ Project Structure

```
concept-graph-ai/
├── backend/          # Express.js API
├── frontend/         # React application
├── docs/            # Additional documentation
└── docker-compose.yml
```

---

## 📡 API Endpoints (Quick Reference)

### Core Endpoints
```
POST   /api/documents/process      # Upload document
POST   /api/topics/extract         # Extract topics
POST   /api/quiz/generate          # Generate questions
POST   /api/quiz/evaluate          # Evaluate answer
GET    /api/progress/get           # Get progress
GET    /api/results/list           # Get results
POST   /api/graphs/save            # Save graph
```

**Full API Reference**: See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

---

## 💾 Data Storage

### What Gets Stored
- **Users**: Profile & authentication
- **Graphs**: Extracted topics & relationships
- **Quiz Results**: Answers & evaluations
- **Progress**: Mastery levels & weak topics

### Storage Details
See [DATA_STORAGE_GUIDE.md](./DATA_STORAGE_GUIDE.md#data-storage)

---

## 🧪 Testing Commands

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test

# E2E tests
npm run test:e2e

# Coverage report
npm test -- --coverage
```

---

## 🚢 Deployment Commands

### Build
```bash
# Frontend
cd frontend && npm run build

# Backend (if needed)
cd backend && npm run build
```

### Deploy to Vercel (Frontend)
```bash
npm install -g vercel
vercel --prod
```

### Deploy to Heroku (Backend)
```bash
heroku login
heroku create app-name
git push heroku main
```

---

## 🐛 Common Issues & Solutions

### 1. Module not found
```bash
rm -rf node_modules package-lock.json
npm install
npm start
```

### 2. Port already in use
```bash
# macOS/Linux
lsof -i :3000
kill -9 <PID>

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### 3. Firebase error
- Check `.env` file exists and has correct values
- Verify Firebase project is created
- Ensure Firestore is enabled

### 4. API timeout
- Check OpenAI API status
- Increase timeout in backend
- Optimize text processing

**More solutions**: See [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md)

---

## 📊 Core Components

### Frontend Components
- **DocumentUpload**: File handling & OCR
- **ConceptGraph**: D3.js visualization
- **QuizInterface**: Quiz & evaluation
- **Dashboard**: Statistics & progress
- **Components**: Detailed guide in [COMPONENT_ARCHITECTURE.md](./COMPONENT_ARCHITECTURE.md)

### Custom Hooks
- `useGraphStorage()`: Save/load graphs
- `useQuizStorage()`: Save/load quiz results
- `useProgressTracking()`: Track progress
- `useApi()`: API calls

---

## 🔐 Security Checklist

- [ ] Firestore security rules configured
- [ ] API authentication implemented
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] HTTPS enforced
- [ ] Sensitive data not logged
- [ ] Environment variables used for secrets

**Full checklist**: See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md#security-checklist)

---

## 📈 Performance Tips

### Frontend
- Enable code splitting
- Lazy load components
- Optimize bundle size
- Use React.memo for expensive components
- Implement virtual scrolling

### Backend
- Add database indexes
- Implement caching
- Use pagination
- Optimize API calls
- Monitor memory usage

---

## 🎯 Development Workflow

### 1. Create Feature Branch
```bash
git checkout -b feature/new-feature
```

### 2. Make Changes
- Write code
- Write tests
- Run tests: `npm test`
- Check coverage: `npm test -- --coverage`

### 3. Commit & Push
```bash
git add .
git commit -m "type: description"
git push origin feature/new-feature
```

### 4. Create Pull Request
- Add description
- Request review
- Wait for CI to pass

### 5. Merge
```bash
git checkout main
git pull
git merge feature/new-feature
```

---

## 📝 Commit Message Format

```
type(scope): description

body (optional)

footer (optional)
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `test`: Test cases
- `refactor`: Code refactoring
- `perf`: Performance improvement
- `chore`: Maintenance

**Example**:
```
feat(quiz): add confidence rating input

- Add confidence slider to answer input
- Save confidence score with result
- Display confidence in results page

Closes #123
```

---

## 🔄 Git Commands Reference

```bash
# Clone repository
git clone <repo-url>

# Create branch
git checkout -b branch-name

# View changes
git status
git diff

# Stage changes
git add .
git add <file>

# Commit
git commit -m "message"

# Push
git push origin branch-name

# Pull updates
git pull origin main

# Merge
git merge branch-name

# Rebase
git rebase main

# View history
git log --oneline
```

---

## 🧩 Technology Stack

| Layer | Tech | Version |
|-------|------|---------|
| **Frontend** | React | 18.x |
| **Styling** | Tailwind CSS | 3.x |
| **State** | Zustand | Latest |
| **Visualization** | D3.js | 7.x |
| **Backend** | Express.js | 4.x |
| **Runtime** | Node.js | 16+ |
| **Database** | Firestore | v9 |
| **Auth** | Firebase Auth | v9 |
| **Testing** | Jest/Vitest | Latest |
| **Deployment** | Docker/Vercel | Latest |

---

## 📚 Learning Resources

### React
- [React Docs](https://react.dev)
- [React Hooks API](https://react.dev/reference/react/hooks)
- [React Router](https://reactrouter.com)

### Tailwind CSS
- [Tailwind Docs](https://tailwindcss.com)
- [Component Examples](https://tailwindui.com)

### Firebase
- [Firebase Docs](https://firebase.google.com/docs)
- [Firestore Guide](https://firebase.google.com/docs/firestore)
- [Auth Guide](https://firebase.google.com/docs/auth)

### D3.js
- [D3 Learning](https://d3js.org/intro)
- [Gallery Examples](https://observablehq.com/@d3)

### OpenAI
- [API Reference](https://platform.openai.com/docs)
- [Chat Completions](https://platform.openai.com/docs/guides/gpt)

---

## 💬 Getting Help

### Before asking:
1. Check [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md)
2. Search GitHub issues
3. Check documentation
4. Review error message in browser console

### Where to ask:
- **Issues**: GitHub Issues (with template)
- **Discussions**: GitHub Discussions
- **Community**: Discord server
- **Email**: support@conceptgraph.ai

### Helpful information to include:
- Error message (full text)
- Steps to reproduce
- Environment (OS, Node version, etc.)
- Screenshots if UI-related
- Relevant code snippet

---

## 📋 Pre-Launch Checklist

### Development
- [ ] All features implemented
- [ ] Unit tests written (>80% coverage)
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Code reviewed

### Testing
- [ ] No console errors
- [ ] Performance optimized
- [ ] Cross-browser tested
- [ ] Mobile responsive
- [ ] Accessibility compliant

### Deployment
- [ ] Environment variables set
- [ ] Database backup configured
- [ ] Logging enabled
- [ ] Monitoring setup
- [ ] Security scan passed

### Documentation
- [ ] README updated
- [ ] API docs updated
- [ ] Deployment guide complete
- [ ] Troubleshooting guide updated

---

## 🎓 Onboarding Checklist (New Developer)

- [ ] Clone repository
- [ ] Install dependencies
- [ ] Setup `.env` files
- [ ] Start backend: `npm run dev`
- [ ] Start frontend: `npm start`
- [ ] Access http://localhost:3000
- [ ] Test document upload
- [ ] Test quiz generation
- [ ] Read [PROJECT_README.md](./PROJECT_README.md)
- [ ] Read [COMPONENT_ARCHITECTURE.md](./COMPONENT_ARCHITECTURE.md)
- [ ] Ask questions in Discord

---

## 📞 Quick Contact

- **Project Lead**: [Name] - @username
- **Backend Lead**: [Name] - @username
- **Frontend Lead**: [Name] - @username
- **Discord**: [Invite Link]
- **Email**: team@conceptgraph.ai

---

## 📊 Project Status

| Aspect | Status | Notes |
|--------|--------|-------|
| Development | ✅ Active | Phase 1 complete |
| Testing | ✅ 80%+ coverage | Ongoing |
| Documentation | ✅ Complete | This guide |
| Production | ✅ Ready | Live deployment available |
| Support | ✅ Available | Community support active |

---

## 📅 Timeline & Milestones

- **Q1 2024**: Phase 1 Complete ✅
- **Q2 2024**: Mobile app
- **Q3 2024**: Collaborative features
- **Q4 2024**: Advanced analytics

---

## 💡 Pro Tips

1. **Use Git branches**: Always work on feature branches
2. **Test first**: Write tests before committing
3. **Document as you code**: Comments matter
4. **Review code**: Always do peer reviews
5. **Monitor performance**: Use Lighthouse regularly
6. **Keep dependencies updated**: Run `npm audit` weekly
7. **Backup regularly**: Enable Firestore backups
8. **Log everything**: Good logging helps debugging

---

## 🎯 Next Steps

1. **First time?** → Start with [PROJECT_README.md](./PROJECT_README.md)
2. **Setting up?** → Follow [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
3. **Developing?** → Read [COMPONENT_ARCHITECTURE.md](./COMPONENT_ARCHITECTURE.md)
4. **Having issues?** → Check [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md)
5. **Need API help?** → See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

---

## 📄 Version History

| Version | Date | Status | Notes |
|---------|------|--------|-------|
| 1.0.0 | Jan 2024 | Release | Initial production release |
| 0.9.0 | Dec 2023 | Beta | Pre-release testing |
| 0.1.0 | Nov 2023 | Alpha | Initial development |

---

## 🙏 Acknowledgments

Special thanks to:
- OpenAI for powerful AI capabilities
- Google Cloud for Vision API
- Firebase for excellent backend
- React community for amazing tools
- All contributors & supporters

---

**Last Updated**: January 2024
**Maintained by**: Development Team
**License**: MIT

---

## 🔗 Important Links

- [GitHub Repository](https://github.com/yourname/concept-graph-ai)
- [Firebase Console](https://console.firebase.google.com)
- [OpenAI Platform](https://platform.openai.com)
- [Google Cloud Console](https://console.cloud.google.com)
- [Project Board](https://github.com/yourname/concept-graph-ai/projects)

---

**Need something else?** Check the [PROJECT_README.md](./PROJECT_README.md) for comprehensive documentation links.

**Found an error in this guide?** Please submit an issue on GitHub!
