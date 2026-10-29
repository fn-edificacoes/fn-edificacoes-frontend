/* ============================================================
   PATOLOGIA POR VOZ — foto + áudio → item do laudo
   ============================================================
   O técnico anexa a foto da patologia, segura o botão do microfone e descreve ("Sala, parede
   da janela, fissura diagonal saindo do canto da esquadria, uns 2 mm"). O servidor guarda o
   áudio, transcreve e a IA monta o item no formato do laudo; aqui o técnico só revisa e
   confirma (ver src/patologia-voz.js no backend).

   Arquivo à parte, como a Rede Nacional: o App.jsx só o encaixa na aba da vistoria e entrega
   o apiFetch, que continua sendo o único caminho para a API. Nada do fluxo antigo muda — o
   item confirmado é um item comum, com os mesmos campos de sempre, que entra na lista de
   itens da vistoria. O que ainda está pendente de revisão mora só no servidor e nunca entra
   no laudo.

   Quem vê o botão decide o servidor (flag por conta + papel). Esconder aqui não protege nada:
   as rotas recusam com 403 quem não pode. */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, Lock, X, Camera, Image as IconeImagem, RefreshCcw, CheckCircle2, Trash2, Send, Loader2, AlertTriangle, ChevronUp, ChevronLeft } from "lucide-react";

const AZUL_MEDIO = "#2C75B5";
const AZUL_MARINHO = "#12335B";
const CINZA_CLARO = "#F1F4F8";
const CINZA_BORDA = "#D8DEE7";
const VERDE = "#0F7259";
const VERMELHO = "#C62828";
const AMBAR = "#B26A00";

const lab = { fontSize: 12, fontWeight: 600, color: "#5a6a80" };
const inp = { padding: "9px 11px", border: `1px solid ${CINZA_BORDA}`, borderRadius: 8, fontSize: 14, outline: "none", background: "#fff", fontFamily: "inherit", width: "100%", boxSizing: "border-box" };
const btn = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 14px", borderRadius: 8, border: "none", background: AZUL_MEDIO, color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer" };
const btnLeve = { ...btn, background: "#fff", color: AZUL_MARINHO, border: `1px solid ${CINZA_BORDA}` };

const DURACAO_MIN_MS = 1000;
const DURACAO_MAX_MS = 2 * 60 * 1000;
/* Mesma régua do servidor: "processando" há mais que isso, sem andar, é erro com "reprocessar". */
const PARADA_MS = 5 * 60 * 1000;
const INTERVALO_CONSULTA_MS = 3000;
const ARRASTO_CANCELAR = 90;
const ARRASTO_TRAVAR = 70;

const STATUS_ITEM = [
  { valor: "pendente", label: "Pendente" },
  { valor: "corrigido", label: "Corrigido" },
  { valor: "reincidente", label: "Reincidente" },
];
const CONFIANCA = {
  alta: { label: "Confiança alta", cor: VERDE, fundo: "#E6F4EF" },
  media: { label: "Confiança média", cor: AMBAR, fundo: "#FFF4E0" },
  baixa: { label: "Confiança baixa — confira a patologia", cor: VERMELHO, fundo: "#FDECEC" },
};
const ORIGEM_TEXTO = { catalogo: "do catálogo", tecnico: "falada pelo técnico", a_confirmar: "a confirmar" };

function mmss(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function horaDe(iso) {
  try { return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}
function blobParaDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("Não foi possível ler a gravação."));
    r.readAsDataURL(blob);
  });
}
function statusNaTela(g) {
  if (g.status === "processando" && Date.now() - new Date(g.atualizadoEm).getTime() > PARADA_MS) return "erro";
  return g.status;
}

/* ---------- Estado e chamadas ----------
   Um lugar só para tudo o que a voz conversa com a API. O AppInterno chama uma vez e entrega
   o resultado à aba da vistoria e ao "Enviar para gerência" (que avisa dos pendentes). */
