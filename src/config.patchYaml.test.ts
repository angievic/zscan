import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import YAML from "yaml";
import { afterEach, describe, expect, it } from "vitest";
import { patchYamlLlmSection, writeDefaultConfig } from "./config.js";

describe("patchYamlLlmSection", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const d of dirs.splice(0)) {
      fs.rmSync(d, { recursive: true, force: true });
    }
  });

  it("merges llm and can drop provider and api_key", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "zscan-cfg-"));
    dirs.push(root);
    writeDefaultConfig(root);
    patchYamlLlmSection(
      root,
      {
        enabled: true,
        model: "m1",
        base_url: "https://x/v1",
        provider: "anthropic",
        api_key: "secret",
      },
      { removeApiKeyFromYaml: true }
    );
    let raw = YAML.parse(fs.readFileSync(path.join(root, "zscan.yaml"), "utf8")) as {
      llm: Record<string, unknown>;
    };
    expect(raw.llm.enabled).toBe(true);
    expect(raw.llm.model).toBe("m1");
    expect(raw.llm.provider).toBe("anthropic");
    expect(raw.llm.api_key).toBeUndefined();

    patchYamlLlmSection(
      root,
      { base_url: "http://ollama/v1" },
      { removeApiKeyFromYaml: true, dropProviderField: true }
    );
    raw = YAML.parse(fs.readFileSync(path.join(root, "zscan.yaml"), "utf8")) as {
      llm: Record<string, unknown>;
    };
    expect(raw.llm.provider).toBeUndefined();
    expect(raw.llm.base_url).toBe("http://ollama/v1");
  });
});
