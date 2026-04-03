/**
 * Integración con **Ollama** (sin APIs de terceros).
 *
 * Requisitos:
 * - `ollama` en PATH
 * - `ollama serve` en marcha (por defecto :11434)
 * - Variable: `ZSCAN_INTEGRATION_OLLAMA=1`
 *
 * Si el modelo no está en disco, `beforeAll` ejecuta `ollama pull` (puede tardar varios minutos la primera vez).
 * Sin `ollama` en PATH, la suite se omite (exit 0) y se emite un aviso en consola.
 */
import { spawn, spawnSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import { ZSCAN_LLM_MODEL_DEFAULT } from "./constants.js";
import { invokeChat } from "./invoke.js";
import type { ResolvedLlmOptions } from "./resolve-options.js";

const OLLAMA_BASE = "http://127.0.0.1:11434/v1";
const TAGS_URL = "http://127.0.0.1:11434/api/tags";
const ENABLED = process.env.ZSCAN_INTEGRATION_OLLAMA === "1";
const MODEL =
  process.env.ZSCAN_OLLAMA_TEST_MODEL?.trim() || ZSCAN_LLM_MODEL_DEFAULT;

function ollamaCliAvailable(): boolean {
  return spawnSync("ollama", ["--version"], {
    encoding: "utf8",
    stdio: "pipe",
  }).status === 0;
}

const CLI_AVAILABLE = ollamaCliAvailable();
if (ENABLED && !CLI_AVAILABLE) {
  console.warn(
    "[zscan] ZSCAN_INTEGRATION_OLLAMA=1 pero `ollama` no está en PATH; se omite la suite (instala desde https://ollama.com)."
  );
}

async function ollamaServerReachable(): Promise<boolean> {
  try {
    const r = await fetch(TAGS_URL, { signal: AbortSignal.timeout(2500) });
    return r.ok;
  } catch {
    return false;
  }
}

async function listOllamaModelNames(): Promise<string[]> {
  const r = await fetch(TAGS_URL, { signal: AbortSignal.timeout(5000) });
  if (!r.ok) return [];
  const data = (await r.json()) as { models?: { name: string }[] };
  return (data.models ?? []).map((m) => m.name);
}

function pullModel(model: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("ollama", ["pull", model], {
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ollama pull ${model} exited ${code}`));
    });
  });
}

function baseOpts(): ResolvedLlmOptions {
  return {
    enabled: true,
    baseUrl: OLLAMA_BASE,
    model: MODEL,
    provider: "openai_compatible",
  };
}

describe.skipIf(!ENABLED || !CLI_AVAILABLE)(
  "Ollama (integración local, sin terceros)",
  () => {
    beforeAll(async () => {
      if (!(await ollamaServerReachable())) {
        throw new Error(
          "Ollama no responde en :11434. Arranca el servicio (`ollama serve` suele estar ya activo en segundo plano)."
        );
      }
      const names = await listOllamaModelNames();
      const baseName = MODEL.includes(":") ? MODEL.split(":")[0]! : MODEL;
      const hasModel = names.some(
        (n) => n === MODEL || n.startsWith(`${baseName}:`)
      );
      if (!hasModel) {
        console.log(`[integration] Descargando modelo con Ollama: ${MODEL} …`);
        await pullModel(MODEL);
      }
    });

    it("invokeChat responde vía API OpenAI-compatible (/v1/chat/completions)", async () => {
      const text = await invokeChat(
        baseOpts(),
        [
          {
            role: "user",
            content:
              'Responde exactamente la palabra OK sin puntuación extra ni explicación.',
          },
        ],
        { max_tokens: 16, temperature: 0.1 }
      );
      expect(text.length).toBeGreaterThan(0);
      expect(text.toLowerCase()).toMatch(/ok/);
    });

    it("invokeChat admite mensaje system + user (como prompt-scan)", async () => {
      const text = await invokeChat(
        baseOpts(),
        [
          {
            role: "system",
            content: "Responde de forma mínima, sin explicación.",
          },
          {
            role: "user",
            content: "¿Cuánto es 1+1? Responde solo el número.",
          },
        ],
        { max_tokens: 8, temperature: 0.1 }
      );
      expect(text).toMatch(/2/);
    });
  }
);
