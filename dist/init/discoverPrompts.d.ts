/**
 * Recorre el repo (sin node_modules, dist, .git, …) y arma entradas `prompts[]`
 * con globs que **sí** coinciden hoy con al menos un fichero.
 */
export declare function discoverPromptGroupsForInit(root: string): {
    paths: string[];
    purpose: string;
}[];
