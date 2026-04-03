import * as fs from "node:fs";
import * as path from "node:path";
import { loadConfig } from "../config.js";
import { loadEnvLocalFile } from "../env/localEnv.js";
import { resolveLlmOptions } from "../llm/resolve-options.js";
import {
  evaluatePromptContent,
  mergePromptScanMeta,
  type PromptScanResult,
} from "./evaluate.js";
import { appendLlmRuleChecks } from "./evaluateLlm.js";
import { expandPromptPaths } from "./expandPaths.js";

export async function runPromptScanCore(
  root: string,
  options?: { skipLlm?: boolean }
): Promise<{ result: PromptScanResult | null; error?: string }> {
  const abs = path.resolve(root);
  loadEnvLocalFile(abs);
  const cfg = loadConfig(abs);
  const llmOpts = resolveLlmOptions(cfg);
  const useLlmForScan =
    llmOpts.enabled && options?.skipLlm !== true;
  const groups = cfg.prompts ?? [];
  const minRequired = cfg.reliability?.prompts_min_percent ?? 85;

  if (!groups.length) {
    return {
      result: null,
      error:
        "No hay entradas en `prompts[]` de zscan.yaml; añade paths y `purpose`, o usa `zscan init`.",
    };
  }

  const skippedYamlRules: { id: string; reason: string }[] = [];
  const patternErrors: { ruleId: string; message: string }[] = [];
  const llmErrors: string[] = [];
  const files: PromptScanResult["files"] = [];

  for (const group of groups) {
    const paths = group.paths ?? [];
    if (!paths.length) continue;

    let resolved: string[];
    try {
      resolved = await expandPromptPaths(abs, paths);
    } catch (e) {
      return {
        result: null,
        error: `Glob inválido o error al expandir paths: ${e instanceof Error ? e.message : e}`,
      };
    }

    for (const fileAbs of resolved) {
      let content: string;
      try {
        content = fs.readFileSync(fileAbs, "utf8");
      } catch {
        continue;
      }
      const rel = path.relative(abs, fileAbs);
      const { fileResult, skipped, patternErrors: pe } = evaluatePromptContent(
        fileAbs,
        rel,
        group.purpose ?? "(sin purpose en YAML)",
        content,
        cfg,
        { llmCoversRulesWithoutPattern: useLlmForScan }
      );
      if (useLlmForScan && (cfg.rules?.length ?? 0) > 0) {
        const llmErr = await appendLlmRuleChecks(
          fileResult,
          content,
          cfg,
          llmOpts
        );
        if (llmErr) llmErrors.push(`${rel}: ${llmErr}`);
      }
      mergePromptScanMeta({ skipped: skippedYamlRules, patternErrors }, { skipped, patternErrors: pe });
      files.push(fileResult);
    }
  }

  if (!files.length) {
    return {
      result: null,
      error:
        "Los globs de `prompts[]` no coincidieron con ningún archivo (revisa rutas y .gitignore implícito).",
    };
  }

  const belowThreshold = files
    .filter((f) => f.scorePercent < minRequired)
    .map((f) => f.relativePath);

  const result: PromptScanResult = {
    root: abs,
    minRequiredPercent: minRequired,
    files,
    belowThreshold,
    skippedYamlRules,
    patternErrors,
    ...(llmErrors.length ? { llmErrors } : {}),
  };

  return { result };
}
