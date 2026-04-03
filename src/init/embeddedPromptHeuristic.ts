/**
 * Detección best-effort de **cadenas en código** (TS/JS/Python/Ruby/Go/Java/Kotlin, …)
 * que podrían ser prompts para modelos, sin parsear AST.
 */
const KEYWORDS =
  /\b(system|user|assistant|instruction|prompt|chat\.completions|openai|anthropic|claude|gemini|ollama|messages\s*\(|role\s*:\s*['"]?(system|user|assistant)|you\s+are\s+an?|act\s+as\s+a|respond\s+with|following\s+(instructions|rules))\b/i;

const MIN_LITERAL = 72;

function hasLongPromptLikeLiteral(source: string): boolean {
  if (source.length < MIN_LITERAL) return false;
  // Python """ ... """ / ''' ... '''
  if (
    new RegExp(`"""[\\s\\S]{${MIN_LITERAL},8000}?"""`, "m").test(source) ||
    new RegExp(`'''[\\s\\S]{${MIN_LITERAL},8000}?'''`, "m").test(source)
  ) {
    return true;
  }
  // JS/TS template literals `...`
  if (new RegExp(`\`[^\`]{${MIN_LITERAL},}\``).test(source)) {
    return true;
  }
  // C-style "..." y '...' (una línea o pocas, con escapes)
  if (
    new RegExp(`"(?:[^"\\\\]|\\\\.){${MIN_LITERAL},}"`).test(source) ||
    new RegExp(`'(?:[^'\\\\]|\\\\.){${MIN_LITERAL},}'`).test(source)
  ) {
    return true;
  }
  return false;
}

/**
 * `true` si el fragmento de código parece mezclar **palabras típicas de LLM** y **literales largos**.
 */
export function mayContainEmbeddedPromptLiterals(source: string): boolean {
  if (source.length < 80) return false;
  if (!hasLongPromptLikeLiteral(source)) return false;
  if (KEYWORDS.test(source)) return true;
  // Literal muy largo aunque no haya keyword (p. ej. texto de sistema copiado)
  if (/`[^`]{240,}`/.test(source)) return true;
  if (/"""[\s\S]{240,}?"""/m.test(source)) return true;
  if (/'''[\s\S]{240,}?'''/m.test(source)) return true;
  return false;
}
