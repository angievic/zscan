import * as fs from "node:fs";
import { promptScanToJson, promptScanToMarkdown } from "../prompt/reportPrompt.js";
import { runPromptScanCore } from "../prompt/runPromptScan.js";
export async function runPromptScanCommand(root, out) {
    const { result, error } = await runPromptScanCore(root, {
        skipLlm: out.skipLlm === true,
    });
    if (!result) {
        console.error(error ?? "prompt-scan sin resultado.");
        process.exitCode = 1;
        return;
    }
    if (out.json) {
        fs.writeFileSync(out.json, promptScanToJson(result), "utf8");
        console.log(`JSON: ${out.json}`);
    }
    if (out.markdown) {
        fs.writeFileSync(out.markdown, promptScanToMarkdown(result), "utf8");
        console.log(`Markdown: ${out.markdown}`);
    }
    if (out.print) {
        console.log(promptScanToMarkdown(result));
    }
    const anyFail = result.files.some((f) => f.checks.some((c) => !c.passed));
    if (anyFail)
        process.exitCode = 1;
}
