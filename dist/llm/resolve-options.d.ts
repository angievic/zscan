import type { ZscanConfig } from "../config.js";
import type { LlmProvider } from "./provider.js";
export type { LlmProvider } from "./provider.js";
export interface ResolvedLlmOptions {
    baseUrl: string;
    model: string;
    apiKey?: string;
    enabled: boolean;
    provider: LlmProvider;
}
export declare function resolveLlmOptions(cfg: ZscanConfig): ResolvedLlmOptions;
