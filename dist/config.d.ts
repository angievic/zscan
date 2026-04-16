import type { LlmProvider } from "./llm/provider.js";
/** Nombre del archivo de config en la raíz del proyecto (o `ZSCAN_CONFIG`). */
export declare const ZSCAN_CONFIG_DEFAULT = "zscan.yaml";
export interface ZscanConfig {
    /**
     * Versión del esquema de este YAML (campos soportados por zscan).
     * Incrementar cuando se añadan claves incompatibles.
     */
    schema_version?: number;
    version: number;
    /**
     * Evaluador local vía API OpenAI-compatible (p. ej. Ollama).
     * Modelo por defecto del proyecto: Qwen2.5-Coder 3B → `qwen2.5-coder:3b`.
     */
    llm?: {
        enabled?: boolean;
        model?: string;
        base_url?: string;
        /**
         * `anthropic` → API Messages (Claude). Omitir o `openai_compatible` → `/chat/completions`
         * (OpenAI, Ollama, Gemini).
         */
        provider?: LlmProvider;
        /** Preferir variable de entorno `ZSCAN_LLM_API_KEY` en CI. */
        api_key?: string;
    };
    prompts?: {
        paths: string[];
        purpose: string;
    }[];
    reliability?: {
        prompts_min_percent?: number;
        dependencies?: {
            default_min_percent?: number;
            structural_critical?: {
                auto_threshold_percent?: number;
                explicit_core?: string[];
            };
            packages?: Record<string, {
                min_percent?: number;
                critical?: boolean;
            }>;
        };
    };
    /**
     * Reglas en `prompt-scan`: con `pattern` se evalúa por regex (origen yaml_rule).
     * Con `llm.enabled: true`, todas las entradas se evalúan también por el modelo
     * según `description` (origen llm); sin `pattern` y sin LLM se listan como omitidas.
     */
    rules?: {
        id: string;
        description: string;
        pattern?: string;
    }[];
}
export declare function configFileName(): string;
export declare function configPath(root: string): string;
export declare function loadConfig(root: string): ZscanConfig;
export declare function writeDefaultConfig(root: string, extra?: Partial<ZscanConfig>): string;
/**
 * Fusiona solo la sección `llm` en `zscan.yaml` preservando el resto del documento.
 */
export declare function patchYamlLlmSection(root: string, llmPatch: Partial<NonNullable<ZscanConfig["llm"]>>, options?: {
    removeApiKeyFromYaml?: boolean;
    dropProviderField?: boolean;
}): void;
export declare function defaultConfigYaml(): string;
