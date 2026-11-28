"use client";

import { Suspense, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notFound, useParams, useRouter, useSearchParams } from "next/navigation";
import { IssueDetailView } from "@/components/issues/IssueDetailView";
import { apiJson, apiJsonWithStatus } from "@/lib/api-client";
import type { IssueDetail } from "@/types/issue";
import { useOrganizationStore } from "@/stores/useOrganizationStore";
import { IssueDetailSkeleton } from "@/components/issues/IssueDetailSkeleton";
import { resolveIssueCloseHref } from "@/lib/issue-detail-from";
import { safeDecodeURIComponent } from "@/lib/utils";

async function loadIssueDetail(id: string, orgId: string | null): Promise<IssueDetail> {
  const path = `/api/issues/${encodeURIComponent(id)}`;
  const { status, payload: r } = await apiJsonWithStatus<IssueDetail>(path, { orgId });
  if (!r.success) {
    if (status === 401) throw new Error("UNAUTHORIZED");
    if (status === 404) throw new Error("NOT_FOUND");
    throw new Error("LOAD_FAILED");
  }
  let detail: IssueDetail = { ...r.data, githubLinks: r.data.githubLinks ?? [] };
  if (detail.unread) {
    await apiJson(path, {
      method: "PATCH",
      body: { unread: false },
      orgId,
    });
    const again = await apiJsonWithStatus<IssueDetail>(path, { orgId });
    if (again.payload.success) detail = { ...again.payload.data, githubLinks: again.payload.data.githubLinks ?? [] };
  }
  return detail;
}

export default function IssueDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <IssueDetailSkeleton />
        </div>
      }
    >
      <IssueDetailPageInner />
    </Suspense>
  );
}

function IssueDetailPageInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const closeHref = resolveIssueCloseHref(searchParams);
  const id = typeof params.id === "string" ? safeDecodeURIComponent(params.id) : "";
  const organizationId = useOrganizationStore((s) => s.organizationId);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["issue", organizationId, id],
    enabled: Boolean(organizationId && id),
    queryFn: ({ queryKey }) => loadIssueDetail(id, queryKey[1]),
  });

  useEffect(() => {
    if (!query.isError || !(query.error instanceof Error)) return;
    if (query.error.message !== "UNAUTHORIZED") return;
    router.replace("/");
  }, [query.isError, query.error, router]);

  if (!id) {
    notFound();
  }

  if (query.isError && query.error instanceof Error && query.error.message === "NOT_FOUND") {
    notFound();
  }

  if (!organizationId || !id || query.isLoading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <IssueDetailSkeleton />
      </div>
    );
  }

  if (query.isError) {
    const msg =
      query.error instanceof Error && query.error.message === "UNAUTHORIZED"
        ? "Redirecting to sign in…"
        : "Could not load this issue.";
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-linear-text-muted">
        {msg}
      </div>
    );
  }

  if (!query.data) {
    return null;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <IssueDetailView
        issue={query.data}
        closeHref={closeHref}
        onRefresh={async () => {
          if (organizationId) {
            await queryClient.invalidateQueries({
              queryKey: ["issues", organizationId],
              refetchType: "all",
            });
          }
          await query.refetch();
        }}
      />
    </div>
  );
}
