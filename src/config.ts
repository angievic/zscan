import * as fs from "node:fs";
import * as path from "node:path";
import YAML from "yaml";
import {
  ZSCAN_LLM_BASE_URL_DEFAULT,
  ZSCAN_LLM_MODEL_DEFAULT,
} from "./llm/constants.js";
import type { LlmProvider } from "./llm/provider.js";

/** Nombre del archivo de config en la raíz del proyecto (o `ZSCAN_CONFIG`). */
export const ZSCAN_CONFIG_DEFAULT = "zscan.yaml";

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
  prompts?: { paths: string[]; purpose: string }[];
  reliability?: {
    prompts_min_percent?: number;
    dependencies?: {
      default_min_percent?: number;
      structural_critical?: {
        auto_threshold_percent?: number;
        explicit_core?: string[];
      };
      packages?: Record<
        string,
        { min_percent?: number; critical?: boolean }
      >;
    };
  };
  /**
   * Reglas en `prompt-scan`: con `pattern` se evalúa por regex (origen yaml_rule).
   * Con `llm.enabled: true`, todas las entradas se evalúan también por el modelo
   * según `description` (origen llm); sin `pattern` y sin LLM se listan como omitidas.
   */
  rules?: { id: string; description: string; pattern?: string }[];
}

const SUPPORTED_SCHEMA_VERSION = 1;

const DEFAULT_CONFIG: ZscanConfig = {
  schema_version: 1,
  version: 1,
  llm: {
    enabled: false,
    model: ZSCAN_LLM_MODEL_DEFAULT,
    base_url: ZSCAN_LLM_BASE_URL_DEFAULT,
  },
  prompts: [],
  reliability: {
    prompts_min_percent: 85,
    dependencies: {
      default_min_percent: 70,
      structural_critical: {
        auto_threshold_percent: 80,
        explicit_core: [],
      },
      packages: {},
    },
  },
  rules: [],
};

export function configFileName(): string {
  return (process.env.ZSCAN_CONFIG || ZSCAN_CONFIG_DEFAULT).trim() || ZSCAN_CONFIG_DEFAULT;
}

export function configPath(root: string): string {
  return path.join(path.resolve(root), configFileName());
}

export function loadConfig(root: string): ZscanConfig {
  const p = configPath(root);
  const base = structuredClone(DEFAULT_CONFIG);
  if (!fs.existsSync(p)) return base;
  const doc = YAML.parse(fs.readFileSync(p, "utf8")) as ZscanConfig;
  const merged: ZscanConfig = { ...base, ...doc };
  merged.schema_version = doc.schema_version ?? base.schema_version;
  if (doc.llm) {
    merged.llm = { ...base.llm, ...doc.llm };
  }
  if (
    typeof merged.schema_version === "number" &&
    merged.schema_version > SUPPORTED_SCHEMA_VERSION
  ) {
    console.warn(
      `[zscan] schema_version=${merged.schema_version} es mayor que la soportada (${SUPPORTED_SCHEMA_VERSION}); revisa la documentación.`
    );
  }
  return merged;
}

export function writeDefaultConfig(root: string, extra?: Partial<ZscanConfig>) {
  const p = configPath(root);
  const body = { ...structuredClone(DEFAULT_CONFIG), ...extra };
  fs.writeFileSync(p, YAML.stringify(body, { lineWidth: 100 }), "utf8");
  return p;
}

/**
 * Fusiona solo la sección `llm` en `zscan.yaml` preservando el resto del documento.
 */
export function patchYamlLlmSection(
  root: string,
  llmPatch: Partial<NonNullable<ZscanConfig["llm"]>>,
  options?: { removeApiKeyFromYaml?: boolean; dropProviderField?: boolean }
): void {
  const p = configPath(root);
  if (!fs.existsSync(p)) {
    writeDefaultConfig(root);
  }
  const raw = YAML.parse(fs.readFileSync(p, "utf8")) as Record<string, unknown>;
  const prev =
    raw.llm &&
    typeof raw.llm === "object" &&
    raw.llm !== null &&
    !Array.isArray(raw.llm)
      ? { ...(raw.llm as Record<string, unknown>) }
      : {};
  const next: Record<string, unknown> = { ...prev };
  for (const [k, v] of Object.entries(llmPatch)) {
    if (v !== undefined) next[k] = v;
  }
  if (options?.removeApiKeyFromYaml) {
    delete next.api_key;
  }
  if (options?.dropProviderField) {
    delete next.provider;
  }
  raw.llm = next;
  fs.writeFileSync(p, YAML.stringify(raw, { lineWidth: 100 }), "utf8");
}

export function defaultConfigYaml(): string {
  return YAML.stringify(DEFAULT_CONFIG, { lineWidth: 100 });
}
