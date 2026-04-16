import type { ScanResult } from "../types.js";
/** Nombre de carpeta único que termina en `-scan`. */
export declare function createBundleDirName(): string;
/**
 * Crea `<parent>/<hex>-scan/` con:
 * - `report.json` — `ScanResult` completo (JSON indentado)
 * - `informe.json` — vista por pestañas (`InformeView`, JSON indentado)
 * - `prompts.json` — siempre; bloque `{ zscanPromptsInformeVersion, generatedAt, resultado, mensaje }`
 * - `report.html` — lee el mismo `InformeView` embebido y pestañas
 * - `informe.md`, `prompts.md`, `ecosystems/*.{json,md}`
 */
export declare function writeScanBundle(parentDir: string, result: ScanResult): string;
