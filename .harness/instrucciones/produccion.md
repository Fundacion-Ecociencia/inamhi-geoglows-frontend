# Producción: diagnóstico, despliegue y vuelta atrás

Los servidores, las rutas que mantiene otro equipo, las tablas grandes y los scripts de solo
lectura están declarados en `.harness/proyecto.json` → `produccion`. La guardia de comandos lee
de ahí; este archivo explica el porqué.

## Qué deja pasar la guardia y qué no

| Lo que corre en el servidor | Qué hace el harness |
|---|---|
| Lectura reconocida: `ls`, `tail`, `grep`, `ps`, `who`, `df`, `git status/log/diff`, `crontab -l`, `systemctl status`, `journalctl`, `psql -c "select … where …"`, scripts de estado declarados | Pasa |
| Escritura: `sudo`, `systemctl restart`, `rm`, `mv`, `sed -i`, redirigir a un archivo fuera de `/tmp`, `git pull`, instalar un crontab, SQL que cambia datos, un programa que el harness no conoce | Pregunta a una persona, con el recordatorio de la regla |
| `git clean`, `stash`, `reset --hard`, `checkout .`, commits en el servidor; `comando \| crontab -`; `crontab -r`; leer un archivo de secretos; tocar lo que mantiene otro equipo; `rsync --delete` | Niega |
| `ssh` sin comando, o con el comando por la entrada estándar | Pregunta: no se puede ver qué corre |
| Consulta sin filtro o con `count(distinct)` sobre una tabla grande | Pregunta: puede tardar horas |

Es una lista blanca: un comando que el harness no reconoce se pregunta, no se deja pasar.

## Diagnóstico

Subagente `operador` (solo lectura). Entrega hechos con su hora en la zona del proyecto y
distingue lo que vio de lo que supone.

## Despliegue

Skill `desplegar`. Lleva la lista de comprobación del proyecto: antes (`who`, procesos, clon
limpio, huellas de la API), durante (`git pull --ff-only`), después (reinicio si toca la API,
huellas otra vez, registros, estado de la plataforma) y vuelta atrás.

## Vuelta atrás

Forzar el commit bueno al remoto de despliegue y, enseguida, `git revert` del cambio en la rama
principal del repositorio. Hasta que ese revert esté subido, ningún `git pull` en el servidor:
el pull vuelve a avanzar hasta el commit malo.

## Crontab

Respaldo con `crontab -l`, versión nueva en un archivo, comprobar el número de líneas y cuántas
cambian, y recién entonces instalarla. Un `comando | crontab -` deja el crontab vacío si el
comando falla.
