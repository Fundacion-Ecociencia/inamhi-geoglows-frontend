## Producción

- **Por defecto, solo lectura.** Mirar (registros, `ps`, `df`, `git status`, consultas `SELECT`
  filtradas) no necesita permiso. Escribir, borrar, reiniciar o matar procesos lo confirma una
  persona para esa acción concreta: el harness pregunta, y niega lo que nunca se hace.
- **Con confirmación, siempre igual:** respaldo antes y fuera de la carpeta del código, cambio
  exacto que aborta si el original no coincide, `diff` contra el respaldo, prueba que no toque
  datos y verificación después.
- **En el clon del servidor nunca** `git clean`, `checkout .`, `reset --hard`, `stash` ni commits.
- **Despliegue:** solo lo que está en la rama principal. Antes, `who`, ningún proceso afectado
  corriendo y el clon limpio. Después de una vuelta atrás, ningún `git pull` hasta que el revert
  esté en el repositorio.
- **Crontab:** respaldo, versión nueva en un archivo, contar líneas y cambios, y recién entonces
  instalarla. Nunca `comando | crontab -`.
- **Consultas:** en las tablas grandes, siempre filtradas por su clave o su partición.
- **Lo que otro equipo mantiene a mano en el servidor** no se pisa ni se «arregla»: se acuerda
  antes con ellos.
