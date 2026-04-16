export const BUILTIN_HEURISTICS = [
    {
        id: "heur-ignore-prior-instructions",
        description: "Frase típica de anulación de instrucciones previas",
        pattern: /\bignore\s+(all\s+)?(previous|prior|above)\s+instructions?\b/i,
    },
    {
        id: "heur-disregard-above",
        description: "Pedido de ignorar texto anterior",
        pattern: /\bdisregard\s+(the\s+)?(above|prior|previous)\b/i,
    },
    {
        id: "heur-you-are-now",
        description: "Reasignación de rol ('you are now a …')",
        pattern: /\byou\s+are\s+now\s+(a|an|the)\b/i,
    },
    {
        id: "heur-end-system",
        description: "Cierre de bloque tipo </system> o frase 'end of system'",
        pattern: /\b(end\s+of\s+system)\b|<\/system\s*>/i,
    },
    {
        id: "heur-jailbreak-dan",
        description: "Referencias explícitas a modo DAN / jailbreak",
        pattern: /\b(DAN\s+mode|jailbreak|bypass\s+(the\s+)?(filter|safety))\b/i,
    },
];
