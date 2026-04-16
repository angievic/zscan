import * as fs from "node:fs";
import * as path from "node:path";
export function findMavenPom(root) {
    const p = path.join(path.resolve(root), "pom.xml");
    return fs.existsSync(p) ? p : null;
}
export function mavenPomLabel() {
    return "pom.xml";
}
const PROP_REF = /^\$\{([^}]+)\}$/;
/** Resuelve ${prop} en un mapa simple de propiedades del POM (MVP). */
function resolveProp(raw, props) {
    const t = raw.trim();
    const m = t.match(PROP_REF);
    if (m) {
        const v = props[m[1].trim()];
        return v !== undefined ? v : null;
    }
    if (t.includes("${"))
        return null;
    return t;
}
/**
 * Dependencias con versión literal o ${property} resoluble desde <properties>.
 * Nombre OSV Maven: `groupId:artifactId`.
 */
export function parseMavenPomDependencies(text) {
    const props = {};
    const genericProp = /<properties>([\s\S]*?)<\/properties>/i.exec(text);
    if (genericProp) {
        const block = genericProp[1];
        const tagRe = /<([a-zA-Z0-9_.-]+)>([^<]*)<\/\1>/g;
        let pm;
        while ((pm = tagRe.exec(block)) !== null) {
            props[pm[1]] = pm[2].trim();
        }
    }
    const out = [];
    const seen = new Set();
    const depBlockRe = /<dependency>([\s\S]*?)<\/dependency>/gi;
    let dm;
    while ((dm = depBlockRe.exec(text)) !== null) {
        const block = dm[1];
        const gid = /<groupId>([^<]+)<\/groupId>/i.exec(block)?.[1]?.trim();
        const aid = /<artifactId>([^<]+)<\/artifactId>/i.exec(block)?.[1]?.trim();
        const verRaw = /<version>([^<]+)<\/version>/i.exec(block)?.[1]?.trim();
        if (!gid || !aid || !verRaw)
            continue;
        const version = resolveProp(verRaw, props);
        if (!version)
            continue;
        const name = `${gid}:${aid}`;
        const k = `${name}@${version}`;
        if (seen.has(k))
            continue;
        seen.add(k);
        out.push({ name, version });
    }
    return out;
}
export function readMavenPomPackages(root) {
    const p = path.join(path.resolve(root), "pom.xml");
    const text = fs.readFileSync(p, "utf8");
    return parseMavenPomDependencies(text);
}
export function readMavenProjectLabel(root) {
    const p = path.join(path.resolve(root), "pom.xml");
    const text = fs.readFileSync(p, "utf8");
    const head = text.slice(0, 4000).replace(/<parent>[\s\S]*?<\/parent>/i, "");
    const aid = /<artifactId>([^<]+)<\/artifactId>/i.exec(head)?.[1]?.trim() ??
        path.basename(path.resolve(root));
    return aid || "maven-project";
}
