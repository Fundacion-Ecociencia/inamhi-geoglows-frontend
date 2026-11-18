// Shared patterns for the harness guards and git hooks: what counts as a
// secret file, a secret value, a generated file or a lockfile.

import { existsSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/** Files that hold secrets. `.env.example` / `.env.sample` are templates. */
export function isSecretFile(path) {
  const name = basename(path).toLowerCase();
  if (/\.(example|sample|template|dist)$/.test(name)) return false;
  if (name === ".env" || name.startsWith(".env.")) return true;
  if (/\.(p12|pfx|pem|ppk|key|jks|keystore)$/.test(name)) return true;
  // PgBouncer's user list, GeoServer's store credentials and password files.
  if (["userlist.txt", "datastore.properties", ".pgpass", ".netrc", "id_rsa", "id_ed25519"].includes(name)) return true;
  if (/^service-account.*\.json$/.test(name) || /credentials.*\.json$/.test(name)) return true;
  return false;
}

/** Lockfiles are written by their package manager. */
export function isLockfile(path) {
  return ["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock", "uv.lock", "conda-lock.yml"]
    .includes(basename(path));
}

/**
 * Secret values with a recognisable shape. Each has a severity: `critica`
 * means a live credential that must never be written to a file.
 */
export const SECRET_PATTERNS = [
  { tipo: "llave privada", severidad: "critica", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { tipo: "cuenta de servicio de Google", severidad: "critica", re: /"private_key"\s*:\s*"-----BEGIN/ },
  { tipo: "llave de AWS", severidad: "critica", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { tipo: "token de GitHub", severidad: "critica", re: /\b(ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{50,})\b/ },
  { tipo: "token de Slack", severidad: "critica", re: /\bxox[abposr]-[A-Za-z0-9-]{10,}/ },
  // Una URL de base con la clave escrita, no con una variable ({DB_PASS}, $PGPASSWORD).
  { tipo: "URL de base de datos con contraseña", severidad: "critica", re: /\bpostgres(?:ql)?(?:\+\w+)?:\/\/[^:\s\/{}$]+:[^@\s{}$<>*]{3,}@/ },
  { tipo: "SECRET_KEY de Django", severidad: "critica", re: /\bSECRET_KEY\s*=\s*["'][^"'\s]{24,}["']/ },
  { tipo: "contraseña de GeoServer en la URL", severidad: "critica", re: /\bhttps?:\/\/[^:\s\/{}$]+:[^@\s{}$<>*]{3,}@[^\s]*geoserver/ },
  { tipo: "llave de Anthropic", severidad: "critica", re: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  { tipo: "llave de OpenAI", severidad: "critica", re: /\bsk-(proj-)?[A-Za-z0-9]{32,}/ },
];

const PLACEHOLDER = /(example|ejemplo|fake|falsa|dummy|placeholder|xxxx|your[_-]?key|tu[_-]?llave|usuario:clave|user:pass)/i;

/** Secret values found in `text`, without the values themselves. */
export function findSecrets(text) {
  const found = [];
  const lines = String(text).split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const pattern of SECRET_PATTERNS) {
      const match = pattern.re.exec(line);
      if (match && !PLACEHOLDER.test(line)) {
        found.push({ linea: index + 1, tipo: pattern.tipo, severidad: pattern.severidad, muestra: `${match[0].slice(0, 4)}…` });
      }
    }
  });
  return found;
}

/** Replaces anything that looks like a secret before it is logged. */
export function redact(text) {
  let out = String(text);
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(new RegExp(pattern.re.source, "g"), (m) => `${m.slice(0, 4)}…[oculto]`);
  }
  // Values of variables that are named like secrets: FOO_TOKEN=abc → FOO_TOKEN=[oculto]
  out = out.replace(/\b([A-Z0-9_]*(KEY|SECRET|TOKEN|PASSWORD|PASS|PRIVATE)[A-Z0-9_]*)=(\S+)/g, "$1=[oculto]");
  return out;
}

export function basename(path) {
  const parts = normalize(path).split("/");
  return parts[parts.length - 1] ?? "";
}

export function normalize(path) {
  return String(path ?? "").replace(/\\/g, "/");
}

/**
 * The real path of `path`, even when it does not exist yet: symlinked parents
 * (/var → /private/var on macOS) are resolved so paths compare correctly.
 */
export function realPath(path) {
  let current = resolve(path);
  const rest = [];
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) return resolve(path);
    rest.unshift(current.slice(parent.length + (parent.endsWith("/") ? 0 : 1)));
    current = parent;
  }
  try {
    return join(realpathSync(current), ...rest);
  } catch {
    return resolve(path);
  }
}
