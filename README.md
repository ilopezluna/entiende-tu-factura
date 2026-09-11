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

## Para agentes

Si prefieres que sea tu agente quien lea la factura, hay un servidor MCP que expone la
misma lógica: [`factura-luz-mcp`](mcp/README.md). Se ejecuta en local, así que la factura
tampoco sale de tu ordenador.

```bash
claude plugin marketplace add ilopezluna/entiende-tu-factura
claude plugin install factura-luz@entiende-tu-factura
```

O, si prefieres solo el servidor MCP sin el comando `/entender`:

```bash
claude mcp add factura-luz -- npx -y factura-luz-mcp
```

## Más servicios

Si quieres comparar ofertas y ahorrar en tu factura, visita
**[InvoiceDown](https://www.invoicedown.com/)**.

## Requisitos

- Node.js (ver [`.nvmrc`](.nvmrc) → 22.20.0)

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
```

## Scripts

| Script              | Descripción                                 |
| ------------------- | ------------------------------------------- |
| `npm run dev`       | Servidor de desarrollo (Vite)               |
| `npm run build`     | Typecheck + build de producción a `dist/`   |
| `npm run preview`   | Sirve el build de producción                |
| `npm test`          | Tests (Vitest)                              |
| `npm run typecheck` | Comprobación de tipos sin emitir            |
| `npm run format`    | Formatea con Prettier                       |
| `npm run validate`  | `format:check` + `typecheck` + `test` + MCP |
| `npm run build:mcp` | Compila el servidor MCP a `mcp/dist`        |
| `npm run test:mcp`  | Typecheck + tests del servidor MCP          |

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
mcp/                   # servidor MCP (paquete npm factura-luz-mcp)
```

`src/lib/cnmc/` es compartido: la web y el servidor MCP calculan con el mismo código.
Solo `extraction/extractor.ts` depende del navegador; `extraction/scan.ts` y
`extraction/pdf.ts` no tocan el DOM y se reutilizan en Node.

## Despliegue

Push a `main` despliega automáticamente a GitHub Pages
([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)), disponible en
**https://ilopezluna.github.io/entiende-tu-factura/**. El `base` de Vite es
relativo (`./`), por lo que funciona tanto en `usuario.github.io/<repo>/` como en un
dominio propio.
