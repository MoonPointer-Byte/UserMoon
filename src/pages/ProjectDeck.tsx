import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { PROJECTS, type Project } from "../data/projects";
import "../stage/deck.css";

type Kind = "title" | "project" | "overview";

type Step = {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  rotateY: number;
  scale: number;
  kind: Kind;
  reverse?: boolean;
  project?: Project;
};

const SPOTS: Array<Pick<Step, "x" | "y" | "z" | "rotateY" | "reverse">> = [
  { x: 1500, y: 0, z: 0, rotateY: 0, reverse: false },
  { x: 1200, y: 800, z: 200, rotateY: 30, reverse: true },
  { x: 0, y: 1500, z: 400, rotateY: 90, reverse: false },
  { x: -1060, y: 1060, z: 600, rotateY: 135, reverse: true },
  { x: -1500, y: 0, z: 800, rotateY: 180, reverse: false },
  { x: -1060, y: -1060, z: 1000, rotateY: 225, reverse: true },
  { x: 0, y: -1500, z: 1200, rotateY: 270, reverse: true },
  { x: 1060, y: -1060, z: 1400, rotateY: 315, reverse: false },
];

function spotFor(index: number) {
  const known = SPOTS[index];
  if (known) return known;
  const angle = (index / 8) * Math.PI * 2;
  return {
    x: Math.round(Math.cos(angle) * 1500),
    y: Math.round(Math.sin(angle) * 1500),
    z: 200 + index * 200,
    rotateY: (index * 45) % 360,
    reverse: index % 2 === 1,
  };
}

const STEPS: Step[] = [
  { id: "title", name: "MoonPointer", x: 0, y: 0, z: 0, rotateY: 0, scale: 1, kind: "title" },
  ...PROJECTS.map((project, index) => ({
    id: project.id,
    name: project.name,
    ...spotFor(index),
    scale: 1,
    kind: "project" as const,
    project,
  })),
  { id: "overview", name: "Overview", x: 0, y: 0, z: 0, rotateY: 0, scale: 4.5, kind: "overview" },
];

const CYCLE = STEPS.filter((step) => step.kind !== "overview");

