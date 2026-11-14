// Cloudflare Pages Advanced Mode Worker (_worker.js) — CHARON V2.0
// Serves /api/* and /ws (WebSocket) directly on Cloudflare Pages
// and falls back to env.ASSETS for static 3D frontend assets.

const GRID_W = 16;
const GRID_H = 13;

const BLOCKED = new Set([
  "1,2", "1,3", "1,6", "1,7", "1,10", "1,11",
  "5,1",
  "14,2", "14,3", "14,8", "14,9", "14,11",
  "8,5",
  "7,1", "8,1", "9,1",
  "7,11", "8,11",
]);

const LOUNGE_SPOTS = [[6, 2], [10, 2], [6, 9], [10, 9], [5, 5], [11, 5]];
const COFFEE_SPOTS = [[6, 2], [7, 2], [9, 2], [10, 2]];
const COLLAB_VISIT_POS = {
  lead: [3, 2],
  cybersec: [3, 6],
  dev: [3, 10],
  growth: [12, 2],
  motion: [12, 8],
  scout: [5, 3],
  quant: [12, 11],
};

const VISUAL_STATES = new Set([
  "IDLE",
  "THINKING",
  "WORKING",
  "COLLABORATING",
  "REVIEWING",
  "BLOCKED",
  "ERROR",
  "COMPLETED",
]);

const KV_MEMORY_KEY = "charon:memory";
const KV_KEYS_KEY = "charon:keys";

const DESTRUCTIVE_KEYWORDS = [
  "удалить базу",
  "опубликовать в прод",
  "купить",
  "drop database",
  "delete database",
  "rm -rf",
  "deploy to prod",
  "оплатить",
  "перевести деньги",
  "удалить все",
];

const KEY_FIELD_TO_ENV = {
  openrouter_api_key: "OPENROUTER_API_KEY",
  gemini_api_key: "GEMINI_API_KEY",
  groq_api_key: "GROQ_API_KEY",
  cerebras_api_key: "CEREBRAS_API_KEY",
  deepseek_api_key: "DEEPSEEK_API_KEY",
  siliconflow_api_key: "SILICONFLOW_API_KEY",
  zai_api_key: "ZAI_API_KEY",
};

const PROVIDER_TO_KEY_FIELD = {
  openrouter: "openrouter_api_key",
  gemini: "gemini_api_key",
  groq: "groq_api_key",
  cerebras: "cerebras_api_key",
  deepseek: "deepseek_api_key",
  siliconflow: "siliconflow_api_key",
  zai: "zai_api_key",
};

const INITIAL_AGENTS = {
  lead: {
    id: "lead",
    name: "Атлас",
    role: "Тимлид / Стратег",
    specialty: "Оркестрация задач, стратегия, финальная сборка",
    color: "#38bdf8",
    provider: "gemini",
    model: "gemini-3-flash-preview",
    cfModel: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    desk_pos: [2, 2],
    look_pos: [1, 2.5],
    meeting_pos: [7, 5],
    system_prompt:
      "Ты Атлас — тимлид и главный стратег AI-офиса CHARON V2.0. Ты координируешь команду из 6 специалистов: Скаут (исследования и рынок), Шейдер (Motion Graphics и UI/дизайн), Пульс (продвижение и контент), Нова (код и архитектура), Вектор (кибербез и OWASP-аудит), Квант (независимый QA-аудитор). Отвечай чётко, структурно, по делу на русском языке.",
    idle_phrases: [
      "Проверяю бэклог DAG-задач на сегодня.",
      "Команда, держим темп и контролируем квоты моделей.",
      "Сверяю приоритеты по текущим проектам.",
    ],
  },
  scout: {
    id: "scout",
    name: "Скаут",
    role: "Research Analyst",
    specialty: "Интернет-исследования, анализ технологий и рынка, проверка источников",
    color: "#06b6d4",
    provider: "gemini",
    model: "gemini-3-flash-preview",
    cfModel: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    desk_pos: [5, 2],
    look_pos: [5, 1.2],
    meeting_pos: [7, 4],
    system_prompt:
      "Ты Скаут — Research Analyst AI-офиса. Специализируешься на веб-исследованиях, проверке первоисточников, сравнении технологий и рыночном анализе. Опирайся на факты и проверенные URL из инструментов поиска, давай структурированное сравнение на русском языке.",
    idle_phrases: [
      "Мониторю свежие релизы и бенчмарки в сети.",
      "Проверяю достоверность источников и ссылки.",
      "Собираю сравнительную матрицу технологий.",
    ],
  },
  cybersec: {
    id: "cybersec",
    name: "Вектор",
    role: "Пентест и Кибербез",
    specialty: "Аудит уязвимостей, OWASP, threat modeling, харденинг",
    color: "#f43f5e",
    provider: "openrouter",
    model: "nvidia/nemotron-3-ultra-550b-a55b:free",
    cfModel: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
    desk_pos: [2, 6],
    look_pos: [1, 6.5],
    meeting_pos: [8, 4],
    system_prompt:
      "Ты Вектор — специалист по наступательной и оборонительной кибербезопасности (пентест, статический аудит кода, OWASP Top 10, поиск мисконфигов, CSP/CORS, секреты, харденинг). Говори прямо, технически глубоко, без воды на русском языке в рамках легального аудита.",
    idle_phrases: [
      "Сканирую зависимости и код на известные CVE.",
      "Проверяю заголовки безопасности, CSP и CORS-политики.",
      "Ищу слабые места в конфигурации доступа.",
    ],
  },
  dev: {
    id: "dev",
    name: "Нова",
    role: "Код и Автоматизация",
    specialty: "Python/JS скрипты, парсеры, боты, архитектура",
    color: "#22c55e",
    provider: "gemini",
    model: "gemini-3-flash-preview",
    cfModel: "@cf/qwen/qwen2.5-coder-32b-instruct",
    desk_pos: [2, 10],
    look_pos: [1, 10.5],
    meeting_pos: [9, 4],
    system_prompt:
      "Ты Нова — senior-разработчик и автоматизатор. Пишешь чистый, безопасный, рабочий код (JavaScript, TypeScript, Python, SQL, HTML/CSS, API). Всегда оформляй код в блоки с указанием пути файла, например ```filepath:src/app.js ... ```. Отвечай на русском языке.",
    idle_phrases: [
      "Оптимизирую пайплайн, чтобы ничего не тормозило.",
      "Рефакторю асинхронные воркеры и типы.",
      "Проверяю граничные случаи в реализации.",
    ],
  },
  growth: {
    id: "growth",
    name: "Пульс",
    role: "Контент и Продвижение",
    specialty: "Вирусные сценарии, воронки, SMM, SEO, копирайтинг",
    color: "#f59e0b",
    provider: "groq",
    model: "openai/gpt-oss-120b",
    cfModel: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    desk_pos: [13, 2],
    look_pos: [14, 2.5],
    meeting_pos: [9, 6],
    system_prompt:
      "Ты Пульс — эксперт по продвижению, контент-маркетингу, вирусным хукам, воронкам, Reels/Shorts/YouTube сценариям и продающим текстам. Мыслишь метриками удержания и CTR. Отвечай на русском языке.",
    idle_phrases: [
      "Анализирую цепляющие хуки для первых 3 секунд.",
      "Собираю контент-матрицу под разные площадки.",
      "Тестирую заголовки с высоким CTR.",
    ],
  },
  motion: {
    id: "motion",
    name: "Шейдер",
    role: "Motion Graphics & Визуал",
    specialty: "Раскадровки, UI/CSS/SVG артефакты, 3D/AE-концепты, шейдеры",
    color: "#a855f7",
    provider: "deepseek",
    model: "deepseek-chat",
    cfModel: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    desk_pos: [13, 8],
    look_pos: [14, 8.5],
    meeting_pos: [8, 6],
    system_prompt:
      "Ты Шейдер — арт-директор по Motion Graphics, UI/UX-дизайну, CSS-анимациям, SVG и 3D/Three.js. Всегда включай в ответ конкретные UI/дизайн-артефакты в fenced-блоках (например ```css или ```svg или ```html с указанием ```filepath:design/theme.css или ```filepath:design/preview.svg). Отвечай на русском языке.",
    idle_phrases: [
      "Настраиваю кривые скорости и композицию кадра.",
      "Подбираю неоновую палитру и ритм анимаций.",
      "Генерирую SVG-схемы и CSS-токены интерфейса.",
    ],
  },
  quant: {
    id: "quant",
    name: "Квант",
    role: "QA / Independent Auditor",
    specialty: "Независимый аудит кода, архитектуры, безопасности и приёмка",
    color: "#eab308",
    provider: "deepseek",
    model: "deepseek-reasoner",
    cfModel: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
    desk_pos: [13, 11],
    look_pos: [14, 11],
    meeting_pos: [7, 6],
    system_prompt:
      "Ты Квант — независимый QA и главный аудитор приёмки. Проверяешь артефакты команды (код, дизайн, отчёт безопасности, соответствие задаче босса) максимально критично и объективно. В конце отчёта ОБЯЗАТЕЛЬНО вынеси строгий вердикт отдельной строкой: `VERDICT: APPROVED` если всё качественно и безопасно, либо `VERDICT: REJECTED` со списком конкретных дефектов для исправления. Отвечай на русском языке.",
    idle_phrases: [
      "Готовлю чек-лист приёмки и регресс-проверки.",
      "Сверяю архитектуру с требованиями безопасности.",
      "Проверяю корректность и полноту сгенерированных файлов.",
    ],
  },
};

const AGENT_FALLBACK_CHAINS = {
  lead: [
    ["gemini", "gemini-3-flash-preview"],
    ["groq", "openai/gpt-oss-120b"],
    ["siliconflow", "deepseek-ai/DeepSeek-V4.1-Flash"],
    ["openrouter", "nvidia/nemotron-3-ultra-550b-a55b:free"],
  ],
  scout: [
    ["gemini", "gemini-3-flash-preview"],
    ["groq", "openai/gpt-oss-120b"],
    ["cerebras", "qwen-3.8-27b"],
    ["openrouter", "nvidia/nemotron-3-ultra-550b-a55b:free"],
  ],
  cybersec: [
    ["gemini", "gemini-3-flash-preview"],
    ["groq", "openai/gpt-oss-120b"],
    ["deepseek", "deepseek-reasoner"],
    ["openrouter", "nvidia/nemotron-3-ultra-550b-a55b:free"],
  ],
  dev: [
    ["gemini", "gemini-3-flash-preview"],
    ["groq", "openai/gpt-oss-120b"],
    ["cerebras", "qwen-3.8-27b"],
    ["deepseek", "deepseek-chat"],
  ],
  growth: [
    ["groq", "openai/gpt-oss-120b"],
    ["gemini", "gemini-3-flash-preview"],
    ["cerebras", "gpt-oss-120b"],
    ["zai", "glm-5.3-flash"],
  ],
  motion: [
    ["gemini", "gemini-3-flash-preview"],
    ["groq", "openai/gpt-oss-120b"],
    ["deepseek", "deepseek-chat"],
    ["siliconflow", "deepseek-ai/DeepSeek-V4.1-Flash"],
  ],
  quant: [
    ["gemini", "gemini-3-flash-preview"],
    ["groq", "openai/gpt-oss-120b"],
    ["deepseek", "deepseek-reasoner"],
    ["cerebras", "qwen-3.8-27b"],
  ],
};

