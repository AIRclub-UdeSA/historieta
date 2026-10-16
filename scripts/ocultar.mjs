// Oculta viñetas de la página por su número (el "#69" que se ve en cada una).
// Uso: node scripts/ocultar.mjs "69, 70"
// Numera igual que index.html: sin las excluidas y ordenadas por fecha.
import fs from "node:fs";

const imagenes = JSON.parse(fs.readFileSync("data/imagenes.json", "utf8"));
const ruta = "data/excluidas.json";
const excluidas = fs.existsSync(ruta) ? JSON.parse(fs.readFileSync(ruta, "utf8")) : [];
const fuera = new Set(excluidas);
const lista = imagenes
  .filter((x) => !fuera.has(x.sha256) && !fuera.has(x.archivo))
  .sort((a, b) => a.fecha.localeCompare(b.fecha));

const numeros = [...new Set((process.argv[2] || "").split(/[\s,]+/).filter(Boolean))];
if (!numeros.length || numeros.some((n) => !/^\d+$/.test(n) || +n < 1 || +n > lista.length)) {
  console.error(`números inválidos: "${process.argv[2]}" (la página tiene ${lista.length} viñetas)`);
  process.exit(1);
}

for (const n of numeros) {
  const x = lista[+n - 1];
  excluidas.push(x.sha256);
  console.log(`#${n}: ${x.archivo} (${x.repo} #${x.num}) ${x.alt || ""}`);
}
fs.writeFileSync(ruta, JSON.stringify(excluidas, null, 2) + "\n");
