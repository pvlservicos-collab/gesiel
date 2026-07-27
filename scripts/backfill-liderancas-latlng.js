// Script de uso único: joga pro banco as coordenadas que já tínhamos em
// liderancas-geo.json (gerado antes da lat/lng virar coluna no banco), pra
// não precisar geocodificar de novo as lideranças já cadastradas.
// Depois desse backfill, o banco vira a única fonte de verdade (mapa.html
// lê direto de /api/admin/liderancas-geo, não mais desse arquivo).
// Uso: node scripts/backfill-liderancas-latlng.js
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const ROOT = path.join(__dirname, '..');
const envPath = path.join(ROOT, '.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').trim().split(/\r?\n/).forEach(line => {
    const idx = line.indexOf('=');
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key && !(key in process.env)) process.env[key] = val;
  });
}

async function main() {
  const geoPath = path.join(ROOT, 'liderancas-geo.json');
  const registros = JSON.parse(fs.readFileSync(geoPath, 'utf8'));

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await pool.query('ALTER TABLE liderancas ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION');
  await pool.query('ALTER TABLE liderancas ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION');

  let atualizados = 0;
  for (const r of registros) {
    if (r.lat == null || r.lng == null) continue;
    const { rowCount } = await pool.query(
      'UPDATE liderancas SET lat = $1, lng = $2 WHERE id = $3 AND lat IS NULL',
      [r.lat, r.lng, r.id]
    );
    atualizados += rowCount;
  }
  await pool.end();
  console.log(`Backfill concluído: ${atualizados} lideranças atualizadas com lat/lng (de ${registros.length} no arquivo).`);
}

main().catch(e => { console.error(e); process.exit(1); });
