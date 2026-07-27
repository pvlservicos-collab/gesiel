const { getPool, ensureSchema } = require('../_db');
const { isAuthenticated } = require('../_auth');

// mesma normalização usada no mapa.html — sem isso, "Novo Horizonte",
// "NOVO HORIZONTE" e "Novo horizonte" contavam como 3 bairros diferentes
function normBairro(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// cada liderança vale 30 votos "padrão" até que algum apoiador se cadastre
// citando ela como quem indicou — a partir daí, vale a contagem real de
// apoiadores trazidos por ela, não mais os 30 fixos.
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'não autenticado' });
  try {
    await ensureSchema();
    const [liderancasContagemRes, apoiadoresIndividuaisRes, bairrosRes] = await Promise.all([
      getPool().query(`
        SELECT l.id, (SELECT count(*)::int FROM apoiadores a WHERE a.indicado_por_id = l.id) AS n
        FROM liderancas l
      `),
      getPool().query('SELECT count(*)::int AS n FROM apoiadores WHERE indicado_por_id IS NULL'),
      getPool().query("SELECT bairro FROM liderancas WHERE bairro IS NOT NULL AND bairro <> ''"),
    ]);
    const liderancas = liderancasContagemRes.rows.length;
    const votosLiderancas = liderancasContagemRes.rows.reduce((soma, r) => soma + (r.n > 0 ? r.n : 30), 0);
    const apoiadoresIndividuais = apoiadoresIndividuaisRes.rows[0].n;
    const bairrosNormalizados = new Set(bairrosRes.rows.map(r => normBairro(r.bairro)).filter(Boolean));
    const bairros = bairrosNormalizados.size;
    const votosPrevistos = votosLiderancas + apoiadoresIndividuais;
    res.status(200).json({ liderancas, apoiadoresIndividuais, bairros, votosPrevistos });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
