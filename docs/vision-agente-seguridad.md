# Agente de seguridad para proyectos (JS + Python) — visión y diseño

Documento vivo para discutir arquitectura, alcance y riesgos. Objetivo: librería multilenguaje con API local que opere sobre repositorios Git.

---

## 1. Propósito

- **Auditoría de dependencias**: detectar vulnerabilidades conocidas (p. ej. vía **OSV**), comparar versiones declaradas vs. recomendadas, y **ubicar en el código** dónde se consume cada paquete (imports, requires, dynamic imports, etc.). Por defecto en **`zscan scan`**, **scrapear referencias HTTP** de advisories (extractos en el informe; **`--no-enrich-docs`** para omitir), con caché local.
- **Análisis de prompts / especificaciones de IA**: **matching de confiabilidad** frente al **YAML de proyecto** (reglas, umbrales y archivos de prompts con su **objetivo**; véase §6) para reducir riesgo de **prompt injection** y flujos peligrosos.

**Principio de intervención**: el agente **no modifica** el repositorio (sin bumps automáticos ni PRs). Emite un **reporte explícito y estructurado** de todo lo hallado para que la persona desarrolladora, si lo desea, lo use como **entrada** a su asistente de IA y corrija con contexto claro (qué falló, dónde, y qué evidencia se usó).

---

## 2. API local — qué significa en la práctica

| Enfoque | Pros | Contras |
|--------|------|---------|
| **CLI + librería embebida** (`import` / `require`) | Simple, sin servidor, CI/CD friendly | Menos “servicio” reutilizable entre procesos |
| **Servidor local (HTTP/JSON-RPC)** | Varios clientes, UI, extensiones IDE | Más superficie operativa (puerto, auth local) |
| **Híbrido** | CLI que levanta daemon opcional | Más código a mantener |

**Recomendación inicial**: núcleo como librería compartida + **CLI**; opcionalmente un **servidor HTTP en localhost** con binding solo a `127.0.0.1` y sin auth si se asume entorno de desarrollo de confianza.

---

## 3. Fuentes de vulnerabilidades: scraping vs. APIs

“Scrapear documentación oficial” suena bien en producto, pero en ingeniería conviene separar:

