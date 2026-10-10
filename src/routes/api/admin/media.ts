import { createFileRoute } from "@tanstack/react-router";

const MAX_BYTES = 10 * 1024 * 1024;
const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

async function authorizeAdmin(request: Request) {
  const value = request.headers.get("authorization") ?? "";
  const token = value.startsWith("Bearer ") ? value.slice(7).trim() : "";
  if (!token) return { response: Response.json({ error: "unauthorized" }, { status: 401 }) };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return { response: Response.json({ error: "unauthorized" }, { status: 401 }) };

  const [adminRole, ownerRole] = await Promise.all([
    supabaseAdmin.rpc("has_role", { _user_id: data.user.id, _role: "admin" }),
    supabaseAdmin.rpc("has_role", { _user_id: data.user.id, _role: "owner" }),
  ]);
  if (adminRole.error || ownerRole.error) {
    console.error("[R2 upload] Role check failed");
    return { response: Response.json({ error: "permission_check_failed" }, { status: 500 }) };
  }
  if (!adminRole.data && !ownerRole.data) {
    return { response: Response.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { user: data.user };
}

function matchesImageSignature(bytes: Uint8Array, mime: string) {
  if (mime === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  if (mime === "image/webp") return bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

export const Route = createFileRoute("/api/admin/media")({
  server: {
    handlers: {
      /** Used by the admin upload UI to verify that R2 credentials are present. */
      GET: async ({ request }) => {
        const access = await authorizeAdmin(request);
        if ("response" in access) return access.response;
        const { getR2Config } = await import("@/lib/cloudflare-r2.server");
        const config = getR2Config();
        return Response.json({
          provider: config ? "cloudflare-r2" : "not-configured",
          configured: !!config,
          bucket: config?.bucket ?? null,
          requiredSecrets: config ? [] : [
            "CLOUDFLARE_ACCOUNT_ID",
            "CLOUDFLARE_R2_ACCESS_KEY_ID",
            "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
            "CLOUDFLARE_R2_BUCKET",
          ],
        });
      },
      /** Images are streamed from the browser to the server and then R2; R2 keys never reach the browser. */
      POST: async ({ request }) => {
        const access = await authorizeAdmin(request);
        if ("response" in access) return access.response;

        const contentLength = Number(request.headers.get("content-length") ?? "0");
        if (contentLength > MAX_BYTES + 128 * 1024) {
          return Response.json({ error: "file_too_large", message: "A imagem deve ter no máximo 10 MB." }, { status: 413 });
        }

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return Response.json({ error: "invalid_form_data" }, { status: 400 });
        }

        const file = form.get("file");
        const folderValue = form.get("folder");
        if (!(file instanceof File) || typeof folderValue !== "string") {
          return Response.json({ error: "file_required" }, { status: 400 });
        }
        if (file.size < 1 || file.size > MAX_BYTES) {
          return Response.json({ error: "file_too_large", message: "A imagem deve ter no máximo 10 MB." }, { status: 413 });
        }

        const folder = folderValue.trim();
        const allowedFolder = folder === "covers" || folder === "banners" ||
          /^chapters\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(folder);
        if (!allowedFolder) return Response.json({ error: "invalid_folder" }, { status: 400 });

        const mime = file.type.toLowerCase();
        const ext = MIME_EXT[mime];
        if (!ext) return Response.json({ error: "unsupported_image", message: "Use uma imagem JPG, PNG ou WebP." }, { status: 415 });

        const bytes = new Uint8Array(await file.arrayBuffer());
        if (!matchesImageSignature(bytes, mime)) {
          return Response.json({ error: "invalid_image_signature", message: "O arquivo não parece ser uma imagem válida deste formato." }, { status: 415 });
        }

        const { getR2Config, putR2Object } = await import("@/lib/cloudflare-r2.server");
        if (!getR2Config()) {
          return Response.json({
            error: "cloudflare_r2_not_configured",
            message: "O Cloudflare R2 ainda não está configurado. Adicione as quatro variáveis de ambiente do R2 no Lovable e tente novamente.",
          }, { status: 503 });
        }

        const key = `${folder}/${crypto.randomUUID()}.${ext}`;
        try {
          await putR2Object(key, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), mime);
        } catch (error) {
          const message = (error as Error)?.message;
          console.error("[R2 upload] Failed:", message ?? "unknown");
          return Response.json({
            error: message === "cloudflare_r2_not_configured" ? "cloudflare_r2_not_configured" : "cloudflare_r2_upload_failed",
            message: "Não foi possível enviar ao Cloudflare R2. Confira as credenciais e permissões do bucket.",
          }, { status: message === "cloudflare_r2_not_configured" ? 503 : 502 });
        }

        return Response.json({ ok: true, provider: "cloudflare-r2", path: key, url: `/api/public/media/${key}` }, { status: 201 });
      },
    },
  },
});
