import { Link } from "react-router-dom";
import { PROJECTS } from "../data/projects";

const years = [...new Set(PROJECTS.map((project) => project.year))].sort();

export function AboutPage() {
  return (
    <main className="inner">
      <header className="panel inner-hero panel--warm">
        <p className="hello-kicker">About</p>
        <h1>
          KingPointer
          <span>MoonPointer-Byte</span>
        </h1>
        <a className="pill-link" href="https://github.com/MoonPointer-Byte" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </header>
      <div className="inner-grid">
        {years.map((year) => (
          <article key={year} className="panel inner-card">
            <span className="soft-pill">时间</span>
            <strong>{year}</strong>
            <div className="about-links">
              {PROJECTS.filter((project) => project.year === year).map((project) => (
                <Link key={project.id} className="row-link" to={`/works/${project.id}`}>
                  <strong>{project.name}</strong>
                  <span>{project.lang}</span>
                </Link>
              ))}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
