/**
 * Directorio de caché para descargas de enriquecimiento.
 * Orden: `ZSCAN_ENRICH_CACHE_DIR`, `~/.cache/zscan/enrich`, `{tmpdir}/zscan/enrich`.
 * Evita EPERM en entornos que bloquean escritura en el home (p. ej. sandbox).
 */
export declare function defaultEnrichCacheDir(): string;
export interface FetchCachedResult {
    text: string;
    fromCache: boolean;
}
export type FetchUrlCachedOptions = {
    ttlMs?: number;
    /** Tiempo máximo por intento (ms). */
    timeoutMs?: number;
    /** Reintentos tras timeout, 429, 502 o 503. */
    retries?: number;
};
/**
 * Descarga una URL (HTML reducido a texto o plano) con caché en disco, TTL,
 * timeout y reintentos ante errores transitorios.
 */
export declare function fetchUrlCached(url: string, cacheDir: string, options?: number | FetchUrlCachedOptions): Promise<FetchCachedResult>;
