// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Public (publishable) backend values. Used only when the build has no .env,
// so published builds never ship without a backend connection. Not secrets.
const PUBLIC_URL = "https://c--71ea1b67-94a5-4ed1-98d3-fcf85f2249e7-prod.lovable.cloud";
const PUBLIC_KEY = "sb_publishable_FZ2-oLPHlQsuJc_ekqkvkQ_uCQysDBp";

const define: Record<string, string> = {};
if (!process.env["VITE_SUPABASE_URL"]) {
  process.env["VITE_SUPABASE_URL"] = PUBLIC_URL;
  define["import.meta.env.VITE_SUPABASE_URL"] = JSON.stringify(PUBLIC_URL);
}
if (!process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]) {
  process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] = PUBLIC_KEY;
  define["import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY"] = JSON.stringify(PUBLIC_KEY);
}
process.env["SUPABASE_URL"] ??= process.env["VITE_SUPABASE_URL"];
process.env["SUPABASE_PUBLISHABLE_KEY"] ??= process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: { define },
});
