import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { startGrid } from "../stage/GridField";
import "../stage/stage.css";

const SUBTITLE = "Front back left right end engineer";
const PATH_A =
  "M-44-50C-52.71 28.52 15.86 8.186 184 14.69 383.3 22.39 462.5 12.58 638 14 835.5 15.6 987 6.4 1194 13.86 1661 30.68 1652-36.74 1582-140.1 1512-243.5 15.88-589.5-44-50Z";
const PATH_B =
  "M -44,-50 C -137.1,117.4 67.86,445.5 236,452 435.3,459.7 500.5,242.6 676,244 873.5,245.6 957,522.4 1154,594 1593,753.7 1793,226.3 1582,-126 1371,-478.3 219.8,-524.2 -44,-50 Z";

const LINKS: Array<{ to: string; icon: string; label: string; caption?: string }> = [
  { to: "/articles", icon: "icon-bokeyuan", label: "Blog" },
  { to: "/shares", icon: "icon-biaoqing", label: "Thoughts" },
  { to: "/about", icon: "icon-zhifeiji", label: "About" },
  { to: "/honors", icon: "icon-xiangce", label: "Album" },
  { to: "/projects", icon: "icon-projects", label: "Projects" },
  { to: "/agent", icon: "icon-idea", label: "Thinking" },
];

type StageWindow = Window & {
  config?: Record<string, unknown>;
  switchPage?: { switched: boolean };
  visibilityChangeEvent?: string;
  __STAGE_CANVAS?: HTMLCanvasElement | null;
  _initBackground?: { (): void; loaded?: boolean };
  animationID?: number;
};

let fluidCode: Promise<string> | null = null;

function loadFluidCode() {
  if (!fluidCode) {
    fluidCode = fetch(`${import.meta.env.BASE_URL}stage-fluid.js`)
      .then((res) => {
        if (!res.ok) throw new Error("fluid");
        return res.text();
      })
      .catch((error) => {
        fluidCode = null;
        throw error;
      });
  }
  return fluidCode;
}

const FLUID: Record<string, unknown> = {
  SIM_RESOLUTION: 128,
  DYE_RESOLUTION: 1024,
  CAPTURE_RESOLUTION: 512,
  DENSITY_DISSIPATION: 1,
  VELOCITY_DISSIPATION: 0.2,
  PRESSURE: 0.8,
  PRESSURE_ITERATIONS: 20,
  CURL: 30,
  SPLAT_RADIUS: 0.25,
  SPLAT_FORCE: 6000,
  SHADING: true,
  COLORFUL: true,
  COLOR_UPDATE_SPEED: 10,
  PAUSED: false,
  BACK_COLOR: { r: 30, g: 31, b: 33 },
  TRANSPARENT: false,
  BLOOM: true,
  BLOOM_ITERATIONS: 8,
  BLOOM_RESOLUTION: 256,
  BLOOM_INTENSITY: 0.4,
  BLOOM_THRESHOLD: 0.8,
  BLOOM_SOFT_KNEE: 0.7,
  SUNRAYS: true,
  SUNRAYS_RESOLUTION: 196,
  SUNRAYS_WEIGHT: 1,
};

