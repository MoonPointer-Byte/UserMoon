import { useEffect, useRef, useState } from "react";
import "./ScrollLens.css";

type Mark = { at: number; title: string; detail: string };

type Preview = { title: string; detail: string; top: number; index: number };

function plain(node: Element | null) {
  return (node?.textContent || "").replace(/\s+/g, " ").trim();
}

function offsetIn(scroller: HTMLElement, node: Element) {
  const box = scroller.getBoundingClientRect();
  return node.getBoundingClientRect().top - box.top + scroller.scrollTop;
}

function collect(scroller: HTMLElement): Mark[] {
  const rows = [...scroller.querySelectorAll(".stage-sheet__row")];
  if (rows.length) {
    return rows
      .map((row) => ({
        at: offsetIn(scroller, row),
        title: plain(row.querySelector("strong")) || plain(row),
        detail: plain(row.querySelector("em")),
      }))
      .filter((item) => item.title);
  }

  const blocks = [...scroller.querySelectorAll(".stage-read h2, .stage-read h3, .stage-read p, .stage-read li")];
  let heading = plain(scroller.querySelector(".stage-sheet__head h1"));
  const marks: Mark[] = [];
  for (const block of blocks) {
    const value = plain(block);
    if (!value) continue;
    const at = offsetIn(scroller, block);
    if (/^H[1-3]$/.test(block.tagName)) {
      heading = value;
      marks.push({ at, title: value, detail: "" });
      continue;
    }
    marks.push({
      at,
      title: heading || value.slice(0, 32),
      detail: heading && heading !== value ? value : "",
    });
  }
  return marks;
}

function indexAt(marks: Mark[], y: number) {
  let index = 0;
  for (let i = 0; i < marks.length; i += 1) {
    if (marks[i].at <= y + 12) index = i;
    else break;
  }
  return index;
}

export function ScrollLens() {
  const laneRef = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [span, setSpan] = useState({ height: 1, view: 1, top: 0 });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const scroller = document.querySelector(".stage-sheet__scroll");
    if (!(scroller instanceof HTMLElement)) return;

    const measure = () => {
      const next = collect(scroller);
      const height = Math.max(scroller.scrollHeight, 1);
      setMarks(next);
      setSpan({ height, view: scroller.clientHeight, top: scroller.scrollTop });
      setOverflows(scroller.scrollHeight > scroller.clientHeight + 24);
    };
    const onScroll = () => {
      setSpan({
        height: Math.max(scroller.scrollHeight, 1),
        view: scroller.clientHeight,
        top: scroller.scrollTop,
      });
    };

    measure();
    const observer = new MutationObserver(measure);
    observer.observe(scroller, { childList: true, subtree: true, characterData: true });
    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      scroller.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
    };
  }, []);

  function jump(clientY: number, show: boolean) {
    const scroller = document.querySelector(".stage-sheet__scroll");
    const lane = laneRef.current;
    if (!(scroller instanceof HTMLElement) || !lane || marks.length === 0) return;
    const height = Math.max(scroller.scrollHeight, 1);
    const view = scroller.clientHeight;
    const rect = lane.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientY - rect.top) / Math.max(rect.height, 1)));
    const y = ratio * height;
    const index = indexAt(marks, y);
    const mark = marks[index];
    if (drag.current) {
      const max = Math.max(height - view, 0);
      scroller.scrollTop = Math.min(max, Math.max(0, y - view * 0.35));
    }
    if (!show || !mark) {
      setPreview(null);
      return;
    }
    const top = Math.min(window.innerHeight - 78, Math.max(12, clientY - 26));
    setPreview({ title: mark.title, detail: mark.detail, top, index });
  }

  if (!overflows || marks.length === 0) return null;

  const viewStart = span.top;
  const viewEnd = span.top + span.view;

  return (
    <div
      className="scroll-lens"
      ref={laneRef}
      role="scrollbar"
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round((span.top / Math.max(span.height - span.view, 1)) * 100)}
      onPointerDown={(event) => {
        drag.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        jump(event.clientY, true);
      }}
      onPointerMove={(event) => jump(event.clientY, true)}
      onPointerUp={() => {
        drag.current = false;
      }}
      onPointerLeave={() => {
        if (!drag.current) setPreview(null);
      }}
    >
      {marks.map((mark, index) => {
        const seen = mark.at >= viewStart - 8 && mark.at <= viewEnd;
        return (
          <i
            key={`${mark.at}-${index}`}
            className={`scroll-lens__tick${seen ? " is-view" : ""}${preview?.index === index ? " is-hot" : ""}`}
            style={{ top: `${(mark.at / span.height) * 100}%` }}
          />
        );
      })}
      {preview ? (
        <div className="scroll-lens__card" style={{ top: preview.top }}>
          <strong>{preview.title}</strong>
          {preview.detail ? <span>{preview.detail}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
