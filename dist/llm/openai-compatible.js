export async function chatCompletion(baseUrl, model, messages, options) {
    const root = baseUrl.replace(/\/$/, "");
    const url = `${root}/chat/completions`;
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            ...(options?.apiKey ? { authorization: `Bearer ${options.apiKey}` } : {}),
        },
        body: JSON.stringify({
            model,
            messages,
            temperature: options?.temperature ?? 0.1,
            max_tokens: options?.max_tokens ?? 512,
        }),
        signal: options?.signal,
    });
    const raw = await res.text();
    if (!res.ok) {
        throw new Error(`LLM HTTP ${res.status}: ${raw.slice(0, 500)}`);
    }
    let data;
    try {
        data = JSON.parse(raw);
    }
    catch {
        throw new Error(`LLM respuesta no JSON: ${raw.slice(0, 200)}`);
    }
    if (data.error?.message) {
        throw new Error(data.error.message);
    }
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
        throw new Error("LLM sin contenido en choices[0].message.content");
    }
    return text.trim();
}