- **Datos estructurados (preferible)**: [OSV](https://osv.dev/), GitHub Security Advisories, npm/pypi ecosystems vía APIs oficiales, bases tipo NVD con CVE. Menos frágil que parsear HTML.
- **Scraping / docs**: útil para **contexto narrativo** (mitigación, notas del vendor) cuando no está en el JSON; riesgo de rotura ante cambios de layout.

**Propuesta**: pipeline **API-first** + **enriquecimiento opcional** desde páginas oficiales (con caché y versionado del scraper).

**Implementación actual (zscan)** — no sustituye a OSV; **complementa** el informe:

- Tras resolver CVE/hallazgos vía **OSV**, **`zscan scan`** enriquece por defecto (salvo **`--no-enrich-docs`** o **`"enrichDocs": false`** en `POST /scan`): se toma la **primera URL `http(s)`** de `references` de cada vulnerabilidad, se descarga la página y se reduce el HTML a **texto plano**; un **extracto** (~1500 caracteres) entra en el Markdown (sección *Referencias*) y en **`meta.docSnippets`** del JSON. La flag **`--enrich-docs`** existe solo por compatibilidad (sin efecto).
- **Caché en disco** (`~/.cache/zscan/enrich` o **`ZSCAN_ENRICH_CACHE_DIR`**), TTL **7 días**, para no martillar sitios y permitir trabajo offline con datos ya descargados.
- **Límite** de URLs por escaneo (orden de aparición; por defecto ~15) y **User-Agent** identificable; algunos sitios pueden bloquear o devolver HTML distinto — comportamiento **best-effort**, errores en `meta.enrichErrors`.

**Siguiente ola (pendiente de producto)**: plantillas o selectores por dominio (NVD, GitHub Advisory, etc.), reintentos y rate limiting, y enlace con el ítem de **remediation text** más rico del backlog (§10, *Salida y flujo de trabajo*).

---

## 4. Resolución de versiones y comparación

- Normalizar lockfiles: `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `requirements.txt`, `poetry.lock`, `Pipfile.lock`, `uv.lock`.
- Mapear **nombre del paquete** → **ecosistema** (npm, PyPI) → **consulta OSV/advisory**.
- Semver y rangos: alinear con el comportamiento de cada gestor; documentar límites (ej. dependencias git URL, path deps).

### 4.1 Confiabilidad por dependencia y sugerencias de reemplazo

Además de CVE y versiones, el **YAML de proyecto** (véase §6.1) puede fijar un **porcentaje o umbral mínimo de confiabilidad por dependencia** (y uno por defecto para el resto). La herramienta combina señales propias (vulnerabilidades, mantenimiento, popularidad, flags de advisory, etc.—detalle de implementación abierto) y produce un **score** comparable con ese umbral.

- Si una dependencia marcada como **crítica** para el proyecto queda **por debajo** del umbral, el reporte debe ser **explícito**: riesgo, evidencia, y **sugerencia de sustitución** cuando sea razonable (p. ej. paquete alternativo conocido, fork mantenido, o submódulo interno), sin aplicar el cambio en el repo.
- Temas **críticos** (seguridad, datos sensibles, cadena de suministro) amplían el texto de remediación: no solo “actualizar versión”, sino **evaluar reemplazo** si la confiabilidad agregada sigue siendo insuficiente.

### 4.2 Dependencias críticas por cobertura de código (≥80%)

Algunas bibliotecas **sostienen** la mayor parte del producto: p. ej. framework web, runtime de UI, ORM, o SDK principal. El YAML debe poder expresar y combinar:

- **Detección asistida**: el escaneo estático estima, por paquete, qué fracción del **código de primera parte** depende de él (vía imports directos o **transitivos** en el grafo del proyecto—la métrica exacta—porcentaje de archivos, módulos ponderados, etc.—se define en implementación y se documenta para evitar ambigüedad).
- **Umbral por defecto**: si la cobertura estimada es **≥80%** (configurable en YAML), el paquete se trata como **estructuralmente crítico** salvo que el equipo lo corrija en el archivo.
- **Declaración explícita**: lista en YAML de paquetes **núcleo** (`critical_core` o similar) que siempre reciben **mayor vigilancia**: umbrales de confiabilidad más estrictos, más detalle en hallazgos, prioridad en el análisis de **propagación** (§4.3).

Así se distingue la “criticidad de negocio/manual” de la **criticidad por peso en el código**.

### 4.3 Salida: árbol de dependencias e impacto en cadena

El **reporte** debe incluir, además de listas planas:

1. **Árbol (o DAG)** de dependencias resuelto desde lockfile(s), legible en Markdown y serializado en JSON (nodos: paquete + versión; aristas: depende-de).
2. **Consecuencia por confiabilidad baja**: cuando un paquete queda por debajo de su umbral (o el global), el output describe **cómo afecta al resto**: qué **dependientes directos e indirectos** quedan en la “sombra” de ese riesgo, **rutas** en el grafo desde el paquete débil hasta el proyecto, y una lectura en prosa tipo *“por transitividad, X e Y heredan el riesgo de Z”* para que el desarrollador o un asistente de IA prioricen remediación.

Esto complementa el mapa de **líneas de uso en código fuente** (§5): el árbol cubre la **cadena de suministro declarada**; el mapa cubre **dónde** se invoca en el repo.

---

## 5. “Dónde se usa” en el código

Objetivo: para cada dependencia vulnerable o sensible, listar **archivo + línea + tipo de uso**.

| Lenguaje | Enfoque |
|----------|---------|
| **JavaScript/TS** | AST (TypeScript compiler API, Babel, o `swc`) para `import`, `require()`, `import()`, re-exports; complementar con búsqueda de strings para casos dinámicos (con falsos positivos documentados). |
| **Python** | `ast` estándar + resolución aproximada de top-level packages (mapear `from foo.bar` → distribución `foo` vía metadata cuando sea posible). |

**Limitación honesta**: código altamente dinámico (`__import__(var)`, `require(name)`) no siempre se resuelve estáticamente; el doc debe prometer **“best effort”** con severidad de confianza.

---

## 6. Prompt injection y “confiabilidad” de textos

Esto es **distinto** del análisis de dependencias: aquí el input es **texto** (prompts, system prompts, archivos de spec, `.md` de producto, etc.).

### 6.1 Archivo de proyecto en YAML (generado por defecto, editable)

**Formato**: **YAML** como configuración versionada del repo (convención de nombre fijada por la herramienta, p. ej. `zscan.yaml` en la raíz del proyecto—nombre exacto por definir en la implementación).

- **Bootstrap**: un primer escaneo del repositorio **genera un YAML por defecto** con propuestas razonables (rutas candidatas a prompts, globs, dependencias detectadas). El equipo **edita** ese archivo para reflejar la realidad: sin eso, las verificaciones de prompts no pueden ser precisas.
- **Entradas imprescindibles para prompts**: qué **archivos** (o patrones) contienen principalmente prompts y, para cada uno, el **objetivo** (p. ej. “instrucción de sistema del chat de soporte”, “plantilla de extracción RAG”). Ese **objetivo** orienta qué reglas y expectativas aplicar en el matching.
- **Porcentajes / umbrales de confiabilidad**:
  - Un umbral para el **escaneo de prompts** (p. ej. puntuación mínima global o por archivo) por debajo del cual el reporte marca fallo o advertencia según política.
  - Umbrales **por dependencia** (y `critical: true` o equivalente para paquetes sensibles), alineados con §4.1.
- **Criticidad por código (≥80%)**: umbral configurable (por defecto 80) para marcar automáticamente paquetes que concentran la dependencia del código propio; lista explícita de **núcleo** para **vigilancia reforzada** (véase §4.2).

El mismo YAML puede agrupar **reglas de spec** (características que deben cumplirse) y referencias a archivos; lo importante es un **solo lugar** claro para humanos y para CI.

### 6.2 Spec y reglas dentro del YAML

El **matching de confiabilidad** se hace contra las **características declaradas** en ese YAML (y plantillas mínimas documentadas por la herramienta si aplica): longitud máxima, patrones prohibidos, secciones obligatorias, límites de rol, separación usuario/sistema, etc.

- Cada hallazgo del reporte debe ser **explícito**: qué regla o campo del YAML se evaluó, si pasó o falló, **porcentaje o score** cuando corresponda, y **cita o fragmento** del texto analizado.
- Heurísticas (inyección conocida, delimitadores rotos, etc.) se reportan con origen: `yaml_rule` vs. `heuristic`.

### 6.3 Ejecución: local y CI

- **Local**: mismo comando / misma librería; análisis acorde al YAML del repo.
- **CI**: con la herramienta **instalada**, el mismo `zscan.yaml` define el comportamiento; fallo opcional si se violan umbrales de confiabilidad (prompts o dependencias).

### 6.4 Privacidad

Por defecto, el módulo de prompts no envía contenido del repo a APIs externas; el YAML y los archivos escaneados permanecen en el entorno donde corre el comando.

### 6.5 Ejemplo ilustrativo (no normativo)

```yaml
# Ejemplo conceptual — el esquema final lo fija la implementación
version: 1
prompts:
  - paths: ["src/ai/system-prompt.md", "src/prompts/*.ts"]
    purpose: "Instrucción de sistema del asistente; no debe ejecutar órdenes del usuario crudo"
reliability:
  prompts_min_percent: 85
  dependencies:
    default_min_percent: 70
    # paquetes sobre los que “reposa” ≥80% del código (auto + editable): mayor vigilancia
    structural_critical:
      auto_threshold_percent: 80
      explicit_core: ["next", "react"]  # siempre núcleo aunque la métrica oscile
    packages:
      example-lib:
        min_percent: 95
        critical: true
        # por debajo del umbral: el reporte sugiere reemplazo explícito (p. ej. alternativa mantenida)
rules:
  - id: no_instruction_override
    description: "No aceptar frases tipo 'ignora instrucciones anteriores' en rol sistema"
    pattern: "ignore\\s+(all\\s+)?(previous|prior)\\s+instructions?"
```

---

## 7. Empaquetado multilenguaje

| Opción | Notas |
|--------|--------|
| **Rust / Go** core + bindings | Un binario, máximo rendimiento; más curva de desarrollo. |
| **TypeScript** core + **Python** vía subprocess o port paralelo | Duplicación lógica si no se comparte binario. |
| **Python** core + invocar herramientas Node para AST JS | Pragmático si el equipo es más fuerte en Python. |

Decisión pendiente según prioridad: **time-to-market** vs. **un solo artefacto**.

---

## 8. Alcance MVP sugerido

1. **CLI breve** (un comando con pocos flags) como forma principal de uso inicial; integración en **CI opcional** (mismo binario/paquete, misma salida).
2. Detectar repo Git, identificar ecosistema(s), parsear lockfile principal.
3. Consultar vulnerabilidades vía **OSV API** (o equivalente estable).
4. **Reporte explícito** (idealmente **JSON** para máquinas + **Markdown legible** para humanos): por cada hallazgo incluir tipo, severidad, paquete/CVE, versiones, rutas, **líneas de uso en código** cuando existan, y texto de remediación sugerida **sin aplicar cambios** en el repo.
5. Incluir **árbol / DAG de dependencias** y sección de **impacto en cadena**: si un paquete tiene confiabilidad insuficiente, **qué nodos quedan afectados** por transitividad y **rutas** en el grafo (alineado con §4.3).
6. El reporte debe estar pensado para **copiar/pegar o adjuntar** como input a un asistente de IA: contexto suficiente para corregir sin adivinar.
7. Mapa de uso: imports estáticos en **un lenguaje** primero (ej. solo TS/JS o solo Python).
8. Comando tipo **init** o primer run que **escriba o actualice** `zscan.yaml` por defecto (incl. propuesta de **núcleo** por cobertura ≥80% cuando la métrica exista); documentar que el equipo debe ajustar **rutas de prompts** y **objetivo** de cada uno.
9. Modo “prompt scan”: evaluación contra reglas y umbrales del **YAML** + **porcentaje de confiabilidad** (prompts y dependencias); sin LLM externo por defecto.

---

## 9. Decisiones cerradas

| Tema | Decisión |
|------|----------|
| Modificación del repo | **No**. Solo reporte; el desarrollador decide y puede usar el reporte con su asistente de IA. |
| Forma de uso inicial | **Comando breve** en local; **CI** si se instala la herramienta en el pipeline. |
| Prompt injection | Matching contra **YAML de proyecto** con reglas y **umbrales de confiabilidad**; archivos de prompts declarados con **objetivo** para verificar bien. |
| Configuración | **YAML**; **generado por defecto** tras escaneo, **editable**; confiabilidad global y **por dependencia**; sugerencias de **reemplazo** cuando la criticidad/umbral lo exijan. |
| Criticidad estructural | Paquetes con **≥80%** de cobertura de código (umbral en YAML) o lista **núcleo** explícita → **mayor vigilancia**; ver §4.2. |
| Salida dependencias | **Árbol/DAG** + **propagación** de riesgo cuando la confiabilidad de un nodo es baja (afectados y rutas); ver §4.3. |

### Preguntas aún abiertas

- ¿Integración adicional deseada: **pre-commit**, **IDE**, u omitir en MVP?
- ¿Requisito **air-gapped** para dependencias (CVE local sin red)?
- Nombre fijo del archivo (`zscan.yaml` vs. otro) y versión del esquema YAML v1, v2…
- Cómo se calcula el **score de confiabilidad** de dependencias (fuentes y pesos) para que sea auditable en el reporte.
- Definición exacta de **“% del código que depende de un paquete”** (archivos vs. líneas vs. módulos) para el umbral del 80%.

---

## 10. Backlog (producto e ingeniería)

Lista viva de lo acordado en la visión y lo pendiente; orden aproximado por valor / dependencias. Marca mental: **hecho (MVP npm)** = ya existe una primera implementación en el repo; el resto sigue en cola.

### Infraestructura y producto

| Estado | Ítem |
|--------|------|
| MVP npm | CLI breve (`init`, `scan`), librería embebible, salida Markdown + JSON, **sin modificar el repo** |
| MVP npm | Consulta **OSV** (API-first) para registro **npm** (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`) |
| MVP npm | **Árbol de dependencias** (transitivo npm; directas + lock para pnpm/yarn) + **propagación** ante hallazgos OSV |
| MVP npm | **Pistas de uso** en código (`import` / `require`, best-effort sobre `src/`) |
| MVP npm | **Git** en reporte (HEAD, submódulos); `--ignore-submodules` en imports |
| MVP npm | `zscan.yaml` con **init** que genera default **editable** |
| Parcial | **Python**: lockfiles `poetry.lock`, `uv.lock`, `Pipfile.lock`, `requirements.txt` (pins `==`) + OSV **PyPI**; árbol MVP plano; sin `pyproject.toml` como única fuente |
| Parcial | **Go / Ruby / Java (Maven)**: `go.mod`, `Gemfile.lock`, `pom.xml` + OSV (**Go**, **RubyGems**, **Maven**); árbol plano; pistas de uso en `.go` / `.rb` / `.java` / `.kt` (regex; sin Gradle aún) |
| Parcial | **Yarn / pnpm**: `yarn.lock` (v1 + Berry con `@npm:`), `pnpm-lock.yaml` (claves `packages/`); prioridad lock: npm → pnpm → yarn; árbol JS = transitivo solo con `package-lock.json`, resto = directas desde `package.json` |
| Parcial | **Git**: subida desde `--root` hasta `.git` (directorio o `gitdir`), HEAD leído sin CLI; submódulos listados desde `.gitmodules`; `--ignore-submodules` excluye esas rutas del mapa de imports |
| Hecho | **Servidor HTTP local** `zscan serve` (127.0.0.1): `GET /health`, `POST /scan` JSON `{ root?, offline?, enrichDocs?, … }` — mismo núcleo que la CLI |
| Hecho | **pre-commit** / **IDE**: ejemplos en `contrib/pre-commit` y `contrib/vscode/tasks.json` |
| Parcial | **Air-gapped / offline**: `scan --offline` o `ZSCAN_OFFLINE=1` — OSV solo desde caché (`~/.cache/zscan/osv` o `ZSCAN_OSV_CACHE_DIR`); poblar con un escaneo online previo; sin mirror OSV empaquetado |
| Parcial | **Scraping / enriquecimiento CVE** (producto): `scan` por defecto y `serve` con `enrichDocs !== false` descargan URLs de `references` en hallazgos OSV, HTML → texto, extractos en Markdown + `meta.docSnippets` en JSON; **`--no-enrich-docs`** / `"enrichDocs": false` lo omiten; caché `ZSCAN_ENRICH_CACHE_DIR`, TTL 7 días; límite de URLs/escaneo; ver §3 |
| Pendiente | Scraping **más robusto**: reintentos, rate limit, heurísticas por dominio; enriquecer cuando falten `references` útiles |
| Hecho | Config: archivo por defecto **`zscan.yaml`**; nombre alternativo vía env **`ZSCAN_CONFIG`**; **`schema_version`** en YAML (soportado **1**; aviso si es mayor) |
| Hecho | **Tests unitarios** (**Vitest**): `npm test` — parsers (`go.mod`, `Gemfile.lock`, `pom.xml`, TOML Poetry), `resolveLlmOptions`, `.env.local`, `evaluatePromptContent`, `patchYamlLlmSection` |
| Pendiente | Ampliar cobertura: OSV batch (mock `fetch`), `importHints`, CLI smoke |
| Parcial | **Integración Ollama** (`*.integration.test.ts`): `invokeChat` contra modelo local; `ollama pull` si falta; opt-in `ZSCAN_INTEGRATION_OLLAMA=1` |

