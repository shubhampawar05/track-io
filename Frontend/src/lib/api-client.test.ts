import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiJson, apiJsonWithStatus, setUnauthorizedHandler } from "@/lib/api-client";
import { useOrganizationStore } from "@/stores/useOrganizationStore";

const NETWORK_ERROR = "Network error — check your connection";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stubFetch(impl: (...args: Parameters<typeof fetch>) => Promise<Response>) {
  const mock = vi.fn(impl);
  vi.stubGlobal("fetch", mock);
  return mock;
}

function sentHeaders(mock: ReturnType<typeof stubFetch>, call = 0): Record<string, string> {
  const init = mock.mock.calls[call][1];
  return (init?.headers ?? {}) as Record<string, string>;
}

beforeEach(() => {
  useOrganizationStore.setState({ organizationId: null });
});

afterEach(() => {
  setUnauthorizedHandler(null);
});

describe("apiJson", () => {
  it("returns the API envelope on success and sends JSON with credentials", async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ success: true, data: { id: 1 }, error: null }));
    const res = await apiJson<{ id: number }>("/api/things", { method: "POST", body: { a: 1 } });
    expect(res).toEqual({ success: true, data: { id: 1 }, error: null });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/things$/);
    expect(init?.credentials).toBe("include");
    expect(init?.body).toBe(JSON.stringify({ a: 1 }));
    expect(sentHeaders(fetchMock)["Content-Type"]).toBe("application/json");
  });

  it("resolves to a failure with the network message when fetch rejects (never throws)", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(apiJson("/api/things")).resolves.toEqual({
      success: false,
      data: null,
      error: NETWORK_ERROR,
    });
  });

  it("returns a failure for a non-JSON body instead of throwing", async () => {
    stubFetch(async () => new Response("<html>Bad Gateway</html>", { status: 502 }));
    await expect(apiJson("/api/things")).resolves.toEqual({
      success: false,
      data: null,
      error: "Unexpected server response (HTTP 502)",
    });
  });

  it("returns a failure for JSON that is not an API envelope", async () => {
    stubFetch(async () => jsonResponse({ hello: "world" }, 200));
    const res = await apiJson("/api/things");
    expect(res).toEqual({ success: false, data: null, error: "Unexpected server response (HTTP 200)" });
  });

  it("calls the registered unauthorized handler on 401", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    stubFetch(async () => jsonResponse({ success: false, data: null, error: "Unauthorized" }, 401));
    const res = await apiJson("/api/me");
    expect(handler).toHaveBeenCalledTimes(1);
    expect(res.success).toBe(false);
  });

  it("does not call the unauthorized handler for other statuses", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    stubFetch(async () => jsonResponse({ success: false, data: null, error: "Forbidden" }, 403));
    await apiJson("/api/me");
    expect(handler).not.toHaveBeenCalled();
  });

  it("sends X-Organization-Id from the organization store", async () => {
    useOrganizationStore.setState({ organizationId: "org-store" });
    const fetchMock = stubFetch(async () => jsonResponse({ success: true, data: null, error: null }));
    await apiJson("/api/projects");
    expect(sentHeaders(fetchMock)["X-Organization-Id"]).toBe("org-store");
  });

  it("omits X-Organization-Id when no organization is active", async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ success: true, data: null, error: null }));
    await apiJson("/api/projects");
    expect(sentHeaders(fetchMock)).not.toHaveProperty("X-Organization-Id");
  });

  it("lets the orgId option override the store, including null to omit the header", async () => {
    useOrganizationStore.setState({ organizationId: "org-store" });
    const fetchMock = stubFetch(async () => jsonResponse({ success: true, data: null, error: null }));
    await apiJson("/api/projects", { orgId: "org-explicit" });
    await apiJson("/api/projects", { orgId: null });
    expect(sentHeaders(fetchMock, 0)["X-Organization-Id"]).toBe("org-explicit");
    expect(sentHeaders(fetchMock, 1)).not.toHaveProperty("X-Organization-Id");
  });
});

describe("apiJsonWithStatus", () => {
  it("returns status 0 and the network message when fetch rejects", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(apiJsonWithStatus("/api/things")).resolves.toEqual({
      status: 0,
      payload: { success: false, data: null, error: NETWORK_ERROR },
    });
  });

  it("returns the HTTP status alongside the payload", async () => {
    stubFetch(async () => jsonResponse({ success: false, data: null, error: "Not found" }, 404));
    await expect(apiJsonWithStatus("/api/things/1")).resolves.toEqual({
      status: 404,
      payload: { success: false, data: null, error: "Not found" },
    });
  });

  it("calls the unauthorized handler on 401", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    stubFetch(async () => new Response("", { status: 401 }));
    const { status, payload } = await apiJsonWithStatus("/api/me");
    expect(status).toBe(401);
    expect(payload).toEqual({ success: false, data: null, error: "Unexpected server response (HTTP 401)" });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