export function StageHome({ onClassic }: { onClassic: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef<HTMLCanvasElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const shapeRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [shown, setShown] = useState(false);
  const [letters, setLetters] = useState(false);
  const [cardIn, setCardIn] = useState(false);
  const [armed, setArmed] = useState(false);
  const switched = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setShown(true), 30);
    const lettersTimer = window.setTimeout(() => setLetters(true), 300);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(lettersTimer);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stage = window as StageWindow;
    let cancelled = false;
    let blobUrl = "";
    stage.config = FLUID;
    stage.switchPage = { switched: false };
    stage.visibilityChangeEvent = "visibilitychange";
    stage.__STAGE_CANVAS = canvas;
    if (stage.animationID) window.cancelAnimationFrame(stage.animationID);
    const tracked: Array<[EventTarget, string, EventListenerOrEventListenerObject, boolean | AddEventListenerOptions | undefined]> = [];
    const docAdd = document.addEventListener.bind(document);
    const winAdd = window.addEventListener.bind(window);
    const wrap = (target: EventTarget, orig: typeof document.addEventListener) =>
      ((type: string, fn: EventListenerOrEventListenerObject, opt?: boolean | AddEventListenerOptions) => {
        tracked.push([target, type, fn, opt]);
        orig(type, fn, opt);
      }) as typeof document.addEventListener;
    document.addEventListener = wrap(document, docAdd);
    window.addEventListener = wrap(window, winAdd);
    const restore = () => {
      document.addEventListener = docAdd;
      window.addEventListener = winAdd;
    };
    const script = document.createElement("script");
    script.onload = () => {
      restore();
      if (cancelled) return;
      const buffers = window as StageWindow & { dye?: unknown; velocity?: unknown };
      buffers.dye = null;
      buffers.velocity = null;
      try {
        if (stage._initBackground) {
          stage._initBackground.loaded = false;
          stage._initBackground();
        }
      } catch {
        /* WebGL unavailable: keep the dark stage */
      }
    };
    script.onerror = restore;
    void loadFluidCode()
      .then((code) => {
        if (cancelled) return;
        blobUrl = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
        script.src = blobUrl;
        document.body.appendChild(script);
      })
      .catch(() => restore());
    return () => {
      cancelled = true;
      restore();
      if (stage.switchPage) stage.switchPage.switched = true;
      if (stage.animationID) window.cancelAnimationFrame(stage.animationID);
      stage.animationID = undefined;
      for (const [target, type, fn, opt] of tracked) target.removeEventListener(type, fn, opt);
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
      script.remove();
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      if (stage._initBackground) stage._initBackground.loaded = false;
      const buffers = window as StageWindow & { dye?: unknown; velocity?: unknown };
      buffers.dye = null;
      buffers.velocity = null;
      stage.__STAGE_CANVAS = null;
    };
  }, []);

  useEffect(() => {
    if (!cardIn || !gridRef.current) return;
    const phone = /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent);
    return startGrid(gridRef.current, {
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
  }, [cardIn]);

  function enter() {
    if (switched.current) return;
    switched.current = true;
    const stage = window as StageWindow;
    if (stage.switchPage) stage.switchPage.switched = true;
    const intro = introRef.current;
    const shape = shapeRef.current;
    const path = pathRef.current;
    const started = performance.now();
    const duration = 1100;
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / duration);
      const slide = -(Math.cos(Math.PI * t) - 1) / 2;
      if (intro) intro.style.transform = `translateY(${-200 * slide}vh)`;
      const scale = t < 0.5 ? 0.8 + (1.8 - 0.8) * (t / 0.5) ** 2 : 1.8 + (1 - 1.8) * (1 - (1 - (t - 0.5) / 0.5) ** 2);
      if (shape) shape.style.transform = `scaleY(${scale})`;
      if (path && t > 0.45) path.setAttribute("d", PATH_B);
      if (t < 1) {
        window.requestAnimationFrame(tick);
        return;
      }
      if (stage.animationID) window.cancelAnimationFrame(stage.animationID);
      canvasRef.current?.remove();
      window.setTimeout(() => setCardIn(true), 400);
    };
    window.requestAnimationFrame(tick);
  }

  useEffect(() => {
    window.scrollTo(0, 0);
    const timer = window.setTimeout(() => setArmed(true), 900);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!armed) return undefined;
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY > 0) enter();
    };
    let startY = 0;
    const onTouchStart = (event: TouchEvent) => {
      startY = event.touches[0]?.pageY ?? 0;
    };
    const onTouchEnd = (event: TouchEvent) => {
      const endY = event.changedTouches[0]?.pageY ?? startY;
      if (startY - endY > 36) enter();
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [armed]);

  return (
    <main className="stage-root">
      <button type="button" className="face-back" onClick={onClassic}>
        经典
      </button>
      <div className="content content-intro" ref={introRef}>
        <div className="content-inner">
          <canvas id="background" ref={canvasRef} />
          <div className={shown ? "wrap fade in" : "wrap fade"}>
            <a className="github-corner" href="https://github.com/MoonPointer-Byte" aria-label="GitHub" target="_blank" rel="noreferrer">
              <svg width="80" height="80" viewBox="0 0 250 250" aria-hidden="true">
                <path d="M0 0 115 115 130 115 142 142 250 250 250 0Z" />
                <path className="octo-arm" d="M128.3 109C113.8 99.7 119 89.6 119 89.6 122 82.7 120.5 78.6 120.5 78.6 119.2 72 123.4 76.3 123.4 76.3 127.3 80.9 125.5 87.3 125.5 87.3 122.9 97.6 130.6 101.9 134.4 103.2" fill="currentColor" />
                <path className="octo-body" d="M115 115C114.9 115.1 118.7 116.5 119.8 115.4L133.7 101.6C136.9 99.2 139.9 98.4 142.2 98.6 133.8 88 127.5 74.4 143.8 58 148.5 53.4 154 51.2 159.7 51 160.3 49.4 163.2 43.6 171.4 40.1 171.4 40.1 176.1 42.5 178.8 56.2 183.1 58.6 187.2 61.8 190.9 65.4 194.5 69 197.7 73.2 200.1 77.6 213.8 80.2 216.3 84.9 216.3 84.9 212.7 93.1 206.9 96 205.4 96.6 205.1 102.4 203 107.8 198.3 112.5 181.9 128.9 168.3 122.5 157.7 114.1 157.9 116.9 156.7 120.9 152.7 124.9L141 136.5C139.8 137.7 141.6 141.9 141.8 141.8Z" fill="currentColor" />
              </svg>
            </a>
            <h2 className="content-title">MoonPointer</h2>
            <h3 className="content-subtitle">
              {letters
                ? [...SUBTITLE].map((char, index) => (
                    <span key={`${char}-${index}`} style={{ animationDelay: `${50 + index * 50}ms` }}>
                      {char === " " ? "\u00a0" : char}
                    </span>
                  ))
                : "\u00a0"}
            </h3>
            <button type="button" className="enter" onClick={enter}>
              PRESS START
            </button>
            <div className="arrow arrow-1" onMouseEnter={() => { if (armed) enter(); }} />
            <div className="arrow arrow-2" onMouseEnter={() => { if (armed) enter(); }} />
          </div>
        </div>
        <div className="shape-wrap">
          <svg className="shape" ref={shapeRef} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 1440 800">
            <path ref={pathRef} d={PATH_A} />
          </svg>
        </div>
      </div>
      <div className="content content-main">
        <div id="card">
          <div className={cardIn ? "card-inner fade in" : "card-inner fade"}>
            <header>
              <img src="https://github.com/MoonPointer-Byte.png" width="100" height="100" alt="" />
              <h1>MoonPointer</h1>
              <h2>STDIN | Think &gt;&gt; /dev/Mind</h2>
            </header>
            <ul>
              {LINKS.map((item) => (
                <li key={item.label}>
                  <Link to={item.to} aria-label={item.label}>
                    <i className={`icon ${item.icon}`} />
                    <span>{item.label}</span>
                    {item.caption ? <em>{item.caption}</em> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <canvas className="grid-background" ref={gridRef} />
      </div>
    </main>
  );
}
