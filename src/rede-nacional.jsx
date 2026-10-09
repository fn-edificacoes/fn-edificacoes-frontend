/* ============================================================
   FN NACIONAL — Rede Nacional (regionais, técnicos parceiros, carteira, OS)
   ============================================================
   Arquivo à parte de propósito: o App.jsx já passa de 19 mil linhas e este módulo conversa
   só com /api/nacional (ver src/nacional.js no backend). O App.jsx apenas o encaixa como
   mais uma aba e entrega o apiFetch — que continua sendo o único caminho para a API.

   Quem vê o quê é decidido pelo servidor. Aqui as abas só seguem o papel para não mostrar
   botão que daria 403; esconder não protege nada. */
import React, { useEffect, useState } from "react";
import {
  Building2, Users, MapPin, ClipboardList, Wallet, History, LayoutGrid, RefreshCcw, Plus, X,
  AlertTriangle, CheckCircle2, ShieldCheck, Save, Search,
} from "lucide-react";

const AZUL_MEDIO = "#2C75B5";
const AZUL_MARINHO = "#12335B";
const CINZA_CLARO = "#F1F4F8";
const CINZA_BORDA = "#D8DEE7";
const VERDE = "#0F7259";
const VERMELHO = "#C62828";
const AMBAR = "#B26A00";

const lab = { fontSize: 12, fontWeight: 600, color: "#5a6a80" };
const inp = { padding: "8px 10px", border: `1px solid ${CINZA_BORDA}`, borderRadius: 8, fontSize: 13.5, outline: "none", background: "#fff", fontFamily: "inherit", minWidth: 0 };
/* Cabeçalho preso no topo da caixa de rolagem (ver Tabela): rolando uma lista longa, o
   nome de cada coluna continua à vista. */
const th = { textAlign: "left", fontSize: 11.5, fontWeight: 700, color: "#5a6a80", padding: "8px 8px", borderBottom: `1px solid ${CINZA_BORDA}`, whiteSpace: "nowrap", position: "sticky", top: 0, background: "#fff", zIndex: 1 };
const td = { fontSize: 13, padding: "8px 8px", borderBottom: `1px solid ${CINZA_CLARO}`, verticalAlign: "top" };
const tdN = { ...td, whiteSpace: "nowrap" };
const btn = { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "none", background: AZUL_MEDIO, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };
const btnLeve = { ...btn, background: "#fff", color: AZUL_MARINHO, border: `1px solid ${CINZA_BORDA}` };

const ROTULO_NIVEL = { candidato: "0 · Candidato", em_homologacao: "1 · Em homologação", homologado: "2 · Homologado", premium: "3 · Premium", lider: "4 · Líder regional" };
const ROTULO_SITUACAO = {
  inscricao_recebida: "Inscrição recebida", documentacao_pendente: "Documentação pendente", documentos_em_analise: "Documentos em análise",
  treinamento_pendente: "Treinamento pendente", prova_pendente: "Prova pendente", reprovado: "Reprovado",
  aprovado_homologacao: "Aprovado p/ homologação", ativo: "Ativo", suspenso: "Suspenso", desligado: "Desligado",
};
const ROTULO_STATUS_REGIONAL = {
  nao_iniciada: "Não iniciada", prospeccao: "Prospecção", recrutamento: "Recrutamento", piloto: "Piloto",
  ativa: "Ativa", expansao: "Expansão", consolidada: "Consolidada", suspensa: "Suspensa",
};
const ROTULO_ORIGEM = {
  fn: "FN", parceiro: "Parceiro", indicacao_parceiro: "Indicação de parceiro", rede: "Rede", indicacao: "Indicação",
  campanha: "Campanha", organico: "Orgânico", afiliado: "Afiliado", outro: "Outro",
};
const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

