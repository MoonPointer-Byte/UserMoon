import { useEffect, useRef, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { startGrid } from "../stage/GridField";
import { ScrollLens } from "./ScrollLens";
import "../stage/stage.css";

const LINKS: Array<{ to: string; icon: string; label: string; caption?: string }> = [
  { to: "/articles", icon: "icon-bokeyuan", label: "Blog" },
  { to: "/shares", icon: "icon-biaoqing", label: "Thoughts" },
  { to: "/about", icon: "icon-zhifeiji", label: "About" },
  { to: "/honors", icon: "icon-xiangce", label: "Album" },
  { to: "/projects", icon: "icon-projects", label: "Projects" },
  { to: "/agent", icon: "icon-idea", label: "Thinking" },
];

export function StageSheet({
  kicker,
  title,
  lens = false,
  children,
}: {
  kicker: string;
  title: string;
  lens?: boolean;
  children: ReactNode;
}) {
  const gridRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = gridRef.current;
    if (!canvas) return;
    const phone = /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent);
    return startGrid(canvas, {
      direction: "diagonal",
      speed: phone ? 0.03 : 0.05,
      borderColor: phone ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.1)",
      squareSize: phone ? 50 : 40,
      hoverFillColor: "rgba(255, 255, 255, 0.8)",
      hoverShadowColor: "rgba(255, 255, 255, 0.8)",
      transitionDuration: phone ? 150 : 200,
      trailDuration: phone ? 2000 : 1500,
      specialBlockColor: "rgba(100, 255, 152, 0.8)",
      snakeHeadColor: "rgba(255, 255, 255, 0.95)",
      snakeTailColor: "rgba(218, 231, 255, 0.25)",
      snakeColorDecay: 0.85,
    });
  }, []);

  function relay(clientX: number, clientY: number) {
    gridRef.current?.dispatchEvent(new MouseEvent("mousemove", { clientX, clientY }));
  }

  return (
    <div
      className="stage-sheet"
      onMouseMove={(event) => relay(event.clientX, event.clientY)}
      onTouchMove={(event) => {
        const touch = event.touches[0];
        if (touch) relay(touch.clientX, touch.clientY);
      }}
    >
      <canvas className="stage-sheet__grid" ref={gridRef} />
      <div className={`stage-sheet__scroll${lens ? " has-lens" : ""}`}>
        <header className="stage-sheet__head">
          <p>{kicker}</p>
          <h1>{title}</h1>
        </header>
        <ul className="stage-sheet__nav">
          {LINKS.map((item) => (
            <li key={item.label}>
              <NavLink to={item.to} aria-label={item.label}>
                <i className={`icon ${item.icon}`} />
                <span>{item.label}</span>
                {item.caption ? <em>{item.caption}</em> : null}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="stage-sheet__body">{children}</div>
      </div>
      {lens ? <ScrollLens /> : null}
    </div>
  );
}
