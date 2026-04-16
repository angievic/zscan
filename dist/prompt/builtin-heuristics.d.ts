/** Heurísticas locales (sin red); origen siempre `heuristic`. */
export interface BuiltinHeuristic {
    id: string;
    description: string;
    pattern: RegExp;
}
export declare const BUILTIN_HEURISTICS: BuiltinHeuristic[];
