/* ============================================================
   FN HOME — PRODUTOS DO MERCADO LIVRE (link de afiliado da FN)
   ============================================================
   Dois pedaços, os dois falando só com /api/afiliados/mercadolivre* (src/afiliados-mercadolivre.js
   no backend):
     - AbaProdutosMercadoLivre: Gerência → FN Home · Mercado Livre. Cadastra o produto com o link
       que o portal de afiliados do Mercado Livre gerou, a foto e o preço conferido no dia.
     - SecaoOfertasMercadoLivre: a grade que aparece no FN Home (página pública e portal do
       cliente), dentro da vitrine de parceiros.

   A FN não vende nada aqui: o cliente compra no Mercado Livre e a comissão aparece no painel de
   afiliados de lá. O sistema só conta os cliques no botão. O link de afiliado sai só do portal
   (o Mercado Livre não tem API para isso); o resto a tela adianta de dois jeitos:
     - pelo endereço da página do produto (/preencher no backend): nome e categoria sempre, foto
       e preço só de produto de catálogo (/p/), com o aplicativo da FN configurado no servidor;
     - pelo botão "Enviar ao FN Home", um favorito do Chrome que lê a página aberta (ver
       lerPaginaParaOFnHome): foto e preço de qualquer anúncio;
     - pelo "Colar do Mercado Livre", o caminho do celular: lê o que o Compartilhar do app copiou e
       manda cada pedaço para o campo certo (ver lerTextoDoMercadoLivre).
   A Gerência confere e salva — e o preço vem sempre com a data em que foi conferido.

   Arquivo à parte como a Rede Nacional: o App.jsx só o encaixa e entrega o apiFetch. */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ShoppingBag, ExternalLink, Plus, Pencil, Trash2, RefreshCcw, Loader2, X, Search, Upload, CalendarCheck, Eye, EyeOff, MousePointerClick, Sparkles, Bookmark, Check, ClipboardPaste, CircleCheck, Circle } from "lucide-react";

const AZUL_MEDIO = "#2C75B5";
const AZUL_MARINHO = "#12335B";
const CINZA_CLARO = "#F1F4F8";
const CINZA_BORDA = "#D8DEE7";
const VERDE = "#2E7D32";
const VERMELHO = "#C62828";
const AMBAR = "#B26A00";

const lab = { fontSize: 12, fontWeight: 600, color: "#5a6a80" };
const inp = { padding: "8px 10px", border: `1px solid ${CINZA_BORDA}`, borderRadius: 8, fontSize: 13.5, outline: "none", background: "#fff", fontFamily: "inherit", minWidth: 0, width: "100%", boxSizing: "border-box" };
const btn = { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "none", background: AZUL_MEDIO, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };
const btnLeve = { ...btn, background: "#fff", color: AZUL_MARINHO, border: `1px solid ${CINZA_BORDA}` };
const secao = { background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 14, padding: 18, minWidth: 0 };

/* Preço parado há mais que isso pede nova conferência na lista da Gerência. Preço de Mercado
   Livre muda com frequência; duas semanas é o que ainda dá para mostrar sem constranger. */
const DIAS_PRECO_VELHO = 14;
const PORTAL_AFILIADOS = "https://afiliados.mercadolivre.com.br";

const fmtReal = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDia = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "");
const diasDesde = (iso) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null);
const desconto = (p) => (p.preco_de && p.preco && Number(p.preco_de) > Number(p.preco)
  ? Math.round((1 - Number(p.preco) / Number(p.preco_de)) * 100) : null);

/* O link que dá comissão é o que o portal de afiliados gera (mercadolivre.com/sec/…, ou o
   encurtador meli.la). Um link copiado da barra do navegador na página do produto abre o mesmo
   produto e não paga nada — o erro mais fácil de cometer aqui, e invisível depois. Só avisa: se
   o Mercado Livre mudar o formato do link, o cadastro não pode travar. */
function pareceLinkDeAfiliado(link) {
  try {
    const u = new URL(link);
    return u.hostname.endsWith("meli.la") || /^\/(sec|social)\//.test(u.pathname);
  } catch { return true; }
}
function ehLinkCurto(texto) {
  try {
    const u = new URL(String(texto || "").trim());
    return u.hostname.endsWith("meli.la") || /^\/(sec|social)\//.test(u.pathname);
  } catch { return false; }
}

/* Endereço de página do Mercado Livre (não de imagem do mlstatic) — é o que o Preencher lê. Serve
   também para notar a página colada no campo da foto, que na vitrine vira imagem quebrada. */
function ehPaginaDoMercadoLivre(texto) {
  try {
    const u = new URL(String(texto || "").trim());
    return u.protocol === "https:" && /(^|\.)(mercadolivre\.com(\.br)?|mercadolibre\.com)$/i.test(u.hostname);
  } catch { return false; }
}

