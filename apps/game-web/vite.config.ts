import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => ({
  plugins: [tsconfigPaths()],
  define: {
    __BUILD_TARGET__: JSON.stringify(mode === "production" ? "local" : mode),
  },
  server: {
    port: 5173,
    host: "0.0.0.0",
  },
  preview: {
    port: 4173,
    host: "0.0.0.0",
  },
  build: {
    sourcemap: mode !== "yandex",
    outDir: "dist",
    // Phaser now lives in a dedicated lazy chunk, so the practical risk is low even though
    // the engine bundle itself remains large.
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll("\\", "/");

          if (normalizedId.includes("/node_modules/phaser/")) {
            return "phaser";
          }

          if (
            normalizedId.includes("/packages/game-core/") ||
            normalizedId.includes("/packages/game-data/")
          ) {
            return "gameplay";
          }

          if (
            normalizedId.includes("/packages/platform-sdk/") ||
            normalizedId.includes("/packages/shared/") ||
            normalizedId.includes("/packages/config/") ||
            normalizedId.includes("/packages/analytics/")
          ) {
            return "platform";
          }

          return undefined;
        },
      },
    },
  },
}));
