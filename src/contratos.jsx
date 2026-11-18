/* ============================================================
   CONTRATOS — geração, assinatura e arquivo dos contratos de prestação de serviço
   ============================================================
   Arquivo à parte, como a Rede Nacional: o App.jsx só encaixa as telas e entrega o apiFetch (o único
   caminho para a API). Backend em src/contratos.js.

   - Equipe (Gerência e Atendimento): AbaContratos (lista, novo contrato, ficha, validação do GOV.BR,
     modelos e dados da FN) e SecaoContratosCliente (a seção "Contratos" da ficha do cliente).
   - Cliente: MeusContratos, no portal — ler, baixar e assinar (aqui na FN ou pelo GOV.BR).

   Quem pode o quê é decidido pelo servidor (campo "acoes" de cada contrato). A tela só mostra os
   botões que ele liberou; esconder não protege nada. */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FileSignature, FileText, Download, Eye, Plus, Search, RefreshCcw, X, Check, AlertTriangle, ShieldCheck, Loader2,
  ExternalLink, Upload, Eraser, History, Paperclip, Ban, Repeat, Send, Lock, Mail, Save, PenLine, Info, Settings, ScrollText,
} from "lucide-react";

const AZUL_MEDIO = "#2C75B5";
const AZUL_MARINHO = "#12335B";
const CINZA_CLARO = "#F1F4F8";
const CINZA_BORDA = "#D8DEE7";
const VERDE = "#1B7F4B";
const VERMELHO = "#C62828";
const AMBAR = "#B26A00";
const ROXO = "#6E36BE";

const LINK_ASSINADOR_GOVBR = "https://assinador.iti.br/";
const LINK_VALIDADOR_ITI = "https://validar.iti.gov.br/";
const LIMITE_PDF_BYTES = 7 * 1024 * 1024;
const ASPECTO_ASSINATURA = 3; // largura / altura do quadro de assinatura

const lab = { fontSize: 12, fontWeight: 600, color: "#5a6a80" };
const inp = { padding: "9px 11px", border: `1px solid ${CINZA_BORDA}`, borderRadius: 8, fontSize: 14, outline: "none", background: "#fff", fontFamily: "inherit", minWidth: 0, width: "100%" };
const btn = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 14px", borderRadius: 8, border: "none", background: AZUL_MEDIO, color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer", lineHeight: 1.25, textAlign: "center" };
const btnLeve = { ...btn, background: "#fff", color: AZUL_MARINHO, border: `1px solid ${CINZA_BORDA}`, fontWeight: 600 };
const btnPerigo = { ...btnLeve, color: VERMELHO, border: "1px solid #F2C4C4" };
const desligado = (b) => (b ? { opacity: 0.5, cursor: "default" } : {});

const COR_STATUS = {
  rascunho: ["#5a6a80", "#EEF1F5"],
  aguardando_assinatura: [AMBAR, "#FFF4E0"],
  em_assinatura_fn: [AZUL_MEDIO, "#EAF2FB"],
  aguardando_govbr: [AZUL_MEDIO, "#EAF2FB"],
  documento_recebido: [ROXO, "#F1EAFB"],
  aguardando_validacao: [ROXO, "#F1EAFB"],
  assinado: [VERDE, "#E6F4EC"],
  rejeitado: [VERMELHO, "#FDECEC"],
  cancelado: ["#5a6a80", "#EEF1F5"],
  substituido: ["#5a6a80", "#EEF1F5"],
};
const ROTULO_STATUS = {
  rascunho: "Rascunho", aguardando_assinatura: "Aguardando assinatura", em_assinatura_fn: "Em processo de assinatura FN",
  aguardando_govbr: "Aguardando retorno GOV.BR", documento_recebido: "Documento recebido", aguardando_validacao: "Aguardando validação",
  assinado: "Assinado", rejeitado: "Rejeitado", cancelado: "Cancelado", substituido: "Substituído",
};
const ORDEM_STATUS = Object.keys(ROTULO_STATUS);
const ROTULO_EVENTO = {
  criado: "Contrato gerado", editado: "Dados conferidos ou alterados", liberado: "Liberado para assinatura",
  visualizado: "Cliente abriu o contrato", original_baixado: "PDF do contrato baixado", assinado_baixado: "PDF assinado baixado",
  arquivo_baixado: "Arquivo baixado pela equipe", modalidade_escolhida: "Modalidade de assinatura escolhida",
  codigo_enviado: "Código de confirmação enviado por e-mail", assinado_fn: "Assinado na plataforma FN",
  falha_assinatura: "Tentativa de assinatura não concluída", govbr_recebido: "PDF assinado pelo GOV.BR recebido",
  triagem_automatica: "Triagem automática: assinatura digital encontrada", validacao_aprovada: "Assinatura GOV.BR validada e aprovada",
  validacao_rejeitada: "Documento do GOV.BR recusado", cancelado: "Contrato cancelado", substituido: "Contrato substituído",
};
const ROTULO_ARQUIVO = {
  original: "PDF original (o que vai para assinatura)", assinado_fn: "PDF assinado na plataforma FN",
  assinatura_png: "Imagem da assinatura desenhada", evidencias: "Evidências da assinatura (JSON)",
  govbr_enviado: "PDF enviado pelo cliente (GOV.BR)", relatorio_iti: "Relatório do validador do ITI",
};
const ROTULO_PAPEL = { gerencia: "Gerência", atendimento: "Atendimento", cliente: "Cliente" };
const GRUPOS_CAMPOS = [
  ["Contratante", ["contratante.nome", "contratante.documento", "contratante.email", "contratante.telefone", "contratante.endereco"]],
  ["Imóvel", ["imovel.empreendimento", "imovel.construtora", "imovel.unidade", "imovel.endereco"]],
  ["Serviço", ["servico.nome", "servico.descricao", "servico.prazo"]],
  ["Pagamento", ["pagamento.valor", "pagamento.forma", "pagamento.condicoes"]],
  ["Condições adicionais", ["clausulas.adicionais"]],
];

const dataHora = (v) => (v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const data = (v) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");
const tamanho = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round((b || 0) / 1024))} KB`);
const hashCurto = (h) => (h ? `${h.slice(0, 10)}…${h.slice(-6)}` : "—");
const brl = (v) => (v === null || v === undefined || v === "" ? "" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));

/* ---------------- arquivos protegidos pelo login ---------------- */
/* O apiFetch lê JSON; PDF vem em binário, com o mesmo token. */
async function buscarBinario({ apiUrl, token, caminho, method = "GET", body }) {
  let resp;
  try {
    resp = await fetch(`${apiUrl}${caminho}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout?.(90000),
    });
  } catch {
    throw new Error("Não foi possível falar com o sistema agora. Tente de novo em instantes.");
  }
  if (!resp.ok) {
    let dados = null;
    try { dados = await resp.json(); } catch { /* corpo não-JSON */ }
    throw new Error(dados?.erro || (resp.status >= 500 ? "O sistema não respondeu como deveria. Tente de novo em instantes." : `Erro ${resp.status}`));
  }
  return resp.blob();
}
/* A aba abre ANTES do download: aberta depois de um await, o navegador trata como pop-up. */
async function abrirPdf(obterBlob) {
  const janela = window.open("", "_blank");
  try {
    const url = URL.createObjectURL(await obterBlob());
    if (janela) janela.location.href = url; else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  } catch (e) {
    janela?.close();
    throw e;
  }
}
async function salvarArquivo(obterBlob, nome) {
  const url = URL.createObjectURL(await obterBlob());
  const a = document.createElement("a");
  a.href = url; a.download = nome; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 120000);
}
const lerComoDataUrl = (arquivo) => new Promise((resolver, rejeitar) => {
  const leitor = new FileReader();
  leitor.onload = () => resolver(leitor.result);
  leitor.onerror = () => rejeitar(new Error("Não foi possível ler o arquivo."));
  leitor.readAsDataURL(arquivo);
});

/* ---------------- peças visuais ---------------- */
const ESTILOS = `
  .fnc-raiz, .fnc-raiz *, .fnc-fundo, .fnc-fundo * { box-sizing: border-box; }
  .fnc-fundo { position: fixed; inset: 0; background: rgba(10, 25, 45, .5); z-index: 60; display: flex; align-items: flex-start; justify-content: center; padding: 24px 12px; overflow-y: auto; }
  .fnc-modal { background: #fff; border-radius: 14px; width: 100%; box-shadow: 0 12px 40px rgba(0,0,0,.25); position: relative; }
  .fnc-modal-topo { position: sticky; top: 0; background: #fff; z-index: 2; display: flex; align-items: center; gap: 10px; padding: 14px 18px; border-bottom: 1px solid ${CINZA_BORDA}; border-radius: 14px 14px 0 0; }
  .fnc-modal-corpo { padding: 16px 18px 20px; }
  .fnc-acoes { display: flex; gap: 8px; flex-wrap: wrap; }
  .fnc-grade { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
  .fnc-texto-contrato { font-size: 14.5px; line-height: 1.6; color: #1a2330; }
  .fnc-opcoes { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .fnc-linha { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .fnc-tabela { width: 100%; border-collapse: collapse; font-size: 13px; }
  .fnc-tabela th { text-align: left; font-size: 11.5px; color: #5a6a80; padding: 8px; border-bottom: 1px solid ${CINZA_BORDA}; white-space: nowrap; }
  .fnc-tabela td { padding: 9px 8px; border-bottom: 1px solid ${CINZA_CLARO}; vertical-align: top; }
  .fnc-spin { animation: fnc-gira 1s linear infinite; }
  @keyframes fnc-gira { to { transform: rotate(360deg); } }
  @media (max-width: 640px) {
    .fnc-fundo { padding: 0; }
    .fnc-modal { border-radius: 0; min-height: 100dvh; }
    .fnc-modal-topo { border-radius: 0; }
    .fnc-opcoes { grid-template-columns: 1fr; }
    .fnc-acoes > * { flex: 1 1 100%; }
    .fnc-esconde-celular { display: none; }
  }
`;
function Estilos() { return <style>{ESTILOS}</style>; }

function Modal({ titulo, subtitulo, largura = 760, onFechar, children }) {
  /* onFechar chega como função nova a cada render; pela ref, o efeito roda uma vez só. */
  const fecharRef = useRef(onFechar);
  fecharRef.current = onFechar;
  useEffect(() => {
    const tecla = (e) => { if (e.key === "Escape") fecharRef.current?.(); };
    window.addEventListener("keydown", tecla);
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", tecla); document.body.style.overflow = anterior; };
  }, []);
  return (
    <div className="fnc-fundo no-print" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar?.(); }}>
      <div className="fnc-modal" style={{ maxWidth: largura }} role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="fnc-modal-topo">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: AZUL_MARINHO, fontSize: 15.5 }}>{titulo}</div>
            {subtitulo && <div style={{ fontSize: 12.5, color: "#65758b", marginTop: 2 }}>{subtitulo}</div>}
          </div>
          <button onClick={onFechar} aria-label="Fechar" style={{ ...btnLeve, padding: 8 }}><X size={16} /></button>
        </div>
        <div className="fnc-modal-corpo">{children}</div>
      </div>
    </div>
  );
}

function Selo({ status, rotulo }) {
  const [cor, fundo] = COR_STATUS[status] || ["#5a6a80", "#EEF1F5"];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: fundo, color: cor, borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
      {status === "assinado" && <Check size={12} />}{rotulo || ROTULO_STATUS[status] || status}
    </span>
  );
}

function Aviso({ tipo = "info", children, style }) {
  const cores = {
    info: [AZUL_MARINHO, "#EAF2FB", Info], erro: [VERMELHO, "#FDECEC", AlertTriangle],
    alerta: [AMBAR, "#FFF4E0", AlertTriangle], ok: [VERDE, "#E6F4EC", ShieldCheck],
  };
  const [cor, fundo, Icone] = cores[tipo] || cores.info;
  return (
    <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: fundo, color: cor, borderRadius: 10, padding: "10px 12px", fontSize: 13.5, lineHeight: 1.45, ...style }}>
      <Icone size={17} style={{ flexShrink: 0, marginTop: 1 }} /><div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

function Caixa({ icon: Icone = FileText, titulo, acoes, children, style }) {
  return (
    <section style={{ background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 14, padding: 18, minWidth: 0, ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: CINZA_CLARO, display: "grid", placeItems: "center" }}><Icone size={16} color={AZUL_MEDIO} /></div>
        <h3 style={{ margin: 0, fontSize: 15, color: AZUL_MARINHO, flex: 1, minWidth: 160 }}>{titulo}</h3>
        {acoes}
      </div>
      {children}
    </section>
  );
}

function Girando({ texto = "Carregando…" }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#8593a8", fontSize: 14, padding: "6px 0" }}><Loader2 size={16} className="fnc-spin" /> {texto}</div>;
}

