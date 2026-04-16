import type { ChatCompletionOptions, ChatMessage } from "./openai-compatible.js";
/**
 * Claude (Anthropic Messages API). Requiere `x-api-key` y cabecera `anthropic-version`.
 */
export declare function chatCompletionAnthropic(baseUrl: string, model: string, messages: ChatMessage[], options?: ChatCompletionOptions & {
    apiKey?: string;
}): Promise<string>;
