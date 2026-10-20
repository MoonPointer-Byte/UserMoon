import catalog from "../shared/catalog.json";
import { listAchievements, listPosts, listShares } from "./site";

export type SearchDomain = "all" | "works" | "articles" | "shares" | "honors" | "pages";

export type SearchHit = {
  id: string;
  domain: Exclude<SearchDomain, "all">;
  title: string;
  summary: string;
  href: string;
  reasons: string[];
  score: number;
};

type Doc = {
  id: string;
  domain: Exclude<SearchDomain, "all">;
  title: string;
  summary: string;
  href: string;
  haystack: string;
  weight: number;
};

const PAGE_DOCS: Doc[] = [
  {
    id: "page-home",
    domain: "pages",
    title: "首页",
    summary: "问候、日历、留言和访问计数。",
    href: "/",
    haystack: "首页 home 问候 日历 留言 桌面",
    weight: 2,
  },
  {
    id: "page-works",
    domain: "pages",
    title: "作品",
    summary: "可运行项目的介绍页。",
    href: "/works",
    haystack: "作品 works 项目 介绍",
    weight: 2,
  },
  {
    id: "page-repos",
    domain: "pages",
    title: "仓库",
    summary: "GitHub 仓库与本机一键运行。",
    href: "/repos",
    haystack: "仓库 repos github docker 运行 展示位",
    weight: 3,
  },
  {
    id: "page-articles",
    domain: "pages",
    title: "文章",
    summary: "近况和长文。",
    href: "/articles",
    haystack: "文章 articles 博客 长文",
    weight: 2,
  },
  {
    id: "page-honors",
    domain: "pages",
    title: "成绩",
    summary: "学业、奖项和经历。",
    href: "/honors",
    haystack: "成绩 honors 奖项 学业 经历",
    weight: 2,
  },
  {
    id: "page-shares",
    domain: "pages",
    title: "分享",
    summary: "想推荐的链接。",
    href: "/shares",
    haystack: "分享 shares 链接 推荐",
    weight: 2,
  },
  {
    id: "page-about",
    domain: "pages",
    title: "关于",
    summary: "MoonPointer 是谁。",
    href: "/about",
    haystack: "关于 about moonpointer 我是谁",
    weight: 2,
  },
  {
    id: "page-agent",
    domain: "pages",
    title: "Agent",
    summary: "站内助手：查内容、讲解作品、看展示位状态。",
    href: "/agent",
    haystack: "agent 助手 聊天 ai 工具",
    weight: 3,
  },
];

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokens(query: string) {
  const clean = normalize(query);
  if (!clean) return [];
  const parts = clean.split(/[\s,，。.!！?？/|]+/).filter(Boolean);
  return [...new Set(parts.length ? parts : [clean])];
}

async function buildDocs(): Promise<Doc[]> {
  const works: Doc[] = catalog.map((project) => {
    const text = [project.name, project.scene, project.summary, project.env, project.lang, ...(project.tags ?? [])]
      .filter(Boolean)
      .join(" ");
    return {
      id: `work-${project.id}`,
      domain: "works",
      title: project.name,
      summary: project.summary,
      href: `/works/${project.id}`,
      haystack: normalize(text),
      weight: 5,
    };
  });

  const articles: Doc[] = (await listPosts()).map((post) => ({
    id: `article-${post.slug}`,
    domain: "articles",
    title: post.title,
    summary: post.summary || post.date || "文章",
    href: `/articles/${post.slug}`,
    haystack: normalize([post.title, post.summary, post.slug, post.date, post.source, ...(post.tags || [])].join(" ")),
    weight: 4,
  }));

  const shares: Doc[] = listShares().map((share, index) => ({
    id: `share-${index}-${share.title}`,
    domain: "shares",
    title: share.title,
    summary: share.reason || share.url,
    href: share.url.startsWith("http") ? share.url : `/shares`,
    haystack: normalize([share.title, share.reason, share.url].join(" ")),
    weight: 3,
  }));

  const honors: Doc[] = listAchievements().map((item) => ({
    id: `honor-${item.id}`,
    domain: "honors",
    title: item.title,
    summary: [item.year, item.category, item.result].filter(Boolean).join(" · "),
    href: "/honors",
    haystack: normalize([item.title, item.category, item.result, item.detail, item.year].join(" ")),
    weight: 3,
  }));

  return [...PAGE_DOCS.map((doc) => ({ ...doc, haystack: normalize(doc.haystack) })), ...works, ...articles, ...shares, ...honors];
}

