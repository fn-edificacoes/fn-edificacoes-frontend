/* ============================================================
   FINANCEIRO — regras de Despesas e Controle Fiscal
   ============================================================
   Só regra, sem tela: categorias, o que conta nos indicadores, saúde documental, limite do
   MEI e os formatos de exportação para a contabilidade. As telas moram no App.jsx, como o
   resto do sistema; aqui fica o que precisa ser igual em todas elas — o total do dashboard,
   o do relatório mensal e o da planilha do contador não podem sair de três contas diferentes.

   Nada aqui toma decisão tributária. O limite do MEI é o que a Gerência configurou, e os
   campos do Simples Nacional (anexo, alíquota, fator R…) são só guardados nesta versão. */

/* ---------- Categorias ---------- */
export const CATEGORIAS_DESPESA = {
  "Deslocamento": ["Combustível", "Pedágio", "Estacionamento", "Aplicativo de transporte", "Passagens", "Hospedagem", "Alimentação em viagem", "Outros deslocamentos"],
  "Operacional": ["Equipamentos de vistoria", "Ferramentas", "EPIs", "Materiais", "Manutenção de equipamentos", "Equipamentos eletrônicos", "Tablet", "Notebook", "Celular", "Câmeras", "Outros"],
  "Administrativo": ["Telefone", "Internet", "Sistema", "Softwares", "Assinaturas", "Domínio", "Hospedagem do site", "Contabilidade", "Serviços bancários", "Material de escritório", "Outros"],
  "Comercial e Marketing": ["Instagram", "Meta Ads", "Google Ads", "Tráfego pago", "Designer", "Social media", "Impressão", "Material gráfico", "Comissão", "Afiliados", "Parceiros", "Outros"],
  "Profissionais e Prestadores": ["Engenheiro", "Arquiteto", "Técnico em edificações", "Vistoriador", "Salário e extras", "Prestador de serviço", "Freelancer", "Consultoria", "Outros"],
  "Tributos e Taxas": ["DAS MEI", "ISS", "Taxas municipais", "TRT", "ART", "RRT", "Taxas de conselho profissional", "Certificados", "Licenças", "Outros"],
};
export const CATEGORIAS = Object.keys(CATEGORIAS_DESPESA);
/* Rótulo curto para os botões grandes do cadastro rápido no celular. */
export const CATEGORIA_CURTA = {
  "Deslocamento": "Deslocamento", "Operacional": "Operacional", "Administrativo": "Administrativo",
  "Comercial e Marketing": "Marketing", "Profissionais e Prestadores": "Prestadores", "Tributos e Taxas": "Tributos",
};
export const FORMAS_PAGAMENTO = ["Pix", "Cartão de crédito", "Cartão de débito", "Dinheiro", "Boleto", "Transferência", "Débito automático", "Outro"];
/* A que a despesa está ligada. "Vistoria" e "Revistoria" apontam para um cadastro de cliente
   (é assim que o sistema identifica um atendimento); os demais podem ficar só no texto. */
export const TIPOS_VINCULO = ["Vistoria", "Revistoria", "Documentação ART/TRT", "Reforma", "Projeto", "Serviço", "Geral da empresa"];
export const FINALIDADES = [
  { valor: "empresarial", rotulo: "Uso 100% empresarial" },
  { valor: "parcial", rotulo: "Uso parcialmente empresarial" },
  { valor: "pessoal", rotulo: "Uso pessoal" },
];
export const STATUS_APROVACAO = ["Aguardando conferência", "Aprovada", "Necessita correção", "Rejeitada"];
export const COR_STATUS_APROVACAO = {
  "Aguardando conferência": { cor: "#B26A00", fundo: "#FFF4E0" },
  "Aprovada": { cor: "#1B7F4B", fundo: "#E6F4EC" },
  "Necessita correção": { cor: "#B85E10", fundo: "#FDEBDD" },
  "Rejeitada": { cor: "#C62828", fundo: "#FDECEC" },
};

