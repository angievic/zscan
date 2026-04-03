import { describe, expect, it } from "vitest";
import { parseGoModRequires } from "./goMod.js";

describe("parseGoModRequires", () => {
  it("parses require block with comments", () => {
    const text = `
module example.com/foo

go 1.21

require (
    github.com/bar/baz v1.2.3
    golang.org/x/net v0.17.0 // indirect
)
`;
    const pkgs = parseGoModRequires(text);
    expect(pkgs).toContainEqual({ name: "github.com/bar/baz", version: "v1.2.3" });
    expect(pkgs).toContainEqual({ name: "golang.org/x/net", version: "v0.17.0" });
  });

  it("parses single-line require", () => {
    const text = `
require github.com/single/mod v0.0.1
`;
    expect(parseGoModRequires(text)).toContainEqual({
      name: "github.com/single/mod",
      version: "v0.0.1",
    });
  });

  it("skips go and toolchain tokens in block", () => {
    const text = `
require (
    go 1.22
    toolchain go1.22.1
    example.com/x v1.0.0
)
`;
    const pkgs = parseGoModRequires(text);
    expect(pkgs.some((p) => p.name === "go")).toBe(false);
    expect(pkgs.some((p) => p.name === "toolchain")).toBe(false);
    expect(pkgs).toContainEqual({ name: "example.com/x", version: "v1.0.0" });
  });

  it("dedupes same module@version from block and line require", () => {
    const text = `
require github.com/dup/mod v1.0.0
require (
    github.com/dup/mod v1.0.0
)
`;
    const pkgs = parseGoModRequires(text);
    expect(pkgs.filter((p) => p.name === "github.com/dup/mod")).toHaveLength(1);
  });
});
