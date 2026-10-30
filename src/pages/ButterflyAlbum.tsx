import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Nebula, StarField } from "../components/AlbumSky";
import BlueButterfly from "../components/BlueButterfly.jsx";

type Phase = "idle" | "cosmos" | "leaving";

type Shot = { src: string; name: string; group: string };

type AlbumGroup = { id: string; title: string; shots: Shot[] };

const GROUPS: Array<{ id: string; title: string; pattern: Record<string, string> }> = [
  {
    id: "honors",
    title: "Honors",
    pattern: import.meta.glob("../assets/album/honors/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}", {
      eager: true,
      import: "default",
    }) as Record<string, string>,
  },
  {
    id: "life",
    title: "Life",
    pattern: import.meta.glob("../assets/album/life/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}", {
      eager: true,
      import: "default",
    }) as Record<string, string>,
  },
  {
    id: "interest",
    title: "Interest",
    pattern: import.meta.glob("../assets/album/interest/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}", {
      eager: true,
      import: "default",
    }) as Record<string, string>,
  },
];

function shotsOf(group: string, files: Record<string, string>): Shot[] {
  return Object.entries(files)
    .sort(([a], [b]) => a.localeCompare(b, "zh"))
    .map(([path, src]) => ({ src, name: path.split("/").pop() || "photo", group }));
}

function placeCard(index: number, count: number, band: number, bands: number, calm: boolean) {
  if (calm) {
    const span = Math.min(48, 26 * Math.max(count - 1, 1));
    const x = count === 1 ? 50 : 50 - span / 2 + (span * index) / (count - 1);
    const y = bands === 1 ? 46 : 30 + (band * 40) / Math.max(bands - 1, 1);
    const tilt = (index - (count - 1) / 2) * 8;
    return { x, y, z: 24, rx: 0, ry: tilt, s: count === 1 ? 1.02 : 0.94 };
  }
  const slot = slotFor(index, count);
  const center = bands === 1 ? 48 : 26 + (band * 46) / Math.max(bands - 1, 1);
  return {
    x: slot.x,
    y: center + (slot.y - 48) * 0.32,
    z: slot.z,
    rx: slot.rx,
    ry: slot.ry,
    s: slot.s,
  };
}

type Slot = { x: number; y: number; ry: number; rx: number; z: number; s: number };

const SLOTS: Slot[] = [
  { x: 28, y: 22, ry: 26, rx: 8, z: 40, s: 0.9 },
  { x: 72, y: 18, ry: -30, rx: 6, z: 80, s: 0.86 },
  { x: 30, y: 50, ry: 18, rx: -2, z: 120, s: 0.96 },
  { x: 50, y: 44, ry: 2, rx: 0, z: -170, s: 0.6 },
  { x: 70, y: 50, ry: -16, rx: 4, z: 100, s: 0.92 },
  { x: 32, y: 76, ry: 34, rx: -12, z: 16, s: 0.76 },
  { x: 68, y: 72, ry: -24, rx: 12, z: 56, s: 0.84 },
];

const SPREAD = [2, 4, 0, 6, 1, 5, 3];

function slotFor(index: number, total: number): Slot {
  if (total <= SLOTS.length) return SLOTS[SPREAD[index % SPREAD.length]];
  if (index < SLOTS.length) return SLOTS[index];
  const ring = index - SLOTS.length;
  const angle = ring * 2.399;
  return {
    x: 50 + Math.cos(angle) * 34,
    y: 48 + Math.sin(angle) * 26,
    ry: Math.cos(angle) * 28,
    rx: Math.sin(angle) * 10,
    z: -30 - (ring % 5) * 36,
    s: 0.72,
  };
}

function browsePose(index: number, focus: number, total: number) {
  let delta = index - focus;
  if (delta > total / 2) delta -= total;
  if (delta < -total / 2) delta += total;
  if (delta === 0) {
    return {
      hero: true,
      x: 50,
      y: 43,
      zIndex: 8,
      transform: "translate(-50%, -50%) translateZ(240px) rotateX(0deg) rotateY(0deg) scale(1)",
    };
  }
  const around = [
    { x: 50, y: -4, rx: 14, ry: -16, z: 30, s: 0.86 },
    { x: 10, y: 94, rx: -8, ry: 24, z: 12, s: 0.8 },
    { x: 94, y: 16, rx: 8, ry: -22, z: -20, s: 0.72 },
    { x: 88, y: 96, rx: 4, ry: -14, z: -50, s: 0.64 },
  ];
  const place = around[(Math.abs(delta) - 1) % around.length];
  const dir = delta > 0 ? 1 : -1;
  const x = place.x === 50 ? 50 : dir > 0 ? place.x : 100 - place.x;
  return {
    hero: false,
    x,
    y: place.y,
    zIndex: 5 - Math.min(Math.abs(delta), 4),
    transform: `translate(-50%, -50%) translateZ(${place.z}px) rotateX(${place.rx}deg) rotateY(${place.ry * dir}deg) scale(${place.s})`,
  };
}

