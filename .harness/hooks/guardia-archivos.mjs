#!/usr/bin/env node
// PreToolUse guard for file edits (Claude: Write/Edit/MultiEdit/NotebookEdit,
// Codex: apply_patch). Refuses edits to secrets, generated code, lockfiles and
// the harness itself, and content that carries a live secret.

import { existsSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { agentName, ask, deny, projectDir, readPayload, readProjectConfig, toolInput } from "./comun.mjs";
import { findSecrets, isLockfile, isSecretFile, realPath } from "./patrones.mjs";
import { coincide, leerOrquestacion, modeloAlcanza, nivelDeRuta } from "./proyecto.mjs";
import { modeloDeSesion } from "./modelo.mjs";

const START = "<!-- harness:inicio";
const END = "<!-- harness:fin -->";
const HARNESS_OWNED = [".claude/settings.json", ".codex/hooks.json", ".harness/orquestacion.json"];
const PROJECT_OWNED_IN_HARNESS = [".harness/proyecto.json", ".harness/excepciones.json"];

function isUnder(path, dir) {
  const rel = relative(dir, path);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith(sep));
}

/** Every file this tool call writes, with the new text when known. */
export function edits(payload) {
  const input = toolInput(payload);
  const out = [];
  const patch = typeof input === "string" ? input : (input?.patch ?? input?.input ?? null);
  if (typeof patch === "string" && patch.includes("*** Begin Patch")) {
    // Codex apply_patch: one header per file, added lines start with "+".
    let current = null;
    for (const line of patch.split(/\r?\n/)) {
      const header = /^\*\*\* (Add|Update|Delete) File: (.+)$/.exec(line);
      const move = /^\*\*\* Move to: (.+)$/.exec(line);
      if (header) {
        current = { path: header[2].trim(), text: "", kind: header[1] };
        out.push(current);
      } else if (move && current) {
        out.push({ path: move[1].trim(), text: "", kind: "Move" });
      } else if (current && line.startsWith("+")) {
        current.text += `${line.slice(1)}\n`;
      }
    }
    return out;
  }
  const path = input?.file_path ?? input?.path ?? input?.notebook_path;
  if (!path) return out;
  const pieces = [input?.content, input?.new_string, input?.new_source, ...(Array.isArray(input?.edits) ? input.edits.map((e) => e?.new_string) : [])];
  out.push({ path, text: pieces.filter((p) => typeof p === "string").join("\n"), oldText: input?.old_string, kind: input?.content !== undefined ? "Write" : "Edit" });
  return out;
}

/** Inside the managed block of AGENTS.md? */
export function touchesManagedBlock(current, edit) {
  const start = current.indexOf(START);
  const end = current.indexOf(END);
  if (start === -1 || end === -1) return false;
  const block = current.slice(start, end + END.length);
  if (edit.kind === "Write") {
    const s = edit.text.indexOf(START);
    const e = edit.text.indexOf(END);
    return s === -1 || e === -1 || edit.text.slice(s, e + END.length) !== block;
  }
  if (typeof edit.oldText === "string" && edit.oldText.length > 0) {
    const at = current.indexOf(edit.oldText);
    return at !== -1 && at < end + END.length && at + edit.oldText.length > start;
  }
  return edit.text.includes(START) || edit.text.includes(END);
}

const OUTSIDE_OK = () => [tmpdir(), "/tmp", "/private/tmp", "/var/folders", "/private/var/folders",
  join(homedir(), ".claude"), join(homedir(), ".codex"), join(homedir(), ".gemini")];

