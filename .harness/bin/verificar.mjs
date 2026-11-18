#!/usr/bin/env node
// Corre las verificaciones del proyecto que aplican a lo que cambió.
//
//   node .harness/bin/verificar.mjs [--rapido] [--todo] [--base <ref>] [--json]
//
// Las verificaciones se declaran en `.harness/proyecto.json` (las pone el
// instalador con --verificar):
//
//   "verificar": [
//     { "nombre": "API", "cuando": ["api/", "test/api/"], "correr": "npm run test:api" },
//     { "nombre": "Tipos", "cuando": ["*.ts"], "correr": "npx tsc --noEmit", "rapido": true }
//   ]
//
// `cuando` acepta carpetas («api/» o «api»), archivos («pubspec.yaml») y
// patrones con * y ** (y llaves: «*.{ts,tsx}»). Sin `cuando`, la verificación
// aplica a cualquier cambio. Con --rapido corre solo las rápidas (las que usa
// el hook de fin de turno). Con --todo corre todas aunque no haya cambios.
// Termina con 0 si todo pasó o nada aplicaba, 1 si algo falló, 2 si no pudo
// revisar (git falló, la base no existe) y 3 si el proyecto no declaró
// verificaciones.

import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluate } from "../hooks/guardia-bash.mjs";

export const SIN_CONFIGURAR = 3;
export const NO_SE_PUDO = 2;
const MAX_LINEAS_ERROR = 30;
const MINUTOS_DEFECTO = 15;
/** Tope de cada verificación rápida: el hook de fin de turno no puede tardar más que su propio límite. */
export const MINUTOS_MAX_RAPIDA = 4;
const GRACIA_MS = 5_000;

/** «a{b,c}d» → ["abd", "acd"]; sin llaves, el mismo patrón. */
function expandirLlaves(patron) {
  const m = patron.match(/\{([^{}]*)\}/);
  if (!m) return [patron];
  return m[1].split(",").flatMap((op) => expandirLlaves(patron.replace(m[0], op)));
}

// Un patrón con * o ? → expresión regular sobre rutas con /. Un * no cruza
// carpetas; ** sí, y seguido de barra también acepta «ninguna carpeta».
export function globARegex(glob) {
  const partes = expandirLlaves(glob).map((g) => {
    let re = "";
    for (let i = 0; i < g.length; i += 1) {
      const c = g[i];
      if (c === "*") {
        if (g[i + 1] === "*") {
          const barra = g[i + 2] === "/";
          re += barra ? "(?:.*/)?" : ".*";
          i += barra ? 2 : 1;
        } else {
          re += "[^/]*";
        }
      } else if (c === "?") {
        re += "[^/]";
      } else {
        re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
      }
    }
    return re;
  });
  return new RegExp(`^(?:${partes.join("|")})$`);
}

