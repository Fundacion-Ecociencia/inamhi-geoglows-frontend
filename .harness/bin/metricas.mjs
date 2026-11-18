#!/usr/bin/env node
/**
 * metricas.mjs — Informe de resultados de los agentes: cómo sale el trabajo,
 * medido con git y con la bitácora. La percepción («vamos más rápido») no es
 * una métrica: METR midió desarrolladores que se creían 20 % más rápidos con IA
 * y eran 19 % más lentos. Por eso aquí solo se cuentan resultados.
 *
 * Node >= 20, sin dependencias de npm (solo módulos node:). No escribe nada.
 * Uso: node .harness/bin/metricas.mjs [ruta-del-proyecto] [--dias 30] [--json]
 *
 * De git (rama actual, últimos N días por fecha del commit, sin merges):
 *   - commits totales y commits con un agente (línea Co-Authored-By que nombra
 *     a Claude, Codex, Gemini, Copilot o Cursor)
 *   - reverts: el mensaje empieza con «Revert» o el tipo es «revert»
 *   - retrabajo: arreglos (fix) que tocan un archivo que otro commit ya había
 *     cambiado en los 14 días anteriores a ese arreglo (DIAS_RETRABAJO)
 *   - tamaño: mediana y percentil 90 de líneas cambiadas por commit
 *   - commits por tipo
 * De la bitácora (.harness/bitacora/*.jsonl), si existe:
 *   - sesiones por agente, usos de herramientas y bloqueos de las guardias
 *
 * Las funciones puras se exportan para las pruebas (metricas.test.mjs).
 * main() solo corre cuando el archivo se ejecuta directamente.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

export const VERSION_INFORME = 1;
export const DIAS_DEFECTO = 30;
const DIAS_MAXIMO = 3650;
const DIA_MS = 86_400_000;
const ZONA = 'America/Guayaquil';
const MAX_SALIDA_GIT = 256 * 1024 * 1024;

/** Agentes que se reconocen en las líneas Co-Authored-By, sin distinguir mayúsculas. */
export const AGENTES = ['claude', 'codex', 'gemini', 'copilot', 'cursor'];

/** Tipos de commit que se cuentan por separado; el resto va a «otros». */
export const TIPOS = ['feat', 'fix', 'refactor', 'test', 'docs', 'chore', 'perf', 'style'];

/** Archivos que escribe un gestor de paquetes: no los escribe ni los revisa nadie. */
export const LOCKFILES = new Set([
  'package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lock', 'bun.lockb',
  'pubspec.lock', 'Podfile.lock', 'Gemfile.lock', 'Cargo.lock', 'composer.lock', 'poetry.lock',
  'Pipfile.lock', 'go.sum', 'Package.resolved',
]);

/** Código de Dart que produce un generador (mismos sufijos que las guardias). */
const GENERADO_DART = /\.(g|freezed|gr|mocks|pb|pbenum|pbjson|pbserver)\.dart$/;

/** Carpetas de salida de una compilación. */
const CARPETAS_COMPILADAS = new Set(['dist', 'build']);

/**
 * Umbrales fijos de la lectura. Son los únicos juicios que hace el informe;
 * cambiarlos cambia lo que se le dice al dueño, así que se anota en el CHANGELOG.
 */
/**
 * Ventana del retrabajo: un arreglo cuenta como retrabajo si toca un archivo
 * cambiado en las dos semanas anteriores (la «rotación» que mide GitClear).
 * Con una ventana tan larga como el periodo, casi todo arreglo de un proyecto
 * activo saldría como retrabajo.
 */
export const DIAS_RETRABAJO = 14;

export const UMBRALES = {
  /** Con menos commits que estos, los porcentajes dicen poco y la lectura lo advierte. */
  minCommits: 10,
  /** Reverts sobre el total de commits. Desde 5 %, algo se está entregando sin probar. */
  revertsAlto: 0.05,
  /** Retrabajo sobre el total de commits. Desde 20 % es alto; hasta 10 %, bajo. */
  retrabajoAlto: 0.2,
  retrabajoBajo: 0.1,
  /**
   * Líneas cambiadas por commit. Pasadas las 400 líneas, una revisión deja de
   * encontrar errores (estudio de SmartBear en Cisco); hasta 200 se revisa bien.
   */
  medianaGrande: 400,
  medianaPequena: 200,
  /** Percentil 90 (el 10 % de commits más grandes). Desde 1000 líneas, conviene partirlos. */
  p90Grande: 1000,
  /** Bloqueos y pedidos de aprobación por sesión. Desde 0,5, los agentes chocan seguido con las guardias. */
  guardiasPorSesion: 0.5,
};

