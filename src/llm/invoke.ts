import { chatCompletionAnthropic } from "./anthropic-messages.js";
import {
  chatCompletion,
  type ChatCompletionOptions,
  type ChatMessage,
} from "./openai-compatible.js";
import type { ResolvedLlmOptions } from "./resolve-options.js";

/**
 * Una llamada de chat según `provider`: OpenAI-compatible (OpenAI, Ollama, Gemini) o Anthropic (Claude).
 */
export async function invokeChat(
  opts: ResolvedLlmOptions,
  messages: ChatMessage[],
  request?: ChatCompletionOptions
): Promise<string> {
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
