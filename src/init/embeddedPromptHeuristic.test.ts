import { describe, expect, it } from "vitest";
import { mayContainEmbeddedPromptLiterals } from "./embeddedPromptHeuristic.js";

describe("mayContainEmbeddedPromptLiterals", () => {
  it("rechaza código corto sin literales largos", () => {
    expect(mayContainEmbeddedPromptLiterals("const x = 1;")).toBe(false);
  });

  it("detecta template JS largo + palabra system", () => {
    const body =
      "const p = `You are a helpful assistant. " + "x".repeat(80) + "`;\n";
    expect(mayContainEmbeddedPromptLiterals(body)).toBe(true);
  });

  it("detecta triple comilla Python", () => {
    const body = `x = """Act as a teacher.\n${"y".repeat(80)}\n"""\n`;
    expect(mayContainEmbeddedPromptLiterals(body)).toBe(true);
  });
});
