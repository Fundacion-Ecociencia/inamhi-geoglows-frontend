---
name: registro
description: Anotar lo hecho en el día en el registro diario del proyecto, con horas en la zona horaria del proyecto, comprobaciones, lo que quedó sin probar y los errores propios. Usar al terminar un bloque de trabajo, después de un despliegue o cuando pidan «anota en el daily» o «registra lo de hoy».
model: sonnet
effort: low
---

# Registro diario

La carpeta y el formato del nombre están en `AGENTS.md` del proyecto (o en
`.harness/proyecto.json` → `registro`). Plantilla: `.harness/plantillas/registro.md`.

- Una sección por tema, con título descriptivo.
- Hechos con su cifra: qué se cambió, qué comando lo probó y con qué resultado (casos, fallas).
- Horas en la zona horaria del proyecto, no en la del servidor.
- **Sin probar o pendiente:** con esas palabras, y qué lo confirmaría.
- **Errores propios:** qué pasó, cómo se detectó y qué regla deja. Un error que deja una regla
  se pasa también por la skill `leccion`.
- Enlaces a los pull requests y los commits de antes y de después de cada despliegue.
- Lenguaje directo: sin relato, sin adjetivos. No se inventan actividades.
- Sin secretos ni valores de variables de entorno.
