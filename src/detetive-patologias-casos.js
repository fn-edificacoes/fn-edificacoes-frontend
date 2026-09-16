/* ============================================================================
   FN ARQUIVO TÉCNICO — Detetive das Patologias
   Catálogo dos casos jogáveis no game do Portal do Cliente.

   Cada caso é demonstrativo: o texto é baseado em situações reais de vistoria de
   entrega de chaves, mas "imagemCena" e "imagemEvidencia" ficam null de propósito —
   a tela do jogo mostra um quadro de "fotografia/vídeo entra aqui" no lugar, para
   nunca passar uma imagem genérica por um registro real de vistoria. Quando a FN
   tiver o acervo de fotos/vídeos reais organizado por caso, basta preencher esses
   dois campos com a URL e a tela do jogo já usa a imagem no lugar do quadro.

   "classificacao" segue o vocabulário técnico do laudo (ver CLAUDE.md): nem toda
   ocorrência é uma "patologia", e o jogo evita esse rótulo quando não é o caso.
   ========================================================================== */

export const CASOS_DETETIVE = [
  {
    id: "caso-001",
    numero: 1,
    titulo: "O banheiro que parecia perfeito",
    categoria: "Áreas molhadas",
    dificuldade: "Fácil",
    xpMaximo: 30,
    imagemCena: null,
    imagemEvidencia: null,
    segundosObservacao: 7,
    textoAbertura:
      "Um imóvel novo acaba de entrar no Arquivo Técnico da FN. À primeira vista, o banheiro parece perfeito — piso limpo, rejunte novo, tudo brilhando. Mas a equipe encontrou uma pista. Sua missão é descobrir o que está acontecendo.",
    pistaExtra: "Repare para que lado a água deveria escorrer perto do ralo — e se ela de fato chega lá.",
    hipoteses: [
      { letra: "A", texto: "Vazamento na tubulação." },
      { letra: "B", texto: "Problema relacionado ao caimento do piso até o ralo." },
      { letra: "C", texto: "Falha de rejuntamento." },
      { letra: "D", texto: "Não existe problema." },
    ],
    respostaCorreta: "B",
    textoNovaEvidencia:
      "A equipe jogou um balde de água no centro do banheiro e cronometrou o escoamento. Depois de mais de um minuto, ainda havia poças perto do box — a água não estava indo toda para o ralo.",
    veredito: {
      classificacao: "condição que exige avaliação",
      resumo: "Indício de caimento insuficiente do piso em direção ao ralo.",
      explicacao:
        "O piso do banheiro precisa de uma leve inclinação (caimento) para toda a água correr até o ralo. Quando o caimento é insuficiente, a água empoça, demora para escoar e, com o tempo, pode infiltrar no contrapiso ou na laje — um problema que só aparece depois que o imóvel já está em uso. Por isso o teste com água durante a vistoria é tão importante: sozinho, o olho não enxerga a inclinação do piso.",
    },
    perguntaTecnica: {
      pergunta: "Qual equipamento os vistoriadores costumam usar para confirmar um caimento insuficiente?",
      alternativas: ["Trena a laser", "Nível de bolha ou mangueira de nível", "Multímetro"],
      respostaCorreta: 1,
    },
    equipamentoUtilizado: "Nível de bolha / mangueira de nível + teste com água",
  },
  {
    id: "caso-002",
    numero: 2,
    titulo: "O som que denunciou o piso",
    categoria: "Pisos",
    dificuldade: "Médio",
    xpMaximo: 30,
    imagemCena: null,
    imagemEvidencia: null,
    segundosObservacao: 7,
    textoAbertura:
      "Um apartamento com porcelanato recém-instalado chegou ao Arquivo Técnico. Visualmente, o piso está impecável — nenhuma trinca, nenhum desnível aparente. Mas a equipe encontrou uma pista que os olhos não pegam.",
    pistaExtra: "Nem toda pista se vê. Às vezes ela se ouve.",
    hipoteses: [
      { letra: "A", texto: "Piso com placas ocas (mal aderidas ao contrapiso)." },
      { letra: "B", texto: "Piso com cor diferente do combinado." },
      { letra: "C", texto: "Rejunte da cor errada." },
      { letra: "D", texto: "Não existe problema." },
    ],
    respostaCorreta: "A",
    textoNovaEvidencia:
      "A equipe percorreu o piso batendo levemente com um instrumento próprio de inspeção. Em alguns pontos, o som voltou grave e cheio; em outros, oco — como se houvesse um vão embaixo da placa.",
    veredito: {
      classificacao: "não conformidade",
      resumo: "Indício de placas de porcelanato com aderência insuficiente ao contrapiso (som oco à percussão).",
      explicacao:
        "Quando a argamassa não cobre toda a área embaixo da placa, fica um vão de ar — e é esse vão que produz o som oco. Piso oco tende a trincar ou soltar com o tempo, principalmente em áreas de passagem. O teste de percussão (bater de leve e ouvir) é rotina em vistoria de entrega de chaves justamente porque esse defeito não aparece a olho nu.",
    },
    perguntaTecnica: {
      pergunta: "Como esse tipo de falha costuma ser verificado numa vistoria?",
      alternativas: ["Teste de percussão (som ao bater de leve no piso)", "Medição de temperatura do piso", "Teste de resistência elétrica"],
      respostaCorreta: 0,
    },
    equipamentoUtilizado: "Instrumento de percussão para piso",
  },
  {
    id: "caso-003",
    numero: 3,
    titulo: "A tomada suspeita",
    categoria: "Instalações elétricas",
    dificuldade: "Médio",
    xpMaximo: 30,
    imagemCena: null,
    imagemEvidencia: null,
    segundosObservacao: 7,
    textoAbertura:
      "Na vistoria de um apartamento novo, uma tomada da sala chamou a atenção da equipe. Nada vazando, nada quebrado — mas algo no jeito que ela foi instalada não parecia certo.",
    pistaExtra: "Conte quantos polos essa tomada tem — e compare com uma tomada comum de três pinos.",
    hipoteses: [
      { letra: "A", texto: "Tomada sem o pino de aterramento (fora do padrão NBR 5410)." },
      { letra: "B", texto: "Tomada de voltagem errada." },
      { letra: "C", texto: "Tomada com fiação exposta." },
      { letra: "D", texto: "Não existe problema." },
    ],
    respostaCorreta: "A",
    textoNovaEvidencia:
      "A equipe testou a tomada com um equipamento próprio de verificação elétrica: o terceiro polo, o de aterramento, não respondeu — ele simplesmente não está ligado a nada.",
    veredito: {
      classificacao: "irregularidade aparente",
      resumo: "Indício de tomada sem aterramento funcional, fora do padrão da norma NBR 5410.",
      explicacao:
        "O aterramento é o caminho de segurança que desvia uma corrente de fuga para a terra, em vez de passar pela pessoa. Uma tomada de três pinos que parece completa, mas não está de fato aterrada, passa uma falsa sensação de segurança — e é exatamente por isso que a equipe testa e não só olha.",
    },
    perguntaTecnica: {
      pergunta: "Qual norma técnica trata das instalações elétricas de baixa tensão em edificações no Brasil?",
      alternativas: ["NBR 5410", "NBR 6118", "NBR 9050"],
      respostaCorreta: 0,
    },
    equipamentoUtilizado: "Testador de tomadas / equipamento de verificação elétrica",
  },
  {
    id: "caso-004",
    numero: 4,
    titulo: "O problema estava na janela",
    categoria: "Esquadrias",
    dificuldade: "Fácil",
    xpMaximo: 30,
    imagemCena: null,
    imagemEvidencia: null,
    segundosObservacao: 7,
    textoAbertura:
      "Uma esquadria de alumínio, aparentemente nova e bem instalada, entrou no Arquivo Técnico depois de uma reclamação recente de umidade na parede ao lado.",
    pistaExtra: "Repare no contorno da esquadria com a parede — nem toda folga ali é só estética.",
    hipoteses: [
      { letra: "A", texto: "Vidro de espessura errada." },
      { letra: "B", texto: "Vedação da esquadria com a alvenaria permitindo entrada de água." },
      { letra: "C", texto: "Cor da esquadria diferente do projeto." },
      { letra: "D", texto: "Não existe problema." },
    ],
    respostaCorreta: "B",
    textoNovaEvidencia:
      "A equipe aplicou um teste de estanqueidade, simulando chuva com água direcionada à esquadria por alguns minutos. Do lado de dentro, surgiu um fio de umidade descendo pelo canto inferior do marco.",
    veredito: {
      classificacao: "falha de execução",
      resumo: "Indício de vedação inadequada entre a esquadria e a alvenaria, permitindo infiltração.",
      explicacao:
        "Esquadria bem fabricada não é garantia de instalação bem feita: a vedação entre o marco e a parede (selante, contramarco, pingadeira) é o que impede a água da chuva de entrar. Quando essa vedação falha, a infiltração costuma aparecer bem depois da entrega — muitas vezes só na primeira chuva forte.",
    },
    perguntaTecnica: {
      pergunta: "Que tipo de teste ajuda a identificar esse problema antes da entrega das chaves?",
      alternativas: ["Teste de estanqueidade (simulação de chuva)", "Teste de dureza do vidro", "Teste de nivelamento a laser"],
      respostaCorreta: 0,
    },
    equipamentoUtilizado: "Simulação de chuva / teste de estanqueidade",
  },
  {
    id: "caso-005",
    numero: 5,
    titulo: "O apartamento aparentemente perfeito",
    categoria: "Acabamentos",
    dificuldade: "Difícil",
    xpMaximo: 30,
    imagemCena: null,
    imagemEvidencia: null,
    segundosObservacao: 7,
    textoAbertura:
      "Este é o apartamento que mais recebeu elogios da família compradora: acabamento impecável, pintura nova, tudo em ordem. Mesmo assim, a equipe da FN não fecha um laudo só de olhar — e encontrou uma pista discreta em um dos ambientes.",
    pistaExtra: "Luz rasante (de lado) revela o que a luz de cima esconde.",
    hipoteses: [
      { letra: "A", texto: "Fissura fina de acabamento, compatível com acomodação natural da estrutura." },
      { letra: "B", texto: "Mofo embaixo da pintura." },
      { letra: "C", texto: "Parede fora de esquadro." },
      { letra: "D", texto: "Não existe problema." },
    ],
    respostaCorreta: "A",
    textoNovaEvidencia:
      "Com uma lanterna posicionada bem rente à parede (luz rasante), uma fissura fina e capilar ficou visível — do tipo que costuma aparecer com a acomodação natural da alvenaria nos primeiros meses do imóvel.",
    veredito: {
      classificacao: "condição que exige avaliação",
      resumo: "Fissura de acabamento compatível com acomodação natural da estrutura — não necessariamente uma patologia.",
      explicacao:
        "Nem toda fissura é grave: fissuras finas, sem padrão de mapa e sem continuidade estrutural costumam vir da acomodação natural de um prédio novo. Ainda assim, ela entra no laudo — o registro existe para que o histórico fique documentado e comparável, caso a fissura volte a aparecer ou aumente depois.",
    },
    perguntaTecnica: {
      pergunta: "Qual técnica de iluminação ajuda a revelar fissuras finas na parede?",
      alternativas: ["Luz rasante (de lado)", "Luz ultravioleta", "Luz infravermelha"],
      respostaCorreta: 0,
    },
    equipamentoUtilizado: "Lanterna para luz rasante",
  },
];
