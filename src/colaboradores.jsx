/* ============================================================
   GERÊNCIA › COLABORADORES
   ============================================================
   Pedido da Gerência (18/11/2026): tudo de cada pessoa da equipe num lugar só — o painel dela,
   a folha, os documentos e o perfil — e um cadastro de colaborador novo para todas as áreas
   (técnico, atendimento, vendas e gerência).

   Nada aqui tem regra própria nem rota nova no servidor: é uma visão por pessoa do que já existe.
   - Cadastro e perfil: /api/users (o mesmo da aba Usuários) e /api/users/:id/perfil-tecnico.
   - Folha: GET /api/folha?competencia=AAAA-MM, filtrado pela pessoa. Pagar, extras e salário
     continuam em Financeiro › Folha de pagamento — aqui só se lê, e o botão leva para lá.
   - Salário fixo no cadastro: PUT /api/folha/salarios/:id (o mesmo do "Salários fixos" da folha).
   - Documentos: carteira do conselho e acervo do técnico (MeusDocumentosTecnico) e os
     comprovantes anexados às despesas da pessoa e aos pagamentos dela na folha.
   - Painel: contas sobre clientes, docs e despesas que o App já carregou. */
import React, { useEffect, useMemo, useState } from "react";
import {
  Users, UserPlus, Search, X, LayoutGrid, Wallet, FileText, UserCog, Wrench, Headphones, TrendingUp,
  Briefcase, ClipboardCheck, Landmark, Loader2, CalendarDays, CheckCircle, Clock, Receipt, Paperclip,
  UserX, UserCheck, KeyRound, ArrowRight, RefreshCcw, ChevronLeft,
} from "lucide-react";
import { MeusDocumentosTecnico } from "./documentacao-construtora.jsx";

const AZUL_MEDIO = "#2C75B5";
const AZUL_MARINHO = "#12335B";
const CINZA_CLARO = "#F1F4F8";
const CINZA_BORDA = "#D8DEE7";
const VERDE = "#2E7D32";
const AMBAR = "#B26A00";
const VERMELHO = "#c62828";

const inp = { padding: "9px 11px", border: `1px solid ${CINZA_BORDA}`, borderRadius: 8, fontSize: 14, outline: "none", background: "#fff", fontFamily: "inherit", width: "100%", boxSizing: "border-box" };
const lab = { fontSize: 12, fontWeight: 600, color: "#5a6a80", display: "block", marginBottom: 5 };
const overlay = { position: "fixed", inset: 0, background: "rgba(18,51,91,.45)", display: "grid", placeItems: "center", zIndex: 50, padding: "clamp(10px, 3vw, 20px)", overflowY: "auto" };
const modal = { background: "#fff", borderRadius: 14, padding: 20, width: "100%", maxWidth: 520, boxShadow: "0 20px 50px rgba(18,51,91,.25)" };

const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "—");
const hojeIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
/* "1.500,00" → "1500.00": o servidor só troca a vírgula, e o ponto de milhar virava NaN. */
const paraNumero = (v) => String(v || "").trim().replace(/\./g, "").replace(",", ".");
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotuloMes = (m) => (m ? `${MESES[Number(m.slice(5, 7)) - 1]}/${m.slice(0, 4)}` : "");

/* As áreas que a Gerência enxerga. "role" é o papel de acesso que o servidor guarda: é ele que
   decide o que a pessoa vê no sistema. Técnico é o papel "vistoriador". */
export const AREAS = [
  { chave: "tecnico", role: "vistoriador", rotulo: "Técnico", Icon: Wrench, cor: "#2C75B5",
    resumo: "Faz as vistorias e os laudos. Recebe por vistoria (regra 100/80 da folha)." },
  { chave: "atendimento", role: "atendimento", rotulo: "Atendimento", Icon: Headphones, cor: "#6E36BE",
    resumo: "Clientes, agendamento, contratos, documentação e envio de laudo. Salário fixo." },
  { chave: "vendas", role: "vendas", rotulo: "Vendas", Icon: TrendingUp, cor: "#B26A00",
    resumo: "Parceiros e fornecedores do FN Clube. Salário fixo, sem comissão individual." },
  { chave: "gerencia", role: "gerencia", rotulo: "Gerência", Icon: Briefcase, cor: "#12335B",
    resumo: "Acesso completo ao sistema, inclusive financeiro. Também pode vistoriar." },
];
const OUTRAS_AREAS = [
  { chave: "documentacao", role: "documentacao", rotulo: "Documentação", Icon: ClipboardCheck, cor: "#00838F",
    resumo: "Só Documentação/TRT e ARTs de vistoria." },
  { chave: "gestor_regional", role: "gestor_regional", rotulo: "Gestor regional", Icon: Landmark, cor: "#5D4037",
    resumo: "Só a Rede Nacional, das regionais liberadas para ele." },
];
const TODAS_AREAS = [...AREAS, ...OUTRAS_AREAS];
const areaDoPapel = (role) => TODAS_AREAS.find((a) => a.role === role) || { rotulo: role || "—", Icon: Users, cor: "#65758b" };
const fazVistoria = (u) => u?.role === "vistoriador" || u?.role === "gerencia";
const ganhaSalarioFixo = (role) => role === "atendimento" || role === "vendas" || role === "documentacao";

const iniciais = (nome = "") => nome.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "?";

function Avatar({ u, tamanho = 40 }) {
  const area = areaDoPapel(u.role);
  return (
    <div style={{ width: tamanho, height: tamanho, borderRadius: "50%", background: area.cor, color: "#fff", display: "grid", placeItems: "center",
      fontWeight: 800, fontSize: tamanho * 0.36, flexShrink: 0, opacity: u.ativo === false ? 0.45 : 1 }}>
      {iniciais(u.nome)}
    </div>
  );
}