/** Why this edit is refused (`deny`) or needs a person (`ask`), or null. */
export function check(edit, projectRoot, { config = {}, modelo = null, orquestacion = null } = {}) {
  const root = realPath(projectRoot);
  const absolute = realPath(resolve(root, edit.path));
  const rel = relative(root, absolute).split(sep).join("/");
  const name = basename(absolute);

  if (!isUnder(absolute, root)) {
    if (OUTSIDE_OK().some((dir) => isUnder(absolute, realPath(dir)))) return null;
    return { decision: "ask", rule: "fuera-del-proyecto", reason: `Ese archivo (${absolute}) está fuera del proyecto. Los cambios a otro repositorio se hacen en ese repositorio.` };
  }
  if (isSecretFile(name)) return { decision: "deny", rule: "archivo-de-secretos", reason: "Ese archivo guarda secretos; lo edita una persona. En el código, lee la variable de entorno." };
  if (isLockfile(name)) return { decision: "deny", rule: "lockfile", reason: "El lockfile lo escribe el gestor de paquetes (npm install, uv lock)." };
  if (PROJECT_OWNED_IN_HARNESS.includes(rel)) {
    return {
      decision: "ask",
      rule: "configuracion-del-harness",
      reason: rel.endsWith("proyecto.json")
        ? "Cambia qué es producción, qué rutas son de riesgo, qué se verifica o cómo se entrega; lo aprueba una persona."
        : "Aceptar una excepción lo aprueba una persona, con su motivo.",
    };
  }
  if (rel.startsWith(".harness/") && !rel.startsWith(".harness/bitacora/") && !rel.startsWith(".harness/estado/")) {
    return { decision: "deny", rule: "harness", reason: "Esa parte del harness se actualiza desde el repositorio del harness con su instalador, no a mano." };
  }
  if (HARNESS_OWNED.includes(rel)) {
    return { decision: "deny", rule: "harness", reason: "La configuración de agentes y la tabla de modelos las escribe el instalador del harness. Lo propio del proyecto va en .claude/settings.local.json." };
  }
  if (rel === ".claude/settings.local.json" && /disableAllHooks|"hooks"\s*:/.test(edit.text)) {
    return { decision: "deny", rule: "harness", reason: "Los hooks del harness no se apagan ni se reemplazan desde la configuración local." };
  }
  if (rel === "AGENTS.md" && existsSync(absolute)) {
    const current = readFileSync(absolute, "utf8");
    if (touchesManagedBlock(current, edit)) {
      return { decision: "deny", rule: "harness", reason: "Las reglas del harness (entre harness:inicio y harness:fin) se cambian en el repositorio del harness. Edita la sección del proyecto." };
    }
  }
  const secrets = findSecrets(edit.text ?? "");
  if (secrets.length > 0 && !/\.(example|sample)$/.test(name)) {
    return { decision: "deny", rule: "secreto-en-codigo", reason: `El texto trae un secreto (${secrets[0].tipo}). Va en el .env y el código lee la variable de entorno; si es una variable nueva, agrégala a .env.example sin valor.` };
  }
  // Repositorio público: lo interno (direcciones, rutas del servidor) no se publica.
  for (const patron of config.publico === true ? (config.noPublicar ?? []) : []) {
    let re;
    try {
      re = new RegExp(patron, "i");
    } catch {
      continue;
    }
    const hallado = re.exec(edit.text ?? "");
    if (hallado) return { decision: "deny", rule: "repo-publico", reason: `Este repositorio es público y el texto trae un dato interno («${hallado[0].slice(0, 40)}»). Las direcciones, rutas y configuración de los servidores van en el repositorio privado.` };
  }
  // Lo que otro equipo mantiene a mano en producción.
  if (coincide(rel, config.produccion?.rutasDeTerceros)) {
    return { decision: "ask", rule: "ruta-de-terceros", reason: config.produccion?.motivoTerceros ?? "Esa ruta la mantiene otro equipo directamente en producción. Cualquier cambio ahí se acuerda antes con ellos." };
  }
  // El modelo de la sesión tiene que alcanzar para el riesgo de la ruta.
  const nivel = nivelDeRuta(rel, config);
  const tabla = orquestacion ?? leerOrquestacion(root, config);
  if (modelo && !modeloAlcanza(modelo, nivel, tabla)) {
    const pide = tabla.niveles[nivel];
    return {
      decision: "ask",
      rule: "modelo-por-riesgo",
      reason: `${rel} es de riesgo ${nivel} y esta sesión corre con ${modelo}. Para esa ruta el proyecto pide ${pide.modeloMinimo} o superior (recomendado: ${pide.modelo}, esfuerzo ${pide.esfuerzo}). Cambia con /model y /effort, o delega el cambio a un subagente con ese modelo.`,
    };
  }
  return null;
}

function main() {
  const payload = readPayload();
  const agent = agentName();
  const root = projectDir(payload);
  const config = readProjectConfig(root);
  const modelo = modeloDeSesion(root, payload?.session_id ?? payload?.sessionId);
  for (const edit of edits(payload)) {
    const verdict = check(edit, root, { config, modelo });
    if (!verdict) continue;
    if (verdict.decision === "deny") deny(root, payload, agent, verdict.reason, verdict.rule);
    ask(root, payload, agent, verdict.reason, verdict.rule);
  }
  process.exit(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
export { dirname };
