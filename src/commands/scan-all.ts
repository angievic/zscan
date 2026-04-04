import { runScan } from "./scan.js";

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
export async function runScanAll(root: string, opts: ScanAllOptions) {
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
