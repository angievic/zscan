/**
 * Clasificación alineada con CVSS (FIRST) — puntuación base 0–10 y bandas cualitativas CVSS v3.x.
 * @see https://www.first.org/cvss/v3.1/specification-document#5-Qualitative-Severity-Rating-Scale
 */
const TYPE_RANK = {
    CVSS_V4: 0,
    CVSS_V3: 1,
    CVSS_V2: 2,
};
function rankType(t) {
    if (!t)
        return 99;
    return TYPE_RANK[t] ?? 50;
}
/** Bandas cualitativas oficiales CVSS v3.0/v3.1 (misma escala numérica). */
export function numericCvssToQualitative(score) {
    if (score <= 0)
        return "NONE";
    if (score < 4.0)
        return "LOW";
    if (score < 7.0)
        return "MEDIUM";
    if (score < 9.0)
        return "HIGH";
    return "CRITICAL";
}
const ES_QUALITATIVE = {
    NONE: "Ninguno",
    LOW: "Bajo",
    MEDIUM: "Medio",
    HIGH: "Alto",
    CRITICAL: "Crítico",
    UNKNOWN: "Sin puntuación base",
};
/** Etiqueta corta (tablas, chips). */
export function qualitativeShortEs(q) {
    return ES_QUALITATIVE[q];
}
/** Orden para mostrar / agrupar (peor primero). */
export const CVSS_QUALITATIVE_ORDER = [
    "CRITICAL",
    "HIGH",
    "MEDIUM",
    "LOW",
    "NONE",
    "UNKNOWN",
];
export function qualitativeRank(q) {
    const i = CVSS_QUALITATIVE_ORDER.indexOf(q);
    return i === -1 ? -1 : CVSS_QUALITATIVE_ORDER.length - i;
}
export function worseQualitative(a, b) {
    return qualitativeRank(a) >= qualitativeRank(b) ? a : b;
}
function extractNumericBase(score) {
    const t = score.trim();
    const m = t.match(/^(\d+(?:\.\d+)?)/);
    if (!m)
        return null;
    const n = Number.parseFloat(m[1]);
    if (Number.isNaN(n) || n < 0 || n > 10)
        return null;
    return n;
}
export function worseClassified(a, b) {
    return qualitativeRank(a.qualitative) >= qualitativeRank(b.qualitative) ? a : b;
}
/**
 * Elige la severidad “mejor” según tipo (pref. CVSS v4 > v3 > v2) y clasifica por puntuación base si es numérica.
 */
export function classifyOsvSeverities(severities) {
    if (!severities?.length) {
        return {
            qualitative: "UNKNOWN",
            labelEs: `${ES_QUALITATIVE.UNKNOWN} (sin datos en OSV)`,
        };
    }
    const sorted = [...severities].sort((a, b) => rankType(a.type) - rankType(b.type));
    for (const s of sorted) {
        const raw = s.score?.trim();
        if (!raw)
            continue;
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
