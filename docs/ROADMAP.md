# Roadmap de Desarrollo: Ticket a Ventas

Este roadmap está pensado para que Joaquín construya el proyecto paso a paso en Cursor, con milestones pequeños y testeables.

---

## Milestone 1: Webhook de WhatsApp — ✅ HECHO

**Objetivo**: Recibir mensajes de WhatsApp y verificar que el webhook funciona.

### Entregado
- `src/index.ts` — servidor Express (`npm run dev`)
- `src/whatsapp/webhook.ts` — verify + receive + descarga de imágenes
- `src/whatsapp/signature.ts` — `X-Hub-Signature-256` con `WHATSAPP_APP_SECRET`
- `src/whatsapp/media.ts` — Graph API media download + `MockMediaClient`
- `src/whatsapp/routes.ts` — GET/POST `/webhook`, `/health`
- Sin token → mock (tests y local sin Meta)

### Criterio de aceptación: cumplido
- `npm test` pasa; GET verify; POST recibe y valida firma

### Para ir a producción (M1)
1. App en [Meta for Developers](https://developers.facebook.com) con producto WhatsApp
2. Número de WhatsApp Business + `WHATSAPP_PHONE_NUMBER_ID`
3. `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`
4. URL pública (ngrok/Railway) apuntando a `POST/GET /webhook`

---

## Milestone 2: Extracción con Vision LLM — ✅ HECHO

**Objetivo**: Extraer venta estructurada con Vision LLM (JSON + confianza).

### Entregado
- `src/extraction/schema.ts` — Zod + `requiereRevision`
- `src/extraction/extractor.ts` — `IExtractor`, `MockExtractor`, `VisionLLMExtractor` (OpenAI-compatible)
- `src/extraction/prompt.ts` — system prompt + JSON schema estricto
- Fixtures: `fixtures/venta-alta-confianza.json`, `venta-baja-confianza.json`
- Sin `VISION_API_KEY` → `MockExtractor`

### Criterio de aceptación: cumplido
- Extracción validada con Zod; flag baja confianza; tests con fetch mockeado

### Para ir a producción (M2)
1. API key de un proveedor OpenAI-compatible (OpenAI, Azure, Groq, etc.)
2. `VISION_API_KEY`, `VISION_API_PROVIDER=openai`, `VISION_API_BASE_URL`, `VISION_MODEL` (ej. `gpt-4o`)

---

## Milestone 3: Almacenamiento y Respuesta — ✅ HECHO

**Objetivo**: Persistencia Neon + fotos en R2 + reply por WhatsApp.

### Entregado
- Repositorios SQL vía `src/db/client.ts` (Neon) + memoria si no hay `DATABASE_URL`
  - `comercioRepository`, `fotoRepository`, `ventaRepository`
- `migrations/002_create_tables.sql` — schema completo
- `src/storage/storage.ts` — `IStorage`, `MockStorage`, `CloudflareR2Storage`
- `src/whatsapp/sender.ts` — Graph send + mock
- `src/services/ventaService.ts` — pipeline: foto → R2 → extract → DB → reply
- Resumen en español: `✅ Registré tu venta...` / `📸 Recibí tu foto, la revisamos...`

### Criterio de aceptación: cumplido
- Repos + sender + pipeline e2e en tests con mocks
- Sin Prisma: SQL puro + Neon (alineado al stack del repo)

### Para ir a producción (M3) — credenciales necesarias
| Servicio | Qué crear | Variables |
|----------|-----------|-----------|
| **Meta / WhatsApp** | App + número WA Business | `WHATSAPP_*` (ver M1) |
| **Neon** | Proyecto Postgres + pooler | `DATABASE_URL` (correr `migrations/*.sql`) |
| **Vision LLM** | API key OpenAI-compatible | `VISION_API_*` (ver M2) |
| **Cloudflare R2** | Bucket + API token S3 | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` |

Sin estas variables el servidor corre en **modo mock** (útil para desarrollo y `npm test`).

---

## Milestone 4: Exportación CSV/Excel — ✅ HECHO

**Objetivo**: Usuario puede solicitar exportar sus ventas a archivo.

### Entregado
- `src/services/exportService.ts` — CSV + Excel (hojas **Ventas** y **Totales**), columnas en español, montos ARS
- `src/whatsapp/commands.ts` — `exportar` / `exportar mes` / `exportar semana` / `exportar csv`
- `src/whatsapp/documentSender.ts` — upload media Graph API + envío documento (mock en tests)
- `src/services/exportHandler.ts` — orquesta WhatsApp → archivo
- `GET /api/export` — Bearer `EXPORT_API_TOKEN`, query `comercio_id`, `desde`, `hasta`, `formato`

### Criterio de aceptación: cumplido
- WhatsApp: "exportar mes" → responde con archivo `.xlsx`/`.csv` (documento vía Graph / mock)
- HTTP autenticado descarga el mismo export
- Archivo incluye ítems + hoja/sección Totales

### Uso
```text
WhatsApp: exportar | exportar mes | exportar semana | exportar mes csv
HTTP: GET /api/export?comercio_id=...&desde=YYYY-MM-DD&hasta=YYYY-MM-DD&formato=xlsx
      Authorization: Bearer $EXPORT_API_TOKEN
```

---

## Milestone 5: Resúmenes Semanales y Forecast Mensual — ✅ HECHO

**Objetivo**: Insights on-demand y job programable de resumen semanal.

### Entregado
- `src/services/resumenService.ts` — total, #ventas, ticket promedio, top productos, vs semana anterior
- `src/services/forecastService.ts` — proyección del mes (promedio diario + día de semana) con rango
- `src/services/insightsHandler.ts` — WhatsApp `resumen` / `pronostico`|`pronóstico`
- `POST /api/jobs/resumen-semanal` — Bearer `JOBS_API_TOKEN` (lunes → semana lun–dom previa)
- `migrations/003_envios_programados.sql` — tabla opcional de auditoría (no aplicada a Neon desde el agente)

### Uso
```text
WhatsApp: resumen
WhatsApp: pronostico | pronóstico
Cron (lunes): POST /api/jobs/resumen-semanal
  Authorization: Bearer $JOBS_API_TOKEN
  body/query opcional: { "fecha": "2024-11-11T12:00:00Z" }
```

### Criterio de aceptación: cumplido
- Cálculos + mensajes ES rioplatense + job HTTP testeado con mocks

---

## Milestone 6: Integración de Billing (Mercado Pago) — ✅ HECHO

**Objetivo**: Cobrar suscripciones recurrentes (preapproval) y controlar trial/límites.

### Entregado
- Trial: **14 días o 30 fotos** (lo que ocurra primero) — `TRIAL_DAYS` / `TRIAL_PHOTOS`
- Precio mensual configurable: `SUBSCRIPTION_PRICE_ARS` (default **7000**)
- `SuscripcionService` + `MockMercadoPagoClient` / cliente real preapproval
- WhatsApp: `suscribirme` / `pagar` → link; `estado` / `mi plan` → estado del plan
- Gate en fotos: sin trial vigente ni plan activo → mensaje amable + link
- `POST /webhooks/mercadopago` con validación `x-signature`
- Estados: `trial` | `activa` | `pausada` | `cancelada` | `en_mora`
- `migrations/004_suscripciones_billing.sql` (no aplicada a Neon)

### Uso
```text
WhatsApp: suscribirme | pagar | estado | mi plan
Webhook MP: POST /webhooks/mercadopago  (x-signature + x-request-id)
Cron tip: al vencer trial el próximo ticket dispara el link solo.
```

### Env
`MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `SUBSCRIPTION_PRICE_ARS`, `TRIAL_DAYS`, `TRIAL_PHOTOS`

---

## Milestone 7: Cola de Revisión (Low Confidence)

**Objetivo**: Admin puede revisar y corregir ventas con baja confianza.

### Archivos a crear/modificar:
- `src/routes/admin.ts` - endpoints REST para dashboard
- `src/services/revisionService.ts` - marcar como revisada, editar venta
- `src/admin/dashboard.html` - página web simple con tabla
- Tests

### Tareas:
1. Endpoints admin:
   - `GET /admin/ventas/revision` → lista de ventas con `requiere_revision=true`
   - `PUT /admin/ventas/:id` → actualizar items/total
   - `POST /admin/ventas/:id/aprobar` → marcar como revisada
2. Dashboard HTML minimalista:
   - Tabla con foto, datos extraídos, confianza
   - Botones "Aprobar" / "Editar"
   - Formulario inline para corregir items
3. Notificar al usuario cuando se aprueba:
   - Enviar WhatsApp con datos finales
4. Tests:
   - CRUD de revisión
   - Autorización básica (admin token)

### Criterio de aceptación:
- Admin puede ver lista de ventas pendientes
- Puede aprobar o editar
- Usuario recibe confirmación post-revisión

---

## Milestone 8: Landing Page y Onboarding

**Objetivo**: Página pública para atraer usuarios y flow de alta.

### Archivos a crear/modificar:
- `public/index.html` - landing page
- `src/routes/onboarding.ts` - alta de comercio
- `src/services/onboardingService.ts` - crear comercio + enviar mensaje bienvenida
- Tests

### Tareas:
1. Landing page:
   - Hero: problema + solución
   - Cómo funciona (3 pasos con ilustraciones)
   - Precios
   - Testimonios (placeholder)
   - CTA: "Empezar gratis" → link de WhatsApp con mensaje pre-rellenado
2. Flow de onboarding:
   - Usuario manda mensaje inicial (ej: "Hola")
   - Bot responde: "¡Hola! Para empezar, ¿cuál es el nombre de tu comercio?"
   - Chatbot simple recolecta: nombre, tipo de comercio, ubicación
   - Crea registro en DB
   - Responde: "Listo! Ahora mandame una foto de un ticket para probar"
3. Tests:
   - Conversación de onboarding con fixture
   - Creación de comercio

### Criterio de aceptación:
- Landing se ve bien en mobile
- Flujo de alta funciona end-to-end
- Nuevo comercio queda registrado y puede usar el bot

---

## Milestones Opcionales (Post-MVP)

### M9: Analytics y Dashboard Web
- Dashboard con gráficos de ventas (Chart.js o Recharts)
- Login con código por WhatsApp
- Ver resúmenes, exportar, cambiar plan

### M10: Notificaciones Proactivas
- "Llevás 3 días sin cargar ventas, ¿está todo bien?"
- "Tu mejor producto esta semana fue X, considerá aumentar stock"

### M11: Integración con Proveedores
- Sugerir pedidos a proveedores según forecast
- Export automático a sistema del proveedor

### M12: Multiusuario por Comercio
- Varios empleados pueden mandar fotos
- Permisos diferenciados

---

## Notas para el Desarrollo

### Cómo trabajar cada milestone:
1. Leé el objetivo y los archivos a modificar
2. Escribí los tests primero (TDD recomendado)
3. Implementá el código hasta que los tests pasen
4. Probá manualmente con ngrok si involucra WhatsApp
5. Commiteá con mensaje descriptivo: "feat: webhook de WhatsApp"
6. Pasá al siguiente milestone

### Herramientas útiles:
- **ngrok**: exponer localhost para webhooks
- **Postman/Insomnia**: probar endpoints manualmente
- **Prisma Studio**: `npx prisma studio` para ver DB
- **WhatsApp Test Number**: usar tu propio número en modo desarrollo

### Cuando algo no sale:
- Revisá los logs (Winston o Pino)
- Chequeá las variables de entorno
- Consultá la doc oficial de WhatsApp/MP/OpenAI
- Pedí ayuda en la comunidad (Discord de Cursor, Stack Overflow)