export function usePatologiaVoz({ apiFetch, token, clienteId, perfil }) {
  const podeUsar = perfil === "vistoriador" || perfil === "gerencia";
  const [habilitado, setHabilitado] = useState(false);
  const [gravacoes, setGravacoes] = useState([]);
  /* Envios que ainda não têm resposta do servidor. Ficam só na memória da página: a fila que
     sobrevive a sinal ruim e a recarregar a página é a fase 2 (IndexedDB). */
  const [locais, setLocais] = useState([]);
  const clienteRef = useRef(clienteId);
  clienteRef.current = clienteId;

  useEffect(() => {
    if (!podeUsar || !token) { setHabilitado(false); return; }
    let vivo = true;
    apiFetch("/api/patologia-voz/config", { token })
      .then((r) => { if (vivo) setHabilitado(!!r?.habilitado); })
      .catch(() => { if (vivo) setHabilitado(false); }); // sem a rota (backend antigo) = sem o botão
    return () => { vivo = false; };
  }, [podeUsar, token]);

  const recarregar = useCallback(async () => {
    const alvo = clienteRef.current;
    if (!habilitado || !alvo) return;
    try {
      const r = await apiFetch(`/api/patologia-voz/vistorias/${encodeURIComponent(alvo)}/gravacoes`, { token });
      if (clienteRef.current === alvo) setGravacoes(r?.gravacoes || []);
    } catch (e) {
      console.warn("Patologia por voz: não consegui atualizar as gravações:", e.message);
    }
  }, [habilitado, token]);

  useEffect(() => {
    setGravacoes([]);
    setLocais([]);
    recarregar();
  }, [clienteId, habilitado]);

  /* Os cards se preenchem sozinhos: enquanto houver gravação em "processando", consulta de
     novo a cada poucos segundos. Nada processando, nada de consulta. */
  const algumProcessando = gravacoes.some((g) => statusNaTela(g) === "processando");
  useEffect(() => {
    if (!algumProcessando) return undefined;
    const t = setTimeout(recarregar, INTERVALO_CONSULTA_MS);
    return () => clearTimeout(t);
  }, [algumProcessando, gravacoes, recarregar]);

  const postarLocal = async (local) => {
    setLocais((l) => l.map((x) => (x.idLocal === local.idLocal ? { ...x, status: "enviando", erro: null } : x)));
    try {
      await apiFetch(`/api/patologia-voz/vistorias/${encodeURIComponent(local.clienteId)}/gravacoes`, {
        method: "POST", token, body: local.corpo,
      });
      setLocais((l) => l.filter((x) => x.idLocal !== local.idLocal));
      await recarregar();
    } catch (e) {
      setLocais((l) => l.map((x) => (x.idLocal === local.idLocal ? { ...x, status: "falha_envio", erro: e.message } : x)));
    }
  };

  /* Aparece na hora como "processando" e o técnico segue para a próxima patologia: o envio,
     a transcrição e a IA correm por trás. */
  const enviar = async ({ blob, duracaoMs, fotoDataUrl, fotoDeGravacaoId }) => {
    if (!clienteRef.current) return;
    const idLocal = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const audioBase64 = await blobParaDataUrl(blob);
    const local = {
      idLocal, clienteId: clienteRef.current, criadoEm: new Date().toISOString(), duracaoMs, status: "enviando",
      foto: fotoDataUrl || null,
      corpo: {
        audioBase64, mimeType: blob.type || "audio/webm", duracaoMs: Math.round(duracaoMs),
        ...(fotoDataUrl ? { fotoBase64: fotoDataUrl, fotoMime: "image/jpeg" } : {}),
        ...(!fotoDataUrl && fotoDeGravacaoId ? { fotoDeGravacaoId } : {}),
      },
    };
    setLocais((l) => [local, ...l]);
    postarLocal(local);
  };
  const reenviarLocal = (idLocal) => { const x = locais.find((l) => l.idLocal === idLocal); if (x) postarLocal(x); };
  const descartarLocal = (idLocal) => setLocais((l) => l.filter((x) => x.idLocal !== idLocal));

  const reprocessar = async (id) => {
    await apiFetch(`/api/patologia-voz/gravacoes/${encodeURIComponent(id)}/reprocessar`, { method: "POST", token });
    await recarregar();
  };
  const confirmar = async (itemId, valores) => {
    const r = await apiFetch(`/api/patologia-voz/itens/${encodeURIComponent(itemId)}/confirmar`, { method: "POST", token, body: { valores } });
    await recarregar();
    return r.item;
  };
  const descartar = async (itemId) => {
    await apiFetch(`/api/patologia-voz/itens/${encodeURIComponent(itemId)}/descartar`, { method: "POST", token });
    await recarregar();
  };

  /* O que ainda não está no laudo: aviso no "Enviar para gerência". */
  const pendentes = useMemo(() => {
    const lista = locais.map((l) => `Gravação das ${horaDe(l.criadoEm)} — ${l.status === "enviando" ? "enviando" : "não enviada"}`);
    for (const g of gravacoes) {
      const st = statusNaTela(g);
      if (st === "processando") lista.push(`Gravação das ${horaDe(g.criadoEm)} — processando`);
      else if (st === "erro") lista.push(`Gravação das ${horaDe(g.criadoEm)} — com erro (reprocessar ou descartar)`);
      else {
        for (const it of g.itens) {
          if (it.statusRevisao !== "pendente_revisao") continue;
          const s = it.sugestao || {};
          lista.push(`${s.local || "Sem ambiente"} · ${s.titulo || "patologia a definir"} — pendente de revisão`);
        }
      }
    }
    return lista;
  }, [gravacoes, locais]);

  return { habilitado: habilitado && podeUsar, gravacoes, locais, pendentes, recarregar, enviar, reenviarLocal, descartarLocal, reprocessar, confirmar, descartar };
}

