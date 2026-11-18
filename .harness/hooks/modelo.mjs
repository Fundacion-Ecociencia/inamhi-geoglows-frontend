#!/usr/bin/env node
// Qué modelo usa cada sesión y si alcanza para lo que está tocando.
//
//   SessionStart     guarda el modelo con que empezó la sesión (cuando Claude
//                    Code lo informa).
//   PostModelSwitch  guarda el modelo nuevo después de un /model.
//   PreModelSwitch   si la sesión ya tocó archivos de un nivel de riesgo que
//                    pide un modelo mayor que el nuevo, pregunta antes de bajar.
//
// La guardia de archivos usa `modeloDeSesion` para preguntar antes de editar
// una ruta de riesgo con un modelo menor que el mínimo. El esfuerzo no llega a
// los hooks: se fija en la configuración, en cada skill y en cada subagente.

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { log, projectDir, readPayload, readProjectConfig } from "./comun.mjs";
import { leerOrquestacion, modeloAlcanza, nivelDeCambio } from "./proyecto.mjs";
import { archivosTocados, recortar } from "./sesion.mjs";
import { archivosCambiados, guardarEstado, leerEstado } from "../bin/verificar.mjs";

export function modeloDeSesion(root, sesion) {
  if (!sesion) return null;
  return leerEstado(root).modelos?.[String(sesion)] ?? null;
}

export function guardarModelo(root, sesion, modelo) {
  if (!sesion || !modelo) return;
  const estado = leerEstado(root);
  guardarEstado(root, { ...estado, modelos: recortar({ ...estado.modelos, [String(sesion)]: String(modelo) }) });
}

/** El texto del modelo, venga como cadena o como objeto ({ id, display_name }). */
export function nombreDeModelo(valor) {
  if (!valor) return null;
  if (typeof valor === "string") return valor;
  return valor.id ?? valor.name ?? valor.display_name ?? null;
}

/** Qué hacer ante un cambio de modelo: null (pasa) o el motivo para preguntar. */
export function revisarCambio({ nuevo, tocados, config, orquestacion }) {
  const nivel = nivelDeCambio(tocados, config);
  if (!nivel || modeloAlcanza(nuevo, nivel, orquestacion)) return null;
  const pide = orquestacion.niveles[nivel];
  return `Esta sesión tiene cambios de riesgo ${nivel} sin entregar y ${nuevo} está por debajo del mínimo para ese nivel (${pide.modeloMinimo}). Termina y verifica ese cambio con ${pide.modelo} antes de bajar de modelo, o confirma que lo que sigue no toca esas rutas.`;
}

function main() {
  const payload = readPayload();
  const root = projectDir(payload);
  const sesion = payload?.session_id ?? payload?.sessionId;
  const evento = payload?.hook_event_name ?? process.argv[process.argv.indexOf("--evento") + 1];
  try {
    if (evento === "SessionStart") {
      guardarModelo(root, sesion, nombreDeModelo(payload?.model));
    } else if (evento === "PostModelSwitch") {
      const nuevo = nombreDeModelo(payload?.to_model);
      guardarModelo(root, sesion, nuevo);
      log(root, { evento: "cambio_de_modelo", agente: "claude", sesion, detalle: `${nombreDeModelo(payload?.from_model) ?? "?"} → ${nuevo ?? "?"}` });
    } else if (evento === "PreModelSwitch") {
      const config = readProjectConfig(root);
      const nuevo = nombreDeModelo(payload?.to_model);
      const tocados = archivosTocados(root, String(sesion ?? ""), archivosCambiados(root));
      const motivo = nuevo ? revisarCambio({ nuevo, tocados, config, orquestacion: leerOrquestacion(root, config) }) : null;
      if (motivo) {
        log(root, { evento: "pregunta", agente: "claude", sesion, regla: "modelo-por-riesgo", detalle: `cambio a ${nuevo}` });
        process.stdout.write(JSON.stringify({
          hookSpecificOutput: { hookEventName: "PreModelSwitch", permissionDecision: "ask", permissionDecisionReason: `Harness (modelo-por-riesgo): ${motivo}` },
        }));
      }
    }
  } catch {
    // Llevar la cuenta del modelo nunca impide trabajar.
  }
  process.exit(0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
