// Geocodifica endereço + bairro via Nominatim (OpenStreetMap), filtrando
// resultados fora do estado do Amapá. Usado tanto no cadastro público
// (api/lideranca.js) quanto no script de reparo (scripts/geocode-liderancas.js),
// pra ter uma única lógica de geocodificação em vez de duas cópias divergentes.

// caixa generosa cobrindo todo o Amapá (de Oiapoque, no extremo norte, até
// Laranjal do Jari/Vitória do Jari, no extremo sul) — só pra rejeitar
// resultado grosseiramente errado do Nominatim, não precisa ser precisa
const BOUNDS = { latMin: -1.3, latMax: 4.5, lngMin: -54.9, lngMax: -49.8 };
function dentroDosLimites(lat, lng) {
  return lat >= BOUNDS.latMin && lat <= BOUNDS.latMax && lng >= BOUNDS.lngMin && lng <= BOUNDS.lngMax;
}

function limpa(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

// bairros de municípios vizinhos vêm prefixados como "Santana-Central" (ver
// BAIRROS_MACAPA em liderancas.html/apoiadores.html) — sem isso a busca no
// Nominatim ia grudar "Macapá" num bairro que é de outro município e nunca
// achar nada. Nenhum bairro de Macapá tem hífen no nome, então qualquer
// "Município-Bairro" aqui é sempre de um dos outros municípios do Amapá.
function extrairMunicipioBairro(bairroBruto) {
  const bai = limpa(bairroBruto);
  const m = bai.match(/^([^-]+)-(.+)$/);
  if (m) return { municipio: m[1].trim(), bairro: m[2].trim() };
  return { municipio: 'Macapá', bairro: bai };
}

async function consultaNominatim(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=3&countrycodes=br&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'GesielOliveiraMapaLiderancas/1.0 (uso interno)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const bons = data.filter(r => dentroDosLimites(Number(r.lat), Number(r.lon)));
  return bons[0] || null;
}

async function geocodeEnderecoBairro(endereco, bairroBruto) {
  const end = limpa(endereco);
  if (!end || !limpa(bairroBruto)) return null;
  const { municipio, bairro: bai } = extrairMunicipioBairro(bairroBruto);
  const tentativas = [
    `${end}, ${bai}, ${municipio}, Amapá, Brasil`,
    `${end}, ${municipio}, Amapá, Brasil`,
    `${bai}, ${municipio}, Amapá, Brasil`,
  ];
  for (const query of tentativas) {
    try {
      const r = await consultaNominatim(query);
      if (r) return { lat: Number(r.lat), lng: Number(r.lon) };
    } catch {
      // tenta a próxima estratégia
    }
  }
  return null;
}

module.exports = { geocodeEnderecoBairro };
