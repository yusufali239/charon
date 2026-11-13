import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Send, Settings, Zap, Shield, Code2, TrendingUp, Film, Copy, Check, RotateCcw, Trophy, MessagesSquare, Square, Eye, Users, Coffee } from "lucide-react";
import OfficeScene from "./components/OfficeScene";
import SettingsModal from "./components/SettingsModal";

const API_BASE = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
const WS_URL = (import.meta.env.VITE_WS_URL || `${API_BASE.replace(/^http/i, "ws")}/ws`).replace(/\/+$/, "");

const CAMERA_PRESETS = [
  { id: "overview", label: "Обзор", icon: Eye },
  { id: "meeting", label: "Переговорная", icon: Users },
  { id: "lounge", label: "Лаунж", icon: Coffee },
];

/* ---------- lightweight markdown-ish renderer for chat (no deps) ---------- */
function renderInline(text, keyPrefix) {
  const parts = [];
  const re = /(`[^`\n]+`|\*\*[^*\n]+\*\*)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("`")) parts.push(<code key={`${keyPrefix}-${i++}`} className="md-code">{tok.slice(1, -1)}</code>);
    else parts.push(<strong key={`${keyPrefix}-${i++}`}>{tok.slice(2, -2)}</strong>);
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function CodeBlock({ code, lang }) {
  const [done, setDone] = useState(false);
  return (
    <div className="md-pre">
      <div className="md-pre-head">
        <span>{lang || "code"}</span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(code);
            setDone(true);
            setTimeout(() => setDone(false), 1400);
          }}
        >
          {done ? <Check size={11} /> : <Copy size={11} />}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function RichText({ text }) {
  const blocks = useMemo(() => {
    const out = [];
    const lines = String(text || "").split("\n");
    let i = 0;
    let para = [];
    const flushPara = () => {
      if (para.length) out.push({ t: "p", text: para.join("\n") });
      para = [];
    };
    while (i < lines.length) {
      const line = lines[i];
      const fence = line.match(/^\s*```(\w+)?\s*$/);
      if (fence) {
        flushPara();
        const buf = [];
        i++;
        while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) buf.push(lines[i++]);
        i++; // closing fence (or EOF)
        out.push({ t: "code", lang: fence[1], text: buf.join("\n") });
        continue;
      }
      const h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) {
        flushPara();
        out.push({ t: "h", level: h[1].length, text: h[2] });
        i++;
        continue;
      }
      if (/^\s*([-*•]|\d+[.)])\s+/.test(line)) {
        flushPara();
        const ordered = /^\s*\d+[.)]\s+/.test(line);
        const items = [];
        while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*([-*•]|\d+[.)])\s+/, ""));
          i++;
        }
        out.push({ t: "list", ordered, items });
        continue;
      }
      if (!line.trim()) {
        flushPara();
        i++;
        continue;
      }
      para.push(line);
      i++;
    }
    flushPara();
    return out;
  }, [text]);

  return (
    <div className="md">
      {blocks.map((b, idx) => {
        if (b.t === "code") return <CodeBlock key={idx} code={b.text} lang={b.lang} />;
        if (b.t === "h") return <div key={idx} className={`md-h md-h${Math.min(b.level, 3)}`}>{renderInline(b.text, idx)}</div>;
        if (b.t === "list") {
          const Tag = b.ordered ? "ol" : "ul";
          return (
            <Tag key={idx} className="md-list">
              {b.items.map((it, j) => (
                <li key={j}>{renderInline(it, `${idx}-${j}`)}</li>
              ))}
            </Tag>
          );
        }
        return <p key={idx}>{renderInline(b.text, idx)}</p>;
      })}
    </div>
  );
}

const PRESETS = [
  {
    icon: Shield,
    label: "Пентест-аудит",
    prompt: "Сделай чек-лист легального пентеста и поиска уязвимостей (OWASP) для нового веб-приложения и скрипт быстрой проверки заголовков безопасности.",
  },
  {
    icon: TrendingUp,
    label: "Контент + Воронка",
    prompt: "Придумай стратегию продвижения AI-продукта на 7 дней: 3 вирусных хука для Reels/Shorts, структуру лендинга и план постов.",
  },
  {
    icon: Film,
    label: "Motion Graphics",
    prompt: "Разработай концепт и раскадровку 15-секундного Motion Graphics ролика в стиле тёмного киберпанка с таймингами, камерой и промптами.",
  },
  {
    icon: Code2,
    label: "Автоматизация",
    prompt: "Спроектируй и напиши компактный Python-скрипт для автоматического мониторинга и сбора аналитики по конкурентам.",
  },
];

const STATUS_META = {
  working: { label: "Работает", cls: "working" },
  meeting: { label: "Совещание", cls: "meeting" },
  walking: { label: "В пути", cls: "walking" },
  idle: { label: "Свободен", cls: "idle" },
};
const statusMeta = (s) => STATUS_META[s] || STATUS_META.idle;

function TypingDots() {
  return (
    <span className="typing-dots">
      <i />
      <i />
      <i />
    </span>
  );
}

export default function App() {
  const [agents, setAgents] = useState([]);
  const [messages, setMessages] = useState([]);
  const [economyMode, setEconomyMode] = useState(true);
  const [taskRunning, setTaskRunning] = useState(false);
  const [providers, setProviders] = useState({});
  const [connected, setConnected] = useState(false);

  const [prompt, setPrompt] = useState("");
  const [targetAgent, setTargetAgent] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [chatFilter, setChatFilter] = useState("all"); // "all" | "results" | agentId
  const [resetSignal, setResetSignal] = useState(0);
  const [cameraPreset, setCameraPreset] = useState(null); // { id, nonce }
  const [activePreset, setActivePreset] = useState("overview");

  const chatEndRef = useRef(null);

  const goPreset = useCallback((id) => {
    setSelectedId(null);
    setActivePreset(id);
    if (id === "overview") setResetSignal((n) => n + 1);
    else setCameraPreset((p) => ({ id, nonce: (p?.nonce || 0) + 1 }));
  }, []);

  const selectAgent = useCallback((id) => {
    setSelectedId(id);
    setActivePreset(null);
    setTargetAgent(id);
  }, []);

  const resetCamera = useCallback(() => {
    setSelectedId(null);
    setActivePreset("overview");
    setResetSignal((n) => n + 1);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !settingsOpen) resetCamera();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [resetCamera, settingsOpen]);

  useEffect(() => {
    let ws;
    let timer;
    const connect = () => {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        timer = setTimeout(connect, 2000);
      };
      ws.onmessage = (ev) => {
        const data = JSON.parse(ev.data);
        if (data.type === "state") {
          setAgents(data.agents || []);
          setMessages(data.messages || []);
          setEconomyMode(Boolean(data.economy_mode));
          setTaskRunning(Boolean(data.task_running));
          setProviders(data.providers || {});
        } else if (data.type === "positions") {
          setAgents(data.agents || []);
          if (typeof data.task_running === "boolean") setTaskRunning(data.task_running);
        } else if (data.type === "message") {
          setMessages((prev) => [...prev.slice(-79), data.message]);
        } else if (data.type === "config") {
          setEconomyMode(Boolean(data.economy_mode));
          setProviders(data.providers || {});
        }
      };
    };
    connect();
    return () => {
      clearTimeout(timer);
      if (ws) ws.close();
    };
  }, []);

  const filteredMessages = useMemo(() => {
    if (chatFilter === "all") return messages;
    if (chatFilter === "results") return messages.filter((m) => m.type === "result");
    return messages.filter((m) => m.sender_id === chatFilter);
  }, [messages, chatFilter]);

  const thinkingAgents = useMemo(() => {
    if (!taskRunning) return [];
    return agents.filter(
      (a) =>
        (a.status === "working" || a.status === "meeting" || Boolean(a.collaborating_with)) &&
        (chatFilter === "all" || chatFilter === a.id)
    );
  }, [agents, taskRunning, chatFilter]);

  const resultCount = useMemo(() => messages.filter((m) => m.type === "result").length, [messages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [filteredMessages, thinkingAgents.length]);

  const sendTask = async (textToSend) => {
    const clean = (textToSend ?? prompt).trim();
    if (!clean || taskRunning) return;
    setPrompt("");
    await fetch(`${API_BASE}/api/task`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: clean, target_agent: targetAgent }),
    });
  };

  const stopTask = async () => {
    await fetch(`${API_BASE}/api/task/stop`, { method: "POST" }).catch(() => {});
  };

  const toggleEconomy = async () => {
    await fetch(`${API_BASE}/api/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ economy_mode: !economyMode }),
    });
  };

  const saveKeys = async (payload) => {
    await fetch(`${API_BASE}/api/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  };

  const updateAgentModel = async (id, provider, model) => {
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, provider, model } : a)));
    await fetch(`${API_BASE}/api/agents/${id}/model`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, model }),
    });
  };

  const hasAnyKey = Object.values(providers).some(Boolean);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 390px", width: "100%", height: "100%" }}>
      {/* Left: 3D Office Viewport */}
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <OfficeScene
          agents={agents}
          taskRunning={taskRunning}
          selectedId={selectedId}
          onSelect={selectAgent}
          resetSignal={resetSignal}
          cameraPreset={cameraPreset}
        />

        {/* Top HUD */}
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            right: 14,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              pointerEvents: "auto",
              background: "rgba(15, 23, 42, 0.85)",
              border: "1px solid rgba(148, 163, 184, 0.2)",
              backdropFilter: "blur(8px)",
              padding: "8px 14px",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: connected ? "#22c55e" : "#ef4444",
              }}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>CHARON 3D AI OFFICE</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                {taskRunning ? "Команда работает над задачей…" : "Свободный режим (живут в офисе)"}
              </div>
            </div>
          </div>

          <div style={{ pointerEvents: "auto", display: "flex", gap: 8 }}>
            <div className="cam-group" title="Камера (Esc — сброс)">
              {CAMERA_PRESETS.map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.id}
                    className={`cam-btn${activePreset === p.id ? " active" : ""}`}
                    onClick={() => goPreset(p.id)}
                  >
                    <Icon size={13} />
                    {p.label}
                  </button>
                );
              })}
              <button className="cam-btn icon" onClick={resetCamera} title="Сбросить камеру (Esc)">
                <RotateCcw size={13} />
              </button>
            </div>
            <button
              onClick={toggleEconomy}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: economyMode ? "rgba(34, 197, 94, 0.16)" : "rgba(15, 23, 42, 0.85)",
                border: `1px solid ${economyMode ? "#22c55e" : "rgba(148,163,184,0.25)"}`,
                color: economyMode ? "#4ade80" : "#cbd5e1",
                padding: "8px 12px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Zap size={14} />
              Эконом: {economyMode ? "ВКЛ" : "ВЫКЛ"}
            </button>

            <button
              onClick={() => setSettingsOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: hasAnyKey ? "rgba(15, 23, 42, 0.85)" : "rgba(245, 158, 11, 0.2)",
                border: `1px solid ${hasAnyKey ? "rgba(148,163,184,0.25)" : "#f59e0b"}`,
                color: hasAnyKey ? "#e2e8f0" : "#fbbf24",
                padding: "8px 12px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Settings size={14} />
              {hasAnyKey ? "API / Модели" : "Подключить API (0₽)"}
            </button>
          </div>
        </div>

        {/* Bottom Command Bar */}
        <div
          style={{
            position: "absolute",
            bottom: 14,
            left: 14,
            right: 14,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {PRESETS.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.label}
                  onClick={() => sendTask(p.prompt)}
                  disabled={taskRunning}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    background: "rgba(15, 23, 42, 0.84)",
                    border: "1px solid rgba(148, 163, 184, 0.2)",
                    color: "#cbd5e1",
                    padding: "5px 10px",
                    borderRadius: 999,
                    fontSize: 11,
                    cursor: "pointer",
                    backdropFilter: "blur(6px)",
                  }}
                >
                  <Icon size={12} color="#38bdf8" />
                  {p.label}
                </button>
              );
            })}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendTask();
            }}
            style={{
              display: "flex",
              gap: 8,
              background: "rgba(15, 23, 42, 0.9)",
              border: "1px solid rgba(148, 163, 184, 0.25)",
              borderRadius: 14,
              padding: 8,
              backdropFilter: "blur(10px)",
            }}
          >
            <select
              value={targetAgent}
              onChange={(e) => setTargetAgent(e.target.value)}
              style={{
                background: "#020617",
                color: "#e2e8f0",
                border: "1px solid rgba(148,163,184,0.2)",
                borderRadius: 8,
                padding: "0 10px",
                fontSize: 12,
              }}
            >
              <option value="all">Вся команда</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.role.split("/")[0].trim()})
                </option>
              ))}
            </select>

            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Дать задание офису (пентест, код, контент, motion graphics)..."
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#f8fafc",
                fontSize: 13,
              }}
            />

            <button
              type="submit"
              disabled={taskRunning || !prompt.trim()}
              style={{
                background: taskRunning ? "#334155" : "#0284c7",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "8px 14px",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontWeight: 600,
                fontSize: 13,
                cursor: taskRunning ? "not-allowed" : "pointer",
              }}
            >
              <Send size={14} />
              Запуск
            </button>
            {taskRunning && (
              <button type="button" className="stop-btn" onClick={stopTask} title="Остановить задачу">
                <Square size={12} fill="currentColor" />
                Стоп
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Right Sidebar: Live Agent Comms */}
      <div
        style={{
          background: "#0b1120",
          borderLeft: "1px solid rgba(148, 163, 184, 0.16)",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(148,163,184,0.14)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Штат офиса ({agents.length})</div>
          <div className="roster">
            {agents.map((a) => {
              const meta = statusMeta(a.status);
              const busy = taskRunning && (a.status === "working" || a.status === "meeting" || Boolean(a.collaborating_with));
              const partner = a.collaborating_with && agents.find((x) => x.id === a.collaborating_with);
              return (
                <button
                  key={a.id}
                  className={`roster-card${selectedId === a.id ? " selected" : ""}`}
                  style={{ "--agent-color": a.color }}
                  onClick={() => selectAgent(a.id)}
                  title={a.role}
                >
                  <span className={`avatar-dot status-${meta.cls}`} style={{ background: a.color }} />
                  <span className="roster-name">{a.name}</span>
                  <span className={`status-badge ${meta.cls}`}>
                    {busy ? (
                      <>
                        {partner ? `Ревью · ${partner.name}` : a.status === "meeting" ? "Обсуждает" : "Думает"}
                        <TypingDots />
                      </>
                    ) : (
                      meta.label
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat filters */}
        <div className="chat-filters">
          <button className={`filter-chip${chatFilter === "all" ? " active" : ""}`} onClick={() => setChatFilter("all")}>
            <MessagesSquare size={12} /> Все
          </button>
          <button
            className={`filter-chip result${chatFilter === "results" ? " active" : ""}`}
            onClick={() => setChatFilter("results")}
          >
            <Trophy size={12} /> Итоги{resultCount ? ` (${resultCount})` : ""}
          </button>
          {agents.map((a) => (
            <button
              key={a.id}
              className={`filter-chip${chatFilter === a.id ? " active" : ""}`}
              style={{ "--agent-color": a.color }}
              onClick={() => setChatFilter(chatFilter === a.id ? "all" : a.id)}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: a.color }} />
              {a.name}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {messages.length === 0 && (
            <div style={{ color: "#64748b", fontSize: 12, textAlign: "center", marginTop: 40 }}>
              Ожидаем подключения к офису…
            </div>
          )}
          {messages.length > 0 && filteredMessages.length === 0 && (
            <div style={{ color: "#64748b", fontSize: 12, textAlign: "center", marginTop: 40 }}>
              {chatFilter === "results" ? "Итоговых результатов пока нет." : "Нет сообщений по этому фильтру."}
            </div>
          )}
          {filteredMessages.map((m) => (
            <div
              key={m.id}
              className={`chat-msg${m.type === "result" ? " result" : ""}`}
              style={{
                background: m.type === "result" ? "rgba(14, 165, 233, 0.1)" : "#0f172a",
                border: `1px solid ${m.type === "result" ? "rgba(56,189,248,0.4)" : "rgba(148,163,184,0.12)"}`,
                borderRadius: 10,
                padding: "9px 11px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: m.color }}>
                  <span>{m.sender_name}</span>
                  <span style={{ color: "#64748b", fontWeight: 400, fontSize: 10 }}>{m.role}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10, color: "#475569" }}>{m.ts}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(m.text);
                      setCopiedId(m.id);
                      setTimeout(() => setCopiedId(null), 1500);
                    }}
                    title="Копировать"
                    style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}
                  >
                    {copiedId === m.id ? <Check size={12} color="#22c55e" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
              <RichText text={m.text} />
              {m.model && (
                <div style={{ fontSize: 10, color: "#64748b", marginTop: 5 }}>
                  Модель: {m.model}
                </div>
              )}
            </div>
          ))}
          {thinkingAgents.map((a) => (
            <div key={`typing-${a.id}`} className="typing-row" style={{ "--agent-color": a.color }}>
              <span style={{ color: a.color, fontWeight: 700 }}>{a.name}</span>
              <span style={{ color: "#94a3b8" }}>{a.status === "meeting" ? "обсуждает" : "печатает"}</span>
              <TypingDots />
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        providers={providers}
        agents={agents}
        onSaveKeys={saveKeys}
        onUpdateAgentModel={updateAgentModel}
      />
    </div>
  );
}
