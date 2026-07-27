const { getPool, getClientIp, ensureSchema } = require('../_db');
const { isAuthenticated } = require('../_auth');

const DAYS_BY_PERIOD = { hoje: 1, '7d': 7, '30d': 30 };
const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

async function ignoredIps(req, res) {
  const mine = getClientIp(req);

  if (req.method === 'GET') {
    const { rows } = await getPool().query('SELECT ip FROM ignored_ips ORDER BY criado_em');
    return res.status(200).json({ mine, ignored: rows.map(r => r.ip) });
  }

  if (req.method === 'POST') {
    await getPool().query('INSERT INTO ignored_ips (ip) VALUES ($1) ON CONFLICT (ip) DO NOTHING', [mine]);
    return res.status(201).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const ip = String(req.query.ip || '');
    if (!ip) return res.status(400).json({ error: 'ip inválido' });
    await getPool().query('DELETE FROM ignored_ips WHERE ip = $1', [ip]);
    return res.status(200).json({ ok: true });
  }

  res.status(405).json({ error: 'Método não permitido' });
}

async function metrics(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });
  let from = String(req.query.from || '').trim();
  let to = String(req.query.to || '').trim();

  let params, sqlDias, sqlDesde, sqlAte;
  if (isIsoDate(from) && isIsoDate(to)) {
    // intervalo customizado (dia exato ou de X até Y)
    if (from > to) { const t = from; from = to; to = t; }
    // trava de segurança: máximo 366 dias
    const dias = (new Date(to) - new Date(from)) / 86400000 + 1;
    if (dias > 366) return res.status(400).json({ error: 'intervalo máximo de 366 dias' });
    params = [from, to];
    sqlDias = `SELECT generate_series($1::date, $2::date, interval '1 day')::date AS dia`;
    sqlDesde = `criado_em >= $1::date`;
    sqlAte = `criado_em < ($2::date + interval '1 day')`;
  } else {
    // períodos padrão (hoje / 7d / 30d)
    const period = String(req.query.period || '7d');
    const days = DAYS_BY_PERIOD[period] || 7;
    params = [days];
    sqlDias = `SELECT generate_series(
      (CURRENT_DATE - ($1::int - 1) * interval '1 day')::date,
      CURRENT_DATE, interval '1 day'
    )::date AS dia`;
    sqlDesde = `criado_em >= CURRENT_DATE - ($1::int - 1) * interval '1 day'`;
    sqlAte = `criado_em < CURRENT_DATE + interval '1 day'`;
  }

  const { rows } = await getPool().query(
    `WITH dias AS (${sqlDias}),
     visitas AS (
       SELECT date_trunc('day', criado_em)::date AS dia, count(*) AS n
       FROM page_views
       WHERE ${sqlDesde} AND ${sqlAte}
         AND ip NOT IN (SELECT ip FROM ignored_ips)
       GROUP BY 1
     ),
     leads_dia AS (
       SELECT date_trunc('day', criado_em)::date AS dia, count(*) AS n
       FROM leads
       WHERE ${sqlDesde} AND ${sqlAte}
         AND (ip IS NULL OR ip NOT IN (SELECT ip FROM ignored_ips))
       GROUP BY 1
     ),
     liderancas_dia AS (
       SELECT date_trunc('day', criado_em)::date AS dia, count(*) AS n
       FROM liderancas
       WHERE ${sqlDesde} AND ${sqlAte}
       GROUP BY 1
     ),
     apoiadores_dia AS (
       SELECT date_trunc('day', criado_em)::date AS dia, count(*) AS n
       FROM apoiadores
       WHERE ${sqlDesde} AND ${sqlAte}
       GROUP BY 1
     )
     SELECT dias.dia, COALESCE(visitas.n,0) AS site_view, COALESCE(leads_dia.n,0) AS leads,
            COALESCE(liderancas_dia.n,0) AS liderancas, COALESCE(apoiadores_dia.n,0) AS apoiadores
     FROM dias
     LEFT JOIN visitas ON visitas.dia = dias.dia
     LEFT JOIN leads_dia ON leads_dia.dia = dias.dia
     LEFT JOIN liderancas_dia ON liderancas_dia.dia = dias.dia
     LEFT JOIN apoiadores_dia ON apoiadores_dia.dia = dias.dia
     ORDER BY dias.dia`,
    params
  );

  const serie = rows.map(r => ({
    data: r.dia.toISOString().slice(0, 10),
    site_view: Number(r.site_view),
    leads: Number(r.leads),
    liderancas: Number(r.liderancas),
    apoiadores: Number(r.apoiadores),
  }));
  const site_view = serie.reduce((s, r) => s + r.site_view, 0);
  const leads = serie.reduce((s, r) => s + r.leads, 0);
  const liderancas = serie.reduce((s, r) => s + r.liderancas, 0);
  const apoiadores = serie.reduce((s, r) => s + r.apoiadores, 0);

  res.status(200).json({ site_view, leads, liderancas, apoiadores, serie });
}

module.exports = async (req, res) => {
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'não autenticado' });
  try {
    await ensureSchema();
    if (req.query.resource === 'ignored-ips') return ignoredIps(req, res);
    return metrics(req, res);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
