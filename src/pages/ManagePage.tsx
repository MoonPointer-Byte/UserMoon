import { FormEvent, useEffect, useState } from "react";

type Stats = {
  engine: string;
  mysql: string;
  mongodb: string;
  visits: number;
  notes: number;
  articles: number;
  articlesBySource: { csdn: number; github: number; local: number };
  agentRuns: number;
  settings: number;
};

type Profiles = {
  csdn: { user: string; home: string; label: string };
  github: { owner: string; label: string };
};

type ArticleRow = {
  slug: string;
  source: string;
  title: string;
  date: string;
  summary: string;
  fetched_at: string;
};

export function ManagePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [profiles, setProfiles] = useState<Profiles | null>(null);
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [csdnUser, setCsdnUser] = useState("");
  const [githubOwner, setGithubOwner] = useState("MoonPointer-Byte");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [statsRes, articlesRes] = await Promise.all([
      fetch("/api/manage/stats").then((res) => res.json()),
      fetch("/api/manage/articles").then((res) => res.json()),
    ]);
    setStats(statsRes.stats ?? null);
    setProfiles(statsRes.profiles ?? null);
    setArticles(articlesRes.articles ?? []);
    setCsdnUser(statsRes.profiles?.csdn?.user || "");
    setGithubOwner(statsRes.profiles?.github?.owner || "MoonPointer-Byte");
  }

  useEffect(() => {
    void load().catch(() => setMessage("无法读取数据库状态"));
  }, []);

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("正在保存并自动拉取…");
    try {
      const data = await fetch("/api/manage/settings/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csdnUser: csdnUser.trim(),
          csdnHome: csdnUser.trim() ? `https://blog.csdn.net/${csdnUser.trim()}` : "",
          githubOwner: githubOwner.trim() || "MoonPointer-Byte",
          syncReadmes: true,
        }),
      }).then(async (res) => {
        const json = (await res.json()) as { error?: string; count?: number };
        if (!res.ok) throw new Error(json.error || "保存失败");
        return json;
      });
      setMessage(`已保存。当前库内远程文章 ${data.count ?? 0} 篇（打开文章页会自动继续同步）。`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="manage">
      <header className="manage__hero">
        <p>Database</p>
        <h1>数据台</h1>
      </header>

      <section className="manage__grid">
        <article className="manage__card">
          <h2>库概况</h2>
          {stats ? (
            <ul>
              <li>
                <strong>引擎</strong>
                <em>{stats.engine}</em>
              </li>
              <li>
                <strong>MySQL</strong>
                <em>{stats.mysql}</em>
              </li>
              <li>
                <strong>MongoDB</strong>
                <em>{stats.mongodb}</em>
              </li>
              <li>
                <strong>访问</strong>
                <em>{stats.visits}</em>
              </li>
              <li>
                <strong>留言</strong>
                <em>{stats.notes}</em>
              </li>
              <li>
                <strong>文章缓存</strong>
                <em>
                  {stats.articles}（CSDN {stats.articlesBySource.csdn} / GitHub {stats.articlesBySource.github}）
                </em>
              </li>
              <li>
                <strong>Agent</strong>
                <em>{stats.agentRuns}</em>
              </li>
            </ul>
          ) : (
            <p>读取中…</p>
          )}
        </article>

        <article className="manage__card">
          <h2>远程源</h2>
          <form className="manage__form" onSubmit={(event) => void saveSettings(event)}>
            <label>
              CSDN 用户名
              <input value={csdnUser} onChange={(event) => setCsdnUser(event.target.value)} placeholder="例如 your_id" />
            </label>
            <label>
              GitHub 所有者
              <input value={githubOwner} onChange={(event) => setGithubOwner(event.target.value)} />
            </label>
            <p className="manage__hint">
              CSDN 使用官方列表接口 <code>home-api/v1/get-business-list</code>；打开文章页会自动拉取，无需手动同步。
            </p>
            <button type="submit" disabled={busy}>
              {busy ? "处理中…" : "保存并拉取"}
            </button>
            {message ? <em className="manage__msg">{message}</em> : null}
            {profiles?.csdn.home ? (
              <a href={profiles.csdn.home} target="_blank" rel="noreferrer">
                打开 CSDN 主页
              </a>
            ) : null}
          </form>
        </article>
      </section>

      <section className="manage__card manage__table">
        <h2>已入库文章</h2>
        {articles.length === 0 ? <p>还没有远程文章。填好 CSDN 用户名后保存，或打开文章页触发 GitHub 同步。</p> : null}
        <div className="manage__rows">
          {articles.map((item) => (
            <div key={item.slug} className="manage__row">
              <span className={`blog__source blog__source--${item.source}`}>{item.source}</span>
              <strong>{item.title}</strong>
              <em>{item.date || item.fetched_at.slice(0, 10)}</em>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
