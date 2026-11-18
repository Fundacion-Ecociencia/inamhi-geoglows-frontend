// What every harness hook shares: reading the agent's payload, finding the
// project, answering allow/deny/ask in a way both Claude Code and Codex
// understand, and writing to the project's log (bitácora).

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
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
