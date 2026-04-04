import { describe, expect, it } from "vitest";
import {
  classifyOsvSeverities,
  numericCvssToQualitative,
  worseClassified,
} from "./cvssSeverity.js";

describe("cvssSeverity", () => {
  it("mapea puntuación base a bandas FIRST / CVSS v3", () => {
    expect(numericCvssToQualitative(0)).toBe("NONE");
    expect(numericCvssToQualitative(3.9)).toBe("LOW");
    expect(numericCvssToQualitative(4)).toBe("MEDIUM");
    expect(numericCvssToQualitative(6.9)).toBe("MEDIUM");
    expect(numericCvssToQualitative(7)).toBe("HIGH");
    expect(numericCvssToQualitative(8.9)).toBe("HIGH");
    expect(numericCvssToQualitative(9)).toBe("CRITICAL");
    expect(numericCvssToQualitative(10)).toBe("CRITICAL");
  });

  it("clasifica severidades OSV con número al inicio del score", () => {
    const c = classifyOsvSeverities([
      { type: "CVSS_V3", score: "7.5 CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H" },
    ]);
    expect(c.qualitative).toBe("HIGH");
    expect(c.baseScore).toBe(7.5);
    expect(c.scheme).toBe("CVSS_V3");
  });

  it("prefiere CVSS_V4 sobre CVSS_V3 cuando ambos tienen número", () => {
    const c = classifyOsvSeverities([
      { type: "CVSS_V3", score: "5.0" },
      { type: "CVSS_V4", score: "8.2" },
    ]);
    expect(c.baseScore).toBe(8.2);
    expect(c.qualitative).toBe("HIGH");
  });

  it("worseClassified elige la peor banda", () => {
    const a = classifyOsvSeverities([{ type: "CVSS_V3", score: "3.0" }]);
    const b = classifyOsvSeverities([{ type: "CVSS_V3", score: "9.1" }]);
    expect(worseClassified(a, b).qualitative).toBe("CRITICAL");
  });
});
