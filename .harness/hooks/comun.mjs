// What every harness hook shares: reading the agent's payload, finding the
// project, answering allow/deny/ask in a way both Claude Code and Codex
// understand, and writing to the project's log (bitácora).

import { appendFileSync, closeSync, existsSync, fstatSync, mkdirSync, openSync, readFileSync, readSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { redact } from "./patrones.mjs";

/** `--agente claude|codex` as passed by the config that runs the hook. */
export function agentName(argv = process.argv) {
  const index = argv.indexOf("--agente");
  if (index !== -1 && argv[index + 1]) return argv[index + 1];
  return process.env.CLAUDE_PROJECT_DIR ? "claude" : "otro";
}

export function readPayload() {
  try {
    const raw = readFileSync(0, "utf8");
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** The project root: the agent's project dir, else the git top level. */
export function projectDir(payload) {
  if (process.env.CLAUDE_PROJECT_DIR) return resolve(process.env.CLAUDE_PROJECT_DIR);
  const start = payload?.cwd ? resolve(payload.cwd) : process.cwd();
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: start, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return start;
  }
}

/** El modelo que nombra una línea de la transcripción, o null. */
function modeloDeLinea(linea) {
  if (!linea.includes("model")) return null;
  let e;
  try {
    e = JSON.parse(linea);
  } catch {
    return null; // Una línea cortada al principio del tramo leído.
  }
  let modelo = null;
  if (e?.type === "assistant" && e.isSidechain !== true) modelo = e.message?.model;
  // La petición al modelo queda escrita antes que su respuesta: es lo único
  // que hay en la primera acción de una sesión. Las peticiones auxiliares
  // (subagentes, resúmenes, títulos) no cuentan.
  else if (e?.type === "api-request" && !/agent|compact|summar|title|classif|hook/i.test(String(e.querySource ?? ""))) modelo = e.params?.model;
  else if (e?.type === "attachment" && e.attachment?.type === "model") modelo = e.attachment.identity?.modelId;
  return typeof modelo === "string" && modelo && !modelo.startsWith("<") ? modelo : null;
}

function ultimoModelo(ruta, desde, largo) {
  let fd;
  try {
    fd = openSync(ruta, "r");
    const buffer = Buffer.alloc(largo);
    readSync(fd, buffer, 0, largo, desde);
    const lineas = buffer.toString("utf8").split("\n");
    for (let i = lineas.length - 1; i >= 0; i -= 1) {
      const modelo = modeloDeLinea(lineas[i]);
      if (modelo) return modelo;
    }
  } catch {
    // Sin transcripción no se sabe.
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
  return null;
}

/**
 * El modelo que está respondiendo en esta sesión. Claude Code no lo manda en
 * la entrada de los hooks, pero lo deja escrito en la transcripción
 * (`transcript_path`): en cada petición, en cada respuesta y al empezar. Se
 * toma lo último, así que también se ve un cambio hecho con /model. Devuelve
 * null si no se puede saber.
 */
export function modeloDeTranscripcion(payload, { cola = 2_000_000, maximo = 40_000_000 } = {}) {
  const ruta = payload?.agent_transcript_path ?? payload?.transcript_path;
  if (!ruta) return null;
  let size;
  try {
    const fd = openSync(ruta, "r");
    size = fstatSync(fd).size;
    closeSync(fd);
  } catch {
    return null;
  }
  const largo = Math.min(size, cola);
  const enLaCola = ultimoModelo(ruta, size - largo, largo);
  if (enLaCola || size <= cola) return enLaCola;
  const todo = Math.min(size, maximo);
  return ultimoModelo(ruta, size - todo, todo);
}

export function toolName(payload) {
  return payload?.tool_name ?? payload?.toolName ?? payload?.tool ?? "";
}

export function toolInput(payload) {
  return payload?.tool_input ?? payload?.toolInput ?? payload?.input ?? {};
}

/** The shell command, whether it arrives as a string or as argv. */
export function shellCommand(payload) {
  const input = toolInput(payload);
  const command = input?.command ?? input?.cmd ?? payload?.command ?? "";
  if (Array.isArray(command)) {
    // Codex sends ["bash", "-lc", "<script>"]; the script is what matters.
    const flag = command.findIndex((part) => part === "-c" || part === "-lc");
    return flag !== -1 && command[flag + 1] ? command[flag + 1] : command.join(" ");
  }
  return String(command);
}

export function readProjectConfig(root) {
  try {
    return JSON.parse(readFileSync(join(root, ".harness", "proyecto.json"), "utf8"));
  } catch {
    return {};
  }
}

export function currentBranch(root) {
  try {
    return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

/** One JSON line in `.harness/bitacora/AAAA-MM-DD.jsonl`. Never throws. */
export function log(root, entry) {
  try {
    const now = new Date();
    const day = now.toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" });
    const dir = join(root, ".harness", "bitacora");
    if (!existsSync(join(root, ".harness"))) return;
    mkdirSync(dir, { recursive: true });
    const line = JSON.stringify({ ts: now.toISOString(), ...entry, detalle: entry.detalle ? redact(entry.detalle).slice(0, 400) : undefined });
    appendFileSync(join(dir, `${day}.jsonl`), `${line}\n`);
  } catch {
    // Logging must never block the agent.
  }
}

/**
 * Refuses the action. Exit code 2 blocks the tool call in Claude Code and in
 * Codex, and the message goes back to the agent so it can change course.
 */
export function deny(root, payload, agent, reason, rule) {
  log(root, { evento: "bloqueado", agente: agent, sesion: payload?.session_id, herramienta: toolName(payload), regla: rule, detalle: describe(payload) });
  process.stderr.write(`Bloqueado por el harness (${rule}): ${reason}\n`);
  process.exit(2);
}

/**
 * Asks a person first. Claude Code shows its approval prompt; agents that
 * cannot ask get a refusal that tells them to hand the step to a person.
 */
export function ask(root, payload, agent, reason, rule) {
  if (agent !== "claude") {
    deny(root, payload, agent, `${reason} Este paso lo aprueba y lo ejecuta una persona.`, rule);
  }
  log(root, { evento: "pregunta", agente: agent, sesion: payload?.session_id, herramienta: toolName(payload), regla: rule, detalle: describe(payload) });
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: `Harness (${rule}): ${reason}`,
    },
  }));
  process.exit(0);
}

/** A short, loggable description of the tool call. */
export function describe(payload) {
  const input = toolInput(payload);
  const command = shellCommand(payload);
  if (command) return command;
  return String(input?.file_path ?? input?.path ?? input?.notebook_path ?? input?.pattern ?? input?.url ?? input?.description ?? "");
}

export { dirname };
