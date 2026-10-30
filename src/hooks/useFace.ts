import { useEffect, useState } from "react";

export type Face = "stage" | "classic";

const KEY = "usermoon-face";

export function useFace() {
  const [face, setFace] = useState<Face>(() =>
    window.localStorage.getItem(KEY) === "classic" ? "classic" : "stage",
  );

  useEffect(() => {
    const sync = () => setFace(window.localStorage.getItem(KEY) === "classic" ? "classic" : "stage");
    window.addEventListener("usermoon-face", sync);
    return () => window.removeEventListener("usermoon-face", sync);
  }, []);

  function choose(next: Face) {
    window.localStorage.setItem(KEY, next);
    window.dispatchEvent(new Event("usermoon-face"));
  }

  return { face, choose };
}
