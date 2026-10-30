import { useEffect, useMemo } from "react";

export type EggFxKind = "map" | "catalog" | "year" | "tag" | "blog" | null;

type Props = {
  kind: EggFxKind;
  title: string | null;
  subtitle?: string | null;
  onDone: () => void;
  ms?: number;
};

const TITLES: Record<Exclude<EggFxKind, null>, string> = {
  map: "QUEST CLEAR",
  catalog: "COMBO ×3",
  year: "TIME WARP",
  tag: "BUFF UNLOCKED",
  blog: "ARCHIVE OPEN",
};

export function GameEggFX({ kind, title, subtitle, onDone, ms = 2600 }: Props) {
  const particles = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        left: `${6 + ((i * 17) % 88)}%`,
        delay: `${(i % 9) * 0.05}s`,
        dur: `${0.9 + (i % 5) * 0.12}s`,
        label: i % 3 === 0 ? "+EXP" : i % 3 === 1 ? "★" : "◆",
      })),
    [],
  );

  useEffect(() => {
    if (!kind || !title) return;
    document.documentElement.classList.add("is-egg-shake");
    const shake = window.setTimeout(() => document.documentElement.classList.remove("is-egg-shake"), 520);
    const done = window.setTimeout(onDone, ms);
    return () => {
      window.clearTimeout(shake);
      window.clearTimeout(done);
      document.documentElement.classList.remove("is-egg-shake");
    };
  }, [kind, title, ms, onDone]);

  if (!kind || !title) return null;

  return (
    <div className={`game-egg game-egg--${kind}`} role="status" aria-live="polite">
      <div className="game-egg__veil" />
      <div className="game-egg__scan" />
      {particles.map((p) => (
        <span
          key={p.id}
          className="game-egg__bit"
          style={{ left: p.left, animationDelay: p.delay, animationDuration: p.dur }}
        >
          {p.label}
        </span>
      ))}
      <div className="game-egg__banner">
        <p className="game-egg__kicker">{TITLES[kind]}</p>
        <strong>{title}</strong>
        {subtitle ? <em>{subtitle}</em> : null}
        <div className="game-egg__bar" aria-hidden="true">
          <i />
        </div>
      </div>
    </div>
  );
}
