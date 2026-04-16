import type { LockfilePackage } from "../types.js";
export declare function findGemfileLock(root: string): string | null;
export declare function gemfileLockLabel(): string;
/**
 * Lista gemas resueltas en la sección GEM / specs (Bundler).
 * Formato: `    nombre (versión)`.
 */
export declare function parseGemfileLockSpecs(text: string): LockfilePackage[];
export declare function readGemfileLockPackages(root: string): LockfilePackage[];
