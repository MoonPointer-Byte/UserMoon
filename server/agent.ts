import catalog from "../shared/catalog.json";
import { getDbAgentRun, listDbAgentRuns, saveDbAgentRun } from "./db";
import { getBoard } from "./runtime-manager";
import { searchSite, type SearchDomain } from "./search";

export type AgentStatus =
  | "running"
  | "awaiting_user"
  | "succeeded"
  | "failed"
  | "interrupted";

export type AgentMessage = {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  name?: string;
};

export type AgentTrajectory = {
  action: "call_tool" | "ask_user" | "finish" | "note";
  detail: string;
  at: string;
};

export type AgentRun = {
  id: string;
  status: AgentStatus;
  message: string;
  execution_note: string;
  createdAt: string;
  updatedAt: string;
  loop: {
    engine: "react";
    conversation: Array<{ role: "user" | "assistant"; content: string }>;
    trajectory: AgentTrajectory[];
    pending: { kind: "clarify"; question: string; options?: string[] } | null;
    final_answer: string;
    iterations: number;
    max_steps: number;
    stop_requested: boolean;
  };
};

type ToolResult = { ok: boolean; content: string; control?: "ask_user" };

const MAX_STEPS = Math.min(24, Math.max(1, Number(process.env.AGENT_REACT_MAX_STEPS) || 10));

async function writeRun(run: AgentRun) {
  run.updatedAt = new Date().toISOString();
  await saveDbAgentRun({
    id: run.id,
    status: run.status,
    message: run.message,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    payload: run,
  });
  return run;
}

async function readRun(id: string): Promise<AgentRun | null> {
  const payload = await getDbAgentRun(id);
  return payload ? (payload as AgentRun) : null;
}

function publicRun(run: AgentRun): AgentRun {
  return run;
}

function llmConfig() {
  return {
    apiKey: (process.env.AGENT_LLM_API_KEY || process.env.OPENAI_API_KEY || "").trim(),
    baseUrl: (process.env.AGENT_LLM_BASE_URL || "https://api.deepseek.com/v1").replace(/\/$/, ""),
    model: process.env.AGENT_LLM_MODEL || "deepseek-chat",
  };
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_site",
      description: "在本站搜索作品、文章、分享、成绩和页面。回答站内内容前应优先调用。",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          domain: {
            type: "string",
            enum: ["all", "works", "articles", "shares", "honors", "pages"],
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_projects",
      description: "列出可在仓库页运行的项目目录。",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_project",
      description: "按 id 或名称取某一个作品的介绍。",
      parameters: {
        type: "object",
        properties: { id_or_name: { type: "string" } },
        required: ["id_or_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_board_status",
      description: "查看当前展示位（Docker 一槽）正在运行哪个项目。",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "ask_user",
      description: "信息不足时向访客追问一个问题，不要瞎猜。",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: { type: "array", items: { type: "string" } },
        },
        required: ["question"],
      },
    },
  },
] as const;

const SYSTEM_PROMPT = `你是 MoonPointer 个人站上的助手。
站点内容：首页、文章、作品介绍、仓库（可 Docker 运行一个项目）、成绩、分享、关于、本 Agent。
原则：
1. 先查站内工具再回答，不要捏造奖项、文章或不存在的项目。
2. 成绩/文章可能为空，空着就老实说还没有。
3. 不要替用户启动或停止 Docker；只解释怎么去仓库页操作。
4. 缺关键信息时用 ask_user。
5. 用简体中文，短句，可给站内路径如 /works/ideaface。`;

