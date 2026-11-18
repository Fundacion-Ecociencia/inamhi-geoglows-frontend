# INAMHI GEOGLOWS — frontend

<!-- Sección del proyecto: la escribe el equipo y el instalador no la toca. Breve: cada agente la lee en cada sesión. -->

## Qué es

Aplicación Angular 17 de la plataforma de monitoreo y pronóstico hidrometeorológico de
Ecuador (inamhi.geoglows.org), de Fundación EcoCiencia junto al INAMHI. Consume la API, las
capas y las teselas del servidor de servicios; la dirección está en
`src/environments/environment.ts`.

**Este repositorio es público.** Aquí no van direcciones internas, rutas del servidor, puertos,
configuración de los servicios ni texto de trabajo interno.

## Partes

- `src/app/`: una carpeta por aplicación (Hydroviewer, Hydropower, Met Data Explorer, Hydromet
  Report, ENSO) y los componentes compartidos.
- `src/environments/`: a qué servicios se conecta.
- `scripts/`: pasos previos a la compilación.

## Comandos

- Dependencias: `npm ci` (Node 20).
- Ejecutar en local: `npm start` (puerto 4200).
- Compilar: `npm run build`. El error de presupuesto de tamaño del paquete inicial es conocido;
  cualquier otro error es nuevo.
- Lo que aplica a un cambio: `node .harness/bin/verificar.mjs`.

## Entrega

Por pull request: rama `fix/…` o `feat/…` desde `main`, un cambio por rama, en español. Lo
fusiona y lo despliega el Especialista en Hidroinformática. Commits sin línea de coautoría.

## Reglas propias de este proyecto

- Una vista nueva sigue el estilo de las aplicaciones existentes: mismos paneles, leyendas,
  modales y tipografía.
- En la interfaz, terminología técnica de pronosticador; sin metáforas.
- Un cambio visual se comprueba en el navegador: la vista, la consola sin errores y las
  peticiones.
- Despliegue: se copia sin `--delete` (en el servidor hay archivos que no vienen de este
  repositorio) y el `index.html` va al final.

<!-- harness:inicio v0.1.0 · no edites esta parte: se actualiza con el instalador del harness -->

## Reglas del harness

Valen para personas y para agentes. Las que dicen «bloquea» o «pregunta» las hace cumplir un
hook; no dependen de que alguien las recuerde.

1. **Terminado quiere decir verificado.** Nada de «debería funcionar»: el cambio se ejecuta, con
   su camino feliz, su «no existe» y su error. Lo que no se pudo ejecutar se dice con las
   palabras «sin probar» y el motivo. Para mostrar que un arreglo arregla algo, la misma prueba
   falla con la versión anterior.
2. **El repositorio es la fuente de verdad.** Lo que no está en el repositorio no existe para el
   próximo que llegue: reglas, lecciones, planes y documentación viven aquí, no en la memoria de
   una persona ni de un agente.
3. **Cada cambio en su rama y con su pull request**, con tres secciones: qué cambia (y por qué,
   con el caso real), cómo se probó (comandos y resultados, y qué quedó sin probar) y vuelta
   atrás. Lo fusiona una persona. Antes de tocar algo, busca en todo el código a qué más afecta.
4. **Secretos fuera del código y fuera de la pantalla.** Van en `.env`; una variable nueva se
   agrega a `.env.example` sin valor. En la salida de un comando solo longitudes, conteos o
   valores enmascarados. El `.env` nunca se carga con `source`.
5. **El riesgo decide el proceso.** Cada ruta tiene un nivel (bajo, medio, alto) en
   `.harness/proyecto.json`. El nivel fija el modelo y el esfuerzo mínimos, si hace falta un plan
   aprobado, qué pruebas y qué revisión. `node .harness/bin/riesgo.mjs` lo dice para el cambio en
   curso.
6. **Antes de cambiar un método (científico o de cálculo), se investiga.** Literatura reciente
   con fuente verificable, contrastada con los datos propios, antes de proponer código. Se separa
   lo que dice la fuente de lo que se infiere.
7. **La deuda heredada no se arregla de paso.** Se anota y se decide aparte. Se sigue el estilo
   del archivo que se edita y no se reformatean carpetas enteras.
8. **Lo que hace un subagente es su informe, no una prueba.** El agente principal comprueba el
   resultado antes de darlo por bueno, y quien revisa no es quien escribió.

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

## Detalle y herramientas

Lee el archivo del tema antes de trabajar en él:

- `.harness/instrucciones/trabajo.md`: cómo se hace un cambio, cómo se prueba y cómo se entrega.
- `.harness/instrucciones/orquestacion.md`: riesgo de cada cambio, qué modelo y esfuerzo pide y cómo se reparten los subagentes.
- `.harness/instrucciones/produccion.md`: diagnóstico de solo lectura, despliegue, vuelta atrás, crontab y secretos.
- `.harness/instrucciones/stacks/angular.md`: antes de tocar el frontend.
- `docs/lecciones.md` (si existe): cada incidente del proyecto con la regla que dejó.

Subagentes: `auditor-seguridad`, `explorador`, `operador`, `probador`, `revisor`, `revisor-de-metodo`. Skills: `desplegar`, `entregar`, `investigar`, `leccion`, `plan`, `registro`, `verify`. Lo que hace cada agente queda en la bitácora: `node .harness/bin/bitacora.mjs`.

<!-- harness:fin -->
