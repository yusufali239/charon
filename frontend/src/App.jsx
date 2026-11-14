import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Send,
  Settings,
  Zap,
  Shield,
  Code2,
  TrendingUp,
  Film,
  Copy,
  Check,
  RotateCcw,
  Trophy,
  MessagesSquare,
  Square,
  Eye,
  Users,
  Coffee,
  Activity,
  Workflow,
  Cpu,
  Key,
  Database,
  Terminal,
  BarChart3,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  ArrowDown,
} from "lucide-react";
import OfficeScene from "./components/OfficeScene";
import SettingsModal from "./components/SettingsModal";
import CommandDashboard from "./components/CommandDashboard";

const DEFAULT_ORIGIN =
  typeof window !== "undefined" &&
  window.location.hostname !== "localhost" &&
  window.location.hostname !== "127.0.0.1"
    ? window.location.origin
    : "http://127.0.0.1:8000";
const API_BASE = (import.meta.env.VITE_API_URL || DEFAULT_ORIGIN).replace(/\/+$/, "");
const WS_URL = (import.meta.env.VITE_WS_URL || `${API_BASE.replace(/^http/i, "ws")}/ws`).replace(/\/+$/, "");

const CAMERA_PRESETS = [
  { id: "overview", label: "Обзор", icon: Eye },
  { id: "meeting", label: "Переговорная", icon: Users },
  { id: "lounge", label: "Лаунж", icon: Coffee },
];

const NAV_TABS = [
  { id: "office", label: "3D Офис", icon: Eye, is3d: true },
  { id: "overview", label: "Обзор", icon: Activity },
  { id: "tasks", label: "Задачи", icon: Workflow, hasBadge: true },
  { id: "extensions", label: "Терминал & Браузер", icon: Terminal },
  { id: "agents", label: "Агенты", icon: Users },
  { id: "models", label: "Модели", icon: Cpu },
  { id: "providers", label: "Провайдеры", icon: Key },
  { id: "workflow", label: "Пайплайн", icon: Workflow },
  { id: "memory", label: "Память", icon: Database },
  { id: "logs", label: "Логи", icon: Code2 },
  { id: "analytics", label: "Квоты", icon: BarChart3 },
  { id: "settings", label: "Настройки", icon: Sliders },
];

