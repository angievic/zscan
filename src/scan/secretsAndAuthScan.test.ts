import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { scanSecretsAndAuth } from "./secretsAndAuthScan.js";

describe("scanSecretsAndAuth", () => {
  it("detecta Access Key ID estilo AWS en código", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zscan-sauth-"));
    try {
      fs.writeFileSync(
        path.join(dir, "cfg.ts"),
        'const a = "AKIA1234567890ABCDEF";\n',
        "utf8"
      );
      const r = scanSecretsAndAuth(dir);
      expect(r.hallazgos.some((h) => h.titulo.includes("AWS"))).toBe(true);
      expect(r.nivel).toBe("riesgo_alto_heuristico");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("omite líneas que usan process.env", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zscan-sauth-"));
    try {
      fs.writeFileSync(
        path.join(dir, "ok.ts"),
        "const k = process.env.AWS_KEY;\n",
        "utf8"
      );
      const r = scanSecretsAndAuth(dir);
      expect(r.hallazgos.length).toBe(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
