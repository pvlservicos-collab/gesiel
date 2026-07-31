const { getPool, ensureSchema } = require('../_db');
const { isAuthenticated } = require('../_auth');

module.exports = async (req, res) => {
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'não autenticado' });
  try {
    await ensureSchema();

    if (req.method === 'GET') {
      const { rows } = await getPool().query(
        `SELECT id, titulo, to_char(data, 'YYYY-MM-DD') AS data, hora, duracao, local, obs
         FROM agenda ORDER BY data, hora`
      );
      return res.status(200).json({ itens: rows });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const titulo = String(body.titulo || '').trim().slice(0, 300);
      const data = String(body.data || '').trim();
      if (!titulo || !data) return res.status(400).json({ error: 'Preencha pelo menos o compromisso e a data.' });
      const hora = body.hora ? String(body.hora).trim().slice(0, 5) : null;
      const duracao = Number(body.duracao) || null;
      const local = body.local ? String(body.local).trim().slice(0, 400) : null;
      const obs = body.obs ? String(body.obs).trim().slice(0, 4000) : null;

      const { rows } = await getPool().query(
        `INSERT INTO agenda (titulo, data, hora, duracao, local, obs)
         VALUES ($1, $2::date, $3, $4, $5, $6) RETURNING id`,
        [titulo, data, hora, duracao, local, obs]
      );
      return res.status(200).json({ ok: true, id: rows[0].id });
    }

    if (req.method === 'DELETE') {
      const id = Number(req.query.id);
      if (!id) return res.status(400).json({ error: 'id inválido' });
      await getPool().query('DELETE FROM agenda WHERE id = $1', [id]);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método não permitido' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
