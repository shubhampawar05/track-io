/**
 * One-time renumbering of board card positions (sortOrder) per project column, keeping the
 * current order. Safe to run repeatedly.
 *
 *   npm run migrate:sort-order -- --dry-run
 *   npm run migrate:sort-order -- --yes
 */
import "dotenv/config";
import mongoose from "mongoose";
import { renumberSortOrders } from "../services/sortOrderMigration.service";
import { confirmMaintenanceTarget } from "./confirmTarget";

const uri = process.env.MONGODB_URI?.trim();
if (!uri) {
  console.error("Missing MONGODB_URI");
  process.exit(1);
}

async function main() {
  const { dryRun } = confirmMaintenanceTarget(uri as string, "migrate:sort-order");
  await mongoose.connect(uri as string);
  const report = await renumberSortOrders({ dryRun });
  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
