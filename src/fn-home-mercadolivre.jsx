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
   afiliados de lá. O sistema só conta os cliques no botão. Tudo é cadastrado à mão porque o
   Mercado Livre não tem API para afiliado e a API pública dele recusa consulta de anúncio sem
   aplicativo autorizado (out/2026) — por isso o preço vem sempre com a data em que foi conferido.

   Arquivo à parte como a Rede Nacional: o App.jsx só o encaixa e entrega o apiFetch. */
import React, { useEffect, useMemo, useState } from "react";
import { ShoppingBag, ExternalLink, Plus, Pencil, Trash2, RefreshCcw, Loader2, X, Search, Upload, CalendarCheck, Eye, EyeOff, MousePointerClick } from "lucide-react";

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

/* Some quando não há produto — e também quando a API falha: para o cliente, uma seção vazia
   ou um erro no meio do FN Home seria pior que nada. A falha fica no console. */
export function SecaoOfertasMercadoLivre({ apiFetch, aoCarregar, separar = true }) {
  const [produtos, setProdutos] = useState([]);
  const [categoria, setCategoria] = useState("");

  useEffect(() => {
    let vivo = true;
    apiFetch("/api/afiliados/mercadolivre/vitrine")
      .then((r) => { if (!vivo) return; const lista = r?.produtos || []; setProdutos(lista); aoCarregar?.(lista.length); })
      .catch((e) => { console.warn("Ofertas do Mercado Livre não carregaram:", e.message); aoCarregar?.(0); });
    return () => { vivo = false; };
  }, []);

  const categorias = useMemo(() => [...new Set(produtos.map((p) => p.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")), [produtos]);
  if (produtos.length === 0) return null;
  const visiveis = categoria ? produtos.filter((p) => p.categoria === categoria) : produtos;

  /* O botão é o próprio link do Mercado Livre: a compra não depende da nossa API. O aviso de
     clique vai junto, sem esperar resposta — se falhar, perde-se só a contagem. */
  const registrarClique = (id) => {
    apiFetch(`/api/afiliados/mercadolivre/${encodeURIComponent(id)}/clique`, { method: "POST" }).catch(() => {});
  };

  return (
    <div style={separar ? { marginTop: 22, paddingTop: 18, borderTop: `1px solid ${CINZA_BORDA}` } : {}}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <ShoppingBag size={17} color={AZUL_MEDIO} />
        <h4 style={{ margin: 0, fontSize: 15, color: AZUL_MARINHO }}>Ofertas no Mercado Livre</h4>
      </div>
      <p style={{ fontSize: 13, color: "#65758b", margin: "0 0 12px" }}>
        Produtos para o seu imóvel escolhidos pela FN. A compra é feita no Mercado Livre.
      </p>

      {categorias.length > 1 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {["", ...categorias].map((c) => (
            <button key={c || "todas"} onClick={() => setCategoria(c)}
              style={{ border: `1px solid ${categoria === c ? AZUL_MEDIO : CINZA_BORDA}`, background: categoria === c ? "#EAF2FB" : "#fff", color: categoria === c ? AZUL_MEDIO : "#4a5a70", borderRadius: 999, padding: "5px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
              {c || "Todas"}
            </button>
          ))}
        </div>
      )}

      {/* 130 px cabe duas por linha no celular — produto em coluna única vira rolagem sem fim. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
        {visiveis.map((p) => {
          const off = desconto(p);
          return (
            <div key={p.id} style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column", background: "#fff", minWidth: 0 }}>
              <div style={{ position: "relative", height: 140, background: "#fff", display: "grid", placeItems: "center", borderBottom: `1px solid ${CINZA_CLARO}` }}>
                {p.foto
                  ? <img src={p.foto} alt={p.titulo} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  : <ShoppingBag size={28} color="#b8c3d3" />}
                {off && (
                  <span style={{ position: "absolute", top: 8, left: 8, fontSize: 11, fontWeight: 700, color: "#fff", background: VERDE, borderRadius: 6, padding: "2px 7px" }}>-{off}%</span>
                )}
              </div>
              <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1a2330", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }} title={p.titulo}>
                  {p.titulo}
                </div>
                <div style={{ marginTop: "auto" }}>
                  {off && <div style={{ fontSize: 11.5, color: "#8593a8", textDecoration: "line-through" }}>{fmtReal(p.preco_de)}</div>}
                  {p.preco
                    ? <div style={{ fontSize: 16, fontWeight: 700, color: AZUL_MARINHO }}>{fmtReal(p.preco)}</div>
                    : <div style={{ fontSize: 12.5, color: "#65758b" }}>Veja o preço no Mercado Livre</div>}
                  {p.preco && p.preco_conferido_em && (
                    <div style={{ fontSize: 10.5, color: "#8593a8" }}>Preço em {fmtDia(p.preco_conferido_em)}</div>
                  )}
                </div>
                <a className="btn-solid" href={p.link} target="_blank" rel="noopener noreferrer sponsored nofollow"
                  onClick={() => registrarClique(p.id)}
                  style={{ justifyContent: "center", marginTop: 8, padding: "8px", textDecoration: "none", display: "flex", fontSize: 12.5 }}>
                  <ExternalLink size={13} /> Comprar no Mercado Livre
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Publicidade com link de afiliado se identifica como tal — e o cliente precisa saber
          de quem cobrar a entrega e a garantia, que não são da FN. */}
      <p style={{ fontSize: 11.5, color: "#8593a8", margin: "12px 0 0", lineHeight: 1.5 }}>
        Links de afiliado: a FN pode receber comissão do Mercado Livre pelas compras feitas por eles, sem custo a mais para você.
        O preço pode ter mudado desde a data indicada; valor final, entrega, troca e garantia são do Mercado Livre e do vendedor.
      </p>
    </div>
  );
}

/* ---------------- Gerência ---------------- */

const formVazio = () => ({ id: null, link: "", titulo: "", categoria: "", preco: "", preco_de: "", foto: "", ativo: true });
const paraForm = (p) => ({
  id: p.id, link: p.link || "", titulo: p.titulo || "", categoria: p.categoria || "",
  preco: p.preco != null ? String(Number(p.preco)) : "", preco_de: p.preco_de != null ? String(Number(p.preco_de)) : "",
  foto: p.foto || "", ativo: p.ativo !== false,
});

export default function AbaProdutosMercadoLivre({ token, apiFetch, notify, redimensionar }) {
  const [lista, setLista] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [form, setForm] = useState(formVazio());
  const [salvando, setSalvando] = useState(false);
  const [mexendo, setMexendo] = useState(null); // id da linha com ação em andamento
  const [busca, setBusca] = useState("");

  const carregar = async () => {
    setCarregando(true);
    try {
      const r = await apiFetch("/api/afiliados/mercadolivre", { token });
      setLista(r.produtos || []);
    } catch (e) { notify(`Não foi possível carregar os produtos: ${e.message}`); }
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, []);

  const categorias = useMemo(() => [...new Set((lista || []).map((p) => p.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")), [lista]);
  const termo = busca.trim().toLowerCase();
  const visiveis = (lista || []).filter((p) => !termo || `${p.titulo} ${p.categoria}`.toLowerCase().includes(termo));
  const naVitrine = (lista || []).filter((p) => p.ativo).length;
  const cliques = (lista || []).reduce((s, p) => s + (Number(p.cliques) || 0), 0);

  const mudar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));
  const avisoLink = form.link.trim() && !pareceLinkDeAfiliado(form.link.trim());

  const onArquivoFoto = (e) => {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    if (!arquivo.type.startsWith("image/")) { notify("Envie uma imagem (JPG ou PNG)."); return; }
    const leitor = new FileReader();
    // 600 px basta para o card da vitrine e mantém cada foto em dezenas de KB.
    leitor.onload = async () => mudar("foto", await redimensionar(leitor.result, 600));
    leitor.readAsDataURL(arquivo);
  };

  const salvar = async () => {
    if (!form.link.trim()) { notify("Cole o link de afiliado do produto."); return; }
    if (!form.titulo.trim()) { notify("Informe o nome do produto."); return; }
    setSalvando(true);
    const corpo = {
      link: form.link.trim(), titulo: form.titulo.trim(), categoria: form.categoria.trim(),
      preco: form.preco === "" ? null : form.preco, preco_de: form.preco_de === "" ? null : form.preco_de,
      foto: form.foto, ativo: form.ativo,
    };
    try {
      if (form.id) {
        await apiFetch(`/api/afiliados/mercadolivre/${encodeURIComponent(form.id)}`, { method: "PATCH", token, body: corpo });
        notify("Produto atualizado ✓");
      } else {
        await apiFetch("/api/afiliados/mercadolivre", { method: "POST", token, body: corpo });
        notify("Produto cadastrado — já aparece no FN Home ✓");
      }
      setForm(formVazio());
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
      if (form.id === p.id) setForm(formVazio());
      await carregar();
    } catch (e) { notify(`Não foi possível excluir: ${e.message}`); }
    setMexendo(null);
  };

  return (
    <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
      <section style={secao}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: CINZA_CLARO, display: "grid", placeItems: "center" }}><ShoppingBag size={16} color={AZUL_MEDIO} /></div>
          <h3 style={{ margin: 0, fontSize: 15, color: AZUL_MARINHO, flex: 1 }}>{form.id ? "Editar produto" : "Novo produto do Mercado Livre"}</h3>
          {form.id && <button style={btnLeve} onClick={() => setForm(formVazio())}><X size={14} /> Cancelar edição</button>}
        </div>
        <p style={{ fontSize: 13, color: "#5a6a80", margin: "0 0 12px", lineHeight: 1.5 }}>
          No <a href={PORTAL_AFILIADOS} target="_blank" rel="noreferrer" style={{ color: AZUL_MEDIO }}>portal de afiliados do Mercado Livre</a>,
          gere o link do produto e cole aqui com o nome, a foto e o preço que aparece hoje. O produto entra na vitrine do
          FN Home com o botão "Comprar no Mercado Livre"; a venda e a comissão aparecem no painel de afiliados de lá.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Campo label="Link de afiliado *" largo
            dica={avisoLink ? null : "O link que o portal gera começa com https://mercadolivre.com/sec/…"}>
            <input style={inp} type="url" placeholder="https://mercadolivre.com/sec/..." value={form.link} onChange={(e) => mudar("link", e.target.value)} />
            {avisoLink && (
              <span style={{ fontSize: 12, color: AMBAR, background: "#FFF4E0", borderRadius: 6, padding: "6px 8px", lineHeight: 1.4 }}>
                Este parece ser o endereço da página do produto, não o link de afiliado. Assim o produto abre normalmente, mas a FN
                não recebe comissão. Gere o link no portal de afiliados e cole aqui.
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
            <input style={inp} type="number" min="0" step="0.01" placeholder="199,90" value={form.preco} onChange={(e) => mudar("preco", e.target.value)} />
          </Campo>
          <Campo label={'Preço "De" (R$, opcional)'} dica="Só quando o anúncio mostra preço riscado.">
            <input style={inp} type="number" min="0" step="0.01" placeholder="249,90" value={form.preco_de} onChange={(e) => mudar("preco_de", e.target.value)} />
          </Campo>
          <Campo label="Foto" largo dica={'Na página do produto, clique com o botão direito na foto → "Copiar endereço da imagem" e cole aqui. Ou envie um arquivo.'}>
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
              <input style={{ ...inp, flex: "1 1 220px", width: "auto" }} placeholder="https://http2.mlstatic.com/..."
                value={form.foto.startsWith("data:") ? "" : form.foto} disabled={form.foto.startsWith("data:")}
                onChange={(e) => mudar("foto", e.target.value.trim())} />
              <label style={{ ...btnLeve, cursor: "pointer" }}>
                <Upload size={14} /> Enviar arquivo
                <input type="file" accept="image/*" onChange={onArquivoFoto} style={{ display: "none" }} />
              </label>
            </div>
          </Campo>
          {form.id && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#1a2330", flex: "1 1 100%" }}>
              <input type="checkbox" checked={form.ativo} onChange={(e) => mudar("ativo", e.target.checked)} />
              Aparece no FN Home
            </label>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
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
        <p style={{ fontSize: 12.5, color: "#8593a8", margin: "0 0 12px" }}>
          Cliques contados no botão "Comprar no Mercado Livre". Vendas e comissão só aparecem no painel de afiliados do Mercado Livre.
          Preço conferido há mais de {DIAS_PRECO_VELHO} dias fica em amarelo: confira no anúncio e use "Conferi hoje" ou edite o valor.
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
                <div style={{ width: 56, height: 56, borderRadius: 8, border: `1px solid ${CINZA_CLARO}`, background: "#fff", display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0 }}>
                  {p.foto ? <img src={p.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <ShoppingBag size={20} color="#b8c3d3" />}
                </div>
                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1a2330", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.titulo}>{p.titulo}</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 4, fontSize: 12, color: "#65758b" }}>
                    {p.ativo ? <Etiqueta cor={VERDE}>No FN Home</Etiqueta> : <Etiqueta cor="#65758b">Fora do FN Home</Etiqueta>}
                    {p.categoria && <Etiqueta>{p.categoria}</Etiqueta>}
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><MousePointerClick size={12} /> {p.cliques || 0}</span>
                  </div>
                </div>
                <div style={{ flex: "0 1 170px", fontSize: 12.5 }}>
                  {p.preco != null ? (
                    <>
                      <strong style={{ color: AZUL_MARINHO, fontSize: 14 }}>{fmtReal(p.preco)}</strong>
                      {p.preco_de != null && <span style={{ color: "#8593a8", textDecoration: "line-through", marginLeft: 6 }}>{fmtReal(p.preco_de)}</span>}
                      <div style={{ color: velho ? AMBAR : "#8593a8", fontWeight: velho ? 700 : 400 }}>
                        {velho ? `Conferido há ${dias} dias` : `Conferido em ${fmtDia(p.preco_conferido_em)}`}
                      </div>
                    </>
                  ) : <span style={{ color: "#8593a8" }}>Sem preço na vitrine</span>}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {ocupado ? <Loader2 size={16} className="spin" color={AZUL_MEDIO} /> : (
                    <>
                      <a href={p.link} target="_blank" rel="noreferrer" title="Abrir o anúncio" style={{ ...btnLeve, padding: "6px 9px", textDecoration: "none" }}><ExternalLink size={14} /></a>
                      <button title="Editar" style={{ ...btnLeve, padding: "6px 9px" }} onClick={() => { setForm(paraForm(p)); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Pencil size={14} /></button>
                      {p.preco != null && (
                        <button title="O preço continua o mesmo: marcar como conferido hoje" style={{ ...btnLeve, padding: "6px 9px", color: velho ? AMBAR : AZUL_MARINHO }}
                          onClick={() => acao(p, { conferirPreco: true }, "Preço marcado como conferido hoje ✓")}>
                          <CalendarCheck size={14} /> Conferi hoje
                        </button>
                      )}
                      <button title={p.ativo ? "Tirar do FN Home" : "Voltar ao FN Home"} style={{ ...btnLeve, padding: "6px 9px" }}
                        onClick={() => acao(p, { ativo: !p.ativo }, p.ativo ? "Saiu do FN Home ✓" : "Voltou ao FN Home ✓")}>
                        {p.ativo ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button title="Excluir" style={{ ...btnLeve, padding: "6px 9px", color: VERMELHO }} onClick={() => excluir(p)}><Trash2 size={14} /></button>
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
