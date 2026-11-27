import type { Request, Response } from "express";
import { HttpError } from "../middleware/errorHandler";
import * as sprintService from "../services/sprint.service";
import { fail, ok } from "../types/api";

export async function getActive(req: Request, res: Response) {
  try {
    const data = await sprintService.getActiveSprint(req.organizationId!);
    res.json(ok(data));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json(fail(e.message));
      return;
    }
    res.status(500).json(fail("Something went wrong"));
  }
}