/** Si [ruta] cae en alguno de [patrones]: carpeta, archivo exacto o patrón con comodines. */
export function coincide(ruta, patrones) {
  return patrones.some((p) => {
    if (/[*?{]/.test(p)) {
      // «*.ts» sin carpeta vale para cualquier carpeta, como en .gitignore.
      const patron = p.includes("/") ? p : `**/${p}`;
      return globARegex(patron).test(ruta);
    }
    const base = p.replace(/\/+$/, "");
    return ruta === base || ruta.startsWith(`${base}/`);
  });
}

/** Las verificaciones válidas de proyecto.json, con los valores por defecto. */
export function leerVerificaciones(proyecto) {
  const lista = Array.isArray(proyecto?.verificar) ? proyecto.verificar : [];
  return lista
    .filter((v) => v && typeof v.correr === "string" && v.correr.trim())
    .map((v, i) => ({
      nombre: typeof v.nombre === "string" && v.nombre.trim() ? v.nombre.trim() : `verificación ${i + 1}`,
      cuando: Array.isArray(v.cuando) ? v.cuando.filter((g) => typeof g === "string" && g) : [],
      correr: v.correr.trim(),
      rapido: v.rapido === true,
      minutos: Number.isFinite(v.minutos) && v.minutos > 0 ? v.minutos : MINUTOS_DEFECTO,
    }));
}

/** Qué verificaciones corren para [cambios]. */
export function elegir(verificaciones, cambios, { rapido = false, todo = false } = {}) {
  return verificaciones.filter((v) => {
    if (rapido && !v.rapido) return false;
    if (todo) return true;
    if (!cambios.length) return false;
    return v.cuando.length === 0 || cambios.some((ruta) => coincide(ruta, v.cuando));
  });
}

export class ErrorDeGit extends Error {}

function git(raiz, args) {
  try {
    return execFileSync("git", ["-c", "core.quotePath=false", ...args], {
      cwd: raiz, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 256 * 1024 * 1024,
    });
  } catch (e) {
    throw new ErrorDeGit(`git ${args.join(" ")} falló: ${String(e?.stderr || e?.message || e).trim().split("\n")[0]}`);
  }
}

/**
 * Archivos cambiados: sin commit (con y sin stage) y nuevos; con [base],
 * también lo que va de base a HEAD. Un renombre cuenta por las dos rutas.
 * Si git falla, lanza ErrorDeGit: un «sin cambios» falso daría un verde falso.
 */
export function archivosCambiados(raiz, { base = null } = {}) {
  if (base) git(raiz, ["rev-parse", "--verify", "--quiet", `${base}^{commit}`]);
  const tieneHead = (() => {
    try {
      git(raiz, ["rev-parse", "--verify", "--quiet", "HEAD"]);
      return true;
    } catch {
      return false;
    }
  })();
  const salidas = [
    tieneHead ? git(raiz, ["diff", "--name-only", "--no-renames", "-z", "HEAD"]) : "",
    git(raiz, ["diff", "--name-only", "--no-renames", "-z", "--cached"]),
    git(raiz, ["ls-files", "--others", "--exclude-standard", "-z"]),
    base ? git(raiz, ["diff", "--name-only", "--no-renames", "-z", `${base}...HEAD`]) : "",
  ];
  // Lo que escribe el propio harness (bitácora, estado, reportes) no es un cambio del proyecto.
  const rutas = salidas.join("\0").split("\0").filter((r) => r && !r.startsWith(".harness/"));
  return [...new Set(rutas)].sort();
}

/**
 * Huella de los archivos cambiados (ruta, tamaño y fecha de modificación) y de
 * las verificaciones declaradas: cambia si alguien toca un archivo o la lista.
 */
export function huella(raiz, cambios, verificaciones = []) {
  const h = createHash("sha256");
  h.update(JSON.stringify(verificaciones.map((v) => [v.nombre, v.cuando, v.correr, v.rapido])));
  for (const ruta of cambios) {
    h.update(`\0${ruta}\0`);
    try {
      const st = statSync(join(raiz, ruta));
      h.update(`${st.size}:${st.mtimeMs}`);
    } catch {
      h.update("borrado");
    }
  }
  return h.digest("hex").slice(0, 16);
}

export function leerProyecto(raiz) {
  try {
    return JSON.parse(readFileSync(join(raiz, ".harness", "proyecto.json"), "utf8"));
  } catch {
    return {};
  }
}

const RUTA_ESTADO = [".harness", "estado", "verificacion.json"];

export function leerEstado(raiz) {
  try {
    return JSON.parse(readFileSync(join(raiz, ...RUTA_ESTADO), "utf8"));
  } catch {
    return {};
  }
}

export function guardarEstado(raiz, estado) {
  const ruta = join(raiz, ...RUTA_ESTADO);
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, `${JSON.stringify(estado, null, 2)}\n`);
}

const SENAL_DE_FALLA = /\bFALLA\b|\bFAIL(ED)?\b|Traceback|\bError\b|error:|Address already in use|✗/;

/**
 * Lo que se muestra de una verificación roja: las líneas que nombran la falla
 * (con las dos que siguen) y el final de la salida. Un arnés largo falla a
 * veces en un caso del principio, que el final solo no alcanza a mostrar.
 */
