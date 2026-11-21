import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // pure helpers only; API, DOM and cookie modules need a browser or a backend
      include: [
        "src/lib/bookings.ts",
        "src/lib/moments.ts",
        "src/lib/session.ts",
        "src/lib/upload-batches.ts",
        "src/lib/utils.ts",
      ],
      reporter: ["text", "json-summary", "json"],
      reportsDirectory: "coverage",
    },
  },
});