function unit(seed: number, index: number, salt: number) {
  const n = Math.sin(seed * 12.9898 + index * 78.233 + salt) * 43758.5453;
  return n - Math.floor(n);
}

function AlbumCloud({ groups, onOpen }: { groups: AlbumGroup[]; onOpen: (shot: Shot) => void }) {
  const shots = groups.flatMap((group) => group.shots);
  const [focus, setFocus] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [grid, setGrid] = useState(false);
  const [seed, setSeed] = useState(0);
  const [orbit, setOrbit] = useState({ x: 0, y: 0 });
  const [narrow, setNarrow] = useState(() => window.matchMedia("(max-width: 720px)").matches);
  const drag = useRef({ x: 0, y: 0, moved: false, active: false });

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const onChange = () => setNarrow(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!playing || shots.length === 0) return undefined;
    const timer = window.setInterval(() => {
      setFocus((current) => (current == null ? 0 : (current + 1) % shots.length));
    }, 2800);
    return () => window.clearInterval(timer);
  }, [playing, shots.length]);

  const step = (dir: number) => {
    setPlaying(false);
    setGrid(false);
    setFocus((current) => {
      const base = current == null ? (dir > 0 ? -1 : 0) : current;
      return (base + dir + shots.length) % shots.length;
    });
  };

  return (
    <div className={`album__cloud${grid ? " is-grid" : ""}`}>
      <div
        className="album__stage"
        style={grid ? undefined : { transform: `rotateX(${orbit.y}deg) rotateY(${orbit.x}deg)` }}
        onPointerDown={(event) => {
          drag.current = { x: event.clientX, y: event.clientY, moved: false, active: true };
        }}
        onPointerMove={(event) => {
          if (!drag.current.active || grid) return;
          const dx = event.clientX - drag.current.x;
          const dy = event.clientY - drag.current.y;
          if (Math.hypot(dx, dy) > 6) drag.current.moved = true;
          drag.current.x = event.clientX;
          drag.current.y = event.clientY;
          setOrbit((current) => ({
            x: Math.max(-22, Math.min(22, current.x + dx * 0.08)),
            y: Math.max(-14, Math.min(14, current.y - dy * 0.05)),
          }));
        }}
        onPointerUp={() => {
          drag.current.active = false;
        }}
        onPointerLeave={() => {
          drag.current.active = false;
        }}
      >
        {groups.flatMap((group, band) => {
          const calm = seed === 0 && group.shots.length <= 4;
          const anchor = placeCard(0, group.shots.length, band, groups.length, calm);
          const label =
            focus != null ? null : (
              <p
                key={`${group.id}-label`}
                className="album__label"
                style={grid ? undefined : { top: `${Math.max(12, anchor.y - 16)}%` }}
              >
                {group.title}
              </p>
            );
          const cards = group.shots.map((shot, indexInGroup) => {
          const index = shots.indexOf(shot);
          const slot = placeCard(indexInGroup, group.shots.length, band, groups.length, calm);
          const j = seed === 0 || calm ? 0 : unit(seed, index, 1) - 0.5;
          const k = seed === 0 || calm ? 0 : unit(seed, index, 2) - 0.5;
          const pull = narrow ? 0.78 : 1;
          const edge = narrow ? 34 : 24;
          const x = Math.min(100 - edge, Math.max(edge, 50 + (slot.x - 50) * pull + j * 8));
          const y = Math.min(78, Math.max(18, slot.y + k * 6));
          const browsing = !grid && focus != null;
          const pose = browsing ? browsePose(index, focus, shots.length) : null;
          const style = grid
            ? { animationDelay: `${index * 70}ms` }
            : pose
              ? {
                  left: `${pose.x}%`,
                  top: `${pose.y}%`,
                  zIndex: pose.zIndex,
                  opacity: 1,
                  animationDelay: `${index * 70}ms`,
                  transform: pose.transform,
                }
              : {
                  left: `${x}%`,
                  top: `${y}%`,
                  zIndex: Math.round(slot.z + 220),
                  opacity: 1,
                  animationDelay: `${index * 70}ms`,
                  transform: `translate(-50%, -50%) translateZ(${slot.z}px) rotateX(${slot.rx + k * 8}deg) rotateY(${slot.ry + j * 16}deg) scale(${slot.s})`,
                };
          return (
            <button
              key={shot.src}
              type="button"
              className={`album__card${pose?.hero ? " is-hero" : ""}`}
              style={style}
              onClick={() => {
                if (drag.current.moved) {
                  drag.current.moved = false;
                  return;
                }
                if (!grid && focus === index) onOpen(shot);
                else {
                  setGrid(false);
                  setFocus(index);
                }
              }}
            >
              <img src={shot.src} alt={shot.name} draggable={false} />
            </button>
          );
          });
          return [label, ...cards];
        })}
      </div>
      <div className="album__dock">
        <button type="button" aria-label="Previous" onClick={() => step(-1)}>
          <IconLeft />
        </button>
        <button type="button" aria-label="Next" onClick={() => step(1)}>
          <IconRight />
        </button>
        <button type="button" aria-label={playing ? "Pause" : "Play"} aria-pressed={playing} onClick={() => setPlaying((value) => !value)}>
          {playing ? <IconPause /> : <IconPlay />}
        </button>
        <button type="button" aria-label="Grid" aria-pressed={grid} onClick={() => { setGrid(true); setFocus(null); setPlaying(false); }}>
          <IconGrid />
        </button>
        <button type="button" aria-label="Scatter" aria-pressed={!grid && focus == null} onClick={() => { setGrid(false); setFocus(null); setPlaying(false); }}>
          <IconFrame />
        </button>
        <button type="button" aria-label="Shuffle" onClick={() => { setSeed((value) => value + 1); setGrid(false); setFocus(null); }}>
          <IconSpark />
        </button>
      </div>
    </div>
  );
}

