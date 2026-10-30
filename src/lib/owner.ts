const KEY = "usermoon-owner-token";

export function getStoredOwnerToken() {
  try {
    return window.sessionStorage.getItem(KEY)?.trim() || "";
  } catch {
    return "";
  }
}

export function setStoredOwnerToken(token: string) {
  try {
    if (token.trim()) window.sessionStorage.setItem(KEY, token.trim());
    else window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function clearStoredOwnerToken() {
  setStoredOwnerToken("");
}

export function ownerHeaders(extra?: HeadersInit): HeadersInit {
  const token = getStoredOwnerToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}
