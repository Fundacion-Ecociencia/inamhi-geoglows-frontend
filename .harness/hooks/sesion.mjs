// Qué archivos tocó una sesión del agente. Al empezar (SessionStart) se guarda
// cómo estaban los cambios sin commit; al terminar un turno, los tocados son
// los que cambiaron desde entonces o aparecieron después. Una sesión sin foto
// inicial (un agente sin SessionStart, o una sesión que empezó antes de
// instalar esto) cuenta todos los cambios.

import { statSync } from "node:fs";
import { join } from "node:path";
import { guardarEstado, leerEstado } from "../bin/verificar.mjs";

export const MAX_SESIONES = 20;

/** Deja solo las últimas entradas de un mapa sesión → valor. */
export function recortar(mapa) {
  const claves = Object.keys(mapa ?? {});
  return Object.fromEntries(claves.slice(Math.max(0, claves.length - MAX_SESIONES)).map((k) => [k, mapa[k]]));
}

function firma(root, ruta) {
  try {
    const st = statSync(join(root, ruta));
    return `${st.size}:${st.mtimeMs}`;
  } catch {
    return "borrado";
  }
}

/** Guarda cómo estaban [cambios] al empezar la sesión, solo la primera vez. */
export function guardarInicio(root, sesion, cambios) {
  const estado = leerEstado(root);
  if (estado.sesiones?.[sesion]) return false;
  const foto = Object.fromEntries(cambios.map((ruta) => [ruta, firma(root, ruta)]));
  guardarEstado(root, { ...estado, sesiones: recortar({ ...estado.sesiones, [sesion]: foto }) });
  return true;
}

export function archivosTocados(root, sesion, cambios) {
  const foto = leerEstado(root).sesiones?.[sesion];
  if (!foto) return cambios;
  return cambios.filter((ruta) => foto[ruta] !== firma(root, ruta));
}
