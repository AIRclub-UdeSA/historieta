// Recorre los repos de la org buscando imágenes de los últimos días que no estén archivadas.
// Escribe una línea JSON por comentario (mismo formato que recibe guardar.mjs) en pendientes.jsonl.
// Uso: GH_TOKEN=... node scripts/barrer.mjs <dias>
import fs from "node:fs";

const ORG = "AIRclub-UdeSA";
const DIAS = Number(process.argv[2] || 3);
const desde = new Date(Date.now() - DIAS * 86400e3).toISOString();
const IMG = /<img[^>]*src="([^"]+)"[^>]*>|!\[[^\]]*\]\(([^)\s]+)/g;
const ALT = /alt="([^"]*)"/;

const archivadas = new Set(
  JSON.parse(fs.readFileSync("data/imagenes.json", "utf8")).map((x) => `${x.url} ${x.src}`)
);

async function api(ruta) {
  const out = [];
  let url = `https://api.github.com/${ruta}`;
  while (url) {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: "application/vnd.github+json" },
    });
    if (!r.ok) throw new Error(`${ruta}: ${r.status} ${await r.text()}`);
    const datos = await r.json();
    out.push(...(Array.isArray(datos) ? datos : datos.repositories || [datos]));
    url = /<([^>]+)>;\s*rel="next"/.exec(r.headers.get("link") || "")?.[1];
  }
  return out;
}

function imagenes(texto) {
  const out = [];
  for (const m of (texto || "").matchAll(IMG)) {
    const alt = ALT.exec(m[0]);
    out.push({ src: m[1] || m[2], alt: alt ? alt[1] : "" });
  }
  return out;
}

const pendientes = [];
function revisar(repo, num, tipo, obj) {
  if (!obj?.body || obj.user?.type === "Bot") return;
  const imgs = imagenes(obj.body).filter((i) => !archivadas.has(`${obj.html_url} ${i.src}`));
  if (!imgs.length) return;
  pendientes.push({
    repo, num, tipo,
    autor: obj.user.login,
    fecha: obj.submitted_at || obj.created_at,
    url: obj.html_url,
    imagenes: imgs,
  });
}

const repos = (await api(`installation/repositories?per_page=100`))
  .filter((r) => r.owner.login === ORG && r.name !== "historieta" && !r.archived);

for (const { name: repo } of repos) {
  // Issues y PRs tocados en la ventana: descripción, y para los PRs también sus reviews.
  for (const it of await api(`repos/${ORG}/${repo}/issues?state=all&since=${desde}&per_page=100`)) {
    const esPR = Boolean(it.pull_request);
    if (it.created_at >= desde) revisar(repo, it.number, esPR ? "pr-body" : "issue-body", it);
    if (esPR) {
      for (const rv of await api(`repos/${ORG}/${repo}/pulls/${it.number}/reviews?per_page=100`)) {
        if (rv.submitted_at >= desde) revisar(repo, it.number, "review", rv);
      }
    }
  }
  for (const c of await api(`repos/${ORG}/${repo}/issues/comments?since=${desde}&per_page=100`)) {
    revisar(repo, Number(c.issue_url.split("/").pop()), "comment", c);
  }
  for (const c of await api(`repos/${ORG}/${repo}/pulls/comments?since=${desde}&per_page=100`)) {
    revisar(repo, Number(c.pull_request_url.split("/").pop()), "inline", c);
  }
}

fs.writeFileSync("pendientes.jsonl", pendientes.map((p) => JSON.stringify(p)).join("\n") + (pendientes.length ? "\n" : ""));
console.log(`${repos.length} repos revisados desde ${desde.slice(0, 10)}; ${pendientes.length} comentario(s) con imágenes sin archivar`);
for (const p of pendientes) console.log(`- ${p.url} (${p.imagenes.length})`);
