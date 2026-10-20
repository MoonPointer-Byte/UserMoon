import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { LiveFrame } from "../components/LiveFrame";
import { BLURBS } from "../data/blurbs";
import { findProject, PROJECTS } from "../data/projects";
import { useBoard } from "../hooks/useBoard";

type Repo = {
  name: string;
  description: string;
  isPrivate: boolean;
  isFork: boolean;
  language: string;
  updatedAt: string;
  url: string;
  stars: number;
};

type OutletCtx = { visitor: string };

function previewHref(port: number, readyPath?: string, startedAt?: string | null) {
  const path = readyPath || "/";
  const host = window.location.hostname || "127.0.0.1";
  const route = path.startsWith("/") ? path : `/${path}`;
  const stamp = encodeURIComponent(startedAt || "");
  return `http://${host}:${port}${route}${route.includes("?") ? "&" : "?"}slot=${stamp}`;
}

const RUNNABLE = new Map<string, string[]>();
for (const project of PROJECTS) {
  const name = project.launch.repo.split("/")[1] ?? project.name;
  const list = RUNNABLE.get(name) ?? [];
  list.push(project.id);
  RUNNABLE.set(name, list);
}

const SHOWCASE = PROJECTS.filter((project) => project.launch);

export function ReposPage() {
  const { visitor } = useOutletContext<OutletCtx>();
  const { board, error: boardError, pending, launch, stop } = useBoard();
  const [login, setLogin] = useState("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [hideForks, setHideForks] = useState(true);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState(SHOWCASE[0]?.id ?? "");
  const seeded = useRef(false);
  const active = findProject(board.activeId);
  const focus = findProject(picked) ?? active ?? SHOWCASE[0];
  const showingLive = Boolean(focus && board.activeId === focus.id && board.status !== "idle");
  const runningThis = Boolean(focus && board.activeId === focus.id && board.status === "running");
  const busyThis = Boolean(
    focus &&
      board.activeId === focus.id &&
      board.status !== "idle" &&
      board.status !== "error" &&
      !runningThis,
  );

  useEffect(() => {
    if (seeded.current || !board.activeId) return;
    seeded.current = true;
    setPicked(board.activeId);
  }, [board.activeId]);

  useEffect(() => {
    void fetch("/api/github")
      .then(async (response) => {
        const data = (await response.json()) as { login?: string; repos?: Repo[]; error?: string };
        if (!response.ok) throw new Error(data.error || "读取失败");
        setLogin(data.login ?? "");
        setRepos(data.repos ?? []);
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "无法连接 GitHub");
      });
  }, []);

  const visible = useMemo(() => {
    const list = repos.filter((repo) => (hideForks ? !repo.isFork : true));
    return list.sort((a, b) => Number(RUNNABLE.has(b.name)) - Number(RUNNABLE.has(a.name)));
  }, [repos, hideForks]);

  if (!focus) return null;

  const lead = BLURBS[focus.id] || focus.summary;
  const runLabel = runningThis ? "运行中" : busyThis ? "启动中" : board.status === "error" && board.activeId === focus?.id ? "重试" : board.activeId && board.activeId !== focus?.id && board.status !== "idle" ? `切换到 ${focus?.name ?? ""}` : "运行项目";

  return (
    <main className="showcase">
      <div className="showcase__stage">
        <nav className="showcase__rail" aria-label="可运行项目">
          <p>可运行</p>
          {SHOWCASE.map((project) => {
            const on = project.id === focus.id;
            return (
              <button
                key={project.id}
                type="button"
                className={on ? "is-on" : undefined}
                disabled={busyThis && project.id === board.activeId}
                onClick={() => {
                  setPicked(project.id);
                  const same = board.activeId === project.id;
                  const starting =
                    board.status === "cloning" ||
                    board.status === "installing" ||
                    board.status === "starting" ||
                    board.status === "stopping";
                  if (same && (board.status === "running" || starting)) return;
                  void launch(project.id, visitor);
                }}
              >
                <strong>{project.name}</strong>
                <span>{project.scene}</span>
              </button>
            );
          })}
        </nav>

        <section className="showcase__main">
          <header className="showcase__hero">
            <div className="showcase__id">
              <h1>{focus.name}</h1>
              <p className="showcase__lead">{focus.scene} · {lead}</p>
            </div>
            <div className="showcase__actions">
              <button
                className="showcase__run"
                type="button"
                disabled={pending || runningThis || busyThis}
                onClick={() => void launch(focus.id, visitor)}
              >
                {runLabel}
              </button>
              <a className="showcase__ghost" href={focus.url} target="_blank" rel="noreferrer">
                查看代码
              </a>
              {runningThis && board.port ? (
                <a className="showcase__ghost" href={previewHref(board.port, focus.launch.readyPath, board.startedAt)} target="_blank" rel="noreferrer">
                  新窗口打开
                </a>
              ) : null}
              <button className="showcase__ghost" type="button" disabled={pending || board.status === "idle"} onClick={() => void stop(visitor)}>
                停止
              </button>
            </div>
          </header>
          {boardError ? <p className="showcase__note">{boardError}</p> : null}
          <section className="showcase__bezel">
            <div className="showcase__top">
              <em>{showingLive ? board.message : "未启动"}</em>
            </div>
            <div className="showcase__screen">
              {showingLive ? (
                <LiveFrame board={board} project={focus} />
              ) : (
                <div className="showcase__poster">
                  <p>{focus.lang}</p>
                  <strong>在这里打开 {focus.name}</strong>
                  <span>同一时间只运行一个项目。点左侧项目即可切换，画面会出现在这个窗口里。</span>
                </div>
              )}
            </div>
          </section>
        </section>
      </div>

      <details className="showcase__more">
        <summary>
          <span>全部仓库 · {login ? `@${login}` : "GitHub"} · {visible.length || "—"}</span>
          <label onClick={(event) => event.stopPropagation()}>
            <input type="checkbox" checked={hideForks} onChange={(event) => setHideForks(event.target.checked)} />
            隐藏 fork
          </label>
        </summary>
        {error ? <p>{error}</p> : null}
        <ul>
          {visible.map((repo) => (
            <li key={repo.name}>
              <a href={repo.url} target="_blank" rel="noreferrer">
                {repo.name}
              </a>
              <span>{repo.language || "代码"}</span>
              <em>{repo.description || "还没有简介"}</em>
            </li>
          ))}
        </ul>
      </details>
    </main>
  );
}
