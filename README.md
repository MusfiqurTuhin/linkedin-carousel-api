# LinkedIn Carousel Generator & API

A complete solution for generating professional LinkedIn carousels with AI-powered content and a FastAPI backend.

## Features

- 🎨 **10+ Professional Themes** (Glass, Neon, Luxury, etc.)
- 🔤 **14 Fonts** (including Bengali fonts)
- 🖼️ **AI Image Generation**
- 📏 **Multiple Canvas Sizes**
- 📥 **Download as PNG or PDF**
- 🧠 **AI Content Engine** (Gemini 1.5 Flash)

## Project Structure

This is a monorepo containing:
- `web/`: Next.js Frontend
- `api/` (root): FastAPI Backend

## API Endpoints

- `POST /generate` - Generate carousel content from a topic
- `POST /generate-image` - Generate AI images
- `POST /generate-ideas` - Generate content ideas

## Deployment

### Frontend (Vercel)
1. Push this repo to GitHub
2. Import to Vercel
3. Set `NEXT_PUBLIC_API_URL` to your backend URL

### Backend (Railway)
1. Import to Railway
2. Set Environment Variables:
   - `GEMINI_API_KEY`: Your Google Gemini API key

## Local Development

### 1. Backend
```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn api.main:app --reload --port 8000
```

### 2. Frontend
```bash
cd web
npm install
npm run dev
```

## Environment Variables
- `GEMINI_API_KEY` (Backend)
- `NEXT_PUBLIC_API_URL` (Frontend)
