# factura-luz-mcp

Servidor [MCP](https://modelcontextprotocol.io) que lee y explica facturas de la luz
españolas a partir del código QR de la CNMC.

Está pensado para que **le pidas a tu agente que entienda tu factura**: le pasas el PDF
que te manda la comercializadora y el agente te dice qué estás pagando, si te sobra
potencia contratada y cuánto ahorrarías bajándola.

Es la versión para agentes de [entiende-tu-factura](https://ilopezluna.github.io/entiende-tu-factura/),
y usa exactamente la misma lógica de cálculo que la web.

## Privacidad

**Tu factura no sale de tu ordenador.** El servidor se ejecuta en local, lee el fichero
del disco y no hace ninguna petición de red: ni telemetría, ni consultas a APIs, ni
descarga de recursos. Hay un test que lo comprueba desactivando `fetch`, `http`, `https`,
`net` y `dns` y leyendo una factura entera con la red inutilizada.

Lo que sí sale de tu ordenador es lo que tu agente decida contarle a su modelo. El
servidor devuelve el CUPS y el código postal sin ocultar, porque son los datos que hacen
falta para comparar ofertas, así que tenlo en cuenta según qué agente uses.

## Instalación

### Opción 1: como plugin de Claude Code (recomendada)

```bash
claude plugin marketplace add ilopezluna/entiende-tu-factura
claude plugin install factura-luz@entiende-tu-factura
```

Además del servidor, esto te instala el comando `/entender`, que lee la factura y te la
explica de una vez.

### Opción 2: como servidor MCP suelto

```bash
claude mcp add factura-luz -- npx -y factura-luz-mcp
```

### Opción 3: en otro agente

Añade esto a la configuración MCP de tu agente:

```json
{
  "mcpServers": {
    "factura-luz": {
      "command": "npx",
      "args": ["-y", "factura-luz-mcp"]
    }
  }
}
```

Requiere Node.js 20 o superior.

También está listado en el
[MCP Registry](https://registry.modelcontextprotocol.io) como
`io.github.ilopezluna/factura-luz`, así que los clientes que soporten descubrimiento
pueden encontrarlo por su nombre.

## Uso

Si instalaste el plugin, el atajo es:

```
/entender ~/Descargas/factura-enero.pdf
```

O pídeselo a tu agente en lenguaje natural:

> Explícame la factura que tengo en ~/Descargas/factura-enero.pdf

> ¿Puedo bajar la potencia contratada? ¿Cuánto ahorraría al año?

> ¿Y si la dejo en 3 kW?

## Herramientas

| Herramienta             | Para qué sirve                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `read_invoice`          | Lee la factura entera: contrato, potencia, consumo, precios, importes y media mensual. |
| `analyze_power`         | Dice si puedes bajar la potencia contratada y cuánto ahorrarías al año.                |
| `simulate_power_change` | Calcula el ahorro para una potencia concreta que tú propongas.                         |
| `explain_concept`       | Explica un concepto de la factura, con tus propias cifras si le pasas la factura.      |
| `list_concepts`         | Lista los conceptos que `explain_concept` sabe explicar.                               |

Todas las herramientas de análisis aceptan la factura de tres formas:

- `file_path`: ruta al PDF o imagen (PNG, JPG, WEBP) en tu ordenador.
- `qr_url`: la URL del comparador de la CNMC, si el QR ya está decodificado.
- `invoice`: el objeto `invoice` que devolvió `read_invoice`. **Úsalo siempre que puedas**:
  evita volver a decodificar el PDF, que es con diferencia el paso más lento.

Las claves del JSON están en inglés para que el modelo razone mejor sobre ellas; todo el
texto pensado para leer está en español.

## Recursos

| Recurso                 | Contenido                                                            |
| ----------------------- | -------------------------------------------------------------------- |
| `cnmc://qr-fields`      | Todos los campos del QR de la CNMC, con unidades y particularidades. |
| `cnmc://glossary`       | Glosario de conceptos de la factura en lenguaje llano.               |
| `cnmc://contract-types` | Tipos de contrato (PVPC, fija, indexada, tarifa plana, flexible).    |

Y un prompt, `entender-factura`, que guía al agente desde la ruta del fichero hasta una
explicación completa en español.

## Avisos y estimaciones

Dos cifras son deducciones, no datos impresos en la factura, y el servidor lo dice en el
campo `warnings` cuando toca:

- **La unidad del precio de potencia.** El QR no indica si viene en €/kW/día o en €/kW/año;
  se deduce de la magnitud del valor.
- **La ventana del consumo anual.** Algunas comercializadoras rellenan mal la fecha de
  inicio, lo que multiplicaría por diez la media mensual. Cuando el consumo facturado
  contradice esa fecha, se estima la ventana real a partir del ritmo de consumo.

Traslada esos avisos al usuario en lugar de presentar las cifras como exactas.

## Limitaciones

- Solo lee facturas con el **QR de la CNMC**, obligatorio en España desde 2023. Una factura
  antigua sin QR no se puede leer.
- Formatos de imagen admitidos: PNG, JPG, JPEG, WEBP, AVIF y SVG. Para GIF o BMP, convierte
  a PNG o usa el PDF original.
- El QR no contiene el detalle hora a hora del consumo, así que no se pueden analizar hábitos
  de consumo ni comparar tramos horarios reales.

## Licencia

MIT
