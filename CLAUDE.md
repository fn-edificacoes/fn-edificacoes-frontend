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
| `fn-edificacoes-backend` | a API deste front **e o banco** | servidor próprio da FN (VPS) |

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

## ⚠️ Onde estão os dados de verdade

Site, API e banco **rodam na mesma máquina da FN** desde 28/08/2026 — VPS Hostinger,
`179.199.134.65`, PostgreSQL 16 local no banco `fn`. Para ver dado real:

```bash
ssh -i ~/.ssh/fn-vps root@179.199.134.65
sudo -u postgres psql -d fn
```

Duas fontes antigas continuam de pé e **enganam quem for consultá-las**:

- o projeto no **Supabase** é uma cópia congelada na véspera da migração (o cadastro mais
  novo lá é de 27/08/2026). Devolve número plausível e errado — em 02/09/2026 um relatório
  inteiro do Financeiro foi montado em cima dele antes de alguém perceber;
- `fn-edificacoes-api.onrender.com` responde **503**: a API não mora mais lá. O site
  institucional apontava para esse endereço e ficou sem depoimento nenhum por uma semana,
  sem erro na tela, porque a seção some sozinha quando o fetch falha.

## Se o sistema travar

Front e API estão na mesma máquina, mas são serviços diferentes. Antes de procurar defeito
no código, descubra o que parou:

```bash
curl -s -o /dev/null -w "front %{http_code}\n" https://sistema.fnedificacoes.com.br/
curl -s -o /dev/null -w "api %{http_code}\n" https://sistema.fnedificacoes.com.br/api/avaliacoes/vitrine
```

Front 200 e API 5xx: **não há nada a corrigir neste repositório**. No servidor,
`systemctl status fn-api` e `journalctl -u fn-api -n 50` dizem o que houve — normalmente a
API não subiu depois de uma publicação.

Já aconteceu (agosto/2026, ainda no Render): o serviço ficou suspenso e o sistema inteiro
parou. A página de erro da hospedagem não mandava cabeçalho de CORS, então o navegador
engolia o 503 e o app só via um `Failed to fetch` — a tela dizia "verifique sua internet" e
a busca foi para o lado errado. Hoje `apiFetch` traduz isso para uma mensagem que diz que o
servidor está fora.

## Estrutura

Praticamente tudo vive em `src/App.jsx` (mais de 10 mil linhas). É proposital: o app
nasceu como um artefato de chat, num arquivo só, e continua assim. Não vale quebrar em
módulos "de passagem", junto com outra tarefa.

