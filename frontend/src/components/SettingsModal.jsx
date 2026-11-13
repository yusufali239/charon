import React, { useState } from "react";
import { X, Key, Cpu, CheckCircle2 } from "lucide-react";

const RECOMMENDED_MODELS = {
  openrouter: [
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "moonshotai/kimi-k3.1-pro",
    "qwen/qwen3.8-flash-next",
    "cohere/north-mini-code:free",
    "qwen/qwen3-235b-a22b:free",
    "nousresearch/hermes-3-llama-3.1-405b:free",
  ],
  siliconflow: ["deepseek-ai/DeepSeek-V4.1-Flash", "Qwen/Qwen3-235B-A22B"],
  zai: ["glm-5.3-flash", "glm-4.5-flash"],
  gemini: ["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.0-flash"],
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
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
};

export default function SettingsModal({ open, onClose, providers, agents, onSaveKeys, onUpdateAgentModel }) {
  const [keys, setKeys] = useState({
    openrouter_api_key: "",
    gemini_api_key: "",
    groq_api_key: "",
    cerebras_api_key: "",
    deepseek_api_key: "",
    siliconflow_api_key: "",
    zai_api_key: "",
  });
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {};
    Object.entries(keys).forEach(([k, v]) => {
      if (v.trim()) payload[k] = v.trim();
    });
    await onSaveKeys(payload);
    setSaving(false);
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2, 6, 23, 0.78)",
        backdropFilter: "blur(6px)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 640,
          maxHeight: "90vh",
          overflowY: "auto",
          background: "#0f172a",
          border: "1px solid rgba(148, 163, 184, 0.2)",
          borderRadius: 16,
          padding: 20,
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 700 }}>
            <Key size={18} color="#38bdf8" />
            <span>Бесплатные API-ключи и модели агентов</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} style={{ display: "grid", gap: 12, marginBottom: 22 }}>
          {[
            { field: "openrouter_api_key", name: "OpenRouter (:free + Uncensored)", statusKey: "openrouter", hint: "openrouter.ai/keys" },
            { field: "gemini_api_key", name: "Google AI Studio (Gemini Flash)", statusKey: "gemini", hint: "aistudio.google.com/apikey" },
            { field: "groq_api_key", name: "Groq (Быстрый бесплатный тир)", statusKey: "groq", hint: "console.groq.com/keys" },
            { field: "cerebras_api_key", name: "Cerebras (Qwen 3.8 / GPT-OSS)", statusKey: "cerebras", hint: "cloud.cerebras.ai" },
            { field: "deepseek_api_key", name: "DeepSeek (V3 / Reasoner)", statusKey: "deepseek", hint: "platform.deepseek.com" },
            { field: "siliconflow_api_key", name: "SiliconFlow (DeepSeek V4.1 Flash)", statusKey: "siliconflow", hint: "cloud.siliconflow.cn" },
            { field: "zai_api_key", name: "Z.ai (GLM-5.3 Flash Free)", statusKey: "zai", hint: "z.ai / bigmodel" },
          ].map((item) => (
            <div key={item.field} style={{ display: "grid", gap: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  {item.name}
                  {providers[item.statusKey] && <CheckCircle2 size={14} color="#22c55e" />}
                </span>
                <span style={{ color: "#64748b" }}>{item.hint}</span>
              </div>
              <input
                type="password"
                placeholder={providers[item.statusKey] ? "Ключ уже сохранён (введите новый для замены)" : "Вставьте бесплатный API-ключ..."}
                value={keys[item.field]}
                onChange={(e) => setKeys({ ...keys, [item.field]: e.target.value })}
                style={{
                  background: "#020617",
                  border: "1px solid rgba(148,163,184,0.22)",
                  borderRadius: 8,
                  padding: "8px 10px",
                  color: "#f8fafc",
                  fontSize: 13,
                }}
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={saving}
            style={{
              background: "#0284c7",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "9px 14px",
              fontWeight: 600,
              cursor: "pointer",
              marginTop: 4,
            }}
          >
            {saving ? "Сохранение..." : "Сохранить ключи"}
          </button>
        </form>

        <div style={{ borderTop: "1px solid rgba(148,163,184,0.15)", paddingTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
            <Cpu size={16} color="#a855f7" />
            <span>Модели каждого агента</span>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {agents.map((a) => (
              <div
                key={a.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 110px 1fr",
                  gap: 8,
                  alignItems: "center",
                  background: "#020617",
                  padding: 8,
                  borderRadius: 8,
                  border: "1px solid rgba(148,163,184,0.12)",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: a.color }}>
                  {a.name} <span style={{ color: "#64748b", fontWeight: 400 }}>({a.role.split(" ")[0]})</span>
                </div>
                <select
                  value={a.provider}
                  onChange={(e) => {
                    const p = e.target.value;
                    onUpdateAgentModel(a.id, p, RECOMMENDED_MODELS[p][0]);
                  }}
                  style={{
                    background: "#0f172a",
                    color: "#e2e8f0",
                    border: "1px solid rgba(148,163,184,0.2)",
                    borderRadius: 6,
                    padding: "4px 6px",
                    fontSize: 12,
                  }}
                >
                  <option value="openrouter">OpenRouter</option>
                  <option value="siliconflow">SiliconFlow</option>
                  <option value="zai">Z.ai (GLM)</option>
                  <option value="gemini">Gemini</option>
                  <option value="groq">Groq</option>
                  <option value="cerebras">Cerebras</option>
                  <option value="deepseek">DeepSeek</option>
                </select>
                <input
                  value={a.model}
                  onChange={(e) => onUpdateAgentModel(a.id, a.provider, e.target.value)}
                  style={{
                    background: "#0f172a",
                    color: "#e2e8f0",
                    border: "1px solid rgba(148,163,184,0.2)",
                    borderRadius: 6,
                    padding: "4px 8px",
                    fontSize: 12,
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
