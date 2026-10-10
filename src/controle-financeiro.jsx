/* ============================================================
   CONTROLE FINANCEIRO — ARTs de vistoria, pagamento de técnicos e valores dos custos
   ============================================================
   Arquivo à parte, como a Rede Nacional: o App.jsx só encaixa estas telas e entrega o
   apiFetch (o único caminho para a API) e as funções de regra que já moram lá
   (chave do empreendimento, data do atendimento) — para a regra não existir duas vezes.

   A regra do dinheiro mora no servidor (src/custos.js no backend): R$ 100 a 1ª vistoria do
   técnico no dia, R$ 80 as seguintes, revistoria sempre R$ 80; ART múltipla de vistoria de
   R$ 69 para até 50 pessoas do mesmo empreendimento, válida por 30 dias a partir da emissão.
   Aqui a tela só mostra o que o servidor calculou e manda as ações. Cada pagamento de técnico
   e cada ART emitida vira UMA despesa no Financeiro, lançada pelo próprio sistema. */
import React, { useEffect, useMemo, useState } from "react";
import {
  FileCheck, Users, Plus, X, Check, RefreshCcw, Search, Trash2, ChevronDown, ChevronRight, Save, Wallet, Settings,
  Repeat, Paperclip, RotateCcw, Edit3, Power,
} from "lucide-react";
import { CATEGORIAS, CATEGORIAS_DESPESA, FORMAS_PAGAMENTO } from "./financeiro-regras.js";

const AZUL_MEDIO = "#2C75B5";
const AZUL_MARINHO = "#12335B";
const CINZA_CLARO = "#F1F4F8";
const CINZA_BORDA = "#D8DEE7";
const VERDE = "#1B7F4B";
const VERMELHO = "#C62828";
const AMBAR = "#B26A00";

const lab = { fontSize: 12, fontWeight: 600, color: "#5a6a80" };
const inp = { padding: "8px 10px", border: `1px solid ${CINZA_BORDA}`, borderRadius: 8, fontSize: 13.5, outline: "none", background: "#fff", fontFamily: "inherit", minWidth: 0 };
const th = { textAlign: "left", fontSize: 11.5, fontWeight: 700, color: "#5a6a80", padding: "8px 8px", borderBottom: `1px solid ${CINZA_BORDA}`, whiteSpace: "nowrap" };
const td = { fontSize: 13, padding: "8px 8px", borderBottom: `1px solid ${CINZA_CLARO}`, verticalAlign: "top" };
const tdN = { ...td, whiteSpace: "nowrap", textAlign: "right" };
const btn = { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "none", background: AZUL_MEDIO, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };
const btnLeve = { ...btn, background: "#fff", color: AZUL_MARINHO, border: `1px solid ${CINZA_BORDA}` };

const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (v) => (v ? String(v).slice(0, 10).split("-").reverse().join("/") : "—");
const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const ultimoDia = (mes) => { const [a, m] = mes.split("-").map(Number); return `${mes}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}`; };
const lerPreferencia = (chave, padrao) => { try { return localStorage.getItem(chave) || padrao; } catch { return padrao; } };
const gravarPreferencia = (chave, valor) => { try { localStorage.setItem(chave, valor); } catch { /* sem storage, só não lembra */ } };

function Caixa({ icon: Icon, titulo, acoes, children }) {
  return (
    <section style={{ background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 14, padding: 18, minWidth: 0, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: CINZA_CLARO, display: "grid", placeItems: "center" }}><Icon size={16} color={AZUL_MEDIO} /></div>
        <h3 style={{ margin: 0, fontSize: 15, color: AZUL_MARINHO, flex: 1 }}>{titulo}</h3>
        {acoes}
      </div>
      {children}
    </section>
  );
}
function Kpi({ rotulo, valor, apoio, cor = AZUL_MARINHO }) {
  return (
    <div style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 12, padding: "11px 13px", background: "#fff", minWidth: 0 }}>
      <div style={{ fontSize: 11.5, color: "#65758b", fontWeight: 600 }}>{rotulo}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: cor, marginTop: 3 }}>{valor}</div>
      {apoio && <div style={{ fontSize: 11.5, color: "#8593a8", marginTop: 2 }}>{apoio}</div>}
    </div>
  );
}
function Pilula({ cor, fundo, children }) {
  return <span style={{ background: fundo, color: cor, borderRadius: 20, padding: "2px 9px", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>{children}</span>;
}
function Aviso({ tom = "atencao", children }) {
  const cores = { atencao: ["#FFF4E0", "#8a5300"], erro: ["#FDECEC", "#A12020"], ok: ["#E6F4EC", VERDE] }[tom];
  return <div style={{ background: cores[0], color: cores[1], borderRadius: 8, padding: "9px 12px", fontSize: 12.5 }}>{children}</div>;
}

/* ============================================================
   ARTs DE VISTORIA (ART múltipla por empreendimento)
   ============================================================
   A lista é a do pré-cadastro em diante: todo cadastro de vistoria/revistoria não cancelado,
   agrupado por empreendimento. Quem ainda não está numa ART aparece em "Sem ART" — é ali que
   se forma o grupo da próxima ART, ou se completa uma ART vigente que ainda tem vaga, em vez
   de pagar uma ART individual para quem chegou depois. */
const ROTULO_ETAPA = {
  "Em análise": "Pré-cadastro", "Agendamento aprovado": "Agendamento aprovado", "Vistoria agendada": "Vistoria agendada",
  "Em vistoria": "Em vistoria",
};

export function AbaArtsVistoria({ token, apiFetch, notify, perfil, clientes = [], chaveEmpreendimento, dataDoAtendimento, ehVistoria, jaVistoriado }) {
  const [arts, setArts] = useState([]);
  const [config, setConfig] = useState({ artValor: 69, artCapacidade: 50, artValidadeDias: 30 });
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState("");
  const [soPendentes, setSoPendentes] = useState(true);
  /* "A partir de hoje": a organização por ART múltipla começou agora. Vistoria antiga, sem ART
     no sistema, não é pendência — a não ser que a Gerência volte a data. */
  const [aPartirDe, setAPartirDe] = useState(() => lerPreferencia("fn_arts_a_partir_de", hoje()));
  const [abertos, setAbertos] = useState({});

  const carregar = async () => {
    setCarregando(true);
    try {
      const r = await apiFetch("/api/arts-vistoria", { token });
      setArts(r.arts || []);
      if (r.config) setConfig(r.config);
    } catch (e) { notify(`Não foi possível carregar as ARTs: ${e.message}`); }
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, []);
  useEffect(() => { gravarPreferencia("fn_arts_a_partir_de", aPartirDe); }, [aPartirDe]);

  const artDoCliente = useMemo(() => {
    const m = {};
    arts.forEach((a) => a.pessoas.forEach((p) => { m[p.clienteId] = a; }));
    return m;
  }, [arts]);
  const clientePorId = useMemo(() => Object.fromEntries(clientes.map((c) => [c.id, c])), [clientes]);

  /* Agrupa por empreendimento: as pessoas (pré-cadastro em diante) e as ARTs emitidas. */
  const grupos = useMemo(() => {
    const mapa = {};
    const grupo = (nome) => {
      const chave = chaveEmpreendimento(nome || "(sem empreendimento)");
      return (mapa[chave] ||= { chave, nomes: {}, pessoas: [], arts: [] });
    };
    clientes.forEach((c) => {
      if (!ehVistoria(c) || c.status === "Cancelado" || c.status === "Cancelamento solicitado" || c.origem === "importacao") return;
      const g = grupo(c.empreendimento);
      const grafia = (c.empreendimento || "").trim() || "(sem empreendimento)";
      g.nomes[grafia] = (g.nomes[grafia] || 0) + 1;
      const data = dataDoAtendimento(c) || "";
      const art = artDoCliente[c.id] || null;
      g.pessoas.push({ c, data, art, feita: jaVistoriado(c) });
    });
    arts.forEach((a) => {
      const g = grupo(a.empreendimento);
      g.nomes[a.empreendimento] = (g.nomes[a.empreendimento] || 0) + 1;
      g.arts.push(a);
    });
    return Object.values(mapa).map((g) => {
      const nome = Object.entries(g.nomes).sort((a, b) => b[1] - a[1])[0]?.[0] || g.chave;
      /* Sem ART e dentro do recorte: sem data (pré-cadastro ainda sem dia marcado) sempre entra. */
      const semArt = g.pessoas.filter((p) => !p.art && (!p.data || p.data >= aPartirDe))
        .sort((a, b) => (a.data || "9999").localeCompare(b.data || "9999") || a.c.nome.localeCompare(b.c.nome, "pt-BR"));
      const comArt = g.pessoas.filter((p) => p.art);
      const feitasSemArt = semArt.filter((p) => p.feita).length;
      const vigentes = g.arts.filter((a) => a.validaAte >= hoje() && a.pessoas.length < a.capacidade);
      return { ...g, nome, semArt, comArt, feitasSemArt, vigentes };
    }).sort((a, b) => b.feitasSemArt - a.feitasSemArt || b.semArt.length - a.semArt.length || a.nome.localeCompare(b.nome, "pt-BR"));
  }, [clientes, arts, artDoCliente, aPartirDe]);

  const termo = busca.trim().toLowerCase();
  const visiveis = grupos.filter((g) => (!soPendentes || g.semArt.length > 0) && (!termo || g.nome.toLowerCase().includes(termo)));

  const mesAtual = hoje().slice(0, 7);
  const artsDoMes = arts.filter((a) => a.emitidaEm.slice(0, 7) === mesAtual);
  const cobertas = arts.reduce((s, a) => s + a.pessoas.length, 0);
  const totalSemArt = grupos.reduce((s, g) => s + g.semArt.length, 0);
  const totalFeitasSemArt = grupos.reduce((s, g) => s + g.feitasSemArt, 0);
  /* O que a ART múltipla poupou: cada pessoa coberta custaria uma ART individual. */
  const economia = Math.max(0, cobertas * config.artValor - arts.length * config.artValor);

  const trocarArt = (nova) => setArts((atual) => atual.some((a) => a.id === nova.id) ? atual.map((a) => (a.id === nova.id ? nova : a)) : [nova, ...atual]);

  return (
    <div style={{ display: "grid", gap: 0 }}>
      <Caixa icon={FileCheck} titulo="ARTs de vistoria por empreendimento"
        acoes={<button style={btnLeve} onClick={carregar}><RefreshCcw size={14} className={carregando ? "spin" : ""} /> Atualizar</button>}>
        <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 14px" }}>
          Uma ART múltipla de vistoria custa <strong>{brl(config.artValor)}</strong> e cobre até <strong>{config.artCapacidade} pessoas</strong> do
          mesmo empreendimento, por <strong>{config.artValidadeDias} dias</strong> a partir da emissão. Quem ainda não está em nenhuma ART aparece
          em "Sem ART": junte essas pessoas na próxima ART — ou numa ART vigente que ainda tem vaga — em vez de fazer individual.
          Cada ART emitida já entra sozinha como despesa no Financeiro.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 14 }}>
          <Kpi rotulo="ARTs emitidas no mês" valor={artsDoMes.length} apoio={`${brl(artsDoMes.length * config.artValor)} · ${arts.length} no total`} />
          <Kpi rotulo="Pessoas cobertas" valor={cobertas} apoio="em todas as ARTs" cor={VERDE} />
          <Kpi rotulo="Sem ART" valor={totalSemArt} apoio={`vistorias desde ${dataBr(aPartirDe)}`} cor={totalSemArt ? AMBAR : VERDE} />
          <Kpi rotulo="Vistoria feita sem ART" valor={totalFeitasSemArt} apoio="precisam entrar numa ART" cor={totalFeitasSemArt ? VERMELHO : VERDE} />
          <Kpi rotulo="Economia vs. individual" valor={brl(economia)} apoio={`${cobertas} pessoas em ${arts.length} ART(s)`} cor={VERDE} />
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ display: "grid", gap: 4, flex: 1, minWidth: 200 }}>
            <label style={lab}>Empreendimento</label>
            <div style={{ position: "relative" }}>
              <Search size={14} color="#8593a8" style={{ position: "absolute", left: 9, top: 10 }} />
              <input style={{ ...inp, width: "100%", paddingLeft: 28 }} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar empreendimento…" />
            </div>
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            <label style={lab}>Vistorias a partir de</label>
            <input style={inp} type="date" value={aPartirDe} onChange={(e) => setAPartirDe(e.target.value || hoje())} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#4a5a70", paddingBottom: 8 }}>
            <input type="checkbox" checked={soPendentes} onChange={(e) => setSoPendentes(e.target.checked)} /> Só com gente sem ART
          </label>
        </div>
      </Caixa>

      {visiveis.length === 0 && (
        <Aviso tom="ok">{carregando ? "Carregando…" : soPendentes ? "Ninguém sem ART neste recorte. ✓" : "Nenhum empreendimento encontrado."}</Aviso>
      )}
      {visiveis.map((g) => (
        <GrupoEmpreendimento key={g.chave} g={g} config={config} perfil={perfil} token={token} apiFetch={apiFetch} notify={notify}
          clientePorId={clientePorId} trocarArt={trocarArt} recarregar={carregar}
          aberto={!!abertos[g.chave]} alternar={() => setAbertos((x) => ({ ...x, [g.chave]: !x[g.chave] }))} />
      ))}
    </div>
  );
}

