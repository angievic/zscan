import * as fs from "node:fs";
import * as path from "node:path";
export function findGemfileLock(root) {
    const p = path.join(path.resolve(root), "Gemfile.lock");
    return fs.existsSync(p) ? p : null;
}
export function gemfileLockLabel() {
    return "Gemfile.lock";
}
/**
 * Lista gemas resueltas en la sección GEM / specs (Bundler).
 * Formato: `    nombre (versión)`.
 */
export function parseGemfileLockSpecs(text) {
    const lines = text.split(/\r?\n/);
    let inSpecs = false;
    const out = [];
    const seen = new Set();
    const gemLine = /^ {4}([A-Za-z0-9_.-]+) \(([^)]+)\)\s*$/;
    for (const line of lines) {
        if (line.startsWith("GEM")) {
            inSpecs = false;
            continue;
        }
        if (line.trim() === "specs:") {
            inSpecs = true;
            continue;
        }
        if (inSpecs) {
            if (line.startsWith("  ") && !line.startsWith("    ")) {
                inSpecs = false;
                continue;
            }
            const m = line.match(gemLine);
            if (m) {
                const name = m[1].toLowerCase();
                const version = m[2].trim();
                const k = `${name}@${version}`;
                if (!seen.has(k)) {
                    seen.add(k);
                    out.push({ name, version });
                }
            }
        }
    }
    return out;
}
export function readGemfileLockPackages(root) {
    const p = path.join(path.resolve(root), "Gemfile.lock");
    const text = fs.readFileSync(p, "utf8");
    return parseGemfileLockSpecs(text);
}
