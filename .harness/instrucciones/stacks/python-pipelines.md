# API y pipelines en Python

- **Un pipeline sigue un patrón fijo:** cargar la configuración → descargar → procesar →
  escribir el producto → registrar su marca temporal → limpiar lo viejo. Si un script es una
  plantilla repetida con otra variable, un cambio se evalúa para todos.
- **Idempotencia.** Una corrida repetida no duplica ni reprocesa lo ya hecho; una corrida
  interrumpida no deja nada a medias (transacción, archivo temporal y `mv` al final).
- **Los errores de base se cierran.** Después de una excepción, `rollback` antes de seguir: sin
  él la conexión queda inservible para lo que viene.
- **Varias bases, una variable por base.** Elegir la equivocada es el error más frecuente:
  comprueba el sufijo de la variable antes de conectar.
- **Sin listas de fechas escritas en el código.** Meses, años y particiones se calculan.
- **Para probar un script que no se puede correr entero,** se ejecutan sus funciones reales
  contra datos de prueba y una base desechable, con un caso sano, uno dañado y uno de error.
- **La API se compara byte a byte** con la que está sirviendo antes de desplegar, y se le mandan
  peticiones mal formadas.
- **Dependencias con versión fija.** Lo que se instala para que algo corra queda anotado.
