# Cómo se hace un cambio

## 1. Antes de escribir

- Rama desde la rama principal actualizada (`fix/…`, `feat/…`), un cambio por rama.
- `node .harness/bin/riesgo.mjs <rutas que vas a tocar>` dice el nivel y lo que exige.
- Si la tarea tiene más de un paso o no termina en una sesión: skill `plan`. En riesgo alto el
  plan lo aprueba una persona antes del código.
- Si cambia un método científico o de cálculo: skill `investigar` antes de proponer nada.
- Busca en todo el código a qué más afecta el cambio. Las plantillas repetidas (varios scripts
  que son el mismo con otra variable) se revisan todas.

## 2. Probar de verdad

- Cada cambio trae su arnés: un script que corre solo, compara el resultado esperado con el
  obtenido y dice OK o FALLA por caso. Cada caso exige también el mensaje de su motivo, no solo
  el estado final: un aborto por otra causa no debe dar OK por accidente.
- Tres caminos como mínimo: feliz, «no existe» y error (archivo dañado, base que rechaza,
  servicio caído). Los servicios externos se simulan con un programa falso del tamaño real.
- El arnés acepta la versión a probar como argumento: se corre con la anterior (debe fallar) y
  con la nueva (debe pasar).
- En producción solo se prueba sobre una copia en `/tmp`, contra la base real y sin escribir.
  Una API se compara byte a byte con la que está sirviendo.
- Las cifras de un commit o de un pull request se escriben después de la última corrida.
- Simular un despliegue antes del merge no prueba el estado posterior al merge: el arnés modela
  ese estado.

## 3. Entregar

- Skill `entregar`: verificación, revisión según el riesgo, commit y pull request.
- Commits en el idioma del proyecto, con una primera línea que se entienda sola. Sin línea de
  coautoría ni marca de herramienta, salvo que el proyecto la permita.
- El pull request lo firma una persona: en impersonal o en primera persona, sin relleno.
- Las observaciones de la revisión se verifican una por una, se corrigen con un commit nuevo en
  la misma rama y se vuelven a probar.
- Un pull request apilado sobre otro cambia su base a la rama principal en cuanto se fusiona el
  de abajo.

## 4. Dejar registro

- Skill `registro`: lo hecho en el día, con horas en la zona del proyecto, lo que quedó sin
  probar y los errores propios.
- Un incidente deja una regla. Skill `leccion`: la anota en `docs/lecciones.md` y, si se puede
  comprobar por máquina, la agrega como caso en `.harness/incidentes/` para que la guardia la
  cubra.
- Si cambió el comportamiento de un pipeline, un endpoint o el esquema, la documentación se
  actualiza en el mismo commit.

## 5. Secretos

Un agente no escribe secretos en producción. Para rotar o cambiar uno se escribe un script con
`--simular`, modo real con confirmación escrita, `--sin-preguntas` y `--revertir`; el agente lo
simula y una persona lo ejecuta en el servidor dentro de `tmux`.
