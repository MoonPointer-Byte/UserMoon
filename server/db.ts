import fs from "node:fs";
import path from "node:path";
import { MongoClient, type Db as MongoDb } from "mongodb";
import mysql, { type Pool, type RowDataPacket, type ResultSetHeader } from "mysql2/promise";

const ROOT = process.cwd();
const NOTES_FILE = path.resolve(ROOT, "server/notes.json");
const VISITS_FILE = path.resolve(ROOT, "server/visits.json");
const ARTICLES_FILE = path.resolve(ROOT, "content/articles.json");
const CACHE_DIR = path.resolve(ROOT, "server/article-cache");
const AGENT_DIR = path.resolve(ROOT, "server/agent-runs");
const SQLITE_PATH = path.resolve(ROOT, "server/usermoon.db");

export type DbNote = { id: string; name: string; text: string; at: string };
export type DbArticle = {
  slug: string;
  source: string;
  title: string;
  date: string;
  summary: string;
  tags: string;
  external_url: string;
  html: string;
  body_text: string;
  reading_mode: string;
  fetched_at: string;
};

type ArticleDoc = {
  _id: string;
  html: string;
  body_text: string;
  tags?: string[];
  source?: string;
};

type AgentDoc = {
  _id: string;
  status: string;
  message: string;
  payload: unknown;
  created_at: string;
  updated_at: string;
};

const mysqlConfig = {
  host: process.env.MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "root",
  database: process.env.MYSQL_DATABASE || "usermoon",
};

const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const mongoDbName = process.env.MONGODB_DB || "usermoon";

let pool: Pool | null = null;
let mongoClient: MongoClient | null = null;
let mongoDb: MongoDb | null = null;
let ready: Promise<void> | null = null;
let bootstrapping = false;
let articleMem: DbArticle[] = [];

function mysqlBase() {
  return mysql.createPool({
    host: mysqlConfig.host,
    port: mysqlConfig.port,
    user: mysqlConfig.user,
    password: mysqlConfig.password,
    waitForConnections: true,
    connectionLimit: 8,
  });
}

