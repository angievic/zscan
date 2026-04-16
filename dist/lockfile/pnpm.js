import * as fs from "node:fs";
import YAML from "yaml";
/**
 * Extrae paquetes desde claves del mapa `packages` de pnpm
 * (p. ej. `/foo/1.2.3`, `/@scope/bar/2.0.0_peer`).
 */
export function parsePnpmPackageKeys(keys) {
    const seen = new Set();
    const out = [];
    for (const key of keys) {
        const m = key.match(/^\/?((?:@[^/]+\/)?[^/]+)\/(.+)$/);
        if (!m)
            continue;
        const name = m[1];
        let version = m[2].split("(")[0].trim();
        version = version.replace(/_peerDependencies.*$/i, "");
        const at = version.search(/_[a-z]/i);
        if (at > 0)
            version = version.slice(0, at);
        if (!/^v?\d/.test(version))
            continue;
        const k = `${name}@${version}`;
        if (seen.has(k))
            continue;
        seen.add(k);
        out.push({ name, version });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
}
export function readPnpmLockfile(lockPath) {
    const raw = fs.readFileSync(lockPath, "utf8");
    const doc = YAML.parse(raw);
    if (doc.packages && typeof doc.packages === "object") {
        return parsePnpmPackageKeys(Object.keys(doc.packages));
    }
    return [];
}
