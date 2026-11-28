/** MongoDB duplicate-key (unique index) violation, e.g. two concurrent inserts of the same value. */
export function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}
