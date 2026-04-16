/**
 * Clasificación alineada con CVSS (FIRST) — puntuación base 0–10 y bandas cualitativas CVSS v3.x.
 * @see https://www.first.org/cvss/v3.1/specification-document#5-Qualitative-Severity-Rating-Scale
 */
export type CvssQualitative = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "UNKNOWN";
/** Bandas cualitativas oficiales CVSS v3.0/v3.1 (misma escala numérica). */
export declare function numericCvssToQualitative(score: number): CvssQualitative;
/** Etiqueta corta (tablas, chips). */
export declare function qualitativeShortEs(q: CvssQualitative): string;
/** Orden para mostrar / agrupar (peor primero). */
export declare const CVSS_QUALITATIVE_ORDER: CvssQualitative[];
export declare function qualitativeRank(q: CvssQualitative): number;
export declare function worseQualitative(a: CvssQualitative, b: CvssQualitative): CvssQualitative;
export interface ClassifiedSeverity {
    qualitative: CvssQualitative;
    /** Etiqueta en español + referencia al estándar. */
    labelEs: string;
    baseScore?: number;
    /** p.ej. CVSS_V3, CVSS_V4 */
    scheme?: string;
    /** Valor original en OSV (vector o número como string). */
    raw?: string;
}
export declare function worseClassified(a: ClassifiedSeverity, b: ClassifiedSeverity): ClassifiedSeverity;
/**
 * Elige la severidad “mejor” según tipo (pref. CVSS v4 > v3 > v2) y clasifica por puntuación base si es numérica.
 */
export declare function classifyOsvSeverities(severities?: {
    type?: string;
    score?: string;
}[]): ClassifiedSeverity;
