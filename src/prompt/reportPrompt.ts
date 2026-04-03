import type { PromptScanResult } from "./evaluate.js";

export function promptScanToJson(result: PromptScanResult): string {
  return JSON.stringify(result, null, 2);
}

export function promptScanToMarkdown(
  result: PromptScanResult,
  opts?: { embedInScanReport?: boolean }
): string {
  const embed = opts?.embedInScanReport === true;
  const L = (n: number) => "#".repeat(n + (embed ? 1 : 0));
  const title = embed
    ? "Prompts y reglas (`zscan.yaml`)"
    : "zscan — informe prompt-scan";

  const lines: string[] = [
    `${L(1)} ${title}`,
    "",
    `- **Raíz:** \`${result.root}\``,
    `- **Umbral mínimo (\`reliability.prompts_min_percent\`):** ${result.minRequiredPercent}%`,
    `- **Archivos analizados:** ${result.files.length}`,
    "",
  ];

  if (result.skippedYamlRules.length) {
    lines.push(`${L(2)} Reglas YAML no evaluadas (sin \`pattern\`)`, "");
    for (const s of result.skippedYamlRules) {
      lines.push(`- **${s.id}:** ${s.reason}`);
    }
    lines.push("");
  }

  if (result.patternErrors.length) {
    lines.push(`${L(2)} Errores de regex en reglas YAML`, "");
    for (const e of result.patternErrors) {
      lines.push(`- **${e.ruleId}:** ${e.message}`);
    }
    lines.push("");
  }

  if (result.llmErrors?.length) {
    lines.push(`${L(2)} Avisos LLM (prompt-scan)`, "");
    for (const e of result.llmErrors) {
      lines.push(`- ${e}`);
    }
    lines.push("");
  }

  if (result.belowThreshold.length) {
    lines.push(
      `${L(2)} Por debajo del umbral`,
      "",
      ...result.belowThreshold.map((p) => `- \`${p}\``),
      ""
    );
  }

  for (const f of result.files) {
    lines.push(
      `${L(2)} \`${f.relativePath}\``,
      "",
      `- **Objetivo (YAML):** ${f.purpose}`,
      `- **Puntuación del archivo (mínimo de checks):** ${f.scorePercent}%`,
      "",
      `${L(3)} Comprobaciones`,
      "",
      "| Origen | Regla | OK | % | Línea | Cita |",
      "|--------|-------|----|---|-------|------|"
    );

    for (const c of f.checks) {
      const ok = c.passed ? "sí" : "no";
      const cite = c.citation.replace(/\|/g, "\\|").replace(/\n/g, " ");
      lines.push(
        `| \`${c.origin}\` | \`${c.ruleId}\` | ${ok} | ${c.scorePercent} | ${c.line || "—"} | ${cite.slice(0, 120)}${cite.length > 120 ? "…" : ""} |`
      );
    }

    const fails = f.checks.filter((c) => !c.passed);
    if (fails.length) {
      lines.push("", `${L(4)} Hallazgos (fallos)`, "");
      for (const c of fails) {
        lines.push(
          `- **\`${c.origin}\` / \`${c.ruleId}\`** (L${c.line}): ${c.ruleDescription ?? ""}`,
          `  - \`${c.citation.slice(0, 400)}\`${c.citation.length > 400 ? "…" : ""}`,
          ""
        );
      }
    }
    lines.push("");
  }

  lines.push(
    "---",
    "",
    "Origen **yaml_rule** = regla con `pattern` (regex). **heuristic** = heurística integrada. **llm** = evaluación semántica vía API OpenAI-compatible (`llm` en YAML) usando `rules[]` y `purpose`."
  );

  return lines.join("\n");
}
