const { getPool, ensureSchema } = require('../_db');
const { isAuthenticated } = require('../_auth');

const PAGE_SIZE = 20;

function buildFiltro(query) {
  const where = [];
  const params = [];
  const q = String(query.q || '').trim();
  if (q) {
    params.push('%' + q + '%');
    where.push(`(nome ILIKE $${params.length} OR numero ILIKE $${params.length} OR bairro ILIKE $${params.length} OR nome_mae ILIKE $${params.length} OR endereco ILIKE $${params.length})`);
  }
  const from = String(query.from || '').trim();
  if (from) {
    params.push(from);
    where.push(`criado_em >= $${params.length}::date`);
  }
  const to = String(query.to || '').trim();
  if (to) {
    params.push(to);
    where.push(`criado_em < ($${params.length}::date + interval '1 day')`);
  }
  return { whereSql: where.length ? 'WHERE ' + where.join(' AND ') : '', params };
}

function csvField(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return '"' + s.replace(/"/g, '""') + '"';
}

async function exportarCsv(req, res, whereSql, params) {
  const { rows } = await getPool().query(
    `SELECT nome, numero, bairro, nome_mae, data_nascimento, endereco, criado_em FROM liderancas ${whereSql} ORDER BY criado_em DESC`,
    params
  );

  const header = ['Nome', 'WhatsApp', 'Bairro', 'Nome da mãe', 'Data de nascimento', 'Endereço', 'Data'].map(csvField).join(';');
  const linhas = rows.map(l => [
    l.nome, l.numero, l.bairro, l.nome_mae,
    l.data_nascimento ? new Date(l.data_nascimento).toLocaleDateString('pt-BR') : '',
    l.endereco,
    new Date(l.criado_em).toLocaleString('pt-BR'),
  ].map(csvField).join(';'));

  const csv = '﻿' + [header, ...linhas].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="liderancas.csv"');
  res.status(200).send(csv);
}

module.exports = async (req, res) => {
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'não autenticado' });
  try {
    await ensureSchema();
    if (req.method === 'DELETE') {
      const id = Number(req.query.id);
      if (!id) return res.status(400).json({ error: 'id inválido' });
      await getPool().query('DELETE FROM liderancas WHERE id = $1', [id]);
      return res.status(200).json({ ok: true });
    }

    if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

    const { whereSql, params } = buildFiltro(req.query);

    if (req.query.export === 'csv') {
      return exportarCsv(req, res, whereSql, params);
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const offset = (page - 1) * PAGE_SIZE;

    const totalRes = await getPool().query(`SELECT count(*)::int AS n FROM liderancas ${whereSql}`, params);
    const total = totalRes.rows[0].n;

    const bairrosRes = await getPool().query(
      `SELECT count(DISTINCT bairro)::int AS n FROM liderancas ${whereSql} ${whereSql ? 'AND' : 'WHERE'} bairro IS NOT NULL AND bairro <> ''`,
      params
    );
    const bairros = bairrosRes.rows[0].n;

    const itensRes = await getPool().query(
      `SELECT id, nome, numero, bairro, nome_mae, data_nascimento, endereco, criado_em,
              (SELECT count(*)::int FROM apoiadores a WHERE a.indicado_por_id = liderancas.id) AS apoiadores_count
       FROM liderancas ${whereSql}
       ORDER BY criado_em DESC
       LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
      params
    );

    res.status(200).json({ total, bairros, itens: itensRes.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
