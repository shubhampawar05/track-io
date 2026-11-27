import type { Request, Response } from "express";
import { HttpError } from "../middleware/errorHandler";
import * as inviteService from "../services/invite.service";
import * as organizationService from "../services/organization.service";
import { fail, ok } from "../types/api";
import type { BoardColumnDto } from "../utils/boardColumns";
import { parseAndValidateBoardColumns } from "../utils/boardColumns";

export async function listMembers(req: Request, res: Response) {
  try {
    const data = await organizationService.listMembers(req.organizationId!);
    res.json(ok(data));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}

export async function getIssuesBoardColumns(req: Request, res: Response) {
  try {
    const data = await organizationService.getIssuesBoardColumns(
      req.organizationId!,
      req.userId!,
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

export async function patchOrganization(req: Request, res: Response) {
  try {
    const body = req.body as { name?: string; issuesBoardColumns?: unknown | null };
    const orgId = req.organizationId!;
    const role = req.membershipRole!;
    const userId = req.userId!;

    let nameResult: { id: string; name: string } | null = null;
    let columnsResult: { columns: BoardColumnDto[] } | null = null;

    if ("issuesBoardColumns" in body) {
      const raw = body.issuesBoardColumns;
      if (raw === null) {
        columnsResult = await organizationService.updateOrganizationIssuesBoardColumns(
          orgId,
          role,
          userId,
          null,
        );
      } else if (Array.isArray(raw)) {
        const cols = parseAndValidateBoardColumns(raw);
        columnsResult = await organizationService.updateOrganizationIssuesBoardColumns(
          orgId,
          role,
          userId,
          cols,
        );
      } else if (raw !== undefined) {
        res.status(400).json(fail("Invalid issuesBoardColumns"));
        return;
      }
    }

    if (typeof body.name === "string" && body.name.trim() !== "") {
      nameResult = await organizationService.updateOrganizationName(orgId, role, body.name.trim());
    }

    if (!nameResult && !columnsResult) {
      res.status(400).json(fail("No valid fields"));
      return;
    }
    if (nameResult && columnsResult) {
      res.json(ok({ ...nameResult, ...columnsResult }));
      return;
    }
    res.json(ok(nameResult ?? columnsResult));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}

export async function createInvite(req: Request, res: Response) {
  try {
    const body = req.body as { email?: string; role?: string };
    const role = body.role === "admin" ? "admin" : "member";
    const data = await inviteService.createAndSendInvite({
      organizationId: req.organizationId!,
      inviterUserId: req.userId!,
      membershipRole: req.membershipRole!,
      emailRaw: String(body.email ?? ""),
      role,
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

export async function listInvites(req: Request, res: Response) {
  try {
    const data = await inviteService.listInvitesForOrganization({
      organizationId: req.organizationId!,
      membershipRole: req.membershipRole!,
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

export async function cancelInvite(req: Request, res: Response) {
  try {
    const raw = req.params.inviteId;
    const inviteId = typeof raw === "string" ? raw : "";
    await inviteService.cancelInviteById({
      organizationId: req.organizationId!,
      membershipRole: req.membershipRole!,
      inviteId,
    });
    res.json(ok(true));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}

export async function postGithubWebhookSetup(req: Request, res: Response) {
  try {
    const data = await organizationService.setupGithubWebhookCredentials(req.organizationId!, req.userId!);
    res.json(ok(data));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}