import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  kickArticleSync,
  listCachedRemoteArticles,
  readCachedGithubMarkdown,
  readCachedRemoteArticle,
  refreshRemoteArticles,
} from "./articles-remote";
import {
  addDbNote,
  bumpVisitCount,
  getSetting,
  initDb,
  listDbNotes,
  readArticlesConfig,
  readVisitCount,
  setSetting,
  writeArticlesConfig,
} from "./db";

export type Note = {
  id: string;
  name: string;
  text: string;
  at: string;
};

export type GithubRepo = {
  name: string;
  description: string;
  isPrivate: boolean;
  isFork: boolean;
  language: string;
  updatedAt: string;
  url: string;
  stars: number;
};

let githubCache: {
  at: number;
  login: string;
  name: string;
  repos: GithubRepo[];
} | null = null;

export async function listNotes() {
  return listDbNotes(40);
}

export async function addNote(name: string, text: string) {
  const cleanName = name.trim().slice(0, 24) || "访客";
  const cleanText = text.trim().slice(0, 280);
  if (!cleanText) throw new Error("留言不能为空");
  return addDbNote(cleanName, cleanText);
}

function runGh(args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn("gh", args, { windowsHide: true });
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
      else reject(new Error(err.trim() || `gh exited ${code}`));
    });
  });
}

export async function githubSnapshot() {
  if (githubCache && Date.now() - githubCache.at < 120_000) {
    return { ...githubCache, cached: true };
  }
  const user = JSON.parse(await runGh(["api", "user"])) as {
    login: string;
    name?: string | null;
  };
  const raw = JSON.parse(
    await runGh([
      "repo",
      "list",
      user.login,
      "--limit",
      "100",
      "--json",
      "name,description,isPrivate,isFork,primaryLanguage,updatedAt,url,stargazerCount",
    ]),
  ) as Array<{
    name: string;
    description?: string | null;
    isPrivate: boolean;
    isFork: boolean;
    primaryLanguage?: { name?: string } | null;
    updatedAt: string;
    url: string;
    stargazerCount: number;
  }>;

  githubCache = {
    at: Date.now(),
    login: user.login,
    name: user.name || user.login,
    repos: raw.map((repo) => ({
      name: repo.name,
      description: repo.description || "",
      isPrivate: repo.isPrivate,
      isFork: repo.isFork,
      language: repo.primaryLanguage?.name || "—",
      updatedAt: repo.updatedAt,
      url: repo.url,
      stars: repo.stargazerCount,
    })),
  };
  return { ...githubCache, cached: false };
}

export type PostSource = "local" | "csdn" | "github";

export type PostHeading = {
  id: string;
  text: string;
  level: number;
};

export type Post = {
  slug: string;
  title: string;
  date: string;
  summary: string;
  html: string;
  source: PostSource;
  tags: string[];
  externalUrl: string;
  readingMode: "full" | "external";
  headings: PostHeading[];
  minutes: number;
};

export type ArticleProfiles = {
  csdn: { user: string; home: string; label: string };
  github: { owner: string; label: string };
  local: { label: string };
};

type CatalogEntry = {
  slug: string;
  title: string;
  date?: string;
  summary?: string;
  source: PostSource;
  url?: string;
  repo?: string;
  path?: string;
  ref?: string;
  tags?: string[] | string;
};

type ArticlesFile = {
  profiles?: Partial<ArticleProfiles>;
  entries?: CatalogEntry[];
};

export type Share = {
  title: string;
  reason: string;
  url: string;
};

export type Achievement = {
  id: string;
  year: string;
  category: "学业" | "竞赛与奖项" | "经历" | "项目结果";
  title: string;
  result: string;
  detail: string;
  url: string;
};

const POSTS_DIR = path.resolve(process.cwd(), "content/posts");
const SHARES_FILE = path.resolve(process.cwd(), "content/shares.json");
const HONORS_FILE = path.resolve(process.cwd(), "content/achievements.json");
const PROFILE_FILE = path.resolve(process.cwd(), "content/profile.json");

const ACHIEVEMENT_CATEGORIES = ["学业", "竞赛与奖项", "经历", "项目结果"] as const;

export type Profile = {
  name: string;
  handle: string;
  school: string;
  role: string;
  bio: string;
  github: string;
};

const DEFAULT_PROFILE: Profile = {
  name: "MoonPointer",
  handle: "MoonPointer-Byte",
  school: "南京林业大学 · 计算机科学与技术",
  role: "Agent / 全栈",
  bio: "南京林业大学计算机科学与技术。平时做 Agent 和全栈，也把工具做成能打开的作品。",
  github: "https://github.com/MoonPointer-Byte",
};

