const { setSessionCookie, clearSessionCookie } = require('../_auth');

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    const body = req.body || {};
    const user = String(body.user || '');
    const senha = String(body.senha || '');
    const okUser = process.env.ADMIN_USER || '';
    const okPass = process.env.ADMIN_PASS || '';
    if (!okUser || !okPass) return res.status(500).json({ error: 'Painel não configurado (ADMIN_USER/ADMIN_PASS ausentes).' });
    if (user !== okUser || senha !== okPass) return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    setSessionCookie(res, user);
    return res.status(200).json({ ok: true });
  }
  if (req.method === 'DELETE') {
    clearSessionCookie(res);
    return res.status(200).json({ ok: true });
  }
  res.status(405).json({ error: 'Método não permitido' });
};
