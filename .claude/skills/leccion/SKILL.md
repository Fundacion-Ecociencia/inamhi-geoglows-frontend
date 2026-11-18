---
name: leccion
description: Convertir un incidente o un error en una regla del proyecto, anotarla en docs/lecciones.md y, cuando se puede comprobar por máquina, agregarla como caso de prueba de las guardias. Usar después de cualquier incidente, de un error propio que costó tiempo o de una corrección de quien dirige el proyecto.
---

# De incidente a regla

Una regla que solo está en la memoria de una persona o de un agente no existe para el
siguiente. Lo aprendido va al repositorio.

1. **El hecho,** en una línea: fecha, qué se hizo y qué pasó. Sin culpas.
2. **Qué faltó:** qué comprobación lo habría evitado.
3. **La regla,** escrita como una acción concreta («respaldo, archivo nuevo, contar líneas y
   recién instalar»), no como una intención («tener más cuidado»).
4. **Dónde vive:**
   - Siempre: una entrada en `docs/lecciones.md` (fecha · incidente · regla).
   - Si un comando o una edición lo puede detectar: un caso en `docs/lecciones.casos.json`
     (mismo formato que `.harness/incidentes/casos.json`: el comando y la decisión esperada,
     `deny`, `ask` o `pasa`). `node .harness/bin/incidentes.mjs` lo corre contra las guardias.
     Si la guardia actual no lo cubre, el caso falla: eso se pide como cambio al repositorio
     del harness.
   - Si es de un procedimiento: en la guía correspondiente de `docs/`.
5. `AGENTS.md` no crece con cada lección: ahí solo va lo que todo agente necesita en toda sesión.
