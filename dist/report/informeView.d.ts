import type { PromptScanResult } from "../prompt/evaluate.js";
import type { EcosystemScanResult, LlmUsageSnapshot, OsvVuln, ScanMeta, ScanResult, SecretAuthScanResult } from "../types.js";
import { type ClassifiedSeverity, type CvssQualitative } from "./cvssSeverity.js";
export declare const ZSCAN_INFORME_VERSION: 5;
/** Texto fijo: el escaneo cubre todo el lockfile, no solo dependencias directas ni el “framework”. */
export declare const INFORME_ALCANCE_LOCKFILE = "zscan compara contra OSV las versiones de cada paquete listado en el lockfile (directas y transitivas). Los hallazgos no se limitan al framework ni al nombre del proyecto: utilidades, plugins, tipos y dependencias anidadas entran en el mismo an\u00E1lisis.";
export declare const ZSCAN_PROMPTS_INFORME_VERSION: 1;
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
        enPaquetes: {
            ecosystem: string;
            lockfile: string;
            package: string;
            version: string;
        }[];
    }[];
};
/** JSON orientado a pestañas del informe HTML (y `informe.json`). */
export type InformeView = {
    zscanInformeVersion: typeof ZSCAN_INFORME_VERSION;
    generatedAt: string;
    resumen: {
        root: string;
        git: ScanResult["git"];
        meta: Pick<ScanMeta, "offline" | "osvWarnings" | "enrichErrors" | "reportSchemaVersion"> | null;
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
export declare function prettyJson(value: unknown): string;
export declare function buildVulnResumen(ecosystems: EcosystemScanResult[], numPaquetes: number, numPaquetesConOsv: number): InformeVulnResumen;
export declare function buildInformeView(result: ScanResult): InformeView;
export declare function buildPromptsInformeJson(result: ScanResult): PromptsInformeJson;
