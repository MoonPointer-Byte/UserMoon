import catalog from "../shared/catalog.json";
import {
  clearDbArticles,
  getDbArticle,
  listDbArticles,
  readArticlesConfig,
  upsertDbArticle,
  type DbArticle,
} from "./db";

type ArticlesConfig = {
  profiles?: {
    csdn?: { user?: string; home?: string; label?: string; sync?: boolean; limit?: number };
    github?: {
      owner?: string;
      label?: string;
      syncReadmes?: boolean;
      sources?: Array<{ repo: string; path?: string; ref?: string; title?: string; tags?: string[] }>;
    };
  };
  entries?: Array<{
    slug: string;
    title: string;
    date?: string;
    summary?: string;
    source: string;
    url?: string;
    repo?: string;
    path?: string;
    ref?: string;
    tags?: string[] | string;
  }>;
};

type RemoteArticle = {
  slug: string;
  title: string;
  date: string;
  summary: string;
  source: "csdn" | "github";
  tags: string[];
  externalUrl: string;
  html: string;
  bodyText: string;
  fetchedAt: string;
};

const TTL_MS = 15 * 60 * 1000;
let refreshing: Promise<RemoteArticle[]> | null = null;
let lastSyncAt = 0;

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function stripTags(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeArticleHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "")
    .trim();
}

function slugFrom(parts: string[]) {
  return (
    parts
      .join("-")
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fff]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || `item-${Date.now().toString(36)}`
  );
}

function dateOnly(value: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

async function fetchText(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(8000),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "application/json,text/html;q=0.9,*/*;q=0.8",
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`请求失败 ${response.status} ${url}`);
  return response.text();
}

function extractCsdnBody(html: string) {
  const match =
    /<div[^>]+id="content_views"[^>]*>([\s\S]*?)<\/div>\s*<div[^>]+class="[^"]*hide-article-box/i.exec(html) ||
    /<div[^>]+id="content_views"[^>]*>([\s\S]*?)<\/div>/i.exec(html) ||
    /<article[^>]*>([\s\S]*?)<\/article>/i.exec(html);
  if (!match) return "";
  return sanitizeArticleHtml(match[1]);
}

async function fetchCsdnArticle(url: string, fallbackHtml = "") {
  try {
    const page = await fetchText(url, {
      headers: {
        Accept: "text/html",
        Referer: "https://blog.csdn.net/",
      },
    });
    const body = extractCsdnBody(page);
    if (body && stripTags(body).length > 40) {
      return { html: body, bodyText: stripTags(body) };
    }
  } catch {
    // ignore
  }
  if (fallbackHtml) return { html: fallbackHtml, bodyText: stripTags(fallbackHtml) };
  return {
    html: `<p>列表已同步，正文暂未抓取到（CSDN 可能有保护）。</p><p><a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">打开 CSDN 原文</a></p>`,
    bodyText: "",
  };
}

type CsdnListItem = {
  articleId?: number | string;
  title?: string;
  description?: string;
  url?: string;
  postTime?: string;
  formatTime?: string;
  viewCount?: number;
};

async function fetchCsdnList(username: string, limit: number) {
  const items: CsdnListItem[] = [];
  let page = 1;
  const size = Math.min(100, Math.max(limit, 20));
  while (items.length < limit) {
    const url =
      `https://blog.csdn.net/community/home-api/v1/get-business-list?` +
      new URLSearchParams({
        page: String(page),
        size: String(size),
        businessType: "blog",
        orderby: "",
        noMore: "false",
        year: "",
        month: "",
        username,
      }).toString();
    const text = await fetchText(url, {
      headers: {
        Accept: "application/json",
        Referer: `https://blog.csdn.net/${username}?type=blog`,
        Origin: "https://blog.csdn.net",
      },
    });
    const json = JSON.parse(text) as {
      code?: number;
      message?: string;
      data?: { list?: CsdnListItem[]; total?: number };
    };
    if (json.code !== 200) throw new Error(json.message || `CSDN API code ${json.code}`);
    const list = json.data?.list || [];
    if (!list.length) break;
    items.push(...list);
    if (items.length >= (json.data?.total || limit) || list.length < size) break;
    page += 1;
  }
  return items.slice(0, limit);
}

