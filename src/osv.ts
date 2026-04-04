import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { LockfilePackage, OsvEcosystem, OsvVuln } from "./types.js";

const OSV_BATCH = "https://api.osv.dev/v1/querybatch";
const OSV_VULN = "https://api.osv.dev/v1/vulns";

export function defaultOsvCacheDir(): string {
  return process.env.ZSCAN_OSV_CACHE_DIR?.trim() || path.join(os.homedir(), ".cache", "zscan", "osv");
}

export interface OsvQueryOptions {
  /** Solo leer caché en disco; sin red. */
  offline?: boolean;
  /** Ignorar lectura de caché y volver a consultar OSV (sigue escribiendo caché). */
  bypassCache?: boolean;
  cacheDir?: string;
  onWarning?: (msg: string) => void;
}

function chunkCachePath(
  chunk: LockfilePackage[],
  ecosystem: OsvEcosystem,
  cacheDir: string
): string {
  const payload = JSON.stringify({
    e: ecosystem,
    q: chunk.map((p) => [p.name, p.version]),
  });
  const hash = createHash("sha256").update(payload).digest("hex").slice(0, 48);
  return path.join(cacheDir, `${ecosystem}_${hash}.json`);
}

function readCachedBatch(
  filePath: string
): { results: { vulns?: OsvVuln[] }[] } | null {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw) as { results?: { vulns?: OsvVuln[] }[] };
    if (!Array.isArray(data.results)) return null;
    return { results: data.results };
  } catch {
    return null;
  }
}

function writeCachedBatch(
  filePath: string,
  results: { vulns?: OsvVuln[] }[]
): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify({ results }), "utf8");
}

export async function queryOsvBatch(
  packages: LockfilePackage[],
  ecosystem: OsvEcosystem = "npm",
  opts?: OsvQueryOptions
): Promise<Map<string, OsvVuln[]>> {
  const out = new Map<string, OsvVuln[]>();
  const cacheDir = opts?.cacheDir ?? defaultOsvCacheDir();
  const offline = opts?.offline === true;
  const warn = opts?.onWarning ?? (() => {});

  const chunkSize = 500;
  for (let i = 0; i < packages.length; i += chunkSize) {
    const chunk = packages.slice(i, i + chunkSize);
    const cacheFile = chunkCachePath(chunk, ecosystem, cacheDir);
    const bypass = opts?.bypassCache === true;

    if (offline) {
      const cached = readCachedBatch(cacheFile);
      if (!cached || cached.results.length !== chunk.length) {
        warn(
          `OSV offline: sin caché para un lote de ${chunk.length} paquetes (${ecosystem}); se asume sin CVE en caché.`
        );
        chunk.forEach((p) => out.set(`${p.name}@${p.version}`, []));
        continue;
      }
      chunk.forEach((p, j) => {
        out.set(`${p.name}@${p.version}`, cached.results[j]?.vulns ?? []);
      });
      continue;
    }

    if (!bypass) {
      const cached = readCachedBatch(cacheFile);
      if (cached && cached.results.length === chunk.length) {
        chunk.forEach((p, j) => {
          out.set(`${p.name}@${p.version}`, cached.results[j]?.vulns ?? []);
        });
        continue;
      }
    }

    const queries = chunk.map((p) => ({
      package: { name: p.name, ecosystem },
      version: p.version,
    }));

    const res = await fetch(OSV_BATCH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ queries }),
    });

    if (!res.ok) {
      throw new Error(`OSV batch failed: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as {
      results: { vulns?: OsvVuln[] }[];
    };

    try {
      writeCachedBatch(
        cacheFile,
        chunk.map((_, j) => ({ vulns: data.results[j]?.vulns ?? [] }))
      );
    } catch (e) {
      warn(`No se pudo escribir caché OSV (${cacheFile}): ${e}`);
    }

    chunk.forEach((p, j) => {
      out.set(`${p.name}@${p.version}`, data.results[j]?.vulns ?? []);
    });
  }

  return out;
}

/**
 * Registro completo de una vulnerabilidad (incluye `references` con URLs).
 * El batch `/v1/querybatch` suele devolver entradas sin hidratar (sin `references`).
 */
export async function fetchOsvVulnDetail(id: string): Promise<OsvVuln | null> {
  try {
    const res = await fetch(`${OSV_VULN}/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return (await res.json()) as OsvVuln;
  } catch {
    return null;
  }
}
