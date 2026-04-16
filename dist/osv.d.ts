import type { LockfilePackage, OsvEcosystem, OsvVuln } from "./types.js";
export declare function defaultOsvCacheDir(): string;
export interface OsvQueryOptions {
    /** Solo leer caché en disco; sin red. */
    offline?: boolean;
    /** Ignorar lectura de caché y volver a consultar OSV (sigue escribiendo caché). */
    bypassCache?: boolean;
    cacheDir?: string;
    onWarning?: (msg: string) => void;
}
export declare function queryOsvBatch(packages: LockfilePackage[], ecosystem?: OsvEcosystem, opts?: OsvQueryOptions): Promise<Map<string, OsvVuln[]>>;
/**
 * Registro completo de una vulnerabilidad (incluye `references` con URLs).
 * El batch `/v1/querybatch` suele devolver entradas sin hidratar (sin `references`).
 */
export declare function fetchOsvVulnDetail(id: string): Promise<OsvVuln | null>;
