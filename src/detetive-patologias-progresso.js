/* ============================================================================
   FN ARQUIVO TÉCNICO — Detetive das Patologias
   Progresso do jogador (XP, nível, badges, casos concluídos), guardado no
   localStorage do navegador — o mesmo padrão de "salva sozinho" do rascunho de
   vistoria (ver rascunho-local.js), só que aqui não tem foto nenhuma envolvida,
   então o volume de dado é pequeno e localStorage puro é suficiente.

   Fica só no aparelho de quem joga: não é ranking entre clientes (isso exigiria
   um servidor) nem sincroniza com o backend. Trocar de aparelho ou limpar os
   dados do navegador zera o progresso.
   ========================================================================== */

const CHAVE_PROGRESSO = "fn_detetive_progresso";

function estadoPadrao() {
  return { xpTotal: 0, resultados: {} };
}

export function carregarProgresso() {
  try {
    const bruto = window.localStorage.getItem(CHAVE_PROGRESSO);
    if (!bruto) return estadoPadrao();
    const dados = JSON.parse(bruto);
    return { ...estadoPadrao(), ...dados, resultados: dados.resultados || {} };
  } catch {
    return estadoPadrao();
  }
}

export function salvarProgresso(progresso) {
  try { window.localStorage.setItem(CHAVE_PROGRESSO, JSON.stringify(progresso)); }
  catch { /* localStorage bloqueado (modo privado) ou cheio — o jogo continua, só não persiste */ }
}

/* Registra o resultado de um caso e soma o XP — mas só da primeira vez: jogar de
   novo um caso já concluído deixa rever o veredito, sem inflar XP nem badge. */
export function registrarCasoConcluido(progresso, { casoId, categoria, acertouHipotese, pistaUsada, perguntaTecnicaCorreta, xpGanho }) {
  const jaConcluido = !!progresso.resultados[casoId];
  const novo = {
    ...progresso,
    xpTotal: progresso.xpTotal + (jaConcluido ? 0 : xpGanho),
    resultados: {
      ...progresso.resultados,
      [casoId]: {
        categoria, acertouHipotese, pistaUsada, perguntaTecnicaCorreta,
        xpGanho: jaConcluido ? progresso.resultados[casoId].xpGanho : xpGanho,
        concluidoEm: jaConcluido ? progresso.resultados[casoId].concluidoEm : new Date().toISOString(),
      },
    },
  };
  salvarProgresso(novo);
  return novo;
}

export const NIVEIS = [
  { nivel: 1, nome: "Olho Atento", xpMin: 0 },
  { nivel: 2, nome: "Investigador FN", xpMin: 30 },
  { nivel: 3, nome: "Inspetor de Pistas", xpMin: 70 },
  { nivel: 4, nome: "Detetive Técnico", xpMin: 110 },
  { nivel: 5, nome: "Mestre do Arquivo FN", xpMin: 150 },
];

export function nivelAtual(xpTotal) {
  let atual = NIVEIS[0];
  for (const n of NIVEIS) if (xpTotal >= n.xpMin) atual = n;
  const proximo = NIVEIS.find((n) => n.xpMin > xpTotal) || null;
  return { ...atual, proximo };
}

function maiorSequenciaDeAcertos(resultados) {
  const ordenados = Object.values(resultados).sort((a, b) => String(a.concluidoEm).localeCompare(String(b.concluidoEm)));
  let maior = 0, atual = 0;
  for (const r of ordenados) { atual = r.acertouHipotese ? atual + 1 : 0; maior = Math.max(maior, atual); }
  return maior;
}

export const BADGES = [
  { chave: "primeira-pista", nome: "Primeira Pista", descricao: "Concluiu o primeiro caso.", criterio: (ctx) => Object.keys(ctx.resultados).length >= 1 },
  { chave: "sem-segunda-pista", nome: "Sem Segunda Pista", descricao: "Resolveu um caso sem pedir a pista extra.", criterio: (ctx) => Object.values(ctx.resultados).some((r) => !r.pistaUsada) },
  { chave: "resposta-afiada", nome: "Resposta Técnica Afiada", descricao: "Acertou a pergunta técnica em 3 casos.", criterio: (ctx) => Object.values(ctx.resultados).filter((r) => r.perguntaTecnicaCorreta).length >= 3 },
  { chave: "olho-clinico", nome: "Olho Clínico", descricao: "Acertou a hipótese em 3 investigações seguidas.", criterio: (ctx) => maiorSequenciaDeAcertos(ctx.resultados) >= 3 },
  { chave: "mestre-arquivo", nome: "Mestre do Arquivo FN", descricao: "Concluiu todos os casos do Arquivo Técnico.", criterio: (ctx) => ctx.totalCasos > 0 && Object.keys(ctx.resultados).length >= ctx.totalCasos },
];

export function calcularBadges(progresso, totalCasos) {
  const ctx = { resultados: progresso.resultados, totalCasos };
  return BADGES.map((b) => ({ ...b, conquistada: b.criterio(ctx) }));
}

export function estatisticas(progresso) {
  const lista = Object.values(progresso.resultados);
  const concluidos = lista.length;
  const acertos = lista.filter((r) => r.acertouHipotese).length;
  const semPista = lista.filter((r) => !r.pistaUsada).length;
  return {
    concluidos,
    taxaAcerto: concluidos ? Math.round((acertos / concluidos) * 100) : 0,
    semPista,
  };
}

export function especialidades(progresso) {
  const porCategoria = {};
  Object.values(progresso.resultados).forEach((r) => {
    if (!porCategoria[r.categoria]) porCategoria[r.categoria] = { acertos: 0, total: 0 };
    porCategoria[r.categoria].total += 1;
    if (r.acertouHipotese) porCategoria[r.categoria].acertos += 1;
  });
  return Object.entries(porCategoria)
    .map(([categoria, v]) => ({ categoria, percentual: Math.round((v.acertos / v.total) * 100) }))
    .sort((a, b) => b.percentual - a.percentual);
}
