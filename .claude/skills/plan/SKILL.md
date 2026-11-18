---
name: plan
description: Escribir y seguir el plan de una tarea de más de un paso o de más de una sesión, guardado en el repo (docs/planes/), con lo que cambia para el usuario, criterios que se pueden comprobar, lo que queda fuera y los pasos. Usar antes de empezar una función nueva, un cambio grande, una migración o cualquier pedido que no se termina en un rato, y cuando pidan «planifica», «haz un plan» o «¿cómo lo harías?».
effort: high
---

# Plan de trabajo

El plan vive en el repo para que cualquier persona o agente pueda retomar el
trabajo sin la conversación original. Una sesión que se corta, una
compactación o un agente nuevo leen el plan y siguen donde quedó.

## Escribirlo

1. Acuerda primero la necesidad: para qué lo usaría quien opera el producto.
   Pregunta solo lo que es decisión de esa persona; lo técnico lo decides tú.
   Si el plan cambia un método científico o de cálculo, corre antes la skill
   `investigar`.
2. Copia `.harness/plantillas/plan.md` a
   `docs/planes/activos/AAAA-MM-DD-tema-corto.md` y llénalo:
   - **Para el usuario:** qué cambia, en lenguaje sencillo, para que quien
     decide lo apruebe sin leer código.
   - **Riesgo:** el nivel que da `node .harness/bin/riesgo.mjs <rutas>` y lo
     que ese nivel exige.
   - **Criterios:** «cuando pasa X, el sistema hace Y». Cada uno se tiene que poder
     comprobar con una prueba o mirando el resultado. Si no se puede comprobar, no
     es un criterio.
   - **Fuera de alcance:** lo que no se toca.
   - **Pasos:** casillas `- [ ]`, cada una lo bastante chica para hacerla y
     verificarla en una sesión, con cómo se verifica.
3. Si el plan cambia lo que ve el usuario, o es de riesgo alto, muéstraselo a
   quien decide y espera su aprobación antes de escribir código. Separa siempre
   lo que ya está hecho de lo que es propuesta.

## Seguirlo

- Un paso a la vez. Al terminarlo, verifica (skill `verify`) y recién entonces
  marca la casilla `- [x]`. No marques pasos que no verificaste.
- Escribe los criterios como pruebas antes de implementar, cuando se pueda.
- Anota en **Avance** qué se hizo en cada sesión y en **Decisiones** lo que se
  decidió y por qué. Lo próximo que lea el plan no tendrá esta conversación.
- Si aparece algo que no estaba en el plan, agrégalo como paso nuevo o en
  «Fuera de alcance»; no lo hagas a escondidas.
- Al entregar el último paso (skill `entregar`), mueve el archivo a
  `docs/planes/terminados/` en el mismo commit.

Al empezar o retomar una sesión, el harness le recuerda al agente los planes
activos y su siguiente paso.
