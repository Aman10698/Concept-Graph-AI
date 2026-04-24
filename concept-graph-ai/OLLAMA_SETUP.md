# 🤖 Ollama Integration Setup Guide

## ✅ What You Need

You already have Ollama installed! Here's how to set it up:

## 🚀 Step 1: Start Ollama

In a **new terminal**, run:

```bash
ollama serve
```

Or depending on your OS:
- **Windows**: Start the Ollama app (it runs in background on `localhost:11434`)
- **Mac/Linux**: `ollama serve` in terminal

You should see output like:
```
2026/04/15 12:00:00 Listening on 127.0.0.1:11434
```

## 📦 Step 2: Download a Model

In **another terminal**, choose one:

```bash
# Lightweight and fast (recommended for testing)
ollama pull llama2

# Or try smaller model
ollama pull mistral

# Or try another
ollama pull neural-chat
```

This downloads the model (first time is large). After, it's cached locally.

## 🔧 Step 3: Configure Backend

Add to your `backend/.env` file:

```env
# Ollama Configuration
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama2

# Keep existing configs...
PORT=5000
NODE_ENV=development
```

## 🧪 Step 4: Test Ollama Integration

Once your backend is running, test these endpoints:

### Health Check
```bash
curl http://localhost:5000/api/ollama/health
```

Expected response:
```json
{
  "success": true,
  "message": "✅ Ollama is running and ready!",
  "status": "connected"
}
```

### Generate Questions
```bash
curl -X POST http://localhost:5000/api/ollama/generate-questions \
  -H "Content-Type: application/json" \
  -d '{
    "topics": ["React hooks", "State management"],
    "context": "Beginner level"
  }'
```

### Evaluate Answer
```bash
curl -X POST http://localhost:5000/api/ollama/evaluate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What are React hooks?",
    "answer": "React hooks are functions that let you use state and other React features",
    "concepts": ["useState", "useEffect", "function components"]
  }'
```

### Extract Topics
```bash
curl -X POST http://localhost:5000/api/ollama/extract-topics \
  -H "Content-Type: application/json" \
  -d '{
    "text": "React is a JavaScript library for building user interfaces with JSX. State management can be done with hooks like useState and useContext."
  }'
```

## 📊 What's Now Working

✅ **Question Generation** - AI-powered (locally)
✅ **Answer Evaluation** - AI-powered (locally)
✅ **Topic Extraction** - AI-powered (locally)
✅ **Learning Paths** - AI-powered recommendations

## 🆓 All FREE!

- ✨ No API keys needed
- 🚀 Runs completely offline
- 💻 Uses your computer's power
- 🔒 Your data stays private

## 🆘 Troubleshooting

### "Connection refused"
- Make sure Ollama is running: `ollama serve`
- Check port 11434 is accessible

### "Model not found"
- Download a model: `ollama pull llama2`
- Wait for download to complete

### "Slow responses"
- Use lighter model: `ollama pull mistral`
- Give it more time on first run

### Check what models you have
```bash
ollama list
```

## 📚 Available Models (Try These)

| Model | Size | Speed | Quality | Command |
|-------|------|-------|---------|---------|
| mistral | 4.1GB | ⚡⚡⚡ | 🌟🌟🌟 | `ollama pull mistral` |
| llama2 | 3.8GB | ⚡⚡ | 🌟🌟🌟 | `ollama pull llama2` |
| neural-chat | 4.1GB | ⚡⚡ | 🌟🌟 | `ollama pull neural-chat` |
| phi | 1.4GB | ⚡⚡⚡ | 🌟🌟 | `ollama pull phi` |

---

**Next Steps:**
1. Start Ollama: `ollama serve`
2. Pull a model: `ollama pull llama2`
3. Add OLLAMA_URL to backend/.env
4. Test with the curl commands above
5. Your project now uses local AI! 🎉
