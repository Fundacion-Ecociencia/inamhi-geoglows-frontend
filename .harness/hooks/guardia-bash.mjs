#!/usr/bin/env node
// PreToolUse guard for shell commands. Each rule either refuses the command
// (deny) or asks a person first (ask). Everything else passes.

import { homedir, tmpdir } from "node:os";
import { relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { agentName, ask, currentBranch, deny, projectDir, readPayload, readProjectConfig, shellCommand } from "./comun.mjs";
import { isSecretFile, realPath } from "./patrones.mjs";
import { esProduccion } from "./proyecto.mjs";
import { clasificarRemoto, comandosSimples, conexionesSsh, revisarSql, sinPrefijos, sqlDePsql } from "./remoto.mjs";

const PROTECTED = /^(main|master)$/;
const SECRET_NAME = String.raw`[A-Z0-9_]*(KEY|SECRET|TOKEN|PASSWORD|PRIVATE)[A-Z0-9_]*`;

/** Splits `a && b; c | d` into its simple commands. */
export function segments(command) {
  return command.split(/&&|\|\||;|\||\n/).map((part) => part.trim()).filter(Boolean);
}

/** Words of a simple command, without quotes. Good enough for flags/paths. */
function words(segment) {
  return (segment.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map((w) => w.replace(/^["']|["']$/g, ""));
}

function isUnder(path, dir) {
  const rel = relative(dir, path);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith(sep) && rel !== "..");
}

const SCRATCH = [tmpdir(), "/tmp", "/private/tmp", "/var/folders", "/private/var/folders"];

/** Why removing these paths is dangerous, or null. */
export function dangerousRemoval(args, root) {
  for (const raw of args) {
    if (raw.startsWith("-")) continue;
    if (raw === "*" || raw === ".*") return "Ese borrado alcanza todo lo que hay en la carpeta. Borra rutas concretas.";
    let path = raw.replace(/^~(?=\/|$)/, homedir()).replace(/^\$\{?HOME\}?(?=\/|$)/, homedir()).replace(/^\$\{?TMPDIR\}?/, tmpdir());
    if (path.startsWith("$")) return "Ese borrado usa una variable; escribe la ruta concreta.";
    const absolute = realPath(resolve(root, path));
    if (SCRATCH.some((dir) => isUnder(absolute, realPath(dir)) && absolute !== realPath(dir))) continue;
    if (isUnder(root, absolute)) return "Ese borrado alcanza la carpeta del proyecto o una carpeta que la contiene.";
    if (!isUnder(absolute, root)) return "Ese borrado está fuera del proyecto. Un agente solo borra dentro del proyecto o en carpetas temporales.";
    if (isUnder(absolute, resolve(root, ".git"))) return "No se borra el historial de git.";
  }
  return null;
}

const READERS = new Set(["cat", "less", "more", "head", "tail", "bat", "base64", "xxd", "od", "strings", "grep", "rg", "awk", "sed", "open", "cp", "scp", "rsync", "curl"]);
const COPIERS = new Set(["cp", "scp", "rsync"]);

/** Does this simple command read or copy out a secret file? */
export function readsSecretFile(segment) {
  const w = words(segment).map((word) => word.replace(/^(\$\(|\(|`)+/, ""));
  for (let i = 0; i < w.length; i += 1) {
    if (!READERS.has(w[i])) continue;
    const args = w.slice(i + 1).filter((a) => !a.startsWith("-"));
    const candidates = COPIERS.has(w[i]) ? args.slice(0, -1) : args; // a copy's last argument is where it goes
    // curl -F file=@.env / -d @.env: the file is what follows the @.
    // host:ruta de scp y rsync: lo que cuenta es la ruta.
    if (candidates.some((a) => isSecretFile((a.includes("@") ? a.slice(a.lastIndexOf("@") + 1) : a).replace(/^[\w.-]+:/, "")))) return true;
  }
  return false;
}

/** Where `git push <args>` sends the current work, as far as we can tell. */
export function pushTargets(args, branch) {
  const positional = args.filter((a) => !a.startsWith("-"));
  const refspecs = positional.slice(1); // [remote, ...refspecs]
  if (refspecs.length === 0) return [branch];
  return refspecs.map((spec) => {
    const target = spec.replace(/^\+/, "").split(":").pop();
    return target === "HEAD" ? branch : target.replace(/^refs\/heads\//, "");
  });
}

/** `git push`: el remoto y si es forzado. */
function push(segment) {
  const args = words(segment).slice(2);
  const positional = args.filter((a) => !a.startsWith("-"));
  return {
    args,
    remote: positional[0] ?? "origin",
    forced: args.some((a) => /^(--force|-f|--force-with-lease|--force-if-includes)(=|$)/.test(a)) || positional.slice(1).some((a) => /^\+/.test(a)),
  };
}

const esRemotoDeProduccion = (remote, config) => (config?.produccion?.remotos ?? []).includes(remote);

/** ¿Este scp/rsync copia hacia un servidor de producción? Devuelve el destino o null. */
function copiaAProduccion(w, config) {
  const args = w.slice(1).filter((a) => !a.startsWith("-"));
  const destino = args[args.length - 1] ?? "";
  const m = /^([^:/]+):(.*)$/.exec(destino);
  return m && esProduccion(m[1], config) ? { host: m[1], ruta: m[2] } : null;
}

/**
 * Las reglas, en orden: primero las que niegan, después las que preguntan.
 * `c` es el comando entero; `local` es lo mismo sin lo que corre dentro de un
 * ssh a producción (eso lo revisa `clasificarRemoto`); `segs` sale de `local`.
 */
export const RULES = [
  {
    id: "sin-saltar-controles",
    decision: "deny",
    test: ({ segs }) => segs.some((s) => /^git\s+(commit|push|merge|rebase|am|cherry-pick)\b/.test(s) && words(s).some((w) => w === "--no-verify" || (/^git\s+commit\b/.test(s) && /^-[a-zA-Z]*n[a-zA-Z]*$/.test(w))))
      ? "--no-verify salta los controles del proyecto. Arregla lo que el control señala." : null,
  },
  {
    id: "hooks-de-git",
    decision: "deny",
    test: ({ c }) => {
      const message = "Los hooks de git del proyecto viven en .harness/git-hooks y no se cambian ni se saltan.";
      const company = /^["']?\.harness\/git-hooks\/?["']?$/;
      for (const m of c.matchAll(/\bgit\b[^;&|]*?\s-c\s*["']?core\.hooksPath\s*=\s*(\S*)/gi)) {
        if (!company.test(m[1])) return message;
      }
      for (const m of c.matchAll(/\bgit\s+config\b([^;&|]*?)\bcore\.hooksPath\b([^;&|]*)/gi)) {
        const options = m[1];
        const value = m[2].trim();
        const removes = /--unset(-all)?\b|(^|\s)unset\b/.test(options);
        if (!removes && /--get(-all|-regexp)?\b|--list\b|(^|\s)(-l|get|list)\b/.test(options)) continue;
        if (!removes && !value) continue;
        if (!removes && company.test(value)) continue;
        return message;
      }
      return null;
    },
  },
  {
    // 13 oct 2026: `sed … | crontab -` instaló un crontab vacío porque el sed falló.
    id: "crontab-por-tuberia",
    decision: "deny",
    test: ({ c }) => {
      if (/\|\s*(sudo\s+)?crontab\s+(-u\s+\S+\s+)?-(\s|$|["')])/.test(c)) return "Nunca `comando | crontab -`: si el comando falla, queda un crontab vacío. Respaldo con `crontab -l > archivo`, versión nueva en otro archivo, comprobar el número de líneas y cuántas cambian, y recién entonces `crontab archivo`.";
      if (/\bcrontab\s+(-u\s+\S+\s+)?-r\b/.test(c)) return "`crontab -r` borra todas las rutinas programadas.";
      return null;
    },
  },
  {
    // 13 oct 2026: `source .env` imprimió una clave; el .env tiene valores con `$`.
    id: "cargar-env",
    decision: "deny",
    test: ({ c }) => /(^|[;&|({"'`]\s*|\bset\s+-a\b[^\n]*?)(source|\.)\s+["']?[^\s;&|"']*\.env\b(?!\.(example|sample|template))/.test(c)
      ? "El .env no se carga con `source`: tiene valores con `$` y termina mostrando secretos. Lee cada variable por separado (`sed -n 's/^NOMBRE=//p'` dentro de una asignación) o usa python-dotenv." : null,
  },
  {
    id: "leer-secretos",
    decision: "deny",
    test: ({ c, segs }) => {
      if (segs.some(readsSecretFile)) return "Ese archivo guarda secretos. Usa las variables de entorno, sin leer ni copiar el archivo.";
      if (segs.some((s) => /^(printenv|env|set|export\s+-p|declare\s+-x)$/.test(s))) return "Eso imprime todas las variables de entorno, incluidos los secretos.";
      if (new RegExp(String.raw`\b(echo|printf)\b[^;&|]*\$\{?` + SECRET_NAME).test(c) || new RegExp(String.raw`\bprintenv\s+` + SECRET_NAME).test(c)) {
        return "No se imprimen secretos en la terminal: solo longitudes, conteos o valores enmascarados.";
      }
      return null;
    },
  },
  {
    id: "subir-secretos",
    decision: "deny",
    test: ({ segs }) => segs.some((s) => /^git\s+add\b/.test(s) && words(s).slice(2).some((a) => !a.startsWith("-") && isSecretFile(a)))
      ? "Ese archivo guarda secretos y no se sube al repositorio." : null,
  },
  {
    id: "atribucion",
    decision: "deny",
    test: ({ c, config }) => {
      if (config.coautoria === true) return null;
      if (/\bgit\s+(commit|merge|tag|notes)\b/.test(c) && /co-authored-by:|generated with \[?claude|🤖/i.test(c)) {
        return "En este proyecto los commits van a nombre de quien los firma, sin línea de coautoría ni marca de herramienta.";
      }
      if (/\bgh\s+(pr|issue)\s+(create|edit|comment|review)\b/.test(c) && /generated with \[?claude|co-authored-by:|🤖/i.test(c)) {
        return "Los pull requests los firma una persona: sin marca de herramienta ni coautoría en el texto.";
      }
      return null;
    },
  },
  {
    id: "push-forzado",
    decision: "deny",
    test: ({ segs, branch, config }) => {
      for (const s of segs.filter((s) => /^git\s+push\b/.test(s))) {
        const p = push(s);
        if (p.forced && !esRemotoDeProduccion(p.remote, config) && pushTargets(p.args, branch).some((t) => PROTECTED.test(t))) {
          return "Nunca se fuerza un push a la rama principal del repositorio: reescribe lo que otros ya tienen. Para deshacer un cambio fusionado se usa `git revert`.";
        }
      }
      return null;
    },
  },
  {
    id: "borrado-peligroso",
    decision: "deny",
    test: ({ segs, root }) => {
      for (const s of segs) {
        const w = words(s);
        const rmAt = w.findIndex((x) => x === "rm");
        if (rmAt === -1) continue;
        const args = w.slice(rmAt + 1);
        if (!args.some((a) => /^-[a-zA-Z]*[rR]/.test(a) || a === "--recursive")) continue;
        const reason = dangerousRemoval(args, root);
        if (reason) return reason;
      }
      return null;
    },
  },
  {
    // «Sigue el estilo del archivo que editas»: reformatear todo esconde el cambio y toca la deuda heredada.
    id: "formato-masivo",
    decision: "deny",
    test: ({ segs, c }) => {
      if (/git\s+diff\b[^;&|]*--name-only/.test(c)) return null;
      for (const s of segs) {
        const w = words(s);
        const at = w.findIndex((x, i) => ["black", "autopep8", "isort", "yapf", "autoflake"].includes(x) || (x === "format" && w[i - 1] === "ruff") || (x === "--fix" && w.includes("ruff")));
        if (at !== -1 && !w.some((x) => ["--check", "--diff"].includes(x))) {
          const args = w.slice(w.findIndex((x) => ["black", "autopep8", "isort", "yapf", "autoflake", "ruff"].includes(x)) + 1).filter((a) => !a.startsWith("-") && !["format", "check"].includes(a));
          if (args.length === 0 || args.some((a) => !/\.pyi?$/.test(a))) {
            return "Formatea solo los archivos que cambiaste. Reformatear carpetas enteras esconde el cambio real y toca código heredado que no se arregla sin decisión.";
          }
        }
        if (/\b(prettier|biome|eslint)\b/.test(s) && w.some((x) => ["--write", "-w", "--fix"].includes(x))) {
          const args = w.slice(w.findIndex((x) => /prettier|biome|eslint/.test(x)) + 1).filter((a) => !a.startsWith("-") && a !== "format" && a !== "check");
          if (args.length === 0 || args.some((a) => a === "." || a.endsWith("/") || a.includes("*"))) {
            return "Formatea o corrige solo los archivos que cambiaste, no carpetas enteras.";
          }
        }
      }
      return null;
    },
  },
  {
    id: "script-de-internet",
    decision: "deny",
    test: ({ c }) => /\b(curl|wget)\b[^|;&]*\|\s*(sudo\s+)?(ba|z|da)?sh\b/.test(c)
      ? "No se ejecutan scripts bajados de internet directo en la terminal. Bájalo, léelo y pide aprobación." : null,
  },
  {
    id: "borrar-repositorio",
    decision: "deny",
    test: ({ c }) => /\bgh\s+repo\s+delete\b|\bgit\s+branch\s+-D\s+(main|master)\b|\bgit\s+push\s+\S+\s+(--delete\s+|:)(main|master)\b/.test(c)
      ? "Borrar un repositorio o la rama principal no lo hace un agente." : null,
  },
  {
    id: "copia-a-produccion",
    decision: "deny",
    test: ({ simples, config }) => {
      for (const sc of simples) {
        const w = sinPrefijos(sc.filter((t) => t.t === "w").map((t) => t.v));
        if (!["scp", "rsync", "sftp"].includes(w[0])) continue;
        const destino = copiaAProduccion(w, config);
        if (!destino) continue;
        if (w[0] === "rsync" && w.some((a) => /^--delete/.test(a) || a === "--remove-source-files")) {
          return "`rsync --delete` hacia producción borra lo que no viene del repositorio (versiones anteriores, archivos subidos a mano). Copia sin --delete.";
        }
        if ((config?.produccion?.rutasDeTerceros ?? []).some((r) => destino.ruta.includes(r.replace(/\/\*\*?$/, "").replace(/\/+$/, "")))) {
          return config?.produccion?.motivoTerceros ?? "Esa ruta la mantiene otro equipo directamente en el servidor. No se sobrescribe; cualquier cambio se acuerda antes con ellos.";
        }
      }
      return null;
    },
  },
  {
    // Lo que corre dentro de un ssh a producción: lectura pasa, lo demás se pregunta o se niega.
    id: "produccion",
    decision: "variable",
    test: ({ ssh, config }) => {
      let peor = null;
      for (const s of ssh) {
        let v;
        if (s.porEntrada) v = { decision: "ask", rule: "produccion-escritura", reason: "Ese ssh recibe el comando por la entrada estándar y no se puede ver qué corre en producción. Pásalo como argumento." };
        else if (s.remoto === null) v = { decision: "ask", rule: "produccion-escritura", reason: "Eso abre una sesión interactiva en un servidor de producción. Pasa el comando como argumento para que se pueda revisar." };
        else v = clasificarRemoto(s.remoto, config);
        if (v?.decision === "deny") return v;
        if (v && !peor) peor = v;
      }
      return peor;
    },
  },
  {
    id: "base-de-produccion",
    decision: "variable",
    test: ({ simples, config }) => {
      for (const sc of simples) {
        const w = sinPrefijos(sc.filter((t) => t.t === "w").map((t) => t.v));
        if (!["psql", "pg_dump", "pg_restore", "pg_dumpall", "dropdb", "createdb"].includes(w[0])) continue;
        const hosts = config?.produccion?.hosts ?? [];
        const apunta = w.some((a, i) => ((w[i - 1] === "-h" || w[i - 1] === "--host") && esProduccion(a, config)) || hosts.some((h) => !h.includes("*") && new RegExp(String.raw`(@|host=|--host=|-h)${h.replace(/[.]/g, "\\.")}([:/\s]|$)`).test(a)));
        if (!apunta) continue;
        if (w[0] !== "psql") return { decision: "ask", rule: "base-de-produccion", reason: "Ese comando actúa sobre la base de producción." };
        const sql = sqlDePsql(w.slice(1));
        if (sql === null) return { decision: "ask", rule: "base-de-produccion", reason: "No se ve qué SQL corre ese psql contra producción. Pásalo con -c para que se pueda revisar." };
        const v = revisarSql(sql, config);
        if (v) return v;
      }
      return null;
    },
  },
  {
    id: "despliegue",
    decision: "ask",
    test: ({ segs, simples, config }) => {
      for (const s of segs.filter((s) => /^git\s+push\b/.test(s))) {
        const p = push(s);
        if (!esRemotoDeProduccion(p.remote, config)) continue;
        return p.forced
          ? "Eso es una vuelta atrás en producción. Enseguida después va el `git revert` del cambio en la rama principal del repositorio; hasta que ese revert esté subido, ningún `git pull` en el servidor."
          : "Eso despliega en producción. Antes: `who` sin nadie más conectado, ningún pipeline afectado corriendo y el clon del servidor limpio.";
      }
      for (const sc of simples) {
        const w = sinPrefijos(sc.filter((t) => t.t === "w").map((t) => t.v));
        if (["scp", "rsync", "sftp"].includes(w[0]) && copiaAProduccion(w, config)) {
          return "Eso copia archivos a un servidor de producción. Respaldo antes, fuera de la carpeta del código, y lo que va al servidor tiene que estar en el repositorio.";
        }
      }
      return null;
    },
  },
  {
    id: "entrega-por-pr",
    decision: "ask",
    test: ({ segs, branch, config }) => {
      if (config.entrega === "directa") return null;
      for (const s of segs.filter((s) => /^git\s+push\b/.test(s))) {
        const p = push(s);
        if (esRemotoDeProduccion(p.remote, config)) continue;
        if (p.args.some((a) => a === "--tags" || a === "--delete" || a === "-d")) continue;
        if (pushTargets(p.args, branch).some((t) => PROTECTED.test(t))) {
          return "Este proyecto entrega por pull request. Directo a la rama principal solo van los arreglos pequeños y urgentes, como el revert de una vuelta atrás.";
        }
      }
      return null;
    },
  },
  {
    id: "perder-trabajo",
    decision: "ask",
    test: ({ segs }) => segs.some((s) => [
      /^git\s+reset\b.*\s--hard\b/,
      /^git\s+clean\b.*\s-[a-zA-Z]*[fdx]/,
      /^git\s+checkout\s+--\s+\.$/,
      /^git\s+restore\s+(--staged\s+|--worktree\s+)*\.$/,
      /^git\s+stash\s+(drop|clear)\b/,
      /^git\s+push\b.*\s(--delete|-d)\b/,
      /^git\s+push\s+\S+\s+:\S+/,
    ].some((re) => re.test(s))) ? "Este comando descarta trabajo o borra una rama remota." : null,
  },
  {
    id: "fusionar-pr",
    decision: "ask",
    test: ({ c }) => /\bgh\s+pr\s+merge\b/.test(c) ? "Un pull request lo fusiona una persona después de revisarlo." : null,
  },
];

export function evaluate(command, { branch = "", config = {}, root = process.cwd() } = {}) {
  const c = command.replace(/\\\n/g, " ").replace(/[ \t]+/g, " ");
  // Lo que corre dentro de un ssh a producción se revisa aparte, con sus
  // propias reglas: las de rutas locales (borrados, formato) no le aplican.
  const ssh = conexionesSsh(c).filter((s) => esProduccion(s.host, config));
  let local = c;
  for (const s of [...ssh].sort((a, b) => b.s - a.s)) {
    if (s.remoto !== null) local = `${local.slice(0, s.desde)} ${local.slice(s.e)}`;
  }
  const context = { c, local, segs: segments(local), simples: comandosSimples(local), ssh, branch, config, root: realPath(root) };
  let pregunta = null;
  for (const rule of RULES) {
    const result = rule.test(context);
    if (!result) continue;
    const verdict = typeof result === "string" ? { rule: rule.id, decision: rule.decision, reason: result } : result;
    if (verdict.decision === "deny") return verdict;
    pregunta ??= verdict;
  }
  return pregunta;
}

function main() {
  const payload = readPayload();
  const agent = agentName();
  const root = projectDir(payload);
  const command = shellCommand(payload);
  if (!command) process.exit(0);
  const verdict = evaluate(command, { branch: currentBranch(root), config: readProjectConfig(root), root });
  if (!verdict) process.exit(0);
  if (verdict.decision === "deny") deny(root, payload, agent, verdict.reason, verdict.rule);
  ask(root, payload, agent, verdict.reason, verdict.rule);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
