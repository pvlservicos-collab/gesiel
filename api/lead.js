const { getPool, ensureSchema, getClientIp } = require('./_db');

// Formulário de contato (POST {nome, mensagem, ...}) e rastreamento de visitas
// (POST {path, ...}) dividem essa função pra caber no limite de funções
// serverless do plano Hobby — /api/track é reescrito pra cá via vercel.json.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  try {
    await ensureSchema();
    const body = req.body || {};
    const ip = getClientIp(req);

    if (body.path !== undefined) {
      const path = String(body.path || '/').slice(0, 300);
      const referrer = body.referrer ? String(body.referrer).slice(0, 300) : null;
      await getPool().query('INSERT INTO page_views (path, referrer, ip) VALUES ($1,$2,$3)', [path, referrer, ip]);
      return res.status(204).end();
    }

    const nome = String(body.nome || '').trim().slice(0, 200);
    const whatsapp = String(body.whatsapp || '').trim().slice(0, 40);
    const cidade = String(body.cidade || '').trim().slice(0, 200);
    const mensagem = String(body.mensagem || '').trim().slice(0, 4000);
    if (!nome || !mensagem) return res.status(400).json({ error: 'Nome e mensagem são obrigatórios.' });
    await getPool().query(
      'INSERT INTO leads (nome, whatsapp, cidade, mensagem, ip) VALUES ($1,$2,$3,$4,$5)',
      [nome, whatsapp || null, cidade || null, mensagem, ip]
    );
    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