/* ---------- Grupos do relatório mensal e da pasta do contador ----------
   O relatório não lista as 60 subcategorias: agrupa no que a FN acompanha mês a mês. A mesma
   função decide a pasta do comprovante no ZIP, para a planilha e a pasta baterem. */
export const GRUPOS_RELATORIO = ["Combustível", "Deslocamentos", "Prestadores", "Marketing", "Sistemas", "Equipamentos", "Administrativo", "Tributos", "Outros"];
const SUB_SISTEMAS = ["Sistema", "Softwares", "Assinaturas", "Domínio", "Hospedagem do site", "Internet", "Telefone"];
export function grupoDoRelatorio(d) {
  const cat = d?.categoria, sub = d?.subcategoria;
  if (cat === "Deslocamento") return sub === "Combustível" ? "Combustível" : "Deslocamentos";
  if (cat === "Profissionais e Prestadores") return "Prestadores";
  if (cat === "Comercial e Marketing") return "Marketing";
  if (cat === "Tributos e Taxas") return "Tributos";
  if (cat === "Administrativo") return SUB_SISTEMAS.includes(sub) ? "Sistemas" : "Administrativo";
  if (cat === "Operacional") return sub === "Outros" || !sub ? "Outros" : "Equipamentos";
  return "Outros";
}

/* ---------- O que entra nos indicadores ----------
   Rejeitada não aconteceu (ou não é da empresa). Pessoal não é da empresa — o pedido é
   explícito: não entra em indicador empresarial nenhum. Parcial entra pela parte empresarial.
   "Aguardando conferência" entra: é gasto real que só não foi conferido ainda, e deixá-lo de
   fora faria o resultado do mês melhorar sozinho sempre que a conferência atrasasse. */
export const contaNosIndicadores = (d) => d && d.statusAprovacao !== "Rejeitada" && d.finalidade !== "pessoal";
export function valorEmpresarial(d) {
  if (!contaNosIndicadores(d)) return 0;
  const v = Number(d.valor) || 0;
  if (d.finalidade === "parcial") {
    const pct = d.percentualEmpresarial == null ? 50 : Number(d.percentualEmpresarial);
    return v * Math.min(100, Math.max(0, pct)) / 100;
  }
  return v;
}
export const somaEmpresarial = (lista) => lista.reduce((s, d) => s + valorEmpresarial(d), 0);

/* ---------- Situação documental de uma despesa ----------
   A ordem é a da gravidade para o contador: sem comprovante nenhum não há o que lançar; sem
   nota há recibo mas não há documento fiscal; nota sem o CNPJ da FN existe mas não é dedutível
   como despesa da empresa. */
export const PENDENCIAS_DOC = {
  semComprovante: "Falta comprovante",
  semNota: "Sem nota fiscal",
  notaSemCnpj: "Nota sem CNPJ da FN",
};
export function pendenciasDocumentais(d) {
  const p = [];
  const temAnexo = (d?.anexos?.length || 0) > 0;
  if (!temAnexo) p.push("semComprovante");
  if (!String(d?.numeroNf || "").trim()) p.push("semNota");
  else if (d?.nfCnpjFn !== true) p.push("notaSemCnpj");
  return p;
}
export function statusDocumental(d) {
  const p = pendenciasDocumentais(d);
  if (!p.length) return { chave: "completo", rotulo: "Documento completo", ok: true };
  return { chave: p[0], rotulo: PENDENCIAS_DOC[p[0]], ok: false, todas: p };
}

/* ---------- Saúde documental ----------
   Cada despesa empresarial vale cinco pontos — um por critério do pedido — e o percentual é
   quantos pontos a base toda cumpre. Assim uma despesa com fornecedor e categoria mas sem
   comprovante conta 3/5, e não "zero" como numa régua de tudo-ou-nada, que esconderia se a
   documentação está melhorando.
   Despesa pessoal fica fora da base: ela não é da empresa, então não é documentação que o
   contador vá cobrar. "Finalidade empresarial" é a despesa dizer para que serviu — ligada a um
   atendimento/empreendimento, ou com descrição. */
