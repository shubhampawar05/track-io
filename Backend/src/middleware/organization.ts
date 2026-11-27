import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { fail } from "../types/api";
import { Membership } from "../models/Membership";

const HEADER = "x-organization-id";

export async function requireOrganization(req: Request, res: Response, next: NextFunction) {
  if (!req.userId) {
    res.status(401).json(fail("Unauthorized"));
    return;
  }
  const raw = req.headers[HEADER];
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  if (!idStr || !mongoose.Types.ObjectId.isValid(idStr)) {
    res.status(400).json(fail("Organization required"));
    return;
  }
  const organizationId = new mongoose.Types.ObjectId(idStr);
  const m = await Membership.findOne({
    userId: new mongoose.Types.ObjectId(req.userId),
    organizationId,
  }).lean();
  if (!m) {
    res.status(403).json(fail("Forbidden"));
    return;
  }
  req.organizationId = organizationId;
  req.membershipRole = m.role as "owner" | "admin" | "member";
  next();
}
