# AI Chat – Full‑Stack

An internship‑grade full‑stack AI chat application built with React + Vite, Firebase (Auth, Firestore, Storage), and a secure Node/Express backend proxying Google Gemini text + vision APIs. Supports voice input, text‑to‑speech, image uploads/analysis, AI image generation, chat history with search/pin/delete, responsive design, and keyboard shortcuts.

## Stack
- Frontend: React + Vite
- Backend: Node.js + Express (secure Gemini proxy)
- Data: Firebase Auth, Firestore, Storage

## Features
- Secure server‑side Gemini calls (no API key in browser)
- Text + Vision endpoints with retries and error handling
- Voice input and text‑to‑speech toggle
- Image upload, analysis, and generation (Pollinations)
- Chat history with search, pin, clear all (batch delete)
- Fully responsive UI (mobile‑first with overlays)

## Setup

1) Frontend environment
Create `.env` in project root based on `.env.example`:

```
VITE_API_BASE_URL=http://localhost:3001/api
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
VITE_FIREBASE_APP_ID=1:000000000000:web:xxxxxxxxxxxxxxxx
```

2) Backend environment
Create `server/.env` based on `server/.env.example`:

```
PORT=3001
ALLOWED_ORIGIN=http://localhost:5174
GEMINI_API_KEY=your_gemini_api_key_here
```

3) Install dependencies

```bash
# Frontend
npm install

# Backend
cd server && npm install
```

## Run (local dev)

```bash
# Start backend
cd server && npm run dev

# In another terminal, start frontend
cd .. && npm run dev
```

Frontend dev server: `http://localhost:5174/`
Backend server: `http://localhost:3001/api`

## Deployment
- Frontend: Netlify/Vercel (build `npm run build`, publish `dist/`)
- Backend: Render/Heroku/Fly.io (Node server); set env vars and CORS
- Firebase: Add deployed domain in Auth settings; Firestore/Storage already configured

## Security
- Gemini API key lives only on the server
- CORS restricted to your frontend origin
- Do not commit real secrets; use env vars

## License
Internal project for learning/demo purposes.
