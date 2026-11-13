// Cloudflare Pages Advanced Mode Worker (_worker.js)
// Serves /api/* and /ws (WebSocket) directly on https://charon-office.pages.dev
// and falls back to env.ASSETS for static 3D frontend assets.

const GRID_W = 16;
const GRID_H = 13;

const BLOCKED = new Set([
  "1,2","1,3","1,6","1,7","1,10","1,11",
  "14,2","14,3","14,8","14,9",
  "8,5",
  "7,1","8,1","9,1",
  "7,11","8,11",
]);

const LOUNGE_SPOTS = [[6, 2], [10, 2], [6, 9], [10, 9], [5, 5], [11, 5]];
const COFFEE_SPOTS = [[6, 2], [7, 2], [9, 2], [10, 2]];
const COLLAB_VISIT_POS = {
  lead: [3, 2],
  cybersec: [3, 6],
  dev: [3, 10],
  growth: [12, 2],
  motion: [12, 8],
};

const INITIAL_AGENTS = {
  lead: {
    id: "lead",
    name: "Атлас",
    role: "Тимлид / Стратег",
    specialty: "Оркестрация задач, стратегия, финальная сборка",
    color: "#38bdf8",
    provider: "siliconflow",
    model: "deepseek-ai/DeepSeek-V4.1-Flash",
    cfModel: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    desk_pos: [2, 2],
    look_pos: [1, 2.5],
    meeting_pos: [7, 5],
    system_prompt:
      "Ты Атлас — тимлид и главный стратег AI-офиса. Ты координируешь команду из 5 специалистов: Вектор (пентест и кибербез), Нова (код и автоматизация), Пульс (продвижение и контент), Шейдер (Motion Graphics и визуал). Отвечай чётко, структурно, по делу на русском языке.",
    idle_phrases: [
      "Проверяю бэклог задач на сегодня.",
      "Команда, держим темп и экономим токены.",
      "Сверяю приоритеты по текущим проектам.",
    ],
  },
  cybersec: {
    id: "cybersec",
    name: "Вектор",
    role: "Пентест и Кибербез",
    specialty: "Аудит уязвимостей, OWASP, threat modeling, харденинг",
    color: "#f43f5e",
    provider: "openrouter",
    model: "qwen/qwen3.8-flash-next",
    cfModel: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
    desk_pos: [2, 6],
    look_pos: [1, 6.5],
    meeting_pos: [8, 4],
    system_prompt:
      "Ты Вектор — специалист по наступательной и оборонительной кибербезопасности (пентест, аудит кода, OWASP Top 10, поиск мисконфигов, харденинг). Говори прямо, технически глубоко, без воды на русском языке в рамках легального аудита.",
    idle_phrases: [
      "Сканирую зависимости на известные CVE.",
      "Проверяю заголовки безопасности и CORS-политики.",
      "Ищу слабые места в конфигурации доступа.",
    ],
  },
  dev: {
    id: "dev",
    name: "Нова",
    role: "Код и Автоматизация",
    specialty: "Python/JS скрипты, парсеры, боты, архитектура",
    color: "#22c55e",
    provider: "cerebras",
    model: "qwen-3.8-27b",
    cfModel: "@cf/qwen/qwen2.5-coder-32b-instruct",
    desk_pos: [2, 10],
    look_pos: [1, 10.5],
    meeting_pos: [9, 4],
    system_prompt:
      "Ты Нова — senior-разработчик и автоматизатор. Пишешь чистый, оптимизированный код (Python, TypeScript, Bash, API-интеграции, боты). Всегда даёшь рабочие решения без лишней теории на русском языке.",
    idle_phrases: [
      "Оптимизирую пайплайн, чтобы ничего не тормозило.",
      "Рефакторю асинхронные воркеры.",
      "Проверяю, как сжать потребление памяти.",
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
      "Ты Пульс — эксперт по продвижению, контент-маркетингу, вирусным хукам, Reels/Shorts/YouTube сценариям, вовлечению и продающим текстам. Мыслишь метриками удержания и CTR. Отвечай на русском языке.",
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
    specialty: "Раскадровки, 3D/AE-концепты, промпты, шейдеры",
    color: "#a855f7",
    provider: "deepseek",
    model: "deepseek-chat",
    cfModel: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    desk_pos: [13, 8],
    look_pos: [14, 8.5],
    meeting_pos: [8, 6],
    system_prompt:
      "Ты Шейдер — арт-директор по Motion Graphics, 3D-анимации, After Effects, Remotion, Three.js и генеративному видео. Даёшь точные раскадровки, тайминги, камеру, свет, эффекты и промпты на русском языке.",
    idle_phrases: [
      "Настраиваю кривые скорости и композицию кадра.",
      "Подбираю неоновую палитру и ритм монтажа.",
      "Прорабатываю динамику камеры для нового ролика.",
    ],
  },
};

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
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
      const nk = key(nx, ny);
      const isGoal = nx === goal[0] && ny === goal[1];
      if (BLOCKED.has(nk) && !isGoal) continue;
      if (occupiedSet && occupiedSet.has(nk) && !isGoal) continue;
      const tg = (gScore.get(key(cur.x, cur.y)) ?? 9999) + 1;
      if (tg < (gScore.get(nk) ?? 9999)) {
        cameFrom.set(nk, key(cur.x, cur.y));
        gScore.set(nk, tg);
        const h = Math.abs(goal[0] - nx) + Math.abs(goal[1] - ny);
        open.push({ x: nx, y: ny, g: tg, f: tg + h });
      }
    }
  }
  return [];
}

