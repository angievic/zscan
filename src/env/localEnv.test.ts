import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadEnvLocalFile, removeEnvLocalKey, upsertEnvLocal } from "./localEnv.js";

describe("localEnv", () => {
  const key = "ZSCAN_TEST_LOAD_ENV";

  afterEach(() => {
    delete process.env[key];
  });

  it("loadEnvLocalFile sets ZSCAN_* from .env.local", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zscan-env-"));
    try {
      fs.writeFileSync(
        path.join(dir, ".env.local"),
        `# c\n${key}=hello-world\nOTHER=ignored\n`,
        "utf8"
      );
      delete process.env[key];
      loadEnvLocalFile(dir);
      expect(process.env[key]).toBe("hello-world");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("upsertEnvLocal creates file and removeEnvLocalKey strips line", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zscan-env2-"));
    try {
      upsertEnvLocal(dir, "ZSCAN_FOO", "bar");
      const p = path.join(dir, ".env.local");
      expect(fs.readFileSync(p, "utf8")).toContain("ZSCAN_FOO=bar");
      removeEnvLocalKey(dir, "ZSCAN_FOO");
      expect(fs.readFileSync(p, "utf8")).not.toContain("ZSCAN_FOO=bar");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