export function resumirError(salida, { maxFallas = 8 } = {}) {
  const lineas = salida.trimEnd().split("\n");
  const cola = lineas.slice(-MAX_LINEAS_ERROR);
  const antes = lineas.slice(0, Math.max(0, lineas.length - MAX_LINEAS_ERROR));
  const marcadas = [];
  for (let i = 0; i < antes.length && marcadas.length < maxFallas; i += 1) {
    if (SENAL_DE_FALLA.test(antes[i])) marcadas.push(antes.slice(i, i + 3).join("\n"));
  }
  if (!marcadas.length) return cola.join("\n");
  return [`Líneas que nombran la falla (${marcadas.length}):`, ...marcadas, "[…]", "Final de la salida:", ...cola].join("\n");
}

/** Mata el comando y todo lo que lanzó (su grupo de procesos). */
function matarGrupo(hijo, senal) {
  try {
    process.kill(-hijo.pid, senal);
  } catch {
    try {
      hijo.kill(senal);
    } catch {
      // Ya terminó.
    }
  }
}

/**
 * Corre una verificación. El comando recibe en `HARNESS_LISTA` la ruta de un
 * archivo con los archivos cambiados que le tocan (uno por línea): los mismos
 * que eligió el verificador, estén sin guardar, en el índice o ya en commits
 * de la rama. Un comando que los busca por su cuenta con `git ls-files -m`
 * no ve los que ya están en un commit, y en el CI no revisaría nada.
 */
export function correrUna(raiz, v, { minutosMax = Infinity, archivos = [] } = {}) {
  // Un comando que la guardia del harness no dejaría correr tampoco corre aquí.
  const veredicto = evaluate(v.correr, { root: raiz, config: leerProyecto(raiz) });
  if (veredicto) {
    return Promise.resolve({
      nombre: v.nombre, correr: v.correr, ok: false, segundos: 0,
      final: `La guardia del harness no deja correr este comando (${veredicto.rule}): ${veredicto.reason}`,
    });
  }
  const minutos = Math.min(v.minutos, minutosMax);
  const propios = v.cuando?.length ? archivos.filter((ruta) => coincide(ruta, v.cuando)) : archivos;
  const carpeta = mkdtempSync(join(tmpdir(), "harness-lista-"));
  const lista = join(carpeta, "archivos.txt");
  writeFileSync(lista, propios.length ? `${propios.join("\n")}\n` : "");
  return new Promise((listo) => {
    const inicio = Date.now();
    let salida = "";
    let terminado = false;
    let motivo = null;
    const hijo = spawn("sh", ["-c", v.correr], {
      cwd: raiz, detached: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, CI: process.env.CI ?? "1", HARNESS_LISTA: lista },
    });
    const guardar = (d) => {
      salida += d.toString();
      if (salida.length > 2_000_000) salida = salida.slice(-1_000_000);
    };
    hijo.stdout.on("data", guardar);
    hijo.stderr.on("data", guardar);
    const fin = (codigo) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(reloj);
      matarGrupo(hijo, "SIGKILL"); // Nada de lo que lanzó queda vivo.
      rmSync(carpeta, { recursive: true, force: true });
      const ok = codigo === 0 && !motivo;
      listo({
        nombre: v.nombre,
        correr: v.correr,
        ok,
        segundos: Math.round((Date.now() - inicio) / 1000),
        ...(motivo ? { motivo } : {}),
        ...(ok ? {} : { final: resumirError(salida) }),
      });
    };
    const reloj = setTimeout(() => {
      motivo = `se detuvo después de ${minutos} min`;
      matarGrupo(hijo, "SIGTERM");
      setTimeout(() => fin(null), GRACIA_MS);
    }, minutos * 60_000);
    // Al salir el comando, se espera poco a que cierren sus salidas: un
    // proceso que quedó vivo no deja la verificación colgada.
    hijo.on("exit", (codigo) => setTimeout(() => fin(codigo), 2_000));
    hijo.on("close", (codigo) => fin(codigo));
    hijo.on("error", (e) => {
      salida += String(e?.message ?? e);
      fin(null);
    });
  });
}

