import { useEffect, useRef } from "react";

type Phase = "idle" | "cosmos" | "leaving";

function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rand = mulberry32(20261027);
    const stars = Array.from({ length: 180 }, () => ({
      x: rand(),
      y: rand(),
      r: rand() < 0.85 ? 0.4 + rand() * 0.8 : 1.1 + rand() * 0.9,
      tw: rand() * Math.PI * 2,
      speed: 0.4 + rand() * 1.4,
    }));
    let frame = 0;
    const paint = (now: number) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pixelWidth = Math.round(width * dpr);
      const pixelHeight = Math.round(height * dpr);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const time = now / 1000;
      stars.forEach((star) => {
        const alpha = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(time * star.speed + star.tw));
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#f4f7ff";
        ctx.beginPath();
        ctx.arc(star.x * width, star.y * height, star.r, 0, Math.PI * 2);
        ctx.fill();
      });
      frame = window.requestAnimationFrame(paint);
    };
    frame = window.requestAnimationFrame(paint);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={canvasRef} className="album__stars" aria-hidden="true" />;
}

export function Nebula({ phase }: { phase: Phase }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const shown = phase !== "idle";

  useEffect(() => {
    if (!shown) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rand = mulberry32(91);
    const stars = Array.from({ length: 260 }, () => ({
      angle: rand() * Math.PI * 2,
      dist: 0.05 + rand() ** 0.62 * 0.78,
      size: 0.5 + rand() * 2.2,
      tw: rand() * Math.PI * 2,
      speed: 0.4 + rand() * 1.1,
      violet: rand() > 0.72,
    }));
    const clouds = [
      { x: 0.22, y: 0.32, r: 0.46, color: "96, 72, 196", drift: 0.7 },
      { x: 0.72, y: 0.58, r: 0.5, color: "28, 92, 196", drift: 1.1 },
      { x: 0.48, y: 0.7, r: 0.36, color: "132, 64, 168", drift: 0.5 },
      { x: 0.5, y: 0.4, r: 0.26, color: "186, 220, 255", drift: 0.9 },
    ];
    let frame = 0;
    let leaveAt = 0;
    const started = performance.now();

    const paint = (now: number) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pixelWidth = Math.round(width * dpr);
      const pixelHeight = Math.round(height * dpr);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      if (phaseRef.current === "leaving" && !leaveAt) leaveAt = now;
      const time = (now - started) / 1000;
      const leaveT = leaveAt ? Math.min(1, (now - leaveAt) / (reduce ? 1 : 1400)) : 0;
      const reveal = phaseRef.current === "leaving" ? 1 - leaveT : reduce ? 1 : Math.min(1, time / 0.9);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";
      clouds.forEach((cloud) => {
        const drift = reduce ? 0 : Math.sin(time * 0.18 * cloud.drift) * 26;
        const cx = cloud.x * width + drift;
        const cy = cloud.y * height + Math.cos(time * 0.14 * cloud.drift) * 16;
        const radius = cloud.r * Math.max(width, height);
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        glow.addColorStop(0, `rgba(${cloud.color}, ${0.22 * reveal})`);
        glow.addColorStop(0.45, `rgba(${cloud.color}, ${0.08 * reveal})`);
        glow.addColorStop(1, `rgba(${cloud.color}, 0)`);
        ctx.globalAlpha = 1;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      });
      const ox = width * 0.5;
      const oy = height * 0.46;
      stars.forEach((star) => {
        const fly = leaveAt ? 1 - leaveT : reduce ? 1 : 1 - Math.exp(-time * star.speed);
        const reach = Math.max(width, height) * star.dist * fly;
        const x = ox + Math.cos(star.angle) * reach;
        const y = oy + Math.sin(star.angle) * reach * 0.86;
        const twinkle = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(time * 1.8 + star.tw));
        ctx.globalAlpha = reveal * (reduce ? 0.8 : twinkle);
        ctx.fillStyle = star.violet ? "#efe8ff" : "#f7fbff";
        ctx.beginPath();
        ctx.arc(x, y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    if (reduce && phaseRef.current !== "leaving") {
      paint(started + 4000);
      return;
    }
    const loop = (now: number) => {
      paint(now);
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, [shown]);

  if (!shown) return null;
  return <canvas ref={canvasRef} className="album__nebula" aria-hidden="true" />;
}
