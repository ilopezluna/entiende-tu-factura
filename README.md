# Entiende tu factura

Aplicación **100% cliente** (sin backend) que explica tu factura de la luz. Sube tu
factura (PDF o imagen), el navegador lee el código QR de la CNMC y te muestra un
desglose claro de lo que estás pagando: potencia, energía, impuestos y contrato.

👉 **Pruébala en vivo: [entiende-tu-factura](https://ilopezluna.github.io/entiende-tu-factura/)**

> **Privacidad:** todo el procesamiento ocurre en tu navegador. Tu factura nunca
> se envía a ningún servidor.

## Stack

- **React 19 + Vite + TypeScript**
- **Tailwind CSS v4**
- Extracción de QR/PDF con `jsqr` + `pdfjs-dist`
- Tests con **Vitest**

## Requisitos

- Node.js (ver [`.nvmrc`](.nvmrc) → 22.20.0)

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
```

## Scripts

| Script              | Descripción                               |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Servidor de desarrollo (Vite)             |
| `npm run build`     | Typecheck + build de producción a `dist/` |
| `npm run preview`   | Sirve el build de producción              |
| `npm test`          | Tests (Vitest)                            |
| `npm run typecheck` | Comprobación de tipos sin emitir          |
| `npm run format`    | Formatea con Prettier                     |
| `npm run validate`  | `format:check` + `typecheck` + `test`     |

## Estructura

```
src/
├── lib/cnmc/          # Extracción y cálculo (lógica CNMC propia)
│   ├── extraction/    # scan/pdf (agnósticos) + extractor (navegador) + validadores
│   ├── parsing/       # parseo de parámetros del QR
│   ├── types/         # QrParameters + enums
│   ├── content/       # vocabulario y explicaciones en español
│   ├── format/        # formateo de números en es-ES
│   ├── utils/         # cálculo de costes y análisis de potencia
│   └── __tests__/     # tests de lógica pura
├── styles/            # Tailwind v4 + design tokens
├── App.tsx
└── main.tsx
```

Solo `extraction/extractor.ts` depende del navegador; `extraction/scan.ts` y
`extraction/pdf.ts` no tocan el DOM.

## Despliegue

Push a `main` despliega automáticamente a GitHub Pages
([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)), disponible en
**https://ilopezluna.github.io/entiende-tu-factura/**. El `base` de Vite es
relativo (`./`), por lo que funciona tanto en `usuario.github.io/<repo>/` como en un
dominio propio.