const DEFAULT_FALLBACK_POOL = [
  ["gemini", "gemini-3-flash-preview"],
  ["groq", "openai/gpt-oss-120b"],
  ["cerebras", "qwen-3.8-27b"],
  ["deepseek", "deepseek-chat"],
  ["siliconflow", "deepseek-ai/DeepSeek-V4.1-Flash"],
  ["zai", "glm-5.3-flash"],
  ["openrouter", "nvidia/nemotron-3-ultra-550b-a55b:free"],
];

const KNOWN_FLEET_QUOTAS = [
  {
    key: "fleet/gemini-4-argon",
    provider: "antigravity",
    model: "gemini-4-argon",
    status: "PROTECTED",
    requests: 0,
    tokens: 0,
    rpm: 0,
    tpm: 0,
    rpd: 0,
    cost: 0,
    last_error: null,
    reset_time: null,
    quota_remaining: "96%",
    note: "Protected for complex planning",
    protected: true,
  },
  {
    key: "fleet/gemini-4-hydrogen",
    provider: "antigravity",
    model: "gemini-4-hydrogen",
    status: "AVAILABLE",
    requests: 0,
    tokens: 0,
    rpm: 0,
    tpm: 0,
    rpd: 0,
    cost: 0,
    last_error: null,
    reset_time: null,
    quota_remaining: "98%",
    note: "Fleet ready",
  },
  {
    key: "fleet/gemini-3.8-flash",
    provider: "antigravity",
    model: "gemini-3.8-flash",
    status: "AVAILABLE",
    requests: 0,
    tokens: 0,
    rpm: 0,
    tpm: 0,
    rpd: 0,
    cost: 0,
    last_error: null,
    reset_time: null,
    quota_remaining: "98%",
    note: "Fleet ready",
  },
  {
    key: "fleet/claude-opus-5.5",
    provider: "antigravity",
    model: "claude-opus-5.5",
    status: "BLOCKED",
    requests: 0,
    tokens: 0,
    rpm: 0,
    tpm: 0,
    rpd: 0,
    cost: 0,
    last_error: "Quota exhausted (0%)",
    reset_time: "2026-11-16T09:42:49Z",
    quota_remaining: "0%",
    note: "Blocked until 2026-11-16T09:42:49Z",
  },
  {
    key: "fleet/claude-sonnet-5.5",
    provider: "antigravity",
    model: "claude-sonnet-5.5",
    status: "CONSERVED",
    requests: 0,
    tokens: 0,
    rpm: 0,
    tpm: 0,
    rpd: 0,
    cost: 0,
    last_error: null,
    reset_time: null,
    quota_remaining: "CONSERVED",
    note: "Conserved for high-value tasks",
  },
];

// Singleton simulation state inside Worker isolate
const state = {
  kv_loaded: false,
  local_running: false,
  economy_mode: true,
  auto_routing: true,
  task_running: false,
  current_task: "",
  last_task_prompt: "",
  last_target_agent: "all",
  task_abort: false,
  current_dag: null,
  pending_approval: null,
  approval_resolver: null,
  keys: {
    openrouter_api_key: "",
    gemini_api_key: "",
    groq_api_key: "",
    cerebras_api_key: "",
    deepseek_api_key: "",
    siliconflow_api_key: "",
    zai_api_key: "",
  },
  deleted_keys: new Set(),
  agents: {},
  quotas: {},
  memory: {
    summary: "CHARON V2.0 Shared Workspace Memory initialized.",
    files: [],
    tasks: [],
    decisions: [],
    logs: [],
  },
  messages: [],
  sockets: new Set(),
  lastTick: Date.now(),
  lastWander: Date.now(),
};

for (const fq of KNOWN_FLEET_QUOTAS) {
  state.quotas[fq.key] = { ...fq };
}

for (const [id, prof] of Object.entries(INITIAL_AGENTS)) {
  const [dx, dy] = prof.desk_pos;
  const [lx, ly] = prof.look_pos;
  state.agents[id] = {
    profile: { ...prof },
    x: dx,
    y: dy,
    target_x: dx,
    target_y: dy,
    path: [],
    status: "idle",
    post_status: "idle",
    visual_state: "IDLE",
    post_visual_state: "IDLE",
    facing: Math.atan2(lx - dx, ly - dy),
    look_target: [lx, ly],
    bubble: "",
    bubble_until: 0,
    collaborating_with: null,
  };
}

// ============================================================================
// KV Persistence Helpers
// ============================================================================

async function ensureKVLoaded(env) {
  if (!env || !env.CHARON_KV) return;
  if (!state.kv_loaded) {
    state.kv_loaded = true;
    try {
      const rawKeys = await env.CHARON_KV.get(KV_KEYS_KEY, "json");
      if (rawKeys && typeof rawKeys === "object") {
        if (rawKeys.keys && typeof rawKeys.keys === "object") {
          for (const k of Object.keys(state.keys)) {
            if (typeof rawKeys.keys[k] === "string") {
              state.keys[k] = rawKeys.keys[k].trim();
            }
          }
        }
        if (Array.isArray(rawKeys.deleted_keys)) {
          for (const dk of rawKeys.deleted_keys) {
            state.deleted_keys.add(dk);
          }
        }
      }
    } catch {
      // KV read failure is non-fatal
    }
  }

  // Always sync shared runtime & memory state across Cloudflare isolates when not actively running in this isolate
  if (state.local_running) return;

  try {
    const rawMem = await env.CHARON_KV.get(KV_MEMORY_KEY, "json");
    if (rawMem && typeof rawMem === "object") {
      state.memory = {
        summary: typeof rawMem.summary === "string" ? rawMem.summary : state.memory.summary,
        files: Array.isArray(rawMem.files) ? rawMem.files : [],
        tasks: Array.isArray(rawMem.tasks) ? rawMem.tasks : [],
        decisions: Array.isArray(rawMem.decisions) ? rawMem.decisions : [],
        logs: Array.isArray(rawMem.logs) ? rawMem.logs : [],
      };
      if (rawMem.current_dag !== undefined) {
        state.current_dag = rawMem.current_dag;
      }
      const isStaleRun = rawMem.task_running && rawMem.updated_at && Date.now() - rawMem.updated_at > 60000;
      state.task_running = isStaleRun ? false : Boolean(rawMem.task_running);
      state.current_task = isStaleRun ? "" : String(rawMem.current_task || "");
      if (typeof rawMem.last_task_prompt === "string") state.last_task_prompt = rawMem.last_task_prompt;
      if (typeof rawMem.last_target_agent === "string") state.last_target_agent = rawMem.last_target_agent;
      if (rawMem.pending_approval !== undefined) state.pending_approval = rawMem.pending_approval;
      if (Array.isArray(rawMem.messages)) state.messages = rawMem.messages;
      if (rawMem.quotas && typeof rawMem.quotas === "object") {
        for (const [qk, qv] of Object.entries(rawMem.quotas)) {
          state.quotas[qk] = { ...(state.quotas[qk] || {}), ...qv };
        }
      }
      if (rawMem.agents_snapshot && typeof rawMem.agents_snapshot === "object") {
        for (const [aid, snap] of Object.entries(rawMem.agents_snapshot)) {
          const ag = state.agents[aid];
          if (!ag || !snap) continue;
          if (typeof snap.x === "number") ag.x = snap.x;
          if (typeof snap.y === "number") ag.y = snap.y;
          if (typeof snap.target_x === "number") ag.target_x = snap.target_x;
          if (typeof snap.target_y === "number") ag.target_y = snap.target_y;
          if (typeof snap.status === "string") ag.status = isStaleRun ? "idle" : snap.status;
          if (typeof snap.visual_state === "string") ag.visual_state = isStaleRun ? "IDLE" : snap.visual_state;
          if (typeof snap.facing === "number") ag.facing = snap.facing;
          if (typeof snap.bubble === "string") ag.bubble = snap.bubble;
          if (typeof snap.bubble_until === "number") ag.bubble_until = snap.bubble_until;
          ag.collaborating_with = isStaleRun ? null : snap.collaborating_with || null;
          if (typeof snap.provider === "string" && snap.provider) ag.profile.provider = snap.provider;
          if (typeof snap.model === "string" && snap.model) {
            ag.profile.model = snap.model === "gemini-2.5-flash" ? "gemini-3-flash-preview" : snap.model;
          }
        }
      }
    }
  } catch {
    // KV read failure is non-fatal
  }
}

async function saveKeysToKV(env) {
  if (!env || !env.CHARON_KV) return;
  try {
    await env.CHARON_KV.put(
      KV_KEYS_KEY,
      JSON.stringify({
        keys: state.keys,
        deleted_keys: Array.from(state.deleted_keys),
        updated_at: new Date().toISOString(),
      })
    );
  } catch {
    // Ignore KV write errors
  }
}

async function saveMemoryToKV(env) {
  if (!env || !env.CHARON_KV) return;
  try {
    state.memory.files = state.memory.files.slice(-50);
    state.memory.tasks = state.memory.tasks.slice(-40);
    state.memory.decisions = state.memory.decisions.slice(-60);
    state.memory.logs = state.memory.logs.slice(-150);
    state.messages = state.messages.slice(-50);

    const agentsSnapshot = {};
    for (const [aid, ag] of Object.entries(state.agents)) {
      agentsSnapshot[aid] = {
        x: ag.x,
        y: ag.y,
        target_x: ag.target_x,
        target_y: ag.target_y,
        status: ag.status,
        visual_state: ag.visual_state,
        facing: ag.facing,
        bubble: ag.bubble,
        bubble_until: ag.bubble_until,
        collaborating_with: ag.collaborating_with,
        provider: ag.profile.provider,
        model: ag.profile.model,
      };
    }

    await env.CHARON_KV.put(
      KV_MEMORY_KEY,
      JSON.stringify({
        ...state.memory,
        current_dag: state.current_dag,
        task_running: state.task_running,
        current_task: state.current_task,
        last_task_prompt: state.last_task_prompt,
        last_target_agent: state.last_target_agent,
        pending_approval: state.pending_approval,
        messages: state.messages,
        quotas: state.quotas,
        agents_snapshot: agentsSnapshot,
        updated_at: Date.now(),
      })
    );
  } catch {
    // Ignore KV write errors
  }
}

function syncEnvKeys(env) {
  if (!env) return;
  for (const [k, envKey] of Object.entries(KEY_FIELD_TO_ENV)) {
    if (state.deleted_keys.has(k)) continue;
    if (!state.keys[k] && env[envKey]) {
      state.keys[k] = String(env[envKey]).trim();
    }
  }
}

function getProviderStatus(env) {
  syncEnvKeys(env);
  return {
    openrouter: Boolean(state.keys.openrouter_api_key),
    gemini: Boolean(state.keys.gemini_api_key),
    groq: Boolean(state.keys.groq_api_key),
    cerebras: Boolean(state.keys.cerebras_api_key),
    deepseek: Boolean(state.keys.deepseek_api_key),
    siliconflow: Boolean(state.keys.siliconflow_api_key),
    zai: Boolean(state.keys.zai_api_key),
    cloudflare_ai: Boolean(env && env.AI),
  };
}

// ============================================================================
// Logging, Decisions & Memory Helpers
// ============================================================================

function addLog(level, source, message, meta = null) {
  const entry = {
    id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    ts: new Date().toISOString(),
    level,
    source,
    message,
    meta,
  };
  state.memory.logs.push(entry);
  if (state.memory.logs.length > 150) {
    state.memory.logs = state.memory.logs.slice(-150);
  }
  return entry;
}

