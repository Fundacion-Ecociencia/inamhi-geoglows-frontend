#!/usr/bin/env node
// Observability: records what the agent did in .harness/bitacora/, one JSON
// line per event. Runs after every tool (PostToolUse), at the start of a
// session (SessionStart) and when the agent ends its turn (Stop).
// On session start it also makes sure the company git hooks are active.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { agentName, describe, log, modeloDeTranscripcion, projectDir, readPayload, readProjectConfig, toolInput, toolName } from "./comun.mjs";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

function ensureGitHooks(root) {
  if (!existsSync(join(root, ".harness", "git-hooks"))) return null;
  try {
    const current = execFileSync("git", ["config", "core.hooksPath"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (current === ".harness/git-hooks") return null;
  } catch {
    // Not set yet.
  }
  // Solo cuando la rama principal ya trae el harness: si se activaran antes, al
  // volver a una rama sin .harness/ git no encontraría ningún hook y el control
  // de secretos que hubiera en .git/hooks dejaría de correr.
  try {
    const principal = readProjectConfig(root).ramaPrincipal ?? "main";
    execFileSync("git", ["cat-file", "-e", `origin/${principal}:.harness/git-hooks/pre-commit`], { cwd: root, stdio: "ignore" });
  } catch {
    return null;
  }
  try {
    execFileSync("git", ["config", "core.hooksPath", ".harness/git-hooks"], { cwd: root, stdio: "ignore" });
    return "hooks de git activados";
  } catch {
    return null;
  }
}

function outcome(payload) {
  const response = payload?.tool_response ?? payload?.toolResponse;
  if (!response || typeof response !== "object") return undefined;
  if (response.is_error === true || response.isError === true || response.error) return "error";
  if (response.interrupted === true) return "interrumpido";
  if (typeof response.exitCode === "number" && response.exitCode !== 0) return "error";
  return "ok";
}

function main() {
  const payload = readPayload();
  const agent = agentName();
  const root = projectDir(payload);
  const event = argument("--evento") ?? payload?.hook_event_name ?? "herramienta";
  const base = { agente: agent, sesion: payload?.session_id ?? payload?.sessionId };

  if (event === "inicio" || event === "SessionStart") {
    const note = ensureGitHooks(root);
    log(root, { ...base, evento: "inicio_sesion", origen: payload?.source, modelo: payload?.model, detalle: note ?? undefined });
  } else if (event === "fin" || event === "Stop") {
    log(root, { ...base, evento: "fin_turno" });
  } else {
    const input = toolInput(payload);
    log(root, {
      ...base,
      evento: "herramienta",
      herramienta: toolName(payload),
      modelo: modeloDeTranscripcion(payload) ?? undefined,
      esfuerzo: payload?.effort?.level,
      subagente: input?.subagent_type,
      archivo: input?.file_path ?? input?.notebook_path,
      resultado: outcome(payload),
      detalle: describe(payload),
    });
  }
  process.exit(0);
}

main();
