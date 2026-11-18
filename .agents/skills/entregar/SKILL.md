---
name: entregar
description: Entregar un cambio terminado: clasificar su riesgo, verificarlo, pasarlo por la revisión que ese riesgo exige, hacer el commit y abrir el pull request con las tres secciones (qué cambia, cómo se probó, vuelta atrás). Usar cuando pidan «entrega», «abre el PR», «sube este cambio» o al terminar el último paso de un plan.
---

# Entregar un cambio

1. **Rama.** Nunca en la rama principal. Si estás ahí, crea `fix/…` o `feat/…` antes del commit.
2. **Riesgo.** `node .harness/bin/riesgo.mjs --base origin/<rama principal>`. Anota el nivel: va
   en el pull request.
3. **Verificación.** Skill `verify`. En rojo no se entrega.
4. **Revisión según el nivel.**
   - Bajo: relee tu propio diff.
   - Medio: subagente `revisor` con el diff (no con tu conclusión).
   - Alto: `revisor` y, si cambia un método, `revisor-de-metodo`.
   Cada hallazgo se comprueba; los ciertos se corrigen y se vuelven a probar.
5. **Documentación.** Si cambió el comportamiento de un pipeline, un endpoint o el esquema, la
   documentación va en el mismo commit.
6. **Commit.** En el idioma del proyecto, primera línea que se entienda sola. Sin línea de
   coautoría ni marca de herramienta (el harness lo bloquea si el proyecto no la permite). Solo
   los archivos del cambio: nada de `git add -A` a ciegas.
7. **Pull request** con la plantilla `.github/pull_request_template.md`:
   - **Qué cambia** y por qué, con el caso real que lo motivó.
   - **Cómo se probó:** comandos y resultados de la última corrida, el resultado con la versión
     anterior, y qué quedó sin probar.
   - **Vuelta atrás:** el commit al que se vuelve y lo que el revert no deshace.
   - **Riesgo:** el nivel y las rutas que lo dan.
   En impersonal o en primera persona: lo firma una persona. Sin relleno.
8. **No lo fusiones.** Lo fusiona una persona después de la revisión. Si el pull request está
   apilado sobre otro, cambia su base a la rama principal en cuanto se fusione el de abajo.
9. Si el plan del cambio quedó completo, muévelo a `docs/planes/terminados/` en el mismo commit.
