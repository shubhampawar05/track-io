import type { Request, Response } from "express";
import { HttpError } from "../middleware/errorHandler";
import * as projectService from "../services/project.service";
import * as issueService from "../services/issue.service";
import { fail, ok } from "../types/api";
import { bodyObject, nullableString, optionalString } from "../utils/bodyFields";
import { parseAndValidateBoardColumns } from "../utils/boardColumns";

export async function list(req: Request, res: Response) {
  try {
    const data = await projectService.listProjects(req.organizationId!, req.userId!);
    res.json(ok(data));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}

export async function create(req: Request, res: Response) {
  try {
    const body = req.body as { name?: string };
    const data = await projectService.createProject(req.organizationId!, req.userId!, String(body.name ?? ""));
    res.json(ok(data));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}

export async function getBySlug(req: Request, res: Response) {
  try {
    const slug = decodeURIComponent(String(req.params.slug));
    const data = await projectService.getProjectBySlug(req.organizationId!, req.userId!, slug);
    res.json(ok(data));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}

/** PATCH project: boardColumns and/or githubRepoFullName (owner/admin for both). */
export async function patchBySlug(req: Request, res: Response) {
  try {
    const slug = decodeURIComponent(String(req.params.slug));
    const body = req.body as {
      boardColumns?: unknown;
      githubRepoFullName?: string | null;
    };
    if (!body || typeof body !== "object") {
      res.status(400).json(fail("Invalid input"));
      return;
    }

    const hasBoardColumns = "boardColumns" in body;
    const hasGithubRepo = "githubRepoFullName" in body;
    if (!hasBoardColumns && !hasGithubRepo) {
      res.status(400).json(fail("No valid fields"));
      return;
    }

    let data = null;
    if (hasBoardColumns) {
      const boardColumns = parseAndValidateBoardColumns(body.boardColumns);
      data = await projectService.patchProjectBoardColumns(
        req.organizationId!,
        req.userId!,
        req.membershipRole!,
        slug,
        boardColumns,
      );
    }
    if (hasGithubRepo) {
      data = await projectService.patchProjectGithubRepo(
        req.organizationId!,
        req.userId!,
        req.membershipRole!,
        slug,
        body.githubRepoFullName,
      );
    }
    res.json(ok(data));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}

export async function listIssues(req: Request, res: Response) {
  try {
    const slug = decodeURIComponent(String(req.params.slug));
    const query = issueService.parseIssueListQueryParams(req.query as Record<string, unknown>);
    const data = await issueService.listProjectIssues(req.organizationId!, req.userId!, slug, query);
    res.json(ok(data));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}

export async function createIssue(req: Request, res: Response) {
  try {
    const slug = decodeURIComponent(String(req.params.slug));
    const body = bodyObject(req.body);
    const data = await issueService.createIssueUnderProject(req.organizationId!, req.userId!, slug, {
      title: optionalString(body, "title") ?? "",
      description: optionalString(body, "description"),
      status: optionalString(body, "status"),
      priority: optionalString(body, "priority"),
      label: optionalString(body, "label"),
      assigneeId: nullableString(body, "assigneeId"),
      dueDate: nullableString(body, "dueDate"),
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

export async function patchIssue(req: Request, res: Response) {
  try {
    const slug = decodeURIComponent(String(req.params.slug));
    const issueId = decodeURIComponent(String(req.params.issueId));
    const data = await issueService.patchIssueUnderProject(
      req.organizationId!,
      req.userId!,
      slug,
      issueId,
      req.body as Record<string, unknown>,
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
