import type { ZscanConfig } from "../config.js";
import { BUILTIN_HEURISTICS } from "./builtin-heuristics.js";
import {
  analyzePromptDataSensitivity,
  type PromptDataSensitivityAssessment,
} from "./promptDataSensitivity.js";

export type {
  PromptDataSensitivityAssessment,
  PromptDataSensitivityDetail,
  PromptDataSensitivityLevel,
} from "./promptDataSensitivity.js";

export type PromptFindingOrigin = "yaml_rule" | "heuristic" | "llm";

/** Resultado de una comprobación (pasa o falla) sobre un archivo. */
export interface PromptRuleResult {
  origin: PromptFindingOrigin;
  ruleId: string;
  ruleDescription?: string;
  passed: boolean;
  /** 100 si pasa, 0 si falla esta comprobación. */
  scorePercent: number;
  line: number;
  /** Fragmento de línea o mensaje corto. */
  citation: string;
}

export interface PromptFileResult {
  absolutePath: string;
  relativePath: string;
  purpose: string;
  /** Mínimo de los scorePercent de cada check (estricto). */
  scorePercent: number;
  checks: PromptRuleResult[];
  /** Qué tipo de datos parece entrar al prompt y sensibilidad inferida (heurístico). */
  dataSensitivity: PromptDataSensitivityAssessment;
}

export interface PromptScanResult {
  root: string;
  minRequiredPercent: number;
  files: PromptFileResult[];
  /** Relativas a root por debajo del umbral. */
  belowThreshold: string[];
  /** Reglas YAML sin `pattern` cuando el LLM está desactivado (no evaluadas). */
  skippedYamlRules: { id: string; reason: string }[];
  /** Errores de red/parseo al llamar al LLM (un elemento por archivo si aplica). */
  llmErrors?: string[];
  /** Errores al compilar regex de reglas YAML. */
  patternErrors: { ruleId: string; message: string }[];
}

function firstMatchLine(
  lines: string[],
  pattern: RegExp
): { line: number; citation: string } | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (pattern.test(line)) {
      return { line: i + 1, citation: line.trim().slice(0, 280) };
    }
  }
  return null;
}

export function evaluatePromptContent(
  absolutePath: string,
  relativePath: string,
  purpose: string,
  content: string,
  cfg: ZscanConfig,
  opts?: { llmCoversRulesWithoutPattern?: boolean }
): {
  fileResult: PromptFileResult;
  skipped: { id: string; reason: string }[];
  patternErrors: { ruleId: string; message: string }[];
} {
  const lines = content.split(/\r?\n/);
  const checks: PromptRuleResult[] = [];
  const skipped: { id: string; reason: string }[] = [];
  const patternErrors: { ruleId: string; message: string }[] = [];

  for (const h of BUILTIN_HEURISTICS) {
    const hit = firstMatchLine(lines, h.pattern);
    if (hit) {
      checks.push({
        origin: "heuristic",
        ruleId: h.id,
        ruleDescription: h.description,
        passed: false,
        scorePercent: 0,
        line: hit.line,
        citation: hit.citation,
      });
    } else {
      checks.push({
        origin: "heuristic",
        ruleId: h.id,
        ruleDescription: h.description,
        passed: true,
        scorePercent: 100,
        line: 0,
        citation: "(sin coincidencia en este archivo)",
      });
    }
  }

  const yamlRules = cfg.rules ?? [];
  const llmWillCoverRules =
    opts?.llmCoversRulesWithoutPattern !== undefined
      ? opts.llmCoversRulesWithoutPattern
      : cfg.llm?.enabled === true;
  for (const r of yamlRules) {
    if (!r.pattern?.trim()) {
      if (!llmWillCoverRules) {
        skipped.push({
          id: r.id,
          reason:
            "sin campo `pattern`; activa `llm.enabled: true` en zscan.yaml para evaluarlas con el modelo",
        });
      }
      continue;
    }
    let re: RegExp;
    try {
      const raw = r.pattern.trim();
      const body = raw.replace(/^\(\?i\)/, "");
      re = new RegExp(body, "i");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      patternErrors.push({ ruleId: r.id, message: msg });
      checks.push({
        origin: "yaml_rule",
        ruleId: r.id,
        ruleDescription: r.description,
        passed: false,
        scorePercent: 0,
        line: 0,
        citation: `[regex inválido] ${msg}`,
      });
      continue;
    }

    const hit = firstMatchLine(lines, re);
    if (hit) {
      checks.push({
        origin: "yaml_rule",
        ruleId: r.id,
        ruleDescription: r.description,
        passed: false,
        scorePercent: 0,
        line: hit.line,
        citation: hit.citation,
      });
    } else {
      checks.push({
        origin: "yaml_rule",
        ruleId: r.id,
        ruleDescription: r.description,
        passed: true,
        scorePercent: 100,
        line: 0,
        citation: "(sin coincidencia en este archivo)",
      });
    }
  }

  const scores = checks.map((c) => c.scorePercent);
  const fileScore = scores.length ? Math.min(...scores) : 100;
  const dataSensitivity = analyzePromptDataSensitivity(content);

  return {
    fileResult: {
      absolutePath,
      relativePath,
      purpose,
      scorePercent: fileScore,
      checks,
      dataSensitivity,
    },
    skipped,
    patternErrors,
  };
}

export function mergePromptScanMeta(
  acc: {
    skipped: { id: string; reason: string }[];
    patternErrors: { ruleId: string; message: string }[];
  },
  next: {
    skipped: { id: string; reason: string }[];
    patternErrors: { ruleId: string; message: string }[];
  }
): void {
  const seen = new Set(acc.skipped.map((s) => s.id + s.reason));
  for (const s of next.skipped) {
    const k = s.id + s.reason;
    if (!seen.has(k)) {
      seen.add(k);
      acc.skipped.push(s);
    }
  }
  const seenE = new Set(acc.patternErrors.map((e) => e.ruleId));
  for (const e of next.patternErrors) {
    if (!seenE.has(e.ruleId)) {
      seenE.add(e.ruleId);
      acc.patternErrors.push(e);
    }
  }
}
