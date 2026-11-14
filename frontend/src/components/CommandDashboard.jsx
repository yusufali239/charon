import React, { useState, useMemo } from "react";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RotateCcw,
  Square,
  Shield,
  Search,
  CheckSquare,
  Cpu,
  Key,
  GitBranch,
  Database,
  BarChart3,
  Sliders,
  ExternalLink,
  Trash2,
  Copy,
  Check,
  Download,
  FileCode,
  ArrowRight,
  Eye,
  Zap,
  Play,
  ShieldCheck,
  Workflow,
  Terminal,
  Code2,
  Globe,
} from "lucide-react";

// Default 7 agents meta if not fully populated
const DEFAULT_AGENTS = [
  {
    id: "lead",
    name: "Атлас",
    role: "Тимлид / Стратег",
    specialty: "Оркестрация задач, стратегия, архитектура и финальная сборка",
    color: "#38bdf8",
    provider: "gemini",
    model: "gemini-3-flash-preview",
    fallback_model: "deepseek-ai/DeepSeek-V4.1-Flash",
    status: "idle",
    visual_state: "IDLE",
  },
  {
    id: "cybersec",
    name: "Вектор",
    role: "Пентест и Кибербез",
    specialty: "Аудит уязвимостей, OWASP Top 10, threat modeling, харденинг",
    color: "#f43f5e",
    provider: "openrouter",
    model: "nvidia/nemotron-3-ultra-550b-a55b:free",
    fallback_model: "qwen-3.8-27b",
    status: "idle",
    visual_state: "IDLE",
  },
  {
    id: "dev",
    name: "Нова",
    role: "Код и Автоматизация",
    specialty: "Python/JS скрипты, парсеры, боты, архитектура бэкенда",
    color: "#22c55e",
    provider: "cerebras",
    model: "qwen-3.8-27b",
    fallback_model: "cohere/north-mini-code:free",
    status: "idle",
    visual_state: "IDLE",
  },
  {
    id: "growth",
    name: "Пульс",
    role: "Контент и Продвижение",
    specialty: "Вирусные хуки, воронки продаж, Reels/Shorts сценарии, SEO",
    color: "#f59e0b",
    provider: "groq",
    model: "openai/gpt-oss-120b",
    fallback_model: "glm-5.3-flash",
    status: "idle",
    visual_state: "IDLE",
  },
  {
    id: "motion",
    name: "Шейдер",
    role: "Motion Graphics & Визуал",
    specialty: "Раскадровки, 3D/AE-концепты, Three.js шейдеры, промпты",
    color: "#a855f7",
    provider: "deepseek",
    model: "deepseek-chat",
    fallback_model: "gemini-2.5-flash",
    status: "idle",
    visual_state: "IDLE",
  },
  {
    id: "scout",
    name: "Скаут",
    role: "Research Analyst",
    specialty: "Глубокий веб-поиск, анализ документации, бенчмарки и разведка API",
    color: "#06b6d4",
    provider: "openrouter",
    model: "moonshotai/kimi-k3.1-pro",
    fallback_model: "gemini-3-flash-preview",
    status: "idle",
    visual_state: "IDLE",
  },
  {
    id: "quant",
    name: "Квант",
    role: "QA / Независимый Аудитор",
    specialty: "Независимая верификация кода, стресс-тесты, поиск краевых багов",
    color: "#eab308",
    provider: "openrouter",
    model: "qwen/qwen3-235b-a22b:free",
    fallback_model: "deepseek-reasoner",
    status: "idle",
    visual_state: "IDLE",
  },
];

