import { create } from "zustand";
import { apiJson, setUnauthorizedHandler } from "@/lib/api-client";
import { clearPipelineFilters } from "@/hooks/useIssuesList";
import { readLastOrganizationId } from "@/lib/last-organization";
import { useOrganizationStore } from "@/stores/useOrganizationStore";
import { useRecordingSessionStore } from "@/stores/useRecordingSessionStore";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  initials: string;
}

export interface AuthOrganization {
  id: string;
  name: string;
  role: string;
}

export interface AuthMeResponse extends AuthUser {
  organizations: AuthOrganization[];
  currentOrganizationId: string | null;
}

interface HydrateOptions {
  /** Re-fetch session (e.g. after org rename). Default hydrate runs once per page load. */
  force?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  /** Org list from last /api/auth/me (or login/register); used for role-based UI. */
  organizations: AuthOrganization[];
  hydrated: boolean;
  hydrate: (options?: HydrateOptions) => Promise<void>;
  /** Updates display name and initials; refreshes org list from server. */
  patchProfile: (name: string) => Promise<string | null>;
  login: (email: string, password: string) => Promise<string | null>;
  register: (name: string, email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

function applyMe(me: AuthMeResponse) {
  const valid = new Set((me.organizations ?? []).map((o) => o.id));
  const stored = readLastOrganizationId(me.id);
  const next =
    stored && valid.has(stored) ? stored : (me.currentOrganizationId ?? null);
  useOrganizationStore.getState().setOrganizationId(next);
}

let hydratePromise: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set, get) => {
  const applyAuthMe = (me: AuthMeResponse) => {
    applyMe(me);
    set({
      user: {
        id: me.id,
        email: me.email,
        name: me.name,
        initials: me.initials,
      },
      organizations: me.organizations ?? [],
      hydrated: true,
    });
  };

  return {
  user: null,
  organizations: [],
  hydrated: false,
  hydrate: async (options) => {
    const force = options?.force === true;
    if (!force && get().hydrated) return;
    if (!force && hydratePromise) return hydratePromise;

    hydratePromise = (async () => {
      try {
        const r = await apiJson<AuthMeResponse>("/api/auth/me");
        if (!force && get().hydrated) return;
        if (r.success) {
          applyAuthMe(r.data);
          return;
        }
        if (!get().user) {
          useOrganizationStore.getState().setOrganizationId(null);
          set({ user: null, organizations: [], hydrated: true });
        } else {
          set({ hydrated: true });
        }
      } catch {
        if (!get().user) {
          useOrganizationStore.getState().setOrganizationId(null);
          set({ user: null, organizations: [], hydrated: true });
        } else {
          set({ hydrated: true });
        }
      } finally {
        hydratePromise = null;
      }
    })();

    return hydratePromise;
  },
  patchProfile: async (name) => {
    const r = await apiJson<AuthMeResponse>("/api/auth/me", {
      method: "PATCH",
      body: { name },
    });
    if (!r.success) return r.error;
    applyAuthMe(r.data);
    return null;
  },
  login: async (email, password) => {
    const r = await apiJson<AuthMeResponse>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    if (!r.success) return r.error;
    applyAuthMe(r.data);
    return null;
  },
  register: async (name, email, password) => {
    const r = await apiJson<AuthMeResponse>("/api/auth/register", {
      method: "POST",
      body: { name, email, password },
    });
    if (!r.success) return r.error;
    applyAuthMe(r.data);
    return null;
  },
  /** Always clears local session state, even if the server call fails. Callers clear the query cache. */
  logout: async () => {
    useRecordingSessionStore.getState().discardSession();
    try {
      await apiJson("/api/auth/logout", { method: "POST" });
    } finally {
      useOrganizationStore.getState().setOrganizationId(null);
      clearPipelineFilters();
      set({ user: null, organizations: [], hydrated: true });
    }
  },
};
});

/**
 * A 401 while signed in means the session expired or was revoked (logout / password reset on
 * another device). Do a full navigation to the sign-in page: it drops every in-memory cache
 * (queries, filters, recording session) so nothing from this session leaks to the next user.
 */
let redirectingForExpiredSession = false;
setUnauthorizedHandler(() => {
  if (typeof window === "undefined" || redirectingForExpiredSession) return;
  if (!useAuthStore.getState().user) return;
  redirectingForExpiredSession = true;
  const here = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/?next=${encodeURIComponent(here)}`);
});
