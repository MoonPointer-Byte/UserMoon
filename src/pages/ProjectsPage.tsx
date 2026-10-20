import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PROJECTS } from "../data/projects";
import { useBoard } from "../hooks/useBoard";

type SourceRow = {
  id: string;
  ready: boolean;
  path: string | null;
};

export function ProjectsPage() {
  const { board } = useBoard();
  const [sources, setSources] = useState<Record<string, SourceRow>>({});

  useEffect(() => {
    void fetch("/api/sources")
      .then((response) => response.json())
      .then((data: { sources: SourceRow[] }) => {
        const map: Record<string, SourceRow> = {};
        for (const row of data.sources) map[row.id] = row;
        setSources(map);
      })
      .catch(() => undefined);
  }, []);

  return (
    <main className="page">
      <header className="page__head">
        <p className="eyebrow">Projects</p>
        <h1>我的项目</h1>
      </header>
      <div className="project-list">
        {PROJECTS.map((project) => {
          const running = board.activeId === project.id && board.status === "running";
          const source = sources[project.id];
          return (
            <article key={project.id} className={running ? "project is-on" : "project"}>
              <div className="project__meta">
                <span>{project.year}</span>
                <span>{project.lang}</span>
                <span>{project.env}</span>
                <span className={source?.ready ? "ready" : "missing"}>
                  {source ? (source.ready ? "代码就绪" : "缺少代码") : "检查中"}
                </span>
                {running ? <em>运行中</em> : null}
              </div>
              <h2>{project.name}</h2>
              <p>{project.summary}</p>
              {source?.path ? <p className="muted">路径：{source.path}</p> : null}
              <div className="tags">
                {project.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <div className="project__actions">
                <Link className="btn" to={`/studio?launch=${project.id}`}>
                  {running ? "查看预览" : "启动"}
                </Link>
                <a className="btn btn--ghost" href={project.url} target="_blank" rel="noreferrer">
                  仓库
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
