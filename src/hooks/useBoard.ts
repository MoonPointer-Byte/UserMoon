import { useCallback, useEffect, useRef, useState } from "react";
import { fetchBoard, launchProject, stopProject, type Board } from "../api";

const EMPTY: Board = {
  activeId: null,
  status: "idle",
  message: "展示位空闲",
  startedAt: null,
  startedBy: null,
  previewUrl: null,
  port: null,
  output: "",
  logs: [],
};

const IDLE_MS = 12_000;
const BUSY_MS = 2_000;

export function useBoard() {
  const [board, setBoard] = useState<Board>(EMPTY);
  const [error, setError] = useState("");
  const [needOwner, setNeedOwner] = useState(false);
  const [pending, setPending] = useState(false);
  const statusRef = useRef(board.status);

  const refresh = useCallback(async () => {
    if (document.hidden) return;
    try {
      const next = await fetchBoard();
      statusRef.current = next.status;
      setBoard((prev) =>
        prev.status === next.status &&
        prev.activeId === next.activeId &&
        prev.message === next.message &&
        prev.port === next.port &&
        prev.previewUrl === next.previewUrl &&
        prev.output === next.output &&
        prev.logs.length === next.logs.length
          ? prev
          : next,
      );
      setError("");
    } catch {
      setError("启动台连不上，请稍后重试或检查站点服务。");
    }
  }, []);

  useEffect(() => {
    void refresh();
    let timer = 0;

    const schedule = () => {
      window.clearInterval(timer);
      if (document.hidden) return;
      const busy =
        statusRef.current === "cloning" ||
        statusRef.current === "installing" ||
        statusRef.current === "starting" ||
        statusRef.current === "stopping";
      timer = window.setInterval(() => void refresh(), busy ? BUSY_MS : IDLE_MS);
    };

    schedule();
    const onVis = () => {
      if (document.hidden) window.clearInterval(timer);
      else {
        void refresh();
        schedule();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh, board.status]);

  const launch = useCallback(async (id: string, visitor: string) => {
    setPending(true);
    try {
      const next = await launchProject(id, visitor);
      statusRef.current = next.status;
      setBoard(next);
      setError("");
      setNeedOwner(false);
    } catch (reason) {
      const err = reason as Error & { status?: number };
      if (err.status === 401 || err.status === 503) {
        setNeedOwner(true);
        setError(err.message || "需要主人密钥才能启动");
      } else {
        setError(err.message || "启动请求失败，请再试一次。");
      }
    } finally {
      setPending(false);
    }
  }, []);

  const stop = useCallback(async (visitor: string) => {
    setPending(true);
    try {
      const next = await stopProject(visitor);
      statusRef.current = next.status;
      setBoard(next);
      setError("");
      setNeedOwner(false);
    } catch (reason) {
      const err = reason as Error & { status?: number };
      if (err.status === 401 || err.status === 503) {
        setNeedOwner(true);
        setError(err.message || "需要主人密钥才能停止");
      } else {
        setError(err.message || "停止请求失败，请再试一次。");
      }
    } finally {
      setPending(false);
    }
  }, []);

  return { board, error, needOwner, pending, launch, stop, refresh, setNeedOwner };
}
