import type { ZscanConfig } from "../config.js";
import type { ResolvedLlmOptions } from "../llm/resolve-options.js";
import type { PromptFileResult } from "./evaluate.js";
/**
 * Añade comprobaciones con origen `llm` según `rules[]` del YAML (id + description,
 * opcionalmente pattern como pista). Requiere `llm.enabled` y API alcanzable.
 */
export declare function appendLlmRuleChecks(fileResult: PromptFileResult, content: string, cfg: ZscanConfig, llm: ResolvedLlmOptions): Promise<string | undefined>;
