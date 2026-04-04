import * as fs from "node:fs";
import * as path from "node:path";
import { applyDocEnrichment } from "../enrich/applyEnrich.js";
import { defaultEnrichCacheDir } from "../enrich/docCache.js";
import { analyzeGitRepo } from "../git/metadata.js";
import {
  buildJsDependencyTree,
  findJsLockfile,
  jsLockfileLabel,
  readJsLockPackages,
} from "../lockfile/jsWorkspace.js";
import {
  findGemfileLock,
  gemfileLockLabel,
  readGemfileLockPackages,
} from "../lockfile/gemfileLock.js";
import {
  findGoModFile,
  goLockfileLabel,
  readGoModPackages,
  readGoModulePath,
} from "../lockfile/goMod.js";
import {
  findMavenPom,
  mavenPomLabel,
  readMavenPomPackages,
  readMavenProjectLabel,
} from "../lockfile/mavenPom.js";
import {
  buildPythonFlatTree,
  findPythonLockfile,
  pythonLockfileLabel,
  readPythonLockfile,
  readPythonProjectName,
} from "../lockfile/python.js";
import { defaultOsvCacheDir, queryOsvBatch } from "../osv.js";
import {
  collectGoImportHints,
  collectImportHints,
  collectJavaImportHints,
  collectPythonImportHints,
  collectRubyImportHints,
  type ScanWalkOptions,
} from "./importHints.js";
import { scanSecretsAndAuth } from "./secretsAndAuthScan.js";
import type {
  EcosystemScanResult,
  ScanFinding,
  ScanMeta,
  ScanResult,
} from "../types.js";

function readPackageMeta(root: string): { name: string; version: string } {
  const pj = path.join(root, "package.json");
  const j = JSON.parse(fs.readFileSync(pj, "utf8")) as {
    name?: string;
    version?: string;
  };
  return { name: j.name ?? "package", version: j.version ?? "0.0.0" };
}

export interface ProjectScanOptions {
  ignoreSubmodules?: boolean;
  offline?: boolean;
  bypassOsvCache?: boolean;
  osvCacheDir?: string;
  enrichDocs?: boolean;
  enrichCacheDir?: string;
  /** Por defecto true: heurísticas de llaves / autenticación en código. */
  secretAuthScan?: boolean;
}

export interface ProjectScanOutcome {
  result: ScanResult | null;
  errorMessage?: string;
}

export async function performProjectScan(
  root: string,
  options: ProjectScanOptions = {}
): Promise<ProjectScanOutcome> {
  const abs = path.resolve(root);
  const git = analyzeGitRepo(abs);
  const walkOpts: ScanWalkOptions | undefined =
    options.ignoreSubmodules ? { ignoreSubmodules: true, git } : undefined;

  const osvWarnings: string[] = [];
  const osvOpts = {
    offline: options.offline === true,
    bypassCache: options.bypassOsvCache === true,
    cacheDir: options.osvCacheDir ?? defaultOsvCacheDir(),
    onWarning: (msg: string) => osvWarnings.push(msg),
  };

  const ecosystems: EcosystemScanResult[] = [];

  const jsLock = findJsLockfile(abs);
  if (jsLock && fs.existsSync(path.join(abs, "package.json"))) {
    const meta = readPackageMeta(abs);
    const packages = readJsLockPackages(jsLock);
    const osv = await queryOsvBatch(packages, "npm", osvOpts);
    const findings: ScanFinding[] = packages.map((p) => {
      const key = `${p.name}@${p.version}`;
      return { package: p.name, version: p.version, vulns: osv.get(key) ?? [] };
    });
    const tree = buildJsDependencyTree(
      jsLock,
      abs,
      meta.name,
      meta.version,
      packages
    );
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
    const findings: ScanFinding[] = packages.map((p) => {
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
      const findings: ScanFinding[] = packages.map((p) => {
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
      const findings: ScanFinding[] = packages.map((p) => {
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
      const findings: ScanFinding[] = packages.map((p) => {
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
      errorMessage:
        "No se encontró lockfile reconocido: JS (package-lock.json, pnpm-lock.yaml, yarn.lock), Python (poetry.lock, uv.lock, Pipfile.lock, requirements.txt), Go (go.mod), Ruby (Gemfile.lock) o Maven (pom.xml con dependencias con versión resoluble).",
    };
  }

  const meta: ScanMeta = {
    reportSchemaVersion: 1,
    offline: options.offline === true,
    osvWarnings: osvWarnings.length ? osvWarnings : undefined,
  };

  const result: ScanResult = { root: abs, git, ecosystems, meta };

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
