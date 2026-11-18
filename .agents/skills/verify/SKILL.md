---
name: verify
description: Verificar que el cambio funciona antes de hacer commit, corriendo las verificaciones del proyecto que aplican a lo que cambió (arneses, pruebas, compilación, sintaxis). Usar antes de cada commit, antes de decir que algo está terminado y cuando pidan «verifica», «corre las pruebas» o «¿funciona?».
allowed-tools: Bash(node .harness/bin/verificar.mjs *), Bash(node .harness/bin/riesgo.mjs *)
---

# Verificar antes de terminar

Terminado quiere decir verificado. Esta skill corre lo que el proyecto declaró en
`.harness/proyecto.json` → `verificar`, solo lo que aplica a los archivos cambiados.

## Pasos

1. `node .harness/bin/riesgo.mjs` para saber el nivel del cambio y qué pruebas exige.
2. `node .harness/bin/verificar.mjs`. Dale tiempo (hasta 10 minutos) o córrelo en segundo plano.
   - Sale 0: todo en verde, o nada aplicaba. Sigue.
   - Sale 1: algo falló. Arregla la causa, no la prueba, y vuelve a correrla.
   - Sale 3: el proyecto no declaró verificaciones. Corre los comandos de «Comandos» de
     `AGENTS.md` que correspondan, y dilo en el reporte.
3. Las verificaciones declaradas son el piso, no el techo. Según el nivel:
   - **Medio:** el cambio trae su prueba con camino feliz, «no existe» y error, ejecutada.
   - **Alto:** además, el arnés falla con la versión anterior y hay una simulación en una copia
     contra la base real, sin escribir.
   Si falta, delega en el subagente `probador`.
4. Si el cambio se ve en pantalla, ábrelo y compruébalo como lo haría un usuario.
5. En el reporte: qué corrió, con qué resultado, y qué quedó **sin probar** y por qué.

## Opciones

- `--todo`: corre todas aunque no haya cambios.
- `--rapido`: solo las rápidas (las del hook de fin de turno).
- `--base origin/main`: incluye lo que va de esa rama a HEAD.
