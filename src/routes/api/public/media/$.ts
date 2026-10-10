import { createFileRoute } from "@tanstack/react-router";

/**
 * Entrega imagens de obras através do domínio do site.
 * Novos arquivos vêm do Cloudflare R2 privado; arquivos antigos continuam no Supabase.
 */
export const Route = createFileRoute("/api/public/media/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = (params as { _splat?: string })._splat ?? "";
        if (!/^[a-zA-Z0-9/_.-]+\.(jpg|jpeg|png|webp)$/i.test(path) || path.includes("..")) {
          return new Response("Not found", { status: 404 });
        }

        // Read from R2 first. Old uploads remain available from Supabase during the transition.
        try {
          const { getR2Object } = await import("@/lib/cloudflare-r2.server");
          const object = await getR2Object(path);
          if (object) {
            return new Response(object.body, {
              headers: {
                "Content-Type": object.contentType,
                "Cache-Control": "public, max-age=31536000, immutable",
                "X-Storage-Provider": "cloudflare-r2",
                "X-Content-Type-Options": "nosniff",
              },
            });
          }
        } catch (error) {
          console.error("[Media] R2 read failed; attempting legacy media store:", (error as Error)?.message ?? "unknown");
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("manga-media").download(path);
        if (error || !data) return new Response("Not found", { status: 404 });
        return new Response(data, {
          headers: {
            "Content-Type": data.type || "image/jpeg",
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-Storage-Provider": "supabase-legacy",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});
