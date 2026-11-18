// Qué hace un comando que corre en un servidor de producción. La regla es de
// lista blanca: lo que se reconoce como lectura pasa; lo que nunca se hace en
// el servidor se niega; todo lo demás lo confirma una persona. Así, un comando
// que el harness no conoce se pregunta en vez de dejarse pasar.

import { coincide } from "./proyecto.mjs";
import { isSecretFile } from "./patrones.mjs";

/**
 * Parte un comando de shell en palabras, operadores (; | || && &) y
 * redirecciones, respetando comillas, `\` y `$( … )`. Cada pieza lleva dónde
 * empieza y termina en el texto.
 */
export function tokens(command) {
  const out = [];
  const n = command.length;
  let cur = "";
  let has = false;
  let start = 0;
  let i = 0;
  const push = (end) => {
    if (has) out.push({ t: "w", v: cur, s: start, e: end });
    cur = "";
    has = false;
  };
  const begin = () => {
    if (!has) start = i;
    has = true;
  };
  while (i < n) {
    const ch = command[i];
    if (ch === "\\" && i + 1 < n) {
      begin();
      cur += command[i + 1];
      i += 2;
    } else if (ch === "'") {
      begin();
      let j = command.indexOf("'", i + 1);
      if (j === -1) j = n;
      cur += command.slice(i + 1, j);
      i = j + 1;
    } else if (ch === '"') {
      begin();
      let j = i + 1;
      while (j < n && command[j] !== '"') {
        if (command[j] === "\\" && j + 1 < n) {
          cur += command[j + 1];
          j += 2;
        } else {
          cur += command[j];
          j += 1;
        }
      }
      i = j + 1;
    } else if (ch === "$" && command[i + 1] === "(") {
      begin();
      let depth = 0;
      let j = i + 1;
      while (j < n) {
        if (command[j] === "(") depth += 1;
        else if (command[j] === ")") {
          depth -= 1;
          if (depth === 0) break;
        }
        j += 1;
      }
      cur += command.slice(i, j + 1);
      i = j + 1;
    } else if (ch === "`") {
      begin();
      let j = command.indexOf("`", i + 1);
      if (j === -1) j = n - 1;
      cur += command.slice(i, j + 1);
      i = j + 1;
    } else if (/\s/.test(ch)) {
      push(i);
      if (ch === "\n") out.push({ t: "op", v: ";", s: i, e: i + 1 });
      i += 1;
    } else if (ch === ";" || ch === "|" || ch === "&") {
      // «2>&1» y «>&2»: el & es parte de la redirección, no un operador.
      const last = out[out.length - 1];
      if (ch === "&" && !has && last?.t === "redir" && last.e === i) {
        last.v += "&";
        last.e = i + 1;
        i += 1;
      } else {
        push(i);
        const two = command.slice(i, i + 2);
        const v = two === "&&" || two === "||" ? two : ch;
        out.push({ t: "op", v, s: i, e: i + v.length });
        i += v.length;
      }
    } else if (ch === ">" || ch === "<") {
      // El descriptor que va pegado delante (2>) no es una palabra.
      if (has && /^\d+$/.test(cur)) {
        cur = "";
        has = false;
      } else {
        push(i);
      }
      let j = i;
      while (j < n && (command[j] === ">" || command[j] === "<")) j += 1;
      out.push({ t: "redir", v: command.slice(i, j), s: i, e: j });
      i = j;
    } else {
      begin();
      cur += ch;
      i += 1;
    }
  }
  push(n);
  return out;
}

/**
 * Los comandos que un texto de shell ejecuta por dentro: `$( … )`, comillas
 * invertidas y `<( … )` / `>( … )`. El shell los corre antes que el comando
 * que los contiene, así que cada uno se revisa por su cuenta. Lo que va entre
 * comillas simples no se expande y no cuenta; `$(( … ))` es aritmética.
 * `capturado` dice si el resultado va a una variable (`VAR=$( … )`) y por
 * tanto no sale en pantalla.
 */
