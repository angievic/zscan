import { runPromptScanCore } from "../prompt/runPromptScan.js";
import type { ScanResult } from "../types.js";
import {
  performProjectScan,
  type ProjectScanOptions,
  type ProjectScanOutcome,
} from "./projectScan.js";

export interface CombinedScanOutcome extends ProjectScanOutcome {
  /** Error de configuración de prompts (no aplica si solo faltaba `prompts[]`). */
  promptScanHardFail: boolean;
}

/** `true` si el mensaje indica que no hay nada que evaluar (no es fallo del pipeline). */
function isPromptScanOptionalSkip(message: string): boolean {
  return message.includes("No hay entradas en `prompts[]`");
}

/**
 * Escaneo de dependencias + OSV (+ enriquecimiento opcional) y prompt-scan según `zscan.yaml`.
 */
export async function performCombinedScan(
  root: string,
  depOpts: ProjectScanOptions,
  promptOpts: { skipLlm?: boolean }
): Promise<CombinedScanOutcome> {
  const { result, errorMessage } = await performProjectScan(root, depOpts);
  if (!result) {
    return { result: null, errorMessage, promptScanHardFail: false };
  }

  const { result: pr, error: pe } = await runPromptScanCore(root, {
    skipLlm: promptOpts.skipLlm === true,
  });

  let promptScanHardFail = false;

  if (pr) {
    result.prompts = pr;
  } else if (pe) {
    result.promptScanMessage = pe;
    if (!isPromptScanOptionalSkip(pe)) promptScanHardFail = true;
  }

  result.meta = {
    ...result.meta,
    reportSchemaVersion: 2,
  };

  return { result, promptScanHardFail };
}

export function promptChecksFailed(result: ScanResult): boolean {
  return Boolean(
    result.prompts?.files.some((f) => f.checks.some((c) => !c.passed))
  );
}
