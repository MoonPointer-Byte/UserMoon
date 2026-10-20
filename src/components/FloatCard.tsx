import { useRef, useState, type PointerEvent, type ReactNode } from "react";

type Props = {
  id: string;
  children: ReactNode;
  className?: string;
  left: string;
  top: string;
  width: string;
  delay?: number;
};

const LAYOUT_KEY = "usermoon-layout";

function readOffset(id: string) {
  try {
    const all = JSON.parse(localStorage.getItem(LAYOUT_KEY) || "{}") as Record<
      string,
      { x?: number; y?: number }
    >;
    const item = all[id];
    if (item && Number.isFinite(item.x) && Number.isFinite(item.y)) {
      return { x: item.x as number, y: item.y as number };
    }
  } catch {
    /* keep the default place */
  }
  return { x: 0, y: 0 };
}

function saveOffset(id: string, offset: { x: number; y: number }) {
  try {
    const all = JSON.parse(localStorage.getItem(LAYOUT_KEY) || "{}") as Record<string, unknown>;
    all[id] = offset;
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(all));
  } catch {
    /* layout is optional */
  }
}

export function FloatCard({ id, children, className, left, top, width, delay = 0 }: Props) {
  const [offset, setOffset] = useState(() => readOffset(id));
  const [dragging, setDragging] = useState(false);
  const [front, setFront] = useState(1);
  const origin = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const offsetRef = useRef(offset);

  function down(event: PointerEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("a, button, input, textarea, label")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    origin.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
    setDragging(true);
    setFront(Date.now());
  }

  function move(event: PointerEvent<HTMLElement>) {
    if (!dragging) return;
    const next = {
      x: origin.current.ox + event.clientX - origin.current.x,
      y: origin.current.oy + event.clientY - origin.current.y,
    };
    offsetRef.current = next;
    setOffset(next);
  }

  function up() {
    if (!dragging) return;
    setDragging(false);
    saveOffset(id, offsetRef.current);
  }

  return (
    <div
      className="float-slot"
      style={{ left, top, width, animationDelay: `${delay}ms`, zIndex: front }}
    >
      <article
        className={`squircle${dragging ? " is-drag" : ""}${className ? ` ${className}` : ""}`}
        style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        {children}
      </article>
    </div>
  );
}