/* O mesmo texto do PDF, em blocos — o cliente lê no celular exatamente o que está no arquivo. */
function TextoDoContrato({ blocos = [] }) {
  return (
    <div className="fnc-texto-contrato">
      {blocos.map((b, i) => {
        const partes = (b.segmentos || []).map((s, j) => (
          /* Sem negrito marcado, herda o peso do bloco: o título e as seções são negrito inteiros, como no PDF. */
          <span key={j} style={{ fontWeight: s.negrito ? 700 : undefined, color: s.faltando ? VERMELHO : undefined, background: s.faltando ? "#FDECEC" : undefined }}>{s.texto}</span>
        ));
        if (b.tipo === "titulo") return <h3 key={i} style={{ textAlign: "center", color: AZUL_MARINHO, fontSize: 17, margin: "4px 0 14px", lineHeight: 1.35 }}>{partes}</h3>;
        if (b.tipo === "secao") return <h4 key={i} style={{ color: AZUL_MARINHO, fontSize: 14.5, margin: "18px 0 6px" }}>{partes}</h4>;
        if (b.tipo === "item") return <div key={i} style={{ display: "flex", gap: 8, margin: "0 0 6px 4px" }}><span style={{ color: AZUL_MEDIO }}>•</span><span>{partes}</span></div>;
        return <p key={i} style={{ margin: "0 0 10px", textAlign: "justify" }}>{partes}</p>;
      })}
    </div>
  );
}

/* ============================================================
   Campo de assinatura (canvas + Pointer Events)
   ============================================================
   Os traços ficam guardados normalizados (0..1 na caixa), então a assinatura se redesenha igual
   quando a tela gira ou muda de tamanho — e é essa geometria que o servidor redesenha no PDF.
   Só x e y: tempo e pressão do traço seriam dado biométrico sem necessidade (LGPD). */
function pontosDaAssinatura(tracos) { return tracos.reduce((n, t) => n + t.length, 0); }
function assinaturaSuficiente(tracos) {
  let pontos = 0; let comprimento = 0; let minX = 1; let maxX = 0;
  for (const t of tracos) {
    for (let i = 0; i < t.length; i++) {
      pontos++;
      minX = Math.min(minX, t[i][0]); maxX = Math.max(maxX, t[i][0]);
      if (i) comprimento += Math.hypot((t[i][0] - t[i - 1][0]) * ASPECTO_ASSINATURA, t[i][1] - t[i - 1][1]);
    }
  }
  return pontos >= 8 && comprimento >= 1.2 && (maxX - minX) * ASPECTO_ASSINATURA >= 0.6;
}
function desenhar(ctx, tracos, largura, altura, cor = "#0b2a52", espessura = 2.2) {
  ctx.clearRect(0, 0, largura, altura);
  ctx.strokeStyle = cor; ctx.fillStyle = cor; ctx.lineWidth = espessura; ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const t of tracos) {
    if (!t.length) continue;
    const p = t.map(([x, y]) => [x * largura, y * altura]);
    if (p.length === 1) { ctx.beginPath(); ctx.arc(p[0][0], p[0][1], espessura / 2, 0, Math.PI * 2); ctx.fill(); continue; }
    ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length - 1; i++) {
      ctx.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2);
    }
    ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
    ctx.stroke();
  }
}
/* PNG da assinatura para guardar como evidência visual: tamanho fixo, fundo transparente. */
function pngDosTracos(tracos) {
  const c = document.createElement("canvas");
  c.width = 900; c.height = 300;
  desenhar(c.getContext("2d"), tracos, 900, 300, "#0b2a52", 4);
  return c.toDataURL("image/png");
}

function CampoAssinatura({ tracos, onChange, desabilitado = false }) {
  const caixaRef = useRef(null);
  const canvasRef = useRef(null);
  const tracosRef = useRef(tracos);
  const desenhando = useRef(null);
  const [largura, setLargura] = useState(0);
  tracosRef.current = tracos;

  useEffect(() => {
    const caixa = caixaRef.current;
    if (!caixa) return undefined;
    const medir = () => setLargura(Math.floor(caixa.clientWidth));
    medir();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(medir) : null;
    ro?.observe(caixa);
    window.addEventListener("orientationchange", medir);
    return () => { ro?.disconnect(); window.removeEventListener("orientationchange", medir); };
  }, []);

  const altura = Math.max(110, Math.round(largura / ASPECTO_ASSINATURA));
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !largura) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    c.width = Math.round(largura * dpr); c.height = Math.round(altura * dpr);
    c.style.width = `${largura}px`; c.style.height = `${altura}px`;
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    desenhar(ctx, tracosRef.current, largura, altura);
  }, [largura, altura, tracos]);

  const ponto = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    return [Math.round(x * 10000) / 10000, Math.round(y * 10000) / 10000];
  };
  const inicio = (e) => {
    if (desabilitado) return;
    e.preventDefault();
    canvasRef.current.setPointerCapture?.(e.pointerId);
    desenhando.current = [ponto(e)];
    const ctx = canvasRef.current.getContext("2d");
    desenhar(ctx, [...tracosRef.current, desenhando.current], largura, altura);
  };
  const mover = (e) => {
    if (!desenhando.current) return;
    e.preventDefault();
    const p = ponto(e);
    const ultimo = desenhando.current[desenhando.current.length - 1];
    // Só guarda o ponto que andou ~1,5 px: mantém o traço liso e a assinatura leve.
    if (Math.hypot((p[0] - ultimo[0]) * largura, (p[1] - ultimo[1]) * altura) < 1.5) return;
    desenhando.current.push(p);
    const ctx = canvasRef.current.getContext("2d");
    desenhar(ctx, [...tracosRef.current, desenhando.current], largura, altura);
  };
  const fim = () => {
    if (!desenhando.current) return;
    const novo = desenhando.current;
    desenhando.current = null;
    if (pontosDaAssinatura(tracosRef.current) + novo.length > 6000) return; // limite do servidor
    onChange([...tracosRef.current, novo]);
  };
  const vazio = !tracos.length;

  return (
    <div>
      <div ref={caixaRef} style={{ position: "relative", width: "100%", border: `1.5px dashed ${desabilitado ? CINZA_BORDA : AZUL_MEDIO}`, borderRadius: 12, background: desabilitado ? CINZA_CLARO : "#fff", overflow: "hidden" }}>
        <canvas ref={canvasRef}
          onPointerDown={inicio} onPointerMove={mover} onPointerUp={fim} onPointerCancel={fim} onLostPointerCapture={fim}
          style={{ display: "block", touchAction: "none", cursor: desabilitado ? "not-allowed" : "crosshair", width: largura || "100%", height: altura }}
          aria-label="Quadro de assinatura: desenhe sua assinatura com o dedo ou o mouse" role="img" />
        <div style={{ position: "absolute", left: "8%", right: "8%", bottom: Math.round(altura * 0.22), borderBottom: "1px solid #c2cad6", pointerEvents: "none" }} />
        {vazio && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none", color: "#a0abbb", fontSize: 14, textAlign: "center", padding: 10 }}>
            <span><PenLine size={16} style={{ verticalAlign: "-3px" }} /> {desabilitado ? "Leia o contrato até o fim para assinar" : "Assine aqui com o dedo ou o mouse"}</span>
          </div>
        )}
      </div>
      <div className="fnc-linha" style={{ marginTop: 8, justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: "#8593a8" }}>A assinatura desenhada aparece no contrato, mas quem confirma sua identidade é o login e o código enviado ao seu e-mail.</span>
        <button type="button" onClick={() => onChange([])} disabled={vazio} style={{ ...btnLeve, ...desligado(vazio) }}><Eraser size={15} /> Limpar assinatura</button>
      </div>
    </div>
  );
}

/* ============================================================
   PORTAL DO CLIENTE — Meus contratos
   ============================================================ */
export function MeusContratos({ token, apiFetch, apiUrl, notify, usuario }) {
  const [lista, setLista] = useState(null);
  const [aberto, setAberto] = useState(null); // { id, modo: "ler" | "escolher" | "fn" | "govbr" }
  const carregar = async () => {
    try {
      const r = await apiFetch("/api/meus-contratos", { token });
      setLista(r.contratos || []);
    } catch { setLista((atual) => atual || []); }
  };
  useEffect(() => { carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const baixar = (c, tipo) => salvarArquivo(
    () => buscarBinario({ apiUrl, token, caminho: `/api/meus-contratos/${c.id}/pdf?tipo=${tipo}` }),
    `${c.numero}${tipo === "assinado" ? "-assinado" : ""}.pdf`,
  ).catch((e) => notify(e.message));

  /* O botão "Assinar" leva ao caminho em que o contrato está: sem escolha, pergunta; escolhido, vai direto. */
  const abrirAssinatura = (c) => {
    if (c.status === "em_assinatura_fn") return setAberto({ id: c.id, modo: "fn" });
    if (["aguardando_govbr", "documento_recebido", "aguardando_validacao"].includes(c.status)) return setAberto({ id: c.id, modo: "govbr" });
    if (c.status === "rejeitado" && c.modalidade === "govbr") return setAberto({ id: c.id, modo: "govbr" });
    return setAberto({ id: c.id, modo: "escolher" });
  };

  if (lista === null || lista.length === 0) return null; // sem contrato, o portal fica como sempre foi
  const pendentes = lista.filter((c) => ["aguardando_assinatura", "em_assinatura_fn", "aguardando_govbr", "rejeitado"].includes(c.status));

  return (
    <div id="meus-contratos" className="fnc-raiz" style={{ display: "grid", minWidth: 0, scrollMarginTop: 90 }}>
      <Estilos />
      <Caixa icon={FileSignature} titulo="Meus contratos">
        {pendentes.length > 0 && (
          <Aviso tipo="alerta" style={{ marginBottom: 12 }}>
            <strong>{pendentes.length === 1 ? "Você tem 1 contrato aguardando assinatura." : `Você tem ${pendentes.length} contratos aguardando assinatura.`}</strong>{" "}
            Leia e assine pelo celular ou computador — aqui mesmo, ou pelo GOV.BR, se preferir.
          </Aviso>
        )}
        <div style={{ display: "grid", gap: 10 }}>
          {lista.map((c) => (
            <div key={c.id} style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: AZUL_MARINHO, fontSize: 14.5 }}>Contrato {c.numero}</div>
                  <div style={{ fontSize: 13, color: "#4a5a70" }}>{c.servico || "Prestação de serviços"} · emitido em {data(c.emitidoEm)}</div>
                </div>
                <Selo status={c.status} rotulo={c.rotuloStatus} />
              </div>

              {c.status === "assinado" && (
                <div style={{ fontSize: 12.5, color: VERDE, marginTop: 8 }}>
                  ✓ Assinado em {dataHora(c.assinadoEm)}{c.modalidade === "govbr" ? " pelo GOV.BR (validado pela FN)" : " na plataforma FN"} ·{" "}
                  <span title={c.hashFinal}>código de integridade {hashCurto(c.hashFinal)}</span>
                </div>
              )}
              {["documento_recebido", "aguardando_validacao"].includes(c.status) && (
                <div style={{ fontSize: 12.5, color: ROXO, marginTop: 8 }}>Recebemos seu PDF assinado em {dataHora(c.govbrRecebidoEm)}. A equipe da FN vai conferir a assinatura no validador oficial do ITI.</div>
              )}
              {c.status === "rejeitado" && c.motivo && <Aviso tipo="erro" style={{ marginTop: 8 }}>Documento recusado: {c.motivo}</Aviso>}
              {c.status === "substituido" && <div style={{ fontSize: 12.5, color: "#65758b", marginTop: 8 }}>Este contrato foi substituído por uma versão corrigida.{c.motivo ? ` Motivo: ${c.motivo}` : ""}</div>}
              {c.status === "cancelado" && <div style={{ fontSize: 12.5, color: "#65758b", marginTop: 8 }}>Contrato cancelado.{c.motivo ? ` Motivo: ${c.motivo}` : ""}</div>}

              <div className="fnc-acoes" style={{ marginTop: 12 }}>
                {(c.acoes.assinarFn || c.acoes.enviarGovbr || c.acoes.escolherModalidade) && (
                  <button style={btn} onClick={() => abrirAssinatura(c)}><PenLine size={15} /> {c.status === "rejeitado" ? "Enviar de novo / assinar" : "Assinar contrato"}</button>
                )}
                {c.acoes.visualizar && <button style={btnLeve} onClick={() => setAberto({ id: c.id, modo: "ler" })}><Eye size={15} /> Visualizar</button>}
                {c.acoes.baixarAssinado && <button style={btnLeve} onClick={() => baixar(c, "assinado")}><Download size={15} /> Baixar contrato assinado</button>}
                {c.acoes.baixarOriginal && !c.acoes.baixarAssinado && <button style={btnLeve} onClick={() => baixar(c, "original")}><Download size={15} /> Baixar PDF</button>}
              </div>
            </div>
          ))}
        </div>
      </Caixa>

      {aberto && (
        <ContratoDoCliente id={aberto.id} modoInicial={aberto.modo} token={token} apiFetch={apiFetch} apiUrl={apiUrl} usuario={usuario}
          notify={notify} onFechar={() => setAberto(null)} onMudou={carregar} />
      )}
    </div>
  );
}

