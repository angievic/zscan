import * as fs from "node:fs";
import { configPath, writeDefaultConfig } from "../config.js";
import { discoverPromptGroupsForInit } from "../init/discoverPrompts.js";
import { findJsLockfile, readJsLockPackages } from "../lockfile/jsWorkspace.js";
export function runInit(root, force) {
    const p = configPath(root);
    if (fs.existsSync(p) && !force) {
        console.error(`Ya existe ${p}. Usa --force para sobrescribir.`);
        process.exitCode = 1;
        return;
    }
    const lock = findJsLockfile(root);
    const packages = lock ? readJsLockPackages(lock) : [];
    const top = packages.slice(0, 30).map((x) => x.name);
    const promptGroups = discoverPromptGroupsForInit(root);
    const written = writeDefaultConfig(root, {
        prompts: promptGroups,
        rules: [
            {
                id: "no_instruction_override",
                description: "Detectar anulación explícita de instrucciones (regex YAML)",
                pattern: "ignore\\s+(all\\s+)?(previous|prior)\\s+instructions?",
            },
        ],
        reliability: {
            prompts_min_percent: 85,
            dependencies: {
                default_min_percent: 70,
                structural_critical: {
                    auto_threshold_percent: 80,
                    explicit_core: top.slice(0, 5),
                },
                packages: {},
            },
        },
    });
    console.log(`Escrito ${written} (${promptGroups.length} grupo(s) prompts detectados; revisa purpose y explicit_core).`);
}
