import type { ScanResult } from "../types.js";
export interface EnrichOptions {
    /** Máximo de extractos exitosos en el run (CVE distintos con al menos un texto). */
    maxUrls?: number;
    /** Intentos de URL distintas por CVE si la anterior falla o el texto es muy corto. */
    maxAttemptsPerVuln?: number;
    /** Texto mínimo aceptado como extracto útil. */
    minExcerptLength?: number;
    cacheDir?: string;
}
/**
 * Enriquecimiento: hidrata CVE (GET /v1/vulns/{id}), prueba varias URLs https (referencias + ficha osv.dev),
 * descarga con timeout/reintentos/User-Agent rotativo, y rellena `enrichWebDiscovery` (Google, DDG, SO, Reddit, NVD…)
 * como enlaces manuales (no se scrapean buscadores).
 */
export declare function applyDocEnrichment(result: ScanResult, options?: EnrichOptions): Promise<void>;
