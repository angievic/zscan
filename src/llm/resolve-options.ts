import type { ZscanConfig } from "../config.js";
import {
  ZSCAN_LLM_BASE_URL_DEFAULT,
  ZSCAN_LLM_MODEL_DEFAULT,
} from "./constants.js";
import type { LlmProvider } from "./provider.js";

export type { LlmProvider } from "./provider.js";

export interface ResolvedLlmOptions {
  baseUrl: string;
  model: string;
  apiKey?: string;
  enabled: boolean;
  provider: LlmProvider;
}

function inferProvider(
  baseUrl: string,
  explicit?: string
): LlmProvider {
  const e = explicit?.trim().toLowerCase();
  if (e === "anthropic" || e === "claude") return "anthropic";
  if (
    e === "openai_compatible" ||
    e === "openai" ||
    e === "gemini" ||
    e === "google"
  ) {
    return "openai_compatible";
  }
  const u = baseUrl.toLowerCase();
  if (u.includes("api.anthropic.com")) return "anthropic";
  return "openai_compatible";
}

export function resolveLlmOptions(cfg: ZscanConfig): ResolvedLlmOptions {
  const llm = cfg.llm;
  const baseUrl =
    process.env.ZSCAN_LLM_BASE_URL?.trim() ||
    llm?.base_url?.trim() ||
    ZSCAN_LLM_BASE_URL_DEFAULT;
  const envProv = process.env.ZSCAN_LLM_PROVIDER?.trim();
  const yamlProv = llm?.provider?.trim();
  return {
    enabled: llm?.enabled === true,
    baseUrl,
    model:
      process.env.ZSCAN_LLM_MODEL?.trim() ||
      llm?.model?.trim() ||
      ZSCAN_LLM_MODEL_DEFAULT,
    apiKey:
      process.env.ZSCAN_LLM_API_KEY?.trim() || llm?.api_key?.trim() || undefined,
    provider: inferProvider(baseUrl, envProv ?? yamlProv),
  };
}
