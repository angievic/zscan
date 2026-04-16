import * as fs from "node:fs";
import * as path from "node:path";
export function findGoModFile(root) {
    const p = path.join(path.resolve(root), "go.mod");
    return fs.existsSync(p) ? p : null;
}
export function goLockfileLabel() {
    return "go.mod";
}
function stripGoComment(line) {
    const idx = line.indexOf("//");
    if (idx < 0)
        return line.trim();
    return line.slice(0, idx).trim();
}
/** Extrae directivas `require` de go.mod (bloque y línea única). */
export function parseGoModRequires(text) {
    const out = [];
    const seen = new Set();
    const push = (name, ver) => {
        const k = `${name}@${ver}`;
        if (seen.has(k))
            return;
        seen.add(k);
        out.push({ name, version: ver });
    };
    const blockRe = /\brequire\s*\(\s*([\s\S]*?)\)/g;
    let m;
    while ((m = blockRe.exec(text)) !== null) {
        const body = m[1];
        for (const raw of body.split("\n")) {
            const line = stripGoComment(raw);
            if (!line || line === ")")
                continue;
            const parts = line.split(/\s+/).filter(Boolean);
            if (parts.length < 2)
                continue;
            const mod = parts[0];
            const ver = parts[1];
            if (mod === "go" || mod === "toolchain")
                continue;
            if (!ver.startsWith("v") && !/^[0-9]/.test(ver))
                continue;
            push(mod, ver);
        }
    }
    const lineRe = /^\s*require\s+(\S+)\s+(\S+)/gm;
    while ((m = lineRe.exec(text)) !== null) {
        push(m[1], m[2]);
    }
    return out;
}
export function readGoModPackages(root) {
    const p = path.join(path.resolve(root), "go.mod");
    const text = fs.readFileSync(p, "utf8");
    return parseGoModRequires(text);
}
export function readGoModulePath(root) {
    const p = path.join(path.resolve(root), "go.mod");
    const text = fs.readFileSync(p, "utf8");
    const m = /^module\s+(\S+)/m.exec(text);
    return m ? m[1] : path.basename(path.resolve(root)) || "go-module";
}
