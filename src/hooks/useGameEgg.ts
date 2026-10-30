import { useCallback, useState } from "react";
import type { EggFxKind } from "../components/GameEggFX";

type EggState = {
  kind: EggFxKind;
  title: string | null;
  subtitle: string | null;
};

const EMPTY: EggState = { kind: null, title: null, subtitle: null };

export function useGameEgg() {
  const [egg, setEgg] = useState<EggState>(EMPTY);
  const clear = useCallback(() => setEgg(EMPTY), []);
  const fire = useCallback((kind: Exclude<EggFxKind, null>, title: string, subtitle?: string) => {
    setEgg({ kind, title, subtitle: subtitle ?? null });
  }, []);
  return { egg, fire, clear };
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
