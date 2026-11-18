#!/usr/bin/env node
// Hooks de git del proyecto. Valen igual para personas y para agentes.
//   pre-commit: sin archivos de secretos, sin secretos reconocibles, sin datos
//               internos en un repositorio público; gitleaks si está instalado
//   commit-msg: una primera línea que se entienda; sin coautoría ni marca de
//               herramienta (salvo que el proyecto la permita)
//   pre-push:   sin push forzado a la rama principal del repositorio; sin push
//               directo cuando se entrega por pull request (salvo urgencia
//               declarada). El remoto de despliegue no entra en esta regla.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findSecrets, isSecretFile } from "../hooks/patrones.mjs";

const PROTECTED = /^refs\/heads\/(main|master)$/;
const ZERO = /^0+$/;

function git(args, options = {}) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options });
}

function fail(lines) {
  process.stderr.write(`\nHarness: ${lines.join("\n")}\n\n`);
  process.exit(1);
}

const MARCA_DE_HERRAMIENTA = /^\s*co-authored-by:|generated with \[?claude|🤖/im;

export function checkMessage(message, config = {}) {
  const lines = message.split(/\r?\n/).filter((line) => !line.startsWith("#"));
  const first = lines.find((line) => line.trim()) ?? "";
  if (/^(Merge|Revert|fixup!|squash!|amend!)/.test(first)) return null;
  if (first.trim().length < 10) return ["el mensaje no dice qué cambió. Una primera línea que se entienda sola, en el idioma del proyecto."];
  if (first.length > 100) return ["la primera línea del mensaje pasa de 100 caracteres; resume y deja el detalle abajo."];
  if (config.coautoria !== true && MARCA_DE_HERRAMIENTA.test(lines.join("\n"))) {
    return ["el mensaje lleva una línea de coautoría o una marca de herramienta.", "En este proyecto los commits van a nombre de quien los firma. Quita esa línea."];
  }
  return null;
}

/** Datos internos que no van a un repositorio público, en las líneas agregadas. */
export function internalData(added, config = {}) {
  if (config.publico !== true) return [];
  const found = [];
  for (const patron of config.noPublicar ?? []) {
    let re;
    try {
      re = new RegExp(patron, "i");
    } catch {
      continue;
    }
    const m = re.exec(added);
    if (m) found.push(m[0].slice(0, 40));
  }
  return found;
}

function gitleaks(root) {
  // gitleaks con las reglas del repositorio, si está instalado. Sin él, quedan
  // los patrones del harness y el CI, que sí lo corre siempre.
  try {
    execFileSync("gitleaks", ["version"], { stdio: "ignore" });
  } catch {
    return null;
  }
  try {
    execFileSync("gitleaks", ["git", "--pre-commit", "--staged", "--redact", "--no-banner"], { cwd: root, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
    return null;
  } catch (e) {
    return String(e?.stdout || e?.stderr || e?.message || "").trim().split("\n").slice(-25).join("\n");
  }
}

function preCommit() {
  const config = readConfig();
  const staged = git(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"]).split("\0").filter(Boolean);
  const problems = [];
  for (const file of staged) {
    if (isSecretFile(file)) problems.push(`  ${file}: archivo de secretos (sácalo con «git restore --staged ${file}» y agrégalo a .gitignore)`);
  }
  for (const file of staged) {
    if (isSecretFile(file)) continue;
    let added = "";
    try {
      added = git(["diff", "--cached", "--unified=0", "--no-color", "--", file])
        .split("\n").filter((line) => line.startsWith("+") && !line.startsWith("+++")).map((line) => line.slice(1)).join("\n");
    } catch {
      continue;
    }
    for (const secret of findSecrets(added)) {
      if (secret.severidad === "critica") problems.push(`  ${file}: ${secret.tipo} (${secret.muestra})`);
    }
    // Los patrones de lo que no se publica viven en .harness/: ahí no se buscan.
    if (!file.startsWith(".harness/")) for (const dato of internalData(added, config)) problems.push(`  ${file}: dato interno en un repositorio público («${dato}»)`);
  }
  if (problems.length > 0) {
    fail(["este commit lleva secretos o datos internos. No se sube:", ...problems, "Los secretos van en el .env y el código lee la variable. Si fue un falso positivo, cambia el texto de ejemplo para que lo diga (ejemplo, fake)."]);
  }
  const hallazgos = gitleaks(git(["rev-parse", "--show-toplevel"]).trim());
  if (hallazgos) fail(["gitleaks encontró secretos en lo que se va a guardar:", hallazgos]);
}

function commitMsg(file) {
  const problem = checkMessage(readFileSync(file, "utf8"), readConfig());
  if (problem) fail(problem);
}

function readConfig() {
  try {
    const root = git(["rev-parse", "--show-toplevel"]).trim();
    return JSON.parse(readFileSync(join(root, ".harness", "proyecto.json"), "utf8"));
  } catch {
    return {};
  }
}

/**
 * Qué hacer con cada ref que se sube: null o el motivo del rechazo.
 * `urgente` (HARNESS_URGENTE=1) deja pasar el push directo a la rama principal
 * de un arreglo pequeño y urgente, como el revert de una vuelta atrás.
 */
export function checkPush({ remote, remoteRef, forced, config = {}, urgente = false }) {
  if (!PROTECTED.test(remoteRef ?? "")) return null;
  const rama = remoteRef.replace("refs/heads/", "");
  // El remoto de despliegue recibe la rama principal tal cual, y una vuelta atrás forzada.
  if ((config.produccion?.remotos ?? []).includes(remote)) return null;
  if (forced) return [`ese push reescribe ${rama} (push forzado). En la rama principal del repositorio no se hace: usa git revert.`];
  if (config.entrega !== "directa" && !urgente) {
    return [`este proyecto entrega por pull request; no se sube directo a ${rama}.`, "Crea una rama, súbela y abre el PR. Para un arreglo pequeño y urgente (el revert de una vuelta atrás): HARNESS_URGENTE=1 git push …"];
  }
  return null;
}

function prePush(input, remote) {
  const config = readConfig();
  for (const line of input.split("\n").filter(Boolean)) {
    const [, localSha, remoteRef, remoteSha] = line.split(" ");
    if (ZERO.test(localSha ?? "")) continue;
    let forced = false;
    if (!ZERO.test(remoteSha ?? "")) {
      try {
        git(["merge-base", "--is-ancestor", remoteSha, localSha], { stdio: "ignore" });
      } catch {
        forced = true;
      }
    }
    const problem = checkPush({ remote, remoteRef, forced, config, urgente: process.env.HARNESS_URGENTE === "1" });
    if (problem) fail(problem);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const [hook, arg] = process.argv.slice(2);
  if (hook === "pre-commit") preCommit();
  else if (hook === "commit-msg") commitMsg(arg);
  else if (hook === "pre-push") prePush(readFileSync(0, "utf8"), arg);
}
