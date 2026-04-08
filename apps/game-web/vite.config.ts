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
    chunkSizeWarningLimit: 1200,
  },
}));
