// patologias-consulta.js — leitura do banco de patologias por ambiente.
//
// Separado de patologias-ambiente.js de propósito: aquele arquivo é gerado da planilha e
// sobrescrito a cada geração; este é escrito à mão e sobrevive.

import { AMBIENTES, PATOLOGIAS, AMBIENTE_PATOLOGIAS } from "./patologias-ambiente.js";

/* Índice ambiente -> ids específicos, montado uma vez. Sem ele, cada troca de ambiente
   varreria os 187 vínculos de novo. */
const IDS_POR_AMBIENTE = AMBIENTE_PATOLOGIAS.reduce((mapa, v) => {
  (mapa[v.ambiente] ||= new Set()).add(v.patologiaId);
  return mapa;
}, {});

const POR_ID = new Map(PATOLOGIAS.map((p) => [p.id, p]));

export function listarAmbientes() {
  return AMBIENTES.map((a) => ({
    ...a,
    /* Quantas o técnico vai ver ao abrir: as do ambiente mais as que valem em todo lugar. */
    total: (IDS_POR_AMBIENTE[a.slug]?.size || 0) + PATOLOGIAS.filter((p) => p.aplicaTodosAmbientes).length,
  }));
}

/* Checklist de um ambiente: as específicas dele MAIS as genéricas, sem repetir.
   As genéricas não têm vínculo gravado — 49 × 13 linhas seriam o mesmo fato repetido — então
   é aqui que elas entram. Quem tem escopo de unidade inteira nunca aparece por ambiente. */
export function getPatologiasPorAmbiente(slug) {
  const especificas = IDS_POR_AMBIENTE[slug] || new Set();
  return PATOLOGIAS
    .filter((p) => !p.escopoUnidadeInteira && (p.aplicaTodosAmbientes || especificas.has(p.id)))
    .map((p) => ({ ...p, especificaDoAmbiente: especificas.has(p.id) }))
    /* Específicas primeiro: são as que aquele cômodo realmente cobra. Depois por gravidade,
       e o desempate por id mantém a ordem da planilha. */
    .sort((a, b) => {
      if (a.especificaDoAmbiente !== b.especificaDoAmbiente) return a.especificaDoAmbiente ? -1 : 1;
      const peso = { Alta: 0, "Média": 1, Baixa: 2 };
      if (peso[a.severidade] !== peso[b.severidade]) return peso[a.severidade] - peso[b.severidade];
      return a.id - b.id;
    });
}

/* Checagens da unidade como um todo (manual do proprietário, pé-direito, medidores). Não
   pertencem a cômodo nenhum, então têm lista própria. */
export function getPatologiasUnidadeInteira() {
  return PATOLOGIAS.filter((p) => p.escopoUnidadeInteira);
}

export function getPatologia(id) {
  return POR_ID.get(Number(id)) || null;
}

/* Converte uma patologia do banco nos campos que o item do laudo espera. O texto vira o que
   o laudo exige: "Verifica-se..." descreve o observado, "Recomenda-se..." a correção. */
export function paraItemDeLaudo(patologia, nomeDoAmbiente) {
  const norma = [patologia.norma, patologia.normasComplementares].filter(Boolean).join("; ");
  return {
    local: nomeDoAmbiente || "",
    tipo: `bp-${patologia.id}`,
    patologia: patologia.nome,
    titulo: patologia.nome,
    categoria: patologia.sistema || "",
    norma,
    severidade: patologia.severidade,
    descricao: patologia.manifestacao ? `Verifica-se ${primeiraMinuscula(patologia.manifestacao)}` : "",
    recomendacao: patologia.acaoRecomendada ? `Recomenda-se ${primeiraMinuscula(patologia.acaoRecomendada)}` : "",
  };
}

/* "Manual não entregue..." -> "manual não entregue...", para encaixar depois de
   "Verifica-se". Siglas ficam como estão: "ABNT" não pode virar "aBNT". */
function primeiraMinuscula(texto) {
  const t = String(texto || "").trim();
  if (!t) return "";
  const primeira = t.split(/\s+/)[0];
  if (primeira.length > 1 && primeira === primeira.toUpperCase()) return t;
  return t[0].toLowerCase() + t.slice(1);
}
