import * as fs from "node:fs";
import * as path from "node:path";
import YAML from "yaml";
import { ZSCAN_LLM_BASE_URL_DEFAULT, ZSCAN_LLM_MODEL_DEFAULT, } from "./llm/constants.js";
/** Nombre del archivo de config en la raíz del proyecto (o `ZSCAN_CONFIG`). */
export const ZSCAN_CONFIG_DEFAULT = "zscan.yaml";
const SUPPORTED_SCHEMA_VERSION = 1;
const DEFAULT_CONFIG = {
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
export function configFileName() {
    return (process.env.ZSCAN_CONFIG || ZSCAN_CONFIG_DEFAULT).trim() || ZSCAN_CONFIG_DEFAULT;
}
export function configPath(root) {
    return path.join(path.resolve(root), configFileName());
}
export function loadConfig(root) {
    const p = configPath(root);
    const base = structuredClone(DEFAULT_CONFIG);
    if (!fs.existsSync(p))
        return base;
    const doc = YAML.parse(fs.readFileSync(p, "utf8"));
    const merged = { ...base, ...doc };
    merged.schema_version = doc.schema_version ?? base.schema_version;
    if (doc.llm) {
        merged.llm = { ...base.llm, ...doc.llm };
    }
    if (typeof merged.schema_version === "number" &&
        merged.schema_version > SUPPORTED_SCHEMA_VERSION) {
        console.warn(`[zscan] schema_version=${merged.schema_version} es mayor que la soportada (${SUPPORTED_SCHEMA_VERSION}); revisa la documentación.`);
    }
    return merged;
}
export function writeDefaultConfig(root, extra) {
    const p = configPath(root);
    const body = { ...structuredClone(DEFAULT_CONFIG), ...extra };
    fs.writeFileSync(p, YAML.stringify(body, { lineWidth: 100 }), "utf8");
    return p;
}
/**
 * Fusiona solo la sección `llm` en `zscan.yaml` preservando el resto del documento.
 */
export function patchYamlLlmSection(root, llmPatch, options) {
    const p = configPath(root);
    if (!fs.existsSync(p)) {
        writeDefaultConfig(root);
    }
    const raw = YAML.parse(fs.readFileSync(p, "utf8"));
    const prev = raw.llm &&
        typeof raw.llm === "object" &&
        raw.llm !== null &&
        !Array.isArray(raw.llm)
        ? { ...raw.llm }
        : {};
    const next = { ...prev };
    for (const [k, v] of Object.entries(llmPatch)) {
        if (v !== undefined)
            next[k] = v;
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
export function defaultConfigYaml() {
    return YAML.stringify(DEFAULT_CONFIG, { lineWidth: 100 });
}
