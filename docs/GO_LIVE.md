# Go-live: checklist para salir a producción

Guía paso a paso para alguien no experto. **No hace falta tener nada creado todavía.**
Seguí el orden. Al final vas a tener la app en internet, WhatsApp funcionando y el cobro listo.

> Tip: anotá cada valor en un gestor de secretos o en el panel de Fly/Render. **Nunca** subas secretos al repo.

---

## 0. Qué vas a crear

| # | Cuenta | Para qué |
|---|--------|----------|
| 1 | Neon | Postgres (base de datos) |
| 2 | Meta / WhatsApp Cloud API | Recibir y mandar mensajes |
| 3 | OpenAI (u otro LLM con visión) | Leer fotos de tickets |
| 4 | Cloudflare R2 (opcional al inicio) | Guardar fotos |
| 5 | Mercado Pago | Suscripciones ARS 7.000/mes |
| 6 | Fly.io o Render | Hosting del backend |
| 7 | Cloudflare Pages (opcional) | Landing `/landing` |
| 8 | Cron (cron-job.org / EasyCron) | Resumen semanal los lunes |

---

## 1. Neon (base de datos) — primero

1. Entrá a [neon.tech](https://neon.tech) → Create project → región cercana (p. ej. São Paulo si está).
2. Copiá la connection string **pooled** (termina en `-pooler...` y suele traer `sslmode=require`).
3. Guardala como `DATABASE_URL`.
4. Abrí el SQL Editor de Neon y ejecutá **en orden**:
   - `migrations/001_create_schema.sql`
   - `migrations/002_create_tables.sql`
   - `migrations/003_envios_programados.sql`
   - `migrations/004_suscripciones_billing.sql`
5. Verificá que existan tablas: `comercios`, `ventas`, `suscripciones`, etc.

**Variable:** `DATABASE_URL`

---

## 2. Meta App + WhatsApp

1. [developers.facebook.com](https://developers.facebook.com) → My Apps → Create App → tipo **Business**.
2. Agregá el producto **WhatsApp**.
3. En API Setup:
   - Anotá **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`
   - Generá un **temporary** o **permanent** access token → `WHATSAPP_ACCESS_TOKEN`
4. En App settings → Basic: copiá **App Secret** → `WHATSAPP_APP_SECRET`
5. Elegí un verify token tuyo (frase secreta) → `WHATSAPP_VERIFY_TOKEN`
6. Cuando la app ya esté desplegada (paso 6), configurá el webhook:
   - Callback URL: `https://TU-DOMINIO/webhook`
   - Verify token: el mismo de `WHATSAPP_VERIFY_TOKEN`
   - Suscribí el campo `messages`
7. Agregá tu número personal como tester y mandá un mensaje de prueba.

**Variables:**  
`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_API_VERSION=v21.0`

---

## 3. Vision LLM (lectura de tickets)

1. Creá cuenta en [platform.openai.com](https://platform.openai.com) (o un proveedor compatible).
2. Generá una API key.
3. Modelo recomendado con visión: `gpt-4o`.

**Variables:**  
`VISION_API_KEY`, `VISION_API_PROVIDER=openai`, `VISION_API_BASE_URL=https://api.openai.com/v1`, `VISION_MODEL=gpt-4o`

---

## 4. Cloudflare R2 (fotos) — opcional al día 1

Si preferís arrancar sin R2, la app usa mock local; igual conviene tenerlo pronto.

1. [dash.cloudflare.com](https://dash.cloudflare.com) → R2 → Create bucket (ej. `ticket-a-ventas-fotos`).
2. Manage R2 API Tokens → Create API token (Object Read & Write).
3. Anotá Account ID, Access Key ID, Secret.

**Variables:**  
`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` (si exponés el bucket por dominio público)

---

## 5. Mercado Pago (suscripciones)

1. [developers.mercadopago.com](https://developers.mercadopago.com) → Credenciales de producción (o test primero).
2. Access Token → `MERCADOPAGO_ACCESS_TOKEN`
3. Public Key → `MERCADOPAGO_PUBLIC_KEY` (opcional en el backend actual)
4. Webhooks → URL: `https://TU-DOMINIO/webhooks/mercadopago`
5. Secret de firma → `MERCADOPAGO_WEBHOOK_SECRET`
6. Precio del plan (default del código: **7000** ARS).

**Variables:**  
`MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_PUBLIC_KEY`, `MERCADOPAGO_WEBHOOK_SECRET`,  
`SUBSCRIPTION_PRICE_ARS=7000`, `TRIAL_DAYS=14`, `TRIAL_PHOTOS=30`

---

## 6. Hosting (Fly.io o Render)

### Opción A — Fly.io

```bash
fly auth login
fly launch --no-deploy   # usa fly.toml del repo
fly secrets set DATABASE_URL="..." WHATSAPP_ACCESS_TOKEN="..." # etc.
fly deploy
fly status
```

Healthcheck: `GET /health` (ya en `fly.toml` + Dockerfile).

### Opción B — Render

1. New → Blueprint → `render.yaml`
2. Completá los secretos marcados `sync: false`
3. Deploy. Health check path: `/health`

**Variables de app:**  
`NODE_ENV=production`, `PORT=3000`, `BASE_URL=https://TU-DOMINIO`

**Tokens internos (generá strings largos al azar):**  
`ADMIN_API_TOKEN`, `EXPORT_API_TOKEN`, `JOBS_API_TOKEN`, `API_TOKEN` (opcional, fallback)

**Landing WhatsApp CTA:**  
`LANDING_WHATSAPP_NUMBER=54911XXXXXXXX` (sin + ni espacios)

---

## 7. Webhooks (después del deploy)

1. Meta WhatsApp → Callback `https://TU-DOMINIO/webhook`
2. Mercado Pago → `https://TU-DOMINIO/webhooks/mercadopago`
3. Probá: mandá una foto por WhatsApp; deberías recibir el resumen.

---

## 8. Cron de los lunes (resumen semanal)

1. En [cron-job.org](https://cron-job.org) (o similar): Create cronjob.
2. URL: `https://TU-DOMINIO/api/jobs/resumen-semanal`
3. Método: **POST**
4. Header: `Authorization: Bearer TU_JOBS_API_TOKEN`
5. Schedule: todos los **lunes 10:00** America/Argentina/Buenos_Aires (o la hora que prefieras).

---

## 9. Landing en Cloudflare Pages (opcional)

1. Pages → Create → upload carpeta `landing/` (o conectar repo, root `landing`).
2. Sin build command.
3. Abrí con `?wa=54911XXXXXXXX` o configurá el número en el HTML.

La misma landing también vive en `https://TU-DOMINIO/landing`.

---

## 10. Smoke test post-deploy

```bash
BASE_URL=https://TU-DOMINIO \
ADMIN_API_TOKEN=... \
npm run smoke
```

Debe imprimir `Smoke OK`.

---

## 11. Admin de revisión

1. Abrí `https://TU-DOMINIO/admin`
2. Pegá `ADMIN_API_TOKEN`
3. Revisá / aprobá tickets de baja confianza

---

## Orden resumido de variables

Cargalas en el host **antes** del primer deploy útil:

1. `DATABASE_URL` (+ migraciones 001→004 en Neon)  
2. `WHATSAPP_*` + `WHATSAPP_VERIFY_TOKEN`  
3. `VISION_API_*`  
4. `MERCADOPAGO_*` + `SUBSCRIPTION_PRICE_ARS` / `TRIAL_*`  
5. `BASE_URL`  
6. `ADMIN_API_TOKEN`, `JOBS_API_TOKEN`, `EXPORT_API_TOKEN`  
7. `LANDING_WHATSAPP_NUMBER`  
8. `R2_*` (cuando quieras persistir fotos)  
9. `MIN_CONFIDENCE_SCORE=0.7` (opcional)

---

## Checklist final

- [ ] Migraciones 001–004 aplicadas en Neon  
- [ ] `/health` responde ok  
- [ ] Webhook WhatsApp verificado  
- [ ] Foto de prueba → respuesta por WhatsApp  
- [ ] `suscribirme` → link Mercado Pago  
- [ ] Webhook MP configurado  
- [ ] Cron lunes configurado  
- [ ] `/landing` y `/admin` accesibles  
- [ ] `npm run smoke` en verde  
