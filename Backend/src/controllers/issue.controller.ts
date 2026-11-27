import type { Request, Response } from "express";
import { HttpError } from "../middleware/errorHandler";
import * as issueService from "../services/issue.service";
import { fail, ok } from "../types/api";

export async function listAll(req: Request, res: Response) {
  try {
    const query = issueService.parseIssueListQueryParams(req.query as Record<string, unknown>);
    const data = await issueService.listAllIssues(req.organizationId!, req.userId!, query);
    res.json(ok(data));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}

export async function createGlobal(req: Request, res: Response) {
  try {
    const body = req.body as {
      title?: string;
      description?: string;
      status?: string;
      priority?: string;
      label?: string;
      projectSlug?: string | null;
      assigneeId?: string | null;
      dueDate?: string | null;
    };
    const data = await issueService.createIssueGlobal(req.organizationId!, req.userId!, {
      title: String(body.title ?? ""),
      description: body.description,
      status: body.status,
      priority: body.priority,
      label: body.label,
      projectSlug: body.projectSlug ?? null,
      assigneeId: body.assigneeId === null ? null : body.assigneeId,
      dueDate: body.dueDate === null ? null : body.dueDate,
    });
    res.json(ok(data));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}

export async function getOne(req: Request, res: Response) {
  try {
    const issueId = decodeURIComponent(String(req.params.issueId));
    const data = await issueService.getIssueDetail(req.organizationId!, req.userId!, issueId);
    res.json(ok(data));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}

export async function patchOne(req: Request, res: Response) {
  try {
    const issueId = decodeURIComponent(String(req.params.issueId));
    const data = await issueService.patchIssue(req.organizationId!, req.userId!, issueId, req.body as Record<string, unknown>);
    res.json(ok(data));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}

export async function deleteOne(req: Request, res: Response) {
  try {
    const issueId = decodeURIComponent(String(req.params.issueId));
    await issueService.deleteIssue(
      req.organizationId!,
      req.userId!,
      issueId,
      req.membershipRole!,
    );
    res.json(ok({ deleted: true }));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}

export async function postComment(req: Request, res: Response) {
  try {
    const issueId = decodeURIComponent(String(req.params.issueId));
    const body = req.body as { body?: string; attachments?: unknown };
    const data = await issueService.addComment(
      req.organizationId!,
      req.userId!,
      issueId,
      String(body.body ?? ""),
      body.attachments,
    );
    res.json(ok(data));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}

export async function patchComment(req: Request, res: Response) {
  try {
    const issueId = decodeURIComponent(String(req.params.issueId));
    const commentId = decodeURIComponent(String(req.params.commentId));
    const body = req.body as { body?: string };
    const data = await issueService.updateComment(
      req.organizationId!,
      req.userId!,
      issueId,
      commentId,
      String(body.body ?? ""),
    );
    res.json(ok(data));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}

export async function postAttachment(req: Request, res: Response) {
  try {
    const issueId = decodeURIComponent(String(req.params.issueId));
    const body = req.body as { filename?: string; size?: number; mimeType?: string; url?: string };
    const data = await issueService.addAttachment(req.organizationId!, req.userId!, issueId, {
      filename: String(body.filename ?? "upload.bin"),
      size: typeof body.size === "number" ? body.size : 1024,
      mimeType: String(body.mimeType ?? "application/octet-stream"),
      url: typeof body.url === "string" ? body.url : undefined,
    });
    res.json(ok(data));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}

export async function deleteAttachment(req: Request, res: Response) {
  try {
    const issueId = decodeURIComponent(String(req.params.issueId));
    const attachmentId = decodeURIComponent(String(req.params.attachmentId));
    await issueService.removeAttachment(
      req.organizationId!,
      req.userId!,
      issueId,
      attachmentId,
    );
    res.json(ok({ deleted: true }));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}
