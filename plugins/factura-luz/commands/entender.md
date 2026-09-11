---
description: Lee una factura de la luz y explica en español qué estás pagando
argument-hint: [ruta al PDF o imagen de la factura]
---

Lee la factura de la luz que hay en `$ARGUMENTS` y explícamela en español claro.

Sigue estos pasos:

1. Llama a `read_invoice` con `file_path` igual a la ruta indicada. Si no se ha
   indicado ninguna, pregúntame por ella antes de seguir.
2. Cuéntame qué tarifa tengo y qué significa, cuánto he pagado en esta factura y en
   qué se va el dinero (energía, potencia, impuestos), con cifras concretas en euros.
3. Llama a `analyze_power` reutilizando el objeto `invoice` que devolvió el paso 1,
   para decirme si puedo bajar la potencia contratada y cuánto ahorraría al año.
4. Avísame de cualquier cosa relevante: permanencia, fin de contrato, descuentos que
   caducan, o datos que falten en la factura.
5. Si el campo `warnings` trae algo, tradúcemelo tal cual, para que sepa qué partes
   son estimaciones y no datos exactos de la factura.

No inventes cifras: usa solo las que devuelvan las herramientas.
