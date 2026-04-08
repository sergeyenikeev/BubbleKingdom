import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const alias = {
  "@bubble-kingdom/shared": fileURLToPath(new URL("./packages/shared/src/index.ts", import.meta.url)),
  "@bubble-kingdom/config": fileURLToPath(new URL("./packages/config/src/index.ts", import.meta.url)),
  "@bubble-kingdom/analytics": fileURLToPath(new URL("./packages/analytics/src/index.ts", import.meta.url)),
  "@bubble-kingdom/platform-sdk": fileURLToPath(new URL("./packages/platform-sdk/src/index.ts", import.meta.url)),
  "@bubble-kingdom/game-data": fileURLToPath(new URL("./packages/game-data/src/index.ts", import.meta.url)),
  "@bubble-kingdom/game-core": fileURLToPath(new URL("./packages/game-core/src/index.ts", import.meta.url)),
};

export default defineConfig({
  resolve: {
    alias,
  },
  test: {
    server: {
      deps: {
        inline: [/^@bubble-kingdom\//],
      },
    },
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          globals: true,
          include: [
            "packages/**/tests/unit/**/*.test.ts",
            "services/**/tests/unit/**/*.test.ts",
          ],
          coverage: {
            provider: "v8",
            reporter: ["text", "html"],
            include: ["packages/game-core/src/**/*.ts"],
            thresholds: {
              lines: 80,
              functions: 80,
              branches: 75,
              statements: 80,
            },
          },
        },
      },
      {
        test: {
          name: "integration",
          environment: "jsdom",
          globals: true,
          include: [
            "packages/**/tests/integration/**/*.test.ts",
            "apps/**/tests/**/*.test.ts",
          ],
          setupFiles: ["apps/game-web/tests/setup.ts"],
        },
      },
    ],
  },
});