// Singleton simulation state inside Worker isolate
const state = {
  economy_mode: true,
  task_running: false,
  current_task: "",
  task_abort: false,
  keys: {
    openrouter_api_key: "",
    gemini_api_key: "",
    groq_api_key: "",
    cerebras_api_key: "",
    deepseek_api_key: "",
    siliconflow_api_key: "",
    zai_api_key: "",
  },
  agents: {},
  messages: [],
  sockets: new Set(),
  lastTick: Date.now(),
  lastWander: Date.now(),
};

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
    facing: Math.atan2(lx - dx, ly - dy),
    look_target: [lx, ly],
    bubble: "",
    bubble_until: 0,
    collaborating_with: null,
  };
}

function syncEnvKeys(env) {
  if (!env) return;
  const map = {
    openrouter_api_key: "OPENROUTER_API_KEY",
    gemini_api_key: "GEMINI_API_KEY",
    groq_api_key: "GROQ_API_KEY",
    cerebras_api_key: "CEREBRAS_API_KEY",
    deepseek_api_key: "DEEPSEEK_API_KEY",
    siliconflow_api_key: "SILICONFLOW_API_KEY",
    zai_api_key: "ZAI_API_KEY",
  };
  for (const [k, envKey] of Object.entries(map)) {
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

function serializeAgent(st) {
  const now = Date.now();
  return {
    id: st.profile.id,
    name: st.profile.name,
    role: st.profile.role,
    specialty: st.profile.specialty,
    color: st.profile.color,
    provider: st.profile.provider,
    model: st.profile.model,
    x: Number(st.x.toFixed(3)),
    y: Number(st.y.toFixed(3)),
    facing: Number((st.facing || 0).toFixed(3)),
    status: st.status,
    bubble: now < st.bubble_until ? st.bubble : "",
    collaborating_with: st.collaborating_with,
  };
}

function getSnapshot(env) {
  return {
    type: "state",
    agents: Object.values(state.agents).map(serializeAgent),
    economy_mode: state.economy_mode,
    task_running: state.task_running,
    current_task: state.current_task,
    providers: getProviderStatus(env),
    messages: state.messages.slice(-40),
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
  if (state.messages.length > 80) state.messages = state.messages.slice(-80);
  broadcast({ type: "message", message: msg });
}

function moveAgent(id, gx, gy, postStatus = "idle", lookAt = null) {
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
  st.path = astar([Math.round(st.x), Math.round(st.y)], [gx, gy], occupied);
  if (st.path.length > 0) {
    st.status = "walking";
  } else {
    st.status = postStatus;
    if (lookAt) {
      st.facing = Math.atan2(lookAt[0] - st.x, lookAt[1] - st.y);
    }
  }
}

function stepSimulation() {
  const now = Date.now();
  const speed = 0.24;
  let changed = false;

  for (const st of Object.values(state.agents)) {
    if (st.path && st.path.length > 0) {
      const [nx, ny] = st.path[0];
      const dx = nx - st.x;
      const dy = ny - st.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.001) {
        st.facing = Math.atan2(dx, dy);
      }
      if (dist <= speed) {
        st.x = nx;
        st.y = ny;
        st.path.shift();
        if (st.path.length === 0) {
          st.status = st.post_status || "idle";
          if (st.look_target) {
            st.facing = Math.atan2(st.look_target[0] - st.x, st.look_target[1] - st.y);
          }
        }
      } else {
        st.x += (dx / dist) * speed;
        st.y += (dy / dist) * speed;
      }
      changed = true;
    }
  }

  if (!state.task_running && now - state.lastWander > 9000) {
    state.lastWander = now;
    const ids = Object.keys(state.agents);
    const pick = ids[Math.floor(Math.random() * ids.length)];
    const st = state.agents[pick];
    if (!st.path || st.path.length === 0) {
      if (Math.random() < 0.5) {
        const spots = [...LOUNGE_SPOTS, ...COFFEE_SPOTS];
        const [gx, gy] = spots[Math.floor(Math.random() * spots.length)];
        moveAgent(pick, gx, gy, "idle", [8, 5]);
        const phrase = st.profile.idle_phrases[Math.floor(Math.random() * st.profile.idle_phrases.length)];
        setBubble(pick, phrase, 6500);
      } else {
        const [dx, dy] = st.profile.desk_pos;
        moveAgent(pick, dx, dy, "idle", st.profile.look_pos);
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

async function callOpenAICompat(url, apiKey, model, systemPrompt, userPrompt, maxTokens = 700, extraHeaders = {}) {
  const resp = await fetch(url, {
    method: "POST",
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
      temperature: 0.7,
    }),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  return data.choices[0].message.content.trim();
}

async function callGemini(apiKey, model, systemPrompt, userPrompt, maxTokens = 700) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
    }),
  });
  if (!resp.ok) throw new Error(`Gemini HTTP ${resp.status}`);
  const data = await resp.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || "").join("").trim();
}

