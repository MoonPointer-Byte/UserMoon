import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import catalog from "../shared/catalog.json";

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

type Project = (typeof catalog)[number];

const ROOT = process.cwd();
const SRC_ROOT = "D:\\usermoon-src";
const RUNTIME_IMAGE = "usermoon-runtime:1";
const RUNTIME = path.resolve(ROOT, "runtime/projects");
const BOARD_FILE = path.resolve(ROOT, "server/board.json");
const SLOT = "usermoon-slot";
const BY_ID = new Map(catalog.map((item) => [item.id, item]));

let activePort: number | null = null;
let queue: Promise<void> = Promise.resolve();

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

function readBoard(): Board {
  try {
    const data = JSON.parse(fs.readFileSync(BOARD_FILE, "utf8")) as Board;
    return { ...EMPTY, ...data, logs: Array.isArray(data.logs) ? data.logs.slice(0, 100) : [] };
  } catch {
    return { ...EMPTY, logs: [] };
  }
}

function writeBoard(board: Board) {
  fs.mkdirSync(path.dirname(BOARD_FILE), { recursive: true });
  fs.writeFileSync(BOARD_FILE, JSON.stringify(board, null, 2), "utf8");
}

function patchBoard(partial: Partial<Board>) {
  const board = { ...readBoard(), ...partial };
  writeBoard(board);
  return board;
}

function pushLog(item: Omit<LogItem, "id" | "at">) {
  const board = readBoard();
  board.logs.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    ...item,
  });
  board.logs = board.logs.slice(0, 100);
  writeBoard(board);
}

function docker(args: string[]) {
  return new Promise<{ code: number; out: string }>((resolve, reject) => {
    const proc = spawn("docker", args, { windowsHide: true });
    let out = "";
    proc.stdout?.on("data", (chunk) => {
      out += String(chunk);
    });
    proc.stderr?.on("data", (chunk) => {
      out += String(chunk);
    });
    proc.on("error", reject);
    proc.on("exit", (code) => resolve({ code: code ?? 1, out }));
  });
}

let dockerReady = false;

async function ensureDocker() {
  if (dockerReady) return;
  const started = Date.now();
  let last = "";
  while (Date.now() - started < 120000) {
    try {
      const result = await docker(["info", "--format", "{{.ServerVersion}}"]);
      if (result.code === 0 && result.out.trim()) {
        dockerReady = true;
        return;
      }
      last = result.out;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    patchBoard({ status: "starting", message: "正在等待 Docker Desktop 引擎…" });
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(
    `Docker 引擎没有就绪。请打开 Docker Desktop 后再试。${last ? ` ${last.slice(0, 180)}` : ""}`,
  );
}

function run(command: string, cwd: string) {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(command, { cwd, shell: true, windowsHide: true });
    let stderr = "";
    proc.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    proc.on("error", reject);
    proc.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.slice(-600) || `命令失败: ${command}`));
    });
  });
}

function githubFolder(repo: string) {
  return repo.split("/")[1] ?? repo;
}

async function ensureSource(project: Project) {
  const launch = project.launch;
  const folder = githubFolder(launch.repo);
  const root = path.join("D:\\usermoon-src", folder);
  const workdir = path.resolve(root, launch.cwd || ".");
  if (!fs.existsSync(workdir)) {
    patchBoard({ status: "cloning", message: `正在下载 GitHub 源码 ${launch.repo}…` });
    try {
      await run(`python "${path.join(ROOT, "server", "fetch_repo.py")}" ${launch.repo} ${folder}`, ROOT);
    } catch (error) {
      const fallback = launch.localPath
        ? path.isAbsolute(launch.localPath)
          ? launch.localPath
          : path.resolve(ROOT, launch.localPath)
        : "";
      if (fallback && fs.existsSync(fallback)) return fallback;
      throw error;
    }
  }
  if (!fs.existsSync(workdir)) {
    throw new Error(`GitHub 源码里没有目录 ${launch.cwd || "."}（${launch.repo}）`);
  }
  return workdir;
}

