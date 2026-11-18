#!/usr/bin/env node
// Al terminar un turno (Stop): si esta sesión dejó cambios sin commit que no
// pasaron la verificación rápida del proyecto, la corre. Si falla, el agente
// no termina: recibe los errores y sigue (decision "block", que Claude Code y
// Codex entienden igual). Después de MAX_INTENTOS bloqueos seguidos en el
// mismo turno, deja terminar y avisa a la persona.
//
// Solo mira los archivos que tocó esta sesión: el hook de inicio guarda cómo
// estaban los cambios al empezar, y lo que otra sesión o una persona tenga a
// medias no le toca arreglarlo a este agente. Solo corre las verificaciones
// marcadas como rápidas; las suites completas las corre la skill `verify`.

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { log, projectDir, readPayload } from "./comun.mjs";
import { archivosTocados, recortar } from "./sesion.mjs";
import {
  archivosCambiados, elegir, guardarEstado, huella, leerEstado, leerProyecto, leerVerificaciones, resumen, verificar,
} from "../bin/verificar.mjs";

export const MAX_INTENTOS = 2;

function agentName() {
  const i = process.argv.indexOf("--agente");
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : "otro";
}

/**
 * Cuántos bloqueos lleva este turno. Claude Code dice con `stop_hook_active`
 * si ya está siguiendo por un hook: si no, es la primera parada del turno y
 * se cuenta desde cero. Un agente que no lo manda cuenta por sesión hasta que
 * la verificación pase.
 */
export function intentosPrevios(payload, previos) {
  if (typeof payload?.stop_hook_active === "boolean" && !payload.stop_hook_active) return 0;
  return previos ?? 0;
}

/** Lo que el hook decide, sin efectos: para probarlo sin correr comandos. */
export function decidir({ intentosPrevios: previos, resultado }) {
  if (resultado.ok) return { accion: "terminar" };
  const intentos = previos + 1;
  if (intentos > MAX_INTENTOS) return { accion: "avisar", intentos };
  return { accion: "seguir", intentos };
}

async function main() {
  const payload = readPayload();
  const root = projectDir(payload);
  const agente = agentName();
  const sesion = String(payload?.session_id ?? payload?.sessionId ?? "sin-sesion");
  const verificaciones = leerVerificaciones(leerProyecto(root));
  const rapidas = verificaciones.filter((v) => v.rapido);
  if (!rapidas.length) process.exit(0);

  const cambios = archivosCambiados(root);
  const tocados = archivosTocados(root, sesion, cambios);
  if (!elegir(rapidas, tocados, { rapido: true }).length) process.exit(0);

  const estado = leerEstado(root);
  const todo = huella(root, cambios, verificaciones);
  if (estado.rapido?.huella === todo || estado.completo?.huella === todo) process.exit(0); // Ya pasó así.
  const marca = huella(root, tocados, verificaciones);
  if (estado.verdes?.[sesion] === marca) process.exit(0);

  const resultado = await verificar(root, { rapido: true, archivos: tocados });
  const d = decidir({ intentosPrevios: intentosPrevios(payload, estado.fallos?.[sesion]), resultado });
  const nuevo = leerEstado(root);
  if (d.accion === "terminar") {
    guardarEstado(root, {
      ...nuevo,
      verdes: recortar({ ...nuevo.verdes, [sesion]: marca }),
      fallos: recortar({ ...nuevo.fallos, [sesion]: 0 }),
    });
    log(root, { evento: "verificacion", agente, sesion, detalle: "rápida en verde" });
    process.exit(0);
  }
  guardarEstado(root, { ...nuevo, fallos: recortar({ ...nuevo.fallos, [sesion]: d.intentos }) });
  log(root, { evento: "verificacion", agente, sesion, regla: "verificacion-rapida", detalle: `en rojo, intento ${d.intentos}` });
  const texto = resumen(resultado, { rapido: true });
  if (d.accion === "avisar") {
    process.stdout.write(JSON.stringify({
      systemMessage: `La verificación rápida sigue en rojo después de ${MAX_INTENTOS} intentos; el agente terminó igual. Revisa antes de hacer commit.\n${texto}`,
    }));
    process.exit(0);
  }
  process.stdout.write(JSON.stringify({
    decision: "block",
    reason: `Harness del harness: los cambios de esta sesión no pasan la verificación rápida. Arréglalos antes de terminar (intento ${d.intentos} de ${MAX_INTENTOS}).\n${texto}`,
  }));
  process.exit(0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(() => process.exit(0)); // Un fallo del hook nunca deja al agente sin poder terminar.
}