async function syncCsdn(user: string, limit: number, manual: ArticlesConfig["entries"]) {
  const out: RemoteArticle[] = [];
  if (user) {
    try {
      const list = await fetchCsdnList(user, limit);
      for (const item of list) {
        const id = String(item.articleId || "");
        const link = item.url || (id ? `https://blog.csdn.net/${user}/article/details/${id}` : "");
        if (!link || !item.title) continue;
        const slug = `csdn-${id || slugFrom([item.title])}`;
        const summary = stripTags(item.description || "").slice(0, 180);
        const content = await fetchCsdnArticle(
          link,
          item.description ? `<p>${escapeHtml(stripTags(item.description))}</p>` : "",
        );
        out.push({
          slug,
          title: item.title,
          date: dateOnly(item.postTime || item.formatTime || ""),
          summary: summary || content.bodyText.slice(0, 160),
          source: "csdn",
          tags: ["CSDN"],
          externalUrl: link,
          html: content.html,
          bodyText: content.bodyText,
          fetchedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.warn("[articles] CSDN API failed:", error instanceof Error ? error.message : error);
    }
  }

  for (const entry of manual || []) {
    if (entry.source !== "csdn" || !entry.url) continue;
    if (out.some((item) => item.externalUrl === entry.url || item.slug === entry.slug)) continue;
    const content = await fetchCsdnArticle(entry.url);
    out.push({
      slug: entry.slug,
      title: entry.title,
      date: entry.date || "",
      summary: entry.summary || content.bodyText.slice(0, 160),
      source: "csdn",
      tags: Array.isArray(entry.tags) ? entry.tags.map(String) : ["CSDN"],
      externalUrl: entry.url,
      html: content.html,
      bodyText: content.bodyText,
      fetchedAt: new Date().toISOString(),
    });
  }
  return out;
}

async function loadGithubMarkdown(repo: string, filePath: string, ref: string) {
  try {
    const { spawn } = await import("node:child_process");
    const raw = await new Promise<string>((resolve, reject) => {
      const child = spawn(
        "gh",
        ["api", `repos/${repo}/contents/${filePath}?ref=${encodeURIComponent(ref)}`, "--jq", ".content"],
        { windowsHide: true },
      );
      let out = "";
      let err = "";
      child.stdout.on("data", (chunk) => {
        out += String(chunk);
      });
      child.stderr.on("data", (chunk) => {
        err += String(chunk);
      });
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) resolve(out);
        else reject(new Error(err || `gh exit ${code}`));
      });
    });
    return Buffer.from(raw.replace(/\s+/g, ""), "base64").toString("utf8");
  } catch {
    return fetchText(`https://raw.githubusercontent.com/${repo}/${ref}/${filePath}`);
  }
}

