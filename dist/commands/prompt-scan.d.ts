export declare function runPromptScanCommand(root: string, out: {
    json?: string;
    markdown?: string;
    print: boolean;
    skipLlm?: boolean;
}): Promise<void>;
