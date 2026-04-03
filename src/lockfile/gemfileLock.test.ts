import { describe, expect, it } from "vitest";
import { parseGemfileLockSpecs } from "./gemfileLock.js";

describe("parseGemfileLockSpecs", () => {
  it("extracts gems from GEM specs section", () => {
    const text = `GEM
  remote: https://rubygems.org/
  specs:
    rack (2.2.6)
    nokogiri (1.14.0-x86_64-linux)

PLATFORMS
  ruby
`;
    const pkgs = parseGemfileLockSpecs(text);
    expect(pkgs).toContainEqual({ name: "rack", version: "2.2.6" });
    expect(pkgs).toContainEqual({ name: "nokogiri", version: "1.14.0-x86_64-linux" });
  });

  it("normalizes gem names to lowercase", () => {
    const text = `GEM
  specs:
    JSON (2.6.3)
`;
    expect(parseGemfileLockSpecs(text)).toContainEqual({
      name: "json",
      version: "2.6.3",
    });
  });
});
