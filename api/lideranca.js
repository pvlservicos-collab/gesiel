const { waitUntil } = require('@vercel/functions');
const { getPool, ensureSchema, getClientIp } = require('./_db');
const { geocodeEnderecoBairro } = require('./_geocode');

const isValidDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// roda DEPOIS que a resposta já foi enviada pro cliente — quem cadastrou não
// espera a busca de endereço, mas o mapa precisa da localização certa, então
// tenta geocodificar com uma segunda tentativa (redundância) antes de desistir
async function geocodificarEGravar(id, endereco, bairro) {
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      const geo = await geocodeEnderecoBairro(endereco, bairro);
      if (geo) {
        await getPool().query('UPDATE liderancas SET lat = $1, lng = $2 WHERE id = $3', [geo.lat, geo.lng, id]);
        return;
      }
    } catch (e) {
      console.error(`geocodificação em segundo plano (liderança ${id}, tentativa ${tentativa}):`, e);
    }
    if (tentativa === 1) await espera(2500); // dá um tempo antes de tentar de novo
  }
  // sem sucesso nas 2 tentativas: fica sem lat/lng — scripts/geocode-liderancas.js
  // cobre esses casos depois, como rede de segurança adicional
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    try {
      await ensureSchema();
      const { rows } = await getPool().query('SELECT id, nome, bairro FROM liderancas ORDER BY nome ASC');
      return res.status(200).json({ liderancas: rows });
    } catch (e) {
      console.error('GET /api/lideranca:', e);
      return res.status(500).json({ error: 'Não foi possível carregar as lideranças agora.' });
    }
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  try {
    await ensureSchema();
    const body = req.body || {};
    const nome = String(body.nome || '').trim().slice(0, 200);
    const numero = String(body.numero || '').trim().slice(0, 40);
    const bairro = String(body.bairro || '').trim().slice(0, 200);
    const mae = String(body.mae || '').trim().slice(0, 200);
    const nascimento = String(body.nascimento || '').trim().slice(0, 10);
    const endereco = String(body.endereco || '').trim().slice(0, 300);
    if (!nome || !numero || !bairro || !mae || !nascimento || !endereco) {
      return res.status(400).json({ error: 'Nome, WhatsApp, bairro, nome da mãe, data de nascimento e endereço são obrigatórios.' });
    }
    if (!isValidDate(nascimento)) {
      return res.status(400).json({ error: 'Data de nascimento inválida.' });
    }
    const ip = getClientIp(req);
    // cadastra sem esperar a busca de endereço — quem preencheu o formulário
    // não fica parado nisso. A localização exata (pro quadrado no mapa) é
    // buscada logo em seguida, em segundo plano, com repetição caso a
    // primeira tentativa falhe (ver geocodificarEGravar acima)
    const r = await getPool().query(
      'INSERT INTO liderancas (nome, numero, bairro, nome_mae, data_nascimento, endereco, ip, lat, lng) VALUES ($1,$2,$3,$4,$5,$6,$7,NULL,NULL) RETURNING id',
      [nome, numero, bairro, mae, nascimento, endereco, ip]
    );
    const id = r.rows[0].id;
    res.status(201).json({ ok: true, id });
    waitUntil(geocodificarEGravar(id, endereco, bairro));
  } catch (e) {
    console.error('POST /api/lideranca:', e);
    res.status(500).json({ error: 'Não foi possível concluir o cadastro agora. Tente novamente em instantes.' });
  }
};