async function ensureMysql() {
  const boot = mysqlBase();
  await boot.query(
    `CREATE DATABASE IF NOT EXISTS \`${mysqlConfig.database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await boot.end();
  pool = mysql.createPool({
    ...mysqlConfig,
    waitForConnections: true,
    connectionLimit: 8,
  });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS meta (
      \`key\` VARCHAR(191) PRIMARY KEY,
      value LONGTEXT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS visits (
      id TINYINT PRIMARY KEY,
      count INT NOT NULL DEFAULT 0,
      updated_at VARCHAR(40) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(64) NOT NULL,
      text VARCHAR(512) NOT NULL,
      at VARCHAR(40) NOT NULL,
      INDEX (at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      \`key\` VARCHAR(191) PRIMARY KEY,
      value LONGTEXT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS articles (
      slug VARCHAR(191) PRIMARY KEY,
      source VARCHAR(32) NOT NULL,
      title VARCHAR(512) NOT NULL,
      date VARCHAR(32) NOT NULL DEFAULT '',
      summary TEXT NOT NULL,
      tags TEXT NOT NULL,
      external_url TEXT NOT NULL,
      reading_mode VARCHAR(16) NOT NULL DEFAULT 'full',
      fetched_at VARCHAR(40) NOT NULL,
      INDEX (source),
      INDEX (date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agent_runs (
      id VARCHAR(64) PRIMARY KEY,
      status VARCHAR(32) NOT NULL,
      message TEXT NOT NULL,
      created_at VARCHAR(40) NOT NULL,
      updated_at VARCHAR(40) NOT NULL,
      INDEX (updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await pool.query(
    `INSERT IGNORE INTO visits (id, count, updated_at) VALUES (1, 0, ?)`,
    [new Date().toISOString()],
  );
}

async function ensureMongo() {
  mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  mongoDb = mongoClient.db(mongoDbName);
  await mongoDb.collection("articles").createIndex({ source: 1 });
  await mongoDb.collection("agent_runs").createIndex({ updated_at: -1 });
}

function sql() {
  if (!pool) throw new Error("MySQL 尚未初始化");
  return pool;
}

function mongo() {
  if (!mongoDb) throw new Error("MongoDB 尚未初始化");
  return mongoDb;
}

async function loadArticleMemory() {
  const [rows] = await sql().query<RowDataPacket[]>("SELECT * FROM articles ORDER BY date DESC, title ASC");
  const docs = await mongo()
    .collection<ArticleDoc>("articles")
    .find({})
    .toArray();
  const bodyMap = new Map(docs.map((doc) => [doc._id, doc]));
  articleMem = rows.map((row) => {
    const body = bodyMap.get(String(row.slug));
    return {
      slug: String(row.slug),
      source: String(row.source),
      title: String(row.title),
      date: String(row.date || ""),
      summary: String(row.summary || ""),
      tags: String(row.tags || "[]"),
      external_url: String(row.external_url || ""),
      html: body?.html || "",
      body_text: body?.body_text || "",
      reading_mode: String(row.reading_mode || "full"),
      fetched_at: String(row.fetched_at || ""),
    } satisfies DbArticle;
  });
}

async function importLegacy() {
  const [rows] = await sql().query<RowDataPacket[]>("SELECT value FROM meta WHERE `key` = 'legacy_imported'");
  if (rows[0]?.value === "1") return;

  try {
    const visits = JSON.parse(fs.readFileSync(VISITS_FILE, "utf8")) as { count?: number };
    await sql().query("UPDATE visits SET count = ?, updated_at = ? WHERE id = 1", [
      Number(visits.count) || 0,
      new Date().toISOString(),
    ]);
  } catch {
    // ignore
  }

  try {
    const notes = JSON.parse(fs.readFileSync(NOTES_FILE, "utf8")) as DbNote[];
    for (const note of notes || []) {
      if (!note?.id) continue;
      await sql().query("INSERT IGNORE INTO notes (id, name, text, at) VALUES (?, ?, ?, ?)", [
        note.id,
        note.name || "访客",
        note.text || "",
        note.at || new Date().toISOString(),
      ]);
    }
  } catch {
    // ignore
  }

  try {
    const raw = fs.readFileSync(ARTICLES_FILE, "utf8");
    await sql().query("REPLACE INTO settings (`key`, value) VALUES ('articles_config', ?)", [raw]);
  } catch {
    // ignore
  }

  // migrate previous sqlite if present
  try {
    if (fs.existsSync(SQLITE_PATH)) {
      const { DatabaseSync } = await import("node:sqlite");
      const sqlite = new DatabaseSync(SQLITE_PATH);
      const articles = sqlite.prepare("SELECT * FROM articles").all() as DbArticle[];
      for (const article of articles) {
        await upsertDbArticle(article);
      }
      const agentRows = sqlite
        .prepare("SELECT id, status, message, payload, created_at, updated_at FROM agent_runs")
        .all() as Array<{
        id: string;
        status: string;
        message: string;
        payload: string;
        created_at: string;
        updated_at: string;
      }>;
      for (const row of agentRows) {
        let payload: unknown = row.payload;
        try {
          payload = JSON.parse(row.payload);
        } catch {
          // keep string
        }
        await saveDbAgentRun({
          id: row.id,
          status: row.status,
          message: row.message,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          payload,
        });
      }
      const visit = sqlite.prepare("SELECT count FROM visits WHERE id = 1").get() as { count?: number } | undefined;
      if (visit?.count != null) {
        await sql().query("UPDATE visits SET count = ?, updated_at = ? WHERE id = 1", [
          Number(visit.count) || 0,
          new Date().toISOString(),
        ]);
      }
      sqlite.close();
    }
  } catch (error) {
    console.warn("[db] sqlite migrate skipped:", error instanceof Error ? error.message : error);
  }

  try {
    const indexFile = path.join(CACHE_DIR, "index.json");
    if (fs.existsSync(indexFile)) {
      const items = JSON.parse(fs.readFileSync(indexFile, "utf8")) as Array<Record<string, string>>;
      for (const item of items) {
        if (!item.slug) continue;
        let body = item.bodyText || "";
        let html = item.html || "";
        try {
          if (item.source === "github") {
            body = fs.readFileSync(path.join(CACHE_DIR, `${item.slug}.md`), "utf8") || body;
          }
        } catch {
          // ignore
        }
        await upsertDbArticle({
          slug: item.slug,
          source: item.source || "local",
          title: item.title || item.slug,
          date: item.date || "",
          summary: item.summary || "",
          tags: JSON.stringify(item.tags || []),
          external_url: item.externalUrl || "",
          html,
          body_text: body,
          reading_mode: html || body ? "full" : "external",
          fetched_at: item.fetchedAt || new Date().toISOString(),
        });
      }
    }
  } catch {
    // ignore
  }

  try {
    if (fs.existsSync(AGENT_DIR)) {
      for (const name of fs.readdirSync(AGENT_DIR)) {
        if (!name.endsWith(".json")) continue;
        const run = JSON.parse(fs.readFileSync(path.join(AGENT_DIR, name), "utf8")) as {
          id?: string;
          status?: string;
          message?: string;
          createdAt?: string;
          updatedAt?: string;
        };
        if (!run.id) continue;
        await saveDbAgentRun({
          id: run.id,
          status: run.status || "succeeded",
          message: run.message || "",
          createdAt: run.createdAt || new Date().toISOString(),
          updatedAt: run.updatedAt || new Date().toISOString(),
          payload: run,
        });
      }
    }
  } catch {
    // ignore
  }

  await sql().query("REPLACE INTO meta (`key`, value) VALUES ('legacy_imported', '1')");
}

export async function initDb() {
  if (!ready) {
    ready = (async () => {
      bootstrapping = true;
      try {
        await ensureMysql();
        await ensureMongo();
        // importLegacy 会再调 upsert/save；此时连接已就绪，不能再 await ready（会死锁）
        await importLegacy();
        await loadArticleMemory();
        console.log(
          `[db] MySQL ${mysqlConfig.host}:${mysqlConfig.port}/${mysqlConfig.database} · MongoDB ${mongoDbName}`,
        );
      } finally {
        bootstrapping = false;
      }
    })().catch((error) => {
      ready = null;
      pool = null;
      mongoClient = null;
      mongoDb = null;
      throw error;
    });
  }
  if (bootstrapping && pool && mongoDb) return;
  await ready;
}

/** @deprecated use initDb */
export function getDb() {
  void initDb();
  return { mysql: true, mongo: true };
}

export async function getSetting(key: string, fallback = "") {
  await initDb();
  const [rows] = await sql().query<RowDataPacket[]>("SELECT value FROM settings WHERE `key` = ?", [key]);
  return rows[0] ? String(rows[0].value) : fallback;
}

export async function setSetting(key: string, value: string) {
  await initDb();
  await sql().query("REPLACE INTO settings (`key`, value) VALUES (?, ?)", [key, value]);
}

export async function readArticlesConfig() {
  const raw = await getSetting("articles_config");
  if (raw) {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // fall through
    }
  }
  try {
    return JSON.parse(fs.readFileSync(ARTICLES_FILE, "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function writeArticlesConfig(config: unknown) {
  const raw = JSON.stringify(config, null, 2);
  await setSetting("articles_config", raw);
  fs.mkdirSync(path.dirname(ARTICLES_FILE), { recursive: true });
  fs.writeFileSync(ARTICLES_FILE, raw, "utf8");
}

export function listDbArticles(source?: string) {
  if (source && source !== "all") return articleMem.filter((item) => item.source === source);
  return [...articleMem];
}

export async function upsertDbArticle(article: DbArticle) {
  await initDb();
  await sql().query(
    `
      REPLACE INTO articles
      (slug, source, title, date, summary, tags, external_url, reading_mode, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      article.slug,
      article.source,
      article.title,
      article.date,
      article.summary,
      article.tags,
      article.external_url,
      article.reading_mode,
      article.fetched_at,
    ],
  );
  await mongo()
    .collection<ArticleDoc>("articles")
    .updateOne(
      { _id: article.slug },
      {
        $set: {
          html: article.html,
          body_text: article.body_text,
          tags: (() => {
            try {
              return JSON.parse(article.tags) as string[];
            } catch {
              return [];
            }
          })(),
          source: article.source,
        },
      },
      { upsert: true },
    );
  const idx = articleMem.findIndex((item) => item.slug === article.slug);
  if (idx >= 0) articleMem[idx] = article;
  else articleMem.push(article);
}

