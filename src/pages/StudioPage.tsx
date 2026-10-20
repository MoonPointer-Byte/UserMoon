import { useEffect } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { LiveFrame } from "../components/LiveFrame";
import { findProject, PROJECTS } from "../data/projects";
import { useBoard } from "../hooks/useBoard";

type OutletCtx = { visitor: string; visitorReady: boolean };

export function StudioPage() {
  const { visitor, visitorReady } = useOutletContext<OutletCtx>();
  const [params, setParams] = useSearchParams();
  const { board, error, pending, launch, stop } = useBoard();
  const active = findProject(board.activeId);
  const launchId = params.get("launch");
  const busy =
    pending ||
    board.status === "cloning" ||
    board.status === "installing" ||
    board.status === "starting" ||
    board.status === "stopping";

  useEffect(() => {
    if (!visitorReady || !launchId || busy) return;
    if (!PROJECTS.some((item) => item.id === launchId)) return;
    if (board.activeId === launchId && board.status === "running") {
      setParams({}, { replace: true });
      return;
    }
    void launch(launchId, visitor).then(() => setParams({}, { replace: true }));
  }, [
    launchId,
    board.activeId,
    board.status,
    launch,
    busy,
    setParams,
    visitor,
    visitorReady,
  ]);

  return (
    <main className="studio">
      <section className="studio__list panel">
        <header>
          <p className="eyebrow">单槽</p>
          <h1>切换</h1>
        </header>
        <ul>
          {PROJECTS.map((project) => {
            const on = board.activeId === project.id;
            return (
              <li key={project.id} className={on ? "is-on" : undefined}>
                <div>
                  <strong>{project.name}</strong>
                  <span>
                    {project.year} · {project.lang} · {project.launch.kind}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={busy || (on && board.status === "running")}
                  onClick={() => void launch(project.id, visitor)}
                >
                  {on && board.status === "running"
                    ? "运行中"
                    : on
                      ? STATUS[board.status]
                      : "启动"}
                </button>
              </li>
            );
          })}
        </ul>
        <button
          className="stop"
          type="button"
          disabled={busy || (!board.activeId && board.status === "idle")}
          onClick={() => void stop(visitor)}
        >
          停止当前项目
        </button>
        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="studio__stage">
        <LiveFrame board={board} project={active} />
        {active ? (
          <footer className="stage-foot">
            <span>
              {board.startedBy ? `由 ${board.startedBy} 启动` : "等待启动"}
              {board.port ? ` · :${board.port}` : ""}
            </span>
            <a href={active.url} target="_blank" rel="noreferrer">
              GitHub
            </a>
          </footer>
        ) : null}
      </section>

      <aside className="log panel">
        <header>
          <p className="eyebrow">记录栏</p>
          <h2>多人共享</h2>
        </header>
        <ol>
          {board.logs.length === 0 ? (
            <li className="log__empty">还没有记录。</li>
          ) : (
            board.logs.map((item) => (
              <li key={item.id}>
                <time>{formatStamp(item.at)}</time>
                <strong>{item.visitor}</strong>
                <span className={`act act--${item.action}`}>{ACTION[item.action]}</span>
                <p>{item.detail}</p>
              </li>
            ))
          )}
        </ol>
      </aside>
    </main>
  );
}

const STATUS: Record<string, string> = {
  idle: "空闲",
  stopping: "停止中",
  cloning: "拉取中",
  installing: "安装中",
  starting: "启动中",
  running: "运行中",
  error: "失败",
};

const ACTION: Record<string, string> = {
  launch: "启动",
  switch: "切换",
  stop: "停止",
  system: "系统",
};

function formatStamp(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
