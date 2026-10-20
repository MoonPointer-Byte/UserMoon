import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

type Domain = "all" | "works" | "articles" | "shares" | "honors" | "pages";

type Hit = {
  id: string;
  domain: Exclude<Domain, "all">;
  title: string;
  summary: string;
  href: string;
  reasons: string[];
};

type Suggest = { text: string; kind: string };

const DOMAINS: Array<{ id: Domain; label: string }> = [
  { id: "all", label: "综合" },
  { id: "works", label: "作品" },
  { id: "articles", label: "文章" },
  { id: "shares", label: "分享" },
  { id: "honors", label: "成绩" },
  { id: "pages", label: "页面" },
];

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SearchOverlay({ open, onClose }: Props) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState<Domain>("all");
  const [hits, setHits] = useState<Hit[]>([]);
  const [understood, setUnderstood] = useState("");
  const [related, setRelated] = useState<string[]>([]);
  const [suggests, setSuggests] = useState<Suggest[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void fetch(`/api/suggest?q=${encodeURIComponent(query)}`)
        .then((res) => res.json())
        .then((data: { suggestions?: Suggest[] }) => {
          if (!cancelled) setSuggests(data.suggestions ?? []);
        })
        .catch(() => {
          if (!cancelled) setSuggests([]);
        });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setBusy(true);
    const timer = window.setTimeout(() => {
      void fetch(`/api/search?q=${encodeURIComponent(query)}&domain=${domain}`)
        .then((res) => res.json())
        .then(
          (data: {
            hits?: Hit[];
            related?: string[];
            understood?: { label?: string; keywords?: string[] };
          }) => {
            if (cancelled) return;
            setHits(data.hits ?? []);
            setRelated(data.related ?? []);
            const label = data.understood?.label || "综合";
            const keys = (data.understood?.keywords || []).join(" ");
            setUnderstood(query.trim() ? `理解为 ${label}${keys ? ` · ${keys}` : ""}` : "输入关键词搜索本站");
            setBusy(false);
          },
        )
        .catch(() => {
          if (cancelled) return;
          setHits([]);
          setUnderstood("搜索暂时不可用");
          setBusy(false);
        });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, domain, open]);

  if (!open) return null;

  function go(href: string) {
    onClose();
    if (href.startsWith("http")) {
      window.open(href, "_blank", "noreferrer");
      return;
    }
    navigate(href);
  }

  return (
    <div className="search-overlay" role="dialog" aria-modal="true" aria-label="站内搜索">
      <button type="button" className="search-overlay__dim" aria-label="关闭" onClick={onClose} />
      <div className="search-panel">
        <form
          className="search-panel__bar"
          onSubmit={(event) => {
            event.preventDefault();
            if (hits[0]) go(hits[0].href);
          }}
        >
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索作品、文章、页面…"
            aria-label="搜索"
          />
          <kbd>Esc</kbd>
        </form>

        <div className="search-panel__domains" role="tablist" aria-label="类型">
          {DOMAINS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={domain === item.id}
              className={domain === item.id ? "is-on" : undefined}
              onClick={() => setDomain(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <p className="search-panel__meta">
          {busy ? "检索中…" : understood}
        </p>

        {query.trim() && suggests.length > 0 ? (
          <div className="search-panel__suggest">
            {suggests.map((item) => (
              <button key={`${item.kind}-${item.text}`} type="button" onClick={() => setQuery(item.text)}>
                <strong>{item.text}</strong>
                <span>{item.kind}</span>
              </button>
            ))}
          </div>
        ) : null}

        <ul className="search-panel__hits">
          {hits.map((hit) => (
            <li key={hit.id}>
              <button type="button" onClick={() => go(hit.href)}>
                <span className="search-panel__domain">{domainLabel(hit.domain)}</span>
                <strong>{highlight(hit.title, query)}</strong>
                <em>{hit.summary}</em>
                <span className="search-panel__reasons">
                  {hit.reasons.map((reason) => (
                    <i key={reason}>{reason}</i>
                  ))}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {related.length > 0 ? (
          <div className="search-panel__related">
            <span>相关</span>
            {related.map((item) => (
              <button key={item} type="button" onClick={() => setQuery(item)}>
                {item}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function domainLabel(domain: string) {
  const found = DOMAINS.find((item) => item.id === domain);
  return found?.label ?? domain;
}

function highlight(text: string, query: string) {
  const word = query.trim().split(/\s+/)[0];
  if (!word) return text;
  const index = text.toLowerCase().indexOf(word.toLowerCase());
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + word.length)}</mark>
      {text.slice(index + word.length)}
    </>
  );
}
