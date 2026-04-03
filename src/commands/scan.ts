import * as fs from "node:fs";
import { toJson, toMarkdown } from "../report.js";
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
  }
) {
  const { result, errorMessage, promptScanHardFail } = await performCombinedScan(
    root,
    {
      ignoreSubmodules: out.ignoreSubmodules,
      offline: out.offline,
      bypassOsvCache: out.bypassOsvCache,
      enrichDocs: out.enrichDocs !== false,
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
  if (out.print) {
    console.log(toMarkdown(result));
  }

  const vulnCount = result.ecosystems.reduce(
    (n, e) => n + e.findings.filter((f) => f.vulns.length).length,
    0
  );
  if (
    vulnCount ||
    promptScanHardFail ||
    promptChecksFailed(result)
  ) {
    process.exitCode = 1;
  }
}
