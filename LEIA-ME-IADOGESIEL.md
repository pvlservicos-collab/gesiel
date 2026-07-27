# IA do Gesiel — atualização do projeto

Nova página de chat em **`/iadogesiel`** + nova aba **IA do Gesiel** no painel para editar tudo.

## Como instalar

Extraia este zip **por cima da pasta do projeto** (as pastas já batem com a estrutura do repositório) e faça commit + push. A Vercel publica sozinha e `/iadogesiel` entra no ar.

Arquivos **novos**:
- `iadogesiel.html` — a página pública do chat
- `api/iadogesiel.js` — entrega a conversa pra página (público)
- `api/admin/iadogesiel.js` — salvar/restaurar pelo painel (protegido por login)
- `api/_iadogesiel.js` — conteúdo padrão + validação de tudo que é salvo

Arquivos **substituídos** (se você mexeu neles por fora do git, confira antes de sobrescrever):
- `painel.html` — ganhou a aba IA do Gesiel (nada das outras abas foi alterado)
- `api/_db.js` — ganhou a tabela `iadogesiel_config` (criada sozinha no primeiro acesso) e passa a dispensar SSL só quando o banco é localhost (teste local)
- `scripts/dev-server.js` — pequeno conserto: o servidor local não sabia responder `res.end()` (o `/api/track` usava e dava erro 500 só no local)

Nenhuma variável de ambiente nova é necessária.

## O que dá pra fazer na aba IA do Gesiel

- **Foto da bolinha**: envie um arquivo (é comprimido no navegador e salvo no banco) ou cole um link/caminho (`img/fotocandidato.webp`).
- **Nome e frase de status** que aparecem embaixo da foto.
- **Passos**: cada passo é uma resposta do Gesiel em vários balõezinhos + os botões que a pessoa pode clicar. Cada botão aponta pra outro passo (inclusive um anterior — dá pra montar a rede que quiser) ou "Voltar ao início". Dá pra reordenar balõezinhos e passos, marcar qual passo é o início e excluir (o painel avisa se algum botão apontava pro passo excluído).
- **Salvar e publicar**: a página `/iadogesiel` atualiza na hora. Se a mesma aba estiver aberta em dois lugares, o segundo salvamento é bloqueado com aviso em vez de sobrescrever calado.
- **Restaurar padrão**: volta pro conteúdo original (o que está descrito abaixo).

## A página /iadogesiel

- Mesmo azul escuro do painel, foto redonda fixa no topo; o chat rola por baixo dela e as mensagens somem num degradê ao subir (dá pra rolar de volta e ler).
- Enquanto o Gesiel "responde", saem **ondas circulares cinzas** ao redor da foto, com o indicador de digitando entre um balãozinho e outro.
- Sem campo de digitar: só os botõezinhos (fonte Montserrat fina, menores), fixos embaixo como se fossem o campo de mensagem.
- As visitas entram nas **métricas do painel** como o caminho `/iadogesiel` (usa o mesmo `/api/track` do site).
- Se a API falhar por qualquer motivo, a página mostra o conteúdo padrão — nunca fica muda.

## Conteúdo que já vem pronto

Uma rede de 5 passos no tom de conversa do Gesiel: boas-vindas → quem é o Gesiel (texto genérico, "em breve" — ainda não tem a biografia real dele) → projetos (idem, placeholder) → fé e valores (família, vida, liberdade religiosa, Filipenses 4:13) → bandeiras (saúde, educação, segurança, trabalho). Os textos de biografia/projetos são propositalmente genéricos — edite pela aba assim que tiver a trajetória real do Gesiel. Tudo editável na aba.

## Depois, a LLM

A estrutura já deixa o caminho pronto: a página busca a conversa em `/api/iadogesiel`, então quando quiser plugar uma LLM (Llama etc.) é só criar um endpoint novo que receba a pergunta e responda no mesmo formato de balõezinhos — os botões continuam funcionando como atalhos.

## Teste local (opcional)

```bash
npm install
node scripts/dev-server.js
# http://localhost:3210/iadogesiel  e  http://localhost:3210/painel.html
```
