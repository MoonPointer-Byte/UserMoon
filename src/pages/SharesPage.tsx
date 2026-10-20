import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type Share = { title: string; reason: string; url: string };

export function SharesPage() {
  const [shares, setShares] = useState<Share[] | null>(null);

  useEffect(() => {
    void fetch("/api/shares")
      .then((response) => response.json())
      .then((data: { shares?: Share[] }) => setShares(data.shares ?? []))
      .catch(() => setShares([]));
  }, []);

  return (
    <main className="inner">
      <header className="panel inner-hero panel--warm">
        <p className="hello-kicker">Shares</p>
        <h1>分享</h1>
      </header>
      {shares === null ? <p className="panel empty">正在读取…</p> : null}
      {shares && shares.length === 0 ? (
        <p className="panel empty">
          还没有分享。
          <Link className="ghost-btn" to="/">
            回首页
          </Link>
        </p>
      ) : null}
      <div className="inner-grid">
        {shares?.map((item) => (
          <a key={item.url} className="panel inner-card" href={item.url} target="_blank" rel="noreferrer">
            <span className="soft-pill">推荐</span>
            <strong>{item.title}</strong>
            <em>{item.reason}</em>
          </a>
        ))}
      </div>
    </main>
  );
}
