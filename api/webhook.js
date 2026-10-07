// Recibe los eventos de la GitHub App airclub-historieta y, si el texto trae
// imágenes, le pide al workflow "guardar" de este repo que las archive.
import crypto from "node:crypto";

const REPO = "AIRclub-UdeSA/historieta";
const IMG = /<img[^>]*src="([^"]+)"[^>]*>|!\[[^\]]*\]\(([^)\s]+)/g;
const ALT = /alt="([^"]*)"/;

// Qué texto mirar según el evento.
const TEXTO = {
  issue_comment: (p) => ["comment", p.comment],
  pull_request_review: (p) => ["review", p.review],
  pull_request_review_comment: (p) => ["inline", p.comment],
  issues: (p) => ["issue-body", p.issue],
  pull_request: (p) => ["pr-body", p.pull_request],
};

function firmaValida(cuerpo, firma) {
  const secreto = process.env.WEBHOOK_SECRET;
  if (!secreto || !firma) return false;
  const esperada = "sha256=" + crypto.createHmac("sha256", secreto).update(cuerpo).digest("hex");
  const a = Buffer.from(esperada);
  const b = Buffer.from(firma);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function imagenes(texto) {
  const out = [];
  for (const m of (texto || "").matchAll(IMG)) {
    const alt = ALT.exec(m[0]);
    out.push({ src: m[1] || m[2], alt: alt ? alt[1] : "" });
  }
  return out;
}

async function tokenDeInstalacion(instalacion) {
  const ahora = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const sinFirma = b64({ alg: "RS256", typ: "JWT" }) + "." + b64({ iat: ahora - 60, exp: ahora + 540, iss: process.env.APP_ID });
  const clave = process.env.APP_PRIVATE_KEY.replace(/\\n/g, "\n");
  const jwt = sinFirma + "." + crypto.createSign("RSA-SHA256").update(sinFirma).sign(clave, "base64url");
  const r = await fetch(`https://api.github.com/app/installations/${instalacion}/access_tokens`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, Accept: "application/vnd.github+json" },
    // Aunque la App esté instalada en toda la org, este token solo puede escribir en historieta.
    body: JSON.stringify({ repositories: ["historieta"], permissions: { contents: "write" } }),
  });
  if (!r.ok) throw new Error(`token de instalación: ${r.status} ${await r.text()}`);
  return (await r.json()).token;
}

export async function GET() {
  return Response.json({ ok: true, servicio: "historieta" });
}

export async function POST(request) {
  const cuerpo = await request.text();
  if (!firmaValida(cuerpo, request.headers.get("x-hub-signature-256"))) {
    return new Response("firma inválida", { status: 401 });
  }
  const evento = request.headers.get("x-github-event");
  const p = JSON.parse(cuerpo);
  if (evento === "ping") return Response.json({ pong: true });
  if (!TEXTO[evento] || !["created", "edited", "submitted", "opened"].includes(p.action)) {
    return Response.json({ ignorado: `${evento}/${p.action}` });
  }
  if (p.sender?.type === "Bot") return Response.json({ ignorado: "bot" });

  const [tipo, obj] = TEXTO[evento](p);
  const imgs = imagenes(obj?.body);
  if (imgs.length === 0) return Response.json({ ignorado: "sin imágenes" });

  const datos = {
    repo: p.repository.name,
    num: (p.issue || p.pull_request)?.number ?? null,
    tipo,
    autor: obj.user?.login,
    fecha: obj.submitted_at || obj.created_at,
    url: obj.html_url,
    imagenes: imgs,
  };
  console.log("imágenes encontradas", JSON.stringify(datos));

  if (!process.env.APP_ID || !process.env.APP_PRIVATE_KEY) {
    return Response.json({ modo: "prueba", datos });
  }
  const token = await tokenDeInstalacion(p.installation.id);
  const r = await fetch(`https://api.github.com/repos/${REPO}/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    body: JSON.stringify({ event_type: "imagen-nueva", client_payload: { datos } }),
  });
  if (!r.ok) return new Response(`dispatch falló: ${r.status} ${await r.text()}`, { status: 502 });
  return Response.json({ enviado: datos.imagenes.length });
}
