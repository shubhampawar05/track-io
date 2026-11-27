"use client";

import { useCallback, useRef } from "react";
import { IssueDetailActivity } from "@/components/issues/detail/IssueDetailActivity";
import { IssueDetailAttachments } from "@/components/issues/detail/IssueDetailAttachments";
import {
  IssueDetailEditor,
  type IssueDetailEditorHandle,
} from "@/components/issues/detail/IssueDetailEditor";
import { IssueDetailSubtasks } from "@/components/issues/detail/IssueDetailSubtasks";
import type { IssueDetail } from "@/types/issue";

export function IssueDetailView({
  issue,
  onRefresh,
  closeHref,
}: {
  issue: IssueDetail;
  onRefresh: () => Promise<void>;
  closeHref: string;
}) {
  const editorRef = useRef<IssueDetailEditorHandle>(null);

  const onUpdateIssue = useCallback(async () => {
    await editorRef.current?.flushAll();
    await onRefresh();
  }, [onRefresh]);

  return (
    <IssueDetailEditor
      ref={editorRef}
      key={issue.id}
      issue={issue}
      closeHref={closeHref}
      onRefresh={onRefresh}
      onUpdateIssue={onUpdateIssue}
    >
      <IssueDetailSubtasks issue={issue} onRefresh={onRefresh} />
      <IssueDetailAttachments issue={issue} onRefresh={onRefresh} />
      <IssueDetailActivity issue={issue} onRefresh={onRefresh} />
    </IssueDetailEditor>
  );
}
