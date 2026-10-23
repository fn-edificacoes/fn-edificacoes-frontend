/* ============================================================
   EMPREENDIMENTOS DO CADASTRO — a lista que o cliente vê no "Cadastre-se"
   ============================================================
   Gerência → Empreendimentos. O cliente escolhe a construtora e depois o empreendimento numa
   lista (AbaCliente, no App.jsx, via GET /api/empreendimentos-ref). Essa lista tem duas
   fontes, e esta tela mostra as duas juntas:
     - a planilha do Drive, que a sincronização apaga e recria — nome e construtora se corrigem
       lá; aqui dá para desativar e ajustar tipologias;
     - os empreendimentos que a Gerência cria aqui, que a sincronização não toca.
   Salvou, já aparece no formulário público. Regras no servidor: src/empreendimentos-cadastro.js.

   Arquivo à parte como a Rede Nacional: o App.jsx só o encaixa e entrega o apiFetch. */
import React, { useEffect, useMemo, useState } from "react";
import { Building2, Plus, X, Pencil, Trash2, RefreshCcw, Search, Loader2 } from "lucide-react";

const AZUL_MEDIO = "#2C75B5";
const AZUL_MARINHO = "#12335B";
const CINZA_CLARO = "#F1F4F8";
const CINZA_BORDA = "#D8DEE7";
const VERDE = "#0F7259";
const VERMELHO = "#C62828";
const AMBAR = "#B26A00";

const lab = { fontSize: 12, fontWeight: 600, color: "#5a6a80" };
const inp = { padding: "8px 10px", border: `1px solid ${CINZA_BORDA}`, borderRadius: 8, fontSize: 13.5, outline: "none", background: "#fff", fontFamily: "inherit", minWidth: 0, width: "100%", boxSizing: "border-box" };
const th = { textAlign: "left", fontSize: 11.5, fontWeight: 700, color: "#5a6a80", padding: "8px 8px", borderBottom: `1px solid ${CINZA_BORDA}`, whiteSpace: "nowrap", position: "sticky", top: 0, background: "#fff" };
const td = { fontSize: 13, padding: "8px 8px", borderBottom: `1px solid ${CINZA_CLARO}`, verticalAlign: "top" };
const btn = { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "none", background: AZUL_MEDIO, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };
const btnLeve = { ...btn, background: "#fff", color: AZUL_MARINHO, border: `1px solid ${CINZA_BORDA}` };

function Etiqueta({ cor = AZUL_MEDIO, children }) {
  return <span style={{ display: "inline-block", fontSize: 11.5, fontWeight: 700, color: cor, background: `${cor}14`, border: `1px solid ${cor}33`, borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>{children}</span>;
}
function Campo({ label, children, largo, dica }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: largo ? "1 1 100%" : "1 1 220px", minWidth: 0 }}>
      <span style={lab}>{label}</span>
      {children}
      {dica && <span style={{ fontSize: 11.5, color: "#8593a8" }}>{dica}</span>}
    </label>
  );
}

const linhaVazia = () => ({ tipologia: "", areaPrivativa: "", ambientes: "" });

/* Tipologias são opcionais. Quando existem, o cliente escolhe a dele no cadastro e a área
   privativa vem preenchida. Sempre sobra uma linha em branco para digitar a próxima — o
   servidor ignora linha toda vazia. */
function EditorTipologias({ linhas, setLinhas }) {
  const mudar = (i, campo, valor) => setLinhas(linhas.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {linhas.map((l, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.3fr) minmax(0, .8fr) auto", gap: 6, alignItems: "center" }}>
          <input style={inp} placeholder="Tipologia (ex.: 2 quartos)" value={l.tipologia} onChange={(e) => mudar(i, "tipologia", e.target.value)} />
          <input style={inp} placeholder="Área (ex.: 58,40 m²)" value={l.areaPrivativa} onChange={(e) => mudar(i, "areaPrivativa", e.target.value)} />
          <input style={inp} placeholder="Ambientes" inputMode="numeric" value={l.ambientes ?? ""} onChange={(e) => mudar(i, "ambientes", e.target.value.replace(/\D/g, "").slice(0, 2))} />
          <button type="button" aria-label="Tirar esta tipologia" title="Tirar esta tipologia" style={{ border: "none", background: "none", cursor: "pointer", color: "#8593a8", padding: 4 }}
            onClick={() => setLinhas(linhas.length > 1 ? linhas.filter((_, j) => j !== i) : [linhaVazia()])}>
            <X size={16} />
          </button>
        </div>
      ))}
      <button type="button" style={{ ...btnLeve, justifySelf: "start" }} onClick={() => setLinhas([...linhas, linhaVazia()])}>
        <Plus size={14} /> Outra tipologia
      </button>
    </div>
  );
}

