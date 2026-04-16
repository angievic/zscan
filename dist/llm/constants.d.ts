/**
 * Modelo local acordado para evaluaciones de código + políticas YAML (zscan).
 * Cuantización recomendada en disco: Q4_K_M (GGUF), ~2 GB según distribución.
 *
 * Ollama: `ollama pull qwen2.5-coder:3b`
 */
export declare const ZSCAN_LLM_MODEL_DEFAULT = "qwen2.5-coder:3b";
/** Base URL API OpenAI-compatible (sin barra final); Ollama expone `/v1`. */
export declare const ZSCAN_LLM_BASE_URL_DEFAULT = "http://127.0.0.1:11434/v1";
/** Gemini vía capa OpenAI-compatible (Google AI Studio / API key). */
export declare const ZSCAN_GEMINI_OPENAI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
/** Modelo por defecto para Gemini en el asistente `zscan config`. */
export declare const ZSCAN_GEMINI_MODEL_DEFAULT = "gemini-2.0-flash";
/** API Messages de Anthropic (Claude); no usa `/chat/completions`. */
export declare const ZSCAN_ANTHROPIC_BASE_URL_DEFAULT = "https://api.anthropic.com/v1";
/** Modelo por defecto para Claude en el asistente `zscan config`. */
export declare const ZSCAN_CLAUDE_MODEL_DEFAULT = "claude-3-5-sonnet-20241022";
/** Versión de API Anthropic (cabecera obligatoria). */
export declare const ZSCAN_ANTHROPIC_VERSION = "2023-06-01";