/* ---------- Botão de gravar, igual áudio de WhatsApp ----------
   Segura para gravar, solta para enviar, arrasta para o lado para cancelar, arrasta para cima
   para travar (e aí solta o dedo e fala à vontade). Cronômetro na tela, mínimo de 1 s,
   máximo de 2 min. */
function escolherTipoDeAudio() {
  if (typeof window === "undefined" || !window.MediaRecorder) return null;
  /* O Chrome do Android grava webm/opus; o Safari do iPhone, mp4 (aac). A ordem importa:
     webm primeiro porque é menor; quem não tem cai no mp4. */
  for (const t of ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/aac"]) {
    if (window.MediaRecorder.isTypeSupported?.(t)) return t;
  }
  return "";
}

function mensagemDoMicrofone(err) {
  const nome = err?.name || "";
  if (nome === "NotAllowedError" || nome === "SecurityError") {
    return "O microfone está bloqueado para o sistema. No Android (Chrome): toque no ícone ao lado do endereço › Permissões › Microfone › Permitir. "
      + "No iPhone: Ajustes › Safari › Microfone › Permitir (vale também para o atalho da tela de início). Depois recarregue a página.";
  }
  if (nome === "NotFoundError" || nome === "OverconstrainedError") return "Nenhum microfone encontrado neste aparelho.";
  if (nome === "NotReadableError" || nome === "AbortError") return "O microfone está ocupado por outro app (ligação, gravador). Feche o outro app e tente de novo.";
  return `Não foi possível abrir o microfone${err?.message ? `: ${err.message}` : "."}`;
}

