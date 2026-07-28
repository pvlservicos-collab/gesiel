// Conteúdo padrão + validação da "IA do Gesiel".
// Usado por api/iadogesiel.js (GET público + PUT/DELETE do painel, protegidos por login).

const DEFAULT_CONFIG = {
  nome: 'Gesiel Oliveira',
  status: 'Pode perguntar 👇',
  foto: 'img/fotocandidato.webp',
  inicio: 'p1',
  passos: [
    {
      id: 'p1', titulo: 'Boas-vindas',
      msgs: [
        'Eae! Tudo beleza? 👋',
        'Aqui é o Gesiel Oliveira, candidato a Deputado Federal pelo PL no Amapá.',
        '"O Amapá que sonhamos começa agora." Escolhe aí embaixo o que você quer saber. Tamo junto! 🙏',
      ],
      opcoes: [
        { label: 'Quem é Gesiel Oliveira?', goto: 'p2' },
        { label: 'Quais são os seus projetos?', goto: 'p3' },
        { label: 'Fé e valores?', goto: 'p4' },
        { label: 'No que você vai ajudar o Estado?', goto: 'p5' },
      ],
    },
    {
      id: 'p2', titulo: 'Quem é Gesiel Oliveira',
      msgs: [
        'Boa! Deixa eu te contar:',
        'Nasci em Macapá em 1978 e morei um tempo em Serra do Navio. Hoje, aos 47 anos, sou Geógrafo, Bacharel em Direito e Teólogo.',
        'Sou casado com a Pastora Berenice Rabelo há 26 anos, pai de Gabriel, Miguel e Larissa. Também sou Oficial de Justiça do Tribunal de Justiça do Amapá e professor de Direito e Geopolítica.',
        'Há quase 20 anos sirvo como pastor missionário nas comunidades ribeirinhas e indígenas da Amazônia — foi ali que minha missão de servir o Amapá começou de verdade.',
      ],
      opcoes: [
        { label: 'Quais são os seus projetos?', goto: 'p3' },
        { label: 'No que você vai ajudar o Estado?', goto: 'p5' },
        { label: '⟲ Voltar ao início', goto: 'p1' },
      ],
    },
    {
      id: 'p3', titulo: 'Quais são os seus projetos',
      msgs: [
        'Tenho um plano de mandato com 13 eixos e 60 propostas pro Amapá entre 2027 e 2030! Alguns destaques:',
        '⚡ ENERGIA MAIS BARATA\nTarifa justa e combate às tarifas abusivas e ações para reduzir a tarifa energética.',
        '🔍 FISCALIZAÇÃO RIGOROSA DOS ROYALTIES\nTransparência total e investimentos onde o Amapá mais precisa.',
        '🌱 APOIO AO AGRONEGÓCIO E AGRICULTURA FAMILIAR\nCrédito, tecnologia e valorização do produtor.',
        '📈 INCENTIVO AO EMPREENDEDORISMO\nMais crédito, menos burocracia e geração de empregos.',
        '🎓 EDUCAÇÃO DE QUALIDADE, SEM DOUTRINAÇÃO\nMais escolas, institutos e valorização dos professores.',
        '❤️‍🩹 MAIS ACESSO À SAÚDE\nHospitais regionais, atendimento digno e medicamentos para todos.',
        '🛡️ COMBATE FIRME À CRIMINALIDADE\nMais policiais, tecnologia e leis mais duras.',
        '📶 INTERNET E INFRAESTRUTURA PARA TODOS\nConectividade, estradas e desenvolvimento para cada município.',
        '🛣️ OBRAS ESTRUTURANTES\nBR-156, logística, portos e mobilidade para o progresso do Amapá.',
        '♻️ DESENVOLVIMENTO COM RESPONSABILIDADE AMBIENTAL\nUso racional dos recursos naturais em favor do povo do Amapá.',
        '👨‍👩‍👧‍👦 DEFESA DA FAMÍLIA E DOS VALORES CRISTÃOS\nContra as pautas que ameaçam nossos filhos e nossa sociedade.',
        '📢 LIBERDADE DE EXPRESSÃO E DIREITOS INDIVIDUAIS\nContra abusos e censura. A liberdade é inegociável.',
      ],
      opcoes: [
        { label: 'Quem é Gesiel Oliveira?', goto: 'p2' },
        { label: 'Fé e valores?', goto: 'p4' },
        { label: 'No que você vai ajudar o Estado?', goto: 'p5' },
        { label: '⟲ Voltar ao início', goto: 'p1' },
      ],
    },
    {
      id: 'p4', titulo: 'Fé e valores',
      msgs: [
        'Aqui é simples: fé, verdade, coragem e coerência 🙏',
        'Minhas bandeiras são Vida, Família, Liberdades e Princípios Cristãos — as mesmas que sustentam a APEBE e toda a minha trajetória.',
        'Sou pastor evangélico há quase 20 anos e membro vitalício (cadeira nº 19) da Academia de Letras Evangélica do Amapá.',
        '"Posso tudo naquele que me fortalece" — Filipenses 4:13. É esse o meu combustível.',
      ],
      opcoes: [
        { label: 'Quais são os seus projetos?', goto: 'p3' },
        { label: 'No que você vai ajudar o Estado?', goto: 'p5' },
        { label: '⟲ Voltar ao início', goto: 'p1' },
      ],
    },
    {
      id: 'p5', titulo: 'No que você vai ajudar o Estado',
      msgs: [
        'Vou trabalhar em cima de bandeiras bem claras pelo nosso Amapá:',
        '🩺 Saúde — valorizar quem cuida da gente e melhorar o atendimento público.',
        '📚 Educação — a maior ferramenta de transformação que existe, e quero investir pesado nela.',
        '🛡️ Segurança e 💼 Trabalho — mais proteção pras famílias e mais oportunidade pra quem batalha todo dia.',
      ],
      opcoes: [
        { label: 'Quem é Gesiel Oliveira?', goto: 'p2' },
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

    const msgs = (Array.isArray(p.msgs) ? p.msgs.slice(0, 20) : [])
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
