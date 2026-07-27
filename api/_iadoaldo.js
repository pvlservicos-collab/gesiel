// Conteúdo padrão + validação da "IA do Aldo".
// Usado por api/iadoaldo.js (GET público + PUT/DELETE do painel, protegidos por login).

const DEFAULT_CONFIG = {
  nome: 'Aldo Maurício',
  status: 'Pode perguntar 👇',
  foto: 'img/fotocandidato.webp',
  inicio: 'p1',
  passos: [
    {
      id: 'p1', titulo: 'Boas-vindas',
      msgs: [
        'Eae! Tudo beleza? 👋',
        'Aqui é o Aldo Maurício, pré-candidato a deputado estadual pelo Amapá.',
        'Pode perguntar sem cerimônia — escolhe aí embaixo o que você quer saber. Tamo junto! 🙏',
      ],
      opcoes: [
        { label: 'Quem é Aldo Maurício?', goto: 'p2' },
        { label: 'Quais são os seus projetos?', goto: 'p3' },
        { label: 'Fé e valores?', goto: 'p4' },
        { label: 'No que você vai ajudar a cidade?', goto: 'p5' },
      ],
    },
    {
      id: 'p2', titulo: 'Quem é Aldo Maurício',
      msgs: [
        'Boa! Deixa eu me apresentar direitinho 😄',
        'Sou enfermeiro há 26 anos e professor há 15. Também sou bacharel em Direito pela UNIFAP.',
        'Sou funcionário público, escritor, teólogo e participo de vários projetos sociais aqui na nossa terra.',
        'Minha vida inteira foi servindo pessoas — na saúde, na sala de aula e na comunidade. Agora quero servir o nosso estado inteiro.',
      ],
      opcoes: [
        { label: 'Quais são os seus projetos?', goto: 'p3' },
        { label: 'No que você vai ajudar a cidade?', goto: 'p5' },
        { label: '⟲ Voltar ao início', goto: 'p1' },
      ],
    },
    {
      id: 'p3', titulo: 'Quais são os seus projetos',
      msgs: [
        'Tenho vários projetos que já saíram do papel, viu? 💪',
        'Sou diretor da UBS Cláudio Leão e já fui voluntário da Cruz Vermelha — sempre na linha de frente da saúde.',
        'Como sindicalista, lutei junto com a categoria pelo piso da enfermagem.',
        'Na educação, idealizei o Aulão Solidário pra ajudar quem tá se preparando pra concursos — não à toa me chamam de amigo dos concurseiros 📚',
      ],
      opcoes: [
        { label: 'Quem é Aldo Maurício?', goto: 'p2' },
        { label: 'Fé e valores?', goto: 'p4' },
        { label: 'No que você vai ajudar a cidade?', goto: 'p5' },
        { label: '⟲ Voltar ao início', goto: 'p1' },
      ],
    },
    {
      id: 'p4', titulo: 'Fé e valores',
      msgs: [
        'Aqui é simples: fé, verdade, coragem e coerência 🙏',
        'Defendo a família, a vida e a liberdade religiosa. Valores não se negociam.',
        'Sou líder evangélico na comunidade e vice-líder da UJAMA, a nossa juventude gospel.',
        '"Posso tudo naquele que me fortalece" — Filipenses 4:13. É esse o combustível.',
      ],
      opcoes: [
        { label: 'Quais são os seus projetos?', goto: 'p3' },
        { label: 'No que você vai ajudar a cidade?', goto: 'p5' },
        { label: '⟲ Voltar ao início', goto: 'p1' },
      ],
    },
    {
      id: 'p5', titulo: 'No que você vai ajudar a cidade',
      msgs: [
        'Vou trabalhar em cima de bandeiras bem claras pela nossa cidade:',
        '🩺 Saúde — valorizar quem cuida da gente e melhorar o atendimento público.',
        '📚 Educação — a maior ferramenta de transformação que existe, e quero investir pesado nela.',
        '🛡️ Segurança e 💼 Trabalho — mais proteção pras famílias e mais oportunidade pra quem batalha todo dia.',
      ],
      opcoes: [
        { label: 'Quem é Aldo Maurício?', goto: 'p2' },
        { label: 'Quais são os seus projetos?', goto: 'p3' },
        { label: 'Fé e valores?', goto: 'p4' },
        { label: '⟲ Voltar ao início', goto: 'p1' },
      ],
    },
  ],
};

// ── validação/sanitização (roda em todo salvamento; nada entra "cru" no banco) ──

function str(v, max) { return String(v == null ? '' : v).slice(0, max).trim(); }

function fotoValida(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s) return DEFAULT_CONFIG.foto;
  // caminho relativo do próprio site (ex.: img/fotocandidato.webp)
  if (/^[a-zA-Z0-9_\-./]+$/.test(s) && !s.includes('..') && !s.startsWith('/')) return s.slice(0, 300);
  if (/^https?:\/\//i.test(s)) return s.slice(0, 500);
  // imagem enviada pelo painel (comprimida no navegador antes de salvar)
  if (/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(s) && s.length <= 2000000) return s;
  return DEFAULT_CONFIG.foto;
}

function sanitizeConfig(raw) {
  const cfg = raw && typeof raw === 'object' ? raw : {};
  const out = {
    nome: str(cfg.nome, 60) || DEFAULT_CONFIG.nome,
    status: str(cfg.status, 80),
    foto: fotoValida(cfg.foto),
    inicio: '',
    passos: [],
  };

  const brutos = Array.isArray(cfg.passos) ? cfg.passos.slice(0, 60) : [];
  const vistos = new Set();
  for (const p of brutos) {
    if (!p || typeof p !== 'object') continue;
    let id = str(p.id, 24).toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!id || vistos.has(id)) continue; // id duplicado: fica só o primeiro
    vistos.add(id);

    const msgs = (Array.isArray(p.msgs) ? p.msgs.slice(0, 12) : [])
      .map(m => str(m, 400)).filter(Boolean);
    if (!msgs.length) continue; // passo sem mensagem não existe

    const opcoes = (Array.isArray(p.opcoes) ? p.opcoes.slice(0, 8) : [])
      .map(o => ({ label: str(o && o.label, 60), goto: str(o && o.goto, 24).toLowerCase() }))
      .filter(o => o.label);

    out.passos.push({ id, titulo: str(p.titulo, 60) || 'Passo', msgs, opcoes });
  }

  if (!out.passos.length) return JSON.parse(JSON.stringify(DEFAULT_CONFIG));

  // destinos precisam apontar pra passos que existem ('' = volta pro início)
  const ids = new Set(out.passos.map(p => p.id));
  for (const p of out.passos) {
    for (const o of p.opcoes) if (o.goto && !ids.has(o.goto)) o.goto = '';
  }

  const inicio = str(cfg.inicio, 24).toLowerCase();
  out.inicio = ids.has(inicio) ? inicio : out.passos[0].id;
  return out;
}

module.exports = { DEFAULT_CONFIG, sanitizeConfig };
