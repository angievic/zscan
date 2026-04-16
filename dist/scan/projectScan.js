import * as fs from "node:fs";
import * as path from "node:path";
import { applyDocEnrichment } from "../enrich/applyEnrich.js";
import { defaultEnrichCacheDir } from "../enrich/docCache.js";
import { analyzeGitRepo } from "../git/metadata.js";
import { buildJsDependencyTree, findJsLockfile, jsLockfileLabel, readJsLockPackages, } from "../lockfile/jsWorkspace.js";
import { findGemfileLock, gemfileLockLabel, readGemfileLockPackages, } from "../lockfile/gemfileLock.js";
import { findGoModFile, goLockfileLabel, readGoModPackages, readGoModulePath, } from "../lockfile/goMod.js";
import { findMavenPom, mavenPomLabel, readMavenPomPackages, readMavenProjectLabel, } from "../lockfile/mavenPom.js";
import { buildPythonFlatTree, findPythonLockfile, pythonLockfileLabel, readPythonLockfile, readPythonProjectName, } from "../lockfile/python.js";
import { defaultOsvCacheDir, queryOsvBatch } from "../osv.js";
import { collectGoImportHints, collectImportHints, collectJavaImportHints, collectPythonImportHints, collectRubyImportHints, } from "./importHints.js";
import { scanSecretsAndAuth } from "./secretsAndAuthScan.js";
function readPackageMeta(root) {
    const pj = path.join(root, "package.json");
    const j = JSON.parse(fs.readFileSync(pj, "utf8"));
    return { name: j.name ?? "package", version: j.version ?? "0.0.0" };
}
export async function performProjectScan(root, options = {}) {
    const abs = path.resolve(root);
    const git = analyzeGitRepo(abs);
    const walkOpts = options.ignoreSubmodules ? { ignoreSubmodules: true, git } : undefined;
    const osvWarnings = [];
    const osvOpts = {
        offline: options.offline === true,
        bypassCache: options.bypassOsvCache === true,
        cacheDir: options.osvCacheDir ?? defaultOsvCacheDir(),
        onWarning: (msg) => osvWarnings.push(msg),
    };
    const ecosystems = [];
    const jsLock = findJsLockfile(abs);
    if (jsLock && fs.existsSync(path.join(abs, "package.json"))) {
        const meta = readPackageMeta(abs);
        const packages = readJsLockPackages(jsLock);
        const osv = await queryOsvBatch(packages, "npm", osvOpts);
        const findings = packages.map((p) => {
            const key = `${p.name}@${p.version}`;
            return { package: p.name, version: p.version, vulns: osv.get(key) ?? [] };
        });
        const tree = buildJsDependencyTree(jsLock, abs, meta.name, meta.version, packages);
        const importHints = collectImportHints(abs, packages, walkOpts);
        ecosystems.push({
            ecosystem: "npm",
            lockfile: jsLockfileLabel(jsLock.kind),
            packages,
            findings,
            tree,
            importHints,
        });
    }
    const pyLock = findPythonLockfile(abs);
    if (pyLock) {
        const packages = readPythonLockfile(pyLock);
        const osv = await queryOsvBatch(packages, "PyPI", osvOpts);
        const findings = packages.map((p) => {
            const key = `${p.name}@${p.version}`;
            return { package: p.name, version: p.version, vulns: osv.get(key) ?? [] };
        });
        const label = readPythonProjectName(abs);
        const tree = buildPythonFlatTree(label, packages);
        const importHints = collectPythonImportHints(abs, packages, walkOpts);
        ecosystems.push({
            ecosystem: "PyPI",
            lockfile: pythonLockfileLabel(pyLock.kind),
            packages,
            findings,
            tree,
            importHints,
        });
    }
    if (findGoModFile(abs)) {
        const packages = readGoModPackages(abs);
        if (packages.length > 0) {
            const osv = await queryOsvBatch(packages, "Go", osvOpts);
            const findings = packages.map((p) => {
                const key = `${p.name}@${p.version}`;
                return { package: p.name, version: p.version, vulns: osv.get(key) ?? [] };
            });
            const label = readGoModulePath(abs);
            const tree = buildPythonFlatTree(label, packages);
            const importHints = collectGoImportHints(abs, packages, walkOpts);
            ecosystems.push({
                ecosystem: "Go",
                lockfile: goLockfileLabel(),
                packages,
                findings,
                tree,
                importHints,
            });
        }
    }
    if (findGemfileLock(abs)) {
        const packages = readGemfileLockPackages(abs);
        if (packages.length > 0) {
            const osv = await queryOsvBatch(packages, "RubyGems", osvOpts);
            const findings = packages.map((p) => {
                const key = `${p.name}@${p.version}`;
                return { package: p.name, version: p.version, vulns: osv.get(key) ?? [] };
            });
            const label = path.basename(abs) || "ruby-project";
            const tree = buildPythonFlatTree(label, packages);
            const importHints = collectRubyImportHints(abs, packages, walkOpts);
            ecosystems.push({
                ecosystem: "RubyGems",
                lockfile: gemfileLockLabel(),
                packages,
                findings,
                tree,
                importHints,
            });
        }
    }
    if (findMavenPom(abs)) {
        const packages = readMavenPomPackages(abs);
        if (packages.length > 0) {
            const osv = await queryOsvBatch(packages, "Maven", osvOpts);
            const findings = packages.map((p) => {
                const key = `${p.name}@${p.version}`;
                return { package: p.name, version: p.version, vulns: osv.get(key) ?? [] };
            });
            const label = readMavenProjectLabel(abs);
            const tree = buildPythonFlatTree(label, packages);
            const importHints = collectJavaImportHints(abs, packages, walkOpts);
            ecosystems.push({
                ecosystem: "Maven",
                lockfile: mavenPomLabel(),
                packages,
                findings,
                tree,
                importHints,
            });
        }
    }
    if (!ecosystems.length) {
        return {
            result: null,
            errorMessage: "No se encontró lockfile reconocido: JS (package-lock.json, pnpm-lock.yaml, yarn.lock), Python (poetry.lock, uv.lock, Pipfile.lock, requirements.txt), Go (go.mod), Ruby (Gemfile.lock) o Maven (pom.xml con dependencias con versión resoluble).",
        };
    }
    const meta = {
        reportSchemaVersion: 1,
        offline: options.offline === true,
        osvWarnings: osvWarnings.length ? osvWarnings : undefined,
    };
    const result = { root: abs, git, ecosystems, meta };
    if (options.secretAuthScan !== false) {
        result.secretAuthScan = scanSecretsAndAuth(abs, {
            ignoreSubmodules: options.ignoreSubmodules,
            git,
        });
    }
    if (options.enrichDocs !== false) {
        await applyDocEnrichment(result, {
            cacheDir: options.enrichCacheDir ?? defaultEnrichCacheDir(),
        });
    }
    return { result };
}