/* ---------------- "Colar do Mercado Livre" (o caminho do celular) ----------------
   No celular não existe o favorito arrastável: o que se tem é o "Compartilhar" do app do Mercado
   Livre, que para afiliado dá o link de afiliado (meli.la) e o código do produto (MLB…), e para
   todo mundo dá o endereço da página. O texto que vem junto muda conforme a versão do app, então
   nada aqui depende do formato: cada pedaço reconhecível vai para o seu campo, e o resto é tentado
   como nome (e "R$ …" como preço). Pedido da Gerência em 31/10/2026: cadastrar pelo celular. */
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;
// Com \b: "Folha", "escolha" e "molhe" não são convite.
const CONVITE = /(mercado\s*livre|mercadolivre|\b(olh[ae]|veja|confira|encontrei|achei)\b|\bcompartilh|\brecomend)/i;
const semAcentoMin = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function precoDoTexto(trecho) {
  const m = trecho.match(/^R\$\s*(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?/);
  return m ? Number(`${m[1].replace(/\./g, "")}.${(m[2] || "0").padEnd(2, "0")}`) : null;
}
function lerTextoDoMercadoLivre(texto) {
  const bruto = String(texto || "").slice(0, 4000);
  const urls = (bruto.match(/https?:\/\/[^\s<>"']+/gi) || []).map((u) => u.replace(/[).,;:!?\]]+$/, ""));
  let link = "";
  let pagina = "";
  for (const u of urls) {
    if (ehLinkCurto(u)) { if (!link) link = u; } else if (ehPaginaDoMercadoLivre(u) && !pagina) pagina = u;
  }
  let resto = bruto;
  for (const u of urls) resto = resto.split(u).join(" ");
  const cod = resto.match(/\bMLB(U?)-?(\d{6,})\b/i);
  const codigo = cod ? `MLB${cod[1] ? "U" : ""}${cod[2]}` : "";
  // "De R$ 249,90 por R$ 199,90": o menor é o preço, o maior vira o "De".
  const precos = (resto.match(/R\$\s*[\d.]+(?:,\d{1,2})?/g) || []).map(precoDoTexto).filter((n) => n > 0 && n <= 1e7);
  const preco = precos.length ? Math.min(...precos) : null;
  const precoDe = precos.length > 1 && Math.max(...precos) > preco ? Math.max(...precos) : null;
  const linhas = resto.split(/\n+/).map((l) => {
    let t = l.replace(EMOJI, " ").replace(/R\$\s*[\d.]+(?:,\d{1,2})?/g, " ").replace(/\bMLBU?-?\d{6,}\b/gi, " ");
    const doisPontos = t.indexOf(":");
    if (doisPontos >= 0 && CONVITE.test(t.slice(0, doisPontos))) t = t.slice(doisPontos + 1);
    return t.replace(/[*_~|•·]+/g, " ").replace(/\s+/g, " ").trim().replace(/^[-–—:,.!\s]+|[-–—:,.!\s]+$/g, "");
  }).filter((t) => t.length >= 6 && t.length <= 200 && /[a-zà-ú]{3}/i.test(t) && !(CONVITE.test(t) && t.split(" ").length <= 8));
  const nome = linhas.sort((a, b) => b.length - a.length)[0] || "";
  return { link, pagina, codigo, preco, precoDe, nome };
}
/* Só o código (o "Copiar ID" do compartilhar de afiliado): monta um endereço que o Preencher do
   servidor entende. Catálogo tem até 9 dígitos (MLB19567837); anúncio, 10 ou mais (out/2026). O
   nome vai no endereço porque, sem foto e preço liberados, é dele que o servidor tira o rascunho
   do nome e a categoria. */
function enderecoDoCodigo(codigo, nome) {
  const m = String(codigo || "").match(/^MLB(U?)(\d{6,})$/);
  if (!m) return "";
  const trecho = semAcentoMin(nome).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "produto";
  if (m[1]) return `https://www.mercadolivre.com.br/${trecho}/up/MLBU${m[2]}`;
  if (m[2].length <= 9) return `https://www.mercadolivre.com.br/${trecho}/p/MLB${m[2]}`;
  return `https://produto.mercadolivre.com.br/MLB-${m[2]}-${trecho}-_JM`;
}

/* O cadastro em andamento fica na aba (sessionStorage) enquanto se vai e volta do app do Mercado
   Livre: no iPhone, a aba que fica para trás pode ser recarregada pelo sistema, e o que já tinha
   sido colado sumia. Some ao salvar, ao cancelar e ao fechar a aba. */
const CHAVE_FORM = "fn-home-ml-form";
const DOZE_HORAS = 12 * 3600 * 1000;

/* ---------------- Botão "Enviar ao FN Home" (favorito do Chrome) ----------------
   A API do Mercado Livre só libera foto e preço de produto de catálogo (/p/); produto de vendedor
   (/up/) e anúncio avulso dão 403, e a página não abre pelo servidor. Mas ela abre no Chrome de
   quem está logado no Mercado Livre — então quem lê é o próprio navegador da Gerência, na página
   que ela está vendo: este favorito pega nome, foto, preço (e o meli.la, se já foi gerado) e abre
   o sistema com #fn-home-ml=<dados>. Nada passa pelo servidor nesse caminho.

   Vira código de favorito por toString(): precisa ser autossuficiente (nada de fora da função) e
   em JS simples, sem nada que o build troque por ajudante. As classes ui-pdp-* / andes-* são as da
   página de produto do Mercado Livre; og:*, itemprop e JSON-LD seguram se elas mudarem. */
function lerPaginaParaOFnHome(destino) {
  var d = document;
  var q = function (s) { return d.querySelector(s); };
  if (!/mercadoli(vre|bre)\./.test(location.hostname)) {
    alert("Abra a página de um produto do Mercado Livre e clique de novo em \"Enviar ao FN Home\".");
    return;
  }
  var meta = function (p) { var m = q("meta[property=\"" + p + "\"]") || q("meta[name=\"" + p + "\"]"); return m ? m.getAttribute("content") || "" : ""; };
  var ld = {};
  d.querySelectorAll("script[type=\"application/ld+json\"]").forEach(function (s) {
    try {
      [].concat(JSON.parse(s.textContent)).forEach(function (j) {
        [].concat(j && j["@graph"] ? j["@graph"] : j).forEach(function (x) { if (x && x["@type"] === "Product" && !ld.name) ld = x; });
      });
    } catch (e) { /* JSON-LD quebrado: segue sem ele */ }
  });
  var oferta = [].concat(ld.offers || [])[0] || {};
  var imagemLd = [].concat(ld.image || [])[0];
  var valor = function (el) {
    if (!el) return "";
    var f = el.querySelector(".andes-money-amount__fraction"), c = el.querySelector(".andes-money-amount__cents");
    return f ? f.textContent.replace(/\D/g, "") + "." + (c ? c.textContent.replace(/\D/g, "") : "00") : "";
  };
  var h1 = q("h1.ui-pdp-title") || q("h1");
  var img = q(".ui-pdp-gallery__figure img") || q("figure img");
  var precoMeta = q("meta[itemprop=\"price\"]");
  var curto = /https:\/\/meli\.la\/[A-Za-z0-9]+/;
  var link = ((d.body.innerText || "").match(curto) || [""])[0];
  d.querySelectorAll("input,textarea").forEach(function (i) { var m = (i.value || "").match(curto); if (m && !link) link = m[0]; });
  var dados = {
    pagina: location.href,
    titulo: (h1 && h1.textContent.trim()) || ld.name || meta("og:title"),
    foto: (img && (img.getAttribute("data-zoom") || img.currentSrc || img.src)) || (imagemLd && (imagemLd.url || imagemLd)) || meta("og:image"),
    preco: (precoMeta && precoMeta.getAttribute("content")) || oferta.price || valor(q(".ui-pdp-price__second-line .andes-money-amount")),
    preco_de: valor(q(".ui-pdp-price s.andes-money-amount--previous") || q("s.andes-money-amount--previous")),
    link: link,
  };
  window.open(destino + "#fn-home-ml=" + encodeURIComponent(JSON.stringify(dados)), "_blank");
}
// encodeURIComponent: o Chrome decodifica o favorito antes de rodar, e um "%" solto no código o quebraria.
const codigoDoBotao = (destino) => `javascript:${encodeURIComponent(`(${lerPaginaParaOFnHome.toString()})(${JSON.stringify(destino)})`)}`;

/* O que chega pelo endereço é de quem montou o link, não necessariamente do botão: só entra o que
   tem a cara certa (página e link do Mercado Livre, foto do mlstatic, preço número), e mesmo assim
   só preenche o formulário — a Gerência confere e salva, e o backend valida de novo. */
const CHAVE_RASCUNHO = "fn-home-ml-rascunho";
const PREFIXO_RASCUNHO = "#fn-home-ml=";
function limparRascunho(r) {
  if (!r || typeof r !== "object") return null;
  const texto = (v, max) => String(v || "").replace(/\s+/g, " ").trim().slice(0, max);
  const numero = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) && n > 0 && n <= 1e7 ? n : null; };
  let foto = "";
  try {
    const u = new URL(String(r.foto || ""));
    if (u.protocol === "https:" && (u.hostname === "mlstatic.com" || u.hostname.endsWith(".mlstatic.com"))) foto = u.toString();
  } catch { /* fica sem foto */ }
  const preco = numero(r.preco);
  const precoDe = numero(r.preco_de);
  return {
    pagina: ehPaginaDoMercadoLivre(r.pagina) ? String(r.pagina).trim().slice(0, 2000) : "",
    titulo: texto(r.titulo, 200),
    foto,
    preco,
    preco_de: preco != null && precoDe != null && precoDe > preco ? precoDe : null,
    link: /^https:\/\/meli\.la\/[A-Za-z0-9]+$/.test(String(r.link || "")) ? r.link : "",
  };
}
/* Guarda assim que o arquivo carrega e tira do endereço: o login pode vir antes da tela, e um F5
   não deve preencher de novo. sessionStorage é da aba que o botão abriu. */
(function guardarRascunhoDoEndereco() {
  try {
    if (!window.location.hash.startsWith(PREFIXO_RASCUNHO)) return;
    sessionStorage.setItem(CHAVE_RASCUNHO, decodeURIComponent(window.location.hash.slice(PREFIXO_RASCUNHO.length)));
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  } catch { /* sem sessionStorage: o botão só não preenche */ }
})();
export function temRascunhoMercadoLivre() {
  try { return Boolean(sessionStorage.getItem(CHAVE_RASCUNHO)); } catch { return false; }
}
function pegarRascunho() {
  try {
    const t = sessionStorage.getItem(CHAVE_RASCUNHO);
    sessionStorage.removeItem(CHAVE_RASCUNHO);
    return t ? limparRascunho(JSON.parse(t)) : null;
  } catch { return null; }
}

function Etiqueta({ cor = AZUL_MEDIO, children }) {
  return <span style={{ display: "inline-block", fontSize: 11.5, fontWeight: 700, color: cor, background: `${cor}14`, border: `1px solid ${cor}33`, borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>{children}</span>;
}
function Campo({ label, children, largo, dica }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: largo ? "1 1 100%" : "1 1 200px", minWidth: 0 }}>
      <span style={lab}>{label}</span>
      {children}
      {dica && <span style={{ fontSize: 11.5, color: "#8593a8" }}>{dica}</span>}
    </label>
  );
}

/* ---------------- Vitrine (FN Home) ---------------- */

/* A foto do cartão, dentro da moldura .fnh-foto (ver o <style> da vitrine). Foto que não abre
   (endereço vencido no Mercado Livre, link de página colado no lugar da foto) vira o ícone da
   sacola — no iPhone o navegador mostrava o nome do produto solto no quadro, como foto quebrada. */
function FotoDoProduto({ src, alt }) {
  const [quebrou, setQuebrou] = useState(false);
  useEffect(() => { setQuebrou(false); }, [src]);
  if (!src || quebrou) return <div className="fnh-sem-foto"><ShoppingBag size={34} color="#b8c3d3" /></div>;
  return <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setQuebrou(true)} />;
}

/* Quantos cartões aparecem antes do "Ver mais": com 70+ produtos numa grade só, o celular virava
   rolagem sem fim e a loja parecia desorganizada. Buscar ou escolher categoria mostra tudo dela. */
const PRODUTOS_POR_PAGINA = 24;

/* Some quando não há produto — e também quando a API falha: para o cliente, uma seção vazia
   ou um erro no meio do FN Home seria pior que nada. A falha fica no console. */
