import type { GitMetadata } from "./git/metadata.js";
import type { PromptScanResult } from "./prompt/evaluate.js";
import type { LlmProvider } from "./llm/provider.js";

export interface LockfilePackage {
  name: string;
  version: string;
}

export interface OsvVuln {
  id: string;
  summary?: string;
  details?: string;
  severity?: { type: string; score?: string }[];
  affected?: { package?: { ecosystem: string; name: string }; ranges?: unknown[] }[];
  references?: { type?: string; url?: string }[];
}

export interface ScanFinding {
  package: string;
  version: string;
  vulns: OsvVuln[];
}

export interface DependencyNode {
  name: string;
  version: string;
  children: DependencyNode[];
}

export type OsvEcosystem = "npm" | "PyPI" | "RubyGems" | "Go" | "Maven";

export interface ImportHintGroup {
  package: string;
  files: { path: string; line: number; snippet: string }[];
}

/** Un ecosistema resuelto (npm, PyPI, RubyGems, Go, Maven, …) dentro de un escaneo. */
export interface EcosystemScanResult {
  ecosystem: OsvEcosystem;
  /** Etiqueta del lockfile (p. ej. package-lock.json, poetry.lock). */
  lockfile: string;
  packages: LockfilePackage[];
  findings: ScanFinding[];
  tree: DependencyNode | null;
  importHints: ImportHintGroup[];
}

/** Metadatos del escaneo (offline, caché, enriquecimiento). */
export interface ScanMeta {
  /** Esquema del informe zscan (incremental con el producto). */
  reportSchemaVersion?: number;
  offline?: boolean;
  osvWarnings?: string[];
  enrichErrors?: string[];
  /** Excerpts de URLs de referencia OSV (scraping con caché). */
  docSnippets?: { vulnId: string; url: string; excerpt: string }[];
  /**
   * Enlaces sugeridos por CVE/GHSA (OSV, NVD, búsqueda, foros); no implica scrape de esas URLs.
   */
  enrichWebDiscovery?: {
    vulnId: string;
    package?: string;
    links: { label: string; url: string; kind: "registry" | "search" | "community" }[];
  }[];
}

export type SecretAuthCategory = "secret_material" | "auth_pattern" | "config_risk";

export type SecretAuthSeverity = "high" | "medium" | "low";

export interface SecretAuthFinding {
  category: SecretAuthCategory;
  severity: SecretAuthSeverity;
  path: string;
  line: number;
  snippet: string;
  titulo: string;
  sugerencia: string;
}

export type SecretAuthNivel = "sin_indicios_graves" | "revisar" | "riesgo_alto_heuristico";

export interface SecretAuthScanResult {
  archivosAnalizados: number;
  hallazgos: SecretAuthFinding[];
  nivel: SecretAuthNivel;
  resumen: string;
  metodo: string;
}

/** Configuración LLM resuelta para el informe (sin secretos). */
export interface LlmUsageSnapshot {
  proveedor: LlmProvider;
  proveedor_descripcion: string;
  modelo: string;
  base_url: string;
  yaml_llm_enabled: boolean;
  api_key_configurada: boolean;
  env: {
    model?: boolean;
    base_url?: boolean;
    api_key?: boolean;
    provider?: boolean;
  };
  /** Lista fija de proveedores/modelos que zscan documenta como referencia. */
  catalogo_referencia: {
    nombre: string;
    ejemplos_modelo: string[];
    nota?: string;
  }[];
}

export interface ScanResult {
  root: string;
  git: GitMetadata;
  ecosystems: EcosystemScanResult[];
  meta?: ScanMeta;
  /** Incluido cuando `scan` ejecuta también prompt-scan (heurísticas, reglas YAML, LLM). */
  prompts?: PromptScanResult;
  /** Si prompt-scan no produjo resultado (p. ej. sin `prompts[]` o error). */
  promptScanMessage?: string;
  /** Heurísticas locales: secretos y patrones de autenticación en código/config. */
  secretAuthScan?: SecretAuthScanResult;
  /** Uso de LLM resuelto (zscan.yaml + env); también puede rellenarse en el informe si faltaba. */
  llmUsage?: LlmUsageSnapshot;
}
