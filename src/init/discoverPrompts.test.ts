import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { discoverPromptGroupsForInit } from "./discoverPrompts.js";

describe("discoverPromptGroupsForInit", () => {
  let tmp: string;

  afterEach(() => {
    if (tmp && fs.existsSync(tmp)) {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("sin archivos devuelve plantilla por defecto", () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zscan-init-"));
    const g = discoverPromptGroupsForInit(tmp);
    expect(g).toHaveLength(1);
    expect(g[0]!.paths).toEqual(["docs/**/*.md", "prompts/**/*.md"]);
  });

  it("detecta docs/**/*.md y README en la raíz", () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zscan-init-"));
    fs.mkdirSync(path.join(tmp, "docs"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "docs", "a.md"), "# x\n");
    fs.writeFileSync(path.join(tmp, "README.md"), "# r\n");
    const g = discoverPromptGroupsForInit(tmp);
    const purposes = g.map((x) => x.purpose);
    expect(purposes.some((p) => p.includes("docs/"))).toBe(true);
    expect(purposes.some((p) => p.includes("README principal"))).toBe(true);
  });

  it("detecta src/ con literal tipo prompt en TypeScript", () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zscan-init-"));
    fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, "src", "llm.ts"),
      `const system = \`You are an assistant. ${"z".repeat(80)}\`;\n`
    );
    const g = discoverPromptGroupsForInit(tmp);
    expect(
      g.some(
        (x) =>
          x.purpose.includes("Código fuente") &&
          x.paths.some((p) => p.includes("src/"))
      )
    ).toBe(true);
  });
});