export async function getDbArticle(slug: string) {
  await initDb();
  const cached = articleMem.find((item) => item.slug === slug);
  if (cached) return cached;
  const [rows] = await sql().query<RowDataPacket[]>("SELECT * FROM articles WHERE slug = ?", [slug]);
  const row = rows[0];
  if (!row) return null;
  const doc = await mongo().collection<ArticleDoc>("articles").findOne({ _id: slug });
  return {
    slug: String(row.slug),
    source: String(row.source),
    title: String(row.title),
    date: String(row.date || ""),
    summary: String(row.summary || ""),
    tags: String(row.tags || "[]"),
    external_url: String(row.external_url || ""),
    html: doc?.html || "",
    body_text: doc?.body_text || "",
    reading_mode: String(row.reading_mode || "full"),
    fetched_at: String(row.fetched_at || ""),
  } satisfies DbArticle;
}

export async function deleteDbArticle(slug: string) {
  await initDb();
  await sql().query("DELETE FROM articles WHERE slug = ?", [slug]);
  await mongo().collection("articles").deleteOne({ _id: slug });
  articleMem = articleMem.filter((item) => item.slug !== slug);
}

export async function clearDbArticles(source?: string) {
  await initDb();
  if (source) {
    await sql().query("DELETE FROM articles WHERE source = ?", [source]);
    await mongo().collection("articles").deleteMany({ source });
    articleMem = articleMem.filter((item) => item.source !== source);
  } else {
    await sql().query("DELETE FROM articles");
    await mongo().collection("articles").deleteMany({});
    articleMem = [];
  }
}