function Pilula({ children, cor = AZUL_MARINHO, fundo = CINZA_CLARO }) {
  return <span style={{ fontSize: 11.5, fontWeight: 700, color: cor, background: fundo, borderRadius: 20, padding: "2px 9px", whiteSpace: "nowrap" }}>{children}</span>;
}

function Kpi({ label, valor, cor = AZUL_MARINHO, Icon, detalhe }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 12, padding: "13px 15px", display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
      {Icon && <div style={{ width: 34, height: 34, borderRadius: 9, background: CINZA_CLARO, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={16} color={cor} /></div>}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: cor, lineHeight: 1.15 }}>{valor}</div>
        <div style={{ fontSize: 12, color: "#65758b", marginTop: 2 }}>{label}</div>
        {detalhe && <div style={{ fontSize: 11.5, color: "#8593a8", marginTop: 1 }}>{detalhe}</div>}
      </div>
    </div>
  );
}

function Bloco({ titulo, Icon, children, acao }) {
  return (
    <section style={{ background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 14, padding: 18, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12, flexWrap: "wrap" }}>
        {Icon && <div style={{ width: 28, height: 28, borderRadius: 8, background: CINZA_CLARO, display: "grid", placeItems: "center" }}><Icon size={15} color={AZUL_MEDIO} /></div>}
        <h3 style={{ margin: 0, fontSize: 14.5, color: AZUL_MARINHO, flex: 1 }}>{titulo}</h3>
        {acao}
      </div>
      {children}
    </section>
  );
}

const gradeKpi = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 };
const vazio = { fontSize: 13, color: "#8593a8", margin: 0 };

/* A folha do mês é uma só para todo mundo (GET /api/folha): carregada uma vez por mês aberto e
   filtrada por pessoa — nada de um pedido por colaborador. */
function useFolhaDoMes({ token, apiFetch, mes }) {
  const [folha, setFolha] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const carregar = async () => {
    setCarregando(true); setErro("");
    try { setFolha(await apiFetch(`/api/folha?competencia=${mes}`, { token })); }
    catch (e) { setErro(e.message); setFolha(null); }
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, [mes]);
  return { folha, carregando, erro, recarregar: carregar };
}

/* ============================================================ */
export default function AbaColaboradores({
  token, apiFetch, notify, usuarios = [], carregando, criarUsuario, atualizarUsuario, salvarPerfilTecnico,
  usuarioAtualId, clientes = [], docs = [], fin, aoAbrirFolha,
}) {
  const [busca, setBusca] = useState("");
  const [filtroArea, setFiltroArea] = useState("");
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [selecionadoId, setSelecionadoId] = useState(null);
  const [sub, setSub] = useState("painel");
  const [novoAberto, setNovoAberto] = useState(false);
  const [mes, setMes] = useState(() => hojeIso().slice(0, 7));
  const folhaDoMes = useFolhaDoMes({ token, apiFetch, mes });

  const contagem = useMemo(() => {
    const c = {};
    usuarios.filter((u) => u.ativo !== false).forEach((u) => { c[u.role] = (c[u.role] || 0) + 1; });
    return c;
  }, [usuarios]);

  const lista = useMemo(() => usuarios
    .filter((u) => mostrarInativos || u.ativo !== false)
    .filter((u) => !filtroArea || (filtroArea === "outros" ? !AREAS.some((a) => a.role === u.role) : u.role === filtroArea))
    .filter((u) => !busca || `${u.nome} ${u.email}`.toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => (b.ativo !== false) - (a.ativo !== false) || String(a.nome).localeCompare(String(b.nome), "pt-BR")),
  [usuarios, busca, filtroArea, mostrarInativos]);

  const selecionado = usuarios.find((u) => String(u.id) === String(selecionadoId)) || null;
  const pessoaNaFolha = (id) => (folhaDoMes.folha?.pessoas || []).find((p) => String(p.usuarioId) === String(id)) || null;

  const aoCriar = (id) => { if (id) { setSelecionadoId(id); setSub("perfil"); } };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Bloco titulo="Colaboradores" Icon={Users}
        acao={<button className="btn-add" style={{ width: "auto", padding: "9px 16px" }} onClick={() => setNovoAberto(true)}><UserPlus size={16} /> Novo colaborador</button>}>
        <p style={{ fontSize: 13, color: "#65758b", margin: "0 0 12px" }}>
          Toda a equipe num lugar só. Escolha uma pessoa para ver o painel, a folha, os documentos e o perfil dela.
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <BotaoFiltro ativo={!filtroArea} onClick={() => setFiltroArea("")}>Todos ({usuarios.filter((u) => u.ativo !== false).length})</BotaoFiltro>
          {AREAS.map((a) => (
            <BotaoFiltro key={a.chave} ativo={filtroArea === a.role} cor={a.cor} onClick={() => setFiltroArea(a.role)}>
              <a.Icon size={13} /> {a.rotulo} ({contagem[a.role] || 0})
            </BotaoFiltro>
          ))}
          <BotaoFiltro ativo={filtroArea === "outros"} onClick={() => setFiltroArea("outros")}>
            Outros ({OUTRAS_AREAS.reduce((s, a) => s + (contagem[a.role] || 0), 0)})
          </BotaoFiltro>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <Search size={14} color="#8593a8" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
            <input style={{ ...inp, paddingLeft: 30 }} placeholder="Buscar por nome ou e-mail…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <label style={{ fontSize: 13, color: "#4a5a70", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} /> Mostrar desligados
          </label>
        </div>

        {carregando && <p style={vazio}>Carregando equipe…</p>}
        {!carregando && lista.length === 0 && <p style={vazio}>Ninguém encontrado com esses filtros.</p>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>
          {lista.map((u) => {
            const area = areaDoPapel(u.role);
            const ativo = String(u.id) === String(selecionadoId);
            const naFolha = pessoaNaFolha(u.id);
            return (
              <button key={u.id} type="button" onClick={() => { setSelecionadoId(ativo ? null : u.id); if (!ativo) setSub("painel"); }}
                style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 12px", borderRadius: 12, textAlign: "left", cursor: "pointer",
                  border: `1.5px solid ${ativo ? AZUL_MEDIO : CINZA_BORDA}`, background: ativo ? "#EEF5FC" : "#fff", fontFamily: "inherit", minWidth: 0 }}>
                <Avatar u={u} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, color: AZUL_MARINHO, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {u.nome}{String(u.id) === String(usuarioAtualId) && <span style={{ color: "#8593a8", fontWeight: 500 }}> (você)</span>}
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 3, flexWrap: "wrap" }}>
                    <Pilula cor={area.cor}>{area.rotulo}</Pilula>
                    {u.ativo === false && <Pilula cor={VERMELHO} fundo="#FDECEC">Desligado</Pilula>}
                    {naFolha?.aPagar > 0 && <Pilula cor={AMBAR} fundo="#FFF4E0">{brl(naFolha.aPagar)} a pagar</Pilula>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </Bloco>

      {selecionado && (
        <FichaColaborador key={selecionado.id} u={selecionado} sub={sub} setSub={setSub} onFechar={() => setSelecionadoId(null)}
          token={token} apiFetch={apiFetch} notify={notify} clientes={clientes} docs={docs} fin={fin}
          mes={mes} setMes={setMes} folhaDoMes={folhaDoMes} naFolha={pessoaNaFolha(selecionado.id)}
          atualizarUsuario={atualizarUsuario} salvarPerfilTecnico={salvarPerfilTecnico}
          ehVoce={String(selecionado.id) === String(usuarioAtualId)} aoAbrirFolha={aoAbrirFolha} />
      )}

      {novoAberto && (
        <ModalNovoColaborador onFechar={() => setNovoAberto(false)} criarUsuario={criarUsuario}
          salvarPerfilTecnico={salvarPerfilTecnico} token={token} apiFetch={apiFetch} notify={notify}
          aoCriar={(id) => { setNovoAberto(false); aoCriar(id); folhaDoMes.recarregar(); }} />
      )}
    </div>
  );
}

function BotaoFiltro({ ativo, cor = AZUL_MARINHO, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 20, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
        fontFamily: "inherit", border: `1.5px solid ${ativo ? cor : CINZA_BORDA}`, background: ativo ? cor : "#fff", color: ativo ? "#fff" : "#4a5a70" }}>
      {children}
    </button>
  );
}

