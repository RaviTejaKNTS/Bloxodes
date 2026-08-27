import { createHash, createHmac } from "node:crypto";

export type R2ClientConfig = {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

type PutR2ObjectInput = {
  key: string;
  body: Uint8Array;
  contentType: string;
  cacheControl?: string;
  metadata?: Record<string, string | number>;
};

const encoder = new TextEncoder();

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: string | Buffer, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function encodePath(value: string) {
  return value
    .split("/")
    .map((segment) => encodeURIComponent(segment).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`))
    .join("/");
}

function normalizeEndpoint(value: string) {
  const url = new URL(value);
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url;
}

export function loadR2ClientConfig(
  env: NodeJS.ProcessEnv = process.env
): R2ClientConfig {
  const config = {
    endpoint: env.WIKI_R2_ENDPOINT?.trim() || "",
    accessKeyId: env.WIKI_R2_ACCESS_KEY_ID?.trim() || "",
    secretAccessKey: env.WIKI_R2_SECRET_ACCESS_KEY?.trim() || "",
    bucket: env.WIKI_R2_BUCKET?.trim() || ""
  };
  const missing = Object.entries(config).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw new Error(`Missing R2 configuration: ${missing.join(", ")}`);
  return config;
}

export class R2Client {
  constructor(
    private readonly config: R2ClientConfig,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly now: () => Date = () => new Date()
  ) {}

  async putObject(input: PutR2ObjectInput) {
    return this.request("PUT", input.key, input.body, {
      "cache-control": input.cacheControl || "public, max-age=31536000, immutable",
      "content-type": input.contentType,
      ...Object.fromEntries(
        Object.entries(input.metadata || {}).map(([key, value]) => [`x-amz-meta-${key.toLowerCase()}`, String(value)])
      )
    });
  }

  async headObject(key: string) {
    return this.request("HEAD", key, new Uint8Array(), {});
  }

  async hasObject(key: string) {
    const response = await this.request("HEAD", key, new Uint8Array(), {}, [404]);
    return response.status !== 404;
  }

  private async request(
    method: string,
    key: string,
    body: Uint8Array,
    extraHeaders: Record<string, string>,
    acceptedStatuses: number[] = []
  ) {
    const endpoint = normalizeEndpoint(this.config.endpoint);
    const encodedKey = encodePath(key);
    const canonicalPath = `${endpoint.pathname}/${encodeURIComponent(this.config.bucket)}/${encodedKey}`.replace(/\/+/g, "/");
    const url = new URL(endpoint.toString());
    url.pathname = canonicalPath;

    const timestamp = this.now().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const date = timestamp.slice(0, 8);
    const payloadHash = sha256(body);
    const headers: Record<string, string> = {
      host: url.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": timestamp,
      ...extraHeaders
    };
    const signedHeaderNames = Object.keys(headers).sort();
    const canonicalHeaders = signedHeaderNames.map((name) => `${name}:${headers[name].trim()}\n`).join("");
    const signedHeaders = signedHeaderNames.join(";");
    const canonicalRequest = [method, canonicalPath, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const scope = `${date}/auto/s3/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", timestamp, scope, sha256(canonicalRequest)].join("\n");
    const dateKey = hmac(`AWS4${this.config.secretAccessKey}`, date);
    const regionKey = hmac(dateKey, "auto");
    const serviceKey = hmac(regionKey, "s3");
    const signingKey = hmac(serviceKey, "aws4_request");
    const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
    headers.authorization = `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const response = await this.fetchImpl(url, {
      method,
      headers,
      body: method === "HEAD" ? undefined : Buffer.from(body)
    });
    if (!response.ok && !acceptedStatuses.includes(response.status)) {
      const detail = method === "HEAD" ? "" : `: ${(await response.text()).slice(0, 500)}`;
      throw new Error(`R2 ${method} ${key} failed with ${response.status}${detail}`);
    }
    return response;
  }
}

export function utf8Bytes(value: string) {
  return encoder.encode(value);
}