export function SecaoOfertasMercadoLivre({ apiFetch, aoCarregar, separar = true }) {
  const [produtos, setProdutos] = useState([]);
  const [categoria, setCategoria] = useState("");
  const [busca, setBusca] = useState("");
  const [limite, setLimite] = useState(PRODUTOS_POR_PAGINA);

  useEffect(() => {
    let vivo = true;
    apiFetch("/api/afiliados/mercadolivre/vitrine")
      .then((r) => { if (!vivo) return; const lista = r?.produtos || []; setProdutos(lista); aoCarregar?.(lista.length); })
      .catch((e) => { console.warn("Ofertas do Mercado Livre não carregaram:", e.message); aoCarregar?.(0); });
    return () => { vivo = false; };
  }, []);

  // Categoria com a contagem, a maior primeiro: a fileira de filtros começa pelo que a loja mais tem.
  const categorias = useMemo(() => {
    const n = new Map();
    for (const p of produtos) if (p.categoria) n.set(p.categoria, (n.get(p.categoria) || 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));
  }, [produtos]);
  if (produtos.length === 0) return null;

  // Sem acento e sem caixa: os títulos do Mercado Livre vêm ora "Lâmpada", ora "Lampada".
  const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const termo = semAcento(busca.trim());
  const filtrados = produtos.filter((p) => (!categoria || p.categoria === categoria) && (!termo || semAcento(p.titulo).includes(termo)));
  const visiveis = filtrados.slice(0, limite);
  const trocarCategoria = (c) => { setCategoria(c); setLimite(PRODUTOS_POR_PAGINA); };

  /* O botão é o próprio link do Mercado Livre: a compra não depende da nossa API. O aviso de
     clique vai junto, sem esperar resposta — se falhar, perde-se só a contagem. */
  const registrarClique = (id) => {
    apiFetch(`/api/afiliados/mercadolivre/${encodeURIComponent(id)}/clique`, { method: "POST" }).catch(() => {});
  };

  const chip = (ativo) => ({
    flex: "0 0 auto", border: `1px solid ${ativo ? AZUL_MARINHO : CINZA_BORDA}`, background: ativo ? AZUL_MARINHO : "#fff",
    color: ativo ? "#fff" : "#4a5a70", borderRadius: 999, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
  });

  return (
    <div style={separar ? { marginTop: 22, paddingTop: 18, borderTop: `1px solid ${CINZA_BORDA}` } : {}}>
      {/* Hover dos cartões e a fileira de categorias sem barra de rolagem: estilo em linha não tem
          :hover nem pseudo-elemento. */}
      <style>{`
        .fnh-card { transition: box-shadow .15s ease, transform .15s ease, border-color .15s ease; }
        .fnh-card:hover { border-color: #BFD3EA; box-shadow: 0 8px 22px rgba(18,51,91,.10); transform: translateY(-2px); }
        .fnh-chips { scrollbar-width: none; }
        .fnh-chips::-webkit-scrollbar { display: none; }
        @media (prefers-reduced-motion: reduce) { .fnh-card, .fnh-card:hover { transition: none; transform: none; } }
        /* Cartão grande como o do site institucional (out/2026, pedido da Gerência): ~220 px de
           largura e foto quadrada. No celular volta a duas colunas, com letra menor. */
        .fnh-grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 18px; }
        /* Moldura da foto com tamanho fixo: quadrada, da largura do cartão. A foto fica por cima dela
           (absolute) e não ocupa espaço. Antes ela ia dentro de uma grade com aspect-ratio, e foto alta
           (garrafa, cadeira) esticava a moldura e a linha inteira de cartões — no iPhone ainda vazava por
           cima do "Comprar" (out/2026). Agora qualquer formato cabe inteiro no quadrado, centralizado. */
        .fnh-foto { position: relative; flex: none; aspect-ratio: 1 / 1; overflow: hidden; background: #fff; border-bottom: 1px solid ${CINZA_CLARO}; }
        @supports not (aspect-ratio: 1 / 1) { .fnh-foto::before { content: ""; display: block; padding-top: 100%; } }
        .fnh-foto > img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; box-sizing: border-box; padding: 18px; object-fit: contain; display: block; }
        .fnh-sem-foto { position: absolute; top: 0; right: 0; bottom: 0; left: 0; display: flex; align-items: center; justify-content: center; }
        .fnh-corpo { padding: 14px 16px 16px; gap: 6px; }
        .fnh-cat { font-size: 11px; }
        .fnh-nome { font-size: 15px; }
        .fnh-preco { font-size: 21px; }
        .fnh-comprar { font-size: 13.5px; padding: 10px 8px; }
        @media (max-width: 640px) {
          .fnh-grade { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; }
          .fnh-foto > img { padding: 10px; }
          .fnh-corpo { padding: 10px 12px 12px; gap: 4px; }
          .fnh-cat { font-size: 10px; }
          .fnh-nome { font-size: 13px; }
          .fnh-preco { font-size: 17px; }
          .fnh-comprar { font-size: 12.5px; padding: 9px 6px; }
        }
      `}</style>

      {separar && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <ShoppingBag size={17} color={AZUL_MEDIO} />
          <h4 style={{ margin: 0, fontSize: 15, color: AZUL_MARINHO }}>Produtos da loja</h4>
        </div>
      )}

      {/* Busca e total na mesma linha; no celular a busca ocupa a linha inteira. */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <label style={{ position: "relative", flex: "1 1 220px", minWidth: 0 }}>
          <Search size={15} color="#8593a8" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
          <input value={busca} onChange={(e) => { setBusca(e.target.value); setLimite(PRODUTOS_POR_PAGINA); }}
            placeholder="Buscar produto (ex.: luminária, tomada)" aria-label="Buscar produto"
            style={{ ...inp, padding: "9px 10px 9px 32px", fontSize: 14 }} />
        </label>
        <span style={{ fontSize: 12.5, color: "#65758b", whiteSpace: "nowrap" }}>
          {filtrados.length === 1 ? "1 produto" : `${filtrados.length} produtos`}
        </span>
      </div>

      {categorias.length > 1 && (
        <div className="fnh-chips" role="group" aria-label="Categorias"
          style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 14 }}>
          <button style={chip(!categoria)} onClick={() => trocarCategoria("")}>Todas ({produtos.length})</button>
          {categorias.map(([c, n]) => (
            <button key={c} style={chip(categoria === c)} onClick={() => trocarCategoria(categoria === c ? "" : c)}>{c} ({n})</button>
          ))}
        </div>
      )}

      {filtrados.length === 0 && (
        <p style={{ fontSize: 13.5, color: "#65758b", textAlign: "center", padding: "24px 0" }}>
          Nenhum produto encontrado{termo ? ` para "${busca.trim()}"` : ""}.
        </p>
      )}

      {/* Tamanhos nas classes fnh-* do <style> acima: grande no computador, duas colunas no
          celular — produto em coluna única vira rolagem sem fim. */}
      <div className="fnh-grade">
        {visiveis.map((p) => {
          const off = desconto(p);
          return (
            <div key={p.id} className="fnh-card" style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column", background: "#fff", minWidth: 0, boxShadow: "0 1px 2px rgba(18,51,91,.04), 0 4px 14px rgba(18,51,91,.05)" }}>
              <div className="fnh-foto">
                <FotoDoProduto src={p.foto} alt={p.titulo} />
                {off && (
                  <span style={{ position: "absolute", zIndex: 1, top: 10, left: 10, fontSize: 12, fontWeight: 700, color: "#fff", background: AZUL_MARINHO, borderRadius: 7, padding: "3px 8px" }}>-{off}%</span>
                )}
              </div>
              <div className="fnh-corpo" style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                {p.categoria && (
                  <div className="fnh-cat" style={{ fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: AZUL_MEDIO, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.categoria}</div>
                )}
                <div className="fnh-nome" style={{ fontWeight: 600, color: "#1a2330", lineHeight: 1.35, minHeight: "2.7em", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }} title={p.titulo}>
                  {p.titulo}
                </div>
                <div style={{ marginTop: "auto", paddingTop: 6 }}>
                  {off && <div style={{ fontSize: 12, color: "#8593a8", textDecoration: "line-through" }}>{fmtReal(p.preco_de)}</div>}
                  {p.preco
                    ? <div className="fnh-preco" style={{ fontWeight: 800, color: AZUL_MARINHO, letterSpacing: "-.02em", lineHeight: 1.2 }}>{fmtReal(p.preco)}</div>
                    : <div style={{ fontSize: 13, color: "#65758b" }}>Veja o preço no Mercado Livre</div>}
                  {p.preco && p.preco_conferido_em && (
                    <div style={{ fontSize: 11, color: "#8593a8" }}>Preço em {fmtDia(p.preco_conferido_em)}</div>
                  )}
                </div>
                <a href={p.link} target="_blank" rel="noopener noreferrer sponsored nofollow"
                  onClick={() => registrarClique(p.id)} className="fnh-comprar"
                  style={{ ...btn, justifyContent: "center", marginTop: 10, borderRadius: 10, textDecoration: "none" }}>
                  <ExternalLink size={14} /> Comprar
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {filtrados.length > limite && (
        <button onClick={() => setLimite((n) => n + PRODUTOS_POR_PAGINA)}
          style={{ ...btnLeve, width: "100%", justifyContent: "center", marginTop: 14, padding: "10px" }}>
          Ver mais produtos ({filtrados.length - limite})
        </button>
      )}

      {/* Publicidade com link de afiliado se identifica como tal — e o cliente precisa saber
          de quem cobrar a entrega e a garantia, que não são da FN. */}
      <p style={{ fontSize: 11.5, color: "#8593a8", margin: "14px 0 0", lineHeight: 1.5 }}>
        A compra é feita no Mercado Livre. Links de afiliado: a FN pode receber comissão pelas compras feitas por eles, sem custo a mais para você.
        O preço pode ter mudado desde a data indicada; valor final, entrega, troca e garantia são do Mercado Livre e do vendedor.
      </p>
    </div>
  );
}

/* ---------------- Gerência ---------------- */

/* Miniatura da lista: mesma ideia da moldura da vitrine — caixa de tamanho fixo e a foto por cima,
   inteira. Com a foto dentro de uma grade, a alta (garrafa) saía cortada embaixo. */
function Miniatura({ src, tamanho = 56 }) {
  const [quebrou, setQuebrou] = useState(false);
  useEffect(() => { setQuebrou(false); }, [src]);
  return (
    <div style={{ position: "relative", width: tamanho, height: tamanho, borderRadius: 8, border: `1px solid ${CINZA_CLARO}`, background: "#fff", overflow: "hidden", flexShrink: 0 }}>
      {src && !quebrou
        ? <img src={src} alt="" loading="lazy" onError={() => setQuebrou(true)}
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
        : <span style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><ShoppingBag size={20} color="#b8c3d3" /></span>}
    </div>
  );
}

const fmtPct = (n) => `${String(Math.round(Number(n) * 100) / 100).replace(".", ",")}%`;
const numeroDigitado = (v) => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/* A comissão que entra na conta do "você ganha": a que a Gerência informou (a do portal de
   afiliados, que é a que vale) ou, sem ela, a da tabela do Mercado Livre para a categoria do
   produto lá — estimativa que o servidor manda pronta em comissao_tabela (ver
   comissao-mercadolivre.js no backend). Ganho = preço × %, a mesma conta do Financeiro do FN Home.
   É o teto: o Mercado Livre paga sobre a venda sem as tarifas dele. */
function comissaoDoProduto(p) {
  const informada = numeroDigitado(p.comissao_percentual);
  const tabela = p.comissao_tabela != null ? Number(p.comissao_tabela) : null;
  const percentual = informada ?? tabela;
  return {
    percentual,
    origem: informada != null ? "informada" : tabela != null ? "tabela" : null,
    ganho: percentual != null && p.preco != null ? Math.round(Number(p.preco) * percentual) / 100 : null,
  };
}

/* "Você ganha R$ X por venda" em cada item da lista, com a % editável ali mesmo: o percentual de
   cada produto aparece no portal de afiliados ao gerar o link, e abrir o formulário inteiro só para
   digitar um número fazia ninguém digitar (em out/2026 nenhum produto tinha a %). Pedido da Gerência. */
function BlocoComissao({ p, salvar, ocupado, buscandoCategorias }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState("");
  const c = comissaoDoProduto(p);
  const abrir = () => { setValor(p.comissao_percentual != null ? String(Number(p.comissao_percentual)).replace(".", ",") : ""); setEditando(true); };
  const confirmar = async () => {
    const texto = valor.trim();
    if (texto === "" && p.comissao_percentual == null) { setEditando(false); return; }
    if (await salvar(texto)) setEditando(false);
  };

  if (editando) {
    return (
      <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input autoFocus inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)}
            placeholder={p.comissao_tabela != null ? String(p.comissao_tabela) : "8"} aria-label="Sua comissão (%)"
            onKeyDown={(e) => { if (e.key === "Enter") confirmar(); if (e.key === "Escape") setEditando(false); }}
            style={{ ...inp, width: 64, padding: "6px 8px", fontSize: 16 /* menos que 16 px, o iPhone dá zoom na tela */ }} />
          <span style={{ fontSize: 13, color: "#4a5a70" }}>%</span>
          <button type="button" style={{ ...btn, padding: "6px 10px", opacity: ocupado ? 0.6 : 1 }} disabled={ocupado} onClick={confirmar}>
            {ocupado ? <Loader2 size={14} className="spin" /> : <Check size={14} />} Salvar
          </button>
          <button type="button" style={{ ...btnLeve, padding: "6px 8px" }} onClick={() => setEditando(false)} aria-label="Cancelar"><X size={14} /></button>
        </div>
        <span style={{ fontSize: 11, color: "#8593a8", lineHeight: 1.4 }}>
          A % que o portal de afiliados mostra para este produto.
          {p.comissao_tabela != null ? ` Em branco, vale a tabela do Mercado Livre (${fmtPct(p.comissao_tabela)}).` : ""}
        </span>
      </div>
    );
  }

  const cor = c.origem === "informada" ? VERDE : c.origem === "tabela" ? AZUL_MEDIO : AMBAR;
  let detalhe;
  if (c.origem === "informada") detalhe = `${fmtPct(c.percentual)} · informada por você`;
  else if (c.origem === "tabela") detalhe = `${fmtPct(c.percentual)} · estimada pela tabela do ML · ${p.categoria_ml}`;
  else if (p.categoria_ml == null && buscandoCategorias) detalhe = "Buscando a categoria no Mercado Livre…";
  else if (p.categoria_ml) detalhe = `${p.categoria_ml}: fora da tabela do Mercado Livre`;
  else detalhe = "Sem categoria do Mercado Livre para estimar";
  return (
    <button type="button" onClick={abrir} title="Toque para informar a % que o portal de afiliados mostra"
      style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, width: "100%", textAlign: "left", background: `${cor}0D`, border: `1px solid ${cor}40`, borderRadius: 8, padding: "6px 9px", cursor: "pointer", fontFamily: "inherit", boxSizing: "border-box" }}>
      <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 1 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: c.origem === "tabela" ? AZUL_MARINHO : cor }}>
          {c.percentual == null ? "Informe a % de comissão"
            : c.ganho != null ? `Você ganha ${fmtReal(c.ganho)} por venda`
              : `Comissão de ${fmtPct(c.percentual)} (produto sem preço)`}
        </span>
        <span style={{ fontSize: 11, color: "#65758b", lineHeight: 1.35 }}>{detalhe}</span>
      </span>
      <Pencil size={13} color="#8593a8" style={{ flexShrink: 0 }} />
    </button>
  );
}

