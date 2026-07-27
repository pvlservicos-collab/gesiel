// GET: devolve a conversa da IA do Aldo (usado pela página pública /iadoaldo
// e pela aba do painel, que também lê a version pra controle de concorrência).
// PUT/DELETE exigem login (edição pelo painel).

const { getPool, ensureSchema } = require('./_db');
const { isAuthenticated } = require('./_auth');
const { DEFAULT_CONFIG, sanitizeConfig } = require('./_iadoaldo');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store'); // editou no painel = já vale na página
    try {
      await ensureSchema();
      const { rows } = await getPool().query('SELECT data, version FROM iadoaldo_config WHERE id = 1');
      const cfg = rows.length ? sanitizeConfig(rows[0].data) : DEFAULT_CONFIG;
      const version = rows.length ? rows[0].version : 0;
      return res.status(200).json({ config: cfg, version });
    } catch (e) {
      // banco fora do ar não pode derrubar a página: entrega o padrão
      return res.status(200).json({ config: DEFAULT_CONFIG, version: 0, aviso: 'usando conteúdo padrão (' + e.message + ')' });
    }
  }

  if (!isAuthenticated(req)) return res.status(401).json({ error: 'não autenticado' });
  try {
    await ensureSchema();
    const pool = getPool();

    if (req.method === 'PUT') {
      const body = req.body || {};
      const version = Number(body.version);
      if (!Number.isInteger(version) || version < 0) return res.status(400).json({ error: 'versão inválida' });
      const cfg = sanitizeConfig(body.config);
      const json = JSON.stringify(cfg);

      if (version === 0) {
        // primeiro salvamento (a tela estava mostrando o conteúdo padrão)
        const r = await pool.query(
          `INSERT INTO iadoaldo_config (id, data, version) VALUES (1, $1::jsonb, 1)
           ON CONFLICT (id) DO NOTHING RETURNING version`, [json]);
        if (!r.rows.length) return res.status(409).json({ error: 'A conversa foi salva em outra aba. Recarregue antes de salvar de novo.' });
        return res.status(200).json({ ok: true, config: cfg, version: 1 });
      }

      const r = await pool.query(
        `UPDATE iadoaldo_config SET data = $1::jsonb, version = version + 1, atualizado_em = now()
         WHERE id = 1 AND version = $2 RETURNING version`, [json, version]);
      if (!r.rows.length) return res.status(409).json({ error: 'A conversa mudou em outra aba desde que você abriu. Recarregue antes de salvar de novo.' });
      return res.status(200).json({ ok: true, config: cfg, version: r.rows[0].version });
    }

    if (req.method === 'DELETE') {
      await pool.query('DELETE FROM iadoaldo_config WHERE id = 1');
      return res.status(200).json({ ok: true, config: DEFAULT_CONFIG, version: 0 });
    }

    return res.status(405).json({ error: 'Método não permitido' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
