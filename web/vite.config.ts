import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Relative base: the site is served from a sub-path on GitHub Pages (/TailorUrResume/).
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  server: { port: 5174 },
});
