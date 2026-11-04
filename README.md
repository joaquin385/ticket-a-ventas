# Ticket a Ventas

## El Problema

Los comercios chicos (kioscos, almacenes, verdulerías) en Argentina manejan sus ventas en tickets de papel o cuadernos manuscritos. Al final del día o de la semana:

- **Pierden tiempo** anotando ventas a mano en planillas
- **No tienen visibilidad** de qué se vende más o cuándo
- **No pueden proyectar** compras ni flujo de caja
- **Les cuesta** hacer declaraciones impositivas

Las soluciones existentes (Cobrando, GoFactura, Vendi) requieren que el comerciante cargue producto por producto en una app o computadora. Para un kiosco con cientos de productos variados, es inviable.

## La Solución

**Ticket a Ventas** permite al dueño del comercio:

1. **Sacar una foto** del ticket o página del cuaderno con el celular
2. **Mandarlo por WhatsApp** al bot
3. **Recibir al toque** los datos estructurados (qué se vendió, cantidades, totales)
4. **Consultar** resúmenes semanales y proyecciones mensuales
5. **Exportar** todo a Excel/CSV cuando lo necesite

Todo automatizado con inteligencia artificial. Sin tipear nada.

## Usuarios Objetivo

- Kioscos de barrio
- Almacenes y dietéticas
- Verdulerías y fruterías
- Carnicerías y fiambrerías
- Pequeños comercios que facturan < ARS 10M/mes

**Perfil**: dueño o familiar que atiende, usa WhatsApp, saca fotos con el celu, no quiere cargar datos a mano.

## Modelo de Negocio

### Precios (hipótesis inicial)

| Plan | Precio | Fotos incluidas | Prueba gratuita |
|------|--------|-----------------|-----------------|
| **Básico** | ARS 15.000/mes | ~100 fotos/mes | 14 días o 30 fotos |
| **Plus** | ARS 30.000/mes | ~300 fotos/mes | 14 días o 30 fotos |

Pago mediante **Mercado Pago** (suscripción recurrente mensual).

### Competencia

- **Cobrando**: app de punto de venta, requiere cargar productos
- **GoFactura**: facturación electrónica, no extrae de fotos
- **Vendi**: app de gestión de stock, entrada manual
- **Diferenciador**: WhatsApp + foto → datos automáticos

## Arquitectura (Overview)

```
┌─────────────┐
│  WhatsApp   │  ← Usuario saca foto del ticket
└──────┬──────┘
       │ webhook
       ▼
┌─────────────────────────────────────────┐
│  Backend (Node + TypeScript)            │
│  - Recibe foto                          │
│  - Llama a Vision LLM (GPT-4V/Claude)   │
│  - Extrae items, precios, totales       │
│  - Guarda en Postgres (Supabase)        │
│  - Responde resumen por WhatsApp        │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────┐       ┌──────────────┐
│  Dashboard  │       │ Mercado Pago │
│  Web simple │       │ Suscripciones│
└─────────────┘       └──────────────┘
```

**Stack recomendado**:
- Backend: Node.js + TypeScript + Express
- Base de datos: PostgreSQL (Supabase)
- OCR/Extracción: OpenAI GPT-4V o Anthropic Claude 3.5 Sonnet
- Mensajería: WhatsApp Cloud API
- Pagos: Mercado Pago Subscriptions
- Deploy: Railway, Render o Fly.io

Ver detalles en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)

## Plan de Desarrollo

El proyecto está pensado para ser construido por pasos. Ver el roadmap completo en [docs/ROADMAP.md](docs/ROADMAP.md).

**Milestones clave**:
1. ✅ Scaffold inicial
2. Webhook de WhatsApp funcionando
3. Extracción de datos con Vision LLM
4. Almacenamiento y respuesta automática
5. Exportación a CSV/Excel
6. Resúmenes semanales y forecast mensual
7. Integración de billing con Mercado Pago
8. Cola de revisión para baja confianza
9. Landing page y onboarding

## Cómo Correr Localmente

### Prerequisitos

- Node.js 20+
- npm o pnpm
- PostgreSQL (o cuenta en Supabase)

### Setup

```bash
# Clonar el repo
git clone <url-del-repo>
cd ticket-a-ventas

# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Correr tests
npm test

# Modo desarrollo
npm run dev
```

### Obtener credenciales

- **WhatsApp Cloud API**: [developers.facebook.com](https://developers.facebook.com)
- **OpenAI API**: [platform.openai.com](https://platform.openai.com)
- **Supabase**: [supabase.com](https://supabase.com)
- **Mercado Pago**: [developers.mercadopago.com](https://developers.mercadopago.com)

## Operación y Automatización

Ver [docs/OPERACION.md](docs/OPERACION.md) para entender qué está automatizado y qué requiere intervención manual (~1h/día).

## Licencia

MIT
