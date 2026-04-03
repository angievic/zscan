import * as fs from "node:fs";
import * as path from "node:path";
import type { DependencyNode, LockfilePackage } from "../types.js";
import { buildNpmDependencyTree, readNpmLockfile } from "./npm.js";
import { readPnpmLockfile } from "./pnpm.js";
import { readYarnLockfile } from "./yarn.js";

export type JsLockKind = "npm" | "pnpm" | "yarn";

export interface JsLockRef {
  kind: JsLockKind;
  path: string;
}

/**
 * Prioridad: npm → pnpm → yarn (suele haber un solo lockfile; evita mezclar herramientas).
 */
export function findJsLockfile(root: string): JsLockRef | null {
  const order: { kind: JsLockKind; name: string }[] = [
    { kind: "npm", name: "package-lock.json" },
    { kind: "pnpm", name: "pnpm-lock.yaml" },
    { kind: "yarn", name: "yarn.lock" },
  ];
  for (const o of order) {
    const p = path.join(root, o.name);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      return { kind: o.kind, path: p };
    }
  }
  return null;
}

export function jsLockfileLabel(kind: JsLockKind): string {
  switch (kind) {
    case "npm":
      return "package-lock.json";
    case "pnpm":
      return "pnpm-lock.yaml";
    case "yarn":
      return "yarn.lock";
  }
}

export function readJsLockPackages(ref: JsLockRef): LockfilePackage[] {
  switch (ref.kind) {
    case "npm":
      return readNpmLockfile(ref.path);
    case "pnpm":
      return readPnpmLockfile(ref.path);
    case "yarn":
      return readYarnLockfile(ref.path);
  }
}

function readDirectDepNames(rootDir: string): string[] {
  const pjPath = path.join(rootDir, "package.json");
  try {
    const pj = JSON.parse(fs.readFileSync(pjPath, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    return [
      ...Object.keys(pj.dependencies ?? {}),
      ...Object.keys(pj.devDependencies ?? {}),
      ...Object.keys(pj.optionalDependencies ?? {}),
      ...Object.keys(pj.peerDependencies ?? {}),
    ];
  } catch {
    return [];
  }
}

/** npm: árbol transitivo; yarn/pnpm: dependencias directas según package.json + versiones del lock. */
export function buildJsDependencyTree(
  ref: JsLockRef,
  rootDir: string,
  rootPackageName: string,
  rootVersion: string,
  packages: LockfilePackage[]
): DependencyNode | null {
  if (ref.kind === "npm") {
    return buildNpmDependencyTree(ref.path, rootPackageName, rootVersion);
  }
  const byName = new Map<string, string>();
  for (const p of packages) {
    if (!byName.has(p.name)) byName.set(p.name, p.version);
  }
  const depNames = readDirectDepNames(rootDir);
  return {
    name: rootPackageName,
    version: rootVersion,
    children: depNames.map((name) => ({
      name,
      version: byName.get(name) ?? "?",
      children: [],
    })),
  };
}
