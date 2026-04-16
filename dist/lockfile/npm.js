import * as fs from "node:fs";
import * as path from "node:path";
function parseNameFromPath(key) {
    if (key === "")
        return null;
    const prefix = "node_modules/";
    if (!key.startsWith(prefix))
        return null;
    const rest = key.slice(prefix.length);
    if (rest.startsWith("@")) {
        const parts = rest.split("/");
        if (parts.length >= 2)
            return `${parts[0]}/${parts[1]}`;
        return null;
    }
    return rest.split("/")[0] ?? null;
}
export function readNpmLockfile(lockPath) {
    const raw = fs.readFileSync(lockPath, "utf8");
    const lock = JSON.parse(raw);
    const seen = new Map();
    if (lock.packages) {
        for (const [key, meta] of Object.entries(lock.packages)) {
            const name = key === "" ? null : parseNameFromPath(key);
            const ver = meta.version;
            if (name && ver) {
                const k = `${name}@${ver}`;
                if (!seen.has(k))
                    seen.set(k, ver);
            }
        }
    }
    if (lock.dependencies && !lock.packages) {
        const walk = (deps) => {
            for (const [name, meta] of Object.entries(deps)) {
                if (meta.version) {
                    const k = `${name}@${meta.version}`;
                    if (!seen.has(k))
                        seen.set(k, meta.version);
                }
            }
        };
        walk(lock.dependencies);
    }
    const list = [];
    for (const [k, v] of seen.entries()) {
        const at = k.lastIndexOf("@");
        const name = at > 0 ? k.slice(0, at) : k;
        list.push({ name, version: v });
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
}
function findResolvedKey(lock, parentKey, depName) {
    const packages = lock.packages;
    const direct = parentKey === ""
        ? `node_modules/${depName}`
        : `${parentKey}/node_modules/${depName}`;
    if (packages[direct]?.version)
        return direct;
    const suffix = `node_modules/${depName}`;
    const matches = Object.keys(packages).filter((key) => key.endsWith(suffix) && packages[key]?.version);
    const underParent = matches.filter((key) => parentKey === "" || key.startsWith(parentKey + "/"));
    const pool = underParent.length ? underParent : matches;
    pool.sort((a, b) => a.length - b.length);
    return pool[0] ?? null;
}
export function buildNpmDependencyTree(lockPath, rootPackageName, rootVersion) {
    const raw = fs.readFileSync(lockPath, "utf8");
    const lock = JSON.parse(raw);
    if (!lock.packages)
        return null;
    const visit = (parentKey, depName) => {
        const resolved = findResolvedKey(lock, parentKey, depName);
        if (!resolved)
            return null;
        const meta = lock.packages[resolved];
        const children = [];
        if (meta.dependencies) {
            for (const childName of Object.keys(meta.dependencies)) {
                const c = visit(resolved, childName);
                if (c)
                    children.push(c);
            }
        }
        return { name: depName, version: meta.version, children };
    };
    const rootMeta = lock.packages[""];
    if (!rootMeta?.dependencies) {
        return { name: rootPackageName, version: rootVersion, children: [] };
    }
    const children = [];
    for (const depName of Object.keys(rootMeta.dependencies)) {
        const n = visit("", depName);
        if (n)
            children.push(n);
    }
    return { name: rootPackageName, version: rootVersion, children };
}
export function findNpmLockfile(root) {
    const p = path.join(root, "package-lock.json");
    if (fs.existsSync(p))
        return p;
    return null;
}
