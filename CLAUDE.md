# FN Edificações — Front-end do sistema

O sistema em si, em **sistema.fnedificacoes.com.br**: laudos de vistoria, documentação
(ART/TRT), agendamento, área do cliente, painel do parceiro e gerência. Fala com a API por
`fetch`; não tem banco nem sessão de servidor.

## Onde este repositório fica no todo

São três repositórios, todos em `github.com/fn-edificacoes`:

| Repositório | O que é | Endereço |
|---|---|---|
| `fn-edificacoes-site` | site institucional | fnedificacoes.com.br |
| `fn-edificacoes-frontend` | **este aqui** — o sistema | sistema.fnedificacoes.com.br |
| `fn-edificacoes-backend` | a API deste front | Render + Postgres no Supabase |

Mexer no fluxo de login, de cadastro ou de permissão quase sempre encosta no backend
também — vale anexar os dois na mesma sessão. Cada repositório tem o seu `CLAUDE.md`.

## Como rodar

```bash
npm install
npm run dev      # http://localhost:5173, já apontando para a API de produção
npm run build    # verificação mínima antes de qualquer commit
npm run preview  # serve o dist/, útil para conferir no navegador
```

`API_URL`, no topo do `src/App.jsx`, cai em `https://sistema.fnedificacoes.com.br` quando
`VITE_API_URL` não é definida. Rodar local usando a API de produção mexe em dados reais —
para tarefas que gravam, suba o backend local e ponha `VITE_API_URL` num `.env.local`
(que é ignorado pelo git).

## Publicação

**Desde 28/08/2026 o site é gerado e servido no servidor próprio da FN**, junto com a API.
Quem publica é o `deploy/atualizar.sh` do repositório do backend, rodado por SSH — ele faz
`git pull` aqui, `npm run build` e copia o `dist/` para o nginx.

Push na `main` **não publica nada sozinho**. O workflow do GitHub Pages continua no
repositório, mas só dispara pelo botão, como rota de emergência (ver o cabeçalho dele).

O app fala com a API pelo **mesmo domínio**, em `/api` — o `VITE_API_URL` é passado no
build como `https://sistema.fnedificacoes.com.br`. Não há CORS no caminho, e o endereço da
API deixou de estar escrito dentro do código.

⚠️ O `README.md` ainda descreve um deploy pelo Netlify. Está **desatualizado** duas vezes:
não é Netlify e não é mais GitHub Pages.

## Se a API cair ("o sistema travou")

O front e a API são hospedados em lugares diferentes e caem separado. Antes de procurar
defeito no código, descubra **qual dos dois** parou:

```bash
curl -s -o /dev/null -w "front %{http_code}
" https://sistema.fnedificacoes.com.br/
curl -s -i https://fn-edificacoes-api.onrender.com/ | head -5
```

Front 200 e API 5xx significa que **não há nada a corrigir neste repositório** — o serviço
no Render é que está fora. Olhe o cabeçalho `x-render-routing` da resposta:

| Resposta | O que é | O que fazer |
|---|---|---|
| `suspend-by-user` + "suspended by its owner" | serviço **suspenso** — quase sempre cobrança pendente ou cartão recusado | resolver o pagamento no Render e clicar em *Resume* |
| demora de ~50s e depois responde | serviço **hibernado** (plano free) | normal, só a primeira chamada |
| `502` / `504` | serviço caindo ao subir | ver os logs de deploy no Render |

Já aconteceu (agosto/2026): o serviço ficou suspenso e o sistema inteiro parou. A página de
erro da hospedagem não manda cabeçalho de CORS, então o navegador engole o 503 e o app só
via um `Failed to fetch` — a tela dizia "verifique sua internet" e a busca foi para o lado
errado. Hoje `apiFetch` traduz isso para uma mensagem que diz que o servidor está fora.

**O endereço da API ainda é o do Render, não nosso.** Enquanto for assim, trocar de
hospedagem exige mexer no `API_URL`, buildar e publicar o front. Apontar
`api.fnedificacoes.com.br` (CNAME) para o serviço e cadastrar esse domínio no Render
reduz a troca a uma mudança de DNS — o app não precisa saber. Feito isso, o novo endereço
entra em `API_URL`, no topo do `src/App.jsx`.

## Estrutura

Praticamente tudo vive em `src/App.jsx` (mais de 10 mil linhas). É proposital: o app
nasceu como um artefato de chat, num arquivo só, e continua assim. Não vale quebrar em
módulos "de passagem", junto com outra tarefa.

```
src/App.jsx                 o app inteiro: telas, componentes e chamadas de API
src/patologias-ambiente.js  catálogo de patologias por ambiente
src/patologias-consulta.js  busca no catálogo
src/rascunho-local.js       vistoria em edição salva no navegador
```

Para achar algo no `App.jsx`, procure pela definição da componente
(`grep -n "^function [A-Z]" src/App.jsx`). As grandes: `TelaLogin`, `PortalCliente`,
`TelaCadastroParceiro`, `PainelCliente`, `PainelParceiro`, `AppInterno` (equipe),
`AbaItens` (a vistoria), `AbaDocumentacao`, `AbaQualidade*` (agendamento).

## Quem entra e o que enxerga

O papel vem do backend no login, nunca é escolhido na tela. `App()` despacha por
`session.usuario.role`:

- `afiliado` → `PainelParceiro`
- `cliente` → `PainelCliente`
- os demais → `AppInterno`, filtrado por `MODULOS_POR_PERFIL`:
  `vistoriador` (laudos), `documentacao`, `atendimento` (clientes, agendamento, parceiros),
  `qualidade` (agendamento, só leitura), `vendas` (parceiros), `gerencia` (tudo).