### YAML y políticas

| Estado | Ítem |
|--------|------|
| Parcial | `prompts[]`: **paths/globs** + **objetivo** por grupo (imprescindible para verificaciones serias) |
| Parcial | `reliability.prompts_min_percent` y **umbrales por dependencia** (`packages.*.min_percent`, `critical`) |
| Parcial | `structural_critical`: `auto_threshold_percent` (ej. 80) + `explicit_core` (núcleo siempre vigilado) |
| Pendiente | **Init** que proponga `explicit_core` y rutas de prompts usando **métrica de cobertura** (≥80% código que depende del paquete) |
| Pendiente | Cerrar definición de **métrica de cobertura** (% archivos vs líneas vs módulos) y documentarla |
| Pendiente | **Score de confiabilidad** por dependencia (fuentes, pesos, **auditable** en reporte) más allá de CVE |
| Pendiente | **Sugerencias de reemplazo** explícitas (alternativas mantenidas) cuando umbral/criticidad lo exijan |
| Pendiente | Reglas `rules[]` en YAML: matching de spec (longitud, patrones prohibidos, secciones obligatorias, rol, separación usuario/sistema) |

### Prompt injection y textos

| Estado | Ítem |
|--------|------|
| Hecho | Comando **`prompt-scan`**: globs en `prompts[]`, reglas YAML (**`pattern`** + **`description`**), heurísticas en `src/prompt/builtin-heuristics.ts` |
| Hecho | Origen en informe / JSON: **`yaml_rule`**, **`heuristic`**, **`llm`** (este último si `llm.enabled` en YAML: verificación semántica de `rules[]` con el modelo) |
| Hecho | Cada check: `ruleId`, `passed`, **`scorePercent`**, **`citation`**, línea; puntuación por archivo = mínimo de checks; umbral `reliability.prompts_min_percent`; **`--no-llm`** en CLI |
| Hecho | **100% local** por defecto (`llm.enabled: false`); con **`llm.enabled: true`**, **Qwen2.5-Coder 3B** vía API OpenAI-compatible (Ollama); el mismo **`scan`** incluye **prompt-scan** en el informe; **`scan --no-prompt-llm`** evita llamadas al modelo |
| Pendiente | Fallo CI opcional si se violan umbrales de prompts o dependencias |

