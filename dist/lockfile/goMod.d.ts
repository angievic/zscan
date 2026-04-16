import type { LockfilePackage } from "../types.js";
export declare function findGoModFile(root: string): string | null;
export declare function goLockfileLabel(): string;
/** Extrae directivas `require` de go.mod (bloque y línea única). */
export declare function parseGoModRequires(text: string): LockfilePackage[];
export declare function readGoModPackages(root: string): LockfilePackage[];
export declare function readGoModulePath(root: string): string;
