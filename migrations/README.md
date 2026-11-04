# Migraciones de Base de Datos

Este directorio contiene las migraciones SQL puras para la base de datos PostgreSQL (Neon).

## Filosofía

- **SQL puro**: sin vendor lock-in, compatible con cualquier Postgres
- **Numeradas secuencialmente**: `001_nombre.sql`, `002_nombre.sql`, etc.
- **Idempotentes**: usar `IF NOT EXISTS` cuando sea posible
- **Una feature por migración**: cambios atómicos y reversibles

## Estructura

```
migrations/
├── README.md (este archivo)
├── 001_create_schema.sql
├── 002_create_comercios.sql
├── 003_create_usuarios.sql
└── ...
```

## Cómo ejecutar

### Opción 1: Manualmente (desarrollo)

```bash
# En la consola SQL de Neon:
psql $DATABASE_URL -f migrations/001_create_schema.sql
psql $DATABASE_URL -f migrations/002_create_comercios.sql
# etc.
```

### Opción 2: Script Node.js

Crear `scripts/migrate.ts`:

```typescript
import { readFileSync } from 'fs';
import { query, closePool } from '../src/db/client.js';

const migrations = [
  '001_create_schema.sql',
  '002_create_comercios.sql',
  // ...
];

for (const file of migrations) {
  const sql = readFileSync(`migrations/${file}`, 'utf-8');
  await query(sql);
  console.log(`✓ ${file}`);
}

await closePool();
```

Ejecutar con: `tsx scripts/migrate.ts`

### Opción 3: Herramienta (recomendado para producción)

Usar `node-pg-migrate` o similar:

```bash
npm install -D node-pg-migrate
npx node-pg-migrate create nombre-de-migracion
npx node-pg-migrate up
```

## Convenciones

- Nombres en snake_case
- Usar `TIMESTAMP DEFAULT NOW()` para timestamps
- Foreign keys con `ON DELETE CASCADE` o `ON DELETE SET NULL` según corresponda
- Índices para queries frecuentes (comercio_id, fecha, etc.)
- Comentarios SQL para lógica no obvia

## Rollback

Cada migración debería tener su versión `down` para revertir:

```
migrations/
├── 001_create_comercios.up.sql
├── 001_create_comercios.down.sql
```

O usar transacciones cuando sea posible:

```sql
BEGIN;
  -- cambios aquí
  -- si falla, hace ROLLBACK automático
COMMIT;
```