const brl = (v) => (v === null || v === undefined || v === "" ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const dataBr = (v) => (v ? String(v).slice(0, 10).split("-").reverse().join("/") : "—");
const mesAtual = () => new Date().toISOString().slice(0, 7);

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
/* A tabela rola dentro de uma caixa com altura máxima, e não a página inteira. Assim a barra
   de rolagem lateral fica sempre à vista, na base da caixa — antes ela só existia no fim da
   tabela, e numa lista de OS longa ninguém chegava até ela para ver as colunas da direita. */
function Tabela({ children }) {
  return (
    <div style={{ overflow: "auto", maxHeight: "70vh", border: `1px solid ${CINZA_CLARO}`, borderRadius: 10 }}>
      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>{children}</table>
    </div>
  );
}
function Etiqueta({ cor = AZUL_MEDIO, children }) {
  return <span style={{ display: "inline-block", fontSize: 11.5, fontWeight: 700, color: cor, background: `${cor}14`, border: `1px solid ${cor}33`, borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>{children}</span>;
}
function Campo({ label, children, largo }) {
  return <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: largo ? "1 / -1" : "auto" }}><span style={lab}>{label}</span>{children}</label>;
}
const Grade = ({ children }) => <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>{children}</div>;
const Vazio = ({ children }) => <div style={{ padding: 16, textAlign: "center", color: "#7a889c", fontSize: 13 }}>{children}</div>;

/* Janela para o que exige justificativa (origem comercial, nível do técnico, valor). O
   servidor recusa menos de 10 caracteres; aqui o botão só acende a partir daí, para a pessoa
   não descobrir a regra pelo erro. */
function ModalJustificativa({ titulo, descricao, children, aoConfirmar, aoFechar }) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const pronto = texto.trim().length >= 10;
  return (
    <div onClick={aoFechar} style={{ position: "fixed", inset: 0, background: "rgba(10,25,45,.45)", display: "grid", placeItems: "center", zIndex: 1000, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 20, width: "min(520px, 100%)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: AZUL_MARINHO, flex: 1 }}>{titulo}</h3>
          <button onClick={aoFechar} style={{ border: "none", background: "none", cursor: "pointer" }} aria-label="Fechar"><X size={18} /></button>
        </div>
        {descricao && <p style={{ fontSize: 13, color: "#5a6a80", marginTop: 0 }}>{descricao}</p>}
        <div style={{ display: "grid", gap: 10 }}>
          {children}
          <Campo label="Justificativa (fica registrada na auditoria)">
            <textarea style={{ ...inp, minHeight: 80, resize: "vertical" }} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Por que esta mudança está sendo feita?" />
          </Campo>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <button style={btnLeve} onClick={aoFechar}>Cancelar</button>
          <button style={{ ...btn, opacity: pronto && !enviando ? 1 : 0.5 }} disabled={!pronto || enviando}
            onClick={async () => { setEnviando(true); const ok = await aoConfirmar(texto.trim()); setEnviando(false); if (ok) aoFechar(); }}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

/* Carrega uma rota e guarda o resultado; recarregar() refaz. Erro vira aviso, nunca tela
   quebrada — mesma postura do resto do sistema. */
function useApi(apiFetch, token, notify, caminho, deps = []) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const recarregar = async () => {
    if (!caminho) return;
    setCarregando(true);
    try { setDados(await apiFetch(caminho, { token })); }
    catch (e) { notify(`Não foi possível carregar: ${e.message}`); }
    setCarregando(false);
  };
  useEffect(() => { recarregar(); }, [caminho, ...deps]);
  return { dados, carregando, recarregar };
}

export default function AbaRedeNacional({ token, perfil, apiFetch, notify, usuarios = [] }) {
  const ehNacional = perfil === "gerencia";
  const abas = [
    ["painel", "Painel", LayoutGrid],
    ["tecnicos", "Técnicos e parceiros", Users],
    ["empreendimentos", "Empreendimentos", Building2],
    ["os", "Ordens de serviço", ClipboardList],
    ...(ehNacional ? [["regionais", "Regionais", MapPin], ["remuneracao", "Remuneração", Wallet], ["auditoria", "Auditoria", History]] : []),
  ];
  const [aba, setAba] = useState("painel");
  const escopo = useApi(apiFetch, token, notify, "/api/nacional/escopo");
  const regionais = escopo.dados?.regionais || [];
  const ctx = { token, perfil, apiFetch, notify, ehNacional, regionais, usuarios, recarregarEscopo: escopo.recarregar };

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {abas.map(([k, label, Icon]) => (
          <button key={k} onClick={() => setAba(k)}
            style={{ ...btnLeve, background: aba === k ? AZUL_MARINHO : "#fff", color: aba === k ? "#fff" : AZUL_MARINHO, borderColor: aba === k ? AZUL_MARINHO : CINZA_BORDA }}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>
      {!ehNacional && escopo.dados && regionais.length === 0 && (
        <Caixa icon={AlertTriangle} titulo="Nenhuma regional liberada">
          <p style={{ margin: 0, fontSize: 13.5 }}>Seu acesso ainda não foi ligado a nenhuma regional. Peça à FN Nacional para liberar a sua.</p>
        </Caixa>
      )}
      {aba === "painel" && <AbaPainel {...ctx} />}
      {aba === "tecnicos" && <AbaTecnicos {...ctx} />}
      {aba === "empreendimentos" && <AbaEmpreendimentos {...ctx} />}
      {aba === "os" && <AbaOs {...ctx} />}
      {aba === "regionais" && ehNacional && <AbaRegionais {...ctx} />}
      {aba === "remuneracao" && ehNacional && <AbaRemuneracao {...ctx} />}
      {aba === "auditoria" && ehNacional && <AbaAuditoria {...ctx} />}
    </div>
  );
}

/* ---------------- Painel ---------------- */
function AbaPainel({ token, apiFetch, notify, ehNacional }) {
  const [mes, setMes] = useState(mesAtual());
  const { dados, carregando, recarregar } = useApi(apiFetch, token, notify, `/api/nacional/painel?mes=${mes}`);
  const linhas = dados?.regionais || [];
  const total = linhas.reduce((s, l) => ({
    os: s.os + l.os_criadas_mes, laudos: s.laudos + l.laudos_aprovados_mes, pend: s.pend + l.laudos_pendentes,
    receita: s.receita + l.receita_mes, repasse: s.repasse + l.repasse_estimado_mes,
  }), { os: 0, laudos: 0, pend: 0, receita: 0, repasse: 0 });
  const tec = dados?.tecnicos || {};
  const cartoes = [
    ["OS criadas no mês", total.os], ["Laudos aprovados no mês", total.laudos], ["Laudos em revisão/correção", total.pend],
    ["Técnicos ativos", tec.ativos ?? "—"], ["Em homologação", tec.em_homologacao ?? "—"], ["Suspensos", tec.suspensos ?? "—"],
    ["Receita do mês", brl(total.receita)], ["Repasse estimado", brl(total.repasse)], ["Margem estimada", brl(total.receita - total.repasse)],
  ];
  return (
    <>
      <Caixa icon={LayoutGrid} titulo={ehNacional ? "FN Nacional" : "Minha regional"}
        acoes={<>
          <input type="month" style={inp} value={mes} onChange={(e) => setMes(e.target.value)} />
          <button style={btnLeve} onClick={recarregar}><RefreshCcw size={14} className={carregando ? "spin" : ""} /> Atualizar</button>
        </>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          {cartoes.map(([rotulo, valor]) => (
            <div key={rotulo} style={{ background: CINZA_CLARO, borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 11.5, color: "#5a6a80", fontWeight: 600 }}>{rotulo}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: AZUL_MARINHO, marginTop: 2 }}>{valor}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11.5, color: "#7a889c", margin: "10px 0 0" }}>
          Receita = valor cobrado lançado no mês. Repasse = valor do técnico na OS ou, sem ele, o custo da tabela do empreendimento — por isso “estimado”.
        </p>
      </Caixa>
      {(dados?.alertas || []).length > 0 && (
        <Caixa icon={AlertTriangle} titulo="Alertas">
          <div style={{ display: "grid", gap: 6 }}>
            {dados.alertas.map((a) => (
              <div key={a.tipo} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}>
                <AlertTriangle size={14} color={a.nivel === "atencao" ? VERMELHO : AMBAR} /> {a.texto}
              </div>
            ))}
          </div>
        </Caixa>
      )}
      <Caixa icon={MapPin} titulo="Por regional">
        <Tabela>
          <thead><tr>{["Regional", "Situação", "OS no mês", "Meta", "Laudos aprovados", "Em revisão", "Em aberto", "Sem técnico", "Receita", "Repasse", "Margem"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.regional_id || "sem"}>
                <td style={tdN}><b>{l.regional_nome || "Sem regional"}</b>{l.uf ? ` · ${l.uf}` : ""}</td>
                <td style={tdN}>{l.regional_status ? ROTULO_STATUS_REGIONAL[l.regional_status] : <Etiqueta cor={AMBAR}>mapear</Etiqueta>}</td>
                <td style={tdN}>{l.os_criadas_mes}</td>
                <td style={tdN}>{l.meta_os_mes ?? "—"}</td>
                <td style={tdN}>{l.laudos_aprovados_mes}</td>
                <td style={tdN}>{l.laudos_pendentes}</td>
                <td style={tdN}>{l.os_em_aberto}</td>
                <td style={tdN}>{l.os_sem_tecnico ? <Etiqueta cor={VERMELHO}>{l.os_sem_tecnico}</Etiqueta> : 0}</td>
                <td style={tdN}>{brl(l.receita_mes)}</td>
                <td style={tdN}>{brl(l.repasse_estimado_mes)}</td>
                <td style={tdN}>{brl(l.margem_estimada_mes)}</td>
              </tr>
            ))}
            {!linhas.length && <tr><td style={td} colSpan={11}><Vazio>{carregando ? "Carregando…" : "Sem OS no escopo."}</Vazio></td></tr>}
          </tbody>
        </Tabela>
      </Caixa>
    </>
  );
}

/* ---------------- Técnicos ---------------- */
function AbaTecnicos({ token, apiFetch, notify, ehNacional, regionais }) {
  const { dados, carregando, recarregar } = useApi(apiFetch, token, notify, "/api/nacional/tecnicos");
  const [aberto, setAberto] = useState(null);
  const [busca, setBusca] = useState("");
  const tecnicos = (dados?.tecnicos || []).filter((t) => !busca || `${t.nome} ${t.email}`.toLowerCase().includes(busca.toLowerCase()));
  return (
    <>
      <Caixa icon={Users} titulo="Técnicos e parceiros homologados"
        acoes={<>
          <div style={{ position: "relative" }}><Search size={14} style={{ position: "absolute", left: 9, top: 10, color: "#7a889c" }} /><input style={{ ...inp, paddingLeft: 28 }} placeholder="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
          <button style={btnLeve} onClick={recarregar}><RefreshCcw size={14} className={carregando ? "spin" : ""} /> Atualizar</button>
        </>}>
        <p style={{ fontSize: 12.5, color: "#5a6a80", marginTop: 0 }}>
          O login continua sendo criado em <b>Usuários</b> com o papel Vistoriador. Aqui entra o perfil nacional: regional, nível, homologação, registro e documentos.
          Técnico <b>sem perfil</b> trabalha como sempre trabalhou.
        </p>
        <Tabela>
          <thead><tr>{["Técnico", "Vínculo", "Nível", "Situação", "Regional", "Pode receber OS?", "Docs vencendo", "OS em aberto", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {tecnicos.map((t) => (
              <tr key={t.usuario_id}>
                <td style={tdN}><b>{t.nome}</b><div style={{ fontSize: 11.5, color: "#7a889c" }}>{t.email}</div>{!t.login_ativo && <Etiqueta cor={VERMELHO}>login desativado</Etiqueta>}</td>
                <td style={tdN}>{t.tem_perfil ? (t.vinculo === "interno" ? "Equipe FN" : "Parceiro") : <Etiqueta cor="#7a889c">sem perfil</Etiqueta>}</td>
                <td style={tdN}>{t.nivel ? ROTULO_NIVEL[t.nivel] : "—"}</td>
                <td style={tdN}>{t.situacao ? ROTULO_SITUACAO[t.situacao] : "—"}</td>
                <td style={tdN}>{t.regional_nome || "—"}</td>
                <td style={{ ...td, minWidth: 210 }}>
                  {t.apto ? <Etiqueta cor={VERDE}>Sim</Etiqueta> : <Etiqueta cor={VERMELHO}>Não</Etiqueta>}
                  {(t.motivos || []).map((m) => <div key={m} style={{ fontSize: 11.5, color: VERMELHO, marginTop: 3 }}>{m}</div>)}
                </td>
                <td style={td}>{t.documentos_vencendo ? <Etiqueta cor={AMBAR}>{t.documentos_vencendo}</Etiqueta> : 0}</td>
                <td style={td}>{t.os_em_aberto}</td>
                <td style={td}><button style={btnLeve} onClick={() => setAberto(t.usuario_id)}>{t.tem_perfil ? "Abrir" : "Criar perfil"}</button></td>
              </tr>
            ))}
            {!tecnicos.length && <tr><td style={td} colSpan={9}><Vazio>{carregando ? "Carregando…" : "Nenhum técnico no seu escopo."}</Vazio></td></tr>}
          </tbody>
        </Tabela>
      </Caixa>
      {aberto && (
        <FichaTecnico usuarioId={aberto} token={token} apiFetch={apiFetch} notify={notify} ehNacional={ehNacional}
          regionais={regionais} niveis={dados?.niveis || []} situacoes={dados?.situacoes || []}
          aoMudar={recarregar} aoFechar={() => { setAberto(null); recarregar(); }} />
      )}
    </>
  );
}

const lista = (txt) => String(txt || "").split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);

function FichaTecnico({ usuarioId, token, apiFetch, notify, ehNacional, regionais, niveis, situacoes, aoFechar, aoMudar }) {
  const ficha = useApi(apiFetch, token, notify, `/api/nacional/tecnicos/${usuarioId}`);
  const { dados } = ficha;
  /* O que muda aqui (perfil, nível, documento) muda a linha da lista também. */
  const recarregar = () => { ficha.recarregar(); aoMudar?.(); };
  const t = dados?.tecnico;
  const [form, setForm] = useState(null);
  const [classificando, setClassificando] = useState(false);
  const [novaClass, setNovaClass] = useState({});
  const [novoDoc, setNovoDoc] = useState({ tipo: "", validade: "", numero: "" });

  useEffect(() => {
    if (!t) return;
    setForm({
      vinculo: t.vinculo || "parceiro", regionalId: t.regional_id || (regionais.length === 1 ? regionais[0].id : ""),
      cpfCnpj: t.cpf_cnpj || "", telefone: t.telefone || "", cidade: t.cidade || "", uf: t.uf || "",
      profissao: t.profissao || "", conselho: t.conselho || "", registroNumero: t.registro_numero || "",
      registroUf: t.registro_uf || "", registroValidade: t.registro_validade ? String(t.registro_validade).slice(0, 10) : "",
      raioKm: t.raio_km ?? "", veiculo: t.veiculo || "", recemFormado: !!t.recem_formado,
      cidadesAtendidas: (t.cidades_atendidas || []).join(", "), servicosHabilitados: (t.servicos_habilitados || []).join(", "),
      equipamentos: (t.equipamentos || []).join(", "), especialidades: (t.especialidades || []).join(", "),
      observacoes: t.observacoes || "",
    });
    setNovaClass({ nivel: t.nivel || "candidato", situacao: t.situacao || "inscricao_recebida" });
  }, [t?.usuario_id, t?.atualizado_em]);

  const salvar = async () => {
    const corpo = {
      ...form, raioKm: form.raioKm === "" ? null : Number(form.raioKm),
      cidadesAtendidas: lista(form.cidadesAtendidas), servicosHabilitados: lista(form.servicosHabilitados),
      equipamentos: lista(form.equipamentos), especialidades: lista(form.especialidades),
    };
    if (!corpo.regionalId) return notify("Escolha a regional do técnico.");
    try {
      await apiFetch(`/api/nacional/tecnicos/${usuarioId}`, { method: "PUT", token, body: corpo });
      notify(t?.tem_perfil ? "Perfil salvo ✓" : "Perfil nacional criado ✓");
      recarregar();
    } catch (e) { notify(e.message); }
  };
  const incluirDoc = async () => {
    if (!novoDoc.tipo) return notify("Informe o tipo do documento.");
    try {
      await apiFetch(`/api/nacional/tecnicos/${usuarioId}/documentos`, { method: "POST", token, body: { ...novoDoc, validade: novoDoc.validade || null } });
      setNovoDoc({ tipo: "", validade: "", numero: "" });
      recarregar();
    } catch (e) { notify(e.message); }
  };
  const mudarDoc = async (id, patch) => {
    try { await apiFetch(`/api/nacional/tecnico-documentos/${id}`, { method: "PATCH", token, body: patch }); recarregar(); }
    catch (e) { notify(e.message); }
  };

  if (!t || !form) return <Caixa icon={Users} titulo="Carregando técnico…"><Vazio>Carregando…</Vazio></Caixa>;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  return (
    <Caixa icon={ShieldCheck} titulo={`${t.nome}${t.tem_perfil ? ` · ${ROTULO_NIVEL[t.nivel]}` : " · sem perfil nacional"}`}
      acoes={<button style={btnLeve} onClick={aoFechar}><X size={14} /> Fechar</button>}>
      {t.tem_perfil && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          {t.apto ? <Etiqueta cor={VERDE}><CheckCircle2 size={12} style={{ verticalAlign: -2 }} /> Pode receber OS</Etiqueta> : <Etiqueta cor={VERMELHO}>Não recebe OS</Etiqueta>}
          <Etiqueta>{ROTULO_SITUACAO[t.situacao]}</Etiqueta>
          {(t.motivos || []).map((m) => <span key={m} style={{ fontSize: 12, color: VERMELHO }}>{m}</span>)}
          <button style={{ ...btnLeve, marginLeft: "auto" }} onClick={() => setClassificando(true)}>Mudar nível / situação</button>
        </div>
      )}
      {!t.tem_perfil && (
        <p style={{ fontSize: 13, background: "#FFF4E0", border: "1px solid #F2D49B", borderRadius: 8, padding: 10, marginTop: 0 }}>
          Ao criar o perfil, <b>parceiro</b> nasce como Candidato (não recebe OS até ser homologado). <b>Equipe FN</b> nasce homologada e ativa — use para quem já trabalha hoje.
        </p>
      )}
      <Grade>
        <Campo label="Vínculo"><select style={inp} value={form.vinculo} onChange={set("vinculo")} disabled={t.tem_perfil && !ehNacional}><option value="parceiro">Parceiro homologado</option><option value="interno">Equipe FN</option></select></Campo>
        <Campo label="Regional"><select style={inp} value={form.regionalId} onChange={set("regionalId")}><option value="">Escolha…</option>{regionais.map((r) => <option key={r.id} value={r.id}>{r.nome} · {r.uf}</option>)}</select></Campo>
        <Campo label="CPF/CNPJ"><input style={inp} value={form.cpfCnpj} onChange={set("cpfCnpj")} /></Campo>
        <Campo label="Telefone"><input style={inp} value={form.telefone} onChange={set("telefone")} /></Campo>
        <Campo label="Cidade"><input style={inp} value={form.cidade} onChange={set("cidade")} /></Campo>
        <Campo label="UF"><select style={inp} value={form.uf} onChange={set("uf")}><option value="">—</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select></Campo>
        <Campo label="Profissão"><input style={inp} value={form.profissao} onChange={set("profissao")} placeholder="Engenheiro Civil, Arquiteto…" /></Campo>
        <Campo label="Conselho"><input style={inp} value={form.conselho} onChange={set("conselho")} placeholder="CREA, CAU, CFT…" /></Campo>
        <Campo label="Nº do registro"><input style={inp} value={form.registroNumero} onChange={set("registroNumero")} /></Campo>
        <Campo label="UF do registro"><select style={inp} value={form.registroUf} onChange={set("registroUf")}><option value="">—</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select></Campo>
        <Campo label="Validade do registro"><input type="date" style={inp} value={form.registroValidade} onChange={set("registroValidade")} /></Campo>
        <Campo label="Raio de atendimento (km)"><input type="number" min="0" style={inp} value={form.raioKm} onChange={set("raioKm")} /></Campo>
        <Campo label="Veículo"><input style={inp} value={form.veiculo} onChange={set("veiculo")} /></Campo>
        <Campo label="Recém-formado"><input type="checkbox" checked={form.recemFormado} onChange={set("recemFormado")} style={{ width: 18, height: 18 }} /></Campo>
        <Campo label="Cidades atendidas (separe por vírgula)" largo><input style={inp} value={form.cidadesAtendidas} onChange={set("cidadesAtendidas")} /></Campo>
        <Campo label="Serviços habilitados (vazio = qualquer um liberado pela matriz)" largo><input style={inp} value={form.servicosHabilitados} onChange={set("servicosHabilitados")} placeholder="Vistoria de entrega de chaves, Revistoria" /></Campo>
        <Campo label="Equipamentos" largo><input style={inp} value={form.equipamentos} onChange={set("equipamentos")} /></Campo>
        <Campo label="Especialidades" largo><input style={inp} value={form.especialidades} onChange={set("especialidades")} /></Campo>
        <Campo label="Observações" largo><textarea style={{ ...inp, minHeight: 60 }} value={form.observacoes} onChange={set("observacoes")} /></Campo>
      </Grade>
      <div style={{ marginTop: 12 }}><button style={btn} onClick={salvar}><Save size={14} /> {t.tem_perfil ? "Salvar perfil" : "Criar perfil nacional"}</button></div>

      {t.tem_perfil && (
        <div style={{ marginTop: 20 }}>
          <h4 style={{ margin: "0 0 8px", color: AZUL_MARINHO, fontSize: 14 }}>Documentos</h4>
          <Tabela>
            <thead><tr>{["Tipo", "Número", "Validade", "Situação", "Bloqueia se vencer", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {(dados.documentos || []).map((d) => {
                const venc = d.validade && String(d.validade).slice(0, 10) < new Date().toISOString().slice(0, 10);
                return (
                  <tr key={d.id}>
                    <td style={td}>{d.tipo}</td>
                    <td style={td}>{d.numero || "—"}</td>
                    <td style={td}>{dataBr(d.validade)} {venc && <Etiqueta cor={VERMELHO}>vencido</Etiqueta>}</td>
                    <td style={td}>
                      <select style={inp} value={d.situacao} onChange={(e) => mudarDoc(d.id, { situacao: e.target.value })}>
                        <option value="em_analise">Em análise</option><option value="aprovado">Aprovado</option><option value="recusado">Recusado</option>
                      </select>
                    </td>
                    <td style={td}><input type="checkbox" checked={d.bloqueia_se_vencido} onChange={(e) => mudarDoc(d.id, { bloqueiaSeVencido: e.target.checked })} /></td>
                    <td style={td}><input type="date" style={inp} defaultValue={d.validade ? String(d.validade).slice(0, 10) : ""} onBlur={(e) => e.target.value !== String(d.validade || "").slice(0, 10) && mudarDoc(d.id, { validade: e.target.value || null })} title="Nova validade" /></td>
                  </tr>
                );
              })}
              <tr>
                <td style={td}><input style={inp} placeholder="Ex.: Registro CREA, Seguro RC" value={novoDoc.tipo} onChange={(e) => setNovoDoc({ ...novoDoc, tipo: e.target.value })} /></td>
                <td style={td}><input style={inp} value={novoDoc.numero} onChange={(e) => setNovoDoc({ ...novoDoc, numero: e.target.value })} /></td>
                <td style={td}><input type="date" style={inp} value={novoDoc.validade} onChange={(e) => setNovoDoc({ ...novoDoc, validade: e.target.value })} /></td>
                <td style={td} colSpan={3}><button style={btnLeve} onClick={incluirDoc}><Plus size={14} /> Incluir documento</button></td>
              </tr>
            </tbody>
          </Tabela>
        </div>
      )}

      {classificando && (
        <ModalJustificativa titulo="Nível e situação do técnico" aoFechar={() => setClassificando(false)}
          descricao="É o que libera ou bloqueia a entrada de OS. Premium e Líder regional só a FN Nacional concede."
          aoConfirmar={async (justificativa) => {
            try {
              await apiFetch(`/api/nacional/tecnicos/${usuarioId}/classificacao`, { method: "PATCH", token, body: { ...novaClass, justificativa } });
              notify("Classificação atualizada ✓"); recarregar(); return true;
            } catch (e) { notify(e.message); return false; }
          }}>
          <Campo label="Nível"><select style={inp} value={novaClass.nivel} onChange={(e) => setNovaClass({ ...novaClass, nivel: e.target.value })}>{niveis.map((n) => <option key={n} value={n}>{ROTULO_NIVEL[n]}</option>)}</select></Campo>
          <Campo label="Situação"><select style={inp} value={novaClass.situacao} onChange={(e) => setNovaClass({ ...novaClass, situacao: e.target.value })}>{situacoes.map((s) => <option key={s} value={s}>{ROTULO_SITUACAO[s]}</option>)}</select></Campo>
        </ModalJustificativa>
      )}
    </Caixa>
  );
}

/* ---------------- Empreendimentos ---------------- */
function AbaEmpreendimentos({ token, apiFetch, notify, ehNacional, regionais }) {
  const { dados, carregando, recarregar } = useApi(apiFetch, token, notify, "/api/nacional/empreendimentos");
  const [edicao, setEdicao] = useState({});
  const [busca, setBusca] = useState("");
  const [origemDe, setOrigemDe] = useState(null);
  const [novaOrigem, setNovaOrigem] = useState("fn");
  const linhas = (dados?.empreendimentos || []).filter((e) => !busca || e.nome.toLowerCase().includes(busca.toLowerCase()));

  const valor = (e, k, padrao) => (edicao[e.chave]?.[k] !== undefined ? edicao[e.chave][k] : padrao);
  const mudar = (e, k, v) => setEdicao({ ...edicao, [e.chave]: { ...edicao[e.chave], [k]: v } });
  const salvar = async (e) => {
    const patch = edicao[e.chave];
    if (!patch) return;
    try {
      await apiFetch("/api/nacional/empreendimentos", { method: "PUT", token, body: { nome: e.nome, ...patch } });
      notify("Empreendimento salvo ✓");
      setEdicao((atual) => { const n = { ...atual }; delete n[e.chave]; return n; });
      recarregar();
    } catch (err) { notify(err.message); }
  };
  /* "Sem regional" é o que conta, não "sem linha nacional": um empreendimento pode ter sido
     mapeado só com a cidade, e continuar fora de toda regional. */
  const semRegional = (dados?.empreendimentos || []).filter((e) => !e.regional_id);
  const naoMapeados = semRegional.length;

  /* Regional em lote: no começo quase toda a base é de uma regional só (hoje, Pernambuco), e
     escolher um por um era trabalho de uma tarde. Usa a mesma rota do salvar individual, um
     empreendimento por vez, então cada mudança fica na auditoria como se fosse feita à mão. */
  const [regionalLote, setRegionalLote] = useState("");
  const [aplicandoLote, setAplicandoLote] = useState(null); // { feitos, total } durante a aplicação
  const aplicarEmLote = async () => {
    const regional = regionais.find((r) => r.id === regionalLote);
    if (!regional || !semRegional.length) return;
    if (!window.confirm(`Colocar os ${semRegional.length} empreendimento(s) sem regional na ${regional.nome} (UF ${regional.uf})? Dá para trocar um a um depois.`)) return;
    let feitos = 0; const falhas = [];
    setAplicandoLote({ feitos, total: semRegional.length });
    for (const e of semRegional) {
      try {
        await apiFetch("/api/nacional/empreendimentos", { method: "PUT", token, body: { nome: e.nome, regionalId: regional.id, uf: e.uf || regional.uf } });
        feitos++;
      } catch { falhas.push(e.nome); }
      setAplicandoLote({ feitos: feitos + falhas.length, total: semRegional.length });
    }
    setAplicandoLote(null);
    notify(falhas.length ? `${feitos} colocado(s) na ${regional.nome}; não deu em: ${falhas.join(", ")}` : `${feitos} empreendimento(s) na ${regional.nome} ✓`);
    recarregar();
  };
  return (
    <Caixa icon={Building2} titulo="Empreendimentos e carteira FN"
      acoes={<>
        <div style={{ position: "relative" }}><Search size={14} style={{ position: "absolute", left: 9, top: 10, color: "#7a889c" }} /><input style={{ ...inp, paddingLeft: 28 }} placeholder="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
        <button style={btnLeve} onClick={recarregar}><RefreshCcw size={14} className={carregando ? "spin" : ""} /> Atualizar</button>
      </>}>
      <p style={{ fontSize: 12.5, color: "#5a6a80", marginTop: 0 }}>
        Definir a regional de um empreendimento regionaliza todas as OS dele, inclusive as antigas.
        {ehNacional && naoMapeados > 0 && <> <b>{naoMapeados}</b> ainda sem regional — aparecem primeiro.</>}
        {" "}<b>Carteira FN</b> ligada: o parceiro só enxerga as OS atribuídas a ele, nunca a lista de clientes ou leads.
      </p>
      {ehNacional && naoMapeados > 0 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", background: "#FFF4E0", border: "1px solid #F2D49B", borderRadius: 10, padding: "10px 12px", marginBottom: 12, fontSize: 13 }}>
          <b>{naoMapeados} sem regional.</b> Colocar todos em:
          <select style={inp} value={regionalLote} onChange={(ev) => setRegionalLote(ev.target.value)} disabled={!!aplicandoLote}>
            <option value="">escolha a regional…</option>
            {regionais.map((r) => <option key={r.id} value={r.id}>{r.nome} · {r.uf}</option>)}
          </select>
          <button style={{ ...btn, opacity: regionalLote && !aplicandoLote ? 1 : 0.5 }} disabled={!regionalLote || !!aplicandoLote} onClick={aplicarEmLote}>
            {aplicandoLote ? `Aplicando… ${aplicandoLote.feitos}/${aplicandoLote.total}` : "Aplicar a todos sem regional"}
          </button>
        </div>
      )}
      <Tabela>
        <thead><tr>{["Empreendimento", "Regional", "Cidade", "UF", "Carteira FN", "Origem", "OS (mês/total)", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>
          {linhas.map((e) => (
            <tr key={e.chave}>
              <td style={{ ...td, minWidth: 200 }}><b>{e.nome}</b><div style={{ fontSize: 11.5, color: "#7a889c" }}>{e.construtora || ""}</div></td>
              <td style={td}>
                <select style={inp} value={valor(e, "regionalId", e.regional_id || "")} onChange={(ev) => mudar(e, "regionalId", ev.target.value || null)}>
                  <option value="">— sem regional —</option>
                  {regionais.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
                </select>
              </td>
              <td style={td}><input style={{ ...inp, width: 130 }} value={valor(e, "cidade", e.cidade || "")} onChange={(ev) => mudar(e, "cidade", ev.target.value)} /></td>
              <td style={td}><select style={inp} value={valor(e, "uf", e.uf || "")} onChange={(ev) => mudar(e, "uf", ev.target.value)}><option value="">—</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select></td>
              <td style={td}><input type="checkbox" checked={valor(e, "carteiraFn", e.carteira_fn)} disabled={!ehNacional} onChange={(ev) => mudar(e, "carteiraFn", ev.target.checked)} /></td>
              <td style={td}>
                {ROTULO_ORIGEM[e.origem_comercial] || e.origem_comercial}
                {ehNacional && <button style={{ border: "none", background: "none", color: AZUL_MEDIO, cursor: "pointer", fontSize: 12 }} onClick={() => { setOrigemDe(e); setNovaOrigem(e.origem_comercial); }}>alterar</button>}
              </td>
              <td style={td}>{e.os_mes} / {e.total_os}</td>
              <td style={td}>{edicao[e.chave] && <button style={btn} onClick={() => salvar(e)}><Save size={14} /> Salvar</button>}</td>
            </tr>
          ))}
          {!linhas.length && <tr><td style={td} colSpan={8}><Vazio>{carregando ? "Carregando…" : "Nenhum empreendimento no seu escopo."}</Vazio></td></tr>}
        </tbody>
      </Tabela>
      {origemDe && (
        <ModalJustificativa titulo={`Origem comercial · ${origemDe.nome}`} aoFechar={() => setOrigemDe(null)}
          descricao="A origem diz de quem é a carteira. Só muda com justificativa, e a mudança fica na auditoria."
          aoConfirmar={async (justificativa) => {
            try {
              await apiFetch("/api/nacional/empreendimentos/origem", { method: "PATCH", token, body: { nome: origemDe.nome, origemComercial: novaOrigem, justificativa } });
              notify("Origem alterada ✓"); recarregar(); return true;
            } catch (err) { notify(err.message); return false; }
          }}>
          <Campo label="Nova origem"><select style={inp} value={novaOrigem} onChange={(e) => setNovaOrigem(e.target.value)}>{Object.entries(ROTULO_ORIGEM).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Campo>
        </ModalJustificativa>
      )}
    </Caixa>
  );
}

/* ---------------- Ordens de serviço ---------------- */
function AbaOs({ token, apiFetch, notify, ehNacional, regionais }) {
  const [filtro, setFiltro] = useState({ regional: "", mes: "" });
  const qs = new URLSearchParams();
  if (filtro.regional === "__sem") qs.set("semRegional", "1"); else if (filtro.regional) qs.set("regionalId", filtro.regional);
  if (filtro.mes) qs.set("mes", filtro.mes);
  const { dados, carregando, recarregar } = useApi(apiFetch, token, notify, `/api/nacional/os?${qs}`);
  const [elegiveis, setElegiveis] = useState(null);
  const [origemDe, setOrigemDe] = useState(null);
  const [valorDe, setValorDe] = useState(null);
  const [tecnicos, setTecnicos] = useState([]);
  const os = dados?.os || [];
  const verDinheiro = os.some((o) => "margem_fn" in o);

  const abrirElegiveis = async (o) => {
    setElegiveis({ os: o, carregando: true, tecnicos: [] });
    try { const r = await apiFetch(`/api/nacional/os/${o.id}/elegiveis`, { token }); setElegiveis({ os: o, tecnicos: r.tecnicos }); }
    catch (e) { notify(e.message); setElegiveis(null); }
  };
  const abrirOrigem = async (o) => {
    setOrigemDe({ os: o, origem: o.origem_comercial, tecnicoId: "" });
    if (!tecnicos.length) {
      try { const r = await apiFetch("/api/nacional/tecnicos", { token }); setTecnicos(r.tecnicos || []); } catch { /* lista só ajuda a escolher */ }
    }
  };
  const abrirValor = async (o) => {
    setValorDe({ os: o, valor: o.valor_tecnico ?? "", sugestao: null });
    try { const r = await apiFetch(`/api/nacional/os/${o.id}/remuneracao`, { token }); setValorDe((v) => v && ({ ...v, sugestao: r.sugestao })); } catch { /* sugestão é opcional */ }
  };

  return (
    <Caixa icon={ClipboardList} titulo="Ordens de serviço"
      acoes={<>
        <select style={inp} value={filtro.regional} onChange={(e) => setFiltro({ ...filtro, regional: e.target.value })}>
          <option value="">Todas as regionais</option>
          {regionais.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          {ehNacional && <option value="__sem">Sem regional</option>}
        </select>
        <input type="month" style={inp} value={filtro.mes} onChange={(e) => setFiltro({ ...filtro, mes: e.target.value })} title="Mês de criação" />
        <button style={btnLeve} onClick={recarregar}><RefreshCcw size={14} className={carregando ? "spin" : ""} /> Atualizar</button>
      </>}>
      <p style={{ fontSize: 12.5, color: "#5a6a80", marginTop: 0 }}>
        A OS é o próprio cadastro do cliente — agendar e escalar técnico continua em <b>Agendamento</b>. Ao escalar, o sistema recusa técnico suspenso, candidato, com documento vencido, de outra regional ou sem habilitação.
      </p>
      <Tabela>
        <thead><tr>{["OS", "Cliente / imóvel", "Serviço", "Situação", "Data", "Técnico", "Regional", "Origem",
          ...(verDinheiro ? ["Cliente paga", "Técnico recebe", "Margem FN"] : []), ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>
          {os.map((o) => (
            <tr key={o.id}>
              <td style={tdN}><b>{o.numero}</b>{o.prioridade && o.prioridade !== "normal" && <div><Etiqueta cor={o.prioridade === "urgente" ? VERMELHO : AMBAR}>{o.prioridade}</Etiqueta></div>}</td>
              {/* Largura mínima: sem ela as colunas que não quebram espremiam o nome do cliente
                  numa palavra por linha, e cada OS ocupava meia tela de altura. */}
              <td style={{ ...td, minWidth: 230 }}>{o.nome}<div style={{ fontSize: 11.5, color: "#7a889c" }}>{o.empreendimento} {o.bloco_torre} {o.apartamento}</div></td>
              <td style={tdN}>{o.servico}</td>
              <td style={tdN}>{o.status}</td>
              <td style={tdN}>{dataBr(o.data_desejada)}</td>
              <td style={tdN}>{o.tecnico_nome || <Etiqueta cor={AMBAR}>sem técnico</Etiqueta>}</td>
              <td style={tdN}>{o.regional_nome || <Etiqueta cor="#7a889c">sem regional</Etiqueta>}</td>
              <td style={tdN}>{ROTULO_ORIGEM[o.origem_comercial] || o.origem_comercial}{ehNacional && <button style={{ border: "none", background: "none", color: AZUL_MEDIO, cursor: "pointer", fontSize: 12 }} onClick={() => abrirOrigem(o)}>alterar</button>}</td>
              {verDinheiro && <>
                <td style={tdN}>{brl(o.valor_cobrado ?? o.valor_cliente_tabela)}</td>
                <td style={tdN}>{brl(o.valor_tecnico ?? o.valor_tecnico_tabela)}{o.valor_tecnico == null && o.valor_tecnico_tabela != null && <div style={{ fontSize: 11, color: "#7a889c" }}>tabela</div>}{ehNacional && <div><button style={{ border: "none", background: "none", color: AZUL_MEDIO, cursor: "pointer", fontSize: 12, padding: 0 }} onClick={() => abrirValor(o)}>definir</button></div>}</td>
                <td style={tdN}>{brl(o.margem_fn)}</td>
              </>}
              <td style={td}><button style={btnLeve} onClick={() => abrirElegiveis(o)}>Técnicos aptos</button></td>
            </tr>
          ))}
          {!os.length && <tr><td style={td} colSpan={12}><Vazio>{carregando ? "Carregando…" : "Nenhuma OS com estes filtros."}</Vazio></td></tr>}
        </tbody>
      </Tabela>

      {elegiveis && (
        <div onClick={() => setElegiveis(null)} style={{ position: "fixed", inset: 0, background: "rgba(10,25,45,.45)", display: "grid", placeItems: "center", zIndex: 1000, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 20, width: "min(720px, 100%)", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: AZUL_MARINHO, flex: 1 }}>Quem pode receber {elegiveis.os.numero}</h3>
              <button onClick={() => setElegiveis(null)} style={{ border: "none", background: "none", cursor: "pointer" }} aria-label="Fechar"><X size={18} /></button>
            </div>
            <p style={{ fontSize: 12.5, color: "#5a6a80", marginTop: 0 }}>Ordem: aptos, quem atende a cidade, nível, score e menos OS no dia. É sugestão — a escala continua no Agendamento.</p>
            {elegiveis.carregando ? <Vazio>Carregando…</Vazio> : (
              <Tabela>
                <thead><tr>{["Técnico", "Nível", "OS no dia", "Situação"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {elegiveis.tecnicos.map((t) => (
                    <tr key={t.usuarioId} style={{ opacity: t.apto ? 1 : 0.6 }}>
                      <td style={td}><b>{t.nome}</b>{t.atual && <> <Etiqueta>escalado</Etiqueta></>}{t.cidadeAtende && <> <Etiqueta cor={VERDE}>atende a cidade</Etiqueta></>}</td>
                      <td style={td}>{t.nivel ? ROTULO_NIVEL[t.nivel] : "sem perfil"}</td>
                      <td style={td}>{t.osNoDia}</td>
                      <td style={td}>
                        {t.apto ? <Etiqueta cor={VERDE}>apto</Etiqueta> : <Etiqueta cor={VERMELHO}>bloqueado</Etiqueta>}
                        {[...t.motivos, ...t.avisos].map((m) => <div key={m} style={{ fontSize: 11.5, color: t.motivos.includes(m) ? VERMELHO : "#7a889c" }}>{m}</div>)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Tabela>
            )}
          </div>
        </div>
      )}

      {origemDe && (
        <ModalJustificativa titulo={`Origem comercial · ${origemDe.os.numero}`} aoFechar={() => setOrigemDe(null)}
          descricao="Cliente trazido por técnico parceiro precisa indicar qual técnico — é o que define o repasse diferenciado."
          aoConfirmar={async (justificativa) => {
            try {
              await apiFetch(`/api/nacional/os/${origemDe.os.id}/origem`, { method: "PATCH", token, body: { origemComercial: origemDe.origem, origemTecnicoId: origemDe.tecnicoId || null, justificativa } });
              notify("Origem alterada ✓"); recarregar(); return true;
            } catch (e) { notify(e.message); return false; }
          }}>
          <Campo label="Nova origem"><select style={inp} value={origemDe.origem} onChange={(e) => setOrigemDe({ ...origemDe, origem: e.target.value })}>{Object.entries(ROTULO_ORIGEM).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Campo>
          {["parceiro", "indicacao_parceiro"].includes(origemDe.origem) && (
            <Campo label="Técnico de origem"><select style={inp} value={origemDe.tecnicoId} onChange={(e) => setOrigemDe({ ...origemDe, tecnicoId: e.target.value })}><option value="">Escolha…</option>{tecnicos.map((t) => <option key={t.usuario_id} value={t.usuario_id}>{t.nome}</option>)}</select></Campo>
          )}
        </ModalJustificativa>
      )}

      {valorDe && (
        <ModalJustificativa titulo={`Valor do técnico · ${valorDe.os.numero}`} aoFechar={() => setValorDe(null)}
          descricao={valorDe.sugestao?.valor != null
            ? `Sugestão: ${brl(valorDe.sugestao.valor)} (${valorDe.sugestao.regra ? `regra “${valorDe.sugestao.regra.nome}”` : "tabela do empreendimento"}). Deixe vazio para seguir a sugestão.`
            : "Sem regra nem tabela para esta OS. Deixe vazio para não definir."}
          aoConfirmar={async (justificativa) => {
            try {
              await apiFetch(`/api/nacional/os/${valorDe.os.id}/valor-tecnico`, { method: "PATCH", token, body: { valorTecnico: valorDe.valor === "" ? null : Number(valorDe.valor), justificativa } });
              notify("Valor do técnico salvo ✓"); recarregar(); return true;
            } catch (e) { notify(e.message); return false; }
          }}>
          <Campo label="Valor (R$)"><input type="number" min="0" step="0.01" style={inp} value={valorDe.valor} onChange={(e) => setValorDe({ ...valorDe, valor: e.target.value })} /></Campo>
        </ModalJustificativa>
      )}
    </Caixa>
  );
}

/* ---------------- Regionais (só FN Nacional) ---------------- */
function AbaRegionais({ token, apiFetch, notify, usuarios, recarregarEscopo }) {
  const { dados, carregando, recarregar } = useApi(apiFetch, token, notify, "/api/nacional/regionais");
  const cidades = useApi(apiFetch, token, notify, "/api/nacional/cidades");
  const habilitacoes = useApi(apiFetch, token, notify, "/api/nacional/habilitacoes");
  const [nova, setNova] = useState({ nome: "", uf: "", status: "nao_iniciada" });
  const [novaCidade, setNovaCidade] = useState({ nome: "", uf: "", regionalId: "" });
  const [novaHab, setNovaHab] = useState({ servico: "", profissao: "", regionalId: "" });
  const [gestores, setGestores] = useState({});
  const regionais = dados?.regionais || [];
  const listaGestores = usuarios.filter((u) => u.role === "gestor_regional");

  useEffect(() => {
    (async () => {
      const mapa = {};
      for (const u of listaGestores) {
        try { mapa[u.id] = (await apiFetch(`/api/nacional/usuarios/${u.id}/regionais`, { token })).regionais; } catch { mapa[u.id] = []; }
      }
      setGestores(mapa);
    })();
  }, [listaGestores.length]);

  const tudo = () => { recarregar(); cidades.recarregar(); recarregarEscopo(); };
  const criar = async () => {
    try { await apiFetch("/api/nacional/regionais", { method: "POST", token, body: nova }); setNova({ nome: "", uf: "", status: "nao_iniciada" }); notify("Regional criada ✓"); tudo(); }
    catch (e) { notify(e.message); }
  };
  const atualizar = async (id, patch) => {
    try { await apiFetch(`/api/nacional/regionais/${id}`, { method: "PATCH", token, body: patch }); tudo(); }
    catch (e) { notify(e.message); }
  };
  const criarCidade = async () => {
    try { await apiFetch("/api/nacional/cidades", { method: "POST", token, body: novaCidade }); setNovaCidade({ nome: "", uf: "", regionalId: novaCidade.regionalId }); cidades.recarregar(); }
    catch (e) { notify(e.message); }
  };
  const alternarGestor = async (usuarioId, regionalId) => {
    const atual = gestores[usuarioId] || [];
    const proximo = atual.includes(regionalId) ? atual.filter((x) => x !== regionalId) : [...atual, regionalId];
    try { await apiFetch(`/api/nacional/usuarios/${usuarioId}/regionais`, { method: "PUT", token, body: { regionais: proximo } }); setGestores({ ...gestores, [usuarioId]: proximo }); }
    catch (e) { notify(e.message); }
  };
  const criarHab = async () => {
    try { await apiFetch("/api/nacional/habilitacoes", { method: "POST", token, body: { ...novaHab, regionalId: novaHab.regionalId || null } }); setNovaHab({ servico: novaHab.servico, profissao: "", regionalId: novaHab.regionalId }); habilitacoes.recarregar(); }
    catch (e) { notify(e.message); }
  };
  const removerHab = async (id) => {
    try { await apiFetch(`/api/nacional/habilitacoes/${id}`, { method: "DELETE", token }); habilitacoes.recarregar(); }
    catch (e) { notify(e.message); }
  };

  return (
    <>
      <Caixa icon={MapPin} titulo="Regionais" acoes={<button style={btnLeve} onClick={tudo}><RefreshCcw size={14} className={carregando ? "spin" : ""} /> Atualizar</button>}>
        <Tabela>
          <thead><tr>{["Regional", "UF", "Situação", "No site", "Meta OS/mês", "SLA laudo (h)", "Cidades", "Técnicos ativos"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {regionais.map((r) => (
              <tr key={r.id}>
                <td style={td}><b>{r.nome}</b></td>
                <td style={td}>{r.uf}</td>
                <td style={td}><select style={inp} value={r.status} onChange={(e) => atualizar(r.id, { status: e.target.value })}>{Object.entries(ROTULO_STATUS_REGIONAL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></td>
                {/* Aparece no mapa "Onde atuamos" do site institucional (só onde a FN atua e
                    quantos empreendimentos atendeu — nunca clientes por cidade nem parceiros). */}
                <td style={td}><label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12.5 }}><input type="checkbox" checked={!!r.publico_site} onChange={(e) => atualizar(r.id, { publicoSite: e.target.checked })} /> Mostrar</label></td>
                <td style={td}><input type="number" min="0" style={{ ...inp, width: 90 }} defaultValue={r.meta_os_mes ?? ""} onBlur={(e) => String(r.meta_os_mes ?? "") !== e.target.value && atualizar(r.id, { metaOsMes: e.target.value })} /></td>
                <td style={td}><input type="number" min="0" style={{ ...inp, width: 80 }} defaultValue={r.sla_laudo_horas ?? ""} onBlur={(e) => String(r.sla_laudo_horas ?? "") !== e.target.value && atualizar(r.id, { slaLaudoHoras: e.target.value })} /></td>
                <td style={td}>{r.cidades_ativas}</td>
                <td style={td}>{r.tecnicos_ativos}</td>
              </tr>
            ))}
            <tr>
              <td style={td}><input style={inp} placeholder="Regional Ceará" value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} /></td>
              <td style={td}><select style={inp} value={nova.uf} onChange={(e) => setNova({ ...nova, uf: e.target.value })}><option value="">UF</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select></td>
              <td style={td}><select style={inp} value={nova.status} onChange={(e) => setNova({ ...nova, status: e.target.value })}>{Object.entries(ROTULO_STATUS_REGIONAL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></td>
              <td style={td} colSpan={5}><button style={btn} onClick={criar} disabled={!nova.nome || !nova.uf}><Plus size={14} /> Criar regional</button></td>
            </tr>
          </tbody>
        </Tabela>
      </Caixa>

      <Caixa icon={Users} titulo="Gestores regionais">
        {listaGestores.length === 0
          ? <p style={{ fontSize: 13, margin: 0 }}>Nenhum usuário com papel <b>Gestor regional</b>. Crie em <b>Usuários</b> e volte aqui para liberar as regionais dele.</p>
          : (
            <Tabela>
              <thead><tr><th style={th}>Gestor</th>{regionais.map((r) => <th key={r.id} style={th}>{r.nome}</th>)}</tr></thead>
              <tbody>
                {listaGestores.map((u) => (
                  <tr key={u.id}>
                    <td style={td}><b>{u.nome}</b><div style={{ fontSize: 11.5, color: "#7a889c" }}>{u.email}</div></td>
                    {regionais.map((r) => <td key={r.id} style={td}><input type="checkbox" checked={(gestores[u.id] || []).includes(r.id)} onChange={() => alternarGestor(u.id, r.id)} /></td>)}
                  </tr>
                ))}
              </tbody>
            </Tabela>
          )}
      </Caixa>

      <Caixa icon={MapPin} titulo="Cidades atendidas">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {(cidades.dados?.cidades || []).map((c) => <Etiqueta key={c.id} cor={c.ativa ? AZUL_MEDIO : "#7a889c"}>{c.nome}/{c.uf} · {c.regional_nome}</Etiqueta>)}
          {!(cidades.dados?.cidades || []).length && <span style={{ fontSize: 13, color: "#7a889c" }}>Nenhuma cidade cadastrada.</span>}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input style={inp} placeholder="Cidade" value={novaCidade.nome} onChange={(e) => setNovaCidade({ ...novaCidade, nome: e.target.value })} />
          <select style={inp} value={novaCidade.uf} onChange={(e) => setNovaCidade({ ...novaCidade, uf: e.target.value })}><option value="">UF</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select>
          <select style={inp} value={novaCidade.regionalId} onChange={(e) => setNovaCidade({ ...novaCidade, regionalId: e.target.value })}><option value="">Regional…</option>{regionais.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}</select>
          <button style={btn} onClick={criarCidade}><Plus size={14} /> Adicionar</button>
        </div>
      </Caixa>

      <Caixa icon={ShieldCheck} titulo="Matriz de habilitações">
        <p style={{ fontSize: 12.5, color: "#5a6a80", marginTop: 0 }}>
          Quais profissões podem executar cada serviço. Serviço <b>sem nenhuma linha</b> aqui não é restringido pela matriz. A FN decide — o sistema não presume atribuição legal de conselho.
        </p>
        <Tabela>
          <thead><tr>{["Serviço", "Profissão", "Regional", "Exige registro", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {(habilitacoes.dados?.regras || []).map((h) => (
              <tr key={h.id}>
                <td style={td}>{h.servico}</td><td style={td}>{h.profissao}</td><td style={td}>{h.regional_nome || "Todas"}</td>
                <td style={td}>{h.exige_registro_valido ? "Sim" : "Não"}</td>
                <td style={td}><button style={btnLeve} onClick={() => removerHab(h.id)}><X size={14} /> Remover</button></td>
              </tr>
            ))}
            <tr>
              <td style={td}><input style={inp} placeholder="Vistoria de entrega de chaves" value={novaHab.servico} onChange={(e) => setNovaHab({ ...novaHab, servico: e.target.value })} /></td>
              <td style={td}><input style={inp} placeholder="Engenheiro Civil" value={novaHab.profissao} onChange={(e) => setNovaHab({ ...novaHab, profissao: e.target.value })} /></td>
              <td style={td}><select style={inp} value={novaHab.regionalId} onChange={(e) => setNovaHab({ ...novaHab, regionalId: e.target.value })}><option value="">Todas</option>{regionais.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}</select></td>
              <td style={td} colSpan={2}><button style={btn} onClick={criarHab}><Plus size={14} /> Liberar</button></td>
            </tr>
          </tbody>
        </Tabela>
      </Caixa>
    </>
  );
}

/* ---------------- Remuneração (só FN Nacional) ---------------- */
function AbaRemuneracao({ token, apiFetch, notify, regionais }) {
  const { dados, recarregar } = useApi(apiFetch, token, notify, "/api/nacional/remuneracao");
  const vazia = { nome: "", modelo: "percentual", percentualTecnico: "", valorFixo: "", servico: "", regionalId: "", nivel: "", origemComercial: "", campanha: "", prioridade: 0 };
  const [nova, setNova] = useState(vazia);
  const criar = async () => {
    const corpo = { ...nova };
    for (const k of Object.keys(corpo)) if (corpo[k] === "") corpo[k] = null;
    try { await apiFetch("/api/nacional/remuneracao", { method: "POST", token, body: corpo }); setNova(vazia); notify("Regra criada ✓"); recarregar(); }
    catch (e) { notify(e.message); }
  };
  const alternar = async (r) => {
    try { await apiFetch(`/api/nacional/remuneracao/${r.id}`, { method: "PATCH", token, body: { ativo: !r.ativo } }); recarregar(); }
    catch (e) { notify(e.message); }
  };
  const set = (k) => (e) => setNova({ ...nova, [k]: e.target.value });
  return (
    <Caixa icon={Wallet} titulo="Regras de remuneração do técnico">
      <p style={{ fontSize: 12.5, color: "#5a6a80", marginTop: 0 }}>
        Nenhum percentual fica no código. Para cada OS vale a regra <b>mais específica</b> cujos critérios batem (vazio = qualquer); empate, a de maior prioridade.
        Sem regra, vale o <b>custo por empreendimento</b> da tela de Preços.
      </p>
      <Tabela>
        <thead><tr>{["Regra", "Paga", "Serviço", "Regional", "Nível", "Origem", "Campanha", "Prioridade", "Ativa"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>
          {(dados?.regras || []).map((r) => (
            <tr key={r.id} style={{ opacity: r.ativo ? 1 : 0.5 }}>
              <td style={td}><b>{r.nome}</b></td>
              <td style={td}>{r.modelo === "fixo" ? brl(r.valor_fixo) : `${Number(r.percentual_tecnico)}% do valor cobrado`}</td>
              <td style={td}>{r.servico || "qualquer"}</td><td style={td}>{r.regional_nome || "qualquer"}</td>
              <td style={td}>{r.nivel ? ROTULO_NIVEL[r.nivel] : "qualquer"}</td><td style={td}>{r.origem_comercial ? ROTULO_ORIGEM[r.origem_comercial] : "qualquer"}</td>
              <td style={td}>{r.campanha || "qualquer"}</td><td style={td}>{r.prioridade}</td>
              <td style={td}><input type="checkbox" checked={r.ativo} onChange={() => alternar(r)} /></td>
            </tr>
          ))}
        </tbody>
      </Tabela>
      <h4 style={{ margin: "16px 0 8px", color: AZUL_MARINHO, fontSize: 14 }}>Nova regra</h4>
      <Grade>
        <Campo label="Nome"><input style={inp} value={nova.nome} onChange={set("nome")} placeholder="Cliente do parceiro — 85%" /></Campo>
        <Campo label="Modelo"><select style={inp} value={nova.modelo} onChange={set("modelo")}><option value="percentual">Percentual do valor cobrado</option><option value="fixo">Valor fixo por OS</option></select></Campo>
        {nova.modelo === "percentual"
          ? <Campo label="% para o técnico"><input type="number" min="0" max="100" style={inp} value={nova.percentualTecnico} onChange={set("percentualTecnico")} /></Campo>
          : <Campo label="Valor fixo (R$)"><input type="number" min="0" step="0.01" style={inp} value={nova.valorFixo} onChange={set("valorFixo")} /></Campo>}
        <Campo label="Serviço"><input style={inp} value={nova.servico} onChange={set("servico")} placeholder="qualquer" /></Campo>
        <Campo label="Regional"><select style={inp} value={nova.regionalId} onChange={set("regionalId")}><option value="">qualquer</option>{regionais.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}</select></Campo>
        <Campo label="Nível"><select style={inp} value={nova.nivel} onChange={set("nivel")}><option value="">qualquer</option>{Object.entries(ROTULO_NIVEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Campo>
        <Campo label="Origem do cliente"><select style={inp} value={nova.origemComercial} onChange={set("origemComercial")}><option value="">qualquer</option>{Object.entries(ROTULO_ORIGEM).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Campo>
        <Campo label="Campanha"><input style={inp} value={nova.campanha} onChange={set("campanha")} placeholder="qualquer" /></Campo>
        <Campo label="Prioridade"><input type="number" style={inp} value={nova.prioridade} onChange={set("prioridade")} /></Campo>
      </Grade>
      <div style={{ marginTop: 12 }}><button style={btn} onClick={criar} disabled={!nova.nome}><Plus size={14} /> Criar regra</button></div>
    </Caixa>
  );
}

/* ---------------- Auditoria (só FN Nacional) ---------------- */
const ROTULO_ACAO = {
  regional_criada: "Regional criada", regional_alterada: "Regional alterada", cidade_criada: "Cidade criada", cidade_alterada: "Cidade alterada",
  permissao_regional_alterada: "Permissão regional alterada", tecnico_perfil_criado: "Perfil técnico criado", tecnico_perfil_alterado: "Perfil técnico alterado",
  tecnico_classificacao_alterada: "Nível/situação do técnico", tecnico_documento_incluido: "Documento incluído", tecnico_documento_alterado: "Documento alterado",
  tecnico_documento_excluido: "Documento excluído", habilitacao_criada: "Habilitação liberada", habilitacao_desativada: "Habilitação removida",
  empreendimento_mapeado: "Empreendimento mapeado", empreendimento_alterado: "Empreendimento alterado", origem_comercial_alterada: "Origem comercial alterada",
  os_alterada: "OS alterada", valor_tecnico_alterado: "Valor do técnico alterado", regra_remuneracao_criada: "Regra de remuneração criada",
  regra_remuneracao_alterada: "Regra de remuneração alterada",
};
function AbaAuditoria({ token, apiFetch, notify }) {
  const [acao, setAcao] = useState("");
  const { dados, carregando, recarregar } = useApi(apiFetch, token, notify, `/api/nacional/auditoria${acao ? `?acao=${acao}` : ""}`);
  const mostrar = (v) => {
    if (v == null) return "—";
    try { const o = JSON.parse(v); return typeof o === "object" && o ? Object.entries(o).map(([k, x]) => `${k}: ${Array.isArray(x) ? x.join(", ") : x ?? "—"}`).join(" · ") : String(o); }
    catch { return v; }
  };
  return (
    <Caixa icon={History} titulo="Auditoria"
      acoes={<>
        <select style={inp} value={acao} onChange={(e) => setAcao(e.target.value)}><option value="">Todas as ações</option>{Object.entries(ROTULO_ACAO).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <button style={btnLeve} onClick={recarregar}><RefreshCcw size={14} className={carregando ? "spin" : ""} /> Atualizar</button>
      </>}>
      <Tabela>
        <thead><tr>{["Quando", "Quem", "Ação", "Antes", "Depois", "Justificativa"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>
          {(dados?.registros || []).map((a) => (
            <tr key={a.id}>
              <td style={td}>{new Date(a.criado_em).toLocaleString("pt-BR")}</td>
              <td style={td}>{a.usuario_nome || "—"}<div style={{ fontSize: 11, color: "#7a889c" }}>{a.perfil}</div></td>
              <td style={td}>{ROTULO_ACAO[a.acao] || a.acao}</td>
              <td style={{ ...td, fontSize: 12, maxWidth: 260 }}>{mostrar(a.valor_anterior)}</td>
              <td style={{ ...td, fontSize: 12, maxWidth: 260 }}>{mostrar(a.valor_novo)}</td>
              <td style={{ ...td, fontSize: 12 }}>{a.justificativa || "—"}</td>
            </tr>
          ))}
          {!(dados?.registros || []).length && <tr><td style={td} colSpan={6}><Vazio>{carregando ? "Carregando…" : "Nada registrado ainda."}</Vazio></td></tr>}
        </tbody>
      </Tabela>
    </Caixa>
  );
}