function addDecision(actor, title, verdict, rationale) {
  const entry = {
    id: `dec-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    ts: new Date().toISOString(),
    actor,
    title,
    verdict,
    rationale,
  };
  state.memory.decisions.push(entry);
  if (state.memory.decisions.length > 60) {
    state.memory.decisions = state.memory.decisions.slice(-60);
  }
  return entry;
}

function upsertWorkspaceFile(filename, language, content, authorId, authorName) {
  const cleanName = String(filename || "artifact.txt")
    .replace(/^[/\\]+/, "")
    .replace(/\.\./g, "")
    .trim();
  const cleanContent = String(content || "");
  const record = {
    id: `file-${cleanName}`,
    filename: cleanName,
    language: language || inferLanguageFromName(cleanName),
    size: cleanContent.length,
    content: cleanContent,
    author: authorId,
    author_name: authorName,
    timestamp: new Date().toISOString(),
  };
  const idx = state.memory.files.findIndex((f) => f.filename === cleanName);
  if (idx >= 0) {
    state.memory.files[idx] = record;
  } else {
    state.memory.files.push(record);
  }
  return record;
}

function inferLanguageFromName(name) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  const map = {
    js: "javascript",
    jsx: "jsx",
    ts: "typescript",
    tsx: "tsx",
    py: "python",
    html: "html",
    css: "css",
    svg: "svg",
    sql: "sql",
    json: "json",
    md: "markdown",
    sh: "bash",
    yml: "yaml",
    yaml: "yaml",
  };
  return map[ext] || "text";
}

function extFromLanguage(lang) {
  const l = (lang || "").toLowerCase();
  const map = {
    javascript: "js",
    js: "js",
    typescript: "ts",
    ts: "ts",
    jsx: "jsx",
    tsx: "tsx",
    python: "py",
    py: "py",
    html: "html",
    css: "css",
    svg: "svg",
    sql: "sql",
    json: "json",
    markdown: "md",
    md: "md",
    bash: "sh",
    sh: "sh",
    glsl: "glsl",
  };
  return map[l] || "txt";
}

// ============================================================================
// Quota Manager & Model Router
// ============================================================================

function ensureQuotaBucket(provider, model) {
  const key = `${provider}/${model}`;
  if (!state.quotas[key]) {
    state.quotas[key] = {
      key,
      provider,
      model,
      status: "AVAILABLE",
      requests: 0,
      tokens: 0,
      rpm: 0,
      tpm: 0,
      rpd: 0,
      cost: 0,
      last_error: null,
      reset_time: null,
      quota_remaining: "UNKNOWN",
      _day: new Date().toISOString().slice(0, 10),
      _recent: [],
    };
  }
  return state.quotas[key];
}

function pruneAndComputeRates(bucket) {
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  if (bucket._day !== today) {
    bucket._day = today;
    bucket.rpd = 0;
  }
  if (!Array.isArray(bucket._recent)) bucket._recent = [];
  bucket._recent = bucket._recent.filter((item) => now - item.ts <= 60000);
  bucket.rpm = bucket._recent.length;
  bucket.tpm = bucket._recent.reduce((acc, item) => acc + item.tokens, 0);
}

function estimateCostUsd(provider, model, tokens) {
  if (provider === "cloudflare-ai" || provider === "antigravity") return 0;
  if (model.includes(":free") || provider === "groq" || provider === "cerebras" || provider === "gemini") {
    return 0;
  }
  if (provider === "deepseek") {
    return Number(((tokens / 1000000) * 0.28).toFixed(6));
  }
  return Number(((tokens / 1000000) * 0.15).toFixed(6));
}

function parseRateLimitHeaders(headers) {
  if (!headers) return {};
  const remReq =
    headers.get("x-ratelimit-remaining-requests") ||
    headers.get("x-ratelimit-remaining") ||
    headers.get("anthropic-ratelimit-requests-remaining");
  const remTok =
    headers.get("x-ratelimit-remaining-tokens") ||
    headers.get("anthropic-ratelimit-tokens-remaining");
  const resetReq =
    headers.get("x-ratelimit-reset-requests") ||
    headers.get("x-ratelimit-reset") ||
    headers.get("retry-after");

  let quota_remaining = null;
  if (remReq !== null && remReq !== undefined && remReq !== "") {
    quota_remaining = remTok ? `${remReq} req / ${remTok} tok` : `${remReq} req`;
  } else if (remTok) {
    quota_remaining = `${remTok} tok`;
  }

  return {
    quota_remaining,
    reset_time: resetReq || null,
  };
}

function recordQuotaSuccess(provider, model, tokens, headers = null) {
  const b = ensureQuotaBucket(provider, model);
  b.requests += 1;
  b.rpd = (b.rpd || 0) + 1;
  b.tokens += tokens;
  b.cost = Number((b.cost + estimateCostUsd(provider, model, tokens)).toFixed(6));
  b.status = "HEALTHY";
  b.last_error = null;
  if (!Array.isArray(b._recent)) b._recent = [];
  b._recent.push({ ts: Date.now(), tokens });
  pruneAndComputeRates(b);

  const hdr = parseRateLimitHeaders(headers);
  if (hdr.quota_remaining) b.quota_remaining = hdr.quota_remaining;
  if (hdr.reset_time) b.reset_time = hdr.reset_time;
}

function recordQuotaError(provider, model, errMsg, headers = null) {
  const b = ensureQuotaBucket(provider, model);
  b.requests += 1;
  b.rpd = (b.rpd || 0) + 1;
  b.last_error = String(errMsg || "Unknown error").slice(0, 180);
  b.status = String(errMsg).includes("429") ? "RATE_LIMITED" : "ERROR";
  b._last_err_ts = Date.now();
  if (!Array.isArray(b._recent)) b._recent = [];
  b._recent.push({ ts: Date.now(), tokens: 0 });
  pruneAndComputeRates(b);

  const hdr = parseRateLimitHeaders(headers);
  if (hdr.quota_remaining) b.quota_remaining = hdr.quota_remaining;
  if (hdr.reset_time) b.reset_time = hdr.reset_time;
}

function getSerializedQuotas() {
  return Object.values(state.quotas).map((b) => {
    if (Array.isArray(b._recent)) pruneAndComputeRates(b);
    return {
      key: b.key,
      provider: b.provider,
      model: b.model,
      status: b.status,
      requests: b.requests,
      tokens: b.tokens,
      rpm: b.rpm,
      tpm: b.tpm,
      rpd: b.rpd,
      cost: b.cost,
      last_error: b.last_error,
      reset_time: b.reset_time,
      quota_remaining: b.quota_remaining || "UNKNOWN",
      note: b.note || "",
    };
  });
}

async function callOpenAICompat(url, apiKey, model, systemPrompt, userPrompt, maxTokens = 1200, extraHeaders = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 11000);
  try {
    const resp = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...extraHeaders,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.5,
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      const err = new Error(`HTTP ${resp.status}: ${errText.slice(0, 120)}`);
      err.headers = resp.headers;
      throw err;
    }
    const data = await resp.json();
    const msgObj = data?.choices?.[0]?.message || {};
    const content = (msgObj.content || "").trim();
    if (!content) {
      const err = new Error("Empty completion response");
      err.headers = resp.headers;
      throw err;
    }
    const totalTokens =
      data?.usage?.total_tokens ||
      Math.ceil((systemPrompt.length + userPrompt.length + content.length) / 4);
    return { text: content, tokens: totalTokens, headers: resp.headers };
  } finally {
    clearTimeout(timer);
  }
}

async function callGemini(apiKey, model, systemPrompt, userPrompt, maxTokens = 1200) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 11000);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const resp = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.5 },
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      const err = new Error(`Gemini HTTP ${resp.status}: ${errText.slice(0, 120)}`);
      err.headers = resp.headers;
      throw err;
    }
    const data = await resp.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p.text || "").join("").trim();
    if (!text) {
      const err = new Error("Empty Gemini response");
      err.headers = resp.headers;
      throw err;
    }
    const totalTokens =
      data?.usageMetadata?.totalTokenCount ||
      Math.ceil((systemPrompt.length + userPrompt.length + text.length) / 4);
    return { text, tokens: totalTokens, headers: resp.headers };
  } finally {
    clearTimeout(timer);
  }
}

function buildRoutingChain(agentProfile) {
  const seen = new Set();
  const chain = [];
  const pushPair = (prov, mod, tier) => {
    if (!prov || !mod) return;
    const normMod = mod === "gemini-2.5-flash" ? "gemini-3-flash-preview" : mod;
    const key = `${prov}/${normMod}`;
    if (seen.has(key)) return;
    seen.add(key);
    chain.push({ provider: prov, model: normMod, tier });
  };

  // PRIMARY
  pushPair(agentProfile.provider, agentProfile.model, "PRIMARY");

  if (state.auto_routing) {
    // FALLBACK 1..3
    const agentChain = AGENT_FALLBACK_CHAINS[agentProfile.id] || [];
    agentChain.forEach(([p, m], idx) => pushPair(p, m, `FALLBACK_${idx + 1}`));
    // Remaining configured provider pool
    DEFAULT_FALLBACK_POOL.forEach(([p, m]) => pushPair(p, m, "FALLBACK_POOL"));
  }

  return chain;
}

async function invokeExternalProvider(prov, mod, systemPrompt, userPrompt, maxTokens) {
  if (prov === "openrouter" && state.keys.openrouter_api_key) {
    return callOpenAICompat(
      "https://openrouter.ai/api/v1/chat/completions",
      state.keys.openrouter_api_key,
      mod,
      systemPrompt,
      userPrompt,
      maxTokens,
      { "HTTP-Referer": "https://charon-office.pages.dev", "X-Title": "Charon 3D AI Office" }
    );
  }
  if (prov === "siliconflow" && state.keys.siliconflow_api_key) {
    return callOpenAICompat(
      "https://api.siliconflow.cn/v1/chat/completions",
      state.keys.siliconflow_api_key,
      mod,
      systemPrompt,
      userPrompt,
      maxTokens
    );
  }
  if (prov === "zai" && state.keys.zai_api_key) {
    return callOpenAICompat(
      "https://api.z.ai/api/paas/v4/chat/completions",
      state.keys.zai_api_key,
      mod,
      systemPrompt,
      userPrompt,
      maxTokens
    );
  }
  if (prov === "gemini" && state.keys.gemini_api_key) {
    return callGemini(state.keys.gemini_api_key, mod, systemPrompt, userPrompt, maxTokens);
  }
  if (prov === "groq" && state.keys.groq_api_key) {
    return callOpenAICompat(
      "https://api.groq.com/openai/v1/chat/completions",
      state.keys.groq_api_key,
      mod,
      systemPrompt,
      userPrompt,
      maxTokens
    );
  }
  if (prov === "cerebras" && state.keys.cerebras_api_key) {
    return callOpenAICompat(
      "https://api.cerebras.ai/v1/chat/completions",
      state.keys.cerebras_api_key,
      mod,
      systemPrompt,
      userPrompt,
      maxTokens
    );
  }
  if (prov === "deepseek" && state.keys.deepseek_api_key) {
    return callOpenAICompat(
      "https://api.deepseek.com/chat/completions",
      state.keys.deepseek_api_key,
      mod,
      systemPrompt,
      userPrompt,
      maxTokens
    );
  }
  return null;
}

async function generateAgentReply(agentProfile, userPrompt, env, maxTokens = 1200) {
  syncEnvKeys(env);
  const chain = buildRoutingChain(agentProfile);
  const errors = [];

  for (const step of chain) {
    const keyField = PROVIDER_TO_KEY_FIELD[step.provider];
    if (!keyField || !state.keys[keyField]) continue;
    const qKey = `${step.provider}/${step.model}`;
    const qBucket = state.quotas[qKey];
    if (qBucket && qBucket._last_err_ts && Date.now() - qBucket._last_err_ts < 120000) {
      continue;
    }
    try {
      const res = await invokeExternalProvider(
        step.provider,
        step.model,
        agentProfile.system_prompt,
        userPrompt,
        maxTokens
      );
      if (res && res.text) {
        recordQuotaSuccess(step.provider, step.model, res.tokens, res.headers);
        addLog("info", "router", `${agentProfile.name} -> ${step.provider}/${step.model} (${step.tier})`, {
          tokens: res.tokens,
        });
        return [res.text, `${step.provider}/${step.model}`];
      }
    } catch (err) {
      const msg = err?.message || "Provider request failed";
      recordQuotaError(step.provider, step.model, msg, err?.headers || null);
      errors.push(`${step.provider}/${step.model}: ${msg}`);
      addLog("warn", "router", `Fallback from ${step.provider}/${step.model}: ${msg}`);
    }
  }

  // Built-in Cloudflare Workers AI fallback (PRIMARY -> FALLBACK 1..3 -> CF AI)
  if (env && env.AI) {
    const cfCandidates = Array.from(
      new Set([
        agentProfile.cfModel || "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        "@cf/qwen/qwen2.5-coder-32b-instruct",
      ])
    );
    for (const cfMod of cfCandidates) {
      try {
        const res = await env.AI.run(cfMod, {
          messages: [
            { role: "system", content: agentProfile.system_prompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: maxTokens,
        });
        const text = (res && (res.response || res.result?.response || "")).trim();
        if (text) {
          const estTokens = Math.ceil((agentProfile.system_prompt.length + userPrompt.length + text.length) / 4);
          recordQuotaSuccess("cloudflare-ai", cfMod, estTokens, null);
          addLog("info", "router", `${agentProfile.name} -> cloudflare-ai/${cfMod.split("/").pop()} (CF_AI)`, {
            tokens: estTokens,
          });
          return [text, `cloudflare-ai/${cfMod.split("/").pop()}`];
        }
      } catch (err) {
        const msg = err?.message || "CF AI failed";
        recordQuotaError("cloudflare-ai", cfMod, msg, null);
        errors.push(`cloudflare-ai/${cfMod}: ${msg}`);
      }
    }
  }

  const summaryErr =
    errors.length > 0
      ? errors.join(" | ")
      : "No LLM providers configured (no API keys and no env.AI binding)";
  addLog("error", "router", `All LLM routes failed for ${agentProfile.id}: ${summaryErr}`);
  throw new Error(`LLM routing exhausted for ${agentProfile.name}: ${summaryErr}`);
}

// ============================================================================
// Real Agent Tools (Scout, Nova, Shader, Vector, Quant)
// ============================================================================

async function safeFetchWithTimeout(url, options = {}, timeoutMs = 5500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function runScoutResearchTool(promptText) {
  const urls = Array.from(new Set(promptText.match(/https?:\/\/[^\s"'<>]+/gi) || [])).slice(0, 3);
  const findings = [];

  // 1. Fetch any URLs explicitly mentioned in prompt
  for (const targetUrl of urls) {
    try {
      const resp = await safeFetchWithTimeout(targetUrl, {
        headers: { "User-Agent": "Charon-Scout-Bot/2.0" },
      });
      const contentType = resp.headers.get("content-type") || "";
      const server = resp.headers.get("server") || "unknown";
      const csp = resp.headers.get("content-security-policy") ? "present" : "missing";
      const xfo = resp.headers.get("x-frame-options") || "missing";
      let title = "";
      let snippet = "";
      if (contentType.includes("text") || contentType.includes("json")) {
        const raw = (await resp.text()).slice(0, 4000);
        const titleMatch = raw.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) title = titleMatch[1].trim();
        snippet = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400);
      }
      findings.push({
        source: targetUrl,
        type: "direct_url",
        status: resp.status,
        server,
        csp,
        x_frame_options: xfo,
        title,
        snippet,
      });
    } catch (err) {
      findings.push({
        source: targetUrl,
        type: "direct_url",
        error: err?.message || "Fetch failed",
      });
    }
  }

  // 2. Extract topic keywords for Wikipedia & GitHub search
  const cleanWords = promptText
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}\s_-]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 5)
    .join(" ");

  const query = cleanWords || "software architecture";

  // Wikipedia search (ru -> en fallback)
  try {
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query
    )}&srlimit=3&utf8=1&format=json`;
    const wResp = await safeFetchWithTimeout(wikiUrl, {
      headers: { "User-Agent": "Charon-Scout-Bot/2.0" },
    });
    if (wResp.ok) {
      const wData = await wResp.json();
      const hits = wData?.query?.search || [];
      for (const h of hits.slice(0, 2)) {
        findings.push({
          source: `https://en.wikipedia.org/wiki/${encodeURIComponent(h.title.replace(/ /g, "_"))}`,
          type: "wikipedia",
          title: h.title,
          snippet: String(h.snippet || "").replace(/<[^>]+>/g, ""),
        });
      }
    }
  } catch {
    // Non-fatal
  }

  // GitHub repositories search
  try {
    const ghUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(
      query
    )}&sort=stars&per_page=3`;
    const gResp = await safeFetchWithTimeout(ghUrl, {
      headers: {
        "User-Agent": "Charon-Scout-Bot/2.0",
        Accept: "application/vnd.github+json",
      },
    });
    if (gResp.ok) {
      const gData = await gResp.json();
      for (const repo of (gData?.items || []).slice(0, 3)) {
        findings.push({
          source: repo.html_url,
          type: "github_repo",
          title: repo.full_name,
          stars: repo.stargazers_count,
          language: repo.language,
          snippet: (repo.description || "").slice(0, 200),
        });
      }
    }
  } catch {
    // Non-fatal
  }

  addLog("info", "tool:scout", `Fetched ${findings.length} live research sources`, {
    query,
    sources: findings.map((f) => f.source),
  });
  return findings;
}

function parseCodeBlocksFromOutput(text, defaultPrefix, authorId, authorName) {
  const created = [];
  const normalizedText = (text || "").replace(/\r\n/g, "\n");
  const fenceCount = (normalizedText.match(/```/g) || []).length;
  const closedText = fenceCount % 2 === 1 ? `${normalizedText}\n\`\`\`` : normalizedText;

  const regex = /```([^\n`]*)\n([\s\S]*?)```/g;
  let match;
  let index = 1;

  while ((match = regex.exec(closedText)) !== null) {
    const header = (match[1] || "").trim();
    const code = (match[2] || "").trim();
    if (!code || code.length < 12) continue;

    let filename = "";
    let language = "";

    // Support ```filepath:src/app.js or ```filename=app.py or ```js:src/app.js
    const fpMatch =
      header.match(/^(?:filepath|file|path)\s*[:=]\s*([^\s]+)/i) ||
      header.match(/^([a-zA-Z0-9_-]+)\s*[:]\s*([^\s]+\.[a-zA-Z0-9]+)$/);
    if (fpMatch) {
      if (fpMatch[2]) {
        language = fpMatch[1].toLowerCase();
        filename = fpMatch[2];
      } else {
        filename = fpMatch[1];
        language = inferLanguageFromName(filename);
      }
    } else {
      language = header.split(/\s+/)[0].toLowerCase();
      // Check first line comment for filename hint
      const firstLine = code.split("\n")[0] || "";
      const commentHint = firstLine.match(
        /(?:\/\/|#|\/\*|<!--)\s*(?:file|filepath|filename)\s*:\s*([a-zA-Z0-9_./\\-]+)/i
      );
      if (commentHint) {
        filename = commentHint[1].trim();
      } else {
        const ext = extFromLanguage(language);
        filename = `${defaultPrefix}_${index}.${ext}`;
      }
    }

    const fileRec = upsertWorkspaceFile(filename, language || inferLanguageFromName(filename), code, authorId, authorName);
    created.push(fileRec);
    index += 1;
  }

  return created;
}

