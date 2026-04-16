import type { ScanResult } from "../types.js";
export interface ProjectScanOptions {
    ignoreSubmodules?: boolean;
    offline?: boolean;
    bypassOsvCache?: boolean;
    osvCacheDir?: string;
    enrichDocs?: boolean;
    enrichCacheDir?: string;
    /** Por defecto true: heurísticas de llaves / autenticación en código. */
    secretAuthScan?: boolean;
}
export interface ProjectScanOutcome {
    result: ScanResult | null;
    errorMessage?: string;
}
export declare function performProjectScan(root: string, options?: ProjectScanOptions): Promise<ProjectScanOutcome>;
