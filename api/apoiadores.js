const { getPool, ensureSchema, getClientIp } = require('./_db');

const isValidDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

module.exports = async (req, res) => {
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
    const indicadoPor = String(body.indicadoPor || '').trim().slice(0, 200);
    const indicadoPorId = Number(body.indicadoPorId) || null;
    if (!nome || !numero || !bairro || !mae || !nascimento || !endereco) {
      return res.status(400).json({ error: 'Nome, WhatsApp, bairro, nome da mãe, data de nascimento e endereço são obrigatórios.' });
    }
    if (!isValidDate(nascimento)) {
      return res.status(400).json({ error: 'Data de nascimento inválida.' });
    }
    const ip = getClientIp(req);
    await getPool().query(
      'INSERT INTO apoiadores (nome, numero, bairro, nome_mae, data_nascimento, endereco, ip, indicado_por, indicado_por_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [nome, numero, bairro, mae, nascimento, endereco, ip, indicadoPor || null, indicadoPorId]
    );
    res.status(201).json({ ok: true });
  } catch (e) {
    // mensagem de erro real só no log do servidor — o cadastro não pode
    // vazar detalhe técnico do banco pra quem está preenchendo o formulário
    console.error('POST /api/apoiadores:', e);
    res.status(500).json({ error: 'Não foi possível concluir o cadastro agora. Tente novamente em instantes.' });
  }
};
