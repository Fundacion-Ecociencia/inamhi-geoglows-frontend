// Lo que el harness sabe del proyecto: qué es producción, qué rutas son de
// riesgo y qué modelo y esfuerzo pide cada nivel. Todo sale de
// `.harness/proyecto.json` (del proyecto) y `.harness/orquestacion.json`
// (del harness); aquí no hay nombres de servidores ni de tablas.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));

/** «a{b,c}d» → ["abd", "acd"]. */
function expandirLlaves(patron) {
  const m = patron.match(/\{([^{}]*)\}/);
  if (!m) return [patron];
  return m[1].split(",").flatMap((op) => expandirLlaves(patron.replace(m[0], op)));
}

/** Patrón con * y ** → expresión regular sobre rutas con /. */
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

/** Si [ruta] cae en alguno de [patrones]: carpeta, archivo exacto o patrón. */
export function coincide(ruta, patrones) {
  return (patrones ?? []).some((p) => {
    if (/[*?{]/.test(p)) return globARegex(p.includes("/") ? p : `**/${p}`).test(ruta);
    const base = p.replace(/\/+$/, "");
    return ruta === base || ruta.startsWith(`${base}/`);
  });
}

export const NIVELES = ["bajo", "medio", "alto"];

/**
 * Nivel de riesgo de una ruta: «alto» si cae en `riesgo.alto`, «bajo» si cae
 * en `riesgo.bajo`, «medio» en cualquier otro caso. Alto gana sobre bajo: una
 * prueba dentro de una carpeta de riesgo alto sigue siendo de riesgo alto solo
 * si el patrón alto la nombra.
 */
export function nivelDeRuta(ruta, config) {
  const r = config?.riesgo ?? {};
  if (coincide(ruta, r.alto)) return "alto";
  if (coincide(ruta, r.bajo)) return "bajo";
  return "medio";
}

/** El nivel más alto entre [rutas]; sin rutas, null. */
export function nivelDeCambio(rutas, config) {
  let max = -1;
  for (const ruta of rutas) max = Math.max(max, NIVELES.indexOf(nivelDeRuta(ruta, config)));
  return max === -1 ? null : NIVELES[max];
}

const ORQUESTACION_MINIMA = {
  rangos: { haiku: 1, sonnet: 2, opus: 3, fable: 4, mythos: 4 },
  esfuerzos: { low: 1, medium: 2, high: 3, xhigh: 4, max: 5 },
  niveles: {
    bajo: { modelo: "sonnet", esfuerzo: "medium", modeloMinimo: "haiku", esfuerzoMinimo: "low" },
    medio: { modelo: "opus", esfuerzo: "high", modeloMinimo: "sonnet", esfuerzoMinimo: "medium" },
    alto: { modelo: "opus", esfuerzo: "xhigh", modeloMinimo: "opus", esfuerzoMinimo: "high" },
  },
};

/** La tabla de modelos: la del harness, con lo que el proyecto cambie encima. */
export function leerOrquestacion(root, config = {}) {
  let base = ORQUESTACION_MINIMA;
  for (const ruta of [join(root ?? "", ".harness", "orquestacion.json"), join(AQUI, "..", "config", "orquestacion.json"), join(AQUI, "..", "orquestacion.json")]) {
    try {
      base = JSON.parse(readFileSync(ruta, "utf8"));
      break;
    } catch {
      // Prueba la siguiente.
    }
  }
  const propio = config?.orquestacion ?? {};
  const niveles = {};
  for (const n of NIVELES) niveles[n] = { ...ORQUESTACION_MINIMA.niveles[n], ...(base.niveles?.[n] ?? {}), ...(propio.niveles?.[n] ?? {}) };
  return {
    ...base,
    ...propio,
    rangos: { ...ORQUESTACION_MINIMA.rangos, ...(base.rangos ?? {}), ...(propio.rangos ?? {}) },
    esfuerzos: { ...ORQUESTACION_MINIMA.esfuerzos, ...(base.esfuerzos ?? {}), ...(propio.esfuerzos ?? {}) },
    niveles,
  };
}

/** «claude-opus-5-5», «opus[1m]», «Opus 5.5» → «opus». Lo que no se reconoce, null. */
export function familia(modelo, rangos = ORQUESTACION_MINIMA.rangos) {
  const texto = String(modelo ?? "").toLowerCase();
  // El nombre más largo primero: «opusplan» no es una familia, «opus» sí.
  for (const nombre of Object.keys(rangos).sort((a, b) => b.length - a.length)) {
    if (texto.includes(nombre)) return nombre;
  }
  return null;
}

/**
 * ¿El modelo de la sesión alcanza para ese nivel? Un modelo que no se
 * reconoce no se juzga (true): la regla no puede bloquear a quien usa un
 * modelo nuevo que el harness todavía no conoce.
 */
export function modeloAlcanza(modelo, nivel, orquestacion) {
  const f = familia(modelo, orquestacion.rangos);
  const minimo = orquestacion.niveles?.[nivel]?.modeloMinimo;
  if (!f || !minimo || !orquestacion.rangos[minimo]) return true;
  return orquestacion.rangos[f] >= orquestacion.rangos[minimo];
}

/** ¿El esfuerzo de la sesión alcanza para ese nivel? Uno que no se reconoce no se juzga. */
export function esfuerzoAlcanza(esfuerzo, nivel, orquestacion) {
  const tiene = orquestacion.esfuerzos?.[String(esfuerzo ?? "").toLowerCase()];
  const pide = orquestacion.esfuerzos?.[orquestacion.niveles?.[nivel]?.esfuerzoMinimo];
  if (!tiene || !pide) return true;
  return tiene >= pide;
}

/** ¿[host] (con o sin usuario@) es uno de los servidores de producción? */
export function esProduccion(host, config) {
  const limpio = String(host ?? "").replace(/^[^@]*@/, "").replace(/:.*$/, "").toLowerCase();
  if (!limpio) return false;
  return (config?.produccion?.hosts ?? []).some((h) => {
    const patron = String(h).toLowerCase();
    return patron.includes("*") ? globARegex(patron).test(limpio) : patron === limpio;
  });
}
