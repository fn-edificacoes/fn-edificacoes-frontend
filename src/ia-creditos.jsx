/* ============================================================
   CRÉDITOS DE IA — Financeiro › Créditos de IA (só Gerência)
   ============================================================
   Quanto a inteligência artificial do sistema gastou dos créditos comprados e quanto cada
   técnico pode gravar. Os créditos ficam em duas empresas, cada uma com saldo próprio:
   OpenAI (transcrição do áudio e o botão "Gerar sugestão com IA") e Anthropic (o Claude, que
   monta o item da patologia por voz). Nenhuma das duas informa o saldo por API, então o valor
   aqui é estimativa: o servidor soma o que mandou para cada uma e multiplica pelos preços de
   tabela (ver src/ia-consumo.js no backend). O saldo exato fica no painel de cada empresa.

   Arquivo à parte, como a Rede Nacional: o App.jsx só encaixa e entrega o apiFetch. */
import React, { useEffect, useMemo, useState } from "react";
import { Sparkles, RefreshCcw, Save, ExternalLink, Loader2, Users, Clock, SlidersHorizontal } from "lucide-react";

const AZUL_MEDIO = "#2C75B5";
const AZUL_MARINHO = "#12335B";
const CINZA_CLARO = "#F1F4F8";
const CINZA_BORDA = "#D8DEE7";
const VERDE = "#0F7259";
const VERMELHO = "#C62828";
const AMBAR = "#B26A00";

const lab = { fontSize: 12, fontWeight: 600, color: "#5a6a80" };
const inp = { padding: "8px 10px", border: `1px solid ${CINZA_BORDA}`, borderRadius: 8, fontSize: 13.5, outline: "none", background: "#fff", fontFamily: "inherit", minWidth: 0 };
const th = { textAlign: "left", fontSize: 11.5, fontWeight: 700, color: "#5a6a80", padding: "8px 8px", borderBottom: `1px solid ${CINZA_BORDA}`, whiteSpace: "nowrap" };
const td = { fontSize: 13, padding: "8px 8px", borderBottom: `1px solid ${CINZA_CLARO}`, verticalAlign: "middle" };
const btn = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "none", background: AZUL_MEDIO, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" };
const btnLeve = { ...btn, background: "#fff", color: AZUL_MARINHO, border: `1px solid ${CINZA_BORDA}` };
const cartao = { background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 14, padding: 18, marginBottom: 16 };

/* Dólar: os créditos são comprados em dólar. Valores pequenos (cada gravação custa centavos)
   ganham mais casas para não virarem "US$ 0,00". */