export const CRITERIOS_SAUDE = [
  { chave: "documento", rotulo: "Documento anexado", testa: (d) => (d.anexos?.length || 0) > 0 },
  { chave: "fornecedor", rotulo: "Fornecedor identificado", testa: (d) => !!String(d.fornecedor || "").trim() },
  { chave: "cpfCnpj", rotulo: "CPF/CNPJ do fornecedor", testa: (d) => documentoFornecedorValido(d.fornecedorDocumento) },
  { chave: "categoria", rotulo: "Categoria e subcategoria", testa: (d) => !!d.categoria && !!d.subcategoria },
  { chave: "finalidade", rotulo: "Finalidade empresarial descrita", testa: (d) => !!(d.clienteId || String(d.empreendimento || "").trim() || String(d.servicoRelacionado || "").trim() || String(d.descricao || "").trim().length >= 4) },
];
export function saudeDocumental(lista) {
  const base = lista.filter(contaNosIndicadores);
  const porCriterio = CRITERIOS_SAUDE.map((c) => {
    const ok = base.filter(c.testa).length;
    return { ...c, ok, total: base.length, pct: base.length ? (ok / base.length) * 100 : 0 };
  });
  const pontos = porCriterio.reduce((s, c) => s + c.ok, 0);
  const possiveis = base.length * CRITERIOS_SAUDE.length;
  const percentual = possiveis ? (pontos / possiveis) * 100 : null;
  return { percentual, faixa: faixaSaude(percentual), porCriterio, total: base.length };
}
export function faixaSaude(pct) {
  if (pct == null) return { rotulo: "Sem despesas no período", cor: "#65758b", fundo: "#F1F4F8", emoji: "⚪" };
  if (pct >= 90) return { rotulo: "Excelente", cor: "#1B7F4B", fundo: "#E6F4EC", emoji: "🟢" };
  if (pct >= 70) return { rotulo: "Atenção", cor: "#B26A00", fundo: "#FFF4E0", emoji: "🟡" };
  return { rotulo: "Documentação insuficiente", cor: "#C62828", fundo: "#FDECEC", emoji: "🔴" };
}

/* CPF ou CNPJ com os dígitos verificadores certos. Não confere na Receita — pega número
   digitado errado, que é o que faz o contador devolver o lançamento. */
export function documentoFornecedorValido(v) {
  const d = String(v || "").replace(/\D/g, "");
  if (d.length === 11) return cpfOk(d);
  if (d.length === 14) return cnpjOk(d);
  return false;
}
function cpfOk(d) {
  if (/^(\d)\1{10}$/.test(d)) return false;
  const dig = (n) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dig(9) === Number(d[9]) && dig(10) === Number(d[10]);
}
function cnpjOk(d) {
  if (/^(\d)\1{13}$/.test(d)) return false;
  const dig = (n) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = pesos.reduce((acc, p, i) => acc + Number(d[i]) * p, 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dig(12) === Number(d[12]) && dig(13) === Number(d[13]);
}
export function formatarCpfCnpj(v) {
  const d = String(v || "").replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return String(v || "");
}

/* ---------- Deslocamentos ----------
   km e custo por km saem daqui, não do banco, para a regra ficar num lugar só. Viagem sem
   abastecimento (só o registro de km) não tem valor próprio: o custo dela é estimado pela
   média de custo por km do período — e a tela diz que é estimativa. */
export function kmRodados(d) {
  const ini = Number(d?.deslocamento?.kmInicial), fim = Number(d?.deslocamento?.kmFinal);
  return Number.isFinite(ini) && Number.isFinite(fim) && fim > ini ? fim - ini : 0;
}
export function custoMedioPorKm(deslocamentos) {
  let km = 0, valor = 0;
  deslocamentos.forEach((d) => {
    const k = kmRodados(d), v = valorEmpresarial(d);
    if (k > 0 && v > 0) { km += k; valor += v; }
  });
  return km > 0 ? valor / km : 0;
}
export function calculoDeslocamento(d, mediaKm = 0) {
  const km = kmRodados(d);
  const valor = valorEmpresarial(d);
  const estimado = valor === 0 && km > 0 && mediaKm > 0;
  const custoTotal = estimado ? km * mediaKm : valor;
  return { km, custoKm: km > 0 && custoTotal > 0 ? custoTotal / km : 0, custoTotal, estimado };
}
/* Litros, preço por litro e valor: dois deles determinam o terceiro. Devolve só o que dá para
   completar, sem sobrescrever o que a pessoa digitou. */
export function completarAbastecimento({ valor, litros, precoLitro }) {
  const v = num(valor), l = num(litros), p = num(precoLitro);
  if (v && l && !p) return { precoLitro: arred(v / l, 3) };
  if (v && p && !l) return { litros: arred(v / p, 2) };
  if (l && p && !v) return { valor: arred(l * p, 2) };
  return {};
}
const num = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : 0; };
const arred = (n, casas) => Math.round(n * 10 ** casas) / 10 ** casas;
export const ehDeslocamento = (d) => !!d?.deslocamento;

