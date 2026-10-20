import type { Board } from "../api";
import type { Project } from "../data/projects";

const STATUS_LABEL: Record<Board["status"], string> = {
  idle: "空闲",
  stopping: "停止中",
  cloning: "拉取代码",
  installing: "准备环境",
  starting: "启动进程",
  running: "运行中",
  error: "失败",
};

type Props = {
  board: Board;
  project: Project | null;
};

export function LiveFrame({ board, project }: Props) {
  const busy =
    board.status === "cloning" ||
    board.status === "installing" ||
    board.status === "starting" ||
    board.status === "stopping";

  if (board.status === "idle" && !project) {
    return (
      <div className="live live--idle">
        <div className="live__orb" aria-hidden="true" />
        <p className="eyebrow">Live Stage</p>
        <h2>还没有运行中的项目</h2>
        <p>选一个标了「可运行」的仓库。源码从 GitHub 下载到本机，Docker 里只保留这一个容器。</p>
      </div>
    );
  }

  if (board.status === "error") {
    return (
      <div className="live live--error">
        <p className="eyebrow">启动失败</p>
        <h2>{project?.name ?? "这个项目"} 没有跑起来</h2>
        <p>{board.message}</p>
        {board.output ? <pre className="live__log">{board.output}</pre> : null}
      </div>
    );
  }

  if (busy || board.status !== "running" || !board.previewUrl) {
    return (
      <div className="live live--busy">
        <div className="spinner" aria-hidden="true" />
        <p>{board.message || STATUS_LABEL[board.status]}</p>
      </div>
    );
  }

  return (
    <div className="live live--frame">
      <div className="live__chrome">
        <span className="pulse" />
        <strong>{project?.name}</strong>
        <em>{board.message}</em>
        <a href={directPreview(board, project)} target="_blank" rel="noreferrer">
          新窗口打开
        </a>
      </div>
      <iframe
        key={`${board.activeId}-${board.startedAt}-${board.port}`}
        title={project?.name ?? "live"}
        src={directPreview(board, project)}
        className="live__iframe"
      />
    </div>
  );
}

function directPreview(board: Board, project: Project | null) {
  if (!board.port) return board.previewUrl ?? "about:blank";
  const path = project?.launch.readyPath || "/";
  const host = window.location.hostname || "127.0.0.1";
  const route = `${path.startsWith("/") ? path : `/${path}`}`;
  const stamp = encodeURIComponent(board.startedAt || board.activeId || "");
  return `http://${host}:${board.port}${route}${route.includes("?") ? "&" : "?"}slot=${stamp}`;
}