const formVazio = () => ({
  id: null, link: "", titulo: "", categoria: "", preco: "", preco_de: "", comissao_percentual: "", foto: "", ativo: true,
  // Categoria de cima do Mercado Livre e a % da tabela dela: só para a estimativa da comissão.
  // categoria_ml_nova = veio do Preencher agora e vai junto ao salvar.
  categoria_ml: "", comissao_tabela: null, categoria_ml_nova: false,
});
function lerFormGuardado() {
  try {
    const g = JSON.parse(sessionStorage.getItem(CHAVE_FORM) || "null");
    if (!g || !g.form || Date.now() - (Number(g.em) || 0) > DOZE_HORAS) return null;
    return { form: { ...formVazio(), ...g.form }, pagina: String(g.pagina || "") };
  } catch { return null; }
}
function guardarForm(form, pagina) {
  try {
    const vazio = JSON.stringify(form) === JSON.stringify(formVazio()) && !String(pagina || "").trim();
    if (vazio) sessionStorage.removeItem(CHAVE_FORM);
    else sessionStorage.setItem(CHAVE_FORM, JSON.stringify({ form, pagina, em: Date.now() }));
  } catch { /* sem espaço ou sem storage: só não guarda */ }
}
const paraForm = (p) => ({
  id: p.id, link: p.link || "", titulo: p.titulo || "", categoria: p.categoria || "",
  preco: p.preco != null ? String(Number(p.preco)) : "", preco_de: p.preco_de != null ? String(Number(p.preco_de)) : "",
  comissao_percentual: p.comissao_percentual != null ? String(Number(p.comissao_percentual)) : "",
  foto: p.foto || "", ativo: p.ativo !== false,
  categoria_ml: p.categoria_ml || "", comissao_tabela: p.comissao_tabela ?? null, categoria_ml_nova: false,
});

