import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { StageSheet } from "../components/StageSheet";
import { PROJECTS } from "../data/projects";
import { useFace } from "../hooks/useFace";

type Profile = {
  name: string;
  handle: string;
  school: string;
  role: string;
  bio: string;
  github: string;
};

type Achievement = {
  id: string;
  year: string;
  category: string;
  title: string;
  result: string;
  detail: string;
  url: string;
};

const FALLBACK: Profile = {
  name: "MoonPointer",
  handle: "MoonPointer-Byte",
  school: "南京林业大学 · 计算机科学与技术",
  role: "Agent / 全栈",
  bio: "南京林业大学计算机科学与技术。平时做 Agent 和全栈，也把工具做成能打开的作品。",
  github: "https://github.com/MoonPointer-Byte",
};

const ORDER = ["学业", "竞赛与奖项", "经历", "项目结果"];
const years = [...new Set(PROJECTS.map((project) => project.year))].sort();

export function AboutPage() {
  const { face } = useFace();
  const [profile, setProfile] = useState<Profile>(FALLBACK);
  const [items, setItems] = useState<Achievement[]>([]);

  useEffect(() => {
    void fetch("/api/profile")
      .then((response) => response.json())
      .then((data: { profile?: Profile }) => {
        if (data.profile?.name) setProfile(data.profile);
      })
      .catch(() => undefined);
    void fetch("/api/achievements")
      .then((response) => response.json())
      .then((data: { achievements?: Achievement[] }) => setItems(data.achievements ?? []))
      .catch(() => setItems([]));
  }, []);

  const groups = ORDER.map((category) => ({
    category,
    rows: items.filter((item) => item.category === category),
  })).filter((group) => group.rows.length > 0);

  if (face === "stage") {
    return (
      <StageSheet kicker="Profile" title={profile.name}>
        <p className="stage-sheet__lead">{profile.bio}</p>
        <p className="stage-identity">
          {profile.role ? <span>{profile.role}</span> : null}
          {profile.school ? <span>{profile.school}</span> : null}
        </p>
        <a className="stage-sheet__row" href={profile.github} target="_blank" rel="noreferrer">
          <span className="stage-sheet__meta">GitHub</span>
          <strong>{profile.handle}</strong>
        </a>
        {groups.map((group) => (
          <section key={group.category}>
            <h2 className="stage-year">{group.category}</h2>
            <div className="stage-timeline">
              {group.rows.map((item) => {
                const body = (
                  <>
                    <span className="stage-sheet__meta">
                      {item.year}
                      {item.result ? ` · ${item.result}` : ""}
                    </span>
                    <strong>{item.title}</strong>
                    {item.detail ? <em>{item.detail}</em> : null}
                  </>
                );
                return item.url ? (
                  <a key={item.id} className="stage-honor" href={item.url} target="_blank" rel="noreferrer">
                    {body}
                  </a>
                ) : (
                  <div key={item.id} className="stage-honor">
                    {body}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
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
        <p className="hello-kicker">Profile</p>
        <h1>
          {profile.name}
          <span>{profile.handle}</span>
        </h1>
        <p>{profile.bio}</p>
        {profile.school ? <p>{profile.school}</p> : null}
        <a className="pill-link" href={profile.github} target="_blank" rel="noreferrer">
          GitHub
        </a>
      </header>
      {groups.map((group) => (
        <section key={group.category} className="inner-block">
          <h2>{group.category}</h2>
          <div className="inner-grid">
            {group.rows.map((item) => (
              <article key={item.id} className="panel inner-card">
                <span className="soft-pill">
                  {item.year}
                  {item.result ? ` · ${item.result}` : ""}
                </span>
                <strong>{item.title}</strong>
                {item.detail ? <em>{item.detail}</em> : null}
              </article>
            ))}
          </div>
        </section>
      ))}
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
