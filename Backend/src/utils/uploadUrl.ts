import mongoose from "mongoose";
import { env } from "../config/env";

const FILE_ID_SEGMENT = /^[a-f0-9]{24}$/i;

export function publicApiBase(): string {
  const fromEnv = env.API_PUBLIC_URL?.replace(/\/$/, "") ?? "";
  if (fromEnv) return fromEnv;
  return `http://localhost:${env.PORT}`;
}

function pathnameIsTrustedAttachment(pathname: string): boolean {
  if (!pathname.startsWith("/api/uploads/files/")) return false;
  const id = pathname.slice("/api/uploads/files/".length);
  return FILE_ID_SEGMENT.test(id) && !id.includes("/");
}

/** Only allow attachment URLs served by this API (GridFS download route). */
export function isTrustedUploadUrl(url: string): boolean {
  const t = url.trim();
  if (!t || t.includes("..") || t.includes("\n")) return false;
  if (t.startsWith("/")) {
    return pathnameIsTrustedAttachment(t);
  }
  try {
    const base = new URL(publicApiBase());
    const u = new URL(t);
    return u.origin === base.origin && pathnameIsTrustedAttachment(u.pathname);
  } catch {
    return false;
  }
}

export function attachmentGridFsIdFromTrustedUrl(url: string): mongoose.Types.ObjectId | null {
  const t = url.trim();
  let pathname = "";
  if (t.startsWith("/")) {
    if (!pathnameIsTrustedAttachment(t)) return null;
    pathname = t;
  } else {
    try {
      const base = new URL(publicApiBase());
      const u = new URL(t);
      if (u.origin !== base.origin) return null;
      if (!pathnameIsTrustedAttachment(u.pathname)) return null;
      pathname = u.pathname;
    } catch {
      return null;
    }
  }
  const idStr = pathname.slice("/api/uploads/files/".length);
  if (!mongoose.Types.ObjectId.isValid(idStr)) return null;
  return new mongoose.Types.ObjectId(idStr);
}
