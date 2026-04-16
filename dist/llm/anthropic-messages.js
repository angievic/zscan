import { ZSCAN_ANTHROPIC_VERSION } from "./constants.js";
function splitSystemAndRest(messages) {
    const sysParts = [];
    const rest = [];
    for (const m of messages) {
        if (m.role === "system") {
            sysParts.push(m.content);
        }
        else if (m.role === "user" || m.role === "assistant") {
            rest.push({ role: m.role, content: m.content });
        }
    }
    return {
        system: sysParts.join("\n\n").trim(),
        rest,
    };
}
/** Anthropic espera turnos user/assistant; fusiona consecutivos del mismo rol. */
function mergeAdjacentRoles(msgs) {
    const out = [];
    for (const m of msgs) {
        const last = out[out.length - 1];
        if (last && last.role === m.role) {
            last.content = `${last.content}\n\n${m.content}`;
        }
        else {
            out.push({ role: m.role, content: m.content });
        }
    }
    return out;
}
/**
 * Claude (Anthropic Messages API). Requiere `x-api-key` y cabecera `anthropic-version`.
 */
export async function chatCompletionAnthropic(baseUrl, model, messages, options) {
    const key = options?.apiKey?.trim();
    if (!key) {
        throw new Error("Anthropic requiere API key (ZSCAN_LLM_API_KEY o llm.api_key)");
    }
    const { system, rest } = splitSystemAndRest(messages);
    const anthropicMessages = mergeAdjacentRoles(rest);
    if (!anthropicMessages.length) {
        throw new Error("Anthropic: se necesita al menos un mensaje user o assistant");
    }
    const root = baseUrl.replace(/\/$/, "");
    const url = `${root}/messages`;
    const body = {
        model,
        max_tokens: options?.max_tokens ?? 4096,
        messages: anthropicMessages.map((m) => ({
            role: m.role,
            content: m.content,
        })),
    };
    if (system)
        body.system = system;
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-api-key": key,
            "anthropic-version": ZSCAN_ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
        signal: options?.signal,
    });
    const raw = await res.text();
    if (!res.ok) {
        throw new Error(`Anthropic HTTP ${res.status}: ${raw.slice(0, 500)}`);
    }
    let data;
    try {
        data = JSON.parse(raw);
    }
    catch {
        throw new Error(`Anthropic respuesta no JSON: ${raw.slice(0, 200)}`);
    }
    if (data.error?.message) {
        throw new Error(data.error.message);
    }
    const block = data.content?.find((c) => c.type === "text" && c.text);
    const text = block?.text;
    if (typeof text !== "string" || !text.trim()) {
        throw new Error("Anthropic sin texto en content[]");
    }
    return text.trim();
}
