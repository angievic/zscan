import { type ChatCompletionOptions, type ChatMessage } from "./openai-compatible.js";
import type { ResolvedLlmOptions } from "./resolve-options.js";
/**
 * Una llamada de chat según `provider`: OpenAI-compatible (OpenAI, Ollama, Gemini) o Anthropic (Claude).
 */
export declare function invokeChat(opts: ResolvedLlmOptions, messages: ChatMessage[], request?: ChatCompletionOptions): Promise<string>;
