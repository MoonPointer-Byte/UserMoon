import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { launcherApi } from "./server/launcher";

export default defineConfig({
  plugins: [react(), launcherApi()],
  base: "/UserMoon/",
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
});
