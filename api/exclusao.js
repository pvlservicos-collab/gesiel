const { getPool } = require('./_db');

// endpoint público (LGPD) — qualquer pessoa pode localizar e apagar os
// próprios dados pelo número de WhatsApp, sem precisar estar logada.
// Busca nas 3 tabelas onde um número pode aparecer: formulário de contato
// (leads.whatsapp), liderança (liderancas.numero) e apoiador (apoiadores.numero).

function normalizarFone(s) {
  return String(s || '').replace(/\D/g, '');
}

function variantes(fone) {
  const v = new Set([fone]);
  if (fone.startsWith('55') && fone.length > 11) v.add(fone.slice(2));
  else if (!fone.startsWith('55')) v.add('55' + fone);
  return [...v];
}

module.exports = async (req, res) => {
  const fone = normalizarFone(req.query.fone);
  if (!fone || fone.length < 10) return res.status(400).json({ error: 'Número inválido' });
  const lista = variantes(fone);

  try {
    if (req.method === 'GET') {
      const [leads, lids, apo] = await Promise.all([
        getPool().query(`SELECT id, nome FROM leads WHERE regexp_replace(whatsapp, '\\D', '', 'g') = ANY($1)`, [lista]),
        getPool().query(`SELECT id, nome FROM liderancas WHERE regexp_replace(numero, '\\D', '', 'g') = ANY($1)`, [lista]),
        getPool().query(`SELECT id, nome FROM apoiadores WHERE regexp_replace(numero, '\\D', '', 'g') = ANY($1)`, [lista]),
      ]);
      const total = leads.rows.length + lids.rows.length + apo.rows.length;
      if (!total) return res.status(200).json({ found: false });
      const nome = (lids.rows[0] || apo.rows[0] || leads.rows[0] || {}).nome;
      return res.status(200).json({
        found: true,
        nome,
        formulario: leads.rows.length,
        lideranca: lids.rows.length,
        apoiador: apo.rows.length,
      });
    }

    if (req.method === 'DELETE') {
      const [leads, lids, apo] = await Promise.all([
        getPool().query(`DELETE FROM leads WHERE regexp_replace(whatsapp, '\\D', '', 'g') = ANY($1)`, [lista]),
        getPool().query(`DELETE FROM liderancas WHERE regexp_replace(numero, '\\D', '', 'g') = ANY($1)`, [lista]),
        getPool().query(`DELETE FROM apoiadores WHERE regexp_replace(numero, '\\D', '', 'g') = ANY($1)`, [lista]),
      ]);
      return res.status(200).json({
        ok: true,
        deletados: { formulario: leads.rowCount, lideranca: lids.rowCount, apoiador: apo.rowCount },
      });
    }

    res.status(405).json({ error: 'Método não permitido' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