function ContratoDoCliente({ id, modoInicial, token, apiFetch, apiUrl, usuario, notify, onFechar, onMudou }) {
  const [c, setC] = useState(null);
  const [erro, setErro] = useState("");
  const [modo, setModo] = useState(modoInicial);
  const [escolhendo, setEscolhendo] = useState(false);

  const carregar = async () => {
    try {
      const r = await apiFetch(`/api/meus-contratos/${id}`, { token });
      setC(r.contrato);
      return r.contrato;
    } catch (e) { setErro(e.message); return null; }
  };
  useEffect(() => { carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const escolher = async (modalidade) => {
    setEscolhendo(true); setErro("");
    try {
      const r = await apiFetch(`/api/meus-contratos/${id}/modalidade`, { method: "POST", token, body: { modalidade } });
      setC(r.contrato);
      setModo(modalidade);
      onMudou();
    } catch (e) { setErro(e.message); }
    setEscolhendo(false);
  };
  const baixarOriginal = () => salvarArquivo(() => buscarBinario({ apiUrl, token, caminho: `/api/meus-contratos/${id}/pdf` }), `${c?.numero || "contrato"}.pdf`)
    .catch((e) => notify(e.message));
  const baixarAssinado = () => salvarArquivo(() => buscarBinario({ apiUrl, token, caminho: `/api/meus-contratos/${id}/pdf?tipo=assinado` }), `${c?.numero || "contrato"}-assinado.pdf`)
    .catch((e) => notify(e.message));

  const titulo = c ? `Contrato ${c.numero}` : "Contrato";
  return (
    <Modal titulo={titulo} subtitulo={c ? `${c.servico || "Prestação de serviços"} · ${c.rotuloStatus}` : ""} onFechar={onFechar} largura={modo === "ler" ? 820 : 760}>
      {!c && !erro && <Girando />}
      {erro && <Aviso tipo="erro" style={{ marginBottom: 12 }}>{erro}</Aviso>}
      {c && modo === "ler" && (
        <div>
          <div className="fnc-acoes" style={{ marginBottom: 12 }}>
            <button style={btnLeve} onClick={baixarOriginal}><Download size={15} /> Baixar PDF</button>
            {c.acoes.baixarAssinado && <button style={btnLeve} onClick={baixarAssinado}><Download size={15} /> Baixar contrato assinado</button>}
            {(c.acoes.assinarFn || c.acoes.enviarGovbr || c.acoes.escolherModalidade) && (
              <button style={btn} onClick={() => setModo(c.status === "em_assinatura_fn" ? "fn" : (c.modalidade === "govbr" && c.acoes.enviarGovbr) ? "govbr" : "escolher")}><PenLine size={15} /> Assinar contrato</button>
            )}
          </div>
          {c.status === "assinado" && (
            <Aviso tipo="ok" style={{ marginBottom: 12 }}>
              Assinado em {dataHora(c.assinadoEm)}{c.modalidade === "govbr" ? " pelo GOV.BR, com validação da FN" : " na plataforma FN"}.
              Código de integridade (SHA-256) do arquivo assinado: <code style={{ wordBreak: "break-all" }}>{c.hashFinal}</code>
            </Aviso>
          )}
          <div style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 12, padding: "16px 18px", background: "#fcfdfe" }}>
            <TextoDoContrato blocos={c.conteudo} />
          </div>
        </div>
      )}
      {c && modo === "escolher" && (
        <EscolhaDeModalidade contrato={c} escolhendo={escolhendo} onEscolher={escolher} />
      )}
      {c && modo === "fn" && (
        <AssinaturaNaFn contrato={c} token={token} apiFetch={apiFetch} usuario={usuario} onBaixar={baixarOriginal} onBaixarAssinado={baixarAssinado}
          onAssinado={(novo) => { setC(novo); onMudou(); }}
          onTrocar={c.acoes.escolherModalidade ? () => escolher("govbr") : null} />
      )}
      {c && modo === "govbr" && (
        <AssinaturaGovbr contrato={c} token={token} apiFetch={apiFetch} onBaixar={baixarOriginal} onBaixarAssinado={baixarAssinado}
          onEnviado={(novo) => { setC(novo); onMudou(); }}
          onTrocar={c.acoes.escolherModalidade ? () => escolher("fn") : null} />
      )}
    </Modal>
  );
}

function EscolhaDeModalidade({ contrato, escolhendo, onEscolher }) {
  const cartao = (modalidade, numero, titulo, Icone, texto, itens) => (
    <button type="button" disabled={escolhendo} onClick={() => onEscolher(modalidade)}
      style={{ textAlign: "left", border: `1.5px solid ${contrato.modalidade === modalidade ? AZUL_MEDIO : CINZA_BORDA}`, borderRadius: 14, padding: 16, background: "#fff", cursor: escolhendo ? "default" : "pointer", display: "grid", gap: 8, fontFamily: "inherit" }}>
      <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 0.5, color: AZUL_MEDIO }}>OPÇÃO {numero}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, color: AZUL_MARINHO, fontSize: 16 }}><Icone size={20} /> {titulo}</span>
      <span style={{ fontSize: 13.5, color: "#4a5a70", lineHeight: 1.45 }}>{texto}</span>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "#65758b", lineHeight: 1.5 }}>{itens.map((i) => <li key={i}>{i}</li>)}</ul>
    </button>
  );
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ fontSize: 14, color: "#33445a" }}>Como você prefere assinar o contrato <strong>{contrato.numero}</strong>? As duas formas são gratuitas.</div>
      {contrato.status === "rejeitado" && contrato.motivo && <Aviso tipo="erro">O documento enviado foi recusado: {contrato.motivo}</Aviso>}
      <div className="fnc-opcoes">
        {cartao("fn", 1, "ASSINAR AQUI NA FN", PenLine, "Leia o contrato, desenhe sua assinatura na tela e confirme com um código enviado ao seu e-mail.",
          ["Funciona no celular e no computador", "Leva poucos minutos", "O contrato assinado fica aqui no portal"])}
        {cartao("govbr", 2, "ASSINAR COM GOV.BR", ShieldCheck, "Assinatura digital gratuita do governo federal, com a sua conta GOV.BR.",
          ["Precisa de conta GOV.BR nível prata ou ouro", "Você baixa o PDF, assina no site do GOV.BR e envia de volta", "A FN confere a assinatura no validador oficial"])}
      </div>
      {escolhendo && <Girando texto="Registrando a sua escolha…" />}
    </div>
  );
}

/* ---------------- Opção 1: assinar aqui na FN ---------------- */
function AssinaturaNaFn({ contrato, token, apiFetch, usuario, onBaixar, onBaixarAssinado, onAssinado, onTrocar }) {
  const [leuAteOFim, setLeuAteOFim] = useState(false);
  const [tracos, setTracos] = useState([]);
  const [aceite, setAceite] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [envioCodigo, setEnvioCodigo] = useState(null); // { email, expiraEm }
  const [enviandoCodigo, setEnviandoCodigo] = useState(false);
  const [podeReenviarEm, setPodeReenviarEm] = useState(0);
  const [agora, setAgora] = useState(Date.now());
  const [assinando, setAssinando] = useState(false);
  const [erro, setErro] = useState("");
  const fimRef = useRef(null);
  const caixaTextoRef = useRef(null);

  /* "Li até o fim" é a pessoa ter rolado o texto até a última linha — e vira evidência. */
  useEffect(() => {
    const alvo = fimRef.current;
    if (!alvo) return undefined;
    if (typeof IntersectionObserver === "undefined") { setLeuAteOFim(true); return undefined; }
    const io = new IntersectionObserver((itens) => { if (itens.some((i) => i.isIntersecting)) setLeuAteOFim(true); }, { root: caixaTextoRef.current, threshold: 0.1 });
    io.observe(alvo);
    return () => io.disconnect();
  }, [contrato.id]);
  useEffect(() => {
    if (!podeReenviarEm) return undefined;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [podeReenviarEm]);

  if (contrato.status === "assinado") {
    return (
      <div style={{ display: "grid", gap: 12, textAlign: "center", padding: "10px 0" }}>
        <div style={{ width: 56, height: 56, borderRadius: 28, background: "#E6F4EC", display: "grid", placeItems: "center", margin: "0 auto" }}><Check size={30} color={VERDE} /></div>
        <div style={{ fontWeight: 800, fontSize: 18, color: AZUL_MARINHO }}>Contrato assinado!</div>
        <div style={{ fontSize: 14, color: "#4a5a70" }}>Sua assinatura do contrato {contrato.numero} foi registrada em {dataHora(contrato.assinadoEm)}. Enviamos uma confirmação para o seu e-mail.</div>
        <div style={{ fontSize: 12.5, color: "#65758b" }}>Código de integridade (SHA-256) do arquivo assinado:<br /><code style={{ wordBreak: "break-all" }}>{contrato.hashFinal}</code></div>
        <div><button style={btn} onClick={onBaixarAssinado}><Download size={15} /> Baixar contrato assinado</button></div>
      </div>
    );
  }

  const assinaturaOk = assinaturaSuficiente(tracos);
  const exigeCodigo = contrato.exigeCodigo !== false;
  const codigoOk = !exigeCodigo || /^\d{6}$/.test(codigo);
  const pendencias = [
    !leuAteOFim && "Role o contrato até o fim",
    !tracos.length ? "Desenhe sua assinatura" : !assinaturaOk && "A assinatura ficou muito pequena — assine ocupando melhor o quadro",
    !aceite && "Marque a declaração de concordância",
    exigeCodigo && !envioCodigo && "Peça o código de confirmação no seu e-mail",
    exigeCodigo && envioCodigo && !codigoOk && "Digite os 6 números do código",
  ].filter(Boolean);
  const segundosParaReenviar = Math.max(0, Math.ceil((podeReenviarEm - agora) / 1000));

  const pedirCodigo = async () => {
    setEnviandoCodigo(true); setErro("");
    try {
      const r = await apiFetch(`/api/meus-contratos/${contrato.id}/codigo`, { method: "POST", token });
      if (r.exigeCodigo === false) setEnvioCodigo({ email: "", expiraEm: null });
      else setEnvioCodigo({ email: r.email, expiraEm: r.expiraEm });
      setPodeReenviarEm(Date.now() + 45000);
      setCodigo("");
    } catch (e) { setErro(e.message); }
    setEnviandoCodigo(false);
  };

  const assinar = async () => {
    if (pendencias.length || assinando) return;
    setAssinando(true); setErro("");
    try {
      const r = await apiFetch(`/api/meus-contratos/${contrato.id}/assinar`, {
        method: "POST", token,
        body: {
          aceite: true, versaoAceite: contrato.versaoAceite, hashDocumento: contrato.hashDocumento, codigo,
          tracos, aspecto: ASPECTO_ASSINATURA, imagemPng: pngDosTracos(tracos), leuAteOFim,
          dispositivo: {
            fuso: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
            tela: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
            idioma: navigator.language || "",
          },
        },
      });
      onAssinado(r.contrato);
    } catch (e) {
      setErro(e.message);
    }
    setAssinando(false);
  };

  const etapa = (n, titulo, feito) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "18px 0 8px" }}>
      <span style={{ width: 24, height: 24, borderRadius: 12, background: feito ? VERDE : AZUL_MARINHO, color: "#fff", display: "grid", placeItems: "center", fontSize: 12.5, fontWeight: 800 }}>{feito ? <Check size={14} /> : n}</span>
      <strong style={{ color: AZUL_MARINHO, fontSize: 14.5 }}>{titulo}</strong>
    </div>
  );

  return (
    <div>
      <Aviso tipo="info">
        Você está assinando como <strong>{usuario?.nome || contrato.contratante?.nome}</strong>{usuario?.email ? <> ({usuario.email})</> : null}, conectado(a) à sua Área do Cliente.
        {onTrocar && <> Prefere o GOV.BR? <button type="button" onClick={onTrocar} style={{ background: "none", border: "none", color: AZUL_MEDIO, fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 13.5 }}>Assinar com GOV.BR</button></>}
      </Aviso>

      {etapa(1, "Leia o contrato", leuAteOFim)}
      <div ref={caixaTextoRef} style={{ maxHeight: "52vh", overflowY: "auto", border: `1px solid ${CINZA_BORDA}`, borderRadius: 12, padding: "14px 16px", background: "#fcfdfe" }} tabIndex={0} aria-label="Texto do contrato">
        <TextoDoContrato blocos={contrato.conteudo} />
        <div ref={fimRef} style={{ fontSize: 12, color: "#8593a8", textAlign: "center", padding: "8px 0 2px" }}>— fim do contrato —</div>
      </div>
      <div className="fnc-linha" style={{ marginTop: 8, justifyContent: "space-between" }}>
        <span style={{ fontSize: 12.5, color: leuAteOFim ? VERDE : AMBAR }}>{leuAteOFim ? "✓ Você leu o contrato até o fim." : "Role o texto até o fim para continuar."}</span>
        <button style={btnLeve} onClick={onBaixar}><Download size={15} /> Baixar PDF</button>
      </div>

      {etapa(2, "Desenhe sua assinatura", assinaturaOk)}
      <CampoAssinatura tracos={tracos} onChange={setTracos} desabilitado={!leuAteOFim} />

      {etapa(3, "Confirme", aceite && codigoOk && !!envioCodigo)}
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, lineHeight: 1.5, color: "#1a2330", cursor: leuAteOFim ? "pointer" : "not-allowed", background: CINZA_CLARO, borderRadius: 10, padding: "10px 12px" }}>
        <input type="checkbox" checked={aceite} disabled={!leuAteOFim} onChange={(e) => setAceite(e.target.checked)} style={{ width: 20, height: 20, marginTop: 1, flexShrink: 0 }} />
        <span>{contrato.textoAceite}</span>
      </label>

      {exigeCodigo && (
        <div style={{ marginTop: 12, border: `1px solid ${CINZA_BORDA}`, borderRadius: 12, padding: 12, display: "grid", gap: 10 }}>
          <div style={{ fontSize: 13.5, color: "#33445a" }}><Mail size={15} style={{ verticalAlign: "-3px" }} /> Para confirmar que é você, enviamos um código de 6 números para o e-mail da sua conta.</div>
          {!envioCodigo ? (
            <div><button style={{ ...btn, ...desligado(enviandoCodigo) }} disabled={enviandoCodigo} onClick={pedirCodigo}>{enviandoCodigo ? <Loader2 size={15} className="fnc-spin" /> : <Send size={15} />} Enviar código para meu e-mail</button></div>
          ) : (
            <>
              <div style={{ fontSize: 13, color: VERDE }}>✓ Código enviado{envioCodigo.email ? ` para ${envioCodigo.email}` : ""}. Ele vale por 10 minutos — confira também a caixa de spam.</div>
              <div className="fnc-linha">
                <input value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code"
                  placeholder="000000" aria-label="Código de confirmação" style={{ ...inp, width: 150, fontSize: 20, letterSpacing: 6, textAlign: "center", fontWeight: 700 }} />
                <button style={{ ...btnLeve, ...desligado(segundosParaReenviar > 0 || enviandoCodigo) }} disabled={segundosParaReenviar > 0 || enviandoCodigo} onClick={pedirCodigo}>
                  <RefreshCcw size={14} /> {segundosParaReenviar > 0 ? `Reenviar em ${segundosParaReenviar}s` : "Reenviar código"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {erro && <Aviso tipo="erro" style={{ marginTop: 12 }}>{erro}</Aviso>}
      {pendencias.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12.5, color: "#65758b" }}>
          Falta: {pendencias.join(" · ")}.
        </div>
      )}
      <button style={{ ...btn, width: "100%", marginTop: 12, padding: "13px 16px", fontSize: 15, ...desligado(pendencias.length > 0 || assinando) }}
        disabled={pendencias.length > 0 || assinando} onClick={assinar}>
        {assinando ? <Loader2 size={17} className="fnc-spin" /> : <Lock size={17} />} {assinando ? "Assinando…" : "Confirmar e assinar contrato"}
      </button>
      <p style={{ fontSize: 11.5, color: "#8593a8", margin: "10px 0 0", lineHeight: 1.45 }}>
        Ao confirmar, registramos a data e a hora, o endereço IP e o aparelho usado, junto com o código de integridade do contrato que você leu.
        Esta é uma assinatura eletrônica na plataforma da FN Edificações — não é assinatura digital com certificado ICP-Brasil.
      </p>
    </div>
  );
}