function usd(v) {
  if (v === null || v === undefined) return "—";
  const n = Number(v) || 0;
  const casas = Math.abs(n) > 0 && Math.abs(n) < 1 ? 4 : 2;
  return `US$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: casas })}`;
}
/* Menos de um minuto vira segundos: uma gravação curta não pode aparecer como "0 min". */
function min(v) {
  const n = Number(v || 0);
  if (n > 0 && n < 1) return `${Math.max(1, Math.round(n * 60))} s`;
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} min`;
}
function mesAtual() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date()).slice(0, 7);
}
function faixaDoMes(mes) {
  const [ano, m] = mes.split("-").map(Number);
  const ultimo = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  return { de: `${mes}-01`, ate: `${mes}-${String(ultimo).padStart(2, "0")}` };
}
const PERIODO_TEXTO = { dia: "por dia", mes: "por mês" };

const SOBRE_PROVEDOR = {
  openai: { uso: "Transcrição do áudio e o botão \"Gerar sugestão com IA\"", painel: "https://platform.openai.com/usage" },
  anthropic: { uso: "Montagem do item da patologia por voz (Claude)", painel: "https://platform.claude.com/" },
  assemblyai: { uso: "Transcrição do áudio (se escolhida no servidor)", painel: "https://www.assemblyai.com/dashboard" },
};
const ROTULO_PRECO = {
  claudeEntradaPorMilhao: "Claude — entrada (por milhão de tokens)",
  claudeSaidaPorMilhao: "Claude — saída (por milhão de tokens)",
  claudeCacheLeituraPorMilhao: "Claude — leitura do cache (por milhão)",
  claudeCacheEscritaPorMilhao: "Claude — escrita no cache (por milhão)",
  transcricaoOpenaiPorMinuto: "OpenAI — transcrição (por minuto de áudio)",
  transcricaoAssemblyaiPorMinuto: "AssemblyAI — transcrição (por minuto)",
  sugestaoEntradaPorMilhao: "Sugestão de laudo — entrada (por milhão)",
  sugestaoSaidaPorMilhao: "Sugestão de laudo — saída (por milhão)",
};

function Barra({ pct, cor }) {
  return (
    <div style={{ height: 6, borderRadius: 4, background: CINZA_CLARO, overflow: "hidden", minWidth: 80 }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", background: cor }} />
    </div>
  );
}

export default function AbaCreditosIA({ apiFetch, token, notify }) {
  const [mes, setMes] = useState(mesAtual());
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState("");
  /* O que a Gerência está editando (créditos, limites, preços). Só vai ao servidor no Salvar. */
  const [rascunho, setRascunho] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    setErroCarga("");
    const { de, ate } = faixaDoMes(mes);
    try {
      const r = await apiFetch(`/api/financeiro/ia-creditos?de=${de}&ate=${ate}`, { token });
      setDados(r);
      setRascunho({ creditos: { ...r.creditos }, limites: JSON.parse(JSON.stringify(r.limites)), precos: { ...r.precos } });
    } catch (e) {
      setErroCarga(e.message || "Não foi possível carregar os créditos de IA.");
    }
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, [mes]);

  const original = useMemo(() => (dados ? JSON.stringify({ creditos: dados.creditos, limites: dados.limites, precos: dados.precos }) : ""), [dados]);
  const alterado = !!rascunho && JSON.stringify(rascunho) !== original;

  const salvar = async () => {
    setSalvando(true);
    try {
      await apiFetch("/api/financeiro/ia-creditos", { method: "PUT", token, body: rascunho });
      notify?.("Créditos e limites de IA salvos ✓");
      await carregar();
    } catch (e) {
      notify?.(e.message || "Não foi possível salvar agora.");
    }
    setSalvando(false);
  };

  const mudarCredito = (prov, valor) => setRascunho((r) => ({ ...r, creditos: { ...r.creditos, [prov]: valor === "" ? null : Number(valor) } }));
  const mudarPadrao = (patch) => setRascunho((r) => ({ ...r, limites: { ...r.limites, padrao: { ...r.limites.padrao, ...patch } } }));
  const mudarLimitePessoa = (id, valor) => setRascunho((r) => {
    const porUsuario = { ...r.limites.porUsuario };
    if (valor === undefined) delete porUsuario[id]; else porUsuario[id] = valor;
    return { ...r, limites: { ...r.limites, porUsuario } };
  });

  if (carregando && !dados) {
    return <div style={cartao}><Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> Carregando créditos de IA…</div>;
  }
  if (erroCarga && !dados) {
    return (
      <div style={cartao}>
        <p style={{ color: VERMELHO, margin: "0 0 10px" }}>{erroCarga}</p>
        <button type="button" style={btn} onClick={carregar}><RefreshCcw size={15} /> Tentar de novo</button>
      </div>
    );
  }
  if (!dados || !rascunho) return null;

  const padrao = rascunho.limites.padrao;
  const tecnicos = dados.pessoas.filter((p) => p.role !== "gerencia");
  const gerentes = dados.pessoas.filter((p) => p.role === "gerencia");

  return (
    <div>
      <div style={cartao}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <Sparkles size={20} color={AZUL_MEDIO} />
          <h2 style={{ margin: 0, fontSize: 18, color: AZUL_MARINHO }}>Créditos de IA</h2>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: "#5a6a80" }}>
          Quanto a inteligência artificial do sistema gastou dos créditos comprados, e quanto cada técnico pode gravar na
          patologia por voz. Os valores são <strong>estimativas</strong> pelos preços de tabela; o saldo exato fica no painel de cada empresa.
          {dados.contandoDesde && <> Contando desde {new Date(dados.contandoDesde).toLocaleDateString("pt-BR")}.</>}
        </p>
      </div>

      {/* ---- Crédito por empresa ---- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 16 }}>
        {dados.provedores.map((p) => {
          const credito = rascunho.creditos[p.provedor];
          const restante = credito === null || credito === undefined ? null : credito - p.gastoTotal;
          const pctUsado = credito ? (p.gastoTotal / credito) * 100 : 0;
          const corRestante = restante === null ? "#5a6a80" : restante <= 0 ? VERMELHO : pctUsado >= 80 ? AMBAR : VERDE;
          return (
            <div key={p.provedor} style={{ ...cartao, marginBottom: 0 }}>
              <strong style={{ fontSize: 15, color: AZUL_MARINHO }}>{p.nome}</strong>
              <p style={{ fontSize: 12, color: "#8a97a8", margin: "2px 0 12px" }}>{SOBRE_PROVEDOR[p.provedor]?.uso}</p>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                <span style={lab}>Crédito que você colocou (US$)</span>
                <input type="number" min="0" step="0.01" inputMode="decimal" style={inp} placeholder="Ex.: 5"
                  value={credito ?? ""} onChange={(e) => mudarCredito(p.provedor, e.target.value)} />
              </label>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: "#5a6a80" }}>Gasto estimado</span><strong>{usd(p.gastoTotal)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
                <span style={{ color: "#5a6a80" }}>Restante estimado</span>
                <strong style={{ color: corRestante }}>{restante === null ? "informe o crédito" : usd(restante)}</strong>
              </div>
              {credito ? <Barra pct={pctUsado} cor={corRestante} /> : null}
              {restante !== null && restante <= 0 && (
                <p style={{ fontSize: 12.5, color: VERMELHO, margin: "8px 0 0" }}>O crédito estimado acabou: confira o saldo no painel e recarregue.</p>
              )}
              <a href={SOBRE_PROVEDOR[p.provedor]?.painel} target="_blank" rel="noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, color: AZUL_MEDIO, marginTop: 10 }}>
                Ver saldo exato no painel <ExternalLink size={13} />
              </a>
            </div>
          );
        })}
      </div>

      {/* ---- Gasto no mês ---- */}
      <div style={cartao}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <Clock size={18} color={AZUL_MEDIO} />
          <strong style={{ fontSize: 15, color: AZUL_MARINHO }}>Gasto no mês</strong>
          <input type="month" style={{ ...inp, marginLeft: "auto" }} value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} />
          {carregando && <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />}
        </div>
        <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginBottom: 12 }}>
          <div><span style={lab}>Total estimado</span><div style={{ fontSize: 20, fontWeight: 700, color: AZUL_MARINHO }}>{usd(dados.totalPeriodo.custo)}</div></div>
          <div><span style={lab}>Gravações</span><div style={{ fontSize: 20, fontWeight: 700, color: AZUL_MARINHO }}>{dados.totalPeriodo.gravacoes}</div></div>
          <div><span style={lab}>Áudio transcrito</span><div style={{ fontSize: 20, fontWeight: 700, color: AZUL_MARINHO }}>{min(dados.totalPeriodo.minutos)}</div></div>
          <div><span style={lab}>Sugestões de laudo</span><div style={{ fontSize: 20, fontWeight: 700, color: AZUL_MARINHO }}>{dados.totalPeriodo.sugestoes}</div></div>
        </div>
        {dados.recursos.length === 0 ? (
          <p style={{ fontSize: 13, color: "#8a97a8", margin: 0 }}>Nenhum uso de IA neste mês.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>O que gastou</th><th style={th}>Empresa</th><th style={th}>Usos</th><th style={th}>Gasto estimado</th></tr></thead>
              <tbody>
                {dados.recursos.map((r) => (
                  <tr key={`${r.recurso}-${r.provedor}`}>
                    <td style={td}>{r.nome}{r.recurso === "voz_transcricao" ? ` (${min(r.minutos)})` : ""}</td>
                    <td style={td}>{r.provedorNome}</td>
                    <td style={td}>{r.chamadas}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{usd(r.custo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---- Limite padrão ---- */}
      <div style={cartao}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <SlidersHorizontal size={18} color={AZUL_MEDIO} />
          <strong style={{ fontSize: 15, color: AZUL_MARINHO }}>Limite de gravação dos técnicos</strong>
        </div>
        <p style={{ fontSize: 12.5, color: "#5a6a80", margin: "0 0 12px" }}>
          Tempo de áudio que cada técnico pode gravar na patologia por voz. Quando acaba, o botão de gravar trava e aparece
          "fale com a Gerência". A Gerência não tem limite. Vale para quem não tem limite próprio na tabela abaixo.
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={lab}>Limite padrão</span>
            <select style={inp} value={padrao.minutos === null ? "sem" : "com"}
              onChange={(e) => mudarPadrao(e.target.value === "sem" ? { minutos: null } : { minutos: 30, periodo: padrao.periodo || "mes" })}>
              <option value="com">Com limite</option>
              <option value="sem">Sem limite</option>
            </select>
          </label>
          {padrao.minutos !== null && (
            <>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, width: 110 }}>
                <span style={lab}>Minutos</span>
                <input type="number" min="0" step="1" inputMode="numeric" style={inp} value={padrao.minutos}
                  onChange={(e) => mudarPadrao({ minutos: e.target.value === "" ? 0 : Number(e.target.value) })} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={lab}>Período</span>
                <select style={inp} value={padrao.periodo} onChange={(e) => mudarPadrao({ periodo: e.target.value })}>
                  <option value="dia">por dia</option>
                  <option value="mes">por mês</option>
                </select>
              </label>
            </>
          )}
        </div>
      </div>

      {/* ---- Por pessoa ---- */}
      <div style={cartao}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Users size={18} color={AZUL_MEDIO} />
          <strong style={{ fontSize: 15, color: AZUL_MARINHO }}>Uso por pessoa no mês</strong>
        </div>
        {dados.pessoas.length === 0 ? (
          <p style={{ fontSize: 13, color: "#8a97a8", margin: 0 }}>Nenhum técnico cadastrado.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
              <thead>
                <tr>
                  <th style={th}>Pessoa</th><th style={th}>Gravações</th><th style={th}>Áudio</th><th style={th}>Sugestões</th>
                  <th style={th}>Gasto</th><th style={th}>Limite</th><th style={th}>Usado no limite</th>
                </tr>
              </thead>
              <tbody>
                {[...tecnicos, ...gerentes].map((p) => (
                  <LinhaPessoa key={p.id} p={p} padrao={padrao} proprio={rascunho.limites.porUsuario[p.id]}
                    onMudar={(valor) => mudarLimitePessoa(p.id, valor)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---- Preços ---- */}
      <details style={cartao}>
        <summary style={{ cursor: "pointer", fontWeight: 700, color: AZUL_MARINHO }}>Preços usados na estimativa (US$)</summary>
        <p style={{ fontSize: 12.5, color: "#5a6a80", margin: "10px 0 12px" }}>
          Preços de tabela de cada empresa. Se mudarem, corrija aqui: o gasto de todo o histórico é recalculado.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
          {Object.keys(dados.precosPadrao).map((k) => (
            <label key={k} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={lab}>{ROTULO_PRECO[k] || k}</span>
              <input type="number" min="0" step="0.0001" inputMode="decimal" style={inp} value={rascunho.precos[k]}
                onChange={(e) => setRascunho((r) => ({ ...r, precos: { ...r.precos, [k]: e.target.value === "" ? 0 : Number(e.target.value) } }))} />
            </label>
          ))}
        </div>
        <button type="button" style={{ ...btnLeve, marginTop: 12 }} onClick={() => setRascunho((r) => ({ ...r, precos: { ...dados.precosPadrao } }))}>
          Voltar aos preços de tabela
        </button>
      </details>

      {/* ---- Salvar ---- */}
      {alterado && (
        <div style={{ position: "sticky", bottom: 12, zIndex: 5, display: "flex", gap: 10, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap",
          background: "#fff", border: `1px solid ${AZUL_MEDIO}`, borderRadius: 12, padding: "10px 14px", boxShadow: "0 6px 18px rgba(18,51,91,.15)" }}>
          <span style={{ fontSize: 13, color: AZUL_MARINHO, marginRight: "auto" }}>Você tem alterações não salvas.</span>
          <button type="button" style={btnLeve} onClick={() => setRascunho({ creditos: { ...dados.creditos }, limites: JSON.parse(JSON.stringify(dados.limites)), precos: { ...dados.precos } })}>
            Descartar
          </button>
          <button type="button" style={btn} onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={15} />} Salvar
          </button>
        </div>
      )}
    </div>
  );
}

/* Uma pessoa na tabela: o consumo dela no mês e o limite. Para técnico, a Gerência escolhe
   entre o padrão, um limite próprio ou sem limite; a Gerência não tem limite. */
function LinhaPessoa({ p, padrao, proprio, onMudar }) {
  const ehGerencia = p.role === "gerencia";
  const escolha = ehGerencia ? "gerencia" : proprio === undefined ? "padrao" : proprio.minutos === null ? "sem_limite" : "personalizado";
  const limiteSalvo = p.limite; // o que vale hoje no servidor (o uso abaixo é desse limite)
  const pct = limiteSalvo && limiteSalvo.minutos > 0 ? (p.usadoNoLimite / limiteSalvo.minutos) * 100 : (limiteSalvo ? 100 : 0);
  const cor = pct >= 100 ? VERMELHO : pct >= 80 ? AMBAR : VERDE;
  const textoPadrao = padrao.minutos === null ? "sem limite" : `${padrao.minutos} min ${PERIODO_TEXTO[padrao.periodo]}`;

  return (
    <tr style={{ opacity: p.ativo ? 1 : 0.6 }}>
      <td style={td}>
        <strong style={{ color: AZUL_MARINHO }}>{p.nome}</strong>
        <div style={{ fontSize: 11.5, color: "#8a97a8" }}>{ehGerencia ? "Gerência" : "Técnico"}{p.ativo ? "" : " · inativo"}</div>
      </td>
      <td style={td}>{p.gravacoes}</td>
      <td style={td}>{min(p.minutos)}</td>
      <td style={td}>{p.sugestoes}</td>
      <td style={{ ...td, fontWeight: 700 }}>{usd(p.custo)}</td>
      <td style={td}>
        {ehGerencia ? (
          <span style={{ fontSize: 12.5, color: "#5a6a80" }}>Sem limite (Gerência)</span>
        ) : (
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <select style={inp} value={escolha} onChange={(e) => {
              const v = e.target.value;
              if (v === "padrao") onMudar(undefined);
              else if (v === "sem_limite") onMudar({ minutos: null, periodo: "mes" });
              else onMudar({ minutos: padrao.minutos ?? 30, periodo: padrao.periodo || "mes" });
            }}>
              <option value="padrao">Padrão ({textoPadrao})</option>
              <option value="personalizado">Próprio</option>
              <option value="sem_limite">Sem limite</option>
            </select>
            {escolha === "personalizado" && (
              <>
                <input type="number" min="0" step="1" inputMode="numeric" style={{ ...inp, width: 70 }} value={proprio.minutos}
                  aria-label={`Minutos de ${p.nome}`}
                  onChange={(e) => onMudar({ ...proprio, minutos: e.target.value === "" ? 0 : Number(e.target.value) })} />
                <select style={inp} value={proprio.periodo} aria-label={`Período de ${p.nome}`} onChange={(e) => onMudar({ ...proprio, periodo: e.target.value })}>
                  <option value="dia">min/dia</option>
                  <option value="mes">min/mês</option>
                </select>
              </>
            )}
          </div>
        )}
      </td>
      <td style={td}>
        {limiteSalvo ? (
          <div style={{ minWidth: 120 }}>
            <div style={{ fontSize: 12.5, color: cor, fontWeight: 600, marginBottom: 3 }}>
              {min(p.usadoNoLimite)} de {limiteSalvo.minutos} {limiteSalvo.periodo === "dia" ? "hoje" : "no mês"}
            </div>
            <Barra pct={pct} cor={cor} />
          </div>
        ) : (
          <span style={{ fontSize: 12.5, color: "#8a97a8" }}>—</span>
        )}
      </td>
    </tr>
  );
}