const ALL_DEFAULT_AGENTS = [
  {
    id: "lead",
    name: "Атлас",
    role: "Тимлид / Стратег",
    specialty: "Оркестрация задач, стратегия, финальная сборка",
    color: "#38bdf8",
    provider: "gemini",
    model: "gemini-3-flash-preview",
    status: "idle",
    visual_state: "IDLE",
  },
  {
    id: "cybersec",
    name: "Вектор",
    role: "Пентест и Кибербез",
    specialty: "Аудит уязвимостей, OWASP, threat modeling, харденинг",
    color: "#f43f5e",
    provider: "openrouter",
    model: "nvidia/nemotron-3-ultra-550b-a55b:free",
    status: "idle",
    visual_state: "IDLE",
  },
  {
    id: "dev",
    name: "Нова",
    role: "Код и Автоматизация",
    specialty: "Python/JS скрипты, парсеры, боты, архитектура",
    color: "#22c55e",
    provider: "cerebras",
    model: "qwen-3.8-27b",
    status: "idle",
    visual_state: "IDLE",
  },
  {
    id: "growth",
    name: "Пульс",
    role: "Контент и Продвижение",
    specialty: "Вирусные сценарии, воронки, SMM, SEO, копирайтинг",
    color: "#f59e0b",
    provider: "groq",
    model: "openai/gpt-oss-120b",
    status: "idle",
    visual_state: "IDLE",
  },
  {
    id: "motion",
    name: "Шейдер",
    role: "Motion Graphics & Визуал",
    specialty: "Раскадровки, 3D/AE-концепты, промпты, шейдеры",
    color: "#a855f7",
    provider: "deepseek",
    model: "deepseek-chat",
    status: "idle",
    visual_state: "IDLE",
  },
  {
    id: "scout",
    name: "Скаут",
    role: "Research Analyst",
    specialty: "Глубокий веб-поиск, анализ документации, сбор бенчмарков, разведка API",
    color: "#06b6d4",
    provider: "openrouter",
    model: "moonshotai/kimi-k3.1-pro",
    status: "idle",
    visual_state: "IDLE",
  },
  {
    id: "quant",
    name: "Квант",
    role: "QA / Независимый Аудитор",
    specialty: "Независимая верификация кода, тестирование граничных условий, валидация гипотез",
    color: "#eab308",
    provider: "openrouter",
    model: "qwen/qwen3-235b-a22b:free",
    status: "idle",
    visual_state: "IDLE",
  },
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

  // V2 Navigation & Dashboard state fields
  const [activeTab, setActiveTab] = useState("office");
  const [currentDag, setCurrentDag] = useState(null);
  const [quotas, setQuotas] = useState([]);
  const [files, setFiles] = useState([]);
  const [logs, setLogs] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [terminalHistory, setTerminalHistory] = useState([]);
  const [browserSessions, setBrowserSessions] = useState([]);
  const [reconReports, setReconReports] = useState([]);
  const [pendingApproval, setPendingApproval] = useState(null);
  const [autoRouting, setAutoRouting] = useState(true);
  const [humanControlGates, setHumanControlGates] = useState({
    highRiskApproval: true,
    deployApproval: true,
    qaConsensusGate: true,
  });

  const [prompt, setPrompt] = useState("");
  const [targetAgent, setTargetAgent] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [chatFilter, setChatFilter] = useState("all");
  const [resetSignal, setResetSignal] = useState(0);
  const [cameraPreset, setCameraPreset] = useState(null);
  const [activePreset, setActivePreset] = useState("overview");

  const chatEndRef = useRef(null);
  const chatListRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const savedScrollTopRef = useRef(0);
  const prevFilteredInfoRef = useRef({ count: 0, lastId: "", lastLen: 0, filter: "all" });
  const [unreadCount, setUnreadCount] = useState(0);

  const updateAgentsDedup = useCallback((incoming) => {
    if (!Array.isArray(incoming)) return;
    setAgents((prev) => {
      if (prev.length !== incoming.length) return incoming;
      for (let i = 0; i < prev.length; i++) {
        const a = prev[i];
        const b = incoming[i];
        if (
          a.id !== b.id ||
          a.status !== b.status ||
          a.visual_state !== b.visual_state ||
          a.bubble !== b.bubble ||
          a.collaborating_with !== b.collaborating_with ||
          a.provider !== b.provider ||
          a.model !== b.model ||
          a.target_x !== b.target_x ||
          a.target_y !== b.target_y ||
          Math.abs((a.x || 0) - (b.x || 0)) > 0.01 ||
          Math.abs((a.y || 0) - (b.y || 0)) > 0.01 ||
          (a.path?.length || 0) !== (b.path?.length || 0)
        ) {
          return incoming;
        }
      }
      return prev;
    });
  }, []);

  const updateMessagesDedup = useCallback((incoming) => {
    if (!Array.isArray(incoming)) return;
    setMessages((prev) => {
      if (prev.length === incoming.length) {
        if (prev.length === 0) return prev;
        const pLast = prev[prev.length - 1];
        const nLast = incoming[incoming.length - 1];
        if (
          pLast?.id === nLast?.id &&
          (pLast?.text || "").length === (nLast?.text || "").length &&
          prev[0]?.id === incoming[0]?.id
        ) {
          return prev;
        }
      }
      return incoming;
    });
  }, []);

  const handleChatScroll = useCallback((e) => {
    const el = e.currentTarget;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distFromBottom <= 95;
    isNearBottomRef.current = nearBottom;
    savedScrollTopRef.current = el.scrollTop;
    if (nearBottom) {
      setUnreadCount((c) => (c !== 0 ? 0 : c));
    }
  }, []);

  const scrollToLatestMessages = useCallback((smooth = true) => {
    const el = chatListRef.current;
    isNearBottomRef.current = true;
    setUnreadCount(0);
    if (el) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    } else {
      chatEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    }
  }, []);

  // Ensure all 7 agents are represented even if backend is in transition
  const displayAgents = useMemo(() => {
    if (!agents || agents.length === 0) return ALL_DEFAULT_AGENTS;
    return ALL_DEFAULT_AGENTS.map((def) => {
      const found = agents.find((a) => a.id === def.id);
      return found ? { ...def, ...found } : def;
    });
  }, [agents]);

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
      if (e.key === "Escape" && !settingsOpen) {
        if (activeTab === "office") resetCamera();
        else setActiveTab("office");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [resetCamera, settingsOpen, activeTab]);

  useEffect(() => {
    let ws;
    let timer;
    let pollTimer;
    let wsOpen = false;

    const applySnapshot = (data) => {
      if (!data) return;
      if (data.agents) updateAgentsDedup(data.agents);
      if (data.messages) updateMessagesDedup(data.messages);
      if (typeof data.economy_mode === "boolean") setEconomyMode(data.economy_mode);
      if (typeof data.task_running === "boolean") setTaskRunning(data.task_running);
      if (data.providers) setProviders(data.providers);
      if (data.current_dag !== undefined) setCurrentDag(data.current_dag);
      if (data.quotas) setQuotas(data.quotas);
      if (data.files) setFiles((prev) => (prev.length === data.files.length ? prev : data.files));
      if (data.logs) setLogs((prev) => (prev.length === data.logs.length ? prev : data.logs));
      if (data.decisions) setDecisions((prev) => (prev.length === data.decisions.length ? prev : data.decisions));
      if (data.terminal_history) {
        setTerminalHistory((prev) => (prev.length === data.terminal_history.length ? prev : data.terminal_history));
      }
      if (data.browser_sessions) {
        setBrowserSessions((prev) => (prev.length === data.browser_sessions.length ? prev : data.browser_sessions));
      }
      if (data.recon_reports) {
        setReconReports((prev) => (prev.length === data.recon_reports.length ? prev : data.recon_reports));
      }
      if (data.pending_approval !== undefined) setPendingApproval(data.pending_approval);
      setConnected(true);
    };

    fetch(`${API_BASE}/api/state`)
      .then((r) => (r.ok ? r.json() : null))
      .then(applySnapshot)
      .catch(() => {});

    const connect = () => {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => {
        wsOpen = true;
        setConnected(true);
      };
      ws.onclose = () => {
        wsOpen = false;
        timer = setTimeout(connect, 2500);
      };
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.type === "state") {
            applySnapshot(data);
          } else if (data.type === "positions") {
            updateAgentsDedup(data.agents || []);
            if (typeof data.task_running === "boolean") setTaskRunning(data.task_running);
            if (data.current_dag) setCurrentDag(data.current_dag);
          } else if (data.type === "message") {
            setMessages((prev) => [...prev.slice(-79), data.message]);
            if (data.message) {
              setLogs((prev) => [
                ...prev.slice(-199),
                {
                  id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  ts: data.message.ts || new Date().toLocaleTimeString(),
                  level: data.message.type === "result" ? "INFO" : "INFO",
                  agent: data.message.sender_id,
                  message: `${data.message.sender_name}: ${data.message.text?.slice(0, 160)}...`,
                },
              ]);
            }
          } else if (data.type === "config") {
            setEconomyMode(Boolean(data.economy_mode));
            setProviders(data.providers || {});
          } else if (data.type === "dag" || data.type === "task_update") {
            if (data.dag) setCurrentDag(data.dag);
            if (data.pending_approval !== undefined) setPendingApproval(data.pending_approval);
          } else if (data.type === "approval_request") {
            setPendingApproval(data.approval || data);
          } else if (data.type === "log") {
            setLogs((prev) => [...prev.slice(-199), data.log]);
          } else if (data.type === "file") {
            setFiles((prev) => {
              const idx = prev.findIndex((f) => f.name === data.file.name);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = data.file;
                return next;
              }
              return [...prev, data.file];
            });
          }
        } catch (e) {
          // ignore parsing error
        }
      };
    };
    connect();

    pollTimer = setInterval(() => {
      if (!wsOpen) {
        fetch(`${API_BASE}/api/state`)
          .then((r) => (r.ok ? r.json() : null))
          .then(applySnapshot)
          .catch(() => setConnected(false));
      }
    }, 1200);

    return () => {
      clearTimeout(timer);
      clearInterval(pollTimer);
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
    return displayAgents.filter(
      (a) =>
        (a.status === "working" || a.status === "meeting" || Boolean(a.collaborating_with)) &&
        (chatFilter === "all" || chatFilter === a.id)
    );
  }, [displayAgents, taskRunning, chatFilter]);

  const resultCount = useMemo(() => messages.filter((m) => m.type === "result").length, [messages]);

  useEffect(() => {
    const prev = prevFilteredInfoRef.current;
    const count = filteredMessages.length;
    const lastMsg = count > 0 ? filteredMessages[count - 1] : null;
    const lastId = lastMsg?.id || "";
    const lastLen = (lastMsg?.text || "").length;

    const filterChanged = prev.filter !== chatFilter;
    const hasNewMsg = count > prev.count || (lastId && lastId !== prev.lastId);
    const isStreamingUpdate = lastId && lastId === prev.lastId && lastLen !== prev.lastLen;

    prevFilteredInfoRef.current = { count, lastId, lastLen, filter: chatFilter };

    if (filterChanged) {
      if (isNearBottomRef.current) {
        scrollToLatestMessages(false);
      }
      return;
    }

    if (!hasNewMsg && !isStreamingUpdate) return;

    // Auto-scroll ONLY when a new response/token arrives AND user is near bottom (or user just submitted)
    const isUserAuthored = lastMsg?.sender_id === "user";
    if (isNearBottomRef.current || isUserAuthored) {
      scrollToLatestMessages(hasNewMsg && !isStreamingUpdate);
    } else if (hasNewMsg) {
      const added = Math.max(1, count - prev.count);
      setUnreadCount((c) => c + added);
    }
  }, [filteredMessages, chatFilter, scrollToLatestMessages]);

  // Preserve scroll position when returning to the 3D Office tab
  useEffect(() => {
    if (activeTab === "office" && chatListRef.current) {
      if (isNearBottomRef.current) {
        chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
      } else {
        chatListRef.current.scrollTop = savedScrollTopRef.current;
      }
    }
  }, [activeTab]);

  const refreshState = () => {
    fetch(`${API_BASE}/api/state`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setConnected(true);
          if (d.agents) updateAgentsDedup(d.agents);
          if (d.messages) updateMessagesDedup(d.messages);
          if (typeof d.economy_mode === "boolean") setEconomyMode(d.economy_mode);
          if (typeof d.task_running === "boolean") setTaskRunning(d.task_running);
          if (d.providers) setProviders(d.providers);
          if (d.current_dag !== undefined) setCurrentDag(d.current_dag);
          if (d.quotas) setQuotas(d.quotas);
          const nextFiles = d.files || (d.memory && d.memory.files);
          if (nextFiles) setFiles((prev) => (prev.length === nextFiles.length ? prev : nextFiles));
          const nextLogs = d.logs || (d.memory && d.memory.logs);
          if (nextLogs) setLogs((prev) => (prev.length === nextLogs.length ? prev : nextLogs));
          const nextDec = d.decisions || (d.memory && d.memory.decisions);
          if (nextDec) setDecisions((prev) => (prev.length === nextDec.length ? prev : nextDec));
          if (d.terminal_history) setTerminalHistory(d.terminal_history);
          if (d.browser_sessions) setBrowserSessions(d.browser_sessions);
          if (d.recon_reports) setReconReports(d.recon_reports);
          if (d.pending_approval !== undefined) setPendingApproval(d.pending_approval);
        }
      })
      .catch(() => {});
  };

  const runExtension = async (payload) => {
    try {
      const res = await fetch(`${API_BASE}/api/extensions/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      refreshState();
      return data;
    } catch {
      return null;
    }
  };

  const sendTask = async (textToSend, customTarget) => {
    const clean = (textToSend ?? prompt).trim();
    if (!clean || taskRunning) return;
    setPrompt("");
    setTaskRunning(true);
    try {
      await fetch(`${API_BASE}/api/task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: clean, target_agent: customTarget || targetAgent }),
      });
    } finally {
      refreshState();
    }
  };

  const stopTask = async () => {
    await fetch(`${API_BASE}/api/task/stop`, { method: "POST" }).catch(() => {});
    refreshState();
  };

  const retryTask = async (nodeId) => {
    setTaskRunning(true);
    try {
      await fetch(`${API_BASE}/api/task/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ node_id: nodeId }),
      });
    } finally {
      refreshState();
    }
  };

  const approveTask = async (approvalId, approved, feedback = "") => {
    setPendingApproval(null);
    if (approved) setTaskRunning(true);
    try {
      await fetch(`${API_BASE}/api/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: approvalId, approved, feedback }),
      });
    } finally {
      refreshState();
    }
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

  const saveSingleKey = async (provider, keyVal) => {
    await saveKeys({ [`${provider}_api_key`]: keyVal });
    setProviders((prev) => ({ ...prev, [provider]: true }));
  };

  const deleteKey = async (provider) => {
    try {
      const res = await fetch(`${API_BASE}/api/settings/key/${provider}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        // Fallback: update via POST settings if DELETE route is still propagating
        await fetch(`${API_BASE}/api/settings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [`${provider}_api_key`]: "" }),
        });
      }
    } catch (e) {
      console.warn("Delete key fallback:", e);
    }
    setProviders((prev) => ({ ...prev, [provider]: false }));
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
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", overflow: "hidden" }}>
      {/* V2 Top Navigation Bar (11 Sections) */}
      <header className="v2-top-navbar">
        <div className="v2-nav-brand">
          <span className="v2-brand-badge">V2</span>
          <div>
            <div className="v2-brand-title">
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: connected ? "#22c55e" : "#ef4444" }} />
              CHARON 3D AI STUDIO
            </div>
            <div className="v2-brand-sub">
              {taskRunning ? "Команда работает над задачей…" : "7 Автономных Агентов"}
            </div>
          </div>
        </div>

        {/* 11 Navigation Tabs */}
        <nav className="v2-nav-tabs-wrapper">
          {NAV_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                className={`v2-nav-tab-btn ${tab.is3d ? "tab-3d" : ""} ${isActive ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
                {tab.hasBadge && pendingApproval && (
                  <span className="v2-tab-alert-badge">!</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Header Quick Controls */}
        <div className="v2-nav-actions">
          <button
            onClick={toggleEconomy}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: economyMode ? "rgba(34, 197, 94, 0.16)" : "rgba(15, 23, 42, 0.85)",
              border: `1px solid ${economyMode ? "#22c55e" : "rgba(148,163,184,0.25)"}`,
              color: economyMode ? "#4ade80" : "#cbd5e1",
              padding: "6px 11px",
              borderRadius: 8,
              fontSize: 11.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Zap size={13} />
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
              padding: "6px 11px",
              borderRadius: 8,
              fontSize: 11.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Settings size={13} />
            {hasAnyKey ? "Ключи API" : "Подключить API (0₽)"}
          </button>
        </div>
      </header>

      {/* Main Area: 3D Office OR CommandDashboard */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {activeTab === "office" ? (
          <div className="office-split-layout" style={{ display: "grid", gridTemplateColumns: "1fr 390px", width: "100%", height: "100%" }}>
            {/* Left: 3D Office Viewport */}
            <div className="office-viewport" style={{ position: "relative", width: "100%", height: "100%", minHeight: 0 }}>
              <OfficeScene
                agents={displayAgents}
                taskRunning={taskRunning}
                selectedId={selectedId}
                onSelect={selectAgent}
                resetSignal={resetSignal}
                cameraPreset={cameraPreset}
              />

              {/* Floating Pending Approval Alert in 3D View */}
              {pendingApproval && (
                <div
                  style={{
                    position: "absolute",
                    top: 14,
                    left: 14,
                    right: 14,
                    zIndex: 20,
                  }}
                >
                  <div className="v2-approval-alert-banner">
                    <div className="v2-approval-left">
                      <div className="v2-approval-badge">
                        <AlertTriangle size={15} />
                        <span>ОДОБРЕНИЕ</span>
                      </div>
                      <div className="v2-approval-info">
                        <div className="v2-approval-title">{pendingApproval.task || "Критическая операция"}</div>
                        <div className="v2-approval-desc">{pendingApproval.description || "Требуется согласие оператора."}</div>
                      </div>
                    </div>
                    <div className="v2-approval-actions">
                      <button className="v2-btn-approve" onClick={() => approveTask(pendingApproval.id, true)}>
                        <CheckCircle2 size={14} /> Одобрить
                      </button>
                      <button className="v2-btn-reject" onClick={() => approveTask(pendingApproval.id, false)}>
                        <Square size={13} /> Отклонить
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Top HUD Camera Controls in 3D Scene */}
              <div
                style={{
                  position: "absolute",
                  top: pendingApproval ? 80 : 14,
                  right: 14,
                  display: "flex",
                  gap: 8,
                  zIndex: 10,
                }}
              >
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
                  zIndex: 10,
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
                          background: "rgba(15, 23, 42, 0.88)",
                          border: "1px solid rgba(148, 163, 184, 0.2)",
                          color: "#cbd5e1",
                          padding: "5px 11px",
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
                    background: "rgba(15, 23, 42, 0.92)",
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
                    <option value="all">Вся команда (7 агентов)</option>
                    {displayAgents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.role.split("/")[0].trim()})
                      </option>
                    ))}
                  </select>

                  <input
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Дать задание офису (пентест, код, контент, motion graphics, ресерч, QA)..."
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
              className="office-chat-sidebar"
              style={{
                background: "#0b1120",
                borderLeft: "1px solid rgba(148, 163, 184, 0.16)",
                display: "flex",
                flexDirection: "column",
                height: "100%",
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(148,163,184,0.14)" }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                  Штат офиса ({displayAgents.length})
                </div>
                <div className="roster">
                  {displayAgents.map((a) => {
                    const meta = statusMeta(a.status);
                    const busy = taskRunning && (a.status === "working" || a.status === "meeting" || Boolean(a.collaborating_with));
                    const partner = a.collaborating_with && displayAgents.find((x) => x.id === a.collaborating_with);
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
                {displayAgents.map((a) => (
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

              {/* Live Messages List */}
              <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                <div
                  ref={chatListRef}
                  onScroll={handleChatScroll}
                  className="chat-messages-scroll"
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    overflowAnchor: "none",
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
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

                {unreadCount > 0 && (
                  <button
                    type="button"
                    className="new-messages-pill"
                    onClick={() => scrollToLatestMessages(true)}
                    title="Перейти к новым сообщениям"
                  >
                    <span>Новые сообщения ({unreadCount})</span>
                    <ArrowDown size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <CommandDashboard
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            agents={displayAgents}
            currentDag={currentDag}
            quotas={quotas}
            files={files}
            logs={logs}
            decisions={decisions}
            terminalHistory={terminalHistory}
            browserSessions={browserSessions}
            reconReports={reconReports}
            onRunExtension={runExtension}
            pendingApproval={pendingApproval}
            taskRunning={taskRunning}
            economyMode={economyMode}
            onToggleEconomy={toggleEconomy}
            autoRouting={autoRouting}
            onToggleAutoRouting={() => setAutoRouting((v) => !v)}
            humanControlGates={humanControlGates}
            onUpdateHumanGates={setHumanControlGates}
            providers={providers}
            onSaveKey={saveSingleKey}
            onDeleteKey={deleteKey}
            onUpdateAgentModel={updateAgentModel}
            onStartTask={sendTask}
            onStopTask={stopTask}
            onRetryTask={retryTask}
            onApproveTask={approveTask}
            onSelectAgent={selectAgent}
            onSwitchToOffice={() => setActiveTab("office")}
          />
        )}
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        providers={providers}
        agents={displayAgents}
        onSaveKeys={saveKeys}
        onDeleteKey={deleteKey}
        onUpdateAgentModel={updateAgentModel}
      />
    </div>
  );
}