/* ---------------- Opção 2: assinar com GOV.BR ---------------- */
function AssinaturaGovbr({ contrato, token, apiFetch, onBaixar, onBaixarAssinado, onEnviado, onTrocar }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const inputRef = useRef(null);

  const enviar = async (arquivo) => {
    setErro(""); setOk("");
    if (!arquivo) return;
    if (!/pdf$/i.test(arquivo.type || "") && !/\.pdf$/i.test(arquivo.name || "")) { setErro("Escolha o arquivo PDF que o assinador do GOV.BR devolveu."); return; }
    if (arquivo.size > LIMITE_PDF_BYTES) { setErro("O arquivo passou de 7 MB. Envie só o PDF assinado do contrato."); return; }
    setEnviando(true);
    try {
      const dataUrl = await lerComoDataUrl(arquivo);
      const r = await apiFetch(`/api/meus-contratos/${contrato.id}/govbr`, { method: "POST", token, body: { nomeArquivo: arquivo.name, arquivoBase64: dataUrl } });
      onEnviado(r.contrato);
      setOk("Recebemos o seu contrato assinado. A equipe da FN vai conferir a assinatura no validador oficial do ITI e você acompanha a situação aqui.");
    } catch (e) { setErro(e.message); }
    setEnviando(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  if (contrato.status === "assinado") {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <Aviso tipo="ok">Contrato assinado pelo GOV.BR e validado pela FN em {dataHora(contrato.confirmadoEm)}.</Aviso>
        <div><button style={btn} onClick={onBaixarAssinado}><Download size={15} /> Baixar contrato assinado</button></div>
      </div>
    );
  }
  const emValidacao = ["documento_recebido", "aguardando_validacao"].includes(contrato.status);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ fontSize: 14, lineHeight: 1.6, color: "#1a2330" }}>
        <p style={{ margin: "0 0 8px" }}>Você escolheu assinar seu contrato gratuitamente pelo <strong>GOV.BR</strong>.</p>
        <p style={{ margin: "0 0 8px" }}>Para utilizar essa opção, é necessário possuir conta GOV.BR nível <strong>prata ou ouro</strong>.</p>
        <p style={{ margin: "0 0 6px" }}>Siga as etapas:</p>
        <ol style={{ margin: 0, paddingLeft: 22 }}>
          <li>Baixe seu contrato em PDF.</li>
          <li>Acesse o assinador eletrônico oficial do GOV.BR.</li>
          <li>Entre com sua conta.</li>
          <li>Envie o arquivo PDF para assinatura.</li>
          <li>Assine conforme as instruções.</li>
          <li>Baixe o PDF assinado.</li>
          <li>Retorne ao portal FN e envie o documento assinado.</li>
        </ol>
      </div>

      <div className="fnc-acoes">
        <button style={btnLeve} onClick={onBaixar}><Download size={15} /> Baixar meu contrato</button>
        <a href={LINK_ASSINADOR_GOVBR} target="_blank" rel="noopener noreferrer" style={{ ...btnLeve, textDecoration: "none" }}><ExternalLink size={15} /> Acessar GOV.BR</a>
        <button style={{ ...btn, ...desligado(enviando) }} disabled={enviando} onClick={() => inputRef.current?.click()}>
          {enviando ? <Loader2 size={15} className="fnc-spin" /> : <Upload size={15} />} {enviando ? "Enviando…" : emValidacao ? "Enviar outro arquivo" : "Enviar contrato assinado"}
        </button>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" style={{ display: "none" }} onChange={(e) => enviar(e.target.files?.[0])} />
      </div>

      <Aviso tipo="alerta">
        Envie o arquivo <strong>exatamente como o assinador do GOV.BR devolver</strong>. Não imprima, não "salve como PDF" de novo e não edite o arquivo — qualquer alteração faz a assinatura digital deixar de valer.
      </Aviso>
      {contrato.status === "rejeitado" && contrato.motivo && <Aviso tipo="erro">Seu documento anterior foi recusado: {contrato.motivo}. Envie o arquivo assinado de novo.</Aviso>}
      {emValidacao && !ok && <Aviso tipo="info">Recebemos seu PDF assinado em {dataHora(contrato.govbrRecebidoEm)}. A equipe da FN vai conferir a assinatura no validador oficial do ITI. Se enviou o arquivo errado, mande o certo — vale o último enviado.</Aviso>}
      {ok && <Aviso tipo="ok">{ok}</Aviso>}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {onTrocar && (
        <div style={{ fontSize: 13, color: "#65758b" }}>
          Não tem conta prata ou ouro? <button type="button" onClick={onTrocar} style={{ background: "none", border: "none", color: AZUL_MEDIO, fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 13 }}>Assinar aqui na FN</button>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   EQUIPE — Contratos (Gerência e Atendimento)
   ============================================================ */
export default function AbaContratos({ token, apiFetch, apiUrl, notify, perfil }) {
  const ehGerencia = perfil === "gerencia";
  const [sub, setSub] = useState("contratos");
  const abas = [["contratos", "Contratos", FileSignature], ...(ehGerencia ? [["modelos", "Modelos", ScrollText], ["contratada", "Dados da FN", Settings]] : [])];
  return (
    <div className="fnc-raiz" style={{ display: "grid", gap: 16, minWidth: 0 }}>
      <Estilos />
      {abas.length > 1 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {abas.map(([k, rotulo, Icone]) => (
            <button key={k} onClick={() => setSub(k)} style={{ ...btnLeve, ...(sub === k ? { background: AZUL_MARINHO, color: "#fff", border: `1px solid ${AZUL_MARINHO}` } : {}) }}>
              <Icone size={15} /> {rotulo}
            </button>
          ))}
        </div>
      )}
      {sub === "contratos" && <ListaDeContratos token={token} apiFetch={apiFetch} apiUrl={apiUrl} notify={notify} perfil={perfil} />}
      {sub === "modelos" && ehGerencia && <ModelosDeContrato token={token} apiFetch={apiFetch} apiUrl={apiUrl} notify={notify} />}
      {sub === "contratada" && ehGerencia && <DadosDaContratada token={token} apiFetch={apiFetch} notify={notify} />}
    </div>
  );
}

function ListaDeContratos({ token, apiFetch, apiUrl, notify, perfil }) {
  const [filtro, setFiltro] = useState("");
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [aberto, setAberto] = useState(null);
  const [novo, setNovo] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    try {
      const q = new URLSearchParams();
      if (filtro) q.set("status", filtro);
      if (buscaAplicada) q.set("busca", buscaAplicada);
      const r = await apiFetch(`/api/contratos?${q.toString()}`, { token });
      setDados(r);
    } catch (e) { notify(`Não foi possível carregar os contratos: ${e.message}`); setDados((d) => d || { contratos: [], contagem: {} }); }
    setCarregando(false);
  };
  useEffect(() => { carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filtro, buscaAplicada]);
  useEffect(() => { const t = setTimeout(() => setBuscaAplicada(busca.trim()), 350); return () => clearTimeout(t); }, [busca]);

  const contagem = dados?.contagem || {};
  const total = Object.values(contagem).reduce((a, b) => a + b, 0);
  const paraValidar = (contagem.documento_recebido || 0) + (contagem.aguardando_validacao || 0);

  return (
    <Caixa icon={FileSignature} titulo="Contratos" acoes={(
      <div className="fnc-acoes">
        <button style={btnLeve} onClick={carregar}><RefreshCcw size={15} className={carregando ? "fnc-spin" : ""} /> Atualizar</button>
        <button style={btn} onClick={() => setNovo(true)}><Plus size={15} /> Novo contrato</button>
      </div>
    )}>
      {paraValidar > 0 && (
        <Aviso tipo="alerta" style={{ marginBottom: 12 }}>
          <strong>{paraValidar === 1 ? "1 documento do GOV.BR" : `${paraValidar} documentos do GOV.BR`} esperando validação.</strong>{" "}
          <button type="button" onClick={() => setFiltro("aguardando_validacao")} style={{ background: "none", border: "none", color: AZUL_MEDIO, fontWeight: 700, cursor: "pointer", padding: 0 }}>Ver agora</button>
        </Aviso>
      )}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={() => setFiltro("")} style={{ ...btnLeve, padding: "6px 11px", fontSize: 12.5, ...(filtro === "" ? { background: AZUL_MARINHO, color: "#fff", border: `1px solid ${AZUL_MARINHO}` } : {}) }}>Todos ({total})</button>
        {ORDEM_STATUS.filter((s) => contagem[s] || filtro === s).map((s) => (
          <button key={s} onClick={() => setFiltro(s)} style={{ ...btnLeve, padding: "6px 11px", fontSize: 12.5, ...(filtro === s ? { background: AZUL_MARINHO, color: "#fff", border: `1px solid ${AZUL_MARINHO}` } : {}) }}>
            {ROTULO_STATUS[s]} ({contagem[s] || 0})
          </button>
        ))}
      </div>
      <div style={{ position: "relative", marginBottom: 12 }}>
        <Search size={15} style={{ position: "absolute", left: 11, top: 11, color: "#8593a8" }} />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por número, cliente, CPF ou serviço" style={{ ...inp, paddingLeft: 34 }} />
      </div>
      {!dados && <Girando />}
      {dados && dados.contratos.length === 0 && (
        <p style={{ color: "#8593a8", fontSize: 14, margin: 0 }}>{filtro || buscaAplicada ? "Nenhum contrato com esse filtro." : "Nenhum contrato ainda. Use \"Novo contrato\" para gerar o primeiro."}</p>
      )}
      {dados && dados.contratos.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table className="fnc-tabela">
            <thead><tr><th>Número</th><th>Cliente</th><th className="fnc-esconde-celular">Serviço</th><th>Situação</th><th className="fnc-esconde-celular">Atualização</th><th /></tr></thead>
            <tbody>
              {dados.contratos.map((c) => (
                <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => setAberto(c.id)}>
                  <td style={{ fontWeight: 700, color: AZUL_MARINHO, whiteSpace: "nowrap" }}>{c.numero}{c.versao > 1 && <div style={{ fontSize: 11, color: "#8593a8", fontWeight: 500 }}>versão {c.versao}</div>}</td>
                  <td>{c.clienteNome}</td>
                  <td className="fnc-esconde-celular">{c.servico}</td>
                  <td><Selo status={c.status} /></td>
                  <td className="fnc-esconde-celular" style={{ whiteSpace: "nowrap", color: "#65758b" }}>{dataHora(c.assinadoEm || c.govbrRecebidoEm || c.liberadoEm || c.criadoEm)}</td>
                  <td><button style={{ ...btnLeve, padding: "6px 10px" }} onClick={(e) => { e.stopPropagation(); setAberto(c.id); }}>Abrir</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {novo && (
        <NovoContrato token={token} apiFetch={apiFetch} notify={notify} onFechar={() => setNovo(false)}
          onCriado={(id) => { setNovo(false); setAberto(id); carregar(); }} />
      )}
      {aberto && (
        <FichaContrato id={aberto} token={token} apiFetch={apiFetch} apiUrl={apiUrl} notify={notify} perfil={perfil}
          onFechar={() => setAberto(null)} onMudou={carregar} onAbrir={(id) => setAberto(id)} />
      )}
    </Caixa>
  );
}

/* Gerar contrato: escolher o cadastro (cliente + serviço) e o modelo. */
function NovoContrato({ token, apiFetch, notify, onFechar, onCriado, cadastroInicial = null }) {
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [cadastro, setCadastro] = useState(cadastroInicial);
  const [modelos, setModelos] = useState([]);
  const [modeloId, setModeloId] = useState("");
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    apiFetch("/api/contratos-modelos", { token }).then((r) => setModelos((r.modelos || []).filter((m) => m.ativo))).catch(() => setModelos([]));
  }, [apiFetch, token]);
  useEffect(() => {
    if (cadastro || busca.trim().length < 2) { setResultados([]); return undefined; }
    const t = setTimeout(async () => {
      setBuscando(true);
      try { setResultados((await apiFetch(`/api/contratos/cadastros?busca=${encodeURIComponent(busca.trim())}`, { token })).cadastros || []); }
      catch (e) { setErro(e.message); }
      setBuscando(false);
    }, 350);
    return () => clearTimeout(t);
  }, [busca, cadastro, apiFetch, token]);
  useEffect(() => {
    if (!cadastro || !modelos.length) return;
    const doServico = modelos.find((m) => m.servico && m.servico.toLowerCase() === String(cadastro.servico || "").toLowerCase());
    setModeloId((doServico || modelos.find((m) => !m.servico) || modelos[0]).id);
  }, [cadastro, modelos]);

  const criar = async () => {
    setCriando(true); setErro("");
    try {
      const r = await apiFetch("/api/contratos", { method: "POST", token, body: { clienteId: cadastro.id, modeloId: modeloId || undefined } });
      notify(`Contrato ${r.contrato.numero} gerado — confira os dados e libere para assinatura.`);
      onCriado(r.contrato.id);
    } catch (e) { setErro(e.message); }
    setCriando(false);
  };

  return (
    <Modal titulo="Novo contrato" subtitulo="Escolha o cliente e o serviço contratado. Os dados do cadastro entram sozinhos no contrato." onFechar={onFechar} largura={680}>
      {!cadastro ? (
        <div style={{ display: "grid", gap: 10 }}>
          <label style={lab}>Cliente (nome, CPF, e-mail ou empreendimento)</label>
          <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Comece a digitar…" style={inp} />
          {buscando && <Girando texto="Buscando…" />}
          {!buscando && busca.trim().length >= 2 && resultados.length === 0 && <div style={{ fontSize: 13, color: "#8593a8" }}>Nenhum cadastro encontrado.</div>}
          <div style={{ display: "grid", gap: 8 }}>
            {resultados.map((r) => (
              <button key={r.id} onClick={() => setCadastro(r)} style={{ textAlign: "left", border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: 10, background: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
                <div style={{ fontWeight: 700, color: AZUL_MARINHO }}>{r.nome}</div>
                <div style={{ fontSize: 12.5, color: "#4a5a70" }}>{r.servico || "Serviço não informado"} · {r.empreendimento || "sem empreendimento"}{r.unidade ? ` · ${r.unidade}` : ""}</div>
                <div style={{ fontSize: 12, color: "#8593a8" }}>CPF {r.cpf || "—"} · cadastro de {data(r.criadoEm)} · {r.status}{r.contratos ? ` · já tem ${r.contratos} contrato(s)` : ""}</div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: 12, background: CINZA_CLARO }}>
            <div style={{ fontWeight: 700, color: AZUL_MARINHO }}>{cadastro.nome}</div>
            <div style={{ fontSize: 13, color: "#4a5a70" }}>{cadastro.servico || "Serviço não informado"} · {cadastro.empreendimento || "sem empreendimento"}{cadastro.unidade ? ` · ${cadastro.unidade}` : ""}</div>
            <div style={{ fontSize: 12, color: "#8593a8" }}>CPF {cadastro.cpf || "—"}{cadastro.valorCobrado !== null && cadastro.valorCobrado !== undefined ? ` · valor lançado ${brl(cadastro.valorCobrado)}` : ""}</div>
            {cadastro.contratos > 0 && <div style={{ fontSize: 12.5, color: AMBAR, marginTop: 4 }}>Este cadastro já tem {cadastro.contratos} contrato(s). Gere outro só se for mesmo um contrato novo — para corrigir um liberado, use "Substituir" nele.</div>}
            {!cadastroInicial && <button onClick={() => setCadastro(null)} style={{ background: "none", border: "none", color: AZUL_MEDIO, fontWeight: 700, cursor: "pointer", padding: 0, marginTop: 6, fontSize: 12.5 }}>Trocar cliente</button>}
          </div>
          <div style={{ display: "grid", gap: 5 }}>
            <label style={lab}>Modelo de contrato</label>
            <select value={modeloId} onChange={(e) => setModeloId(e.target.value)} style={inp}>
              {modelos.map((m) => <option key={m.id} value={m.id}>{m.nome} — versão {m.versao}{m.servico ? ` (${m.servico})` : ""}</option>)}
            </select>
            {!modelos.length && <span style={{ fontSize: 12.5, color: VERMELHO }}>Nenhum modelo ativo. A Gerência cadastra em Contratos › Modelos.</span>}
          </div>
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          <div className="fnc-acoes" style={{ justifyContent: "flex-end" }}>
            <button style={btnLeve} onClick={onFechar}>Cancelar</button>
            <button style={{ ...btn, ...desligado(criando || !modelos.length) }} disabled={criando || !modelos.length} onClick={criar}>
              {criando ? <Loader2 size={15} className="fnc-spin" /> : <FileSignature size={15} />} Gerar contrato
            </button>
          </div>
        </div>
      )}
      {erro && !cadastro && <Aviso tipo="erro" style={{ marginTop: 10 }}>{erro}</Aviso>}
    </Modal>
  );
}

/* A ficha do contrato: conferir, visualizar, liberar, validar o GOV.BR, substituir, cancelar e o histórico. */
function FichaContrato({ id, token, apiFetch, apiUrl, notify, perfil, onFechar, onMudou, onAbrir }) {
  const [c, setC] = useState(null);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [modelos, setModelos] = useState([]);
  const [confirmando, setConfirmando] = useState(null); // "liberar" | "cancelar" | "substituir"
  const [motivo, setMotivo] = useState("");
  const [agindo, setAgindo] = useState(false);
  const [verTexto, setVerTexto] = useState(false);

  const carregar = async () => {
    try {
      const r = await apiFetch(`/api/contratos/${id}`, { token });
      setC(r.contrato);
      const f = {};
      for (const campo of r.contrato.campos) {
        const v = r.contrato.dados[campo.chave];
        f[campo.chave] = v === null || v === undefined ? "" : campo.tipo === "dinheiro" ? String(v).replace(".", ",") : String(v);
      }
      setForm(f);
      setErro("");
    } catch (e) { setErro(e.message); }
  };
  useEffect(() => { setC(null); carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);
  useEffect(() => {
    if (c?.status !== "rascunho") return;
    apiFetch("/api/contratos-modelos", { token }).then((r) => setModelos((r.modelos || []).filter((m) => m.ativo))).catch(() => {});
  }, [c?.status, apiFetch, token]);

  const alterados = useMemo(() => {
    if (!c) return {};
    const saida = {};
    for (const campo of c.campos) {
      const original = c.dados[campo.chave];
      const atual = form[campo.chave] ?? "";
      const antes = original === null || original === undefined ? "" : campo.tipo === "dinheiro" ? String(original).replace(".", ",") : String(original);
      if (atual !== antes) saida[campo.chave] = atual;
    }
    return saida;
  }, [c, form]);
  const temAlteracao = Object.keys(alterados).length > 0;

  const salvar = async (modeloId) => {
    setSalvando(true); setErro("");
    try {
      const r = await apiFetch(`/api/contratos/${id}`, { method: "PATCH", token, body: { dados: alterados, ...(modeloId ? { modeloId } : {}) } });
      setC(r.contrato);
      const f = {};
      for (const campo of r.contrato.campos) {
        const v = r.contrato.dados[campo.chave];
        f[campo.chave] = v === null || v === undefined ? "" : campo.tipo === "dinheiro" ? String(v).replace(".", ",") : String(v);
      }
      setForm(f);
      notify("Dados do contrato salvos.");
      onMudou();
      return true;
    } catch (e) { setErro(e.message); return false; }
    finally { setSalvando(false); }
  };

  const visualizar = async () => {
    try {
      if (c.status === "rascunho" && temAlteracao && !(await salvar())) return;
      await abrirPdf(() => buscarBinario({ apiUrl, token, caminho: `/api/contratos/${id}/previa` }));
    } catch (e) { notify(e.message); }
  };
  const baixar = (tipo) => salvarArquivo(() => buscarBinario({ apiUrl, token, caminho: `/api/contratos/${id}/pdf?tipo=${tipo}` }), `${c.numero}${tipo === "assinado" ? "-assinado" : ""}.pdf`)
    .catch((e) => notify(e.message));
  const baixarArquivo = (a) => salvarArquivo(() => buscarBinario({ apiUrl, token, caminho: `/api/contratos/${id}/arquivos/${a.id}` }), a.nome)
    .catch((e) => notify(e.message));

  const executar = async () => {
    setAgindo(true); setErro("");
    try {
      if (confirmando === "liberar") {
        if (temAlteracao && !(await salvar())) { setAgindo(false); return; }
        const r = await apiFetch(`/api/contratos/${id}/liberar`, { method: "POST", token });
        setC(r.contrato);
        notify(`Contrato ${r.contrato.numero} liberado. O cliente já pode assinar pelo portal.`);
      } else if (confirmando === "cancelar") {
        const r = await apiFetch(`/api/contratos/${id}/cancelar`, { method: "POST", token, body: { motivo } });
        setC(r.contrato);
        notify("Contrato cancelado.");
      } else if (confirmando === "substituir") {
        const r = await apiFetch(`/api/contratos/${id}/substituir`, { method: "POST", token, body: { motivo } });
        notify(`Contrato ${r.contrato.numero} criado no lugar do anterior. Confira e libere.`);
        onMudou();
        setConfirmando(null); setMotivo(""); setAgindo(false);
        onAbrir(r.contrato.id);
        return;
      }
      setConfirmando(null); setMotivo("");
      onMudou();
    } catch (e) { setErro(e.message); }
    setAgindo(false);
  };

  if (!c) {
    return <Modal titulo="Contrato" onFechar={onFechar}>{erro ? <Aviso tipo="erro">{erro}</Aviso> : <Girando />}</Modal>;
  }
  const a = c.acoes;
  return (
    <Modal titulo={`Contrato ${c.numero}`} subtitulo={`${c.servico || "Serviço"} · ${c.modelo ? `${c.modelo.nome} (versão ${c.modelo.versao})` : c.modeloNome || ""}${c.versao > 1 ? ` · versão ${c.versao} do documento` : ""}`}
      onFechar={onFechar} largura={900}>
      <div style={{ display: "grid", gap: 14 }}>
        <div className="fnc-linha" style={{ justifyContent: "space-between" }}>
          <Selo status={c.status} />
          {c.emProcessamento && <span style={{ fontSize: 12.5, color: AMBAR }}><Loader2 size={13} className="fnc-spin" /> operação em andamento — atualize em instantes</span>}
          <button style={btnLeve} onClick={carregar}><RefreshCcw size={14} /> Consultar status</button>
        </div>

        {c.motivo && ["cancelado", "rejeitado", "substituido"].includes(c.status) && <Aviso tipo={c.status === "rejeitado" ? "erro" : "info"}>Motivo: {c.motivo}</Aviso>}
        {c.substituiId && <Aviso tipo="info">Este contrato substitui uma versão anterior. <button type="button" onClick={() => onAbrir(c.substituiId)} style={{ background: "none", border: "none", color: AZUL_MEDIO, fontWeight: 700, cursor: "pointer", padding: 0 }}>Abrir a versão anterior</button></Aviso>}
        {c.substituidoPorId && <Aviso tipo="info">Substituído por uma versão corrigida. <button type="button" onClick={() => onAbrir(c.substituidoPorId)} style={{ background: "none", border: "none", color: AZUL_MEDIO, fontWeight: 700, cursor: "pointer", padding: 0 }}>Abrir o contrato novo</button></Aviso>}

        <div style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 700, color: AZUL_MARINHO }}>{c.cliente.nome}</div>
          <div style={{ fontSize: 13, color: "#4a5a70" }}>CPF {c.cliente.cpf || "—"} · {c.cliente.email || "sem e-mail"} · {c.cliente.telefone || "sem telefone"}</div>
          <div style={{ fontSize: 13, color: "#4a5a70" }}>{c.cliente.empreendimento || "sem empreendimento"}{c.cliente.unidade ? ` · ${c.cliente.unidade}` : ""}</div>
          {c.cliente.temAcessoAoPortal
            ? <div style={{ fontSize: 12.5, color: VERDE, marginTop: 4 }}>✓ Cliente com acesso ao portal — vê e assina o contrato na Área do Cliente.</div>
            : <Aviso tipo="alerta" style={{ marginTop: 8 }}>Este cliente ainda não tem acesso ao portal. Para ver e assinar, ele cria a senha em "Primeiro acesso" com o e-mail {c.cliente.email || "do cadastro"} (ou a equipe envia o link pela ficha do cliente).</Aviso>}
        </div>

        <div className="fnc-acoes">
          <button style={btnLeve} onClick={visualizar}><Eye size={15} /> {c.status === "rascunho" ? "Visualizar prévia" : "Visualizar contrato"}</button>
          {a.baixarOriginal && <button style={btnLeve} onClick={() => baixar("original")}><Download size={15} /> Baixar PDF</button>}
          {a.baixarAssinado && <button style={btnLeve} onClick={() => baixar("assinado")}><Download size={15} /> Baixar PDF assinado</button>}
          {a.liberar && <button style={btn} onClick={() => setConfirmando("liberar")}><Send size={15} /> Liberar para assinatura</button>}
          {a.substituir && <button style={btnLeve} onClick={() => setConfirmando("substituir")}><Repeat size={15} /> Substituir</button>}
          {a.cancelar && <button style={btnPerigo} onClick={() => setConfirmando("cancelar")}><Ban size={15} /> Cancelar</button>}
          {c.pastaDrive && <a href={c.pastaDrive} target="_blank" rel="noopener noreferrer" style={{ ...btnLeve, textDecoration: "none" }}><ExternalLink size={15} /> Pasta no Drive</a>}
        </div>

        {confirmando && (
          <div style={{ border: `1.5px solid ${confirmando === "cancelar" ? "#F2C4C4" : AZUL_MEDIO}`, borderRadius: 12, padding: 14, background: confirmando === "cancelar" ? "#FFF8F8" : "#F6F9FD", display: "grid", gap: 10 }}>
            {confirmando === "liberar" && (
              <div style={{ fontSize: 13.5, color: "#1a2330", lineHeight: 1.5 }}>
                <strong>Liberar o contrato {c.numero} para assinatura?</strong> O PDF é gerado agora, com o código de integridade, e o cliente passa a vê-lo no portal (e recebe um aviso por e-mail).
                Depois de liberado o texto não muda: para corrigir, será preciso "Substituir".
              </div>
            )}
            {confirmando !== "liberar" && (
              <>
                <div style={{ fontSize: 13.5, color: "#1a2330", lineHeight: 1.5 }}>
                  {confirmando === "cancelar"
                    ? <><strong>Cancelar o contrato {c.numero}?</strong> Ele deixa de poder ser assinado, mas tudo o que já existe fica guardado.</>
                    : <><strong>Substituir o contrato {c.numero}?</strong> Nasce um contrato novo (outro número, versão {c.versao + 1}) com os mesmos dados para você corrigir e liberar. Este fica como "Substituído".</>}
                </div>
                <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder="Motivo (pelo menos 10 caracteres)" style={{ ...inp, resize: "vertical" }} />
              </>
            )}
            <div className="fnc-acoes" style={{ justifyContent: "flex-end" }}>
              <button style={btnLeve} onClick={() => { setConfirmando(null); setMotivo(""); }}>Voltar</button>
              <button style={{ ...(confirmando === "cancelar" ? { ...btn, background: VERMELHO } : btn), ...desligado(agindo || (confirmando !== "liberar" && motivo.trim().length < 10)) }}
                disabled={agindo || (confirmando !== "liberar" && motivo.trim().length < 10)} onClick={executar}>
                {agindo ? <Loader2 size={15} className="fnc-spin" /> : <Check size={15} />}{" "}
                {confirmando === "liberar" ? "Sim, liberar" : confirmando === "cancelar" ? "Sim, cancelar" : "Sim, substituir"}
              </button>
            </div>
          </div>
        )}
        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        {c.status === "rascunho" && (
          <ConferenciaDoRascunho c={c} form={form} setForm={setForm} modelos={modelos} salvando={salvando} temAlteracao={temAlteracao} onSalvar={salvar} />
        )}

        {a.validar && <ValidacaoGovbr c={c} token={token} apiFetch={apiFetch} onBaixarArquivo={baixarArquivo} onDecidido={(novo) => { setC(novo); onMudou(); }} notify={notify} />}

        {c.status === "assinado" && <ResumoDaAssinatura c={c} />}

        {c.conteudo && (
          <div>
            <button type="button" onClick={() => setVerTexto((v) => !v)} style={{ ...btnLeve, padding: "6px 11px" }}><ScrollText size={14} /> {verTexto ? "Esconder o texto do contrato" : "Ver o texto do contrato"}</button>
            {verTexto && <div style={{ marginTop: 10, border: `1px solid ${CINZA_BORDA}`, borderRadius: 12, padding: "14px 16px", background: "#fcfdfe" }}><TextoDoContrato blocos={c.conteudo} /></div>}
          </div>
        )}

        {c.arquivos.length > 0 && (
          <div>
            <div style={{ fontWeight: 700, color: AZUL_MARINHO, fontSize: 14, marginBottom: 8 }}><Paperclip size={14} style={{ verticalAlign: "-2px" }} /> Arquivos</div>
            <div style={{ display: "grid", gap: 6 }}>
              {c.arquivos.map((arq) => (
                <div key={arq.id} className="fnc-linha" style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: "8px 10px", justifyContent: "space-between" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{ROTULO_ARQUIVO[arq.tipo] || arq.tipo}</div>
                    <div style={{ fontSize: 11.5, color: "#8593a8" }}>{dataHora(arq.criadoEm)} · {tamanho(arq.bytes)} · SHA-256 <span title={arq.sha256}>{hashCurto(arq.sha256)}</span></div>
                  </div>
                  <button style={{ ...btnLeve, padding: "6px 10px" }} onClick={() => baixarArquivo(arq)}><Download size={14} /> Baixar</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <HistoricoDoContrato eventos={c.eventos} />
      </div>
    </Modal>
  );
}

function ConferenciaDoRascunho({ c, form, setForm, modelos, salvando, temAlteracao, onSalvar }) {
  const campoPorChave = Object.fromEntries(c.campos.map((f) => [f.chave, f]));
  const faltando = new Set(c.faltando.map((f) => f.chave));
  return (
    <div style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 12, padding: 14, display: "grid", gap: 14 }}>
      <div className="fnc-linha" style={{ justifyContent: "space-between" }}>
        <div style={{ fontWeight: 700, color: AZUL_MARINHO, fontSize: 14.5 }}>Conferir as informações</div>
        <div className="fnc-linha">
          <select value={c.modelo?.id || ""} onChange={(e) => onSalvar(e.target.value)} style={{ ...inp, width: "auto", maxWidth: 320 }} aria-label="Modelo do contrato" disabled={salvando}>
            {c.modelo && !modelos.some((m) => m.id === c.modelo.id) && <option value={c.modelo.id}>{c.modelo.nome} — versão {c.modelo.versao}</option>}
            {modelos.map((m) => <option key={m.id} value={m.id}>{m.nome} — versão {m.versao}</option>)}
          </select>
        </div>
      </div>
      {c.errosDoModelo.length > 0 && <Aviso tipo="erro">O modelo tem erros: {c.errosDoModelo.join(" ")}</Aviso>}
      {c.faltando.length > 0 && (
        <Aviso tipo="alerta">Antes de liberar, falta: {c.faltando.map((f) => f.rotulo).join(", ")}.{c.faltando.some((f) => f.origem === "config") ? " Os dados da FN ficam em Contratos › Dados da FN (Gerência)." : ""}</Aviso>
      )}
      {GRUPOS_CAMPOS.map(([titulo, chaves]) => (
        <div key={titulo}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.4, color: "#8593a8", textTransform: "uppercase", marginBottom: 8 }}>{titulo}</div>
          <div className="fnc-grade">
            {chaves.map((chave) => {
              const campo = campoPorChave[chave];
              if (!campo) return null;
              const longo = campo.tipo === "texto-longo";
              const marcado = faltando.has(chave);
              // "border" inteiro, não só a cor: misturar a abreviação com borderColor faz o React avisar e a borda falhar ao trocar.
              const estilo = { ...inp, ...(marcado ? { border: `1px solid ${VERMELHO}`, background: "#FFF8F8" } : {}) };
              return (
                <div key={chave} style={{ display: "grid", gap: 5, gridColumn: longo ? "1 / -1" : "auto" }}>
                  <label style={lab}>{campo.rotulo}{campo.obrigatorio && campo.usadoNoModelo ? " *" : ""}{!campo.usadoNoModelo ? <span style={{ fontWeight: 400, color: "#a0abbb" }}> (não aparece neste modelo)</span> : null}</label>
                  {longo
                    ? <textarea aria-label={campo.rotulo} rows={chave === "clausulas.adicionais" ? 4 : 3} value={form[chave] ?? ""} onChange={(e) => setForm((f) => ({ ...f, [chave]: e.target.value }))} style={{ ...estilo, resize: "vertical", lineHeight: 1.5 }} />
                    : <input aria-label={campo.rotulo} value={form[chave] ?? ""} inputMode={campo.tipo === "dinheiro" ? "decimal" : undefined} placeholder={campo.tipo === "dinheiro" ? "0,00" : ""}
                      onChange={(e) => setForm((f) => ({ ...f, [chave]: e.target.value }))} style={estilo} />}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className="fnc-acoes" style={{ justifyContent: "flex-end" }}>
        <button style={{ ...btn, ...desligado(!temAlteracao || salvando) }} disabled={!temAlteracao || salvando} onClick={() => onSalvar()}>
          {salvando ? <Loader2 size={15} className="fnc-spin" /> : <Save size={15} />} Salvar alterações
        </button>
      </div>
    </div>
  );
}

function ValidacaoGovbr({ c, token, apiFetch, onBaixarArquivo, onDecidido, notify }) {
  const arquivo = c.arquivos.find((a) => a.id === c.govbrArquivoId);
  const v = c.govbrVerificacao || {};
  const [checks, setChecks] = useState({ assinaturaValida: false, signatarioConfere: false, documentoConfere: false });
  const [dataAssinatura, setDataAssinatura] = useState("");
  const [observacao, setObservacao] = useState("");
  const [relatorio, setRelatorio] = useState(null);
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const todos = checks.assinaturaValida && checks.signatarioConfere && checks.documentoConfere;

  const decidir = async (decisao) => {
    setEnviando(true); setErro("");
    try {
      const body = { decisao, arquivoId: c.govbrArquivoId, observacao };
      if (decisao === "rejeitar") body.motivo = motivo;
      else {
        body.verificacoes = checks;
        if (dataAssinatura) body.dataAssinatura = dataAssinatura;
        if (relatorio) {
          if (relatorio.size > LIMITE_PDF_BYTES) throw new Error("O relatório passou de 7 MB.");
          body.relatorio = { nomeArquivo: relatorio.name, arquivoBase64: await lerComoDataUrl(relatorio) };
        }
      }
      const r = await apiFetch(`/api/contratos/${c.id}/validacao`, { method: "POST", token, body });
      notify(decisao === "aprovar" ? `Contrato ${c.numero} marcado como assinado.` : "Documento recusado. O cliente foi avisado por e-mail.");
      onDecidido(r.contrato);
    } catch (e) { setErro(e.message); }
    setEnviando(false);
  };

  const sim = (valor, textoSim, textoNao, textoTalvez) => (valor === true
    ? <span style={{ color: VERDE, fontWeight: 700 }}>✓ {textoSim}</span>
    : valor === false ? <span style={{ color: VERMELHO, fontWeight: 700 }}>✗ {textoNao}</span>
      : <span style={{ color: AMBAR, fontWeight: 700 }}>? {textoTalvez}</span>);

  return (
    <div style={{ border: `1.5px solid ${ROXO}`, borderRadius: 12, padding: 14, display: "grid", gap: 12, background: "#FBF8FE" }}>
      <div style={{ fontWeight: 800, color: ROXO, fontSize: 14.5 }}><ShieldCheck size={16} style={{ verticalAlign: "-3px" }} /> Validar o PDF assinado pelo GOV.BR</div>
      <div style={{ fontSize: 13, color: "#33445a", lineHeight: 1.6 }}>
        Recebido em {dataHora(c.govbrRecebidoEm)}{v.nomeOriginal ? ` · arquivo "${v.nomeOriginal}"` : ""}{arquivo ? ` · ${tamanho(arquivo.bytes)}` : ""}<br />
        Assinatura digital no arquivo: {sim(v.assinaturaEncontrada, `encontrada${v.quantidadeAssinaturas > 1 ? ` (${v.quantidadeAssinaturas})` : ""}`, "não encontrada", "—")}<br />
        Texto do contrato original preservado: {sim(v.conteudoOriginalPreservado, "sim, o começo do arquivo é o contrato emitido", "não — o arquivo foi regravado ou é outro documento", "não deu para confirmar")}<br />
        {v.signatarios?.length > 0 && <>Nome no certificado: <strong>{v.signatarios.join("; ")}</strong><br /></>}
        <span style={{ fontSize: 12, color: "#8593a8" }}>A triagem automática não valida a assinatura — quem valida é o verificador oficial do ITI.</span>
      </div>
      {v.alerta && <Aviso tipo="alerta">{v.alerta}</Aviso>}
      <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.6, color: "#1a2330" }}>
        <li>Baixe o PDF enviado pelo cliente (o arquivo exato que chegou).</li>
        <li>Abra o validador do ITI e envie o arquivo.</li>
        <li>Confira o resultado e marque abaixo.</li>
      </ol>
      <div className="fnc-acoes">
        {arquivo && <button style={btnLeve} onClick={() => onBaixarArquivo(arquivo)}><Download size={15} /> Baixar PDF enviado</button>}
        <a href={LINK_VALIDADOR_ITI} target="_blank" rel="noopener noreferrer" style={{ ...btnLeve, textDecoration: "none" }}><ExternalLink size={15} /> Abrir validador do ITI</a>
      </div>
      {!recusando ? (
        <div style={{ display: "grid", gap: 8 }}>
          {[["assinaturaValida", "O validador do ITI indicou a assinatura como válida (aprovada)."],
            ["signatarioConfere", `O signatário é o contratante (${c.cliente.nome}${c.cliente.cpf ? `, CPF ${c.cliente.cpf}` : ""}).`],
            ["documentoConfere", `O documento assinado é o contrato ${c.numero}, sem alterações.`]].map(([k, texto]) => (
            <label key={k} style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 13.5, cursor: "pointer" }}>
              <input type="checkbox" checked={checks[k]} onChange={(e) => setChecks((x) => ({ ...x, [k]: e.target.checked }))} style={{ width: 18, height: 18, marginTop: 1 }} />{texto}
            </label>
          ))}
          <div className="fnc-grade">
            <div style={{ display: "grid", gap: 5 }}>
              <label style={lab}>Data da assinatura (do relatório do ITI, opcional)</label>
              <input type="date" value={dataAssinatura} onChange={(e) => setDataAssinatura(e.target.value)} style={inp} />
            </div>
            <div style={{ display: "grid", gap: 5 }}>
              <label style={lab}>Relatório do validador em PDF (opcional)</label>
              <input type="file" accept="application/pdf,.pdf" onChange={(e) => setRelatorio(e.target.files?.[0] || null)} style={{ fontSize: 13 }} />
            </div>
          </div>
          <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} placeholder="Observação (opcional)" style={{ ...inp, resize: "vertical" }} />
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          <div className="fnc-acoes" style={{ justifyContent: "flex-end" }}>
            <button style={btnPerigo} onClick={() => setRecusando(true)} disabled={enviando}><X size={15} /> Recusar</button>
            <button style={{ ...btn, background: VERDE, ...desligado(!todos || enviando) }} disabled={!todos || enviando} onClick={() => decidir("aprovar")}>
              {enviando ? <Loader2 size={15} className="fnc-spin" /> : <Check size={15} />} Aprovar e marcar como assinado
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          <label style={lab}>Motivo da recusa — é o que o cliente vai ler</label>
          <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Ex.: o validador do ITI não reconheceu a assinatura; assine de novo no GOV.BR e envie o arquivo que o assinador devolver." style={{ ...inp, resize: "vertical" }} />
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          <div className="fnc-acoes" style={{ justifyContent: "flex-end" }}>
            <button style={btnLeve} onClick={() => setRecusando(false)}>Voltar</button>
            <button style={{ ...btn, background: VERMELHO, ...desligado(motivo.trim().length < 10 || enviando) }} disabled={motivo.trim().length < 10 || enviando} onClick={() => decidir("rejeitar")}>
              {enviando ? <Loader2 size={15} className="fnc-spin" /> : <X size={15} />} Recusar documento
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ResumoDaAssinatura({ c }) {
  const ev = c.evidencias || {};
  const linhas = c.modalidade === "fn"
    ? [
      ["Modalidade", "Assinatura na plataforma FN (desenho + login + código por e-mail)"],
      ["Assinado em", dataHora(c.assinadoEm)],
      ["Conta", ev.signatario ? `${ev.signatario.nomeDaConta} · ${ev.signatario.emailDaConta}` : "—"],
      ["Código por e-mail", ev.autenticacao?.codigoEmail?.exigido ? `confirmado (enviado para ${ev.autenticacao.codigoEmail.enviadoPara})` : "não exigido"],
      ["IP e aparelho", ev.dispositivo ? `${ev.dispositivo.ip || "—"} · ${(ev.dispositivo.userAgent || "").slice(0, 90)}` : "—"],
      ["Leitura", ev.leitura ? `aberto em ${dataHora(ev.leitura.primeiraVisualizacaoEm)} · até o fim: ${ev.leitura.leuAteOFim ? "sim" : "não confirmado"}` : "—"],
      ["SHA-256 do original", c.hashOriginal],
      ["SHA-256 do assinado", c.hashFinal],
    ]
    : [
      ["Modalidade", "Assinatura GOV.BR (ITI), validada pela equipe"],
      ["Data da assinatura", data(c.assinadoEm)],
      ["Validado em", `${dataHora(c.confirmadoEm)}${ev.validacao?.porNome ? ` por ${ev.validacao.porNome}` : ""}`],
      ["Observação", ev.validacao?.observacao || "—"],
      ["SHA-256 do original", c.hashOriginal],
      ["SHA-256 do assinado", c.hashFinal],
    ];
  return (
    <div style={{ border: `1.5px solid ${VERDE}`, borderRadius: 12, padding: 14, background: "#F6FBF8" }}>
      <div style={{ fontWeight: 800, color: VERDE, fontSize: 14.5, marginBottom: 8 }}><ShieldCheck size={16} style={{ verticalAlign: "-3px" }} /> Contrato assinado</div>
      <div style={{ display: "grid", gap: 4 }}>
        {linhas.map(([k, val]) => (
          <div key={k} style={{ display: "grid", gridTemplateColumns: "minmax(110px, 170px) 1fr", gap: 10, fontSize: 13 }}>
            <span style={{ color: "#65758b" }}>{k}</span><span style={{ wordBreak: "break-all" }}>{val || "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HistoricoDoContrato({ eventos = [] }) {
  const [todos, setTodos] = useState(false);
  const lista = todos ? eventos : eventos.slice(0, 8);
  if (!eventos.length) return null;
  return (
    <div>
      <div style={{ fontWeight: 700, color: AZUL_MARINHO, fontSize: 14, marginBottom: 8 }}><History size={14} style={{ verticalAlign: "-2px" }} /> Histórico</div>
      <div style={{ display: "grid", gap: 0, borderLeft: `2px solid ${CINZA_BORDA}`, marginLeft: 6 }}>
        {lista.map((e) => (
          <div key={e.id} style={{ position: "relative", padding: "0 0 12px 14px" }}>
            <span style={{ position: "absolute", left: -6, top: 4, width: 10, height: 10, borderRadius: 5, background: e.para === "assinado" ? VERDE : AZUL_MEDIO }} />
            <div style={{ fontSize: 13, fontWeight: 600 }}>{ROTULO_EVENTO[e.tipo] || e.tipo}{e.para && e.de !== e.para ? <span style={{ fontWeight: 400, color: "#65758b" }}> — {ROTULO_STATUS[e.para] || e.para}</span> : null}</div>
            <div style={{ fontSize: 11.5, color: "#8593a8" }}>
              {dataHora(e.criadoEm)}{e.usuarioNome ? ` · ${e.usuarioNome}` : ""}{e.papel ? ` (${ROTULO_PAPEL[e.papel] || e.papel})` : e.tipo === "triagem_automatica" ? " · sistema" : ""}{e.papel === "cliente" && e.ip ? ` · IP ${e.ip}` : ""}
              {e.detalhe?.motivo ? ` · motivo: ${e.detalhe.motivo}` : ""}{e.detalhe?.modalidade ? ` · ${e.detalhe.modalidade === "fn" ? "assinar na FN" : "GOV.BR"}` : ""}
              {e.detalhe?.campos?.length ? ` · ${e.detalhe.campos.length} campo(s)` : ""}
            </div>
          </div>
        ))}
      </div>
      {eventos.length > 8 && <button style={{ ...btnLeve, padding: "5px 10px", fontSize: 12.5 }} onClick={() => setTodos((t) => !t)}>{todos ? "Mostrar menos" : `Ver todo o histórico (${eventos.length})`}</button>}
    </div>
  );
}

/* ---------------- Modelos (Gerência) ---------------- */
function ModelosDeContrato({ token, apiFetch, apiUrl, notify }) {
  const [dados, setDados] = useState(null);
  const [editando, setEditando] = useState(null); // { familiaId?, id? } | "novo"
  const carregar = async () => {
    try { setDados(await apiFetch("/api/contratos-modelos", { token })); }
    catch (e) { notify(e.message); setDados((d) => d || { modelos: [], campos: [], servicos: [] }); }
  };
  useEffect(() => { carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const alternar = async (m) => {
    try {
      await apiFetch(`/api/contratos-modelos/familia/${m.familiaId}`, { method: "PATCH", token, body: { ativo: !m.ativo } });
      notify(m.ativo ? "Modelo desativado: não aparece mais para contratos novos." : "Modelo ativado.");
      carregar();
    } catch (e) { notify(e.message); }
  };
  return (
    <Caixa icon={ScrollText} titulo="Modelos de contrato" acoes={<button style={btn} onClick={() => setEditando("novo")}><Plus size={15} /> Novo modelo</button>}>
      <p style={{ fontSize: 13, color: "#65758b", margin: "0 0 12px", lineHeight: 1.5 }}>
        Cada vez que você salva um modelo, nasce uma versão nova. Contratos já gerados continuam com a versão que usaram — nada muda neles.
        O modelo de um serviço é sugerido sozinho ao gerar contrato para aquele serviço; sem serviço, vale para todos.
      </p>
      {!dados && <Girando />}
      {dados && (
        <div style={{ display: "grid", gap: 8 }}>
          {dados.modelos.map((m) => (
            <div key={m.familiaId} className="fnc-linha" style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: 12, justifyContent: "space-between", opacity: m.ativo ? 1 : 0.65 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, color: AZUL_MARINHO }}>{m.nome} <span style={{ fontWeight: 500, color: "#8593a8", fontSize: 12.5 }}>versão {m.versao}</span></div>
                <div style={{ fontSize: 12.5, color: "#65758b" }}>{m.servico || "Qualquer serviço"} · atualizado em {data(m.atualizadoEm)} · usado em {m.contratos} contrato(s){m.ativo ? "" : " · desativado"}</div>
              </div>
              <div className="fnc-acoes">
                <button style={btnLeve} onClick={() => setEditando({ familiaId: m.familiaId, id: m.id })}><PenLine size={14} /> Editar</button>
                <button style={btnLeve} onClick={() => alternar(m)}>{m.ativo ? "Desativar" : "Ativar"}</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {editando && dados && (
        <EditorDeModelo inicial={editando === "novo" ? null : editando} familia={editando === "novo" ? null : dados.modelos.find((m) => m.familiaId === editando.familiaId)}
          campos={dados.campos} servicos={dados.servicos} token={token} apiFetch={apiFetch} apiUrl={apiUrl} notify={notify}
          onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); carregar(); }} />
      )}
    </Caixa>
  );
}

function EditorDeModelo({ inicial, familia, campos, servicos, token, apiFetch, apiUrl, notify, onFechar, onSalvo }) {
  const [nome, setNome] = useState(familia?.nome || "");
  const [servico, setServico] = useState(familia?.servico || "");
  const [corpo, setCorpo] = useState("");
  const [versaoVista, setVersaoVista] = useState(inicial?.id || null);
  const [carregando, setCarregando] = useState(!!inicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const textoRef = useRef(null);

  useEffect(() => {
    if (!versaoVista) return;
    setCarregando(true);
    apiFetch(`/api/contratos-modelos/${versaoVista}`, { token })
      .then((r) => { setCorpo(r.modelo.corpo); if (!nome) setNome(r.modelo.nome); })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [versaoVista]);

  const inserir = (chave) => {
    const el = textoRef.current;
    const marca = `{{${chave}}}`;
    if (!el) { setCorpo((t) => t + marca); return; }
    const ini = el.selectionStart ?? corpo.length;
    const fim = el.selectionEnd ?? corpo.length;
    const novo = corpo.slice(0, ini) + marca + corpo.slice(fim);
    setCorpo(novo);
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = ini + marca.length; });
  };
  const previa = () => abrirPdf(() => buscarBinario({ apiUrl, token, caminho: "/api/contratos-modelos/previa", method: "POST", body: { corpo } }))
    .catch((e) => setErro(e.message));
  const salvar = async () => {
    setSalvando(true); setErro("");
    try {
      await apiFetch("/api/contratos-modelos", { method: "POST", token, body: { familiaId: familia?.familiaId, nome, servico, corpo } });
      notify(familia ? "Nova versão do modelo salva." : "Modelo criado.");
      onSalvo();
    } catch (e) { setErro(e.message); }
    setSalvando(false);
  };
  const grupos = [["Contratante e imóvel", "cadastro"], ["Calculados pelo sistema", "sistema"], ["Dados da FN", "config"]];

  return (
    <Modal titulo={familia ? `Editar modelo — ${familia.nome}` : "Novo modelo de contrato"} subtitulo="Ao salvar, nasce uma versão nova. Os contratos já gerados não mudam." onFechar={onFechar} largura={980}>
      <div style={{ display: "grid", gap: 12 }}>
        <div className="fnc-grade">
          <div style={{ display: "grid", gap: 5 }}><label style={lab}>Nome do modelo</label><input value={nome} onChange={(e) => setNome(e.target.value)} style={inp} /></div>
          <div style={{ display: "grid", gap: 5 }}>
            <label style={lab}>Serviço</label>
            <select value={servico} onChange={(e) => setServico(e.target.value)} style={inp}>
              <option value="">Qualquer serviço</option>
              {[...new Set([...(servicos || []), ...(servico ? [servico] : [])])].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {familia && familia.versoes?.length > 1 && (
            <div style={{ display: "grid", gap: 5 }}>
              <label style={lab}>Partir da versão</label>
              <select value={versaoVista || ""} onChange={(e) => setVersaoVista(e.target.value)} style={inp}>
                {familia.versoes.map((v) => <option key={v.id} value={v.id}>Versão {v.versao} — {data(v.criadoEm)}{v.criadoPorNome ? ` · ${v.criadoPorNome}` : ""}</option>)}
              </select>
            </div>
          )}
        </div>
        <div style={{ fontSize: 12.5, color: "#65758b", lineHeight: 1.6, background: CINZA_CLARO, borderRadius: 10, padding: "8px 12px" }}>
          <strong># Título</strong> (centralizado) · <strong>## Cláusula</strong> (subtítulo) · <strong>- item</strong> (lista) · linha em branco separa parágrafos · <strong>**negrito**</strong> ·
          campos entre chaves duplas, como <code>{"{{contratante.nome}}"}</code>. Um parágrafo só com um campo longo (descrição, condições) some quando o campo fica vazio.
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          {grupos.map(([titulo, origem]) => (
            <div key={origem} className="fnc-linha" style={{ gap: 6 }}>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: "#8593a8", textTransform: "uppercase", minWidth: 120 }}>{titulo}</span>
              {campos.filter((f) => f.origem === origem).map((f) => (
                <button key={f.chave} type="button" title={`{{${f.chave}}}`} onClick={() => inserir(f.chave)}
                  style={{ ...btnLeve, padding: "4px 9px", fontSize: 12, fontWeight: 500 }}>{f.rotulo}</button>
              ))}
            </div>
          ))}
        </div>
        {carregando ? <Girando /> : (
          <textarea ref={textoRef} value={corpo} onChange={(e) => setCorpo(e.target.value)} rows={22} spellCheck
            style={{ ...inp, fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace", fontSize: 13, lineHeight: 1.55, resize: "vertical" }}
            placeholder={"# CONTRATO DE PRESTAÇÃO DE SERVIÇOS\n\n## CLÁUSULA PRIMEIRA — DO OBJETO\n\n..."} />
        )}
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <div className="fnc-acoes" style={{ justifyContent: "flex-end" }}>
          <button style={btnLeve} onClick={onFechar}>Cancelar</button>
          <button style={{ ...btnLeve, ...desligado(!corpo.trim()) }} disabled={!corpo.trim()} onClick={previa}><Eye size={15} /> Pré-visualizar PDF</button>
          <button style={{ ...btn, ...desligado(salvando || !corpo.trim() || nome.trim().length < 3) }} disabled={salvando || !corpo.trim() || nome.trim().length < 3} onClick={salvar}>
            {salvando ? <Loader2 size={15} className="fnc-spin" /> : <Save size={15} />} {familia ? "Salvar nova versão" : "Criar modelo"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- Dados da contratada (Gerência) ---------------- */
function DadosDaContratada({ token, apiFetch, notify }) {
  const [config, setConfig] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  useEffect(() => {
    apiFetch("/api/contratos-config", { token }).then((r) => setConfig(r.config)).catch((e) => { setErro(e.message); setConfig({}); });
  }, [apiFetch, token]);
  const salvar = async () => {
    setSalvando(true); setErro("");
    try { setConfig((await apiFetch("/api/contratos-config", { method: "PUT", token, body: config })).config); notify("Dados da FN salvos. Valem para os próximos contratos liberados."); }
    catch (e) { setErro(e.message); }
    setSalvando(false);
  };
  const campos = [
    ["razao_social", "Razão social"], ["cnpj", "CNPJ"], ["endereco", "Endereço completo (sede)"], ["representante", "Representante"],
    ["email", "E-mail"], ["telefone", "Telefone"], ["foro_cidade", "Cidade do foro (se o modelo tiver cláusula de foro)"],
    ["rodape", "Rodapé do contrato (site e redes sociais)"],
  ];
  const escolherAssinatura = async (arquivo) => {
    setErro("");
    if (!arquivo) return;
    if (!/^image\/(png|jpeg)$/.test(arquivo.type)) { setErro("Use uma imagem PNG (de preferência com fundo transparente) ou JPEG."); return; }
    if (arquivo.size > 200 * 1024) { setErro("A imagem passou de 200 KB. Recorte só a assinatura e salve de novo."); return; }
    const dataUrl = await lerComoDataUrl(arquivo);
    setConfig((c) => ({ ...c, assinatura_imagem: dataUrl }));
  };
  return (
    <Caixa icon={Settings} titulo="Dados da FN nos contratos">
      <p style={{ fontSize: 13, color: "#65758b", margin: "0 0 12px" }}>Estes dados entram na qualificação da CONTRATADA, no bloco de assinaturas e no rodapé. Cada contrato guarda os dados do dia em que foi liberado.</p>
      {!config ? <Girando /> : (
        <div style={{ display: "grid", gap: 12 }}>
          <div className="fnc-grade">
            {campos.map(([k, rotulo]) => (
              <div key={k} style={{ display: "grid", gap: 5, gridColumn: ["endereco", "representante", "rodape"].includes(k) ? "1 / -1" : "auto" }}>
                <label style={lab}>{rotulo}</label>
                <input aria-label={rotulo} value={config[k] || ""} onChange={(e) => setConfig((c) => ({ ...c, [k]: e.target.value }))} style={inp} />
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gap: 8, border: `1px solid ${CINZA_BORDA}`, borderRadius: 12, padding: 12 }}>
            <label style={lab}>Assinatura do representante (aparece acima de "CONTRATADA" em todo contrato, como no contrato oficial)</label>
            {config.assinatura_imagem
              ? <img src={config.assinatura_imagem} alt="Assinatura do representante" style={{ maxHeight: 70, maxWidth: 280, objectFit: "contain", background: "#fff", border: `1px dashed ${CINZA_BORDA}`, borderRadius: 8, padding: 6 }} />
              : <span style={{ fontSize: 12.5, color: "#8593a8" }}>Nenhuma imagem: o contrato sai com a linha de assinatura da CONTRATADA em branco.</span>}
            <div className="fnc-linha">
              <label style={{ ...btnLeve, cursor: "pointer" }}><Upload size={15} /> {config.assinatura_imagem ? "Trocar imagem" : "Enviar imagem"}
                <input type="file" accept="image/png,image/jpeg" style={{ display: "none" }} onChange={(e) => { escolherAssinatura(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
              {config.assinatura_imagem && <button style={btnPerigo} onClick={() => setConfig((c) => ({ ...c, assinatura_imagem: "" }))}><X size={15} /> Remover</button>}
            </div>
            <span style={{ fontSize: 12, color: "#8593a8" }}>PNG com fundo transparente, até 200 KB. Vale para os contratos liberados depois de salvar.</span>
          </div>
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          <div className="fnc-acoes" style={{ justifyContent: "flex-end" }}>
            <button style={{ ...btn, ...desligado(salvando) }} disabled={salvando} onClick={salvar}>{salvando ? <Loader2 size={15} className="fnc-spin" /> : <Save size={15} />} Salvar</button>
          </div>
        </div>
      )}
    </Caixa>
  );
}

/* ============================================================
   Seção "Contratos" da ficha do cliente (Gerência › Perfil do cliente e Clientes › Editar cliente)
   ============================================================ */
export function SecaoContratosCliente({ token, apiFetch, apiUrl, notify, perfil, cadastroId, cpf }) {
  const [contratos, setContratos] = useState(null);
  const [cadastro, setCadastro] = useState(null);
  const [aberto, setAberto] = useState(null);
  const [gerando, setGerando] = useState(false);
  const digitos = String(cpf || "").replace(/\D/g, "");
  const carregar = async () => {
    try {
      const q = digitos.length === 11 || digitos.length === 14 ? `cpf=${digitos}` : `clienteId=${encodeURIComponent(cadastroId)}`;
      setContratos((await apiFetch(`/api/contratos?${q}`, { token })).contratos || []);
    } catch { setContratos([]); }
  };
  useEffect(() => { if (cadastroId) carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [cadastroId, digitos]);
  useEffect(() => {
    if (!cadastroId) return;
    apiFetch(`/api/contratos/cadastros?clienteId=${encodeURIComponent(cadastroId)}`, { token })
      .then((r) => setCadastro(r.cadastros?.[0] || null)).catch(() => setCadastro(null));
  }, [cadastroId, apiFetch, token]);

  return (
    <div className="fnc-raiz" style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 14, padding: 16, minWidth: 0, background: "#fff" }}>
      <Estilos />
      <div className="fnc-linha" style={{ justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontWeight: 700, color: AZUL_MARINHO, fontSize: 14.5 }}><FileSignature size={15} style={{ verticalAlign: "-2px" }} /> Contratos</div>
        {cadastro && <button style={btn} onClick={() => setGerando(true)}><Plus size={15} /> Gerar contrato</button>}
      </div>
      {contratos === null && <Girando />}
      {contratos && contratos.length === 0 && <div style={{ fontSize: 13, color: "#8593a8" }}>Nenhum contrato deste cliente ainda.</div>}
      {contratos && contratos.length > 0 && (
        <div style={{ display: "grid", gap: 6 }}>
          {contratos.map((c) => (
            <button key={c.id} onClick={() => setAberto(c.id)} className="fnc-linha"
              style={{ textAlign: "left", border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: "8px 10px", background: "#fff", cursor: "pointer", justifyContent: "space-between", fontFamily: "inherit" }}>
              <span style={{ minWidth: 0 }}>
                <strong style={{ color: AZUL_MARINHO, fontSize: 13.5 }}>{c.numero}</strong>
                <span style={{ fontSize: 12.5, color: "#65758b" }}> · {c.servico || "serviço"} · {data(c.liberadoEm || c.criadoEm)}</span>
              </span>
              <Selo status={c.status} />
            </button>
          ))}
        </div>
      )}
      {gerando && cadastro && (
        <NovoContrato token={token} apiFetch={apiFetch} notify={notify} cadastroInicial={cadastro}
          onFechar={() => setGerando(false)} onCriado={(id) => { setGerando(false); setAberto(id); carregar(); }} />
      )}
      {aberto && (
        <FichaContrato id={aberto} token={token} apiFetch={apiFetch} apiUrl={apiUrl} notify={notify} perfil={perfil}
          onFechar={() => setAberto(null)} onMudou={carregar} onAbrir={(id) => setAberto(id)} />
      )}
    </div>
  );
}
