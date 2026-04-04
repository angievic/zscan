import type { PromptScanResult } from "../prompt/evaluate.js";
import { loadConfig } from "../config.js";
import { loadEnvLocalFile } from "../env/localEnv.js";
import { buildLlmUsageSnapshot } from "../llm/usageSnapshot.js";
import type {
  EcosystemScanResult,
  LlmUsageSnapshot,
  OsvVuln,
  ScanMeta,
  ScanResult,
  SecretAuthScanResult,
} from "../types.js";
import {
  CVSS_QUALITATIVE_ORDER,
  classifyOsvSeverities,
  qualitativeShortEs,
  worseClassified,
  type ClassifiedSeverity,
  type CvssQualitative,
} from "./cvssSeverity.js";

export const ZSCAN_INFORME_VERSION = 5 as const;

/** Texto fijo: el escaneo cubre todo el lockfile, no solo dependencias directas ni el “framework”. */
export const INFORME_ALCANCE_LOCKFILE =
  "zscan compara contra OSV las versiones de cada paquete listado en el lockfile (directas y transitivas). Los hallazgos no se limitan al framework ni al nombre del proyecto: utilidades, plugins, tipos y dependencias anidadas entran en el mismo análisis.";
export const ZSCAN_PROMPTS_INFORME_VERSION = 1 as const;

/** Fila plana para la pestaña “Hallazgos OSV”. */
export type InformeHallazgoRow = {
  ecosystem: string;
  lockfile: string;
  package: string;
  version: string;
  vulns: OsvVuln[];
  /** Misma longitud que `vulns`; CVSS/FIRST desde `v.severity`. */
  severidades: ClassifiedSeverity[];
};

/** Resumen agregado para la pestaña Resumen y Markdown. */
export type InformeVulnResumen = {
  alcanceLockfile: string;
  /** Clasificación FIRST / CVSS (puntuación base 0–10 cuando OSV la expone como número). */
  estandarSeveridad: "CVSS (FIRST)";
  paquetesEscaneados: number;
  paquetesConVulnerabilidad: number;
  idsVulnerabilidadUnicos: string[];
  conteoPorSeveridad: {
    qualitative: CvssQualitative;
    etiquetaCortaEs: string;
    count: number;
  }[];
  porVulnerabilidad: {
    id: string;
    summary?: string;
    severidad: ClassifiedSeverity;
    enPaquetes: { ecosystem: string; lockfile: string; package: string; version: string }[];
  }[];
};

/** JSON orientado a pestañas del informe HTML (y `informe.json`). */
export type InformeView = {
  zscanInformeVersion: typeof ZSCAN_INFORME_VERSION;
  generatedAt: string;
  resumen: {
    root: string;
    git: ScanResult["git"];
    meta: Pick<
      ScanMeta,
      "offline" | "osvWarnings" | "enrichErrors" | "reportSchemaVersion"
    > | null;
    estadisticas: {
      numEcosistemas: number;
      numPaquetes: number;
      numPaquetesConOsv: number;
      porRuntime: {
        ecosystem: string;
        lockfile: string;
        paquetes: number;
        paquetesConOsv: number;
      }[];
    };
    vulnerabilidades: InformeVulnResumen;
  };
  ecosistemas: EcosystemScanResult[];
  hallazgosOsv: InformeHallazgoRow[];
  referencias: {
    docSnippets: NonNullable<ScanMeta["docSnippets"]>;
    webDiscovery: NonNullable<ScanMeta["enrichWebDiscovery"]>;
  };
  prompts: {
    resultado: PromptScanResult | null;
    mensaje: string | null;
  };
  /** Heurísticas de llaves / autenticación; `null` si el escaneo no lo ejecutó. */
  secretAuth: SecretAuthScanResult | null;
  /** LLM resuelto (yaml + env) y catálogo de referencia de proveedores. */
  llm: LlmUsageSnapshot;
};

export type PromptsInformeJson = {
  zscanPromptsInformeVersion: typeof ZSCAN_PROMPTS_INFORME_VERSION;
  generatedAt: string;
  resultado: PromptScanResult | null;
  mensaje: string | null;
};

export function prettyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function countVulnPkgs(eco: EcosystemScanResult): number {
  return eco.findings.filter((f) => f.vulns?.length).length;
}

function flatHallazgos(ecosystems: EcosystemScanResult[]): InformeHallazgoRow[] {
  const rows: InformeHallazgoRow[] = [];
  for (const eco of ecosystems) {
    for (const f of eco.findings) {
      if (f.vulns?.length) {
        rows.push({
          ecosystem: eco.ecosystem,
          lockfile: eco.lockfile,
          package: f.package,
          version: f.version,
          vulns: f.vulns,
          severidades: f.vulns.map((v) => classifyOsvSeverities(v.severity)),
        });
      }
    }
  }
  return rows;
}

type VulnAgg = {
  summary?: string;
  classified?: ClassifiedSeverity;
  keys: Set<string>;
  enPaquetes: { ecosystem: string; lockfile: string; package: string; version: string }[];
};

