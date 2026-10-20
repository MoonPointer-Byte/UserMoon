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

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!response.ok) throw new Error("请求失败");
  return (await response.json()) as Board;
}

export function fetchBoard() {
  return request("/api/board");
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
