import type { ApiResponse } from "@/lib/api-response";
import { useOrganizationStore } from "@/stores/useOrganizationStore";

const jsonHeaders = { "Content-Type": "application/json" };

function apiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  return "http://localhost:4000";
}

function resolveUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = apiBaseUrl();
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function apiJson<T>(
  path: string,
  init?: Omit<RequestInit, "body"> & { body?: unknown },
): Promise<ApiResponse<T>> {
  const { body, headers, ...rest } = init ?? {};
  const orgId = useOrganizationStore.getState().organizationId;
  const orgHeader =
    typeof orgId === "string" && orgId.length > 0
      ? ({ "X-Organization-Id": orgId } as Record<string, string>)
      : {};
  const res = await fetch(resolveUrl(path), {
    ...rest,
    credentials: "include",
    headers: {
      ...jsonHeaders,
      ...orgHeader,
      ...(headers as Record<string, string>),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const payload = (await res.json()) as ApiResponse<T>;
  return payload;
}

/** Same as `apiJson` but includes HTTP status for callers that must distinguish 401 vs 404. */
export async function apiJsonWithStatus<T>(
  path: string,
  init?: Omit<RequestInit, "body"> & { body?: unknown },
): Promise<{ status: number; payload: ApiResponse<T> }> {
  const { body, headers, ...rest } = init ?? {};
  const orgId = useOrganizationStore.getState().organizationId;
  const orgHeader =
    typeof orgId === "string" && orgId.length > 0
      ? ({ "X-Organization-Id": orgId } as Record<string, string>)
      : {};
  const res = await fetch(resolveUrl(path), {
    ...rest,
    credentials: "include",
    headers: {
      ...jsonHeaders,
      ...orgHeader,
      ...(headers as Record<string, string>),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const payload = (await res.json()) as ApiResponse<T>;
  return { status: res.status, payload };
}

export type UploadResult = { url: string; filename: string; size: number; mimeType: string };

/** Multipart upload to POST /api/uploads (cookie + org header). */
export async function apiUploadFile(file: File): Promise<ApiResponse<UploadResult>> {
  const orgId = useOrganizationStore.getState().organizationId;
  const orgHeader =
    typeof orgId === "string" && orgId.length > 0
      ? ({ "X-Organization-Id": orgId } as Record<string, string>)
      : {};
  const res = await fetch(resolveUrl("/api/uploads"), {
    method: "POST",
    credentials: "include",
    headers: orgHeader,
    body: (() => {
      const fd = new FormData();
      fd.append("file", file);
      return fd;
    })(),
  });
  return (await res.json()) as ApiResponse<UploadResult>;
}

/** Multipart upload helper for custom endpoint paths. */
export async function apiUploadForm<T>(path: string, formData: FormData): Promise<ApiResponse<T>> {
  const orgId = useOrganizationStore.getState().organizationId;
  const orgHeader =
    typeof orgId === "string" && orgId.length > 0
      ? ({ "X-Organization-Id": orgId } as Record<string, string>)
      : {};
  const res = await fetch(resolveUrl(path), {
    method: "POST",
    credentials: "include",
    headers: orgHeader,
    body: formData,
  });
  return (await res.json()) as ApiResponse<T>;
}

export async function apiUploadRecording<T>(file: File, durationMs?: number): Promise<ApiResponse<T>> {
  const form = new FormData();
  form.append("file", file);
  if (typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs > 0) {
    form.append("durationMs", String(Math.round(durationMs)));
  }
  return apiUploadForm<T>("/api/transcriptions/recordings", form);
}

export function apiOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  return "http://localhost:4000";
}
