/** Cloudflare R2 (API S3) — só no servidor. Aceita nomes CLOUDFLARE_* (documentados) ou R2_*. Nunca devolve valores. */
import { AwsClient } from "aws4fetch";

export const R2_PREFIX = "r2/";
export type R2Config = { client: AwsClient; base: string; bucket: string; maxBytes: number };

const pick = (...names: string[]) => names.map((n) => process.env[n]?.trim() ?? "").find(Boolean) ?? "";

export function r2Config(): { cfg: R2Config | null; missing: string[] } {
  const accountId = pick("CLOUDFLARE_ACCOUNT_ID", "R2_ACCOUNT_ID");
  const keyId = pick("CLOUDFLARE_R2_ACCESS_KEY_ID", "R2_ACCESS_KEY_ID");
  const secret = pick("CLOUDFLARE_R2_SECRET_ACCESS_KEY", "R2_SECRET_ACCESS_KEY");
  const bucket = pick("CLOUDFLARE_R2_BUCKET", "R2_BUCKET_NAME");
  const endpointEnv = pick("CLOUDFLARE_R2_ENDPOINT", "R2_ENDPOINT");
  const missing = [
    !accountId && !endpointEnv ? "CLOUDFLARE_ACCOUNT_ID" : null,
    !keyId ? "CLOUDFLARE_R2_ACCESS_KEY_ID" : null,
    !secret ? "CLOUDFLARE_R2_SECRET_ACCESS_KEY" : null,
    !bucket ? "CLOUDFLARE_R2_BUCKET" : null,
  ].filter((v): v is string => !!v);
  if (missing.length) return { cfg: null, missing };
  if (!/^[a-z0-9-]{3,63}$/.test(bucket) || (!endpointEnv && !/^[a-f0-9]{32}$/i.test(accountId))) return { cfg: null, missing: ["formato inválido do Account ID ou bucket"] };
  const endpoint = (endpointEnv || `https://${accountId}.r2.cloudflarestorage.com`).replace(/\/+$/, "");
  if (!/^https:\/\//.test(endpoint)) return { cfg: null, missing: ["endpoint deve usar https"] };
  const mb = Number(pick("CLOUDFLARE_R2_MAX_UPLOAD_MB", "R2_MAX_UPLOAD_MB") || 10);
  return {
    cfg: {
      client: new AwsClient({ accessKeyId: keyId, secretAccessKey: secret, service: "s3", region: "auto", retries: 2 }),
      base: `${endpoint}/${bucket}`, bucket,
      maxBytes: Math.max(1, Math.min(Number.isFinite(mb) ? mb : 10, 50)) * 1024 * 1024,
    },
    missing: [],
  };
}

const url = (cfg: R2Config, key: string) => `${cfg.base}/${key}`;
export const r2Get = (cfg: R2Config, key: string) => cfg.client.fetch(url(cfg, key), { method: "GET" });
export const r2Delete = (cfg: R2Config, key: string) => cfg.client.fetch(url(cfg, key), { method: "DELETE" });
export const r2Put = (cfg: R2Config, key: string, body: ArrayBuffer | string, type: string) =>
  cfg.client.fetch(url(cfg, key), { method: "PUT", body, headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" } });

/** Teste real: grava e apaga um objeto pequeno. */
export async function r2Probe(cfg: R2Config): Promise<{ ok: boolean; status: number | null }> {
  const key = `${R2_PREFIX}_diagnostics/${crypto.randomUUID()}.txt`;
  try {
    const put = await r2Put(cfg, key, "ok", "text/plain");
    if (!put.ok) return { ok: false, status: put.status };
    const del = await r2Delete(cfg, key);
    return { ok: del.ok || del.status === 204, status: del.status };
  } catch { return { ok: false, status: null }; }
}
