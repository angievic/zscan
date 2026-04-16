import type { PromptScanResult } from "./evaluate.js";
export declare function promptScanToJson(result: PromptScanResult): string;
export declare function promptScanToMarkdown(result: PromptScanResult, opts?: {
    embedInScanReport?: boolean;
}): string;
