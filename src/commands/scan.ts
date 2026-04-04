import * as fs from "node:fs";
import { toJson, toMarkdown } from "../report.js";
import { writeScanBundle } from "../report/writeScanBundle.js";
import {
  performCombinedScan,
  promptChecksFailed,
} from "../scan/combinedScan.js";

export async function runScan(
  root: string,
  out: {
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
  }
) {
  const { result, errorMessage, promptScanHardFail } = await performCombinedScan(
    root,
    {
      ignoreSubmodules: out.ignoreSubmodules,
      offline: out.offline,
      bypassOsvCache: out.bypassOsvCache,
      enrichDocs: out.enrichDocs !== false,
      secretAuthScan: out.secretAuthScan !== false,
    },
    { skipLlm: out.skipPromptLlm === true }
  );

  if (!result) {
    console.error(errorMessage ?? "Escaneo sin resultado.");
    process.exitCode = 1;
    return;
  }

  if (out.json) {
    fs.writeFileSync(out.json, toJson(result), "utf8");
    console.log(`JSON: ${out.json}`);
  }
  if (out.markdown) {
    fs.writeFileSync(out.markdown, toMarkdown(result), "utf8");
    console.log(`Markdown: ${out.markdown}`);
  }
  if (out.reportBundleParent) {
    const dir = writeScanBundle(out.reportBundleParent, result);
    console.log(`Paquete de informe: ${dir}`);
  }
  if (out.print) {
    console.log(toMarkdown(result));
  }

  const vulnCount = result.ecosystems.reduce(
    (n, e) => n + e.findings.filter((f) => f.vulns.length).length,
    0
  );
  const secretAuthCritical =
    result.secretAuthScan?.nivel === "riesgo_alto_heuristico";
  if (
    vulnCount ||
    promptScanHardFail ||
    promptChecksFailed(result) ||
    secretAuthCritical
  ) {
    process.exitCode = 1;
  }
}
