# historieta

Las caricaturas que se postean en comentarios y reviews de los repos de AIRclub-UdeSA, guardadas automáticamente y ordenadas por fecha.

**Página:** https://airclub-udesa.github.io/historieta/

Nadie tiene que hacer nada para que una caricatura aparezca: cuando alguien la postea en cualquier repo de la org, se guarda sola en unos segundos.

## Cómo funciona

```
comentario con imagen en cualquier repo
        │  (aviso de la GitHub App airclub-historieta)
        ▼
api/webhook.js en Vercel ── verifica la firma y busca imágenes
        │  (repository_dispatch "imagen-nueva")
        ▼
workflow "guardar" ── descarga la imagen y la commitea en archivo/ + data/imagenes.json
        │
        ▼
GitHub Pages vuelve a publicar la página
```

Además, el workflow **"barrido"** corre todos los días a las 03:17 (hora de Argentina) y revisa los últimos 3 días de todos los repos. Si encuentra una imagen que no llegó por el camino de arriba (porque Vercel estaba caído, falló algo o la imagen se subió antes de que la App existiera), la guarda y lo anota en el resumen de la corrida, en la pestaña Actions.

### Qué imágenes se guardan

- **Comentarios, reviews y comentarios en el código:** todas las imágenes.
- **Descripciones de PRs e issues:** solo los JPG, porque ahí casi todo son capturas de pantalla en PNG.
- **Bots** (Vercel, Copilot, dependabot): nunca.
- **Este mismo repo:** el barrido lo saltea.

La misma imagen no se guarda dos veces: se compara por su hash (`sha256`).