export async function readVisitCount() {
  await initDb();
  const [rows] = await sql().query<RowDataPacket[]>("SELECT count FROM visits WHERE id = 1");
  return Number(rows[0]?.count) || 0;
}

export async function bumpVisitCount() {
  const next = (await readVisitCount()) + 1;
  await sql().query("UPDATE visits SET count = ?, updated_at = ? WHERE id = 1", [next, new Date().toISOString()]);
  return next;
}

export async function listDbNotes(limit = 40) {
  await initDb();
  const [rows] = await sql().query<RowDataPacket[]>("SELECT id, name, text, at FROM notes ORDER BY at DESC LIMIT ?", [
    limit,
  ]);
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    text: String(row.text),
    at: String(row.at),
  })) as DbNote[];
}

export async function addDbNote(name: string, text: string) {
  await initDb();
  const note: DbNote = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    text,
    at: new Date().toISOString(),
  };
  await sql().query("INSERT INTO notes (id, name, text, at) VALUES (?, ?, ?, ?)", [
    note.id,
    note.name,
    note.text,
    note.at,
  ]);
  return listDbNotes(40);
}

export async function dbStats() {
  await initDb();
  const count = async (q: string, params: unknown[] = []) => {
    const [rows] = await sql().query<RowDataPacket[]>(q, params);
    return Number(rows[0]?.n) || 0;
  };
  return {
    engine: "mysql+mongodb",
    mysql: `${mysqlConfig.host}:${mysqlConfig.port}/${mysqlConfig.database}`,
    mongodb: `${mongoUri.replace(/\/\/.*@/, "//***@")}/${mongoDbName}`,
    visits: await readVisitCount(),
    notes: await count("SELECT COUNT(*) AS n FROM notes"),
    articles: await count("SELECT COUNT(*) AS n FROM articles"),
    articlesBySource: {
      csdn: await count("SELECT COUNT(*) AS n FROM articles WHERE source = ?", ["csdn"]),
      github: await count("SELECT COUNT(*) AS n FROM articles WHERE source = ?", ["github"]),
      local: await count("SELECT COUNT(*) AS n FROM articles WHERE source = ?", ["local"]),
    },
    agentRuns: await count("SELECT COUNT(*) AS n FROM agent_runs"),
    settings: await count("SELECT COUNT(*) AS n FROM settings"),
  };
}

export async function listDbAgentRuns(limit = 20) {
  await initDb();
  const [rows] = await sql().query<RowDataPacket[]>(
    "SELECT id, status, message, updated_at FROM agent_runs ORDER BY updated_at DESC LIMIT ?",
    [limit],
  );
  return rows.map((row) => ({
    id: String(row.id),
    status: String(row.status),
    message: String(row.message),
    updated_at: String(row.updated_at),
  }));
}

export async function saveDbAgentRun(run: {
  id: string;
  status: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  payload: unknown;
}) {
  await initDb();
  await sql().query(
    `
      REPLACE INTO agent_runs (id, status, message, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `,
    [run.id, run.status, run.message, run.createdAt, run.updatedAt],
  );
  await mongo()
    .collection<AgentDoc>("agent_runs")
    .updateOne(
      { _id: run.id },
      {
        $set: {
          status: run.status,
          message: run.message,
          payload: run.payload,
          created_at: run.createdAt,
          updated_at: run.updatedAt,
        },
      },
      { upsert: true },
    );
}

export async function getDbAgentRun(id: string) {
  await initDb();
  const doc = await mongo().collection<AgentDoc>("agent_runs").findOne({ _id: id });
  return doc?.payload ?? null;
}

export function dbEngineInfo() {
  return {
    mysql: mysqlConfig,
    mongoUri,
    mongoDbName,
  };
}

// silence unused type import in some TS targets
export type { ResultSetHeader };