export default function AbaProdutosMercadoLivre({ token, apiFetch, notify, redimensionar }) {
  const [lista, setLista] = useState(null);
  const [carregando, setCarregando] = useState(false);
  // O cadastro que estava aberto volta sozinho (ver CHAVE_FORM): no celular a aba recarrega
  // enquanto se copia o link no app do Mercado Livre.
  const [guardado] = useState(lerFormGuardado);
  const [form, setForm] = useState(() => guardado?.form || formVazio());
  const [recuperado, setRecuperado] = useState(Boolean(guardado));
  const [salvando, setSalvando] = useState(false);
  const [mexendo, setMexendo] = useState(null); // id da linha com ação em andamento
  const [busca, setBusca] = useState("");
  // Endereço da página do produto: só alimenta o Preencher, não é gravado.
  const [pagina, setPagina] = useState(() => guardado?.pagina || "");
  const [preenchendo, setPreenchendo] = useState(false);
  const [preenchido, setPreenchido] = useState(null); // { campos, categoriaCaminho, avisos }
  // Sem permissão para ler a área de transferência (ou navegador sem a função), abre uma caixa
  // para colar com o dedo — segurar e "Colar".
  const [colarManual, setColarManual] = useState(false);
  // O que o último "Colar" fez e o que falta — fica na tela (o aviso flutuante some em 2 s).
  const [avisoColar, setAvisoColar] = useState("");
  useEffect(() => { guardarForm(form, pagina); }, [form, pagina]);

  // A categoria do Mercado Livre de cada produto (para a comissão estimada) é buscada pelo servidor
  // em segundo plano; enquanto isso a lista se recarrega sozinha algumas vezes.
  const [categoriasMl, setCategoriasMl] = useState({ pendentes: 0, buscando: false });
  const recargas = useRef(0);

  const abrirForm = (f = formVazio()) => { setForm(f); setPagina(""); setPreenchido(null); setRecuperado(false); setColarManual(false); setAvisoColar(""); };

  const carregar = async (silencioso = false) => {
    setCarregando(true);
    try {
      const r = await apiFetch("/api/afiliados/mercadolivre", { token });
      setLista(r.produtos || []);
      setCategoriasMl({ pendentes: Number(r.categoriasMlPendentes) || 0, buscando: Boolean(r.buscandoCategoriasMl) });
    } catch (e) { if (!silencioso) notify(`Não foi possível carregar os produtos: ${e.message}`); }
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, []);
  useEffect(() => {
    if (!categoriasMl.buscando || recargas.current >= 8) return undefined;
    const t = setTimeout(() => { recargas.current += 1; carregar(true); }, 6000);
    return () => clearTimeout(t);
  }, [lista, categoriasMl.buscando]);

  /* A % de um item, direto da lista (BlocoComissao). Em branco apaga a informada — volta a valer a
     estimativa da tabela. Devolve se deu certo, para o quadro fechar ou continuar aberto. */
  const salvarComissao = async (p, valor) => {
    setMexendo(p.id);
    try {
      await apiFetch(`/api/afiliados/mercadolivre/${encodeURIComponent(p.id)}`, { method: "PATCH", token, body: { comissao_percentual: valor === "" ? null : valor } });
      notify(valor === "" ? "Comissão apagada — volta a valer a estimativa ✓" : "Comissão salva ✓");
      await carregar(true);
      return true;
    } catch (e) {
      notify(`Não foi possível salvar a comissão: ${e.message}`);
      return false;
    } finally { setMexendo(null); }
  };

  const categorias = useMemo(() => [...new Set((lista || []).map((p) => p.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")), [lista]);
  const termo = busca.trim().toLowerCase();
  const visiveis = (lista || []).filter((p) => !termo || `${p.titulo} ${p.categoria}`.toLowerCase().includes(termo));
  const naVitrine = (lista || []).filter((p) => p.ativo).length;
  const cliques = (lista || []).reduce((s, p) => s + (Number(p.cliques) || 0), 0);

  const mudar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));
  const avisoLink = form.link.trim() && !pareceLinkDeAfiliado(form.link.trim());
  // O "você ganha" do formulário, com o que está digitado agora (mesma conta da lista).
  const comissaoNoForm = comissaoDoProduto({ comissao_percentual: form.comissao_percentual, comissao_tabela: form.comissao_tabela, preco: numeroDigitado(form.preco) });
  const dicaComissao = comissaoNoForm.origem === "tabela"
    ? `Em branco, vale a tabela do Mercado Livre para ${form.categoria_ml}: ${fmtPct(comissaoNoForm.percentual)}` +
      `${comissaoNoForm.ganho != null ? ` — você ganha ${fmtReal(comissaoNoForm.ganho)} por venda` : ""}. Confira no portal de afiliados.`
    : comissaoNoForm.origem === "informada" && comissaoNoForm.ganho != null
      ? `Você ganha ${fmtReal(comissaoNoForm.ganho)} por venda.`
      : "O percentual que o portal de afiliados mostra ao gerar o link. Opcional.";
  const fotoEhPagina = !form.foto.startsWith("data:") && ehPaginaDoMercadoLivre(form.foto);

  /* Lê do Mercado Livre o que der e põe no formulário, por cima do que estiver nele — foi pedido;
     o que não veio fica como está. Nada é salvo até "Cadastrar". daPagina é o que o botão "Enviar
     ao FN Home" leu da página aberta no Chrome: vale mais que a API (é o que a Gerência está vendo),
     e a API entra para a categoria e para o que a página não deu. doTexto é o que o "Colar do
     Mercado Livre" achou no texto compartilhado (link de afiliado, nome, preço): entra só onde a API
     não deu. Devolve o que foi posto no formulário (null quando nem chamou a API). */
  const preencher = async (endereco = pagina, daPagina = null, doTexto = null) => {
    const texto = String(endereco || "").trim();
    if (!texto) { notify("Cole o endereço da página do produto no Mercado Livre."); return null; }
    // O link curto é o que paga a comissão, e o servidor não consegue abri-lo: vai para o campo dele.
    if (ehLinkCurto(texto)) {
      setPagina("");
      if (!form.link.trim()) mudar("link", texto);
      notify(form.link.trim()
        ? "Esse é um link de afiliado. Para preencher, cole o endereço da página do produto."
        : "Esse é o link de afiliado — coloquei no campo dele. Para preencher, cole agora o endereço da página do produto.");
      return null;
    }
    setPagina(texto);
    setPreenchendo(true);
    setPreenchido(null);
    // Preço novo leva junto o "De" dele (ou nenhum): um "De" antigo menor que o preço novo travaria o salvar.
    const comPreco = (alvo, p, antes) => { alvo.preco = String(p); alvo.preco_de = antes != null ? String(antes) : ""; };
    const novo = {};
    if (daPagina) {
      if (daPagina.titulo) novo.titulo = daPagina.titulo;
      if (daPagina.foto) novo.foto = daPagina.foto;
      if (daPagina.preco != null) comPreco(novo, daPagina.preco, daPagina.preco_de);
      if (daPagina.link) novo.link = daPagina.link;
    }
    if (doTexto?.link) novo.link = doTexto.link;
    let categoriaCaminho = "";
    let avisos = [];
    try {
      const r = await apiFetch("/api/afiliados/mercadolivre/preencher", { method: "POST", token, body: { link: texto } });
      if (r.titulo && !novo.titulo) novo.titulo = r.titulo;
      if (r.categoria) novo.categoria = r.categoria;
      // A da vitrine a Gerência pode trocar; a do Mercado Livre fica guardada à parte para a comissão.
      if (r.categoriaMl) {
        novo.categoria_ml = r.categoriaMl;
        novo.comissao_tabela = r.comissaoTabela ?? null;
        novo.categoria_ml_nova = true;
      }
      if (r.foto && !novo.foto) novo.foto = r.foto;
      if (r.preco != null && novo.preco == null) comPreco(novo, r.preco, r.preco_de);
      categoriaCaminho = r.categoriaCaminho || "";
      // Com a página lida, os avisos da API sobre nome, foto e preço não valem; o da categoria sim.
      avisos = daPagina ? (r.avisos || []).filter((a) => /categoria/i.test(a)) : (r.avisos || []);
    } catch (e) {
      avisos = [daPagina ? `Não consegui a categoria no Mercado Livre agora (${e.message}). Escolha uma à mão.` : e.message];
    }
    /* O nome tirado do endereço vem sem acento ("Furadeira Impacto Bosch"); o do texto compartilhado
       é o do anúncio. O preço do texto só entra quando o Mercado Livre não liberou o dele. */
    if (doTexto) {
      const nomeDoEndereco = avisos.some((a) => /nome veio do endere/i.test(a));
      if (doTexto.nome && (!novo.titulo || nomeDoEndereco)) {
        novo.titulo = doTexto.nome;
        avisos = avisos.filter((a) => !/nome veio do endere/i.test(a));
      }
      if (doTexto.preco != null && novo.preco == null) comPreco(novo, doTexto.preco, doTexto.precoDe);
      if (!novo.foto && !form.foto) avisos.push("Sem foto: salve a foto do produto (ou faça um print) e use \"Enviar foto\", lá embaixo.");
    }
    if (daPagina) {
      if (!novo.foto) avisos.push("Não achei a foto na página. Na foto do produto, botão direito → \"Copiar endereço da imagem\" e cole no campo Foto.");
      if (novo.preco == null) avisos.push("Não achei o preço na página. Digite o preço que aparece no anúncio.");
      if (!novo.link) {
        avisos.push("Falta o link de afiliado: gere na barra de afiliados do Mercado Livre (no topo da página do produto) e cole abaixo. " +
          "Se gerar antes de clicar em \"Enviar ao FN Home\", ele já vem junto.");
      }
    }
    setForm((f) => ({ ...f, ...novo }));
    const nomes = { titulo: "nome", categoria: "categoria", foto: "foto", preco: "preço", link: "link de afiliado" };
    setPreenchido({ campos: Object.keys(nomes).filter((k) => k in novo).map((k) => nomes[k]), categoriaCaminho, avisos });
    setPreenchendo(false);
    return novo;
  };

  /* "Colar do Mercado Livre": o que veio do Compartilhar do app vai, pedaço por pedaço, para o
     campo certo (ver lerTextoDoMercadoLivre). Endereço ou código do produto chamam o Preencher; o
     link de afiliado sozinho só entra no campo dele, e a tela diz o que falta. */
  const aplicarColado = async (texto) => {
    const r = lerTextoDoMercadoLivre(texto);
    // O nome que já se tem (do texto agora ou de um "Colar" anterior) vai no endereço montado a partir
    // do código e fica no lugar do nome sem acento que o servidor tira do endereço.
    const nomeConhecido = r.nome || form.titulo.trim();
    const endereco = r.pagina || (r.codigo ? enderecoDoCodigo(r.codigo, nomeConhecido) : "");
    if (endereco) {
      setColarManual(false);
      setAvisoColar("");
      await preencher(endereco, null, { ...r, nome: nomeConhecido });
      return true;
    }
    // Sem o produto: guarda o que veio (nome e preço só onde estava vazio) e diz o que falta.
    const patch = {};
    const colados = [];
    if (r.link && r.link !== form.link.trim()) { patch.link = r.link; colados.push("link de afiliado"); }
    if (r.nome && !form.titulo.trim()) { patch.titulo = r.nome; colados.push("nome"); }
    if (r.preco != null && !String(form.preco).trim()) {
      patch.preco = String(r.preco);
      patch.preco_de = r.precoDe != null ? String(r.precoDe) : "";
      colados.push("preço");
    }
    if (!colados.length) {
      setAvisoColar(r.link
        ? "Esse link de afiliado já está no formulário. Agora copie o endereço (ou o código MLB…) do produto."
        : "Não achei nada do Mercado Livre no que foi colado. No app, toque em Compartilhar → Copiar link e tente de novo.");
      return false;
    }
    setColarManual(false);
    setForm((f) => ({ ...f, ...patch }));
    const lista = colados.length > 1 ? `${colados.slice(0, -1).join(", ")} e ${colados[colados.length - 1]}` : colados[0];
    const temLink = Boolean(patch.link || form.link.trim());
    // "Produto" aqui é o endereço/código já lido pelo Preencher — é ele que traz foto, preço e categoria.
    const proximo = !pagina.trim() ? "Agora copie o endereço (ou o código MLB…) do produto e toque em \"Colar do Mercado Livre\" de novo."
      : !temLink ? "Falta o link de afiliado: no app, Compartilhar → Copiar link, e toque em \"Colar do Mercado Livre\" de novo."
        : "Confira os campos e toque em \"Cadastrar produto\".";
    setAvisoColar(`${lista.charAt(0).toUpperCase()}${lista.slice(1)} ${colados.length > 1 ? "colados" : "colado"} ✓ ${proximo}`);
    return true;
  };
  const colarDoMercadoLivre = async () => {
    let texto = "";
    try { if (navigator.clipboard?.readText) texto = await navigator.clipboard.readText(); } catch { /* sem permissão: cai na caixa */ }
    if (!String(texto).trim()) { setColarManual(true); return; }
    await aplicarColado(texto);
  };

  // Veio do botão "Enviar ao FN Home": formulário novo, preenchido com o que ele leu da página.
  useEffect(() => {
    const r = pegarRascunho();
    if (!r || !r.pagina) return;
    setForm(formVazio());
    preencher(r.pagina, r);
  }, []);

  // Pelo DOM e não pela prop: o React avisa (e vai barrar) href "javascript:".
  const refBotao = useRef(null);
  useEffect(() => {
    refBotao.current?.setAttribute("href", codigoDoBotao(`${window.location.origin}${window.location.pathname}`));
  }, []);

  /* Endereço de página colado no lugar errado (link de afiliado ou foto): vira o do Preencher. */
  const usarParaPreencher = (campo) => {
    const texto = form[campo].trim();
    mudar(campo, "");
    preencher(texto);
  };

  const lerArquivoDeFoto = (arquivo) => {
    if (!arquivo) return;
    if (!arquivo.type.startsWith("image/")) { notify("Envie uma imagem (JPG ou PNG)."); return; }
    const leitor = new FileReader();
    // 600 px basta para o card da vitrine e mantém cada foto em dezenas de KB.
    leitor.onload = async () => mudar("foto", await redimensionar(leitor.result, 600));
    leitor.readAsDataURL(arquivo);
  };
  const onArquivoFoto = (e) => {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    lerArquivoDeFoto(arquivo);
  };
  // Foto copiada (no celular: segurar a foto do produto → Copiar) e colada no campo da foto.
  const onColarNaFoto = (e) => {
    const imagem = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith("image/"));
    if (imagem) { e.preventDefault(); lerArquivoDeFoto(imagem); }
  };

  const salvar = async () => {
    if (!form.link.trim()) { notify("Cole o link de afiliado do produto."); return; }
    if (!form.titulo.trim()) { notify("Informe o nome do produto."); return; }
    setSalvando(true);
    const corpo = {
      link: form.link.trim(), titulo: form.titulo.trim(), categoria: form.categoria.trim(),
      preco: form.preco === "" ? null : form.preco, preco_de: form.preco_de === "" ? null : form.preco_de,
      comissao_percentual: form.comissao_percentual === "" ? null : form.comissao_percentual,
      foto: form.foto, ativo: form.ativo,
      ...(form.categoria_ml_nova ? { categoria_ml: form.categoria_ml } : {}),
    };
    try {
      if (form.id) {
        await apiFetch(`/api/afiliados/mercadolivre/${encodeURIComponent(form.id)}`, { method: "PATCH", token, body: corpo });
        notify("Produto atualizado ✓");
      } else {
        await apiFetch("/api/afiliados/mercadolivre", { method: "POST", token, body: corpo });
        notify("Produto cadastrado — já aparece no FN Home ✓");
      }
      abrirForm();
      await carregar();
    } catch (e) { notify(`Não foi possível salvar: ${e.message}`); }
    setSalvando(false);
  };

  const acao = async (p, corpo, mensagem) => {
    setMexendo(p.id);
    try {
      await apiFetch(`/api/afiliados/mercadolivre/${encodeURIComponent(p.id)}`, { method: "PATCH", token, body: corpo });
      notify(mensagem);
      await carregar();
    } catch (e) { notify(`Não foi possível alterar: ${e.message}`); }
    setMexendo(null);
  };

  const excluir = async (p) => {
    if (!window.confirm(`Excluir "${p.titulo}"? Ele sai do FN Home e a contagem de cliques se perde. Para só esconder, use "Tirar do FN Home".`)) return;
    setMexendo(p.id);
    try {
      await apiFetch(`/api/afiliados/mercadolivre/${encodeURIComponent(p.id)}`, { method: "DELETE", token });
      notify("Produto excluído ✓");
      if (form.id === p.id) abrirForm();
      await carregar();
    } catch (e) { notify(`Não foi possível excluir: ${e.message}`); }
    setMexendo(null);
  };

  // O que já está no formulário, para quem cadastra pelo celular saber o que falta colar.
  const prontos = [
    ["Link de afiliado", Boolean(form.link.trim()) && pareceLinkDeAfiliado(form.link.trim())],
    ["Nome", Boolean(form.titulo.trim())],
    ["Foto", Boolean(form.foto)],
    ["Preço", String(form.preco).trim() !== ""],
  ];
  const urlSemCorretor = { inputMode: "url", autoCapitalize: "none", autoCorrect: "off", spellCheck: false };

  return (
    <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
      {/* Celular e tablet (sem mouse) não arrastam favorito: lá aparece o passo a passo do
          Compartilhar do app no lugar do "Enviar ao FN Home". No celular os botões crescem para o dedo. */}
      <style>{`
        .fnml-so-toque { display: none; }
        @media (hover: none) and (pointer: coarse) {
          .fnml-so-toque { display: block; }
          .fnml-so-mouse { display: none !important; }
        }
        @media (max-width: 640px) {
          .fnml-colar { flex: 1 1 100%; justify-content: center; min-height: 46px; font-size: 15px !important; }
          .fnml-acoes > button { flex: 1 1 100%; justify-content: center; min-height: 46px; font-size: 15px !important; }
          .fnml-btn-lista { min-width: 40px; min-height: 40px; justify-content: center; }
        }
      `}</style>
      <section style={secao}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8, flexWrap: "wrap" }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: CINZA_CLARO, display: "grid", placeItems: "center" }}><ShoppingBag size={16} color={AZUL_MEDIO} /></div>
          <h3 style={{ margin: 0, fontSize: 15, color: AZUL_MARINHO, flex: 1 }}>{form.id ? "Editar produto" : "Novo produto do Mercado Livre"}</h3>
          {form.id && <button style={btnLeve} onClick={() => abrirForm()}><X size={14} /> Cancelar edição</button>}
          {!form.id && recuperado && JSON.stringify(form) !== JSON.stringify(formVazio()) && (
            <button style={btnLeve} onClick={() => abrirForm()} title="O cadastro que estava aberto voltou. Toque para começar outro.">
              <X size={14} /> Limpar
            </button>
          )}
        </div>
        <p className="fnml-so-mouse" style={{ fontSize: 13, color: "#5a6a80", margin: "0 0 12px", lineHeight: 1.5 }}>
          Abra o produto no Mercado Livre e cole o endereço da página dele no primeiro campo: o resto se preenche sozinho.
          Depois gere o link do produto no <a href={PORTAL_AFILIADOS} target="_blank" rel="noreferrer" style={{ color: AZUL_MEDIO }}>portal de afiliados do Mercado Livre</a> e
          cole em "Link de afiliado". O produto entra na vitrine do FN Home com o botão "Comprar no Mercado Livre"; a venda e a
          comissão aparecem no painel de afiliados de lá.
        </p>
        <div style={{ display: "grid", gap: 10, background: CINZA_CLARO, borderRadius: 10, padding: "10px 12px", margin: "0 0 12px" }}>
          <div className="fnml-so-toque" style={{ fontSize: 13, color: "#4a5a70", lineHeight: 1.5 }}>
            <strong style={{ color: AZUL_MARINHO }}>Pelo celular:</strong>
            <ol style={{ margin: "6px 0 0", paddingLeft: 20, display: "grid", gap: 4 }}>
              <li>No app do Mercado Livre, abra o produto e toque em <strong>Compartilhar</strong> → <strong>Copiar link</strong>.</li>
              <li>Volte aqui e toque em <strong>Colar do Mercado Livre</strong>: cada coisa vai para o campo certo.</li>
              <li>Repita até os quatro itens abaixo ficarem verdes — o link de afiliado (meli.la) e o endereço ou o código
                do produto (MLB…), que traz nome, categoria e, quando o Mercado Livre libera, foto e preço.</li>
            </ol>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="fnml-colar" style={{ ...btn, background: AZUL_MARINHO, opacity: preenchendo ? 0.6 : 1 }}
              disabled={preenchendo} onClick={colarDoMercadoLivre}>
              {preenchendo ? <Loader2 size={15} className="spin" /> : <ClipboardPaste size={15} />} Colar do Mercado Livre
            </button>
            <a ref={refBotao} href="#" draggable="true" title="Arraste para a barra de favoritos do Chrome" className="fnml-so-mouse"
              onClick={(e) => { e.preventDefault(); notify("Arraste este botão para a barra de favoritos do Chrome — aqui ele não faz nada."); }}
              style={{ ...btn, textDecoration: "none", cursor: "grab" }}>
              <Bookmark size={14} /> Enviar ao FN Home
            </a>
          </div>
          <span className="fnml-so-mouse" style={{ fontSize: 12.5, color: "#4a5a70", lineHeight: 1.45 }}>
            <strong>Mais rápido, no computador:</strong> arraste "Enviar ao FN Home" para a barra de favoritos do Chrome (se ela não
            aparece, aperte Ctrl+Shift+B). Com um produto aberto no Mercado Livre, clique nele: o cadastro abre aqui já com nome,
            foto, preço e categoria — em qualquer anúncio, inclusive os que o Preencher não consegue. "Colar do Mercado Livre" lê
            o que você copiou (o endereço do produto ou o link de afiliado) e põe no campo certo.
          </span>
          {colarManual && (
            <div style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12.5, color: "#4a5a70", lineHeight: 1.45 }}>
                O navegador não deixou ler o que foi copiado. Segure o dedo na caixa abaixo e toque em <strong>Colar</strong>.
              </span>
              <textarea autoFocus rows={3} {...urlSemCorretor} inputMode="text" placeholder="Cole aqui o link ou o texto do Mercado Livre"
                style={{ ...inp, fontSize: 16 /* menos que 16 px, o iPhone dá zoom na tela */, resize: "vertical" }}
                onPaste={(e) => { const t = e.clipboardData.getData("text"); if (t.trim()) { e.preventDefault(); aplicarColado(t); } }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && e.currentTarget.value.trim()) { e.preventDefault(); aplicarColado(e.currentTarget.value); } }} />
              <button type="button" style={{ ...btnLeve, justifySelf: "start" }} onClick={() => setColarManual(false)}><X size={14} /> Fechar</button>
            </div>
          )}
          {avisoColar && (
            <div role="status" style={{ fontSize: 12.5, lineHeight: 1.45, color: /✓/.test(avisoColar) ? VERDE : AMBAR, background: /✓/.test(avisoColar) ? "#EAF5EA" : "#FFF4E0", borderRadius: 6, padding: "6px 8px" }}>
              {avisoColar}
            </div>
          )}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} aria-label="O que já está preenchido">
            {prontos.map(([rotulo, ok]) => (
              <span key={rotulo} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: ok ? VERDE : "#8593a8", background: "#fff", border: `1px solid ${ok ? "#BFE0C1" : CINZA_BORDA}`, borderRadius: 999, padding: "3px 9px" }}>
                {ok ? <CircleCheck size={13} /> : <Circle size={13} />} {rotulo}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Campo label="Página do produto no Mercado Livre" largo
            dica="O endereço do produto (no app: Compartilhar → Copiar link; no computador: a barra do navegador). Ao colar, o sistema busca nome, categoria, foto e preço.">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input style={{ ...inp, flex: "1 1 240px", width: "auto" }} type="url" {...urlSemCorretor} enterKeyHint="go" placeholder="https://www.mercadolivre.com.br/.../p/MLB..."
                value={pagina} onChange={(e) => setPagina(e.target.value)}
                onPaste={(e) => { const t = e.clipboardData.getData("text").trim(); if (t) { e.preventDefault(); aplicarColado(t); } }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); preencher(); } }} />
              <button type="button" style={{ ...btn, opacity: preenchendo ? 0.6 : 1 }} disabled={preenchendo} onClick={() => preencher()}>
                {preenchendo ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />} Preencher
              </button>
            </div>
          </Campo>
          {preenchido && (
            <div style={{ flex: "1 1 100%", display: "grid", gap: 6, fontSize: 12.5, lineHeight: 1.45 }}>
              {preenchido.campos.length > 0 && (
                <div style={{ color: VERDE, background: "#EAF5EA", borderRadius: 6, padding: "6px 8px" }}>
                  Veio do Mercado Livre: {preenchido.campos.join(", ")}.
                  {preenchido.categoriaCaminho ? ` Categoria lá: ${preenchido.categoriaCaminho}.` : ""} Confira antes de salvar.
                </div>
              )}
              {preenchido.avisos.map((a) => (
                <div key={a} style={{ color: AMBAR, background: "#FFF4E0", borderRadius: 6, padding: "6px 8px" }}>{a}</div>
              ))}
            </div>
          )}
          <Campo label="Link de afiliado *" largo
            dica={avisoLink ? null : "O link que o portal gera: https://meli.la/… ou https://mercadolivre.com/sec/…"}>
            <input style={inp} type="url" {...urlSemCorretor} placeholder="https://meli.la/..." value={form.link} onChange={(e) => mudar("link", e.target.value)}
              onPaste={(e) => {
                // Texto do Compartilhar com o link no meio: fica só o link (e o resto vai para os outros campos).
                const t = e.clipboardData.getData("text");
                const r = lerTextoDoMercadoLivre(t);
                if (r.link && t.trim() !== r.link) { e.preventDefault(); aplicarColado(t); }
              }} />
            {avisoLink && (
              <span style={{ fontSize: 12, color: AMBAR, background: "#FFF4E0", borderRadius: 6, padding: "6px 8px", lineHeight: 1.4 }}>
                Este parece ser o endereço da página do produto, não o link de afiliado. Assim o produto abre normalmente, mas a FN
                não recebe comissão. Gere o link no portal de afiliados e cole aqui.
                {ehPaginaDoMercadoLivre(form.link) && (
                  <button type="button" onClick={() => usarParaPreencher("link")}
                    style={{ ...btnLeve, display: "flex", marginTop: 6, padding: "5px 10px", fontSize: 12 }}>
                    <Sparkles size={13} /> Usar este endereço para preencher
                  </button>
                )}
              </span>
            )}
          </Campo>
          <Campo label="Nome do produto *" largo>
            <input style={inp} placeholder="Ex.: Furadeira de impacto Bosch 550W" value={form.titulo} onChange={(e) => mudar("titulo", e.target.value)} />
          </Campo>
          <Campo label="Categoria" dica="Vira um filtro na vitrine quando houver mais de uma.">
            <input list="categorias-ml" style={inp} placeholder="Ex.: Ferramentas" value={form.categoria} onChange={(e) => mudar("categoria", e.target.value)} />
            <datalist id="categorias-ml">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
          </Campo>
          <Campo label="Preço hoje (R$)" dica="Em branco, a vitrine manda ver o preço no Mercado Livre.">
            <input style={inp} type="number" inputMode="decimal" min="0" step="0.01" placeholder="199,90" value={form.preco} onChange={(e) => mudar("preco", e.target.value)} />
          </Campo>
          <Campo label={'Preço "De" (R$, opcional)'} dica="Só quando o anúncio mostra preço riscado.">
            <input style={inp} type="number" inputMode="decimal" min="0" step="0.01" placeholder="249,90" value={form.preco_de} onChange={(e) => mudar("preco_de", e.target.value)} />
          </Campo>
          {/* Só para o Financeiro do FN Home dizer quanto a FN ganha por venda; a comissão de
              verdade continua no painel de afiliados do Mercado Livre. */}
          <Campo label="Sua comissão (%)" dica={dicaComissao}>
            <input style={inp} type="number" inputMode="decimal" min="0" max="100" step="0.1" placeholder={form.comissao_tabela != null ? String(form.comissao_tabela) : "8"}
              value={form.comissao_percentual} onChange={(e) => mudar("comissao_percentual", e.target.value)} />
          </Campo>
          <Campo label="Foto" largo dica={'No computador: botão direito na foto do produto → "Copiar endereço da imagem" e cole aqui. No celular: salve a foto (ou faça um print) e toque em "Enviar foto" — ou copie a foto e cole aqui.'}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {form.foto && (
                <div style={{ position: "relative", width: 64, height: 64, border: `1px solid ${CINZA_BORDA}`, borderRadius: 8, overflow: "hidden", background: "#fff", flexShrink: 0 }}>
                  <img src={form.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  <button type="button" title="Tirar a foto" aria-label="Tirar a foto" onClick={() => mudar("foto", "")}
                    style={{ position: "absolute", top: 2, right: 2, border: "none", background: "rgba(255,255,255,.9)", borderRadius: 999, cursor: "pointer", padding: 2, display: "grid" }}>
                    <X size={12} />
                  </button>
                </div>
              )}
              <input style={{ ...inp, flex: "1 1 220px", width: "auto" }} {...urlSemCorretor} placeholder="https://http2.mlstatic.com/..."
                value={form.foto.startsWith("data:") ? "" : form.foto} disabled={form.foto.startsWith("data:")}
                onPaste={onColarNaFoto} onChange={(e) => mudar("foto", e.target.value.trim())} />
              <label style={{ ...btnLeve, cursor: "pointer" }}>
                <Upload size={14} /> Enviar foto
                <input type="file" accept="image/*" onChange={onArquivoFoto} style={{ display: "none" }} />
              </label>
            </div>
            {fotoEhPagina && (
              <span style={{ fontSize: 12, color: AMBAR, background: "#FFF4E0", borderRadius: 6, padding: "6px 8px", lineHeight: 1.4 }}>
                Esse é o endereço da página do produto, não da foto — na vitrine ele aparece como imagem quebrada.
                <button type="button" onClick={() => usarParaPreencher("foto")}
                  style={{ ...btnLeve, display: "flex", marginTop: 6, padding: "5px 10px", fontSize: 12 }}>
                  <Sparkles size={13} /> Usar este endereço para preencher
                </button>
              </span>
            )}
          </Campo>
          {form.id && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#1a2330", flex: "1 1 100%" }}>
              <input type="checkbox" checked={form.ativo} onChange={(e) => mudar("ativo", e.target.checked)} />
              Aparece no FN Home
            </label>
          )}
        </div>
        <div className="fnml-acoes" style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button style={{ ...btn, opacity: salvando ? 0.6 : 1 }} disabled={salvando} onClick={salvar}>
            {salvando ? <Loader2 size={15} className="spin" /> : form.id ? <Pencil size={15} /> : <Plus size={15} />}
            {form.id ? "Salvar alterações" : "Cadastrar produto"}
          </button>
        </div>
      </section>

      <section style={secao}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, fontSize: 15, color: AZUL_MARINHO, flex: 1 }}>Produtos cadastrados</h3>
          <span style={{ fontSize: 12.5, color: "#8593a8" }}>{naVitrine} no FN Home · {cliques} {cliques === 1 ? "clique" : "cliques"} no total</span>
          <a href="?pagina=fn-home" target="_blank" rel="noreferrer" style={{ ...btnLeve, textDecoration: "none" }}><Eye size={14} /> Ver o FN Home</a>
          <button style={btnLeve} onClick={carregar} disabled={carregando}><RefreshCcw size={14} /> Atualizar</button>
        </div>
        <p style={{ fontSize: 12.5, color: "#8593a8", margin: "0 0 12px", lineHeight: 1.5 }}>
          Cliques contados no botão "Comprar no Mercado Livre". Vendas e comissão só aparecem no painel de afiliados do Mercado Livre.
          Preço conferido há mais de {DIAS_PRECO_VELHO} dias fica em amarelo: confira no anúncio e use "Conferi hoje" ou edite o valor.
        </p>
        <p style={{ fontSize: 12.5, color: "#5a6a80", background: CINZA_CLARO, borderRadius: 8, padding: "8px 10px", margin: "0 0 12px", lineHeight: 1.5 }}>
          <strong>Você ganha</strong> = preço × sua comissão: a % que você informar (a do portal de afiliados — toque no quadro
          do produto) ou, sem ela, a estimada pela tabela do Mercado Livre para a categoria. O que cai pode ser um pouco menos:
          o Mercado Livre desconta as tarifas dele.
          {categoriasMl.buscando && categoriasMl.pendentes > 0 && (
            <span style={{ display: "block", marginTop: 4, color: AZUL_MEDIO }}>
              <Loader2 size={12} className="spin" style={{ verticalAlign: "-2px" }} /> Buscando no Mercado Livre a categoria de
              {categoriasMl.pendentes === 1 ? " 1 produto" : ` ${categoriasMl.pendentes} produtos`} para estimar a comissão…
            </span>
          )}
        </p>
        {(lista || []).length > 6 && (
          <div style={{ position: "relative", marginBottom: 12 }}>
            <Search size={14} color="#8593a8" style={{ position: "absolute", left: 10, top: 11 }} />
            <input style={{ ...inp, paddingLeft: 30 }} placeholder="Buscar produto ou categoria…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        )}

        {carregando && !lista && <div style={{ padding: 16, color: "#7a889c", fontSize: 13 }}>Carregando…</div>}
        {lista && visiveis.length === 0 && (
          <div style={{ padding: 16, textAlign: "center", color: "#7a889c", fontSize: 13 }}>
            {lista.length === 0 ? "Nenhum produto cadastrado ainda." : "Nenhum produto com essa busca."}
          </div>
        )}

        <div style={{ display: "grid", gap: 8 }}>
          {visiveis.map((p) => {
            const dias = diasDesde(p.preco_conferido_em);
            const velho = p.preco != null && dias != null && dias > DIAS_PRECO_VELHO;
            const ocupado = mexendo === p.id;
            return (
              <div key={p.id} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", border: `1px solid ${form.id === p.id ? AZUL_MEDIO : CINZA_BORDA}`, borderRadius: 10, padding: 10, opacity: p.ativo ? 1 : 0.65 }}>
                <Miniatura src={p.foto} />
                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                  {/* Duas linhas: o nome do Mercado Livre é comprido, e numa linha só o celular mostrava metade. */}
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1a2330", lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }} title={p.titulo}>{p.titulo}</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 4, fontSize: 12, color: "#65758b" }}>
                    {p.ativo ? <Etiqueta cor={VERDE}>No FN Home</Etiqueta> : <Etiqueta cor="#65758b">Fora do FN Home</Etiqueta>}
                    {p.categoria && <Etiqueta>{p.categoria}</Etiqueta>}
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }} title="Cliques no botão Comprar"><MousePointerClick size={12} /> {p.cliques || 0}</span>
                  </div>
                </div>
                <div style={{ flex: "1 1 230px", maxWidth: 360, minWidth: 0, fontSize: 12.5 }}>
                  {p.preco != null ? (
                    <>
                      <strong style={{ color: AZUL_MARINHO, fontSize: 14 }}>{fmtReal(p.preco)}</strong>
                      {p.preco_de != null && <span style={{ color: "#8593a8", textDecoration: "line-through", marginLeft: 6 }}>{fmtReal(p.preco_de)}</span>}
                      <div style={{ color: velho ? AMBAR : "#8593a8", fontWeight: velho ? 700 : 400 }}>
                        {velho ? `Conferido há ${dias} dias` : `Conferido em ${fmtDia(p.preco_conferido_em)}`}
                      </div>
                    </>
                  ) : <span style={{ color: "#8593a8" }}>Sem preço na vitrine</span>}
                  <BlocoComissao p={p} ocupado={ocupado}
                    buscandoCategorias={categoriasMl.buscando} salvar={(valor) => salvarComissao(p, valor)} />
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {ocupado ? <Loader2 size={16} className="spin" color={AZUL_MEDIO} /> : (
                    <>
                      <a href={p.link} target="_blank" rel="noreferrer" title="Abrir o anúncio" aria-label="Abrir o anúncio" className="fnml-btn-lista" style={{ ...btnLeve, padding: "6px 9px", textDecoration: "none" }}><ExternalLink size={14} /></a>
                      <button title="Editar" aria-label="Editar" className="fnml-btn-lista" style={{ ...btnLeve, padding: "6px 9px" }} onClick={() => { abrirForm(paraForm(p)); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Pencil size={14} /></button>
                      {p.preco != null && (
                        <button title="O preço continua o mesmo: marcar como conferido hoje" className="fnml-btn-lista" style={{ ...btnLeve, padding: "6px 9px", color: velho ? AMBAR : AZUL_MARINHO }}
                          onClick={() => acao(p, { conferirPreco: true }, "Preço marcado como conferido hoje ✓")}>
                          <CalendarCheck size={14} /> Conferi hoje
                        </button>
                      )}
                      <button title={p.ativo ? "Tirar do FN Home" : "Voltar ao FN Home"} aria-label={p.ativo ? "Tirar do FN Home" : "Voltar ao FN Home"} className="fnml-btn-lista" style={{ ...btnLeve, padding: "6px 9px" }}
                        onClick={() => acao(p, { ativo: !p.ativo }, p.ativo ? "Saiu do FN Home ✓" : "Voltou ao FN Home ✓")}>
                        {p.ativo ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button title="Excluir" aria-label="Excluir" className="fnml-btn-lista" style={{ ...btnLeve, padding: "6px 9px", color: VERMELHO }} onClick={() => excluir(p)}><Trash2 size={14} /></button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
