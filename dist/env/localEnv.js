import * as fs from "node:fs";
import * as path from "node:path";
/**
 * Carga claves `ZSCAN_*` desde `.env.local` en la raíz del proyecto (sin dependencia dotenv).
 * Útil tras `zscan config` cuando la API key se guarda fuera de `zscan.yaml`.
 */
export function loadEnvLocalFile(root) {
    const p = path.join(path.resolve(root), ".env.local");
    if (!fs.existsSync(p))
        return;
    let text;
    try {
        text = fs.readFileSync(p, "utf8");
    }
    catch {
        return;
    }
    for (const line of text.split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith("#"))
            continue;
        const eq = t.indexOf("=");
        if (eq < 0)
            continue;
        const k = t.slice(0, eq).trim();
        if (!k.startsWith("ZSCAN_"))
            continue;
        let v = t.slice(eq + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) ||
            (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1);
        }
        process.env[k] = v;
    }
}
export function upsertEnvLocal(root, key, value) {
    const p = path.join(path.resolve(root), ".env.local");
    const prefix = `${key}=`;
    let lines = [];
    if (fs.existsSync(p)) {
        lines = fs.readFileSync(p, "utf8").split(/\r?\n/);
        const idx = lines.findIndex((l) => l.trimStart().startsWith(prefix) || l.trimStart().startsWith(`${key} `));
        if (idx >= 0)
            lines[idx] = `${key}=${value}`;
        else
            lines.push(`${key}=${value}`);
    }
    else {
        lines = [
            "# Generado por zscan config — no subas secretos al repositorio",
            `${key}=${value}`,
        ];
    }
    fs.writeFileSync(p, lines.join("\n") + "\n", "utf8");
}
export function removeEnvLocalKey(root, key) {
    const p = path.join(path.resolve(root), ".env.local");
    if (!fs.existsSync(p))
        return;
    const prefix = `${key}=`;
    const lines = fs
        .readFileSync(p, "utf8")
        .split(/\r?\n/)
        .filter((l) => !l.trimStart().startsWith(prefix));
    fs.writeFileSync(p, lines.join("\n") + (lines.length ? "\n" : ""), "utf8");
}