async function removeSlot() {
  await docker(["rm", "-f", SLOT]);
  activePort = null;
}

function hostPorts() {
  return [...new Set(catalog.map((item) => item.launch.port))];
}

function waitReady(port: number, readyPath: string, timeoutMs = 240000, isStale?: () => boolean, stamp?: string, expect?: string) {
  const started = Date.now();
  let noted = "";
  return new Promise<void>((resolve, reject) => {
    const tick = () => {
      if (isStale?.()) {
        reject(Object.assign(new Error("stale"), { stale: true }));
        return;
      }
      void containerLogs()
        .then((log) => {
          const line = log
            .split("\n")
            .map((item) => item.trim())
            .filter((item) => item && !item.startsWith("SLOT ") && !item.startsWith("Traceback") && !item.startsWith("File "))
            .at(-1);
          if (line && line !== noted && !isStale?.()) {
            noted = line;
            patchBoard({ status: "starting", message: line.slice(0, 80) });
          }
        })
        .catch(() => undefined);
      const req = http.get(
        { host: "127.0.0.1", port, path: readyPath || "/", timeout: 2000 },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => {
            if (chunks.reduce((size, item) => size + item.length, 0) < 12000) chunks.push(chunk);
          });
          res.on("end", () => {
            const body = Buffer.concat(chunks).toString("utf8");
            if ((res.statusCode ?? 500) >= 500) {
              retry();
              return;
            }
            if (expect && !body.includes(expect)) {
              retry();
              return;
            }
            if (expect !== "flutter" && /flutter_bootstrap|main\.dart\.js|flutter_service_worker/i.test(body)) {
              retry();
              return;
            }
            if (!stamp) {
              resolve();
              return;
            }
            void containerLogs().then((log) => {
              if (log.includes(stamp)) resolve();
              else retry();
            });
          });
        },
      );
      req.on("error", retry);
      req.on("timeout", () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`容器端口 ${port} 在时限内没有响应`));
        return;
      }
      setTimeout(tick, 400);
    };
    tick();
  });
}

async function containerLogs() {
  const result = await docker(["exec", SLOT, "sh", "-c", "head -n 1 /tmp/app.log 2>/dev/null; echo; tail -n 30 /tmp/app.log 2>/dev/null"]);
  if (result.code !== 0) return "";
  return result.out.trim().slice(-1800);
}

function containerDir(project: Project) {
  const folder = githubFolder(project.launch.repo);
  const cwd = project.launch.cwd && project.launch.cwd !== "." ? project.launch.cwd : "";
  return `/src/${[folder, cwd].filter(Boolean).join("/")}`;
}

function runtimeMounts() {
  const mounts = new Map<string, string>();
  for (const project of catalog) {
    const launch = project.launch;
    if (launch.modulesVolume) {
      const explicit = "modulesAt" in launch && launch.modulesAt ? String(launch.modulesAt) : "";
      const at = explicit.startsWith("/app/")
        ? `/src/${githubFolder(launch.repo)}/${explicit.slice("/app/".length)}`
        : `${containerDir(project)}/node_modules`;
      if (!mounts.has(at)) mounts.set(at, launch.modulesVolume);
    }
    const caches = "caches" in launch && Array.isArray(launch.caches) ? launch.caches : [];
    for (const cache of caches) {
      if (!cache || typeof cache !== "object") continue;
      const volume = "volume" in cache ? String(cache.volume) : "";
      const at = "at" in cache ? String(cache.at) : "";
      if (volume && at && !mounts.has(at)) mounts.set(at, volume);
    }
  }
  return mounts;
}

async function publishedHostPorts() {
  const result = await docker([
    "inspect",
    "-f",
    "{{range $p, $conf := .NetworkSettings.Ports}}{{range $conf}}{{.HostPort}} {{end}}{{end}}",
    SLOT,
  ]);
  if (result.code !== 0) return new Set<number>();
  return new Set(
    result.out
      .split(/\s+/)
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item) && item > 0),
  );
}

