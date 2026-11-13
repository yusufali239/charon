import React, { useState } from "react";
import { X, Key, Cpu, CheckCircle2, Trash2, ExternalLink } from "lucide-react";

const RECOMMENDED_MODELS = {
  gemini: ["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.0-flash"],
  openrouter: [
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "moonshotai/kimi-k3.1-pro",
    "qwen/qwen3.8-flash-next",
    "cohere/north-mini-code:free",
    "qwen/qwen3-235b-a22b:free",
    "nousresearch/hermes-3-llama-3.1-405b:free",
  ],
  groq: [
    "openai/gpt-oss-120b",
    "moonshotai/kimi-k2-instruct",
    "qwen/qwen3.8-27b",
    "llama-3.3-70b-versatile",
  ],
  cerebras: [
    "qwen-3.8-27b",
    "gpt-oss-120b",
    "qwen-3-32b",
    "llama-3.3-70b",
  ],
  siliconflow: ["deepseek-ai/DeepSeek-V4.1-Flash", "Qwen/Qwen3-235B-A22B"],
  zai: ["glm-5.3-flash", "glm-4.5-flash"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  cloudflare: [
    "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
    "@cf/qwen/qwen2.5-coder-32b-instruct",
  ],
};

const PROVIDERS_CONFIG = [
  { field: "gemini_api_key", statusKey: "gemini", name: "Google AI Studio (Gemini Flash)", hint: "aistudio.google.com/apikey", url: "https://aistudio.google.com/apikey" },
  { field: "openrouter_api_key", statusKey: "openrouter", name: "OpenRouter (:free + Uncensored)", hint: "openrouter.ai/keys", url: "https://openrouter.ai/keys" },
  { field: "groq_api_key", statusKey: "groq", name: "Groq (Быстрый бесплатный LPU)", hint: "console.groq.com/keys", url: "https://console.groq.com/keys" },
  { field: "cerebras_api_key", statusKey: "cerebras", name: "Cerebras (Qwen 3.8 / 450 t/s)", hint: "cloud.cerebras.ai", url: "https://cloud.cerebras.ai" },
  { field: "siliconflow_api_key", statusKey: "siliconflow", name: "SiliconFlow (DeepSeek V4.1 Flash)", hint: "cloud.siliconflow.cn", url: "https://cloud.siliconflow.cn" },
  { field: "zai_api_key", statusKey: "zai", name: "Z.ai (GLM-5.3 Flash Free)", hint: "z.ai / bigmodel", url: "https://z.ai" },
  { field: "deepseek_api_key", statusKey: "deepseek", name: "DeepSeek (V3 / Reasoner)", hint: "platform.deepseek.com", url: "https://platform.deepseek.com" },
  { field: "cloudflare_api_token", statusKey: "cloudflare", name: "Cloudflare Workers AI", hint: "dash.cloudflare.com", url: "https://dash.cloudflare.com" },
];

export default function SettingsModal({
  open,
  onClose,
  providers = {},
  agents = [],
  onSaveKeys,
  onDeleteKey,
  onUpdateAgentModel,
}) {
  const [keys, setKeys] = useState({
    gemini_api_key: "",
    openrouter_api_key: "",
    groq_api_key: "",
    cerebras_api_key: "",
    siliconflow_api_key: "",
    zai_api_key: "",
    deepseek_api_key: "",
    cloudflare_api_token: "",
  });
  const [saving, setSaving] = useState(false);
  const [deletingKey, setDeletingKey] = useState(null);

  if (!open) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {};
    Object.entries(keys).forEach(([k, v]) => {
      if (v.trim()) payload[k] = v.trim();
    });
    await onSaveKeys?.(payload);
    setSaving(false);
    onClose();
  };

  const handleDelete = async (providerKey) => {
    setDeletingKey(providerKey);
    try {
      await onDeleteKey?.(providerKey);
    } finally {
      setDeletingKey(null);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2, 6, 23, 0.82)",
        backdropFilter: "blur(8px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 680,
          maxHeight: "92vh",
          overflowY: "auto",
          background: "#0b1329",
          border: "1px solid rgba(56, 189, 248, 0.25)",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 17, fontWeight: 700 }}>
            <Key size={20} color="#38bdf8" />
            <span>Управление Ключами Провайдеров и Моделями</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              padding: 4,
              borderRadius: 6,
            }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} style={{ display: "grid", gap: 12, marginBottom: 24 }}>
          {PROVIDERS_CONFIG.map((item) => {
            const isSaved = Boolean(providers[item.statusKey]);
            return (
              <div
                key={item.field}
                style={{
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(148, 163, 184, 0.15)",
                  borderRadius: 10,
                  padding: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                    {item.name}
                    {isSaved && <CheckCircle2 size={14} color="#22c55e" />}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#38bdf8", fontSize: 11, display: "flex", alignItems: "center", gap: 3, textDecoration: "none" }}
                    >
                      <span>{item.hint}</span>
                      <ExternalLink size={10} />
                    </a>
                    {isSaved && (
                      <button
                        type="button"
                        onClick={() => handleDelete(item.statusKey)}
                        disabled={deletingKey === item.statusKey}
                        style={{
                          background: "rgba(239, 68, 68, 0.12)",
                          border: "1px solid rgba(239, 68, 68, 0.4)",
                          color: "#f87171",
                          padding: "2px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                        title="Удалить ключ (DELETE /api/settings/key/:provider)"
                      >
                        <Trash2 size={11} />
                        {deletingKey === item.statusKey ? "..." : "Удалить"}
                      </button>
                    )}
                  </div>
                </div>

                <input
                  type="password"
                  placeholder={
                    isSaved
                      ? "●●●●●●●●●●●● (Ключ сохранён, введите новый для замены)"
                      : "Вставьте бесплатный API-ключ..."
                  }
                  value={keys[item.field]}
                  onChange={(e) => setKeys({ ...keys, [item.field]: e.target.value })}
                  style={{
                    width: "100%",
                    background: "#020617",
                    border: "1px solid rgba(148, 163, 184, 0.22)",
                    borderRadius: 8,
                    padding: "8px 10px",
                    color: "#f8fafc",
                    fontSize: 12,
                    fontFamily: "monospace",
                  }}
                />
              </div>
            );
          })}

          <button
            type="submit"
            disabled={saving}
            style={{
              background: "#0284c7",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 14px",
              fontWeight: 600,
              cursor: "pointer",
              marginTop: 4,
              fontSize: 13,
            }}
          >
            {saving ? "Сохранение..." : "Сохранить новые ключи"}
          </button>
        </form>

        <div style={{ borderTop: "1px solid rgba(148,163,184,0.15)", paddingTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
            <Cpu size={18} color="#a855f7" />
            <span>Модели каждого агента флота (7 специалистов)</span>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {agents.map((a) => (
              <div
                key={a.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 120px 1fr",
                  gap: 8,
                  alignItems: "center",
                  background: "#020617",
                  padding: 8,
                  borderRadius: 8,
                  border: "1px solid rgba(148,163,184,0.14)",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: a.color }}>
                  {a.name} <span style={{ color: "#64748b", fontWeight: 400 }}>({a.role.split("/")[0].trim()})</span>
                </div>
                <select
                  value={a.provider}
                  onChange={(e) => {
                    const p = e.target.value;
                    const defaultMod = RECOMMENDED_MODELS[p]?.[0] || a.model;
                    onUpdateAgentModel?.(a.id, p, defaultMod);
                  }}
                  style={{
                    background: "#0f172a",
                    color: "#e2e8f0",
                    border: "1px solid rgba(148,163,184,0.2)",
                    borderRadius: 6,
                    padding: "4px 6px",
                    fontSize: 11,
                  }}
                >
                  <option value="gemini">Gemini</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="groq">Groq</option>
                  <option value="cerebras">Cerebras</option>
                  <option value="siliconflow">SiliconFlow</option>
                  <option value="zai">Z.ai</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="cloudflare">Cloudflare AI</option>
                </select>
                <input
                  value={a.model}
                  onChange={(e) => onUpdateAgentModel?.(a.id, a.provider, e.target.value)}
                  style={{
                    background: "#0f172a",
                    color: "#e2e8f0",
                    border: "1px solid rgba(148,163,184,0.2)",
                    borderRadius: 6,
                    padding: "4px 8px",
                    fontSize: 11,
                    fontFamily: "monospace",
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
