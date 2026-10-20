import { FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

type Run = {
  id: string;
  status: "running" | "awaiting_user" | "succeeded" | "failed" | "interrupted";
  message: string;
  execution_note: string;
  loop: {
    conversation: Array<{ role: "user" | "assistant"; content: string }>;
    trajectory: Array<{ action: string; detail: string }>;
    pending: { kind: string; question: string; options?: string[] } | null;
    final_answer: string;
  };
};

type RunSummary = {
  id: string;
  status: string;
  message: string;
  updatedAt: string;
  final_answer: string;
};

const ACTIVE_KEY = "usermoon.agent.activeRunId";

export function AgentPage() {
  const [run, setRun] = useState<Run | null>(null);
  const [history, setHistory] = useState<RunSummary[]>([]);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState<{ configured: boolean; model: string } | null>(null);
  const [showTrace, setShowTrace] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const seeded = useRef(false);

  async function refreshHistory() {
    const data = (await fetch("/api/agent/runs").then((res) => res.json())) as { runs?: RunSummary[] };
    setHistory(data.runs ?? []);
  }

  async function loadRun(id: string) {
    const data = (await fetch(`/api/agent/runs/${encodeURIComponent(id)}`).then((res) => res.json())) as {
      run?: Run;
      error?: string;
    };
    if (data.run) {
      setRun(data.run);
      window.sessionStorage.setItem(ACTIVE_KEY, data.run.id);
    }
  }

  useEffect(() => {
    void fetch("/api/agent/settings")
      .then((res) => res.json())
      .then((data: { configured?: boolean; model?: string }) =>
        setSettings({ configured: Boolean(data.configured), model: data.model || "" }),
      )
      .catch(() => undefined);
    void refreshHistory();
  }, []);

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    const id = window.sessionStorage.getItem(ACTIVE_KEY);
    if (id) void loadRun(id);
  }, []);

  useEffect(() => {
    if (!run || run.status !== "running") return;
    let timer = 0;
    const tick = () => {
      if (!document.hidden) void loadRun(run.id);
    };
    timer = window.setInterval(tick, 2000);
    const onVis = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [run?.id, run?.status]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [run?.loop.conversation.length, run?.status]);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const message = text.trim();
    if (!message || pending) return;
    setPending(true);
    setError("");
    try {
      const clarifying = run?.status === "awaiting_user";
      const continuing = run && (run.status === "succeeded" || run.status === "failed" || run.status === "interrupted");
      const path = clarifying
        ? `/api/agent/runs/${encodeURIComponent(run.id)}/reply`
        : continuing
          ? `/api/agent/runs/${encodeURIComponent(run.id)}/message`
          : "/api/agent/plan";
      const body = clarifying || continuing ? { message } : { message, mode: "react" };
      const data = (await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async (res) => {
        const json = (await res.json()) as { run?: Run; error?: string };
        if (!res.ok) throw new Error(json.error || "请求失败");
        return json;
      })) as { run: Run };
      setRun(data.run);
      window.sessionStorage.setItem(ACTIVE_KEY, data.run.id);
      setText("");
      void refreshHistory();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "发送失败");
    } finally {
      setPending(false);
    }
  }

  async function stop() {
    if (!run) return;
    await fetch(`/api/agent/runs/${encodeURIComponent(run.id)}/stop`, { method: "POST" });
    void loadRun(run.id);
  }

  function newChat() {
    setRun(null);
    window.sessionStorage.removeItem(ACTIVE_KEY);
    setText("");
    setError("");
  }

  const busy = run?.status === "running" || pending;
  const placeholder =
    run?.status === "awaiting_user" ? "针对当前问题回复…" : run ? "继续问…" : "问作品、页面或展示位状态…";

  return (
    <main className="agent">
      <aside className="agent__rail">
        <div className="agent__rail-top">
          <p>对话</p>
          <button type="button" onClick={newChat}>
            新对话
          </button>
        </div>
        <ul>
          {history.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={run?.id === item.id ? "is-on" : undefined}
                onClick={() => void loadRun(item.id)}
              >
                <strong>{item.message.slice(0, 36) || "空消息"}</strong>
                <span>{item.status}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="agent__main">
        <header className="agent__hero">
          <div>
            <h1>Agent</h1>
            {settings ? (
              <p>
                <em>{settings.configured ? settings.model : "站内搜索兜底"}</em>
              </p>
            ) : null}
          </div>
          <div className="agent__actions">
            <Link className="agent__ghost" to="/repos">
              仓库页
            </Link>
            {run?.status === "running" ? (
              <button type="button" className="agent__ghost" onClick={() => void stop()}>
                停止
              </button>
            ) : null}
            <button type="button" className="agent__ghost" onClick={() => setShowTrace((value) => !value)}>
              {showTrace ? "隐藏轨迹" : "轨迹"}
            </button>
          </div>
        </header>

        <div className="agent__bezel">
          <div className="agent__top">
            <em>{run ? run.execution_note : "还没有对话"}</em>
          </div>
          <div className="agent__thread">
            {!run ? (
              <div className="agent__empty">
                <p>可以试试</p>
                <div className="agent__chips">
                  {["Ideaface 是做什么的", "现在展示位跑着谁", "有哪些可运行项目", "成绩页有什么"].map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      onClick={() => {
                        setText(sample);
                      }}
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              run.loop.conversation.map((item, index) => (
                <article key={`${item.role}-${index}`} className={`agent__bubble agent__bubble--${item.role}`}>
                  <span>{item.role === "user" ? "你" : "助手"}</span>
                  <div>{renderText(item.content)}</div>
                </article>
              ))
            )}
            {run?.status === "awaiting_user" && run.loop.pending ? (
              <div className="agent__clarify">
                <strong>需要补充</strong>
                <p>{run.loop.pending.question}</p>
                {run.loop.pending.options?.length ? (
                  <div className="agent__chips">
                    {run.loop.pending.options.map((option) => (
                      <button key={option} type="button" onClick={() => setText(option)}>
                        {option}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {showTrace && run?.loop.trajectory.length ? (
              <details className="agent__trace" open>
                <summary>工具轨迹 · {run.loop.trajectory.length}</summary>
                <ol>
                  {run.loop.trajectory.map((item, index) => (
                    <li key={`${item.action}-${index}`}>
                      <code>{item.action}</code> {item.detail}
                    </li>
                  ))}
                </ol>
              </details>
            ) : null}
            <div ref={bottomRef} />
          </div>

          <form className="agent__composer" onSubmit={(event) => void submit(event)}>
            {error ? <p className="agent__error">{error}</p> : null}
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={placeholder}
              rows={3}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submit();
                }
              }}
            />
            <button type="submit" disabled={busy || !text.trim()}>
              {busy ? "处理中…" : run?.status === "awaiting_user" ? "回复" : "发送"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

function renderText(content: string) {
  const parts = content.split(/(\[[^\]]+\]\([^)]+\)|\/[a-z0-9/_-]+)/gi);
  return parts.map((part, index) => {
    const md = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (md) {
      const href = md[2].startsWith("http") ? md[2] : md[2];
      if (href.startsWith("http")) {
        return (
          <a key={index} href={href} target="_blank" rel="noreferrer">
            {md[1]}
          </a>
        );
      }
      return (
        <Link key={index} to={href}>
          {md[1]}
        </Link>
      );
    }
    if (/^\/[a-z0-9/_-]+$/i.test(part)) {
      return (
        <Link key={index} to={part}>
          {part}
        </Link>
      );
    }
    return <span key={index}>{part}</span>;
  });
}