async function invokeTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  if (name === "search_site") {
    const query = String(args.query ?? "");
    const domain = (String(args.domain ?? "all") || "all") as SearchDomain;
    const result = await searchSite(query, domain, 8);
    return {
      ok: true,
      content: JSON.stringify({
        understood: result.understood,
        hits: result.hits.map((hit) => ({
          title: hit.title,
          domain: hit.domain,
          href: hit.href,
          summary: hit.summary,
          reasons: hit.reasons,
        })),
        related: result.related,
      }),
    };
  }
  if (name === "list_projects") {
    return {
      ok: true,
      content: JSON.stringify(
        catalog.map((item) => ({
          id: item.id,
          name: item.name,
          scene: item.scene,
          lang: item.lang,
          env: item.env,
          href: `/works/${item.id}`,
        })),
      ),
    };
  }
  if (name === "get_project") {
    const key = String(args.id_or_name ?? "").toLowerCase();
    const project =
      catalog.find((item) => item.id === key || item.name.toLowerCase() === key) ||
      catalog.find((item) => item.name.toLowerCase().includes(key) || item.id.includes(key));
    if (!project) return { ok: false, content: `没有找到项目：${key}` };
    return {
      ok: true,
      content: JSON.stringify({
        id: project.id,
        name: project.name,
        scene: project.scene,
        summary: project.summary,
        env: project.env,
        tags: project.tags,
        url: project.url,
        href: `/works/${project.id}`,
        reposHref: "/repos",
      }),
    };
  }
  if (name === "get_board_status") {
    const board = getBoard();
    return {
      ok: true,
      content: JSON.stringify({
        activeId: board.activeId,
        status: board.status,
        message: board.message,
        port: board.port,
        previewUrl: board.previewUrl,
      }),
    };
  }
  if (name === "ask_user") {
    return {
      ok: true,
      control: "ask_user",
      content: JSON.stringify({
        question: String(args.question ?? "还需要补充什么？"),
        options: Array.isArray(args.options) ? args.options.map(String) : [],
      }),
    };
  }
  return { ok: false, content: `未知工具 ${name}` };
}

type LlmMessage = Record<string, unknown>;