/**
 * Corre lo que aplica y devuelve el resultado, sin imprimir. Con [archivos],
 * solo cuentan esos (el hook de fin de turno pasa los que tocó la sesión).
 */
export async function verificar(raiz, { rapido = false, todo = false, base = null, archivos = null } = {}) {
  const verificaciones = leerVerificaciones(leerProyecto(raiz));
  const todosLosCambios = archivosCambiados(raiz, { base });
  const cambios = archivos ?? todosLosCambios;
  if (!verificaciones.length) return { configurado: false, cambios, resultados: [], ok: true };
  const elegidas = elegir(verificaciones, cambios, { rapido, todo });
  const resultados = [];
  // Una a la vez: dos suites a la vez pelean por los mismos puertos y emuladores.
  for (const v of elegidas) resultados.push(await correrUna(raiz, v, { minutosMax: rapido ? MINUTOS_MAX_RAPIDA : Infinity, archivos: cambios }));
  const ok = resultados.every((r) => r.ok);
  const marca = huella(raiz, todosLosCambios, verificaciones);
  if (ok && !archivos) {
    guardarEstado(raiz, { ...leerEstado(raiz), [rapido ? "rapido" : "completo"]: { huella: marca, fecha: new Date().toISOString() } });
  }
  return { configurado: true, cambios, resultados, ok, huella: marca };
}

export function resumen(r, { rapido = false } = {}) {
  if (!r.configurado) {
    return "Este proyecto no declaró verificaciones en .harness/proyecto.json (el instalador las agrega con --verificar). "
      + "Mientras tanto, corre los comandos de la sección «Comandos» de AGENTS.md que correspondan a lo que cambiaste.";
  }
  if (!r.resultados.length) {
    return r.cambios.length
      ? `Ninguna verificación${rapido ? " rápida" : ""} aplica a los ${r.cambios.length} archivos cambiados.`
      : "No hay cambios sin commit: nada que verificar.";
  }
  const L = [];
  for (const x of r.resultados) {
    L.push(`${x.ok ? "✓" : "✗"} ${x.nombre} (${x.segundos} s)${x.ok ? "" : ` — falló: \`${x.correr}\`${x.motivo ? `, ${x.motivo}` : ""}`}`);
    if (!x.ok && x.final) L.push(x.final.split("\n").map((l) => `    ${l}`).join("\n"));
  }
  L.push(r.ok ? "Verificación en verde." : "Verificación en rojo: arregla lo que falló y vuelve a correrla. No hagas commit así.");
  return L.join("\n");
}

function parsearArgs(argv) {
  const o = { rapido: false, todo: false, base: null, json: false, raiz: process.cwd() };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--rapido") o.rapido = true;
    else if (a === "--todo") o.todo = true;
    else if (a === "--json") o.json = true;
    else if (a === "--base") o.base = argv[++i];
    else if (a === "--raiz") o.raiz = resolve(argv[++i]);
  }
  return o;
}

async function main() {
  const o = parsearArgs(process.argv.slice(2));
  let raiz = o.raiz;
  try {
    raiz = git(raiz, ["rev-parse", "--show-toplevel"]).trim() || raiz;
  } catch {
    // Sin git: se queda la carpeta dada y se avisa abajo.
  }
  if (!existsSync(join(raiz, ".harness"))) {
    process.stderr.write("No encuentro .harness/: corre esto en la raíz de un proyecto con el harness.\n");
    process.exit(NO_SE_PUDO);
  }
  let r;
  try {
    r = await verificar(raiz, o);
  } catch (e) {
    const texto = e instanceof ErrorDeGit && o.base
      ? `No pude revisar los cambios desde «${o.base}»: ¿existe esa rama o ese commit? (${e.message})`
      : `No pude revisar los cambios: ${e?.message ?? e}`;
    process.stderr.write(`${texto}\n`);
    process.exit(NO_SE_PUDO);
  }
  process.stdout.write(`${o.json ? JSON.stringify(r, null, 2) : resumen(r, o)}\n`);
  process.exit(!r.configurado ? SIN_CONFIGURAR : r.ok ? 0 : 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
