import { Link } from "react-router-dom";
import { StageSheet } from "../components/StageSheet";
import { PROJECTS } from "../data/projects";
import { useFace } from "../hooks/useFace";

const years = [...new Set(PROJECTS.map((project) => project.year))].sort();

const INTRO =
  "南京林业大学计算机科学与技术。平时做 Agent 和全栈，也把工具做成能打开的作品。ICPC 深圳、CCPC 南昌邀请赛铜奖，江苏省大学生程序设计竞赛银奖，中国软件杯国家三等奖。";

export function AboutPage() {
  const { face } = useFace();
  if (face === "stage") {
    return (
      <StageSheet kicker="About" title="MoonPointer">
        <p className="stage-sheet__lead">{INTRO}</p>
        <a className="stage-sheet__row" href="https://github.com/MoonPointer-Byte" target="_blank" rel="noreferrer">
          <span className="stage-sheet__meta">GitHub</span>
          <strong>MoonPointer-Byte</strong>
        </a>
        {years.map((year) => (
          <section key={year}>
            <h2 className="stage-year">{year}</h2>
            {PROJECTS.filter((project) => project.year === year).map((project) => (
              <Link key={project.id} className="stage-sheet__row" to={`/works/${project.id}`}>
                <strong>{project.name}</strong>
                <em>{project.lang}</em>
              </Link>
            ))}
          </section>
        ))}
      </StageSheet>
    );
  }
  return (
    <main className="inner">
      <header className="panel inner-hero panel--warm">
        <p className="hello-kicker">About</p>
        <h1>
          KingPointer
          <span>MoonPointer-Byte</span>
        </h1>
        <p>{INTRO}</p>
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
