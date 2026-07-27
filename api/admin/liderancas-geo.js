const { getPool } = require('../_db');
const { isAuthenticated } = require('../_auth');

// Fonte única de verdade pro mapa: consulta o banco ao vivo (não um json
// gerado uma vez) — quem for excluído/cadastrado aqui aparece/some no mapa
// imediatamente, sem precisar rodar script nenhum.
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'não autenticado' });
  try {
    const { rows } = await getPool().query(
      'SELECT id, nome, numero, bairro, endereco, lat, lng FROM liderancas ORDER BY id'
    );
    res.status(200).json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
