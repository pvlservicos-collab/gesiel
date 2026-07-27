// Servidor local pra testar o site inteiro (painel incluso) sem depender do
// `vercel dev` (que exige login/link com a conta Vercel na nuvem).
// Lê .env.local direto e roda os arquivos de api/*.js como se fossem rotas.
//
// Uso: node scripts/dev-server.js
// Depois: http://localhost:3210/painel.html

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 3210;

// carrega .env.local (sem depender do pacote dotenv)
const envPath = path.join(ROOT, '.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').trim().split(/\r?\n/).forEach(line => {
    const idx = line.indexOf('=');
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key && !(key in process.env)) process.env[key] = val;
  });
} else {
  console.warn('Aviso: .env.local não encontrado — copie .env.example e preencha.');
}

// login automático local: gera um cookie de sessão válido de verdade (mesma
// assinatura HMAC do _auth.js) pra você já abrir o painel logado, sem digitar
// usuário/senha toda hora enquanto testa.
const { setSessionCookie, COOKIE_NAME } = require(path.join(ROOT, 'api', '_auth.js'));
let AUTO_COOKIE = null;
try {
  const fakeRes = { setHeader(name, val) { if (name.toLowerCase() === 'set-cookie') AUTO_COOKIE = val; } };
  setSessionCookie(fakeRes, process.env.ADMIN_USER || 'admin');
  AUTO_COOKIE = AUTO_COOKIE.split(';')[0]; // só "painel_sess=token"
  console.log('Login automático local ativado (usa ADMIN_USER do .env.local).');
} catch (e) {
  console.warn('Não deu pra gerar login automático (SESSION_SECRET ausente?):', e.message);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.csv': 'text/csv; charset=utf-8',
};

function send(res, status, body, headers) {
  res.writeHead(status, headers);
  res.end(body);
}

// espelha os "rewrites" do vercel.json (o servidor local não lê esse arquivo)
const API_REWRITES = { track: 'lead' };

function handleApi(req, res, apiPath, query) {
  apiPath = API_REWRITES[apiPath] || apiPath;
  // CORS liberado localmente — evita 405/erro de rede se o painel.html for
  // aberto direto como arquivo (file://) em vez de via http://localhost
  const origin = req.headers.origin || '*';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (req.method === 'OPTIONS') {
    return send(res, 204, '', corsHeaders);
  }

  const filePath = path.join(ROOT, 'api', apiPath + '.js');
  if (!fs.existsSync(filePath)) {
    return send(res, 404, JSON.stringify({ error: 'rota de api não encontrada' }), Object.assign({ 'Content-Type': 'application/json' }, corsHeaders));
  }
  delete require.cache[require.resolve(filePath)];
  const handler = require(filePath);

  let body = '';
  req.on('data', c => (body += c));
  req.on('end', async () => {
    let parsedBody = {};
    if (body) {
      try { parsedBody = JSON.parse(body); } catch {}
    }
    req.query = query;
    req.body = parsedBody;

    let statusCode = 200;
    const headers = Object.assign({}, corsHeaders);
    const fakeRes = {
      status(code) { statusCode = code; return fakeRes; },
      setHeader(name, val) {
        // sem HTTPS local, cookie "Secure" nunca seria salvo pelo navegador —
        // tira essa flag só no ambiente local pra login funcionar em http://
        if (name.toLowerCase() === 'set-cookie') {
          val = Array.isArray(val) ? val.map(v => v.replace(/;\s*Secure/i, '')) : val.replace(/;\s*Secure/i, '');
        }
        headers[name] = val;
        return fakeRes;
      },
      json(obj) {
        headers['Content-Type'] = 'application/json';
        send(res, statusCode, JSON.stringify(obj), headers);
      },
      send(str) {
        if (!headers['Content-Type']) headers['Content-Type'] = 'text/plain; charset=utf-8';
        send(res, statusCode, str, headers);
      },
      end(str) { send(res, statusCode, str || '', headers); },
    };
    try {
      await handler(req, fakeRes);
    } catch (e) {
      console.error('Erro em', apiPath, ':', e);
      send(res, 500, JSON.stringify({ error: e.message }), { 'Content-Type': 'application/json' });
    }
  });
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = decodeURIComponent(parsed.pathname);

  if (pathname.startsWith('/api/')) {
    if (AUTO_COOKIE && pathname.startsWith('/api/admin/') && !req.headers.cookie) {
      req.headers.cookie = AUTO_COOKIE;
    }
    return handleApi(req, res, pathname.slice(5).replace(/\/$/, ''), parsed.query);
  }

  let rel = pathname === '/' ? '/index.html' : pathname;
  let filePath = path.join(ROOT, rel);
  if (!filePath.startsWith(ROOT)) return send(res, 403, 'forbidden');
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    if (fs.existsSync(filePath + '.html')) filePath += '.html';
    else return send(res, 404, 'não encontrado: ' + pathname);
  }
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 500, 'erro ao ler arquivo');
    send(res, 200, data, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  });
});

server.listen(PORT, () => {
  console.log(`Servidor local rodando em http://localhost:${PORT}`);
  console.log(`Painel: http://localhost:${PORT}/painel.html`);
  console.log(`Login: usuário e senha do seu .env.local (ADMIN_USER / ADMIN_PASS)`);
});
