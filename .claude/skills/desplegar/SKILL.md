---
name: desplegar
description: Desplegar en producción lo que ya está fusionado en la rama principal, con la lista de comprobación de antes, durante y después, y la vuelta atrás preparada. Usar solo cuando una persona pida desplegar un cambio concreto.
disable-model-invocation: true
effort: high
---

# Desplegar

Solo se despliega lo que está en la rama principal. Cada paso que escribe en producción lo
confirma una persona: el harness va a preguntar y es lo esperado. Si algo de esta lista no se
puede cumplir, no se despliega.

Lee antes la guía de despliegue del proyecto (está enlazada en `AGENTS.md`); tiene los comandos
exactos. Esta lista es el orden.

## Antes

1. `who` en el servidor: si hay alguien más conectado, esperar.
2. Ningún proceso afectado corriendo (`ps`) y ninguna rutina programada por empezar.
3. `git status` del clon del servidor limpio y en el commit esperado. Anota ese commit: es la
   vuelta atrás.
4. Si toca la API: saca las huellas de las respuestas (las URL de prueba del proyecto).
5. Di en una frase qué va a pasar y espera la confirmación.

## Durante

6. `git pull --ff-only` en el clon. Si falla porque alguien editó a mano un archivo, no se
   fuerza: se mira el `git diff` y esa edición se lleva al repositorio.

## Después

7. Si toca la API: reinicio del servicio (confirmado), huellas otra vez y el registro del servicio.
8. Si toca una rutina programada: se usa en su siguiente corrida. Deja anotado cuándo es y qué
   línea del registro confirma que funcionó.
9. El script de estado de la plataforma.
10. Skill `registro`: hora, commit de antes y de después, comprobaciones y lo pendiente.

## Vuelta atrás

- Forzar el commit bueno al remoto de despliegue y, enseguida, `git revert` del cambio en la
  rama principal del repositorio.
- **Ningún `git pull` en el servidor hasta que ese revert esté subido.**
- Si el cambio creó algo que el revert no deshace (una tabla, una partición, un archivo), dilo.
