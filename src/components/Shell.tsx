import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { PROJECTS } from "../data/projects";
import { useVisitor } from "../hooks/useVisitor";
import { SearchOverlay } from "./SearchOverlay";
import { Wallpaper } from "./Wallpaper";

const LINKS = [
  { to: "/", label: "首页", end: true },
  { to: "/articles", label: "文章", end: false },
  { to: "/works", label: "作品", end: false },
  { to: "/repos", label: "仓库", end: false },
  { to: "/agent", label: "Agent", end: false },
  { to: "/manage", label: "数据", end: false },
  { to: "/honors", label: "成绩", end: false },
  { to: "/shares", label: "分享", end: false },
  { to: "/about", label: "关于", end: false },
];

const SIDE = [
  { to: "/articles", title: "文章", text: "博客阅读台" },
  { to: "/works", title: "作品", text: "九个项目的介绍" },
  { to: "/repos", title: "仓库", text: "GitHub 全部仓库" },
  { to: "/agent", title: "Agent", text: "站内助手" },
  { to: "/manage", title: "数据", text: "库管理" },
  { to: "/honors", title: "成绩", text: "学业、奖项和经历" },
  { to: "/shares", title: "分享", text: "想推荐的链接" },
  { to: "/about", title: "关于", text: "我是谁" },
];

const THEMES = [
  { id: "pixel", label: "像素" },
  { id: "terminal", label: "终端" },
  { id: "paper", label: "纸页" },
] as const;

type ThemeId = (typeof THEMES)[number]["id"];

function storedTheme(): ThemeId {
  const saved = window.localStorage.getItem("usermoon-theme");
  return THEMES.some((item) => item.id === saved) ? (saved as ThemeId) : "pixel";
}

const LANGS = Object.entries(
  PROJECTS.reduce<Record<string, number>>((counts, project) => {
    counts[project.lang] = (counts[project.lang] ?? 0) + 1;
    return counts;
  }, {}),
).sort((a, b) => b[1] - a[1]);

let visitMarked = false;

export function Shell() {
  const { name, rename, ready } = useVisitor();
  const location = useLocation();
  const home = location.pathname === "/";
  const wide =
    location.pathname === "/repos" ||
    location.pathname === "/agent" ||
    location.pathname === "/manage" ||
    location.pathname === "/articles" ||
    location.pathname.startsWith("/articles/");
  const [visits, setVisits] = useState<number | null>(null);
  const [theme, setTheme] = useState<ThemeId>(storedTheme);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    window.localStorage.setItem("usermoon-theme", theme);
  }, [theme]);

  useEffect(() => {
    const method = visitMarked ? "GET" : "POST";
    visitMarked = true;
    void fetch("/api/visit", { method })
      .then((response) => response.json())
      .then((data: { count?: number }) => setVisits(data.count ?? null))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="desk-app" data-theme={theme}>
      <Wallpaper />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <header className="topnav">
        <NavLink to="/" end className="topnav__brand">
          <span className="moon moon--xs" aria-hidden="true" />
          MoonPointer
        </NavLink>
        <nav aria-label="页面">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => (isActive ? "is-active" : undefined)}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="topnav__tools">
          <button type="button" className="topnav__search" onClick={() => setSearchOpen(true)}>
            搜索
            <kbd>⌘K</kbd>
          </button>
          <button
            type="button"
            className="topnav__theme"
            onClick={() => {
              const index = THEMES.findIndex((item) => item.id === theme);
              setTheme(THEMES[(index + 1) % THEMES.length].id);
            }}
          >
            {THEMES.find((item) => item.id === theme)?.label}
          </button>
        </div>
      </header>
      <div className={home ? "frame frame--home" : wide ? "frame frame--wide" : "frame"}>
        {home ? (
          <aside className="side-col">
            <div className="panel nav-card panel--warm">
              <NavLink to="/" className="nav-card__id" end>
                <span className="moon moon--sm" aria-hidden="true" />
                <strong>KingPointer</strong>
                <em>MoonPointer</em>
              </NavLink>
              <p className="soft-pill visit">{visits === null ? "到访统计" : `${visits} 次到访`}</p>
              <label className="visitor">
                <span>访客</span>
                <input
                  value={name}
                  maxLength={24}
                  onChange={(event) => rename(event.target.value)}
                  aria-label="访客名称"
                />
              </label>
            </div>
            <div className="panel side-card">
              <p className="card-label"><span>地图</span></p>
              <div className="well">
                {SIDE.map((item) => (
                  <Link key={item.to} to={item.to} className="row-link">
                    <strong>{item.title}</strong>
                    <span>{item.text}</span>
                  </Link>
                ))}
              </div>
            </div>
            <div className="panel side-card">
              <p className="card-label"><span>目录</span></p>
              <ul className="lang-list">
                {LANGS.map(([lang, count]) => (
                  <li key={lang} className="row-link">
                    <strong>{lang}</strong>
                    <span>{count}</span>
                  </li>
                ))}
              </ul>
              <div className="well">
              {PROJECTS.map((project) => (
                <Link key={project.id} to={`/works/${project.id}`} className="row-link">
                  <strong>{project.name}</strong>
                  <span>{project.scene}</span>
                </Link>
              ))}
              </div>
              <a
                className="pill-link"
                href="https://github.com/MoonPointer-Byte"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
            </div>
          </aside>
        ) : null}
        <div key={location.pathname} className="frame__main stage">
          <Outlet context={{ visitor: name, visitorReady: ready }} />
        </div>
      </div>
    </div>
  );
}
