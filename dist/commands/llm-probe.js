import { loadConfig } from "../config.js";
import { loadEnvLocalFile } from "../env/localEnv.js";
import { invokeChat } from "../llm/invoke.js";
import { resolveLlmOptions } from "../llm/resolve-options.js";
/**
 * Comprueba que la API OpenAI-compatible responde (Ollama, OpenAI, u otro proxy).
 */
export async function runLlmProbe(root) {
    loadEnvLocalFile(root);
    const cfg = loadConfig(root);
    const o = resolveLlmOptions(cfg);
    console.log(`Base URL: ${o.baseUrl}`);
    console.log(`Modelo:   ${o.model}`);
    console.log(`Provider: ${o.provider}`);
    console.log(`enabled en YAML: ${cfg.llm?.enabled === true} (probe ignora enabled)`);
    console.log("");
    try {
        const reply = await invokeChat(o, [
            {
                role: "user",
                content: 'Responde exactamente una palabra: "OK" (sin comillas, sin explicación).',
            },
        ], { max_tokens: 64 });
        console.log("Respuesta:", reply);
        if (!/OK/i.test(reply)) {
            console.warn("(Advertencia: se esperaba contener OK; revisa el modelo o el prompt.)");
        }
    }
    catch (e) {
        console.error(e instanceof Error ? e.message : e);
        process.exitCode = 1;
    }
}
