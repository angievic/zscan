export declare function runScan(root: string, out: {
    json?: string;
    markdown?: string;
    print: boolean;
    ignoreSubmodules?: boolean;
    offline?: boolean;
    bypassOsvCache?: boolean;
    /** Por defecto true: scraping de referencias OSV. */
    enrichDocs?: boolean;
    skipPromptLlm?: boolean;
    /** Por defecto true: patrones de llaves / auth en código. */
    secretAuthScan?: boolean;
    /** Directorio padre donde se crea `zscan-runs/<id>-scan` (o el nombre que elijas) con HTML, JSON y MD. */
    reportBundleParent?: string;
}): Promise<void>;