/** Cuántas frases de lectura lleva el resumen. */
const MAX_LECTURAS = 3;
const MAX_ARCHIVOS_RETRABAJO = 5;

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

export class ErrorUso extends Error {}

/** «1 commit», «3 commits». */
export function plural(n, uno, varios) {
  return `${n} ${n === 1 ? uno : varios}`;
}

/** 0.27 → «27 %»; un valor positivo muy chico no se redondea a cero. */
export function porcentaje(x) {
  if (x == null || !Number.isFinite(x)) return '—';
  if (x > 0 && x < 0.005) return 'menos de 1 %';
  return `${Math.round(x * 100)} %`;
}

/** Fracción a «1 de cada 4» o «7 de cada 10». `singular` dice cómo concuerda el verbo. */
export function deCada(parte, total) {
  if (!total || !parte) return null;
  const r = parte / total;
  if (r >= 1) return { texto: 'todos los', singular: false };
  if (r <= 0.5) {
    const n = Math.round(total / parte);
    return { texto: `1 de cada ${n}`, singular: true };
  }
  const x = Math.min(9, Math.round(r * 10));
  return { texto: `${x} de cada 10`, singular: false };
}

/** Fecha AAAA-MM-DD en la hora de Ecuador. */
export function diaEcuador(fecha) {
  return new Date(fecha).toLocaleDateString('en-CA', { timeZone: ZONA });
}

/** Mediana de una lista de números (promedio de los dos del medio si son pares), redondeada. */
export function mediana(valores) {
  if (!valores.length) return null;
  const v = [...valores].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2);
}

/** Percentil por rango más cercano: el menor valor que deja al menos p de la lista por debajo o igual. */
export function percentil(valores, p) {
  if (!valores.length) return null;
  const v = [...valores].sort((a, b) => a - b);
  const i = Math.min(v.length - 1, Math.max(0, Math.ceil(p * v.length) - 1));
  return v[i];
}

function contar(mapa, clave, n = 1) {
  mapa.set(clave, (mapa.get(clave) ?? 0) + n);
}

