const { setSessionCookie, clearSessionCookie } = require('../_auth');

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    const body = req.body || {};
    const user = String(body.user || '').trim().toLowerCase();
    const senha = String(body.senha || '');
    // ADMIN_USER aceita uma lista separada por vírgula (ex.: dois e-mails), todos com a mesma ADMIN_PASS
    const okUsers = String(process.env.ADMIN_USER || '').split(',').map(u => u.trim().toLowerCase()).filter(Boolean);
    const okPass = process.env.ADMIN_PASS || '';
    if (!okUsers.length || !okPass) return res.status(500).json({ error: 'Painel não configurado (ADMIN_USER/ADMIN_PASS ausentes).' });
    if (!okUsers.includes(user) || senha !== okPass) {
      // atraso pequeno em toda tentativa errada — não impede um ataque
      // dedicado, mas encarece na prática tentar adivinhar a senha por
      // tentativa e erro
      await new Promise(r => setTimeout(r, 400));
      return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    }
    setSessionCookie(res, user);
    return res.status(200).json({ ok: true });
  }
  if (req.method === 'DELETE') {
    clearSessionCookie(res);
    return res.status(200).json({ ok: true });
  }
  res.status(405).json({ error: 'Método não permitido' });
};
