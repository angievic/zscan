import { describe, expect, it } from "vitest";
import { analyzePromptDataSensitivity } from "./promptDataSensitivity.js";

describe("analyzePromptDataSensitivity", () => {
  it("detecta entrada de usuario y plantilla", () => {
    const r = analyzePromptDataSensitivity(
      "You are helpful.\nThe user message follows:\n{{user_input}}\n"
    );
    expect(r.tiene_sustituciones).toBe(true);
    expect(r.nivel).toMatch(/media|alta/);
    expect(r.datos_inferidos.some((t) => /usuario|dinámico/i.test(t))).toBe(true);
  });

  it("marca alta si hay referencia explícita a API key en el prompt", () => {
    const r = analyzePromptDataSensitivity(
      "Send your api_key in the header for testing."
    );
    expect(r.nivel).toBe("alta");
    expect(r.detalles.length).toBeGreaterThan(0);
  });

  it("prompt estático corto sin marcadores → baja o indeterminado", () => {
    const r = analyzePromptDataSensitivity(
      "Respond only with JSON. No extra text."
    );
    expect(["baja", "indeterminado"]).toContain(r.nivel);
  });
});
