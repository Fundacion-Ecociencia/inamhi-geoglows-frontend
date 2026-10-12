// Crea src/environments/carto-key.ts antes de compilar si no existe.
//
// La llave de CARTO Basemaps no va al repo (carto-key.ts está en .gitignore),
// pero environment.ts la importa. Sin este paso, un checkout limpio no compila.
//
// - Si carto-key.ts ya existe, no hace nada.
// - Si está definida la variable de entorno CARTO_KEY, la usa.
// - Si no, copia la plantilla carto-key.example.ts: la aplicación compila,
//   pero las capas de CARTO no cargan.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const envDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "environments");
const target = join(envDir, "carto-key.ts");
const example = join(envDir, "carto-key.example.ts");

if (existsSync(target)) {
  process.exit(0);
}

const template = readFileSync(example, "utf8");
const key = process.env.CARTO_KEY;

if (key) {
  if (!/^[A-Za-z0-9_-]+$/.test(key)) {
    console.error("CARTO_KEY tiene caracteres inesperados; no se creó carto-key.ts.");
    process.exit(1);
  }
  writeFileSync(target, template.replace("CARTO_KEY_PLACEHOLDER", key));
  console.log("carto-key.ts creado con la llave de CARTO_KEY.");
} else {
  writeFileSync(target, template);
  console.warn(
    "AVISO: carto-key.ts creado sin llave. La aplicación compila, pero los mapas de CARTO\n" +
    "no van a cargar. Para producción, define CARTO_KEY o edita src/environments/carto-key.ts."
  );
}
