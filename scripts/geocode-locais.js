// Script único: lê locais_votacao.csv (só MACAPÁ), geocodifica cada local
// via Nominatim (OpenStreetMap) e grava locais-geo.json com lat/lon.
//
// Estratégia (nessa ordem, pra maximizar acerto):
//   A) busca pelo NOME do local (ex: "Escola Municipal Hildemar Maia") como
//      ponto de interesse — muito mais confiável que o endereço em texto
//      livre, porque acerta o prédio em vez de só uma rua qualquer.
//   B) se A não achar nada com o nome completo, tenta uma versão simplificada
//      do nome (sem "MUNICIPAL DE ENSINO FUNDAMENTAL" etc.)
//   C) por fim, cai pro endereço do CSV (como antes).
// Cada resultado só é aceito se cair dentro dos limites plausíveis de Macapá.
//
// Uso: node scripts/geocode-locais.js
const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '..', 'locais_votacao.csv');
const OUT_PATH = path.join(__dirname, '..', 'locais-geo.json');
const FAIL_PATH = path.join(__dirname, '..', 'locais-geo-falhas.json');

const BOUNDS = { latMin: -0.2, latMax: 0.42, lngMin: -51.4, lngMax: -50.9 };
function dentroDosLimites(lat, lng) {
  return lat >= BOUNDS.latMin && lat <= BOUNDS.latMax && lng >= BOUNDS.lngMin && lng <= BOUNDS.lngMax;
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = false; }
      } else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function loadLocais() {
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const rows = lines.slice(1).map(parseCsvLine);
  return rows
    .filter(r => (r[1] || '').trim() === 'MACAPÁ')
    .map(r => ({
      zona: r[0],
      municipio: r[1],
      local: r[2],
      endereco: r[3],
      secoes: r[4],
      qtdSecoes: Number(r[5] || 0),
      aptos: Number(r[6] || 0),
    }));
}

function nomeSemCodigo(local) {
  return local.replace(/^\d+\s*-\s*/, '').trim();
}

function nomeSimplificado(nome) {
  return nome
    .replace(/\bE\.?\s*E\.?\s*E\.?\s*F\.?\b/gi, 'Escola')
    .replace(/\bE\.?\s*P\.?\s*G\.?\b/gi, 'Escola')
    .replace(/\bE\.?\s*M\.?\s*E\.?\s*F\.?\b/gi, 'Escola Municipal')
    .replace(/\bEMEF\b/gi, 'Escola Municipal')
    .replace(/\bEEEF\b/gi, 'Escola Estadual')
    .replace(/MUNICIPAL DE ENSINO FUNDAMENTAL/gi, 'Municipal')
    .replace(/MUNICIPAL DE ENSINO INFANTIL/gi, 'Municipal')
    .replace(/ESTADUAL DE ENSINO FUNDAMENTAL/gi, 'Estadual')
    .replace(/QUILOMBOLA ESTADUAL/gi, 'Estadual')
    .replace(/\s+/g, ' ')
    .trim();
}

function limpaEndereco(end) {
  return end
    .replace(/\bSN\b|\bS\/N\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=3&countrycodes=br&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'AldoMauricioMapaLocaisVotacao/1.0 (uso interno, script unico)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.length) return null;
  // prioriza um resultado que seja um "amenity" (escola, universidade etc.)
  // e que caia dentro dos limites de Macapá
  const bons = data.filter(r => dentroDosLimites(Number(r.lat), Number(r.lon)));
  if (!bons.length) return null;
  const poi = bons.find(r => r.class === 'amenity' || r.class === 'building');
  return poi || bons[0];
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function tentarGeocodar(loc) {
  const nomeCompleto = nomeSemCodigo(loc.local);
  const tentativas = [
    `${nomeCompleto}, Macapá, Amapá`,
    `${nomeSimplificado(nomeCompleto)}, Macapá, Amapá`,
    `${limpaEndereco(loc.endereco)}, Macapá, Amapá, Brasil`,
  ];
  for (const query of tentativas) {
    const r = await geocode(query);
    await sleep(1100);
    if (r) return { r, query };
  }
  return null;
}

async function main() {
  const locais = loadLocais();
  console.log(`Total de locais em Macapá: ${locais.length}`);

  const ok = [];
  const falhas = [];

  for (let i = 0; i < locais.length; i++) {
    const loc = locais[i];
    process.stdout.write(`[${i + 1}/${locais.length}] ${loc.local.slice(0, 50)}... `);
    try {
      const achou = await tentarGeocodar(loc);
      if (achou) {
        const { r, query } = achou;
        ok.push({
          nome: loc.local,
          endereco: loc.endereco,
          zona: loc.zona,
          secoes: loc.secoes,
          qtdSecoes: loc.qtdSecoes,
          aptos: loc.aptos,
          lat: Number(r.lat),
          lng: Number(r.lon),
        });
        console.log(`OK via "${query}" (${r.lat}, ${r.lon})`);
      } else {
        falhas.push(loc);
        console.log('SEM RESULTADO CONFIÁVEL');
      }
    } catch (e) {
      falhas.push({ ...loc, erro: e.message });
      console.log(`ERRO: ${e.message}`);
    }
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(ok, null, 2));
  fs.writeFileSync(FAIL_PATH, JSON.stringify(falhas, null, 2));
  console.log(`\nConcluído: ${ok.length} geocodificados, ${falhas.length} falharam.`);
  console.log(`Saída: ${OUT_PATH}`);
  if (falhas.length) console.log(`Falhas: ${FAIL_PATH}`);
}

main();