// Recommended Fleet Models by Category
const FLEET_CATALOG = {
  strategic: [
    { id: "gemini-3-flash-preview", provider: "gemini", context: "1,000,000", speed: "Ультрабыстрый", tier: "Free Tier", fit: "Оркестрация задач и глобальная архитектура" },
    { id: "nvidia/nemotron-3-ultra-550b-a55b:free", provider: "openrouter", context: "131,072", speed: "Глубокий анализ", tier: "100% Free", fit: "Сложное логическое планирование без цензуры" },
    { id: "deepseek-ai/DeepSeek-V4.1-Flash", provider: "siliconflow", context: "65,536", speed: "Высокая", tier: "Free Tier", fit: "Быстрая декомпозиция и формулирование гипотез" },
    { id: "glm-5.3-flash", provider: "zai", context: "128,000", speed: "Высокая", tier: "Free Tier", fit: "Многоязычный синтез и документация" },
  ],
  coding: [
    { id: "qwen-3.8-27b", provider: "cerebras", context: "32,768", speed: "~450 tok/s", tier: "Free Tier", fit: "Молниеносная генерация Python/JS скриптов" },
    { id: "cohere/north-mini-code:free", provider: "openrouter", context: "65,536", speed: "Высокая", tier: "100% Free", fit: "Рефакторинг и парсинг данных" },
    { id: "qwen/qwen3.8-flash-next", provider: "openrouter", context: "128,000", speed: "Ультрабыстрый", tier: "Free Tier", fit: "API-интеграции и асинхронные обработчики" },
    { id: "deepseek-reasoner", provider: "deepseek", context: "64,000", speed: "Рассуждения", tier: "Free Tier", fit: "Алгоритмический аудит и поиск краевых багов" },
  ],
  general: [
    { id: "openai/gpt-oss-120b", provider: "groq", context: "128,000", speed: "~280 tok/s", tier: "Free Tier", fit: "Контент-стратегии, копирайтинг, воронки" },
    { id: "llama-3.3-70b-versatile", provider: "groq", context: "128,000", speed: "~300 tok/s", tier: "Free Tier", fit: "Универсальный анализ и валидация данных" },
    { id: "gemini-2.5-flash", provider: "gemini", context: "1,000,000", speed: "Мгновенный", tier: "Free Tier", fit: "Анализ длинных логов и мультимодальность" },
    { id: "nousresearch/hermes-3-llama-3.1-405b:free", provider: "openrouter", context: "131,072", speed: "Комплексный", tier: "100% Free", fit: "Глубокая аналитика рынка и конкурентов" },
  ],
  advanced: [
    { id: "deepseek-chat", provider: "deepseek", context: "64,000", speed: "Сбалансированный", tier: "Free Tier", fit: "Motion-дизайн, концепты кадра и шейдеры" },
    { id: "qwen/qwen3-235b-a22b:free", provider: "openrouter", context: "131,072", speed: "Аудит", tier: "100% Free", fit: "Независимый QA-гейт и верификация кода" },
    { id: "moonshotai/kimi-k3.1-pro", provider: "openrouter", context: "128,000", speed: "Аналитика", tier: "Free Tier", fit: "Глубокий ресерч документации и API" },
  ],
  additional: [
    { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", provider: "cloudflare", context: "32,768", speed: "Edge Serverless", tier: "0₽ Встроенный", fit: "Резервный автономный фоллбэк на Cloudflare" },
    { id: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", provider: "cloudflare", context: "32,768", speed: "Edge Reasoning", tier: "0₽ Встроенный", fit: "Автономные рассуждения на границе сети" },
    { id: "@cf/qwen/qwen2.5-coder-32b-instruct", provider: "cloudflare", context: "32,768", speed: "Edge Coding", tier: "0₽ Встроенный", fit: "Локальный автономный кодинг" },
  ],
};

// Providers configuration info
const PROVIDERS_META = [
  { id: "gemini", name: "Google Gemini", hint: "aistudio.google.com/apikey", tier: "15 RPM Free, 1M context", url: "https://aistudio.google.com/apikey" },
  { id: "openrouter", name: "OpenRouter", hint: "openrouter.ai/keys", tier: "Бесплатные :free модели + 550B", url: "https://openrouter.ai/keys" },
  { id: "groq", name: "Groq LPU", hint: "console.groq.com/keys", tier: "Быстрый бесплатный тир (GPT-OSS 120B)", url: "https://console.groq.com/keys" },
  { id: "cerebras", name: "Cerebras Cloud", hint: "cloud.cerebras.ai", tier: "Самый быстрый инференс (Qwen 3.8)", url: "https://cloud.cerebras.ai" },
  { id: "siliconflow", name: "SiliconFlow", hint: "cloud.siliconflow.cn", tier: "DeepSeek V4.1 Flash & Qwen 235B", url: "https://cloud.siliconflow.cn" },
  { id: "zai", name: "Z.ai (GLM BigModel)", hint: "z.ai / bigmodel", tier: "GLM-5.3 Flash Free tier", url: "https://z.ai" },
  { id: "deepseek", name: "DeepSeek Official", hint: "platform.deepseek.com", tier: "DeepSeek-V3 / Reasoner (R1)", url: "https://platform.deepseek.com" },
  { id: "cloudflare", name: "Cloudflare Workers AI", hint: "dash.cloudflare.com", tier: "Серверлесс Edge-инференс (10k req/day free)", url: "https://dash.cloudflare.com" },
];

export default function CommandDashboard({
  activeTab,
  setActiveTab,
  agents = [],
  currentDag = null,
  quotas = [],
  files = [],
  logs = [],
  decisions = [],
  terminalHistory = [],
  browserSessions = [],
  reconReports = [],
  onRunExtension,
  pendingApproval = null,
  taskRunning = false,
  economyMode = true,
  onToggleEconomy,
  autoRouting = true,
  onToggleAutoRouting,
  humanControlGates = { highRiskApproval: true, deployApproval: true, qaConsensusGate: true },
  onUpdateHumanGates,
  providers = {},
  onSaveKey,
  onDeleteKey,
  onUpdateAgentModel,
  onStartTask,
  onStopTask,
  onRetryTask,
  onApproveTask,
  onSelectAgent,
  onSwitchToOffice,
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [logFilter, setLogFilter] = useState("ALL");
  const [logAgentFilter, setLogAgentFilter] = useState("all");
  const [logSearch, setLogSearch] = useState("");
  const [copiedFile, setCopiedFile] = useState(false);
  const [newKeyInputs, setNewKeyInputs] = useState({});
  const [showKeyInputs, setShowKeyInputs] = useState({});
  const [taskPrompt, setTaskPrompt] = useState("");
  const [targetAgent, setTargetAgent] = useState("all");
  const [activeWorkflowStep, setActiveWorkflowStep] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);

  // Interactive Extensions State (Cloud Terminal, Headless Browser, Cyber-Recon)
  const [extSubTab, setExtSubTab] = useState("terminal");
  const [termLang, setTermLang] = useState("python");
  const [termAgent, setTermAgent] = useState("dev");
  const [termFilename, setTermFilename] = useState("src/benchmark.py");
  const [termCode, setTermCode] = useState(
    `import sys, platform, hashlib, time\n\nt0 = time.time()\nprint(f"[CHARON CLOUD TERMINAL] Python {platform.python_version()} on {sys.platform}")\nfor name in ["Atlas", "Vector", "Nova", "Pulse", "Shader", "Scout", "Quant"]:\n    sig = hashlib.sha256(name.encode()).hexdigest()[:12]\n    print(f" -> Agent {name:<7} | token_sig={sig} | status=READY")\nprint(f"Done in {(time.time() - t0)*1000:.2f} ms")`
  );
  const [termRunning, setTermRunning] = useState(false);

  const [browserUrl, setBrowserUrl] = useState("https://news.ycombinator.com");
  const [browserAgent, setBrowserAgent] = useState("scout");
  const [browserRunning, setBrowserRunning] = useState(false);

  const [reconTarget, setReconTarget] = useState("charon-office.pages.dev");
  const [reconRunning, setReconRunning] = useState(false);

  const handleRunTerminal = async (customLang, customCode, customFile, customAgent) => {
    if (termRunning) return;
    setTermRunning(true);
    try {
      await onRunExtension?.({
        action: "terminal",
        language: customLang || termLang,
        code: customCode ?? termCode,
        filename: customFile || termFilename,
        agent: customAgent || termAgent,
      });
    } finally {
      setTermRunning(false);
    }
  };

  const handleRunBrowser = async (e) => {
    if (e) e.preventDefault();
    if (browserRunning || !browserUrl.trim()) return;
    setBrowserRunning(true);
    try {
      await onRunExtension?.({
        action: "browser",
        url: browserUrl.trim(),
        agent: browserAgent,
      });
    } finally {
      setBrowserRunning(false);
    }
  };

  const handleRunRecon = async (e) => {
    if (e) e.preventDefault();
    if (reconRunning || !reconTarget.trim()) return;
    setReconRunning(true);
    try {
      await onRunExtension?.({
        action: "recon",
        target: reconTarget.trim(),
        agent: "cybersec",
      });
    } finally {
      setReconRunning(false);
    }
  };

  // Merge provided agents with default agents
  const mergedAgents = useMemo(() => {
    if (!agents || agents.length === 0) return DEFAULT_AGENTS;
    return DEFAULT_AGENTS.map((def) => {
      const found = agents.find((a) => a.id === def.id);
      return found ? { ...def, ...found } : def;
    });
  }, [agents]);

  // Unified DAG structure supporting live backend current_dag
  const activeDag = useMemo(() => {
    if (currentDag && currentDag.nodes && currentDag.nodes.length > 0) {
      return {
        id: currentDag.id || "dag-live",
        title: currentDag.title || currentDag.name || (taskRunning ? "Автономный спринт Charon V2" : "Пайплайн завершён"),
        status: currentDag.status || (taskRunning ? "running" : "idle"),
        progress: typeof currentDag.progress === "number" ? currentDag.progress : (taskRunning ? 65 : 100),
        nodes: currentDag.nodes.map((node) => {
          const agent = mergedAgents.find((a) => a.id === node.agent) || {};
          return {
            id: node.id,
            title: node.title || node.name || node.id,
            agent: node.agent || "lead",
            agentName: node.agentName || node.agent_name || agent.name || "Агент",
            status: node.status || "pending",
            duration: node.duration ? (typeof node.duration === "number" ? `${node.duration}s` : node.duration) : "—",
            model: node.model || agent.model || "default",
            depends_on: node.depends_on || node.dependencies || [],
            output: node.output || node.summary || node.description || "Ожидание выполнения...",
          };
        }),
      };
    }
    return {
      id: "dag-v2-active",
      title: taskRunning ? "Автономный кросс-модельный спринт Charon V2" : "Пайплайн готов к выполнению",
      status: taskRunning ? "running" : "idle",
      progress: taskRunning ? 65 : 100,
      nodes: [
        {
          id: "node_1_plan",
          title: "Стратегия и декомпозиция DAG",
          agent: "lead",
          agentName: "Атлас",
          status: "completed",
          duration: "1.2s",
          model: "gemini-3-flash-preview",
          depends_on: [],
          output: "Сформирован граф из 6 подзадач, определены модели и критерии приёмки.",
        },
        {
          id: "node_2_scout",
          title: "Исследование документации и анализ API",
          agent: "scout",
          agentName: "Скаут",
          status: "completed",
          duration: "2.8s",
          model: "moonshotai/kimi-k3.1-pro",
          depends_on: ["node_1_plan"],
          output: "Собраны спецификации заголовков OWASP и сигнатуры эндпоинтов.",
        },
        {
          id: "node_3_motion",
          title: "Концепт визуала и спецификация сцены",
          agent: "motion",
          agentName: "Шейдер",
          status: "completed",
          duration: "3.4s",
          model: "deepseek-chat",
          depends_on: ["node_1_plan"],
          output: "Подготовлена раскадровка и параметры материалов MeshReflector.",
        },
        {
          id: "node_4_dev",
          title: "Разработка кода и автоматизация логики",
          agent: "dev",
          agentName: "Нова",
          status: taskRunning ? "running" : "completed",
          duration: taskRunning ? "4.1s (в процессе)" : "4.1s",
          model: "qwen-3.8-27b",
          depends_on: ["node_2_scout", "node_3_motion"],
          output: "Реализован скрипт проверки безопасности и асинхронные воркеры.",
        },
        {
          id: "node_5_sec",
          title: "Пентест-аудит и OWASP проверка",
          agent: "cybersec",
          agentName: "Вектор",
          status: taskRunning ? "pending" : "completed",
          duration: "—",
          model: "nvidia/nemotron-3-ultra-550b-a55b:free",
          depends_on: ["node_4_dev"],
          output: "Проверка заголовков CSP, CORS, X-Frame-Options и прав доступа.",
        },
        {
          id: "node_6_qa",
          title: "Независимый QA-аудит и стресс-тест",
          agent: "quant",
          agentName: "Квант",
          status: taskRunning ? "pending" : "completed",
          duration: "—",
          model: "qwen/qwen3-235b-a22b:free",
          depends_on: ["node_5_sec"],
          output: "Верификация граничных условий и кросс-модельный вердикт.",
        },
        {
          id: "node_7_approval",
          title: "Финальная интеграция и согласование",
          agent: "lead",
          agentName: "Атлас",
          status: taskRunning ? "waiting_approval" : "completed",
          duration: "—",
          model: "gemini-3-flash-preview",
          depends_on: ["node_6_qa"],
          output: "Сборка финального отчёта и выпуск артефактов в хранилище.",
        },
      ],
    };
  }, [currentDag, taskRunning, mergedAgents]);

  // Unified files array supporting both `filename` and `name`
  const activeFiles = useMemo(() => {
    if (files && files.length > 0) {
      return files.map((f, i) => {
        const fname = f.filename || f.name || `artifact_${i + 1}.txt`;
        const fsize = typeof f.size === "number" ? `${(f.size / 1024).toFixed(1)} KB` : (f.size || "2.1 KB");
        return {
          id: f.id || fname,
          name: fname,
          filename: fname,
          path: f.path || `/workspace/${fname}`,
          size: fsize,
          language: f.language || "python",
          updated_at: f.updated_at || "Недавно",
          content: f.content || "",
        };
      });
    }
    return [
      {
        name: "security_audit.py",
        filename: "security_audit.py",
        path: "/workspace/scripts/security_audit.py",
        size: "3.4 KB",
        language: "python",
        updated_at: "Только что",
        content: `#!/usr/bin/env python3
"""
Charon V2 - Autonomous Security & OWASP Header Verifier
Generated by: Vector (Cybersec) & Nova (Dev)
QA Verified by: Quant (QA Auditor)
"""
import sys
import urllib.request
import json

REQUIRED_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": ["DENY", "SAMEORIGIN"],
    "Content-Security-Policy": "default-src 'self'",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Referrer-Policy": "strict-origin-when-cross-origin"
}

def audit_target(url: str):
    print(f"[+] Auditing headers for: {url}")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "CharonV2-SecAudit"})
        with urllib.request.urlopen(req, timeout=10) as response:
            headers = dict(response.headers)
            passed = 0
            for h, expected in REQUIRED_HEADERS.items():
                val = headers.get(h)
                if val:
                    print(f"  [✓] {h}: {val}")
                    passed += 1
                else:
                    print(f"  [!] MISSING: {h}")
            score = (passed / len(REQUIRED_HEADERS)) * 100
            print(f"[+] Security Header Compliance Score: {score:.1f}%")
            return {"status": "SUCCESS", "score": score}
    except Exception as e:
        print(f"[-] Audit error: {e}")
        return {"status": "ERROR", "error": str(e)}

if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "https://charon-office.pages.dev"
    audit_target(url)
`,
      },
      {
        name: "dag_pipeline.json",
        filename: "dag_pipeline.json",
        path: "/workspace/config/dag_pipeline.json",
        size: "2.1 KB",
        language: "json",
        updated_at: "5 минут назад",
        content: JSON.stringify(
          {
            version: "2.0.0",
            engine: "Charon Autonomous Fleet",
            cross_model_verification: true,
            qa_gate_threshold: 0.95,
            steps: [
              { id: "plan", agent: "lead", model: "gemini-3-flash-preview" },
              { id: "research", agent: "scout", model: "kimi-k3.1-pro" },
              { id: "motion", agent: "motion", model: "deepseek-chat" },
              { id: "implementation", agent: "dev", model: "qwen-3.8-27b" },
              { id: "security", agent: "cybersec", model: "nemotron-550b" },
              { id: "audit", agent: "quant", model: "qwen3-235b" },
            ],
          },
          null,
          2
        ),
      },
      {
        name: "reels_viral_matrix.md",
        filename: "reels_viral_matrix.md",
        path: "/workspace/content/reels_viral_matrix.md",
        size: "1.8 KB",
        language: "markdown",
        updated_at: "10 минут назад",
        content: `# Вирусная матрица продвижения AI-офиса (7 Дней)
Автор: Пульс (Контент & Продвижение)

## Хук 1: «В этой 3D комнате сидят 7 нейросетей, и они работают без меня»
- **Формат**: Демонстрация экрана с приближением к столу Новы и Шейдера.
- **Длина**: 14 секунд.
- **Музыка**: Тёмный синтвейв / киберпанк бас.
- **CTA**: «Ссылка в профиле на свободный демо-сервер».

## Хук 2: «Как 550-миллиардная модель нашла дыру в коде за 2 секунды»
- **Формат**: Сравнение логов Вектора (Nemotron Ultra) и вердикта Кванта (QA Gate).
`,
      },
    ];
  }, [files]);

  // Unified logs list
  const activeLogs = useMemo(() => {
    if (logs && logs.length > 0) {
      return logs.map((l, i) => ({
        id: l.id || `log-${i}`,
        ts: l.ts || l.timestamp || new Date().toLocaleTimeString(),
        level: l.level || "INFO",
        agent: l.agent || l.agent_id || "lead",
        message: l.message || l.text || "",
        tool: l.tool || l.tool_name || null,
        args: typeof l.args === "object" ? JSON.stringify(l.args) : l.args,
        duration_ms: l.duration_ms || l.duration,
        result: l.result || null,
      }));
    }
    return [
      { id: "log-1", ts: "04:18:02", level: "INFO", agent: "lead", message: "DAG Orchestrator: task initialized. Decomposition ready." },
      { id: "log-2", ts: "04:18:04", level: "INFO", agent: "scout", message: "Scout: fetching documentation and OWASP compliance guidelines." },
      { id: "log-3", ts: "04:18:06", level: "TOOL", agent: "scout", tool: "web_search", args: '{"query":"OWASP top 10 2026 headers checklist"}', duration_ms: 180, result: "200 OK (8 sources)" },
      { id: "log-4", ts: "04:18:09", level: "INFO", agent: "motion", message: "Shader: generating 3D storyboard layout & lighting specs." },
      { id: "log-5", ts: "04:18:12", level: "INFO", agent: "dev", message: "Nova: writing security_audit.py and asynchronous testing harness." },
      { id: "log-6", ts: "04:18:15", level: "TOOL", agent: "dev", tool: "write_file", args: '{"path":"/workspace/scripts/security_audit.py"}', duration_ms: 45, result: "SUCCESS" },
      { id: "log-7", ts: "04:18:18", level: "INFO", agent: "cybersec", message: "Vector: initiating AST static code analysis for command injection." },
      { id: "log-8", ts: "04:18:21", level: "INFO", agent: "quant", message: "Quant: independent QA gate engaged. Zero bias verification running." },
    ];
  }, [logs]);

  // Unified decisions list
  const activeDecisions = useMemo(() => {
    if (decisions && decisions.length > 0) {
      return decisions.map((d, i) => ({
        id: d.id || `dec-${i}`,
        ts: d.ts || d.timestamp || "Только что",
        agent: d.agent || "lead",
        agentName: d.agentName || d.agent_name || (mergedAgents.find((a) => a.id === d.agent)?.name || "Атлас"),
        title: d.title || d.topic || "Решение",
        verdict: d.verdict || d.decision || "Утверждено",
        rationale: d.rationale || d.details || d.reason || "",
        consensus: d.consensus || "Verified",
      }));
    }
    return [
      {
        id: "dec-1",
        ts: "04:17:50",
        agent: "lead",
        agentName: "Атлас",
        title: "Архитектура декомпозиции задач V2",
        verdict: "Утверждено",
        rationale: "Разделение потоков: Scout и Shader стартуют параллельно, экономя 42% времени выполнения задачи.",
        consensus: "7/7 единогласно",
      },
      {
        id: "dec-2",
        ts: "04:18:10",
        agent: "quant",
        agentName: "Квант",
        title: "Критерий независимого QA-гейта",
        verdict: "Блокирующий гейт установлен",
        rationale: "Ни один исполняемый скрипт не передаётся пользователю без перекрёстной проверки Вектором (Sec) и Квантом (QA).",
        consensus: "Cross-Model Verified",
      },
      {
        id: "dec-3",
        ts: "04:18:22",
        agent: "cybersec",
        agentName: "Вектор",
        title: "Политика удаления устаревших API-ключей",
        verdict: "Реализовано DELETE /api/settings/key/:provider",
        rationale: "Обеспечение безопасного жизненного цикла ключей и предотвращение утечек.",
        consensus: "OWASP Hardened",
      },
    ];
  }, [decisions, mergedAgents]);

  // Unified quotas list supporting dictionary or array from backend
  const activeQuotas = useMemo(() => {
    let rawList = [];
    if (Array.isArray(quotas) && quotas.length > 0) {
      rawList = quotas;
    } else if (quotas && typeof quotas === "object" && Object.keys(quotas).length > 0) {
      rawList = Object.values(quotas);
    }
    if (rawList.length > 0) {
      return rawList.map((b) => ({
        provider: b.provider || "UNKNOWN",
        model: b.model || "UNKNOWN",
        status: b.status || (b.quota_remaining ? b.quota_remaining : "Active"),
        requests: String(b.requests ?? 0),
        tokens: typeof b.tokens === "number" ? b.tokens.toLocaleString() : String(b.tokens ?? 0),
        rpm: String(b.rpm ?? "UNKNOWN"),
        tpm: String(b.tpm ?? "UNKNOWN"),
        rpd: String(b.rpd ?? "UNKNOWN"),
        cost: typeof b.cost === "number" ? `$${b.cost.toFixed(2)}` : String(b.cost ?? "$0.00 (Free)"),
        last_error: b.last_error || "None",
        reset_time: b.reset_time || "UNKNOWN where not reported",
        quota_remaining: b.quota_remaining || b.status || "UNKNOWN where not reported",
      }));
    }
    return [
      {
        provider: "Google Gemini",
        model: "gemini-3-flash-preview",
        status: "Argon 96% protected",
        requests: "412",
        tokens: "842,100",
        rpm: "15 / 15",
        tpm: "1,000,000",
        rpd: "1,500",
        cost: "$0.00 (Free)",
        last_error: "None",
        reset_time: "00:00 UTC",
        quota_remaining: "Argon 96% protected",
      },
      {
        provider: "OpenRouter",
        model: "nemotron-3-ultra-550b:free",
        status: "Active (Free Tier)",
        requests: "189",
        tokens: "410,500",
        rpm: "20 / 20",
        tpm: "200,000",
        rpd: "Неограниченно",
        cost: "$0.00 (Free)",
        last_error: "None",
        reset_time: "UNKNOWN where not reported",
        quota_remaining: "100% Free Quota",
      },
      {
        provider: "Groq",
        model: "openai/gpt-oss-120b",
        status: "Active (Ultra-Fast)",
        requests: "294",
        tokens: "312,000",
        rpm: "30 / 30",
        tpm: "150,000",
        rpd: "14,400",
        cost: "$0.00 (Free)",
        last_error: "None",
        reset_time: "60s rolling",
        quota_remaining: "98% доступно",
      },
      {
        provider: "Cerebras",
        model: "qwen-3.8-27b",
        status: "Active (~450 tok/s)",
        requests: "530",
        tokens: "690,400",
        rpm: "30 / 30",
        tpm: "60,000",
        rpd: "1,000,000",
        cost: "$0.00 (Free)",
        last_error: "None",
        reset_time: "00:00 UTC",
        quota_remaining: "94% доступно",
      },
      {
        provider: "SiliconFlow",
        model: "DeepSeek-V4.1-Flash",
        status: "Active",
        requests: "125",
        tokens: "185,000",
        rpm: "UNKNOWN",
        tpm: "UNKNOWN",
        rpd: "UNKNOWN",
        cost: "$0.00 (Free)",
        last_error: "None",
        reset_time: "UNKNOWN where not reported",
        quota_remaining: "Free Tier Active",
      },
      {
        provider: "Z.ai (GLM)",
        model: "glm-5.3-flash",
        status: "Active",
        requests: "88",
        tokens: "95,000",
        rpm: "UNKNOWN",
        tpm: "UNKNOWN",
        rpd: "UNKNOWN",
        cost: "$0.00 (Free)",
        last_error: "None",
        reset_time: "UNKNOWN where not reported",
        quota_remaining: "Free Tier Active",
      },
      {
        provider: "DeepSeek",
        model: "deepseek-chat",
        status: "Active",
        requests: "162",
        tokens: "210,000",
        rpm: "60 / 60",
        tpm: "UNKNOWN",
        rpd: "UNKNOWN",
        cost: "$0.00",
        last_error: "None",
        reset_time: "UNKNOWN where not reported",
        quota_remaining: "Healthy",
      },
      {
        provider: "Cloudflare Workers AI",
        model: "@cf/meta/llama-3.3-70b-instruct",
        status: "Opus 0% blocked until reset",
        requests: "10,000",
        tokens: "1,200,000",
        rpm: "1,200",
        tpm: "UNKNOWN",
        rpd: "10,000 Free",
        cost: "$0.00 (Free)",
        last_error: "RateLimit 429",
        reset_time: "00:00 UTC (14h 22m)",
        quota_remaining: "Opus 0% blocked until reset",
      },
    ];
  }, [quotas]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return activeLogs.filter((l) => {
      if (logFilter !== "ALL" && l.level !== logFilter) return false;
      if (logAgentFilter !== "all" && l.agent !== logAgentFilter) return false;
      if (logSearch) {
        const q = logSearch.toLowerCase();
        return (
          l.message?.toLowerCase().includes(q) ||
          l.tool?.toLowerCase().includes(q) ||
          l.agent?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [activeLogs, logFilter, logAgentFilter, logSearch]);

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedFile(true);
    setTimeout(() => setCopiedFile(false), 1500);
  };

  const handleDownloadFile = (file) => {
    const blob = new Blob([file.content || ""], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSaveKeySubmit = (providerId) => {
    const val = newKeyInputs[providerId]?.trim();
    if (!val) return;
    onSaveKey?.(providerId, val);
    setNewKeyInputs((prev) => ({ ...prev, [providerId]: "" }));
    setShowKeyInputs((prev) => ({ ...prev, [providerId]: false }));
  };

  const currentViewingFile = selectedFile || activeFiles[0];

  return (
    <div className="v2-dashboard-container">
      {/* Top Banner if Pending Approval is Present across any view */}
      {pendingApproval && (
        <div className="v2-approval-alert-banner">
          <div className="v2-approval-left">
            <div className="v2-approval-badge">
              <AlertTriangle size={16} />
              <span>ТРЕБУЕТСЯ ОДОБРЕНИЕ ЧЕЛОВЕКА</span>
            </div>
            <div className="v2-approval-info">
              <div className="v2-approval-title">{pendingApproval.task || "Критическая операция в пайплайне"}</div>
              <div className="v2-approval-desc">
                {pendingApproval.description ||
                  "Агент запрашивает подтверждение на выполнение действий повышенного риска (выполнение команд, изменение файлов или деплой)."}
              </div>
            </div>
          </div>
          <div className="v2-approval-actions">
            <button
              className="v2-btn-approve"
              onClick={() => onApproveTask?.(pendingApproval.id, true)}
            >
              <CheckCircle2 size={15} />
              Одобрить
            </button>
            <button
              className="v2-btn-reject"
              onClick={() => onApproveTask?.(pendingApproval.id, false)}
            >
              <Square size={14} />
              Отклонить
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area Based on activeTab */}
      <div className="v2-dashboard-scrollable">
        {/* ---------------- 1. OVERVIEW ---------------- */}
        {activeTab === "overview" && (
          <div className="v2-section-fade">
            {/* Header / Hero */}
            <div className="v2-hero-header">
              <div>
                <div className="v2-hero-pill">
                  <Activity size={13} color="#38bdf8" />
                  <span>CHARON V2 // AUTONOMOUS AI FLEET</span>
                </div>
                <h1 className="v2-hero-title">Центр Управления Командой Агентов</h1>
                <p className="v2-hero-sub">
                  7 автономных специалистов · Кросс-модельная валидация · Нулевые затраты на квоты
                </p>
              </div>
              <div className="v2-hero-actions">
                <button className="v2-btn-primary" onClick={onSwitchToOffice}>
                  <Eye size={15} />
                  Открыть 3D Офис
                </button>
                <button
                  className={`v2-btn-mode ${economyMode ? "active" : ""}`}
                  onClick={onToggleEconomy}
                >
                  <Zap size={15} />
                  Эконом-режим: {economyMode ? "ВКЛ (0₽)" : "ВЫКЛ"}
                </button>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="v2-metrics-grid">
              <div className="v2-metric-card">
                <div className="v2-metric-header">
                  <span className="v2-metric-label">Штат специалистов</span>
                  <Activity size={16} color="#38bdf8" />
                </div>
                <div className="v2-metric-val">7 / 7</div>
                <div className="v2-metric-sub green">Все агенты в строю</div>
              </div>
              <div className="v2-metric-card">
                <div className="v2-metric-header">
                  <span className="v2-metric-label">Активный DAG Задач</span>
                  <Workflow size={16} color="#a855f7" />
                </div>
                <div className="v2-metric-val">{taskRunning ? "В работе" : "Готов"}</div>
                <div className="v2-metric-sub">{activeDag.nodes.length} узлов в цепочке</div>
              </div>
              <div className="v2-metric-card">
                <div className="v2-metric-header">
                  <span className="v2-metric-label">Стоимость инференса</span>
                  <ShieldCheck size={16} color="#22c55e" />
                </div>
                <div className="v2-metric-val">$0.00</div>
                <div className="v2-metric-sub green">Бесплатный флот без лимитов</div>
              </div>
              <div className="v2-metric-card">
                <div className="v2-metric-header">
                  <span className="v2-metric-label">QA-Верификация</span>
                  <CheckSquare size={16} color="#eab308" />
                </div>
                <div className="v2-metric-val">100%</div>
                <div className="v2-metric-sub">Независимый аудит Кванта</div>
              </div>
            </div>

            {/* Active DAG Progress Banner */}
            <div className="v2-card v2-dag-summary-card">
              <div className="v2-card-title-row">
                <div className="v2-card-title">
                  <Workflow size={18} color="#38bdf8" />
                  <span>Текущий DAG: {activeDag.title}</span>
                </div>
                <div className="v2-card-actions">
                  {taskRunning && (
                    <button className="v2-btn-danger-small" onClick={onStopTask}>
                      <Square size={12} /> Стоп
                    </button>
                  )}
                  <button className="v2-btn-secondary-small" onClick={() => onRetryTask?.("latest")}>
                    <RotateCcw size={12} /> Перезапуск
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="v2-progress-wrapper">
                <div className="v2-progress-bar">
                  <div
                    className="v2-progress-fill"
                    style={{ width: `${activeDag.progress}%` }}
                  />
                </div>
                <div className="v2-progress-meta">
                  <span>Прогресс выполнения: {activeDag.progress}%</span>
                  <span>{taskRunning ? "В процессе выполнения..." : "Пайплайн завершён успешно"}</span>
                </div>
              </div>

              {/* Node Chips */}
              <div className="v2-dag-chips">
                {activeDag.nodes.map((node) => {
                  const isDone = node.status === "completed";
                  const isRunning = node.status === "running";
                  return (
                    <div
                      key={node.id}
                      className={`v2-dag-chip ${isDone ? "done" : ""} ${isRunning ? "running" : ""}`}
                    >
                      <span className="v2-chip-dot" />
                      <span className="v2-chip-name">{node.agentName}</span>
                      <span className="v2-chip-title">{node.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 7 Agents Cards Grid */}
            <div className="v2-section-head">
              <h2 className="v2-section-title">Специалисты Офиса Charon V2 (7 Агентов)</h2>
              <span className="v2-section-sub">Нажмите для фокуса в 3D или настройки моделей</span>
            </div>

            <div className="v2-agents-grid">
              {mergedAgents.map((agent) => {
                return (
                  <div
                    key={agent.id}
                    className="v2-agent-card"
                    style={{ "--agent-accent": agent.color }}
                  >
                    <div className="v2-agent-card-top">
                      <div className="v2-agent-avatar" style={{ background: agent.color }}>
                        {agent.name.slice(0, 1)}
                      </div>
                      <div className="v2-agent-info">
                        <div className="v2-agent-name">{agent.name}</div>
                        <div className="v2-agent-role">{agent.role}</div>
                      </div>
                      <div className={`v2-visual-badge ${agent.visual_state?.toLowerCase() || "idle"}`}>
                        {agent.visual_state || "IDLE"}
                      </div>
                    </div>

                    <div className="v2-agent-desc">{agent.specialty}</div>

                    <div className="v2-agent-models-box">
                      <div className="v2-agent-model-row">
                        <span className="v2-model-tag">Основная:</span>
                        <span className="v2-model-name" title={agent.model}>
                          {agent.model}
                        </span>
                      </div>
                      {agent.fallback_model && (
                        <div className="v2-agent-model-row">
                          <span className="v2-model-tag">Резерв:</span>
                          <span className="v2-model-name muted" title={agent.fallback_model}>
                            {agent.fallback_model}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="v2-agent-actions">
                      <button
                        className="v2-btn-focus"
                        onClick={() => {
                          onSelectAgent?.(agent.id);
                          onSwitchToOffice?.();
                        }}
                      >
                        <Eye size={13} />
                        В 3D Офис
                      </button>
                      <button
                        className="v2-btn-tune"
                        onClick={() => setActiveTab("agents")}
                      >
                        <Sliders size={13} />
                        Настроить
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Task Launcher */}
            <div className="v2-card v2-quick-launch-card">
              <div className="v2-card-title">
                <Play size={18} color="#22c55e" />
                <span>Быстрый запуск задачи для всей команды</span>
              </div>
              <form
                className="v2-launch-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (taskPrompt.trim() && !taskRunning) {
                    onStartTask?.(taskPrompt, targetAgent);
                    setTaskPrompt("");
                  }
                }}
              >
                <select
                  value={targetAgent}
                  onChange={(e) => setTargetAgent(e.target.value)}
                  className="v2-launch-select"
                >
                  <option value="all">Вся команда (7 агентов)</option>
                  {mergedAgents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} — {a.role.split("/")[0]}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Опишите задачу (пентест, код, вирусный контент, раскадровка, QA аудит)..."
                  value={taskPrompt}
                  onChange={(e) => setTaskPrompt(e.target.value)}
                  className="v2-launch-input"
                  disabled={taskRunning}
                />
                <button
                  type="submit"
                  disabled={taskRunning || !taskPrompt.trim()}
                  className="v2-btn-launch"
                >
                  <Play size={14} />
                  Запуск DAG
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ---------------- 2. 3D OFFICE PROMPT ---------------- */}
        {activeTab === "office" && (
          <div className="v2-section-fade v2-office-return-banner">
            <div className="v2-office-return-content">
              <Eye size={42} color="#38bdf8" />
              <h2>Интерактивный 3D Офис Charon</h2>
              <p>
                Полноэкранная 3D студия активна в фоне. Вы можете свободно переключаться между
                интерактивным 3D миром и панелями управления.
              </p>
              <button className="v2-btn-primary large" onClick={onSwitchToOffice}>
                <Eye size={18} />
                Перейти в 3D Пространство
              </button>
            </div>
          </div>
        )}

        {/* ---------------- 3. TASKS & DAG ---------------- */}
        {activeTab === "tasks" && (
          <div className="v2-section-fade">
            <div className="v2-section-header-row">
              <div>
                <h1 className="v2-page-title">DAG Задач и Контроль Выполнения</h1>
                <p className="v2-page-sub">
                  Дерево зависимостей, статусы узлов, перезапуск шагов и точки согласования
                </p>
              </div>
              <div className="v2-header-actions">
                {taskRunning && (
                  <button className="v2-btn-danger" onClick={onStopTask}>
                    <Square size={14} />
                    Остановить задачу
                  </button>
                )}
                <button className="v2-btn-secondary" onClick={() => onRetryTask?.("all")}>
                  <RotateCcw size={14} />
                  Перезапустить DAG
                </button>
              </div>
            </div>

            {/* Live DAG Tree View */}
            <div className="v2-dag-tree-container">
              {activeDag.nodes.map((node, index) => {
                const isDone = node.status === "completed";
                const isRunning = node.status === "running";
                const isWaiting = node.status === "waiting_approval";
                const agent = mergedAgents.find((a) => a.id === node.agent) || {};

                return (
                  <div key={node.id} className="v2-dag-node-wrapper">
                    <div
                      className={`v2-dag-node-card ${isDone ? "completed" : ""} ${isRunning ? "running" : ""} ${isWaiting ? "waiting" : ""}`}
                      style={{ "--node-color": agent.color || "#38bdf8" }}
                    >
                      <div className="v2-dag-node-head">
                        <div className="v2-dag-node-agent">
                          <span
                            className="v2-agent-mini-dot"
                            style={{ background: agent.color || "#38bdf8" }}
                          />
                          <span className="v2-node-agent-name">{node.agentName}</span>
                          <span className="v2-node-role">({agent.role?.split("/")[0]})</span>
                        </div>
                        <div className="v2-dag-node-status-badge">
                          {isDone && <CheckCircle2 size={13} color="#22c55e" />}
                          {isRunning && <span className="v2-pulse-ring" />}
                          {isWaiting && <AlertTriangle size={13} color="#f59e0b" />}
                          <span>
                            {isDone
                              ? "Завершено"
                              : isRunning
                              ? "Выполняется"
                              : isWaiting
                              ? "Ожидает согласования"
                              : "В очереди"}
                          </span>
                        </div>
                      </div>

                      <div className="v2-dag-node-title">{node.title}</div>
                      <div className="v2-dag-node-output">{node.output}</div>

                      <div className="v2-dag-node-footer">
                        <div className="v2-node-meta">
                          <span className="v2-meta-item">
                            <Clock size={12} /> {node.duration}
                          </span>
                          <span className="v2-meta-item">
                            <Cpu size={12} /> {node.model}
                          </span>
                        </div>
                        <div className="v2-node-controls">
                          <button
                            className="v2-btn-node-retry"
                            onClick={() => onRetryTask?.(node.id)}
                            title="Перезапустить данный узел"
                          >
                            <RotateCcw size={12} /> Перезапуск
                          </button>
                        </div>
                      </div>

                      {node.depends_on && node.depends_on.length > 0 && (
                        <div className="v2-node-deps">
                          <GitBranch size={11} color="#64748b" />
                          <span>Зависит от: {node.depends_on.join(", ")}</span>
                        </div>
                      )}
                    </div>

                    {index < activeDag.nodes.length - 1 && (
                      <div className="v2-dag-connector">
                        <div className="v2-connector-line" />
                        <div className="v2-connector-arrow">↓</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ---------------- 4. AGENTS ---------------- */}
        {activeTab === "agents" && (
          <div className="v2-section-fade">
            <div className="v2-section-header-row">
              <div>
                <h1 className="v2-page-title">Специалисты Офиса (7 Автономных Агентов)</h1>
                <p className="v2-page-sub">
                  Роли, специализации, live visual_state, основные и резервные модели
                </p>
              </div>
            </div>

            <div className="v2-agents-detailed-list">
              {mergedAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="v2-agent-detail-card"
                  style={{ "--agent-accent": agent.color }}
                >
                  <div className="v2-agent-detail-left">
                    <div className="v2-agent-detail-avatar" style={{ background: agent.color }}>
                      {agent.name.slice(0, 1)}
                    </div>
                    <div className="v2-agent-detail-meta">
                      <div className="v2-detail-name-row">
                        <span className="v2-detail-name">{agent.name}</span>
                        <span className="v2-detail-role">{agent.role}</span>
                        <span className={`v2-visual-badge ${agent.visual_state?.toLowerCase() || "idle"}`}>
                          {agent.visual_state || "IDLE"}
                        </span>
                      </div>
                      <div className="v2-detail-specialty">{agent.specialty}</div>
                    </div>
                  </div>

                  <div className="v2-agent-detail-right">
                    <div className="v2-model-selector-group">
                      <label className="v2-label">Назначенная модель:</label>
                      <div className="v2-selector-row">
                        <select
                          className="v2-select-provider"
                          value={agent.provider}
                          onChange={(e) =>
                            onUpdateAgentModel?.(
                              agent.id,
                              e.target.value,
                              FLEET_CATALOG.strategic[0]?.id || agent.model
                            )
                          }
                        >
                          <option value="gemini">Google Gemini</option>
                          <option value="openrouter">OpenRouter</option>
                          <option value="groq">Groq</option>
                          <option value="cerebras">Cerebras</option>
                          <option value="siliconflow">SiliconFlow</option>
                          <option value="zai">Z.ai</option>
                          <option value="deepseek">DeepSeek</option>
                          <option value="cloudflare">Cloudflare Workers AI</option>
                        </select>
                        <input
                          type="text"
                          className="v2-input-model"
                          value={agent.model}
                          onChange={(e) =>
                            onUpdateAgentModel?.(agent.id, agent.provider, e.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div className="v2-detail-buttons">
                      <button
                        className="v2-btn-focus"
                        onClick={() => {
                          onSelectAgent?.(agent.id);
                          onSwitchToOffice?.();
                        }}
                      >
                        <Eye size={13} />
                        Показать в 3D
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---------------- 5. MODELS FLEET ---------------- */}
        {activeTab === "models" && (
          <div className="v2-section-fade">
            <div className="v2-section-header-row">
              <div>
                <h1 className="v2-page-title">Каталог Моделей Fleet (100% Free / Zero-Cost)</h1>
                <p className="v2-page-sub">
                  Стратегические, кодовые, универсальные и аналитические модели без затрат на токены
                </p>
              </div>
            </div>

            {Object.entries(FLEET_CATALOG).map(([catKey, modelsList]) => {
              const catNames = {
                strategic: "Стратегические и Координационные Модели",
                coding: "Код, Автоматизация и Рефакторинг",
                general: "Универсальные & Высокоскоростные LPU Модели",
                advanced: "Аналитические рассуждения & QA-Аудит",
                additional: "Резервные Serverless Edge Модели (Cloudflare)",
              };

              return (
                <div key={catKey} className="v2-models-category-box">
                  <h3 className="v2-cat-title">{catNames[catKey] || catKey}</h3>
                  <div className="v2-models-table-wrap">
                    <table className="v2-table">
                      <thead>
                        <tr>
                          <th>Модель / Идентификатор</th>
                          <th>Провайдер</th>
                          <th>Контекст</th>
                          <th>Скорость</th>
                          <th>Тариф</th>
                          <th>Специализация и применение</th>
                          <th>Назначение</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modelsList.map((m) => (
                          <tr key={m.id}>
                            <td className="v2-model-id-cell">
                              <code>{m.id}</code>
                            </td>
                            <td>
                              <span className="v2-provider-badge">{m.provider}</span>
                            </td>
                            <td>{m.context} tok</td>
                            <td>{m.speed}</td>
                            <td>
                              <span className="v2-free-tag">{m.tier}</span>
                            </td>
                            <td className="v2-fit-cell">{m.fit}</td>
                            <td>
                              <select
                                className="v2-assign-select"
                                defaultValue=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    onUpdateAgentModel?.(e.target.value, m.provider, m.id);
                                    e.target.value = "";
                                  }
                                }}
                              >
                                <option value="" disabled>
                                  Назначить...
                                </option>
                                {mergedAgents.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.name} ({a.role.split("/")[0]})
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ---------------- 6. PROVIDERS ---------------- */}
        {activeTab === "providers" && (
          <div className="v2-section-fade">
            <div className="v2-section-header-row">
              <div>
                <h1 className="v2-page-title">Провайдеры и Ключи API</h1>
                <p className="v2-page-sub">
                  Подключение бесплатных тиров, управление ключами и безопасное удаление
                </p>
              </div>
            </div>

            <div className="v2-providers-grid">
              {PROVIDERS_META.map((prov) => {
                const isConnected = Boolean(providers[prov.id]);
                const isEnteringKey = showKeyInputs[prov.id];

                return (
                  <div key={prov.id} className="v2-provider-card">
                    <div className="v2-provider-card-head">
                      <div>
                        <div className="v2-provider-name">{prov.name}</div>
                        <div className="v2-provider-tier">{prov.tier}</div>
                      </div>
                      <span className={`v2-status-pill ${isConnected ? "connected" : "idle"}`}>
                        {isConnected ? "Подключён" : "Не настроен"}
                      </span>
                    </div>

                    <div className="v2-provider-portal">
                      <a href={prov.url} target="_blank" rel="noreferrer" className="v2-portal-link">
                        <span>Получить бесплатный ключ: {prov.hint}</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>

                    <div className="v2-provider-card-bottom">
                      {isEnteringKey ? (
                        <div className="v2-key-input-box">
                          <input
                            type="password"
                            placeholder="Вставьте бесплатный API-ключ..."
                            value={newKeyInputs[prov.id] || ""}
                            onChange={(e) =>
                              setNewKeyInputs({ ...newKeyInputs, [prov.id]: e.target.value })
                            }
                            className="v2-input-key"
                          />
                          <div className="v2-key-btn-row">
                            <button
                              className="v2-btn-save-key"
                              onClick={() => handleSaveKeySubmit(prov.id)}
                            >
                              Сохранить
                            </button>
                            <button
                              className="v2-btn-cancel-key"
                              onClick={() =>
                                setShowKeyInputs({ ...showKeyInputs, [prov.id]: false })
                              }
                            >
                              Отмена
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="v2-provider-actions-row">
                          <button
                            className="v2-btn-add-key"
                            onClick={() =>
                              setShowKeyInputs({ ...showKeyInputs, [prov.id]: true })
                            }
                          >
                            <Key size={13} />
                            {isConnected ? "Заменить ключ" : "Добавить ключ"}
                          </button>
                          {isConnected && (
                            <button
                              className="v2-btn-delete-key"
                              onClick={() => onDeleteKey?.(prov.id)}
                              title="Удалить ключ из хранилища"
                            >
                              <Trash2 size={13} />
                              Удалить
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ---------------- 7. WORKFLOW ---------------- */}
        {activeTab === "workflow" && (
          <div className="v2-section-fade">
            <div className="v2-section-header-row">
              <div>
                <h1 className="v2-page-title">Кросс-Модельный Пайплайн Charon V2</h1>
                <p className="v2-page-sub">
                  Архитектура автономного потока: Atlas Plan → Scout/Shader Parallel → Nova Code →
                  Vector Security → Quant Independent QA Gate → Revision → Final Approval
                </p>
              </div>
            </div>

            <div className="v2-workflow-diagram-container">
              {/* Step 1 */}
              <div
                className={`v2-wf-step ${activeWorkflowStep === 1 ? "active" : ""}`}
                onClick={() => setActiveWorkflowStep(1)}
              >
                <div className="v2-wf-num">1</div>
                <div className="v2-wf-content">
                  <div className="v2-wf-agent" style={{ color: "#38bdf8" }}>
                    Атлас (Lead / Strategist)
                  </div>
                  <div className="v2-wf-title">Декомпозиция и Формирование DAG</div>
                  <div className="v2-wf-desc">
                    Анализирует промпт пользователя, разбивает цель на подзадачи, назначает
                    оптимальные бесплатные модели и зависимости.
                  </div>
                </div>
              </div>

              <div className="v2-wf-arrow">
                <ArrowRight size={20} color="#38bdf8" />
                <span>Параллельный запуск</span>
              </div>

              {/* Step 2 Parallel */}
              <div className="v2-wf-parallel-group">
                <div
                  className={`v2-wf-step ${activeWorkflowStep === 2 ? "active" : ""}`}
                  onClick={() => setActiveWorkflowStep(2)}
                >
                  <div className="v2-wf-num">2A</div>
                  <div className="v2-wf-content">
                    <div className="v2-wf-agent" style={{ color: "#06b6d4" }}>
                      Скаут (Research Analyst)
                    </div>
                    <div className="v2-wf-title">Поиск документации & API</div>
                    <div className="v2-wf-desc">
                      Веб-поиск, анализ актуальных библиотек и стандартов.
                    </div>
                  </div>
                </div>

                <div
                  className={`v2-wf-step ${activeWorkflowStep === 3 ? "active" : ""}`}
                  onClick={() => setActiveWorkflowStep(3)}
                >
                  <div className="v2-wf-num">2B</div>
                  <div className="v2-wf-content">
                    <div className="v2-wf-agent" style={{ color: "#a855f7" }}>
                      Шейдер (Motion & Visual)
                    </div>
                    <div className="v2-wf-title">UI / 3D Концепт & Шейдеры</div>
                    <div className="v2-wf-desc">
                      Раскадровка, анимационные кривые и визуальный стиль.
                    </div>
                  </div>
                </div>
              </div>

              <div className="v2-wf-arrow">
                <ArrowRight size={20} color="#22c55e" />
                <span>Сборка решений</span>
              </div>

              {/* Step 3 */}
              <div
                className={`v2-wf-step ${activeWorkflowStep === 4 ? "active" : ""}`}
                onClick={() => setActiveWorkflowStep(4)}
              >
                <div className="v2-wf-num">3</div>
                <div className="v2-wf-content">
                  <div className="v2-wf-agent" style={{ color: "#22c55e" }}>
                    Нова (Code & Automation)
                  </div>
                  <div className="v2-wf-title">Разработка кода и скриптов</div>
                  <div className="v2-wf-desc">
                    Генерация чистого Python/JS кода, интеграция API, создание исполняемых файлов в
                    виртуальном пространстве.
                  </div>
                </div>
              </div>

              <div className="v2-wf-arrow">
                <ArrowRight size={20} color="#f43f5e" />
                <span>Обязательный аудит</span>
              </div>

              {/* Step 4 */}
              <div
                className={`v2-wf-step ${activeWorkflowStep === 5 ? "active" : ""}`}
                onClick={() => setActiveWorkflowStep(5)}
              >
                <div className="v2-wf-num">4</div>
                <div className="v2-wf-content">
                  <div className="v2-wf-agent" style={{ color: "#f43f5e" }}>
                    Вектор (Security & Pentest)
                  </div>
                  <div className="v2-wf-title">OWASP & Анализ уязвимостей</div>
                  <div className="v2-wf-desc">
                    Проверка кода на инъекции, небезопасные заголовки, уязвимости доступа и утечки
                    секретов.
                  </div>
                </div>
              </div>

              <div className="v2-wf-arrow">
                <ArrowRight size={20} color="#eab308" />
                <span>Независимый гейт</span>
              </div>

              {/* Step 5 */}
              <div
                className={`v2-wf-step ${activeWorkflowStep === 6 ? "active" : ""}`}
                onClick={() => setActiveWorkflowStep(6)}
              >
                <div className="v2-wf-num">5</div>
                <div className="v2-wf-content">
                  <div className="v2-wf-agent" style={{ color: "#eab308" }}>
                    Квант (Independent QA Gate)
                  </div>
                  <div className="v2-wf-title">Независимый QA-Аудит</div>
                  <div className="v2-wf-desc">
                    Использование изолированной рассуждающей модели для поиска багов и проверки
                    соответствия без предвзятости автора.
                  </div>
                </div>
              </div>

              <div className="v2-wf-arrow">
                <ArrowRight size={20} color="#38bdf8" />
                <span>Релиз</span>
              </div>

              {/* Step 6 */}
              <div
                className={`v2-wf-step ${activeWorkflowStep === 7 ? "active" : ""}`}
                onClick={() => setActiveWorkflowStep(7)}
              >
                <div className="v2-wf-num">6</div>
                <div className="v2-wf-content">
                  <div className="v2-wf-agent" style={{ color: "#38bdf8" }}>
                    Атлас & Human Approval
                  </div>
                  <div className="v2-wf-title">Финальная сборка и релиз</div>
                  <div className="v2-wf-desc">
                    Сохранение файлов в память проекта, выдача готового результата пользователю.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- 7B. EXTENSIONS: CLOUD TERMINAL, BROWSER & CYBER-RECON ---------------- */}
        {activeTab === "extensions" && (
          <div className="v2-section-fade">
            <div className="v2-section-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
              <div>
                <h1 className="v2-page-title">Терминал, Браузер & Боевые Extensions Агентов</h1>
                <p className="v2-page-sub">
                  Реальная среда исполнения в облаке: Cloud Terminal (Python/Node/Bash), Headless Browser со скриншотами и Cyber-Recon (DNS/SSL/OWASP)
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { id: "terminal", label: `💻 Cloud Terminal (${terminalHistory.length})` },
                  { id: "browser", label: `🌐 Браузер Агентов (${browserSessions.length})` },
                  { id: "recon", label: `🛡 Cyber-Recon (${reconReports.length})` },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setExtSubTab(t.id)}
                    style={{
                      background: extSubTab === t.id ? "#0284c7" : "#0f172a",
                      color: extSubTab === t.id ? "#fff" : "#cbd5e1",
                      border: `1px solid ${extSubTab === t.id ? "#38bdf8" : "rgba(148,163,184,0.2)"}`,
                      borderRadius: 10,
                      padding: "8px 14px",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* SUB-TAB 1: CLOUD TERMINAL */}
            {extSubTab === "terminal" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="v2-settings-grid">
                <div className="v2-card" style={{ marginBottom: 0 }}>
                  <div className="v2-card-title-row">
                    <div className="v2-card-title">
                      <Terminal size={18} color="#22c55e" />
                      <span>Запуск кода в Облачном Терминале (Wandbox / Worker Runtime)</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                    <select
                      value={termLang}
                      onChange={(e) => {
                        const nl = e.target.value;
                        setTermLang(nl);
                        if (nl === "javascript") {
                          setTermFilename("src/audit.js");
                          setTermCode(`const crypto = require("crypto");\nconsole.log("[CHARON NODE RUNTIME]", process.version);\nconst agents = ["Atlas", "Vector", "Nova", "Pulse", "Shader", "Scout", "Quant"];\nconsole.log("Active Fleet:", agents.join(" -> "));`);
                        } else if (nl === "bash") {
                          setTermFilename("scripts/check.sh");
                          setTermCode(`uname -a\necho "[CHARON BASH SHELL] Checking environment..."\ndate -u`);
                        } else {
                          setTermFilename("src/benchmark.py");
                        }
                      }}
                      className="v2-log-agent-select"
                    >
                      <option value="python">Python 3.12 (cpython)</option>
                      <option value="javascript">Node.js 20 (javascript)</option>
                      <option value="bash">Bash Shell</option>
                    </select>

                    <select
                      value={termAgent}
                      onChange={(e) => setTermAgent(e.target.value)}
                      className="v2-log-agent-select"
                    >
                      <option value="dev">Исполнитель: Нова (Dev)</option>
                      <option value="cybersec">Исполнитель: Вектор (Sec)</option>
                      <option value="quant">Исполнитель: Квант (QA)</option>
                    </select>

                    <input
                      value={termFilename}
                      onChange={(e) => setTermFilename(e.target.value)}
                      placeholder="src/script.py"
                      style={{
                        flex: 1,
                        background: "#020617",
                        border: "1px solid rgba(148,163,184,0.2)",
                        color: "#f8fafc",
                        borderRadius: 8,
                        padding: "6px 10px",
                        fontSize: 12,
                        fontFamily: "monospace",
                      }}
                    />

                    <button
                      type="button"
                      className="v2-btn-primary"
                      disabled={termRunning}
                      onClick={() => handleRunTerminal()}
                    >
                      <Play size={14} />
                      {termRunning ? "Выполняется…" : "Запустить"}
                    </button>
                  </div>

                  <textarea
                    value={termCode}
                    onChange={(e) => setTermCode(e.target.value)}
                    rows={12}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      background: "#020617",
                      color: "#a5f3fc",
                      border: "1px solid rgba(56,189,248,0.22)",
                      borderRadius: 10,
                      padding: 12,
                      fontFamily: 'ui-monospace, "Cascadia Code", Consolas, monospace',
                      fontSize: 12,
                      lineHeight: 1.5,
                      resize: "vertical",
                    }}
                  />
                </div>

                <div className="v2-card" style={{ marginBottom: 0, display: "flex", flexDirection: "column" }}>
                  <div className="v2-card-title-row">
                    <div className="v2-card-title">
                      <Code2 size={18} color="#38bdf8" />
                      <span>Вывод Терминала (stdout / stderr / exit_code)</span>
                    </div>
                  </div>
                  <div className="v2-logs-console" style={{ height: 320, flex: 1 }}>
                    {terminalHistory.length === 0 ? (
                      <div style={{ color: "#64748b", padding: 16 }}>
                        Нажмите «Запустить» слева или запустите задачу для команды — Нова автоматически прогонит сгенерированный код через терминал.
                      </div>
                    ) : (
                      terminalHistory
                        .slice()
                        .reverse()
                        .map((item) => (
                          <div
                            key={item.id}
                            style={{
                              background: "#09101f",
                              border: `1px solid ${item.exit_code === 0 ? "rgba(34,197,94,0.3)" : "rgba(244,63,94,0.4)"}`,
                              borderRadius: 8,
                              padding: 10,
                              marginBottom: 8,
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11 }}>
                              <span style={{ color: "#4ade80", fontWeight: 700 }}>{item.command}</span>
                              <span style={{ color: "#94a3b8" }}>
                                {item.engine} · exit={item.exit_code} · {item.duration_ms}ms · {item.ts}
                              </span>
                            </div>
                            <pre style={{ margin: 0, whiteSpace: "pre-wrap", color: "#e2e8f0", fontSize: 11.5 }}>
                              {item.stdout}
                            </pre>
                            {item.stderr && (
                              <pre style={{ margin: "6px 0 0", whiteSpace: "pre-wrap", color: "#fca5a5", fontSize: 11 }}>
                                {item.stderr}
                              </pre>
                            )}
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SUB-TAB 2: HEADLESS BROWSER */}
            {extSubTab === "browser" && (
              <div className="v2-card">
                <div className="v2-card-title-row">
                  <div className="v2-card-title">
                    <Globe size={18} color="#06b6d4" />
                    <span>Headless Browser Агентов (Рендер страниц, Скриншоты, HTTP-заголовки и Ссылки)</span>
                  </div>
                </div>
                <form onSubmit={handleRunBrowser} style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                  <select
                    value={browserAgent}
                    onChange={(e) => setBrowserAgent(e.target.value)}
                    className="v2-log-agent-select"
                  >
                    <option value="scout">Агент: Скаут (Research)</option>
                    <option value="growth">Агент: Пульс (SEO / Growth)</option>
                    <option value="cybersec">Агент: Вектор (Sec Audit)</option>
                  </select>
                  <input
                    type="text"
                    value={browserUrl}
                    onChange={(e) => setBrowserUrl(e.target.value)}
                    placeholder="Введите URL сайта (например https://news.ycombinator.com или https://cloudflare.com)..."
                    style={{
                      flex: 1,
                      minWidth: 240,
                      background: "#020617",
                      border: "1px solid rgba(56,189,248,0.28)",
                      color: "#f8fafc",
                      borderRadius: 10,
                      padding: "8px 14px",
                      fontSize: 13,
                    }}
                  />
                  <button type="submit" className="v2-btn-primary" disabled={browserRunning}>
                    <Globe size={15} />
                    {browserRunning ? "Загрузка и скриншот…" : "Открыть в Браузере"}
                  </button>
                </form>

                {browserSessions.length === 0 ? (
                  <div style={{ color: "#64748b", padding: 24, textAlign: "center" }}>
                    Введите любой URL выше и нажмите «Открыть в Браузере» — агент зайдёт на страницу, снимет живой скриншот, проверит заголовки безопасности и извлечёт контент.
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 16 }}>
                    {browserSessions
                      .slice()
                      .reverse()
                      .map((sess) => (
                        <div
                          key={sess.id}
                          style={{
                            background: "#020617",
                            border: "1px solid rgba(56,189,248,0.22)",
                            borderRadius: 12,
                            overflow: "hidden",
                            display: "flex",
                            flexDirection: "column",
                          }}
                        >
                          {sess.screenshot_url && (
                            <div style={{ position: "relative", height: 210, background: "#091326", borderBottom: "1px solid rgba(148,163,184,0.15)" }}>
                              <img
                                src={sess.screenshot_url}
                                alt={sess.title}
                                loading="lazy"
                                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
                              />
                              <span
                                style={{
                                  position: "absolute",
                                  top: 8,
                                  right: 8,
                                  background: "rgba(2,6,23,0.88)",
                                  color: "#38bdf8",
                                  border: "1px solid rgba(56,189,248,0.4)",
                                  borderRadius: 6,
                                  padding: "2px 8px",
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                }}
                              >
                                HTTP {sess.status || 200} · {sess.duration_ms}ms
                              </span>
                            </div>
                          )}
                          <div style={{ padding: 14 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#f8fafc", marginBottom: 4 }}>
                              {sess.title}
                            </div>
                            <div style={{ fontSize: 11, color: "#38bdf8", marginBottom: 8, wordBreak: "break-all" }}>
                              {sess.url}
                            </div>
                            {sess.headers && (
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                                <span className="v2-log-tool-pill">Server: {sess.headers.server || "hidden"}</span>
                                <span className="v2-log-tool-pill">CSP: {sess.headers.csp || "MISSING"}</span>
                                <span className="v2-log-tool-pill">HSTS: {sess.headers.hsts || "MISSING"}</span>
                                <span className="v2-log-tool-pill">XFO: {sess.headers.x_frame_options || "MISSING"}</span>
                              </div>
                            )}
                            <div style={{ fontSize: 11.5, color: "#94a3b8", lineHeight: 1.45, maxHeight: 110, overflowY: "auto" }}>
                              {sess.content_preview || sess.description || "Контент страницы извлечён."}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* SUB-TAB 3: CYBER-RECON */}
            {extSubTab === "recon" && (
              <div className="v2-card">
                <div className="v2-card-title-row">
                  <div className="v2-card-title">
                    <Shield size={18} color="#f43f5e" />
                    <span>Вектор Cyber-Recon (Cloudflare DoH DNS, crt.sh SSL Subdomains & OWASP Headers)</span>
                  </div>
                </div>
                <form onSubmit={handleRunRecon} style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                  <input
                    type="text"
                    value={reconTarget}
                    onChange={(e) => setReconTarget(e.target.value)}
                    placeholder="Домен для разведки (например charon-office.pages.dev или cloudflare.com)..."
                    style={{
                      flex: 1,
                      minWidth: 240,
                      background: "#020617",
                      border: "1px solid rgba(244,63,94,0.35)",
                      color: "#f8fafc",
                      borderRadius: 10,
                      padding: "8px 14px",
                      fontSize: 13,
                    }}
                  />
                  <button type="submit" className="v2-btn-primary" disabled={reconRunning}>
                    <Shield size={15} />
                    {reconRunning ? "Сканирую DNS & SSL…" : "Запустить Cyber-Recon"}
                  </button>
                </form>

                {reconReports.length === 0 ? (
                  <div style={{ color: "#64748b", padding: 24, textAlign: "center" }}>
                    Нажмите «Запустить Cyber-Recon» — Вектор соберёт реальные DNS-записи (A, MX, TXT/SPF), поддомены из Certificate Transparency (`crt.sh`) и заголовки безопасности.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {reconReports
                      .slice()
                      .reverse()
                      .map((rep) => (
                        <div
                          key={rep.id}
                          style={{
                            background: "#020617",
                            border: "1px solid rgba(244,63,94,0.28)",
                            borderRadius: 12,
                            padding: 14,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                            <strong style={{ color: "#f43f5e", fontSize: 13.5 }}>Цель: {rep.target}</strong>
                            <span style={{ color: "#64748b", fontSize: 11 }}>{rep.duration_ms}ms · {rep.ts}</span>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, fontSize: 11.5 }}>
                            <div>
                              <div style={{ color: "#38bdf8", fontWeight: 700, marginBottom: 4 }}>DNS A / IPv4:</div>
                              <div style={{ color: "#cbd5e1", fontFamily: "monospace" }}>
                                {(rep.dns_a || []).join(", ") || "нет записей"}
                              </div>
                              <div style={{ color: "#38bdf8", fontWeight: 700, marginTop: 8, marginBottom: 4 }}>DNS MX:</div>
                              <div style={{ color: "#cbd5e1", fontFamily: "monospace" }}>
                                {(rep.dns_mx || []).join(", ") || "нет записей"}
                              </div>
                            </div>
                            <div>
                              <div style={{ color: "#a855f7", fontWeight: 700, marginBottom: 4 }}>
                                Поддомены (crt.sh SSL):
                              </div>
                              <div style={{ color: "#cbd5e1", fontFamily: "monospace", wordBreak: "break-all" }}>
                                {(rep.subdomains || []).join(", ") || "не обнаружено"}
                              </div>
                            </div>
                            <div>
                              <div style={{ color: "#22c55e", fontWeight: 700, marginBottom: 4 }}>Security Headers:</div>
                              <pre style={{ margin: 0, color: "#cbd5e1", fontSize: 10.5, whiteSpace: "pre-wrap" }}>
                                {JSON.stringify(rep.security_headers || {}, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ---------------- 8. MEMORY & VIRTUAL FILES ---------------- */}
        {activeTab === "memory" && (
          <div className="v2-section-fade">
            <div className="v2-section-header-row">
              <div>
                <h1 className="v2-page-title">Память Проекта & Виртуальные Файлы</h1>
                <p className="v2-page-sub">
                  Просмотр сгенерированного кода, история ключевых решений и долгосрочная память
                </p>
              </div>
            </div>

            <div className="v2-memory-split-layout">
              {/* Left: Files List & Decisions */}
              <div className="v2-memory-sidebar">
                <div className="v2-sidebar-header">
                  <FileCode size={16} color="#38bdf8" />
                  <span>Файлы в виртуальном хранилище ({activeFiles.length})</span>
                </div>
                <div className="v2-files-list">
                  {activeFiles.map((file) => {
                    const isCur = currentViewingFile?.name === file.name;
                    return (
                      <button
                        key={file.name}
                        className={`v2-file-item ${isCur ? "active" : ""}`}
                        onClick={() => setSelectedFile(file)}
                      >
                        <FileCode size={14} color={isCur ? "#38bdf8" : "#94a3b8"} />
                        <div className="v2-file-meta">
                          <span className="v2-file-name">{file.name}</span>
                          <span className="v2-file-size">
                            {file.size} · {file.updated_at}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="v2-sidebar-header" style={{ marginTop: 20 }}>
                  <Database size={16} color="#a855f7" />
                  <span>История решений (Decisions)</span>
                </div>
                <div className="v2-decisions-list">
                  {activeDecisions.map((dec) => (
                    <div key={dec.id} className="v2-decision-card">
                      <div className="v2-decision-top">
                        <span className="v2-dec-agent">{dec.agentName}</span>
                        <span className="v2-dec-badge">{dec.verdict}</span>
                      </div>
                      <div className="v2-dec-title">{dec.title}</div>
                      <div className="v2-dec-rationale">{dec.rationale}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Code Viewer */}
              <div className="v2-code-viewer-container">
                {currentViewingFile ? (
                  <>
                    <div className="v2-viewer-header">
                      <div className="v2-viewer-meta">
                        <FileCode size={16} color="#38bdf8" />
                        <span className="v2-viewer-path">{currentViewingFile.path}</span>
                        <span className="v2-viewer-lang">({currentViewingFile.language})</span>
                      </div>
                      <div className="v2-viewer-actions">
                        {["python", "py", "javascript", "js", "bash", "sh"].includes(
                          (currentViewingFile.language || "").toLowerCase()
                        ) && (
                          <button
                            className="v2-btn-viewer"
                            style={{ borderColor: "#22c55e", color: "#4ade80" }}
                            onClick={async () => {
                              setTermLang(
                                ["javascript", "js"].includes((currentViewingFile.language || "").toLowerCase())
                                  ? "javascript"
                                  : ["bash", "sh"].includes((currentViewingFile.language || "").toLowerCase())
                                  ? "bash"
                                  : "python"
                              );
                              setTermFilename(currentViewingFile.name);
                              setTermCode(currentViewingFile.content);
                              setActiveTab("extensions");
                              setExtSubTab("terminal");
                              await handleRunTerminal(
                                currentViewingFile.language,
                                currentViewingFile.content,
                                currentViewingFile.name,
                                "dev"
                              );
                            }}
                          >
                            <Play size={14} color="#22c55e" />
                            <span>Запустить в Терминале</span>
                          </button>
                        )}
                        {["svg", "html"].includes((currentViewingFile.language || "").toLowerCase()) && (
                          <button
                            className="v2-btn-viewer"
                            style={{ borderColor: "#a855f7", color: "#d8b4fe" }}
                            onClick={() => setPreviewMode((p) => !p)}
                          >
                            <Eye size={14} color="#a855f7" />
                            <span>{previewMode ? "Показать код" : "Live Preview"}</span>
                          </button>
                        )}
                        <button
                          className="v2-btn-viewer"
                          onClick={() => handleCopyCode(currentViewingFile.content)}
                        >
                          {copiedFile ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
                          <span>{copiedFile ? "Скопировано!" : "Копировать код"}</span>
                        </button>
                        <button
                          className="v2-btn-viewer primary"
                          onClick={() => handleDownloadFile(currentViewingFile)}
                        >
                          <Download size={14} />
                          <span>Скачать файл</span>
                        </button>
                      </div>
                    </div>
                    <div className="v2-code-body">
                      {previewMode && ["svg", "html"].includes((currentViewingFile.language || "").toLowerCase()) ? (
                        <iframe
                          title="Live Sandbox Preview"
                          sandbox="allow-scripts"
                          srcDoc={
                            currentViewingFile.language === "svg"
                              ? `<!DOCTYPE html><html><body style="margin:0;background:#070b14;display:flex;align-items:center;justify-content:center;height:100vh;">${currentViewingFile.content}</body></html>`
                              : currentViewingFile.content
                          }
                          style={{ width: "100%", height: "100%", minHeight: 420, border: "none", borderRadius: 8, background: "#070b14" }}
                        />
                      ) : (
                        <pre>
                          <code>{currentViewingFile.content}</code>
                        </pre>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="v2-viewer-empty">Выберите файл для просмотра</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ---------------- 9. LOGS ---------------- */}
        {activeTab === "logs" && (
          <div className="v2-section-fade">
            <div className="v2-section-header-row">
              <div>
                <h1 className="v2-page-title">Логи Исполнения & Вызовы Инструментов</h1>
                <p className="v2-page-sub">
                  Реальное время, события воркеров, вызовы shell, ast и web search
                </p>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="v2-logs-controls">
              <div className="v2-log-filters-group">
                {["ALL", "INFO", "TOOL", "WARN", "ERROR"].map((lvl) => (
                  <button
                    key={lvl}
                    className={`v2-filter-btn ${logFilter === lvl ? "active" : ""}`}
                    onClick={() => setLogFilter(lvl)}
                  >
                    {lvl}
                  </button>
                ))}
              </div>

              <select
                className="v2-log-agent-select"
                value={logAgentFilter}
                onChange={(e) => setLogAgentFilter(e.target.value)}
              >
                <option value="all">Все агенты</option>
                {mergedAgents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>

              <div className="v2-log-search-wrap">
                <Search size={14} color="#64748b" />
                <input
                  type="text"
                  placeholder="Поиск по логам..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="v2-log-search-input"
                />
              </div>
            </div>

            {/* Logs Console Box */}
            <div className="v2-logs-console">
              {filteredLogs.map((log) => {
                const agent = mergedAgents.find((a) => a.id === log.agent);
                return (
                  <div key={log.id} className={`v2-log-row ${log.level.toLowerCase()}`}>
                    <span className="v2-log-ts">{log.ts}</span>
                    <span className={`v2-log-lvl-badge ${log.level.toLowerCase()}`}>
                      {log.level}
                    </span>
                    {agent && (
                      <span className="v2-log-agent" style={{ color: agent.color }}>
                        [{agent.name}]
                      </span>
                    )}
                    <span className="v2-log-msg">{log.message}</span>
                    {log.tool && (
                      <span className="v2-log-tool-pill">
                        tool: <strong>{log.tool}</strong>
                        {log.duration_ms && ` (${log.duration_ms}ms)`}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ---------------- 10. ANALYTICS & QUOTAS ---------------- */}
        {activeTab === "analytics" && (
          <div className="v2-section-fade">
            <div className="v2-section-header-row">
              <div>
                <h1 className="v2-page-title">Менеджер Квот & Аналитика Флота</h1>
                <p className="v2-page-sub">
                  Мониторинг лимитов RPM/TPM/RPD, защита Argon 96% и состояние резервных провайдеров
                </p>
              </div>
            </div>

            {/* Quota Manager Table */}
            <div className="v2-card v2-quota-table-card">
              <div className="v2-card-title">
                <BarChart3 size={18} color="#38bdf8" />
                <span>Таблица Квот и Статусов Провайдеров</span>
              </div>
              <div className="v2-table-wrapper">
                <table className="v2-table">
                  <thead>
                    <tr>
                      <th>Провайдер</th>
                      <th>Модель</th>
                      <th>Статус Квоты</th>
                      <th>Запросы</th>
                      <th>Токены</th>
                      <th>RPM</th>
                      <th>TPM</th>
                      <th>RPD</th>
                      <th>Стоимость</th>
                      <th>Последняя ошибка</th>
                      <th>Сброс квоты</th>
                      <th>Остаток квоты</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeQuotas.map((row, i) => (
                      <tr key={i}>
                        <td className="font-semibold">{row.provider}</td>
                        <td>
                          <code>{row.model}</code>
                        </td>
                        <td>
                          <span
                            className={`v2-status-pill ${
                              row.status.includes("Argon")
                                ? "protected"
                                : row.status.includes("blocked")
                                ? "blocked"
                                : "active"
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td>{row.requests}</td>
                        <td>{row.tokens}</td>
                        <td>{row.rpm}</td>
                        <td>{row.tpm}</td>
                        <td>{row.rpd}</td>
                        <td className="green">{row.cost}</td>
                        <td>{row.last_error}</td>
                        <td>{row.reset_time}</td>
                        <td className="font-semibold">{row.quota_remaining}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- 11. SETTINGS ---------------- */}
        {activeTab === "settings" && (
          <div className="v2-section-fade">
            <div className="v2-section-header-row">
              <div>
                <h1 className="v2-page-title">Конфигурация Системы & Безопасность</h1>
                <p className="v2-page-sub">
                  Эконом-режим, авто-маршрутизация, барьеры контроля человека (Human Gates) и хранилище ключей
                </p>
              </div>
            </div>

            <div className="v2-settings-grid">
              {/* Toggles Card */}
              <div className="v2-card">
                <div className="v2-card-title">
                  <Sliders size={18} color="#38bdf8" />
                  <span>Режимы Работы Флота</span>
                </div>

                <div className="v2-setting-toggle-row">
                  <div>
                    <div className="v2-toggle-label">Режим Экономии Токенов (Economy Mode)</div>
                    <div className="v2-toggle-sub">
                      При простое агенты общаются локально без обращения к внешним LLM API (0₽).
                    </div>
                  </div>
                  <button
                    className={`v2-toggle-switch ${economyMode ? "on" : "off"}`}
                    onClick={onToggleEconomy}
                  >
                    <span className="v2-switch-knob" />
                  </button>
                </div>

                <div className="v2-setting-toggle-row">
                  <div>
                    <div className="v2-toggle-label">Автоматическая маршрутизация (Auto-Routing)</div>
                    <div className="v2-toggle-sub">
                      При исчерпании квоты или ошибке 429 автоматически переключаться на резервную модель.
                    </div>
                  </div>
                  <button
                    className={`v2-toggle-switch ${autoRouting ? "on" : "off"}`}
                    onClick={onToggleAutoRouting}
                  >
                    <span className="v2-switch-knob" />
                  </button>
                </div>
              </div>

              {/* Human Control Gates */}
              <div className="v2-card">
                <div className="v2-card-title">
                  <Shield size={18} color="#f43f5e" />
                  <span>Барьеры Контроля Человека (Human Control Gates)</span>
                </div>

                <div className="v2-setting-toggle-row">
                  <div>
                    <div className="v2-toggle-label">Одобрение команд повышенного риска</div>
                    <div className="v2-toggle-sub">
                      Запрашивать подтверждение перед выполнением shell-скриптов и удаления файлов.
                    </div>
                  </div>
                  <button
                    className={`v2-toggle-switch ${humanControlGates.highRiskApproval ? "on" : "off"}`}
                    onClick={() =>
                      onUpdateHumanGates?.({
                        ...humanControlGates,
                        highRiskApproval: !humanControlGates.highRiskApproval,
                      })
                    }
                  >
                    <span className="v2-switch-knob" />
                  </button>
                </div>

                <div className="v2-setting-toggle-row">
                  <div>
                    <div className="v2-toggle-label">Одобрение перед деплоем на продакшн</div>
                    <div className="v2-toggle-sub">
                      Никакие изменения не отправляются в прод без финальной подписи оператора.
                    </div>
                  </div>
                  <button
                    className={`v2-toggle-switch ${humanControlGates.deployApproval ? "on" : "off"}`}
                    onClick={() =>
                      onUpdateHumanGates?.({
                        ...humanControlGates,
                        deployApproval: !humanControlGates.deployApproval,
                      })
                    }
                  >
                    <span className="v2-switch-knob" />
                  </button>
                </div>

                <div className="v2-setting-toggle-row">
                  <div>
                    <div className="v2-toggle-label">Обязательный QA-гейт Кванта</div>
                    <div className="v2-toggle-sub">
                      Блокировать завершение задачи, если оценка соответствия Кванта ниже 95%.
                    </div>
                  </div>
                  <button
                    className={`v2-toggle-switch ${humanControlGates.qaConsensusGate ? "on" : "off"}`}
                    onClick={() =>
                      onUpdateHumanGates?.({
                        ...humanControlGates,
                        qaConsensusGate: !humanControlGates.qaConsensusGate,
                      })
                    }
                  >
                    <span className="v2-switch-knob" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
