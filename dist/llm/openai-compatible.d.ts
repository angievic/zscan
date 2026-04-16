export type ChatRole = "system" | "user" | "assistant";
export interface ChatMessage {
    role: ChatRole;
    content: string;
}
export interface ChatCompletionOptions {
    temperature?: number;
    max_tokens?: number;
    signal?: AbortSignal;
}
export declare function chatCompletion(baseUrl: string, model: string, messages: ChatMessage[], options?: ChatCompletionOptions & {
    apiKey?: string;
}): Promise<string>;