export function buildVulnResumen(
  ecosystems: EcosystemScanResult[],
  numPaquetes: number,
  numPaquetesConOsv: number
): InformeVulnResumen {
  const byId = new Map<string, VulnAgg>();

  for (const eco of ecosystems) {
    for (const f of eco.findings) {
      if (!f.vulns?.length) continue;
      for (const v of f.vulns) {
        const id = v.id;
        if (!id) continue;
        let agg = byId.get(id);
        if (!agg) {
          agg = { keys: new Set(), enPaquetes: [] };
          byId.set(id, agg);
        }
        const k = `${eco.ecosystem}\0${f.package}\0${f.version}`;
        if (!agg.keys.has(k)) {
          agg.keys.add(k);
          agg.enPaquetes.push({
            ecosystem: eco.ecosystem,
            lockfile: eco.lockfile,
            package: f.package,
            version: f.version,
          });
        }
        if (!agg.summary?.trim() && v.summary?.trim()) {
          agg.summary = v.summary.trim();
        }
        const c = classifyOsvSeverities(v.severity);
        agg.classified = agg.classified ? worseClassified(agg.classified, c) : c;
      }
    }
  }

  const ids = [...byId.keys()].sort((a, b) => a.localeCompare(b));
  const porVulnerabilidad = ids.map((id) => {
    const a = byId.get(id)!;
    a.enPaquetes.sort((x, y) => {
      const p = x.package.localeCompare(y.package);
      return p !== 0 ? p : x.version.localeCompare(y.version);
    });
    return {
      id,
      summary: a.summary,
      severidad: a.classified ?? classifyOsvSeverities(undefined),
      enPaquetes: a.enPaquetes,
    };
  });

  const conteoMap = new Map<CvssQualitative, number>();
  for (const row of porVulnerabilidad) {
    const q = row.severidad.qualitative;
    conteoMap.set(q, (conteoMap.get(q) ?? 0) + 1);
  }
  const conteoPorSeveridad = CVSS_QUALITATIVE_ORDER.filter(
    (q) => (conteoMap.get(q) ?? 0) > 0
  ).map((qualitative) => ({
    qualitative,
    etiquetaCortaEs: qualitativeShortEs(qualitative),
    count: conteoMap.get(qualitative)!,
  }));

  return {
    alcanceLockfile: INFORME_ALCANCE_LOCKFILE,
    estandarSeveridad: "CVSS (FIRST)",
    paquetesEscaneados: numPaquetes,
    paquetesConVulnerabilidad: numPaquetesConOsv,
    idsVulnerabilidadUnicos: ids,
    conteoPorSeveridad,
    porVulnerabilidad,
  };
}

export function buildInformeView(result: ScanResult): InformeView {
  const ecosystems = result.ecosystems ?? [];
  const numPaquetes = ecosystems.reduce((n, e) => n + e.packages.length, 0);
  const numPaquetesConOsv = ecosystems.reduce((n, e) => n + countVulnPkgs(e), 0);
  loadEnvLocalFile(result.root);
  const llm =
    result.llmUsage ?? buildLlmUsageSnapshot(loadConfig(result.root));
  const m = result.meta;
  const metaResumen = m
    ? {
        offline: m.offline,
        osvWarnings: m.osvWarnings,
        enrichErrors: m.enrichErrors,
        reportSchemaVersion: m.reportSchemaVersion,
      }
    : null;

  return {
    zscanInformeVersion: ZSCAN_INFORME_VERSION,
    generatedAt: new Date().toISOString(),
    resumen: {
      root: result.root,
      git: result.git,
      meta: metaResumen,
      estadisticas: {
        numEcosistemas: ecosystems.length,
        numPaquetes,
        numPaquetesConOsv,
        porRuntime: ecosystems.map((e) => ({
          ecosystem: e.ecosystem,
          lockfile: e.lockfile,
          paquetes: e.packages.length,
          paquetesConOsv: countVulnPkgs(e),
        })),
      },
      vulnerabilidades: buildVulnResumen(ecosystems, numPaquetes, numPaquetesConOsv),
    },
    ecosistemas: ecosystems,
    hallazgosOsv: flatHallazgos(ecosystems),
    referencias: {
      docSnippets: m?.docSnippets ?? [],
      webDiscovery: m?.enrichWebDiscovery ?? [],
    },
    prompts: {
      resultado: result.prompts ?? null,
      mensaje: result.promptScanMessage ?? null,
    },
    secretAuth: result.secretAuthScan ?? null,
    llm,
  };
}

export function buildPromptsInformeJson(result: ScanResult): PromptsInformeJson {
  return {
    zscanPromptsInformeVersion: ZSCAN_PROMPTS_INFORME_VERSION,
    generatedAt: new Date().toISOString(),
    resultado: result.prompts ?? null,
    mensaje: result.promptScanMessage ?? null,
  };
}
