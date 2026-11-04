#!/usr/bin/env node
/**
 * Smoke test post-deploy
 *
 * Uso:
 *   BASE_URL=https://tu-app.fly.dev ADMIN_API_TOKEN=... node scripts/smoke-test.mjs
 *   npm run smoke -- --base https://tu-app.onrender.com
 */

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(name);
  if (i >= 0 && args[i + 1]) return args[i + 1];
  return fallback;
}

const base = (arg('--base', process.env.BASE_URL || 'http://127.0.0.1:3000')).replace(
  /\/$/,
  ''
);
const adminToken = process.env.ADMIN_API_TOKEN || '';
const jobsToken = process.env.JOBS_API_TOKEN || process.env.EXPORT_API_TOKEN || '';

let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`✗ ${name}: ${err.message || err}`);
  }
}

await check('GET /health', async () => {
  const res = await fetch(`${base}/health`);
  if (!res.ok) throw new Error(`status ${res.status}`);
  const json = await res.json();
  if (json.status !== 'ok') throw new Error('status != ok');
});

await check('GET /landing', async () => {
  const res = await fetch(`${base}/landing`);
  if (!res.ok) throw new Error(`status ${res.status}`);
  const html = await res.text();
  if (!html.includes('Ticket a')) throw new Error('sin marca en HTML');
  if (!html.includes('7.000') && !html.includes('7000')) {
    throw new Error('sin precio 7000 en landing');
  }
});

await check('GET /admin', async () => {
  const res = await fetch(`${base}/admin`);
  if (!res.ok) throw new Error(`status ${res.status}`);
  const html = await res.text();
  if (!html.includes('revisión') && !html.includes('revision')) {
    throw new Error('admin HTML inesperado');
  }
});

await check('GET /admin/api sin token → 401', async () => {
  const res = await fetch(`${base}/admin/api/ventas/revision`);
  if (res.status !== 401) throw new Error(`esperado 401, got ${res.status}`);
});

if (adminToken) {
  await check('GET /admin/api con token', async () => {
    const res = await fetch(`${base}/admin/api/ventas/revision`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('respuesta no es array');
  });
} else {
  console.log('· skip admin API autenticada (sin ADMIN_API_TOKEN)');
}

await check('POST /api/jobs sin token → 401', async () => {
  const res = await fetch(`${base}/api/jobs/resumen-semanal`, { method: 'POST' });
  if (res.status !== 401) throw new Error(`esperado 401, got ${res.status}`);
});

if (jobsToken) {
  console.log('· JOBS_API_TOKEN presente (no disparamos el job masivo en smoke)');
}

if (failed > 0) {
  console.error(`\nSmoke falló: ${failed} check(s)`);
  process.exit(1);
}

console.log('\nSmoke OK');
