#!/usr/bin/env node
// Al empezar, reanudar o compactar una sesión (SessionStart): le recuerda al
// agente los planes activos del repo y el siguiente paso de cada uno (lo que
// imprime entra a su contexto), y guarda la foto de los cambios sin commit con
// que empezó la sesión.

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { projectDir, readPayload, readProjectConfig } from "./comun.mjs";
import { leerOrquestacion } from "./proyecto.mjs";
import { guardarInicio } from "./sesion.mjs";
import { archivosCambiados } from "../bin/verificar.mjs";

export const CARPETA_PLANES = join("docs", "planes", "activos");
const MAX_PLANES = 5;

/** Título, pasos hechos, total y el siguiente paso de un plan en markdown. */
export function leerPlan(texto) {
  const titulo = texto.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "(sin título)";
  const pasos = [...texto.matchAll(/^\s*[-*]\s+\[( |x|X)\]\s+(.+)$/gm)];
  const hechos = pasos.filter((m) => m[1] !== " ").length;
  const siguiente = pasos.find((m) => m[1] === " ")?.[2]?.trim() ?? null;
  return { titulo, hechos, total: pasos.length, siguiente };
}

/** La tabla de riesgo → modelo y esfuerzo del proyecto, en pocas líneas. */
export function resumenDeOrquestacion(root) {
  const config = readProjectConfig(root);
  if (!config.riesgo) return "";
  const t = leerOrquestacion(root, config).niveles;
  const fila = (n) => `${n}: ${t[n].modelo}, esfuerzo ${t[n].esfuerzo}`;
  return [
    `Este proyecto clasifica cada cambio por el riesgo de las rutas que toca (${fila("bajo")}; ${fila("medio")}; ${fila("alto")}).`,
    "`node .harness/bin/riesgo.mjs` dice el nivel del cambio en curso y lo que ese nivel exige (plan, pruebas, revisor). El detalle está en .harness/instrucciones/orquestacion.md.",
  ].join("\n");
}

export function contexto(root) {
  return [resumenDeOrquestacion(root), planes(root)].filter(Boolean).join("\n\n");
}

export function planes(root) {
  let archivos = [];
  try {
    archivos = readdirSync(join(root, CARPETA_PLANES)).filter((f) => f.endsWith(".md")).sort();
  } catch {
    return "";
  }
  if (!archivos.length) return "";
  const L = [`Planes activos en ${CARPETA_PLANES}/ (léelos antes de seguir con esa tarea):`];
  for (const archivo of archivos.slice(0, MAX_PLANES)) {
    let plan;
    try {
      plan = leerPlan(readFileSync(join(root, CARPETA_PLANES, archivo), "utf8"));
    } catch {
      continue;
    }
    const avance = plan.total ? ` (${plan.hechos} de ${plan.total} pasos hechos)` : "";
    L.push(`- ${archivo}: ${plan.titulo}${avance}${plan.siguiente ? `. Siguiente paso: ${plan.siguiente}` : ". Todos los pasos marcados: verifica y muévelo a docs/planes/terminados/."}`);
  }
  if (archivos.length > MAX_PLANES) L.push(`- y ${archivos.length - MAX_PLANES} más.`);
  L.push("Un paso a la vez: se marca hecho solo después de verificarlo (skill `verify`), y lo que se decida se anota en el plan.");
  return L.join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const payload = readPayload();
  const root = projectDir(payload);
  try {
    // La foto de los cambios al empezar: el hook de fin de turno solo exige
    // verificar lo que esta sesión toque después.
    const sesion = payload?.session_id ?? payload?.sessionId;
    if (sesion) guardarInicio(root, String(sesion), archivosCambiados(root));
  } catch {
    // Sin foto, el fin de turno mira todos los cambios.
  }
  try {
    const texto = contexto(root);
    if (texto) process.stdout.write(`${texto}\n`);
  } catch {
    // Nunca impide empezar la sesión.
  }
  process.exit(0);
}