A tela de login é uma só para os três públicos — equipe, cliente e parceiro/filiado.
Cliente sem senha usa "primeiro acesso"; parceiro se cadastra pelo botão do rodapé, que
abre a `TelaCadastroParceiro`. O login do parceiro nasce desativado e só abre quando a
Gerência homologa: quem mexer nesse fluxo precisa manter a mensagem de "cadastro em
análise" que o backend devolve, senão o parceiro acha que errou a senha.

## Revistoria

Retorno ao mesmo imóvel, pedido pelo cliente no próprio portal depois que o laudo é
entregue. Não altera o atendimento antigo: vira **um cadastro novo** (`servico`
`"Revistoria"`, com `revistoriaDe` e `revistoriaSeq`), que segue o mesmo caminho da
vistoria — análise do Atendimento, agendamento, técnico, laudo. As duas ficam no perfil do
cliente e em pastas separadas no Drive.

- `PainelCliente` → `ModalPedirRevistoria`: o botão só aparece quando o servidor manda
  `podePedirRevistoria` (laudo entregue e nenhuma revistoria em andamento).
- Técnico: a sub-aba **Laudo anterior** (`AbaLaudoAnterior`) só existe quando o cadastro
  aberto é revistoria; é somente leitura, de propósito — nada é copiado para o laudo novo.
- **`docDoCliente(cliente, docs)` é como se acha o laudo de um cadastro.** Nunca casar por
  CPF: vistoria e revistoria compartilham o CPF, e o `find` devolvia sempre a primeira,
  fazendo a revistoria nascer com cara de "já vistoriada".

## Perfil do cliente (Gerência)

Sub-aba **Gerência → Perfil do cliente** (`AbaPerfilCliente`): busca por nome, CPF, e-mail ou
empreendimento e abre o cadastro completo — atendimentos com laudo e documentação para
baixar, situação do acesso ao portal, cupons, orçamentos e pedidos —, tudo em `GET
/api/clientes/:id/perfil`, sem pedir senha nem e-mail do cliente.

É visão administrativa, não "entrar como o cliente": a edição sai pelo mesmo `updCliente` de
sempre. Os campos do cadastro moram em `CamposCadastroCliente`, compartilhado com o modal de
"Editar cliente" da aba Clientes — mexer em um muda os dois, de propósito.

## Rotas públicas (querystring, sem login)

O app não usa router; as páginas públicas são interceptadas no começo de `App()`:

- `?portfolio=<id>` — catálogo de um parceiro
- `?pagina=fn-clube` / `?pagina=fn-home` — as áreas de benefícios
- `?pagina=privacidade` — política de privacidade (`PaginaPrivacidade`)
- `?criar-senha=<token>` — link de e-mail do primeiro acesso ou da senha esquecida
- `?parceiro-cadastro=1` — link privado de cadastro de parceiro, enviado por WhatsApp

## Entrar no sistema

**Não existe senha padrão.** Ela já foi `12345678`, escrita na própria tela de login, e 38
das 78 contas ainda estavam com ela — o e-mail de um cliente bastava para abrir o laudo do
imóvel dele. Hoje a senha provisória nasce aleatória e ninguém a conhece.

Quem precisa entrar usa **"Receba um link por e-mail"** (`PrimeiroAcessoPorEmail`), que
serve aos dois casos — primeiro acesso e senha esquecida — para cliente, parceiro e equipe.
A resposta é sempre a mesma frase, exista ou não o e-mail: senão a tela vira uma forma de
descobrir quem é cliente da FN.

Um 401 vindo do servidor encerra a sessão e volta para o login com o motivo à vista (ver
`ligarSessaoAoApi`, no topo do arquivo). Um 403 não faz isso de propósito — quase sempre é
falta de permissão para uma tela, e deslogar por isso seria pior.

## Fotos do laudo vêm como URL, não como base64

O backend guarda as fotos no Drive e devolve uma **URL assinada de uma hora** no lugar da
imagem. Para as telas nada muda: continua sendo uma string no `src`. Duas consequências
para quem mexe aqui:

- `redimensionar()` devolve a string intacta quando ela não é `data:` — não dá para passar
  uma imagem de outra origem por um canvas.
- **A lista de laudos não traz o conteúdo.** `AbaLaudosRealizados` busca
  `/api/laudos/:docId/conteudo` quando alguém abre uma linha. Com o conteúdo na lista, uma
  abertura de tela baixava 62 MB — foi o que consumiu a banda mensal da hospedagem e
  suspendeu o serviço.

## Convenções

- **Tudo em português**: componentes, estados, constantes, comentários.
- Os comentários registram **por que** a coisa é assim, e muitos guardam um problema real
  já resolvido (a sessão que se perdia no F5, o botão duplicado que confundia). Leia o
  comentário antes de mudar o comportamento que ele descreve.
- Estilo é `style={{...}}` inline com as constantes de cor do topo (`AZUL_MARINHO`,
  `AZUL_MEDIO`, `CINZA_CLARO`, `CINZA_BORDA`) e os helpers `cell()`, `lab`, `inp`. Não há
  CSS-in-JS nem framework.
- Toda chamada de API passa por `apiFetch`, que já trata erro e token. **GET é repetido até
  3 vezes** quando a falha é passageira (rede, 502/503/504) — a API hiberna sem uso e reinicia
  a cada publicação, e a segunda tentativa quase sempre pega ela de pé. POST/PATCH nunca são
  repetidos: o mesmo clique viraria dois cadastros, laudos ou pedidos.
- Não há testes automatizados. A verificação é `npm run build` e abrir a tela no navegador.