/* ============================================================
   FICHA: uma pessoa, com as sub-abas
   ============================================================ */
const SUBABAS = [
  { chave: "painel", rotulo: "Painel", Icon: LayoutGrid },
  { chave: "folha", rotulo: "Folha", Icon: Wallet },
  { chave: "documentos", rotulo: "Documentos", Icon: FileText },
  { chave: "perfil", rotulo: "Perfil", Icon: UserCog },
];

function FichaColaborador(props) {
  const { u, sub, setSub, onFechar } = props;
  const area = areaDoPapel(u.role);
  return (
    <section style={{ background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 14, minWidth: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: `1px solid ${CINZA_BORDA}`, flexWrap: "wrap" }}>
        <button className="icon-btn" onClick={onFechar} title="Voltar à lista"><ChevronLeft size={18} color={AZUL_MARINHO} /></button>
        <Avatar u={u} tamanho={46} />
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: AZUL_MARINHO }}>{u.nome}</div>
          <div style={{ fontSize: 12.5, color: "#65758b", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 2 }}>
            <Pilula cor={area.cor}>{area.rotulo}</Pilula>
            <span>{u.email}</span>
            {u.criado_em && <span>· na equipe desde {dataBr(u.criado_em)}</span>}
            {u.ativo === false && <Pilula cor={VERMELHO} fundo="#FDECEC">Desligado</Pilula>}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 2, padding: "0 12px", borderBottom: `1px solid ${CINZA_BORDA}`, overflowX: "auto", background: CINZA_CLARO }}>
        {SUBABAS.map((s) => (
          <button key={s.chave} type="button" onClick={() => setSub(s.chave)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "11px 14px", border: "none", background: "none", cursor: "pointer",
              fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap",
              color: sub === s.chave ? AZUL_MEDIO : "#65758b", borderBottom: `2.5px solid ${sub === s.chave ? AZUL_MEDIO : "transparent"}` }}>
            <s.Icon size={15} /> {s.rotulo}
          </button>
        ))}
      </div>
      <div style={{ padding: 16, display: "grid", gap: 14, background: "#FAFBFD" }}>
        {sub === "painel" && <SubPainel {...props} />}
        {sub === "folha" && <SubFolha {...props} />}
        {sub === "documentos" && <SubDocumentos {...props} />}
        {sub === "perfil" && <SubPerfil {...props} />}
      </div>
    </section>
  );
}

