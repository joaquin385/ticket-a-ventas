# Guía de Operación: Ticket a Ventas

Este documento describe qué está automatizado por IA y el sistema, versus qué requiere intervención manual del operador (Joaquín).

---

## Automatizado 100% por el Sistema

### 1. Procesamiento de Fotos
- **Qué hace**: Recibe foto por WhatsApp → extrae datos con Vision LLM → guarda en DB → responde resumen
- **Intervención humana**: Solo si confianza < 0.7 (ver "Cola de Revisión" más abajo)
- **Tiempo**: <10 segundos por foto
- **Costo**: ~USD 0.02 por foto (API de GPT-4V) + storage mínimo

### 2. Resúmenes Semanales
- **Qué hace**: Cada domingo a las 20:00, envía reporte automático a cada comercio
- **Contenido**: 
  - Total vendido en la semana
  - Promedio diario
  - Top 5 productos más vendidos
  - Medio de pago predominante
- **Intervención humana**: Ninguna
- **Monitoreo**: revisar logs por si algún envío falló

### 3. Forecast Mensual
- **Qué hace**: Último día del mes, proyecta ventas del próximo mes
- **Contenido**:
  - Proyección de ventas totales
  - Días pico esperados
  - Sugerencias de stock (si hay data suficiente)
- **Intervención humana**: Ninguna en fase 1
- **Mejora futura**: modelo ML más sofisticado

### 4. Cobros y Renovaciones
- **Qué hace**: Mercado Pago cobra automáticamente cada mes
- **Flujo**:
  1. MP intenta cobrar
  2. Si exitoso: webhook actualiza DB, resetea contador de fotos, envía confirmación
  3. Si falla: reintenta 3 veces en 7 días
  4. Si sigue fallando: marca suscripción como "vencida", envía notificación
- **Intervención humana**: Solo si cliente pide factura o tiene problema de pago recurrente

### 5. Control de Límites
- **Qué hace**: Verifica antes de procesar foto si el comercio tiene saldo en su plan
- **Si superó**: responde por WhatsApp "⚠️ Alcanzaste el límite..."
- **Intervención humana**: Ninguna

### 6. Respuestas de Soporte L1 (Futuro con AI Agent)
- **Qué automatizar**: Bot responde preguntas frecuentes
  - "¿Cómo exporto mis ventas?" → instrucciones automáticas
  - "¿Cuánto cuesta?" → info de planes
  - "No me llegó el resumen" → verificar envío y reenviar
- **Implementación**: ChatGPT API con contexto del comercio
- **Intervención humana**: escalación si el bot no puede resolver

---

## Tareas Manuales (~1 hora/día)

### 1. Cola de Revisión (Ventas con Baja Confianza)

**Frecuencia**: Diaria, preferiblemente 1-2 veces al día

**Proceso**:
1. Entrar al dashboard admin: `https://app.ticketaventas.com/admin`
2. Ver lista de fotos con `requiere_revision=true`
3. Para cada una:
   - Ver imagen original
   - Ver datos extraídos por el LLM
   - Corregir items/total si es necesario
   - Click "Aprobar" → sistema envía confirmación al comercio
4. Priorizar por antigüedad (las más viejas primero)

**Tiempo estimado**: 2-5 min por venta, ~10-20 ventas/día = 20-100 min

**Objetivo**: confianza del usuario de que sus datos son correctos

**Métrica clave**: % de ventas que requieren revisión (meta: <15%)

---

### 2. Soporte al Cliente (Nivel 2)

**Frecuencia**: Asíncrona, según demanda

**Canales**:
- WhatsApp directo (número del admin)
- Email (soporte@ticketaventas.com)
- Instagram DM

**Casos típicos**:
- Comercio quiere cambiar de plan → generar nuevo link de MP
- Error al procesar foto → revisar logs, reprocesar manualmente
- Pedido de factura → generar PDF con datos fiscales
- Consulta sobre forecast → explicar metodología
- Quiere cancelar suscripción → cancelar en MP dashboard, confirmar

**Tiempo estimado**: 5-10 mensajes/día, 3-5 min c/u = 15-50 min

**Automatización futura**: 
- FAQ chatbot absorbe 80% de consultas simples
- Queda solo casos complejos

---

### 3. Onboarding de Nuevos Clientes

**Frecuencia**: Según adquisición (variable)

**Proceso**:
1. Cliente llega al bot (via landing o referido)
2. Bot hace preguntas automáticas (nombre, tipo de comercio)
3. **[Manual]**: Si cliente tiene dudas sobre cómo funciona:
   - Mandar video demo por WhatsApp
   - Responder preguntas personalizadas
4. **[Manual]**: Seguimiento 48hs después del trial:
   - "¿Cómo te está yendo con Ticket a Ventas?"
   - Identificar fricción
   - Ayudar a configurar workflow

**Tiempo estimado**: 
- 10-15 min por cliente nuevo (si necesita ayuda)
- No todos necesitan contacto manual

**Meta**: >50% autoservicio completo, <50% necesita chat

---

### 4. Marketing de Contenido (SEO, Redes)

**Frecuencia**: 2-3 veces/semana

**Canales**:
- Instagram: casos de uso, tips para comerciantes
- Blog: artículos sobre gestión de comercios, fiscalidad, etc.
- YouTube (opcional): tutoriales, casos de éxito

**Contenido sugerido por IA**:
- Usar ChatGPT para generar borradores
- Usar Midjourney/DALL-E para imágenes
- Usar Descript para editar videos

