#!/usr/bin/env node
// Revisa que el harness esté completo y activo en este proyecto.
//   node .harness/bin/doctor.mjs             revisar
//   node .harness/bin/doctor.mjs --arreglar  activar lo que se puede activar solo
// Sale con código 1 si falta algo.

import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const fix = process.argv.includes("--arreglar");
// En CI no hay copia de trabajo de una persona: no se revisan los hooks de git ni las herramientas locales.
const ci = process.argv.includes("--ci");

function root() {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return process.cwd();
  }
}

const project = root();
const at = (...parts) => join(project, ...parts);
const read = (...parts) => (existsSync(at(...parts)) ? readFileSync(at(...parts), "utf8") : "");
const results = [];

function check(name, ok, hint, repair) {
  if (!ok && fix && repair) {
    try {
      repair();
      results.push({ name, ok: true, note: "arreglado" });
      return;
    } catch {
      // Falls through to the failure.
    }
  }
  results.push({ name, ok, note: ok ? "" : hint });
}

/** Lo que conviene arreglar pero no impide trabajar: se muestra con ⚠ y no cambia el código de salida. */
function warn(name, ok, hint) {
  results.push({ name, ok: true, aviso: !ok, note: ok ? "" : hint });
}

function commandVersion(cmd) {
  try {
    return execFileSync(cmd, ["--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 10_000 }).trim();
  } catch {
    return null;
  }
}

function gitleaksVersion() {
  try {
    return execFileSync("gitleaks", ["version"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 10_000 }).trim();
  } catch {
    return null;
  }
}

/** a.b.c ≥ x.y.z */
export function atLeast(version, minimum) {
  const a = String(version).split(".").map(Number);
  const b = minimum.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    if ((a[i] ?? 0) !== b[i]) return (a[i] ?? 0) > b[i];
  }
  return true;
}

const version = read(".harness", "VERSION").trim();
check("Carpeta .harness instalada", Boolean(version), "corre el instalador: node <ruta-del-harness>/bin/instalar.mjs .");

let config = {};
try {
  config = JSON.parse(read(".harness", "proyecto.json"));
} catch {
  // Reported below.
}
check(".harness/proyecto.json válido", Boolean(config.nombre && config.entrega), "corre el instalador con --nombre y --entrega, o con un perfil");
check("Tabla de modelos y esfuerzo presente", existsSync(at(".harness", "orquestacion.json")), "corre el instalador");
warn("Rutas de riesgo declaradas", Boolean(config.riesgo?.alto?.length), "sin `riesgo.alto` en proyecto.json todo cambio cuenta como riesgo medio y el modelo mínimo no se exige");
warn("Producción declarada", Boolean(config.produccion?.hosts?.length), "sin `produccion.hosts` en proyecto.json la guardia no reconoce un ssh a producción");
if (config.publico === true) warn("Repositorio público con lo que no se publica declarado", Boolean(config.noPublicar?.length), "agrega `noPublicar` (expresiones regulares) a proyecto.json");

const agents = read("AGENTS.md");
check("AGENTS.md con las reglas del harness", agents.includes("<!-- harness:inicio") && agents.includes("<!-- harness:fin -->"), "corre el instalador");
check("Las reglas de AGENTS.md son de esta versión", !version || agents.includes(`<!-- harness:inicio v${version}`), "corre el instalador para actualizar el bloque");
check("CLAUDE.md importa AGENTS.md", read("CLAUDE.md").includes("@AGENTS.md"), "agrega la línea @AGENTS.md a CLAUDE.md");
warn("Sección del proyecto completada en AGENTS.md", agents.length > 0 && !agents.includes("(qué hace y para quién"), "completa «Qué es», «Partes» y «Comandos» en AGENTS.md");

const settings = read(".claude", "settings.json");
for (const hook of ["guardia-bash.mjs", "guardia-archivos.mjs", "bitacora.mjs", "verificar-fin.mjs", "contexto-inicio.mjs", "modelo.mjs"]) {
  check(`Claude Code usa ${hook}`, settings.includes(`.harness/hooks/${hook}`), "corre el instalador");
}
check("Las guardias de Claude Code bloquean si fallan", /guardia-bash\.mjs[^}]*"onFailure":\s*"block"/s.test(settings), "corre el instalador");
check("Codex usa las guardias", read(".codex", "hooks.json").includes(".harness/hooks/guardia-bash.mjs"), "corre el instalador");

