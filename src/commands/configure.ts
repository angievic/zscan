import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { configPath, patchYamlLlmSection, writeDefaultConfig } from "../config.js";
import { removeEnvLocalKey, upsertEnvLocal, loadEnvLocalFile } from "../env/localEnv.js";
import {
  ZSCAN_ANTHROPIC_BASE_URL_DEFAULT,
  ZSCAN_CLAUDE_MODEL_DEFAULT,
  ZSCAN_GEMINI_MODEL_DEFAULT,
  ZSCAN_GEMINI_OPENAI_BASE_URL,
  ZSCAN_LLM_BASE_URL_DEFAULT,
  ZSCAN_LLM_MODEL_DEFAULT,
} from "../llm/constants.js";
import { runLlmProbe } from "./llm-probe.js";

const OPENAI_BASE_URL = "https://api.openai.com/v1";
const OPENAI_MODEL_DEFAULT = "gpt-4o-mini";

function ollamaOnPath(): boolean {
  const r = spawnSync("ollama", ["--help"], {
    encoding: "utf8",
    stdio: "pipe",
  });
  return r.status === 0;
}

function runOllamaPull(model: string): void {
  if (!ollamaOnPath()) {
    console.log(
      "\n(No se encontró `ollama` en PATH. Instálalo desde https://ollama.com y ejecuta: ollama pull " +
        model +
        ")\n"
    );
    return;
  }
  console.log(`\nDescargando modelo con Ollama: ollama pull ${model}\n`);
  const r = spawnSync("ollama", ["pull", model], {
    stdio: "inherit",
    encoding: "utf8",
  });
  if (r.status !== 0) {
    console.warn(
      "\n`ollama pull` terminó con error; comprueba que el servicio esté en marcha (`ollama serve`).\n"
    );
  }
}

function applyApiKeyToEnvLocal(absRoot: string, apiKey: string): void {
  upsertEnvLocal(absRoot, "ZSCAN_LLM_API_KEY", apiKey);
  removeEnvLocalKey(absRoot, "ZSCAN_LLM_BASE_URL");
  removeEnvLocalKey(absRoot, "ZSCAN_LLM_MODEL");
}

/**
 * Asistente interactivo: OpenAI, Ollama, Gemini (OpenAI-compatible) o Claude (Messages API).
 * Termina con la misma prueba que `llm-probe`.
 */
export async function runInteractiveConfig(root: string) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error(
      "zscan config necesita una terminal interactiva (TTY). En CI usa variables ZSCAN_LLM_* y edita zscan.yaml a mano."
    );
    process.exitCode = 1;
    return;
  }

  const absRoot = path.resolve(root);
  console.log("");
  console.log("zscan config — proveedor LLM");
  console.log("─".repeat(50));
  console.log("");

  if (!fs.existsSync(configPath(absRoot))) {
    const p = writeDefaultConfig(absRoot);
    console.log(`Se creó ${p} con valores por defecto.\n`);
  }

  loadEnvLocalFile(absRoot);

  const rl = readline.createInterface({ input, output });

  let choice = "";
  while (!["1", "2", "3", "4"].includes(choice)) {
    const raw = (
      await rl.question(
        "Proveedor:  [1] OpenAI   [2] Ollama (local)   [3] Google Gemini   [4] Anthropic Claude   [2]: "
      )
    ).trim();
    choice = raw === "" ? "2" : raw;
    if (!["1", "2", "3", "4"].includes(choice)) {
      console.log("  Escribe 1, 2, 3 o 4.\n");
    }
  }

  if (choice === "1") {
    const apiKey = (await rl.question("API key de OpenAI (sk-…): ")).trim();
    if (!apiKey) {
      console.error("Sin API key no se puede continuar.");
      rl.close();
      process.exitCode = 1;
      return;
    }
    const model = (
      await rl.question(`Modelo [${OPENAI_MODEL_DEFAULT}]: `)
    ).trim() || OPENAI_MODEL_DEFAULT;
    applyApiKeyToEnvLocal(absRoot, apiKey);
    patchYamlLlmSection(
      absRoot,
      { enabled: true, base_url: OPENAI_BASE_URL, model },
      { removeApiKeyFromYaml: true, dropProviderField: true }
    );
    console.log(
      "\nListo: OpenAI — `zscan.yaml` (URL + modelo); clave en `.env.local` (ZSCAN_LLM_API_KEY).\n"
    );
  } else if (choice === "3") {
    const apiKey = (await rl.question("API key de Google AI / Gemini: ")).trim();
    if (!apiKey) {
      console.error("Sin API key no se puede continuar.");
      rl.close();
      process.exitCode = 1;
      return;
    }
    const model = (
      await rl.question(`Modelo Gemini [${ZSCAN_GEMINI_MODEL_DEFAULT}]: `)
    ).trim() || ZSCAN_GEMINI_MODEL_DEFAULT;
    applyApiKeyToEnvLocal(absRoot, apiKey);
    patchYamlLlmSection(
      absRoot,
      {
        enabled: true,
        base_url: ZSCAN_GEMINI_OPENAI_BASE_URL,
        model,
      },
      { removeApiKeyFromYaml: true, dropProviderField: true }
    );
    console.log(
      "\nListo: Gemini — endpoint OpenAI-compatible de Google; clave en `.env.local`.\n"
    );
  } else if (choice === "4") {
    const apiKey = (await rl.question("API key de Anthropic (sk-ant-…): ")).trim();
    if (!apiKey) {
      console.error("Sin API key no se puede continuar.");
      rl.close();
      process.exitCode = 1;
      return;
    }
    const model = (
      await rl.question(`Modelo Claude [${ZSCAN_CLAUDE_MODEL_DEFAULT}]: `)
    ).trim() || ZSCAN_CLAUDE_MODEL_DEFAULT;
    applyApiKeyToEnvLocal(absRoot, apiKey);
    patchYamlLlmSection(
      absRoot,
      {
        enabled: true,
        base_url: ZSCAN_ANTHROPIC_BASE_URL_DEFAULT,
        model,
        provider: "anthropic",
      },
      { removeApiKeyFromYaml: true }
    );
    console.log(
      "\nListo: Claude — `llm.provider: anthropic` + API Messages; clave en `.env.local`.\n"
    );
  } else {
    const model = (
      await rl.question(`Modelo Ollama [${ZSCAN_LLM_MODEL_DEFAULT}]: `)
    ).trim() || ZSCAN_LLM_MODEL_DEFAULT;
    removeEnvLocalKey(absRoot, "ZSCAN_LLM_API_KEY");
    patchYamlLlmSection(
      absRoot,
      {
        enabled: true,
        base_url: ZSCAN_LLM_BASE_URL_DEFAULT,
        model,
      },
      { removeApiKeyFromYaml: true, dropProviderField: true }
    );
    console.log("\n`zscan.yaml` actualizado para Ollama local.\n");
    runOllamaPull(model);
  }

  rl.close();

  console.log(
    "Asegúrate de tener `.env.local` en `.gitignore` si guardas claves ahí.\n"
  );

  loadEnvLocalFile(absRoot);
  console.log("Comprobando conexión (`zscan llm-probe`)…\n");
  await runLlmProbe(absRoot);
}
