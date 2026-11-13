# Deploying Charon

Frontend = static site on **Cloudflare Pages**. Backend = FastAPI + WebSocket, must run as a **long-lived container/process** (Cloudflare Pages/Workers can't host it).

## 1. Backend (Docker)

```bash
cd backend
docker build -t charon-backend .
docker run -p 8000:8000 \
  -e OPENROUTER_API_KEY=... -e GEMINI_API_KEY=... -e GROQ_API_KEY=... -e CEREBRAS_API_KEY=... \
  charon-backend
```

Hosts that work well: Fly.io (`fly launch`), Railway, Render, any VPS. Requirements:
- Must serve **HTTPS/WSS** (Pages is HTTPS; browsers block `ws://` and mixed content). Hosts above terminate TLS for you.
- Keep **1 instance/worker** (simulation state is in memory).
- The platform's `PORT` env var is respected (default 8000).
- Keys can be set via env vars or the in-app «API / Модели» dialog (the dialog writes `.env` inside the container, which is ephemeral — prefer env vars).
- CORS currently allows `*`; restrict `allow_origins` in `backend/app/main.py` to your Pages domain for production.

Check: `curl https://YOUR-BACKEND/api/state` → 200.

## 2. Frontend (Cloudflare Pages)

Env vars are baked in at **build time**:

| Var | Value |
|---|---|
| `VITE_API_URL` | `https://YOUR-BACKEND` (default `http://127.0.0.1:8000`) |
| `VITE_WS_URL` | optional; default derived from `VITE_API_URL` (`https`→`wss`, + `/ws`) |

**Option A — Git integration (dashboard):** Pages → Create project → connect repo →
Root directory `frontend`, Build command `npm run build`, Output `dist`, add the vars above.

**Option B — CLI:**
```bash
cd frontend
VITE_API_URL=https://YOUR-BACKEND npm run build     # PowerShell: $env:VITE_API_URL="https://YOUR-BACKEND"; npm run build
npx wrangler pages deploy        # uses wrangler.toml (project "charon-office", ./dist)
```

## Local dev

`./start.ps1` (backend :8000, frontend :5173). Copy `frontend/.env.example` to `.env.local` to point at another backend.
