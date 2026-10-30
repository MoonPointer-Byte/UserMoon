import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { StageSheet } from "../components/StageSheet";
import { useFace } from "../hooks/useFace";

type PostSource = "local" | "csdn" | "github";

type Heading = { id: string; text: string; level: number };

type Post = {
  slug: string;
  title: string;
  date: string;
  summary: string;
  html: string;
  source: PostSource;
  tags: string[];
  externalUrl: string;
  readingMode: "full" | "external";
  headings: Heading[];
  minutes: number;
};

type Neighbor = { slug: string; title: string; source: PostSource } | null;

export function ArticlePage() {
  const { face } = useFace();
  const { slug } = useParams();
  const [post, setPost] = useState<Post | null>(null);
  const [prev, setPrev] = useState<Neighbor>(null);
  const [next, setNext] = useState<Neighbor>(null);
  const [missing, setMissing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeHeading, setActiveHeading] = useState("");

  useEffect(() => {
    if (!slug) return;
    setMissing(false);
    setPost(null);
    void fetch(`/api/posts/${encodeURIComponent(slug)}`)
      .then(async (response) => {
        if (!response.ok) {
          setMissing(true);
          return;
        }
        const data = (await response.json()) as { post: Post; prev: Neighbor; next: Neighbor };
        setPost(data.post);
        setPrev(data.prev);
        setNext(data.next);
      })
      .catch(() => setMissing(true));
  }, [slug]);

  useEffect(() => {
    if (!post || post.readingMode !== "full") return;
    const onScroll = () => {
      const article = document.querySelector(".reader__body");
      if (!article) return;
      const rect = article.getBoundingClientRect();
      const total = article.scrollHeight - window.innerHeight;
      const passed = Math.min(Math.max(-rect.top, 0), Math.max(total, 1));
      setProgress(Math.round((passed / Math.max(total, 1)) * 100));

      const headings = [...document.querySelectorAll(".reader__body h2[id], .reader__body h3[id]")];
      let current = "";
      for (const node of headings) {
        if (node.getBoundingClientRect().top <= 120) current = node.id;
      }
      setActiveHeading(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [post]);

  const toc = useMemo(() => post?.headings.filter((item) => item.level >= 2) ?? [], [post]);

  if (face === "stage") {
    return (
      <StageSheet kicker="Blog" title={post?.title || "文章"} lens>
        {missing ? <p className="stage-sheet__note">找不到这篇文章。</p> : null}
        {!missing && !post ? <p className="stage-sheet__note">正在读取…</p> : null}
        {post ? (
          <article className="stage-read">
            <p className="stage-sheet__meta">
              {sourceLabel(post.source)}
              {post.date ? ` · ${post.date}` : ""}
              {` · ${post.minutes} 分钟`}
            </p>
            {post.summary ? <p>{post.summary}</p> : null}
            {post.readingMode === "external" && !post.html ? (
              <p>
                正文还没同步。
                {post.externalUrl ? (
                  <a href={post.externalUrl} target="_blank" rel="noreferrer">
                    打开原文
                  </a>
                ) : null}
              </p>
            ) : (
              <div dangerouslySetInnerHTML={{ __html: post.html }} />
            )}
            <p>
              <Link to="/articles">返回文章</Link>
              {prev ? <Link to={`/articles/${prev.slug}`}>上一篇</Link> : null}
              {next ? <Link to={`/articles/${next.slug}`}>下一篇</Link> : null}
            </p>
            {toc.length ? (
              <ul>
                {toc.map((item) => (
                  <li key={item.id}>
                    <a href={`#${item.id}`}>{item.text}</a>
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        ) : null}
      </StageSheet>
    );
  }

  return (
    <main className="reader">
      <div className="reader__progress" aria-hidden="true">
        <i style={{ width: `${progress}%` }} />
      </div>

      <p className="reader__crumb">
        <Link to="/">首页</Link>
        <span>/</span>
        <Link to="/articles">文章</Link>
        {post ? (
          <>
            <span>/</span>
            <em>{post.title}</em>
          </>
        ) : null}
      </p>

      {missing ? (
        <div className="reader__empty">
          <strong>找不到这篇文章</strong>
          <Link to="/articles">返回书架</Link>
        </div>
      ) : null}

      {!missing && !post ? <p className="reader__empty">正在铺开纸页…</p> : null}

      {post ? (
        <div className="reader__layout">
          <article className="reader__paper">
            <header className="reader__hero">
              <div className="reader__meta">
                <span className={`blog__source blog__source--${post.source}`}>{sourceLabel(post.source)}</span>
                {post.date ? <time dateTime={post.date}>{post.date}</time> : null}
                <span>{post.minutes} 分钟阅读</span>
              </div>
              <h1>{post.title}</h1>
              {post.summary ? <p className="reader__lead">{post.summary}</p> : null}
              {post.tags.length ? (
                <div className="blog__tags">
                  {post.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              ) : null}
            </header>

            {post.readingMode === "external" && !post.html ? (
              <section className="reader__external">
                <p>这篇来自 {sourceLabel(post.source)}。正文还没同步下来，可以先打开原文。</p>
                {post.summary ? <blockquote>{post.summary}</blockquote> : null}
                {post.externalUrl ? (
                  <a className="reader__open" href={post.externalUrl} target="_blank" rel="noreferrer">
                    打开原文
                  </a>
                ) : (
                  <p>请在 content/articles.json 填写 csdn.user，或登记文章 url 后点「同步远程」。</p>
                )}
              </section>
            ) : (
              <div className="reader__body" dangerouslySetInnerHTML={{ __html: post.html }} />
            )}

            <footer className="reader__foot">
              {post.externalUrl ? (
                <a href={post.externalUrl} target="_blank" rel="noreferrer">
                  原文 · {sourceLabel(post.source)}
                </a>
              ) : (
                <span>本站发布</span>
              )}
              <Link to="/articles">回到书架</Link>
            </footer>

            <nav className="reader__neighbors" aria-label="相邻文章">
              {prev ? (
                <Link to={`/articles/${prev.slug}`}>
                  <span>上一篇</span>
                  <strong>{prev.title}</strong>
                </Link>
              ) : (
                <span />
              )}
              {next ? (
                <Link to={`/articles/${next.slug}`}>
                  <span>下一篇</span>
                  <strong>{next.title}</strong>
                </Link>
              ) : (
                <span />
              )}
            </nav>
          </article>

          <aside className="reader__toc">
            <p>目录</p>
            {toc.length === 0 ? <em>这篇没有二级标题</em> : null}
            <ul>
              {toc.map((item) => (
                <li key={item.id} data-level={item.level}>
                  <a
                    href={`#${item.id}`}
                    className={activeHeading === item.id ? "is-on" : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    {item.text}
                  </a>
                </li>
              ))}
            </ul>
            <Link className="reader__toc-back" to="/articles">
              全部文章
            </Link>
          </aside>
        </div>
      ) : null}
    </main>
  );
}

function sourceLabel(source: PostSource) {
  if (source === "csdn") return "CSDN";
  if (source === "github") return "GitHub";
  return "本站";
}
