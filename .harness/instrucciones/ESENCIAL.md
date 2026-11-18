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
