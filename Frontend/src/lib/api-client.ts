import { fail, type ApiResponse } from "@/lib/api-response";
import { useOrganizationStore } from "@/stores/useOrganizationStore";

const jsonHeaders = { "Content-Type": "application/json" };

/**
 * Called whenever the API answers 401 (session expired or revoked, e.g. logout on another device).
 * Registered by the auth store so this module does not import it (avoids a circular import).
 */
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

function noteStatus(status: number): void {
  if (status === 401) unauthorizedHandler?.();
}

const NETWORK_ERROR_MESSAGE = "Network error — check your connection";

/** `fetch` that never rejects: network failures resolve to `null`. */
async function safeFetch(url: string, init: RequestInit): Promise<Response | null> {
  try {
    return await fetch(url, init);
  } catch {
    return null;
  }
}

/**
 * Parse an API envelope, tolerating non-JSON bodies (HTML error pages, empty bodies) by
 * returning a failed `ApiResponse` instead of throwing.
 */
async function readPayload<T>(res: Response): Promise<ApiResponse<T>> {
  try {
    const payload = (await res.json()) as unknown;
    if (payload && typeof payload === "object" && "success" in payload) {
      return payload as ApiResponse<T>;
    }
  } catch {
    // fall through
  }
  return fail(`Unexpected server response (HTTP ${res.status})`);
}

/** Backend origin (no trailing slash); also used to absolutize API-relative upload URLs. */
export function apiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  return "http://localhost:4000";
}

function resolveUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = apiBaseUrl();
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export type ApiJsonInit = Omit<RequestInit, "body"> & {
  body?: unknown;
  /**
   * Organization to scope the request to. When provided (including `null`), overrides the
   * active organization from the store — org-scoped queries pass the id from their query key
   * so a workspace switch can never cache org B's data under org A's key.
   */
  orgId?: string | null;
};

function organizationHeader(explicit?: string | null): Record<string, string> {
  const orgId =
    explicit !== undefined ? explicit : useOrganizationStore.getState().organizationId;
  return typeof orgId === "string" && orgId.length > 0 ? { "X-Organization-Id": orgId } : {};
}

export async function apiJson<T>(
  path: string,
  init?: ApiJsonInit,
): Promise<ApiResponse<T>> {
  const { body, headers, orgId, ...rest } = init ?? {};
  const orgHeader = organizationHeader(orgId);
  const res = await safeFetch(resolveUrl(path), {
    ...rest,
    credentials: "include",
    headers: {
      ...jsonHeaders,
      ...orgHeader,
      ...(headers as Record<string, string>),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res) return fail(NETWORK_ERROR_MESSAGE);
  noteStatus(res.status);
  return readPayload<T>(res);
}

/** Same as `apiJson` but includes HTTP status for callers that must distinguish 401 vs 404. */
export async function apiJsonWithStatus<T>(
  path: string,
  init?: ApiJsonInit,
): Promise<{ status: number; payload: ApiResponse<T> }> {
  const { body, headers, orgId, ...rest } = init ?? {};
  const orgHeader = organizationHeader(orgId);
  const res = await safeFetch(resolveUrl(path), {
    ...rest,
    credentials: "include",
    headers: {
      ...jsonHeaders,
      ...orgHeader,
      ...(headers as Record<string, string>),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res) return { status: 0, payload: fail(NETWORK_ERROR_MESSAGE) };
  noteStatus(res.status);
  const payload = await readPayload<T>(res);
  return { status: res.status, payload };
}

export type UploadResult = { url: string; filename: string; size: number; mimeType: string };

/** Multipart upload to POST /api/uploads (cookie + org header). */
export async function apiUploadFile(file: File): Promise<ApiResponse<UploadResult>> {
  const orgHeader = organizationHeader();
  const res = await safeFetch(resolveUrl("/api/uploads"), {
    method: "POST",
    credentials: "include",
    headers: orgHeader,
    body: (() => {
      const fd = new FormData();
      fd.append("file", file);
      return fd;
    })(),
  });
  if (!res) return fail(NETWORK_ERROR_MESSAGE);
  noteStatus(res.status);
  return readPayload<UploadResult>(res);
}

/** Multipart upload helper for custom endpoint paths. */
export async function apiUploadForm<T>(path: string, formData: FormData): Promise<ApiResponse<T>> {
  const orgHeader = organizationHeader();
  const res = await safeFetch(resolveUrl(path), {
    method: "POST",
    credentials: "include",
    headers: orgHeader,
    body: formData,
  });
  if (!res) return fail(NETWORK_ERROR_MESSAGE);
  noteStatus(res.status);
  return readPayload<T>(res);
}

export async function apiUploadRecording<T>(file: File, durationMs?: number): Promise<ApiResponse<T>> {
  const form = new FormData();
  form.append("file", file);
  if (typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs > 0) {
    form.append("durationMs", String(Math.round(durationMs)));
  }
  return apiUploadForm<T>("/api/transcriptions/recordings", form);
}