### Análisis de código y grafo

| Estado | Ítem | 
|--------|------|
| Parcial | Mapa **archivo + línea** para paquetes afectados (regex; AST TS/JS después) |
| Pendiente | AST **TypeScript/JavaScript** (import, require, dynamic import, re-export) |
| Pendiente | AST **Python** + mapeo `from foo.bar` → distribución |
| Pendiente | Documentar límites: `require(var)`, `__import__(dynamic)` — confianza graduada |
| Pendiente | Serializar **DAG completo** en JSON (nodos/aristas) alineado a §4.3; árbol MD ya iniciado |

### Salida y flujo de trabajo

| Estado | Ítem |
|--------|------|
| Hecho (MVP) | Reporte explícito para **copiar/pegar** a asistente de IA |
| Pendiente | Severidades unificadas, **remediation text** más rico (CVE + mitigación + bump sugerido); alinear con extractos de **scraping** (enriquecimiento por defecto en `scan`) en un solo bloque “qué hacer” |
| Pendiente | Propagación: **más rutas** y dependientes indirectos cuando el grafo sea más completo |
| Hecho | **Sitio estático** en **`docs/`** para **GitHub Pages** (`index.html` + `.nojekyll`) |
| Parcial | Publicación npm opcional; URL pública vía **Pages** (`/docs`) |

