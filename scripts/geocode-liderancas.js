// Ferramenta de reparo: geocodifica (via Nominatim) só as lideranças que
// ainda estão sem lat/lng no banco (endereço não encontrado no cadastro,
// Nominatim fora do ar na hora, etc.) e grava direto na tabela.
// Cadastros novos já se geocodificam sozinhos em api/lideranca.js — esse
// script é só pra corrigir os que passaram batido.
// Uso: node scripts/geocode-liderancas.js
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { geocodeEnderecoBairro } = require('../api/_geocode');

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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const { rows: pendentes } = await pool.query(
    "SELECT id, nome, bairro, endereco FROM liderancas WHERE lat IS NULL AND endereco IS NOT NULL AND endereco <> '' ORDER BY id"
  );

  console.log(`Lideranças sem coordenada: ${pendentes.length}`);
  let corrigidos = 0;
  for (let i = 0; i < pendentes.length; i++) {
    const l = pendentes[i];
    process.stdout.write(`[${i + 1}/${pendentes.length}] ${l.nome.slice(0, 40)} (${l.bairro})... `);
    const geo = await geocodeEnderecoBairro(l.endereco, l.bairro);
    if (geo) {
      await pool.query('UPDATE liderancas SET lat = $1, lng = $2 WHERE id = $3', [geo.lat, geo.lng, l.id]);
      corrigidos++;
      console.log(`OK (${geo.lat}, ${geo.lng})`);
    } else {
      console.log('sem resultado confiável');
    }
    await sleep(1100); // respeita o limite de uso do Nominatim entre chamadas em lote
  }

  await pool.end();
  console.log(`\nConcluído: ${corrigidos} de ${pendentes.length} corrigidas.`);
}

main().catch(e => { console.error(e); process.exit(1); });
