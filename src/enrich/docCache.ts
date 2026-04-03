import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function defaultEnrichCacheDir(): string {
  return (
    process.env.ZSCAN_ENRICH_CACHE_DIR?.trim() ||
    path.join(os.homedir(), ".cache", "zscan", "enrich")
  );
}

function urlCachePath(url: string, cacheDir: string): string {
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 56);
  return path.join(cacheDir, `${hash}.txt`);
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface FetchCachedResult {
  text: string;
  fromCache: boolean;
}

/**
 * Descarga una URL (texto plano o HTML reducido) con caché en disco y TTL.
 */
export async function fetchUrlCached(
  url: string,
  cacheDir: string,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<FetchCachedResult> {
  fs.mkdirSync(cacheDir, { recursive: true });
  const fp = urlCachePath(url, cacheDir);

  try {
    const st = fs.statSync(fp);
    if (Date.now() - st.mtimeMs < ttlMs) {
      const text = fs.readFileSync(fp, "utf8");
      return { text, fromCache: true };
    }
  } catch {
    /* no cache */
  }

  const res = await fetch(url, {
    headers: {
      "user-agent": "zscan/0.1 (+https://github.com) enrich-docs",
      accept: "text/html, text/plain, */*",
    },
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const ct = res.headers.get("content-type") || "";
  const raw = await res.text();
  const text = ct.includes("html") ? stripHtml(raw) : raw.trim();

  try {
    fs.writeFileSync(fp, text, "utf8");
  } catch {
    /* ignore cache write errors */
  }

  return { text, fromCache: false };
}
