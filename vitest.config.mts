import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
  resolve: {
    tsconfigPaths: true,
    alias: {
      // server-only melempar error di luar RSC — stub-kan di test
      "server-only": fileURLToPath(
        new URL("./src/lib/testing/server-only-stub.ts", import.meta.url),
      ),
    },
  },
});
