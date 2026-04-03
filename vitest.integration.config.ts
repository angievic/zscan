import { defineConfig } from "vitest/config";

/** Pruebas contra Ollama local: `ZSCAN_INTEGRATION_OLLAMA=1 npm run test:integration` */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    testTimeout: 120_000,
    hookTimeout: 600_000,
    clearMocks: true,
  },
});
