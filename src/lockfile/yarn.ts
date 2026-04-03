import * as fs from "node:fs";
import type { LockfilePackage } from "../types.js";

/** Nombre npm desde clave Yarn v1 `descriptor@range`. */
export function parseYarnV1DescriptorKey(key: string): string | null {
  const k = key.trim();
  const scoped = k.match(/^(@[^/]+\/[^@]+)@(.+)$/);
  if (scoped) return scoped[1]!;
  const plain = k.match(/^([^@]+)@(.+)$/);
  if (plain) return plain[1]!;
  return null;
}

/** `name@npm:version` o `name@npm:range` (Berry): preferir versión explícita en la clave. */
export function parseYarnBerryKey(key: string): { name: string; version: string } | null {
  const k = key
    .trim()
    .replace(/^"/, "")
    .replace(/"$/, "")
    .replace(/:$/, "");
  const m = k.match(/^((?:@[^/]+\/)?[^@]+)@npm:([^:]+)$/);
  if (!m) return null;
  const name = m[1]!;
  const version = m[2]!;
  if (!/^v?\d/.test(version)) return null;
  return { name, version };
}

function readYarnClassic(content: string): LockfilePackage[] {
  const lines = content.split(/\r?\n/);
  const seen = new Set<string>();
  const out: LockfilePackage[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim() || line.startsWith("#")) {
      i++;
      continue;
    }
    if (line.match(/^\s/) || !line.endsWith(":")) {
      i++;
      continue;
    }

    const header = line.slice(0, -1);
    const keys = header.split(",").map((k) =>
      k
        .trim()
        .replace(/^"/, "")
        .replace(/"$/, "")
    );
    i++;
    let version: string | null = null;
    while (i < lines.length && /^\s/.test(lines[i]!)) {
      const vm = lines[i]!.match(/^\s+version\s+"([^"]+)"/);
      if (vm) version = vm[1]!;
      i++;
    }
    if (!version) continue;

    const names = new Set<string>();
    for (const key of keys) {
      const n = parseYarnV1DescriptorKey(key);
      if (n) names.add(n);
    }
    for (const name of names) {
      const k = `${name}@${version}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ name, version });
    }
  }

  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function readYarnBerry(content: string): LockfilePackage[] {
  const lines = content.split(/\r?\n/);
  const seen = new Set<string>();
  const out: LockfilePackage[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim() || line.startsWith("#")) {
      i++;
      continue;
    }
    if (line.match(/^\s/) || !line.endsWith(":")) {
      i++;
      continue;
    }
    if (line.startsWith("__metadata")) {
      i++;
      while (i < lines.length && /^\s/.test(lines[i]!)) i++;
      continue;
    }

    const headerTrim = line.trim();
    if (
      headerTrim.includes("@workspace:") ||
      headerTrim.includes("@portal:") ||
      headerTrim.includes("patch:")
    ) {
      i++;
      while (i < lines.length && /^\s/.test(lines[i]!)) i++;
      continue;
    }

    const header = headerTrim.replace(/:$/, "");
    const berry = parseYarnBerryKey(header);
    i++;
    let version: string | null = berry?.version ?? null;
    let name: string | null = berry?.name ?? null;

    while (i < lines.length && /^\s/.test(lines[i]!)) {
      const vm = lines[i]!.match(/^\s+version:\s*(?:"([^"]+)"|([0-9][^#\s]*))/);
      if (vm) version = vm[1] ?? vm[2] ?? version;
      const rm = lines[i]!.match(/^\s+resolution:\s*"([^"]+)"/);
      if (rm && !name) {
        const inner = parseYarnBerryKey(rm[1]!);
        if (inner) {
          name = inner.name;
          version = inner.version;
        }
      }
      i++;
    }

    if (name && version) {
      const k = `${name}@${version}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push({ name, version });
      }
    }
  }

  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function readYarnLockfile(lockPath: string): LockfilePackage[] {
  const content = fs.readFileSync(lockPath, "utf8");
  if (content.includes("__metadata")) {
    return readYarnBerry(content);
  }
  return readYarnClassic(content);
}
