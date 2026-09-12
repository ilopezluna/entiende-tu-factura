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

## Qué hace el servidor y qué hace tu agente

El servidor se ocupa de las dos cosas que tu agente no puede hacer solo: **sacar** los
datos del QR de la CNMC que hay dentro del PDF, y **decir qué significa** cada campo.
Las cuentas las hace el agente, con los datos ya extraídos.

Por eso no hay herramientas de tipo calculadora. Las preguntas de arriba se siguen
respondiendo igual de bien: el agente lee la factura, lee el recurso
`cnmc://power-method` y aplica esa receta. Como la receta es la misma que usa la web
del proyecto, las cifras coinciden con las que verías allí.

## Herramientas

| Herramienta       | Para qué sirve                                                                         |
| ----------------- | -------------------------------------------------------------------------------------- |
| `read_invoice`    | Lee la factura entera: contrato, potencia, consumo, precios, importes y media mensual. |
| `explain_concept` | Explica un concepto de la factura, con tus propias cifras si le pasas la factura.      |
| `list_concepts`   | Lista los conceptos que `explain_concept` sabe explicar.                               |

`read_invoice` y `explain_concept` aceptan la factura de tres formas:

- `file_path`: ruta al PDF o imagen (PNG, JPG, WEBP) en tu ordenador.
- `qr_url`: la URL del comparador de la CNMC, si el QR ya está decodificado.
- `invoice`: el objeto `invoice` que devolvió `read_invoice`. **Úsalo siempre que puedas**:
  evita volver a decodificar el PDF, que es con diferencia el paso más lento.

Las claves del JSON están en inglés para que el modelo razone mejor sobre ellas; todo el
texto pensado para leer está en español.

## Recursos

| Recurso                 | Contenido                                                              |
| ----------------------- | ---------------------------------------------------------------------- |
| `cnmc://qr-fields`      | Los 43 campos del QR, con unidades, obligatoriedad y particularidades. |
| `cnmc://glossary`       | Glosario de conceptos de la factura en lenguaje llano.                 |
| `cnmc://contract-types` | Tipos de contrato (PVPC, fija, indexada, tarifa plana, flexible).      |
| `cnmc://power-method`   | Cómo calcular si puedes bajar la potencia y cuánto ahorrarías.         |

Y un prompt, `entender-factura`, que guía al agente desde la ruta del fichero hasta una
explicación completa en español.

`cnmc://qr-fields` es una transcripción de la [Resolución de la CNMC de 6 de octubre de
2022](https://www.boe.es/diario_boe/txt.php?id=BOE-A-2022-16989), Anexo I, y lleva
además las Tablas 2 y 4: los tipos de factura y el ejemplo resuelto. Un test fija los 43
campos contra esa tabla para que no se desvíen de la norma sin que nadie se entere.

Ojo con `required`: `true` son los campos con la casilla «Obligatorio» marcada. `false`
no significa opcional, porque la mayoría son obligatorios salvo en facturas anuladoras,
rectificadoras, complementarias o regularizadoras.

## Deducciones

Alguna cifra es una deducción y no un dato impreso en la factura. `read_invoice` las
lista en el campo `inferences`, con el valor que ha publicado, lo que decía el QR y qué
otras secciones arrastran esa deducción:

- **La unidad del precio de potencia.** El QR no indica si viene en €/kW/día o en €/kW/año;
  se deduce de la magnitud del valor y se convierte dividiendo entre 365.
- **La ventana del consumo anual.** Algunas comercializadoras rellenan mal la fecha de
  inicio, lo que multiplicaría por diez la media mensual. Cuando el consumo facturado
  contradice esa fecha, se estima la ventana real a partir del ritmo de consumo.
- **La estimación mensual sin precios de energía.** Si el QR no los trae, la media se
  deriva del importe total en vez de calcularse a partir del consumo.

Si `inferences` trae algo, preséntalo al usuario como estimación y no como dato exacto.
Es la única parte del JSON que no puedes deducir mirando los datos: el campo afectado
lleva un número que parece medido.

Lo que **no** hay ahí son campos que el QR simplemente no incluye. Esos llegan como
`null` y se ven solos, así que el servidor no gasta una frase en repetirlo.

## Limitaciones

- Solo lee facturas con el **QR de la CNMC**, obligatorio en España desde 2023. Una factura
  antigua sin QR no se puede leer.
- Formatos de imagen admitidos: PNG, JPG, JPEG, WEBP, AVIF y SVG. Para GIF o BMP, convierte
  a PNG o usa el PDF original.
- El QR no contiene el detalle hora a hora del consumo, así que no se pueden analizar hábitos
  de consumo ni comparar tramos horarios reales.

## Licencia

MIT
