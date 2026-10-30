import type { Connect } from "vite";

/** Personal-site owner secret. Only this token may bind sources / manage data. */
export function getOwnerToken() {
  return String(process.env.USERMOON_OWNER_TOKEN || process.env.OWNER_TOKEN || "").trim();
}

export function ownerConfigured() {
  return getOwnerToken().length >= 8;
}

export function extractOwnerToken(req: Connect.IncomingMessage) {
  const header = String(req.headers.authorization || "");
  if (header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  const raw = String(req.headers["x-owner-token"] || "").trim();
  if (raw) return raw;
  try {
    const url = new URL(req.url || "", "http://127.0.0.1");
    return url.searchParams.get("owner")?.trim() || "";
  } catch {
    return "";
  }
}

export function assertOwner(req: Connect.IncomingMessage): { ok: true } | { ok: false; status: number; error: string } {
  if (!ownerConfigured()) {
    return { ok: false, status: 503, error: "站点未配置主人密钥（USERMOON_OWNER_TOKEN），无法管理。" };
  }
  const got = extractOwnerToken(req);
  if (!got || got !== getOwnerToken()) {
    return { ok: false, status: 401, error: "需要主人密钥才能操作。这是个人站点，访客不能绑定或改数据。" };
  }
  return { ok: true };
}
