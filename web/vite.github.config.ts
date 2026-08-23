import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: resolve(__dirname, "github-src"),
  base: "./",
  publicDir: resolve(__dirname, "public"),
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, "github-dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "github-src", "index.html"),
    },
  },
});