export function sustituciones(texto) {
  const out = [];
  const n = texto.length;
  let i = 0;
  let dobles = false;
  const cerrar = (desde) => {
    let depth = 0;
    for (let j = desde; j < n; j += 1) {
      if (texto[j] === "(") depth += 1;
      else if (texto[j] === ")") {
        depth -= 1;
        if (depth === 0) return j;
      }
    }
    return -1;
  };
  while (i < n) {
    const ch = texto[i];
    if (ch === "\\") {
      i += 2;
    } else if (ch === '"') {
      dobles = !dobles;
      i += 1;
    } else if (ch === "'" && !dobles) {
      const fin = texto.indexOf("'", i + 1);
      i = fin === -1 ? n : fin + 1;
    } else if (ch === "`") {
      const fin = texto.indexOf("`", i + 1);
      out.push({ interior: fin === -1 ? null : texto.slice(i + 1, fin), capturado: false });
      i = fin === -1 ? n : fin + 1;
    } else if ((ch === "$" || ((ch === "<" || ch === ">") && !dobles)) && texto[i + 1] === "(") {
      if (ch === "$" && texto[i + 2] === "(") {
        // Aritmética: se salta entera, pero lo que tenga dentro como $( … ) sí se mira.
        const fin = cerrar(i + 1);
        if (fin !== -1) out.push(...sustituciones(texto.slice(i + 3, fin - 1)));
        i = fin === -1 ? n : fin + 1;
      } else {
        const fin = cerrar(i + 1);
        const capturado = ch === "$" && /(^|[\s;&|(])[A-Za-z_][A-Za-z0-9_]*="?$/.test(texto.slice(0, i));
        out.push({ interior: fin === -1 ? null : texto.slice(i + 2, fin), capturado });
        i = fin === -1 ? n : fin + 1;
      }
    } else {
      i += 1;
    }
  }
  return out;
}

/** Los comandos simples de un texto: listas de piezas separadas por operadores. */
export function comandosSimples(command) {
  const list = [];
  let cur = [];
  for (const tok of tokens(command)) {
    if (tok.t === "op") {
      if (cur.length) list.push(cur);
      cur = [];
    } else {
      cur.push(tok);
    }
  }
  if (cur.length) list.push(cur);
  return list;
}

const ENVOLTORIOS = new Set(["time", "nice", "nohup", "command", "exec"]);

/** Palabras de un comando simple sin asignaciones (VAR=x) ni envoltorios (timeout 30, nice). */
export function sinPrefijos(palabras) {
  let w = [...palabras];
  let cambiado = true;
  while (cambiado && w.length) {
    cambiado = false;
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w[0])) {
      w = w.slice(1);
      cambiado = true;
    } else if (ENVOLTORIOS.has(w[0])) {
      w = w.slice(1);
      while (w[0]?.startsWith("-")) w = w.slice(1);
      cambiado = true;
    } else if (w[0] === "timeout") {
      w = w.slice(1);
      while (w[0]?.startsWith("-")) w = w.slice(/^-[ks]$/.test(w[0]) ? 2 : 1);
      w = w.slice(1); // la duración
      cambiado = true;
    }
  }
  return w;
}

const SSH_CON_ARGUMENTO = new Set(["-b", "-c", "-D", "-E", "-e", "-F", "-I", "-i", "-J", "-L", "-l", "-m", "-O", "-o", "-p", "-Q", "-R", "-S", "-W", "-w"]);

/**
 * Las conexiones `ssh` de un comando: a qué servidor y qué corre allí. `remoto`
 * es el texto que recibe el shell del servidor; null si no se pasa un comando
 * (sesión interactiva) y `porEntrada` si el comando llega por la entrada
 * estándar (heredoc, `bash -s < script`), donde no se puede ver.
 */
export function conexionesSsh(command) {
  const out = [];
  for (const sc of comandosSimples(command)) {
    const palabras = sc.filter((t) => t.t === "w");
    const w = sinPrefijos(palabras.map((t) => t.v));
    const offset = palabras.length - w.length;
    let at = w[0] === "sudo" ? 1 : 0;
    if (w[at] !== "ssh") continue;
    at += 1;
    while (at < w.length && w[at].startsWith("-")) at += SSH_CON_ARGUMENTO.has(w[at]) ? 2 : 1;
    const host = w[at];
    if (!host) continue;
    const resto = w.slice(at + 1);
    const porEntrada = sc.some((t) => t.t === "redir" && t.v.startsWith("<"));
    out.push({
      host,
      remoto: resto.length ? resto.join(" ") : null,
      porEntrada,
      s: sc[0].s,
      e: sc[sc.length - 1].e,
      desde: palabras[offset + at]?.e ?? sc[0].s,
    });
  }
  return out;
}

const ESCRITURA_SQL = /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|vacuum|reindex|cluster|refresh|call|merge|comment\s+on|lock\s+table|pg_terminate_backend|pg_cancel_backend|setval|nextval)\b|\bcopy\b[^;]*\bfrom\b|\bselect\b[^;]*\binto\b/i;