/* ---------- MEI ----------
   R$ 81.000/ano é o teto do MEI em vigor quando este módulo foi escrito. No ano da abertura o
   limite é proporcional: R$ 6.750 por mês, contando o mês da abertura. O valor final é sempre
   o que a Gerência configurou — a regra muda por lei, e o sistema não pode fingir que sabe. */
export const LIMITE_MEI_PADRAO = 81000;
export function limiteProporcionalMei(dataAbertura, ano, limiteAnual = LIMITE_MEI_PADRAO) {
  const m = /^(\d{4})-(\d{2})/.exec(String(dataAbertura || ""));
  if (!m || Number(m[1]) !== Number(ano)) return limiteAnual;
  const meses = 12 - (Number(m[2]) - 1);
  return (limiteAnual / 12) * meses;
}
export function limiteEfetivo(config = {}, ano = new Date().getFullYear()) {
  const base = Number(config.limiteAnual) > 0 ? Number(config.limiteAnual) : LIMITE_MEI_PADRAO;
  return config.limiteProporcional ? limiteProporcionalMei(config.dataAbertura, ano, base) : base;
}
export function situacaoMei(faturamento, limite) {
  const pct = limite > 0 ? (faturamento / limite) * 100 : 0;
  let faixa;
  if (pct > 100) faixa = { rotulo: "Acima do limite", cor: "#C62828", fundo: "#FDECEC", emoji: "🔴" };
  else if (pct > 90) faixa = { rotulo: "Muito perto do limite", cor: "#D35400", fundo: "#FDEBDD", emoji: "🟠" };
  else if (pct > 70) faixa = { rotulo: "Atenção", cor: "#B26A00", fundo: "#FFF4E0", emoji: "🟡" };
  else faixa = { rotulo: "Dentro do limite", cor: "#1B7F4B", fundo: "#E6F4EC", emoji: "🟢" };
  /* Os avisos só dizem onde o número chegou. Decidir o regime é da contabilidade. */
  const alertas = [];
  if (pct >= 100) alertas.push("Atenção: revise o enquadramento tributário da empresa.");
  else if (pct >= 90) alertas.push("Seu faturamento alcançou 90% do limite.");
  else if (pct >= 80) alertas.push("Seu faturamento alcançou 80% do limite configurado para o MEI.");
  return { pct, faixa, alertas, restante: Math.max(0, limite - faturamento) };
}

/* ---------- Resultado ---------- */
export function resultado(receita, despesa) {
  const r = Number(receita) || 0, d = Number(despesa) || 0;
  return { receita: r, despesa: d, resultado: r - d, margem: r > 0 ? ((r - d) / r) * 100 : null };
}