/** Entradas de un Map ordenadas de mayor a menor (empates por nombre). */
function ordenado(mapa) {
  return [...mapa.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

function nombreAgente(id) {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

// ---------------------------------------------------------------------------
// Commits: lectura y clasificación
// ---------------------------------------------------------------------------

/** Los agentes que firman el commit en sus líneas Co-Authored-By. */
export function agentesDelCommit(cuerpo) {
  const encontrados = new Set();
  for (const m of String(cuerpo ?? '').matchAll(/^[ \t]*co-authored-by:(.*)$/gim)) {
    for (const agente of AGENTES) {
      if (new RegExp(`\\b${agente}\\b`, 'i').test(m[1])) encontrados.add(agente);
    }
  }
  return [...encontrados];
}

/** «Revert "feat: x"», «revert(agenda): …» o «revert: …». */
export function esRevert(asunto) {
  return /^revert\b/i.test(String(asunto ?? '').trim());
}

/** «fix(ámbito): …» o «fix: …». */
export function esArreglo(asunto) {
  return /^fix(\([^)]*\))?!?:/i.test(String(asunto ?? '').trim());
}

/** feat, fix, refactor, test, docs, chore, perf, style u «otros». */
export function tipoDeCommit(asunto) {
  const m = /^([a-z]+)(\([^)]*\))?!?:/i.exec(String(asunto ?? '').trim());
  const tipo = m ? m[1].toLowerCase() : null;
  return TIPOS.includes(tipo) ? tipo : 'otros';
}

/** Lockfiles, código generado y salidas de compilación no cuentan como cambio revisable. */
export function archivoExcluido(ruta) {
  const partes = String(ruta).split('/');
  const nombre = partes[partes.length - 1];
  if (LOCKFILES.has(nombre)) return true;
  if (GENERADO_DART.test(nombre)) return true;
  return partes.slice(0, -1).some((d) => CARPETAS_COMPILADAS.has(d));
}

/** La ruta nueva de una línea de numstat: «src/{a => b}/x.dart» → «src/b/x.dart». */
export function rutaNueva(ruta) {
  let r = String(ruta);
  if (r.includes('{') && r.includes(' => ')) {
    r = r.replace(/\{([^{}]*) => ([^{}]*)\}/g, '$2').replace(/\/{2,}/g, '/').replace(/^\//, '');
  } else if (r.includes(' => ')) {
    r = r.slice(r.lastIndexOf(' => ') + 4);
  }
  return r;
}

/** Formato de `git log` que lee parsearLog: registro \x1e, campos \x1f, y después el numstat. */
export const FORMATO_LOG = '%x1e%H%x1f%cI%x1f%B%x1f';

/** Convierte la salida de `git log --numstat --format=FORMATO_LOG` en commits. */
export function parsearLog(texto) {
  const commits = [];
  for (const bloque of String(texto ?? '').split('\x1e')) {
    const partes = bloque.split('\x1f');
    if (partes.length < 4) continue;
    const [hash, fecha, cuerpo, ...resto] = partes;
    const archivos = [];
    for (const linea of resto.join('\x1f').split('\n')) {
      const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(linea);
      if (!m) continue;
      const binario = m[1] === '-' || m[2] === '-';
      archivos.push({
        ruta: rutaNueva(m[3]),
        agregadas: binario ? 0 : Number(m[1]),
        borradas: binario ? 0 : Number(m[2]),
        binario,
      });
    }
    commits.push({
      hash: hash.trim(),
      fecha: fecha.trim(),
      ms: Date.parse(fecha.trim()),
      asunto: (cuerpo.split('\n').find((l) => l.trim()) ?? '').trim(),
      cuerpo,
      archivos,
    });
  }
  return commits;
}

/** Archivos del commit que cuentan: ni lockfiles, ni generados, ni binarios. */
export function archivosQueCuentan(commit) {
  return commit.archivos.filter((a) => !a.binario && !archivoExcluido(a.ruta));
}

/** Líneas cambiadas (agregadas + borradas) en lo que cuenta; null si no cambió nada que cuente. */
export function lineasDelCommit(commit) {
  const archivos = archivosQueCuentan(commit);
  if (!archivos.length) return null;
  return archivos.reduce((s, a) => s + a.agregadas + a.borradas, 0);
}

/**
 * Retrabajo: arreglos dentro del periodo que tocan un archivo que otro commit
 * cambió en los `ventanaMs` anteriores. `commits` va del más viejo al más nuevo
 * e incluye la historia previa al periodo para poder mirar hacia atrás.
 */
export function medirRetrabajo(commits, { desdeMs, ventanaMs }) {
  const ultimoCambio = new Map();
  const porArchivo = new Map();
  const lista = [];
  let arreglos = 0;
  for (const c of commits) {
    const rutas = [...new Set(archivosQueCuentan(c).map((a) => a.ruta))];
    if (c.ms >= desdeMs && esArreglo(c.asunto)) {
      arreglos += 1;
      const tocados = rutas.filter((r) => ultimoCambio.has(r) && c.ms - ultimoCambio.get(r) <= ventanaMs);
      if (tocados.length) {
        lista.push({ hash: c.hash.slice(0, 10), asunto: c.asunto, archivos: tocados });
        for (const r of tocados) contar(porArchivo, r);
      }
    }
    for (const r of rutas) ultimoCambio.set(r, c.ms);
  }
  return {
    arreglos,
    commits: lista.length,
    archivos: ordenado(porArchivo).slice(0, MAX_ARCHIVOS_RETRABAJO),
    lista,
  };
}

// ---------------------------------------------------------------------------
// Git
// ---------------------------------------------------------------------------

function git(raiz, args) {
  const r = spawnSync('git', ['-C', raiz, '-c', 'core.quotePath=false', ...args], {
    encoding: 'utf8',
    maxBuffer: MAX_SALIDA_GIT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { ok: !r.error && r.status === 0, salida: r.stdout ?? '', error: r.error ? String(r.error.message) : (r.stderr ?? '').trim() };
}

/** Raíz del repositorio que contiene `dir`, o null si no hay git. */
export function raizGit(dir) {
  const r = git(dir, ['rev-parse', '--show-toplevel']);
  return r.ok ? r.salida.trim() : null;
}

function ramaActual(raiz) {
  const r = git(raiz, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
  if (r.ok && r.salida.trim()) return r.salida.trim();
  const h = git(raiz, ['rev-parse', '--short', 'HEAD']);
  return h.ok ? `HEAD separado en ${h.salida.trim()}` : null;
}

/** Commits de la rama actual desde `desdeMs`, del más viejo al más nuevo. */
export function leerCommits(raiz, desdeMs) {
  // --no-color y --no-show-signature: la configuración de cada persona no cambia la salida que se lee.
  const r = git(raiz, ['log', '--no-merges', '--no-color', '--no-show-signature', '--numstat', `--since=${new Date(desdeMs).toISOString()}`, `--format=${FORMATO_LOG}`]);
  if (!r.ok) return [];
  return parsearLog(r.salida).filter((c) => Number.isFinite(c.ms) && c.ms >= desdeMs).reverse();
}

/** Todas las métricas de git del periodo [ahora − dias, ahora]. */
export function medirGit(raiz, { dias = DIAS_DEFECTO, ahora = new Date() } = {}) {
  const raizRepo = raizGit(raiz);
  if (!raizRepo) return { disponible: false, motivo: 'sin-git' };
  const rama = ramaActual(raizRepo);
  const hastaMs = new Date(ahora).getTime();
  const ventanaMs = DIAS_RETRABAJO * DIA_MS;
  const desdeMs = hastaMs - dias * DIA_MS;
  const historia = leerCommits(raizRepo, desdeMs - ventanaMs).filter((c) => c.ms <= hastaMs);
  const commits = historia.filter((c) => c.ms >= desdeMs);
  if (!commits.length) return { disponible: true, motivo: 'sin-commits', rama, commits: 0 };

  const porAgente = new Map();
  const tipos = Object.fromEntries([...TIPOS, 'otros'].map((t) => [t, 0]));
  const reverts = [];
  const tamanos = [];
  let conAgente = 0;
  for (const c of commits) {
    const agentes = agentesDelCommit(c.cuerpo);
    if (agentes.length) conAgente += 1;
    for (const a of agentes) contar(porAgente, a);
    tipos[tipoDeCommit(c.asunto)] += 1;
    if (esRevert(c.asunto)) reverts.push({ hash: c.hash.slice(0, 10), asunto: c.asunto });
    const lineas = lineasDelCommit(c);
    if (lineas != null) tamanos.push(lineas);
  }
  const retrabajo = medirRetrabajo(historia, { desdeMs, ventanaMs });
  const total = commits.length;
  return {
    disponible: true,
    rama,
    commits: total,
    conAgente,
    porcentajeConAgente: conAgente / total,
    porAgente: Object.fromEntries(ordenado(porAgente)),
    reverts: { commits: reverts.length, porcentaje: reverts.length / total, lista: reverts },
    retrabajo: {
      commits: retrabajo.commits,
      arreglos: retrabajo.arreglos,
      porcentajeDelTotal: retrabajo.commits / total,
      porcentajeDeArreglos: retrabajo.arreglos ? retrabajo.commits / retrabajo.arreglos : null,
      archivos: retrabajo.archivos.map(([ruta, veces]) => ({ ruta, veces })),
      lista: retrabajo.lista,
    },
    tamano: {
      commitsMedidos: tamanos.length,
      mediana: mediana(tamanos),
      p90: percentil(tamanos, 0.9),
      maximo: tamanos.length ? Math.max(...tamanos) : null,
      excluye: 'lockfiles, código generado (*.g.dart, *.freezed.dart…), dist/, build/ y binarios',
    },
    tipos,
  };
}

// ---------------------------------------------------------------------------
// Bitácora
// ---------------------------------------------------------------------------

/**
 * Registros de `.harness/bitacora/*.jsonl` del periodo. Se salta las líneas
 * cortadas o que no son objetos. Si un registro trae `ts`, se filtra por esa
 * hora; si no, por el día del nombre del archivo.
 */
export function leerBitacora(raiz, { dias = DIAS_DEFECTO, ahora = new Date() } = {}) {
  const dir = path.join(raiz, '.harness', 'bitacora');
  if (!fs.existsSync(dir)) return null;
  const hastaMs = new Date(ahora).getTime();
  const desdeMs = hastaMs - dias * DIA_MS;
  const desdeDia = diaEcuador(desdeMs);
  const hastaDia = diaEcuador(hastaMs);
  const registros = [];
  let nombres = [];
  try {
    nombres = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort();
  } catch {
    return registros;
  }
  for (const nombre of nombres) {
    const dia = /^\d{4}-\d{2}-\d{2}/.exec(nombre)?.[0];
    if (dia && (dia < desdeDia || dia > hastaDia)) continue;
    let texto = '';
    try {
      texto = fs.readFileSync(path.join(dir, nombre), 'utf8');
    } catch {
      continue;
    }
    for (const linea of texto.split('\n')) {
      if (!linea.trim()) continue;
      let r;
      try {
        r = JSON.parse(linea);
      } catch {
        continue; // Línea cortada (el agente se cerró a mitad de escritura).
      }
      if (!r || typeof r !== 'object' || Array.isArray(r)) continue;
      const ms = Date.parse(r.ts);
      if (Number.isFinite(ms) && (ms < desdeMs || ms > hastaMs)) continue;
      registros.push(r);
    }
  }
  return registros;
}

/** «deny» o «ask» si el registro es de una guardia; null si no. */
export function decisionDe(r) {
  const d = typeof r.decision === 'string' ? r.decision.trim().toLowerCase() : '';
  if (d === 'deny' || d === 'ask') return d;
  if (r.evento === 'bloqueado') return 'deny';
  if (r.evento === 'pregunta') return 'ask';
  return null;
}

function reglaDe(r) {
  for (const campo of [r.regla, r.motivo, r.rule, r.reason]) {
    if (typeof campo === 'string' && campo.trim()) {
      const t = campo.trim();
      return t.length > 80 ? `${t.slice(0, 80)}…` : t;
    }
  }
  return 'sin regla';
}

function esUsoDeHerramienta(r) {
  if (r.evento === 'herramienta') return true;
  return r.evento == null && typeof r.herramienta === 'string' && r.herramienta !== '' && decisionDe(r) == null;
}

/** Sesiones por agente, usos de herramientas y bloqueos de las guardias por regla. */
export function resumirBitacora(registros) {
  const sesiones = new Map();
  const herramientas = new Map();
  const reglas = new Map();
  let usos = 0;
  let errores = 0;
  let primero = null;
  let ultimo = null;
  let bloqueos = 0;
  let preguntas = 0;
  for (const r of registros) {
    const agente = typeof r.agente === 'string' && r.agente.trim() ? r.agente.trim() : 'desconocido';
    const sesion = r.sesion ?? r.session_id ?? 'sin-sesion';
    if (!sesiones.has(agente)) sesiones.set(agente, new Set());
    sesiones.get(agente).add(String(sesion));
    const ms = Date.parse(r.ts);
    if (Number.isFinite(ms)) {
      if (primero == null || ms < primero) primero = ms;
      if (ultimo == null || ms > ultimo) ultimo = ms;
    }
    const decision = decisionDe(r);
    if (decision) {
      const regla = reglaDe(r);
      if (!reglas.has(regla)) reglas.set(regla, { regla, deny: 0, ask: 0, total: 0 });
      const fila = reglas.get(regla);
      fila[decision] += 1;
      fila.total += 1;
      if (decision === 'deny') bloqueos += 1;
      else preguntas += 1;
    } else if (esUsoDeHerramienta(r)) {
      usos += 1;
      contar(herramientas, typeof r.herramienta === 'string' && r.herramienta ? r.herramienta : 'desconocida');
      if (r.resultado === 'error') errores += 1;
    }
  }
  const porAgente = ordenado(new Map([...sesiones.entries()].map(([a, s]) => [a, s.size])));
  return {
    registros: registros.length,
    primerRegistro: primero == null ? null : new Date(primero).toISOString(),
    ultimoRegistro: ultimo == null ? null : new Date(ultimo).toISOString(),
    sesiones: porAgente.reduce((s, [, n]) => s + n, 0),
    sesionesPorAgente: Object.fromEntries(porAgente),
    herramientas: { usos, errores, porHerramienta: Object.fromEntries(ordenado(herramientas)) },
    guardias: {
      bloqueos,
      preguntas,
      porRegla: [...reglas.values()].sort((a, b) => b.total - a.total || a.regla.localeCompare(b.regla)),
    },
  };
}

// ---------------------------------------------------------------------------
// Lectura: qué dicen los números (solo con los UMBRALES)
// ---------------------------------------------------------------------------

/** Dos o tres frases para el dueño: primero las alertas, después lo que va bien. */
export function lecturas(informe, umbrales = UMBRALES) {
  const g = informe.git;
  const b = informe.bitacora;
  const dias = informe.dias;
  const alertas = [];
  const buenas = [];
  const hayCommits = g?.disponible && g.commits > 0;
  const pocos = hayCommits && g.commits < umbrales.minCommits;

  if (hayCommits) {
    if (g.reverts.porcentaje >= umbrales.revertsAlto) {
      alertas.push(`Se deshicieron ${plural(g.reverts.commits, 'commit', 'commits')} (${porcentaje(g.reverts.porcentaje)} del total): algo se entregó sin probarlo bien.`);
    } else if (g.reverts.commits === 0 && !pocos) {
      buenas.push('No hubo que deshacer ningún commit.');
    }

    const rt = g.retrabajo;
    const proporcion = deCada(rt.commits, rt.arreglos);
    if (rt.porcentajeDelTotal >= umbrales.retrabajoAlto && proporcion) {
      const verbo = proporcion.singular ? 'corrige' : 'corrigen';
      alertas.push(`El retrabajo es alto (${porcentaje(rt.porcentajeDelTotal)} de los commits): ${proporcion.texto} arreglos ${verbo} algo que se había cambiado en los ${DIAS_RETRABAJO} días anteriores.`);
    } else if (rt.porcentajeDelTotal <= umbrales.retrabajoBajo && !pocos) {
      buenas.push(rt.commits
        ? `El retrabajo es bajo: solo el ${porcentaje(rt.porcentajeDelTotal)} de los commits arregla algo cambiado poco antes.`
        : 'No hubo retrabajo: ningún arreglo tocó algo cambiado poco antes.');
    }

    const t = g.tamano;
    if (t.mediana != null) {
      if (t.mediana >= umbrales.medianaGrande) {
        alertas.push(`Los cambios son grandes (mediana de ${t.mediana} líneas): cuestan de revisar.`);
      } else if (t.p90 >= umbrales.p90Grande) {
        alertas.push(`La mayoría de los cambios se revisan bien (mediana de ${t.mediana} líneas), pero 1 de cada 10 tiene ${t.p90} líneas o más: esos conviene partirlos.`);
      } else if (t.mediana <= umbrales.medianaPequena) {
        buenas.push(`Los cambios son pequeños (mediana de ${t.mediana} líneas): se pueden revisar con cuidado.`);
      }
    }
  }

  if (b && b.sesiones > 0) {
    const frenos = b.guardias.bloqueos + b.guardias.preguntas;
    if (frenos / b.sesiones >= umbrales.guardiasPorSesion && b.guardias.porRegla.length) {
      const regla = b.guardias.porRegla[0];
      alertas.push(`Las guardias frenaron a los agentes ${plural(frenos, 'vez', 'veces')} en ${plural(b.sesiones, 'sesión', 'sesiones')}, sobre todo por «${regla.regla}»: conviene ver si falta una instrucción o si la regla estorba trabajo legítimo.`);
    }
  }

  const frases = [];
  if (pocos) frases.push(`Con ${plural(g.commits, 'commit', 'commits')} en ${dias} días los porcentajes dicen poco: tómalos como referencia.`);
  frases.push(...alertas, ...buenas);
  if (!frases.length && hayCommits) frases.push('Ningún número pasa de los umbrales: no hay señales de alarma.');
  return frases.slice(0, MAX_LECTURAS);
}

// ---------------------------------------------------------------------------
// Informe
// ---------------------------------------------------------------------------

/** El informe completo de un proyecto. No escribe nada. */
export function medir(ruta, { dias = DIAS_DEFECTO, ahora = new Date() } = {}) {
  const inicio = path.resolve(ruta);
  const raiz = raizGit(inicio) ?? inicio;
  const hastaMs = new Date(ahora).getTime();
  const registros = leerBitacora(raiz, { dias, ahora });
  const informe = {
    version: VERSION_INFORME,
    proyecto: path.basename(raiz),
    raiz,
    dias,
    desde: new Date(hastaMs - dias * DIA_MS).toISOString(),
    hasta: new Date(hastaMs).toISOString(),
    git: medirGit(raiz, { dias, ahora }),
    bitacora: registros == null ? null : resumirBitacora(registros),
    umbrales: UMBRALES,
  };
  informe.lecturas = lecturas(informe);
  return informe;
}

/** Nombres de archivo para leer de corrido: el nombre solo, o con su carpeta si se repite. */
export function nombresCortos(rutas) {
  const corto = (r, n) => r.split('/').slice(-n).join('/');
  return rutas.map((r) => {
    let n = 1;
    while (n < r.split('/').length && rutas.some((o) => o !== r && corto(o, n) === corto(r, n))) n += 1;
    return corto(r, n);
  });
}

function lista(pares, max = 3) {
  return pares.slice(0, max).map(([nombre, n]) => `${nombre} ${n}`).join(', ');
}

/** Resumen en español sencillo, de unas 15 líneas. */
export function renderResumen(informe) {
  const g = informe.git;
  const b = informe.bitacora;
  const dias = informe.dias;
  const l = [];
  const rama = g?.rama ? `, rama ${g.rama}` : '';
  l.push(`Resultados de los agentes en ${informe.proyecto}${rama}: últimos ${plural(dias, 'día', 'días')} (${diaEcuador(informe.desde)} a ${diaEcuador(informe.hasta)})`);
  l.push('');

  if (!g.disponible) {
    l.push('No es un repositorio de git: no hay commits que medir.');
  } else if (!g.commits) {
    l.push(`No hay commits en estos días${g.rama ? ` en la rama ${g.rama}` : ''}: no hay resultados que medir.`);
  } else {
    const agentes = Object.entries(g.porAgente).map(([a, n]) => `${nombreAgente(a)} ${n}`).join(', ');
    l.push(g.conAgente
      ? `Commits: ${g.commits}. Con un agente: ${g.conAgente} (${porcentaje(g.porcentajeConAgente)}; ${agentes}).`
      : `Commits: ${g.commits}. Ninguno lleva la firma de un agente (línea Co-Authored-By).`);
    const tipos = Object.entries(g.tipos).filter(([t, n]) => n > 0 && t !== 'otros').sort((a, b) => b[1] - a[1]);
    if (g.tipos.otros) tipos.push(['otros', g.tipos.otros]);
    l.push(`Por tipo: ${tipos.map(([t, n]) => `${t} ${n}`).join(', ')}.`);
    l.push(g.reverts.commits
      ? `Reverts (commits que deshacen otro): ${g.reverts.commits} (${porcentaje(g.reverts.porcentaje)}).`
      : 'Reverts (commits que deshacen otro): 0.');
    const rt = g.retrabajo;
    if (!rt.arreglos) {
      l.push('Retrabajo: no hubo arreglos (fix) en estos días.');
    } else {
      l.push(`Retrabajo: ${plural(rt.commits, 'commit', 'commits')}, el ${porcentaje(rt.porcentajeDelTotal)} del total (${rt.commits} de ${plural(rt.arreglos, 'arreglo', 'arreglos')} tocan archivos cambiados en los ${DIAS_RETRABAJO} días anteriores).`);
      if (rt.archivos.length) {
        const nombres = nombresCortos(rt.archivos.map((a) => a.ruta));
        l.push(`  Archivos con más retrabajo: ${rt.archivos.map((a, i) => `${nombres[i]} (${a.veces})`).join(', ')}.`);
      }
    }
    const t = g.tamano;
    l.push(t.mediana == null
      ? 'Tamaño: ningún commit cambió código que cuente (solo lockfiles, generados o binarios).'
      : `Tamaño de cada commit: mediana de ${t.mediana} líneas; el 10 % más grande tiene ${t.p90} líneas o más (sin lockfiles, código generado ni binarios).`);
  }

  l.push('');
  if (b == null) {
    l.push('Bitácora: este proyecto no tiene (.harness/bitacora/ se llena en cada máquina donde trabaja un agente).');
  } else if (!b.registros) {
    l.push('Bitácora: sin registros en estos días.');
  } else {
    const usos = b.herramientas.usos;
    const desde = b.primerRegistro && diaEcuador(b.primerRegistro) > diaEcuador(informe.desde) ? ` (hay registros desde el ${diaEcuador(b.primerRegistro)})` : '';
    l.push(`Bitácora${desde}: ${plural(b.sesiones, 'sesión', 'sesiones')} (${lista(Object.entries(b.sesionesPorAgente), 4)}) y ${plural(usos, 'uso', 'usos')} de herramientas${usos ? ` (${lista(Object.entries(b.herramientas.porHerramienta))})` : ''}.`);
    const gu = b.guardias;
    l.push(gu.bloqueos + gu.preguntas
      ? `Guardias: ${plural(gu.bloqueos, 'bloqueo', 'bloqueos')} y ${plural(gu.preguntas, 'pedido', 'pedidos')} de aprobación; más frecuentes: ${gu.porRegla.slice(0, 3).map((r) => `${r.regla} (${r.total})`).join(', ')}.`
      : 'Guardias: no frenaron nada.');
  }

  if (informe.lecturas.length) {
    l.push('', 'Lectura:');
    for (const frase of informe.lecturas) l.push(`- ${frase}`);
  }
  return l.join('\n');
}

// ---------------------------------------------------------------------------
// Línea de comandos
// ---------------------------------------------------------------------------

export const AYUDA = `Uso: node .harness/bin/metricas.mjs [ruta-del-proyecto] [--dias N] [--json]

Resultados de los agentes en el proyecto: commits, reverts, retrabajo, tamaño
de los cambios y lo que registró la bitácora. No escribe nada.

  --dias N   periodo a medir, en días hasta hoy (por defecto ${DIAS_DEFECTO})
  --json     todos los datos en JSON, para máquinas`;

export function parsearArgs(argv) {
  const o = { dias: DIAS_DEFECTO, json: false, ruta: null, ayuda: false };
  for (let i = 0; i < argv.length; i++) {
    let a = argv[i];
    let valor;
    const eq = a.indexOf('=');
    if (a.startsWith('--') && eq > 0) { valor = a.slice(eq + 1); a = a.slice(0, eq); }
    switch (a) {
      case '--dias': {
        const v = valor !== undefined ? valor : argv[++i];
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1 || n > DIAS_MAXIMO) {
          throw new ErrorUso(`--dias necesita un número entero de días entre 1 y ${DIAS_MAXIMO} (por ejemplo, --dias 30).`);
        }
        o.dias = n;
        break;
      }
      case '--json': o.json = true; break;
      case '-h': case '--help': case '--ayuda': o.ayuda = true; break;
      default:
        if (a.startsWith('-')) throw new ErrorUso(`Opción desconocida: ${a}`);
        if (o.ruta) throw new ErrorUso(`Solo se mide un proyecto a la vez (sobra: ${a}).`);
        o.ruta = a;
    }
  }
  return o;
}

export function main(argv = process.argv.slice(2), { ahora = new Date() } = {}) {
  let o;
  try {
    o = parsearArgs(argv);
  } catch (e) {
    process.stderr.write(`${e.message}\n\n${AYUDA}\n`);
    return 2;
  }
  if (o.ayuda) {
    process.stdout.write(`${AYUDA}\n`);
    return 0;
  }
  const ruta = path.resolve(o.ruta || process.cwd());
  if (!fs.existsSync(ruta) || !fs.statSync(ruta).isDirectory()) {
    process.stderr.write(`No existe la carpeta del proyecto: ${ruta}\n`);
    return 2;
  }
  const informe = medir(ruta, { dias: o.dias, ahora });
  process.stdout.write(o.json ? `${JSON.stringify(informe, null, 2)}\n` : `${renderResumen(informe)}\n`);
  return 0;
}

function esEjecucionDirecta() {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href
      || import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
}

if (esEjecucionDirecta()) {
  try {
    process.exitCode = main();
  } catch (e) {
    process.stderr.write(`Error interno de métricas: ${e?.stack || e}\n`);
    process.exitCode = 2;
  }
}