function runNovaCodeTool(llmOutput) {
  const files = parseCodeBlocksFromOutput(llmOutput, "src/module", "dev", "Нова");
  if (files.length === 0 && llmOutput && llmOutput.trim().length > 20) {
    files.push(
      upsertWorkspaceFile("src/implementation_spec.md", "markdown", llmOutput.trim(), "dev", "Нова")
    );
  }
  addLog("info", "tool:nova", `Parsed and saved ${files.length} code files to shared memory`, {
    filenames: files.map((f) => f.filename),
  });
  return files;
}

function runShaderDesignTool(llmOutput) {
  const files = parseCodeBlocksFromOutput(llmOutput, "design/artifact", "motion", "Шейдер");
  // Also catch raw inline <svg> if not inside a fenced block
  if (files.length === 0) {
    const svgMatch = llmOutput.match(/<svg[\s\S]*?<\/svg>/i);
    if (svgMatch) {
      files.push(
        upsertWorkspaceFile("design/concept.svg", "svg", svgMatch[0], "motion", "Шейдер")
      );
    } else if (llmOutput && llmOutput.trim().length > 20) {
      files.push(
        upsertWorkspaceFile("design/ui_concept.md", "markdown", llmOutput.trim(), "motion", "Шейдер")
      );
    }
  }
  addLog("info", "tool:shader", `Saved ${files.length} UI/SVG/CSS design artifacts`, {
    filenames: files.map((f) => f.filename),
  });
  return files;
}

