# Guía para agentes / contribuidores

Repositorio **público**. Tres reglas innegociables al trabajar aquí:

## 1. Sin menciones a proyectos internos

No nombres repos ni paquetes privados de origen en código, comentarios, commits, README
ni documentación. El código de `src/lib/cnmc/` y los componentes de `src/components/` son
propios de este repositorio.

## 2. Cero PII

- **Nada sale del navegador.** Sin backend, sin `fetch`/`/api`, sin subida de ficheros, sin
  analytics de terceros.
- **Sin extracción ni tratamiento de datos personales** (DNI, nombre, dirección…).
- **Sin persistencia.** Los datos de la factura (`QrParameters`, que incluyen CUPS y código
  postal) viven solo en memoria (estado de React). No usar `localStorage`/`sessionStorage`
  ni cookies para guardarlos.

## 3. Convenciones técnicas

- Antes de commitear: `npm run validate` (Prettier + `tsc --noEmit` + Vitest).
- La extracción/cálculo CNMC (lógica pura) se testea en `src/lib/cnmc/__tests__/`.
- pdfjs se carga vía `loadPdfJs()` (`src/lib/cnmc/extraction`): única fuente para el worker.
