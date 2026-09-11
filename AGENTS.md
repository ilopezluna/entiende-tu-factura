# Guía para agentes / contribuidores

Repositorio **público** con dos entregables: la web (`src/`) y el servidor MCP (`mcp/`),
que comparten la lógica de `src/lib/cnmc/`. Tres reglas innegociables al trabajar aquí:

## 1. Sin menciones a proyectos internos

No nombres repos ni paquetes privados de origen en código, comentarios, commits, README
ni documentación. El código de `src/lib/cnmc/` y los componentes de `src/components/` son
propios de este repositorio.

## 2. Cero PII

La regla es la misma para los dos entregables —los datos de la factura no viajan a ningún
servidor— pero se concreta distinto en cada uno.

**Web (`src/`):**

- **Nada sale del navegador.** Sin backend, sin `fetch`/`/api`, sin subida de ficheros, sin
  analytics de terceros.
- **Sin extracción ni tratamiento de datos personales** (DNI, nombre, dirección…).
- **Sin persistencia.** Los datos de la factura (`QrParameters`, que incluyen CUPS y código
  postal) viven solo en memoria (estado de React). No usar `localStorage`/`sessionStorage`
  ni cookies para guardarlos.

**Servidor MCP (`mcp/`):**

- **Se ejecuta en local y no hace ninguna petición de red.** Sin telemetría, sin APIs, sin
  descargar recursos en tiempo de ejecución. Está cubierto por
  `mcp/src/__tests__/noNetwork.test.ts`, que inutiliza `fetch`, `http`, `https`, `net` y
  `dns` y lee una factura entera; si añades una dependencia que salga a la red, ese test
  falla.
- **Sin persistencia.** Lee el fichero que le indican y no escribe nada.
- **Devuelve el CUPS y el código postal sin ocultar.** Es una decisión deliberada: el
  servidor corre en la máquina del usuario y son los datos que hacen falta para comparar
  ofertas. Lo que el agente haga luego con ellos queda fuera de nuestro control, y así se
  documenta en `mcp/README.md`.

## 3. Convenciones técnicas

- Antes de commitear: `npm run validate` (Prettier + `tsc --noEmit` + Vitest + MCP).
- La extracción/cálculo CNMC (lógica pura) se testea en `src/lib/cnmc/__tests__/`.
- `src/lib/cnmc/` es **código compartido**: si lo tocas, afecta a la web y al MCP. Solo
  `extraction/extractor.ts` puede depender del DOM; `extraction/scan.ts` y
  `extraction/pdf.ts` deben seguir siendo agnósticos de plataforma.
- `mcp/tsconfig.json` omite la librería `DOM` a propósito: si el servidor MCP acaba
  importando código de navegador, el typecheck falla.
- pdfjs se carga vía `loadPdfJs()` (`src/lib/cnmc/extraction`) en la web y vía el adaptador
  de Node en `mcp/src/extractNode.ts`: una sola fuente para cada plataforma.
- El contenido en español (etiquetas, explicaciones, glosario) vive en
  `src/lib/cnmc/content/`, no en los componentes, para que la web y el agente digan lo mismo.

## 4. Distribución del servidor MCP

Hay tres artefactos que declaran la misma versión y tienen que moverse juntos:
`mcp/package.json`, `mcp/server.json` y `plugins/factura-luz/.claude-plugin/plugin.json`.

- `mcp/package.json` lleva `mcpName`, que **debe** coincidir con el campo `name` de
  `mcp/server.json`. El MCP Registry rechaza la publicación si no cuadran.
- El workflow de publicación sincroniza la versión de `server.json` desde `package.json`,
  así que basta con subir la de `package.json` (`npm version patch -w factura-luz-mcp`).
  La del plugin sí hay que subirla a mano.
- Valida `server.json` contra el registro antes de etiquetar una release:
  `cd mcp && mcp-publisher validate`.
- El registro autentica con el token OIDC del workflow, no con un secreto: por eso el job
  necesita `id-token: write` y el nombre tiene que vivir bajo `io.github.ilopezluna/`.