function firstParagraph(md: string) {
  const body = md.replace(/^---[\s\S]*?---\s*/, "");
  const line = body
    .split("\n")
    .map((item) => item.trim())
    .find((item) => item && !item.startsWith("#") && !item.startsWith("```"));
  return (line || "").replace(/[#>*_`[\]]/g, "").slice(0, 160);
}

async function syncGithub(config: ArticlesConfig) {
  const github = config.profiles?.github;
  const sources: Array<{ repo: string; path: string; ref: string; title?: string; tags?: string[] }> = [];

  if (github?.syncReadmes !== false) {
    const seen = new Set<string>();
    for (const project of catalog) {
      const repo = project.launch?.repo;
      if (!repo || seen.has(repo)) continue;
      seen.add(repo);
      sources.push({
        repo,
        path: "README.md",
        ref: "main",
        title: `${project.name} · README`,
        tags: ["GitHub", "README", project.lang].filter(Boolean) as string[],
      });
    }
  }

  for (const item of github?.sources || []) {
    if (!item.repo) continue;
    sources.push({
      repo: item.repo,
      path: item.path || "README.md",
      ref: item.ref || "main",
      title: item.title,
      tags: item.tags,
    });
  }

  for (const entry of config.entries || []) {
    if (entry.source !== "github" || !entry.repo) continue;
    sources.push({
      repo: entry.repo,
      path: entry.path || "README.md",
      ref: entry.ref || "main",
      title: entry.title,
      tags: Array.isArray(entry.tags) ? entry.tags.map(String) : ["GitHub"],
    });
  }

  const out: RemoteArticle[] = [];
  const used = new Set<string>();
  for (const source of sources) {
    const key = `${source.repo}@${source.ref}:${source.path}`;
    if (used.has(key)) continue;
    used.add(key);
    const slug = slugFrom(["gh", source.repo.replace("/", "-"), source.path.replace(/\//g, "-")]).replace(/\.md$/i, "");
    try {
      const md = await loadGithubMarkdown(source.repo, source.path, source.ref);
      out.push({
        slug,
        title: source.title || `${source.repo} / ${source.path}`,
        date: "",
        summary: firstParagraph(md),
        source: "github",
        tags: source.tags?.length ? source.tags : ["GitHub"],
        externalUrl: `https://github.com/${source.repo}/blob/${source.ref}/${source.path}`,
        html: "",
        bodyText: md,
        fetchedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.warn("[articles] GitHub fetch failed:", source.repo, error instanceof Error ? error.message : error);
    }
  }
  return out;
}

function toDb(item: RemoteArticle): DbArticle {
  return {
    slug: item.slug,
    source: item.source,
    title: item.title,
    date: item.date,
    summary: item.summary,
    tags: JSON.stringify(item.tags),
    external_url: item.externalUrl,
    html: item.html,
    body_text: item.bodyText,
    reading_mode: item.html || item.bodyText ? "full" : "external",
    fetched_at: item.fetchedAt,
  };
}

export async function refreshRemoteArticles(force = false): Promise<RemoteArticle[]> {
  if (!force && lastSyncAt && Date.now() - lastSyncAt < TTL_MS) {
    return listCachedRemoteArticles();
  }
  if (refreshing) return refreshing;

  refreshing = (async () => {
    const config = (await readArticlesConfig()) as ArticlesConfig;
    const csdnUser = config.profiles?.csdn?.user?.trim() || "";
    const csdnSync = config.profiles?.csdn?.sync !== false;
    const limit = Math.min(40, Math.max(1, Number(config.profiles?.csdn?.limit) || 20));

    const [csdn, github] = await Promise.all([
      csdnUser && csdnSync ? syncCsdn(csdnUser, limit, config.entries) : syncCsdn("", 0, config.entries),
      syncGithub(config),
    ]);

    await clearDbArticles("csdn");
    await clearDbArticles("github");
    const merged = [...csdn, ...github];
    for (const item of merged) await upsertDbArticle(toDb(item));
    lastSyncAt = Date.now();
    return merged;
  })().finally(() => {
    refreshing = null;
  });

  return refreshing;
}

export function listCachedRemoteArticles(): RemoteArticle[] {
  return listDbArticles()
    .filter((item) => item.source === "csdn" || item.source === "github")
    .map((item) => ({
      slug: item.slug,
      title: item.title,
      date: item.date,
      summary: item.summary,
      source: item.source as "csdn" | "github",
      tags: (() => {
        try {
          return JSON.parse(item.tags) as string[];
        } catch {
          return [];
        }
      })(),
      externalUrl: item.external_url,
      html: item.html,
      bodyText: item.body_text,
      fetchedAt: item.fetched_at,
    }));
}

export async function readCachedRemoteArticle(slug: string): Promise<RemoteArticle | null> {
  const item = (await getDbArticle(slug)) || listCachedRemoteArticles().find((row) => row.slug === slug);
  if (!item) return null;
  if (item.source !== "csdn" && item.source !== "github") return null;
  const tags =
    "tags" in item && typeof item.tags === "string"
      ? (() => {
          try {
            return JSON.parse(item.tags) as string[];
          } catch {
            return [];
          }
        })()
      : (item as RemoteArticle).tags || [];
  return {
    slug: item.slug,
    title: item.title,
    date: item.date,
    summary: item.summary,
    source: item.source as "csdn" | "github",
    tags,
    externalUrl: "external_url" in item ? String(item.external_url || "") : (item as RemoteArticle).externalUrl,
    html: "html" in item ? String(item.html || "") : (item as RemoteArticle).html,
    bodyText: "body_text" in item ? String(item.body_text || "") : (item as RemoteArticle).bodyText,
    fetchedAt: "fetched_at" in item ? String(item.fetched_at || "") : (item as RemoteArticle).fetchedAt,
  };
}

export async function readCachedGithubMarkdown(slug: string): Promise<string> {
  const item = await readCachedRemoteArticle(slug);
  return item?.bodyText || "";
}

export function kickArticleSync() {
  void refreshRemoteArticles(false).catch((error) => {
    console.warn("[articles] sync failed:", error instanceof Error ? error.message : error);
  });
}

export function isArticleSyncFresh() {
  return Boolean(lastSyncAt && Date.now() - lastSyncAt < TTL_MS) || listCachedRemoteArticles().length > 0;
}
