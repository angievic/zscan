import type { DependencyNode, LockfilePackage } from "../types.js";
export type PythonLockKind = "poetry" | "uv" | "pipfile" | "requirements";
export interface PythonLockRef {
    kind: PythonLockKind;
    path: string;
}
export declare function findPythonLockfile(root: string): PythonLockRef | null;
/** Parse [[package]] blocks in poetry.lock / uv.lock (subset TOML). */
export declare function parseTomlPackageBlocks(content: string): LockfilePackage[];
export declare function readPipfileLock(lockPath: string): LockfilePackage[];
/** Solo dependencias con versión fija (==); líneas PEP 508 básicas. */
export declare function readRequirementsTxt(reqPath: string): LockfilePackage[];
export declare function readPythonLockfile(ref: PythonLockRef): LockfilePackage[];
export declare function pythonLockfileLabel(kind: PythonLockKind): string;
/** Árbol MVP: raíz sintética con paquetes como hojas (sin aristas transitivas finas). */
export declare function buildPythonFlatTree(projectLabel: string, packages: LockfilePackage[]): DependencyNode;
export declare function readPythonProjectName(root: string): string;
