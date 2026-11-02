import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** Local-first Studio web host: dashboards and board editor, no network. */
export default defineConfig({
  plugins: [react()],
  server: { port: 5180, strictPort: true },
  preview: { port: 5180, strictPort: true },
});