function repoName(url: string) {
  const parts = url.split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

function formatStars(count: number) {
  if (count >= 1000) {
    const value = count / 1000;
    return `${value >= 10 ? Math.round(value) : value.toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(count);
}

function windowScaleNow() {
  const width = Math.max(1024, window.innerWidth);
  const height = Math.max(768, window.innerHeight);
  return Math.min(3, window.innerWidth / width, window.innerHeight / height) || 1;
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function ProjectDeck() {
  const navigate = useNavigate();
  const location = useLocation();
  const hashId = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  const active = STEPS.find((step) => step.id === hashId) ?? STEPS.find((step) => step.id === "overview") ?? STEPS[0];
  const [scale, setScale] = useState(1);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [stars, setStars] = useState<Record<string, number>>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const lastFocus = useRef(CYCLE.find((step) => step.kind === "project")?.id ?? "title");
  if (active.kind !== "overview") lastFocus.current = active.id;
  const reduce = useRef(false);
  const lastTarget = useRef(1 / active.scale);
  const activeRef = useRef(active.id);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  activeRef.current = active.id;

  const stepScale = active.kind === "overview" && scale < 0.95 ? 3.1 : active.scale;
  const targetScale = 1 / stepScale;
  const zoomIn = targetScale >= lastTarget.current - 1e-4;
  const motion = ready && !reduce.current ? 1500 : 0;
  const half = motion / 2;
  const rootScale = scale * targetScale;

  useEffect(() => {
    lastTarget.current = targetScale;
  }, [targetScale, active.id]);

  useEffect(() => {
    const stored = window.localStorage.getItem("usermoon-deck-theme");
    if (stored === "light" || stored === "dark") setTheme(stored);
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const measure = () => setScale(windowScaleNow());
    measure();
    setReady(true);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    if (STEPS.some((step) => step.id === hashId)) return;
    navigate({ pathname: "/projects", hash: "#/overview" }, { replace: true });
  }, [hashId, navigate]);

  useEffect(() => {
    void fetch("/api/github")
      .then((res) => res.json())
      .then((data: { repos?: Array<{ name: string; stars?: number }> }) => {
        const next: Record<string, number> = {};
        for (const repo of data.repos ?? []) next[repo.name.toLowerCase()] = repo.stars ?? 0;
        setStars(next);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const index = CYCLE.findIndex((step) => step.id === activeRef.current);
      const next = CYCLE[(index + 1) % CYCLE.length];
      navigate({ pathname: "/projects", hash: `#/${next.id}` });
    }, 4200);
    return () => window.clearInterval(timer);
  }, [playing, navigate]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "Escape") fly("overview");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active.id]);

  function fly(id: string) {
    if (!STEPS.some((step) => step.id === id)) return;
    setMapOpen(false);
    navigate({ pathname: "/projects", hash: `#/${id}` });
  }

  function go(delta: number) {
    const index = STEPS.findIndex((step) => step.id === active.id);
    const next = STEPS[(index + delta + STEPS.length) % STEPS.length];
    fly(next.id);
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    window.localStorage.setItem("usermoon-deck-theme", next);
  }

  function onPointerDown(event: React.PointerEvent) {
    const target = event.target as HTMLElement;
    if (target.closest(".deck__bar, .deck__nav")) return;
    swipe.current = { x: event.clientX, y: event.clientY };
    swiped.current = false;
  }

  function onPointerUp(event: React.PointerEvent) {
    if (!swipe.current) return;
    const dx = event.clientX - swipe.current.x;
    const dy = event.clientY - swipe.current.y;
    swipe.current = null;
    if (Math.abs(dx) < 90 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    swiped.current = true;
    go(dx < 0 ? 1 : -1);
  }

  function onStepClick(event: React.MouseEvent, id: string) {
    if (swiped.current) {
      swiped.current = false;
      event.preventDefault();
      return;
    }
    if (id === active.id) return;
    event.preventDefault();
    fly(id);
  }

  const scene = (
    <main className="deck" data-theme={theme}>
      <div className="deck__viewport" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        <div
          className="deck__root"
          style={{
            perspective: `${1000 / rootScale}px`,
            transform: `scale(${rootScale})`,
            transitionDuration: `${motion}ms`,
            transitionDelay: `${zoomIn ? half : 0}ms`,
          }}
        >
          <div
            className="deck__canvas"
            style={{
              transform: `rotateY(${-active.rotateY}deg) translate3d(${-active.x}px, ${-active.y}px, ${-active.z}px)`,
              transitionDuration: `${motion}ms`,
              transitionDelay: `${zoomIn ? 0 : half}ms`,
            }}
          >
            {STEPS.map((step) =>
              step.kind === "overview" ? (
                <div key={step.id} id={step.id} className="deck__step deck__step--empty" />
              ) : (
                <div
                  key={step.id}
                  id={step.id}
                  className={`deck__step${step.id === active.id ? " is-on" : ""}`}
                  style={{
                    transform: `translate(-50%, -50%) translate3d(${step.x}px, ${step.y}px, ${step.z}px) rotateY(${step.rotateY}deg)`,
                  }}
                  onClick={(event) => onStepClick(event, step.id)}
                >
                  {step.kind === "title" ? <TitleCard /> : step.project ? <ProjectCard project={step.project} reverse={!!step.reverse} stars={stars} failed={failed} onFail={(id) => setFailed((prev) => ({ ...prev, [id]: true }))} /> : null}
                </div>
              ),
            )}
          </div>
        </div>
      </div>

      {mapOpen ? (
        <aside className="deck__nav">
          <p>目录</p>
          {STEPS.filter((step) => step.kind !== "overview").map((step) => (
            <button key={step.id} type="button" className={step.id === active.id ? "is-on" : undefined} onClick={() => fly(step.id)}>
              {step.name}
            </button>
          ))}
          <button type="button" className={active.kind === "overview" ? "is-on" : undefined} onClick={() => fly("overview")}>
            总览
          </button>
          <Link to="/works">原来的作品台</Link>
        </aside>
      ) : null}

      <div className="deck__bar">
        <button type="button" aria-label="上一个" title="上一个" onClick={() => go(-1)}>
          <Icon d="M14.5 5.5 8 12l6.5 6.5" />
        </button>
        <button type="button" aria-label="下一个" title="下一个" onClick={() => go(1)}>
          <Icon d="M9.5 5.5 16 12l-6.5 6.5" />
        </button>
        <button type="button" aria-label={playing ? "暂停" : "播放"} title={playing ? "暂停" : "播放"} className={playing ? "is-on" : undefined} onClick={() => setPlaying((value) => !value)}>
          {playing ? <Icon d="M8 6h2.4v12H8zm5.6 0H16v12h-2.4z" /> : <Icon d="M8.5 6.2v11.6L17.5 12z" />}
        </button>
        <button
          type="button"
          aria-label="总览"
          title="总览"
          className={active.kind === "overview" ? "is-on" : undefined}
          onClick={() => fly(active.kind === "overview" ? lastFocus.current : "overview")}
        >
          <Icon d="M5 5h5.5v5.5H5zm8.5 0H19v5.5h-5.5zM5 13.5h5.5V19H5zm8.5 0H19V19h-5.5z" />
        </button>
        <button type="button" aria-label="目录" title="目录" className={mapOpen ? "is-on" : undefined} onClick={() => setMapOpen((value) => !value)}>
          <Icon d="M7 5.5h4.2v13H7a1.5 1.5 0 0 1-1.5-1.5v-10A1.5 1.5 0 0 1 7 5.5zm5.8 0H17a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5h-4.2v-13z" />
        </button>
        <button type="button" aria-label={theme === "dark" ? "切换浅色" : "切换深色"} title={theme === "dark" ? "切换浅色" : "切换深色"} onClick={toggleTheme}>
          {theme === "dark" ? (
            <Icon d="M12 4.5v1.8M12 17.7V19.5M4.5 12H6.3M17.7 12h1.8M6.4 6.4l1.3 1.3M16.3 16.3l1.3 1.3M17.6 6.4l-1.3 1.3M7.7 16.3l-1.3 1.3M12 8.2A3.8 3.8 0 1 0 12 15.8 3.8 3.8 0 0 0 12 8.2z" />
          ) : (
            <Icon d="M14.5 3.8A7.2 7.2 0 1 0 20.2 14 5.6 5.6 0 0 1 14.5 3.8z" />
          )}
        </button>
      </div>
    </main>
  );

  return createPortal(scene, document.body);
}

