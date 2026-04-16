/**
 * Heurísticas sobre qué clase de datos parece entrar al prompt y qué tan sensible es.
 * No ejecuta la app: solo texto del archivo de prompt.
 */
export type PromptDataSensitivityLevel = "alta" | "media" | "baja" | "indeterminado";
export interface PromptDataSensitivityDetail {
    line: number;
    /** Qué patrón o frase disparó el aviso. */
    hallazgo: string;
    sensibilidad: PromptDataSensitivityLevel;
    /** Tipo de dato inferido (ej. credencial, texto de usuario). */
    tipo_inferido: string;
}
export interface PromptDataSensitivityAssessment {
    nivel: PromptDataSensitivityLevel;
    resumen: string;
    /** Tipos de dato distintos detectados (lista corta para tablas). */
    datos_inferidos: string[];
    sugerencias: string[];
    detalles: PromptDataSensitivityDetail[];
    /** Hay marcadores de sustitución (Mustache, template string, etc.). */
    tiene_sustituciones: boolean;
}
export declare function analyzePromptDataSensitivity(content: string): PromptDataSensitivityAssessment;