function SeletorMes({ mes, setMes, aoRecarregar, carregando }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <label style={{ fontSize: 12.5, fontWeight: 600, color: "#5a6a80" }}>Mês</label>
      <input type="month" style={{ ...inp, width: "auto" }} value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} />
      {aoRecarregar && (
        <button className="icon-btn" onClick={aoRecarregar} title="Recarregar" disabled={carregando}>
          {carregando ? <Loader2 size={15} className="spin" /> : <RefreshCcw size={15} color={AZUL_MEDIO} />}
        </button>
      )}
    </div>
  );
}

/* ---------- Painel ---------- */
function SubPainel({ u, clientes, docs, fin, mes, setMes, folhaDoMes, naFolha }) {
  const id = String(u.id);
  const hoje = hojeIso();
  const tecnico = fazVistoria(u);

  const vistorias = useMemo(() => {
    if (!tecnico) return null;
    const escalados = clientes.filter((c) => String(c.vistoriadorId || "") === id);
    const feitos = docs.filter((d) => String(d.vistoriadorId || "") === id);
    const feitosNoMes = feitos.filter((d) => String(d.data || "").slice(0, 7) === mes);
    const idsComLaudo = new Set(feitos.map((d) => String(d.clienteId || "")).filter(Boolean));
    const proximas = escalados
      .filter((c) => c.dataDesejada && c.dataDesejada >= hoje && !idsComLaudo.has(String(c.id)))
      .sort((a, b) => `${a.dataDesejada} ${a.horarioDesejado}`.localeCompare(`${b.dataDesejada} ${b.horarioDesejado}`));
    const laudoPendente = feitos.filter((d) => !/aprovad|entregue|enviad/i.test(`${d.relatorio} ${d.status}`));
    return { escalados, feitos, feitosNoMes, proximas, laudoPendente };
  }, [tecnico, clientes, docs, id, mes, hoje]);

  const despesas = useMemo(() => (fin?.despesas || []).filter((d) => String(d.colaboradorId || "") === id), [fin?.despesas, id]);
  const despesasMes = despesas.filter((d) => String(d.data || "").slice(0, 7) === mes);
  const pendentesConferencia = despesas.filter((d) => d.statusAprovacao === "Aguardando conferência" || d.statusAprovacao === "Necessita correção");

  return (
    <>
      <SeletorMes mes={mes} setMes={setMes} />

      <Bloco titulo={`Pagamento em ${rotuloMes(mes)}`} Icon={Wallet}>
        {folhaDoMes.carregando && <p style={vazio}>Carregando a folha…</p>}
        {folhaDoMes.erro && <p style={{ ...vazio, color: VERMELHO }}>Não foi possível ler a folha: {folhaDoMes.erro}</p>}
        {!folhaDoMes.carregando && !folhaDoMes.erro && (
          naFolha ? (
            <div style={gradeKpi}>
              <Kpi label="Total do mês" valor={brl(naFolha.devido)} Icon={Wallet} />
              <Kpi label="Já pago" valor={brl(naFolha.pago)} cor={VERDE} Icon={CheckCircle} />
              <Kpi label="A pagar" valor={brl(naFolha.aPagar)} cor={naFolha.aPagar ? AMBAR : "#8593a8"} Icon={Clock} />
            </div>
          ) : <p style={vazio}>Nada na folha deste mês para esta pessoa.</p>
        )}
      </Bloco>

      {vistorias && (
        <Bloco titulo="Vistorias" Icon={Wrench}>
          <div style={gradeKpi}>
            <Kpi label={`Realizadas em ${rotuloMes(mes)}`} valor={vistorias.feitosNoMes.length} Icon={CheckCircle} cor={VERDE} />
            <Kpi label="Realizadas no total" valor={vistorias.feitos.length} Icon={ClipboardCheck} />
            <Kpi label="Próximas agendadas" valor={vistorias.proximas.length} Icon={CalendarDays} cor={AZUL_MEDIO} />
            <Kpi label="Laudos ainda não aprovados" valor={vistorias.laudoPendente.length} Icon={Clock} cor={vistorias.laudoPendente.length ? AMBAR : "#8593a8"} />
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: AZUL_MARINHO, marginBottom: 6 }}>Agenda</div>
            {vistorias.proximas.length === 0 ? <p style={vazio}>Nenhuma vistoria agendada daqui para frente.</p> : (
              <div style={{ display: "grid", gap: 6 }}>
                {vistorias.proximas.slice(0, 8).map((c) => (
                  <div key={c.id} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13, padding: "7px 10px", background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 9, flexWrap: "wrap" }}>
                    <strong style={{ color: AZUL_MARINHO, minWidth: 92 }}>{dataBr(c.dataDesejada)} {c.horarioDesejado || ""}</strong>
                    <span style={{ flex: 1, minWidth: 140 }}>{c.nome}</span>
                    <span style={{ color: "#65758b" }}>{c.empreendimento}</span>
                  </div>
                ))}
                {vistorias.proximas.length > 8 && <p style={vazio}>e mais {vistorias.proximas.length - 8}…</p>}
              </div>
            )}
          </div>
        </Bloco>
      )}

      <Bloco titulo="Despesas lançadas" Icon={Receipt}>
        {!fin?.despesas ? <p style={vazio}>Carregando despesas…</p> : (
          <div style={gradeKpi}>
            <Kpi label={`Em ${rotuloMes(mes)}`} valor={brl(despesasMes.reduce((s, d) => s + (Number(d.valor) || 0), 0))} detalhe={`${despesasMes.length} lançamento(s)`} Icon={Receipt} />
            <Kpi label="Esperando conferência ou correção" valor={pendentesConferencia.length} cor={pendentesConferencia.length ? AMBAR : "#8593a8"} Icon={Clock} />
            <Kpi label="Lançadas no total" valor={despesas.length} Icon={FileText} />
          </div>
        )}
      </Bloco>
    </>
  );
}