function TitleCard() {
  return (
    <article className="deck__card deck__card--title">
      <div className="deck__hello">
        <h2>Hey, I'm MoonPointer</h2>
        <img src="https://github.com/MoonPointer-Byte.png" alt="" />
      </div>
      <ul>
        <li>Front · Back · The pieces in between</li>
        <li>作品、阅读和实验，排在同一片空间里</li>
        <li>点一张卡片，镜头会飞过去</li>
      </ul>
    </article>
  );
}

function ProjectCard({
  project,
  reverse,
  stars,
  failed,
  onFail,
}: {
  project: Project;
  reverse: boolean;
  stars: Record<string, number>;
  failed: Record<string, boolean>;
  onFail: (id: string) => void;
}) {
  const repo = repoName(project.url);
  const shot = repo ? `https://opengraph.githubassets.com/1/MoonPointer-Byte/${repo}` : "";
  const count = stars[repo.toLowerCase()];
  const preview = (
    <div className="deck__shot">
      {shot && !failed[project.id] ? (
        <img src={shot} alt="" draggable={false} onError={() => onFail(project.id)} />
      ) : (
        <div className="deck__shot-fallback">
          <strong>{project.name}</strong>
          <span>{project.scene}</span>
        </div>
      )}
    </div>
  );
  const copy = (
    <div className="deck__info">
      <h2>{project.name}</h2>
      <p>{project.summary}</p>
      <div className="deck__tags">
        {project.tags.slice(0, 3).map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <div className="deck__meta">
        <span>{project.lang}</span>
        <span>Created {project.year}</span>
      </div>
      <div className="deck__actions">
        <Link className="deck__live" to={`/works?id=${encodeURIComponent(project.id)}`}>
          Live Demo
        </Link>
        <a className="deck__git" href={project.url} target="_blank" rel="noreferrer">
          GitHub
          {count != null ? <em>{formatStars(count)}</em> : null}
        </a>
      </div>
    </div>
  );
  return (
    <article className="deck__card">
      {reverse ? preview : copy}
      {reverse ? copy : preview}
    </article>
  );
}
