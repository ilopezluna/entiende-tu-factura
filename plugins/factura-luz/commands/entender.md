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
3. Lee el recurso `cnmc://power-method` y aplica esa receta a los datos del paso 1
   para decirme si puedo bajar la potencia contratada y cuánto ahorraría al año.
   Respeta el margen de seguridad, el redondeo y el orden de los impuestos tal como
   los define el recurso: así tus cifras cuadran con las que muestra la web.
4. Avísame de cualquier cosa relevante: permanencia, fin de contrato, descuentos que
   caducan, o datos que falten en la factura.
5. Si el campo `inferences` trae algo, cuéntamelo con tus palabras: son cifras que el
   servidor ha deducido en vez de leerlas de la factura, y quiero saber qué partes son
   estimaciones antes de fiarme de ellas.

No inventes cifras. Las de la factura salen de `read_invoice` tal cual; las de
potencia, de aplicar el método del recurso a esas mismas cifras, nunca de estimar a
ojo.