async function ensureRuntime() {
  const image = await docker(["image", "inspect", RUNTIME_IMAGE]);
  if (image.code !== 0) {
    throw new Error("运行环境镜像还没有准备好。请先构建 usermoon-runtime:1。");
  }
  const wanted = hostPorts();
  const state = await docker(["inspect", "-f", "{{.State.Running}} {{.Config.Image}}", SLOT]);
  if (state.code === 0) {
    const [running, current] = state.out.trim().split(" ");
    if (current === RUNTIME_IMAGE && running !== "true") {
      const started = await docker(["start", SLOT]);
      if (started.code !== 0) throw new Error(started.out.slice(-800) || "运行环境启动失败");
    }
    if (current === RUNTIME_IMAGE) {
      const published = await publishedHostPorts();
      if (wanted.every((port) => published.has(port))) return;
    }
  }
  await removeSlot();
  const args = ["run", "-d", "--name", SLOT];
  for (const port of wanted) args.push("-p", `${port}:8080`);
  args.push("-v", `${SRC_ROOT}:/src`);
  for (const [at, volume] of runtimeMounts()) args.push("-v", `${volume}:${at}`);
  args.push(RUNTIME_IMAGE, "sleep", "infinity");
  const result = await docker(args);
  if (result.code !== 0) throw new Error(result.out.slice(-800) || "运行环境启动失败");
}

async function killApp() {
  await docker([
    "exec",
    SLOT,
    "sh",
    "-c",
    "if [ -f /tmp/app.pid ]; then kill -9 -- -$(cat /tmp/app.pid) 2>/dev/null; kill -9 $(cat /tmp/app.pid) 2>/dev/null; fi; fuser -k -9 8080/tcp 8081/tcp 8000/tcp 6379/tcp >/dev/null 2>&1 || true",
  ]);
}

