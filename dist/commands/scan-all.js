import { runScan } from "./scan.js";
/**
 * Mismo escaneo que `scan`, pero siempre escribe el paquete bajo
 * `<bundleParent>/<id>-scan/` (por defecto `zscan-runs`) y no imprime Markdown
 * salvo que `print === true`.
 */
export async function runScanAll(root, opts) {
    await runScan(root, {
        json: opts.json,
        markdown: opts.markdown,
        print: opts.print === true,
        ignoreSubmodules: opts.ignoreSubmodules,
        offline: opts.offline,
        bypassOsvCache: opts.bypassOsvCache,
        enrichDocs: opts.enrichDocs !== false,
        skipPromptLlm: opts.skipPromptLlm === true,
        secretAuthScan: opts.secretAuthScan !== false,
        reportBundleParent: opts.bundleParent ?? "zscan-runs",
    });
}
