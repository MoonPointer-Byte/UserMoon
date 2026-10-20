import { useRef, useState, type PointerEvent, type ReactNode } from "react";

type Props = {
  className: string;
  x: number;
  y: number;
  children: ReactNode;
};

export function GlassCard({ className, x, y, children }: Props) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (window.matchMedia("(max-width: 900px)").matches) return;
    const target = event.target as HTMLElement;
    if (target.closest("a, button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      px: event.clientX,
      py: event.clientY,
      ox: offset.x,
      oy: offset.y,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    setOffset({
      x: drag.current.ox + event.clientX - drag.current.px,
      y: drag.current.oy + event.clientY - drag.current.py,
    });
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <article
      className={`card card--float ${className}`}
      style={{
        left: x,
        top: y,
        transform: `translate(${offset.x}px, ${offset.y}px)`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {children}
    </article>
  );
}
