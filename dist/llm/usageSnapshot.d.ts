import type { ZscanConfig } from "../config.js";
import type { LlmUsageSnapshot } from "../types.js";
/** Proveedores y modelos de ejemplo soportados por zscan (referencia; no son los activos del run). */
export declare const LLM_CATALOGO_REFERENCIA: LlmUsageSnapshot["catalogo_referencia"];
/**
 * Resuelve qué LLM vería zscan para `prompt-scan` / `zscan config` (sin exponer la API key).
 */
export declare function buildLlmUsageSnapshot(cfg: ZscanConfig): LlmUsageSnapshot;
