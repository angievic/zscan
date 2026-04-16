import * as fs from "node:fs";
import * as path from "node:path";
export function findPythonLockfile(root) {
    const candidates = [
        { kind: "poetry", name: "poetry.lock" },
        { kind: "uv", name: "uv.lock" },
        { kind: "pipfile", name: "Pipfile.lock" },
        { kind: "requirements", name: "requirements.txt" },
    ];
    for (const c of candidates) {
        const p = path.join(root, c.name);
        if (fs.existsSync(p) && fs.statSync(p).isFile()) {
            return { kind: c.kind, path: p };
        }
    }
    return null;
}
/** Parse [[package]] blocks in poetry.lock / uv.lock (subset TOML). */
export function parseTomlPackageBlocks(content) {
    const blocks = content.split(/\[\[package\]\]/g).slice(1);
    const seen = new Set();
    const out = [];
    for (const block of blocks) {
        const nameM = block.match(/^\s*name\s*=\s*"([^"]+)"/m) ??
            block.match(/^\s*name\s*=\s*'([^']+)'/m);
        const verM = block.match(/^\s*version\s*=\s*"([^"]+)"/m) ??
            block.match(/^\s*version\s*=\s*'([^']+)'/m);
        if (!nameM || !verM)
            continue;
        const name = nameM[1].trim();
        const version = verM[1].trim();
        const key = `${name}@${version}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push({ name, version });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
}
function stripVersionPrefix(v) {
    return v.replace(/^==\s*/, "").replace(/^=\s*/, "").trim();
}
export function readPipfileLock(lockPath) {
    const raw = fs.readFileSync(lockPath, "utf8");
    const data = JSON.parse(raw);
    const seen = new Set();
    const out = [];
    const ingest = (section) => {
        if (!section)
            return;
        for (const [name, meta] of Object.entries(section)) {
            const v = meta.version;
            if (!v)
                continue;
            const version = stripVersionPrefix(v);
            if (!/^\d/.test(version) && !version.includes("."))
                continue;
            const key = `${name}@${version}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            out.push({ name, version });
        }
    };
    ingest(data.default);
    ingest(data.develop);
    return out.sort((a, b) => a.name.localeCompare(b.name));
}
/** Solo dependencias con versión fija (==); líneas PEP 508 básicas. */
export function readRequirementsTxt(reqPath) {
    const raw = fs.readFileSync(reqPath, "utf8");
    const seen = new Set();
    const out = [];
    const lineRe = /^\s*([a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?)(?:\[[^\]]+\])?\s*==\s*([^#;\s]+)\s*(?:#.*)?$/;
    for (const line of raw.split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith("#") || t.startsWith("-"))
            continue;
        const m = t.match(lineRe);
        if (!m)
            continue;
        const name = m[1];
        const version = m[2].trim();
        const key = `${name}@${version}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push({ name, version });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
}
export function readPythonLockfile(ref) {
    switch (ref.kind) {
        case "poetry":
        case "uv": {
            const content = fs.readFileSync(ref.path, "utf8");
            return parseTomlPackageBlocks(content);
        }
        case "pipfile":
            return readPipfileLock(ref.path);
        case "requirements":
            return readRequirementsTxt(ref.path);
        default:
            return [];
    }
}
export function pythonLockfileLabel(kind) {
    switch (kind) {
        case "poetry":
            return "poetry.lock";
        case "uv":
            return "uv.lock";
        case "pipfile":
            return "Pipfile.lock";
        case "requirements":
            return "requirements.txt";
    }
}
/** Árbol MVP: raíz sintética con paquetes como hojas (sin aristas transitivas finas). */
export function buildPythonFlatTree(projectLabel, packages) {
    return {
        name: projectLabel,
        version: "0",
        children: packages.map((p) => ({
            name: p.name,
            version: p.version,
            children: [],
        })),
    };
}
export function readPythonProjectName(root) {
    const pyproject = path.join(root, "pyproject.toml");
    if (fs.existsSync(pyproject)) {
        const text = fs.readFileSync(pyproject, "utf8");
        const m = text.match(/^\s*name\s*=\s*"([^"]+)"/m) ??
            text.match(/^\s*name\s*=\s*'([^']+)'/m) ??
            text.match(/^\[project\]\s*\n(?:.*\n)*?\s*name\s*=\s*"([^"]+)"/m);
        if (m)
            return m[1].trim();
    }
    return path.basename(path.resolve(root)) || "python-project";
}
