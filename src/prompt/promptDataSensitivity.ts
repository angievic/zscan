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

function rank(l: PromptDataSensitivityLevel): number {
  switch (l) {
    case "alta":
      return 3;
    case "media":
      return 2;
    case "baja":
      return 1;
    default:
      return 0;
  }
}

function maxLevel(
  a: PromptDataSensitivityLevel,
  b: PromptDataSensitivityLevel
): PromptDataSensitivityLevel {
  return rank(a) >= rank(b) ? a : b;
}

const ALTA: { re: RegExp; tipo: string; hallazgo: string }[] = [
  {
    re: /\b(password|contraseña|passwd|pwd)\b[^.\n]{0,40}[:=]/i,
    tipo: "credencial / contraseña",
    hallazgo: "Mención de contraseña o campo similar (posible dato sensible en el prompt)",
  },
  {
    re: /\b(api[_-]?key|apikey|secret[_-]?key|client[_-]?secret|private[_-]?key)\b/i,
    tipo: "secreto / clave API",
    hallazgo: "Referencias a claves o secretos en el texto del prompt",
  },
  {
    re: /\b(bearer\s+[a-z0-9._-]{8,}|jwt\.|access[_-]?token|refresh[_-]?token)\b/i,
    tipo: "token de sesión o JWT",
    hallazgo: "Token o JWT mencionado en instrucciones o ejemplo",
  },
  {
    re: /\b(ssn|social\s+security|número\s+de\s+seguro|credit\s+card|tarjeta\s+de\s+crédito|cvv|cvc)\b/i,
    tipo: "identificador financiero o gubernamental",
    hallazgo: "Términos asociados a datos financieros o identidad oficial",
  },
  {
    re: /\b(hipaa|phi\b|datos?\s+de\s+salud|historia\s+clínica|diagnóstico\s+médico)\b/i,
    tipo: "información de salud",
    hallazgo: "Contexto de salud / regulado (alta sensibilidad típica)",
  },
];

const MEDIA: { re: RegExp; tipo: string; hallazgo: string }[] = [
  {
    re: /\b(e-?mail|correo\s+electrónico|@\w+\.\w+)\b/i,
    tipo: "correo / identidad de contacto",
    hallazgo: "Correo u orientación a datos de contacto personales",
  },
  {
    re: /\b(teléfono|telefono|phone\s+number|número\s+de\s+teléfono|dni|documento\s+nacional)\b/i,
    tipo: "PII directa",
    hallazgo: "Teléfono, documento u otros identificadores personales",
  },
  {
    re: /\b(user\s+message|mensaje\s+del\s+usuario|entrada\s+del\s+usuario|human\s+input|end[\s-]?user)\b/i,
    tipo: "texto libre de usuario",
    hallazgo: "El prompt incorpora o describe entrada humana sin formato fijo",
  },
  {
    re: /\b(chat\s+history|historial\s+de\s+chat|conversation\s+log|mensajes\s+anteriores)\b/i,
    tipo: "historial conversacional",
    hallazgo: "Historial de conversación (suele acumular PII y contexto sensible)",
  },
  {
    re: /\b(customer\s+data|datos\s+del\s+cliente|información\s+personal\s+del\s+usuario)\b/i,
    tipo: "datos de cliente",
    hallazgo: "Instrucciones explícitas sobre datos de clientes",
  },
  {
    re: /\b(contexto\s+recuperado|retrieved\s+documents?|rag\s+context|fragmentos?\s+de\s+documentos?)\b/i,
    tipo: "contenido RAG / documentos",
    hallazgo: "Texto recuperado de documentos (puede contener datos internos o personales)",
  },
  {
    re: /\b(sql\s+query|resultado\s+de\s+la\s+consulta|rows?\s+from\s+database|filas?\s+de\s+la\s+tabla)\b/i,
    tipo: "salida de base de datos",
    hallazgo: "Consultas SQL o filas (riesgo de fugas de datos estructurados)",
  },
];

const BAJA: { re: RegExp; tipo: string; hallazgo: string }[] = [
  {
    re: /\b(ejemplo\s+ficticio|fake\s+data|synthetic|placeholder\s+only|solo\s+demostración)\b/i,
    tipo: "marcado como ejemplo",
    hallazgo: "Texto marcado como ficticio o de demostración (menor riesgo si se cumple en runtime)",
  },
];

const PLACEHOLDER_RES =
  /\{\{[\s\S]*?\}\}|\$\{[^}]+\}|%\s*\w+\s*%|<%[\s\S]*?%>|__\w+__/;

