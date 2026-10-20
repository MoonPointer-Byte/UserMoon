import { useEffect, useState } from "react";

const KEY = "usermoon-visitor";

function createName() {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `访客${n}`;
}

export function useVisitor() {
  const [name, setName] = useState("访客");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    if (saved) {
      setName(saved);
    } else {
      const next = createName();
      localStorage.setItem(KEY, next);
      setName(next);
    }
    setReady(true);
  }, []);

  const rename = (value: string) => {
    const next = value.trim().slice(0, 24) || "访客";
    setName(next);
    localStorage.setItem(KEY, next);
  };

  return { name, rename, ready };
}
