import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { LiveFrame, livePreviewHref } from "../components/LiveFrame";
import { BLURBS } from "../data/blurbs";
import { findProject, PROJECTS } from "../data/projects";
import { useBoard } from "../hooks/useBoard";
import { useOwner } from "../hooks/useOwner";

type OutletCtx = { visitor: string; visitorReady: boolean };

type Repo = {
  name: string;
  description: string;
  isPrivate: boolean;
  isFork: boolean;
  language: string;
  url: string;
};

const SHOWCASE = PROJECTS.filter((project) => project.launch);
const BY_REPO = new Map<string, string>();
for (const project of PROJECTS) {
  const name = project.launch.repo.split("/")[1] ?? project.name;
  BY_REPO.set(name, project.id);
}

export function WorksPage() {
  const { visitor, visitorReady } = useOutletContext<OutletCtx>();
  const [params, setParams] = useSearchParams();
  const { isOwner } = useOwner();
  const { board, error: boardError, pending, launch, stop } = useBoard();
  const tag = params.get("tag");
  const lang = params.get("lang");
  const idParam = params.get("id") || params.get("run") || params.get("pick");
  const wantRun = Boolean(params.get("run"));

  const filtered = useMemo(() => {
    return PROJECTS.filter((project) => {
      if (tag && !project.tags.includes(tag)) return false;
      if (lang && project.lang !== lang) return false;
      return true;
    });
  }, [tag, lang]);

  const [picked, setPicked] = useState(() => {
    if (idParam && PROJECTS.some((item) => item.id === idParam)) return idParam;
    return filtered[0]?.id ?? PROJECTS[0]?.id ?? "";
  });
  const seeded = useRef(false);
  const autoRan = useRef(false);
  const autoTarget = useRef<string | null>(wantRun && idParam ? idParam : null);

  const focus = findProject(picked) ?? findProject(filtered[0]?.id ?? null) ?? PROJECTS[0];
  const runningThis = Boolean(focus && board.activeId === focus.id && board.status === "running");
  const busyThis = Boolean(
    focus &&
      board.activeId === focus.id &&
      board.status !== "idle" &&
      board.status !== "error" &&
      !runningThis,
  );
  const boardBusy =
    board.status === "cloning" ||
    board.status === "installing" ||
    board.status === "starting" ||
    board.status === "stopping";
  const canControl = isOwner && visitorReady && !pending && !boardBusy;
  const showingLive = Boolean(focus && board.activeId === focus.id && board.status !== "idle");

  const [repos, setRepos] = useState<Repo[]>([]);
  const [hideForks, setHideForks] = useState(true);
  const [repoError, setRepoError] = useState("");
  const [login, setLogin] = useState("");

  useEffect(() => {
    if (idParam && PROJECTS.some((item) => item.id === idParam)) {
      setPicked(idParam);
      if (wantRun) autoTarget.current = idParam;
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("run");
          next.delete("pick");
          if (!tag && !lang) next.set("id", idParam);
          return next;
        },
        { replace: true },
      );
    }
  }, [idParam, wantRun, setParams, tag, lang]);

  useEffect(() => {
    if (seeded.current || !board.activeId) return;
    seeded.current = true;
    setPicked(board.activeId);
  }, [board.activeId]);

  useEffect(() => {
    const want = autoTarget.current;
    if (autoRan.current || !want || !isOwner || !visitorReady) return;
    setPicked(want);
    if (board.activeId === want && (board.status === "running" || boardBusy)) {
      autoRan.current = true;
      return;
    }
    autoRan.current = true;
    void launch(want, visitor);
  }, [isOwner, visitorReady, board.activeId, board.status, boardBusy, launch, visitor]);

  useEffect(() => {
    void fetch("/api/github")
      .then(async (response) => {
        const data = (await response.json()) as { login?: string; repos?: Repo[]; error?: string };
        if (!response.ok) throw new Error(data.error || "读取失败");
        setLogin(data.login ?? "");
        setRepos(data.repos ?? []);
      })
      .catch((reason: unknown) => {
        setRepoError(reason instanceof Error ? reason.message : "无法连接 GitHub");
      });
  }, []);

  const visibleRepos = useMemo(() => {
    const list = repos.filter((repo) => (hideForks ? !repo.isFork : true));
    return list.sort((a, b) => Number(BY_REPO.has(b.name)) - Number(BY_REPO.has(a.name)));
  }, [repos, hideForks]);

  if (!focus) return null;

  const lead = BLURBS[focus.id] || focus.summary;
  const runnable = Boolean(focus.launch);
  const runLabel = runningThis
    ? "运行中"
    : busyThis
      ? "启动中…"
      : board.status === "error" && board.activeId === focus.id
        ? "重试"
        : board.activeId && board.activeId !== focus.id && board.status !== "idle"
          ? `切换到 ${focus.name}`
          : "运行";

  function selectProject(id: string) {
    setPicked(id);
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("id", id);
        return next;
      },
      { replace: true },
    );
  }

  return (
    <main className="showcase">
      <div className="showcase__stage">
        <nav className="showcase__rail" aria-label="作品">
          <p>
            作品
            {tag || lang ? ` · ${tag || lang}` : ""}
          </p>
          {(tag || lang) && (
            <Link className="showcase__rail-clear" to="/works">
              清除筛选
            </Link>
          )}
          {filtered.map((project) => {
            const on = project.id === focus.id;
            const live = board.activeId === project.id && board.status === "running";
            return (
              <button
                key={project.id}
                type="button"
                className={on ? "is-on" : undefined}
                onClick={() => selectProject(project.id)}
              >
                <strong>
                  {project.name}
                  {live ? " · 在跑" : ""}
                </strong>
                <span>
                  {project.scene} · {project.lang}
                </span>
              </button>
            );
          })}
          {filtered.length === 0 ? <p className="showcase__rail-empty">这个筛选下没有作品</p> : null}
        </nav>

        <section className="showcase__main">
          <header className="showcase__hero">
            <div className="showcase__id">
              <h1>{focus.name}</h1>
              <p className="showcase__lead">
                {focus.year} · {focus.scene} · {focus.lang}
                {lead ? ` · ${lead}` : ""}
              </p>
            </div>
            <div className="showcase__actions">
              {isOwner && runnable ? (
                <>
                  <button
                    className="showcase__run"
                    type="button"
                    disabled={!canControl || runningThis || busyThis}
                    onClick={() => void launch(focus.id, visitor)}
                  >
                    {runLabel}
                  </button>
                  <button
                    className="showcase__ghost"
                    type="button"
                    disabled={!canControl || board.status === "idle"}
                    onClick={() => void stop(visitor)}
                  >
                    停止
                  </button>
                </>
              ) : null}
              <a className="showcase__ghost" href={focus.url} target="_blank" rel="noreferrer">
                GitHub
              </a>
              {runningThis && board.previewUrl ? (
                <a className="showcase__ghost" href={livePreviewHref(board, focus)} target="_blank" rel="noreferrer">
                  新窗口
                </a>
              ) : null}
            </div>
          </header>

          {boardError && isOwner ? <p className="showcase__note">{boardError}</p> : null}

          <div className="showcase__meta">
            <p>{focus.summary}</p>
            <div className="tags">
              {focus.tags.map((item) => (
                <Link key={item} className="soft-pill" to={`/works?tag=${encodeURIComponent(item)}`}>
                  {item}
                </Link>
              ))}
              <Link className="soft-pill" to={`/works?lang=${encodeURIComponent(focus.lang)}`}>
                {focus.lang}
              </Link>
            </div>
          </div>

          <section className="showcase__bezel">
            <div className="showcase__top">
              <em>
                {showingLive
                  ? board.message
                  : runnable
                    ? isOwner
                      ? "未启动 · 点「运行」在下方打开展示"
                      : board.status === "running" && board.activeId !== focus.id
                        ? `展示位正运行 ${findProject(board.activeId)?.name ?? ""}`
                        : "介绍模式 · 展示需主人启动"
                    : "静态作品 · 无在线展示"}
              </em>
            </div>
            <div className="showcase__screen">
              {showingLive ? (
                <LiveFrame board={board} project={focus} />
              ) : (
                <div className="showcase__poster">
                  <p>{focus.env}</p>
                  <strong>{focus.name}</strong>
                  <span>
                    {runnable
                      ? isOwner
                        ? "左侧选作品，右上角运行。同一时间只跑一个。"
                        : "可阅读介绍与源码；演示画面由主人启动后出现在这里。"
                      : "这个作品没有在线展示位，可从 GitHub 查看。"}
                  </span>
                  {SHOWCASE.length && isOwner ? (
                    <span className="showcase__poster-sub">
                      可运行：{SHOWCASE.map((item) => item.name).join(" · ")}
                    </span>
                  ) : null}
                </div>
              )}
            </div>
          </section>
        </section>
      </div>

      <details className="showcase__more">
        <summary>
          <span>
            GitHub 仓库 · {login ? `@${login}` : "…"} · {visibleRepos.length || "—"}
          </span>
          <label onClick={(event) => event.stopPropagation()}>
            <input type="checkbox" checked={hideForks} onChange={(event) => setHideForks(event.target.checked)} />
            隐藏 fork
          </label>
        </summary>
        {repoError ? <p>{repoError}</p> : null}
        <ul>
          {visibleRepos.map((repo) => (
            <li key={repo.name}>
              <a href={repo.url} target="_blank" rel="noreferrer">
                <strong>{repo.name}</strong>
                <span>{repo.description || repo.language || "—"}</span>
              </a>
              {BY_REPO.has(repo.name) ? (
                <button type="button" className="ghost-btn" onClick={() => selectProject(BY_REPO.get(repo.name)!)}>
                  选中
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </details>
    </main>
  );
}
