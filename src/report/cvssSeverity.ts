/**
 * Clasificación alineada con CVSS (FIRST) — puntuación base 0–10 y bandas cualitativas CVSS v3.x.
 * @see https://www.first.org/cvss/v3.1/specification-document#5-Qualitative-Severity-Rating-Scale
 */

export type CvssQualitative = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "UNKNOWN";

const TYPE_RANK: Record<string, number> = {
  CVSS_V4: 0,
  CVSS_V3: 1,
  CVSS_V2: 2,
};

function rankType(t?: string): number {
  if (!t) return 99;
  return TYPE_RANK[t] ?? 50;
}

/** Bandas cualitativas oficiales CVSS v3.0/v3.1 (misma escala numérica). */
export function numericCvssToQualitative(score: number): CvssQualitative {
  if (score <= 0) return "NONE";
  if (score < 4.0) return "LOW";
  if (score < 7.0) return "MEDIUM";
  if (score < 9.0) return "HIGH";
  return "CRITICAL";
}

const ES_QUALITATIVE: Record<CvssQualitative, string> = {
  NONE: "Ninguno",
  LOW: "Bajo",
  MEDIUM: "Medio",
  HIGH: "Alto",
  CRITICAL: "Crítico",
  UNKNOWN: "Sin puntuación base",
};

/** Etiqueta corta (tablas, chips). */
export function qualitativeShortEs(q: CvssQualitative): string {
  return ES_QUALITATIVE[q];
}

/** Orden para mostrar / agrupar (peor primero). */
export const CVSS_QUALITATIVE_ORDER: CvssQualitative[] = [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
  "NONE",
  "UNKNOWN",
];

export function qualitativeRank(q: CvssQualitative): number {
  const i = CVSS_QUALITATIVE_ORDER.indexOf(q);
  return i === -1 ? -1 : CVSS_QUALITATIVE_ORDER.length - i;
}

export function worseQualitative(a: CvssQualitative, b: CvssQualitative): CvssQualitative {
  return qualitativeRank(a) >= qualitativeRank(b) ? a : b;
}

function extractNumericBase(score: string): number | null {
  const t = score.trim();
  const m = t.match(/^(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number.parseFloat(m[1]!);
  if (Number.isNaN(n) || n < 0 || n > 10) return null;
  return n;
}

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

export function worseClassified(a: ClassifiedSeverity, b: ClassifiedSeverity): ClassifiedSeverity {
  return qualitativeRank(a.qualitative) >= qualitativeRank(b.qualitative) ? a : b;
}

/**
 * Elige la severidad “mejor” según tipo (pref. CVSS v4 > v3 > v2) y clasifica por puntuación base si es numérica.
 */
export function classifyOsvSeverities(
  severities?: { type?: string; score?: string }[]
): ClassifiedSeverity {
  if (!severities?.length) {
    return {
      qualitative: "UNKNOWN",
      labelEs: `${ES_QUALITATIVE.UNKNOWN} (sin datos en OSV)`,
    };
  }

  const sorted = [...severities].sort((a, b) => rankType(a.type) - rankType(b.type));

  for (const s of sorted) {
    const raw = s.score?.trim();
    if (!raw) continue;
    const n = extractNumericBase(raw);
    if (n !== null) {
      const q = numericCvssToQualitative(n);
      const scheme = s.type ?? "CVSS";
      return {
        qualitative: q,
        labelEs: `${ES_QUALITATIVE[q]} · ${scheme} base ${n.toFixed(1)} (FIRST / CVSS)`,
        baseScore: n,
        scheme,
        raw,
      };
    }
  }

  const first = sorted.find((x) => x.score?.trim());
  const raw = first?.score?.trim();
  return {
    qualitative: "UNKNOWN",
    labelEs: `${ES_QUALITATIVE.UNKNOWN} — revisar vector o severidad en OSV/NVD`,
    scheme: first?.type,
    raw,
  };
}
