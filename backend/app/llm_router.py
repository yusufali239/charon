import httpx
from .config import settings
from .agents import AgentProfile

DEFAULT_MODELS = {
    "openrouter": "qwen/qwen3-235b-a22b:free",
    "gemini": "gemini-2.5-flash",
    "groq": "llama-3.3-70b-versatile",
    "cerebras": "qwen-3-32b",
    "ollama": "qwen2.5:7b",
    "deepseek": "deepseek-chat",
}


async def _call_openai_compat(
    url: str,
    api_key: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
    max_tokens: int,
    extra_headers: dict | None = None,
) -> str:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    if extra_headers:
        headers.update(extra_headers)
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": 0.7,
    }
    async with httpx.AsyncClient(timeout=45.0) as client:
        resp = await client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()


async def _call_gemini(
    api_key: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
    max_tokens: int,
) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    payload = {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        "generationConfig": {"maxOutputTokens": max_tokens, "temperature": 0.7},
    }
    async with httpx.AsyncClient(timeout=45.0) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()
        candidates = data.get("candidates", [])
        if not candidates:
            raise ValueError("Empty Gemini response")
        parts = candidates[0]["content"]["parts"]
        return "".join(p.get("text", "") for p in parts).strip()


async def _call_ollama(
    base_url: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
    max_tokens: int,
) -> tuple[str, str]:
    base = base_url.rstrip("/")
    async with httpx.AsyncClient(timeout=2.5) as probe_client:
        tags_resp = await probe_client.get(f"{base}/api/tags")
        tags_resp.raise_for_status()
        models_data = tags_resp.json().get("models", [])
        available = [m.get("name", "") for m in models_data if m.get("name")]
        if not available:
            raise RuntimeError("No local Ollama models installed")
        chosen_model = model if model in available else available[0]

    payload = {
        "model": chosen_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "stream": False,
        "options": {"num_predict": max_tokens, "temperature": 0.7},
    }
    async with httpx.AsyncClient(timeout=45.0) as client:
        resp = await client.post(f"{base}/api/chat", json=payload)
        resp.raise_for_status()
        data = resp.json()
        text = data.get("message", {}).get("content", "").strip()
        if not text:
            raise ValueError("Empty Ollama response")
        return text, f"ollama/{chosen_model}"


async def _call_provider(
    provider: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
    max_tokens: int,
) -> tuple[str, str]:
    if provider == "openrouter" and settings.openrouter_api_key:
        text = await _call_openai_compat(
            "https://openrouter.ai/api/v1/chat/completions",
            settings.openrouter_api_key,
            model,
            system_prompt,
            user_prompt,
            max_tokens,
            extra_headers={"HTTP-Referer": "http://localhost:5173", "X-Title": "Charon 3D AI Office"},
        )
        return text, f"openrouter/{model}"

    if provider == "gemini" and settings.gemini_api_key:
        text = await _call_gemini(
            settings.gemini_api_key,
            model,
            system_prompt,
            user_prompt,
            max_tokens,
        )
        return text, f"gemini/{model}"

    if provider == "groq" and settings.groq_api_key:
        text = await _call_openai_compat(
            "https://api.groq.com/openai/v1/chat/completions",
            settings.groq_api_key,
            model,
            system_prompt,
            user_prompt,
            max_tokens,
        )
        return text, f"groq/{model}"

    if provider == "cerebras" and settings.cerebras_api_key:
        text = await _call_openai_compat(
            "https://api.cerebras.ai/v1/chat/completions",
            settings.cerebras_api_key,
            model,
            system_prompt,
            user_prompt,
            max_tokens,
        )
        return text, f"cerebras/{model}"

    if provider == "deepseek" and settings.deepseek_api_key:
        text = await _call_openai_compat(
            "https://api.deepseek.com/chat/completions",
            settings.deepseek_api_key,
            model,
            system_prompt,
            user_prompt,
            max_tokens,
        )
        return text, f"deepseek/{model}"

    if provider == "ollama" and settings.ollama_url:
        return await _call_ollama(
            settings.ollama_url,
            model,
            system_prompt,
            user_prompt,
            max_tokens,
        )

    raise RuntimeError(f"Provider {provider} not configured")


def _demo_reply(agent: AgentProfile, user_prompt: str, is_idle: bool = False) -> tuple[str, str]:
    if is_idle:
        import random
        return random.choice(agent.idle_phrases), "demo/economy"
    return (
        f"[DEMO — вставьте любой бесплатный API-ключ в Настройках или запустите локальный Ollama]\n"
        f"{agent.name} ({agent.role}) проработал задачу и подготовил решение по профилю: {agent.specialty}.",
        "demo/offline",
    )


async def generate_agent_reply(
    agent: AgentProfile,
    user_prompt: str,
    max_tokens: int | None = None,
    is_idle: bool = False,
) -> tuple[str, str]:
    """Call the agent's preferred free provider with automatic fallback to other configured providers and local Ollama."""
    if is_idle and settings.economy_mode:
        # Economy mode keeps idle token usage at zero by using built-in phrases
        return _demo_reply(agent, user_prompt, is_idle=True)

    if max_tokens is None:
        max_tokens = 90 if is_idle else (550 if settings.economy_mode else 1200)

    candidates: list[tuple[str, str]] = [(agent.provider, agent.model)]
    for fallback_prov, fallback_model in DEFAULT_MODELS.items():
        if fallback_prov != agent.provider:
            candidates.append((fallback_prov, fallback_model))

    status = settings.provider_status()
    for prov, mod in candidates:
        if not status.get(prov):
            continue
        try:
            return await _call_provider(prov, mod, agent.system_prompt, user_prompt, max_tokens)
        except Exception:
            continue

    return _demo_reply(agent, user_prompt, is_idle=is_idle)
