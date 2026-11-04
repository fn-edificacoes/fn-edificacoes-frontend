/* ============================================================
   FN HOME — IMPORTAR PLANILHA DE PRODUTOS DO MERCADO LIVRE
   ============================================================
   Pedido da Gerência (nov/2026): subir de uma vez uma planilha com 300 itens natalinos. Encaixa no
   topo de AbaProdutosMercadoLivre e usa só as rotas que o cadastro manual já usa
   (POST/PATCH /api/afiliados/mercadolivre e /preencher) — o backend não ganhou nada.

   Só entra quem tem link de afiliado (meli.la, /sec/, /social/) — é ele que paga a comissão, e a
   Gerência pediu (nov/2026) "só o que vai me dar retorno por venda". Linha sem ele (só a página do
   produto, ou link de busca) não é cadastrada nem oculta: fica listada, com o link para abrir e
   gerar o meli.la, e entra quando a planilha for importada de novo com a coluna preenchida.
   Produto já cadastrado sem link de afiliado (à mão) que chega com meli.la na planilha recebe o
   link e vai ao FN Home. O casamento é pelo link gravado ou pelo nome (sem acento nem caixa).

   Foto e preço: os da planilha, se houver; senão o Preencher, que só os dá para produto de
   catálogo (/p/). O servidor limita o Preencher a 60 por 10 minutos — no 429 a importação espera
   e continua, em vez de gravar o resto sem foto.

   XLSX sem biblioteca: o arquivo é um zip de XMLs, e o navegador já descompacta (DecompressionStream).
   Lê a primeira aba que tiver cabeçalho de nome e link — a planilha da FN começa por "Como usar". */
import React, { useRef, useState } from "react";
import { FileSpreadsheet, Loader2, X, ExternalLink, Check, AlertTriangle, Search } from "lucide-react";

const AZUL_MEDIO = "#2C75B5";
const AZUL_MARINHO = "#12335B";
const CINZA_CLARO = "#F1F4F8";
const CINZA_BORDA = "#D8DEE7";
const VERDE = "#2E7D32";
const VERMELHO = "#C62828";
const AMBAR = "#B26A00";

const btn = { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "none", background: AZUL_MEDIO, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };
const btnLeve = { ...btn, background: "#fff", color: AZUL_MARINHO, border: `1px solid ${CINZA_BORDA}` };
const inp = { padding: "7px 9px", border: `1px solid ${CINZA_BORDA}`, borderRadius: 8, fontSize: 13, background: "#fff", fontFamily: "inherit" };

const MAX_TITULO = 200; // o do servidor
const MAX_CATEGORIA = 60;

export const normalizar = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- Classificação de link ---------------- */
function urlDe(texto) {
  try {
    const u = new URL(String(texto || "").trim());
    return u.protocol === "https:" ? u : null;
  } catch { return null; }
}
const doMercadoLivre = (u) => Boolean(u) && /(^|\.)(mercadolivre\.com(\.br)?|mercadolibre\.com|meli\.la)$/i.test(u.hostname);
export function ehLinkDeAfiliado(texto) {
  const u = urlDe(texto);
  return doMercadoLivre(u) && (/(^|\.)meli\.la$/i.test(u.hostname) || /^\/(sec|social)\//i.test(u.pathname));
}
const ehBusca = (u) => /^lista\./i.test(u.hostname) || /^\/jm\/search/i.test(u.pathname);
const ehCatalogo = (u) => /\/p\/MLB\d+/i.test(u.pathname);

function precoDaPlanilha(v) {
  const t = String(v ?? "").replace(/R\$\s*/i, "").trim();
  if (!t) return null;
  // "1.299,90" (como se digita) ou "1299.9" (como o Excel guarda).
  const n = Number(/,/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) && n > 0 && n <= 1e7 ? Math.round(n * 100) / 100 : null;
}

/* ---------------- Leitura do arquivo ---------------- */
function lerCsv(texto) {
  const t = texto.replace(/^﻿/, "");
  const primeira = t.split(/\r?\n/, 1)[0] || "";
  const sep = [";", "\t", ","].reduce((a, b) => (primeira.split(b).length > primeira.split(a).length ? b : a));
  const linhas = [];
  let linha = [], campo = "", aspas = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (aspas) {
      if (ch === '"' && t[i + 1] === '"') { campo += '"'; i++; } else if (ch === '"') aspas = false; else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) { linha.push(campo); campo = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo); linhas.push(linha); linha = []; campo = "";
    } else campo += ch;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return [linhas.filter((l) => l.some((c) => c.trim()))];
}

