import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

type PostSource = "local" | "csdn" | "github";

type Post = {
  slug: string;
  title: string;
  date: string;
  summary: string;
  source: PostSource;
  tags: string[];
  externalUrl: string;
  readingMode: "full" | "external";
  minutes: number;
};

type Profiles = {
  local: { label: string };
  csdn: { user: string; home: string; label: string };
  github: { owner: string; label: string };
};

type Filter = "all" | PostSource;

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "全部" },
  { id: "local", label: "本站" },
  { id: "csdn", label: "CSDN" },
  { id: "github", label: "GitHub" },
];

export function ArticlesPage() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [profiles, setProfiles] = useState<Profiles | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("正在整理书架…");

  useEffect(() => {
    let cancelled = false;
    setStatus("正在读取，并自动同步远程…");
    void fetch("/api/posts")
      .then((response) => response.json())
      .then((data: { posts?: Post[]; profiles?: Profiles }) => {
        if (cancelled) return;
        setPosts(data.posts ?? []);
        setProfiles(data.profiles ?? null);
        setStatus("");
      })
      .catch(() => {
        if (cancelled) return;
        setPosts([]);
        setStatus("文章服务暂时不可用");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const list = posts ?? [];
    const q = query.trim().toLowerCase();
    return list.filter((post) => {
      if (filter !== "all" && post.source !== filter) return false;
      if (!q) return true;
      return [post.title, post.summary, post.tags.join(" "), post.source].join(" ").toLowerCase().includes(q);
    });
  }, [posts, filter, query]);

  const counts = useMemo(() => {
    const base = { all: posts?.length ?? 0, local: 0, csdn: 0, github: 0 };
    for (const post of posts ?? []) base[post.source] += 1;
    return base;
  }, [posts]);

  return (
    <main className="blog">
      <aside className="blog__rail">
        <header className="blog__rail-head">
          <p>阅读台</p>
          <h1>文章</h1>
        </header>

        <label className="blog__find">
          <span>筛选</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="标题、标签…" />
        </label>

        <nav className="blog__filters" aria-label="来源">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={filter === item.id ? "is-on" : undefined}
              onClick={() => setFilter(item.id)}
            >
              <strong>{item.label}</strong>
              <em>{counts[item.id]}</em>
            </button>
          ))}
        </nav>

        <div className="blog__sources">
          <p>源</p>
          {profiles?.csdn.user ? (
            <a href={profiles.csdn.home || `https://blog.csdn.net/${profiles.csdn.user}`} target="_blank" rel="noreferrer">
              {profiles.csdn.label} · {profiles.csdn.user}
            </a>
          ) : (
            <Link to="/manage">去数据台填写 CSDN 用户名</Link>
          )}
          <a
            href={`https://github.com/${profiles?.github.owner || "MoonPointer-Byte"}`}
            target="_blank"
            rel="noreferrer"
          >
            {profiles?.github.label || "GitHub"} · {profiles?.github.owner || "MoonPointer-Byte"}
          </a>
          <Link to="/manage">数据台</Link>
        </div>
      </aside>

      <section className="blog__stage">
        <header className="blog__stage-head">
          <div>
            <p className="blog__kicker">Blog</p>
            <h2>{filter === "all" ? "全部文章" : FILTERS.find((item) => item.id === filter)?.label}</h2>
            <p>
              {visible.length} 篇
              {status ? ` · ${status}` : ""}
            </p>
          </div>
        </header>

        {posts === null ? <p className="blog__empty">{status || "正在整理书架…"}</p> : null}

        {posts && posts.length === 0 ? (
          <div className="blog__empty">
            <strong>还没有文章</strong>
            <p>
              本站可放 Markdown；CSDN / GitHub 在 <Link to="/manage">数据台</Link> 配置后，打开本页会自动入库展示。
            </p>
          </div>
        ) : null}

        {posts && posts.length > 0 && visible.length === 0 ? (
          <p className="blog__empty">这个筛选下没有文章。</p>
        ) : null}

        <div className="blog__feed">
          {visible.map((post) => (
            <article key={post.slug} className="blog__card">
              <div className="blog__card-meta">
                <span className={`blog__source blog__source--${post.source}`}>{sourceLabel(post.source, profiles)}</span>
                {post.date ? <time dateTime={post.date}>{post.date}</time> : <span>未标日期</span>}
                <span>{post.minutes} 分钟</span>
              </div>
              <h3>
                <Link to={`/articles/${post.slug}`}>{post.title}</Link>
              </h3>
              {post.summary ? <p>{post.summary}</p> : null}
              <div className="blog__card-foot">
                <div className="blog__tags">
                  {post.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                <Link className="blog__read" to={`/articles/${post.slug}`}>
                  阅读
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function sourceLabel(source: PostSource, profiles: Profiles | null) {
  if (source === "csdn") return profiles?.csdn.label || "CSDN";
  if (source === "github") return profiles?.github.label || "GitHub";
  return profiles?.local.label || "本站";
}