/** Por qué una consulta SQL no es una lectura liviana, o null. */
export function revisarSql(sql, config) {
  const texto = String(sql);
  if (/\\(copy|i|ir|!|o|w|g?exec|set|c|connect)\b/.test(texto)) {
    return { decision: "ask", rule: "base-de-produccion", reason: "Ese comando de psql escribe, ejecuta un archivo o cambia de conexión en la base de producción." };
  }
  if (ESCRITURA_SQL.test(texto)) {
    return { decision: "ask", rule: "base-de-produccion", reason: "Esa consulta cambia la base de producción (o cancela procesos). Explica qué va a pasar, saca el respaldo que corresponda y espera la confirmación." };
  }
  const grandes = (config?.produccion?.tablasGrandes ?? []).filter((t) => new RegExp(String.raw`\b(from|join)\s+(only\s+)?("?\w+"?\.)?"?${t}"?\b`, "i").test(texto));
  if (grandes.length) {
    const analiza = /\bexplain\b[^;]*\banalyze\b/i.test(texto);
    if (/\bexplain\b/i.test(texto) && !analiza) return null;
    if (/count\s*\(\s*distinct/i.test(texto) || !/\bwhere\b/i.test(texto) || analiza) {
      return { decision: "ask", rule: "consulta-pesada", reason: `Esa consulta recorre ${grandes.join(", ")}, que es una tabla muy grande, sin filtro o con count(distinct). Puede tardar horas y cargar la base de producción: fíltrala por la clave o la partición, o usa las estadísticas (pg_class.reltuples).` };
    }
  }
  return null;
}

/** El SQL de un `psql …`: null si no se puede ver (interactivo, -f, entrada estándar). */
export function sqlDePsql(args) {
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "-f" || args[i] === "--file" || args[i].startsWith("--file=")) return null;
  }
  const partes = [];
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a.startsWith("--command=")) partes.push(a.slice(10));
    // Todo lo que sigue a -c cuenta como SQL: si las comillas llegaron rotas,
    // se revisa el texto entero en vez de solo la primera palabra.
    else if (a === "-c" || a === "--command" || (/^-[a-zA-Z]*c$/.test(a) && !a.startsWith("--"))) partes.push(args.slice(i + 1).join(" "));
  }
  if (partes.length) return partes.join(" ; ");
  if (args.some((a) => ["-l", "--list", "-V", "--version", "--help"].includes(a))) return "";
  return null;
}

const LECTURA = new Set([
  "ls", "cat", "head", "tail", "grep", "egrep", "fgrep", "zgrep", "zcat", "less", "wc", "df", "du", "ps", "who", "w",
  "uptime", "free", "date", "stat", "file", "echo", "printf", "cd", "pwd", "awk", "sort", "uniq", "cut", "tr", "test",
  "[", "[[", "true", "false", "hostname", "id", "whoami", "pgrep", "ss", "netstat", "lsof", "md5sum", "sha256sum", "nproc",
  "uname", "lsblk", "basename", "dirname", "realpath", "readlink", "column", "nl", "tac", "jq", "diff", "cmp", "which",
  "type", "nslookup", "dig", "ping", "top", "vmstat", "iostat", "last", "numfmt", "seq", "xargs", "tee",
]);

/** Los únicos comandos que xargs puede lanzar sin preguntar: no escriben ni ejecutan, les llegue el argumento que les llegue. */
const LECTURA_CON_CUALQUIER_ARGUMENTO = new Set(["grep", "egrep", "fgrep", "zgrep", "wc", "ls", "stat", "du", "head", "tail", "basename", "dirname", "md5sum", "sha256sum", "file", "echo", "readlink", "realpath"]);

const GIT_LECTURA = new Set(["status", "log", "diff", "show", "rev-parse", "ls-files", "describe", "fetch", "blame", "shortlog", "rev-list", "ls-remote", "cat-file", "merge-base", "name-rev"]);
const SYSTEMCTL_LECTURA = new Set(["status", "is-active", "is-enabled", "is-failed", "list-units", "list-timers", "list-unit-files", "show", "cat"]);
const DOCKER_LECTURA = new Set(["ps", "logs", "inspect", "images", "stats", "version", "info", "top", "port"]);

const pregunta = (reason, rule = "produccion-escritura") => ({ decision: "ask", rule, reason });
const niega = (reason, rule) => ({ decision: "deny", rule, reason });

