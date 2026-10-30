export type BoardStatus =
  | "idle"
  | "stopping"
  | "cloning"
  | "installing"
  | "starting"
  | "running"
  | "error";

export type LogItem = {
  id: string;
  at: string;
  visitor: string;
  action: "launch" | "switch" | "stop" | "system";
  projectId: string;
  projectName: string;
  detail: string;
};

export type Board = {
  activeId: string | null;
  status: BoardStatus;
  message: string;
  startedAt: string | null;
  startedBy: string | null;
  previewUrl: string | null;
  port: number | null;
  output: string;
  logs: LogItem[];
};

import { ownerHeaders } from "./lib/owner";

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...ownerHeaders(),
      ...(init?.headers || {}),
    },
  });
  const json = (await response.json().catch(() => ({}))) as Board & { error?: string };
  if (!response.ok) {
    const err = new Error(json.error || "请求失败") as Error & { status?: number };
    err.status = response.status;
    throw err;
  }
  return json as Board;
}

export function fetchBoard() {
  return request("/api/board", { method: "GET", headers: { "Content-Type": "application/json" } });
}

export function launchProject(id: string, visitor: string) {
  return request("/api/launch", {
    method: "POST",
    body: JSON.stringify({ id, visitor }),
  });
}

export function stopProject(visitor: string) {
  return request("/api/stop", {
    method: "POST",
    body: JSON.stringify({ visitor }),
  });
}
