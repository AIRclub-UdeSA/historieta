# historieta

Las caricaturas que se postean en comentarios y reviews de los repos de AIRclub-UdeSA, en orden de aparición.

**Página:** https://airclub-udesa.github.io/historieta/

## Cómo funciona

1. La GitHub App `airclub-historieta` está instalada en todos los repos de la org y avisa cada vez que alguien comenta, deja un review o edita un issue/PR.
2. `api/webhook.js` (Vercel, Team `airc-lub-ude-sa`) recibe el aviso, verifica la firma y, si el texto trae imágenes, dispara el workflow `guardar`.
3. `.github/workflows/guardar.yml` descarga cada imagen, la guarda en `archivo/` y agrega sus datos (autor, fecha, link al comentario) a `data/imagenes.json`.

Se guardan las imágenes de comentarios y reviews. De las descripciones de PR/issue solo se guardan las JPG, porque ahí casi todo son capturas de pantalla.

## Sacar una imagen de la historieta

Si se coló una captura, agregá su `sha256` (o su ruta en `archivo/`) a `data/excluidas.json`. La imagen queda archivada pero no se muestra.
