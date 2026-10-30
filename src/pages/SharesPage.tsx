import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { StageSheet } from "../components/StageSheet";
import { useFace } from "../hooks/useFace";

type Share = { title: string; reason: string; url: string };

export function SharesPage() {
  const { face } = useFace();
  const [shares, setShares] = useState<Share[] | null>(null);

  useEffect(() => {
    void fetch("/api/shares")
      .then((response) => response.json())
      .then((data: { shares?: Share[] }) => setShares(data.shares ?? []))
      .catch(() => setShares([]));
  }, []);

  if (face === "stage") {
    return (
      <StageSheet kicker="Thoughts" title="想法">
        {shares === null ? <p className="stage-sheet__note">正在读取…</p> : null}
        {shares && shares.length === 0 ? (
          <div className="stage-sheet__empty">
            <strong>想法还在路上</strong>
            <p>读过的文章和想留下的句子，之后会出现在这里。</p>
            <Link to="/articles">先去 Blog</Link>
          </div>
        ) : null}
        {shares?.map((item) => (
          <a key={item.url} className="stage-sheet__row" href={item.url} target="_blank" rel="noreferrer">
            <strong>{item.title}</strong>
            <em>{item.reason}</em>
          </a>
        ))}
      </StageSheet>
    );
  }

  return (
    <main className="inner">
      <header className="panel inner-hero panel--warm">
        <p className="hello-kicker">Shares</p>
        <h1>分享</h1>
      </header>
      {shares === null ? <p className="panel empty">正在读取…</p> : null}
      {shares && shares.length === 0 ? (
        <p className="panel empty">
          想法还在路上。读过的文章和想留下的句子，之后会出现在这里。
          <Link className="ghost-btn" to="/articles">
            先去文章
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
