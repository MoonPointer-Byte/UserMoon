import { useEffect, useRef } from "react";

export function Wallpaper() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let scale = 0.5;
    let frame = 0;
    let time = 0;
    let last = 0;
    const pointer = { x: window.innerWidth * 0.3, y: window.innerHeight * 0.2 };

    const resize = () => {
      scale = 0.5;
      width = Math.max(1, Math.floor(window.innerWidth * scale));
      height = Math.max(1, Math.floor(window.innerHeight * scale));
      canvas.width = width;
      canvas.height = height;
    };

    const onMove = (event: PointerEvent) => {
      pointer.x = event.clientX * scale;
      pointer.y = event.clientY * scale;
    };

    const draw = (now: number) => {
      if (!reduce) frame = window.requestAnimationFrame(draw);
      if (reduce) {
        paint();
        return;
      }
      if (document.hidden || now - last < 32) return;
      last = now;
      time += 0.02;
      paint();
    };

    const paint = () => {
      const host = canvas.parentElement;
      const mode = host?.getAttribute("data-theme") || "pixel";
      const theme = host ? getComputedStyle(host) : null;
      const bg = theme?.getPropertyValue("--bg0").trim() || "#090909";
      const accent = theme?.getPropertyValue("--accent").trim() || "#32f08c";
      context.globalAlpha = 1;
      context.fillStyle = bg;
      context.fillRect(0, 0, width, height);
      if (mode === "paper") {
        context.globalAlpha = 0.35;
        const wash = context.createLinearGradient(0, 0, width, height);
        wash.addColorStop(0, "#fffaf2");
        wash.addColorStop(1, "#e7d7c0");
        context.fillStyle = wash;
        context.fillRect(0, 0, width, height);
        context.globalAlpha = 0.08;
        context.strokeStyle = "#8a7048";
        for (let i = 0; i < 18; i += 1) {
          context.beginPath();
          context.moveTo((i * 97) % width, 0);
          context.lineTo((i * 97 + 40) % width, height);
          context.stroke();
        }
        context.globalAlpha = 1;
        return;
      }
      if (mode === "terminal") {
        context.fillStyle = "#05060c";
        context.fillRect(0, 0, width, height);
        for (let i = 0; i < 70; i += 1) {
          const sx = (Math.sin(i * 12.1) * 0.5 + 0.5) * width;
          const sy = (Math.cos(i * 7.7) * 0.5 + 0.5) * height;
          context.globalAlpha = 0.35 + (i % 5) * 0.1;
          context.fillStyle = "#f4f7fb";
          context.fillRect(sx, sy, 1.2, 1.2);
        }
        const comets = [
          { color: "#c6ff4a", ox: 0.18, oy: 0.16, vx: 0.22, vy: 0.05 },
          { color: "#7eb6ff", ox: 0.12, oy: 0.48, vx: 0.18, vy: -0.04 },
          { color: "#ff7a45", ox: 0.42, oy: 0.78, vx: 0.16, vy: -0.08 },
          { color: "#9af6ff", ox: 0.62, oy: 0.42, vx: -0.05, vy: 0.12 },
        ];
        for (const comet of comets) {
          const headX = ((((comet.ox + time * comet.vx) % 1) + 1) % 1) * width;
          const headY = ((((comet.oy + time * comet.vy) % 1) + 1) % 1) * height;
          for (let step = 8; step >= 0; step -= 1) {
            context.globalAlpha = step === 0 ? 0.95 : 0.08 * (8 - step);
            context.fillStyle = step === 0 ? "#ffffff" : comet.color;
            const radius = step === 0 ? 3.2 : 1.4 + (8 - step) * 0.15;
            context.beginPath();
            context.arc(headX - comet.vx * step * 18, headY - comet.vy * step * 18, radius, 0, Math.PI * 2);
            context.fill();
          }
        }
        context.globalAlpha = 1;
        return;
      }
      const cell = 14;
      const cols = Math.ceil(width / cell);
      const rows = Math.ceil(height / cell);
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const flow =
            Math.sin(x * 0.22 + time + ((y * cell - pointer.y) / height) * 2) +
            Math.cos(y * 0.18 - time + ((x * cell - pointer.x) / width) * 2);
          if (flow < 1.05) continue;
          context.globalAlpha = Math.min((flow - 1.05) * 0.55, 0.75);
          context.fillStyle = accent;
          context.fillRect(x * cell, y * cell, cell - 5, cell - 5);
        }
      }
      context.globalAlpha = 1;
    };

    resize();
    pointer.x = window.innerWidth * scale * 0.62;
    pointer.y = window.innerHeight * scale * 0.38;
    if (reduce) paint();
    else frame = window.requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return <canvas ref={ref} className="wallpaper" aria-hidden="true" />;
}