/* ---------- Folha ---------- */
function SubFolha({ u, fin, mes, setMes, folhaDoMes, naFolha, aoAbrirFolha }) {
  const despesaPorId = useMemo(() => Object.fromEntries((fin?.despesas || []).map((d) => [d.id, d])), [fin?.despesas]);
  const p = naFolha;
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <SeletorMes mes={mes} setMes={setMes} aoRecarregar={folhaDoMes.recarregar} carregando={folhaDoMes.carregando} />
        {aoAbrirFolha && (
          <button className="btn-ghost" style={{ color: AZUL_MEDIO, background: CINZA_CLARO, width: "auto" }} onClick={aoAbrirFolha}>
            Pagar ou lançar extra na Folha de pagamento <ArrowRight size={14} />
          </button>
        )}
      </div>
      {folhaDoMes.erro && <p style={{ ...vazio, color: VERMELHO }}>Não foi possível ler a folha: {folhaDoMes.erro}</p>}
      {!folhaDoMes.carregando && !folhaDoMes.erro && !p && (
        <Bloco titulo={`Folha de ${rotuloMes(mes)}`} Icon={Wallet}>
          <p style={vazio}>
            {u.nome} não tem nada na folha deste mês.
            {!fazVistoria(u) && " Quem não é técnico só entra na folha com salário fixo — defina em Perfil › Salário fixo."}
          </p>
        </Bloco>
      )}
      {p && (
        <>
          <div style={gradeKpi}>
            <Kpi label="Vistorias" valor={p.vistorias ? brl(p.vistorias.devido) : "—"} detalhe={p.vistorias ? `${p.vistorias.qtd} vistoria(s)` : null} Icon={Wrench} />
            <Kpi label="Salário fixo" valor={p.salario ? brl(p.salario.valor) : "—"} detalhe={p.salario ? (p.salario.pago ? "pago" : "a pagar") : null} Icon={Briefcase} />
            <Kpi label="Extras" valor={brl(p.extras.reduce((s, e) => s + e.valor, 0))} detalhe={`${p.extras.length} lançamento(s)`} Icon={Receipt} />
            <Kpi label="Pago" valor={brl(p.pago)} cor={VERDE} Icon={CheckCircle} />
            <Kpi label="A pagar" valor={brl(p.aPagar)} cor={p.aPagar ? AMBAR : "#8593a8"} Icon={Clock} />
          </div>

          {p.extras.length > 0 && (
            <Bloco titulo="Extras do mês" Icon={Receipt}>
              <Tabela cabecalho={["Descrição", "Valor", "Situação"]} linhas={p.extras.map((e) => [
                e.descricao || "—", brl(e.valor), e.pago ? <Pilula cor={VERDE} fundo="#E6F4EC">Pago</Pilula> : <Pilula cor={AMBAR} fundo="#FFF4E0">A pagar</Pilula>,
              ])} />
            </Bloco>
          )}

          <Bloco titulo="Pagamentos feitos" Icon={CheckCircle}>
            {p.pagamentos.length === 0 ? <p style={vazio}>Nenhum pagamento registrado neste mês.</p> : (
              <Tabela cabecalho={["Data", "Referente a", "Forma", "Valor", "Comprovante"]} linhas={p.pagamentos.map((x) => {
                const anexos = (x.despesaId && despesaPorId[x.despesaId]?.anexos) || [];
                const partes = [x.valorVistorias && "vistorias", x.valorSalario && "salário", x.valorExtras && "extras"].filter(Boolean).join(", ");
                return [
                  dataBr(x.pagoEm), (x.dia ? `dia ${dataBr(x.dia)} · ` : "") + (partes || "—"), x.formaPagamento || "—", brl(x.valor),
                  <ListaAnexos anexos={anexos} fin={fin} />,
                ];
              })} />
            )}
          </Bloco>
        </>
      )}
    </>
  );
}

