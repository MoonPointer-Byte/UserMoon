import { useEffect, useState, type FormEvent } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { CalendarCard } from "../components/CalendarCard";
import { BLURBS } from "../data/blurbs";
import { PROJECTS } from "../data/projects";
import { useGreeting } from "../hooks/useGreeting";

type OutletCtx = { visitor: string };
type Note = { id: string; name: string; text: string; at: string };
type Post = { slug: string; title: string; date: string; summary: string };
type Achievement = { id: string; year: string; title: string; result: string };

export function HomePage() {
  const greeting = useGreeting();
  const { visitor } = useOutletContext<OutletCtx>();
  const [pick, setPick] = useState(0);
  const [shown, setShown] = useState(true);
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState("");
  const [noteError, setNoteError] = useState("");
  const [latest, setLatest] = useState<Post | null>(null);
  const [honors, setHonors] = useState<Achievement[]>([]);
  const [now, setNow] = useState(() => new Date());
  const project = PROJECTS[pick % PROJECTS.length];

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void fetch("/api/notes")
      .then((response) => response.json())
      .then((data: { notes?: Note[] }) => setNotes(data.notes ?? []))
      .catch(() => undefined);
    void fetch("/api/posts")
      .then((response) => response.json())
      .then((data: { posts?: Post[] }) => setLatest(data.posts?.[0] ?? null))
      .catch(() => undefined);
    void fetch("/api/achievements")
      .then((response) => response.json())
      .then((data: { achievements?: Achievement[] }) => setHonors(data.achievements ?? []))
      .catch(() => undefined);
  }, []);

  function shuffle() {
    setShown(false);
    window.setTimeout(() => {
      setPick((value) => (value + 1 + Math.floor(Math.random() * (PROJECTS.length - 1))) % PROJECTS.length);
      setShown(true);
    }, 280);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setNoteError("");
    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: visitor, text }),
      });
      if (!response.ok) {
        setNoteError("没发出去，再试一次。");
        return;
      }
      const data = (await response.json()) as { notes: Note[] };
      setNotes(data.notes);
      setText("");
    } catch {
      setNoteError("没发出去，再试一次。");
    }
  }

  const clock = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  const honor = honors[0];
  const years = [...new Set(PROJECTS.map((item) => item.year))].sort();
  const tags = [...new Set(PROJECTS.flatMap((item) => item.tags))].slice(0, 12);

  return (
    <main className="bento">
      <article className="panel feature panel--accent">
        <div className="card-label">
          <span>随机推荐</span>
          <button type="button" className="ghost-btn" onClick={shuffle}>
            换一个
          </button>
        </div>
        <div className={shown ? "swap is-in" : "swap"}>
          <p className="soft-pill">{project.scene} · {project.lang}</p>
          <h2>
            <Link to={`/works/${project.id}`}>{project.name}</Link>
          </h2>
          <p>{BLURBS[project.id] ?? project.scene}</p>
          <Link className="pill-link" to={`/works/${project.id}`}>
            查看这个作品
          </Link>
        </div>
        <div className="feature__split">
          <div>
            <span className="soft-pill">最新动态</span>
            {latest ? (
              <Link to={`/articles/${latest.slug}`}>{latest.title}</Link>
            ) : (
              <Link to="/articles">还没有文章</Link>
            )}
          </div>
          <div>
            <span className="soft-pill">成绩</span>
            {honor ? (
              <Link to="/honors">
                {honor.year} · {honor.title}
              </Link>
            ) : (
              <Link to="/honors">还没有公开的成绩</Link>
            )}
          </div>
        </div>
      </article>

      <article className="panel clock-card panel--deep">
        <p className="card-label"><span>现在</span></p>
        <time dateTime={now.toISOString()}>{clock}</time>
        <p>
          {now.toLocaleDateString("zh-CN", {
            month: "long",
            day: "numeric",
            weekday: "short",
          })}
        </p>
        <Link className="pill-link" to="/about">
          关于我
        </Link>
        <p className="clock-stat">{PROJECTS.length} 个作品 · {years[0]}–{years[years.length - 1]}</p>
      </article>

      <article className="panel hello-card panel--warm">
        <div className="moon" aria-hidden="true" />
        <h1>
          {greeting}
          <span>
            I&apos;m <em>KingPointer</em>, Nice to meet you.
          </span>
        </h1>
        <p className="quiet">做 AI、全栈和交互工具。作品、文章、成绩和分享都从这里走进去。</p>
        <a
          className="pill-link"
          href="https://github.com/MoonPointer-Byte"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
        <form className="note-form" onSubmit={(event) => void submit(event)}>
          <input
            value={text}
            maxLength={280}
            placeholder="留一句"
            onChange={(event) => setText(event.target.value)}
          />
          <button type="submit" disabled={!text.trim()}>
            发送
          </button>
        </form>
        {noteError ? <p className="quiet">{noteError}</p> : null}
        {notes.length === 0 ? (
          <p className="quiet">还没有留言。</p>
        ) : (
          <ul className="notes">
            {notes.slice(0, 3).map((note) => (
              <li key={note.id}>
                <strong>{note.name}</strong>
                <span>{note.text}</span>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="panel cal-card">
        <CalendarCard />
      </article>

      <article className="panel focus-card">
        <div className="card-label">
          <span>方向</span>
          <Link className="ghost-btn" to="/works">
            按标签看作品
          </Link>
        </div>
        <div className="tags">
          {tags.map((tag) => (
            <Link key={tag} className="soft-pill" to={`/works?tag=${encodeURIComponent(tag)}`}>
              {tag}
            </Link>
          ))}
        </div>
      </article>

      <article className="panel years-card">
        <div className="card-label">
          <span>年份</span>
          <Link className="ghost-btn" to="/works">
            全部作品
          </Link>
        </div>
        <div className="year-cols">
          {years.map((year) => (
            <div key={year}>
              <strong>{year}</strong>
              {PROJECTS.filter((item) => item.year === year).map((item) => (
                <Link key={item.id} className="row-link" to={`/works/${item.id}`}>
                  <strong>{item.name}</strong>
                  <span>{item.lang}</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      </article>
    </main>
  );
}
