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
- [Dependencia en otro proyecto (cualquier lenguaje)](#dependencia-en-otro-proyecto-cualquier-lenguaje)
- [GitHub Pages (sitio estático)](#github-pages-sitio-estático)
- [Uso rápido](#uso-rápido)
- [Referencia de configuración](#referencia-de-configuración)
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

## Dependencia en otro proyecto (cualquier lenguaje)

El **repositorio que escaneás** puede estar en **Python, Go, Ruby, Java, Rust**, etc. **zscan no sustituye al runtime de tu app**: solo necesitas **Node.js 18+** en la máquina o en CI para **instalar y ejecutar** la CLI; el lockfile y el código del otro proyecto no tienen que ser Node.

### Opción recomendada: `devDependency` con npm / pnpm / Yarn

Aunque el producto no sea una app Node, es habitual tener un **`package.json` mínimo** en la raíz (solo herramientas: linters, zscan, etc.).

**Instalar desde GitHub** (sin depender de npmjs):

```bash
npm install --save-dev github:angieshadai/zscan
```

```bash
pnpm add -D github:angieshadai/zscan
yarn add -D github:angieshadai/zscan
```

**Compilar** zscan dentro de `node_modules` (el paquete trae fuente TypeScript; hace falta generar `dist/`):

```bash
npm explore zscan -- npm install && npm run build
```

(Equivalente manual: `cd node_modules/zscan && npm install && npm run build`.)

**Escanear** tu repo (raíz del producto = `.`):

```bash
npx zscan scan-all --root .
# o:
node node_modules/zscan/dist/cli.js scan-all --root .
```

**Fijar rama o tag** (reproducibilidad):

```bash
npm install --save-dev "git+https://github.com/angieshadai/zscan.git#main"
npm install --save-dev "git+https://github.com/angieshadai/zscan.git#v0.1.0"
```

**Script en el `package.json` del producto** (ejemplo):

```json
{
  "scripts": {
    "security:scan": "zscan scan-all --root ."
  }
}
```

Si **publicás zscan en npm** ([Publicación opcional en npm](#publicación-opcional-en-npm)), podés usar `npm install --save-dev zscan`: el paquete publicado incluye `dist/` y suele **no** requerir build manual tras instalar.

### Sin `package.json` en el repo del producto

- **Submódulo Git**: por ejemplo `git submodule add https://github.com/angieshadai/zscan.git tools/zscan` → en `tools/zscan` ejecutás `npm ci && npm run build` y llamás `node tools/zscan/dist/cli.js scan-all --root ..` (o `--root` absoluto al repo de la app).
- **Clonar aparte**: igual que [Instalación desde GitHub](#instalación-desde-github) y escanear con **`ZSCAN_ROOT=/ruta/al/otro/repo`** o **`--root /ruta/al/otro/repo`**.
- **CI / Docker**: imagen con Node 18+, checkout o copia de zscan, `npm ci && npm run build`, luego `node …/dist/cli.js scan-all --root "$CI_PROJECT_DIR"` (o la ruta de tu código).

### pre-commit y otros orquestadores

Podés invocar la misma CLI desde **pre-commit**, **Makefile**, **Taskfile**, **Just**, etc.; solo necesitás una ruta estable a `dist/cli.js` (tras build) y pasar **`--root`** al directorio del proyecto. Ejemplo de hook: [contrib/pre-commit/sample.pre-commit-config.yaml](contrib/pre-commit/sample.pre-commit-config.yaml).

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
node dist/cli.js scan-all --root /ruta/al/proyecto
```

**`init`** genera `zscan.yaml` recorriendo el proyecto (sin `node_modules`, `dist`, `.git`, …) y rellenando **`prompts[]`** con: (1) **Markdown** y convenciones de agentes (`docs/`, `prompts/`, `.cursor/`, `*.prompt.md`, `AGENTS.md` / `CLAUDE.md` / `GEMINI.md`, `README.md`, `contrib/`, …) cuando hay al menos un fichero; (2) **código fuente** bajo `src/`, `lib/`, `app/`, `cmd/`, `pkg/`, `internal/` — globs `*.{ts,tsx,js,jsx,mjs,cjs,py,rb,go,java,kt}` solo si una muestra de ficheros contiene **literales largos** (template literals JS, triple quotes Python, strings entre comillas, etc.) y **señales típicas de prompts/LLM** (heurística, sin AST). Si no hay nada de lo anterior, deja plantilla `docs/**/*.md` + `prompts/**/*.md`. Incluye la regla `no_instruction_override` y `explicit_core` desde el lockfile JS si existe.

- **`scan`** arma un **único informe** (Markdown/JSON): dependencias + OSV + (por defecto) **enriquecimiento** de URLs de advisories + **prompt-scan** según `prompts[]` en `zscan.yaml`.
- Código de salida **1** si hay vulnerabilidades OSV, si **prompt-scan** tiene fallos, o si la configuración de prompts es errónea (p. ej. globs sin archivos).
- `--json` / `--markdown` con ruta explícita solo si necesitas copias **fuera** del run (p. ej. CI); el flujo habitual es **`--report-bundle`** (todo dentro de `zscan-runs/<id>-scan/`).
- `--no-enrich-docs` omite el scraping de referencias OSV (más rápido).
- `--no-prompt-llm` evita llamar al modelo en el bloque de prompts (solo regex + heurísticas).
- `--enrich-docs` queda **obsoleto** (sin efecto; compatibilidad con scripts antiguos).
- `--ignore-submodules` excluye rutas bajo submódulos Git al mapear imports.
- **`scan-all`** es el atajo recomendado: equivale a **`scan --report-bundle --no-print`** con padre por defecto **`zscan-runs`** (ver tabla de comandos).
- **`--report-bundle`** en `scan` hace lo mismo de forma explícita: bajo el directorio padre (por defecto **`./zscan-runs`**) se crea **`zscan-runs/<id-hex>-scan/`** con: `report.json` (`ScanResult` indentado), **`informe.json`** (vista por pestañas, `zscanInformeVersion`), **`prompts.json`** (siempre; `zscanPromptsInformeVersion` + `resultado` / `mensaje`), `report.html` (mismas secciones por pestañas), `informe.md`, `prompts.md` si aplica, y `ecosystems/*.{json,md}`. Sin bundle solo hay **stdout** (y rutas `--json` / `--markdown` solo si las pasas). La ruta creada se imprime como `Paquete de informe: ...`. Ejemplo de otro padre: `--report-bundle ./runs` → `./runs/<id>-scan/`.

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
node dist/cli.js scan --root . --report-bundle --no-print
# sin scraping (más rápido):
node dist/cli.js scan --root . --no-enrich-docs --report-bundle --no-print
```

- **Caché:** `~/.cache/zscan/enrich` o **`ZSCAN_ENRICH_CACHE_DIR`**; TTL **7 días** por URL.
- **Límite:** ~**15** URLs por escaneo (orden de aparición en hallazgos).
- **API HTTP:** `POST /scan` enriquece salvo **`"enrichDocs": false`**.
- **Errores** (timeout, bloqueo, HTML raro): `meta.enrichErrors` y Markdown bajo avisos.
- **Límites:** no es un crawler completo; sitios con anti-bot pueden fallar. Roadmap: reintentos, rate limit y plantillas por dominio — [docs/vision-agente-seguridad.md](docs/vision-agente-seguridad.md).

---

## Variables de entorno

Plantilla comentada línea a línea: **[`.env.example`](.env.example)**. Para comandos que usan LLM, la CLI carga **`ZSCAN_*`** desde **`.env.local`** en la raíz del proyecto escaneado (no un `.env` genérico automático). En bash puedes hacer `set -a && source .env && set +a` si prefieres exportar desde otro fichero.

---

## Referencia de configuración

Aquí tienes **YAML**, **variables de entorno**, **CLI**, el atajo **`./zscan`**, **VS Code / Cursor** y **pre-commit** en un solo sitio.

### `zscan.yaml`

| Tema | Detalle |
|------|---------|
| Ubicación | Raíz del proyecto; otro nombre con env **`ZSCAN_CONFIG`**. |
| Esquema | **`schema_version: 1`** (ver avisos si usas una versión mayor). |
| Contenido típico | `llm`, `prompts[]` (globs + `purpose`), `reliability`, `rules[]`. |
| Ejemplo en este repo | [zscan.yaml](zscan.yaml) |

Tras clonar un proyecto vacío: `node dist/cli.js init --root .` (o `./zscan init`). **`init`** detecta Markdown, agentes y código con posibles prompts; ver [Uso rápido](#uso-rápido).

### Variables `ZSCAN_*` (resumen)

| Variable | Rol |
|----------|-----|
| `ZSCAN_CONFIG` | Nombre del fichero YAML (por defecto `zscan.yaml`). |
| `ZSCAN_ROOT` | Raíz a escanear con el script [`./zscan`](zscan) si no usas `--root`. |
| `ZSCAN_OFFLINE` | `1` → OSV solo desde caché (equivale a `scan --offline`). |
| `ZSCAN_OSV_CACHE_DIR` | Caché OSV (por defecto `~/.cache/zscan/osv`). |
| `ZSCAN_ENRICH_CACHE_DIR` | Caché del scraping de referencias CVE. |
| `ZSCAN_LLM_BASE_URL` | URL base API compatible OpenAI (p. ej. Ollama `http://127.0.0.1:11434/v1`). |
| `ZSCAN_LLM_MODEL` | Identificador del modelo. |
| `ZSCAN_LLM_API_KEY` | Clave (OpenAI, Gemini, Anthropic, …). |
| `ZSCAN_LLM_PROVIDER` | `openai_compatible`, `anthropic`, etc. |
| `ZSCAN_INTEGRATION_OLLAMA` | `1` → activa tests de integración contra Ollama. |
| `ZSCAN_OLLAMA_TEST_MODEL` | Modelo para esos tests. |
| `ZSCAN_OLLAMA_NO_INSTALL` | `1` → [`scripts/ensure-ollama.sh`](scripts/ensure-ollama.sh) no instala Ollama (solo comprueba / levanta). |

Detalle y comentarios: **[`.env.example`](.env.example)**.

### Comandos CLI

Ayuda: `node dist/cli.js --help` y `node dist/cli.js <comando> --help`. Desarrollo sin compilar: **`npm run dev -- <cmd>`** (ej. `npm run dev -- scan-all --help`) con [`tsx`](https://github.com/privatenumber/tsx).

| Comando | Uso típico | Parámetros (principales) | Descripción |
|---------|------------|--------------------------|-------------|
| **`init`** | `init --root .` | `--root <dir>` (def. `.`), `--force` | Genera [`zscan.yaml`](zscan.yaml); `--force` sobrescribe el fichero. |
| **`config`** | `config --root .` | `--root <dir>` | Asistente interactivo: proveedor LLM, modelo y API key → **`.env.local`**. |
| **`llm-probe`** | `llm-probe --root .` | `--root <dir>` | Alias: **`llm-ping`**. Comprueba que el modelo responde según YAML + `.env.local`. |
| **`prompt-scan`** | `prompt-scan --root .` | `--root`, `--json <f>`, `--markdown <f>`, `--no-print`, `--no-llm` | Alias: **`prompts`**. Solo evalúa `prompts[]` (heurísticas, regex, LLM si está activo). |
| **`scan`** | `scan --root .` | `--root`, `--report-bundle [dir]`, `--no-print`, `--json`, `--markdown`, `--offline`, `--refresh-osv`, `--no-enrich-docs`, `--no-prompt-llm`, `--ignore-submodules` | Informe único: lockfiles, OSV, scraping de referencias (por defecto), imports, prompt-scan integrado. Sin `--report-bundle` el Markdown va a **stdout** salvo `--no-print`. |
| **`scan-all`** | `scan-all --root .` | Igual que `scan` salvo bundle: **`--bundle-parent <dir>`** (def. `zscan-runs`), **`--print`** (opcional, también stdout), más `--json` / `--markdown` adicionales, `--offline`, `--refresh-osv`, `--no-enrich-docs`, `--no-prompt-llm`, `--ignore-submodules` | **Atajo recomendado**: siempre escribe un run en **`<bundle-parent>/<id>-scan/`** (HTML, JSON, MD por ecosistema, prompts). Por defecto **no** imprime el Markdown completo por stdout (usa `--print` si lo quieres). Equivale a `scan --report-bundle --no-print` con el mismo padre. |
| **`serve`** | `serve --port 8787` | `--host <addr>` (def. `127.0.0.1`), `--port <n>` (def. `8787`) | API HTTP local: **`GET /health`**, **`POST /scan`** (cuerpo JSON con opciones de escaneo). |

### Atajo `./zscan` (este repositorio)

Script [`zscan`](zscan): instala dependencias y compila si hace falta; usa **`ZSCAN_ROOT`** o la raíz Git del cwd.

| Invocación | Equivale a |
|------------|------------|
| `./zscan scan` | `scan --root <raíz>` |
| `./zscan scan-all` | `scan-all --root <raíz>` (run en `zscan-runs/` por defecto) |
| `./zscan probe` | `llm-probe` |
| `./zscan init` | `init` |
| `./zscan config` | `config` |
| `./zscan prompt-scan` | `prompt-scan` |
| `./zscan ollama` | [`scripts/ensure-ollama.sh`](scripts/ensure-ollama.sh) |
| `./zscan serve` | `serve` |
| `./zscan <cmd>` | Cualquier subcomando del CLI |

Ayuda: `./zscan help`. Documentación del intérprete: [GNU Bash](https://www.gnu.org/software/bash/manual/).

### VS Code y Cursor (tareas recomendadas)

1. Lee la guía del repo: **[contrib/vscode/README.md](contrib/vscode/README.md)**.
2. Copia **[contrib/vscode/tasks.json](contrib/vscode/tasks.json)** a **`.vscode/tasks.json`** del workspace (o fusiona las entradas `zscan:*`).
3. En la paleta: **Tasks: Run Task** → p. ej. **`zscan: scan (this folder)`** (crea un run bajo **`zscan-runs/<id>-scan/`** en el workspace) o **`zscan: serve HTTP`**.

Referencias oficiales:

- [Tasks en Visual Studio Code](https://code.visualstudio.com/docs/editor/tasks)
- [Variables en tareas](https://code.visualstudio.com/docs/editor/variables-reference) (`${workspaceFolder}`, etc.)
- [Cursor](https://cursor.com/) — compatible con el mismo formato de tareas que VS Code

### pre-commit (en el repo *de tu aplicación*)

Ejemplo listo para copiar: **[contrib/pre-commit/sample.pre-commit-config.yaml](contrib/pre-commit/sample.pre-commit-config.yaml)**. Ajusta `entry` a `zscan`, `npx zscan` o ruta a `dist/cli.js`. Instalación del framework: [pre-commit.com](https://pre-commit.com/).

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
| `npm run scan:self:save` | Igual en disco: **`scan-all --root .`** → run en **`zscan-runs/<id>-scan/`** |
| `npm run scan:all` | Igual que `scan:self:save` (nombre explícito para “todo en un paso”) |
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
