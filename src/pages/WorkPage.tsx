import { Link, useParams } from "react-router-dom";
import { BLURBS } from "../data/blurbs";
import { findProject } from "../data/projects";

export function WorkPage() {
  const { id } = useParams();
  const project = findProject(id ?? null);

  if (!project) {
    return (
      <main className="inner">
        <p className="panel empty">
          没有这个作品。
          <Link className="ghost-btn" to="/works">
            返回作品
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="inner">
      <article className="panel inner-hero panel--accent">
        <p className="hello-kicker">
          <Link to="/works">作品</Link>
          <span> / {project.scene}</span>
        </p>
        <h1>{project.name}</h1>
        <p>{BLURBS[project.id] ?? project.scene}</p>
        <div className="tags">
          {project.tags.map((tag) => (
            <Link key={tag} className="soft-pill" to={`/works?tag=${encodeURIComponent(tag)}`}>
              {tag}
            </Link>
          ))}
        </div>
        <a className="pill-link" href={project.url} target="_blank" rel="noreferrer">
          在 GitHub 打开
        </a>
      </article>
      <div className="inner-grid">
        <article className="panel inner-card">
          <span className="soft-pill">时间</span>
          <strong>{project.year}</strong>
          <em>{project.lang}</em>
        </article>
        <article className="panel inner-card">
          <span className="soft-pill">场景</span>
          <strong>{project.scene}</strong>
          <em>{project.lang}</em>
        </article>
      </div>
    </main>
  );
}