function IconLeft() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.5 6.5 9 12l5.5 5.5" />
    </svg>
  );
}
function IconRight() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9.5 6.5 15 12l-5.5 5.5" />
    </svg>
  );
}
function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 7.5v9l8-4.5-8-4.5Z" />
    </svg>
  );
}
function IconPause() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 7v10M15 7v10" />
    </svg>
  );
}
function IconGrid() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5h6v6H5zm8 0h6v6h-6zM5 13h6v6H5zm8 0h6v6h-6z" />
    </svg>
  );
}
function IconFrame() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 7h12v10H6zm2 2v6h8V9z" />
    </svg>
  );
}
function IconSpark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4.5 13.4 10 19 12l-5.6 2L12 19.5 10.6 14 5 12l5.6-2L12 4.5Z" />
    </svg>
  );
}

export function ButterflyAlbum() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [gather, setGather] = useState(0);
  const [active, setActive] = useState<Shot | null>(null);
  const leaveTimer = useRef(0);
  const open = phase !== "idle";
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const previousRoot = root.style.overflow;
    const previousBody = body.style.overflow;
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      root.style.overflow = previousRoot;
      body.style.overflow = previousBody;
      window.clearTimeout(leaveTimer.current);
    };
  }, []);

  const groups = useMemo(
    () =>
      GROUPS.map((group) => ({
        id: group.id,
        title: group.title,
        shots: shotsOf(group.id, group.pattern),
      })).filter((group) => group.shots.length > 0),
    [],
  );
  return (
    <main className={`album${open ? " is-open" : ""}`}>
      <StarField />
      <Nebula phase={phase} />
      <Link className="album__home" to="/" aria-label="返回">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14.5 5.5 8 12l6.5 6.5" />
        </svg>
      </Link>
      <BlueButterfly
        className="album__wing"
        cover
        bloomWhenVisible
        reactToPointer
        label="Album"
        onBurst={() => {
          if (phase !== "idle") return;
          setPhase("cosmos");
        }}
        gatherToken={gather}
      />
      {open ? (
        <button
          type="button"
          className="album__back"
          onClick={() => {
            if (phase !== "cosmos") return;
            setActive(null);
            setPhase("leaving");
            setGather((value) => value + 1);
            const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            window.clearTimeout(leaveTimer.current);
            leaveTimer.current = window.setTimeout(() => setPhase("idle"), reduce ? 0 : 1500);
          }}
          aria-label="Return"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 14.5 12 8l6 6.5" />
          </svg>
        </button>
      ) : (
        <p className="album__hint">Click</p>
      )}
      {open && groups.length === 0 ? <p className="album__empty">No photos yet.</p> : null}
      <section className="album__wall" hidden={!open || groups.length === 0}>
        <AlbumCloud groups={groups} onOpen={setActive} />
      </section>
      {active ? (
        <button type="button" className="album__lightbox" onClick={() => setActive(null)}>
          <img src={active.src} alt={active.name} />
        </button>
      ) : null}
    </main>
  );
}