const githubMdCache = new Map<string, { at: number; text: string }>();

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function inline(value: string) {
  return escapeHtml(value)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function parseTags(raw: string | string[] | undefined): string[] {
  if (Array.isArray(raw)) return raw.map(String).map((item) => item.trim()).filter(Boolean);
  if (!raw) return [];
  return raw
    .replace(/^\[|\]$/g, "")
    .split(/[,，]/)
    .map((item) => item.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

function readingMinutes(text: string) {
  const count = text.replace(/\s+/g, "").length;
  return Math.max(1, Math.round(count / 400));
}

function markdownToHtml(source: string) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  const headings: PostHeading[] = [];
  let list: string[] = [];
  let quote: string[] = [];
  let code: string[] | null = null;
  const usedIds = new Set<string>();

  const flushList = () => {
    if (!list.length) return;
    html.push(`<ul>${list.join("")}</ul>`);
    list = [];
  };
  const flushQuote = () => {
    if (!quote.length) return;
    html.push(`<blockquote>${quote.map((line) => `<p>${inline(line)}</p>`).join("")}</blockquote>`);
    quote = [];
  };

  for (const line of lines) {
    if (code) {
      if (line.startsWith("```")) {
        html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        code = null;
      } else {
        code.push(line);
      }
      continue;
    }
    if (line.startsWith("```")) {
      flushList();
      flushQuote();
      code = [];
      continue;
    }
    const item = /^[-*] (.+)$/.exec(line);
    if (item) {
      flushQuote();
      list.push(`<li>${inline(item[1])}</li>`);
      continue;
    }
    const quoted = /^>\s?(.*)$/.exec(line);
    if (quoted) {
      flushList();
      quote.push(quoted[1]);
      continue;
    }
    flushList();
    flushQuote();
    if (!line.trim()) continue;
    const heading = /^(#{1,3}) (.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      let id = slugify(text) || `h-${headings.length + 1}`;
      if (usedIds.has(id)) id = `${id}-${headings.length + 1}`;
      usedIds.add(id);
      headings.push({ id, text, level });
      html.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      continue;
    }
    html.push(`<p>${inline(line)}</p>`);
  }
  flushList();
  flushQuote();
  if (code) html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
  return { html: html.join(""), headings };
}

function parseFrontmatter(raw: string) {
  let title = "";
  let date = "";
  let summary = "";
  let tags: string[] = [];
  let body = raw.trim();
  if (body.startsWith("---")) {
    const end = body.indexOf("\n---", 3);
    if (end > 0) {
      const head = body.slice(3, end);
      body = body.slice(end + 4).trim();
      for (const line of head.split("\n")) {
        const split = line.indexOf(":");
        if (split < 0) continue;
        const key = line.slice(0, split).trim();
        const value = line.slice(split + 1).trim();
        if (key === "title") title = value;
        if (key === "date") date = value;
        if (key === "summary") summary = value;
        if (key === "tags") tags = parseTags(value);
      }
    }
  }
  return { title, date, summary, tags, body };
}

function finishPost(partial: Omit<Post, "minutes" | "headings" | "html"> & { html: string; headings: PostHeading[]; bodyText: string }): Post {
  return {
    ...partial,
    minutes: readingMinutes(partial.bodyText || partial.summary || partial.title),
  };
}

function parseLocalFile(file: string): Post {
  const raw = fs.readFileSync(file, "utf8");
  const slug = path.basename(file, ".md");
  const meta = parseFrontmatter(raw);
  const rendered = markdownToHtml(meta.body);
  return finishPost({
    slug,
    title: meta.title || slug,
    date: meta.date || "",
    summary: meta.summary || "",
    html: rendered.html,
    source: "local",
    tags: meta.tags,
    externalUrl: "",
    readingMode: "full",
    headings: rendered.headings,
    bodyText: meta.body,
  });
}

async function readArticlesFile(): Promise<ArticlesFile> {
  return (await readArticlesConfig()) as ArticlesFile;
}

export async function getArticleProfiles(): Promise<ArticleProfiles> {
  const file = await readArticlesFile();
  return {
    local: { label: file.profiles?.local?.label || "本站" },
    csdn: {
      user: file.profiles?.csdn?.user || "",
      home: file.profiles?.csdn?.home || "",
      label: file.profiles?.csdn?.label || "CSDN",
    },
    github: {
      owner: file.profiles?.github?.owner || "MoonPointer-Byte",
      label: file.profiles?.github?.label || "GitHub",
    },
  };
}

export async function updateArticleProfiles(partial: {
  csdnUser?: string;
  csdnHome?: string;
  csdnLimit?: number;
  githubOwner?: string;
  syncReadmes?: boolean;
}) {
  const file = await readArticlesFile();
  const next: ArticlesFile = {
    ...file,
    profiles: {
      local: { label: file.profiles?.local?.label || "本站" },
      csdn: {
        user: partial.csdnUser ?? file.profiles?.csdn?.user ?? "",
        home:
          partial.csdnHome ??
          file.profiles?.csdn?.home ??
          (partial.csdnUser ? `https://blog.csdn.net/${partial.csdnUser}` : ""),
        label: file.profiles?.csdn?.label || "CSDN",
      },
      github: {
        owner: partial.githubOwner ?? file.profiles?.github?.owner ?? "MoonPointer-Byte",
        label: file.profiles?.github?.label || "GitHub",
      },
    },
    entries: file.entries ?? [],
  };
  const raw = (await readArticlesConfig()) as {
    profiles?: {
      csdn?: { sync?: boolean; limit?: number };
      github?: { syncReadmes?: boolean; sources?: unknown[] };
    };
    entries?: unknown[];
  };
  await writeArticlesConfig({
    ...raw,
    profiles: {
      ...raw.profiles,
      local: next.profiles?.local,
      csdn: {
        ...raw.profiles?.csdn,
        ...next.profiles?.csdn,
        sync: raw.profiles?.csdn?.sync !== false,
        limit: partial.csdnLimit ?? raw.profiles?.csdn?.limit ?? 20,
      },
      github: {
        ...raw.profiles?.github,
        ...next.profiles?.github,
        syncReadmes: partial.syncReadmes ?? raw.profiles?.github?.syncReadmes !== false,
        sources: raw.profiles?.github?.sources ?? [],
      },
    },
    entries: raw.entries ?? [],
  });
  return getArticleProfiles();
}

function entryToStub(entry: CatalogEntry): Post {
  const tags = parseTags(entry.tags);
  if (entry.source === "csdn") {
    return finishPost({
      slug: entry.slug,
      title: entry.title,
      date: entry.date || "",
      summary: entry.summary || "",
      html: "",
      source: "csdn",
      tags,
      externalUrl: entry.url || "",
      readingMode: "external",
      headings: [],
      bodyText: entry.summary || entry.title,
    });
  }
  if (entry.source === "github") {
    return finishPost({
      slug: entry.slug,
      title: entry.title,
      date: entry.date || "",
      summary: entry.summary || "",
      html: "",
      source: "github",
      tags,
      externalUrl: entry.repo
        ? `https://github.com/${entry.repo}/blob/${entry.ref || "main"}/${entry.path || "README.md"}`
        : entry.url || "",
      readingMode: "full",
      headings: [],
      bodyText: entry.summary || entry.title,
    });
  }
  const localName = entry.path || `${entry.slug}.md`;
  const file = path.join(POSTS_DIR, path.basename(localName));
  if (fs.existsSync(file)) return parseLocalFile(file);
  return finishPost({
    slug: entry.slug,
    title: entry.title,
    date: entry.date || "",
    summary: entry.summary || "",
    html: `<p>${escapeHtml(entry.summary || "正文尚未放入 content/posts。")}</p>`,
    source: "local",
    tags,
    externalUrl: "",
    readingMode: "full",
    headings: [],
    bodyText: entry.summary || entry.title,
  });
}

function remoteToPost(item: {
  slug: string;
  title: string;
  date: string;
  summary: string;
  source: PostSource;
  tags: string[];
  externalUrl: string;
  html: string;
  bodyText: string;
}): Post {
  if (item.source === "github") {
    const rendered = markdownToHtml(item.bodyText || "");
    return finishPost({
      slug: item.slug,
      title: item.title,
      date: item.date,
      summary: item.summary,
      html: rendered.html,
      source: "github",
      tags: item.tags,
      externalUrl: item.externalUrl,
      readingMode: "full",
      headings: rendered.headings,
      bodyText: item.bodyText,
    });
  }
  const headings = extractHeadingsFromHtml(item.html);
  return finishPost({
    slug: item.slug,
    title: item.title,
    date: item.date,
    summary: item.summary,
    html: item.html,
    source: item.source,
    tags: item.tags,
    externalUrl: item.externalUrl,
    readingMode: item.html ? "full" : "external",
    headings,
    bodyText: item.bodyText || item.summary,
  });
}

function extractHeadingsFromHtml(html: string): PostHeading[] {
  const headings: PostHeading[] = [];
  const re = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const text = match[2].replace(/<[^>]+>/g, "").trim();
    if (!text) continue;
    const id = slugify(text) || `h-${headings.length + 1}`;
    headings.push({ id, text, level: Number(match[1]) });
  }
  return headings;
}

export async function listPosts(): Promise<Post[]> {
  const file = await readArticlesFile();
  const bySlug = new Map<string, Post>();

  if (fs.existsSync(POSTS_DIR)) {
    for (const name of fs.readdirSync(POSTS_DIR)) {
      if (!name.endsWith(".md") || name.toLowerCase() === "readme.md") continue;
      const post = parseLocalFile(path.join(POSTS_DIR, name));
      bySlug.set(post.slug, post);
    }
  }

  for (const entry of file.entries ?? []) {
    if (!entry?.slug || !entry.title || !entry.source) continue;
    if (entry.source === "csdn" || entry.source === "github") continue;
    bySlug.set(entry.slug, entryToStub(entry));
  }

  for (const item of listCachedRemoteArticles()) {
    bySlug.set(item.slug, remoteToPost(item));
  }

  return [...bySlug.values()].sort((a, b) => (b.date || "").localeCompare(a.date || "") || a.title.localeCompare(b.title, "zh"));
}

export async function listPostsAsync(forceRefresh = false): Promise<Post[]> {
  await initDb();
  if (forceRefresh) await refreshRemoteArticles(true);
  else kickArticleSync();
  return listPosts();
}

export { kickArticleSync, getSetting, setSetting };

async function loadGithubMarkdown(entry: CatalogEntry) {
  const repo = entry.repo || "";
  const filePath = entry.path || "README.md";
  const ref = entry.ref || "main";
  const key = `${repo}@${ref}:${filePath}`;
  const cached = githubMdCache.get(key);
  if (cached && Date.now() - cached.at < 120_000) return cached.text;

  try {
    const raw = await runGh(["api", `repos/${repo}/contents/${filePath}?ref=${encodeURIComponent(ref)}`, "--jq", ".content"]);
    const text = Buffer.from(raw.replace(/\s+/g, ""), "base64").toString("utf8");
    githubMdCache.set(key, { at: Date.now(), text });
    return text;
  } catch {
    const url = `https://raw.githubusercontent.com/${repo}/${ref}/${filePath}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`无法拉取 GitHub 文章 ${repo}/${filePath}`);
    const text = await response.text();
    githubMdCache.set(key, { at: Date.now(), text });
    return text;
  }
}

export async function readPost(slug: string): Promise<Post | null> {
  const safe = slug.replace(/[^a-z0-9_-]/gi, "");
  await initDb();
  kickArticleSync();
  const list = await listPosts();
  const found = list.find((post) => post.slug === safe) ?? null;
  if (!found) return null;

  if (found.source === "local") return found;

  if (found.source === "github") {
    const md = (await readCachedGithubMarkdown(safe)) || found.bodyText;
    if (md) {
      const meta = parseFrontmatter(md);
      const rendered = markdownToHtml(meta.body || md);
      return finishPost({
        ...found,
        title: found.title || meta.title || found.slug,
        summary: found.summary || meta.summary || firstLine(meta.body || md),
        html: rendered.html,
        headings: rendered.headings,
        bodyText: meta.body || md,
        readingMode: "full",
      });
    }
    const file = await readArticlesFile();
    const entry = (file.entries ?? []).find((item) => item.slug === safe);
    if (entry?.repo) {
      try {
        const raw = await loadGithubMarkdown(entry);
        const meta = parseFrontmatter(raw);
        const rendered = markdownToHtml(meta.body || raw);
        return finishPost({
          ...found,
          html: rendered.html,
          headings: rendered.headings,
          bodyText: meta.body || raw,
          readingMode: "full",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return finishPost({
          ...found,
          html: `<p>${escapeHtml(message)}</p><p><a href="${escapeHtml(found.externalUrl)}" target="_blank" rel="noreferrer">在 GitHub 打开原文</a></p>`,
          headings: [],
          bodyText: found.summary,
        });
      }
    }
  }

  if (found.source === "csdn") {
    const cached = await readCachedRemoteArticle(safe);
    if (cached?.html) {
      return remoteToPost(cached);
    }
    if (found.html) return { ...found, readingMode: "full" };
    return finishPost({
      ...found,
      readingMode: found.externalUrl ? "external" : "full",
      html:
        found.html ||
        `<p>还没有同步到正文。</p><p><a href="${escapeHtml(found.externalUrl)}" target="_blank" rel="noreferrer">打开 CSDN 原文</a></p>`,
      headings: [],
      bodyText: found.summary,
    });
  }

  return found;
}

function firstLine(text: string) {
  return text
    .split("\n")
    .map((item) => item.trim())
    .find((item) => item && !item.startsWith("#"))
    ?.slice(0, 160) || "";
}

export async function neighborPosts(slug: string) {
  const list = await listPosts();
  const index = list.findIndex((post) => post.slug === slug);
  if (index < 0) return { prev: null, next: null };
  return {
    prev: index + 1 < list.length ? list[index + 1] : null,
    next: index > 0 ? list[index - 1] : null,
  };
}

function readJsonFile<T>(file: string): T[] {
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8")) as T[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function listShares() {
  return readJsonFile<Share>(SHARES_FILE).filter((item) => item.title && item.url);
}

function clip(value: unknown, max: number) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeProfile(raw: Partial<Profile> | null | undefined): Profile {
  const github = clip(raw?.github, 180) || DEFAULT_PROFILE.github;
  return {
    name: clip(raw?.name, 40) || DEFAULT_PROFILE.name,
    handle: clip(raw?.handle, 40) || DEFAULT_PROFILE.handle,
    school: clip(raw?.school, 80),
    role: clip(raw?.role, 40),
    bio: clip(raw?.bio, 600) || DEFAULT_PROFILE.bio,
    github: /^https?:\/\//.test(github) ? github : `https://github.com/${github.replace(/^@/, "")}`,
  };
}

function profileFromFile(): Profile {
  try {
    return normalizeProfile(JSON.parse(fs.readFileSync(PROFILE_FILE, "utf8")) as Partial<Profile>);
  } catch {
    return DEFAULT_PROFILE;
  }
}

export async function readProfile(): Promise<Profile> {
  try {
    const raw = await getSetting("profile", "");
    if (raw) return normalizeProfile(JSON.parse(raw) as Partial<Profile>);
  } catch {
    // 数据库暂时不可用时仍返回站内档案
  }
  return profileFromFile();
}

export async function writeProfile(input: Partial<Profile>) {
  const next = normalizeProfile({ ...(await readProfile()), ...input });
  await setSetting("profile", JSON.stringify(next));
  return next;
}

function normalizeAchievement(raw: Partial<Achievement>, index: number): Achievement | null {
  const title = clip(raw.title, 80);
  if (!title) return null;
  const category = ACHIEVEMENT_CATEGORIES.includes(raw.category as (typeof ACHIEVEMENT_CATEGORIES)[number])
    ? (raw.category as Achievement["category"])
    : "竞赛与奖项";
  const year = clip(raw.year, 8);
  const id = clip(raw.id, 64) || slugify(`${year}-${title}`) || `honor-${index + 1}`;
  return {
    id,
    year,
    category,
    title,
    result: clip(raw.result, 24),
    detail: clip(raw.detail, 240),
    url: clip(raw.url, 240),
  };
}

function sortAchievements(items: Achievement[]) {
  return [...items].sort((a, b) => b.year.localeCompare(a.year) || a.title.localeCompare(b.title, "zh"));
}

export function listAchievements() {
  return sortAchievements(
    readJsonFile<Achievement>(HONORS_FILE)
      .map((item, index) => normalizeAchievement(item, index))
      .filter((item): item is Achievement => Boolean(item)),
  );
}

export async function readAchievements(): Promise<Achievement[]> {
  try {
    const raw = await getSetting("achievements", "");
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Achievement>[];
      if (Array.isArray(parsed)) {
        return sortAchievements(
          parsed
            .map((item, index) => normalizeAchievement(item, index))
            .filter((item): item is Achievement => Boolean(item)),
        );
      }
    }
  } catch {
    // 使用文件里的种子
  }
  return listAchievements();
}

export async function writeAchievements(input: unknown) {
  const rows = Array.isArray(input) ? input : [];
  const next = sortAchievements(
    rows
      .slice(0, 40)
      .map((item, index) => normalizeAchievement((item ?? {}) as Partial<Achievement>, index))
      .filter((item): item is Achievement => Boolean(item)),
  );
  await setSetting("achievements", JSON.stringify(next));
  return next;
}

export async function readVisit() {
  return readVisitCount();
}

export async function bumpVisit() {
  return bumpVisitCount();
}