function GrupoEmpreendimento({ g, config, perfil, token, apiFetch, notify, clientePorId, trocarArt, recarregar, aberto, alternar }) {
  const [marcados, setMarcados] = useState({});
  const [emitindo, setEmitindo] = useState(false);
  const [form, setForm] = useState({ numero: "", emitidaEm: hoje(), observacoes: "" });
  const [enviando, setEnviando] = useState(false);
  const selecionados = g.semArt.filter((p) => marcados[p.c.id]);
  const alternarTodos = () => {
    if (selecionados.length) { setMarcados({}); return; }
    const novos = {};
    g.semArt.slice(0, config.artCapacidade).forEach((p) => { novos[p.c.id] = true; });
    setMarcados(novos);
  };
  /* Quem fica fora da janela de validade da ART: aviso, não bloqueio — a data agendada muda, e
     quem decide é quem emite. */
  const foraDaJanela = (inicio, fim) => selecionados.filter((p) => p.data && (p.data < inicio || p.data > fim));

  const emitir = async () => {
    if (!selecionados.length) return;
    if (selecionados.length > config.artCapacidade) { notify(`Uma ART cobre no máximo ${config.artCapacidade} pessoas.`); return; }
    setEnviando(true);
    try {
      const r = await apiFetch("/api/arts-vistoria", { method: "POST", token, body: {
        empreendimento: g.nome, numero: form.numero, emitidaEm: form.emitidaEm, observacoes: form.observacoes,
        clienteIds: selecionados.map((p) => p.c.id),
      } });
      trocarArt(r.art);
      setMarcados({}); setEmitindo(false); setForm({ numero: "", emitidaEm: hoje(), observacoes: "" });
      notify(`ART emitida com ${r.art.pessoas.length} pessoa(s) ✓ — ${brl(r.art.valor)} lançado nas despesas`);
    } catch (e) { notify(`Não foi possível emitir a ART: ${e.message}`); }
    setEnviando(false);
  };
  const incluirEm = async (art) => {
    setEnviando(true);
    try {
      const r = await apiFetch(`/api/arts-vistoria/${art.id}/pessoas`, { method: "POST", token, body: { clienteIds: selecionados.map((p) => p.c.id) } });
      trocarArt(r.art); setMarcados({});
      notify(`${selecionados.length} pessoa(s) incluída(s) na ART ${art.numero || ""} ✓ — sem custo novo`);
    } catch (e) { notify(`Não foi possível incluir: ${e.message}`); }
    setEnviando(false);
  };
  const tirar = async (art, clienteId) => {
    try {
      const r = await apiFetch(`/api/arts-vistoria/${art.id}/pessoas/${clienteId}`, { method: "DELETE", token });
      trocarArt(r.art);
    } catch (e) { notify(`Não foi possível tirar da ART: ${e.message}`); }
  };
  const excluirArt = async (art) => {
    if (!window.confirm(`Excluir a ART ${art.numero || "sem número"} de ${g.nome}? As ${art.pessoas.length} pessoa(s) voltam para "Sem ART" e a despesa de ${brl(art.valor)} é apagada. Use só para ART lançada por engano.`)) return;
    try {
      await apiFetch(`/api/arts-vistoria/${art.id}`, { method: "DELETE", token });
      recarregar(); notify("ART excluída");
    } catch (e) { notify(`Não foi possível excluir: ${e.message}`); }
  };

  const fora = emitindo ? foraDaJanela(form.emitidaEm, somarDias(form.emitidaEm, config.artValidadeDias)) : [];

  return (
    <section style={{ background: "#fff", border: `1px solid ${g.feitasSemArt ? "#F3C2C2" : CINZA_BORDA}`, borderRadius: 14, padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", cursor: "pointer" }} onClick={alternar}>
        {aberto ? <ChevronDown size={16} color={AZUL_MEDIO} /> : <ChevronRight size={16} color={AZUL_MEDIO} />}
        <strong style={{ fontSize: 14.5, color: AZUL_MARINHO, flex: 1, minWidth: 160 }}>{g.nome}</strong>
        <Pilula cor={AZUL_MARINHO} fundo={CINZA_CLARO}>{g.pessoas.length} pessoa(s)</Pilula>
        <Pilula cor={VERDE} fundo="#E6F4EC">{g.comArt.length} com ART</Pilula>
        {g.semArt.length > 0 && <Pilula cor={AMBAR} fundo="#FFF4E0">{g.semArt.length} sem ART</Pilula>}
        {g.feitasSemArt > 0 && <Pilula cor={VERMELHO} fundo="#FDECEC">{g.feitasSemArt} vistoriada(s) sem ART</Pilula>}
        <Pilula cor="#4a5a70" fundo={CINZA_CLARO}>{g.arts.length} ART(s) · {brl(g.arts.reduce((s, a) => s + a.valor, 0))}</Pilula>
      </div>

      {aberto && (
        <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
          {g.arts.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>{["ART nº", "Emissão", "Válida até", "Ocupação", "Situação", "Custo", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {g.arts.map((a) => (
                    <LinhaArt key={a.id} art={a} perfil={perfil} clientePorId={clientePorId} tirar={tirar} excluir={excluirArt}
                      salvar={async (dados) => {
                        try { const r = await apiFetch(`/api/arts-vistoria/${a.id}`, { method: "PATCH", token, body: dados }); trocarArt(r.art); notify("ART atualizada ✓"); return true; }
                        catch (e) { notify(`Não foi possível salvar: ${e.message}`); return false; }
                      }} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <strong style={{ fontSize: 13.5, color: AZUL_MARINHO, flex: 1 }}>Sem ART ({g.semArt.length})</strong>
              {g.semArt.length > 0 && (
                <button style={btnLeve} onClick={alternarTodos}>
                  {selecionados.length ? "Desmarcar" : `Marcar ${Math.min(g.semArt.length, config.artCapacidade)}`}
                </button>
              )}
            </div>
            {g.semArt.length === 0 ? <Aviso tom="ok">Todo mundo deste empreendimento já está numa ART. ✓</Aviso> : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>{["", "Pessoa", "Bloco/torre", "Data da vistoria", "Etapa"].map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {g.semArt.map((p) => (
                      <tr key={p.c.id} style={{ background: marcados[p.c.id] ? "#EAF2FB" : undefined }}>
                        <td style={td}><input type="checkbox" checked={!!marcados[p.c.id]} onChange={(e) => setMarcados((x) => ({ ...x, [p.c.id]: e.target.checked }))} /></td>
                        <td style={{ ...td, fontWeight: 600 }}>{p.c.nome}{p.c.servico === "Revistoria" && <span style={{ color: "#6E36BE", fontWeight: 700, fontSize: 11.5 }}> · revistoria</span>}</td>
                        <td style={td}>{p.c.blocoTorre || "—"}</td>
                        <td style={{ ...td, whiteSpace: "nowrap" }}>{p.data ? dataBr(p.data) : <span style={{ color: "#8593a8" }}>sem data</span>}</td>
                        <td style={td}>
                          {p.feita ? <Pilula cor={VERMELHO} fundo="#FDECEC">Vistoria feita</Pilula> : (ROTULO_ETAPA[p.c.status] || p.c.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {selecionados.length > 0 && (
            <div style={{ border: `1px dashed ${AZUL_MEDIO}`, background: "#F6F9FD", borderRadius: 10, padding: 12, display: "grid", gap: 10 }}>
              <div style={{ fontSize: 13, color: AZUL_MARINHO }}>
                <strong>{selecionados.length}</strong> selecionada(s)
                {selecionados.length > config.artCapacidade && <span style={{ color: VERMELHO }}> — passa do limite de {config.artCapacidade} por ART</span>}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {g.vigentes.map((a) => {
                  const vagas = a.capacidade - a.pessoas.length;
                  return (
                    <button key={a.id} style={btn} disabled={enviando || selecionados.length > vagas} onClick={() => incluirEm(a)}
                      title={selecionados.length > vagas ? `Esta ART só tem ${vagas} vaga(s)` : "Sem custo novo"}>
                      <Plus size={14} /> Incluir na ART {a.numero || dataBr(a.emitidaEm)} ({vagas} vaga{vagas === 1 ? "" : "s"})
                    </button>
                  );
                })}
                {!emitindo && <button style={g.vigentes.length ? btnLeve : btn} onClick={() => setEmitindo(true)}><FileCheck size={14} /> Emitir nova ART ({brl(config.artValor)})</button>}
              </div>
              {emitindo && (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 4 }}><label style={lab}>Número da ART</label>
                      <input style={inp} value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="pode preencher depois" /></div>
                    <div style={{ display: "grid", gap: 4 }}><label style={lab}>Data de emissão</label>
                      <input style={inp} type="date" value={form.emitidaEm} onChange={(e) => setForm({ ...form, emitidaEm: e.target.value })} /></div>
                    <div style={{ display: "grid", gap: 4, flex: 1, minWidth: 180 }}><label style={lab}>Observação</label>
                      <input style={inp} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
                  </div>
                  <div style={{ fontSize: 12.5, color: "#4a5a70" }}>
                    Válida de {dataBr(form.emitidaEm)} até {dataBr(somarDias(form.emitidaEm, config.artValidadeDias))}.
                  </div>
                  {fora.length > 0 && (
                    <Aviso>{fora.length} pessoa(s) com vistoria fora dessa validade: {fora.map((p) => `${p.c.nome} (${dataBr(p.data)})`).join(", ")}.</Aviso>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={btn} disabled={enviando || selecionados.length > config.artCapacidade || !form.emitidaEm} onClick={emitir}>
                      <Check size={14} /> Emitir ART com {selecionados.length} pessoa(s)
                    </button>
                    <button style={btnLeve} onClick={() => setEmitindo(false)}>Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function somarDias(iso, dias) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + Number(dias || 0));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function LinhaArt({ art, perfil, clientePorId, tirar, excluir, salvar }) {
  const [vendo, setVendo] = useState(false);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({ numero: art.numero, emitidaEm: art.emitidaEm });
  const vigente = art.validaAte >= hoje();
  return (
    <>
      <tr>
        <td style={{ ...td, fontWeight: 700 }}>
          {editando ? <input style={{ ...inp, width: 130 }} value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
            : (art.numero || <span style={{ color: AMBAR }}>sem número</span>)}
        </td>
        <td style={{ ...td, whiteSpace: "nowrap" }}>
          {editando ? <input style={inp} type="date" value={form.emitidaEm} onChange={(e) => setForm({ ...form, emitidaEm: e.target.value })} /> : dataBr(art.emitidaEm)}
        </td>
        <td style={{ ...td, whiteSpace: "nowrap" }}>{dataBr(art.validaAte)}</td>
        <td style={{ ...td, whiteSpace: "nowrap" }}>
          <button style={{ ...btnLeve, padding: "3px 8px", fontSize: 12 }} onClick={() => setVendo(!vendo)}>{art.pessoas.length}/{art.capacidade} {vendo ? "▲" : "▼"}</button>
        </td>
        <td style={td}>{vigente ? <Pilula cor={VERDE} fundo="#E6F4EC">Vigente</Pilula> : <Pilula cor="#65758b" fundo={CINZA_CLARO}>Vencida</Pilula>}</td>
        <td style={tdN}>{brl(art.valor)}</td>
        <td style={{ ...td, whiteSpace: "nowrap", textAlign: "right" }}>
          {editando ? (
            <>
              <button style={{ ...btn, padding: "4px 8px" }} onClick={async () => { if (await salvar(form)) setEditando(false); }}><Save size={13} /></button>{" "}
              <button style={{ ...btnLeve, padding: "4px 8px" }} onClick={() => setEditando(false)}><X size={13} /></button>
            </>
          ) : (
            <>
              <button style={{ ...btnLeve, padding: "4px 8px", fontSize: 12 }} onClick={() => { setForm({ numero: art.numero, emitidaEm: art.emitidaEm }); setEditando(true); }}>Editar</button>{" "}
              {perfil === "gerencia" && <button style={{ ...btnLeve, padding: "4px 8px" }} title="Excluir (lançada por engano)" onClick={() => excluir(art)}><Trash2 size={13} color={VERMELHO} /></button>}
            </>
          )}
        </td>
      </tr>
      {vendo && (
        <tr>
          <td colSpan={7} style={{ ...td, background: "#FAFBFD" }}>
            {art.pessoas.length === 0 ? <span style={{ color: "#8593a8" }}>Ninguém nesta ART.</span> : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {art.pessoas.map((p) => {
                  const c = clientePorId[p.clienteId];
                  return (
                    <span key={p.clienteId} style={{ display: "inline-flex", alignItems: "center", gap: 5, border: `1px solid ${CINZA_BORDA}`, borderRadius: 20, padding: "3px 6px 3px 10px", fontSize: 12.5, background: "#fff" }}>
                      {c ? `${c.nome}${c.blocoTorre ? ` · ${c.blocoTorre}` : ""}` : "(cadastro excluído)"}
                      <button title="Tirar desta ART" onClick={() => tirar(art, p.clienteId)} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 2, display: "grid" }}><X size={12} color="#8593a8" /></button>
                    </span>
                  );
                })}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/* ============================================================
   FOLHA DE PAGAMENTO (só a Gerência)
   ============================================================
   Quem a FN paga, num lugar só, com o comprovante de cada pagamento:
   - vistoriador: as vistorias que ELE fez, pela regra do dia (calculada no servidor — R$ 100 a
     1ª do dia, R$ 80 as seguintes, revistoria R$ 80). Vistoria sem técnico (base antiga, feita
     pela Gerência) não custa nada. A FN paga o vistoriador no FIM DE CADA DIA: o "Fechamento do
     dia" mostra o que cada um fez no dia e paga só aquilo;
   - salário fixo: o Atendimento recebe o salário configurado (R$ 400/mês hoje) a partir do mês
     em que entrou; dá para mudar valor e mês de início, tirar ou incluir alguém;
   - extras: hora extra, bônus — lançados à mão no mês.
   Pagamento feito antes da folha existir (setembro, por exemplo) se registra como pago com a
   data em que foi feito, escolhendo se lança ou não a despesa — se já foi lançado à mão em
   Despesas, lançar de novo contaria duas vezes. Nada disso aparece para o atendente ou o técnico. */
const ROTULO_REGRA = { primeira: "1ª do dia", seguinte: "demais do dia", revistoria: "revistoria" };
const FORMAS = ["Pix", "Transferência", "Dinheiro", "Boleto", "Outro"];
const ROTULO_PAPEL = {
  vistoriador: "Vistoriador", atendimento: "Atendimento", documentacao: "Documentação", qualidade: "Qualidade",
  vendas: "Vendas", gerencia: "Gerência", gestor_regional: "Gestor regional",
};
const mesBr = (mes) => { const [a, m] = String(mes || "").split("-"); return m ? `${m}/${a}` : "—"; };

/* O formulário de um pagamento — do dia, do mês ou do mês inteiro de todo mundo. */
function FormPagamento({ titulo, dataPadrao, enviando, onConfirmar, onCancelar, rotuloBotao }) {
  const [f, setF] = useState({ dataPagamento: dataPadrao || hoje(), formaPagamento: "Pix", observacoes: "", lancarDespesa: true });
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {titulo && <div style={{ fontSize: 12.5, fontWeight: 700, color: AZUL_MARINHO }}>{titulo}</div>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ display: "grid", gap: 4 }}><label style={lab}>Data em que foi pago</label>
          <input style={inp} type="date" value={f.dataPagamento} max={hoje()} onChange={(e) => setF({ ...f, dataPagamento: e.target.value })} /></div>
        <div style={{ display: "grid", gap: 4 }}><label style={lab}>Forma</label>
          <select style={inp} value={f.formaPagamento} onChange={(e) => setF({ ...f, formaPagamento: e.target.value })}>
            {FORMAS.map((x) => <option key={x}>{x}</option>)}
          </select></div>
        <div style={{ display: "grid", gap: 4, flex: 1, minWidth: 160 }}><label style={lab}>Observação</label>
          <input style={inp} value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></div>
      </div>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 12.5, color: "#4a5a70" }}>
        <input type="checkbox" checked={f.lancarDespesa} onChange={(e) => setF({ ...f, lancarDespesa: e.target.checked })} style={{ marginTop: 2 }} />
        <span>
          <strong>Lançar como despesa no Financeiro</strong> (é onde se anexa o comprovante).
          {" "}Desmarque se este pagamento <strong>já foi lançado à mão em Despesas</strong> — senão ele conta duas vezes.
        </span>
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={btn} disabled={enviando || !f.dataPagamento} onClick={() => onConfirmar(f)}><Check size={14} /> {rotuloBotao}</button>
        <button style={btnLeve} onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  );
}

export function AbaFolhaPagamento({ token, apiFetch, notify, fin, usuarios = [] }) {
  const [mes, setMes] = useState(() => hoje().slice(0, 7));
  const [dados, setDados] = useState({ pessoas: [], vistorias: [], config: null, salariosPersonalizados: [], inicioPadrao: [] });
  const [carregando, setCarregando] = useState(false);
  const [aberto, setAberto] = useState(null);
  /* Qual formulário de pagamento está aberto: { usuarioId, dia } (dia vazio = o mês), ou "todos". */
  const [pagando, setPagando] = useState(null);
  const [extraDe, setExtraDe] = useState(null);
  const [formExtra, setFormExtra] = useState({ descricao: "", valor: "" });
  const [enviando, setEnviando] = useState(false);
  const [diaFechamento, setDiaFechamento] = useState(hoje());

  const carregar = async () => {
    setCarregando(true);
    try { setDados(await apiFetch(`/api/folha?competencia=${mes}`, { token })); }
    catch (e) { notify(`Não foi possível carregar a folha: ${e.message}`); }
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, [mes]);
  /* O dia do fechamento acompanha o mês aberto: hoje, se for deste mês; senão o último dia. */
  useEffect(() => {
    if (diaFechamento.slice(0, 7) !== mes) setDiaFechamento(hoje().slice(0, 7) === mes ? hoje() : ultimoDia(mes));
  }, [mes]);

  const despesaPorId = useMemo(() => Object.fromEntries((fin?.despesas || []).map((d) => [d.id, d])), [fin?.despesas]);
  const anexosDe = (despesaId) => (despesaId ? despesaPorId[despesaId]?.anexos || [] : []);

  const pagar = async (p, form, dia = null) => {
    setEnviando(true);
    try {
      const r = await apiFetch(`/api/folha/${p.usuarioId}/pagar`, { method: "POST", token, body: { competencia: mes, ...form, ...(dia ? { dia } : {}) } });
      notify(`Pagamento de ${p.nome} registrado: ${brl(r.total)} ✓${r.despesaId ? " — anexe o comprovante" : " (sem despesa)"}`);
      setPagando(null);
      await Promise.all([carregar(), r.despesaId ? fin?.carregar?.() : null]);
      return true;
    } catch (e) { notify(`Não foi possível registrar ${p.nome}: ${e.message}`); return false; }
    finally { setEnviando(false); }
  };
  /* Mês inteiro como pago, de todo mundo que tem algo em aberto (para fechar setembro, por
     exemplo). Vistoriador recebe no fim de cada dia, então vira UM pagamento por dia, com a data
     do próprio dia — é nele que se anexa o comprovante daquele dia depois. Salário e extras
     viram um pagamento na data escolhida. */
  const pagarTodos = async (form) => {
    const abertos = (dados.pessoas || []).filter((p) => p.aPagar > 0);
    const registrar = (p, corpo) => apiFetch(`/api/folha/${p.usuarioId}/pagar`, { method: "POST", token, body: { competencia: mes, ...form, ...corpo } });
    setEnviando(true);
    let ok = 0;
    for (const p of abertos) {
      const dias = [...new Set((dados.vistorias || []).filter((v) => v.tecnicoId === p.usuarioId && !v.pago && v.valor > 0).map((v) => v.dia))].sort();
      for (const dia of dias) {
        try { await registrar(p, { dia, dataPagamento: dia }); ok += 1; }
        catch (e) { notify(`${p.nome} (${dataBr(dia)}): ${e.message}`); }
      }
      const resto = (p.salario && !p.salario.pago ? p.salario.valor : 0) + p.extras.filter((e) => !e.pago).reduce((s, e) => s + e.valor, 0);
      if (resto > 0) {
        try { await registrar(p, {}); ok += 1; }
        catch (e) { notify(`${p.nome}: ${e.message}`); }
      }
    }
    setEnviando(false); setPagando(null);
    notify(`${ok} pagamento(s) registrado(s) em ${mesBr(mes)} ✓${form.lancarDespesa ? " — anexe os comprovantes quando tiver" : ""}`);
    await Promise.all([carregar(), form.lancarDespesa ? fin?.carregar?.() : null]);
  };
  const desfazer = async (pagamento) => {
    if (!window.confirm(`Desfazer o pagamento de ${brl(pagamento.valor)} de ${dataBr(pagamento.pagoEm)}? O que ele pagou volta para "a pagar".`)) return;
    try {
      await apiFetch(`/api/folha/pagamentos/${pagamento.id}`, { method: "DELETE", token });
      notify("Pagamento desfeito");
      await Promise.all([carregar(), pagamento.despesaId ? fin?.carregar?.() : null]);
    } catch (e) { notify(e.message); }
  };
  const lancarExtra = async (p) => {
    setEnviando(true);
    try {
      await apiFetch("/api/folha/extras", { method: "POST", token, body: { competencia: mes, usuarioId: p.usuarioId, ...formExtra } });
      notify("Extra lançado ✓");
      setExtraDe(null); setFormExtra({ descricao: "", valor: "" });
      await carregar();
    } catch (e) { notify(`Não foi possível lançar o extra: ${e.message}`); }
    setEnviando(false);
  };
  const apagarExtra = async (id) => {
    try { await apiFetch(`/api/folha/extras/${id}`, { method: "DELETE", token }); await carregar(); }
    catch (e) { notify(e.message); }
  };
  const anexar = async (despesaId, arquivos) => {
    for (const arquivo of arquivos) await fin.anexar(despesaId, arquivo);
    notify("Comprovante anexado ✓");
  };
  /* Os comprovantes de um pagamento e o botão de anexar — o mesmo no Fechamento do dia e na
     lista de pagamentos da pessoa. Pagamento registrado sem despesa não tem onde anexar. */
  const comprovantes = (x) => {
    if (!x.despesaId) return <Pilula cor="#4a5a70" fundo={CINZA_CLARO}>registrado sem despesa</Pilula>;
    const anexos = anexosDe(x.despesaId);
    return (
      <>
        {anexos.map((a) => (
          <button key={a.id} style={{ ...btnLeve, padding: "3px 8px", fontSize: 12 }} onClick={() => fin.abrirAnexo(a)}>
            <FileCheck size={12} /> {a.nomeArquivo}
          </button>
        ))}
        {fin?.carregado && anexos.length === 0 && <Pilula cor={VERMELHO} fundo="#FDECEC">sem comprovante</Pilula>}
        <label style={{ ...btnLeve, padding: "3px 8px", fontSize: 12 }}>
          <Plus size={12} /> Anexar comprovante
          <input type="file" accept="application/pdf,image/*" multiple style={{ display: "none" }}
            onChange={(e) => { const arquivos = [...e.target.files]; e.target.value = ""; if (arquivos.length) anexar(x.despesaId, arquivos); }} />
        </label>
      </>
    );
  };

  const pessoas = dados.pessoas || [];
  const vistorias = dados.vistorias || [];
  const totalDevido = pessoas.reduce((s, p) => s + p.devido, 0);
  const totalPago = pessoas.reduce((s, p) => s + p.pago, 0);
  const totalAPagar = pessoas.reduce((s, p) => s + p.aPagar, 0);
  const pagamentos = pessoas.flatMap((p) => p.pagamentos);
  const semComprovante = fin?.carregado ? pagamentos.filter((x) => x.despesaId && anexosDe(x.despesaId).length === 0).length : 0;
  const extrasDe = (p) => p.extras.reduce((s, e) => s + e.valor, 0);
  const pessoaPorId = Object.fromEntries(pessoas.map((p) => [p.usuarioId, p]));

  /* Fechamento do dia: o que cada vistoriador fez no dia escolhido. */
  const doDia = {};
  vistorias.filter((v) => v.dia === diaFechamento).forEach((v) => {
    const t = (doDia[v.tecnicoId] ||= { usuarioId: v.tecnicoId, nome: v.tecnicoNome, qtd: 0, valor: 0, aberto: 0 });
    t.qtd += 1; t.valor += v.valor; if (!v.pago) t.aberto += v.valor;
  });
  const fechamento = Object.values(doDia).sort((a, b) => b.aberto - a.aberto || a.nome.localeCompare(b.nome, "pt-BR"));
  const ehForm = (usuarioId, dia = null) => pagando && pagando !== "todos" && pagando.usuarioId === usuarioId && (pagando.dia || null) === dia;

  return (
    <div>
      <Caixa icon={Wallet} titulo={`Folha de pagamento — ${mesBr(mes)}`}
        acoes={<button style={btnLeve} onClick={carregar}><RefreshCcw size={14} className={carregando ? "spin" : ""} /> Atualizar</button>}>
        <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 12px" }}>
          Vistoriador recebe pelas vistorias que <strong>ele fez</strong>: {brl(dados.config?.tecnicoPrimeiraDoDia ?? 100)} a 1ª do dia,
          {" "}{brl(dados.config?.tecnicoDemaisDoDia ?? 80)} as seguintes, {brl(dados.config?.tecnicoRevistoria ?? 80)} cada revistoria — pague no
          {" "}<strong>Fechamento do dia</strong>. Vistoria feita pela Gerência ou da base antiga, sem técnico, não tem custo. O Atendimento recebe
          {" "}<strong>{brl(dados.config?.salarioFixoAtendimento ?? 400)}</strong> por mês a partir do mês em que entrou, mais os extras.
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 14 }}>
          <div style={{ display: "grid", gap: 4 }}><label style={lab}>Mês</label>
            <input style={inp} type="month" value={mes} onChange={(e) => setMes(e.target.value || hoje().slice(0, 7))} /></div>
          {totalAPagar > 0 && pagando !== "todos" && (
            <button style={btnLeve} onClick={() => setPagando("todos")} title="Para registrar um mês que já foi pago fora do sistema">
              <Check size={14} /> Marcar o mês todo como pago
            </button>
          )}
        </div>
        {pagando === "todos" && (
          <div style={{ border: `1px dashed ${AZUL_MEDIO}`, background: "#F6F9FD", borderRadius: 10, padding: 12, marginBottom: 14 }}>
            <FormPagamento titulo={`Registrar ${mesBr(mes)} como pago para ${pessoas.filter((p) => p.aPagar > 0).length} pessoa(s) — ${brl(totalAPagar)}. `
              + "Vistoriadores: um pagamento por dia, com a data do próprio dia (para anexar o comprovante de cada dia). Salário e extras: um pagamento na data abaixo."}
              dataPadrao={hoje().slice(0, 7) === mes ? hoje() : ultimoDia(mes)} enviando={enviando}
              rotuloBotao="Marcar todos como pagos" onConfirmar={pagarTodos} onCancelar={() => setPagando(null)} />
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          <Kpi rotulo="Total da folha" valor={brl(totalDevido)} apoio={`${pessoas.length} pessoa(s)`} />
          <Kpi rotulo="Já pago" valor={brl(totalPago)} cor={VERDE} apoio={`${pagamentos.length} pagamento(s)`} />
          <Kpi rotulo="A pagar" valor={brl(totalAPagar)} cor={totalAPagar ? AMBAR : VERDE} />
          <Kpi rotulo="Sem comprovante" valor={semComprovante} cor={semComprovante ? VERMELHO : VERDE} apoio="pagamentos com despesa e sem arquivo" />
        </div>
      </Caixa>

      <Caixa icon={Users} titulo="Fechamento do dia — vistoriadores">
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 10 }}>
          <div style={{ display: "grid", gap: 4 }}><label style={lab}>Dia</label>
            <input style={inp} type="date" value={diaFechamento} min={`${mes}-01`} max={ultimoDia(mes)}
              onChange={(e) => setDiaFechamento(e.target.value || diaFechamento)} /></div>
          <span style={{ fontSize: 12.5, color: "#65758b", paddingBottom: 8 }}>O pagamento do dia já vem com a data do dia — mude se pagou em outra data.</span>
        </div>
        {fechamento.length === 0 ? <Aviso tom="ok">Nenhuma vistoria de técnico em {dataBr(diaFechamento)}.</Aviso> : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Vistoriador", "Vistorias", "Valor do dia", "Situação", ""].map((h, i) => <th key={i} style={{ ...th, textAlign: i === 1 || i === 2 ? "right" : "left" }}>{h}</th>)}</tr></thead>
            <tbody>
              {fechamento.map((t) => (
                <React.Fragment key={t.usuarioId}>
                  <tr>
                    <td style={{ ...td, fontWeight: 700, color: AZUL_MARINHO }}>{t.nome}</td>
                    <td style={tdN}>{t.qtd}</td>
                    <td style={{ ...tdN, fontWeight: 700 }}>{brl(t.valor)}</td>
                    <td style={td}>{t.aberto > 0 ? <Pilula cor={AMBAR} fundo="#FFF4E0">a pagar {brl(t.aberto)}</Pilula> : <Pilula cor={VERDE} fundo="#E6F4EC">pago</Pilula>}</td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {t.aberto > 0 && !ehForm(t.usuarioId, diaFechamento) && (
                        <button style={btn} onClick={() => setPagando({ usuarioId: t.usuarioId, dia: diaFechamento })}><Wallet size={14} /> Pagar {brl(t.aberto)}</button>
                      )}
                      {/* Pago no dia: o comprovante do dia se anexa aqui mesmo. */}
                      {(pessoaPorId[t.usuarioId]?.pagamentos || []).filter((x) => x.dia === diaFechamento).map((x) => (
                        <div key={x.id} style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 4 }}>
                          {comprovantes(x)}
                        </div>
                      ))}
                    </td>
                  </tr>
                  {ehForm(t.usuarioId, diaFechamento) && (
                    <tr><td colSpan={5} style={{ ...td, background: "#F6F9FD" }}>
                      <FormPagamento dataPadrao={diaFechamento} enviando={enviando} rotuloBotao={`Pagar ${brl(t.aberto)}`}
                        onConfirmar={(f) => pagar(pessoaPorId[t.usuarioId] || { usuarioId: t.usuarioId, nome: t.nome }, f, diaFechamento)}
                        onCancelar={() => setPagando(null)} />
                    </td></tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </Caixa>

      {pessoas.length === 0 && <Aviso tom="ok">{carregando ? "Carregando…" : "Ninguém na folha deste mês."}</Aviso>}
      {pessoas.length > 0 && (
        <section style={{ background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 14, padding: 14, overflowX: "auto", marginBottom: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Pessoa", "Vistorias", "Salário fixo", "Extras", "Total", "Pago", "A pagar", ""].map((h, i) => (
              <th key={i} style={{ ...th, textAlign: i >= 1 && i <= 6 ? "right" : "left" }}>{h}</th>))}</tr></thead>
            <tbody>
              {pessoas.map((p) => (
                <React.Fragment key={p.usuarioId}>
                  <tr>
                    <td style={{ ...td, fontWeight: 700, color: AZUL_MARINHO, cursor: "pointer" }} onClick={() => setAberto(aberto === p.usuarioId ? null : p.usuarioId)}>
                      {aberto === p.usuarioId ? <ChevronDown size={13} /> : <ChevronRight size={13} />} {p.nome}
                      <div style={{ fontSize: 11.5, color: "#8593a8", fontWeight: 500 }}>{ROTULO_PAPEL[p.papel] || p.papel}</div>
                    </td>
                    <td style={tdN}>{p.vistorias ? `${p.vistorias.qtd} · ${brl(p.vistorias.devido)}` : "—"}</td>
                    <td style={tdN}>{p.salario ? <>{brl(p.salario.valor)}{p.salario.pago && <div style={{ fontSize: 11, color: VERDE }}>pago</div>}</> : "—"}</td>
                    <td style={tdN}>{p.extras.length ? brl(extrasDe(p)) : "—"}</td>
                    <td style={{ ...tdN, fontWeight: 700 }}>{brl(p.devido)}</td>
                    <td style={{ ...tdN, color: VERDE }}>{brl(p.pago)}</td>
                    <td style={{ ...tdN, fontWeight: 800, color: p.aPagar ? AMBAR : "#8593a8" }}>{brl(p.aPagar)}</td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                      {p.aPagar > 0 && !ehForm(p.usuarioId) && (
                        <button style={btn} onClick={() => { setPagando({ usuarioId: p.usuarioId, dia: null }); setExtraDe(null); }}><Wallet size={14} /> Pagar o mês</button>
                      )}{" "}
                      <button style={btnLeve} onClick={() => { setExtraDe(p.usuarioId); setPagando(null); }}><Plus size={14} /> Extra</button>
                    </td>
                  </tr>
                  {ehForm(p.usuarioId) && (
                    <tr><td colSpan={8} style={{ ...td, background: "#F6F9FD" }}>
                      <FormPagamento titulo={`Tudo o que está em aberto de ${p.nome} em ${mesBr(mes)}: ${brl(p.aPagar)}`}
                        dataPadrao={hoje().slice(0, 7) === mes ? hoje() : ultimoDia(mes)} enviando={enviando}
                        rotuloBotao={`Pagar ${brl(p.aPagar)}`} onConfirmar={(f) => pagar(p, f)} onCancelar={() => setPagando(null)} />
                    </td></tr>
                  )}
                  {extraDe === p.usuarioId && (
                    <tr><td colSpan={8} style={{ ...td, background: "#F6F9FD" }}>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                        <div style={{ display: "grid", gap: 4, flex: 1, minWidth: 200 }}><label style={lab}>Extra de {mesBr(mes)}</label>
                          <input style={inp} value={formExtra.descricao} placeholder="Ex.: hora extra, bônus" onChange={(e) => setFormExtra({ ...formExtra, descricao: e.target.value })} /></div>
                        <div style={{ display: "grid", gap: 4 }}><label style={lab}>Valor (R$)</label>
                          <input style={{ ...inp, width: 120 }} inputMode="decimal" value={formExtra.valor} placeholder="0,00"
                            onChange={(e) => setFormExtra({ ...formExtra, valor: e.target.value.replace(/[^\d,.]/g, "") })} /></div>
                        <button style={btn} disabled={enviando} onClick={() => lancarExtra(p)}><Plus size={14} /> Lançar extra</button>
                        <button style={btnLeve} onClick={() => setExtraDe(null)}>Cancelar</button>
                      </div>
                    </td></tr>
                  )}
                  {aberto === p.usuarioId && (
                    <tr><td colSpan={8} style={{ ...td, background: "#FAFBFD" }}>
                      <div style={{ display: "grid", gap: 12 }}>
                        {p.vistorias && (
                          <DiasDoTecnico vistorias={vistorias.filter((v) => v.tecnicoId === p.usuarioId)}
                            pagarDia={(dia) => setPagando({ usuarioId: p.usuarioId, dia })}
                            formDoDia={(dia, abertoNoDia) => ehForm(p.usuarioId, dia) && (
                              <FormPagamento dataPadrao={dia} enviando={enviando} rotuloBotao={`Pagar ${brl(abertoNoDia)}`}
                                onConfirmar={(f) => pagar(p, f, dia)} onCancelar={() => setPagando(null)} />
                            )} />
                        )}
                        {p.extras.length > 0 && (
                          <div>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: AZUL_MARINHO, marginBottom: 3 }}>Extras</div>
                            {p.extras.map((e) => (
                              <div key={e.id} style={{ display: "flex", gap: 8, fontSize: 12.5, color: "#4a5a70", padding: "2px 0 2px 12px", alignItems: "center" }}>
                                <span style={{ flex: 1 }}>{e.descricao}</span>
                                <strong>{brl(e.valor)}</strong>
                                {e.pago ? <Pilula cor={VERDE} fundo="#E6F4EC">pago</Pilula> : (
                                  <button title="Apagar extra" onClick={() => apagarExtra(e.id)} style={{ border: "none", background: "transparent", cursor: "pointer", display: "grid" }}><Trash2 size={13} color={VERMELHO} /></button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: AZUL_MARINHO, marginBottom: 3 }}>Pagamentos e comprovantes</div>
                          {p.pagamentos.length === 0 && <div style={{ fontSize: 12.5, color: "#8593a8", paddingLeft: 12 }}>Nenhum pagamento registrado neste mês.</div>}
                          {p.pagamentos.map((x) => {
                            return (
                              <div key={x.id} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 12.5, padding: "4px 0 4px 12px", borderTop: `1px dashed ${CINZA_BORDA}` }}>
                                <span style={{ minWidth: 210 }}>
                                  {dataBr(x.pagoEm)} · {x.formaPagamento || "—"} · <strong>{brl(x.valor)}</strong>
                                  {x.dia && <span style={{ color: "#8593a8" }}> · vistorias de {dataBr(x.dia)}</span>}
                                </span>
                                {comprovantes(x)}
                                <button style={{ ...btnLeve, padding: "3px 8px", fontSize: 12, color: VERMELHO }} onClick={() => desfazer(x)}>Desfazer</button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </td></tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <SalariosFixos token={token} apiFetch={apiFetch} notify={notify} usuarios={usuarios} config={dados.config}
        personalizados={dados.salariosPersonalizados || []} inicioPadrao={dados.inicioPadrao || []} recarregar={carregar} />
    </div>
  );
}

/* Vistorias do técnico no mês, dia a dia, cada dia com a sua situação e o botão de pagar. */
function DiasDoTecnico({ vistorias, pagarDia, formDoDia }) {
  const porDia = {};
  vistorias.forEach((v) => { (porDia[v.dia] ||= []).push(v); });
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {Object.entries(porDia).sort((a, b) => a[0].localeCompare(b[0])).map(([dia, lista]) => {
        const abertoNoDia = lista.filter((v) => !v.pago).reduce((s, v) => s + v.valor, 0);
        const form = formDoDia?.(dia, abertoNoDia);
        return (
          <div key={dia}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12.5, fontWeight: 700, color: AZUL_MARINHO, marginBottom: 3 }}>
              <span>{dataBr(dia)} · {lista.length} vistoria(s) · {brl(lista.reduce((s, v) => s + v.valor, 0))}</span>
              {abertoNoDia > 0
                ? (!form && pagarDia && <button style={{ ...btnLeve, padding: "2px 8px", fontSize: 12 }} onClick={() => pagarDia(dia)}><Wallet size={12} /> Pagar o dia ({brl(abertoNoDia)})</button>)
                : <Pilula cor={VERDE} fundo="#E6F4EC">dia pago</Pilula>}
            </div>
            {form && <div style={{ background: "#F6F9FD", borderRadius: 8, padding: 10, margin: "4px 0 6px" }}>{form}</div>}
            {lista.map((v) => (
              <div key={v.docId} style={{ display: "flex", gap: 8, fontSize: 12.5, color: "#4a5a70", padding: "2px 0 2px 12px", flexWrap: "wrap" }}>
                <span style={{ flex: 1, minWidth: 180 }}>{v.cliente} · {v.empreendimento || "—"}</span>
                <span style={{ color: "#8593a8" }}>{ROTULO_REGRA[v.regra]}</span>
                <strong style={{ width: 80, textAlign: "right" }}>{brl(v.valor)}</strong>
                <span style={{ width: 54 }}>{v.pago ? <Pilula cor={VERDE} fundo="#E6F4EC">pago</Pilula> : <Pilula cor={AMBAR} fundo="#FFF4E0">aberto</Pilula>}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* Quem tem salário fixo, quanto e desde quando. Sem ajuste, o Atendimento ativo recebe o valor
   padrão (Configurações Fiscais › Valores dos custos) a partir do mês em que o usuário foi
   criado; aqui se muda o valor, o mês de início (quem entrou em setembro), se inclui outra
   pessoa ou se tira alguém da folha fixa. */
function SalariosFixos({ token, apiFetch, notify, usuarios, config, personalizados, inicioPadrao, recarregar }) {
  const [form, setForm] = useState({ usuarioId: "", valor: "", inicio: "" });
  const padrao = Number(config?.salarioFixoAtendimento ?? 400);
  const porId = Object.fromEntries(personalizados.map((s) => [s.usuarioId, s]));
  const inicioDe = Object.fromEntries(inicioPadrao.map((x) => [x.usuarioId, x.inicio]));
  const equipe = usuarios.filter((u) => ROTULO_PAPEL[u.role] && u.role !== "gerencia");
  const linhas = equipe.map((u) => {
    const s = porId[u.id];
    const ativo = s ? s.ativo : u.role === "atendimento" && u.ativo !== false;
    const valor = !ativo ? 0 : s && s.valor != null ? s.valor : (u.role === "atendimento" ? padrao : 0);
    return { u, s, valor, ativo, inicio: s?.inicio || inicioDe[u.id] || "" };
  }).filter((l) => l.valor > 0 || l.s);

  const salvar = async (usuarioId, corpo, aviso = "Salário fixo atualizado ✓") => {
    try { await apiFetch(`/api/folha/salarios/${usuarioId}`, { method: "PUT", token, body: corpo }); notify(aviso); await recarregar(); return true; }
    catch (e) { notify(e.message); return false; }
  };
  const voltarAoPadrao = async (usuarioId) => {
    try { await apiFetch(`/api/folha/salarios/${usuarioId}`, { method: "DELETE", token }); await recarregar(); }
    catch (e) { notify(e.message); }
  };

  return (
    <Caixa icon={Users} titulo="Salários fixos">
      <p style={{ fontSize: 13, color: "#65758b", margin: "0 0 10px" }}>
        Todo o Atendimento recebe {brl(padrao)} por mês (o padrão fica em Configurações Fiscais › Valores dos custos), a partir do mês em que entrou.
        Ajuste aqui o mês de entrada ("Desde"), o valor de alguém, inclua outra pessoa ou tire da folha fixa. Salário já pago não muda.
      </p>
      {linhas.length === 0 && <div style={{ fontSize: 13, color: "#8593a8", marginBottom: 10 }}>Ninguém com salário fixo.</div>}
      {linhas.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
          <thead><tr>{["Pessoa", "Setor", "Salário/mês", "Desde", ""].map((h, i) => <th key={i} style={{ ...th, textAlign: i === 2 ? "right" : "left" }}>{h}</th>)}</tr></thead>
          <tbody>
            {linhas.map(({ u, s, valor, ativo, inicio }) => (
              <tr key={u.id}>
                <td style={{ ...td, fontWeight: 600 }}>{u.nome}</td>
                <td style={td}>{ROTULO_PAPEL[u.role] || u.role}</td>
                <td style={tdN}>
                  {valor > 0 ? brl(valor) : <span style={{ color: "#8593a8" }}>fora da folha fixa</span>}
                  {s && s.valor != null && valor > 0 && <div style={{ fontSize: 11, color: "#8593a8" }}>valor próprio</div>}
                </td>
                <td style={td}>
                  {ativo ? (
                    <input type="month" style={{ ...inp, padding: "4px 8px" }} value={inicio}
                      onChange={(e) => e.target.value && salvar(u.id, { inicio: e.target.value, ativo: true }, `Início de ${u.nome}: ${mesBr(e.target.value)} ✓`)} />
                  ) : "—"}
                </td>
                <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                  {s && <button style={{ ...btnLeve, padding: "3px 8px", fontSize: 12 }} onClick={() => voltarAoPadrao(u.id)}>Voltar ao padrão</button>}{" "}
                  {valor > 0 && <button style={{ ...btnLeve, padding: "3px 8px", fontSize: 12 }} onClick={() => salvar(u.id, { ativo: false })}>Tirar da folha fixa</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ display: "grid", gap: 4, minWidth: 200 }}><label style={lab}>Pessoa</label>
          <select style={inp} value={form.usuarioId} onChange={(e) => setForm({ ...form, usuarioId: e.target.value })}>
            <option value="">Escolha…</option>
            {equipe.map((u) => <option key={u.id} value={u.id}>{u.nome} ({ROTULO_PAPEL[u.role] || u.role})</option>)}
          </select></div>
        <div style={{ display: "grid", gap: 4 }}><label style={lab}>Salário/mês (R$)</label>
          <input style={{ ...inp, width: 130 }} inputMode="decimal" value={form.valor} placeholder={String(padrao)}
            onChange={(e) => setForm({ ...form, valor: e.target.value.replace(/[^\d,.]/g, "") })} /></div>
        <div style={{ display: "grid", gap: 4 }}><label style={lab}>Desde (mês)</label>
          <input style={inp} type="month" value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} /></div>
        <button style={btn} disabled={!form.usuarioId || (!form.valor && !form.inicio)}
          onClick={async () => {
            const corpo = { ativo: true, ...(form.valor ? { valor: form.valor } : {}), ...(form.inicio ? { inicio: form.inicio } : {}) };
            if (await salvar(form.usuarioId, corpo)) setForm({ usuarioId: "", valor: "", inicio: "" });
          }}>
          <Save size={14} /> Definir
        </button>
      </div>
    </Caixa>
  );
}

/* ============================================================
   DESPESAS FIXAS (Financeiro › Despesas fixas, só Gerência)
   ============================================================
   O que se paga todo mês: crédito de telefone, marketing, DAS… O cadastro diz o valor previsto
   (vazio = varia) e o dia do vencimento. "Pagar" vira uma despesa comum no Financeiro — entra
   nos relatórios e no ZIP do contador — e o comprovante fica anexado nela, na hora do pagamento
   ou depois, na mesma linha. O vínculo mês a mês mora no servidor (src/despesas-fixas.js). */
const MODELOS_FIXA = [
  { nome: "Crédito de telefone", categoria: "Administrativo", subcategoria: "Telefone", diaVencimento: 10, formaPagamento: "Pix" },
  { nome: "Marketing (tráfego pago)", categoria: "Comercial e Marketing", subcategoria: "Tráfego pago", diaVencimento: 10, formaPagamento: "Cartão de crédito" },
  { nome: "DAS MEI", categoria: "Tributos e Taxas", subcategoria: "DAS MEI", diaVencimento: 20, formaPagamento: "Boleto" },
  { nome: "Internet", categoria: "Administrativo", subcategoria: "Internet", diaVencimento: 10, formaPagamento: "Débito automático" },
  { nome: "Contabilidade", categoria: "Administrativo", subcategoria: "Contabilidade", diaVencimento: 10, formaPagamento: "Pix" },
];
const FIXA_VAZIA = { nome: "", categoria: "Administrativo", subcategoria: "", valor: "", diaVencimento: 10, fornecedor: "", formaPagamento: "Pix", inicio: "", observacoes: "" };
const SITUACAO_FIXA = { paga: [VERDE, "#E6F4EC"], "a pagar": [AMBAR, "#FFF4E0"], vencida: [VERMELHO, "#FDECEC"] };
/* Valor como se digita no Brasil: "1.412,50". Vazio = null (varia todo mês). */
const lerValor = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};
const valorNaTela = (v) => (v == null || v === "" ? "" : Number(v).toFixed(2).replace(".", ","));
const ACEITA_COMPROVANTE = "application/pdf,image/*";

/* O lugar do comprovante: escolher um ou mais arquivos (PDF ou foto), ver o que foi escolhido. */
function CampoComprovante({ arquivos, aoMudar }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", border: `1.5px dashed ${CINZA_BORDA}`, borderRadius: 10, padding: "10px 12px", cursor: "pointer", background: "#fff", fontSize: 13, color: "#4a5a70" }}>
      <Paperclip size={15} color={AZUL_MEDIO} />
      {arquivos.length
        ? <span><strong style={{ color: AZUL_MARINHO }}>{arquivos.map((a) => a.name).join(", ")}</strong> · trocar</span>
        : <span><strong style={{ color: AZUL_MARINHO }}>Anexar comprovante</strong> (PDF ou foto) — pode ser agora ou depois</span>}
      <input type="file" accept={ACEITA_COMPROVANTE} multiple style={{ display: "none" }}
        onChange={(e) => { aoMudar([...e.target.files]); e.target.value = ""; }} />
    </label>
  );
}

function FormPagarFixa({ fixa, mes, enviando, onConfirmar, onCancelar }) {
  /* Mês que já passou: a data sugerida é a do vencimento; mês corrente ou futuro, hoje. */
  const dataPadrao = mes < hoje().slice(0, 7) ? fixa.vencimento : hoje();
  const [f, setF] = useState({ valor: valorNaTela(fixa.valor), data: dataPadrao, formaPagamento: fixa.formaPagamento || "Pix", numeroNf: "", observacoes: "", arquivos: [] });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const valor = lerValor(f.valor);
  const valido = valor > 0 && !!f.data;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: AZUL_MARINHO }}>
        Pagar {fixa.nome} — vencimento {dataBr(fixa.vencimento)}{fixa.valor == null ? " (valor varia: informe o que foi pago)" : ""}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ display: "grid", gap: 4 }}><label style={lab}>Valor pago (R$)</label>
          <input style={{ ...inp, width: 120 }} inputMode="decimal" value={f.valor} placeholder="0,00" autoFocus={fixa.valor == null}
            onChange={(e) => set("valor", e.target.value.replace(/[^\d,.]/g, ""))} /></div>
        <div style={{ display: "grid", gap: 4 }}><label style={lab}>Data do pagamento</label>
          <input style={inp} type="date" value={f.data} max={hoje()} onChange={(e) => set("data", e.target.value)} /></div>
        <div style={{ display: "grid", gap: 4 }}><label style={lab}>Forma</label>
          <select style={inp} value={f.formaPagamento} onChange={(e) => set("formaPagamento", e.target.value)}>
            {FORMAS_PAGAMENTO.map((x) => <option key={x}>{x}</option>)}
          </select></div>
        <div style={{ display: "grid", gap: 4, width: 130 }}><label style={lab}>Nº da nota (se tiver)</label>
          <input style={inp} value={f.numeroNf} onChange={(e) => set("numeroNf", e.target.value)} /></div>
        <div style={{ display: "grid", gap: 4, flex: 1, minWidth: 160 }}><label style={lab}>Observação</label>
          <input style={inp} value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)} /></div>
      </div>
      <CampoComprovante arquivos={f.arquivos} aoMudar={(a) => set("arquivos", a)} />
      <div style={{ display: "flex", gap: 8 }}>
        <button style={btn} disabled={enviando || !valido} onClick={() => onConfirmar({ ...f, valor })}>
          <Check size={14} /> {enviando ? "Registrando…" : `Registrar pagamento${valor > 0 ? ` de ${brl(valor)}` : ""}`}
        </button>
        <button style={btnLeve} onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  );
}

function FormFixa({ inicial, enviando, onSalvar, onCancelar }) {
  const [f, setF] = useState(() => ({ ...FIXA_VAZIA, ...inicial, valor: valorNaTela(inicial.valor), inicio: inicial.inicio || hoje().slice(0, 7) }));
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const subcategorias = CATEGORIAS_DESPESA[f.categoria] || [];
  return (
    <div style={{ border: `1px dashed ${AZUL_MEDIO}`, background: "#F6F9FD", borderRadius: 10, padding: 12, marginBottom: 14, display: "grid", gap: 10 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: AZUL_MARINHO }}>{inicial.id ? `Editar ${inicial.nome}` : "Nova despesa fixa"}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
        <div style={{ display: "grid", gap: 4 }}><label style={lab}>Nome</label>
          <input style={inp} value={f.nome} placeholder="Ex.: Crédito de telefone" onChange={(e) => set("nome", e.target.value)} /></div>
        <div style={{ display: "grid", gap: 4 }}><label style={lab}>Categoria</label>
          <select style={inp} value={f.categoria} onChange={(e) => setF((x) => ({ ...x, categoria: e.target.value, subcategoria: "" }))}>
            {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
          </select></div>
        <div style={{ display: "grid", gap: 4 }}><label style={lab}>Subcategoria</label>
          <select style={inp} value={f.subcategoria} onChange={(e) => set("subcategoria", e.target.value)}>
            <option value="">—</option>
            {subcategorias.map((s) => <option key={s}>{s}</option>)}
          </select></div>
        <div style={{ display: "grid", gap: 4 }}><label style={lab}>Valor previsto (R$)</label>
          <input style={inp} inputMode="decimal" value={f.valor} placeholder="vazio = varia todo mês" onChange={(e) => set("valor", e.target.value.replace(/[^\d,.]/g, ""))} /></div>
        <div style={{ display: "grid", gap: 4 }}><label style={lab}>Vence todo dia</label>
          <input style={inp} type="number" min={1} max={31} value={f.diaVencimento} onChange={(e) => set("diaVencimento", e.target.value)} /></div>
        <div style={{ display: "grid", gap: 4 }}><label style={lab}>Forma de pagamento</label>
          <select style={inp} value={f.formaPagamento} onChange={(e) => set("formaPagamento", e.target.value)}>
            {FORMAS_PAGAMENTO.map((x) => <option key={x}>{x}</option>)}
          </select></div>
        <div style={{ display: "grid", gap: 4 }}><label style={lab}>Fornecedor</label>
          <input style={inp} value={f.fornecedor} placeholder="Ex.: operadora, Meta, Receita Federal" onChange={(e) => set("fornecedor", e.target.value)} /></div>
        <div style={{ display: "grid", gap: 4 }}><label style={lab}>Desde (mês)</label>
          <input style={inp} type="month" value={f.inicio} onChange={(e) => set("inicio", e.target.value)} /></div>
      </div>
      {f.subcategoria === "DAS MEI" && (
        <Aviso tom="atencao">O DAS do MEI vence no dia 20, e o valor muda quando o salário mínimo muda — confira no boleto e corrija o valor na hora de pagar.</Aviso>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button style={btn} disabled={enviando || !f.nome.trim()} onClick={() => onSalvar(f)}><Save size={14} /> Salvar</button>
        <button style={btnLeve} onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  );
}

export function AbaDespesasFixas({ token, apiFetch, notify, fin }) {
  const [mes, setMes] = useState(() => hoje().slice(0, 7));
  const [dados, setDados] = useState({ fixas: [], cadastro: [] });
  const [carregando, setCarregando] = useState(false);
  const [carregado, setCarregado] = useState(false);
  const [pagando, setPagando] = useState(null); // id da despesa fixa com o formulário de pagamento aberto
  const [editando, setEditando] = useState(null); // cadastro em edição (sem id = nova)
  const [enviando, setEnviando] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    try { setDados(await apiFetch(`/api/financeiro/fixas?competencia=${mes}`, { token })); setCarregado(true); }
    catch (e) { notify(`Não foi possível carregar as despesas fixas: ${e.message}`); }
    setCarregando(false);
  };
  useEffect(() => { carregar(); setPagando(null); }, [mes]);

  const despesaPorId = useMemo(() => Object.fromEntries((fin?.despesas || []).map((d) => [d.id, d])), [fin?.despesas]);
  const anexosDe = (despesaId) => (despesaId ? despesaPorId[despesaId]?.anexos || [] : []);
  const anexar = async (despesaId, arquivos) => {
    let ok = 0;
    for (const arquivo of arquivos) if (await fin.anexar(despesaId, arquivo)) ok += 1;
    if (ok) notify(ok > 1 ? `${ok} comprovantes anexados ✓` : "Comprovante anexado ✓");
    return ok;
  };

  const pagar = async (fixa, form) => {
    setEnviando(true);
    try {
      const r = await apiFetch(`/api/financeiro/fixas/${fixa.id}/pagar`, {
        method: "POST", token,
        body: { competencia: mes, valor: form.valor, data: form.data, formaPagamento: form.formaPagamento, numeroNf: form.numeroNf, observacoes: form.observacoes },
      });
      notify(`${fixa.nome}: pagamento de ${brl(r.valor)} registrado ✓${form.arquivos.length ? "" : " — anexe o comprovante quando tiver"}`);
      setPagando(null);
      /* O pagamento já está gravado: se o comprovante falhar, a linha mostra "sem comprovante" e
         o botão de anexar continua ali. */
      if (form.arquivos.length) await anexar(r.despesaId, form.arquivos);
      await Promise.all([carregar(), fin?.carregar?.()]);
    } catch (e) { notify(`Não foi possível registrar o pagamento: ${e.message}`); }
    setEnviando(false);
  };
  const desfazer = async (fixa) => {
    const n = anexosDe(fixa.pagamento.despesaId).length;
    if (!window.confirm(`Desfazer o pagamento de ${fixa.nome} (${brl(fixa.pagamento.valor)})? A despesa sai do Financeiro${n ? ` e ${n > 1 ? "os comprovantes são apagados" : "o comprovante é apagado"}` : ""}, e o mês volta para "a pagar".`)) return;
    await fin.excluir(fixa.pagamento.despesaId);
    await carregar();
  };

  const salvarCadastro = async (f) => {
    const valor = lerValor(f.valor);
    if (Number.isNaN(valor) || valor === 0) { notify("Valor previsto inválido — deixe vazio se ele muda todo mês."); return; }
    setEnviando(true);
    try {
      const corpo = { ...f, valor, diaVencimento: Number(f.diaVencimento) };
      if (f.id) await apiFetch(`/api/financeiro/fixas/${f.id}`, { method: "PATCH", token, body: corpo });
      else await apiFetch("/api/financeiro/fixas", { method: "POST", token, body: corpo });
      notify(`${f.nome} salva ✓`);
      setEditando(null);
      await carregar();
    } catch (e) { notify(`Não foi possível salvar: ${e.message}`); }
    setEnviando(false);
  };
  const alternarAtivo = async (f) => {
    try { await apiFetch(`/api/financeiro/fixas/${f.id}`, { method: "PATCH", token, body: { ativo: !f.ativo } }); await carregar(); }
    catch (e) { notify(e.message); }
  };
  const excluirCadastro = async (f) => {
    if (!window.confirm(`Excluir a despesa fixa ${f.nome}?`)) return;
    try { await apiFetch(`/api/financeiro/fixas/${f.id}`, { method: "DELETE", token }); notify("Despesa fixa excluída"); await carregar(); }
    catch (e) { notify(e.message); }
  };

  const fixas = dados.fixas || [];
  const cadastro = dados.cadastro || [];
  const pagas = fixas.filter((f) => f.pagamento);
  const abertas = fixas.filter((f) => !f.pagamento);
  const totalPago = pagas.reduce((s, f) => s + f.pagamento.valor, 0);
  const totalAberto = abertas.reduce((s, f) => s + (f.valor || 0), 0);
  const variaveisAbertas = abertas.filter((f) => f.valor == null).length;
  const vencidas = fixas.filter((f) => f.situacao === "vencida");
  const semComprovante = fin?.carregado ? pagas.filter((f) => anexosDe(f.pagamento.despesaId).length === 0).length : 0;
  const modelosLivres = MODELOS_FIXA.filter((m) => !cadastro.some((c) => c.nome.toLowerCase() === m.nome.toLowerCase()));

  return (
    <div>
      <Caixa icon={Repeat} titulo={`Despesas fixas — ${mesBr(mes)}`}
        acoes={<button style={btnLeve} onClick={carregar}><RefreshCcw size={14} className={carregando ? "spin" : ""} /> Atualizar</button>}>
        <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 12px" }}>
          O que a FN paga todo mês — crédito de telefone, marketing, DAS… <strong>Pagar</strong> lança a despesa no Financeiro (entra nos
          relatórios e no ZIP do contador) e o <strong>comprovante</strong> fica anexado nela, na hora ou depois, na mesma linha.
        </p>
        <div style={{ display: "grid", gap: 4, marginBottom: 14, width: "fit-content" }}><label style={lab}>Mês do vencimento</label>
          <input style={inp} type="month" value={mes} onChange={(e) => setMes(e.target.value || hoje().slice(0, 7))} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 14 }}>
          <Kpi rotulo="Pago" valor={brl(totalPago)} cor={VERDE} apoio={`${pagas.length} de ${fixas.length}`} />
          <Kpi rotulo="A pagar" valor={brl(totalAberto)} cor={abertas.length ? AMBAR : VERDE}
            apoio={variaveisAbertas ? `+ ${variaveisAbertas} com valor que varia` : `${abertas.length} em aberto`} />
          <Kpi rotulo="Vencidas" valor={vencidas.length} cor={vencidas.length ? VERMELHO : VERDE} apoio={vencidas.length ? brl(vencidas.reduce((s, f) => s + (f.valor || 0), 0)) : "nenhuma"} />
          <Kpi rotulo="Sem comprovante" valor={semComprovante} cor={semComprovante ? VERMELHO : VERDE} apoio="pagas sem arquivo" />
        </div>

        {carregado && cadastro.length === 0 && (
          <Aviso tom="atencao">Nenhuma despesa fixa cadastrada ainda. Comece por um modelo em "Cadastro", logo abaixo — telefone, marketing, DAS…</Aviso>
        )}
        {carregado && cadastro.length > 0 && fixas.length === 0 && <Aviso tom="ok">Nenhuma despesa fixa vence em {mesBr(mes)}.</Aviso>}
        {fixas.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
              <thead><tr>{["Despesa", "Vence", "Valor", "Situação", "Comprovante"].map((h, i) => <th key={h} style={{ ...th, textAlign: i === 2 ? "right" : "left" }}>{h}</th>)}</tr></thead>
              <tbody>
                {fixas.map((f) => {
                  const [cor, fundo] = SITUACAO_FIXA[f.situacao] || SITUACAO_FIXA["a pagar"];
                  const anexos = f.pagamento ? anexosDe(f.pagamento.despesaId) : [];
                  return (
                    <React.Fragment key={f.id}>
                      <tr>
                        <td style={td}>
                          <div style={{ fontWeight: 700, color: AZUL_MARINHO }}>{f.nome}</div>
                          <div style={{ fontSize: 11.5, color: "#8593a8" }}>{[f.subcategoria ? `${f.categoria} › ${f.subcategoria}` : f.categoria, f.fornecedor].filter(Boolean).join(" · ")}</div>
                        </td>
                        <td style={{ ...td, whiteSpace: "nowrap" }}>{dataBr(f.vencimento)}</td>
                        <td style={tdN}>
                          {f.pagamento ? <strong>{brl(f.pagamento.valor)}</strong> : f.valor != null ? brl(f.valor) : <span style={{ color: "#8593a8" }}>varia</span>}
                          {f.pagamento && f.valor != null && Math.abs(f.valor - f.pagamento.valor) > 0.009 && <div style={{ fontSize: 11, color: "#8593a8" }}>previsto {brl(f.valor)}</div>}
                        </td>
                        <td style={td}>
                          <Pilula cor={cor} fundo={fundo}>{f.situacao}</Pilula>
                          {f.pagamento && <div style={{ fontSize: 11.5, color: "#8593a8", marginTop: 3 }}>{dataBr(f.pagamento.data)} · {f.pagamento.formaPagamento || "—"}</div>}
                        </td>
                        <td style={td}>
                          {!f.pagamento && pagando !== f.id && (
                            <button style={btn} onClick={() => { setPagando(f.id); setEditando(null); }}><Wallet size={14} /> Pagar</button>
                          )}
                          {f.pagamento && (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                              {anexos.map((a) => (
                                <button key={a.id} style={{ ...btnLeve, padding: "3px 8px", fontSize: 12 }} onClick={() => fin.abrirAnexo(a)}>
                                  <FileCheck size={12} /> {a.nomeArquivo}
                                </button>
                              ))}
                              {fin?.carregado && anexos.length === 0 && <Pilula cor={VERMELHO} fundo="#FDECEC">sem comprovante</Pilula>}
                              <label style={{ ...btnLeve, padding: "3px 8px", fontSize: 12 }}>
                                <Paperclip size={12} /> Anexar
                                <input type="file" accept={ACEITA_COMPROVANTE} multiple style={{ display: "none" }}
                                  onChange={(e) => { const arquivos = [...e.target.files]; e.target.value = ""; if (arquivos.length) anexar(f.pagamento.despesaId, arquivos); }} />
                              </label>
                              <button style={{ ...btnLeve, padding: "3px 8px", fontSize: 12, color: VERMELHO }} onClick={() => desfazer(f)}><RotateCcw size={12} /> Desfazer</button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {pagando === f.id && (
                        <tr><td colSpan={5} style={{ ...td, background: "#F6F9FD" }}>
                          <FormPagarFixa fixa={f} mes={mes} enviando={enviando} onConfirmar={(form) => pagar(f, form)} onCancelar={() => setPagando(null)} />
                        </td></tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Caixa>

      <Caixa icon={Settings} titulo="Cadastro das despesas fixas"
        acoes={!editando && <button style={btn} onClick={() => { setEditando({ ...FIXA_VAZIA, inicio: mes }); setPagando(null); }}><Plus size={14} /> Nova despesa fixa</button>}>
        {!editando && modelosLivres.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 12.5, color: "#65758b" }}>Começar por um modelo:</span>
            {modelosLivres.map((m) => (
              <button key={m.nome} style={{ ...btnLeve, padding: "4px 10px", fontSize: 12.5 }} onClick={() => { setEditando({ ...FIXA_VAZIA, ...m, inicio: mes }); setPagando(null); }}>
                <Plus size={12} /> {m.nome}
              </button>
            ))}
          </div>
        )}
        {editando && <FormFixa key={editando.id || editando.nome || "nova"} inicial={editando} enviando={enviando} onSalvar={salvarCadastro} onCancelar={() => setEditando(null)} />}
        {cadastro.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
              <thead><tr>{["Nome", "Categoria", "Valor previsto", "Vence", "Desde", ""].map((h, i) => <th key={i} style={{ ...th, textAlign: i === 2 ? "right" : "left" }}>{h}</th>)}</tr></thead>
              <tbody>
                {cadastro.map((f) => (
                  <tr key={f.id} style={{ opacity: f.ativo ? 1 : 0.55 }}>
                    <td style={{ ...td, fontWeight: 700, color: AZUL_MARINHO }}>
                      {f.nome}{!f.ativo && <span style={{ fontSize: 11, color: "#8593a8", fontWeight: 500 }}> · desativada</span>}
                    </td>
                    <td style={td}>{f.subcategoria ? `${f.categoria} › ${f.subcategoria}` : f.categoria}</td>
                    <td style={tdN}>{f.valor != null ? brl(f.valor) : <span style={{ color: "#8593a8" }}>varia</span>}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>dia {f.diaVencimento}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{mesBr(f.inicio)}</td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                      <button title="Editar" style={{ ...btnLeve, padding: "3px 8px", fontSize: 12 }} onClick={() => { setEditando(f); setPagando(null); }}><Edit3 size={12} /> Editar</button>{" "}
                      <button title={f.ativo ? "Tirar dos próximos meses" : "Voltar a cobrar todo mês"} style={{ ...btnLeve, padding: "3px 8px", fontSize: 12 }} onClick={() => alternarAtivo(f)}>
                        <Power size={12} /> {f.ativo ? "Desativar" : "Reativar"}
                      </button>{" "}
                      <button title="Excluir" style={{ ...btnLeve, padding: "3px 8px", fontSize: 12, color: VERMELHO }} onClick={() => excluirCadastro(f)}><Trash2 size={12} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ fontSize: 12, color: "#65758b", margin: "10px 0 0" }}>
          Mudar o valor previsto ou o vencimento vale daqui para a frente — o que já foi pago guarda o valor da época. Despesa fixa com pagamento
          registrado não se exclui: desative, e o histórico continua.
        </p>
      </Caixa>
    </div>
  );
}

/* ============================================================
   VALORES DOS CUSTOS (Configurações Fiscais)
   ============================================================ */
const CAMPOS_CUSTO = [
  ["tecnicoPrimeiraDoDia", "Técnico — 1ª vistoria do dia (R$)"],
  ["tecnicoDemaisDoDia", "Técnico — demais vistorias do dia (R$)"],
  ["tecnicoRevistoria", "Técnico — revistoria (R$)"],
  ["artValor", "ART (individual e múltipla) (R$)"],
  ["artCapacidade", "Pessoas por ART múltipla de vistoria"],
  ["artValidadeDias", "Validade da ART múltipla (dias)"],
  ["salarioFixoAtendimento", "Salário fixo do Atendimento (R$/mês)"],
];
export function CardValoresCustos({ token, apiFetch, notify }) {
  const [f, setF] = useState(null);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    apiFetch("/api/financeiro/custos-config", { token }).then((r) => setF(r.config)).catch((e) => notify(`Não foi possível carregar os valores: ${e.message}`));
  }, []);
  const salvar = async () => {
    setSalvando(true);
    try { const r = await apiFetch("/api/financeiro/custos-config", { method: "PUT", token, body: f }); setF(r.config); notify("Valores dos custos salvos ✓"); }
    catch (e) { notify(`Não foi possível salvar: ${e.message}`); }
    setSalvando(false);
  };
  return (
    <Caixa icon={Settings} titulo="Valores dos custos da operação">
      <p style={{ fontSize: 13, color: "#65758b", margin: "0 0 12px" }}>
        É daqui que saem o pagamento dos técnicos e o custo das ARTs — o sistema lança as despesas com estes valores. Mudar um valor vale para o que
        ainda não foi pago: pagamento já registrado e ART já emitida guardam o valor da época.
      </p>
      {!f ? <span style={{ color: "#8593a8", fontSize: 13 }}>Carregando…</span> : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            {CAMPOS_CUSTO.map(([k, rotulo]) => (
              <div key={k} style={{ display: "grid", gap: 4 }}><label style={lab}>{rotulo}</label>
                <input style={inp} inputMode="decimal" value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value.replace(/[^\d,.]/g, "") })} /></div>
            ))}
          </div>
          <div style={{ marginTop: 12 }}><button style={btn} disabled={salvando} onClick={salvar}><Save size={14} /> Salvar valores</button></div>
        </>
      )}
    </Caixa>
  );
}

/* Carrega os custos calculados pelo servidor — usado pela Receita por empreendimento, que
   precisa do custo do técnico de cada vistoria sem repetir a regra 100/80 aqui no front. */
export function useCustosOperacionais({ token, apiFetch, ativo = true }) {
  const [estado, setEstado] = useState({ vistorias: [], arts: [], config: null, carregado: false });
  useEffect(() => {
    if (!ativo || !token) return;
    let vivo = true;
    Promise.all([
      apiFetch("/api/financeiro/tecnicos", { token }),
      apiFetch("/api/arts-vistoria", { token }),
    ]).then(([t, a]) => {
      if (vivo) setEstado({ vistorias: t.vistorias || [], arts: a.arts || [], config: t.config || a.config || null, carregado: true });
    }).catch(() => { if (vivo) setEstado((x) => ({ ...x, carregado: true })); });
    return () => { vivo = false; };
  }, [ativo, token]);
  return estado;
}

/* O que a Folha ainda mostra em aberto num mês: vistorias feitas e não pagas, salário do mês e
   extras — a mesma conta do "A pagar" da tela da Folha. O que já foi pago virou despesa
   (origem "folha") e já está na lista de despesas: somar aqui de novo contaria duas vezes. */
export function folhaEmAberto(folha) {
  let vistorias = 0, salarios = 0, extras = 0;
  (folha?.pessoas || []).forEach((p) => {
    vistorias += Number(p.vistorias?.aPagar) || 0;
    if (p.salario && !p.salario.pago) salarios += Number(p.salario.valor) || 0;
    extras += (p.extras || []).filter((x) => !x.pago).reduce((s, x) => s + (Number(x.valor) || 0), 0);
  });
  const c = (n) => Math.round(n * 100) / 100;
  return { vistorias: c(vistorias), salarios: c(salarios), extras: c(extras), total: c(vistorias + salarios + extras) };
}

/* A folha em aberto nos meses de um período, para os relatórios do Financeiro somarem às
   despesas. Um GET /api/folha por mês: a regra 100/80 e o salário continuam só no servidor, e o
   "a pagar" do relatório nunca diverge do que a tela da Folha mostra. */
const FOLHA_VAZIA = { vistorias: 0, salarios: 0, extras: 0, total: 0, porMes: [] };
export function useFolhaEmAberto({ token, apiFetch, meses = [], ativo = true }) {
  const chave = meses.join(",");
  const [estado, setEstado] = useState({ ...FOLHA_VAZIA, carregado: false, erro: null });
  useEffect(() => {
    if (!ativo || !token) return;
    let vivo = true;
    /* Zera ao trocar de período: mostrar o total do recorte anterior enquanto carrega seria
       um número errado com cara de certo. */
    setEstado({ ...FOLHA_VAZIA, carregado: false, erro: null });
    Promise.all(meses.map((m) => apiFetch(`/api/folha?competencia=${m}`, { token }).then((f) => ({ competencia: m, ...folhaEmAberto(f) }))))
      .then((porMes) => {
        if (!vivo) return;
        const soma = (k) => Math.round(porMes.reduce((s, x) => s + x[k], 0) * 100) / 100;
        setEstado({
          vistorias: soma("vistorias"), salarios: soma("salarios"), extras: soma("extras"), total: soma("total"),
          porMes: porMes.filter((x) => x.total > 0), carregado: true, erro: null,
        });
      })
      .catch((e) => { if (vivo) setEstado({ ...FOLHA_VAZIA, carregado: true, erro: e.message }); });
    return () => { vivo = false; };
  }, [ativo, token, chave]);
  return estado;
}

