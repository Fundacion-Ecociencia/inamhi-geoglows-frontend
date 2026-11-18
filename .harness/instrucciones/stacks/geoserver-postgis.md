# GeoServer, PostGIS y teselas

- **Los ráster son archivos, no filas.** El GeoTIFF va a la carpeta de su capa con un nombre que
  lleva la fecha, y a la base solo va su marca temporal. Ese par es lo que hace funcionar una
  capa animada: se escriben los dos o ninguno.
- **Las credenciales de la base también viven dentro de GeoServer** (un archivo por capa
  ráster). Rotar la contraseña de la base sin actualizarlas tumba las capas.
- **El juego de caracteres del almacén se declara.** Sin él, los nombres con tildes salen rotos.
- **Las tablas grandes están particionadas** y se consultan por su clave o su partición. Las
  particiones futuras se crean antes de que hagan falta.
- **Un `DROP` o un `TRUNCATE` puede quedar esperando un bloqueo** y dejar la carga duplicada:
  `lock_timeout`, y abortar si la tabla no quedó vacía.
- **Las funciones del servidor de teselas** se prueban con una base desechable y se reinicia el
  servicio después de cambiarlas.
- **Los cambios de capa se hacen con un script** que se puede simular y revertir, no a mano en
  la interfaz.
