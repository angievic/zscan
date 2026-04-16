import type { LockfilePackage } from "../types.js";
/**
 * Extrae paquetes desde claves del mapa `packages` de pnpm
 * (p. ej. `/foo/1.2.3`, `/@scope/bar/2.0.0_peer`).
 */
export declare function parsePnpmPackageKeys(keys: string[]): LockfilePackage[];
export declare function readPnpmLockfile(lockPath: string): LockfilePackage[];