**Tiempo estimado**: 1-2 horas/semana

**Objetivo**: atraer tráfico orgánico, posicionar marca

---

### 5. Análisis de Métricas y Ajustes

**Frecuencia**: Semanal (viernes tarde)

**Qué revisar**:
- **Adquisición**: nuevos usuarios/semana, fuente de tráfico
- **Activación**: % que manda al menos 1 foto en trial
- **Retención**: % que renueva después de trial
- **Revenue**: MRR (Monthly Recurring Revenue), churn rate
- **Producto**:
  - % de fotos con confianza baja → mejorar prompt del LLM
  - Tiempos de respuesta → optimizar si >10 seg
  - Quejas recurrentes → priorizar fixes

**Herramientas**:
- Dashboard interno (custom o Metabase)
- Google Analytics en landing
- Mercado Pago dashboard para billing

**Tiempo estimado**: 30-60 min/semana

**Acciones**: ajustar precios, mejorar prompts, agregar features

---

### 6. Facturación y Contabilidad

**Frecuencia**: Mensual

**Tareas**:
- Revisar ingresos del mes (MP transactions)
- Emitir facturas si hay clientes que lo requieran
- Pagar impuestos (Monotributo o Responsable Inscripto según facturación)
- Cuadrar cuentas con contador

**Tiempo estimado**: 1-2 horas/mes

**Herramienta**: software de facturación (Quipu, Xubio, etc.) o el mismo GoFactura

---

## Métricas a Trackear

### Producto
| Métrica | Definición | Meta |
|---------|------------|------|
| Tasa de éxito de extracción | % de fotos procesadas sin necesidad de revisión | >85% |
| Tiempo promedio de procesamiento | Desde recepción hasta respuesta | <10 seg |
| Uptime del sistema | % de tiempo que el webhook está funcionando | >99.5% |

### Negocio
| Métrica | Definición | Meta (primeros 6 meses) |
|---------|------------|-------------------------|
| Nuevos comercios/mes | Cantidad de trials iniciados | 20-50 |
| Tasa de conversión trial → pago | % que suscribe después de trial | >30% |
| Churn mensual | % de suscripciones canceladas/mes | <10% |
| MRR (Monthly Recurring Revenue) | Ingresos recurrentes mensuales | ARS 300k-1M |
| LTV (Lifetime Value) | Valor total de un cliente promedio | >ARS 200k |
| CAC (Customer Acquisition Cost) | Costo de adquirir un cliente | <ARS 30k |

### Operación
| Métrica | Definición | Meta |
|---------|------------|------|
| Tiempo en cola de revisión/día | Minutos dedicados a revisar ventas | <60 min |
| Tickets de soporte/día | Mensajes de clientes que requieren respuesta | <10 |
| Tiempo promedio de respuesta | Desde mensaje del cliente hasta resolución | <4 horas (laborables) |

---

## Roadmap de Automatización

### Corto plazo (Milestones 1-8)
- ✅ Extracción automática de datos
- ✅ Resúmenes y forecast automáticos
- ✅ Billing automático con Mercado Pago
- ✅ Control de límites

### Mediano plazo (próximos 3-6 meses)
- 🤖 Chatbot de soporte L1 (FAQ, exportación, estado de cuenta)
- 🤖 Detección automática de anomalías (ventas muy altas/bajas, requiere verificación)
- 🤖 Generación de contenido para blog/redes con IA
- 🤖 Emails automáticos de reengagement ("Te extrañamos, volvé a usar Ticket a Ventas")

### Largo plazo (6-12 meses)
- 🤖 Modelo custom de OCR entrenado con tickets argentinos (mejor que GPT-4V general)
- 🤖 Sistema de recomendaciones: "Considerá subir el precio de X" o "Deberías comprar más Y"
- 🤖 Integración con proveedores para pedidos automáticos
- 🤖 Auto-resolución de la mayoría de casos de soporte (solo casos complejos llegan a humano)

---

## Roles Futuros (Cuando Escale)

Si el proyecto crece a 200+ comercios:

1. **Operador de Revisión** (part-time o full-time)
   - Dedicado exclusivamente a cola de revisión
   - Puede ser remoto
   - Meta: procesar 100+ ventas/día

2. **Customer Success** (part-time)
   - Onboarding personalizado
   - Seguimiento proactivo de clientes
   - Identificar oportunidades de upsell

3. **Growth/Marketing** (freelance o part-time)
   - Contenido orgánico
   - Partnerships con asociaciones de comerciantes
   - Campañas pagas si hay presupuesto

4. **Dev/CTO** (Joaquín o contratación futura)
   - Mantener y mejorar el producto
   - Agregar features pedidas por clientes
   - Optimizar costos de infra y APIs

---

## Recomendaciones para las Primeras Semanas

### Semana 1: Testeo Intensivo
- Probar con 2-3 comercios piloto (amigos/familia)
- Procesar 20-30 fotos reales
- Ajustar prompts del LLM según errores comunes
- Refinar respuestas automáticas

### Semanas 2-4: Primeros 10 Clientes Pagos
- Foco en onboarding manual y personalizado
- Recolectar feedback directo
- Iterar rápido sobre pain points
- Confirmar que el billing funciona

### Meses 2-3: Automatización Progresiva
- Identificar patrones en soporte
- Crear respuestas template
- Implementar chatbot básico
- Reducir tiempo manual a <1h/día

### Mes 6: Operación Lean
- Sistema corre con mínima intervención
- Solo revisar métricas y soporte crítico
- Dedicar tiempo a growth y nuevas features
