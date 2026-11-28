import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/globalSetup.ts"],
    setupFiles: ["tests/setupEnv.ts"],
    // Each file gets its own database and module graph; run them one at a time so the
    // in-memory MongoDB and per-process rate-limit buckets stay predictable.
    fileParallelism: false,
    testTimeout: 30_000,
    // Drop request-log lines and console "emails" (no SMTP in tests); keep everything else.
    onConsoleLog(log) {
      if (/^\[\d{4}-\d{2}-\d{2} [\d:]+\] [A-Z]+ \//.test(log)) return false;
      if (log.includes("[mail] (no SMTP)") || log.includes("— Trackio")) return false;
      return undefined;
    },
    hookTimeout: 120_000,
  },
});
