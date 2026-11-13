import asyncio
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .agents import AGENTS
from .config import settings
from .office_sim import sim


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(sim.tick_loop())
    yield
    task.cancel()


app = FastAPI(title="Charon 3D AI Office", lifespan=lifespan)

_raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://127.0.0.1:5173,http://localhost:5173,https://charon-office.pages.dev",
)
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TaskRequest(BaseModel):
    prompt: str
    target_agent: str = "all"


class SettingsRequest(BaseModel):
    openrouter_api_key: str | None = None
    gemini_api_key: str | None = None
    groq_api_key: str | None = None
    cerebras_api_key: str | None = None
    ollama_url: str | None = None
    deepseek_api_key: str | None = None
    siliconflow_api_key: str | None = None
    zai_api_key: str | None = None
    economy_mode: bool | None = None


class AgentModelUpdate(BaseModel):
    provider: str
    model: str


@app.get("/api/state")
async def get_state():
    return sim.get_snapshot()


@app.post("/api/task")
async def submit_task(req: TaskRequest):
    if not req.prompt.strip():
        return {"ok": False, "error": "Empty prompt"}
    if sim.task_running:
        return {"ok": False, "error": "Команда уже выполняет задачу"}
    sim.start_task(req.prompt.strip(), req.target_agent)
    return {"ok": True}


@app.post("/api/task/stop")
async def stop_task():
    stopped = await sim.stop_task()
    return {"ok": True, "stopped": stopped}


@app.post("/api/settings")
async def update_settings(req: SettingsRequest):
    data = req.model_dump(exclude_none=True)
    if "economy_mode" in data:
        settings.economy_mode = bool(data.pop("economy_mode"))
    settings.update_keys(data)
    await sim.broadcast({
        "type": "config",
        "economy_mode": settings.economy_mode,
        "providers": settings.provider_status(),
    })
    return {"ok": True, "providers": settings.provider_status(), "economy_mode": settings.economy_mode}


@app.post("/api/agents/{agent_id}/model")
async def update_agent_model(agent_id: str, req: AgentModelUpdate):
    if agent_id not in AGENTS:
        return {"ok": False, "error": "Unknown agent"}
    AGENTS[agent_id].provider = req.provider.strip()
    AGENTS[agent_id].model = req.model.strip()
    await sim.broadcast({"type": "positions", "agents": [a.to_dict() for a in sim.agents.values()]})
    return {"ok": True}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    sim.clients.add(ws)
    try:
        await ws.send_json(sim.get_snapshot())
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        sim.clients.discard(ws)
    except Exception:
        sim.clients.discard(ws)
