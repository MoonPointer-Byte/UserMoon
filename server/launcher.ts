import httpProxy from "http-proxy";
import type { Connect, Plugin, ViteDevServer } from "vite";
import catalog from "../shared/catalog.json";
import {
  enqueueLaunch,
  enqueueStop,
  claimLaunch,
  claimStop,
  getActivePort,
  getBoard,
  recoverBoard,
  touchShowcaseActivity,
} from "./runtime-manager";
import {
  getAgentRun,
  getAgentSettings,
  listAgentRuns,
  replyAgent,
  startAgent,
  stopAgent,
  updateAgentLlm,
} from "./agent";
import { SEARCH_DOMAINS, searchSite, suggestSite, type SearchDomain } from "./search";
import {
  addNote,
  bumpVisit,
  readVisit,
  githubSnapshot,
  getArticleProfiles,
  kickArticleSync,
  listAchievements,
  listNotes,
  listPostsAsync,
  listShares,
  neighborPosts,
  readPost,
  updateArticleProfiles,
} from "./site";
import { dbStats, initDb, listDbArticles, listDbNotes } from "./db";
import { assertOwner, ownerConfigured } from "./owner";
import { clientIp, rateLimit } from "./rate-limit";

const NAMES = new Map(catalog.map((item) => [item.id, item.name]));
const proxy = httpProxy.createProxyServer({
  ws: true,
  changeOrigin: true,
  xfwd: true,
});

proxy.on("error", (error, _req, res) => {
  const body = `上游项目未就绪: ${error.message}`;
  if (res && "writeHead" in res) {
    (res as Connect.ServerResponse).writeHead(502, {
      "Content-Type": "text/plain; charset=utf-8",
    });
    (res as Connect.ServerResponse).end(body);
  }
});

