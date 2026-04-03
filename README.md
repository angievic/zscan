# zscan

CLI y librería **local** para auditar dependencias contra [OSV](https://osv.dev/) en varios ecosistemas (**npm**, **PyPI**, **Go**, **RubyGems**, **Maven**), generar **árbol de dependencias**, notas de **propagación**, pistas de uso en código (best-effort), **scraping de referencias** de vulnerabilidades y, en el mismo informe, **prompt-scan** según `zscan.yaml` (heurísticas, reglas y LLM si está habilitado). **No modifica tu repositorio**.

| | |
|--|--|
| **Sitio** | Tras activar Pages en `/docs`: `https://<usuario>.github.io/<repo>/` (edita enlaces en `docs/index.html`) |
| **Visión / roadmap** | [docs/vision-agente-seguridad.md](docs/vision-agente-seguridad.md) |
| **Licencia** | MIT |

---

## Tabla de contenidos

- [Instalación desde GitHub](#instalación-desde-github)
- [GitHub Pages (sitio estático)](#github-pages-sitio-estático)
- [Uso rápido](#uso-rápido)
- [Ecosistemas soportados](#ecosistemas-soportados)
- [LLM (config, probe, prompt-scan)](#llm-config-probe-prompt-scan)
- [Servidor HTTP, offline](#servidor-http-offline)
- [Scraping de referencias CVE (por defecto en `scan`)](#scraping-de-referencias-cve-por-defecto-en-scan)
- [Config `zscan.yaml`](#config-zscanyaml)
- [Scripts del repositorio](#scripts-del-repositorio)
- [Publicación opcional en npm](#publicación-opcional-en-npm)

---

## Instalación desde GitHub

No necesitas publicar ni instalar desde npm para usar zscan: basta con clonar y compilar.

**Requisitos:** Node.js **18+**

```bash
git clone https://github.com/angieshadai/zscan.git
cd zscan
npm install
npm run build
```

Ejecuta la CLI con:

```bash
node dist/cli.js --help
```

**Atajo** (en la raíz de este repo): `./zscan help` — el script `zscan` ejecuta `npm install` y `npm run build` si faltan dependencias o `dist/`. Opcional: `chmod +x zscan`.

Variable **`ZSCAN_ROOT`**: raíz del proyecto a escanear (por defecto: raíz del repo git o directorio actual).

---

## GitHub Pages (sitio estático)

La landing pública vive en **`docs/`** (`index.html` + `.nojekyll`), lista para **GitHub Pages sin workflows ni npm** en el despliegue del sitio.

1. Sube el repo a GitHub.
2. **Settings** → **Pages**.
3. **Build and deployment** → **Deploy from a branch**.
4. Branch: `main` (o la principal) · Folder: **`/docs`**.
5. Guarda. Tras unos minutos: `https://<tu-usuario>.github.io/<nombre-repo>/`

**`.nojekyll`** evita que Jekyll ignore o transforme archivos; el sitio se sirve tal cual.

Si el fork o el usuario no es `angieshadai/zscan`, actualiza los enlaces en `docs/index.html` y la tabla del README de arriba.

---

## Uso rápido

```bash
node dist/cli.js init --root /ruta/al/proyecto
node dist/cli.js scan --root /ruta/al/proyecto --markdown reporte.md
```

**`init`** genera `zscan.yaml` recorriendo el proyecto (sin `node_modules`, `dist`, `.git`, …) y rellenando **`prompts[]`** con: (1) **Markdown** y convenciones de agentes (`docs/`, `prompts/`, `.cursor/`, `*.prompt.md`, `AGENTS.md` / `CLAUDE.md` / `GEMINI.md`, `README.md`, `contrib/`, …) cuando hay al menos un fichero; (2) **código fuente** bajo `src/`, `lib/`, `app/`, `cmd/`, `pkg/`, `internal/` — globs `*.{ts,tsx,js,jsx,mjs,cjs,py,rb,go,java,kt}` solo si una muestra de ficheros contiene **literales largos** (template literals JS, triple quotes Python, strings entre comillas, etc.) y **señales típicas de prompts/LLM** (heurística, sin AST). Si no hay nada de lo anterior, deja plantilla `docs/**/*.md` + `prompts/**/*.md`. Incluye la regla `no_instruction_override` y `explicit_core` desde el lockfile JS si existe.

- **`scan`** arma un **único informe** (Markdown/JSON): dependencias + OSV + (por defecto) **enriquecimiento** de URLs de advisories + **prompt-scan** según `prompts[]` en `zscan.yaml`.
- Código de salida **1** si hay vulnerabilidades OSV, si **prompt-scan** tiene fallos, o si la configuración de prompts es errónea (p. ej. globs sin archivos).
- `--json report.json` añade salida JSON.
- `--no-enrich-docs` omite el scraping de referencias OSV (más rápido).
- `--no-prompt-llm` evita llamar al modelo en el bloque de prompts (solo regex + heurísticas).
- `--enrich-docs` queda **obsoleto** (sin efecto; compatibilidad con scripts antiguos).
- `--ignore-submodules` excluye rutas bajo submódulos Git al mapear imports.

---

## Ecosistemas soportados

| Ecosistema | Lockfile / fuente |
|------------|-------------------|
| **JavaScript** | `package-lock.json` → `pnpm-lock.yaml` → `yarn.lock` (árbol transitivo solo con npm lock) |
| **Python** | `poetry.lock`, `uv.lock`, `Pipfile.lock`, `requirements.txt` (pins `==`) |
| **Go** | `go.mod` |
| **Ruby** | `Gemfile.lock` |
| **Java (Maven)** | `pom.xml` (versiones literales o `${prop}` resolubles en `<properties>`) |

**Git** en el informe: detección de repo, `HEAD`, `.gitmodules`. **Gradle** aún no está soportado.

---

## LLM (config, probe, prompt-scan)

Soportados: **OpenAI**, **Ollama**, **Google Gemini** (endpoint OpenAI-compatible de Google) y **Anthropic Claude** (API Messages, `llm.provider: anthropic` en YAML).

```bash
node dist/cli.js config --root .    # [1] OpenAI [2] Ollama [3] Gemini [4] Claude
node dist/cli.js llm-probe --root . # alias: llm-ping
node dist/cli.js prompt-scan --root .  # --no-llm si no quieres llamar al modelo
```

Claves: **`zscan config`** guarda la API key en **`.env.local`** (mantén fuera del git público). Variables con prioridad sobre YAML:

- `ZSCAN_LLM_BASE_URL` — por defecto Ollama `http://127.0.0.1:11434/v1`
- `ZSCAN_LLM_MODEL`
- `ZSCAN_LLM_API_KEY`
- `ZSCAN_LLM_PROVIDER` — p. ej. `anthropic` en CI

Con `llm.enabled: true`, **`scan`** (informe unificado) y **`prompt-scan`** usan el modelo para reglas sin `pattern` y comprobaciones semánticas; **`scan --no-prompt-llm`** deja solo heurísticas y regex. Más detalle: [docs/vision-agente-seguridad.md](docs/vision-agente-seguridad.md).

---

## Servidor HTTP, offline

```bash
node dist/cli.js serve --host 127.0.0.1 --port 8787
# POST /scan  JSON: { "root": "...", "offline": false, "enrichDocs": true, "skipPromptLlm": false, ... }
```

- **Offline OSV:** `scan --offline` o `ZSCAN_OFFLINE=1` (caché en `~/.cache/zscan/osv` o `ZSCAN_OSV_CACHE_DIR`).

---

## Scraping de referencias CVE (por defecto en `scan`)

Además de los datos estructurados de **OSV**, **`scan`** **enriquece por defecto** cada hallazgo bajando la **primera URL https** del advisory en `references`, convirtiendo el HTML a texto y pegando un **extracto** en el informe (JSON: `meta.docSnippets`). Sirve para **contexto narrativo** (mitigación, detalle del vendor) al pegar el reporte en un asistente.

```bash
node dist/cli.js scan --root . --markdown reporte.md
# sin scraping (más rápido):
node dist/cli.js scan --root . --no-enrich-docs --markdown reporte.md
```

- **Caché:** `~/.cache/zscan/enrich` o **`ZSCAN_ENRICH_CACHE_DIR`**; TTL **7 días** por URL.
- **Límite:** ~**15** URLs por escaneo (orden de aparición en hallazgos).
- **API HTTP:** `POST /scan` enriquece salvo **`"enrichDocs": false`**.
- **Errores** (timeout, bloqueo, HTML raro): `meta.enrichErrors` y Markdown bajo avisos.
- **Límites:** no es un crawler completo; sitios con anti-bot pueden fallar. Roadmap: reintentos, rate limit y plantillas por dominio — [docs/vision-agente-seguridad.md](docs/vision-agente-seguridad.md).

---

## Variables de entorno

Plantilla comentada: **[`.env.example`](.env.example)** (todas las `ZSCAN_*` que usa el proyecto).

La CLI **no** lee un fichero `.env` genérico por defecto; para LLM sí se cargan claves `ZSCAN_*` desde **`.env.local`** en la raíz del proyecto escaneado (`loadEnvLocalFile`). Puedes exportar manualmente desde `.env` en tu shell si lo prefieres.

## Config `zscan.yaml`

- Archivo por defecto en la raíz del proyecto; otro nombre con **`ZSCAN_CONFIG`**.
- **`schema_version: 1`** identifica el esquema.

**pre-commit / VS Code:** `contrib/pre-commit`, `contrib/vscode`.

---

## Tests

```bash
npm test              # unitarios (Vitest), sin red ni Ollama
npm run test:watch
```

Cubren parsers de lockfiles (`go.mod`, `Gemfile.lock`, `pom.xml`, TOML tipo Poetry), `resolveLlmOptions`, `.env.local`, `evaluatePromptContent` (prompt-scan) y `patchYamlLlmSection`. Los `*.test.ts` y `*.integration.test.ts` no se emiten a `dist/`.

### Integración Ollama (local, sin APIs de terceros)

Puerto por defecto **11434**. El script del repo **instala Ollama si no está** (solo **macOS** con [Homebrew](https://brew.sh): `brew install ollama`; **Linux**: script oficial de [ollama.com](https://ollama.com)) y, si hace falta, arranca **`ollama serve`** en segundo plano. En **Windows** u otros sistemas hay que instalar a mano desde [ollama.com/download](https://ollama.com/download).

```bash
npm run ollama:ensure              # o: ./zscan ollama
./zscan ollama --no-install        # solo levantar; falla si no hay CLI (útil en CI)
```

Variable opcional: `ZSCAN_OLLAMA_NO_INSTALL=1` (mismo efecto que `--no-install`).

Luego los tests de integración (o todo en un paso):

```bash
ZSCAN_INTEGRATION_OLLAMA=1 npm run test:integration
npm run test:integration:ollama   # ensure + integración
```

- Activa solo los ficheros `*.integration.test.ts`.
- Si falta el modelo (p. ej. `qwen2.5-coder:3b`), el `beforeAll` ejecuta **`ollama pull`** (la primera vez puede tardar mucho).
- Otro modelo: `ZSCAN_OLLAMA_TEST_MODEL=llama3.2:1b ZSCAN_INTEGRATION_OLLAMA=1 npm run test:integration`

Sin la variable `ZSCAN_INTEGRATION_OLLAMA=1`, la suite de integración **no se ejecuta** (CI rápido).

---

## Scripts del repositorio

| Script | Descripción |
|--------|-------------|
| `npm run build` | Compila TypeScript → `dist/` |
| `npm test` | Vitest unitarios (`src/**/*.test.ts`, sin `*.integration.test.ts`) |
| `npm run test:integration` | Ollama local; requiere `ZSCAN_INTEGRATION_OLLAMA=1` |
| `npm run ollama:ensure` | Instala Ollama si falta (macOS/Homebrew, Linux/script) y arranca `serve` si :11434 no responde |
| `npm run test:integration:ollama` | `ollama:ensure` + integración con `ZSCAN_INTEGRATION_OLLAMA=1` |
| `npm run scan:self` | Escanea este proyecto (Markdown por stdout; **exit 1** si hay hallazgos OSV) |
| `npm run scan:self:save` | Igual, pero escribe `zscan-self-report.md` y `.json` (gitignored) sin imprimir |
| `npm run scan:example` | Escanea `examples/test-app` |
| `npm run scan:test-py` | Escanea `examples/test-py` |
| `npm run scan:test-yarn` | Escanea `examples/test-yarn` |
| `npm run scan:test-pnpm` | Escanea `examples/test-pnpm` |

---

## Publicación opcional en npm

Si más adelante quieres distribuir el paquete por npm:

1. Cuenta en [npmjs.com](https://www.npmjs.com/) y `npm login`.
2. Comprueba que el nombre en `package.json` esté libre.
3. `npm version patch` (o minor/major) y `npm publish --access public`.

El flujo recomendado para usuarios y para la documentación pública sigue siendo **clonar desde GitHub** + **sitio en GitHub Pages**.

---

## Licencia

MIT
# zscan
