# Roadmap de Desarrollo: Ticket a Ventas

Este roadmap está pensado para que Joaquín construya el proyecto paso a paso en Cursor, con milestones pequeños y testeables.

---

## Milestone 1: Webhook de WhatsApp

**Objetivo**: Recibir mensajes de WhatsApp y verificar que el webhook funciona.

### Archivos a crear/modificar:
- `src/index.ts` - servidor Express
- `src/whatsapp/webhook.ts` - handlers GET (verify) y POST (receive)
- `src/whatsapp/webhook.test.ts` - tests unitarios
- `.env` - agregar `WHATSAPP_VERIFY_TOKEN` y `PORT`

### Tareas:
1. Crear servidor Express en puerto configurable
2. Implementar endpoint GET `/webhook` para verificación
   - Validar `hub.mode`, `hub.verify_token`, `hub.challenge`
   - Retornar challenge si válido
3. Implementar endpoint POST `/webhook` para recibir mensajes
   - Loguear payload completo
   - Retornar 200 OK siempre (aunque no proceses nada aún)
4. Tests:
   - Verificación exitosa con token correcto
   - Rechazo con token incorrecto
   - Recepción de mensaje dummy

### Criterio de aceptación:
- `npm test` pasa
- Servidor levanta con `npm run dev`
- Endpoint GET responde correctamente
- Endpoint POST recibe y loguea payload

### Siguientes pasos:
- Configurar webhook en WhatsApp Cloud API con URL de ngrok
- Probar con mensaje real desde WhatsApp

---

## Milestone 2: Extracción de Datos (Mock)

**Objetivo**: Procesar foto recibida y extraer datos con implementación mockeada del LLM.

### Archivos a crear/modificar:
- `src/extraction/schema.ts` - Zod schemas para venta extraída
- `src/extraction/extractor.ts` - interfaz + implementación mock
- `src/extraction/extractor.test.ts` - tests con casos de ejemplo
- `src/whatsapp/webhook.ts` - integrar extracción en POST handler

### Tareas:
1. Definir schemas Zod:
   - `ItemVentaSchema`
   - `VentaExtractedSchema`
2. Crear interfaz `IExtractor` con método `extract(imageUrl: string): Promise<VentaExtracted>`
3. Implementar `MockExtractor` que retorna datos hardcodeados con confianza 0.95
4. Integrar en webhook:
   - Detectar mensajes con imagen
   - Extraer media URL (simulado por ahora)
   - Llamar a extractor
   - Loguear resultado
5. Tests:
   - Schema valida JSON correcto
   - Schema rechaza JSON inválido (sin fecha, items vacíos, confianza > 1)
   - MockExtractor retorna datos válidos

### Criterio de aceptación:
- Todos los tests pasan
- Webhook detecta mensajes de imagen
- Extracción mock funciona y valida con Zod

### Siguientes pasos:
- Implementar `VisionLLMExtractor` real con OpenAI/Claude

---

## Milestone 3: Almacenamiento y Respuesta

**Objetivo**: Guardar ventas en base de datos y responder al usuario por WhatsApp.

### Archivos a crear/modificar:
- `prisma/schema.prisma` - modelo de datos
- `src/db/repositories/ventaRepository.ts` - CRUD de ventas
- `src/db/repositories/fotoRepository.ts` - CRUD de fotos
- `src/whatsapp/sender.ts` - envío de mensajes por WhatsApp API
- `src/services/ventaService.ts` - lógica de negocio
- Tests correspondientes

### Tareas:
1. Setup Prisma:
   - Definir modelos: `Comercio`, `Foto`, `Venta`, `Item`
   - Migración inicial
2. Crear repositories:
   - `crearVenta(data)`, `obtenerVentasPorComercio(comercioId, desde, hasta)`
   - `guardarFoto(data)`, `actualizarEstadoFoto(fotoId, estado)`
3. Implementar cliente WhatsApp:
   - `enviarMensaje(telefono, texto)`
   - Autenticación con `WHATSAPP_ACCESS_TOKEN`
4. Integrar en flujo webhook:
   - Guardar foto recibida
   - Extraer datos
   - Guardar venta + items
   - Generar resumen: "✅ Registré tu venta: $X en Y items (fecha Z)"
   - Enviar respuesta al usuario
5. Manejo de confianza baja:
   - Si `confianza < 0.7`: marcar `requiere_revision`
   - Responder: "📸 Recibí tu foto, la revisamos y te confirmamos"

### Criterio de aceptación:
- DB setup exitoso con `npx prisma migrate dev`
- Tests de repositories pasan (con DB en memoria o test DB)
- Tests de sender mockean API de WhatsApp
- Flujo end-to-end: recibir → extraer → guardar → responder

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
