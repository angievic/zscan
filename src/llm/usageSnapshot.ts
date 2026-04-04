import type { ZscanConfig } from "../config.js";
import type { LlmUsageSnapshot } from "../types.js";
import { resolveLlmOptions } from "./resolve-options.js";

/** Proveedores y modelos de ejemplo soportados por zscan (referencia; no son los activos del run). */
export const LLM_CATALOGO_REFERENCIA: LlmUsageSnapshot["catalogo_referencia"] = [
  {
    nombre: "Ollama (local)",
    ejemplos_modelo: ["qwen2.5-coder:3b", "llama3.2", "mistral", "codellama"],
    nota: "OpenAI-compatible en http://127.0.0.1:11434/v1",
  },
  {
    nombre: "OpenAI",
    ejemplos_modelo: ["gpt-4o-mini", "gpt-4o", "o1-mini"],
    nota: "https://api.openai.com/v1",
  },
  {
    nombre: "Google Gemini (vía API OpenAI-compatible)",
    ejemplos_modelo: ["gemini-2.0-flash", "gemini-1.5-pro"],
    nota: "generativelanguage.googleapis.com/v1beta/openai",
  },
  {
    nombre: "Anthropic Claude",
    ejemplos_modelo: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
    nota: "API Messages (no /chat/completions)",
  },
  {
    nombre: "Azure OpenAI / otros compatibles",
    ejemplos_modelo: ["(deployment name)"],
    nota: "Misma forma que OpenAI con base_url del recurso",
  },
];

function proveedorDescripcion(
  provider: LlmUsageSnapshot["proveedor"]
): string {
  return provider === "anthropic"
    ? "Anthropic — Claude (API Messages)"
    : "OpenAI-compatible — OpenAI, Ollama, Gemini (adaptador), Azure OpenAI, vLLM, LM Studio, etc.";
}

/**
 * Resuelve qué LLM vería zscan para `prompt-scan` / `zscan config` (sin exponer la API key).
 */
export function buildLlmUsageSnapshot(cfg: ZscanConfig): LlmUsageSnapshot {
  const r = resolveLlmOptions(cfg);
  return {
    proveedor: r.provider,
    proveedor_descripcion: proveedorDescripcion(r.provider),
    modelo: r.model,
    base_url: r.baseUrl,
    yaml_llm_enabled: cfg.llm?.enabled === true,
    api_key_configurada: Boolean(r.apiKey && r.apiKey.trim().length > 0),
    env: {
      model: Boolean(process.env.ZSCAN_LLM_MODEL?.trim()),
      base_url: Boolean(process.env.ZSCAN_LLM_BASE_URL?.trim()),
      api_key: Boolean(process.env.ZSCAN_LLM_API_KEY?.trim()),
      provider: Boolean(process.env.ZSCAN_LLM_PROVIDER?.trim()),
    },
    catalogo_referencia: LLM_CATALOGO_REFERENCIA,
  };
}