export function BotaoGravarVoz({ onGravado, desabilitado = false }) {
  const [fase, setFase] = useState("parado"); // parado | pedindo | gravando | travado
  const [ms, setMs] = useState(0);
  const [arrasto, setArrasto] = useState({ dx: 0, dy: 0 });
  const [aviso, setAviso] = useState("");
  const faseRef = useRef("parado");
  const r = useRef({ stream: null, rec: null, partes: [], inicio: 0, origem: null, soltou: false, cancelado: false, timer: null, tipo: "" });

  const mudarFase = (f) => { faseRef.current = f; setFase(f); };

  const liberar = () => {
    clearInterval(r.current.timer);
    r.current.stream?.getTracks().forEach((t) => t.stop());
    r.current.stream = null;
  };
  useEffect(() => () => { // saiu da tela no meio: solta o microfone
    r.current.cancelado = true;
    try { if (r.current.rec?.state === "recording") r.current.rec.stop(); } catch { /* já parado */ }
    liberar();
  }, []);

  const parar = (enviar) => {
    if (faseRef.current !== "gravando" && faseRef.current !== "travado") return;
    r.current.cancelado = !enviar;
    clearInterval(r.current.timer);
    try { r.current.rec?.stop(); } catch { liberar(); mudarFase("parado"); }
  };

  /* App foi para segundo plano (ligação, troca de app): o navegador corta o microfone. Envia o
     que já foi gravado em vez de perder. */
  useEffect(() => {
    const aoEsconder = () => { if (document.hidden) parar(true); };
    document.addEventListener("visibilitychange", aoEsconder);
    return () => document.removeEventListener("visibilitychange", aoEsconder);
  }, []);

  const comecar = async ({ travado = false } = {}) => {
    setAviso("");
    if (!navigator.mediaDevices?.getUserMedia || escolherTipoDeAudio() === null) {
      setAviso("Este navegador não grava áudio aqui. Abra o sistema em https://sistema.fnedificacoes.com.br pelo Chrome (Android) ou Safari (iPhone) atualizados.");
      return;
    }
    mudarFase("pedindo");
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (err) {
      mudarFase("parado");
      setAviso(mensagemDoMicrofone(err));
      return;
    }
    /* Na primeira vez o navegador abre o pedido de permissão no meio do gesto, e o dedo já
       saiu do botão quando a permissão volta. Não grava nada: só avisa que agora pode. */
    if (r.current.soltou && !travado) {
      stream.getTracks().forEach((t) => t.stop());
      mudarFase("parado");
      setAviso("Microfone liberado. Agora segure o botão enquanto fala.");
      return;
    }
    const tipo = escolherTipoDeAudio();
    let rec;
    try {
      rec = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
    } catch {
      rec = new MediaRecorder(stream);
    }
    r.current = { ...r.current, stream, rec, partes: [], inicio: Date.now(), cancelado: false, tipo };
    rec.ondataavailable = (ev) => { if (ev.data && ev.data.size) r.current.partes.push(ev.data); };
    rec.onstop = () => {
      const duracao = Date.now() - r.current.inicio;
      const blob = new Blob(r.current.partes, { type: rec.mimeType || r.current.tipo || "audio/webm" });
      const cancelado = r.current.cancelado;
      liberar();
      mudarFase("parado");
      setMs(0);
      setArrasto({ dx: 0, dy: 0 });
      if (cancelado) return;
      if (duracao < DURACAO_MIN_MS || !blob.size) { setAviso("Segure o botão por pelo menos 1 segundo enquanto fala."); return; }
      onGravado({ blob, duracaoMs: Math.min(duracao, DURACAO_MAX_MS) });
    };
    rec.start(250);
    r.current.timer = setInterval(() => {
      const passado = Date.now() - r.current.inicio;
      setMs(passado);
      if (passado >= DURACAO_MAX_MS) parar(true); // limite de 2 min: envia o que tem
    }, 200);
    mudarFase(travado ? "travado" : "gravando");
  };

  const aoApertar = (e) => {
    if (desabilitado || faseRef.current !== "parado") return;
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* navegador antigo */ }
    r.current.origem = { x: e.clientX, y: e.clientY };
    r.current.soltou = false;
    comecar();
  };
  const aoMover = (e) => {
    if (faseRef.current !== "gravando" || !r.current.origem) return;
    const dx = Math.min(0, e.clientX - r.current.origem.x);
    const dy = Math.min(0, e.clientY - r.current.origem.y);
    setArrasto({ dx, dy });
    if (dx < -ARRASTO_CANCELAR) parar(false);
    else if (dy < -ARRASTO_TRAVAR) { mudarFase("travado"); setArrasto({ dx: 0, dy: 0 }); }
  };
  const aoSoltar = () => {
    r.current.soltou = true;
    if (faseRef.current === "gravando") parar(true);
  };
  /* Teclado (computador da Gerência): Enter/Espaço começa já travado; de novo, envia. */
  const aoTeclar = (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (faseRef.current === "parado" && !desabilitado) { r.current.soltou = true; comecar({ travado: true }); }
    else if (faseRef.current === "travado") parar(true);
  };

  const gravando = fase === "gravando" || fase === "travado";
  const quaseCancelando = arrasto.dx < -ARRASTO_CANCELAR / 2;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      {gravando && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontVariantNumeric: "tabular-nums" }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: VERMELHO, animation: "fnVozPulso 1s infinite" }} />
          <strong style={{ fontSize: 18, color: AZUL_MARINHO }}>{mmss(ms)}</strong>
          <span style={{ fontSize: 12, color: "#65758b" }}>/ {mmss(DURACAO_MAX_MS)}</span>
        </div>
      )}
      {fase === "gravando" && (
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: quaseCancelando ? VERMELHO : "#65758b" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><ChevronLeft size={14} /> arraste para cancelar</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><ChevronUp size={14} /> para cima trava</span>
        </div>
      )}

      {fase === "travado" ? (
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" style={{ ...btnLeve, color: VERMELHO }} onClick={() => parar(false)}><X size={16} /> Cancelar</button>
          <button type="button" style={{ ...btn, background: VERDE }} onClick={() => parar(true)} onKeyDown={aoTeclar}><Send size={16} /> Enviar</button>
        </div>
      ) : (
        <button
          type="button"
          aria-label="Segure para gravar a patologia"
          disabled={desabilitado}
          onPointerDown={aoApertar}
          onPointerMove={aoMover}
          onPointerUp={aoSoltar}
          onPointerCancel={aoSoltar}
          onKeyDown={aoTeclar}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            width: 76, height: 76, borderRadius: "50%", border: "none", cursor: desabilitado ? "default" : "pointer",
            background: fase === "gravando" ? (quaseCancelando ? "#9aa5b4" : VERMELHO) : (desabilitado ? "#9aa5b4" : AZUL_MEDIO),
            color: "#fff", display: "grid", placeItems: "center", boxShadow: "0 4px 14px rgba(18,51,91,.25)",
            transform: `translate(${arrasto.dx}px, ${arrasto.dy}px) scale(${fase === "gravando" ? 1.12 : 1})`,
            transition: fase === "gravando" ? "background .15s" : "transform .15s, background .15s",
            /* Sem isto o celular rola a página, seleciona texto ou abre o menu de toque longo
               no meio da gravação. */
            touchAction: "none", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none",
          }}
        >
          {fase === "pedindo" ? <Loader2 size={30} style={{ animation: "spin 1s linear infinite" }} /> : <Mic size={32} />}
        </button>
      )}
      {fase === "travado" && <span style={{ fontSize: 12, color: "#65758b", display: "inline-flex", alignItems: "center", gap: 4 }}><Lock size={12} /> Gravação travada — pode soltar o dedo</span>}
      {fase === "parado" && <span style={{ fontSize: 12.5, color: "#65758b" }}>Segure para gravar</span>}
      {aviso && (
        <div role="alert" style={{ fontSize: 12.5, color: "#7a4e00", background: "#FFF4E0", border: "1px solid #f0c987", borderRadius: 8, padding: "8px 10px", maxWidth: 420, textAlign: "center" }}>
          {aviso}
        </div>
      )}
    </div>
  );
}