/* ---------- Formatação ---------- */
export const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const pct = (v, casas = 1) => (v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(casas).replace(".", ",")}%`);
export const dataBr = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};
export const MESES_NOMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
export const hojeIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const ultimoDiaDoMes = (ano, mes) => new Date(ano, mes + 1, 0).getDate();
export const noMes = (iso, ano, mes) => String(iso || "").startsWith(`${ano}-${String(mes + 1).padStart(2, "0")}`);
export const noAno = (iso, ano) => String(iso || "").startsWith(`${ano}-`);

/* ============================================================
   EXPORTAÇÃO PARA A CONTABILIDADE
   ============================================================
   Tudo gerado no navegador, sem biblioteca: o sistema não tem dependência de planilha e o
   formato é pequeno o bastante para escrever à mão. CSV com ";" e BOM, porque é o que o Excel
   em português abre sem embaralhar acento e coluna. */
export const COLUNAS_CONTADOR = [
  ["Data", (d) => dataBr(d.data)],
  ["Descrição", (d) => d.descricao],
  ["Fornecedor", (d) => d.fornecedor],
  ["CPF/CNPJ", (d) => formatarCpfCnpj(d.fornecedorDocumento)],
  ["Categoria", (d) => d.categoria],
  ["Subcategoria", (d) => d.subcategoria],
  ["Valor", (d) => Number(d.valor) || 0],
  ["Valor empresarial", (d) => Math.round(valorEmpresarial(d) * 100) / 100],
  ["Finalidade", (d) => (FINALIDADES.find((f) => f.valor === d.finalidade)?.rotulo || "") + (d.finalidade === "parcial" ? ` (${d.percentualEmpresarial ?? 50}%)` : "")],
  ["Forma de pagamento", (d) => d.formaPagamento],
  ["Situação", (d) => d.situacaoPagamento],
  ["Número da NF", (d) => d.numeroNf],
  ["CNPJ da FN na nota", (d) => (d.nfCnpjFn === true ? "Sim" : d.nfCnpjFn === false ? "Não" : "")],
  ["Cliente", (d) => d.clienteNome || ""],
  ["Empreendimento", (d) => d.empreendimento],
  ["Serviço", (d) => [d.vinculoTipo, d.servicoRelacionado].filter(Boolean).join(" — ")],
  ["Comprovantes", (d) => d.anexos?.length || 0],
  ["Conferência", (d) => d.statusAprovacao],
  ["Observação", (d) => d.observacoes],
];

export function gerarCsv(linhas, colunas = COLUNAS_CONTADOR) {
  const esc = (v) => {
    if (typeof v === "number") return String(v).replace(".", ",");
    const s = String(v ?? "");
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const corpo = [colunas.map(([t]) => esc(t)).join(";"), ...linhas.map((l) => colunas.map(([, f]) => esc(f(l))).join(";"))].join("\r\n");
  return new Blob(["﻿" + corpo], { type: "text/csv;charset=utf-8" });
}

/* .xlsx de verdade (Office Open XML), com uma aba e números como número — o contador soma a
   coluna de valor sem converter texto. É um ZIP com cinco XMLs; o ZIP sai do criarZip abaixo. */
export function gerarXlsx(linhas, colunas = COLUNAS_CONTADOR, nomeAba = "Despesas") {
  const xml = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    // Caractere de controle invalida o arquivo inteiro no Excel.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  const letra = (i) => { let s = ""; i += 1; while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; };
  const celula = (v, ref) => (typeof v === "number" && Number.isFinite(v)
    ? `<c r="${ref}"><v>${v}</v></c>`
    : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`);
  const todas = [colunas.map(([t]) => t), ...linhas.map((l) => colunas.map(([, f]) => f(l)))];
  const linhasXml = todas.map((valores, i) => `<row r="${i + 1}">${valores.map((v, j) => celula(v, `${letra(j)}${i + 1}`)).join("")}</row>`).join("");
  const arquivos = [
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(nomeAba).slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`],
    ["xl/worksheets/sheet1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${linhasXml}</sheetData></worksheet>`],
  ];
  const enc = new TextEncoder();
  return criarZip(arquivos.map(([caminho, conteudo]) => ({ caminho, dados: enc.encode(conteudo) })),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

/* ZIP sem compressão ("store"). Comprovante já é PDF/JPEG — comprimir de novo quase não ganha
   nada e exigiria um deflate inteiro aqui dentro. Nomes em UTF-8 (bit 11), senão "Março" e
   "Combustível" chegam embaralhados no Windows. */
const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = TABELA_CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
export function criarZip(arquivos, tipo = "application/zip") {
  const enc = new TextEncoder();
  const partes = [];
  const central = [];
  let deslocamento = 0;
  const agora = new Date();
  const hora = (agora.getHours() << 11) | (agora.getMinutes() << 5) | Math.floor(agora.getSeconds() / 2);
  const dia = ((agora.getFullYear() - 1980) << 9) | ((agora.getMonth() + 1) << 5) | agora.getDate();
  const usados = new Set();
  arquivos.forEach(({ caminho, dados }) => {
    /* Dois arquivos com o mesmo nome na mesma pasta: o segundo ganha um número, senão o
       programa de descompactar pergunta se quer sobrescrever — e o contador perde um. */
    let nomeFinal = caminho.replace(/\\/g, "/");
    for (let i = 2; usados.has(nomeFinal); i++) nomeFinal = caminho.replace(/(\.[^./]+)?$/, (ext) => ` (${i})${ext || ""}`);
    usados.add(nomeFinal);
    const nome = enc.encode(nomeFinal);
    const crc = crc32(dados);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034B50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
    local.setUint16(8, 0, true); local.setUint16(10, hora, true); local.setUint16(12, dia, true);
    local.setUint32(14, crc, true); local.setUint32(18, dados.length, true); local.setUint32(22, dados.length, true);
    local.setUint16(26, nome.length, true); local.setUint16(28, 0, true);
    partes.push(new Uint8Array(local.buffer), nome, dados);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014B50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true); c.setUint16(12, hora, true); c.setUint16(14, dia, true);
    c.setUint32(16, crc, true); c.setUint32(20, dados.length, true); c.setUint32(24, dados.length, true);
    c.setUint16(28, nome.length, true); c.setUint16(30, 0, true); c.setUint16(32, 0, true);
    c.setUint16(34, 0, true); c.setUint16(36, 0, true); c.setUint32(38, 0, true); c.setUint32(42, deslocamento, true);
    central.push(new Uint8Array(c.buffer), nome);
    deslocamento += 30 + nome.length + dados.length;
  });
  const tamanhoCentral = central.reduce((s, p) => s + p.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054B50, true); fim.setUint16(8, arquivos.length, true); fim.setUint16(10, arquivos.length, true);
  fim.setUint32(12, tamanhoCentral, true); fim.setUint32(16, deslocamento, true);
  return new Blob([...partes, ...central, new Uint8Array(fim.buffer)], { type: tipo });
}

/* Caminho de um comprovante dentro do ZIP do contador: ano / mês / grupo / arquivo. */
export function caminhoNoZip(despesa, anexo) {
  const [ano, mes] = String(despesa.data || "").split("-");
  const nomeMes = `${mes} - ${MESES_NOMES[Number(mes) - 1] || mes}`;
  const limpar = (s) => String(s || "").replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim().slice(0, 60);
  const ext = (String(anexo.nomeArquivo || "").match(/\.[a-z0-9]{2,5}$/i)?.[0] || (anexo.mimeType === "application/pdf" ? ".pdf" : ".jpg")).toLowerCase();
  const nome = `${despesa.data} - ${limpar(despesa.fornecedor || despesa.descricao || "despesa")} - ${brl(despesa.valor).replace(/\s/g, " ")}${ext}`;
  return `${ano}/${nomeMes}/${grupoDoRelatorio(despesa)}/${limpar(nome.replace(ext, ""))}${ext}`;
}

export function baixarBlob(blob, nomeArquivo) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nomeArquivo;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
