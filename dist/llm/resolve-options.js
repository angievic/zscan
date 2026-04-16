import { ZSCAN_LLM_BASE_URL_DEFAULT, ZSCAN_LLM_MODEL_DEFAULT, } from "./constants.js";
function inferProvider(baseUrl, explicit) {
    const e = explicit?.trim().toLowerCase();
    if (e === "anthropic" || e === "claude")
        return "anthropic";
    if (e === "openai_compatible" ||
        e === "openai" ||
        e === "gemini" ||
        e === "google") {
        return "openai_compatible";
    }
    const u = baseUrl.toLowerCase();
    if (u.includes("api.anthropic.com"))
        return "anthropic";
    return "openai_compatible";
}
export function resolveLlmOptions(cfg) {
    const llm = cfg.llm;
    const baseUrl = process.env.ZSCAN_LLM_BASE_URL?.trim() ||
        llm?.base_url?.trim() ||
        ZSCAN_LLM_BASE_URL_DEFAULT;
    const envProv = process.env.ZSCAN_LLM_PROVIDER?.trim();
    const yamlProv = llm?.provider?.trim();
    return {
        enabled: llm?.enabled === true,
        baseUrl,
        model: process.env.ZSCAN_LLM_MODEL?.trim() ||
            llm?.model?.trim() ||
            ZSCAN_LLM_MODEL_DEFAULT,
        apiKey: process.env.ZSCAN_LLM_API_KEY?.trim() || llm?.api_key?.trim() || undefined,
        provider: inferProvider(baseUrl, envProv ?? yamlProv),
    };
}
