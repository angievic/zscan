export type ScanAllOptions = {
    json?: string;
    markdown?: string;
    /** Por defecto false (solo disco + resumen en consola). */
    print?: boolean;
    ignoreSubmodules?: boolean;
    offline?: boolean;
    bypassOsvCache?: boolean;
    enrichDocs?: boolean;
    skipPromptLlm?: boolean;
    secretAuthScan?: boolean;
    /** Directorio padre del run; por defecto `zscan-runs`. */
    bundleParent?: string;
};
/**
 * Mismo escaneo que `scan`, pero siempre escribe el paquete bajo
 * `<bundleParent>/<id>-scan/` (por defecto `zscan-runs`) y no imprime Markdown
 * salvo que `print === true`.
 */
export declare function runScanAll(root: string, opts: ScanAllOptions): Promise<void>;