async function arquivosDoZip(buffer) {
  const dv = new DataView(buffer);
  let fim = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 66000); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { fim = i; break; }
  }
  if (fim < 0) throw new Error("O arquivo não parece um .xlsx válido.");
  const total = dv.getUint16(fim + 10, true);
  let p = dv.getUint32(fim + 16, true);
  const nomes = new TextDecoder();
  const entradas = {};
  for (let k = 0; k < total; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const metodo = dv.getUint16(p + 10, true);
    const tamanho = dv.getUint32(p + 20, true);
    const n = dv.getUint16(p + 28, true), e = dv.getUint16(p + 30, true), c = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const nome = nomes.decode(new Uint8Array(buffer, p + 46, n));
    entradas[nome] = { metodo, tamanho, local };
    p += 46 + n + e + c;
  }
  const ler = async (nome) => {
    const en = entradas[nome];
    if (!en) return null;
    const inicio = en.local + 30 + dv.getUint16(en.local + 26, true) + dv.getUint16(en.local + 28, true);
    const bytes = new Uint8Array(buffer, inicio, en.tamanho);
    if (en.metodo === 0) return new TextDecoder().decode(bytes);
    if (en.metodo !== 8 || typeof DecompressionStream === "undefined") {
      throw new Error("Este navegador não abre .xlsx. Salve a planilha como CSV e envie o CSV.");
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Response(stream).text();
  };
  return { nomes: Object.keys(entradas), ler };
}