Como no hay un filtro que distinga caricaturas de capturas, de vez en cuando se cuela alguna captura de un comentario. Se saca a mano: ver [Sacar una imagen de la historieta](#sacar-una-imagen-de-la-historieta).

### Ponerle título a una viñeta

El título que se ve en la historieta sale del **texto alternativo** (`alt`) de la imagen. Cuando pegás una imagen en GitHub, se inserta así:

```html
<img width="1024" height="1024" alt="image" src="https://github.com/user-attachments/assets/..." />
```

Cambiá `alt="image"` por el título que quieras, por ejemplo `alt="Raphael y Terminator encadenando el contenedor"`. En markdown es lo que va entre corchetes: `![Mi título](https://...)`.

- Si el `alt` es `image` o un nombre de archivo (sin espacios, con guiones, guiones bajos o puntos), la viñeta se muestra sin título.
- Si ya la publicaste sin título, editá el comentario y cambiale el `alt`: la viñeta se actualiza sola en unos segundos.

## Qué hay en el repo

| Ruta | Qué es |
|---|---|
| `index.html` | La página de la historieta (GitHub Pages, desde `main`). |
| `archivo/` | Las imágenes guardadas. El nombre es `fecha-repo-número-hash.ext`. |
| `data/imagenes.json` | Datos de cada imagen: archivo, hash, tamaño, autor, fecha, repo, número y link al comentario original. |
| `data/excluidas.json` | Hashes (o rutas) de imágenes archivadas que no se muestran en la página. |
| `api/webhook.js` | El receptor de avisos de la App. Corre en Vercel. |
| `scripts/guardar.mjs` | Descarga y archiva las imágenes de un comentario. Lo usan los dos workflows. |
| `scripts/barrer.mjs` | Recorre los repos de la org buscando imágenes sin archivar. |
| `.github/workflows/guardar.yml` | Guarda las imágenes que avisa la App. |
| `.github/workflows/barrido.yml` | El barrido diario de respaldo. |
| `.github/workflows/block-ai-coauthor.yml` | El check de co-autores de IA, igual que en los otros repos. |

## Sacar una imagen de la historieta

1. Buscá la imagen en `data/imagenes.json` y copiá su `sha256` (o su `archivo`).
2. Agregalo a la lista de `data/excluidas.json`.
3. Abrí un PR (ver [Protección de `main`](#protección-de-main)).

La imagen queda archivada en `archivo/`, pero deja de aparecer en la página cuando se mergea el PR.

## Protección de `main`

`main` tiene el mismo ruleset **"Protect main"** que los otros repos del club:

- No se puede borrar `main` ni hacer force push.
- Todo cambio entra por PR, con 1 aprobación.
- El check `check-commit-messages / check-commit-messages` tiene que pasar.

Pueden saltearse estas reglas los admins del repo, como en el resto de la org, y **la App `airclub-historieta`**. Esa excepción es lo que permite que los workflows commiteen las imágenes directo en `main`. Por eso los workflows pushean con un token de la App, limitado a este repo, y no con el token común de Actions: ese token no tiene la excepción y GitHub le rechazaría el push. Los commits del bot aparecen como `airclub-historieta[bot]`.

## Correr los workflows a mano

En **Actions**:

- **guardar** → *Run workflow*: pide un JSON con los datos de un comentario. Sirve para cargar a mano una imagen puntual:
  ```json
  {"repo":"airclub-site","num":48,"tipo":"review","autor":"juan-kaplan","fecha":"2026-10-07T21:22:50Z","url":"https://github.com/AIRclub-UdeSA/airclub-site/pull/48#pullrequestreview-5448526182","imagenes":[{"src":"https://github.com/...jpg?raw=true","alt":""}]}
  ```
  `tipo` puede ser `comment`, `review`, `inline`, `pr-body` o `issue-body`.
- **barrido** → *Run workflow*: elegís cuántos días revisar. Con **simular** tildado solo lista lo que encontraría, sin guardar nada.

## Configuración

### GitHub App `airclub-historieta`

- Es de la org: **Settings → GitHub Apps → airclub-historieta**. App ID `5229671`.
- Instalada en **todos los repos**, también los que se creen después.
- Permisos: Contents (lectura y escritura), Issues y Pull requests (solo lectura).
- Eventos: Issues, Issue comment, Pull request, Pull request review, Pull request review comment.
- Webhook: `https://historieta-ashy.vercel.app/api/webhook`, con una clave secreta.
- Solo la pueden administrar los owners de la org.

### Secretos y variables de este repo

| Nombre | Tipo | Para qué |
|---|---|---|
| `HISTORIETA_APP_ID` | Variable | App ID de `airclub-historieta`. |
| `HISTORIETA_APP_PRIVATE_KEY` | Secreto | Clave privada de la App. |

Los nombres llevan el prefijo `HISTORIETA_` a propósito: la org ya tiene secretos `APP_ID` y `APP_PRIVATE_KEY` para `airclub-projects-bot`, y un secreto del repo con el mismo nombre pisaría al de la org.

### Vercel

- Proyecto `historieta` en el Team del club `airc-lub-ude-sa`.
- Variables de entorno (Production): `WEBHOOK_SECRET` (la misma clave que el webhook de la App), `APP_ID` y `APP_PRIVATE_KEY`.
- La URL pública es `historieta-ashy.vercel.app`. Las URLs de cada deploy individual están protegidas por Vercel, pero la de producción es pública, como necesita GitHub para mandar los avisos.
- **El proyecto no está conectado al repo** (ver [#3](https://github.com/AIRclub-UdeSA/historieta/issues/3)). Si cambiás `api/webhook.js`, después de mergear hay que desplegarlo a mano, con el login de Vercel de la cuenta del club:
  ```
  npx vercel deploy --prod --yes --scope airc-lub-ude-sa
  ```
  La página, el guardado y el barrido no pasan por Vercel, así que solo hace falta desplegar cuando cambia el receptor.

### Cambiar la clave secreta del webhook

1. Generá una clave nueva (por ejemplo, `openssl rand -hex 32`).
2. Cargala en Vercel como `WEBHOOK_SECRET`, reemplazando la anterior, y desplegá de nuevo.
3. Ponela en la App: **Settings → GitHub Apps → airclub-historieta → Webhook secret**.

Entre el paso 2 y el 3 los avisos fallan, pero el barrido diario recupera lo que se pierda.

### Cambiar la clave privada de la App

En la página de la App, **Private keys → Generate a private key**. Después actualizá `HISTORIETA_APP_PRIVATE_KEY` en este repo y `APP_PRIVATE_KEY` en Vercel (con un nuevo deploy), y recién ahí borrá la clave vieja en la App.

## Si algo no anda

- **Una caricatura no apareció:** fijate en **Actions → guardar** si hubo una corrida para ese comentario. Si no la hay, revisá las entregas del webhook en **Settings → GitHub Apps → airclub-historieta → Advanced → Recent Deliveries**: ahí se ve si el aviso llegó a Vercel y qué respondió. Igual, el barrido de esa noche la va a recuperar.
- **Recent Deliveries muestra 401:** la clave del webhook en la App y la de Vercel (`WEBHOOK_SECRET`) no coinciden.
- **Recent Deliveries muestra 500:** el receptor no pudo pedir el token de la App. Revisá `APP_ID` y `APP_PRIVATE_KEY` en Vercel, y que la App siga instalada. Los logs están en Vercel, en el proyecto `historieta` → **Logs**.
- **Recent Deliveries muestra 502 con "dispatch falló":** el receptor tuvo el token, pero GitHub rechazó el pedido para disparar el workflow. El detalle del error viene en la respuesta.
- **"guardar" o "barrido" fallan en el paso del token:** revisá `HISTORIETA_APP_ID` y `HISTORIETA_APP_PRIVATE_KEY` en este repo.
- **El push del bot es rechazado:** revisá que la App siga como excepción del ruleset "Protect main" (**Settings → Rules → Rulesets**).
- **Un adjunto da 404 al descargarlo:** algunos adjuntos (`user-attachments`) solo se pueden bajar con un token aunque el repo sea público, y los que se subieron cuando un repo era privado siguen siendo privados: GitHub no los sirve desde el link del comentario ni con token. `guardar.mjs` prueba en orden el link directo, el link con el token de Actions y, por último, el link firmado y temporal que aparece en el HTML del comentario (lo pide a la API con el token de lectura de la App). Si nada funciona, la imagen fue borrada o el link apunta a una rama que ya no existe.
- **El barrido recupera imágenes seguido:** el camino en vivo está fallando. Empezá por Recent Deliveries.