for (const skill of ["plan", "verify", "entregar", "desplegar", "investigar", "registro", "leccion"]) {
  check(`Skill ${skill}`, existsSync(at(".claude", "skills", skill, "SKILL.md")), "corre el instalador");
}
for (const agent of ["revisor", "revisor-de-metodo", "auditor-seguridad", "explorador", "probador", "operador"]) {
  const texto = read(".claude", "agents", `${agent}.md`);
  check(`Subagente ${agent} con modelo y esfuerzo`, /^model:\s*\S+/m.test(texto) && /^effort:\s*\S+/m.test(texto), "corre el instalador");
}
check("Plantilla de pull request", existsSync(at(".github", "pull_request_template.md")), "corre el instalador");

if (!ci) {
  let hooksPath = "";
  try {
    hooksPath = execFileSync("git", ["config", "core.hooksPath"], { cwd: project, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    // Sin configurar.
  }
  check("Hooks de git activos en esta copia", hooksPath === ".harness/git-hooks", "node .harness/bin/doctor.mjs --arreglar",
    () => execFileSync("git", ["config", "core.hooksPath", ".harness/git-hooks"], { cwd: project }));
  const executables = ["hooks", "git-hooks"].flatMap((dir) => (existsSync(at(".harness", dir)) ? readdirSync(at(".harness", dir)).map((f) => at(".harness", dir, f)) : []));
  check("Hooks ejecutables", executables.every((file) => (statSync(file).mode & 0o111) !== 0), "node .harness/bin/doctor.mjs --arreglar",
    () => executables.forEach((file) => chmodSync(file, 0o755)));
  warn("gitleaks instalado", Boolean(commandVersion("gitleaks") ?? gitleaksVersion()), "sin gitleaks, el pre-commit solo usa los patrones del harness; el CI sí lo corre");
}

check("CI del harness", existsSync(at(".github", "workflows", "harness.yml")), "corre el instalador sin --sin-ci");
const ignore = read(".gitignore");
check(".gitignore protege secretos y bitácora", [".env", "*.pem", ".harness/bitacora/"].every((line) => ignore.includes(line)), "corre el instalador");

const verifications = Array.isArray(config.verificar) ? config.verificar.length : 0;
warn(`Verificaciones declaradas (${verifications})`, verifications > 0,
  "sin ellas, la skill verify y el hook de fin de turno no tienen qué correr");
warn("Hay verificaciones rápidas para el fin de turno", !verifications || config.verificar.some((v) => v.rapido),
  "marca como rápida al menos la sintaxis o los tipos, para que el agente no termine con errores");
const agentsLines = agents ? agents.split("\n").length : 0;
warn(`AGENTS.md corto (${agentsLines} líneas)`, agentsLines <= 200, "pasa el detalle a docs/ y deja en AGENTS.md un índice: cada agente lo lee entero en cada sesión");

if (!ci) {
  const claudeVersion = commandVersion("claude")?.match(/\d+\.\d+\.\d+/)?.[0];
  if (claudeVersion) {
    warn(`Claude Code ${claudeVersion} con guardias que bloquean si fallan (2.1.295 o más nuevo)`, atLeast(claudeVersion, "2.1.295"),
      "actualiza Claude Code: en versiones viejas, una guardia que falla deja pasar la acción");
  }
}

const major = Number(process.versions.node.split(".")[0]);
check(`Node 20 o más nuevo (tienes ${process.versions.node})`, major >= 20, "instala Node 22 LTS");

const missing = results.filter((r) => !r.ok);
const warnings = results.filter((r) => r.aviso);
for (const r of results) process.stdout.write(`${!r.ok ? "✗" : r.aviso ? "⚠" : "✓"} ${r.name}${r.note ? ` — ${r.note}` : ""}\n`);
process.stdout.write(missing.length === 0
  ? `\nTodo en orden${warnings.length ? `, con ${warnings.length} ${warnings.length === 1 ? "aviso" : "avisos"}` : ""}.\n`
  : `\nFaltan ${missing.length}.\n`);
process.exit(missing.length === 0 ? 0 : 1);
export { dirname };
