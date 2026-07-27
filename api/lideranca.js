const { getPool, ensureSchema, getClientIp } = require('./_db');
const { geocodeEnderecoBairro } = require('./_geocode');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    try {
      await ensureSchema();
      const { rows } = await getPool().query('SELECT id, nome, bairro FROM liderancas ORDER BY nome ASC');
      return res.status(200).json({ liderancas: rows });
    } catch (e) {
      return res.status(500).json({ error: e.message });
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
    const ip = getClientIp(req);
    // geocodifica na hora do cadastro pra já nascer com lat/lng no banco —
    // se falhar (endereço não encontrado, Nominatim fora do ar), segue sem
    // coordenada: a liderança fica cadastrada normalmente, só sem quadrado no mapa
    let lat = null, lng = null;
    try {
      const geo = await geocodeEnderecoBairro(endereco, bairro);
      if (geo) { lat = geo.lat; lng = geo.lng; }
    } catch {}
    const r = await getPool().query(
      'INSERT INTO liderancas (nome, numero, bairro, nome_mae, data_nascimento, endereco, ip, lat, lng) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
      [nome, numero, bairro, mae, nascimento, endereco, ip, lat, lng]
    );
    res.status(201).json({ ok: true, id: r.rows[0].id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