### Multilenguaje / empaquetado

| Estado | Ítem |
|--------|------|
| En curso | Núcleo **TypeScript**; decisión pendiente: core Rust/Go vs. mantener TS + port Python |

### Modelo local (LLM)

| Tema | Decisión |
|------|----------|
| Modelo recomendado (local) | **Qwen2.5-Coder 3B Instruct**; cuantización **Q4_K_M** (GGUF) (~2 GB en disco según mirror). |
| Identificador típico (Ollama) | `qwen2.5-coder:3b` (`ollama pull qwen2.5-coder:3b`). |
| Distribución | El **paquete npm no incluye pesos**; nube (**OpenAI**, **Google Gemini**, **Anthropic Claude**) u on-prem (**Ollama**, llama.cpp, vLLM, …). |
| API en zscan | **OpenAI-compatible** (`/v1/chat/completions`) para OpenAI, Ollama y **Gemini** (`generativelanguage…/v1beta/openai`). **Claude** usa la API **Messages** de Anthropic (`/v1/messages`); en YAML `llm.provider: anthropic`. |
| Configuración guiada | **`zscan config`**: **[1] OpenAI**, **[2] Ollama**, **[3] Gemini**, **[4] Claude**; claves en **`.env.local`** (`ZSCAN_LLM_API_KEY`); Ollama ejecuta **`ollama pull`**; cierre con **ping** (`llm-probe`). |
| Comprobación | **`zscan llm-probe`** (alias **`llm-ping`**): una llamada de prueba; carga `.env.local` antes de leer la config. |
| Uso en producto | `llm.enabled` en YAML; **`prompt-scan`** y el bloque de prompts dentro de **`scan`** usan el LLM cuando está activo; **`scan --no-prompt-llm`** lo desactiva para ese bloque. |

