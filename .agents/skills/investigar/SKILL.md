---
name: investigar
description: Revisar la literatura y los datos antes de proponer o cambiar un método científico o de cálculo (un índice, un umbral, una corrección de sesgo, una estadística, una unidad). Usar siempre antes de escribir código que cambie un número que ven los usuarios, y cuando pidan «investiga», «estado del arte» o «¿está bien calculado?».
effort: xhigh
---

# Investigar antes de implementar

1. **La necesidad.** Para qué usa ese número quien opera el producto y qué decisión toma con
   él. Si no está claro, pregúntalo antes de buscar.
2. **El método actual,** en dos o tres frases simples: qué calcula, con qué datos, con qué
   supuestos y qué puede salir mal.
3. **La literatura.** Los trabajos que definen el método y los recientes que lo usan, lo
   corrigen o lo reemplazan. Cada cita con DOI o enlace que abra. Lo que no puedas verificar no
   se cita; lo que recuerdas de memoria no es una fuente.
4. **Los datos propios.** Reproduce un caso publicado con los datos del proyecto, o compara con
   un producto oficial. Di qué coincide y qué no.
5. **La conclusión por escrito,** en `docs/` del proyecto, antes de proponer código: qué dice
   la fuente, qué infieres tú (separado), qué opciones hay con su costo, y cuál recomiendas.
6. Para una revisión independiente del resultado, subagente `revisor-de-metodo`.

En la interfaz se usa la terminología técnica del usuario; sin metáforas.
