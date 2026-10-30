import { useCallback, useState } from "react";

export function useEggToast() {
  const [message, setMessage] = useState<string | null>(null);
  const clear = useCallback(() => setMessage(null), []);
  const show = useCallback((text: string) => setMessage(text), []);
  return { message, show, clear };
}

export function bumpSessionCount(key: string, need: number) {
  try {
    const next = Number(sessionStorage.getItem(key) || 0) + 1;
    if (next >= need) {
      sessionStorage.setItem(key, "0");
      return true;
    }
    sessionStorage.setItem(key, String(next));
  } catch {
    return false;
  }
  return false;
}