async function readJson(req: Connect.IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function send(res: Connect.ServerResponse, code: number, body: unknown) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function visitorName(value: unknown) {
  const name = String(value ?? "").trim().slice(0, 24);
  return name || "访客";
}

function attach(middlewares: Connect.Server, server?: ViteDevServer) {
  void initDb()
    .then(() => {
      kickArticleSync();
    })
    .catch((error) => {
      console.error("[db] init failed:", error instanceof Error ? error.message : error);
    });
  void recoverBoard();
  middlewares.use(async (req, res, next) => {
    try {
    const url = req.url ?? "";
    const pathname = url.split("?")[0] ?? "";
    const method = (req.method || "GET").toUpperCase();

    // vite preview: /UserMoon without slash shows a base-URL hint page — always land on the app.
    if (method === "GET" || method === "HEAD") {
      if (pathname === "/" || pathname === "") {
        res.statusCode = 302;
        res.setHeader("Location", "/UserMoon/");
        res.end();
        return;
      }
      if (pathname === "/UserMoon") {
        const query = url.includes("?") ? url.slice(url.indexOf("?")) : "";
        res.statusCode = 302;
        res.setHeader("Location", `/UserMoon/${query}`);
        res.end();
        return;
      }
    }

    if (pathname.startsWith("/live")) {
      const port = getActivePort();
      const board = getBoard();
      if (!port || board.status !== "running") {
        res.statusCode = 503;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(
          `<!doctype html><meta charset="utf-8"/><body style="font:14px sans-serif;padding:2rem;background:#e8eef4;color:#31465c">当前没有正在运行的项目。</body>`,
        );
        return;
      }
      touchShowcaseActivity();
      const rest = url.replace(/^\/live/, "") || "/";
      req.url = rest.startsWith("/") ? rest : `/${rest}`;
      proxy.web(req, res, { target: `http://127.0.0.1:${port}` });
      return;
    }

    if (!pathname.startsWith("/api/")) return next();

    if (req.method === "GET" && pathname === "/api/board") {
      return send(res, 200, getBoard());
    }

    if (req.method === "GET" && pathname === "/api/visit") {
      return send(res, 200, { count: await readVisit() });
    }

    if (req.method === "POST" && pathname === "/api/visit") {
      const ip = clientIp(req);
      const limited = rateLimit(`visit:${ip}`, 8, 60_000);
      if (!limited.ok) return send(res, 429, { error: `访问计数过快，请 ${limited.retryAfterSec}s 后再试` });
      return send(res, 200, { count: await bumpVisit() });
    }

    if (req.method === "GET" && pathname === "/api/posts") {
      const params = new URL(url, "http://127.0.0.1").searchParams;
      const force = params.get("refresh") === "1";
      if (force) {
        const gate = assertOwner(req);
        if (!gate.ok) return send(res, gate.status, { error: gate.error });
      }
      const posts = (await listPostsAsync(force)).map(({ html: _html, headings: _headings, ...post }) => post);
      return send(res, 200, { posts, profiles: await getArticleProfiles() });
    }

    if (req.method === "POST" && pathname === "/api/posts/refresh") {
      const gate = assertOwner(req);
      if (!gate.ok) return send(res, gate.status, { error: gate.error });
      const posts = (await listPostsAsync(true)).map(({ html: _html, headings: _headings, ...post }) => post);
      return send(res, 200, { ok: true, count: posts.length, posts, profiles: await getArticleProfiles() });
    }

    if (req.method === "GET" && pathname === "/api/manage/status") {
      return send(res, 200, { ownerConfigured: ownerConfigured() });
    }

    if (pathname.startsWith("/api/manage/")) {
      const gate = assertOwner(req);
      if (!gate.ok) return send(res, gate.status, { error: gate.error });
    }

    if (req.method === "GET" && pathname === "/api/manage/stats") {
      return send(res, 200, { stats: await dbStats(), profiles: await getArticleProfiles() });
    }

    if (req.method === "GET" && pathname === "/api/manage/articles") {
      return send(res, 200, { articles: listDbArticles() });
    }

    if (req.method === "GET" && pathname === "/api/manage/notes") {
      return send(res, 200, { notes: await listDbNotes(80) });
    }

    if (req.method === "POST" && pathname === "/api/manage/settings/articles") {
      const body = await readJson(req);
      try {
        const profiles = await updateArticleProfiles({
          csdnUser: body.csdnUser != null ? String(body.csdnUser) : undefined,
          csdnHome: body.csdnHome != null ? String(body.csdnHome) : undefined,
          csdnLimit: body.csdnLimit != null ? Number(body.csdnLimit) : undefined,
          githubOwner: body.githubOwner != null ? String(body.githubOwner) : undefined,
          syncReadmes: body.syncReadmes != null ? Boolean(body.syncReadmes) : undefined,
        });
        const posts = (await listPostsAsync(true)).map(({ html: _html, headings: _headings, ...post }) => post);
        return send(res, 200, { ok: true, profiles, count: posts.length });
      } catch (error) {
        return send(res, 400, { error: error instanceof Error ? error.message : "保存失败" });
      }
    }

    if (req.method === "GET" && pathname === "/api/manage/settings/agent") {
      return send(res, 200, await getAgentSettings(true));
    }

    if (req.method === "POST" && pathname === "/api/manage/settings/agent") {
      const body = await readJson(req);
      try {
        const settings = await updateAgentLlm({
          apiKey: body.apiKey != null ? String(body.apiKey) : undefined,
          baseUrl: body.baseUrl != null ? String(body.baseUrl) : undefined,
          model: body.model != null ? String(body.model) : undefined,
          clearKey: Boolean(body.clearKey),
        });
        return send(res, 200, { ok: true, settings });
      } catch (error) {
        return send(res, 400, { error: error instanceof Error ? error.message : "保存失败" });
      }
    }

    if (req.method === "GET" && pathname.startsWith("/api/posts/")) {
      const slug = decodeURIComponent(pathname.slice("/api/posts/".length));
      const post = await readPost(slug);
      if (!post) return send(res, 404, { error: "找不到这篇文章" });
      const neighbors = await neighborPosts(slug);
      return send(res, 200, {
        post,
        prev: neighbors.prev
          ? { slug: neighbors.prev.slug, title: neighbors.prev.title, source: neighbors.prev.source }
          : null,
        next: neighbors.next
          ? { slug: neighbors.next.slug, title: neighbors.next.title, source: neighbors.next.source }
          : null,
      });
    }

    if (req.method === "GET" && pathname === "/api/shares") {
      return send(res, 200, { shares: listShares() });
    }

    if (req.method === "GET" && pathname === "/api/achievements") {
      return send(res, 200, { achievements: listAchievements() });
    }

    if (req.method === "GET" && pathname === "/api/notes") {
      return send(res, 200, { notes: await listNotes() });
    }

    if (req.method === "POST" && pathname === "/api/notes") {
      const body = await readJson(req);
      // honeypot: bots fill hidden fields
      if (String(body.website || body.url || "").trim()) {
        return send(res, 200, { notes: await listNotes() });
      }
      const ip = clientIp(req);
      const limited = rateLimit(`note:${ip}`, 3, 10 * 60_000);
      if (!limited.ok) return send(res, 429, { error: `留言太频繁，请 ${limited.retryAfterSec}s 后再试` });
      try {
        const notes = await addNote(visitorName(body.name ?? body.visitor), String(body.text ?? ""));
        return send(res, 200, { notes });
      } catch (error) {
        return send(res, 400, { error: error instanceof Error ? error.message : "无法保存" });
      }
    }

    if (req.method === "GET" && pathname === "/api/search") {
      const params = new URL(url, "http://127.0.0.1").searchParams;
      const query = params.get("q") || "";
      const domain = (params.get("domain") || "all") as SearchDomain;
      return send(res, 200, await searchSite(query, domain));
    }

    if (req.method === "GET" && pathname === "/api/suggest") {
      const params = new URL(url, "http://127.0.0.1").searchParams;
      return send(res, 200, { suggestions: await suggestSite(params.get("q") || "") });
    }

    if (req.method === "GET" && pathname === "/api/search/domains") {
      return send(res, 200, { domains: SEARCH_DOMAINS });
    }

    if (req.method === "GET" && pathname === "/api/agent/settings") {
      return send(res, 200, await getAgentSettings(false));
    }

    if (req.method === "GET" && pathname === "/api/agent/runs") {
      const gate = assertOwner(req);
      if (!gate.ok) return send(res, gate.status, { error: gate.error || "全站对话记录仅 MoonPointer 可看。" });
      return send(res, 200, { runs: await listAgentRuns() });
    }

    if (req.method === "GET" && pathname.startsWith("/api/agent/runs/")) {
      const id = decodeURIComponent(pathname.slice("/api/agent/runs/".length));
      const run = await getAgentRun(id);
      if (!run) return send(res, 404, { error: "找不到这次对话" });
      return send(res, 200, { run });
    }

    if (req.method === "POST" && pathname === "/api/agent/plan") {
      const ip = clientIp(req);
      const limited = rateLimit(`agent:${ip}`, 20, 60_000);
      if (!limited.ok) return send(res, 429, { error: `Agent 调用过快，请 ${limited.retryAfterSec}s 后再试` });
      const body = await readJson(req);
      try {
        const run = await startAgent(String(body.message ?? ""), body.run_id ? String(body.run_id) : undefined);
        return send(res, 200, { run });
      } catch (error) {
        return send(res, 400, { error: error instanceof Error ? error.message : "无法开始" });
      }
    }

    if (req.method === "POST" && pathname.startsWith("/api/agent/runs/") && pathname.endsWith("/reply")) {
      const ip = clientIp(req);
      const limited = rateLimit(`agent:${ip}`, 12, 60_000);
      if (!limited.ok) return send(res, 429, { error: `Agent 调用过快，请 ${limited.retryAfterSec}s 后再试` });
      const id = decodeURIComponent(pathname.slice("/api/agent/runs/".length, -"/reply".length));
      const body = await readJson(req);
      try {
        const run = await replyAgent(id, String(body.message ?? ""));
        return send(res, 200, { run });
      } catch (error) {
        return send(res, 400, { error: error instanceof Error ? error.message : "无法回复" });
      }
    }

    if (req.method === "POST" && pathname.startsWith("/api/agent/runs/") && pathname.endsWith("/message")) {
      const ip = clientIp(req);
      const limited = rateLimit(`agent:${ip}`, 12, 60_000);
      if (!limited.ok) return send(res, 429, { error: `Agent 调用过快，请 ${limited.retryAfterSec}s 后再试` });
      const id = decodeURIComponent(pathname.slice("/api/agent/runs/".length, -"/message".length));
      const body = await readJson(req);
      try {
        const run = await startAgent(String(body.message ?? ""), id);
        return send(res, 200, { run });
      } catch (error) {
        return send(res, 400, { error: error instanceof Error ? error.message : "无法继续" });
      }
    }

    if (req.method === "POST" && pathname.startsWith("/api/agent/runs/") && pathname.endsWith("/stop")) {
      const id = decodeURIComponent(pathname.slice("/api/agent/runs/".length, -"/stop".length));
      try {
        return send(res, 200, { run: await stopAgent(id) });
      } catch (error) {
        return send(res, 400, { error: error instanceof Error ? error.message : "无法停止" });
      }
    }

    if (req.method === "GET" && pathname === "/api/github") {
      try {
        return send(res, 200, await githubSnapshot());
      } catch (error) {
        return send(res, 502, {
          error: error instanceof Error ? error.message : "无法读取 GitHub",
        });
      }
    }

    if (req.method === "GET" && pathname === "/api/sources") {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const root = process.cwd();
      const rows = catalog.map((item) => {
        const candidates = [item.launch.localPath, item.launch.fallbackPath]
          .filter(Boolean)
          .map((raw) =>
            path.isAbsolute(String(raw)) ? String(raw) : path.resolve(root, String(raw)),
          );
        const readyPath = candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
        return {
          id: item.id,
          name: item.name,
          ready: Boolean(readyPath),
          path: readyPath,
          env: item.env,
        };
      });
      return send(res, 200, { sources: rows });
    }

    if (req.method === "POST" && pathname === "/api/launch") {
      const gate = assertOwner(req);
      if (!gate.ok) return send(res, gate.status, { error: gate.error || "只有主人能启动展示位（占用服务器内存）。" });
      const ip = clientIp(req);
      const limited = rateLimit(`launch:${ip}`, 6, 60_000);
      if (!limited.ok) return send(res, 429, { error: `启动过快，请 ${limited.retryAfterSec}s 后再试` });
      const body = await readJson(req);
      const id = String(body.id ?? "");
      const visitor = visitorName(body.visitor);
      if (!NAMES.has(id)) return send(res, 400, { error: "未知项目" });

      const current = getBoard();
      if (current.activeId === id && current.status === "running") {
        return send(res, 200, current);
      }

      const claimed = claimLaunch(id, visitor);
      send(res, 200, claimed);
      void enqueueLaunch(id, visitor);
      return;
    }

    if (req.method === "POST" && pathname === "/api/stop") {
      const gate = assertOwner(req);
      if (!gate.ok) return send(res, gate.status, { error: gate.error || "只有主人能停止展示位。" });
      const body = await readJson(req);
      const visitor = visitorName(body.visitor);
      const claimed = claimStop(visitor);
      send(res, 200, claimed);
      void enqueueStop(visitor);
      return;
    }

    return send(res, 404, { error: "not found" });
    } catch (error) {
      console.error("[api]", error instanceof Error ? error.message : error);
      if (!res.headersSent) send(res, 503, { error: "服务暂时不可用" });
    }
  });

  if (server?.httpServer) {
    server.httpServer.on("upgrade", (req, socket, head) => {
      const url = req.url ?? "";
      if (!url.startsWith("/live")) return;
      const port = getActivePort();
      if (!port) {
        socket.destroy();
        return;
      }
      touchShowcaseActivity();
      req.url = url.replace(/^\/live/, "") || "/";
      proxy.ws(req, socket, head, { target: `ws://127.0.0.1:${port}` });
    });
  }
}

export function launcherApi(): Plugin {
  return {
    name: "usermoon-launcher",
    configureServer(server) {
      attach(server.middlewares, server);
    },
    configurePreviewServer(server) {
      attach(server.middlewares, server);
    },
  };
}
