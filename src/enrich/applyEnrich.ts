import type { ScanResult } from "../types.js";
import { defaultEnrichCacheDir, fetchUrlCached } from "./docCache.js";

export interface EnrichOptions {
  maxUrls?: number;
  cacheDir?: string;
}

/**
 * Enriquecimiento de hallazgos OSV: descarga la primera URL https de `references` por vuln,
 * reduce HTML a texto y guarda extractos en `meta.docSnippets` (ver README / visión §3).
 * Activar con `scan --enrich-docs` o `enrichDocs` en POST /scan.
 */
export async function applyDocEnrichment(
  result: ScanResult,
  options?: EnrichOptions
): Promise<void> {
  const max = options?.maxUrls ?? 15;
  const cacheDir = options?.cacheDir ?? defaultEnrichCacheDir();
  if (!result.meta) result.meta = {};
  const meta = result.meta;
  meta.docSnippets = [];
  meta.enrichErrors = [];

  let count = 0;

  outer: for (const eco of result.ecosystems) {
    for (const f of eco.findings) {
      for (const v of f.vulns) {
        const url = v.references?.find((r) => /^https?:\/\//i.test(r.url ?? ""))?.url;
        if (!url) continue;
        if (count >= max) break outer;
        try {
          const { text } = await fetchUrlCached(url, cacheDir);
          meta.docSnippets!.push({
            vulnId: v.id,
            url,
            excerpt: text.slice(0, 1500),
          });
          count++;
        } catch (e) {
          meta.enrichErrors!.push(`${v.id}: ${e instanceof Error ? e.message : e}`);
        }
      }
    }
  }

  if (meta.enrichErrors?.length === 0) delete meta.enrichErrors;
  if (meta.docSnippets?.length === 0) delete meta.docSnippets;
}
