import type { Types } from "mongoose";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      organizationId?: Types.ObjectId;
      membershipRole?: "owner" | "admin" | "member";
    }
  }
}

export {};
