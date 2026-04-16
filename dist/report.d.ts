import type { DependencyNode, EcosystemScanResult, ScanResult } from "./types.js";
export declare function buildPropagationNotes(tree: DependencyNode | null, vulnerableNames: Set<string>): string[];
/** Markdown de un solo ecosistema (mismo bloque que en el informe completo). */
export declare function ecosystemToMarkdown(eco: EcosystemScanResult): string;
export declare function toMarkdown(result: ScanResult): string;
export declare function toJson(result: ScanResult): string;