function portOpen(port: number) {
  return new Promise<boolean>((resolve) => {
    const req = http.get({ host: "127.0.0.1", port, path: "/", timeout: 700 }, (res) => {
      res.resume();
      resolve((res.statusCode ?? 500) < 500);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensurePortFree(port: number) {
  await killApp();
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (!(await portOpen(port))) return;
    if (attempt === 10) await killApp();
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("上一个项目还占着端口，没有切换成功");
}

async function startApp(project: Project) {
  const bootScript = project.id === "ideaface" ? "ideaface-up.sh" : project.id === "moonreader" ? "moonreader-up.sh" : "";
  if (bootScript) {
    const runtimeDir = path.join(SRC_ROOT, ".runtime");
    fs.mkdirSync(runtimeDir, { recursive: true });
    const boot = fs.readFileSync(path.join(process.cwd(), "docker", bootScript), "utf8").replace(/\r\n/g, "\n");
    fs.writeFileSync(path.join(runtimeDir, bootScript), boot, "utf8");
  }
  const stamp = `SLOT ${project.id} ${Date.now()}`;
  const script = path.join(SRC_ROOT, ".slot-cmd.sh");
  fs.writeFileSync(script, `#!/bin/sh\necho "${stamp}"\ncd ${containerDir(project)}\n${project.launch.command}\n`, "utf8");
  await killApp();
  const result = await docker([
    "exec",
    SLOT,
    "sh",
    "-c",
    "nohup setsid sh /src/.slot-cmd.sh >/tmp/app.log 2>&1 & echo $! >/tmp/app.pid",
  ]);
  if (result.code !== 0) throw new Error(result.out.slice(-800) || "项目进程没有启动");
  return stamp;
}

async function startContainer(project: Project, source: string) {
  await removeSlot();
  const launch = project.launch;
  const args = [
    "run",
    "-d",
    "--name",
    SLOT,
    "-p",
    `${launch.port}:${launch.innerPort}`,
    "-v",
    `${source}:/app`,
  ];
  if (launch.modulesVolume) {
    const mountAt =
      "modulesAt" in launch && launch.modulesAt
        ? String(launch.modulesAt)
        : "/app/node_modules";
    args.push("-v", `${launch.modulesVolume}:${mountAt}`);
  }
  const caches = "caches" in launch && Array.isArray(launch.caches) ? launch.caches : [];
  for (const cache of caches) {
    if (!cache || typeof cache !== "object") continue;
    const volume = "volume" in cache ? String(cache.volume) : "";
    const at = "at" in cache ? String(cache.at) : "";
    if (volume && at) args.push("-v", `${volume}:${at}`);
  }
  args.push("-w", "/app", "--entrypoint", "sh", launch.image, "-c", launch.command);
  const result = await docker(args);
  if (result.code !== 0) {
    throw new Error(result.out.slice(-800) || "docker run 失败");
  }
  activePort = launch.port;
}

async function stopInternal(visitor: string, silent = false) {
  const board = readBoard();
  const current = board.activeId ? BY_ID.get(board.activeId) : null;
  if (!current && board.status === "idle") return board;
  patchBoard({ status: "stopping", message: current ? `正在停止 ${current.name}…` : "正在停止…" });
  await killApp();
  if (!silent && current) {
    pushLog({
      visitor,
      action: "stop",
      projectId: current.id,
      projectName: current.name,
      detail: `停止 ${current.name}，运行环境仍留在本机`,
    });
  }
  return patchBoard({
    activeId: null,
    status: "idle",
    message: "展示位空闲",
    startedAt: null,
    startedBy: null,
    previewUrl: null,
    port: null,
    output: "",
  });
}

async function launchInternal(id: string, visitor: string) {
  const project = BY_ID.get(id);
  if (!project) throw new Error("未知项目");
  const board = readBoard();
  if (board.activeId === id && board.status === "running") return board;

  if (board.activeId && board.activeId !== id) {
    const previous = BY_ID.get(board.activeId)?.name ?? board.activeId;
    pushLog({
      visitor,
      action: "switch",
      projectId: id,
      projectName: project.name,
      detail: `释放 ${previous}，改由 ${project.name} 占用展示位`,
    });
    await killApp();
  } else if (board.status !== "idle") {
    await killApp();
  } else {
    pushLog({
      visitor,
      action: "launch",
      projectId: id,
      projectName: project.name,
      detail: `用 Docker 启动 ${project.name}（${project.env}）`,
    });
  }

  patchBoard({
    activeId: id,
    status: "starting",
    message: `准备 Docker 环境：${project.env}`,
    startedAt: new Date().toISOString(),
    startedBy: visitor,
    previewUrl: null,
    port: project.launch.port,
    output: "",
  });

  try {
    await ensureDocker();
    const source = await ensureSource(project);
    if (!fs.existsSync(source)) throw new Error(`工作目录不存在: ${source}`);
    patchBoard({
      status: "installing",
      message: "环境已在本机，正在启动…",
    });
    await ensureRuntime();
    if (readBoard().activeId !== id) return readBoard();
    const port = project.launch.port;
    await ensurePortFree(port);
    if (readBoard().activeId !== id) return readBoard();
    const stamp = await startApp(project);
    const expect =
      project.id === "moonkeyboard"
        ? "flutter"
        : project.id === "answerbook"
          ? "OMNISCIENT"
          : project.id === "ideaface" || project.id === "moonreader" || project.id === "moonpointerai" || project.id === "englishai" || project.id === "evadance"
            ? "/@vite/client"
            : undefined;
    await waitReady(port, project.launch.readyPath || "/", 900_000, () => readBoard().activeId !== id, stamp, expect);
    const output = await containerLogs();
    if (readBoard().activeId !== id) return readBoard();
    pushLog({
      visitor: "系统",
      action: "system",
      projectId: project.id,
      projectName: project.name,
      detail: `${project.name} 已在端口 ${project.launch.port} 打开`,
    });
    const ready = project.launch.readyPath || "/";
    return patchBoard({
      activeId: id,
      status: "running",
      message: `${project.name} 运行中 · ${project.env}`,
      startedAt: new Date().toISOString(),
      startedBy: visitor,
      previewUrl: `/live${ready.startsWith("/") ? ready : `/${ready}`}`,
      port: project.launch.port,
      output,
    });
  } catch (error) {
    if (error && typeof error === "object" && "stale" in error) return readBoard();
    const output = await containerLogs().catch(() => "");
    await killApp();
    const detail = error instanceof Error ? error.message : String(error);
    if (readBoard().activeId !== id) return readBoard();
    pushLog({
      visitor: "系统",
      action: "system",
      projectId: project.id,
      projectName: project.name,
      detail: `启动失败: ${detail}`,
    });
    return patchBoard({
      activeId: id,
      status: "error",
      message: `${project.name}：${detail}`,
      startedAt: null,
      startedBy: visitor,
      previewUrl: null,
      port: null,
      output,
    });
  }
}

export function getBoard() {
  return readBoard();
}

export function claimLaunch(id: string, visitor: string) {
  const project = BY_ID.get(id);
  if (!project) throw new Error("未知项目");
  const board = readBoard();
  if (board.activeId === id && board.status === "running") return board;
  return patchBoard({
    activeId: id,
    status: "cloning",
    message: `正在准备 ${project.name}…`,
    startedAt: new Date().toISOString(),
    startedBy: visitor,
    previewUrl: null,
    port: project.launch.port,
    output: "",
  });
}

export async function recoverBoard() {
  const board = readBoard();
  const busy = board.status === "cloning" || board.status === "installing" || board.status === "starting" || board.status === "stopping";
  if (busy && board.activeId) {
    const project = BY_ID.get(board.activeId);
    const port = project?.launch.port ?? board.port ?? 0;
    const open = port ? await portOpen(port) : false;
    const stamp = await docker(["exec", SLOT, "sh", "-c", "head -n 1 /tmp/app.log 2>/dev/null"]);
    const mark = stamp.code === 0 ? stamp.out.trim() : "";
    if (open && mark.startsWith(`SLOT ${board.activeId} `)) {
      const ready = project?.launch.readyPath || "/";
      activePort = port;
      return patchBoard({
        status: "running",
        message: `${project?.name ?? board.activeId} 运行中${project ? ` · ${project.env}` : ""}`,
        previewUrl: `/live${ready.startsWith("/") ? ready : `/${ready}`}`,
        port,
      });
    }
    activePort = null;
    return patchBoard({
      activeId: null,
      status: "idle",
      message: "展示位空闲",
      startedAt: null,
      startedBy: null,
      previewUrl: null,
      port: null,
      output: "",
    });
  }
  if (board.status !== "running") return board;
  const result = await docker(["inspect", "-f", "{{.State.Running}}", SLOT]).catch(() => ({ code: 1, out: "" }));
  if (result.code === 0 && result.out.trim() === "true") {
    activePort = board.port;
    return board;
  }
  activePort = null;
  return patchBoard({
    activeId: null,
    status: "idle",
    message: "展示位空闲",
    startedAt: null,
    startedBy: null,
    previewUrl: null,
    port: null,
    output: "",
  });
}

export function getActivePort() {
  return activePort ?? readBoard().port;
}

export function enqueueLaunch(id: string, visitor: string) {
  const job = queue.then(() => launchInternal(id, visitor));
  queue = job.then(
    () => undefined,
    () => undefined,
  );
  return job;
}

export function enqueueStop(visitor: string) {
  const job = queue.then(() => stopInternal(visitor));
  queue = job.then(
    () => undefined,
    () => undefined,
  );
  return job;
}