function runVectorStaticSecurityTool(files) {
  const rules = [
    {
      id: "SECRET_EXPOSURE",
      severity: "HIGH",
      regex: /(?:sk-[A-Za-z0-9]{16,}|AIza[0-9A-Za-z\-_]{20,}|ghp_[A-Za-z0-9]{20,}|(?:api_key|secret|password)\s*[:=]\s*["'][^"']{6,}["'])/i,
      message: "Potential hardcoded secret/credential literal",
    },
    {
      id: "XSS_SINK",
      severity: "HIGH",
      regex: /(?:\.innerHTML\s*=|dangerouslySetInnerHTML|document\.write\s*\(|eval\s*\(|new\s+Function\s*\()/,
      message: "Unsafe DOM injection or dynamic code execution sink (XSS risk)",
    },
    {
      id: "SQL_INJECTION",
      severity: "CRITICAL",
      regex: /(?:`|\bf["']|["']\s*\+)\s*(?:SELECT|INSERT|UPDATE|DELETE)\b[\s\S]{0,80}(?:\$\{|\+\s*[a-zA-Z_])/i,
      message: "Potential SQL injection via string interpolation/concatenation",
    },
    {
      id: "INSECURE_TLS_OR_AUTH",
      severity: "MEDIUM",
      regex: /(?:verify\s*=\s*False|rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["']?0)/i,
      message: "Disabled TLS certificate verification",
    },
    {
      id: "CORS_WILDCARD",
      severity: "MEDIUM",
      regex: /Access-Control-Allow-Origin["']?\s*[:=]\s*["']\*["']/i,
      message: "Permissive CORS wildcard (*)",
    },
  ];

  const findings = [];
  for (const file of files) {
    const content = file.content || "";
    const lines = content.split("\n");
    for (const rule of rules) {
      lines.forEach((line, idx) => {
        if (rule.regex.test(line)) {
          findings.push({
            file: file.filename,
            line: idx + 1,
            rule: rule.id,
            severity: rule.severity,
            message: rule.message,
          });
        }
      });
    }
    if (file.language === "html" && !/Content-Security-Policy/i.test(content)) {
      findings.push({
        file: file.filename,
        line: 1,
        rule: "MISSING_CSP",
        severity: "LOW",
        message: "HTML file lacks a Content-Security-Policy meta/header reference",
      });
    }
  }

  addLog("info", "tool:vector", `Static security scan across ${files.length} files: ${findings.length} findings`, {
    findings: findings.slice(0, 15),
  });
  return findings;
}

function runQuantStructuralPrecheck(files) {
  const issues = [];
  if (!files || files.length === 0) {
    issues.push("No code or design artifacts found in shared workspace memory.");
    return issues;
  }
  for (const f of files) {
    if (!f.content || f.content.trim().length < 15) {
      issues.push(`File ${f.filename} is empty or trivial.`);
    }
    if (["javascript", "js", "ts", "jsx", "tsx", "css", "json"].includes(f.language)) {
      const openCurly = (f.content.match(/\{/g) || []).length;
      const closeCurly = (f.content.match(/\}/g) || []).length;
      if (Math.abs(openCurly - closeCurly) > 1) {
        issues.push(`File ${f.filename} has unbalanced curly braces ({:${openCurly} vs }:${closeCurly}).`);
      }
    }
    if (f.language === "json") {
      try {
        JSON.parse(f.content);
      } catch (e) {
        issues.push(`Invalid JSON in ${f.filename}: ${e.message}`);
      }
    }
  }
  return issues;
}

function parseQuantVerdict(text) {
  if (/\bVERDICT\s*:\s*REJECTED\b/i.test(text)) return "REJECTED";
  if (/\bVERDICT\s*:\s*APPROVED\b/i.test(text)) return "APPROVED";
  // Fallback heuristic if model phrased slightly differently
  if (/REJECTED|ОТКЛОНЕНО|НЕ ПРИНЯТО/i.test(text) && !/APPROVED|ОДОБРЕНО/i.test(text)) {
    return "REJECTED";
  }
  return "APPROVED";
}

// ============================================================================
// Grid Pathfinding & 3D Office Simulation
// ============================================================================

const ASTAR_DIRS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, 1.414],
  [1, -1, 1.414],
  [-1, 1, 1.414],
  [-1, -1, 1.414],
];

function astar(start, goal, occupiedSet) {
  if (start[0] === goal[0] && start[1] === goal[1]) return [];
  const key = (x, y) => `${x},${y}`;
  const open = [{ x: start[0], y: start[1], g: 0, f: 0 }];
  const cameFrom = new Map();
  const gScore = new Map([[key(start[0], start[1]), 0]]);

  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f);
    const cur = open.shift();
    if (cur.x === goal[0] && cur.y === goal[1]) {
      const path = [];
      let k = key(cur.x, cur.y);
      while (cameFrom.has(k)) {
        const [px, py] = k.split(",").map(Number);
        path.push([px, py]);
        k = cameFrom.get(k);
      }
      path.reverse();
      return path;
    }
    for (const [dx, dy, baseCost] of ASTAR_DIRS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
      // Prevent corner clipping on diagonal movement
      if (dx !== 0 && dy !== 0) {
        if (BLOCKED.has(key(cur.x + dx, cur.y)) || BLOCKED.has(key(cur.x, cur.y + dy))) {
          continue;
        }
      }
      const nk = key(nx, ny);
      const isGoal = nx === goal[0] && ny === goal[1];
      if (BLOCKED.has(nk) && !isGoal) continue;
      if (occupiedSet && occupiedSet.has(nk) && !isGoal) continue;
      const borderPenalty = nx === 0 || nx === GRID_W - 1 || ny === 0 || ny === GRID_H - 1 ? 0.35 : 0;
      const tg = (gScore.get(key(cur.x, cur.y)) ?? 9999) + baseCost + borderPenalty;
      if (tg < (gScore.get(nk) ?? 9999)) {
        cameFrom.set(nk, key(cur.x, cur.y));
        gScore.set(nk, tg);
        const h = Math.hypot(goal[0] - nx, goal[1] - ny);
        open.push({ x: nx, y: ny, g: tg, f: tg + h });
      }
    }
  }
  return [];
}

function mapStatusToVisual(status) {
  const s = String(status || "idle").toLowerCase();
  if (s === "working") return "WORKING";
  if (s === "meeting") return "COLLABORATING";
  if (s === "thinking") return "THINKING";
  if (s === "reviewing") return "REVIEWING";
  if (s === "blocked") return "BLOCKED";
  if (s === "error") return "ERROR";
  if (s === "completed") return "COMPLETED";
  return "IDLE";
}

function setAgentVisual(id, visualState, status = null) {
  const st = state.agents[id];
  if (!st) return;
  const normalized = VISUAL_STATES.has(visualState) ? visualState : "IDLE";
  st.visual_state = normalized;
  st.post_visual_state = normalized;
  if (status) {
    st.status = status;
    st.post_status = status;
  }
}

function serializeAgent(st) {
  const now = Date.now();
  const chain = AGENT_FALLBACK_CHAINS[st.profile.id] || [];
  return {
    id: st.profile.id,
    name: st.profile.name,
    role: st.profile.role,
    specialty: st.profile.specialty,
    color: st.profile.color,
    provider: st.profile.provider,
    model: st.profile.model,
    cfModel: st.profile.cfModel,
    fallback_models: chain.map(([p, m]) => `${p}/${m}`),
    x: Number(st.x.toFixed(3)),
    y: Number(st.y.toFixed(3)),
    target_x: st.target_x ?? Math.round(st.x),
    target_y: st.target_y ?? Math.round(st.y),
    look_target: st.look_target || null,
    path: Array.isArray(st.path) ? st.path.slice(0, 16) : [],
    facing: Number((st.facing || 0).toFixed(3)),
    status: st.status,
    visual_state: st.visual_state || mapStatusToVisual(st.status),
    bubble: now < st.bubble_until ? st.bubble : "",
    collaborating_with: st.collaborating_with,
  };
}

function getSnapshot(env) {
  return {
    type: "state",
    agents: Object.values(state.agents).map(serializeAgent),
    economy_mode: state.economy_mode,
    auto_routing: state.auto_routing,
    task_running: state.task_running,
    current_task: state.current_task,
    current_dag: state.current_dag,
    providers: getProviderStatus(env),
    quotas: getSerializedQuotas(),
    memory_summary: state.memory.summary,
    files: state.memory.files,
    tasks: state.memory.tasks,
    decisions: state.memory.decisions,
    logs: state.memory.logs.slice(-80),
    pending_approval: state.pending_approval,
    messages: state.messages.slice(-50),
  };
}

function broadcast(payload) {
  const raw = JSON.stringify(payload);
  for (const ws of Array.from(state.sockets)) {
    try {
      ws.send(raw);
    } catch {
      state.sockets.delete(ws);
    }
  }
}

function setBubble(id, text, durationMs = 8500) {
  const st = state.agents[id];
  if (!st) return;
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  st.bubble = clean.length > 120 ? clean.slice(0, 120) + "…" : clean;
  st.bubble_until = Date.now() + durationMs;
}

function pushMessage(sender_id, sender_name, role, color, text, model = "", type = "chat") {
  const d = new Date();
  const ts = d.toTimeString().slice(0, 8);
  const msg = {
    id: `${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
    ts,
    sender_id,
    sender_name,
    role,
    color,
    text,
    model,
    type,
  };
  state.messages.push(msg);
  if (state.messages.length > 100) state.messages = state.messages.slice(-100);
  broadcast({ type: "message", message: msg });
}

function moveAgent(id, gx, gy, postStatus = "idle", lookAt = null, postVisualState = null) {
  const st = state.agents[id];
  if (!st) return;
  const occupied = new Set();
  for (const [oid, ost] of Object.entries(state.agents)) {
    if (oid !== id) {
      occupied.add(`${Math.round(ost.x)},${Math.round(ost.y)}`);
      occupied.add(`${ost.target_x},${ost.target_y}`);
    }
  }
  st.target_x = gx;
  st.target_y = gy;
  st.look_target = lookAt;
  st.post_status = postStatus;
  st.post_visual_state = postVisualState || mapStatusToVisual(postStatus);
  st.path = astar([Math.round(st.x), Math.round(st.y)], [gx, gy], occupied);
  if (st.path.length > 0) {
    st.status = "walking";
    // Preserve active visual_state while walking if already collaborating/working/thinking
    if (!postVisualState) {
      st.visual_state = mapStatusToVisual(postStatus);
    } else {
      st.visual_state = st.post_visual_state;
    }
  } else {
    st.status = postStatus;
    st.visual_state = st.post_visual_state;
    if (lookAt) {
      st.facing = Math.atan2(lookAt[0] - st.x, lookAt[1] - st.y);
    }
  }
}

function stepSimulation() {
  const now = Date.now();
  const rawDt = state.lastStepAt ? (now - state.lastStepAt) / 1000 : 0.14;
  state.lastStepAt = now;
  const dt = Math.min(0.45, Math.max(0.05, rawDt));
  const stepBudget = 2.85 * dt;
  let changed = false;

  for (const st of Object.values(state.agents)) {
    if (st.path && st.path.length > 0) {
      let rem = stepBudget;
      while (rem > 0.0001 && st.path.length > 0) {
        const [nx, ny] = st.path[0];
        const dx = nx - st.x;
        const dy = ny - st.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.001) {
          st.facing = Math.atan2(dx, dy);
        }
        if (dist <= rem) {
          st.x = nx;
          st.y = ny;
          rem -= dist;
          st.path.shift();
          if (st.path.length === 0) {
            st.status = st.post_status || "idle";
            st.visual_state = st.post_visual_state || mapStatusToVisual(st.status);
            if (st.look_target) {
              st.facing = Math.atan2(st.look_target[0] - st.x, st.look_target[1] - st.y);
            }
          }
        } else {
          st.x += (dx / dist) * rem;
          st.y += (dy / dist) * rem;
          rem = 0;
        }
      }
      changed = true;
    }
  }

  if (!state.task_running && !state.pending_approval && now - state.lastWander > 9000) {
    state.lastWander = now;
    const ids = Object.keys(state.agents);
    const pick = ids[Math.floor(Math.random() * ids.length)];
    const st = state.agents[pick];
    if (!st.path || st.path.length === 0) {
      if (Math.random() < 0.5) {
        const spots = [...LOUNGE_SPOTS, ...COFFEE_SPOTS];
        const [gx, gy] = spots[Math.floor(Math.random() * spots.length)];
        moveAgent(pick, gx, gy, "idle", [8, 5], "IDLE");
        const phrase = st.profile.idle_phrases[Math.floor(Math.random() * st.profile.idle_phrases.length)];
        setBubble(pick, phrase, 6500);
      } else {
        const [dx, dy] = st.profile.desk_pos;
        moveAgent(pick, dx, dy, "idle", st.profile.look_pos, "IDLE");
      }
      changed = true;
    }
  }

  if (changed || state.sockets.size > 0) {
    broadcast({
      type: "positions",
      agents: Object.values(state.agents).map(serializeAgent),
      task_running: state.task_running,
    });
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function advanceTicks(durationMs) {
  const steps = Math.max(1, Math.floor(durationMs / 140));
  for (let i = 0; i < steps; i++) {
    if (state.task_abort) return;
    stepSimulation();
    await sleep(140);
  }
}

// ============================================================================
// DAG Task Orchestration Engine (runDagWorkflow) & Human Control Gate
// ============================================================================

function createInitialDag(promptText, targetAgent) {
  const id = `dag-${Date.now()}`;
  const mkNode = (nodeId, label, agentId, dependsOn) => ({
    id: nodeId,
    label,
    agent: agentId,
    agent_name: state.agents[agentId]?.profile.name || agentId,
    depends_on: dependsOn,
    status: "PENDING",
    started_at: null,
    finished_at: null,
    model_used: "",
    output_preview: "",
    error: null,
  });

  if (targetAgent !== "all" && state.agents[targetAgent]) {
    return {
      id,
      prompt: promptText,
      target_agent: targetAgent,
      status: "RUNNING",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      revision_round: 0,
      nodes: [mkNode("direct", `Задача для ${state.agents[targetAgent].profile.name}`, targetAgent, [])],
    };
  }

  return {
    id,
    prompt: promptText,
    target_agent: "all",
    status: "RUNNING",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    revision_round: 0,
    nodes: [
      mkNode("plan", "1. Стратегический план (Атлас)", "lead", []),
      mkNode("research", "2a. Веб-исследование (Скаут)", "scout", ["plan"]),
      mkNode("design", "2b. UI/Motion-дизайн (Шейдер)", "motion", ["plan"]),
      mkNode("marketing", "2c. GTM и маркетинг (Пульс)", "growth", ["plan"]),
      mkNode("implementation", "3. Разработка кода (Нова)", "dev", ["research", "design"]),
      mkNode("sec_audit", "4. OWASP-аудит кода (Вектор)", "cybersec", ["implementation"]),
      mkNode("qa_review", "5. Независимая QA-приёмка (Квант)", "quant", ["implementation", "sec_audit"]),
      mkNode("revision", "6. Доработка по замечаниям (Нова)", "dev", ["qa_review"]),
      mkNode("final_approval", "7. Финальная сборка (Атлас)", "lead", ["qa_review", "revision"]),
    ],
  };
}

async function updateDagNode(nodeId, patch, env = null) {
  if (!state.current_dag) return;
  const node = state.current_dag.nodes.find((n) => n.id === nodeId);
  if (node) {
    Object.assign(node, patch);
  }
  state.current_dag.updated_at = new Date().toISOString();
  broadcast({
    type: "dag_update",
    current_dag: state.current_dag,
    files: state.memory.files,
    logs: state.memory.logs.slice(-40),
    decisions: state.memory.decisions.slice(-20),
    quotas: getSerializedQuotas(),
    pending_approval: state.pending_approval,
    agents: Object.values(state.agents).map(serializeAgent),
  });
  if (env) {
    await saveMemoryToKV(env);
  }
}

function detectDestructiveKeyword(promptText) {
  const lower = promptText.toLowerCase();
  return DESTRUCTIVE_KEYWORDS.find((kw) => lower.includes(kw)) || null;
}

async function enterHumanApprovalGate(promptText, targetAgent, matchedKw, env) {
  state.current_dag.status = "BLOCKED";
  state.pending_approval = {
    id: `gate-${Date.now()}`,
    prompt: promptText,
    target_agent: targetAgent,
    matched_rule: matchedKw,
    reason: `Обнаружена потенциально опасная операция: «${matchedKw}». Требуется явное подтверждение босса.`,
    requested_at: new Date().toISOString(),
  };

  setAgentVisual("lead", "BLOCKED", "idle");
  setBubble("lead", `Ожидаю подтверждения: «${matchedKw}»`, 60000);
  addLog("warn", "human_gate", `DAG paused in BLOCKED state (keyword: ${matchedKw})`);
  pushMessage(
    "lead",
    "Атлас (Human Gate)",
    "Тимлид / Контроль",
    "#f59e0b",
    `⚠️ Задача поставлена на паузу (BLOCKED): обнаружено действие «${matchedKw}». Подтвердите или отклоните выполнение через панель одобрения.`,
    "policy-gate",
    "system"
  );
  await saveMemoryToKV(env);
  broadcast(getSnapshot(env));
}

async function runDagWorkflow(promptText, targetAgent, env, bypassGate = false) {
  if (state.task_running) return;
  await ensureKVLoaded(env);

  state.local_running = true;
  state.task_running = true;
  state.task_abort = false;
  state.current_task = promptText;
  state.last_task_prompt = promptText;
  state.last_target_agent = targetAgent;
  state.current_dag = createInitialDag(promptText, targetAgent);

  const outputs = {};
  let pausedForGate = false;

  try {
    if (!bypassGate) {
      pushMessage("user", "Вы (Босс)", "Постановщик задачи", "#ffffff", promptText, "", "user");
    }
    addLog("info", "dag", `Started DAG ${state.current_dag.id} (${targetAgent})`, { prompt: promptText.slice(0, 120) });
    await saveMemoryToKV(env);

    // Human Control Gate check (works across any Cloudflare isolate via CHARON_KV)
    if (!bypassGate) {
      const matchedKw = detectDestructiveKeyword(promptText);
      if (matchedKw) {
        pausedForGate = true;
        await enterHumanApprovalGate(promptText, targetAgent, matchedKw, env);
        return;
      }
    }

    // Single-agent targeted execution (with real tools!)
    if (targetAgent !== "all" && state.agents[targetAgent]) {
      const st = state.agents[targetAgent];
      const prof = st.profile;
      await updateDagNode("direct", { status: "RUNNING", started_at: new Date().toISOString() }, env);
      moveAgent(targetAgent, prof.desk_pos[0], prof.desk_pos[1], "working", prof.look_pos, "WORKING");
      setBubble(targetAgent, "Принял задачу, работаю…", 6000);
      await advanceTicks(250);
      if (state.task_abort) return;

      let enrichedPrompt = promptText;
      if (targetAgent === "scout") {
        setAgentVisual("scout", "THINKING", "working");
        const sources = await runScoutResearchTool(promptText);
        enrichedPrompt = `${promptText}\n\nРеальные данные из веб-инструментов:\n${JSON.stringify(sources, null, 2)}`;
      } else if (targetAgent === "cybersec") {
        setAgentVisual("cybersec", "REVIEWING", "working");
        const secFindings = runVectorStaticSecurityTool(state.memory.files);
        enrichedPrompt = `${promptText}\n\nРезультаты статического сканирования текущих файлов (${state.memory.files.length}):\n${JSON.stringify(secFindings, null, 2)}`;
      } else if (targetAgent === "quant") {
        setAgentVisual("quant", "REVIEWING", "working");
        const precheck = runQuantStructuralPrecheck(state.memory.files);
        enrichedPrompt = `${promptText}\n\nФайлы в памяти (${state.memory.files.length}): ${state.memory.files.map((f) => f.filename).join(", ")}\nПречек: ${JSON.stringify(precheck)}`;
      }

      const [reply, used] = await generateAgentReply(prof, enrichedPrompt, env, 750);
      if (state.task_abort) return;

      if (targetAgent === "dev") runNovaCodeTool(reply);
      if (targetAgent === "motion") runShaderDesignTool(reply);

      setAgentVisual(targetAgent, "COMPLETED", "working");
      setBubble(targetAgent, reply, 9000);
      pushMessage(prof.id, prof.name, prof.role, prof.color, reply, used, "result");
      state.current_dag.status = "COMPLETED";
      state.memory.tasks.push({
        id: state.current_dag.id,
        prompt: promptText,
        target: targetAgent,
        status: "COMPLETED",
        summary: reply.slice(0, 300),
        timestamp: new Date().toISOString(),
      });
      await updateDagNode(
        "direct",
        {
          status: "COMPLETED",
          finished_at: new Date().toISOString(),
          model_used: used,
          output_preview: reply.slice(0, 240),
        },
        env
      );
      return;
    }

    // ------------------------------------------------------------------------
    // FULL 7-AGENT DAG WORKFLOW
    // ------------------------------------------------------------------------

    // Step 1: PLAN (Lead / Atlas in conference pod)
    for (const [aid, st] of Object.entries(state.agents)) {
      moveAgent(aid, st.profile.meeting_pos[0], st.profile.meeting_pos[1], "meeting", [8, 5], "COLLABORATING");
    }
    setAgentVisual("lead", "THINKING", "meeting");
    setBubble("lead", "Команда, собираемся на планёрку!", 6000);
    await updateDagNode("plan", { status: "RUNNING", started_at: new Date().toISOString() }, env);
    await advanceTicks(250);
    if (state.task_abort) return;

    const leadProf = state.agents.lead.profile;
    const planPrompt =
      `Босс поставил задачу: «${promptText}».\n` +
      `Сформируй краткий чёткий план распределения задач в DAG-пайплайне для команды:\n` +
      `1) Скаут (веб-исследование и технологии)\n2) Шейдер (UI/CSS/SVG дизайн)\n3) Пульс (маркетинг и GTM)\n4) Нова (код и файлы)\n5) Вектор (OWASP-аудит)\n6) Квант (независимая QA-приёмка).`;

    const [planText, leadMod] = await generateAgentReply(leadProf, planPrompt, env, 900);
    if (state.task_abort) return;

    outputs.plan = planText;
    setBubble("lead", planText, 8000);
    pushMessage(leadProf.id, leadProf.name, leadProf.role, leadProf.color, planText, leadMod, "chat");
    await updateDagNode(
      "plan",
      {
        status: "COMPLETED",
        finished_at: new Date().toISOString(),
        model_used: leadMod,
        output_preview: planText.slice(0, 240),
      },
      env
    );

    // Step 2: PARALLEL BRANCH — Research (Scout), Design (Shader), Marketing (Pulse)
    const parallelSpecs = [
      { nodeId: "research", agentId: "scout" },
      { nodeId: "design", agentId: "motion" },
      { nodeId: "marketing", agentId: "growth" },
    ];

    for (const { nodeId, agentId } of parallelSpecs) {
      const st = state.agents[agentId];
      moveAgent(agentId, st.profile.desk_pos[0], st.profile.desk_pos[1], "working", st.profile.look_pos, "WORKING");
      setBubble(agentId, "Выполняю свой узел DAG…", 5000);
      await updateDagNode(nodeId, { status: "RUNNING", started_at: new Date().toISOString() });
    }
    // Move dev/cybersec/quant back to desks ready for next stages
    for (const standbyId of ["lead", "dev", "cybersec", "quant"]) {
      const st = state.agents[standbyId];
      moveAgent(standbyId, st.profile.desk_pos[0], st.profile.desk_pos[1], "idle", st.profile.look_pos, "IDLE");
    }
    await saveMemoryToKV(env);
    await advanceTicks(250);
    if (state.task_abort) return;

    await Promise.all(
      parallelSpecs.map(async ({ nodeId, agentId }) => {
        const prof = state.agents[agentId].profile;
        try {
          let spPrompt = `Задача: «${promptText}».\nПлан Атласа:\n${planText}\n\n`;
          if (agentId === "scout") {
            setAgentVisual("scout", "THINKING", "working");
            const researchData = await runScoutResearchTool(promptText);
            spPrompt +=
              `Результаты реального веб-поиска и анализа URL (fetch):\n${JSON.stringify(researchData, null, 2)}\n\n` +
              `Сделай структурированное технологическое сравнение с обязательным указанием проверенных источников и URL.`;
          } else if (agentId === "motion") {
            spPrompt +=
              `Создай краткую визуальную концепцию и сразу выведи 2 компактных дизайн-артефакта (CSS-тема и SVG-схема) в fenced-блоках:\n` +
              "```filepath:design/theme.css\n...\n```\nи\n```filepath:design/preview.svg\n<svg ...>...</svg>\n```";
          } else {
            spPrompt += `Разработай Go-To-Market стратегию, ключевые хуки, позиционирование и план продвижения.`;
          }

          const [ans, mod] = await generateAgentReply(prof, spPrompt, env, agentId === "motion" ? 1500 : 1100);
          if (state.task_abort) return;

          outputs[nodeId] = ans;
          if (agentId === "motion") {
            runShaderDesignTool(ans);
          }

          setAgentVisual(agentId, "COMPLETED", "working");
          setBubble(agentId, ans, 8000);
          pushMessage(prof.id, prof.name, prof.role, prof.color, ans, mod, "chat");
          await updateDagNode(
            nodeId,
            {
              status: "COMPLETED",
              finished_at: new Date().toISOString(),
              model_used: mod,
              output_preview: ans.slice(0, 240),
            },
            env
          );
        } catch (err) {
          setAgentVisual(agentId, "ERROR", "idle");
          await updateDagNode(
            nodeId,
            {
              status: "FAILED",
              finished_at: new Date().toISOString(),
              error: err?.message || "Node failed",
            },
            env
          );
          throw err;
        }
      })
    );
    if (state.task_abort) return;

    // Step 3: IMPLEMENTATION (Dev / Nova depends on research + design)
    state.agents.scout.collaborating_with = "dev";
    state.agents.dev.collaborating_with = "scout";
    moveAgent("scout", COLLAB_VISIT_POS.dev[0], COLLAB_VISIT_POS.dev[1], "working", state.agents.dev.profile.desk_pos, "COLLABORATING");
    moveAgent("dev", state.agents.dev.profile.desk_pos[0], state.agents.dev.profile.desk_pos[1], "working", state.agents.dev.profile.look_pos, "WORKING");
    setBubble("scout", "Нова, передаю итоги исследования!", 5000);
    setBubble("dev", "Пишу код на основе исследования и дизайна…", 6500);
    await updateDagNode("implementation", { status: "RUNNING", started_at: new Date().toISOString() }, env);
    await advanceTicks(250);
    state.agents.scout.collaborating_with = null;
    state.agents.dev.collaborating_with = null;
    moveAgent("scout", state.agents.scout.profile.desk_pos[0], state.agents.scout.profile.desk_pos[1], "idle", state.agents.scout.profile.look_pos, "COMPLETED");
    if (state.task_abort) return;

    const devProf = state.agents.dev.profile;
    const designFilesHint = state.memory.files.map((f) => `- ${f.filename} (${f.language}, ${f.size} байт)`).join("\n");
    const devPrompt =
      `Задача босса: «${promptText}».\n\n` +
      `Исследование Скаута:\n${(outputs.research || "").slice(0, 900)}\n\n` +
      `Дизайн Шейдера:\n${(outputs.design || "").slice(0, 900)}\n\n` +
      `Файлы дизайна уже в памяти:\n${designFilesHint || "(нет)"}\n\n` +
      `Напиши чистый, безопасный, рабочий код реализации (например schema.sql, server.js, App.jsx). ОБЯЗАТЕЛЬНО оформи каждый файл в отдельный блок с указанием пути:\n` +
      "```filepath:src/server.js\n// ...\n```\n```filepath:src/schema.sql\n-- ...\n```";

    const [devAns, devMod] = await generateAgentReply(devProf, devPrompt, env, 1800);
    if (state.task_abort) return;

    outputs.implementation = devAns;
    const novaFiles = runNovaCodeTool(devAns);
    setAgentVisual("dev", "COMPLETED", "working");
    setBubble("dev", `Код готов (${novaFiles.length} файл(ов) сохранено).`, 8000);
    pushMessage(devProf.id, devProf.name, devProf.role, devProf.color, devAns, devMod, "chat");
    await updateDagNode(
      "implementation",
      {
        status: "COMPLETED",
        finished_at: new Date().toISOString(),
        model_used: devMod,
        output_preview: `${novaFiles.length} file(s): ${novaFiles.map((f) => f.filename).join(", ")}`,
      },
      env
    );

    // Step 4: SECURITY AUDIT (CyberSec / Vector depends on implementation)
    state.agents.cybersec.collaborating_with = "dev";
    state.agents.dev.collaborating_with = "cybersec";
    moveAgent("cybersec", COLLAB_VISIT_POS.dev[0], COLLAB_VISIT_POS.dev[1], "working", state.agents.dev.profile.desk_pos, "REVIEWING");
    setBubble("cybersec", "Нова, провожу статический OWASP-аудит файлов…", 6500);
    await updateDagNode("sec_audit", { status: "RUNNING", started_at: new Date().toISOString() }, env);
    await advanceTicks(250);
    if (state.task_abort) return;

    const secFindings = runVectorStaticSecurityTool(state.memory.files);
    const secProf = state.agents.cybersec.profile;
    const filesForSec = state.memory.files
      .map((f) => `### ${f.filename} (${f.language})\n\`\`\`${f.language}\n${f.content.slice(0, 1200)}\n\`\`\``)
      .join("\n\n");

    const secPrompt =
      `Проведи OWASP-аудит реализации задачи «${promptText}».\n\n` +
      `Результаты автоматического статического анализатора:\n${JSON.stringify(secFindings, null, 2)}\n\n` +
      `Файлы проекта:\n${filesForSec || outputs.implementation.slice(0, 1500)}\n\n` +
      `Сформируй структурированный OWASP-отчёт (Auth, XSS/SQLi, Secrets, CORS, CSP) и рекомендации по харденингу.`;

    const [secAns, secMod] = await generateAgentReply(secProf, secPrompt, env, 1100);
    if (state.task_abort) return;

    outputs.sec_audit = secAns;
    upsertWorkspaceFile("security/owasp_audit.md", "markdown", secAns, "cybersec", "Вектор");
    state.agents.cybersec.collaborating_with = null;
    state.agents.dev.collaborating_with = null;
    moveAgent("cybersec", secProf.desk_pos[0], secProf.desk_pos[1], "idle", secProf.look_pos, "COMPLETED");
    setBubble("cybersec", `OWASP-аудит завершён (находок: ${secFindings.length}).`, 8000);
    pushMessage(secProf.id, secProf.name, secProf.role, secProf.color, secAns, secMod, "chat");
    await updateDagNode(
      "sec_audit",
      {
        status: "COMPLETED",
        finished_at: new Date().toISOString(),
        model_used: secMod,
        output_preview: `Static findings: ${secFindings.length}. ${secAns.slice(0, 180)}`,
      },
      env
    );

    // Step 5 & 6: INDEPENDENT QA REVIEW (Quant) + CONDITIONAL REVISION (up to 1 round)
    const runQuantReview = async (round) => {
      const qProf = state.agents.quant.profile;
      state.agents.quant.collaborating_with = "dev";
      moveAgent("quant", COLLAB_VISIT_POS.dev[0], COLLAB_VISIT_POS.dev[1], "working", state.agents.dev.profile.desk_pos, "REVIEWING");
      setBubble("quant", `Раунд ${round + 1}: независимый QA-аудит кода и архитектуры…`, 6500);
      await updateDagNode("qa_review", { status: "RUNNING", started_at: new Date().toISOString() }, env);
      await advanceTicks(250);
      state.agents.quant.collaborating_with = null;
      moveAgent("quant", qProf.desk_pos[0], qProf.desk_pos[1], "working", qProf.look_pos, "REVIEWING");
      if (state.task_abort) return null;

      const precheckIssues = runQuantStructuralPrecheck(state.memory.files);
      const currentFilesSummary = state.memory.files
        .map((f) => `- ${f.filename} (${f.language}, ${f.size} байт):\n${f.content.slice(0, 900)}`)
        .join("\n\n");

      const quantPrompt =
        `Независимый QA-аудит (раунд ${round + 1}) для задачи: «${promptText}».\n\n` +
        `Автопроверка структуры/синтаксиса:\n${precheckIssues.length ? precheckIssues.join("\n") : "Критических структурных ошибок не найдено."}\n\n` +
        `Отчёт безопасности Вектора:\n${(outputs.sec_audit || "").slice(0, 900)}\n\n` +
        `Файлы в рабочей памяти (${state.memory.files.length}):\n${currentFilesSummary}\n\n` +
        `Проверь полноту решения, качество кода, дизайн и безопасность. Заверши ответ строгой строкой:\nVERDICT: APPROVED\nили\nVERDICT: REJECTED\nсо списком дефектов.`;

      const [qAns, qMod] = await generateAgentReply(qProf, quantPrompt, env, 1100);
      if (state.task_abort) return null;

      const verdict = parseQuantVerdict(qAns);
      outputs.qa_review = qAns;
      addDecision("Квант (QA)", `QA Audit Round ${round + 1}`, verdict, qAns.slice(0, 260));
      setAgentVisual("quant", verdict === "APPROVED" ? "COMPLETED" : "REVIEWING", "working");
      setBubble("quant", `QA Вердикт: ${verdict}`, 8000);
      pushMessage(qProf.id, qProf.name, qProf.role, qProf.color, qAns, qMod, "chat");
      await updateDagNode(
        "qa_review",
        {
          status: "COMPLETED",
          finished_at: new Date().toISOString(),
          model_used: qMod,
          output_preview: `VERDICT: ${verdict}. ${qAns.slice(0, 180)}`,
        },
        env
      );
      return { verdict, report: qAns };
    };

    const qaFirst = await runQuantReview(0);
    if (!qaFirst || state.task_abort) return;

    if (qaFirst.verdict === "REJECTED") {
      state.current_dag.revision_round = 1;
      moveAgent("dev", devProf.desk_pos[0], devProf.desk_pos[1], "working", devProf.look_pos, "WORKING");
      setBubble("dev", "Квант выявил дефекты — исправляю код…", 6500);
      await updateDagNode("revision", { status: "RUNNING", started_at: new Date().toISOString() }, env);
      await advanceTicks(250);
      if (state.task_abort) return;

      const revPrompt =
        `Квант отклонил сборку (VERDICT: REJECTED). Дефекты:\n${qaFirst.report}\n\n` +
        `Исправь указанные дефекты в коде/конфигурации для задачи «${promptText}» и выведи обновлённые файлы в блоках \`\`\`filepath:...`;

      const [revAns, revMod] = await generateAgentReply(devProf, revPrompt, env, 1500);
      if (state.task_abort) return;

      const revisedFiles = runNovaCodeTool(revAns);
      outputs.revision = revAns;
      setAgentVisual("dev", "COMPLETED", "working");
      pushMessage(devProf.id, `${devProf.name} (Ревизия)`, devProf.role, devProf.color, revAns, revMod, "chat");
      await updateDagNode(
        "revision",
        {
          status: "COMPLETED",
          finished_at: new Date().toISOString(),
          model_used: revMod,
          output_preview: `Updated ${revisedFiles.length} file(s) after QA feedback`,
        },
        env
      );

      // Re-run Quant verification once
      const qaSecond = await runQuantReview(1);
      if (!qaSecond || state.task_abort) return;
    } else {
      await updateDagNode(
        "revision",
        {
          status: "SKIPPED",
          finished_at: new Date().toISOString(),
          output_preview: "Skipped (VERDICT: APPROVED on first pass)",
        },
        env
      );
    }

    // Step 7: FINAL APPROVAL (Lead / Atlas)
    moveAgent("lead", leadProf.desk_pos[0], leadProf.desk_pos[1], "working", leadProf.look_pos, "THINKING");
    setBubble("lead", "Собираю финальный релизный отчёт…", 6000);
    await updateDagNode("final_approval", { status: "RUNNING", started_at: new Date().toISOString() }, env);
    await advanceTicks(250);
    if (state.task_abort) return;

    const finalPrompt =
      `Задача босса: «${promptText}».\n\n` +
      `Итоги команды:\n` +
      `### Скаут (Исследование):\n${(outputs.research || "").slice(0, 700)}\n\n` +
      `### Шейдер (UI/Дизайн):\n${(outputs.design || "").slice(0, 600)}\n\n` +
      `### Пульс (Маркетинг):\n${(outputs.marketing || "").slice(0, 600)}\n\n` +
      `### Нова (Реализация):\n${(outputs.revision || outputs.implementation || "").slice(0, 800)}\n\n` +
      `### Вектор (OWASP-аудит):\n${(outputs.sec_audit || "").slice(0, 600)}\n\n` +
      `### Квант (QA-вердикт):\n${(outputs.qa_review || "").slice(0, 600)}\n\n` +
      `Файлы в рабочей памяти: ${state.memory.files.map((f) => f.filename).join(", ")}.\n` +
      `Собери единый, структурированный финальный мастер-отчёт для босса.`;

    const [finalText, finalMod] = await generateAgentReply(leadProf, finalPrompt, env, 1200);
    if (state.task_abort) return;

    setAgentVisual("lead", "COMPLETED", "working");
    setBubble("lead", "Готово! Финальный отчёт в чате.", 9000);
    pushMessage(leadProf.id, `${leadProf.name} (Итог)`, leadProf.role, leadProf.color, finalText, finalMod, "result");

    state.current_dag.status = "COMPLETED";
    state.memory.summary = `Последняя задача (${new Date().toISOString().slice(0, 16)}): ${promptText.slice(0, 140)} — завершена (файлов: ${state.memory.files.length}).`;
    state.memory.tasks.push({
      id: state.current_dag.id,
      prompt: promptText,
      target: targetAgent,
      status: "COMPLETED",
      files_count: state.memory.files.length,
      revision_round: state.current_dag.revision_round,
      summary: finalText.slice(0, 320),
      timestamp: new Date().toISOString(),
    });
    addDecision("Атлас (Lead)", "Final Release Approval", "COMPLETED", `Утверждено файлов: ${state.memory.files.length}`);

    await updateDagNode(
      "final_approval",
      {
        status: "COMPLETED",
        finished_at: new Date().toISOString(),
        model_used: finalMod,
        output_preview: finalText.slice(0, 240),
      },
      env
    );
  } catch (err) {
    const errMsg = err?.message || "DAG execution failed";
    if (state.current_dag) {
      state.current_dag.status = "FAILED";
      for (const n of state.current_dag.nodes) {
        if (n.status === "RUNNING") {
          n.status = "FAILED";
          n.error = errMsg;
          n.finished_at = new Date().toISOString();
          setAgentVisual(n.agent, "ERROR", "idle");
        }
      }
    }
    addLog("error", "dag", `DAG failed: ${errMsg}`);
    pushMessage(
      "lead",
      "Атлас (Система)",
      "Тимлид / Стратег",
      "#f43f5e",
      `❌ Ошибка выполнения DAG: ${errMsg}`,
      "router",
      "system"
    );
    await saveMemoryToKV(env);
  } finally {
    state.local_running = false;
    state.task_running = false;
    state.current_task = "";
    if (!pausedForGate) {
      state.pending_approval = null;
      for (const [aid, st] of Object.entries(state.agents)) {
        st.collaborating_with = null;
        const vs = st.visual_state === "ERROR" ? "ERROR" : "IDLE";
        moveAgent(aid, st.profile.desk_pos[0], st.profile.desk_pos[1], "idle", st.profile.look_pos, vs);
      }
    }
    await saveMemoryToKV(env);
    broadcast(getSnapshot(env));
  }
}

// ============================================================================
// HTTP & WebSocket Entrypoint
// ============================================================================

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return jsonResp({ ok: true });
    }

    await ensureKVLoaded(env);

    // WebSocket endpoint (/ws)
    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket Upgrade", { status: 426 });
      }
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.accept();
      state.sockets.add(server);
      server.send(JSON.stringify(getSnapshot(env)));

      let tickCount = 0;
      const interval = setInterval(() => {
        try {
          stepSimulation();
          tickCount++;
          if (tickCount % 6 === 0 && !state.local_running) {
            ensureKVLoaded(env)
              .then(() => {
                server.send(JSON.stringify(getSnapshot(env)));
              })
              .catch(() => {});
          }
        } catch {
          clearInterval(interval);
        }
      }, 220);

      server.addEventListener("close", () => {
        clearInterval(interval);
        state.sockets.delete(server);
      });
      server.addEventListener("error", () => {
        clearInterval(interval);
        state.sockets.delete(server);
      });

      return new Response(null, { status: 101, webSocket: client });
    }

    // GET /api/state
    if (url.pathname === "/api/state" && request.method === "GET") {
      stepSimulation();
      return jsonResp(getSnapshot(env));
    }

    // POST /api/task
    if (url.pathname === "/api/task" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const prompt = String(body.prompt || "").trim();
      const target = String(body.target_agent || "all");
      if (!prompt) return jsonResp({ ok: false, error: "Empty prompt" }, 400);
      if (state.task_running || state.pending_approval) {
        return jsonResp({ ok: false, error: "Команда уже выполняет задачу" }, 409);
      }
      const wfPromise = runDagWorkflow(prompt, target, env, false);
      ctx.waitUntil(wfPromise);
      await wfPromise;
      return jsonResp({
        ok: true,
        dag_id: state.current_dag?.id,
        status: state.current_dag?.status,
        pending_approval: state.pending_approval,
      });
    }

    // POST /api/task/stop
    if (url.pathname === "/api/task/stop" && request.method === "POST") {
      state.task_abort = true;
      state.local_running = false;
      state.task_running = false;
      state.current_task = "";
      state.pending_approval = null;
      if (state.current_dag) {
        state.current_dag.status = "STOPPED";
        for (const n of state.current_dag.nodes) {
          if (n.status === "RUNNING" || n.status === "PENDING") {
            n.status = "SKIPPED";
          }
        }
      }
      for (const [aid, st] of Object.entries(state.agents)) {
        st.collaborating_with = null;
        moveAgent(aid, st.profile.desk_pos[0], st.profile.desk_pos[1], "idle", st.profile.look_pos, "IDLE");
      }
      addLog("warn", "dag", "Task stopped by user");
      pushMessage("lead", "Атлас", "Тимлид / Стратег", "#38bdf8", "Задача остановлена по команде босса.", "", "system");
      await saveMemoryToKV(env);
      broadcast(getSnapshot(env));
      return jsonResp({ ok: true });
    }

    // POST /api/task/retry
    if (url.pathname === "/api/task/retry" && request.method === "POST") {
      if (state.task_running || state.pending_approval) {
        return jsonResp({ ok: false, error: "Команда уже выполняет задачу" }, 409);
      }
      const body = await request.json().catch(() => ({}));
      const lastTask = state.memory.tasks[state.memory.tasks.length - 1];
      const prompt = String(
        body.prompt || state.last_task_prompt || state.current_dag?.prompt || lastTask?.prompt || ""
      ).trim();
      const target = String(
        body.target_agent || state.last_target_agent || state.current_dag?.target_agent || lastTask?.target || "all"
      );
      if (!prompt) {
        return jsonResp({ ok: false, error: "No previous task available to retry" }, 400);
      }
      const wfPromise = runDagWorkflow(prompt, target, env, false);
      ctx.waitUntil(wfPromise);
      await wfPromise;
      return jsonResp({ ok: true, prompt, target_agent: target, status: state.current_dag?.status });
    }

    // POST /api/approval
    if (url.pathname === "/api/approval" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const approve = Boolean(body.approve ?? body.approved);
      if (!state.pending_approval) {
        return jsonResp({ ok: false, error: "No pending approval request" }, 404);
      }
      const pending = state.pending_approval;
      state.pending_approval = null;
      if (approve) {
        addDecision("Босс", "Human Control Gate", "APPROVED", `Подтверждено действие «${pending.matched_rule || ""}»`);
        addLog("info", "human_gate", `Approved by boss (rule: ${pending.matched_rule || ""})`);
        await saveMemoryToKV(env);
        const wfPromise = runDagWorkflow(pending.prompt, pending.target_agent || "all", env, true);
        ctx.waitUntil(wfPromise);
        await wfPromise;
      } else {
        addDecision("Босс", "Human Control Gate", "REJECTED", `Отклонено действие «${pending.matched_rule || ""}»`);
        if (state.current_dag) {
          state.current_dag.status = "FAILED";
          for (const n of state.current_dag.nodes) {
            if (n.status === "PENDING" || n.status === "RUNNING") n.status = "SKIPPED";
          }
        }
        setAgentVisual("lead", "IDLE", "idle");
        pushMessage(
          "lead",
          "Атлас",
          "Тимлид / Контроль",
          "#f43f5e",
          `🛑 Выполнение задачи отклонено боссом на этапе Human Control Gate.`,
          "policy-gate",
          "system"
        );
        await saveMemoryToKV(env);
      }
      broadcast(getSnapshot(env));
      return jsonResp({ ok: true, approved: approve, status: state.current_dag?.status });
    }

    // POST /api/settings
    if (url.pathname === "/api/settings" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      if (typeof body.economy_mode === "boolean") {
        state.economy_mode = body.economy_mode;
      }
      if (typeof body.auto_routing === "boolean") {
        state.auto_routing = body.auto_routing;
      }
      for (const k of Object.keys(state.keys)) {
        if (typeof body[k] === "string" && body[k].trim()) {
          state.keys[k] = body[k].trim();
          state.deleted_keys.delete(k);
        }
      }
      await saveKeysToKV(env);
      const providers = getProviderStatus(env);
      addLog("info", "settings", "Updated settings/API keys in CHARON_KV");
      await saveMemoryToKV(env);
      broadcast({
        type: "config",
        economy_mode: state.economy_mode,
        auto_routing: state.auto_routing,
        providers,
      });
      return jsonResp({
        ok: true,
        economy_mode: state.economy_mode,
        auto_routing: state.auto_routing,
        providers,
      });
    }

    // DELETE /api/settings/key/:provider
    const matchDeleteKey = url.pathname.match(/^\/api\/settings\/key\/([^/]+)$/);
    if (matchDeleteKey && request.method === "DELETE") {
      const rawProv = decodeURIComponent(matchDeleteKey[1]).trim().toLowerCase();
      const keyField =
        PROVIDER_TO_KEY_FIELD[rawProv] ||
        (Object.prototype.hasOwnProperty.call(state.keys, rawProv) ? rawProv : null);
      if (!keyField) {
        return jsonResp({ ok: false, error: `Unknown provider: ${rawProv}` }, 404);
      }
      state.keys[keyField] = "";
      state.deleted_keys.add(keyField);
      await saveKeysToKV(env);
      const providers = getProviderStatus(env);
      addLog("warn", "settings", `Deleted API key for provider: ${rawProv}`);
      await saveMemoryToKV(env);
      broadcast({
        type: "config",
        economy_mode: state.economy_mode,
        auto_routing: state.auto_routing,
        providers,
      });
      return jsonResp({ ok: true, provider: rawProv, providers });
    }

    // POST /api/agents/:id/model
    const matchModel = url.pathname.match(/^\/api\/agents\/([^/]+)\/model$/);
    if (matchModel && request.method === "POST") {
      const aid = matchModel[1];
      const body = await request.json().catch(() => ({}));
      if (!state.agents[aid]) return jsonResp({ ok: false, error: "Unknown agent" }, 404);
      if (body.provider) state.agents[aid].profile.provider = String(body.provider).trim();
      if (body.model) state.agents[aid].profile.model = String(body.model).trim();
      addLog("info", "agents", `Updated model for ${aid}: ${state.agents[aid].profile.provider}/${state.agents[aid].profile.model}`);
      await saveMemoryToKV(env);
      broadcast({
        type: "positions",
        agents: Object.values(state.agents).map(serializeAgent),
        task_running: state.task_running,
      });
      return jsonResp({ ok: true, agent: serializeAgent(state.agents[aid]) });
    }

    return env.ASSETS.fetch(request);
  },
};
