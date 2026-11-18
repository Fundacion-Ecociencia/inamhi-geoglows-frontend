#!/usr/bin/env node
// Nivel de riesgo del cambio en curso y lo que ese nivel exige.
//
//   node .harness/bin/riesgo.mjs [--base origin/main] [--json] [ruta…]
//
// Sin rutas, mira los archivos cambiados (sin commit y, con --base, lo que va
// de esa rama a HEAD). El nivel del cambio es el de su ruta más riesgosa.

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { leerOrquestacion, nivelDeCambio, nivelDeRuta, NIVELES } from "../hooks/proyecto.mjs";
import { archivosCambiados, leerProyecto } from "./verificar.mjs";

export function informe(rutas, config, orquestacion) {
  const porNivel = Object.fromEntries(NIVELES.map((n) => [n, []]));
  for (const ruta of rutas) porNivel[nivelDeRuta(ruta, config)].push(ruta);
  const nivel = nivelDeCambio(rutas, config);
  return { nivel, exige: nivel ? orquestacion.niveles[nivel] : null, rutas: porNivel };
}

export function texto(r) {
  if (!r.nivel) return "No hay archivos cambiados: nada que clasificar.";
  const L = [`Riesgo del cambio: ${r.nivel.toUpperCase()}`];
  for (const n of [...NIVELES].reverse()) {
    if (r.rutas[n].length) L.push(`  ${n}: ${r.rutas[n].slice(0, 8).join(", ")}${r.rutas[n].length > 8 ? ` y ${r.rutas[n].length - 8} más` : ""}`);
  }
  const e = r.exige;
  L.push("", "Lo que este nivel exige:",
    `  Modelo: ${e.modelo} (mínimo ${e.modeloMinimo}) · Esfuerzo: ${e.esfuerzo}`,
    `  Plan: ${e.plan}`,
    `  Pruebas: ${e.pruebas}`,
    `  Revisión: ${e.revisor}`);
  return L.join("\n");
}

function main() {
  const argv = process.argv.slice(2);
  let base = null;
  let json = false;
  const rutas = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--base") base = argv[++i];
    else if (argv[i] === "--json") json = true;
    else rutas.push(argv[i]);
  }
  let raiz = process.cwd();
  try {
    raiz = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    // Sin git, la carpeta actual.
  }
  const config = leerProyecto(raiz);
  let cambios = rutas;
  if (!cambios.length) {
    try {
      cambios = archivosCambiados(raiz, { base });
    } catch (e) {
      process.stderr.write(`No pude revisar los cambios: ${e?.message ?? e}\n`);
      process.exit(2);
    }
  }
  const r = informe(cambios, config, leerOrquestacion(raiz, config));
  process.stdout.write(`${json ? JSON.stringify(r, null, 2) : texto(r)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
