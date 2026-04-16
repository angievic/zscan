import { type PromptScanResult } from "./evaluate.js";
export declare function runPromptScanCore(root: string, options?: {
    skipLlm?: boolean;
}): Promise<{
    result: PromptScanResult | null;
    error?: string;
}>;