const paraEditor = (tipologias = []) => (tipologias.length
  ? tipologias.map((t) => ({ tipologia: t.tipologia || "", areaPrivativa: t.areaPrivativa || "", ambientes: t.ambientes ?? "" }))
  : [linhaVazia()]);

export default function AbaEmpreendimentosCadastro({ token, apiFetch, notify, aoMudar }) {
  const [lista, setLista] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState("ativos");
  const [origem, setOrigem] = useState("todas");
  const [editando, setEditando] = useState(null);
  const [alternando, setAlternando] = useState(null);

  const [novo, setNovo] = useState({ construtora: "", empreendimento: "" });
  const [novasTipologias, setNovasTipologias] = useState([linhaVazia()]);
  const [salvandoNovo, setSalvandoNovo] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    try {
      const r = await apiFetch("/api/empreendimentos-cadastro", { token });
      setLista(r.empreendimentos || []);
    } catch (e) { notify(`Não foi possível carregar a lista: ${e.message}`); }
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, []);

  /* Toda gravação recarrega esta lista e a do App (Preços por empreendimento, Importar base),
     que leem a mesma rota do formulário público. */
  const depoisDeGravar = async () => { await carregar(); if (aoMudar) aoMudar(); };

  const construtoras = useMemo(
    () => [...new Set((lista || []).map((e) => e.construtora).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [lista]
  );

  const termo = busca.trim().toLowerCase();
  const visiveis = (lista || [])
    .filter((e) => situacao === "todos" || (situacao === "ativos" ? e.ativo : !e.ativo))
    .filter((e) => origem === "todas" || (origem === "manual" ? e.origem === "manual" : e.origem !== "manual"))
    .filter((e) => !termo || `${e.empreendimento} ${e.construtora}`.toLowerCase().includes(termo));
  const total = lista?.length || 0;
  const ativos = (lista || []).filter((e) => e.ativo).length;
  const manuais = (lista || []).filter((e) => e.origem === "manual").length;

  const adicionar = async () => {
    if (!novo.construtora.trim()) { notify("Informe a construtora"); return; }
    if (!novo.empreendimento.trim()) { notify("Informe o nome do empreendimento"); return; }
    setSalvandoNovo(true);
    try {
      await apiFetch("/api/empreendimentos-cadastro", { method: "POST", token,
        body: { construtora: novo.construtora.trim(), empreendimento: novo.empreendimento.trim(), tipologias: novasTipologias } });
      notify("Empreendimento adicionado — já aparece no cadastro do cliente ✓");
      setNovo({ construtora: novo.construtora, empreendimento: "" });
      setNovasTipologias([linhaVazia()]);
      await depoisDeGravar();
    } catch (e) { notify(`Não foi possível adicionar: ${e.message}`); }
    setSalvandoNovo(false);
  };

  const alternarAtivo = async (e) => {
    setAlternando(e.chave);
    try {
      await apiFetch("/api/empreendimentos-cadastro", { method: "PATCH", token, body: { empreendimento: e.empreendimento, ativo: !e.ativo } });
      notify(e.ativo ? `"${e.empreendimento}" saiu do cadastro do cliente ✓` : `"${e.empreendimento}" voltou ao cadastro do cliente ✓`);
      await depoisDeGravar();
    } catch (err) { notify(`Não foi possível alterar: ${err.message}`); }
    setAlternando(null);
  };

  return (
    <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
      <section style={{ background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 14, padding: 18, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: CINZA_CLARO, display: "grid", placeItems: "center" }}><Building2 size={16} color={AZUL_MEDIO} /></div>
          <h3 style={{ margin: 0, fontSize: 15, color: AZUL_MARINHO, flex: 1 }}>Novo empreendimento</h3>
        </div>
        <p style={{ fontSize: 13, color: "#5a6a80", margin: "0 0 12px" }}>
          É a lista que o cliente usa no "Cadastre-se" para achar o empreendimento dele. O que for adicionado aqui aparece
          na hora, e continua lá depois da sincronização da planilha do Drive. Também entra em Preços por empreendimento.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Campo label="Construtora" dica="Escolha uma da lista ou digite uma nova.">
            <input list="construtoras-cadastro" style={inp} placeholder="Construtora" value={novo.construtora}
              onChange={(e) => setNovo({ ...novo, construtora: e.target.value })} />
            <datalist id="construtoras-cadastro">{construtoras.map((c) => <option key={c} value={c} />)}</datalist>
          </Campo>
          <Campo label="Nome do empreendimento" dica="Do jeito que o cliente vai procurar.">
            <input style={inp} placeholder="Ex.: Residencial Vila das Palmeiras" value={novo.empreendimento}
              onChange={(e) => setNovo({ ...novo, empreendimento: e.target.value })} />
          </Campo>
          <Campo label="Tipologias (opcional)" largo dica="Com tipologia, o cliente escolhe a dele e a área privativa vem preenchida.">
            <EditorTipologias linhas={novasTipologias} setLinhas={setNovasTipologias} />
          </Campo>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button style={{ ...btn, opacity: salvandoNovo ? 0.6 : 1 }} disabled={salvandoNovo} onClick={adicionar}>
            {salvandoNovo ? <Loader2 size={15} className="spin" /> : <Plus size={15} />} Adicionar à lista
          </button>
        </div>
      </section>

      <section style={{ background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 14, padding: 18, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, fontSize: 15, color: AZUL_MARINHO, flex: 1 }}>Empreendimentos na lista</h3>
          <span style={{ fontSize: 12.5, color: "#8593a8" }}>{ativos} de {total} aparecem para o cliente · {manuais} adicionados aqui</span>
          <button style={btnLeve} onClick={carregar} disabled={carregando}><RefreshCcw size={14} /> Atualizar</button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 220px", minWidth: 0 }}>
            <Search size={14} color="#8593a8" style={{ position: "absolute", left: 10, top: 11 }} />
            <input style={{ ...inp, paddingLeft: 30 }} placeholder="Buscar empreendimento ou construtora…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <select style={{ ...inp, width: "auto" }} value={situacao} onChange={(e) => setSituacao(e.target.value)}>
            <option value="ativos">Aparecem para o cliente</option>
            <option value="desativados">Desativados</option>
            <option value="todos">Todos</option>
          </select>
          <select style={{ ...inp, width: "auto" }} value={origem} onChange={(e) => setOrigem(e.target.value)}>
            <option value="todas">Planilha e adicionados aqui</option>
            <option value="manual">Só adicionados aqui</option>
            <option value="planilha">Só da planilha</option>
          </select>
        </div>

        {carregando && !lista && <div style={{ padding: 16, color: "#7a889c", fontSize: 13 }}>Carregando…</div>}
        {lista && visiveis.length === 0 && (
          <div style={{ padding: 16, textAlign: "center", color: "#7a889c", fontSize: 13 }}>
            {total === 0 ? "A lista ainda está vazia." : "Nenhum empreendimento com esse filtro."}
          </div>
        )}
        {visiveis.length > 0 && (
          <div style={{ overflow: "auto", maxHeight: 560 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>{["Empreendimento", "Construtora", "Origem", "Tipologias", "Cadastros", "Situação", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {visiveis.map((e) => (
                  <tr key={e.chave} style={{ opacity: e.ativo ? 1 : 0.6 }}>
                    <td style={{ ...td, fontWeight: 600, color: AZUL_MARINHO }}>{e.empreendimento}</td>
                    <td style={td}>{e.construtora || <span style={{ color: AMBAR }}>sem construtora</span>}</td>
                    <td style={td}>
                      {e.origem === "manual"
                        ? <Etiqueta cor={VERDE}>{e.naPlanilha ? "Aqui · também na planilha" : "Adicionado aqui"}</Etiqueta>
                        : <Etiqueta>{e.naPlanilha ? "Planilha" : "Saiu da planilha"}</Etiqueta>}
                    </td>
                    <td style={td}>{e.tipologias.length || "—"}</td>
                    <td style={td}>{e.cadastrosUsando || "—"}</td>
                    <td style={td}>{e.ativo ? <Etiqueta cor={VERDE}>Aparece</Etiqueta> : <Etiqueta cor={VERMELHO}>Desativado</Etiqueta>}</td>
                    <td style={td}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "flex-end" }}>
                      <button style={{ ...btnLeve, padding: "5px 9px" }} onClick={() => setEditando(e)}><Pencil size={13} /> Editar</button>
                      <button style={{ ...btnLeve, padding: "5px 9px", color: e.ativo ? VERMELHO : VERDE }} disabled={alternando === e.chave}
                        onClick={() => alternarAtivo(e)}>
                        {alternando === e.chave ? <Loader2 size={13} className="spin" /> : e.ativo ? <Trash2 size={13} /> : <RefreshCcw size={13} />}
                        {e.ativo ? "Desativar" : "Reativar"}
                      </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editando && (
        <ModalEditar empreendimento={editando} construtoras={construtoras} token={token} apiFetch={apiFetch} notify={notify}
          aoFechar={() => setEditando(null)} aoSalvar={depoisDeGravar} />
      )}
    </div>
  );
}

function ModalEditar({ empreendimento: e, construtoras, token, apiFetch, notify, aoFechar, aoSalvar }) {
  const [nome, setNome] = useState(e.empreendimento);
  const [construtora, setConstrutora] = useState(e.construtora || "");
  const [tipologias, setTipologias] = useState(paraEditor(e.tipologias));
  /* Corrigir o nome normalmente é corrigir um erro de digitação, e quem já se cadastrou com
     o nome errado deveria acompanhar. Mas isso altera cadastros reais, então fica à vista. */
  const [renomearCadastros, setRenomearCadastros] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const nomeMudou = nome.trim() !== e.empreendimento;

  const salvar = async () => {
    const corpo = { empreendimento: e.empreendimento, tipologias };
    if (e.editavel) {
      if (!nome.trim()) { notify("Informe o nome do empreendimento"); return; }
      if (!construtora.trim()) { notify("Informe a construtora"); return; }
      corpo.novoNome = nome.trim();
      corpo.construtora = construtora.trim();
      if (nomeMudou && e.cadastrosUsando > 0) corpo.renomearCadastros = renomearCadastros;
    }
    setSalvando(true);
    try {
      const r = await apiFetch("/api/empreendimentos-cadastro", { method: "PATCH", token, body: corpo });
      notify(r.cadastrosComNomeAntigo
        ? `Salvo. ${r.cadastrosComNomeAntigo} cadastro(s) continuam com o nome antigo — trate em Visão geral → Padronização.`
        : r.cadastrosRenomeados ? `Salvo ✓ ${r.cadastrosRenomeados} cadastro(s) passaram a usar o nome novo.` : "Salvo ✓");
      await aoSalvar();
      aoFechar();
    } catch (err) { notify(`Não foi possível salvar: ${err.message}`); }
    setSalvando(false);
  };

  return (
    <div onClick={aoFechar} style={{ position: "fixed", inset: 0, background: "rgba(10,25,45,.45)", display: "grid", placeItems: "center", zIndex: 1000, padding: 16, overflowY: "auto", overscrollBehavior: "contain" }}>
      <div onClick={(ev) => ev.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 20, width: "min(620px, 100%)", maxHeight: "90vh", overflowY: "auto", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: AZUL_MARINHO, flex: 1 }}>Editar empreendimento</h3>
          <button onClick={aoFechar} style={{ border: "none", background: "none", cursor: "pointer" }} aria-label="Fechar"><X size={18} /></button>
        </div>
        {!e.editavel && (
          <p style={{ fontSize: 12.5, color: "#5a6a80", background: CINZA_CLARO, borderRadius: 8, padding: "8px 10px", margin: "0 0 12px" }}>
            Este vem da planilha do Drive: nome e construtora se corrigem na planilha, senão a próxima sincronização
            desfaria a correção. Aqui dá para ajustar as tipologias e desativar.
          </p>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Campo label="Construtora">
            <input list="construtoras-editar" style={{ ...inp, background: e.editavel ? "#fff" : CINZA_CLARO }} value={construtora} disabled={!e.editavel} onChange={(ev) => setConstrutora(ev.target.value)} />
            <datalist id="construtoras-editar">{construtoras.map((c) => <option key={c} value={c} />)}</datalist>
          </Campo>
          <Campo label="Nome do empreendimento">
            <input style={{ ...inp, background: e.editavel ? "#fff" : CINZA_CLARO }} value={nome} disabled={!e.editavel} onChange={(ev) => setNome(ev.target.value)} />
          </Campo>
          {e.editavel && nomeMudou && e.cadastrosUsando > 0 && (
            <label style={{ flex: "1 1 100%", display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: "#4a5a70", background: "#FFF6E5", borderRadius: 8, padding: "8px 10px" }}>
              <input type="checkbox" checked={renomearCadastros} onChange={(ev) => setRenomearCadastros(ev.target.checked)} style={{ marginTop: 2 }} />
              <span>Também corrigir o nome nos <b>{e.cadastrosUsando}</b> cadastro(s) de cliente que já usam "{e.empreendimento}".</span>
            </label>
          )}
          <Campo label="Tipologias" largo dica="Com tipologia, o cliente escolhe a dele e a área privativa vem preenchida.">
            <EditorTipologias linhas={tipologias} setLinhas={setTipologias} />
          </Campo>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button style={btnLeve} onClick={aoFechar}>Cancelar</button>
          <button style={{ ...btn, opacity: salvando ? 0.6 : 1 }} disabled={salvando} onClick={salvar}>
            {salvando && <Loader2 size={14} className="spin" />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