```
src/App.jsx                 o app inteiro: telas, componentes e chamadas de API
src/patologias-ambiente.js  catálogo de patologias por ambiente
src/patologias-consulta.js  busca no catálogo
src/rascunho-local.js       vistoria em edição salva no navegador
src/financeiro-regras.js    regras do Financeiro (despesas, MEI, exportação) — sem tela
src/controle-financeiro.jsx ARTs de vistoria, folha de pagamento, valores dos custos
src/empreendimentos-lista.jsx Gerência → Empreendimentos: a lista do "Cadastre-se"
src/patologia-voz.jsx       patologia por voz: gravar, acompanhar e revisar o item (aba da vistoria)
src/voz-fila-offline.js     patologia por voz: gravações guardadas no celular até o servidor receber
src/ia-creditos.jsx         Financeiro › Créditos de IA: gasto estimado da IA e limite de gravação por técnico
src/fn-home-mercadolivre.jsx FN Home: produtos do Mercado Livre (cadastro da Gerência e vitrine)
src/fn-home-financeiro.jsx  FN Home: vendas, comissão da FN, repasses, mais vendidos e cliques
src/clube-fn.jsx            FN Clube: ramos, vitrine com desconto, Casa Pronta e o aviso da Gerência
src/laudo-whatsapp.jsx      laudo aprovado pelo WhatsApp do cliente (link wa.me com a mensagem pronta)
src/links-publicos.js       endereços que vão para o cliente: Área do Cliente e FN_HOME_URL
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
  `vistoriador` (laudos, loja FN Home, despesas), `documentacao`, `atendimento` (clientes, agendamento, documentação,
  FAQ, marketing — Fornecedores saiu dele em out/2026), `qualidade` (agendamento, só leitura),
  `vendas` (parceiros), `gerencia` (tudo).

**Aba Documentação (Atendimento e Documentação):** duas sub-abas — **TRTs de reforma**
(`AbaDocumentacao`, os cadastros de "Documentação ART/TRT" com os dois anexos, pagamento e o
controle de produção) e **ARTs de vistoria** (`AbaArtsVistoria`, módulo `arts`). "arts" não tem
aba própria na barra de cima: `abaTop === "arts"` acende a aba Documentação. A Gerência chega às
duas pelo menu lateral, como antes. O Atendimento recebe de `/api/docs` **só os registros de
documentação** (o servidor filtra; os de vistoria continuam fora e as telas dele seguem no
`temLaudo`), e o servidor recusa que ele altere registro de vistoria.

A tela de login é uma só para os três públicos — equipe, cliente e parceiro/filiado.
Cliente sem senha usa "primeiro acesso"; parceiro se cadastra pelo botão do rodapé, que
abre a `TelaCadastroParceiro`. O login do parceiro nasce desativado e só abre quando a
Gerência homologa: quem mexer nesse fluxo precisa manter a mensagem de "cadastro em
análise" que o backend devolve, senão o parceiro acha que errou a senha.

## Patologia por voz

`src/patologia-voz.jsx`, encaixado na aba da vistoria (`AbaItens`) — backend em `src/patologia-voz.js`.
O técnico anexa a foto, segura o microfone e fala; o servidor transcreve e o Claude monta o item; o
técnico revisa e confirma. **Nada do fluxo antigo muda**: o item confirmado é um item comum
(`novoItem` + os campos de sempre, foto em base64, mais `vozItemId`), que entra na lista de itens. O
pendente mora só no servidor e não entra no laudo.

- **Quem vê:** só vistoriador e gerência, e só com a flag `PATOLOGIA_VOZ_LIBERADA` do servidor
  (`GET /api/patologia-voz/config`). Sem a flag, a aba fica exatamente como antes.
- `usePatologiaVoz` é chamado no `AppInterno` (não na aba) porque o **"Enviar para gerência"** precisa
  dos pendentes: com gravação ou item por revisar, `AvisoPendentesVoz` lista o que falta e deixa
  voltar ou enviar sem eles. O aviso vem depois da checagem da foto com o cliente, como antes.
- **Botão de gravar (`BotaoGravarVoz`)**, igual áudio de WhatsApp: segura e solta envia, arrastar
  para o lado cancela, para cima trava. Pointer events com `touch-action: none` (sem isso o celular
  rola a página no meio). Formato por `MediaRecorder.isTypeSupported`: webm/opus, senão mp4 (iPhone).
  Menos de 1 s descarta; 2 min envia sozinho; app em segundo plano envia o que gravou. Na 1ª vez o
  pedido de permissão do microfone interrompe o gesto — a tela só avisa que agora pode gravar.
- Ao soltar, o card aparece na hora ("Enviando" → "Processando") e o técnico segue. Enquanto houver
  algo processando, a lista é consultada a cada 3 s. Erro tem "Reprocessar" (sem regravar);
  "processando" há mais de 5 min conta como erro.
- **Fila sem sinal** (`src/voz-fila-offline.js`, banco IndexedDB `fn-voz-fila`, separado do rascunho):
  toda gravação vai primeiro para o celular e só sai de lá quando o servidor confirma. Áudio como
  ArrayBuffer (Blob no IndexedDB falhou no Safari do iPhone por várias versões). Reenvia sozinha ao
  abrir o sistema, ao trocar/reabrir a vistoria, no evento `online`, ao voltar para o app e a cada
  20 s enquanto houver algo "Aguardando sinal" — um envio por vez. Só reenvia falha sem resposta
  (rede, 5xx, 401, 408, 429; o `apiFetch` agora põe `status` no erro); recusa com motivo fica
  "Não enviada" até o técnico tentar de novo ou descartar. Cada envio leva `idEnvio` (gerado no
  aparelho): se a resposta se perdeu, o reenvio devolve a mesma gravação em vez de duplicar.
  Também vai `gravadoEm`, a hora real da gravação. A fila é por usuário (celular compartilhado) e
  guarda todas as vistorias; o painel mostra as da vistoria aberta e conta as outras. Se o último
  `config` disse "liberado" e agora não há resposta, o botão continua (`fn_voz_habilitado:<id>`).
- Card de revisão: foto, áudio (URL assinada, `preload="none"`), transcrição recolhível, campos do
  item com a patologia do catálogo pré-selecionada, selo de confiança e observações da IA.
  Trocar a patologia traz título, sistema, norma e severidade do catálogo e mantém descrição e
  recomendação. Regravar descarta o item e reaproveita a foto da gravação. **Foto do item**: X tira a
  foto, "Trocar foto" (câmera ou galeria) põe outra, "Voltar à foto da gravação" desfaz — tudo antes
  de confirmar e só para aquele item; o servidor guarda a escolha (`foto_escolhida`).
- **Norma técnica** em destaque no card ("do catálogo da patologia"): vem só do catálogo. Sem patologia
  identificada, o card mostra "É uma destas?" com as opções mais próximas (`extra.alternativas` do
  servidor) — um toque escolhe a patologia e traz a norma; o campo vazio/"a confirmar" fica destacado.
- **Limite de gravação:** `GET /config` traz `limite` (`{ minutos, periodo, usadosMinutos }` ou null);
  `UsoDoLimite` mostra o uso embaixo do botão e, quando acaba, trava o `BotaoGravarVoz` com "fale com a
  Gerência". O config é relido depois de cada envio. Quem define é a Gerência em Créditos de IA.

**Créditos de IA** (`src/ia-creditos.jsx`, `AbaCreditosIA`, item `fin-ia` do Financeiro, só Gerência):
crédito colocado em cada empresa (OpenAI e Anthropic) com gasto e restante **estimados** — o saldo exato
fica no painel delas, e a tela diz isso —, o gasto do mês por recurso e por pessoa, o limite padrão de
gravação dos técnicos, o limite próprio de cada um (padrão, próprio em min/dia ou min/mês, sem limite) e
os preços de tabela usados na conta. Tudo num `GET /api/financeiro/ia-creditos` e salvo num `PUT`.

## Laudo pelo WhatsApp

Depois de aprovar (`CardLaudosPendentes`), a fila mostra "✅ Laudo aprovado e enviado por e-mail" (ou
o aviso de que o e-mail não saiu — o servidor aprova mesmo assim) com **"📲 Enviar também pelo
WhatsApp"**; em Laudos realizados, a Gerência tem **"Reenviar WhatsApp"** nos entregues. É um `<a>`
para `wa.me` (`src/laudo-whatsapp.jsx`): nada de API da Meta, e nada de `window.open` depois de
`await`, que o navegador barra. O número sai do `telefone` do cadastro dono do laudo (`clienteDoDoc`).
O link do laudo é a Área do Cliente (`src/links-publicos.js`): o e-mail só leva o PDF anexo e o Drive
é privado. O cliente entra lá com o **e-mail**, não com o CPF. O clique avisa
`POST /api/laudos/:docId/whatsapp-aberto`, que grava em `laudo_auditoria` — "aberto", porque quem envia
é a pessoa.

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

## Financeiro — Despesas e Controle Fiscal

Menu lateral da Gerência → Financeiro: Receitas (a tela de preços/receita que já existia,
mais "outras receitas"), Despesas, Notas e Comprovantes, Deslocamentos, Relatórios,
Indicadores financeiros e Configurações Fiscais (itens `fin-*`, despachados por
`AbaFinanceiroDespesas`). Os outros perfis da equipe têm o módulo **Despesas**
(`AbaMinhasDespesas`): lançam e veem só o que lançaram. O botão "+ Despesa" do cabeçalho abre o
cadastro rápido (`ModalDespesa`) de qualquer tela.

- Estado e chamadas em `useFinanceiro`; API em `/api/financeiro/*` (`src/financeiro.js` no
  backend). Comprovante vai para o Drive, nunca para o banco.
- Regra única em `src/financeiro-regras.js`: o que entra nos indicadores (pessoal e rejeitada
  não entram; parcial entra pela parte empresarial), saúde documental, limite do MEI, CSV/Excel/ZIP.
  Dashboard, relatório e planilha do contador saem dessas mesmas funções.
- **A receita sai de `fichaFinanceira(cliente, doc, precoPorChave)`, e de nenhum outro lugar.**
  Setor de cobrança, Indicadores, Receitas, Painel estratégico, Indicadores financeiros, MEI e
  relatórios leem a ficha (direto, ou por `resumirAtendimentos`/`receitaDoPeriodo`). Antes cada
  tela somava do seu jeito e nenhum total batia. A ficha diz:
  - **valor**: lançado no Setor de cobrança → registro da vistoria → preço de tabela (`origemValor`);
  - **realizado**: vistoria finalizada (existe registro em `docs`) ou documentação pronta;
  - **faturado**: realizado **ou já pago** — o "Pago" confirmado pelo Atendimento conta na hora,
    sem esperar vistoria nem laudo. O resto é **previsto** e não entra no MEI nem no resultado;
  - **pago**: só `cliente.pagamento` (o backend espelha o registro da vistoria para o cadastro);
    `divergente` aponta caso antigo em que só o registro dizia Pago;
  - **datas**: `dataServico` (competência) e `dataPagamento` (caixa, a que bate com o extrato).
- Baixa manual no Setor de cobrança (`LinhaCobranca`) pede **data e forma** do pagamento. Pago
  antigo sem data nasce com o campo vazio — preencher "hoje" inventaria a data. A aba **Antes da
  vistoria** lista o que ainda não chegou à hora da visita, para registrar pagamento antecipado.
- **A sugestão de valor também é a ficha.** `sugestaoDeCobranca(cliente, doc, precoPorChave)` devolve
  o que a ficha usaria sem lançamento — registro da vistoria → preço de tabela (vistoria e revistoria
  pelo preço da vistoria, ART/TRT pelo da documentação) — e a origem, que a linha mostra embaixo do
  campo. O campo já nasce preenchido e **Lançar** confirma sem editar; campo vazio não grava R$ 0
  (cortesia se lança digitando 0). Os totais da tela (cobrado, recebido, a receber) saem da ficha
  completa, com registro e tabela (`indexarPrecos`, nome normalizado).
- O **Atendimento lê a tabela de preços** (`carregarPrecos`, `GET /api/precos-empreendimento`).
  Se o servidor recusar, a tela só fica sem a sugestão (aviso no console, nada na tela). Como ele
  recebe de `/api/docs` só os registros de documentação, a sugestão dele nas vistorias vem da
  tabela; a da Gerência, que tem os registros, pode vir do registro da vistoria.
- **Base antiga** (`ehHistorico`) sem valor fica num filtro próprio do Setor de cobrança, fora do
  "Falta lançar" e do sino — não é fila do Atendimento. Selo cinza "Base antiga · sem valor".
- **ART/TRT** se lança no card da Documentação (`CardDocumentosArt`), com a mesma `LinhaCobranca` em
  modo `compacto`: valor sugerido, situação, data e forma. Antes era só o seletor Pendente/Pago.
- **Lançados** (sub-aba do Setor de cobrança, **só Gerência**, `ListaCobrancasLancadas`): tudo o que
  tem `valorCobrado`, vistoria e ART/TRT juntas, do `cobrancaEm` mais recente para o mais antigo,
  com quem lançou (`cobrancaPor`). "Corrigir" abre a mesma `LinhaCobranca` compacta — mesmas
  validações e o mesmo PATCH. O Atendimento não vê o seletor de sub-abas.
- Nada decide regime tributário. O limite do MEI é o configurado; os campos do Simples são só guardados.
- **O número do MEI sai de `situacaoMeiDoAno`** (faturamento do ano, limite, projeção): o painel
  Situação Tributária e o aviso por e-mail usam a mesma conta. `Fin.projecaoMei` estica o ritmo do
  ano até 31/12 (só no ano corrente, com 30+ dias corridos) e diz o mês em que o limite estouraria.
- **Aviso do limite por e-mail** (`useAvisoLimiteMei`, chamado no `AppInterno`): uma vez por sessão da
  Gerência, quando clientes, docs e preços terminam a primeira carga, manda o faturamento do ano para
  `POST /api/financeiro/aviso-mei`. O servidor lembra a faixa já avisada (80/90/100/120%) e só manda
  e-mail na nova; a tela mostra um `notify` quando isso acontece. Falha aqui fica só no console.

**Controle financeiro** (`src/controle-financeiro.jsx`, arquivo próprio como a Rede Nacional):
- `AbaArtsVistoria` (módulo `arts`, Gerência, Documentação e Atendimento): ART múltipla de vistoria por
  empreendimento — quem está sem ART (do pré-cadastro em diante), emitir ART (até 50 pessoas,
  30 dias da emissão, R$ 69) ou incluir numa ART vigente com vaga. Cada ART vira despesa no servidor.
  Excluir a ART lançada por engano (some junto a despesa): Gerência e Atendimento.
  **ART individual**: com gente marcada, emite uma ART por pessoa (construtora que não aceita a
  coletiva); a linha mostra o selo "Individual" e o nome no lugar da ocupação, e ela não entra na
  "Economia vs. individual".
- Serviços no cadastro público: `EscolhaDeServico` (cartões com `ROTULO_SERVICO`/`EXPLICACAO_SERVICO`).
  O valor gravado continua o de `SERVICO_OPCOES`; "Documentação ART/TRT" aparece como **ART/TRT de
  reforma**, com aviso para quem precisa de ART de vistoria escolher a vistoria. No card do pedido
  (`CardDocumentosArt`), **Mudar para Vistoria** chama `converterParaVistoria` (rota do backend).
- `AbaFolhaPagamento` (Financeiro › Folha de pagamento, só Gerência): por mês, vistoriador pela
  regra 100/80 calculada **no servidor**, salário fixo do Atendimento (R$ 400) e extras. "Pagar"
  vira uma despesa; o comprovante se anexa ali mesmo (`fin.anexar`). `SalariosFixos` muda o valor
  de alguém, inclui ou tira da folha fixa. Nada disso aparece para o atendente ou o técnico.
  **Fechamento do dia**: o vistoriador recebe no fim de cada dia — escolhe o dia, paga, anexa o
  comprovante na mesma linha. "Marcar o mês todo como pago" (mês já pago fora do sistema) registra
  um pagamento por dia para cada vistoriador. `FormPagamento` tem "Lançar como despesa" — desmarcar
  quando o pagamento já foi lançado à mão em Despesas. `SalariosFixos` tem o mês de início ("Desde").
- Não existe mais custo fixo por empreendimento: a coluna saiu de Preços por empreendimento e a
  Rede Nacional mostra o valor do técnico pela regra do dia (`valor_tecnico_regra`).
- `CardValoresCustos` (Configurações Fiscais): valores do técnico, da ART e o salário fixo do Atendimento.
- `useCustosOperacionais`: o que `CardReceitaEstimada` usa para custo de técnico e de ART — a
  regra não se repete no front.
- Financeiro › **Conferência de pagamentos** (`AbaConferenciaPagamentos`, no App.jsx): "Pago" só no
  registro, pago sem data, realizado sem valor lançado e o que está a receber.
- Financeiro › **Conciliação Mercado Pago** (`AbaConciliacaoMercadoPago`, item `fin-conciliacao`, no
  App.jsx): por mês, o extrato da conta do Mercado Pago (`GET /api/financeiro/conciliacao`) contra os
  cadastros. Primeiro o que pede ação: **entrou sem link** (Pix na chave — o Mercado Pago **não manda
  o nome** de quem paga Pix na chave, só o banco; a sugestão vem, nesta ordem, do CPF do pagador (só
  no link), da baixa à mão no **mesmo dia e valor** (qualquer forma, fora quem já tem pagamento do
  Mercado Pago — `clientesComPagamento`), da baixa à mão como "Mercado Pago" de mesmo valor e do valor
  em aberto da ficha, ou busca por nome/CPF; "Vincular" manda só o id do pagamento e o cadastro),
  **link pago sem baixa** ("Dar baixa"),
  estornos com cadastro ainda Pago, link pago duas vezes e baixa à mão como "Mercado Pago" sem
  pagamento. Conferidos ficam recolhidos. **Planilha do mês para o contador**: `receitaDoPeriodo` em
  caixa (tudo o que entrou, qualquer forma, mais outras receitas recebidas) com tarifa, líquido e
  número do pagamento do Mercado Pago (`mpPaymentId` de `GET /api/cobrancas`) e linha de total.
- Despesa com `origem` foi lançada pelo sistema (técnico, ART, tarifa do Mercado Pago): o valor
  não se edita (`ModalDespesa` trava o campo; o servidor recusa).

**Link de pagamento (Setor de cobrança):** `BlocoLinkPagamento`, dentro de `LinhaCobranca`, gera
o link do Mercado Pago (`POST /api/cobrancas`) e oferece copiar/WhatsApp. O cliente paga pelo
card "Pagamentos" do `PainelCliente`; a volta do Mercado Pago cai em `?cobranca=<id>`
(`PaginaRetornoCobranca`, rota pública). Quem dá baixa é o webhook no backend — a tela só lê.

**Contas de recebimento e comprovante do Pix** (`src/recebimentos.js` no backend). A FN também recebe
numa conta secundária sem integração; a conferência dela é o comprovante do Pix. Todo dinheiro de
cliente em qualquer conta é faturamento da FN (a ficha não olha a conta) — a conta só diz em que
extrato conferir. O sistema não escolhe a conta nem desvia link: os links saem sempre da PJ.

- Estado num lugar só (`recebimentosEstado` + `useRecebimentos`, perto de `useFinanceiro`): contas e a
  lista de comprovantes, carregadas uma vez pelo `AppInterno` (Gerência e Atendimento). Cada linha do
  Setor de cobrança lê dali — buscar em cada linha seriam dezenas de pedidos iguais.
- `LinhaCobranca`: com Pix, transferência, boleto, cartão ou "Outro", aparece **"Caiu em qual conta"**
  (`contaRecebimento`); baixa nova por Pix/transferência não salva sem conta. Dinheiro limpa a conta;
  "Mercado Pago" (o link) já grava a PJ no servidor. Depois da baixa salva, `BlocoComprovanteRecebimento`
  anexa/abre/remove o comprovante; na conta conferida por comprovante, sem arquivo aparece o aviso.
- Conciliação Mercado Pago: "Recebido no mês por conta" (pela ficha, data do pagamento), o quadro
  **"Contas conferidas pelo comprovante"** (fora do bloco do Mercado Pago, aparece mesmo se a consulta
  falhar) com quem está sem comprovante (entra em "Precisa de conferência"), a planilha com as colunas
  **Conta de recebimento** e **Comprovante**, e **Comprovantes do mês (.zip)**, uma pasta por conta.
- Configurações Fiscais › `CardContasRecebimento`: cadastrar conta e desativar/reativar (a PJ é fixa).

## Empreendimentos do cadastro público

Gerência → Empreendimentos (`src/empreendimentos-lista.jsx`, `AbaEmpreendimentosCadastro`): onde a
Gerência adiciona, corrige e desativa o que o cliente escolhe no "Cadastre-se" (`AbaCliente`, que lê
`GET /api/empreendimentos-ref`). Salvou, aparece no formulário. A lista junta a planilha do Drive e os
adicionados aqui; os da planilha só se desativam e ganham tipologias aqui — nome e construtora se
corrigem na planilha, senão a sincronização desfaria. Toda gravação recarrega `empreendimentosRef` do
App, a mesma lista de Preços por empreendimento e Importar base. O "Remover" de Preços manda o nome
na querystring: o servidor não lê corpo de DELETE, e por isso ele nunca tinha funcionado. Regras no
backend: `src/empreendimentos-cadastro.js`.

## FN Home · Produtos do Mercado Livre

`src/fn-home-mercadolivre.jsx`, arquivo próprio como a Rede Nacional (recebe `apiFetch` por prop).
Produtos que a **própria FN** indica com o link de afiliado dela; a compra é no Mercado Livre e a
comissão só aparece no painel de afiliados de lá. Backend: `src/afiliados-mercadolivre.js`.

- **Gerência → FN Home → Produtos Mercado Livre** (`AbaProdutosMercadoLivre`, sub `fn-home-ml`):
  - **Botão "Enviar ao FN Home"** (favorito do Chrome, arrastado da tela): a API do Mercado Livre só
    libera foto e preço de produto de catálogo (`/p/`); produto de vendedor (`/up/`) e anúncio dão
    403 e a página não abre pelo servidor. O favorito roda na página aberta no Chrome de quem está
    logado (`lerPaginaParaOFnHome`, vira código por `toString()` — tem de ser autossuficiente e em JS
    simples), lê nome, foto, preço, "De" e o `meli.la` se já gerado (classes `ui-pdp-*`/`andes-*`,
    com og:*, `itemprop="price"` e JSON-LD de reserva) e abre o sistema com `#fn-home-ml=<json>`.
    Ao carregar, o módulo guarda isso em `sessionStorage` e limpa o endereço; o App abre a Gerência
    nessa tela e ela preenche, com a API só para a categoria. O que chega é filtrado
    (`limparRascunho`: página/link do Mercado Livre, foto do `mlstatic`, preço número) e só preenche.
    O `href` é posto pelo DOM, porque o React avisa sobre `javascript:` em prop. Testado contra páginas
    que imitam a do Mercado Livre — a de verdade pede login para quem não está logado.
  - **Preencher**: o primeiro campo recebe o endereço da **página do produto** (colar já dispara) e
    chama `POST /api/afiliados/mercadolivre/preencher`, que devolve nome e categoria sempre e foto e
    preço só de produto de catálogo, com o aplicativo da FN no Mercado Livre configurado no servidor. Preenche por cima o que
    veio e mostra os avisos do que faltou; não salva. O link curto (`meli.la`, `/sec/`) colado ali vai
    para o campo do link de afiliado — o servidor não consegue abri-lo. Página colada no link de
    afiliado ou na foto ganha o botão "Usar este endereço para preencher".
  - O link de afiliado continua à mão (o Mercado Livre não tem API para afiliado). Avisa, sem travar,
    quando o link não parece o do portal (`/sec/`, `/social/`, `meli.la`) — link da página do produto
    abre o mesmo anúncio e não paga comissão.
  - Foto por endereço https ou arquivo (reduzido a 600 px). Preço conferido há mais de 14 dias fica em
    amarelo; "Conferi hoje" renova a data sem mudar o valor.
- **Vitrine** (`SecaoOfertasMercadoLivre`): dentro de `SecaoParceirosVitrine` na aba FN Home — vale para
  `?pagina=fn-home` e para o portal do cliente. Fora do carrinho. Some se não houver produto ou se a
  API falhar. O botão é o link do Mercado Livre direto; o clique é avisado à API sem esperar resposta.
  Cada card mostra a data do preço, e o rodapé diz que é link de afiliado e que entrega e garantia são
  do Mercado Livre e do vendedor. Busca (sem acento), categorias com contagem numa fileira que rola
  de lado — com **barra de rolagem visível e setas ‹ ›** nas pontas (só aparecem quando há o que ver
  daquele lado, e somem em tela de toque): sem elas, quem usa mouse não chegava às últimas categorias
  (nov/2026) —, e 24 produtos por vez com "Ver mais". **A aba FN Home não mostra cartão de parceiro**
  (`SecaoParceirosVitrine`): o cartão "FN Home · Catálogo de móveis e decoração" saiu a pedido da
  Gerência (out/2026); o carrinho só aparece ali se já tiver item. O título da área é "Loja FN Home"
  e o texto diz que ela é aberta a todos, sem ser cliente.
- **Loja grande, com a cara do site** (out/2026, pedido da Gerência): `?pagina=fn-home` tem 1160 px de
  largura (o FN Clube segue em 780), abre com a faixa azul `FaixaLojaFnHome` (título e a proposta em três
  pontos) e mostra só a grade de produtos, sem as abas. No portal do cliente a loja vem com a faixa em
  versão compacta e ocupa até 1100 px, mais que o resto do portal (720): a margem negativa calculada
  centraliza — `justifySelf: "center"` vazava só para a direita. Os tamanhos dos cartões ficam nas
  classes `fnh-*` do `<style>` de `SecaoOfertasMercadoLivre`: ~210 px no computador, duas colunas abaixo
  de 640 px.
- **No portal do cliente a loja vem sem as abas** (`tipoInicial="produto"` + `semAbas`): o FN Clube tem
  seção própria logo depois dela (ver "Portal do cliente: FN Clube, FN Reforma e a documentação da
  reforma", abaixo), e o cabeçalho tem o botão "Loja FN Home", que rola até ela (`#loja-fn-home`). **Quem acabou de se cadastrar** pelo
  "Cadastre-se" entra com a confirmação do cadastro e a loja no topo da página, antes de "Meu
  atendimento" (`recemCadastrado`: o `AbaCliente` chama `onLogin(sessao, { recemCadastrado: true })`, o
  `App()` guarda só na memória — um F5 devolve a loja ao fim da página). Pedido da Gerência (out/2026).
  O site institucional também mostra uma amostra dos produtos (seção FN Home de lá).
- Os parceiros do FN Home (empresas, portfólio, carrinho) continuam no FN Projetos → Casa Pronta.
- O cadastro tem **"Sua comissão (%)"** (opcional): o percentual do portal de afiliados, só para a
  conta de quanto a FN ganha por venda.
- **"Você ganha R$ X por venda" em cada item da lista** (`BlocoComissao`, pedido da Gerência em
  31/10/2026): preço × a % informada ou, sem ela, a **estimada** pela tabela do Mercado Livre para a
  categoria do produto lá (`comissao_tabela`, que o servidor manda pronta — ver
  `comissao-mercadolivre.js` no backend). Tocar no quadro abre a % para digitar ali mesmo (PATCH só de
  `comissao_percentual`; em branco apaga e volta a estimativa). A conta é `comissaoDoProduto`, a mesma
  do Financeiro do FN Home, que também mostra a estimada como "tabela do ML"/"estimado". A categoria do
  Mercado Livre (`categoria_ml`) vem do Preencher (vai no salvar só quando veio agora) ou o servidor a
  busca pelo nome em segundo plano; enquanto busca, a lista se recarrega sozinha (até 8 vezes).
- **Foto no quadro certo** (31/10/2026): a moldura `.fnh-foto` tem tamanho fixo (quadrada, da largura
  do cartão) e a foto fica por cima dela em `position: absolute`, sem ocupar espaço. Com a foto dentro
  de uma grade com `aspect-ratio`, foto alta (garrafa, cadeira) esticava a moldura e a linha inteira —
  o cartão vizinho ganhava um vão entre o nome e o preço, e no iPhone a foto vazava por cima do
  "Comprar". Foto que não abre vira o ícone (`FotoDoProduto`). A miniatura da lista (`Miniatura`)
  segue a mesma ideia — dentro de grade, a foto alta saía cortada.
- **Loja na página de entrada** (`PortalCliente`, a do "Cadastre-se"; nov/2026, pedido da Gerência:
  "divulgue melhor a FN Home"): logo abaixo de "SOU CLIENTE — ENTRAR" vem `DestaqueLojaFnHome` (em
  `fn-home-mercadolivre.jsx`) — faixa azul com "Tudo para equipar o seu imóvel", o total de produtos, "até
  X% OFF", quatro produtos (maior desconto primeiro, só com foto https) e "Ver a loja FN Home — N ofertas".
  Os cartões levam à loja (`?pagina=fn-home`), não ao Mercado Livre. Some sem produto ou com a API fora.
  Na barra azul, "FN Home · Loja" virou uma pílula amarela.
  O fim da página não tem mais o card **"Benefícios Exclusivos FN"** (logos dos parceiros, só o do FN
  Home): saiu a pedido da Gerência (nov/2026), junto com o modo `somenteLogos` da
  `SecaoParceirosVitrine`, que só existia para ele.
- **Descontos em destaque** (nov/2026, pedido da Gerência: "os descontos que a loja fornece na
  propaganda deles"): `ofertaDe(p)` junta o "De" riscado (`preco_de` maior que o preço) e o texto do
  anúncio (`desconto_texto`, "7% OFF no Pix"); o percentual do texto manda quando os dois existem, e sem
  nenhum dos dois não há oferta — nada é inventado. Na loja: faixa "N produtos em promoção — até X% OFF"
  (abre o filtro), chip **"Em promoção (N)"** antes das categorias, produtos com desconto primeiro (o
  maior na frente; o resto na ordem de sempre), selo vermelho `-X%` na foto (`COR_OFERTA`), "De R$"
  riscado, o texto do anúncio em verde e "Economize R$ X" quando há "De". O texto vai inteiro porque
  "-7%" sem o "no Pix" prometeria o desconto no cartão. No cadastro: campo **"Desconto do anúncio"**.
- **Loja para o técnico mostrar ao cliente** (nov/2026, pedido da Gerência: "uma aba … para que eles
  possam mostrar aos clientes"): o vistoriador tem o módulo `loja` ("Loja FN Home" na barra de cima, entre
  Laudos e Despesas), que abre `AbaLojaParaCliente` (em `fn-home-mercadolivre.jsx`): caixa azul com
  "Enviar pelo WhatsApp" (`wa.me` com a mensagem e o link `fnedificacoes.com.br/fn-home`; com o número do
  cliente — 10/11 dígitos ganham o 55 — abre a conversa dele, sem número o WhatsApp pede o contato) e
  "Copiar link", mais a loja inteira (`SecaoOfertasMercadoLivre separar={false}`). Só leitura: nada de
  cadastro de produto, e o clique no "Comprar" conta como qualquer clique da vitrine.

## Portal do cliente: FN Clube, FN Reforma e a documentação da reforma

Pedido da Gerência (nov/2026): o FN Clube ao lado da FN Home, a FN Reforma no portal mesmo antes de
funcionar, e a Documentação ART/TRT dita com todas as letras como a **da reforma**.

- **Cabeçalho do `PainelCliente`**: Loja FN Home, FN Clube (só com o Clube ativado pela Gerência — ver
  "Ativar ou ocultar" em FN Clube, abaixo), FN Reforma e Sair, cada botão rola até a sua
  seção (`irPara`, que desconta a altura do cabeçalho fixo — no celular ele tem duas linhas, e o
  `scrollMarginTop` fixo escondia o título). O cabeçalho tem 1100 px (a largura da loja), não 720: em 720
  o nome e os quatro botões desciam para uma segunda linha. No celular os botões ficam só no ícone e
  dividem a linha com o nome (`.cabecalho-cliente`, que só existe no portal do cliente: o nome quebra
  em duas linhas antes de o "Sair" ir parar numa terceira).
- **FN Clube** (`#fn-clube`): a mesma `SecaoParceirosVitrine`, com `tipoInicial="servico"` e `semAbas`.
  Sem parceiro de serviço na vitrine, o título ganha o selo "Em breve" (`SeloEmBreve`) e, no lugar de
  "Nenhum parceiro disponível", vem `AvisoFnClubeEmBreve` (em andamento, estreia em breve, "tudo o que o
  seu imóvel precisa em um só lugar"). O primeiro parceiro aprovado toma o lugar do aviso sozinho — vale
  também para `?pagina=fn-clube`. A seção começa "carregando" para o aviso não piscar antes da lista.
  O carrinho: na seção do FN Clube só aparece com parceiro ou com item; com `semAbas`, a loja nunca o
  mostra (cada seção tem o seu `useCarrinho`, e duas cópias na mesma página se desencontrariam).
- **FN Reforma** (`#fn-reforma`, `SecaoFnReforma`): diz que ainda não está funcionando, mas que vai
  atender, e já recebe o pedido — o que fazer (as categorias do FN Casa Pronta, `lib/casa-pronta.ts` do
  fn-reformas, na mesma ordem), detalhes, para quando e, com mais de um imóvel, qual. **Não há rota no
  backend**: o botão é um link `wa.me` para o WhatsApp do atendimento (o do rodapé) com a mensagem pronta,
  nome e imóvel do cadastro. Nada fica gravado no sistema. Quando a FN Reforma abrir, troque por um POST
  na API e dê à Gerência a lista dos pedidos.
- **"Vai reformar?"** (`#documentacao-reforma`, `CardDocumentacaoReforma`): era o "Precisa de mais um
  serviço?" — o cliente não entendia que a ART/TRT dali é a da reforma do imóvel. Mesma regra para
  aparecer (com atendimento e sem documentação pedida) e o mesmo `nova-solicitacao`. A lista do que o
  cliente recebe é a que o portal já promete quando a documentação fica pronta (`STATUS_ATENDIMENTO_INFO`:
  documentação assinada e placa de identificação de obra) — não prometa ali o que a equipe não entrega.
  A frase da NBR 16.280 fica no que a norma pede (reforma comunicada ao síndico antes de começar, com o
  responsável técnico). O imóvel só aparece quando o cliente tem um só: com mais de um, quem escolhe de
  qual cadastro saem os dados é o servidor. A FN Reforma tem um link para este card enquanto ele existir.

## FN Clube (parceiros com desconto para cliente FN)

`src/clube-fn.jsx`, arquivo próprio como o FN Home (recebe `apiFetch` por prop). Pedido da Gerência
(nov/2026): parceiros homologados que dão desconto exclusivo — restaurantes, farmácias, academias,
terapias, lanchonetes… — junto com os colaboradores do Casa Pronta. Backend: `src/clube-fn.js`.

- **Ramo** de cada parceiro de serviço (`RAMOS_CLUBE`: chave, rótulo e ícone; as chaves são as do
  backend). Campo `SeletorRamo` no cadastro manual (`ModalCriarParceiroManual`, obrigatório para
  serviço), na tela do convite (`TelaCadastroParceiro`, obrigatório), no "Completar meu perfil" do
  parceiro e no perfil de venda da Gerência. A lista de parceiros mostra o ramo, ou "sem ramo no
  Clube" em âmbar (esse só aparece em "Todos").
- **Vitrine** (`VitrineClubeFn`, dentro de `SecaoParceirosVitrine` na aba FN Clube; a vitrine só de
  logos não mudou): total e "descontos de até X%", busca sem acento, ramos com contagem (quebram linha
  no computador, rolam de lado no celular) e cartões com o benefício em vermelho e selo `-X%` quando o
  texto tem percentual — o texto vai inteiro, porque "-10%" sem "na mensalidade" prometeria mais. Quem
  dá desconto em número vem primeiro. O cartão abre o `ModalBeneficioParceiro` de sempre: o cupom só
  sai para cliente FN logado.
- **Casa Pronta entra sozinho** em "Casa e reforma" (`GET /api/clube/casa-pronta`, que a API lê do FN
  Projetos): empresa, área atendida e o desconto FN de cada serviço, sem preço. O botão é **"Pedir pela
  FN"** (WhatsApp da FN com a mensagem pronta) — o cliente não fala direto com o parceiro, como no
  Casa Pronta. No celular esses cartões ocupam a largura toda (a lista de serviços não cabia em meia tela).
- `?pagina=fn-clube` abre com a faixa `FaixaClubeFn` e tem 1040 px (era 780).
- **Gerência → FN Clube → Parceiros do Clube** (sub `clube-parceiros`): a mesma `AbaGerenciaParceiros`
  da aba "Fornecedores" de Vendas/Atendimento (homologação, convite, prospecção, cupons, comissões),
  que a Gerência tinha perdido quando o Casa Pronta saiu do sistema (set/2026), mais o aviso
  `AvisoCasaProntaNoClube` (quantos entram sozinhos do Casa Pronta, ou que o FN Projetos não respondeu).
  O sino de "parceiro aguardando homologação" agora também avisa a Gerência e leva para essa tela.
- **Ativar ou ocultar** (Gerência → FN Clube → "Ativar ou ocultar", sub `clube-visibilidade`,
  `AbaVisibilidadeClube`; nov/2026, pedido da Gerência: "mantenha oculto pro cliente ainda"). A chave
  mora no servidor (`GET /api/clube/visibilidade`) e vale para todos; **sem escolha gravada, o Clube
  fica oculto**. As telas perguntam por `useClubeVisivel`/`clubeVisivelParaClientes` (em `clube-fn.jsx`,
  uma pergunta por carga de página; sem resposta, oculto). Oculto quer dizer: sem o botão e a seção
  `#fn-clube` no `PainelCliente`, sem o link "FN Clube" na barra da página de entrada e da página
  pública, `?pagina=fn-clube` só com o `AvisoFnClubeEmBreve` e o atalho para a loja, e a avaliação
  (`PaginaAvaliarPublica`) levando a `?pagina=fn-home`. Mostrar pede confirmação; ocultar, não. A aba
  traz a prévia da seção (a mesma `SecaoParceirosVitrine` do portal). Parceiros continuam sendo
  cadastrados e homologados em "Parceiros do Clube", e as rotas de dados continuam abertas.

## FN Home · Financeiro (vendas e comissões)

`src/fn-home-financeiro.jsx`, arquivo próprio (recebe `apiFetch` por prop). Tudo vem pronto de
`GET /api/financeiro/fn-home?de&ate&area` (`src/fn-home-financeiro.js` no backend): a tela não soma nada.
Pedido da Gerência (out/2026): "acompanhar todas as vendas na FN Home… a comissão que vou ganhar de
todos os itens, itens mais vendidos". Três lugares, um componente:

- **Gerência → FN Home → Vendas e comissões** (sub `fn-home-financeiro`) e o lado **"Financeiro do FN
  Home"** da aba **Conciliação Mercado Pago** (`AbaMercadoPago` no App.jsx: duas abas, conciliação e
  FN Home — o carrinho recebe nessa mesma conta). Os dois abrem `AbaFinanceiroFnHome`.
- **Gerência → Indicadores**: `CardFnHomeNosIndicadores` logo abaixo de "Indicadores por período", no
  mesmo recorte (`datasDoPeriodo` converte o período da tela em de/ate). "Abrir o financeiro do FN
  Home" leva à tela inteira (`aoAbrirFnHome`).

Na tela: período (este mês, ano, tudo ou um mês) e área (FN Home, FN Clube, tudo); comissão da FN em
destaque com a variação sobre o período anterior; vendido, vendas, tarifa do Mercado Pago, "fica para a
FN" (comissão − tarifa), **a repassar** e **a receber** dos parceiros (todas as datas); gráfico de 12 meses
da comissão (uma série, tooltip com o mês inteiro, "Ver em tabela"); mais vendidos; por parceiro;
**comissão de cada item** do catálogo (do item / da categoria / padrão do parceiro, e "você ganha por
venda"); funil do carrinho; orçamentos; Mercado Livre (vendas registradas, comissão confirmada e a
confirmar, cliques e ganho por venda); e a lista de vendas com o acerto:

- Carrinho: a FN recebeu tudo, então o botão é **"Repassei"** (valor − comissão ao parceiro).
- Orçamento: o cliente pagou o parceiro, então é **"Recebi"** (a comissão).
- Os dois mandam `PATCH /api/vendas/:id` `{ statusComissao: "paga" | "pendente" }`, o mesmo de
  Parceiros → Vendas e comissões, e recarregam.
- Mercado Livre: **"Confirmada"** quando o painel de afiliados confirma a comissão
  (`PATCH /api/financeiro/fn-home/vendas-ml/:id` `{ situacao }`).

**Vendas do Mercado Livre não chegam sozinhas** (o Mercado Livre só as mostra no painel de afiliados de
lá). No bloco Mercado Livre, **"Registrar venda"** abre `FormVendaMl`: produto da vitrine ou "Outro
produto", data, quantidade, valor (nasce do preço × quantidade enquanto não for digitado), comissão (em
branco, o servidor usa o % do produto — a tela mostra quanto dá) e situação do painel. A lista do bloco
corrige (lápis) e apaga (com "Sim, apagar"). Enquanto o período não tem venda do Mercado Livre, um aviso
amarelo no topo explica e abre o formulário. O `div` que envolve o bloco (para o `scrollIntoView`) precisa
de `minWidth: 0` — sem isso a tabela larga esticava a coluna do grid e a tela inteira ganhava rolagem lateral.

A comissão do FN Home **não entra** na receita do Financeiro (ficha, MEI, contador).
- `PaginaBeneficiosFn` passou a injetar `estilos` (antes os botões da página pública saíam sem estilo),
  e `BotaoCarrinho` aceita `style` — na vitrine branca o ícone branco do `btn-ghost` sumia.

## Rede Nacional (FN Nacional)

Módulo `nacional`, em **arquivo próprio**: `src/rede-nacional.jsx` (`AbaRedeNacional`). O
`App.jsx` só o importa e o encaixa (menu lateral da Gerência, barra do `gestor_regional`) e lhe
entrega o `apiFetch` por prop — continua sendo o único caminho para a API. Fala só com
`/api/nacional/*` (ver `src/nacional.js` no backend).

- Papel novo `gestor_regional`: `MODULOS_POR_PERFIL.gestor_regional = ["nacional"]`. O
  servidor filtra tudo pelas regionais liberadas a ele; a tela só esconde as abas que dariam 403.
- A OS é o cadastro do cliente: escalar técnico continua no Agendamento, pelo `updCliente` de
  sempre. Quando o técnico não pode receber a OS, o backend devolve 409 com o motivo, e o
  aviso já aparece pelo `notify` do `updCliente`.
- Origem comercial, nível/situação do técnico e valor do técnico pedem justificativa
  (`ModalJustificativa`, mínimo de 10 caracteres — a mesma regra do servidor).

## Mapa de atuação

Módulo `mapa` (`src/mapa-atuacao.jsx`), no menu da Gerência logo abaixo de Indicadores —
**só da Gerência**: clientes e parceiros por cidade são informação comercial. O site
institucional tem a versão pública (`/api/nacional/mapa-publico`), ligada regional por
regional em Rede Nacional → Regionais → "No site". Dados de
`GET /api/nacional/mapa`: clientes (por CPF), empreendimentos e parceiros ativos por UF e por
cidade, lidos do banco a cada consulta; a tela relê sozinha a cada minuto.

- **Brasil:** desenho estático em `src/mapa-brasil.js`. **Regional:** um arquivo por UF em
  `public/mapas/municipios-XX.json`, baixado só quando a regional é aberta. Os dois vêm da
  malha do IBGE e são refeitos por `scripts/mapas/gerar-mapa.cjs` e `gerar-municipios.cjs`.
- A cidade do cadastro casa com o município do IBGE sem acento nem caixa; o que não casar
  aparece em "Cidades não localizadas" — corrige-se a grafia, não o mapa.
- Cores: calor amarelo → vermelho em até 5 faixas com legenda, e cinza-azulado para "sem
  atuação" (validados para daltonismo). A legenda do mapa regional fica **embaixo**: por cima
  ela cobria a região metropolitana.

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

Quem esqueceu a senha resolve sozinho: **"Esqueci minha senha"**, logo abaixo do campo da senha
(pedido da Gerência, nov/2026 — antes era uma linha cinza embaixo do "Entrar" que ninguém achava),
abre `PedirLinkDeSenha` no lugar do formulário, já com o e-mail digitado. **"Primeiro acesso? Crie sua
senha"** abre a mesma tela. Os dois pedem `POST /api/clientes/solicitar-senha`, que vale para cliente,
parceiro e equipe. A resposta é sempre a mesma frase, exista ou não o e-mail: senão a tela vira uma
forma de descobrir quem é cliente da FN. Recusa (limite de pedidos) aparece em vermelho, com o
formulário para tentar de novo.

O link do e-mail (30 minutos, vale uma vez só) abre `?criar-senha=` → `TelaCriarSenhaCliente`
("Defina sua senha", texto que serve aos dois casos), e a pessoa já entra. **"Link vencido ou já
usado? Peça um novo"** volta ao login já no pedido do link (`recuperacaoNoLogin`, no `App()`).
O **suporte pelo WhatsApp continua** (`WHATSAPP_ATENDIMENTO_FN`, mensagem pronta): "Sem e-mail no
cadastro? Fale com a FN pelo WhatsApp" no login, e a caixa "Não tem e-mail no cadastro ou o link não
chegou?" no pedido do link. Esse link não se chama "esqueci minha senha" de propósito: dois botões com
o mesmo nome levavam a pessoa para lados diferentes. `TelaLogin` e `TelaCriarSenhaCliente` carregam o
`estilos` — sem ele o "Entrar" saía como botão cinza do navegador.

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