async function chatCompletion(messages: LlmMessage[]) {
  const cfg = llmConfig();
  if (!cfg.apiKey) return null;
  const response = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      tools: TOOLS,
      tool_choice: "auto",
      temperature: 0.3,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM ${response.status}: ${text.slice(0, 240)}`);
  }
  return (await response.json()) as {
    choices?: Array<{
      message?: {
        role?: string;
        content?: string | null;
        tool_calls?: Array<{
          id: string;
          type?: string;
          function?: { name?: string; arguments?: string };
        }>;
      };
    }>;
  };
}

async function mockAnswer(userText: string): Promise<{ answer: string; trajectory: AgentTrajectory[] }> {
  const result = await searchSite(userText, "all", 5);
  const trajectory: AgentTrajectory[] = [
    {
      action: "call_tool",
      detail: `search_site(${userText})`,
      at: new Date().toISOString(),
    },
  ];
  if (!result.hits.length) {
    return {
      answer:
        "我这边还没有配置 AGENT_LLM_API_KEY，只能做站内检索。没有找到匹配内容。你可以换个词，或到 /repos 自己挑项目运行。",
      trajectory,
    };
  }
  const lines = result.hits.map(
    (hit) => `- [${hit.title}](${hit.href}) · ${hit.domain} · ${hit.summary.slice(0, 60)}`,
  );
  return {
    answer: `（未配置大模型，已用站内搜索）理解为 ${result.understood.label} · ${result.understood.keywords.join(" ")}\n\n${lines.join("\n")}`,
    trajectory: [
      ...trajectory,
      { action: "finish", detail: "mock search reply", at: new Date().toISOString() },
    ],
  };
}

function createEmptyRun(message: string): AgentRun {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    status: "running",
    message,
    execution_note: "正在思考…",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    loop: {
      engine: "react",
      conversation: [{ role: "user", content: message }],
      trajectory: [],
      pending: null,
      final_answer: "",
      iterations: 0,
      max_steps: MAX_STEPS,
      stop_requested: false,
    },
  };
}

async function runLoop(run: AgentRun) {
  const cfg = llmConfig();
  if (!cfg.apiKey) {
    const mock = await mockAnswer(run.message);
    run.loop.trajectory.push(...mock.trajectory);
    run.loop.final_answer = mock.answer;
    run.loop.conversation.push({ role: "assistant", content: mock.answer });
    run.status = "succeeded";
    run.execution_note = "已用站内搜索回复（未配置 LLM）";
    return await writeRun(run);
  }

  const messages: LlmMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...run.loop.conversation.map((item) => ({ role: item.role, content: item.content })),
  ];

  for (let step = 0; step < run.loop.max_steps; step += 1) {
    if (run.loop.stop_requested) {
      run.status = "interrupted";
      run.execution_note = "已打断";
      return await writeRun(run);
    }
    run.loop.iterations = step + 1;
    run.execution_note = `第 ${step + 1} 步…`;
    await writeRun(run);

    const completion = await chatCompletion(messages);
    const choice = completion?.choices?.[0]?.message;
    if (!choice) throw new Error("模型没有返回内容");

    const toolCalls = choice.tool_calls ?? [];
    if (!toolCalls.length) {
      const answer = String(choice.content ?? "").trim() || "（空回复）";
      run.loop.final_answer = answer;
      run.loop.conversation.push({ role: "assistant", content: answer });
      run.loop.trajectory.push({
        action: "finish",
        detail: answer.slice(0, 120),
        at: new Date().toISOString(),
      });
      run.status = "succeeded";
      run.execution_note = "完成";
      return await writeRun(run);
    }

    messages.push({
      role: "assistant",
      content: choice.content || "",
      tool_calls: toolCalls,
    });

    for (const call of toolCalls) {
      const name = call.function?.name || "";
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function?.arguments || "{}") as Record<string, unknown>;
      } catch {
        args = {};
      }
      run.loop.trajectory.push({
        action: name === "ask_user" ? "ask_user" : "call_tool",
        detail: `${name}(${JSON.stringify(args).slice(0, 160)})`,
        at: new Date().toISOString(),
      });
      run.execution_note = `调用 ${name}`;
      await writeRun(run);

      const result = await invokeTool(name, args);
      if (result.control === "ask_user") {
        const pending = JSON.parse(result.content) as { question: string; options?: string[] };
        run.loop.pending = { kind: "clarify", question: pending.question, options: pending.options };
        run.status = "awaiting_user";
        run.execution_note = "等待你的补充";
        run.loop.conversation.push({ role: "assistant", content: pending.question });
        return await writeRun(run);
      }

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: result.content,
      });
    }
  }

  run.status = "failed";
  run.execution_note = "步数用尽";
  run.loop.final_answer = "这一轮工具调用太多，先停住了。你可以再说具体一点。";
  run.loop.conversation.push({ role: "assistant", content: run.loop.final_answer });
  return await writeRun(run);
}

const jobs = new Map<string, Promise<void>>();

function enqueue(runId: string, work: () => Promise<void>) {
  const prev = jobs.get(runId) ?? Promise.resolve();
  const next = prev
    .then(work)
    .catch(() => undefined)
    .finally(() => {
      if (jobs.get(runId) === next) jobs.delete(runId);
    });
  jobs.set(runId, next);
  return next;
}

export async function listAgentRuns(limit = 20) {
  const rows = await listDbAgentRuns(limit);
  const out = [];
  for (const row of rows) {
    const run = await readRun(row.id);
    out.push({
      id: row.id,
      status: row.status,
      message: row.message,
      updatedAt: row.updated_at,
      final_answer: run?.loop.final_answer?.slice(0, 120) || "",
    });
  }
  return out;
}

export async function getAgentRun(id: string) {
  const run = await readRun(id);
  return run ? publicRun(run) : null;
}

export function getAgentSettings() {
  const cfg = llmConfig();
  return {
    configured: Boolean(cfg.apiKey),
    baseUrl: cfg.baseUrl,
    model: cfg.model,
    maxSteps: MAX_STEPS,
    keyMasked: cfg.apiKey ? `${cfg.apiKey.slice(0, 4)}…${cfg.apiKey.slice(-4)}` : "",
  };
}

export async function startAgent(message: string, runId?: string) {
  const text = message.trim().slice(0, 4000);
  if (!text) throw new Error("消息不能为空");

  if (runId) {
    const existing = await readRun(runId);
    if (!existing) throw new Error("找不到这次对话");
    existing.message = text;
    existing.loop.conversation.push({ role: "user", content: text });
    existing.loop.pending = null;
    existing.loop.final_answer = "";
    existing.status = "running";
    existing.execution_note = "继续…";
    existing.loop.stop_requested = false;
    await writeRun(existing);
    void enqueue(existing.id, async () => {
      try {
        await runLoop(existing);
      } catch (error) {
        existing.status = "failed";
        existing.execution_note = error instanceof Error ? error.message : String(error);
        existing.loop.final_answer = existing.execution_note;
        existing.loop.conversation.push({ role: "assistant", content: existing.execution_note });
        await writeRun(existing);
      }
    });
    return publicRun(existing);
  }

  const run = createEmptyRun(text);
  await writeRun(run);
  void enqueue(run.id, async () => {
    try {
      await runLoop(run);
    } catch (error) {
      run.status = "failed";
      run.execution_note = error instanceof Error ? error.message : String(error);
      run.loop.final_answer = run.execution_note;
      run.loop.conversation.push({ role: "assistant", content: run.execution_note });
      await writeRun(run);
    }
  });
  return publicRun(run);
}

export async function replyAgent(id: string, message: string) {
  return startAgent(message, id);
}

export async function stopAgent(id: string) {
  const run = await readRun(id);
  if (!run) throw new Error("找不到这次对话");
  run.loop.stop_requested = true;
  if (run.status === "running") {
    run.status = "interrupted";
    run.execution_note = "已请求停止";
  }
  return writeRun(run);
}
