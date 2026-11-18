# Orquestación: riesgo, modelo, esfuerzo y subagentes

## El riesgo decide

Cada ruta del repositorio tiene un nivel en `.harness/proyecto.json` → `riesgo`. El nivel de un
cambio es el de su ruta más riesgosa. `node .harness/bin/riesgo.mjs` lo calcula.

| Nivel | Modelo (mínimo) | Esfuerzo | Plan | Pruebas | Revisión |
|---|---|---|---|---|---|
| Bajo: documentación, textos, pruebas, estilos | `sonnet` (`haiku`) | medium | No | La verificación rápida | No hace falta |
| Medio: un endpoint, un pipeline, una vista | `opus` (`sonnet`) | high | Si pasa de un paso | Feliz, «no existe» y error, ejecutadas | `revisor` antes del pull request |
| Alto: esquema, carga de datos, secretos, crontab, despliegue | `opus` (`opus`) | xhigh | Siempre, aprobado por una persona | Arnés que falla con la versión anterior y simulación en una copia contra la base real | `revisor`, y `revisor-de-metodo` si cambia un método |

La tabla vive en `.harness/orquestacion.json`; el proyecto puede cambiar valores en
`orquestacion` de `proyecto.json`.

## Cómo se hace cumplir

- **Modelo.** El harness guarda el modelo de cada sesión (al empezar y en cada `/model`). Antes
  de editar una ruta cuyo nivel pide un modelo mayor, la guardia de archivos pregunta. Antes de
  bajar de modelo con cambios de riesgo sin entregar, pregunta. Un modelo que el harness no
  reconoce no se juzga.
- **Esfuerzo.** No llega a los hooks, así que se fija donde se puede: `effortLevel` en la
  configuración del proyecto (`high` por defecto), y `effort` en cada skill y en cada subagente.
  Para riesgo alto, sube con `/effort xhigh` antes de empezar.
- **Subagentes.** Cada uno trae su `model` y su `effort` en el encabezado; no heredan los de la
  sesión.

## Qué subagente para qué tarea

| Tarea | Subagente | Modelo | Esfuerzo | Puede editar |
|---|---|---|---|---|
| Buscar en el código, leer registros largos | `explorador` | haiku | low | No |
| Mirar producción | `operador` | sonnet | medium | No (y solo lectura en el servidor) |
| Escribir pruebas y arneses | `probador` | sonnet | high | Solo pruebas |
| Revisar un cambio | `revisor` | opus | high | No |
| Revisar un método científico | `revisor-de-metodo` | opus | xhigh | No |
| Auditar seguridad | `auditor-seguridad` | opus | high | No |

El trabajo de diseño y el cambio en sí los hace la sesión principal, con el modelo y el esfuerzo
de su nivel.

## Agentes en paralelo

1. Los que solo leen (explorar, revisar, auditar, mirar producción) pueden correr juntos.
2. Dos agentes nunca escriben los mismos archivos: antes de lanzarlos se reparte por escrito qué
   carpetas son de cada uno.
3. Lo que uno necesita de otro (una función, un formato) se define antes de lanzar a los dos.
4. Al terminar, el agente principal comprueba cada resultado y corre la verificación completa.
5. Quien revisa no vio la conversación de quien escribió: recibe el diff, no la conclusión.

## Otros agentes

Codex y otros leen el mismo `AGENTS.md` y pasan por las mismas guardias de comandos y de
archivos. Lo que en Claude Code «pregunta», en un agente que no puede preguntar se niega con el
mensaje de que lo haga una persona.
