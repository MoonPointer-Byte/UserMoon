import { Link, useSearchParams } from "react-router-dom";
import { BLURBS } from "../data/blurbs";
import { PROJECTS } from "../data/projects";

export function WorksPage() {
  const [params] = useSearchParams();
  const tag = params.get("tag");
  const list = tag ? PROJECTS.filter((project) => project.tags.includes(tag)) : PROJECTS;

  return (
    <main className="inner">
      <header className="panel inner-hero panel--accent">
        <p className="hello-kicker">Works</p>
        <h1>{tag ? tag : "我的作品"}</h1>
        {tag ? (
          <Link className="ghost-btn" to="/works">
            看全部作品
          </Link>
        ) : null}
      </header>
      {list.length === 0 ? <p className="panel empty">这个标签下还没有作品。</p> : null}
      <div className="inner-grid">
        {list.map((project) => (
          <Link
            key={project.id}
            className="panel inner-card"
            to={`/works/${project.id}`}
          >
            <span className="soft-pill">
              {project.year} · {project.lang}
            </span>
            <strong>{project.name}</strong>
            <em>{BLURBS[project.id] ?? project.scene}</em>
            <b>{project.scene}</b>
          </Link>
        ))}
      </div>
    </main>
  );
}
