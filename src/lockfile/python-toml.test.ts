import { describe, expect, it } from "vitest";
import { parseTomlPackageBlocks } from "./python.js";

describe("parseTomlPackageBlocks", () => {
  it("parses poetry-style [[package]] blocks", () => {
    const content = `
[[package]]
name = "requests"
version = "2.31.0"

[[package]]
name = "urllib3"
version = "2.0.0"
`;
    const pkgs = parseTomlPackageBlocks(content);
    expect(pkgs).toContainEqual({ name: "requests", version: "2.31.0" });
    expect(pkgs).toContainEqual({ name: "urllib3", version: "2.0.0" });
  });
});
