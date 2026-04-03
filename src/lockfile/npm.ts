import * as fs from "node:fs";
import * as path from "node:path";
import type { DependencyNode, LockfilePackage } from "../types.js";

interface LockJson {
  lockfileVersion?: number;
  packages?: Record<
    string,
    { version?: string; dependencies?: Record<string, string> }
  >;
  dependencies?: Record<string, { version?: string; requires?: Record<string, string> }>;
}

function parseNameFromPath(key: string): string | null {
  if (key === "") return null;
  const prefix = "node_modules/";
  if (!key.startsWith(prefix)) return null;
  const rest = key.slice(prefix.length);
  if (rest.startsWith("@")) {
    const parts = rest.split("/");
    if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
    return null;
  }
  return rest.split("/")[0] ?? null;
}

export function readNpmLockfile(lockPath: string): LockfilePackage[] {
  const raw = fs.readFileSync(lockPath, "utf8");
  const lock = JSON.parse(raw) as LockJson;
  const seen = new Map<string, string>();

  if (lock.packages) {
    for (const [key, meta] of Object.entries(lock.packages)) {
      const name = key === "" ? null : parseNameFromPath(key);
      const ver = meta.version;
      if (name && ver) {
        const k = `${name}@${ver}`;
        if (!seen.has(k)) seen.set(k, ver);
      }
    }
  }

  if (lock.dependencies && !lock.packages) {
    const walk = (deps: Record<string, { version?: string }>) => {
      for (const [name, meta] of Object.entries(deps)) {
        if (meta.version) {
          const k = `${name}@${meta.version}`;
          if (!seen.has(k)) seen.set(k, meta.version);
        }
      }
    };
    walk(lock.dependencies);
  }

  const list: LockfilePackage[] = [];
  for (const [k, v] of seen.entries()) {
    const at = k.lastIndexOf("@");
    const name = at > 0 ? k.slice(0, at) : k;
    list.push({ name, version: v });
  }
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

function findResolvedKey(
  lock: LockJson,
  parentKey: string,
  depName: string
): string | null {
  const packages = lock.packages!;
  const direct =
    parentKey === ""
      ? `node_modules/${depName}`
      : `${parentKey}/node_modules/${depName}`;
  if (packages[direct]?.version) return direct;

  const suffix = `node_modules/${depName}`;
  const matches = Object.keys(packages).filter(
    (key) => key.endsWith(suffix) && packages[key]?.version
  );
  const underParent = matches.filter(
    (key) => parentKey === "" || key.startsWith(parentKey + "/")
  );
  const pool = underParent.length ? underParent : matches;
  pool.sort((a, b) => a.length - b.length);
  return pool[0] ?? null;
}

export function buildNpmDependencyTree(
  lockPath: string,
  rootPackageName: string,
  rootVersion: string
): DependencyNode | null {
  const raw = fs.readFileSync(lockPath, "utf8");
  const lock = JSON.parse(raw) as LockJson;
  if (!lock.packages) return null;

  const visit = (parentKey: string, depName: string): DependencyNode | null => {
    const resolved = findResolvedKey(lock, parentKey, depName);
    if (!resolved) return null;
    const meta = lock.packages![resolved]!;
    const children: DependencyNode[] = [];
    if (meta.dependencies) {
      for (const childName of Object.keys(meta.dependencies)) {
        const c = visit(resolved, childName);
        if (c) children.push(c);
      }
    }
    return { name: depName, version: meta.version!, children };
  };

  const rootMeta = lock.packages[""];
  if (!rootMeta?.dependencies) {
    return { name: rootPackageName, version: rootVersion, children: [] };
  }

  const children: DependencyNode[] = [];
  for (const depName of Object.keys(rootMeta.dependencies)) {
    const n = visit("", depName);
    if (n) children.push(n);
  }

  return { name: rootPackageName, version: rootVersion, children };
}

export function findNpmLockfile(root: string): string | null {
  const p = path.join(root, "package-lock.json");
  if (fs.existsSync(p)) return p;
  return null;
}
