import type { ScanResult } from "../types.js";
import { type ProjectScanOptions, type ProjectScanOutcome } from "./projectScan.js";
export interface CombinedScanOutcome extends ProjectScanOutcome {
    /** Error de configuración de prompts (no aplica si solo faltaba `prompts[]`). */
    promptScanHardFail: boolean;
}
/**
 * Escaneo de dependencias + OSV (+ enriquecimiento opcional) y prompt-scan según `zscan.yaml`.
 */
export declare function performCombinedScan(root: string, depOpts: ProjectScanOptions, promptOpts: {
    skipLlm?: boolean;
}): Promise<CombinedScanOutcome>;
export declare function promptChecksFailed(result: ScanResult): boolean;
