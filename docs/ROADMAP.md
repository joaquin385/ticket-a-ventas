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

## Milestone 4: Exportación CSV/Excel

**Objetivo**: Usuario puede solicitar exportar sus ventas a archivo.

### Archivos a crear/modificar:
- `src/services/exportService.ts` - generación de CSV/Excel
- `src/whatsapp/commands.ts` - parser de comandos por texto
- `src/whatsapp/webhook.ts` - detectar comando "exportar"
- Tests

### Tareas:
1. Implementar generación de archivos:
   - `generarCSV(ventasConItems)` → buffer o path
   - `generarExcel(ventasConItems)` → buffer o path
   - Columnas: Fecha | Hora | Producto | Cantidad | Precio Unit. | Subtotal | Total Venta | Medio Pago
2. Parser de comandos:
   - Detectar "exportar", "exportar semana", "exportar mes"
   - Mapear a rango de fechas
3. Integrar en webhook:
   - Si mensaje de texto contiene comando
   - Obtener ventas del rango
   - Generar archivo
   - Subir a Cloudflare R2 o storage temporal
   - Enviar link al usuario por WhatsApp
4. Tests:
   - Generación de CSV con datos dummy
   - Parsing de comandos
   - Flujo completo con mock de storage

### Criterio de aceptación:
- Usuario envía "exportar mes" por WhatsApp
- Recibe link descargable con archivo Excel/CSV
- Archivo contiene todas las ventas del mes con items

---

## Milestone 5: Resúmenes Semanales y Forecast Mensual

**Objetivo**: Automatizar envío de insights sin que el usuario lo pida.

### Archivos a crear/modificar:
- `src/services/resumenService.ts` - cálculo de métricas
- `src/services/forecastService.ts` - proyección de ventas
- `src/jobs/resumenSemanal.ts` - cron job
- `src/jobs/forecastMensual.ts` - cron job
- `src/index.ts` - inicializar cron jobs
- Tests

### Tareas:
1. Servicio de resumen semanal:
   - Obtener ventas últimos 7 días por comercio
   - Calcular: total vendido, promedio diario, top 5 productos, medio de pago más usado
   - Formatear mensaje bonito con emojis
2. Servicio de forecast:
   - Obtener ventas últimos 3 meses
   - Calcular promedio diario y variación
   - Proyectar próximo mes
   - Identificar días de la semana con más venta
3. Cron jobs:
   - Resumen: todos los domingos a las 20:00
   - Forecast: último día del mes a las 18:00
4. Por cada comercio activo:
   - Generar reporte
   - Enviar por WhatsApp
   - Loguear envío
5. Tests:
   - Cálculo de métricas con datos fixture
   - Formateo de mensajes
   - Mock de envío

### Criterio de aceptación:
- Cron configurado y probado localmente (forzar ejecución)
- Mensajes bien formateados y útiles
- Tests pasan

---

## Milestone 6: Integración de Billing (Mercado Pago)

**Objetivo**: Cobrar suscripciones recurrentes y controlar límites de uso.

### Archivos a crear/modificar:
- `prisma/schema.prisma` - modelo `Suscripcion`
- `src/services/suscripcionService.ts` - lógica de planes y límites
- `src/mercadopago/preapproval.ts` - crear/cancelar suscripciones
- `src/mercadopago/webhook.ts` - recibir notificaciones de pago
- `src/middleware/verificarLimites.ts` - controlar fotos/mes
- `src/routes/checkout.ts` - endpoint para iniciar suscripción
- Tests

### Tareas:
1. Modelo de suscripciones:
   - Campos: plan, estado (trial, activa, vencida, cancelada), fechas, límites
2. Crear preapproval en Mercado Pago:
   - Endpoint `/checkout` que genera link de pago
   - Auto subscription con monto mensual
3. Webhook de Mercado Pago:
   - Recibir notificaciones de pago exitoso/fallido
   - Actualizar estado de suscripción
   - Resetear contador de fotos al cobrar
4. Middleware de límites:
   - Antes de procesar foto: verificar que no superó el plan
   - Si superó: responder "⚠️ Alcanzaste el límite de tu plan. Upgrade o esperá el próximo ciclo"
5. Trial automático:
   - Nuevos comercios arrancan en trial (14 días o 30 fotos)
   - Al vencer, enviar reminder de suscripción
6. Tests:
   - Creación de preapproval (mock SDK MP)
   - Procesamiento de webhook
   - Lógica de límites

### Criterio de aceptación:
- Usuario nuevo puede usar 30 fotos gratis
- Después recibe mensaje para suscribirse
- Link de pago funciona (sandbox MP)
- Webhook actualiza estado correctamente
- Límite se respeta y resetea al cobrar

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
