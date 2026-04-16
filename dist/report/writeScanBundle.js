import * as fs from "node:fs";
import * as path from "node:path";
import { randomBytes } from "node:crypto";
import { promptScanToMarkdown } from "../prompt/reportPrompt.js";
import { buildInformeView, buildPromptsInformeJson, prettyJson, } from "./informeView.js";
import { buildReportHtml } from "./reportHtml.js";
import { ecosystemToMarkdown, toJson, toMarkdown } from "../report.js";
function safeFilePart(s) {
    return s.replace(/[^a-zA-Z0-9._-]+/g, "_");
}
/** Nombre de carpeta único que termina en `-scan`. */
export function createBundleDirName() {
    return `${randomBytes(10).toString("hex")}-scan`;
}
/**
 * Crea `<parent>/<hex>-scan/` con:
 * - `report.json` — `ScanResult` completo (JSON indentado)
 * - `informe.json` — vista por pestañas (`InformeView`, JSON indentado)
 * - `prompts.json` — siempre; bloque `{ zscanPromptsInformeVersion, generatedAt, resultado, mensaje }`
 * - `report.html` — lee el mismo `InformeView` embebido y pestañas
 * - `informe.md`, `prompts.md`, `ecosystems/*.{json,md}`
 */
export function writeScanBundle(parentDir, result) {
    fs.mkdirSync(parentDir, { recursive: true });
    const bundleDir = path.join(parentDir, createBundleDirName());
    fs.mkdirSync(bundleDir, { recursive: true });
    const ecoDir = path.join(bundleDir, "ecosystems");
    fs.mkdirSync(ecoDir, { recursive: true });
    const informeView = buildInformeView(result);
    fs.writeFileSync(path.join(bundleDir, "report.json"), toJson(result), "utf8");
    fs.writeFileSync(path.join(bundleDir, "informe.json"), prettyJson(informeView), "utf8");
    fs.writeFileSync(path.join(bundleDir, "prompts.json"), prettyJson(buildPromptsInformeJson(result)), "utf8");
    fs.writeFileSync(path.join(bundleDir, "informe.md"), toMarkdown(result), "utf8");
    fs.writeFileSync(path.join(bundleDir, "report.html"), buildReportHtml(result), "utf8");
    for (const eco of result.ecosystems) {
        const base = `${safeFilePart(eco.ecosystem)}__${safeFilePart(path.basename(eco.lockfile))}`;
        fs.writeFileSync(path.join(ecoDir, `${base}.json`), `${JSON.stringify(eco, null, 2)}\n`, "utf8");
        fs.writeFileSync(path.join(ecoDir, `${base}.md`), ecosystemToMarkdown(eco), "utf8");
    }
    if (result.prompts) {
        fs.writeFileSync(path.join(bundleDir, "prompts.md"), promptScanToMarkdown(result.prompts, { embedInScanReport: false }), "utf8");
    }
    else if (result.promptScanMessage) {
        fs.writeFileSync(path.join(bundleDir, "prompts.md"), `# Prompt-scan\n\n${result.promptScanMessage}\n`, "utf8");
    }
    return bundleDir;
}
