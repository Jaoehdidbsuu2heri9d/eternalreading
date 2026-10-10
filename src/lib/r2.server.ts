/** Cloudflare R2 (API S3) — só no servidor. Credenciais vêm de secrets; nunca são devolvidas nem registradas. */
import { AwsClient } from "aws4fetch";

export const R2_ALLOWED_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const R2_FOLDER_RE = /^(covers|banners|works\/[0-9a-f-]{36}\/chapters\/([0-9a-f-]{36}|new)\/pages)$/;
export const R2_KEY_RE = /^(covers|banners|works\/[0-9a-f-]{36}\/chapters\/([0-9a-f-]{36}|new)\/pages)\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

export type R2Config = { client: AwsClient; base: string; maxBytes: number; publicBase: string | null };

/** Lê a configuração; null se faltar algo. `missing` lista só NOMES de variáveis. */
export function r2Config(): { cfg: R2Config | null; missing: string[] } {
  const env = process.env;
  const accountId = env["R2_ACCOUNT_ID"];
  const keyId = env["R2_ACCESS_KEY_ID"];
  const secret = env["R2_SECRET_ACCESS_KEY"];
  const bucket = env["R2_BUCKET_NAME"];
  const missing = [
    !accountId && !env["R2_ENDPOINT"] ? "R2_ACCOUNT_ID" : null,
    !keyId ? "R2_ACCESS_KEY_ID" : null,
    !secret ? "R2_SECRET_ACCESS_KEY" : null,
    !bucket ? "R2_BUCKET_NAME" : null,
  ].filter((v): v is string => !!v);
  if (missing.length) return { cfg: null, missing };
  const endpoint = (env["R2_ENDPOINT"] || `https://${accountId}.r2.cloudflarestorage.com`).replace(/\/+$/, "");
  const mb = Number(env["R2_MAX_UPLOAD_MB"] ?? 10);
  const publicBase = env["R2_PUBLIC_BASE_URL"]?.replace(/\/+$/, "") || null;
  return {
    cfg: {
      client: new AwsClient({ accessKeyId: keyId!, secretAccessKey: secret!, service: "s3", region: "auto" }),
      base: `${endpoint}/${encodeURIComponent(bucket!)}`,
      maxBytes: Math.max(1, Math.min(isFinite(mb) ? mb : 10, 50)) * 1024 * 1024,
      publicBase: publicBase && /^https:\/\//.test(publicBase) ? publicBase : null,
    },
    missing: [],
  };
}

const objUrl = (cfg: R2Config, key: string) => `${cfg.base}/${key.split("/").map(encodeURIComponent).join("/")}`;

/** URL pré-assinada de PUT (10 min) presa ao tipo e tamanho do arquivo. */
export async function presignPut(cfg: R2Config, key: string, contentType: string, size: number) {
  const url = new URL(objUrl(cfg, key));
  url.searchParams.set("X-Amz-Expires", "600");
  const signed = await cfg.client.sign(new Request(url, { method: "PUT", headers: { "Content-Type": contentType, "Content-Length": String(size) } }), {
    aws: { signQuery: true, allHeaders: true },
  });
  return signed.url;
}

export const getObject = (cfg: R2Config, key: string) => cfg.client.fetch(objUrl(cfg, key), { method: "GET" });
export const deleteObject = (cfg: R2Config, key: string) => cfg.client.fetch(objUrl(cfg, key), { method: "DELETE" });
export const putObject = (cfg: R2Config, key: string, body: string) =>
  cfg.client.fetch(objUrl(cfg, key), { method: "PUT", body, headers: { "Content-Type": "text/plain" } });