function analyzeLine(line: string, lineNum: number): PromptDataSensitivityDetail | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("```")) return null;

  let best: PromptDataSensitivityDetail | null = null;
  const consider = (d: PromptDataSensitivityDetail) => {
    if (!best || rank(d.sensibilidad) > rank(best.sensibilidad)) best = d;
  };

  for (const x of ALTA) {
    if (x.re.test(line)) {
      consider({
        line: lineNum,
        hallazgo: x.hallazgo,
        sensibilidad: "alta",
        tipo_inferido: x.tipo,
      });
    }
  }
  for (const x of MEDIA) {
    if (x.re.test(line)) {
      consider({
        line: lineNum,
        hallazgo: x.hallazgo,
        sensibilidad: "media",
        tipo_inferido: x.tipo,
      });
    }
  }
  for (const x of BAJA) {
    if (x.re.test(line)) {
      consider({
        line: lineNum,
        hallazgo: x.hallazgo,
        sensibilidad: "baja",
        tipo_inferido: x.tipo,
      });
    }
  }

  if (PLACEHOLDER_RES.test(line)) {
    consider({
      line: lineNum,
      hallazgo:
        "Marcador de plantilla ({{…}}, ${…}, etc.): el valor real depende del código que rellena el prompt",
      sensibilidad: "media",
      tipo_inferido: "valor dinámico / variable de plantilla",
    });
  }

  return best;
}

function uniqueTipos(detalles: PromptDataSensitivityDetail[]): string[] {
  const s = new Set<string>();
  for (const d of detalles) s.add(d.tipo_inferido);
  return [...s].sort((a, b) => a.localeCompare(b));
}

function buildSugerencias(
  nivel: PromptDataSensitivityLevel,
  tieneSustituciones: boolean,
  tipos: string[]
): string[] {
  const out: string[] = [];
  if (nivel === "alta" || tipos.some((t) => /credencial|secreto|token|salud|financier/i.test(t))) {
    out.push(
      "Evitá incluir secretos, tokens reales o PII en el texto estático del prompt; usá variables de entorno o vault solo en el servidor."
    );
    out.push(
      "Si el modelo recibe datos regulados (salud, financieros), revisá acuerdos con el proveedor del LLM y minimización de datos."
    );
  }
  if (nivel === "media" || tieneSustituciones) {
    out.push(
      "Para sustituciones: validá y acotá longitud del texto de usuario; considerá filtrado previo (DLP, regex de PII) antes de llamar al modelo."
    );
    out.push(
      "Registrá qué campos se concatenan al prompt en código; los logs de proveedor pueden retener el contenido enviado."
    );
  }
  if (nivel === "baja" && !tieneSustituciones) {
    out.push(
      "Prompt mayormente estático: el riesgo principal suele ser si en runtime se le añaden datos sin revisar (revisá el código que arma el mensaje)."
    );
  }
  if (nivel === "indeterminado") {
    out.push(
      "No hubo patrones claros: revisá manualmente qué variables inyecta tu aplicación en este template."
    );
  }
  return out;
}

export function analyzePromptDataSensitivity(content: string): PromptDataSensitivityAssessment {
  const lines = content.split(/\r?\n/);
  const byLine = new Map<number, PromptDataSensitivityDetail>();

  for (let i = 0; i < lines.length; i++) {
    const d = analyzeLine(lines[i]!, i + 1);
    if (!d) continue;
    const prev = byLine.get(d.line);
    if (!prev || rank(d.sensibilidad) > rank(prev.sensibilidad)) byLine.set(d.line, d);
  }

  const detalles = [...byLine.values()].sort((a, b) => a.line - b.line);
  const tiene_sustituciones = PLACEHOLDER_RES.test(content);

  let nivel: PromptDataSensitivityLevel = "indeterminado";
  for (const d of detalles) {
    nivel = maxLevel(nivel, d.sensibilidad);
  }
  if (nivel === "indeterminado" && tiene_sustituciones) {
    nivel = "media";
  }
  if (nivel === "indeterminado" && content.trim().length > 80 && detalles.length === 0) {
    nivel = "baja";
  }

  const datos_inferidos = uniqueTipos(detalles);
  if (tiene_sustituciones && !datos_inferidos.includes("valor dinámico / variable de plantilla")) {
    datos_inferidos.push("valor dinámico / variable de plantilla");
    datos_inferidos.sort((a, b) => a.localeCompare(b));
  }

  const sugerencias = buildSugerencias(nivel, tiene_sustituciones, datos_inferidos);

  const resumen =
    nivel === "alta"
      ? "Se infieren datos de alta sensibilidad (credenciales, salud, finanzas o equivalente) en el texto."
      : nivel === "media"
        ? "Hay sustituciones dinámicas o referencias a datos personales, historial o contexto RAG/DB."
        : nivel === "baja"
          ? "El archivo parece mayormente estático o acotado; revisá igualmente qué se concatena en runtime."
          : "No se detectaron patrones fuertes; la sensibilidad depende del código que arma el mensaje final.";

  return {
    nivel,
    resumen,
    datos_inferidos,
    sugerencias,
    detalles,
    tiene_sustituciones,
  };
}
