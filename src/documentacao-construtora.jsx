/* ============================================================
   DOCUMENTAÇÃO PARA A CONSTRUTORA
   ============================================================
   Pedido da Gerência (18/11/2026): a construtora só libera o técnico na obra se receber, dias
   antes da vistoria, o contrato da FN, a ART do empreendimento (quando houver), a carteira do
   conselho do técnico (CFT, CAU ou CREA) e o acervo técnico dele. Antes isso era juntado à mão.

   - O técnico anexa carteira e acervo UMA vez, em "Meus documentos"; o sistema pede para
     atualizar a cada 6 meses e usa sempre a versão mais recente.
   - O Atendimento anexa o PDF da ART na própria ART de vistoria (AnexoArtVistoria).
   - A Gerência cadastra o e-mail de cada construtora e quantos dias antes ela exige
     (AbaConstrutoras), e acompanha o que já foi, o que falta e o que vai sair.
   - O servidor junta tudo num PDF só e envia sozinho (src/documentacao-construtora.js no
     backend). Faltando algo obrigatório, não envia pela metade: avisa a Gerência por e-mail. */
import React, { useEffect, useMemo, useState } from "react";
import {
  FileText, Upload, Eye, Send, RefreshCcw, Building2, Mail, AlertTriangle, CheckCircle, Clock, Trash2, Save, Plus, X,
  Users, ChevronDown, ChevronRight, Loader2, BadgeCheck, Paperclip,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "https://sistema.fnedificacoes.com.br";
const AZUL_MEDIO = "#2C75B5";
const AZUL_MARINHO = "#12335B";
const CINZA_CLARO = "#F1F4F8";
const CINZA_BORDA = "#D8DEE7";
const VERDE = "#1B7F4B";
const VERMELHO = "#C62828";
const AMBAR = "#B26A00";
const TAMANHO_MAX = 10 * 1024 * 1024;

const lab = { fontSize: 12, fontWeight: 600, color: "#5a6a80", display: "block", marginBottom: 4 };
const inp = { padding: "8px 10px", border: `1px solid ${CINZA_BORDA}`, borderRadius: 8, fontSize: 13.5, outline: "none", background: "#fff", fontFamily: "inherit", minWidth: 0, width: "100%", boxSizing: "border-box" };
const th = { textAlign: "left", fontSize: 11.5, fontWeight: 700, color: "#5a6a80", padding: "8px 8px", borderBottom: `1px solid ${CINZA_BORDA}`, whiteSpace: "nowrap" };
const td = { fontSize: 13, padding: "9px 8px", borderBottom: `1px solid ${CINZA_CLARO}`, verticalAlign: "top" };
const btn = { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "none", background: AZUL_MEDIO, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit" };
const btnLeve = { ...btn, background: "#fff", color: AZUL_MARINHO, border: `1px solid ${CINZA_BORDA}` };

const dataBr = (v) => (v ? String(v).slice(0, 10).split("-").reverse().join("/") : "—");
const dataHoraBr = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
};

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
function Pilula({ cor, fundo, children }) {
  return <span style={{ background: fundo, color: cor, borderRadius: 20, padding: "2px 9px", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap", display: "inline-block" }}>{children}</span>;
}
function Aviso({ tom = "atencao", children, style }) {
  const cores = { atencao: ["#FFF4E0", "#8a5300"], erro: ["#FDECEC", "#A12020"], ok: ["#E6F4EC", VERDE], info: ["#EAF2FB", AZUL_MARINHO] }[tom];
  return <div style={{ background: cores[0], color: cores[1], borderRadius: 8, padding: "9px 12px", fontSize: 12.5, lineHeight: 1.5, ...style }}>{children}</div>;
}

/* PDF e foto vêm em binário, com o mesmo token do apiFetch. A aba abre ANTES do download:
   aberta depois de um await, o navegador trata como pop-up e bloqueia. */
async function abrirArquivo(token, caminho) {
  const janela = window.open("", "_blank");
  try {
    let resp;
    try {
      resp = await fetch(`${API_URL}${caminho}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout?.(90000) });
    } catch {
      throw new Error("Não foi possível falar com o sistema agora. Tente de novo em instantes.");
    }
    if (!resp.ok) {
      let dados = null;
      try { dados = await resp.json(); } catch { /* corpo não-JSON */ }
      throw new Error(dados?.erro || `Erro ${resp.status}`);
    }
    const url = URL.createObjectURL(await resp.blob());
    if (janela) janela.location.href = url; else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  } catch (e) {
    janela?.close();
    throw e;
  }
}

/* Lê o arquivo escolhido como data URL, conferindo tipo e tamanho antes de subir 10 MB à toa. */
function lerArquivo(arquivo) {
  return new Promise((resolver, rejeitar) => {
    if (!arquivo) return rejeitar(new Error("Escolha o arquivo."));
    const ok = arquivo.type === "application/pdf" || arquivo.type === "image/jpeg" || arquivo.type === "image/png" || /\.(pdf|jpe?g|png)$/i.test(arquivo.name);
    if (!ok) return rejeitar(new Error("Envie um PDF ou uma foto (JPG ou PNG)."));
    if (arquivo.size > TAMANHO_MAX) return rejeitar(new Error("Arquivo grande demais (máximo 10 MB). Tente um PDF mais leve ou uma foto menor."));
    const leitor = new FileReader();
    leitor.onload = () => resolver(leitor.result);
    leitor.onerror = () => rejeitar(new Error("Não foi possível ler o arquivo."));
    leitor.readAsDataURL(arquivo);
  });
}

export const lerArquivoComoDataUrl = lerArquivo;

/* ============================================================
   PORTAL DO CLIENTE › Minha ART
   ============================================================
   Cada pessoa vê a ART em que está: a coletiva do empreendimento ou a individual dela. Some
   enquanto não houver ART com PDF anexado — "sem arquivo" não ajuda o cliente em nada. */
export function MinhasArts({ token, apiFetch, notify }) {
  const [arts, setArts] = useState([]);
  useEffect(() => {
    apiFetch("/api/minhas-arts", { token }).then((r) => setArts((r.arts || []).filter((a) => a.temArquivo))).catch(() => {});
  }, []);
  if (!arts.length) return null;
  return (
    <section style={{ background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <FileText size={17} color={AZUL_MEDIO} />
        <h3 style={{ margin: 0, fontSize: 15, color: AZUL_MARINHO }}>{arts.length > 1 ? "Minhas ARTs" : "Minha ART"}</h3>
      </div>
      <p style={{ fontSize: 12.5, color: "#65758b", margin: "0 0 10px" }}>
        A ART (Anotação de Responsabilidade Técnica) da sua vistoria. Fica sempre disponível aqui para você baixar.
      </p>
      <div style={{ display: "grid", gap: 8 }}>
        {arts.map((a) => (
          <div key={`${a.artId}-${a.clienteId}`} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: AZUL_MARINHO }}>ART {a.numero || ""} <Pilula cor="#4a5a70" fundo={CINZA_CLARO}>{a.tipo === "individual" ? "Individual" : "Coletiva"}</Pilula></div>
              <div style={{ fontSize: 12.5, color: "#65758b" }}>{[a.empreendimento, a.unidade].filter(Boolean).join(" · ")} · emitida em {dataBr(a.emitidaEm)}</div>
            </div>
            <button type="button" style={btn} onClick={() => abrirArquivo(token, `/api/minhas-arts/${a.artId}/arquivo`).catch((e) => notify?.(e.message))}>
              <Eye size={14} /> Ver / baixar
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============================================================
   PORTAL DO CLIENTE › aceite do anexo da ART/TRT múltipla
   ============================================================
   Para quem já era cliente antes do anexo (ou foi cadastrado pelo Atendimento por telefone).
   Quem se cadastra agora aceita no próprio formulário e não vê este quadro. A versão vem do
   servidor e volta no aceite: texto que mudou no meio da leitura não vale como aceite. */
export function AvisoAnexoArtMultipla({ token, apiFetch, notify }) {
  const [situacao, setSituacao] = useState(null);
  const [marcado, setMarcado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroAceite, setErroAceite] = useState("");
  useEffect(() => {
    apiFetch("/api/anexo-art-multipla", { token }).then(setSituacao).catch(() => {});
  }, []);
  if (!situacao?.pendente) return null;

  const concordar = async () => {
    if (!marcado) { setErroAceite("Marque que leu e concorda para continuar."); return; }
    setEnviando(true);
    try {
      await apiFetch("/api/anexo-art-multipla/aceite", { method: "POST", token, body: { versao: situacao.versao } });
      setSituacao({ ...situacao, pendente: false });
      notify?.("Obrigado! Seu aceite foi registrado ✓");
    } catch (e) { setErroAceite(e.message); }
    setEnviando(false);
  };

  return (
    <section style={{ background: "#FFF8EC", border: "1px solid #F1D29A", borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, color: "#8a5300" }}>
        <AlertTriangle size={17} />
        <h3 style={{ margin: 0, fontSize: 15 }}>Atualizamos a nossa política de privacidade</h3>
      </div>
      <p style={{ fontSize: 13.5, color: "#5c4a2a", margin: "0 0 10px", lineHeight: 1.55 }}>
        Para baratear a vistoria, a FN pode registrar a ART/TRT de várias pessoas do mesmo empreendimento num documento só
        (ART/TRT múltipla). Nesse caso, seu nome, CPF e unidade aparecem no mesmo documento das outras pessoas incluídas nele,
        e cada uma recebe esse documento. Leia o{" "}
        <a href="?pagina=privacidade#anexo-art-multipla" target="_blank" rel="noopener noreferrer" style={{ color: AZUL_MEDIO }}>anexo completo</a>.
      </p>
      <label style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 13, color: "#4a5a70", cursor: "pointer", marginBottom: 10 }}>
        <input type="checkbox" checked={marcado} onChange={(e) => { setMarcado(e.target.checked); setErroAceite(""); }}
          style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0 }} />
        <span>
          Li e concordo com o anexo da ART/TRT múltipla. A FN não responde pelo uso que as outras pessoas da mesma ART/TRT façam
          dos dados que constam nela.
        </span>
      </label>
      <button type="button" style={btn} disabled={enviando} onClick={concordar}>
        {enviando ? <Loader2 size={14} className="spin" /> : <CheckCircle size={14} />} Concordo
      </button>
      {erroAceite && <div style={{ fontSize: 13, color: VERMELHO, marginTop: 8 }}>{erroAceite}</div>}
      <p style={{ fontSize: 12, color: "#8593a8", margin: "10px 0 0" }}>
        Se preferir não ter seus dados num documento compartilhado, fale com a FN antes da vistoria: a ART pode ser individual.
      </p>
    </section>
  );
}

function SituacaoCredenciais({ situacao }) {
  if (!situacao) return null;
  if (situacao.faltando?.length) return <Pilula cor={VERMELHO} fundo="#FDECEC">Incompleto</Pilula>;
  if (situacao.desatualizados?.length) return <Pilula cor={AMBAR} fundo="#FFF4E0">Atualizar agora</Pilula>;
  return <Pilula cor={VERDE} fundo="#E6F4EC">Em dia · até {dataBr(situacao.proximaAtualizacao)}</Pilula>;
}

/* ============================================================
   MEUS DOCUMENTOS (técnico) — também usado pela Gerência para ver/anexar pelo técnico
   ============================================================ */
export function MeusDocumentosTecnico({ token, apiFetch, notify, usuarioId = "me", podeEditar = true, compacto = false, aoMudar }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState("");
  const [carteira, setCarteira] = useState({ conselho: "", numero: "", arquivo: null });
  const [acervo, setAcervo] = useState(null);
  const [erroForm, setErroForm] = useState("");

  const carregar = async () => {
    setCarregando(true);
    try {
      const r = await apiFetch(`/api/credenciais-tecnico/${usuarioId}`, { token });
      setDados(r);
      const c = (r.arquivos || []).find((a) => a.tipo === "carteira");
      setCarteira({ conselho: c?.conselho || "", numero: c?.numero || "", arquivo: null });
    } catch (e) { notify(`Não foi possível carregar os documentos: ${e.message}`); }
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, [usuarioId]);

  const atual = (tipo) => (dados?.arquivos || []).find((a) => a.tipo === tipo);

  const salvar = async (tipo) => {
    setErroForm("");
    const corpo = {};
    try {
      if (tipo === "carteira") {
        if (!carteira.conselho) throw new Error("Escolha o conselho da carteira (CFT, CAU ou CREA).");
        if (!carteira.numero.trim()) throw new Error("Informe o número do registro no conselho.");
        if (!carteira.arquivo && !atual("carteira")) throw new Error("Escolha o arquivo da carteira.");
        corpo.conselho = carteira.conselho;
        corpo.numero = carteira.numero.trim();
        if (carteira.arquivo) corpo.arquivo = await lerArquivo(carteira.arquivo);
      } else {
        if (!acervo) throw new Error("Escolha o arquivo do acervo técnico.");
        corpo.arquivo = await lerArquivo(acervo);
      }
    } catch (e) { setErroForm(e.message); return; }
    setSalvando(tipo);
    try {
      const r = await apiFetch(`/api/credenciais-tecnico/${usuarioId}/${tipo}`, { method: "PUT", token, body: corpo });
      setDados((d) => ({ ...d, ...r }));
      if (tipo === "carteira") setCarteira((c) => ({ ...c, arquivo: null })); else setAcervo(null);
      notify(tipo === "carteira" ? "Carteira salva ✓" : "Acervo técnico salvo ✓");
      aoMudar?.();
    } catch (e) { setErroForm(e.message); }
    setSalvando("");
  };

  const ver = async (tipo) => {
    try { await abrirArquivo(token, `/api/credenciais-tecnico/${usuarioId}/${tipo}/arquivo`); }
    catch (e) { notify(e.message); }
  };

  if (carregando && !dados) return <div style={{ fontSize: 13, color: "#8593a8", padding: 8 }}><Loader2 size={14} className="spin" /> Carregando documentos…</div>;
  const sit = dados?.situacao;
  const meses = dados?.mesesParaAtualizar || 6;

  const blocoArquivo = (tipo) => {
    const a = atual(tipo);
    const desatualizado = sit?.desatualizados?.includes(tipo);
    return a ? (
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12.5, color: "#4a5a70", marginBottom: 8 }}>
        <CheckCircle size={14} color={desatualizado ? AMBAR : VERDE} />
        <span>Enviado em {dataHoraBr(a.atualizadoEm)}{desatualizado ? " — passou de " + meses + " meses, envie a versão atual" : ""}</span>
        <button type="button" style={{ ...btnLeve, padding: "3px 8px", fontSize: 12 }} onClick={() => ver(tipo)}><Eye size={13} /> Ver</button>
      </div>
    ) : (
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: VERMELHO, marginBottom: 8 }}>
        <AlertTriangle size={14} /> Ainda não anexado
      </div>
    );
  };

  const corpo = (
    <div style={{ display: "grid", gap: 14 }}>
      {!compacto && (
        <Aviso tom="info">
          Anexe aqui a sua <strong>carteira do conselho (CFT, CAU ou CREA)</strong> e o seu <strong>acervo técnico</strong>. Você só
          precisa fazer isso uma vez: antes de cada vistoria, o sistema junta esses documentos com o contrato e a ART e envia
          sozinho para a construtora. <strong>A cada {meses} meses, atualize os seus dados</strong> enviando a versão mais recente.
        </Aviso>
      )}
      {sit?.desatualizados?.length > 0 && (
        <Aviso tom="atencao">Já se passaram {meses} meses desde o último envio. Envie a versão atual da carteira e do acervo.</Aviso>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
        <div style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 12, padding: 14 }}>
          <div style={{ fontWeight: 700, color: AZUL_MARINHO, fontSize: 14, marginBottom: 8 }}><BadgeCheck size={15} style={{ verticalAlign: "-2px" }} /> Carteira do conselho</div>
          {blocoArquivo("carteira")}
          {podeEditar && (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 8 }}>
                <label><span style={lab}>Conselho</span>
                  <select style={inp} value={carteira.conselho} onChange={(e) => setCarteira({ ...carteira, conselho: e.target.value })}>
                    <option value="">—</option>
                    {(dados?.conselhos || ["CFT", "CAU", "CREA"]).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label><span style={lab}>Nº do registro</span>
                  <input style={inp} value={carteira.numero} onChange={(e) => setCarteira({ ...carteira, numero: e.target.value })} placeholder="Ex.: PE-123456" />
                </label>
              </div>
              <label><span style={lab}>{atual("carteira") ? "Trocar arquivo (PDF ou foto)" : "Arquivo (PDF ou foto)"}</span>
                <input type="file" accept="application/pdf,image/jpeg,image/png" style={{ fontSize: 12.5 }}
                  onChange={(e) => setCarteira({ ...carteira, arquivo: e.target.files?.[0] || null })} />
              </label>
              <div>
                <button type="button" style={btn} disabled={salvando === "carteira"} onClick={() => salvar("carteira")}>
                  {salvando === "carteira" ? <Loader2 size={14} className="spin" /> : <Upload size={14} />} Salvar carteira
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 12, padding: 14 }}>
          <div style={{ fontWeight: 700, color: AZUL_MARINHO, fontSize: 14, marginBottom: 8 }}><FileText size={15} style={{ verticalAlign: "-2px" }} /> Acervo técnico</div>
          {blocoArquivo("acervo")}
          {podeEditar && (
            <div style={{ display: "grid", gap: 10 }}>
              <p style={{ fontSize: 12, color: "#65758b", margin: 0 }}>Um PDF com as suas CATs / certidão de acervo. Se tiver várias, junte num arquivo só.</p>
              <label><span style={lab}>{atual("acervo") ? "Trocar arquivo (PDF ou foto)" : "Arquivo (PDF ou foto)"}</span>
                <input type="file" accept="application/pdf,image/jpeg,image/png" style={{ fontSize: 12.5 }}
                  onChange={(e) => setAcervo(e.target.files?.[0] || null)} />
              </label>
              <div>
                <button type="button" style={btn} disabled={salvando === "acervo"} onClick={() => salvar("acervo")}>
                  {salvando === "acervo" ? <Loader2 size={14} className="spin" /> : <Upload size={14} />} Salvar acervo
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {erroForm && <div style={{ fontSize: 13, color: VERMELHO }}>{erroForm}</div>}
    </div>
  );
  if (compacto) return corpo;
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "18px" }}>
      <Caixa icon={BadgeCheck} titulo="Meus documentos" acoes={<SituacaoCredenciais situacao={sit} />}>{corpo}</Caixa>
    </div>
  );
}

/* Faixa no topo para o técnico: aparece quando falta documento ou passou dos 6 meses. */
export function AvisoDocumentosTecnico({ token, apiFetch, aoAbrir }) {
  const [sit, setSit] = useState(null);
  useEffect(() => {
    apiFetch("/api/credenciais-tecnico/me", { token }).then((r) => setSit(r.situacao)).catch(() => {});
  }, []);
  if (!sit || !sit.precisaAtualizar) return null;
  const falta = sit.faltando?.length > 0;
  return (
    <div style={{ maxWidth: 1080, margin: "12px auto 0", padding: "0 18px" }}>
      <Aviso tom={falta ? "erro" : "atencao"} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <AlertTriangle size={16} />
        <span style={{ flex: 1, minWidth: 200 }}>
          {falta
            ? "Anexe a sua carteira do conselho e o seu acervo técnico. A construtora exige esses documentos antes da vistoria."
            : "Já se passaram 6 meses: atualize a sua carteira e o seu acervo técnico."}
        </span>
        <button type="button" style={{ ...btn, padding: "5px 10px" }} onClick={aoAbrir}><Upload size={13} /> Abrir meus documentos</button>
      </Aviso>
    </div>
  );
}

/* ============================================================
   ANEXO DA ART DE VISTORIA (dentro da linha da ART, ao lado do número)
   ============================================================ */
export function AnexoArtVistoria({ art, token, apiFetch, notify, aoMudar }) {
  const [enviando, setEnviando] = useState(false);
  const inputId = `art-arquivo-${art.id}`;
  const escolher = async (arquivo) => {
    if (!arquivo) return;
    setEnviando(true);
    try {
      const dataUrl = await lerArquivo(arquivo);
      await apiFetch(`/api/arts-vistoria/${art.id}/arquivo`, { method: "PUT", token, body: { arquivo: dataUrl } });
      notify("PDF da ART anexado ✓ — vai junto para a construtora");
      aoMudar?.();
    } catch (e) { notify(`Não foi possível anexar: ${e.message}`); }
    setEnviando(false);
  };
  return (
    <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontWeight: 400 }}>
      {art.arquivo ? (
        <>
          <button type="button" style={{ ...btnLeve, padding: "2px 7px", fontSize: 11.5, color: VERDE }} title={art.arquivo.nome}
            onClick={() => abrirArquivo(token, `/api/arts-vistoria/${art.id}/arquivo`).catch((e) => notify(e.message))}>
            <Paperclip size={12} /> Ver ART
          </button>
          <label htmlFor={inputId} style={{ fontSize: 11.5, color: AZUL_MEDIO, cursor: "pointer", textDecoration: "underline" }}>{enviando ? "enviando…" : "trocar"}</label>
        </>
      ) : (
        <label htmlFor={inputId} style={{ ...btnLeve, padding: "2px 7px", fontSize: 11.5, color: AMBAR, cursor: "pointer" }}>
          {enviando ? <Loader2 size={12} className="spin" /> : <Upload size={12} />} Anexar PDF
        </label>
      )}
      <input id={inputId} type="file" accept="application/pdf,image/jpeg,image/png" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; escolher(f); }} />
    </div>
  );
}

/* ============================================================
   GERÊNCIA › CONSTRUTORAS: e-mails, envios e documentos dos técnicos
   ============================================================ */
function rotuloEnvio(v) {
  if (v.pacote?.status === "enviado") return { tom: "ok", texto: `Enviado em ${dataHoraBr(v.pacote.enviadoEm)}${v.pacote.envios > 1 ? ` (${v.pacote.envios}×)` : ""}` };
  if (!v.construtoraCadastrada) return { tom: "cinza", texto: "Construtora sem e-mail cadastrado" };
  if (v.pendencias.length) return { tom: "erro", texto: "Falta documento" };
  if (v.pacote?.status === "erro") return { tom: "erro", texto: "Falhou — tenta de novo sozinho" };
  if (v.naJanela) return { tom: "atencao", texto: "Sai na próxima rodada (até 30 min)" };
  return { tom: "info", texto: `Envia sozinho a partir de ${dataBr(v.enviarAPartirDe)}` };
}

function PainelEnvios({ token, apiFetch, notify }) {
  const [vistorias, setVistorias] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState("");
  const [filtro, setFiltro] = useState("todas");

  const carregar = async () => {
    setCarregando(true);
    try { setVistorias((await apiFetch("/api/documentacao-construtora/vistorias", { token })).vistorias || []); }
    catch (e) { notify(`Não foi possível carregar as vistorias: ${e.message}`); }
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, []);

  const enviarAgora = async (v) => {
    const jaFoi = v.pacote?.status === "enviado";
    if (!window.confirm(`${jaFoi ? "Enviar DE NOVO" : "Enviar agora"} a documentação de ${v.cliente} para ${v.emails.join(", ")}?`)) return;
    setEnviando(v.clienteId);
    try {
      const r = await apiFetch(`/api/documentacao-construtora/${v.clienteId}/enviar`, { method: "POST", token, body: {} });
      setVistorias((lista) => lista.map((x) => (x.clienteId === v.clienteId ? r.vistoria : x)));
      notify("Documentação enviada para a construtora ✓");
    } catch (e) { notify(e.message); }
    setEnviando("");
  };

  const visiveis = vistorias.filter((v) => {
    if (filtro === "pendentes") return v.construtoraCadastrada && v.pacote?.status !== "enviado" && v.pendencias.length > 0;
    if (filtro === "enviadas") return v.pacote?.status === "enviado";
    return true;
  });
  const cores = { ok: [VERDE, "#E6F4EC"], erro: [VERMELHO, "#FDECEC"], atencao: [AMBAR, "#FFF4E0"], info: [AZUL_MARINHO, "#EAF2FB"], cinza: ["#65758b", CINZA_CLARO] };

  return (
    <Caixa icon={Send} titulo="Vistorias e envio para a construtora"
      acoes={<button type="button" style={btnLeve} onClick={carregar}><RefreshCcw size={14} className={carregando ? "spin" : ""} /> Atualizar</button>}>
      <p style={{ fontSize: 12.5, color: "#65758b", margin: "0 0 10px" }}>
        Vistorias agendadas daqui para a frente. Quando chega o prazo da construtora, o sistema junta num PDF único o contrato
        assinado, a ART do cliente (se houver), a carteira e o acervo do técnico, e envia sozinho. Se faltar algo, a Gerência
        recebe um e-mail com o que falta.
      </p>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {[["todas", "Todas"], ["pendentes", "Falta documento"], ["enviadas", "Enviadas"]].map(([k, r]) => (
          <button key={k} type="button" onClick={() => setFiltro(k)}
            style={{ ...btnLeve, padding: "4px 10px", fontSize: 12, ...(filtro === k ? { background: AZUL_MARINHO, color: "#fff", borderColor: AZUL_MARINHO } : {}) }}>{r}</button>
        ))}
      </div>
      {visiveis.length === 0 ? (
        <Aviso tom="ok">{carregando ? "Carregando…" : "Nenhuma vistoria neste filtro."}</Aviso>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead><tr>{["Vistoria", "Cliente", "Construtora", "Técnico", "Documentos", "Envio", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {visiveis.map((v) => {
                const r = rotuloEnvio(v);
                const [cor, fundo] = cores[r.tom];
                const podeEnviar = v.construtoraCadastrada && v.pendencias.length === 0;
                const podeVer = v.pendencias.every((p) => p.includes("e-mail cadastrado"));
                return (
                  <tr key={v.clienteId}>
                    <td style={{ ...td, whiteSpace: "nowrap" }}><strong>{dataBr(v.dataVistoria)}</strong>{v.horario ? <div style={{ fontSize: 12, color: "#65758b" }}>{v.horario}</div> : null}</td>
                    <td style={td}>{v.cliente}<div style={{ fontSize: 12, color: "#65758b" }}>{[v.empreendimento, v.unidade].filter(Boolean).join(" · ")}</div></td>
                    <td style={td}>{v.construtora || "—"}
                      <div style={{ fontSize: 11.5, color: v.construtoraCadastrada ? "#65758b" : AMBAR }}>
                        {v.construtoraCadastrada ? `${v.emails.join(", ")} · ${v.diasAntecedencia} dia(s) antes` : "sem e-mail cadastrado"}
                      </div>
                    </td>
                    <td style={td}>{v.tecnico || <span style={{ color: AMBAR }}>sem técnico</span>}</td>
                    <td style={{ ...td, fontSize: 12 }}>
                      <div>{v.contratoAssinado ? "✓ Contrato assinado" : <span style={{ color: VERMELHO }}>✗ Contrato não assinado</span>}</div>
                      <div>{!v.art ? <span style={{ color: "#8593a8" }}>— Sem ART</span> : v.art.temArquivo ? `✓ ART ${v.art.numero}` : <span style={{ color: AMBAR }}>! ART {v.art.numero || ""} sem PDF</span>}</div>
                      <div>{v.credenciais?.faltando?.includes("carteira") ? <span style={{ color: VERMELHO }}>✗ Carteira</span> : "✓ Carteira"}</div>
                      <div>{v.credenciais?.faltando?.includes("acervo") ? <span style={{ color: VERMELHO }}>✗ Acervo</span> : "✓ Acervo"}</div>
                    </td>
                    <td style={td}>
                      <Pilula cor={cor} fundo={fundo}>{r.texto}</Pilula>
                      {v.pacote?.status === "erro" && v.pacote.erro && <div style={{ fontSize: 11.5, color: VERMELHO, marginTop: 4, maxWidth: 220 }}>{v.pacote.erro}</div>}
                    </td>
                    <td style={{ ...td, whiteSpace: "nowrap", textAlign: "right" }}>
                      <button type="button" style={{ ...btnLeve, padding: "4px 8px", fontSize: 12 }} disabled={!podeVer} title={podeVer ? "Ver o PDF que vai para a construtora" : v.pendencias.join(" ")}
                        onClick={() => abrirArquivo(token, `/api/documentacao-construtora/${v.clienteId}/previa`).catch((e) => notify(e.message))}><Eye size={13} /> PDF</button>{" "}
                      <button type="button" style={{ ...btn, padding: "4px 8px", fontSize: 12, opacity: podeEnviar ? 1 : 0.5 }} disabled={!podeEnviar || enviando === v.clienteId}
                        title={podeEnviar ? "" : v.pendencias.join(" ")} onClick={() => enviarAgora(v)}>
                        {enviando === v.clienteId ? <Loader2 size={13} className="spin" /> : <Send size={13} />} {v.pacote?.status === "enviado" ? "Reenviar" : "Enviar agora"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Caixa>
  );
}

function FormConstrutora({ inicial, sugestoes = [], diasPadrao = 3, salvando, onSalvar, onCancelar }) {
  const [f, setF] = useState({
    nome: inicial?.nome || "", emails: (inicial?.emails || []).join(", "),
    diasAntecedencia: String(inicial?.diasAntecedencia ?? diasPadrao), ativo: inicial?.ativo ?? true, observacoes: inicial?.observacoes || "",
  });
  const listaId = `sugestoes-construtora-${inicial?.id || "nova"}`;
  return (
    <div style={{ display: "grid", gap: 10, border: `1px solid ${CINZA_BORDA}`, borderRadius: 12, padding: 14, background: "#FAFBFD" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        <label><span style={lab}>Construtora (igual ao cadastro dos clientes)</span>
          <input style={inp} list={listaId} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Construtora Ábaco" />
          <datalist id={listaId}>{sugestoes.map((s) => <option key={s} value={s} />)}</datalist>
        </label>
        <label><span style={lab}>E-mails (separe por vírgula)</span>
          <input style={inp} value={f.emails} onChange={(e) => setF({ ...f, emails: e.target.value })} placeholder="obra@construtora.com, engenharia@construtora.com" />
        </label>
        <label><span style={lab}>Enviar quantos dias antes</span>
          <input style={inp} type="number" min="1" max="30" value={f.diasAntecedencia} onChange={(e) => setF({ ...f, diasAntecedencia: e.target.value })} />
        </label>
      </div>
      <label><span style={lab}>Observações (opcional)</span>
        <input style={inp} value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} placeholder="Ex.: falar com a engenharia da obra" />
      </label>
      {inicial && (
        <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={f.ativo} onChange={(e) => setF({ ...f, ativo: e.target.checked })} /> Envio automático ligado
        </label>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" style={btn} disabled={salvando} onClick={() => onSalvar(f)}>{salvando ? <Loader2 size={14} className="spin" /> : <Save size={14} />} Salvar</button>
        <button type="button" style={btnLeve} onClick={onCancelar}><X size={14} /> Cancelar</button>
      </div>
    </div>
  );
}

function CadastroConstrutoras({ token, apiFetch, notify, podeEditar }) {
  const [dados, setDados] = useState({ construtoras: [], semEmail: [], diasPadrao: 3 });
  const [editando, setEditando] = useState(null); // null | "nova" | id
  const [salvando, setSalvando] = useState(false);
  const carregar = async () => {
    try { setDados(await apiFetch("/api/construtoras-email", { token })); }
    catch (e) { notify(`Não foi possível carregar as construtoras: ${e.message}`); }
  };
  useEffect(() => { carregar(); }, []);

  const salvar = async (f, id) => {
    setSalvando(true);
    try {
      const body = { nome: f.nome, emails: f.emails, diasAntecedencia: f.diasAntecedencia, observacoes: f.observacoes, ...(id ? { ativo: f.ativo } : {}) };
      await apiFetch(id ? `/api/construtoras-email/${id}` : "/api/construtoras-email", { method: id ? "PATCH" : "POST", token, body });
      notify("Construtora salva ✓");
      setEditando(null);
      carregar();
    } catch (e) { notify(e.message); }
    setSalvando(false);
  };
  const excluir = async (c) => {
    if (!window.confirm(`Tirar ${c.nome} da lista? A documentação deixa de ir para os e-mails dela.`)) return;
    try { await apiFetch(`/api/construtoras-email/${c.id}`, { method: "DELETE", token }); notify("Construtora removida"); carregar(); }
    catch (e) { notify(e.message); }
  };

  return (
    <Caixa icon={Building2} titulo="E-mails das construtoras"
      acoes={podeEditar && editando !== "nova" && <button type="button" style={btn} onClick={() => setEditando("nova")}><Plus size={14} /> Cadastrar construtora</button>}>
      <p style={{ fontSize: 12.5, color: "#65758b", margin: "0 0 10px" }}>
        Para onde vai a documentação da vistoria e com quantos dias de antecedência. O nome precisa ser o mesmo que aparece no
        cadastro dos clientes (maiúsculas e acentos não importam).
      </p>
      {editando === "nova" && (
        <div style={{ marginBottom: 12 }}>
          <FormConstrutora sugestoes={dados.semEmail} diasPadrao={dados.diasPadrao} salvando={salvando} onSalvar={(f) => salvar(f)} onCancelar={() => setEditando(null)} />
        </div>
      )}
      {dados.construtoras.length === 0 ? (
        <Aviso tom="atencao">Nenhuma construtora cadastrada ainda. Sem e-mail cadastrado, nada é enviado.</Aviso>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {dados.construtoras.map((c) => editando === c.id ? (
            <FormConstrutora key={c.id} inicial={c} sugestoes={dados.semEmail} salvando={salvando} onSalvar={(f) => salvar(f, c.id)} onCancelar={() => setEditando(null)} />
          ) : (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: "10px 12px", opacity: c.ativo ? 1 : 0.6 }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 700, color: AZUL_MARINHO, fontSize: 13.5 }}>{c.nome} {!c.ativo && <Pilula cor="#65758b" fundo={CINZA_CLARO}>Envio desligado</Pilula>}</div>
                <div style={{ fontSize: 12.5, color: "#4a5a70" }}><Mail size={12} style={{ verticalAlign: "-2px" }} /> {c.emails.join(", ")}</div>
                {c.observacoes && <div style={{ fontSize: 12, color: "#8593a8" }}>{c.observacoes}</div>}
              </div>
              <Pilula cor={AZUL_MARINHO} fundo="#EAF2FB"><Clock size={11} style={{ verticalAlign: "-1px" }} /> {c.diasAntecedencia} dia(s) antes</Pilula>
              {podeEditar && (
                <>
                  <button type="button" style={{ ...btnLeve, padding: "4px 8px", fontSize: 12 }} onClick={() => setEditando(c.id)}>Editar</button>
                  <button type="button" style={{ ...btnLeve, padding: "4px 8px" }} title="Remover" onClick={() => excluir(c)}><Trash2 size={13} color={VERMELHO} /></button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      {dados.semEmail.length > 0 && (
        <div style={{ fontSize: 12, color: "#8593a8", marginTop: 10 }}>
          Construtoras dos cadastros ainda sem e-mail: {dados.semEmail.join(", ")}.
        </div>
      )}
    </Caixa>
  );
}

function DocumentosDosTecnicos({ token, apiFetch, notify, podeEditar }) {
  const [tecnicos, setTecnicos] = useState([]);
  const [aberto, setAberto] = useState(null);
  const carregar = async () => {
    try { setTecnicos((await apiFetch("/api/credenciais-tecnico", { token })).tecnicos || []); }
    catch (e) { notify(`Não foi possível carregar os técnicos: ${e.message}`); }
  };
  useEffect(() => { carregar(); }, []);
  const ativos = useMemo(() => tecnicos.filter((t) => t.ativo), [tecnicos]);
  return (
    <Caixa icon={Users} titulo="Documentos dos técnicos">
      <p style={{ fontSize: 12.5, color: "#65758b", margin: "0 0 10px" }}>
        Cada técnico anexa a carteira e o acervo em "Meus documentos". Aqui a Gerência confere e, se precisar, anexa por ele.
      </p>
      {ativos.length === 0 ? <Aviso tom="atencao">Nenhum técnico ativo.</Aviso> : (
        <div style={{ display: "grid", gap: 8 }}>
          {ativos.map((t) => (
            <div key={t.id} style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", cursor: "pointer", flexWrap: "wrap" }} onClick={() => setAberto(aberto === t.id ? null : t.id)}>
                {aberto === t.id ? <ChevronDown size={15} color={AZUL_MEDIO} /> : <ChevronRight size={15} color={AZUL_MEDIO} />}
                <strong style={{ flex: 1, fontSize: 13.5, color: AZUL_MARINHO, minWidth: 140 }}>{t.nome}</strong>
                <SituacaoCredenciais situacao={t.situacao} />
              </div>
              {aberto === t.id && (
                <div style={{ padding: "0 12px 12px" }}>
                  <MeusDocumentosTecnico token={token} apiFetch={apiFetch} notify={notify} usuarioId={t.id} podeEditar={podeEditar} compacto aoMudar={carregar} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Caixa>
  );
}

export default function AbaConstrutoras({ token, apiFetch, notify, perfil }) {
  const podeEditar = perfil === "gerencia";
  return (
    <div>
      <PainelEnvios token={token} apiFetch={apiFetch} notify={notify} />
      <CadastroConstrutoras token={token} apiFetch={apiFetch} notify={notify} podeEditar={podeEditar} />
      <DocumentosDosTecnicos token={token} apiFetch={apiFetch} notify={notify} podeEditar={podeEditar} />
    </div>
  );
}