---

## 11. Changelog del documento

- 2026-04-03: borrador inicial.
- 2026-04-03: decisiones — solo reporte explícito (sin modificar repo); CLI + CI opcional; prompt matching contra spec predefinido; local/CI unificado.
- 2026-04-03: YAML de proyecto (default generado + editable); prompts con ruta y **objetivo**; umbrales de confiabilidad para escaneo de prompts y **por dependencia**; sugerencias de reemplazo en casos críticos.
- 2026-04-03: dependencias **críticas por cobertura (≥80%)** y vigilancia reforzada; salida con **árbol de dependencias** e **impacto en cadena** por confiabilidad baja.
- 2026-04-03: §10 **Backlog** consolidado (visión + estado MVP npm vs pendiente).
- 2026-04-03: soporte **PyPI** (lockfiles + OSV) en CLI; escaneo mixto npm+Python si coexisten en la raíz.
- 2026-04-03: OSV + lockfiles **Go** (`go.mod`), **Ruby** (`Gemfile.lock`), **Maven** (`pom.xml`); escaneo mixto con npm/Python en la misma raíz.
- 2026-04-03: **yarn.lock** / **pnpm-lock.yaml** + metadatos **Git** en reporte y flag `--ignore-submodules`.
- 2026-04-03: decisión **LLM local: Qwen2.5-Coder 3B**; bloque `llm` en `zscan.yaml`, cliente OpenAI-compatible, comando `llm-probe`.
- 2026-04-03: **`zscan config`** (asistente OpenAI vs Ollama, `.env.local`, `ollama pull`) y **`llm-ping`** como alias de `llm-probe`.
- 2026-04-03: LLM **Gemini** (OpenAI-compatible) y **Claude** (Messages API + `llm.provider`); **`invokeChat`** unifica rutas.
- 2026-04-03: **serve** HTTP local; **offline** OSV + caché; enriquecimiento CVE (**`--no-enrich-docs`** para omitir; **`--enrich-docs`** obsoleto); **schema_version** / `ZSCAN_CONFIG`; contrib pre-commit + VS Code.
- 2026-04-03: **Sitio en `docs/`** + **`.nojekyll`** para GitHub Pages; README orientado a clonar desde GitHub; landing retirada de `landing/`.
- 2026-04-03: §3 y backlog: **scraping de referencias CVE** (por defecto en `scan`) explicitado como complemento a OSV y hoja de ruta de robustez.
- 2026-04-03: **Vitest** + `src/**/*.test.ts` (excluidos de `tsc` → `dist/`); `npm test` / `npm run test:watch`.
- 2026-04-03: **`test:integration`** + `ollama.integration.test.ts` (Ollama local, `ollama pull` opt-in, `ZSCAN_INTEGRATION_OLLAMA=1`).
- 2026-04-03: **`prompt-scan`** / **`prompts`**: reglas YAML con `pattern`, tabla Markdown + JSON, origen `yaml_rule` | `heuristic` | `llm` si `llm.enabled`.
- 2026-04-03: **`scan`** unificado: mismo informe Markdown/JSON con dependencias + OSV + scraping de referencias + **prompt-scan** (`prompts` + `promptScanMessage` en JSON); `performCombinedScan` en la librería.
- 2026-04-03: **`init`** detecta ficheros tipo prompt (docs, prompts, `.cursor`, `*.prompt.md`, AGENTS/CLAUDE/GEMINI, README, contrib) y genera **`prompts[]`** con globs que tienen coincidencias; regla `no_instruction_override` por defecto.
- 2026-04-03: **`init`** también muestrea código bajo `src/` (y `lib/`, `app/`, …) en TS/JS/Python/Ruby/Go/Java/Kotlin y añade globs si hay **literales largos** + heurística tipo LLM/prompt.
