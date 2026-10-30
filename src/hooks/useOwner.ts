import { useCallback, useState } from "react";
import { clearStoredOwnerToken, getStoredOwnerToken, setStoredOwnerToken } from "../lib/owner";

export function useOwner() {
  const [token, setToken] = useState(() => getStoredOwnerToken());

  const unlock = useCallback((value: string) => {
    const next = value.trim();
    setStoredOwnerToken(next);
    setToken(next);
  }, []);

  const lock = useCallback(() => {
    clearStoredOwnerToken();
    setToken("");
  }, []);

  return {
    token,
    isOwner: token.length >= 8,
    unlock,
    lock,
  };
}