function scoreDoc(doc: Doc, words: string[]): { score: number; reasons: string[] } | null {
  if (!words.length) return null;
  let score = 0;
  const reasons: string[] = [];
  const title = normalize(doc.title);
  const summary = normalize(doc.summary);
  const hay = doc.haystack;

  for (const word of words) {
    if (title === word) {
      score += 100;
      reasons.push("精确标题");
      continue;
    }
    if (title.includes(word)) {
      score += 48;
      reasons.push("标题命中");
      continue;
    }
    if (summary.includes(word)) {
      score += 22;
      reasons.push("简介命中");
      continue;
    }
    if (hay.includes(word)) {
      score += 12;
      reasons.push("内容命中");
      continue;
    }
    if (word.length >= 3) {
      const partial = word.slice(0, word.length - 1);
      if (title.includes(partial) || hay.includes(partial)) {
        score += 6;
        reasons.push("近似命中");
      }
    }
  }

  if (score <= 0) return null;
  score += doc.weight;
  const uniq = [...new Set(reasons)].slice(0, 3);
  return { score, reasons: uniq };
}

function detectDomain(query: string): { domain: SearchDomain; label: string } {
  const q = normalize(query);
  if (/文章|博客|blog|post/.test(q)) return { domain: "articles", label: "文章" };
  if (/作品|项目|project|work/.test(q)) return { domain: "works", label: "作品" };
  if (/分享|链接|share/.test(q)) return { domain: "shares", label: "分享" };
  if (/成绩|奖|荣誉|honor|竞赛/.test(q)) return { domain: "honors", label: "成绩" };
  if (/仓库|repo|github|docker|运行/.test(q)) return { domain: "pages", label: "页面 · 仓库" };
  if (/关于|about|首页|agent|助手/.test(q)) return { domain: "pages", label: "页面" };
  return { domain: "all", label: "综合" };
}

export async function searchSite(query: string, domain: SearchDomain = "all", limit = 20) {
  const words = tokens(query);
  const understood = detectDomain(query);
  const prefer = domain === "all" ? understood.domain : domain;
  const docs = await buildDocs();
  const hits: SearchHit[] = [];

  for (const doc of docs) {
    if (prefer !== "all" && doc.domain !== prefer && domain !== "all") continue;
    if (domain !== "all" && doc.domain !== domain) continue;
    const ranked = scoreDoc(doc, words);
    if (!ranked) continue;
    let score = ranked.score;
    if (prefer !== "all" && domain === "all" && doc.domain === prefer) score += 8;
    hits.push({
      id: doc.id,
      domain: doc.domain,
      title: doc.title,
      summary: doc.summary,
      href: doc.href,
      reasons: ranked.reasons,
      score,
    });
  }

  hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "zh"));
  const related = words.slice(0, 3).flatMap((word) => {
    const pool = docs
      .filter((doc) => normalize(doc.title).includes(word) || doc.haystack.includes(word))
      .map((doc) => doc.title)
      .slice(0, 2);
    return pool;
  });

  return {
    query,
    understood: {
      domain: prefer,
      label: domain === "all" ? understood.label : domainLabel(domain),
      keywords: words,
    },
    hits: hits.slice(0, limit),
    related: [...new Set(related)].filter((item) => normalize(item) !== normalize(query)).slice(0, 6),
  };
}

function domainLabel(domain: SearchDomain) {
  if (domain === "works") return "作品";
  if (domain === "articles") return "文章";
  if (domain === "shares") return "分享";
  if (domain === "honors") return "成绩";
  if (domain === "pages") return "页面";
  return "综合";
}

export async function suggestSite(query: string, limit = 8) {
  const words = tokens(query);
  if (!words.length) {
    return [
      { text: "Ideaface", kind: "作品" },
      { text: "仓库", kind: "页面" },
      { text: "MoonReader", kind: "作品" },
      { text: "成绩", kind: "页面" },
    ];
  }
  const result = await searchSite(query, "all", 12);
  return result.hits.slice(0, limit).map((hit) => ({
    text: hit.title,
    kind: domainLabel(hit.domain),
  }));
}

export const SEARCH_DOMAINS: Array<{ id: SearchDomain; label: string }> = [
  { id: "all", label: "综合" },
  { id: "works", label: "作品" },
  { id: "articles", label: "文章" },
  { id: "shares", label: "分享" },
  { id: "honors", label: "成绩" },
  { id: "pages", label: "页面" },
];
