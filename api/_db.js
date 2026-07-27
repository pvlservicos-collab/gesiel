const { Pool } = require('pg');

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

let pool;
function getPool() {
  if (!pool) {
    if (!connectionString) throw new Error('Banco não configurado (defina DATABASE_URL nas env vars da Vercel).');
    // banco local (teste) não tem SSL; em produção continua igual
    const local = /localhost|127\.0\.0\.1/.test(connectionString);
    pool = new Pool({ connectionString, ssl: local ? false : { rejectUnauthorized: false } });
  }
  return pool;
}

// trava de aplicação (não é do node, é do Postgres) pra garantir que só uma
// invocação por vez rode esse bloco de CREATE/ALTER — cada função da Vercel
// tem seu próprio processo e seu próprio "schemaReady", então sem isso duas
// invocações concorrentes rodando as mesmas alterações em várias tabelas
// dentro da mesma transação podiam se travar uma na outra (deadlock detected).
// Importante: é a variante "_xact_" (por transação), não "pg_advisory_lock"
// (por sessão) — o banco roda atrás de um pooler, e trava de sessão vaza
// entre conexões reaproveitadas (uma trava nunca liberada deixa toda
// consulta futura pendurada pra sempre). A de transação libera sozinha
// quando esse bloco (uma única transação implícita) termina.
async function ensureSchemaImpl() {
  return getPool().query(`
      SELECT pg_advisory_xact_lock(891122);

      CREATE TABLE IF NOT EXISTS page_views (
        id BIGSERIAL PRIMARY KEY,
        path TEXT NOT NULL,
        referrer TEXT,
        ip TEXT NOT NULL,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS page_views_criado_em_idx ON page_views (criado_em);

      CREATE TABLE IF NOT EXISTS leads (
        id BIGSERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        whatsapp TEXT,
        cidade TEXT,
        mensagem TEXT,
        ip TEXT,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS leads_criado_em_idx ON leads (criado_em);

      CREATE TABLE IF NOT EXISTS ignored_ips (
        ip TEXT PRIMARY KEY,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS liderancas (
        id BIGSERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        numero TEXT,
        bairro TEXT,
        nome_mae TEXT,
        data_nascimento DATE,
        endereco TEXT,
        ip TEXT,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS liderancas_criado_em_idx ON liderancas (criado_em);
      ALTER TABLE liderancas ADD COLUMN IF NOT EXISTS nome_mae TEXT;
      ALTER TABLE liderancas ADD COLUMN IF NOT EXISTS data_nascimento DATE;
      ALTER TABLE liderancas ADD COLUMN IF NOT EXISTS endereco TEXT;
      ALTER TABLE liderancas ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
      ALTER TABLE liderancas ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

      ALTER TABLE IF EXISTS eleitores RENAME TO apoiadores;
      ALTER INDEX IF EXISTS eleitores_criado_em_idx RENAME TO apoiadores_criado_em_idx;

      CREATE TABLE IF NOT EXISTS apoiadores (
        id BIGSERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        numero TEXT,
        bairro TEXT,
        nome_mae TEXT,
        data_nascimento DATE,
        endereco TEXT,
        ip TEXT,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS apoiadores_criado_em_idx ON apoiadores (criado_em);
      ALTER TABLE apoiadores ADD COLUMN IF NOT EXISTS indicado_por TEXT;
      ALTER TABLE apoiadores ADD COLUMN IF NOT EXISTS indicado_por_id BIGINT;

      CREATE TABLE IF NOT EXISTS iadoaldo_config (
        id INT PRIMARY KEY,
        data JSONB NOT NULL,
        version INT NOT NULL DEFAULT 1,
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
      );
  `);
}

let schemaReady;
function ensureSchema() {
  if (!schemaReady) schemaReady = ensureSchemaImpl();
  return schemaReady;
}

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.socket && req.socket.remoteAddress || 'desconhecido';
}

module.exports = { getPool, ensureSchema, getClientIp };
