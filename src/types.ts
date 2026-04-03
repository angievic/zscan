import type { GitMetadata } from "./git/metadata.js";
import type { PromptScanResult } from "./prompt/evaluate.js";

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
}
