import * as fs from "node:fs";
import * as path from "node:path";
function resolveGitDirPath(workTree) {
    const g = path.join(workTree, ".git");
    try {
        const st = fs.statSync(g);
        if (st.isDirectory())
            return g;
        const txt = fs.readFileSync(g, "utf8").trim();
        const m = txt.match(/^gitdir:\s*(.+)$/m);
        if (!m)
            return null;
        const target = m[1].trim();
        return path.isAbsolute(target) ? target : path.resolve(workTree, target);
    }
    catch {
        return null;
    }
}
function readRefFromGitDir(gitDir, refPath) {
    const p = path.join(gitDir, refPath);
    if (!fs.existsSync(p))
        return null;
    const v = fs.readFileSync(p, "utf8").trim();
    return v || null;
}
function readHeadFromGitDir(gitDir) {
    const headFile = path.join(gitDir, "HEAD");
    if (!fs.existsSync(headFile))
        return null;
    const head = fs.readFileSync(headFile, "utf8").trim();
    const m = head.match(/^ref:\s*(.+)$/);
    if (m) {
        const ref = m[1].trim();
        const sha = readRefFromGitDir(gitDir, ref);
        if (sha)
            return `${ref} (${sha.slice(0, 7)})`;
        return ref;
    }
    if (/^[0-9a-f]{7,40}$/i.test(head))
        return head.slice(0, 7);
    return head.slice(0, 40);
}
/** Parseo mínimo de `.gitmodules` (INI-like). */
export function parseGitmodules(content) {
    const paths = [];
    for (const line of content.split(/\r?\n/)) {
        const m = line.match(/^\s*path\s*=\s*(.+)$/);
        if (m)
            paths.push(m[1].trim());
    }
    return paths;
}
function tryReadGitmodules(repoRoot) {
    const p = path.join(repoRoot, ".gitmodules");
    if (!fs.existsSync(p))
        return [];
    try {
        return parseGitmodules(fs.readFileSync(p, "utf8"));
    }
    catch {
        return [];
    }
}
/**
 * Sube directorios desde `startDir` hasta encontrar `.git` (directorio o puntero gitdir).
 */
export function analyzeGitRepo(startDir) {
    let dir = path.resolve(startDir);
    for (;;) {
        const gitEntry = path.join(dir, ".git");
        if (fs.existsSync(gitEntry)) {
            const gitDir = resolveGitDirPath(dir);
            return {
                isRepository: true,
                repositoryRoot: dir,
                headLabel: gitDir ? readHeadFromGitDir(gitDir) : null,
                submodulePaths: tryReadGitmodules(dir),
            };
        }
        const parent = path.dirname(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    return {
        isRepository: false,
        repositoryRoot: null,
        headLabel: null,
        submodulePaths: [],
    };
}
export function fileInSubmodule(fileAbs, repoRoot, submodulePaths) {
    const rel = path.relative(repoRoot, fileAbs);
    if (rel.startsWith(".."))
        return false;
    const norm = rel.split(path.sep).join("/");
    for (const sub of submodulePaths) {
        const s = sub.split(path.sep).join("/").replace(/^\/+/, "");
        if (norm === s || norm.startsWith(s + "/"))
            return true;
    }
    return false;
}