const xml = (texto) => new DOMParser().parseFromString(texto, "application/xml");
const textoDe = (el) => [...el.getElementsByTagName("t")].map((t) => t.textContent).join("");
const colunaDe = (ref) => [...String(ref).replace(/\d+/g, "").toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

async function lerXlsx(buffer) {
  const zip = await arquivosDoZip(buffer);
  const compartilhadas = await zip.ler("xl/sharedStrings.xml");
  const textos = compartilhadas ? [...xml(compartilhadas).getElementsByTagName("si")].map(textoDe) : [];
  // As abas na ordem do workbook (sheet1.xml nem sempre é a primeira).
  const wb = xml((await zip.ler("xl/workbook.xml")) || "<w/>");
  const relsWb = xml((await zip.ler("xl/_rels/workbook.xml.rels")) || "<r/>");
  const alvo = {};
  for (const r of relsWb.getElementsByTagName("Relationship")) alvo[r.getAttribute("Id")] = r.getAttribute("Target");
  let caminhos = [...wb.getElementsByTagName("sheet")]
    .map((s) => alvo[s.getAttribute("r:id")] || alvo[s.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id")])
    .filter(Boolean).map((t) => (t.startsWith("/") ? t.slice(1) : `xl/${t}`));
  if (!caminhos.length) caminhos = zip.nomes.filter((n) => /^xl\/worksheets\/[^/]+\.xml$/.test(n)).sort();

  const abas = [];
  for (const caminho of caminhos) {
    const doc = xml((await zip.ler(caminho)) || "<w/>");
    // Célula com hiperlink cujo texto não é o endereço ("abrir"): vale o destino do link.
    const pasta = caminho.replace(/[^/]+$/, "");
    const rels = await zip.ler(`${pasta}_rels/${caminho.split("/").pop()}.rels`);
    const destinos = {};
    if (rels) for (const r of xml(rels).getElementsByTagName("Relationship")) destinos[r.getAttribute("Id")] = r.getAttribute("Target");
    const links = {};
    for (const h of doc.getElementsByTagName("hyperlink")) {
      const id = h.getAttribute("r:id") || h.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
      if (destinos[id]) links[h.getAttribute("ref")] = destinos[id];
    }
    const linhas = [];
    for (const row of doc.getElementsByTagName("row")) {
      const linha = [];
      for (const c of row.getElementsByTagName("c")) {
        const ref = c.getAttribute("r");
        const tipo = c.getAttribute("t");
        const v = c.getElementsByTagName("v")[0]?.textContent ?? "";
        let valor = tipo === "s" ? (textos[Number(v)] ?? "") : tipo === "inlineStr" ? textoDe(c) : v;
        if (links[ref] && !/^https?:\/\//i.test(String(valor).trim())) valor = links[ref];
        linha[colunaDe(ref)] = String(valor);
      }
      linhas.push(Array.from(linha, (x) => x ?? ""));
    }
    abas.push(linhas.filter((l) => l.some((c) => c.trim())));
  }
  return abas;
}

/* ---------------- Cabeçalho → campos ---------------- */
// Ordem importa: "nome do produto na loja" vence "item do catálogo".
const COLUNAS = {
  nome: [/^nome do produto/, /^nome$/, /^produto$/, /^titulo/, /^item do catalogo/, /^item$/],
  afiliado: [/afiliad/, /meli\.?la/],
  pagina: [/link do anuncio/, /pagina do produto/, /^anuncio/, /^link$/, /^url$/, /mercado ?livre/],
  categoria: [/^categoria$/],
  subcategoria: [/^subcategoria/],
  preco: [/^preco/, /^valor/],
  foto: [/^imagem/, /^foto/],
  tipo: [/^tipo de link/],
};
function mapearCabecalho(cab) {
  const n = cab.map(normalizar);
  const usados = new Set();
  const mapa = {};
  for (const [campo, regras] of Object.entries(COLUNAS)) {
    for (const re of regras) {
      const i = n.findIndex((h, j) => !usados.has(j) && re.test(h));
      if (i >= 0) { mapa[campo] = i; usados.add(i); break; }
    }
  }
  return mapa;
}

/* Primeira aba, e primeira linha das 5 de cima, com nome e algum link no cabeçalho. */
function acharTabela(abas) {
  for (const linhas of abas) {
    for (let h = 0; h < Math.min(5, linhas.length); h++) {
      const mapa = mapearCabecalho(linhas[h]);
      if (mapa.nome != null && (mapa.pagina != null || mapa.afiliado != null)) {
        return { mapa, cabecalho: linhas[h], linhas: linhas.slice(h + 1) };
      }
    }
  }
  return null;
}

/* Cada linha vira { situacao, ... }:
   novo-ativo | ativar (já cadastrado sem afiliado, agora com ele) | ja-existe | sem-afiliado | invalido */
function planejar(tabela, cadastrados, origemCategoria) {
  const { mapa, linhas } = tabela;
  const pegar = (l, campo) => (mapa[campo] != null ? String(l[mapa[campo]] ?? "").trim() : "");
  const porLink = new Map(), porNome = new Map();
  for (const p of cadastrados) {
    if (p.link) porLink.set(p.link.trim(), p);
    porNome.set(normalizar(p.titulo), p);
  }
  const vistos = new Set();
  return linhas.map((l, i) => {
    const titulo = pegar(l, "nome").slice(0, MAX_TITULO);
    const paginaTxt = pegar(l, "pagina");
    const afiliadoTxt = pegar(l, "afiliado");
    const categoria = (origemCategoria === "subcategoria" ? pegar(l, "subcategoria") || pegar(l, "categoria") : pegar(l, "categoria") || pegar(l, "subcategoria")).slice(0, MAX_CATEGORIA);
    const fotoTxt = pegar(l, "foto");
    const item = {
      n: i + 1, titulo, categoria,
      pagina: paginaTxt,
      afiliado: ehLinkDeAfiliado(afiliadoTxt) ? urlDe(afiliadoTxt).toString() : "",
      afiliadoInvalido: Boolean(afiliadoTxt) && !ehLinkDeAfiliado(afiliadoTxt),
      preco: precoDaPlanilha(pegar(l, "preco")),
      foto: /^https:\/\/\S+$/i.test(fotoTxt) && !doMercadoLivre(urlDe(fotoTxt)) ? fotoTxt : "",
    };
    if (!titulo) return { ...item, situacao: "invalido", motivo: "Sem nome do produto." };
    const chave = normalizar(titulo);
    if (vistos.has(chave)) return { ...item, situacao: "invalido", motivo: "Nome repetido na planilha." };
    vistos.add(chave);

    const u = urlDe(paginaTxt);
    const pagina = doMercadoLivre(u) && !ehLinkDeAfiliado(paginaTxt) ? u.toString() : "";
    item.pagina = pagina;
    item.catalogo = Boolean(pagina) && ehCatalogo(u);
    item.busca = Boolean(pagina) && (ehBusca(u) || normalizar(pegar(l, "tipo")) === "busca");

    const existente = (item.afiliado && porLink.get(item.afiliado)) || (pagina && porLink.get(pagina)) || porNome.get(chave);
    if (existente) {
      if (item.afiliado && !ehLinkDeAfiliado(existente.link)) return { ...item, situacao: "ativar", existente };
      return { ...item, situacao: "ja-existe", existente };
    }
    if (item.afiliado) return { ...item, situacao: "novo-ativo" };
    return { ...item, situacao: "sem-afiliado" };
  });
}

const ROTULO = {
  "novo-ativo": { texto: "Entram no FN Home", cor: VERDE, dica: "Têm link de afiliado: pagam comissão." },
  "ativar": { texto: "Já cadastrados sem link de afiliado — recebem o link e entram no FN Home", cor: VERDE },
  "sem-afiliado": { texto: "Não entram: sem link de afiliado", cor: VERMELHO, dica: "Não pagariam comissão. Gere o meli.la no portal de afiliados e importe de novo." },
  "ja-existe": { texto: "Já cadastrados (ficam como estão)", cor: "#65758b" },
  "invalido": { texto: "Com problema", cor: VERMELHO },
};

/* ---------------- Tela ---------------- */
export default function ImportarPlanilhaMercadoLivre({ token, apiFetch, notify, cadastrados, aoTerminar }) {
  const [aberto, setAberto] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [arquivo, setArquivo] = useState(null); // { nome, tabela }
  const [origemCategoria, setOrigemCategoria] = useState("categoria");
  const [progresso, setProgresso] = useState(null); // { feito, total, espera, erros: [] }
  const [resultado, setResultado] = useState(null);
  const [verGrupo, setVerGrupo] = useState(null);
  const parar = useRef(false);

  const plano = arquivo ? planejar(arquivo.tabela, cadastrados || [], origemCategoria) : [];
  const grupos = plano.reduce((g, it) => ({ ...g, [it.situacao]: [...(g[it.situacao] || []), it] }), {});
  const aGravar = plano.filter((it) => ["novo-ativo", "ativar"].includes(it.situacao));
  const afiliadosRuins = plano.filter((it) => it.afiliadoInvalido).length;

  const fechar = () => { setAberto(false); setArquivo(null); setResultado(null); setProgresso(null); setVerGrupo(null); };

  const onArquivo = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setLendo(true); setResultado(null); setVerGrupo(null);
    try {
      const abas = /\.xlsx$/i.test(f.name) ? await lerXlsx(await f.arrayBuffer())
        : /\.(csv|txt|tsv)$/i.test(f.name) ? lerCsv(await f.text())
          : (() => { throw new Error("Envie a planilha em .xlsx ou .csv."); })();
      const tabela = acharTabela(abas);
      if (!tabela) throw new Error("Não achei as colunas de nome do produto e link do Mercado Livre no cabeçalho.");
      setArquivo({ nome: f.name, tabela });
    } catch (err) { notify(err.message || "Não consegui ler a planilha."); setArquivo(null); }
    setLendo(false);
  };

  /* O Preencher para foto e preço. 429 = limite do servidor: espera e tenta de novo. */
  const preencher = async (pagina) => {
    for (let tentativa = 0; tentativa < 12; tentativa++) {
      if (parar.current) return null;
      try {
        return await apiFetch("/api/afiliados/mercadolivre/preencher", { method: "POST", token, body: { link: pagina } });
      } catch (e) {
        if (e.status !== 429) return null;
        for (let s = 60; s > 0 && !parar.current; s--) {
          setProgresso((p) => ({ ...p, espera: s }));
          await espera(1000);
        }
        setProgresso((p) => ({ ...p, espera: 0 }));
      }
    }
    return null;
  };

  const importar = async () => {
    parar.current = false;
    const erros = [];
    let criados = 0, ativados = 0;
    setProgresso({ feito: 0, total: aGravar.length, espera: 0, erros });
    for (let i = 0; i < aGravar.length; i++) {
      if (parar.current) break;
      const it = aGravar[i];
      try {
        if (it.situacao === "ativar") {
          await apiFetch(`/api/afiliados/mercadolivre/${encodeURIComponent(it.existente.id)}`, { method: "PATCH", token, body: { link: it.afiliado, ativo: true } });
          ativados++;
        } else {
          const corpo = { titulo: it.titulo, categoria: it.categoria, link: it.afiliado, ativo: true };
          if (it.preco != null) corpo.preco = it.preco;
          if (it.foto) corpo.foto = it.foto;
          if (it.catalogo && (!it.foto || it.preco == null)) {
            const r = await preencher(it.pagina);
            if (r) {
              if (!corpo.foto && /^https:\/\//i.test(r.foto || "")) corpo.foto = r.foto;
              if (corpo.preco == null && r.preco != null) {
                corpo.preco = r.preco;
                if (r.preco_de != null && Number(r.preco_de) > Number(r.preco)) corpo.preco_de = r.preco_de;
              }
              if (r.categoriaMl) corpo.categoria_ml = r.categoriaMl;
            }
          }
          await apiFetch("/api/afiliados/mercadolivre", { method: "POST", token, body: corpo });
          criados++;
        }
      } catch (e) { erros.push({ titulo: it.titulo, motivo: e.message }); }
      setProgresso({ feito: i + 1, total: aGravar.length, espera: 0, erros });
    }
    setResultado({ criados, ativados, erros, parou: parar.current });
    setProgresso(null);
    setArquivo(null);
    notify(`Importação ${parar.current ? "interrompida" : "concluída"}: ${criados} cadastrados, ${ativados} postos no FN Home ✓`);
    await aoTerminar?.();
  };

  if (!aberto) {
    return (
      <button type="button" style={btnLeve} onClick={() => setAberto(true)}><FileSpreadsheet size={14} /> Importar planilha</button>
    );
  }

  const Grupo = ({ chave }) => {
    const itens = grupos[chave] || [];
    if (!itens.length) return null;
    const r = ROTULO[chave];
    const vendo = verGrupo === chave;
    return (
      <div style={{ border: `1px solid ${CINZA_BORDA}`, borderLeft: `4px solid ${r.cor}`, borderRadius: 8, padding: "8px 10px" }}>
        <button type="button" onClick={() => setVerGrupo(vendo ? null : chave)}
          style={{ all: "unset", cursor: "pointer", display: "flex", gap: 8, alignItems: "baseline", width: "100%", flexWrap: "wrap" }}>
          <strong style={{ color: r.cor, fontSize: 18, minWidth: 34 }}>{itens.length}</strong>
          <span style={{ fontSize: 13, color: "#1a2330", flex: 1 }}>{r.texto}{r.dica ? <span style={{ color: "#65758b" }}> — {r.dica}</span> : null}</span>
          <span style={{ fontSize: 12, color: AZUL_MEDIO }}>{vendo ? "esconder" : "ver"}</span>
        </button>
        {vendo && (
          <ul style={{ margin: "8px 0 0", padding: "0 0 0 18px", maxHeight: 260, overflow: "auto", fontSize: 12.5, lineHeight: 1.6 }}>
            {itens.map((it) => (
              <li key={it.n} style={{ overflowWrap: "anywhere" }}>
                {it.titulo || <em>(sem nome)</em>}
                {it.motivo && <span style={{ color: VERMELHO }}> — {it.motivo}</span>}
                {chave === "sem-afiliado" && it.pagina && (
                  <a href={it.pagina} target="_blank" rel="noreferrer" style={{ marginLeft: 6, color: AZUL_MEDIO }}>
                    {it.busca ? <><Search size={11} style={{ verticalAlign: "-1px" }} /> abrir a busca</> : <><ExternalLink size={11} style={{ verticalAlign: "-1px" }} /> abrir o produto</>}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div style={{ flex: "1 1 100%", border: `1px solid ${AZUL_MEDIO}`, borderRadius: 12, padding: 14, background: "#F7FAFE", display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <FileSpreadsheet size={16} color={AZUL_MEDIO} />
        <strong style={{ fontSize: 14, color: AZUL_MARINHO, flex: 1 }}>Importar planilha de produtos</strong>
        {!progresso && <button type="button" style={{ ...btnLeve, padding: "5px 9px" }} onClick={fechar}><X size={14} /> Fechar</button>}
      </div>
      <p style={{ margin: 0, fontSize: 12.5, color: "#4a5a70", lineHeight: 1.5 }}>
        Planilha em .xlsx ou .csv com uma linha por produto e, no cabeçalho, o <strong>nome do produto</strong>, o <strong>link do
        anúncio</strong> e a coluna <strong>link de afiliado (meli.la)</strong>; categoria, preço e imagem são opcionais.
        <strong>Só entra quem tem o link de afiliado</strong> — é ele que paga a comissão. Linha sem ele não é cadastrada:
        gere os meli.la no portal de afiliados, preencha a coluna e importe a mesma planilha de novo.
      </p>

      {!arquivo && !progresso && (
        <label style={{ ...btn, cursor: lendo ? "wait" : "pointer", justifySelf: "start", opacity: lendo ? 0.6 : 1 }}>
          {lendo ? <Loader2 size={14} className="spin" /> : <FileSpreadsheet size={14} />} Escolher a planilha
          <input type="file" accept=".xlsx,.csv,.tsv,.txt" onChange={onArquivo} disabled={lendo} style={{ display: "none" }} />
        </label>
      )}

      {arquivo && !progresso && (
        <>
          <div style={{ fontSize: 12.5, color: "#4a5a70", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span><strong>{arquivo.nome}</strong> · {plano.length} linhas</span>
            {arquivo.tabela.mapa.subcategoria != null && arquivo.tabela.mapa.categoria != null && (
              <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                Filtro na vitrine:
                <select style={inp} value={origemCategoria} onChange={(e) => setOrigemCategoria(e.target.value)}>
                  <option value="categoria">a Categoria (um filtro só)</option>
                  <option value="subcategoria">a Subcategoria (um filtro para cada)</option>
                </select>
              </label>
            )}
          </div>
          {afiliadosRuins > 0 && (
            <div style={{ fontSize: 12.5, color: AMBAR, background: "#FFF4E0", borderRadius: 6, padding: "6px 8px", display: "flex", gap: 6 }}>
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              {afiliadosRuins} {afiliadosRuins === 1 ? "linha tem" : "linhas têm"} algo na coluna de afiliado que não é link de afiliado
              (meli.la, mercadolivre.com/sec/ ou /social/) — {afiliadosRuins === 1 ? "foi tratada" : "foram tratadas"} como sem link.
            </div>
          )}
          <div style={{ display: "grid", gap: 6 }}>
            {aGravar.length === 0 && (
              <div style={{ fontSize: 12.5, color: VERMELHO, background: "#FDECEC", borderRadius: 6, padding: "6px 8px", lineHeight: 1.45 }}>
                Nenhuma linha desta planilha tem link de afiliado, então nada vai ser cadastrado. Gere os links no{" "}
                <a href="https://afiliados.mercadolivre.com.br" target="_blank" rel="noreferrer" style={{ color: AZUL_MEDIO }}>portal de afiliados</a>,
                cole na coluna "Link de afiliado" e envie a planilha de novo.
              </div>
            )}
            {["novo-ativo", "ativar", "sem-afiliado", "ja-existe", "invalido"].map((k) => <Grupo key={k} chave={k} />)}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button type="button" style={btnLeve} onClick={() => setArquivo(null)}>Outra planilha</button>
            <button type="button" style={{ ...btn, opacity: aGravar.length ? 1 : 0.5 }} disabled={!aGravar.length} onClick={importar}>
              <Check size={14} /> Importar {aGravar.length} {aGravar.length === 1 ? "produto" : "produtos"}
            </button>
          </div>
        </>
      )}

      {progresso && (
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ height: 8, background: CINZA_CLARO, borderRadius: 99, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progresso.total ? (progresso.feito / progresso.total) * 100 : 0}%`, background: AZUL_MEDIO, transition: "width .2s" }} />
          </div>
          <div style={{ fontSize: 12.5, color: "#4a5a70", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Loader2 size={13} className="spin" /> {progresso.feito} de {progresso.total}
            {progresso.espera > 0 && <span style={{ color: AMBAR }}>· o Mercado Livre limita as buscas de foto e preço — continuo em {progresso.espera}s</span>}
            {progresso.erros.length > 0 && <span style={{ color: VERMELHO }}>· {progresso.erros.length} com erro</span>}
            <button type="button" style={{ ...btnLeve, padding: "4px 9px", marginLeft: "auto" }} onClick={() => { parar.current = true; }}>Parar</button>
          </div>
          <span style={{ fontSize: 12, color: "#8593a8" }}>Não feche esta tela até terminar.</span>
        </div>
      )}

      {resultado && (
        <div style={{ fontSize: 13, lineHeight: 1.55, background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ color: VERDE, fontWeight: 600 }}>
            {resultado.parou ? "Importação interrompida. " : "Importação concluída. "}
            {resultado.criados} {resultado.criados === 1 ? "produto cadastrado" : "produtos cadastrados"} no FN Home
            {resultado.ativados > 0 ? ` · ${resultado.ativados} postos no FN Home` : ""}.
          </div>
          {resultado.erros.length > 0 && (
            <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: VERMELHO, fontSize: 12.5 }}>
              {resultado.erros.map((e, i) => <li key={i}>{e.titulo}: {e.motivo}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
