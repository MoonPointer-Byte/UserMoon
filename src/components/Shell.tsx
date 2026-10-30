import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useFace } from "../hooks/useFace";
import { useVisitor } from "../hooks/useVisitor";
import { SearchOverlay } from "./SearchOverlay";
import { Wallpaper } from "./Wallpaper";

const LINKS = [
  { to: "/", label: "首页", end: true },
  { to: "/articles", label: "文章", end: false },
  { to: "/works", label: "作品", end: false },
  { to: "/agent", label: "Agent", end: false },
  { to: "/honors", label: "成绩", end: false },
  { to: "/shares", label: "分享", end: false },
  { to: "/about", label: "关于", end: false },
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

let visitMarked = false;

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.5 5.5 8 12l6.5 6.5" />
    </svg>
  );
}

function parentPath(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return null;
  const parts = path.split("/").filter(Boolean);
  if (parts.length >= 2) return `/${parts.slice(0, -1).join("/")}`;
  return "/";
}

export function Shell() {
  const { name, ready } = useVisitor();
  const { face, choose } = useFace();
  const location = useLocation();
  const home = location.pathname === "/";
  const backTo = parentPath(location.pathname);
  const stageHome = home && face === "stage";
  const stagePages =
    face === "stage" &&
    ["/articles", "/shares", "/about", "/honors", "/agent"].some(
      (path) => location.pathname === path || location.pathname.startsWith(`${path}/`),
    );
  const wide =
    location.pathname === "/works" ||
    location.pathname === "/repos" ||
    location.pathname === "/agent" ||
    location.pathname === "/owner" ||
    location.pathname === "/manage" ||
    location.pathname === "/articles" ||
    location.pathname.startsWith("/articles/") ||
    location.pathname === "/projects";
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
    <div className={`desk-app${home ? " desk-app--home" : ""}${stageHome ? " desk-app--stage" : ""}${stagePages ? " desk-app--stage-pages" : ""}`} data-theme={theme}>
      <Wallpaper />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      {backTo && ((stagePages && location.pathname !== "/honors") || location.pathname === "/projects")
        ? createPortal(
            <Link className="level-back" to={backTo} aria-label="返回">
              <BackIcon />
            </Link>,
            document.body,
          )
        : null}
      <header className="topnav" hidden={stageHome || stagePages}>
        {backTo && !stagePages && location.pathname !== "/projects" ? (
          <Link className="topnav__back" to={backTo} aria-label="返回">
            <BackIcon />
          </Link>
        ) : null}
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
            <kbd>{typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl+K"}</kbd>
          </button>
          {home && face === "classic" ? (
            <button type="button" className="face-switch" onClick={() => choose("stage")}>
              舞台
            </button>
          ) : null}
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
          <NavLink to="/owner" className="topnav__owner" title="MoonPointer">
            MoonPointer
          </NavLink>
        </div>
      </header>
      <div className={stageHome || stagePages ? "frame frame--stage" : home ? "frame frame--home" : wide ? "frame frame--wide" : "frame"}>
        <div key={location.pathname} className="frame__main stage">
          <Outlet context={{ visitor: name, visitorReady: ready, visits }} />
        </div>
      </div>
    </div>
  );
}