/* ---------- Painel na aba da vistoria ---------- */
export function PainelPatologiaVoz({ voz, patologiasBanco = [], ambientes = [], notify, redimensionar, onConfirmado }) {
  const [foto, setFoto] = useState(null); // { dataUrl } nova, ou { url, gravacaoId } para regravar
  const [mostrarRevisadas, setMostrarRevisadas] = useState(false);
  const cameraRef = useRef();
  const galeriaRef = useRef();

  const aoEscolherFoto = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { notify?.("Envie uma imagem (JPG ou PNG)."); return; }
    const leitor = new FileReader();
    leitor.onload = async (e) => {
      const reduzida = redimensionar ? await redimensionar(e.target.result, 1024) : e.target.result;
      setFoto({ dataUrl: reduzida });
    };
    leitor.onerror = () => notify?.("Não foi possível carregar a foto. Tente de novo.");
    leitor.readAsDataURL(file);
  };

  const aoGravar = async ({ blob, duracaoMs }) => {
    try {
      await voz.enviar({ blob, duracaoMs, fotoDataUrl: foto?.dataUrl || null, fotoDeGravacaoId: foto?.gravacaoId || null });
      setFoto(null);
      notify?.("Gravação enviada — pode seguir para a próxima patologia.");
    } catch (e) {
      notify?.(e.message || "Não foi possível preparar a gravação.");
    }
  };

  const regravar = async (item, g) => {
    try {
      if (item) await voz.descartar(item.id);
      setFoto(g.foto ? { url: g.foto, gravacaoId: g.id } : null);
      notify?.("Segure o microfone para gravar de novo — a foto já está anexada.");
      window.scrollTo?.({ top: 0, behavior: "smooth" });
    } catch (e) {
      notify?.(e.message || "Não foi possível descartar o item.");
    }
  };

  const abertas = voz.gravacoes.filter((g) => statusNaTela(g) !== "concluido" || g.itens.some((it) => it.statusRevisao === "pendente_revisao") || !g.itens.length);
  const revisadas = voz.gravacoes.filter((g) => !abertas.includes(g));
  const fotoMostrada = foto?.dataUrl || foto?.url;

  return (
    <div style={{ background: "#fff", border: `1.5px solid ${AZUL_MEDIO}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <style>{"@keyframes fnVozPulso { 0%,100% { opacity: 1 } 50% { opacity: .25 } }"}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Mic size={18} color={AZUL_MEDIO} />
        <strong style={{ fontSize: 15, color: AZUL_MARINHO }}>Patologia por voz</strong>
      </div>
      <p style={{ fontSize: 12.5, color: "#5a6a80", margin: "0 0 12px" }}>
        Anexe a foto, segure o microfone e fale: ambiente, onde, o que é, a medida e se já foi corrigido.
        O item aparece abaixo para você revisar — só entra no laudo depois de confirmado.
      </p>

      <div style={{ display: "flex", gap: 16, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          {fotoMostrada ? (
            <div style={{ position: "relative", width: 92, height: 92, borderRadius: 10, overflow: "hidden", border: `1px solid ${CINZA_BORDA}` }}>
              <img src={fotoMostrada} alt="Foto da patologia" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <button type="button" aria-label="Remover foto" onClick={() => setFoto(null)}
                style={{ position: "absolute", top: 4, right: 4, width: 24, height: 24, borderRadius: "50%", border: "none", background: "rgba(0,0,0,.6)", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }}>
                <X size={13} />
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" style={btnLeve} onClick={() => cameraRef.current?.click()}><Camera size={16} /> Foto</button>
              <button type="button" style={btnLeve} onClick={() => galeriaRef.current?.click()} aria-label="Escolher da galeria"><IconeImagem size={16} /></button>
            </div>
          )}
          <span style={{ fontSize: 11.5, color: "#8a97a8" }}>{fotoMostrada ? "Foto anexada" : "Foto (opcional)"}</span>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
            onChange={(e) => { aoEscolherFoto(e.target.files?.[0]); e.target.value = ""; }} />
          <input ref={galeriaRef} type="file" accept="image/*" style={{ display: "none" }}
            onChange={(e) => { aoEscolherFoto(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
        <BotaoGravarVoz onGravado={aoGravar} />
      </div>

      {(voz.locais.length > 0 || abertas.length > 0) && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {voz.locais.map((l) => (
            <div key={l.idLocal} style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 12, padding: 12, background: CINZA_CLARO }}>
              <CabecalhoGravacao hora={horaDe(l.criadoEm)} duracaoMs={l.duracaoMs}
                status={l.status === "enviando" ? "enviando" : "falha_envio"} />
              {l.status === "enviando" ? (
                <p style={{ fontSize: 12.5, color: "#5a6a80", margin: "6px 0 0" }}>Enviando… pode seguir para a próxima patologia.</p>
              ) : (
                <div style={{ marginTop: 8 }}>
                  <p style={{ fontSize: 12.5, color: VERMELHO, margin: "0 0 8px" }}>{l.erro || "Não foi possível enviar."}</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" style={btn} onClick={() => voz.reenviarLocal(l.idLocal)}><RefreshCcw size={15} /> Tentar enviar de novo</button>
                    <button type="button" style={{ ...btnLeve, color: VERMELHO }} onClick={() => voz.descartarLocal(l.idLocal)}><Trash2 size={15} /> Descartar</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {abertas.map((g) => (
            <CardGravacao key={g.id} g={g} voz={voz} patologiasBanco={patologiasBanco} ambientes={ambientes}
              notify={notify} onConfirmado={onConfirmado} onRegravar={regravar} />
          ))}
        </div>
      )}

      {revisadas.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <button type="button" onClick={() => setMostrarRevisadas((v) => !v)}
            style={{ background: "none", border: "none", color: AZUL_MEDIO, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0 }}>
            {mostrarRevisadas ? "Esconder" : "Mostrar"} gravações já revisadas ({revisadas.length})
          </button>
          {mostrarRevisadas && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
              {revisadas.map((g) => (
                <CardGravacao key={g.id} g={g} voz={voz} patologiasBanco={patologiasBanco} ambientes={ambientes}
                  notify={notify} onConfirmado={onConfirmado} onRegravar={regravar} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CabecalhoGravacao({ hora, duracaoMs, status }) {
  const meta = {
    enviando: { texto: "Enviando", cor: AZUL_MEDIO, fundo: "#EAF2FB", girando: true },
    falha_envio: { texto: "Não enviada", cor: VERMELHO, fundo: "#FDECEC" },
    processando: { texto: "Processando", cor: AZUL_MEDIO, fundo: "#EAF2FB", girando: true },
    erro: { texto: "Erro", cor: VERMELHO, fundo: "#FDECEC" },
    concluido: { texto: "Pronta para revisar", cor: VERDE, fundo: "#E6F4EF" },
  }[status] || { texto: status, cor: "#5a6a80", fundo: CINZA_CLARO };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <Mic size={15} color={AZUL_MARINHO} />
      <strong style={{ fontSize: 13.5, color: AZUL_MARINHO }}>Gravação das {hora}</strong>
      {duracaoMs ? <span style={{ fontSize: 12, color: "#65758b" }}>· {mmss(duracaoMs)}</span> : null}
      <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: meta.cor, background: meta.fundo, padding: "3px 9px", borderRadius: 20 }}>
        {meta.girando && <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />}
        {meta.texto}
      </span>
    </div>
  );
}

function CardGravacao({ g, voz, patologiasBanco, ambientes, notify, onConfirmado, onRegravar }) {
  const [reprocessando, setReprocessando] = useState(false);
  const status = statusNaTela(g);
  const erroNaTela = g.erro || (status === "erro" ? "O processamento parou no meio. Toque em reprocessar — não precisa gravar de novo." : "");

  const reprocessar = async () => {
    setReprocessando(true);
    try { await voz.reprocessar(g.id); } catch (e) { notify?.(e.message || "Não foi possível reprocessar agora."); }
    setReprocessando(false);
  };

  return (
    <div style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 12, padding: 12, background: "#fff" }}>
      <CabecalhoGravacao hora={horaDe(g.criadoEm)} duracaoMs={g.duracaoMs} status={status} />
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
        {g.foto && <img src={g.foto} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, border: `1px solid ${CINZA_BORDA}` }} />}
        {/* preload="none": o áudio só desce quando alguém aperta o play. */}
        <audio controls preload="none" src={g.audioUrl} style={{ flex: 1, minWidth: 200, maxWidth: "100%", height: 36 }} />
      </div>
      {g.transcricao && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ fontSize: 12.5, color: AZUL_MEDIO, cursor: "pointer", fontWeight: 600 }}>Transcrição original</summary>
          <p style={{ fontSize: 13, color: "#33445a", margin: "6px 0 0", fontStyle: "italic" }}>“{g.transcricao}”</p>
          {g.transcricaoProvedor && <p style={{ fontSize: 11, color: "#8a97a8", margin: "4px 0 0" }}>{g.transcricaoProvedor} · {g.transcricaoModelo}{g.iaModelo ? ` · ${g.iaModelo}` : ""}</p>}
        </details>
      )}

      {status === "processando" && (
        <p style={{ fontSize: 12.5, color: "#5a6a80", margin: "8px 0 0" }}>Transcrevendo e montando o item… pode seguir para a próxima patologia.</p>
      )}
      {status === "erro" && (
        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: 12.5, color: VERMELHO, margin: "0 0 8px", display: "flex", gap: 6 }}><AlertTriangle size={15} style={{ flexShrink: 0 }} /> {erroNaTela}</p>
          <button type="button" style={btn} onClick={reprocessar} disabled={reprocessando}>
            <RefreshCcw size={15} /> {reprocessando ? "Reprocessando…" : "Reprocessar"}
          </button>
        </div>
      )}
      {status === "concluido" && g.observacoesGerais && (
        <p style={{ fontSize: 12.5, color: "#7a4e00", background: "#FFF4E0", borderRadius: 8, padding: "6px 9px", margin: "8px 0 0" }}>{g.observacoesGerais}</p>
      )}
      {status === "concluido" && g.itens.length === 0 && (
        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: 12.5, color: "#5a6a80", margin: "0 0 8px" }}>Nenhuma patologia foi identificada nesta fala.</p>
          <button type="button" style={btnLeve} onClick={() => onRegravar(null, g)}><Mic size={15} /> Regravar</button>
        </div>
      )}
      {status === "concluido" && g.itens.map((it) => (
        it.statusRevisao === "pendente_revisao" ? (
          <CardRevisaoVoz key={it.id} item={it} patologiasBanco={patologiasBanco} ambientes={ambientes} notify={notify}
            onConfirmar={async (valores) => { const item = await voz.confirmar(it.id, valores); onConfirmado?.(item); }}
            onDescartar={() => voz.descartar(it.id)}
            onRegravar={() => onRegravar(it, g)} />
        ) : (
          <div key={it.id} style={{ marginTop: 8, fontSize: 12.5, color: it.statusRevisao === "confirmado" ? VERDE : "#8a97a8", display: "flex", alignItems: "center", gap: 6 }}>
            {it.statusRevisao === "confirmado" ? <CheckCircle2 size={15} /> : <Trash2 size={14} />}
            {(it.valoresConfirmados || it.sugestao)?.local || "Sem ambiente"} · {(it.valoresConfirmados || it.sugestao)?.titulo || "sem patologia"} —{" "}
            {it.statusRevisao === "confirmado" ? "confirmado e adicionado ao laudo" : "descartado"}
          </div>
        )
      ))}
    </div>
  );
}

function CardRevisaoVoz({ item, patologiasBanco, ambientes, notify, onConfirmar, onDescartar, onRegravar }) {
  const [v, setV] = useState(() => ({ ...item.sugestao }));
  const [salvando, setSalvando] = useState(false);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);
  const conf = CONFIANCA[item.confianca] || CONFIANCA.baixa;
  const set = (patch) => setV((x) => ({ ...x, ...patch }));

  const opcoes = useMemo(() => [...patologiasBanco].sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR")), [patologiasBanco]);
  /* Trocar a patologia traz do catálogo o que é dele (título, sistema, norma, severidade) e
     mantém a descrição e a recomendação, que são o que o técnico falou. */
  const trocarPatologia = (tipo) => {
    const p = patologiasBanco.find((x) => `bp-${x.id}` === tipo);
    if (!p) { set({ tipo: "", patologia: "", titulo: "" }); return; }
    set({
      tipo, patologia: p.nome, titulo: p.nome, categoria: p.sistema || "",
      norma: [p.norma, p.normasComplementares].filter(Boolean).join("; ") || v.norma,
      severidade: p.severidade || v.severidade,
    });
  };

  const confirmar = async () => {
    if (!v.descricao?.trim()) { notify?.("Preencha a descrição antes de confirmar."); return; }
    setSalvando(true);
    try {
      await onConfirmar(v);
      notify?.("Item confirmado e adicionado ao laudo ✓");
    } catch (e) {
      notify?.(e.message || "Não foi possível confirmar agora.");
      setSalvando(false);
    }
  };
  const descartar = async () => {
    setSalvando(true);
    try { await onDescartar(); } catch (e) { notify?.(e.message || "Não foi possível descartar agora."); setSalvando(false); }
  };

  return (
    <div style={{ marginTop: 10, borderTop: `1px dashed ${CINZA_BORDA}`, paddingTop: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: conf.cor, background: conf.fundo, padding: "3px 9px", borderRadius: 20 }}>{conf.label}</span>
        <span style={{ fontSize: 11.5, color: "#8a97a8" }}>Item {item.ordem + 1}</span>
      </div>
      {item.observacoes && (
        <p style={{ fontSize: 12.5, color: "#7a4e00", background: "#FFF4E0", borderRadius: 8, padding: "6px 9px", margin: "0 0 10px" }}>{item.observacoes}</p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={lab}>Local</span>
          <input list={`voz-locais-${item.id}`} style={inp} value={v.local || ""} onChange={(e) => set({ local: e.target.value })} placeholder="Ex.: Sala" />
          <datalist id={`voz-locais-${item.id}`}>{ambientes.map((a) => <option key={a} value={a} />)}</datalist>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={lab}>Patologia (catálogo)</span>
          <select style={inp} value={v.tipo || ""} onChange={(e) => trocarPatologia(e.target.value)}>
            <option value="">— Selecione —</option>
            {opcoes.map((p) => <option key={p.id} value={`bp-${p.id}`}>{p.nome}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={lab}>Situação</span>
          <select style={inp} value={v.status || "pendente"} onChange={(e) => set({ status: e.target.value })}>
            {STATUS_ITEM.map((s) => <option key={s.valor} value={s.valor}>{s.label}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={lab}>Severidade</span>
          <select style={inp} value={v.severidade || "Média"} onChange={(e) => set({ severidade: e.target.value })}>
            {["Baixa", "Média", "Alta"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1" }}>
          <span style={lab}>Descrição</span>
          <textarea style={{ ...inp, minHeight: 70, resize: "vertical" }} value={v.descricao || ""} onChange={(e) => set({ descricao: e.target.value })} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1" }}>
          <span style={lab}>Recomendação</span>
          <textarea style={{ ...inp, minHeight: 60, resize: "vertical" }} value={v.recomendacao || ""} onChange={(e) => set({ recomendacao: e.target.value })} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1" }}>
          <span style={lab}>Norma</span>
          <input style={inp} value={v.norma || ""} onChange={(e) => set({ norma: e.target.value })} />
        </label>
      </div>
      {item.extra?.causa && (
        <p style={{ fontSize: 12, color: "#5a6a80", margin: "8px 0 0" }}>
          <strong>Causa provável</strong> ({ORIGEM_TEXTO[item.extra.origemCausa] || "a confirmar"}): {item.extra.causa}
          <span style={{ color: "#8a97a8" }}> — só para a revisão, não entra no laudo.</span>
        </p>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button type="button" style={{ ...btn, background: VERDE, flex: "1 1 140px" }} onClick={confirmar} disabled={salvando}>
          <CheckCircle2 size={16} /> {salvando ? "Salvando…" : "Confirmar"}
        </button>
        <button type="button" style={{ ...btnLeve, flex: "1 1 120px" }} onClick={onRegravar} disabled={salvando}><Mic size={15} /> Regravar</button>
        {confirmandoDescarte ? (
          <button type="button" style={{ ...btn, background: VERMELHO, flex: "1 1 140px" }} onClick={descartar} disabled={salvando}>
            <Trash2 size={15} /> Confirmar descarte
          </button>
        ) : (
          <button type="button" style={{ ...btnLeve, color: VERMELHO, flex: "1 1 120px" }} onClick={() => setConfirmandoDescarte(true)} disabled={salvando}>
            <Trash2 size={15} /> Descartar
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- Aviso no "Enviar para gerência" ----------
   Só item confirmado entra no laudo. Se ainda há gravação ou item por revisar, o técnico vê a
   lista antes de enviar e decide: voltar e revisar, ou enviar sem eles. */
export function AvisoPendentesVoz({ pendentes = [], onVoltar, onEnviarMesmoAssim }) {
  return (
    <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(10,25,45,.55)", display: "grid", placeItems: "center", zIndex: 1000, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 20, maxWidth: 480, width: "100%", maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <AlertTriangle size={20} color={AMBAR} />
          <strong style={{ fontSize: 16, color: AZUL_MARINHO }}>Há patologias por voz não revisadas</strong>
        </div>
        <p style={{ fontSize: 13, color: "#5a6a80", margin: "0 0 10px" }}>
          Só entra no laudo o que foi confirmado. Estas ainda não estão nele:
        </p>
        <ul style={{ margin: "0 0 16px", paddingLeft: 18, fontSize: 13, color: "#33445a", display: "flex", flexDirection: "column", gap: 4 }}>
          {pendentes.map((p, i) => <li key={i}>{p}</li>)}
        </ul>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button type="button" style={btnLeve} onClick={onEnviarMesmoAssim}>Enviar sem elas</button>
          <button type="button" style={btn} onClick={onVoltar}>Voltar e revisar</button>
        </div>
      </div>
    </div>
  );
}
