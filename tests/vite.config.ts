import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  root: process.cwd(),
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  server: { host: "127.0.0.1", port: 8080, strictPort: true },
});
