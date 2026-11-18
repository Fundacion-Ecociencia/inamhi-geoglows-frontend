#!/usr/bin/env node
// Resumen de la bitácora: qué hicieron los agentes en este proyecto.
//   node .harness/bin/bitacora.mjs              hoy
//   node .harness/bin/bitacora.mjs --dias 7     últimos 7 días
//   node .harness/bin/bitacora.mjs --sesion ID  una sesión
//   node .harness/bin/bitacora.mjs --json       datos para máquinas

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index !== -1 ? process.argv[index + 1] : fallback;
}

function projectRoot() {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return process.cwd();
  }
}

export function readEntries(root, days, now = new Date()) {
  const dir = join(root, ".harness", "bitacora");
  if (!existsSync(dir)) return [];
  const since = new Date(now.getTime() - (days - 1) * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" });
  const entries = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".jsonl") && f.slice(0, 10) >= since).sort()) {
    for (const line of readFileSync(join(dir, file), "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        entries.push(JSON.parse(line));
      } catch {
        // A cut line (agent killed mid-write) is skipped.
      }
    }
  }
  return entries;
}

export function summarize(entries, root) {
  const sessions = new Map();
  const tools = new Map();
  const files = new Map();
  const commands = new Map();
  const blocked = [];
  const asked = [];
  let errors = 0;
  for (const entry of entries) {
    const id = entry.sesion ?? "sin-sesion";
    if (!sessions.has(id)) sessions.set(id, { agente: entry.agente, desde: entry.ts, hasta: entry.ts, acciones: 0 });
    const session = sessions.get(id);
    session.hasta = entry.ts;
    if (entry.evento === "herramienta") {
      session.acciones += 1;
      tools.set(entry.herramienta, (tools.get(entry.herramienta) ?? 0) + 1);
      if (entry.archivo && /^(Write|Edit|MultiEdit|NotebookEdit)$/.test(entry.herramienta)) {
        const path = entry.archivo.startsWith("/") ? relative(root, entry.archivo) : entry.archivo;
        files.set(path, (files.get(path) ?? 0) + 1);
      }
      if (entry.herramienta === "Bash" && entry.detalle) {
        const head = entry.detalle.trim().split(/\s+/).slice(0, 2).join(" ");
        commands.set(head, (commands.get(head) ?? 0) + 1);
      }
      if (entry.resultado === "error") errors += 1;
    }
    if (entry.evento === "bloqueado") blocked.push(entry);
    if (entry.evento === "pregunta") asked.push(entry);
  }
  const top = (map, n) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  return {
    sesiones: [...sessions.entries()].map(([id, s]) => ({ id, ...s })),
    acciones: entries.filter((e) => e.evento === "herramienta").length,
    herramientas: top(tools, 10),
    archivos: top(files, 15),
    comandos: top(commands, 10),
    bloqueos: blocked.map((e) => ({ ts: e.ts, regla: e.regla, detalle: e.detalle })),
    preguntas: asked.map((e) => ({ ts: e.ts, regla: e.regla, detalle: e.detalle })),
    errores: errors,
  };
}

export function render(summary, days) {
  const lines = [];
  lines.push(`Bitácora de agentes (${days === 1 ? "hoy" : `últimos ${days} días`})`);
  lines.push(`Sesiones: ${summary.sesiones.length} · acciones: ${summary.acciones} · errores de herramientas: ${summary.errores}`);
  lines.push(`Bloqueos del harness: ${summary.bloqueos.length} · pedidos de aprobación: ${summary.preguntas.length}`);
  if (summary.archivos.length) {
    lines.push("", "Archivos más editados:");
    for (const [file, count] of summary.archivos) lines.push(`  ${count}× ${file}`);
  }
  if (summary.comandos.length) {
    lines.push("", "Comandos más usados:");
    for (const [command, count] of summary.comandos) lines.push(`  ${count}× ${command}`);
  }
  if (summary.bloqueos.length) {
    lines.push("", "Lo que el harness bloqueó:");
    for (const block of summary.bloqueos.slice(-20)) lines.push(`  ${block.ts.slice(0, 16)} [${block.regla}] ${block.detalle ?? ""}`);
  }
  if (summary.preguntas.length) {
    lines.push("", "Lo que pidió aprobación:");
    for (const question of summary.preguntas.slice(-20)) lines.push(`  ${question.ts.slice(0, 16)} [${question.regla}] ${question.detalle ?? ""}`);
  }
  if (summary.acciones === 0 && summary.bloqueos.length === 0) lines.push("", "No hay registros en ese periodo.");
  return lines.join("\n");
}

function main() {
  const root = projectRoot();
  const days = Math.max(1, Number(option("--dias", "1")) || 1);
  const session = option("--sesion");
  let entries = readEntries(root, days);
  if (session) entries = entries.filter((e) => e.sesion === session);
  const summary = summarize(entries, root);
  process.stdout.write(process.argv.includes("--json") ? `${JSON.stringify(summary, null, 2)}\n` : `${render(summary, days)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
