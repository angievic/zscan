import { fetchOsvVulnDetail } from "../osv.js";
import type { OsvVuln, ScanResult } from "../types.js";
import { defaultEnrichCacheDir, fetchUrlCached } from "./docCache.js";
import { buildWebDiscoveryLinks } from "./webDiscovery.js";

function mergeOsvVuln(thin: OsvVuln, detail: OsvVuln | null): OsvVuln {
  if (!detail) return thin;
  const refMap = new Map<string, { type?: string; url?: string }>();
  for (const r of [...(thin.references ?? []), ...(detail.references ?? [])]) {
    if (r.url) refMap.set(r.url, r);
  }
  const sevMap = new Map<string, { type: string; score?: string }>();
  for (const s of [...(thin.severity ?? []), ...(detail.severity ?? [])]) {
    const key = `${s.type ?? ""}\0${s.score ?? ""}`;
    if (s.type || s.score) {
      sevMap.set(key, { type: s.type ?? "unknown", score: s.score });
    }
  }
  const mergedSev = sevMap.size ? [...sevMap.values()] : thin.severity ?? detail.severity;
  return {
    ...thin,
    summary: thin.summary ?? detail.summary,
    details: thin.details ?? detail.details,
    references: refMap.size ? [...refMap.values()] : thin.references ?? detail.references,
    severity: mergedSev,
  };
}

export interface EnrichOptions {
  /** Máximo de extractos exitosos en el run (CVE distintos con al menos un texto). */
  maxUrls?: number;
  /** Intentos de URL distintas por CVE si la anterior falla o el texto es muy corto. */
  maxAttemptsPerVuln?: number;
  /** Texto mínimo aceptado como extracto útil. */
  minExcerptLength?: number;
  cacheDir?: string;
}

function httpsReferenceUrls(v: OsvVuln): string[] {
  const seen = new Set<string>();
  for (const r of v.references ?? []) {
    const u = r.url?.trim();
    if (u && /^https?:\/\//i.test(u)) seen.add(u);
  }
  return [...seen];
}

function osvPublicPageUrl(vulnId: string): string {
  return `https://osv.dev/vulnerability/${encodeURIComponent(vulnId)}`;
}

/**
 * Enriquecimiento: hidrata CVE (GET /v1/vulns/{id}), prueba varias URLs https (referencias + ficha osv.dev),
 * descarga con timeout/reintentos/User-Agent rotativo, y rellena `enrichWebDiscovery` (Google, DDG, SO, Reddit, NVD…)
 * como enlaces manuales (no se scrapean buscadores).
 */
export async function applyDocEnrichment(
  result: ScanResult,
  options?: EnrichOptions
): Promise<void> {
  const maxSnippets = options?.maxUrls ?? 24;
  const maxAttemptsPerVuln = options?.maxAttemptsPerVuln ?? 6;
  const minLen = options?.minExcerptLength ?? 80;
  const cacheDir = options?.cacheDir ?? defaultEnrichCacheDir();
  const fetchOpts = { timeoutMs: 24_000, retries: 2 } as const;

  if (!result.meta) result.meta = {};
  const meta = result.meta;
  meta.docSnippets = [];
  meta.enrichErrors = [];
  meta.enrichWebDiscovery = [];

  const offline = meta.offline === true;
  const detailCache = new Map<string, OsvVuln | null>();
  const snippetIds = new Set<string>();
  const discoveryIds = new Set<string>();

  if (!offline) {
    const ids = new Set<string>();
    for (const eco of result.ecosystems) {
      for (const f of eco.findings) {
        for (const v of f.vulns) ids.add(v.id);
      }
    }
    await Promise.all(
      [...ids].map(async (id) => {
        if (!detailCache.has(id)) {
          detailCache.set(id, await fetchOsvVulnDetail(id));
        }
      })
    );
    for (const eco of result.ecosystems) {
      for (const f of eco.findings) {
        f.vulns = f.vulns.map((v) => mergeOsvVuln(v, detailCache.get(v.id) ?? null));
      }
    }
  }

  function recordDiscovery(vulnId: string, pkg: string) {
    if (discoveryIds.has(vulnId)) return;
    discoveryIds.add(vulnId);
    meta.enrichWebDiscovery!.push({
      vulnId,
      package: pkg,
      links: buildWebDiscoveryLinks(vulnId, pkg),
    });
  }

  let snippetCount = 0;

  outer: for (const eco of result.ecosystems) {
    for (const f of eco.findings) {
      for (const v of f.vulns) {
        recordDiscovery(v.id, f.package);

        if (offline) continue;

        if (snippetIds.has(v.id)) continue;
        if (snippetCount >= maxSnippets) break outer;

        const merged = v;
        const refUrls = httpsReferenceUrls(merged);
        const tryUrls = [...refUrls];
        if (!tryUrls.includes(osvPublicPageUrl(v.id))) {
          tryUrls.push(osvPublicPageUrl(v.id));
        }

        let attempts = 0;
        let got = false;
        let lastFail: string | null = null;
        for (const url of tryUrls) {
          if (snippetCount >= maxSnippets) break outer;
          if (attempts >= maxAttemptsPerVuln) break;
          attempts++;
          try {
            const { text } = await fetchUrlCached(url, cacheDir, fetchOpts);
            if (text.length < minLen) {
              lastFail = `texto demasiado corto (${text.length} caracteres)`;
              continue;
            }
            meta.docSnippets!.push({
              vulnId: v.id,
              url,
              excerpt: text.slice(0, 2000),
            });
            snippetIds.add(v.id);
            snippetCount++;
            got = true;
            break;
          } catch (e) {
            lastFail = e instanceof Error ? e.message : String(e);
          }
        }

        if (!got && attempts > 0) {
          meta.enrichErrors!.push(
            `${v.id}: sin extracto tras ${attempts} URL(s) (${lastFail ?? "error desconocido"}). Usá “Contexto web” en el informe.`
          );
        }
      }
    }
  }

  if (meta.enrichErrors && meta.enrichErrors.length > 40) {
    const n = meta.enrichErrors.length;
    meta.enrichErrors = [
      ...meta.enrichErrors.slice(0, 39),
      `… y ${n - 39} avisos más omitidos en el JSON`,
    ];
  }
  if (meta.enrichErrors?.length === 0) delete meta.enrichErrors;
  if (meta.docSnippets?.length === 0) delete meta.docSnippets;
  if (meta.enrichWebDiscovery?.length === 0) delete meta.enrichWebDiscovery;
}
