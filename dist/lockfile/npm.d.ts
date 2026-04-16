import type { DependencyNode, LockfilePackage } from "../types.js";
export declare function readNpmLockfile(lockPath: string): LockfilePackage[];
export declare function buildNpmDependencyTree(lockPath: string, rootPackageName: string, rootVersion: string): DependencyNode | null;
export declare function findNpmLockfile(root: string): string | null;