function Tabela({ cabecalho, linhas }) {
  const th = { textAlign: "left", padding: "8px 10px", color: AZUL_MARINHO, borderBottom: `2px solid ${CINZA_BORDA}`, fontSize: 12.5, whiteSpace: "nowrap" };
  const td = { padding: "8px 10px", borderBottom: `1px solid ${CINZA_BORDA}`, fontSize: 13, verticalAlign: "top" };
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr style={{ background: CINZA_CLARO }}>{cabecalho.map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{linhas.map((l, i) => <tr key={i}>{l.map((c, j) => <td key={j} style={td}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function ListaAnexos({ anexos = [], fin }) {
  if (!anexos.length) return <span style={{ color: "#8593a8" }}>—</span>;
  return (
    <div style={{ display: "grid", gap: 3 }}>
      {anexos.map((a) => (
        <button key={a.id} type="button" onClick={() => fin?.abrirAnexo?.(a)} title={a.nomeArquivo}
          style={{ background: "none", border: "none", color: AZUL_MEDIO, cursor: "pointer", padding: 0, textAlign: "left", fontSize: 12.5, display: "inline-flex", gap: 4, alignItems: "center", fontFamily: "inherit" }}>
          <Paperclip size={12} /> {a.nomeArquivo || "comprovante"}
        </button>
      ))}
    </div>
  );
}

/* ---------- Documentos ---------- */
function SubDocumentos({ u, token, apiFetch, notify, fin, folhaDoMes, naFolha, mes }) {
  const id = String(u.id);
  const despesasComAnexo = useMemo(() => (fin?.despesas || [])
    .filter((d) => String(d.colaboradorId || "") === id && (d.anexos || []).length)
    .sort((a, b) => String(b.data || "").localeCompare(String(a.data || ""))), [fin?.despesas, id]);
  const despesaPorId = useMemo(() => Object.fromEntries((fin?.despesas || []).map((d) => [d.id, d])), [fin?.despesas]);
  const comprovantesFolha = (naFolha?.pagamentos || []).filter((x) => x.despesaId && (despesaPorId[x.despesaId]?.anexos || []).length);

  return (
    <>
      {fazVistoria(u) ? (
        <Bloco titulo="Documentos técnicos (carteira do conselho e acervo)" Icon={FileText}>
          <p style={{ ...vazio, marginBottom: 10 }}>
            São os documentos que vão para a construtora antes da vistoria. A Gerência pode anexar ou atualizar por aqui.
          </p>
          <MeusDocumentosTecnico token={token} apiFetch={apiFetch} notify={notify} usuarioId={u.id} podeEditar compacto />
        </Bloco>
      ) : (
        <Bloco titulo="Documentos técnicos" Icon={FileText}>
          <p style={vazio}>Carteira do conselho e acervo técnico só são pedidos de quem faz vistoria (Técnico ou Gerência).</p>
        </Bloco>
      )}

      <Bloco titulo={`Comprovantes de pagamento da folha · ${rotuloMes(mes)}`} Icon={Wallet}>
        {folhaDoMes.carregando ? <p style={vazio}>Carregando…</p> : comprovantesFolha.length === 0 ? (
          <p style={vazio}>Nenhum comprovante de pagamento anexado neste mês. Troque o mês no Painel ou na Folha para ver outros.</p>
        ) : (
          <Tabela cabecalho={["Data", "Valor", "Arquivo"]} linhas={comprovantesFolha.map((x) => [
            dataBr(x.pagoEm), brl(x.valor), <ListaAnexos anexos={despesaPorId[x.despesaId].anexos} fin={fin} />,
          ])} />
        )}
      </Bloco>

      <Bloco titulo="Notas e comprovantes das despesas que lançou" Icon={Receipt}>
        {!fin?.despesas ? <p style={vazio}>Carregando…</p> : despesasComAnexo.length === 0 ? <p style={vazio}>Nenhuma despesa com comprovante.</p> : (
          <Tabela cabecalho={["Data", "Descrição", "Valor", "Arquivos"]} linhas={despesasComAnexo.slice(0, 40).map((d) => [
            dataBr(d.data), d.descricao || d.fornecedor || "—", brl(d.valor), <ListaAnexos anexos={d.anexos} fin={fin} />,
          ])} />
        )}
      </Bloco>
    </>
  );
}

/* ---------- Perfil ---------- */
function SubPerfil({ u, token, apiFetch, notify, atualizarUsuario, salvarPerfilTecnico, ehVoce, naFolha, folhaDoMes }) {
  const [salvando, setSalvando] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [qualificacao, setQualificacao] = useState(u.qualificacao_tecnica || "");
  const [registro, setRegistro] = useState(u.registro_profissional || "");
  const [assinatura, setAssinatura] = useState(null);
  const salarioAtual = (folhaDoMes.folha?.salariosPersonalizados || []).find((s) => String(s.usuarioId) === String(u.id));
  const [salario, setSalario] = useState(salarioAtual?.valor != null ? String(salarioAtual.valor).replace(".", ",") : "");
  useEffect(() => {
    if (salarioAtual?.valor != null) setSalario(String(salarioAtual.valor).replace(".", ","));
  }, [salarioAtual?.valor]);

  const rodar = async (chave, fn) => {
    setSalvando(chave);
    try { await fn(); } catch (e) { notify(`Não foi possível salvar: ${e.message}`); }
    setSalvando("");
  };
  const trocarArea = (role) => rodar("papel", () => atualizarUsuario(u.id, { role }));
  const alternarAtivo = () => rodar("ativo", () => atualizarUsuario(u.id, { ativo: u.ativo === false }));
  const trocarSenha = () => {
    if (novaSenha.length < 8) { notify("A senha precisa ter pelo menos 8 caracteres"); return; }
    rodar("senha", async () => { await atualizarUsuario(u.id, { senha: novaSenha }); setNovaSenha(""); });
  };
  const salvarTecnico = () => rodar("tecnico", async () => {
    const patch = { qualificacao, registro };
    if (assinatura) patch.assinaturaImagem = assinatura;
    await salvarPerfilTecnico(u.id, patch);
    setAssinatura(null);
  });
  const salvarSalario = () => rodar("salario", async () => {
    await apiFetch(`/api/folha/salarios/${u.id}`, { method: "PUT", token, body: { valor: salario.trim() === "" ? null : paraNumero(salario), ativo: true } });
    notify("Salário fixo salvo ✓");
    folhaDoMes.recarregar();
  });
  const tirarDaFolhaFixa = () => rodar("salario", async () => {
    await apiFetch(`/api/folha/salarios/${u.id}`, { method: "PUT", token, body: { ativo: false } });
    notify("Saiu da folha fixa ✓");
    folhaDoMes.recarregar();
  });
  const onArquivo = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { notify("Envie uma imagem (PNG ou JPG) da assinatura"); return; }
    const r = new FileReader();
    r.onload = () => setAssinatura(r.result);
    r.readAsDataURL(file);
  };

  return (
    <>
      <Bloco titulo="Área e acesso" Icon={UserCog}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
          {TODAS_AREAS.map((a) => (
            <CartaoArea key={a.role} area={a} ativo={u.role === a.role} desabilitado={ehVoce || !!salvando}
              onClick={() => u.role !== a.role && trocarArea(a.role)} />
          ))}
        </div>
        <p style={{ fontSize: 12, color: "#65758b", margin: "8px 0 0" }}>
          {ehVoce ? "Você não pode mudar a própria área." : areaDoPapel(u.role).resumo}
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14, alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={lab}>Nova senha (mín. 8 caracteres)</label>
            <input style={inp} value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="digite para redefinir" />
          </div>
          <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO, width: "auto" }} onClick={trocarSenha} disabled={!novaSenha || !!salvando}>
            <KeyRound size={14} /> {salvando === "senha" ? "Salvando…" : "Redefinir senha"}
          </button>
          {!ehVoce && (
            <button className="btn-ghost" style={{ color: u.ativo === false ? VERDE : VERMELHO, background: CINZA_CLARO, width: "auto" }} onClick={alternarAtivo} disabled={!!salvando}>
              {u.ativo === false ? <><UserCheck size={14} /> Reativar acesso</> : <><UserX size={14} /> Desligar (tira o acesso)</>}
            </button>
          )}
        </div>
        {u.ativo !== false && !ehVoce && (
          <p style={{ fontSize: 12, color: "#8593a8", margin: "8px 0 0" }}>
            Desligar não apaga nada: laudos e pagamentos continuam guardados, e o salário fixo para de contar depois do mês da saída.
          </p>
        )}
      </Bloco>

      {fazVistoria(u) && (
        <Bloco titulo="Dados técnicos para o laudo" Icon={Wrench}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            <div><label style={lab}>Qualificação técnica</label>
              <input style={inp} value={qualificacao} onChange={(e) => setQualificacao(e.target.value)} placeholder="Ex.: Técnico em Edificações" /></div>
            <div><label style={lab}>Registro profissional</label>
              <input style={inp} value={registro} onChange={(e) => setRegistro(e.target.value)} placeholder="Ex.: CFT 12345678" /></div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
            <label className="btn-ghost" style={{ color: AZUL_MEDIO, background: CINZA_CLARO, cursor: "pointer", width: "auto" }}>
              {assinatura ? "Trocar imagem da assinatura" : u.tem_assinatura ? "Substituir assinatura" : "Anexar assinatura"}
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={onArquivo} />
            </label>
            {assinatura && <img src={assinatura} alt="Assinatura" style={{ maxHeight: 50, border: `1px solid ${CINZA_BORDA}`, borderRadius: 6, background: "#fff" }} />}
            {!assinatura && <span style={{ fontSize: 12.5, color: u.tem_assinatura ? VERDE : AMBAR }}>{u.tem_assinatura ? "Assinatura cadastrada" : "Sem assinatura cadastrada"}</span>}
            <button className="btn-solid" style={{ width: "auto", marginLeft: "auto" }} onClick={salvarTecnico} disabled={!!salvando}>
              {salvando === "tecnico" ? "Salvando…" : "Salvar dados técnicos"}
            </button>
          </div>
        </Bloco>
      )}

      <Bloco titulo="Salário fixo" Icon={Briefcase}>
        <p style={{ ...vazio, marginBottom: 10 }}>
          {u.role === "vistoriador"
            ? "Técnico recebe por vistoria pela regra da folha. Só preencha se ele também tiver um fixo."
            : u.role === "atendimento"
              ? "Vazio = o salário padrão do Atendimento (Configurações Fiscais)."
              : "Informe o valor mensal para esta pessoa entrar na folha."}
          {naFolha?.salario && <> Neste mês: <strong>{brl(naFolha.salario.valor)}</strong>.</>}
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ width: 180 }}>
            <label style={lab}>Valor mensal (R$)</label>
            <input style={inp} inputMode="decimal" value={salario} onChange={(e) => setSalario(e.target.value)} placeholder="0,00" />
          </div>
          <button className="btn-solid" style={{ width: "auto" }} onClick={salvarSalario} disabled={!!salvando}>{salvando === "salario" ? "Salvando…" : "Salvar salário"}</button>
          {salarioAtual?.ativo !== false && (salarioAtual || u.role === "atendimento") && (
            <button className="btn-ghost" style={{ color: VERMELHO, background: CINZA_CLARO, width: "auto" }} onClick={tirarDaFolhaFixa} disabled={!!salvando}>Tirar da folha fixa</button>
          )}
        </div>
      </Bloco>
    </>
  );
}

function CartaoArea({ area, ativo, desabilitado, onClick }) {
  return (
    <button type="button" onClick={onClick} disabled={desabilitado && !ativo}
      style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 11px", borderRadius: 10, cursor: desabilitado ? "default" : "pointer",
        border: `1.5px solid ${ativo ? area.cor : CINZA_BORDA}`, background: ativo ? `${area.cor}14` : "#fff", fontFamily: "inherit", textAlign: "left",
        opacity: desabilitado && !ativo ? 0.6 : 1 }}>
      <area.Icon size={16} color={area.cor} />
      <span style={{ fontWeight: 700, fontSize: 13, color: ativo ? area.cor : "#4a5a70" }}>{area.rotulo}</span>
    </button>
  );
}

