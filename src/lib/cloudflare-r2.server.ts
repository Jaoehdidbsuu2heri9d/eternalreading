import { AwsClient } from "aws4fetch";

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
};

const env = (key: string) => process.env[key]?.trim() ?? "";

export function getR2Config(): R2Config | null {
  const accountId = env("CLOUDFLARE_ACCOUNT_ID");
  const accessKeyId = env("CLOUDFLARE_R2_ACCESS_KEY_ID");
  const secretAccessKey = env("CLOUDFLARE_R2_SECRET_ACCESS_KEY");
  const bucket = env("CLOUDFLARE_R2_BUCKET");

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  if (!/^[a-z0-9-]{3,63}$/i.test(bucket) || !/^[a-f0-9]{32}$/i.test(accountId)) return null;

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  };
}

function createR2Client(config: R2Config) {
  return new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: "auto",
    retries: 1,
  });
}

function objectUrl(config: R2Config, key: string) {
  // Keys in this app are restricted to safe ASCII path segments.
  return `${config.endpoint}/${config.bucket}/${key}`;
}

/** Store a validated image in the configured private R2 bucket. */
export async function putR2Object(key: string, body: ArrayBuffer, contentType: string) {
  const config = getR2Config();
  if (!config) throw new Error("cloudflare_r2_not_configured");

  const response = await createR2Client(config).fetch(objectUrl(config, key), {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
    body,
  });

  if (!response.ok) {
    console.error("[Cloudflare R2] Upload failed with status", response.status);
    throw new Error("cloudflare_r2_upload_failed");
  }
}

/** Returns the stored image, null only when the object is absent or R2 is not configured. */
export async function getR2Object(key: string): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  const config = getR2Config();
  if (!config) return null;

  const response = await createR2Client(config).fetch(objectUrl(config, key), {
    method: "GET",
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    console.error("[Cloudflare R2] Read failed with status", response.status);
    throw new Error("cloudflare_r2_read_failed");
  }

  return {
    body: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") ?? "application/octet-stream",
  };
}
