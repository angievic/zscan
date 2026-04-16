import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    "zscan/0.1 enrich-docs (+https://github.com/angieshadai/zscan)",
];
function isWritableDir(dir) {
    try {
        fs.accessSync(dir, fs.constants.W_OK);
        return true;
    }
    catch {
        return false;
    }
}
/** Crea el directorio si puede y comprueba escritura. */
function ensureEnrichCacheDir(dir) {
    try {
        fs.mkdirSync(dir, { recursive: true });
        return isWritableDir(dir);
    }
    catch {
        return false;
    }
}
/**
 * Directorio de caché para descargas de enriquecimiento.
 * Orden: `ZSCAN_ENRICH_CACHE_DIR`, `~/.cache/zscan/enrich`, `{tmpdir}/zscan/enrich`.
 * Evita EPERM en entornos que bloquean escritura en el home (p. ej. sandbox).
 */
export function defaultEnrichCacheDir() {
    const fromEnv = process.env.ZSCAN_ENRICH_CACHE_DIR?.trim();
    if (fromEnv && ensureEnrichCacheDir(fromEnv))
        return fromEnv;
    const homeCache = path.join(os.homedir(), ".cache", "zscan", "enrich");
    if (ensureEnrichCacheDir(homeCache))
        return homeCache;
    const tmpCache = path.join(os.tmpdir(), "zscan", "enrich");
    if (ensureEnrichCacheDir(tmpCache))
        return tmpCache;
    const fallback = path.join(os.tmpdir(), `zscan-enrich-${process.pid}`);
    if (ensureEnrichCacheDir(fallback))
        return fallback;
    throw new Error("No se pudo crear caché de enriquecimiento; defina ZSCAN_ENRICH_CACHE_DIR a un directorio escribible.");
}
function urlCachePath(url, cacheDir) {
    const hash = createHash("sha256").update(url).digest("hex").slice(0, 56);
    return path.join(cacheDir, `${hash}.txt`);
}
function stripHtml(html) {
    const stripped = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    return decodeBasicEntities(stripped);
}
function decodeBasicEntities(s) {
    return s
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number.parseInt(n, 10)))
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(Number.parseInt(h, 16)));
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function normalizeOptions(options) {
    const o = typeof options === "number" ? { ttlMs: options } : (options ?? {});
    return {
        ttlMs: o.ttlMs ?? DEFAULT_TTL_MS,
        timeoutMs: o.timeoutMs ?? 22_000,
        retries: o.retries ?? 2,
    };
}
/**
 * Descarga una URL (HTML reducido a texto o plano) con caché en disco, TTL,
 * timeout y reintentos ante errores transitorios.
 */
export async function fetchUrlCached(url, cacheDir, options) {
    const { ttlMs, timeoutMs, retries } = normalizeOptions(options);
    fs.mkdirSync(cacheDir, { recursive: true });
    const fp = urlCachePath(url, cacheDir);
    try {
        const st = fs.statSync(fp);
        if (Date.now() - st.mtimeMs < ttlMs) {
            const text = fs.readFileSync(fp, "utf8");
            return { text, fromCache: true };
        }
    }
    catch {
        /* sin caché */
    }
    let lastErr = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, {
                signal: controller.signal,
                headers: {
                    "user-agent": USER_AGENTS[attempt % USER_AGENTS.length],
                    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
                    "accept-language": "en-US,en;q=0.9,es;q=0.8",
                },
                redirect: "follow",
            });
            clearTimeout(timer);
            if (res.status === 429 || res.status === 502 || res.status === 503) {
                lastErr = new Error(`HTTP ${res.status}`);
                if (attempt < retries) {
                    await sleep(700 * (attempt + 1));
                    continue;
                }
                throw lastErr;
            }
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const ct = res.headers.get("content-type") || "";
            const raw = await res.text();
            const text = ct.includes("html") ? stripHtml(raw) : decodeBasicEntities(raw.trim());
            try {
                fs.writeFileSync(fp, text, "utf8");
            }
            catch {
                /* ignore */
            }
            return { text, fromCache: false };
        }
        catch (e) {
            clearTimeout(timer);
            const err = e instanceof Error ? e : new Error(String(e));
            lastErr = err;
            const abort = err.name === "AbortError";
            const retryable = abort ||
                err.message.includes("fetch failed") ||
                err.message.includes("ECONNRESET") ||
                err.message.includes("ETIMEDOUT") ||
                err.message.includes("HTTP 429") ||
                err.message.includes("HTTP 502") ||
                err.message.includes("HTTP 503");
            if (attempt < retries && retryable) {
                await sleep(600 * (attempt + 1));
                continue;
            }
            throw err;
        }
    }
    throw lastErr ?? new Error("fetch failed");
}