async function generateAgentReply(agentProfile, userPrompt, env, maxTokens = 700) {
  syncEnvKeys(env);

  const providersOrder = [
    [agentProfile.provider, agentProfile.model],
    ["siliconflow", "deepseek-ai/DeepSeek-V4.1-Flash"],
    ["zai", "glm-5.3-flash"],
    ["openrouter", "nvidia/nemotron-3-ultra-550b-a55b:free"],
    ["gemini", "gemini-3-flash-preview"],
    ["groq", "openai/gpt-oss-120b"],
    ["cerebras", "qwen-3.8-27b"],
    ["deepseek", "deepseek-chat"],
  ];

  for (const [prov, mod] of providersOrder) {
    try {
      if (prov === "openrouter" && state.keys.openrouter_api_key) {
        const txt = await callOpenAICompat(
          "https://openrouter.ai/api/v1/chat/completions",
          state.keys.openrouter_api_key,
          mod,
          agentProfile.system_prompt,
          userPrompt,
          maxTokens,
          { "HTTP-Referer": "https://charon-office.pages.dev", "X-Title": "Charon 3D AI Office" }
        );
        return [txt, `openrouter/${mod}`];
      }
      if (prov === "siliconflow" && state.keys.siliconflow_api_key) {
        const txt = await callOpenAICompat(
          "https://api.siliconflow.cn/v1/chat/completions",
          state.keys.siliconflow_api_key,
          mod,
          agentProfile.system_prompt,
          userPrompt,
          maxTokens
        );
        return [txt, `siliconflow/${mod}`];
      }
      if (prov === "zai" && state.keys.zai_api_key) {
        const txt = await callOpenAICompat(
          "https://api.z.ai/api/paas/v4/chat/completions",
          state.keys.zai_api_key,
          mod,
          agentProfile.system_prompt,
          userPrompt,
          maxTokens
        );
        return [txt, `zai/${mod}`];
      }
      if (prov === "gemini" && state.keys.gemini_api_key) {
        const txt = await callGemini(
          state.keys.gemini_api_key,
          mod,
          agentProfile.system_prompt,
          userPrompt,
          maxTokens
        );
        return [txt, `gemini/${mod}`];
      }
      if (prov === "groq" && state.keys.groq_api_key) {
        const txt = await callOpenAICompat(
          "https://api.groq.com/openai/v1/chat/completions",
          state.keys.groq_api_key,
          mod,
          agentProfile.system_prompt,
          userPrompt,
          maxTokens
        );
        return [txt, `groq/${mod}`];
      }
      if (prov === "cerebras" && state.keys.cerebras_api_key) {
        const txt = await callOpenAICompat(
          "https://api.cerebras.ai/v1/chat/completions",
          state.keys.cerebras_api_key,
          mod,
          agentProfile.system_prompt,
          userPrompt,
          maxTokens
        );
        return [txt, `cerebras/${mod}`];
      }
      if (prov === "deepseek" && state.keys.deepseek_api_key) {
        const txt = await callOpenAICompat(
          "https://api.deepseek.com/chat/completions",
          state.keys.deepseek_api_key,
          mod,
          agentProfile.system_prompt,
          userPrompt,
          maxTokens
        );
        return [txt, `deepseek/${mod}`];
      }
    } catch {
      // try next configured provider
    }
  }

  // Built-in 0₽ Cloudflare Workers AI fallback if bound
  if (env && env.AI) {
    try {
      const cfMod = agentProfile.cfModel || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
      const res = await env.AI.run(cfMod, {
        messages: [
          { role: "system", content: agentProfile.system_prompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: maxTokens,
      });
      const text = (res && (res.response || res.result?.response || "")).trim();
      if (text) return [text, `cloudflare-ai/${cfMod.split("/").pop()}`];
    } catch {
      // fallback below
    }
  }

  return [
    `[Автономный режим — подключите бесплатный ключ SiliconFlow / Z.ai / OpenRouter / Gemini / Groq в «API / Модели» для полных LLM-ответов]\n` +
      `**${agentProfile.name}** (${agentProfile.role}): подготовил блок по направлению «${agentProfile.specialty}» для задачи «${userPrompt.slice(0, 90)}».`,
    "demo/autonomous",
  ];
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

async function runTaskWorkflow(promptText, targetAgent, env) {
  if (state.task_running) return;
  state.task_running = true;
  state.task_abort = false;
  state.current_task = promptText;

  try {
    pushMessage("user", "Вы (Босс)", "Постановщик задачи", "#ffffff", promptText, "", "user");

    if (targetAgent !== "all" && state.agents[targetAgent]) {
      const st = state.agents[targetAgent];
      moveAgent(targetAgent, st.profile.desk_pos[0], st.profile.desk_pos[1], "working", st.profile.look_pos);
      setBubble(targetAgent, "Принял задачу, работаю…", 6000);
      await advanceTicks(1600);
      if (state.task_abort) return;
      const [reply, used] = await generateAgentReply(st.profile, promptText, env, 800);
      setBubble(targetAgent, reply, 9000);
      pushMessage(st.profile.id, st.profile.name, st.profile.role, st.profile.color, reply, used, "result");
      return;
    }

    // 1. Gather in conference pod
    for (const [aid, st] of Object.entries(state.agents)) {
      moveAgent(aid, st.profile.meeting_pos[0], st.profile.meeting_pos[1], "meeting", [8, 5]);
    }
    setBubble("lead", "Команда, собираемся в переговорной!", 6000);
    await advanceTicks(2200);
    if (state.task_abort) return;

    const leadProf = state.agents.lead.profile;
    const planPrompt =
      `Босс поставил задачу: «${promptText}».\n` +
      `Кратко (в 4 пунктах) распредели задачи между специалистами: Вектор (пентест/кибербез), Нова (код/автоматизация), Пульс (продвижение/контент), Шейдер (Motion Graphics).`;
    const [planText, leadMod] = await generateAgentReply(leadProf, planPrompt, env, 350);
    if (state.task_abort) return;
    setBubble("lead", planText, 8500);
    pushMessage(leadProf.id, leadProf.name, leadProf.role, leadProf.color, planText, leadMod, "chat");

    // 2. Specialists return to their desks and work
    const specs = ["cybersec", "dev", "growth", "motion"];
    for (const sid of specs) {
      const st = state.agents[sid];
      moveAgent(sid, st.profile.desk_pos[0], st.profile.desk_pos[1], "working", st.profile.look_pos);
      setBubble(sid, "Иду за стол делать свою часть…", 5000);
    }
    await advanceTicks(1800);
    if (state.task_abort) return;

    const specOutputs = {};
    await Promise.all(
      specs.map(async (sid) => {
        const prof = state.agents[sid].profile;
        const spPrompt =
          `Задача: «${promptText}».\nПлан тимлида:\n${planText}\n\n` +
          `Дай конкретный профессиональный результат строго по твоей роли (${prof.specialty}).`;
        const [ans, mod] = await generateAgentReply(prof, spPrompt, env, 650);
        if (state.task_abort) return;
        specOutputs[sid] = ans;
        setBubble(sid, ans, 8500);
        pushMessage(prof.id, prof.name, prof.role, prof.color, ans, mod, "chat");
      })
    );
    if (state.task_abort) return;

    // 3. Cross-review desk visits (CyberSec -> Dev, Growth -> Motion)
    state.agents.cybersec.collaborating_with = "dev";
    state.agents.dev.collaborating_with = "cybersec";
    state.agents.growth.collaborating_with = "motion";
    state.agents.motion.collaborating_with = "growth";

    moveAgent("cybersec", COLLAB_VISIT_POS.dev[0], COLLAB_VISIT_POS.dev[1], "working", state.agents.dev.profile.desk_pos);
    moveAgent("growth", COLLAB_VISIT_POS.motion[0], COLLAB_VISIT_POS.motion[1], "working", state.agents.motion.profile.desk_pos);
    setBubble("cybersec", "Нова, проверяю твой код на уязвимости…", 6000);
    setBubble("growth", "Шейдер, синхронизируем хуки с раскадровкой!", 6000);
    await advanceTicks(2000);
    if (state.task_abort) return;

    state.agents.cybersec.collaborating_with = null;
    state.agents.dev.collaborating_with = null;
    state.agents.growth.collaborating_with = null;
    state.agents.motion.collaborating_with = null;

    // 4. Final synthesis by Lead
    moveAgent("lead", leadProf.desk_pos[0], leadProf.desk_pos[1], "working", leadProf.look_pos);
    const combined = specs
      .map((s) => `### ${state.agents[s].profile.name} (${state.agents[s].profile.role}):\n${specOutputs[s] || ""}`)
      .join("\n\n");
    const finalPrompt =
      `Задача босса: «${promptText}».\n\nРезультаты специалистов:\n${combined}\n\n` +
      `Собери единый, структурированный финальный мастер-план и решение для босса.`;
    const [finalText, finalMod] = await generateAgentReply(leadProf, finalPrompt, env, 900);
    if (state.task_abort) return;
    setBubble("lead", "Готово! Финальный отчёт в чате.", 9000);
    pushMessage(leadProf.id, `${leadProf.name} (Итог)`, leadProf.role, leadProf.color, finalText, finalMod, "result");
  } finally {
    state.task_running = false;
    state.current_task = "";
    for (const [aid, st] of Object.entries(state.agents)) {
      st.collaborating_with = null;
      moveAgent(aid, st.profile.desk_pos[0], st.profile.desk_pos[1], "idle", st.profile.look_pos);
    }
    broadcast({
      type: "positions",
      agents: Object.values(state.agents).map(serializeAgent),
      task_running: false,
    });
  }
}

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

      const interval = setInterval(() => {
        try {
          stepSimulation();
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

    // REST API endpoints
    if (url.pathname === "/api/state" && request.method === "GET") {
      stepSimulation();
      return jsonResp(getSnapshot(env));
    }

    if (url.pathname === "/api/task" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const prompt = String(body.prompt || "").trim();
      const target = String(body.target_agent || "all");
      if (!prompt) return jsonResp({ ok: false, error: "Empty prompt" }, 400);
      if (state.task_running) return jsonResp({ ok: false, error: "Команда уже выполняет задачу" }, 409);
      ctx.waitUntil(runTaskWorkflow(prompt, target, env));
      return jsonResp({ ok: true });
    }

    if (url.pathname === "/api/task/stop" && request.method === "POST") {
      state.task_abort = true;
      state.task_running = false;
      state.current_task = "";
      for (const [aid, st] of Object.entries(state.agents)) {
        st.collaborating_with = null;
        moveAgent(aid, st.profile.desk_pos[0], st.profile.desk_pos[1], "idle", st.profile.look_pos);
      }
      pushMessage("lead", "Атлас", "Тимлид / Стратег", "#38bdf8", "Задача остановлена по команде босса.", "", "system");
      broadcast(getSnapshot(env));
      return jsonResp({ ok: true });
    }

    if (url.pathname === "/api/settings" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      if (typeof body.economy_mode === "boolean") {
        state.economy_mode = body.economy_mode;
      }
      for (const k of Object.keys(state.keys)) {
        if (typeof body[k] === "string" && body[k].trim()) {
          state.keys[k] = body[k].trim();
        }
      }
      const providers = getProviderStatus(env);
      broadcast({ type: "config", economy_mode: state.economy_mode, providers });
      return jsonResp({ ok: true, economy_mode: state.economy_mode, providers });
    }

    const matchModel = url.pathname.match(/^\/api\/agents\/([^/]+)\/model$/);
    if (matchModel && request.method === "POST") {
      const aid = matchModel[1];
      const body = await request.json().catch(() => ({}));
      if (!state.agents[aid]) return jsonResp({ ok: false, error: "Unknown agent" }, 404);
      if (body.provider) state.agents[aid].profile.provider = String(body.provider).trim();
      if (body.model) state.agents[aid].profile.model = String(body.model).trim();
      broadcast({
        type: "positions",
        agents: Object.values(state.agents).map(serializeAgent),
        task_running: state.task_running,
      });
      return jsonResp({ ok: true });
    }

    return env.ASSETS.fetch(request);
  },
};
