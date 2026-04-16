import type { LockfilePackage } from "../types.js";
/** Nombre npm desde clave Yarn v1 `descriptor@range`. */
export declare function parseYarnV1DescriptorKey(key: string): string | null;
/** `name@npm:version` o `name@npm:range` (Berry): preferir versión explícita en la clave. */
export declare function parseYarnBerryKey(key: string): {
    name: string;
    version: string;
} | null;
export declare function readYarnLockfile(lockPath: string): LockfilePackage[];
