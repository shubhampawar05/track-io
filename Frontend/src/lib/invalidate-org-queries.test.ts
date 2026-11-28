import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";
import { switchActiveOrganization } from "@/lib/invalidate-org-queries";
import { useOrganizationStore } from "@/stores/useOrganizationStore";

describe("switchActiveOrganization", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    useOrganizationStore.setState({ organizationId: "org-a" });
  });

  it("drops org-scoped queries of the old org, keeps the new org's and unscoped ones, and updates the store", async () => {
    queryClient.setQueryData(["projects", "org-a"], ["old project"]);
    queryClient.setQueryData(["issues", "org-a", { status: "todo" }], ["old issue"]);
    queryClient.setQueryData(["projects", "org-b"], ["new project"]);
    queryClient.setQueryData(["issue", "org-b", "TRK-1"], { id: "TRK-1" });
    queryClient.setQueryData(["me"], { id: "user-1" });

    await switchActiveOrganization(queryClient, "org-b");

    expect(queryClient.getQueryData(["projects", "org-a"])).toBeUndefined();
    expect(queryClient.getQueryData(["issues", "org-a", { status: "todo" }])).toBeUndefined();
    expect(queryClient.getQueryData(["projects", "org-b"])).toEqual(["new project"]);
    expect(queryClient.getQueryData(["issue", "org-b", "TRK-1"])).toEqual({ id: "TRK-1" });
    expect(queryClient.getQueryData(["me"])).toEqual({ id: "user-1" });
    expect(useOrganizationStore.getState().organizationId).toBe("org-b");
  });

  it("marks the kept org-scoped queries stale so they refetch", async () => {
    queryClient.setQueryData(["projects", "org-b"], ["new project"]);
    await switchActiveOrganization(queryClient, "org-b");
    expect(queryClient.getQueryState(["projects", "org-b"])?.isInvalidated).toBe(true);
  });
});
