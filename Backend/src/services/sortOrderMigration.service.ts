import mongoose from "mongoose";
import { Issue } from "../models/Issue";

/** Gap between consecutive cards after renumbering; leaves room for many midpoint moves. */
export const SORT_ORDER_GAP = 1000;

export type SortOrderReport = { columns: number; issues: number; updated: number };

/**
 * Renumbers `sortOrder` per (project, status) column to 1000, 2000, 3000, ... keeping the
 * current visible order (sortOrder, then issue number). Fixes columns where many cards share
 * the same value (old data), so midpoint drag-and-drop can place cards precisely again.
 * Idempotent; only documents whose value changes are written.
 */
export async function renumberSortOrders(options: { dryRun?: boolean }): Promise<SortOrderReport> {
  const rows = await Issue.find({}).select("projectId status sortOrder number").sort({ projectId: 1, status: 1, sortOrder: 1, number: 1 }).lean();
  const report: SortOrderReport = { columns: 0, issues: rows.length, updated: 0 };
  const ops: mongoose.AnyBulkWriteOperation[] = [];
  let columnKey = "";
  let index = 0;
  for (const row of rows) {
    const key = `${row.projectId.toString()}:${row.status}`;
    if (key !== columnKey) {
      columnKey = key;
      index = 0;
      report.columns += 1;
    }
    index += 1;
    const target = index * SORT_ORDER_GAP;
    if (row.sortOrder !== target) {
      report.updated += 1;
      ops.push({ updateOne: { filter: { _id: row._id }, update: { $set: { sortOrder: target } } } });
    }
  }
  if (!options.dryRun && ops.length > 0) {
    for (let i = 0; i < ops.length; i += 500) await Issue.bulkWrite(ops.slice(i, i + 500), { ordered: false });
  }
  return report;
}