/* ============================================================
   NOVO COLABORADOR
   ============================================================ */
const gerarSenha = () => {
  const letras = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const v = new Uint32Array(10);
  crypto.getRandomValues(v);
  return Array.from(v, (n) => letras[n % letras.length]).join("");
};

function ModalNovoColaborador({ onFechar, criarUsuario, salvarPerfilTecnico, token, apiFetch, notify, aoCriar }) {
  const [area, setArea] = useState(AREAS[0]);
  const [verOutras, setVerOutras] = useState(false);
  const [f, setF] = useState({ nome: "", email: "", senha: gerarSenha(), qualificacao: "", registro: "", salario: "" });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const tecnico = area.role === "vistoriador" || area.role === "gerencia";
  const pedeSalario = ganhaSalarioFixo(area.role);

  const salvar = async () => {
    setErro("");
    if (!f.nome.trim()) return setErro("Informe o nome.");
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return setErro("Informe um e-mail válido — é com ele que a pessoa entra no sistema.");
    if (f.senha.length < 8) return setErro("A senha provisória precisa ter pelo menos 8 caracteres.");
    if (pedeSalario && f.salario.trim() && !(Number(paraNumero(f.salario)) > 0)) return setErro("Salário inválido.");
    setSalvando(true);
    try {
      const r = await criarUsuario({ nome: f.nome.trim(), email: f.email.trim(), senha: f.senha, role: area.role });
      const id = r?.id;
      /* O que vem depois do cadastro não desfaz a pessoa criada: se falhar, avisa e segue. */
      if (id && tecnico && (f.qualificacao.trim() || f.registro.trim())) {
        try { await salvarPerfilTecnico(id, { qualificacao: f.qualificacao.trim(), registro: f.registro.trim() }); }
        catch (e) { notify(`Colaborador criado, mas os dados técnicos não salvaram: ${e.message}`); }
      }
      if (id && pedeSalario && f.salario.trim()) {
        try { await apiFetch(`/api/folha/salarios/${id}`, { method: "PUT", token, body: { valor: paraNumero(f.salario), ativo: true } }); }
        catch (e) { notify(`Colaborador criado, mas o salário não salvou: ${e.message}`); }
      }
      aoCriar(id);
    } catch (e) { setErro(e.message); }
    setSalvando(false);
  };

  return (
    <div className="no-print" style={overlay} onClick={onFechar}>
      <div style={{ ...modal, maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <strong style={{ fontSize: 16, color: AZUL_MARINHO, display: "flex", alignItems: "center", gap: 8 }}><UserPlus size={18} /> Novo colaborador</strong>
          <button className="icon-btn" onClick={onFechar}><X size={16} /></button>
        </div>

        <label style={lab}>Área</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(115px, 1fr))", gap: 8 }}>
          {(verOutras ? TODAS_AREAS : AREAS).map((a) => (
            <button key={a.role} type="button" onClick={() => setArea(a)}
              style={{ display: "grid", justifyItems: "center", gap: 5, padding: "12px 8px", borderRadius: 11, cursor: "pointer", fontFamily: "inherit",
                border: `2px solid ${area.role === a.role ? a.cor : CINZA_BORDA}`, background: area.role === a.role ? `${a.cor}14` : "#fff" }}>
              <a.Icon size={20} color={a.cor} />
              <span style={{ fontWeight: 700, fontSize: 13, color: area.role === a.role ? a.cor : "#4a5a70" }}>{a.rotulo}</span>
            </button>
          ))}
        </div>
        {!verOutras && (
          <button type="button" onClick={() => setVerOutras(true)} style={{ background: "none", border: "none", color: AZUL_MEDIO, fontSize: 12.5, cursor: "pointer", padding: "6px 0 0", fontFamily: "inherit" }}>
            Outras áreas (Documentação, Gestor regional)
          </button>
        )}
        <p style={{ fontSize: 12, color: "#65758b", margin: "6px 0 14px" }}>{area.resumo}</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          <div style={{ gridColumn: "1 / -1" }}><label style={lab}>Nome completo</label>
            <input style={inp} value={f.nome} onChange={(e) => set("nome", e.target.value)} autoFocus /></div>
          <div><label style={lab}>E-mail (login)</label>
            <input style={inp} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
          <div><label style={lab}>Senha provisória</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input style={inp} value={f.senha} onChange={(e) => set("senha", e.target.value)} />
              <button type="button" className="icon-btn" title="Gerar outra" onClick={() => set("senha", gerarSenha())}><RefreshCcw size={15} color={AZUL_MEDIO} /></button>
            </div>
          </div>
          {tecnico && (
            <>
              <div><label style={lab}>Qualificação técnica (opcional)</label>
                <input style={inp} value={f.qualificacao} onChange={(e) => set("qualificacao", e.target.value)} placeholder="Ex.: Técnico em Edificações" /></div>
              <div><label style={lab}>Registro profissional (opcional)</label>
                <input style={inp} value={f.registro} onChange={(e) => set("registro", e.target.value)} placeholder="Ex.: CFT 12345678" /></div>
            </>
          )}
          {pedeSalario && (
            <div><label style={lab}>Salário fixo mensal {area.role === "atendimento" ? "(vazio = padrão)" : "(opcional)"}</label>
              <input style={inp} inputMode="decimal" value={f.salario} onChange={(e) => set("salario", e.target.value)} placeholder="0,00" /></div>
          )}
        </div>
        <p style={{ fontSize: 12, color: "#8593a8", margin: "10px 0 0" }}>
          Passe o e-mail e a senha provisória para a pessoa. Documentos (carteira e acervo) e assinatura se anexam depois, na ficha dela.
        </p>
        {erro && <p style={{ fontSize: 13, color: VERMELHO, margin: "10px 0 0" }}>{erro}</p>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO, width: "auto" }} onClick={onFechar}>Cancelar</button>
          <button className="btn-solid" style={{ width: "auto" }} onClick={salvar} disabled={salvando}>
            {salvando ? <><Loader2 size={15} className="spin" /> Criando…</> : `Criar ${area.rotulo.toLowerCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}
