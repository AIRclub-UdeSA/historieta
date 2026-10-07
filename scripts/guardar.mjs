// Descarga las imágenes de un comentario y las archiva en archivo/ + data/imagenes.json.
// Uso: node scripts/guardar.mjs '<json con {repo,num,tipo,autor,fecha,url,imagenes:[{src,alt}]}>'
import crypto from "node:crypto";
import fs from "node:fs";

const datos = JSON.parse(process.argv[2]);
const indice = "data/imagenes.json";
const lista = fs.existsSync(indice) ? JSON.parse(fs.readFileSync(indice, "utf8")) : [];
const vistos = new Set(lista.map((x) => x.sha256));

const BOTS = /\/\/(vercel\.com|github\.githubassets\.com|dependabot-badges\.githubapp\.com)\//;

function extension(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8) return "jpg";
  if (buf.subarray(0, 4).toString("hex") === "89504e47") return "png";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "webp";
  if (buf.subarray(0, 3).toString() === "GIF") return "gif";
  return null;
}

// Ancho y alto para que la página reserve el lugar de cada viñeta antes de bajarla.
function medidas(buf, ext) {
  if (ext === "png") return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  if (ext === "gif") return [buf.readUInt16LE(6), buf.readUInt16LE(8)];
  if (ext === "webp" && buf.subarray(12, 16).toString() === "VP8X") {
    return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
  }
  if (ext === "jpg") {
    let i = 2;
    while (i < buf.length) {
      const marca = buf[i + 1];
      const largo = buf.readUInt16BE(i + 2);
      if (marca >= 0xc0 && marca <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marca)) {
        return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
      }
      i += 2 + largo;
    }
  }
  return [null, null];
}

let nuevas = 0;
for (const { src, alt } of datos.imagenes) {
  const url = src.startsWith("/") ? "https://github.com" + src : src;
  if (BOTS.test(url)) continue;
  let r = await fetch(url, { redirect: "follow" });
  // Algunos adjuntos (user-attachments) dan 404 sin sesión aunque el repo sea público.
  if (r.status === 404 && process.env.GH_TOKEN) {
    r = await fetch(url, { redirect: "follow", headers: { Authorization: `token ${process.env.GH_TOKEN}` } });
  }
  if (!r.ok) {
    console.log(`::warning::no se pudo descargar (${r.status}): ${url}`);
    continue;
  }
  const buf = Buffer.from(await r.arrayBuffer());
  const ext = extension(buf);
  if (!ext) {
    console.log(`::warning::no es una imagen: ${url}`);
    continue;
  }
  // En descripciones de PR/issue casi todo son capturas (PNG); solo se guardan los JPG.
  if (datos.tipo.endsWith("body") && ext !== "jpg") continue;
  const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
  if (vistos.has(sha256)) continue;
  const archivo = `archivo/${datos.fecha.slice(0, 10)}-${datos.repo}-${datos.num ?? "x"}-${sha256.slice(0, 10)}.${ext}`;
  fs.mkdirSync("archivo", { recursive: true });
  fs.writeFileSync(archivo, buf);
  const [ancho, alto] = medidas(buf, ext);
  lista.push({ archivo, sha256, ancho, alto, src, alt, repo: datos.repo, num: datos.num, tipo: datos.tipo, autor: datos.autor, fecha: datos.fecha, url: datos.url });
  vistos.add(sha256);
  nuevas++;
  console.log(`guardada ${archivo}`);
}

lista.sort((a, b) => a.fecha.localeCompare(b.fecha));
fs.mkdirSync("data", { recursive: true });
fs.writeFileSync(indice, JSON.stringify(lista, null, 2) + "\n");
console.log(`${nuevas} imagen(es) nueva(s)`);