/** Una redirección a un archivo que no es temporal es una escritura. */
function redireccionQueEscribe(sc) {
  for (let i = 0; i < sc.length; i += 1) {
    const t = sc[i];
    if (t.t !== "redir" || !t.v.startsWith(">")) continue;
    const destino = sc[i + 1]?.t === "w" ? sc[i + 1].v : "";
    if (t.v.includes("&") && /^\d+$|^-$/.test(destino)) continue;
    if (destino === "/dev/null" || /^\/(tmp|var\/tmp)\//.test(destino)) continue;
    return destino || "(un archivo)";
  }
  return null;
}

/** Revisa un comando simple que corre en el servidor. */
function revisarComando(sc, config) {
  const todas = sc.filter((t) => t.t === "w").map((t) => t.v);
  const w = sinPrefijos(todas);
  if (!w.length) return null; // Solo asignaciones.
  const [cmd, ...args] = w;
  const prod = config?.produccion ?? {};

  if (cmd === "sudo") return pregunta("Ese comando usa sudo en un servidor de producción.");
  const destino = redireccionQueEscribe(sc);
  if (destino) return pregunta(`Ese comando escribe en ${destino} del servidor de producción. Para pruebas, escribe en /tmp.`);

  if (cmd === "git") {
    const posicionales = [];
    for (let i = 0; i < args.length; i += 1) {
      if (args[i] === "-C" || args[i] === "-c") i += 1;
      else if (!args[i].startsWith("-")) posicionales.push(args[i]);
    }
    const sub = posicionales[0];
    if (sub === "pull" || sub === "merge" || sub === "rebase") {
      return pregunta("Eso despliega en producción. Antes: `who` sin nadie más conectado, ningún pipeline afectado corriendo y `git status` limpio; con `--ff-only`. Nunca un pull después de una vuelta atrás si el revert todavía no está en el repositorio: vuelve a traer el commit malo.", "despliegue");
    }
    if (GIT_LECTURA.has(sub)) return null;
    if (sub === "branch" && !args.some((a) => /^-[dDmMcC]$|^--(delete|move|copy|force)$/.test(a))) return null;
    if (sub === "remote" && (!posicionales[1] || ["-v", "show", "get-url"].includes(posicionales[1]))) return null;
    if (sub === "config" && args.some((a) => /^--(get|list)|^-l$/.test(a))) return null;
    if (sub === "stash" && posicionales[1] === "list") return null;
    return pregunta(`\`git ${sub ?? ""}\` cambia el clon del servidor de producción.`);
  }
  if (cmd === "psql") {
    const sql = sqlDePsql(args);
    if (sql === null) return pregunta("No se ve qué SQL corre ese psql (interactivo, archivo o entrada estándar). Pásalo con -c para que se pueda revisar.", "base-de-produccion");
    return revisarSql(sql, config);
  }
  if (["pg_dump", "pg_dumpall"].includes(cmd)) return pregunta("Un volcado de la base de producción la carga y puede ocupar mucho disco.", "base-de-produccion");
  if (["pg_restore", "dropdb", "createdb", "pg_ctl", "pg_ctlcluster", "pg_upgradecluster"].includes(cmd)) return pregunta("Ese comando cambia la base de producción.", "base-de-produccion");
  if (cmd === "systemctl") {
    const sub = args.find((a) => !a.startsWith("-"));
    return SYSTEMCTL_LECTURA.has(sub) ? null : pregunta(`\`systemctl ${sub ?? ""}\` cambia un servicio de producción. Mira antes con \`who\` si hay alguien más conectado.`);
  }
  if (cmd === "journalctl") return args.some((a) => /^--(vacuum|rotate|flush)/.test(a)) ? pregunta("Eso borra o rota el registro del sistema.") : null;
  if (cmd === "crontab") {
    if (args.length === 1 && args[0] === "-l") return null;
    return pregunta("Eso cambia el crontab de producción. Respaldo con `crontab -l`, versión nueva en un archivo, comprobar cuántas líneas tiene y cuántas cambian, y recién entonces instalarla.", "crontab");
  }
  if (cmd === "find") return args.some((a) => /^-(delete|exec|execdir|ok|okdir|fprint|fls)/.test(a)) ? pregunta("Ese find borra o ejecuta sobre lo que encuentra.") : null;
  if (cmd === "sed") return args.some((a) => /^-[a-zA-Z]*i|^--in-place/.test(a)) ? pregunta("`sed -i` modifica el archivo en el servidor de producción.") : null;
  if (cmd === "curl") {
    for (let i = 0; i < args.length; i += 1) {
      const a = args[i];
      if (/^(-d|--data|--data-\w+|-T|--upload-file|-F|--form|--form-string|--json)$/.test(a)) return pregunta("Ese curl envía datos desde el servidor de producción.");
      if ((a === "-X" || a === "--request") && !/^(GET|HEAD|OPTIONS)$/i.test(args[i + 1] ?? "")) return pregunta("Ese curl no es una lectura (el método no es GET).");
      if ((a === "-o" || a === "--output") && !/^(\/dev\/null|\/tmp\/|-$)/.test(args[i + 1] ?? "")) return pregunta("Ese curl guarda un archivo en el servidor de producción. Guárdalo en /tmp.");
      if (a === "-O" || a === "--remote-name") return pregunta("Ese curl guarda un archivo en el servidor de producción. Guárdalo en /tmp.");
    }
    return null;
  }
  if (cmd === "docker") {
    const sub = args.find((a) => !a.startsWith("-"));
    return DOCKER_LECTURA.has(sub) ? null : pregunta(`\`docker ${sub ?? ""}\` cambia un contenedor de producción.`);
  }
  if (cmd === "tmux") return ["ls", "list-sessions", "list-windows"].includes(args[0]) ? null : pregunta("Ese tmux abre o maneja una sesión en el servidor.");
  if (cmd === "bash" || cmd === "sh") {
    if (args[0] === "-n") return null; // Solo revisa la sintaxis.
    const script = args.find((a) => !a.startsWith("-"));
    if (script && coincide(script.replace(/^~\//, "").replace(/^\/home\/[^/]+\//, ""), prod.scriptsDeLectura ?? [])) return null;
    if (script && args.includes("--simular") && coincide(script.replace(/^~\//, "").replace(/^\/home\/[^/]+\//, ""), prod.scriptsConSimulacion ?? [])) return null;
    return pregunta("Ese script corre en el servidor de producción y el harness no sabe qué hace.");
  }
  if (cmd === "python" || cmd === "python3") {
    if (args[0] === "-m" && args[1] === "py_compile") return null;
    if (args.includes("--simular") || args.includes("--dry-run")) return pregunta("Una simulación en producción lee la base real. Confirma que corre desde una copia en /tmp y que no escribe.");
    return pregunta("Ese programa corre en el servidor de producción. Las pruebas van sobre una copia en /tmp, sin escribir.");
  }
  if (cmd === "tee") {
    const archivos = args.filter((a) => !a.startsWith("-"));
    return archivos.every((a) => a === "/dev/null" || /^\/tmp\//.test(a)) ? null : pregunta("`tee` escribe un archivo en el servidor de producción.");
  }
  if (cmd === "xargs") {
    // Lo que xargs lanza recibe sus argumentos de la entrada, que no se ve: solo pasan los comandos
    // que son lectura con cualquier argumento. `xargs tee`, `xargs cat` o `xargs sed` se preguntan.
    let i = 0;
    while (i < args.length && args[i].startsWith("-")) i += /^-[nILPdsE]$/.test(args[i]) ? 2 : 1;
    const lanzado = args[i];
    if (!lanzado) return pregunta("Ese xargs ejecuta como comandos lo que recibe por la entrada, y no se puede ver qué es.");
    if (!LECTURA_CON_CUALQUIER_ARGUMENTO.has(lanzado)) {
      return pregunta(`Ese xargs lanza \`${lanzado}\` con argumentos que llegan por la entrada y no se pueden revisar. Escribe el comando con sus argumentos a la vista.`);
    }
    return null;
  }
  if (LECTURA.has(cmd)) return null;
  return pregunta(`\`${cmd}\` no está en la lista de comandos de solo lectura. En producción, lo que escribe, borra, reinicia o mata procesos necesita confirmación para esa acción concreta.`);
}

const NUNCA_EN_SERVIDOR = [
  [/\bgit\s+(-C\s+\S+\s+)?clean\b/, "`git clean` en el servidor borra archivos que no vienen del repositorio."],
  [/\bgit\s+(-C\s+\S+\s+)?stash\s*(push|save|pop|apply|drop|clear|-|$|[;&|])/, "`git stash` en el servidor esconde las ediciones hechas a mano en producción."],
  [/\bgit\s+(-C\s+\S+\s+)?reset\b[^;&|]*--hard\b/, "`git reset --hard` en el servidor pierde las ediciones hechas a mano en producción."],
  [/\bgit\s+(-C\s+\S+\s+)?checkout\s+(--\s+)?\.(\s|$)/, "`git checkout .` en el servidor pierde las ediciones hechas a mano en producción."],
  [/\bgit\s+(-C\s+\S+\s+)?restore\s+(--\S+\s+)*\.(\s|$)/, "`git restore .` en el servidor pierde las ediciones hechas a mano en producción."],
  [/\bgit\s+(-C\s+\S+\s+)?commit\b/, "En el servidor no se hacen commits: el repositorio es la fuente de verdad y el servidor solo recibe lo que está en la rama principal."],
];

/**
 * Qué hacer con un comando que corre en un servidor de producción:
 * null (lectura, pasa), `ask` (lo confirma una persona) o `deny`.
 */
export function clasificarRemoto(remoto, config = {}, { capturado = false, nivel = 0 } = {}) {
  const texto = String(remoto);
  for (const [re, motivo] of NUNCA_EN_SERVIDOR) {
    if (re.test(texto)) return niega(motivo, "clon-del-servidor");
  }
  let peor = null;
  // Primero lo que el shell ejecuta por dentro: `echo $(systemctl restart x)` reinicia antes de imprimir.
  for (const s of sustituciones(texto)) {
    const v = s.interior === null || nivel >= 4
      ? pregunta("Ese comando lleva una sustitución que no se puede leer entera (sin cerrar o demasiado anidada).")
      : clasificarRemoto(s.interior, config, { capturado: s.capturado, nivel: nivel + 1 });
    if (v?.decision === "deny") return v;
    if (v && !peor) peor = v;
  }
  const terceros = config?.produccion?.rutasDeTerceros ?? [];
  const simples = comandosSimples(texto);
  // Un archivo de secretos nombrado en una tubería que termina en xargs: `echo .env | xargs head`
  // lo lee igual que `head .env`, aunque el nombre no sea argumento del lector.
  const palabrasDe = (sc) => sc.filter((t) => t.t === "w").map((t) => t.v);
  if (simples.some((sc) => sinPrefijos(palabrasDe(sc))[0] === "xargs") && simples.some((sc) => palabrasDe(sc).some((a) => isSecretFile(a)))) {
    return niega("Esa tubería le pasa a xargs el nombre de un archivo de secretos, y su contenido saldría en la respuesta.", "leer-secretos");
  }
  for (const sc of simples) {
    const palabras = palabrasDe(sc);
    const w = sinPrefijos(palabras);
    // Lo que mantiene otro equipo en el servidor: ni se pisa ni se restaura.
    const toca = w.slice(1).some((a) => !a.startsWith("-") && terceros.some((r) => a.replace(/\/+$/, "").endsWith(r.replace(/\/\*\*?$/, "").replace(/\/+$/, "")) || a.includes(`${r.replace(/\/\*\*?$/, "").replace(/\/+$/, "")}/`)));
    const escribeAhi = ["cp", "mv", "rm", "sed", "tee", "truncate", "chmod", "chown", "touch", "ln"].includes(w[0]) || (w[0] === "git" && /\b(checkout|restore|rm|mv)\b/.test(w.join(" ")));
    if (toca && escribeAhi && !(w[0] === "cp" && terceros.every((r) => !w[w.length - 1].includes(r.replace(/\/\*\*?$/, ""))))) {
      return niega(config?.produccion?.motivoTerceros ?? "Esa ruta la mantiene otro equipo directamente en el servidor. Cualquier cambio ahí se acuerda antes con ellos.", "ruta-de-terceros");
    }
    if (w.some((a, i) => i > 0 && isSecretFile(a)) && ["cat", "less", "head", "tail", "grep", "egrep", "awk", "sed", "cut", "tac", "nl", "diff", "cmp", "jq", "tee", "xargs", "sort", "uniq", "wc"].includes(w[0]) && w[0] !== "wc"
      // Única salida: una variable tomada con `sed -n` dentro de una asignación (VAR=$(sed -n … .env)) no se imprime.
      && !(capturado && w[0] === "sed" && w.includes("-n"))) {
      return niega("Ese archivo guarda secretos y su contenido saldría en la respuesta. Muestra solo longitudes, conteos o valores enmascarados.", "leer-secretos");
    }
    const v = revisarComando(sc, config);
    if (v?.decision === "deny") return v;
    if (v && !peor) peor = v;
  }
  return peor;
}
