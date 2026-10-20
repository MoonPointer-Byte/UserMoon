import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type Achievement = {
  id: string;
  year: string;
  category: string;
  title: string;
  result: string;
  detail: string;
  url: string;
};

const ORDER = ["学业", "竞赛与奖项", "经历", "项目结果"];

export function HonorsPage() {
  const [items, setItems] = useState<Achievement[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/achievements")
      .then((response) => response.json())
      .then((data: { achievements?: Achievement[] }) => setItems(data.achievements ?? []))
      .catch(() => setItems([]));
  }, []);

  const groups = ORDER.map((category) => ({
    category,
    rows: (items ?? []).filter((item) => item.category === category),
  })).filter((group) => group.rows.length > 0);

  return (
    <main className="inner">
      <header className="panel inner-hero panel--accent">
        <p className="hello-kicker">Honors</p>
        <h1>成绩</h1>
      </header>
      {items === null ? <p className="panel empty">正在读取…</p> : null}
      {items && groups.length === 0 ? (
        <p className="panel empty">
          还没有公开的成绩。
          <Link className="ghost-btn" to="/">
            回首页
          </Link>
        </p>
      ) : null}
      {groups.map((group) => (
        <section key={group.category} className="inner-block">
          <h2>{group.category}</h2>
          <div className="inner-grid">
            {group.rows.map((item) => {
              const expanded = open === item.id;
              return (
                <article key={item.id} className="panel inner-card">
                  <button type="button" onClick={() => setOpen(expanded ? null : item.id)}>
                    <span className="soft-pill">
                      {item.year} · {item.result}
                    </span>
                    <strong>{item.title}</strong>
                  </button>
                  {expanded ? (
                    <div className="honor__detail">
                      <p>{item.detail || "没有补充说明。"}</p>
                      {item.url ? (
                        <a className="pill-link" href={item.url} target="_blank" rel="noreferrer">
                          打开链接
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
