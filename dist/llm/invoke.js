import { chatCompletionAnthropic } from "./anthropic-messages.js";
import { chatCompletion, } from "./openai-compatible.js";
/**
 * Una llamada de chat según `provider`: OpenAI-compatible (OpenAI, Ollama, Gemini) o Anthropic (Claude).
 */
export async function invokeChat(opts, messages, request) {
    if (opts.provider === "anthropic") {
        return chatCompletionAnthropic(opts.baseUrl, opts.model, messages, {
            ...request,
            apiKey: opts.apiKey,
        });
    }
    return chatCompletion(opts.baseUrl, opts.model, messages, {
        ...request,
        apiKey: opts.apiKey,
    });
}
