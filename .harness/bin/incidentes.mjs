#!/usr/bin/env node
// Corre los casos de incidentes contra las guardias, con la configuración del
// proyecto. Cada caso es un comando o una edición que alguna vez causó un
// problema (o la forma correcta de hacer lo mismo) y la decisión que se espera.
//
//   node .harness/bin/incidentes.mjs [--json]
//
// Lee .harness/incidentes/casos.json (del harness) y, si existe,
// docs/lecciones.casos.json (del proyecto). Sale con 1 si algún caso no da lo
// esperado.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluate } from "../hooks/guardia-bash.mjs";
import { check } from "../hooks/guardia-archivos.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));

/** El caso con sus marcadores reemplazados, o null si al proyecto le falta ese dato. */
export function preparar(caso, config) {
  const p = config?.produccion ?? {};
  const valores = {
    "{PROD}": (p.hosts ?? []).find((h) => !h.includes("*")),
    "{REMOTO}": (p.remotos ?? [])[0],
    "{TABLA}": (p.tablasGrandes ?? [])[0],
    "{TERCEROS}": (p.rutasDeTerceros ?? [])[0],
    // Inventada aquí para que ningún archivo del harness lleve algo con forma de secreto.
    "{CLAVE}": ["Zx81", "kq77", "Lm"].join(""),
  };
  if (caso.soloPublico && config?.publico !== true) return null;
  const out = { ...caso };
  for (const campo of ["comando", "ruta", "texto"]) {
    if (typeof out[campo] !== "string") continue;
    for (const [marca, valor] of Object.entries(valores)) {
      if (!out[campo].includes(marca)) continue;
      if (!valor) return null;
      out[campo] = out[campo].split(marca).join(valor);
    }
  }
  return out;
}

export function correr(casos, config, root) {
  const resultados = [];
  for (const original of casos) {
    const caso = preparar(original, config);
    if (!caso) {
      resultados.push({ id: original.id, saltado: true });
      continue;
    }
    const v = caso.tipo === "archivo"
      ? check({ path: caso.ruta, text: caso.texto, kind: "Write" }, root, { config })
      : evaluate(caso.comando, { config, root, branch: "fix/caso" });
    const decision = v?.decision ?? "pasa";
    const ok = decision === caso.espera && (!caso.regla || v?.rule === caso.regla);
    resultados.push({ id: caso.id, ok, espera: `${caso.espera}${caso.regla ? `:${caso.regla}` : ""}`, obtuvo: `${decision}${v?.rule ? `:${v.rule}` : ""}`, origen: caso.origen });
  }
  return resultados;
}

export function leerCasos(root) {
  const rutas = [join(root, ".harness", "incidentes", "casos.json"), join(AQUI, "..", "incidentes", "casos.json"), join(root, "docs", "lecciones.casos.json")];
  const vistos = new Set();
  const casos = [];
  for (const ruta of rutas) {
    if (!existsSync(ruta)) continue;
    for (const caso of JSON.parse(readFileSync(ruta, "utf8")).casos ?? []) {
      if (vistos.has(caso.id)) continue;
      vistos.add(caso.id);
      casos.push(caso);
    }
  }
  return casos;
}

function main() {
  let root = process.cwd();
  try {
    root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    // La carpeta actual.
  }
  let config = {};
  try {
    config = JSON.parse(readFileSync(join(root, ".harness", "proyecto.json"), "utf8"));
  } catch {
    // Sin configuración: los casos que la necesitan se saltan.
  }
  const r = correr(leerCasos(root), config, root);
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
  } else {
    for (const x of r) {
      if (x.saltado) process.stdout.write(`  –     ${x.id} (no aplica a este proyecto)\n`);
      else process.stdout.write(`  ${x.ok ? "OK   " : "FALLA"} ${x.id}${x.ok ? "" : ` — esperaba ${x.espera}, obtuvo ${x.obtuvo}`}\n`);
    }
    const fallas = r.filter((x) => x.ok === false).length;
    const corridos = r.filter((x) => !x.saltado).length;
    process.stdout.write(`\n${corridos} casos, ${fallas} fallas, ${r.length - corridos} saltados.\n`);
  }
  process.exit(r.some((x) => x.ok === false) ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
