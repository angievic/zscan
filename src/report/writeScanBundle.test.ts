import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import type { ScanResult } from "../types.js";
import { writeScanBundle } from "./writeScanBundle.js";

const minimalResult: ScanResult = {
  root: "/tmp/proj",
  git: {
    isRepository: false,
    repositoryRoot: null,
    headLabel: null,
    submodulePaths: [],
  },
  ecosystems: [
    {
      ecosystem: "npm",
      lockfile: "package-lock.json",
      packages: [{ name: "left-pad", version: "1.0.0" }],
      findings: [
        {
          package: "left-pad",
          version: "1.0.0",
          vulns: [{ id: "TEST-1", summary: "demo" }],
        },
      ],
      tree: {
        name: "proj",
        version: "0.0.0",
        children: [{ name: "left-pad", version: "1.0.0", children: [] }],
      },
      importHints: [],
    },
  ],
};

describe("writeScanBundle", () => {
  it("crea carpeta terminada en -scan con artefactos esperados", () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), "zscan-bundle-"));
    const bundleDir = writeScanBundle(parent, minimalResult);

    expect(bundleDir.startsWith(parent)).toBe(true);
    expect(path.basename(bundleDir).endsWith("-scan")).toBe(true);

    expect(fs.existsSync(path.join(bundleDir, "report.json"))).toBe(true);
    expect(fs.existsSync(path.join(bundleDir, "informe.json"))).toBe(true);
    expect(fs.existsSync(path.join(bundleDir, "prompts.json"))).toBe(true);
    expect(fs.existsSync(path.join(bundleDir, "informe.md"))).toBe(true);
    expect(fs.existsSync(path.join(bundleDir, "report.html"))).toBe(true);

    const informe = JSON.parse(
      fs.readFileSync(path.join(bundleDir, "informe.json"), "utf8")
    );
    expect(informe.zscanInformeVersion).toBe(5);
    expect(informe.resumen.estadisticas.numPaquetes).toBe(1);

    const promptsJ = JSON.parse(
      fs.readFileSync(path.join(bundleDir, "prompts.json"), "utf8")
    );
    expect(promptsJ.zscanPromptsInformeVersion).toBe(1);
    expect(promptsJ.resultado).toBeNull();
    expect(promptsJ.mensaje).toBeNull();

    const ecoMd = path.join(bundleDir, "ecosystems", "npm__package-lock.json.md");
    const ecoJson = path.join(bundleDir, "ecosystems", "npm__package-lock.json.json");
    expect(fs.existsSync(ecoMd)).toBe(true);
    expect(fs.existsSync(ecoJson)).toBe(true);
    expect(fs.readFileSync(ecoMd, "utf8")).toContain("npm");
    expect(JSON.parse(fs.readFileSync(ecoJson, "utf8")).ecosystem).toBe("npm");
    const reportHtml = fs.readFileSync(path.join(bundleDir, "report.html"), "utf8");
    expect(reportHtml).toContain("zscan-b64");
    expect(reportHtml).toContain("zscan-static-summary");
  });
});
