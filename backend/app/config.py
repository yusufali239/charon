import os
from pathlib import Path
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BACKEND_DIR / ".env"

if ENV_PATH.exists():
    load_dotenv(ENV_PATH, override=True)


class Settings:
    """Runtime settings for free-tier LLM providers and office economy mode."""

    def __init__(self) -> None:
        self.openrouter_api_key: str = os.getenv("OPENROUTER_API_KEY", "").strip()
        self.gemini_api_key: str = os.getenv("GEMINI_API_KEY", "").strip()
        self.groq_api_key: str = os.getenv("GROQ_API_KEY", "").strip()
        self.cerebras_api_key: str = os.getenv("CEREBRAS_API_KEY", "").strip()
        self.deepseek_api_key: str = os.getenv("DEEPSEEK_API_KEY", "").strip()
        self.siliconflow_api_key: str = os.getenv("SILICONFLOW_API_KEY", "").strip()
        self.zai_api_key: str = os.getenv("ZAI_API_KEY", "").strip()
        self.ollama_url: str = os.getenv("OLLAMA_URL", "http://localhost:11434").strip()
        self.economy_mode: bool = True
        self.idle_chat_interval_sec: int = 75

    def update_keys(self, data: dict) -> None:
        mapping = {
            "openrouter_api_key": "OPENROUTER_API_KEY",
            "gemini_api_key": "GEMINI_API_KEY",
            "groq_api_key": "GROQ_API_KEY",
            "cerebras_api_key": "CEREBRAS_API_KEY",
            "deepseek_api_key": "DEEPSEEK_API_KEY",
            "siliconflow_api_key": "SILICONFLOW_API_KEY",
            "zai_api_key": "ZAI_API_KEY",
            "ollama_url": "OLLAMA_URL",
        }
        for attr, env_name in mapping.items():
            if attr in data and data[attr] is not None:
                setattr(self, attr, str(data[attr]).strip())
                os.environ[env_name] = getattr(self, attr)

        lines = [
            f"OPENROUTER_API_KEY={self.openrouter_api_key}",
            f"GEMINI_API_KEY={self.gemini_api_key}",
            f"GROQ_API_KEY={self.groq_api_key}",
            f"CEREBRAS_API_KEY={self.cerebras_api_key}",
            f"DEEPSEEK_API_KEY={self.deepseek_api_key}",
            f"SILICONFLOW_API_KEY={self.siliconflow_api_key}",
            f"ZAI_API_KEY={self.zai_api_key}",
            f"OLLAMA_URL={self.ollama_url}",
        ]
        ENV_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")

    def provider_status(self) -> dict[str, bool]:
        return {
            "openrouter": bool(self.openrouter_api_key),
            "gemini": bool(self.gemini_api_key),
            "groq": bool(self.groq_api_key),
            "cerebras": bool(self.cerebras_api_key),
            "deepseek": bool(self.deepseek_api_key),
            "siliconflow": bool(self.siliconflow_api_key),
            "zai": bool(self.zai_api_key),
            "ollama": bool(self.ollama_url),
        }


settings = Settings()
