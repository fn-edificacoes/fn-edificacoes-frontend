import React, { useState, useEffect, useRef } from "react";
import {
  FileText, Plus, Trash2, Camera, X, Printer, Save, FolderOpen,
  Building2, User, ClipboardList, ChevronDown, ChevronRight, Check,
  AlertTriangle, CircleAlert, Info, Copy, Sparkles, Loader2,
  ClipboardCheck, BarChart3, DollarSign, Users, Edit3, RefreshCcw, Filter, LayoutGrid
} from "lucide-react";

/* ============================================================
   FN EDIFICAÇÕES — Gerador de Laudos (protótipo)
   Cores da marca: Azul Médio #2C75B5 / Azul Marinho #12335B
   ============================================================ */

const AZUL_MEDIO = "#2C75B5";
const AZUL_MARINHO = "#12335B";
const CINZA_CLARO = "#F1F4F8";
const CINZA_BORDA = "#D8DEE7";

/* ---------- Backend (API real, com login) ---------- */
// Troque pela URL do seu serviço no Render, se for diferente:
const API_URL = "https://fn-edificacoes-api.onrender.com";

async function apiFetch(caminho, { method = "GET", body, token } = {}) {
  const resp = await fetch(`${API_URL}${caminho}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let dados = null;
  try { dados = await resp.json(); } catch { /* resposta vazia */ }
  if (!resp.ok) throw new Error(dados?.erro || `Erro ${resp.status}`);
  return dados;
}

/* Converte um registro de Documentação vindo do banco (snake_case) para o formato usado no app (camelCase) */
function mapDocDaApi(d) {
  return {
    id: d.id, cliente: d.cliente || "", cpf: d.cpf || "", empreendimento: d.empreendimento || "",
    complemento: d.complemento || "", data: d.data || "", hora: d.hora || "",
    pagamento: d.pagamento || "Pendente", valorVistoria: d.valor_vistoria ?? 0, valorTrt: d.valor_trt ?? 0,
    vistoria: d.vistoria || "Agendada", art: d.art || "Não solicitada", tipoArt: d.tipo_art || "Individual",
    relatorio: d.relatorio || "Pendente", observacoes: d.observacoes || "",
  };
}
/* Converte um cadastro de Cliente vindo do banco (snake_case) para o formato usado no app (camelCase) */
function mapClienteDaApi(c) {
  return {
    id: c.id, nome: c.nome || "", cpf: c.cpf || "", telefone: c.telefone || "", email: c.email || "",
    construtora: c.construtora || "", empreendimento: c.empreendimento || "", complemento: c.complemento || "",
    servico: c.servico || "", dataDesejada: c.data_desejada || "", horarioDesejado: c.horario_desejado || "",
    observacoes: c.observacoes || "", atendido: !!c.atendido,
  };
}
const LOGO_FN_BASE64 = "data:image/png;base64,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";

/* ---------- Banco de Patologias (autopreenchimento) ---------- */
const BANCO = {
  rejunte: {
    label: "Rejunte",
    sev: "Média",
    desc: "Verifica-se a execução irregular e desuniforme do rejuntamento cerâmico, apresentando falhas de preenchimento, variação de espessura e acabamento inadequado nas juntas entre as peças.",
    rec: "Recomenda-se a remoção do rejunte comprometido e a reaplicação com produto adequado, garantindo preenchimento uniforme, alinhamento e vedação das juntas conforme boas práticas construtivas.",
  },
  pintura: {
    label: "Pintura",
    sev: "Baixa",
    desc: "Verifica-se acabamento de pintura executado de forma irregular e desuniforme, com presença de manchas, variação de tonalidade, escorrimentos e cobertura insuficiente da superfície.",
    rec: "Recomenda-se a correção do substrato e a reaplicação da pintura em demãos uniformes, assegurando cobertura homogênea e acabamento conforme especificação do memorial descritivo.",
  },
  gesso: {
    label: "Gesso / Forro",
    sev: "Média",
    desc: "Verifica-se a execução irregular do revestimento em gesso, apresentando fissuras superficiais, desníveis e acabamento desuniforme nas juntas e emendas.",
    rec: "Recomenda-se o tratamento das juntas, a correção dos desníveis e a regularização do acabamento, garantindo planicidade e uniformidade da superfície.",
  },
  silicone: {
    label: "Silicone / Vedação",
    sev: "Média",
    desc: "Verifica-se aplicação irregular de silicone/vedante, com cordão descontínuo, excesso de material e falhas de aderência que comprometem a estanqueidade da junta.",
    rec: "Recomenda-se a remoção do vedante existente e a reaplicação de cordão contínuo e uniforme, assegurando a estanqueidade e o acabamento adequado da junta.",
  },
  porta: {
    label: "Portas / Fechaduras",
    sev: "Média",
    desc: "Verifica-se funcionamento inadequado do conjunto de porta, apresentando desalinhamento, folga excessiva e/ou fechadura com acionamento irregular.",
    rec: "Recomenda-se o ajuste do batente e das dobradiças, bem como a regulagem ou substituição da fechadura, garantindo o correto funcionamento e travamento.",
  },
  alizar: {
    label: "Alizares / Guarnições",
    sev: "Baixa",
    desc: "Verifica-se instalação irregular dos alizares/guarnições, com desalinhamento, frestas e fixação inadequada em relação ao vão.",
    rec: "Recomenda-se o reassentamento das guarnições, corrigindo o alinhamento e a fixação, com vedação das frestas remanescentes.",
  },
  esquadria: {
    label: "Esquadrias",
    sev: "Média",
    desc: "Verifica-se irregularidade na instalação da esquadria, com aplicação inadequada de PU/vedação ao redor do vão, folgas e acabamento comprometido.",
    rec: "Recomenda-se a correção da fixação e da vedação perimetral da esquadria, assegurando estanqueidade, alinhamento e funcionamento adequado das folhas.",
  },
  vidro: {
    label: "Vidros",
    sev: "Média",
    desc: "Verifica-se a presença de vidro trincado/riscado e/ou fixação inadequada, com folgas nos baguetes e comprometimento da vedação.",
    rec: "Recomenda-se a substituição da peça danificada e a correção da fixação e vedação, conforme especificação técnica.",
  },
  pedra: {
    label: "Pedras / Bancadas",
    sev: "Média",
    desc: "Verifica-se dano na superfície da pedra (bancada/soleira/peitoril), com trincas, lascas ou riscos que comprometem a integridade e o acabamento.",
    rec: "Recomenda-se o reparo ou a substituição da peça comprometida, garantindo nivelamento, acabamento e adequada fixação.",
  },
  vazamento: {
    label: "Vazamentos",
    sev: "Alta",
    desc: "Verifica-se a ocorrência de vazamento na instalação hidráulica, evidenciado por umidade, gotejamento e/ou manchas nas superfícies adjacentes ao ponto.",
    rec: "Recomenda-se a identificação e correção imediata do ponto de vazamento, com teste de estanqueidade e recuperação das áreas afetadas.",
  },
  registro: {
    label: "Registros / Metais",
    sev: "Média",
    desc: "Verifica-se funcionamento inadequado do registro/metal sanitário, apresentando vazamento, dificuldade de acionamento e/ou fixação insuficiente.",
    rec: "Recomenda-se o ajuste, reaperto ou substituição do componente, assegurando vedação e correto funcionamento.",
  },
  sifao: {
    label: "Sifões",
    sev: "Média",
    desc: "Verifica-se instalação inadequada do sifão, com ausência de fecho hídrico eficiente e/ou vazamentos nas conexões.",
    rec: "Recomenda-se a correção da instalação do sifão, garantindo a vedação das conexões e o adequado fecho hídrico.",
  },
  ralo: {
    label: "Ralos",
    sev: "Média",
    desc: "Verifica-se execução irregular ao redor do ralo, com caimento inadequado, rejunte deficiente e/ou vedação comprometida, favorecendo o acúmulo de água.",
    rec: "Recomenda-se a correção do caimento e da vedação ao redor do ralo, assegurando o adequado escoamento e a estanqueidade da região.",
  },
  quadro: {
    label: "Quadro Elétrico",
    sev: "Alta",
    desc: "Verifica-se irregularidade no quadro de distribuição, com identificação insuficiente dos circuitos, fixação inadequada e/ou ausência de dispositivos de proteção conforme previsto.",
    rec: "Recomenda-se a adequação do quadro elétrico, com identificação dos circuitos e verificação dos dispositivos de proteção conforme as normas vigentes.",
  },
  tomada: {
    label: "Tomadas / Interruptores",
    sev: "Média",
    desc: "Verifica-se instalação inadequada de tomada/interruptor, com fixação insuficiente, desalinhamento e/ou funcionamento irregular.",
    rec: "Recomenda-se a correção da fixação e a verificação do funcionamento do dispositivo, assegurando conformidade e segurança da instalação.",
  },
  ferrugem: {
    label: "Ferrugem / Oxidação",
    sev: "Média",
    desc: "Verifica-se a presença de processo de oxidação/ferrugem em elemento metálico, com comprometimento superficial e risco de evolução do quadro.",
    rec: "Recomenda-se o tratamento da superfície oxidada, com remoção da ferrugem e aplicação de proteção anticorrosiva adequada.",
  },
  fissura: {
    label: "Fissuras",
    sev: "Média",
    desc: "Verifica-se a presença de fissuras no revestimento/alvenaria, com abertura reduzida, decorrentes de acomodação e/ou movimentação dos elementos construtivos.",
    rec: "Recomenda-se o monitoramento e o tratamento das fissuras com material adequado, prevenindo infiltrações e a evolução do quadro patológico.",
  },
  trinca: {
    label: "Trincas",
    sev: "Alta",
    desc: "Verifica-se a presença de trincas com abertura significativa no elemento construtivo, indicando possível esforço estrutural ou movimentação relevante.",
    rec: "Recomenda-se avaliação técnica específica para identificação da causa, com posterior tratamento e monitoramento da manifestação.",
  },
  infiltracao: {
    label: "Infiltrações",
    sev: "Alta",
    desc: "Verifica-se a ocorrência de infiltração, evidenciada por manchas de umidade, eflorescências e/ou desprendimento de revestimento na região afetada.",
    rec: "Recomenda-se a identificação da origem da infiltração e a execução dos reparos de impermeabilização, com recuperação das áreas comprometidas.",
  },
  impermeabilizacao: {
    label: "Impermeabilização",
    sev: "Alta",
    desc: "Verifica-se deficiência na impermeabilização da área, com sinais de umidade e comprometimento da estanqueidade do sistema.",
    rec: "Recomenda-se a revisão e/ou refação da impermeabilização conforme o sistema especificado, garantindo a estanqueidade da área.",
  },
  outro: { label: "Outro (personalizado)", sev: "Média", desc: "Verifica-se ", rec: "Recomenda-se " },
};

const LOCAIS = ["Sala", "Cozinha", "Área de Serviço", "Quarto 01", "Quarto 02", "Suíte", "Banheiro Social", "Banheiro Suíte", "Lavabo", "Varanda", "Circulação", "Fachada"];

const TEXTOS_PADRAO = {
  objetivo:
    "Avaliar se o imóvel entregue pela construtora está em conformidade com as características e especificações presentes no Memorial Descritivo de Construção. O principal objetivo é certificar que o imóvel está sendo entregue com qualidade e em perfeitas condições, visando resguardar de responsabilidade o(a) proprietário(a) de vícios construtivos aparentes e solicitar à construtora, se necessário, a correção das anomalias para efetivação da entrega do imóvel.",
  referencias:
    "Este Laudo Técnico de Vistoria foi elaborado a partir da observação do atendimento das boas práticas construtivas e com base nos seguintes documentos: ABNT NBR 13752:1996 – Perícias de engenharia na construção civil; Memorial Descritivo de Construção.",
  metodologia:
    "Foi realizada a vistoria in loco objetivando avaliar as características e especificações construtivas do imóvel, por meio de análise visual dos elementos construtivos acabados e testes de desempenho, quando aplicável. Os vícios aparentes identificados foram sinalizados com etiqueta de identificação e registrados por meio de fotografias e descrição dos problemas observados. O presente relatório não visa à identificação de vícios ocultos.",
  encerramento:
    "Todas as informações contidas neste documento são verdadeiras. Este é um trabalho isento e ético, atendendo às determinações das Resoluções do Conselho Federal dos Técnicos Industriais (CFT) e demais normas aplicáveis. O responsável técnico pela elaboração deste laudo se coloca à disposição para quaisquer esclarecimentos adicionais que se fizerem necessários.",
};

const DADOS_INICIAIS = {
  contratante: { nome: "", cpf: "" },
  imovel: { construtora: "", empreendimento: "", endereco: "", unidade: "", descricao: "" },
  rt: { nome: "ANTONIO FELIPE NEVES BARBOSA", qualificacao: "Técnico em Edificações / Eletrotécnico", registro: "CFT-03 nº 09753183496" },
  vistoria: { data: "", inicio: "", termino: "", presentes: "", cidade: "Paulista - PE" },
  textos: { ...TEXTOS_PADRAO },
};

const sevMeta = {
  Baixa: { cor: "#2E7D32", bg: "#E6F4EA", icon: Info },
  Média: { cor: "#B26A00", bg: "#FFF4E0", icon: CircleAlert },
  Alta: { cor: "#C62828", bg: "#FCEAEA", icon: AlertTriangle },
};

let idCounter = 1;
const novoItem = () => ({ id: idCounter++, local: "", tipo: "", patologia: "", severidade: "Média", descricao: "", recomendacao: "", nota: "", fotos: [] });

/* ---------- Documentação / Gerência (registro de vistorias e TRT) ---------- */

const PAGAMENTO_OPCOES = ["Pendente", "Pago", "Parcial"];
const VISTORIA_OPCOES = ["Agendada", "Concluída", "Cancelada"];
const ART_OPCOES = ["Não solicitada", "Em processo", "Elaborada"];
const TIPO_ART_OPCOES = ["Individual", "Coletiva"];
const RELATORIO_OPCOES = ["Pendente", "Em processo", "Entregue"];

/* ---------- Perfis de acesso (agora definidos pelo backend/login, não escolhidos na tela) ----------
   vistoriador   -> só enxerga o módulo Laudos (não vê Documentação nem Gerência)
   documentacao  -> só enxerga o módulo Documentação
   gerencia      -> acesso restrito, mas enxerga tudo (Laudos + Documentação + Gerência, incl. financeiro)
   O cadastro/acompanhamento de Cliente agora é uma tela pública separada, sem login.
------------------------------------------------------------------ */
const MODULOS_POR_PERFIL = {
  vistoriador: ["laudos"],
  documentacao: ["documentacao"],
  gerencia: ["laudos", "documentacao", "gerencia"],
};
const PERFIL_LABEL = { vistoriador: "Vistoriador", documentacao: "Documentação", gerencia: "Gerência" };

const novoRegistroDoc = () => ({
  id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  cliente: "", cpf: "", empreendimento: "", complemento: "", data: "", hora: "",
  pagamento: "Pendente", valorVistoria: "", valorTrt: "",
  vistoria: "Agendada", art: "Não solicitada", tipoArt: "Individual",
  relatorio: "Pendente", observacoes: "",
});

/* ---------- Cliente (autocadastro e acompanhamento) ---------- */
const SERVICO_OPCOES = ["Vistoria de entrega de chaves", "Laudo técnico / TRT", "Outro"];

const novoCadastroCliente = () => ({
  id: `cli_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  nome: "", cpf: "", telefone: "", email: "",
  construtora: "", empreendimento: "", complemento: "",
  servico: SERVICO_OPCOES[0], dataDesejada: "", horarioDesejado: "", observacoes: "",
  atendido: false,
  criadoEm: new Date().toISOString(),
});

/* ---------- IA redatora da FN (Claude na nuvem) ---------- */
const SYSTEM_FN = `Você é o redator técnico oficial da FN Edificações, especialista em engenharia diagnóstica e vistorias imobiliárias.
A partir da(s) foto(s) e/ou anotação de uma não conformidade, produza o registro técnico no padrão da FN.

Regras de redação: linguagem técnica, objetiva, impessoal, em norma culta, sem opiniões nem linguagem informal.
A "descricao" deve OBRIGATORIAMENTE iniciar por "Verifica-se". A "recomendacao" deve OBRIGATORIAMENTE iniciar por "Recomenda-se".
Não invente detalhes que não estejam visíveis na foto ou na anotação. Seja conciso (2 a 4 linhas por campo).

Classifique a "severidade" exatamente como uma destas: Baixa, Média ou Alta.
Em "patologia", use um rótulo curto. Patologias recorrentes: Rejunte, Pintura, Gesso, Silicone, Portas/Fechaduras, Alizares, Esquadrias, Vidros, Pedras, Vazamentos, Registros, Sifões, Ralos, Quadro Elétrico, Tomadas, Ferrugem/Oxidação, Fissuras, Trincas, Infiltrações, Impermeabilização.

Responda EXCLUSIVAMENTE com um objeto JSON válido, sem markdown, sem cercas de código, sem comentários, no formato exato:
{"patologia":"...","severidade":"Baixa","descricao":"Verifica-se...","recomendacao":"Recomenda-se..."}`;

async function redimensionar(dataUrl, max = 1024) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > max || height > max) { const r = Math.min(max / width, max / height); width = Math.round(width * r); height = Math.round(height * r); }
      const c = document.createElement("canvas"); c.width = width; c.height = height;
      c.getContext("2d").drawImage(img, 0, 0, width, height);
      resolve(c.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function gerarComIA({ nota, fotos, local }) {
  const content = [];
  for (const f of fotos.slice(0, 2)) {
    const r = await redimensionar(f);
    const [meta, b64] = r.split(",");
    const media = (meta.match(/data:(.*?);/) || [])[1] || "image/jpeg";
    content.push({ type: "image", source: { type: "base64", media_type: media, data: b64 } });
  }
  content.push({ type: "text", text: `Local: ${local || "não informado"}. Anotação do vistoriador: ${nota || "(sem anotação — analise a foto)"}. Gere o registro técnico da não conformidade no padrão FN.` });

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, system: SYSTEM_FN, messages: [{ role: "user", content }] }),
  });
  if (!resp.ok) throw new Error("Falha na chamada da IA (" + resp.status + ")");
  const data = await resp.json();
  const texto = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").replace(/```json|```/g, "").trim();
  const jsonStr = texto.slice(texto.indexOf("{"), texto.lastIndexOf("}") + 1);
  return JSON.parse(jsonStr);
}

/* ================= Componente principal ================= */
/* ================= Login da equipe ================= */
function TelaLogin({ onLogin, onVoltar }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const entrar = async () => {
    if (!email || !senha) { setErro("Informe e-mail e senha."); return; }
    setErro(""); setCarregando(true);
    try {
      const r = await apiFetch("/api/auth/login", { method: "POST", body: { email, senha } });
      onLogin({ token: r.token, usuario: r.usuario });
    } catch (e2) {
      setErro(e2.message === "Failed to fetch" ? "Não foi possível conectar à API. Verifique sua internet ou tente novamente em instantes (o servidor pode estar acordando)." : e2.message);
    }
    setCarregando(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: CINZA_CLARO, display: "grid", placeItems: "center", padding: 18, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "32px 30px", width: "100%", maxWidth: 380, boxShadow: "0 10px 30px rgba(18,51,91,.12)" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <img src={LOGO_FN_BASE64} alt="FN Edificações" style={{ height: 64 }} />
        </div>
        <h2 style={{ textAlign: "center", color: AZUL_MARINHO, fontSize: 18, margin: "0 0 4px" }}>Entrar no sistema</h2>
        <p style={{ textAlign: "center", color: "#65758b", fontSize: 13, margin: "0 0 20px" }}>Acesso da equipe FN Edificações</p>

        <div style={cell(true)}>
          <label style={lab}>E-mail</label>
          <input style={inp} type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && entrar()} autoFocus />
        </div>
        <div style={{ ...cell(true), marginTop: 12 }}>
          <label style={lab}>Senha</label>
          <input style={inp} type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && entrar()} />
        </div>

        {erro && (
          <div style={{ marginTop: 12, background: "#FCEAEA", color: "#C62828", padding: "9px 12px", borderRadius: 8, fontSize: 12.5 }}>{erro}</div>
        )}

        <button type="button" className="btn-solid" style={{ width: "100%", justifyContent: "center", marginTop: 18, padding: "11px" }} disabled={carregando} onClick={entrar}>
          {carregando ? <><Loader2 size={15} className="spin" /> Entrando…</> : "Entrar"}
        </button>

        <button type="button" onClick={onVoltar} style={{ width: "100%", marginTop: 14, background: "none", border: "none", color: AZUL_MEDIO, fontSize: 13, cursor: "pointer" }}>
          ← Sou cliente, quero me cadastrar ou acompanhar meu atendimento
        </button>
      </div>
    </div>
  );
}

/* ================= Portal público do cliente (sem login) ================= */
function PortalCliente({ onIrParaLogin }) {
  const [toast, setToast] = useState("");
  const notify = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };

  return (
    <div style={{ minHeight: "100vh", background: CINZA_CLARO, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <header style={{ background: AZUL_MARINHO, color: "#fff" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 18px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: "#fff", display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0 }}>
            <img src={LOGO_FN_BASE64} alt="FN Edificações" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <div style={{ lineHeight: 1.1, flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>FN Edificações</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>Área do Cliente</div>
          </div>
          <button className="btn-ghost" onClick={onIrParaLogin}>Sou da equipe →</button>
        </div>
      </header>
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "22px 18px 80px" }}>
        <AbaCliente notify={notify} />
      </main>
      {toast && (
        <div className="no-print" style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: AZUL_MARINHO, color: "#fff", padding: "10px 18px", borderRadius: 10, fontSize: 13.5, boxShadow: "0 6px 20px rgba(0,0,0,.2)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}

/* ================= App: decide entre Portal do Cliente, Login e App interno ================= */
export default function App() {
  const [session, setSession] = useState(null); // { token, usuario }
  const [mostrarLogin, setMostrarLogin] = useState(false);

  if (!session) {
    return mostrarLogin
      ? <TelaLogin onLogin={setSession} onVoltar={() => setMostrarLogin(false)} />
      : <PortalCliente onIrParaLogin={() => setMostrarLogin(true)} />;
  }
  return <AppInterno session={session} onLogout={() => { setSession(null); setMostrarLogin(false); }} />;
}

function AppInterno({ session, onLogout }) {
  const perfil = session.usuario.role; // definido pelo backend/login — não é mais escolhido na tela
  const token = session.token;
  const [abaTop, setAbaTop] = useState("laudos"); // "laudos" | "documentacao" | "gerencia"
  const [aba, setAba] = useState("dados");
  const [dados, setDados] = useState(DADOS_INICIAIS);
  const [itens, setItens] = useState([novoItem()]);
  const [rascunhos, setRascunhos] = useState([]);
  const [toast, setToast] = useState("");
  const [showLoad, setShowLoad] = useState(false);

  const modulosPermitidos = MODULOS_POR_PERFIL[perfil] || [];
  useEffect(() => {
    if (!modulosPermitidos.includes(abaTop)) setAbaTop(modulosPermitidos[0]);
  }, [perfil]);

  const [docs, setDocs] = useState([]);
  const [docsCarregando, setDocsCarregando] = useState(false);

  const notify = (m) => { setToast(m); setTimeout(() => setToast(""), 2200); };

  /* ---- Documentação/Gerência: carregar e persistir via API real ---- */
  const podeVerDocs = perfil === "gerencia" || perfil === "documentacao";
  const carregarDocs = async () => {
    if (!podeVerDocs) return;
    setDocsCarregando(true);
    try {
      const r = await apiFetch("/api/docs", { token });
      setDocs((r.docs || []).map(mapDocDaApi));
    } catch (e) { notify(`Não foi possível carregar Documentação: ${e.message}`); }
    setDocsCarregando(false);
  };
  useEffect(() => { carregarDocs(); }, []);

  const addDoc = async (registro) => {
    try {
      const r = await apiFetch("/api/docs", { method: "POST", token, body: registro });
      setDocs((atual) => [{ ...registro, id: r.id }, ...atual]);
    } catch (e) { notify(`Não foi possível salvar: ${e.message}`); }
  };
  const updDoc = async (id, patch) => {
    setDocs((atual) => atual.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    try { await apiFetch(`/api/docs/${id}`, { method: "PATCH", token, body: patch }); }
    catch (e) { notify(`Não foi possível atualizar: ${e.message}`); }
  };
  const delDoc = async (id) => {
    setDocs((atual) => atual.filter((d) => d.id !== id));
    try { await apiFetch(`/api/docs/${id}`, { method: "DELETE", token }); }
    catch (e) { notify(`Não foi possível excluir: ${e.message}`); }
  };

  /* ---- Cliente: cadastros (lidos via API — cadastro em si acontece na tela pública, sem login) ---- */
  const [clientes, setClientes] = useState([]);
  const carregarClientes = async () => {
    try {
      const r = await apiFetch("/api/clientes", { token });
      setClientes((r.clientes || []).map(mapClienteDaApi));
    } catch (e) { notify(`Não foi possível carregar clientes: ${e.message}`); }
  };
  useEffect(() => { carregarClientes(); }, []);
  const updCliente = async (id, patch) => {
    setClientes((atual) => atual.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    try { await apiFetch(`/api/clientes/${id}`, { method: "PATCH", token, body: patch }); }
    catch (e) { notify(`Não foi possível atualizar cliente: ${e.message}`); }
  };

  /* ---- Assinatura digital da Gerência (via API real) ---- */
  const [assinatura, setAssinatura] = useState(null); // { imagem, nome }
  const carregarAssinatura = async () => {
    try {
      const r = await apiFetch("/api/assinatura", { token });
      setAssinatura(r.assinatura || null);
    } catch { setAssinatura(null); }
  };
  useEffect(() => { carregarAssinatura(); }, []);
  const salvarAssinatura = async (obj) => {
    setAssinatura(obj);
    try { await apiFetch("/api/assinatura", { method: "POST", token, body: obj }); notify("Assinatura da Gerência atualizada ✓"); }
    catch (e) { notify(`Não foi possível salvar a assinatura: ${e.message}`); }
  };
  const removerAssinatura = async () => {
    setAssinatura(null);
    try { await apiFetch("/api/assinatura", { method: "DELETE", token }); } catch {}
  };

  /* ---- Gerenciar usuários da equipe (somente perfil Gerência) ---- */
  const [usuarios, setUsuarios] = useState([]);
  const [usuariosCarregando, setUsuariosCarregando] = useState(false);
  const carregarUsuarios = async () => {
    if (perfil !== "gerencia") return;
    setUsuariosCarregando(true);
    try {
      const r = await apiFetch("/api/users", { token });
      setUsuarios(r.usuarios || []);
    } catch (e) { notify(`Não foi possível carregar usuários: ${e.message}`); }
    setUsuariosCarregando(false);
  };
  useEffect(() => { carregarUsuarios(); }, []);

  const criarUsuario = async (dadosUsuario) => {
    await apiFetch("/api/users", { method: "POST", token, body: dadosUsuario });
    notify("Usuário criado ✓");
    carregarUsuarios();
  };
  const atualizarUsuario = async (id, patch) => {
    await apiFetch(`/api/users/${id}`, { method: "PATCH", token, body: patch });
    notify("Usuário atualizado ✓");
    carregarUsuarios();
  };
  const excluirUsuario = async (id) => {
    await apiFetch(`/api/users/${id}`, { method: "DELETE", token });
    notify("Usuário removido ✓");
    carregarUsuarios();
  };

  const preencherComCliente = (cli, { irParaItens = false } = {}) => {
    if (!cli) return;
    setDados((d) => ({
      ...d,
      contratante: { ...d.contratante, nome: cli.nome || d.contratante.nome, cpf: cli.cpf || d.contratante.cpf },
      imovel: { ...d.imovel, construtora: cli.construtora || d.imovel.construtora, empreendimento: cli.empreendimento || d.imovel.empreendimento, unidade: cli.complemento || d.imovel.unidade },
      vistoria: { ...d.vistoria, data: cli.dataDesejada || d.vistoria.data },
    }));
    if (!cli.atendido) updCliente(cli.id, { atendido: true });
    if (irParaItens) { setAbaTop("laudos"); setAba("itens"); }
    notify("Dados do cliente aplicados ao laudo ✓");
  };

  /* ---- rascunhos de laudo em andamento: guardados só neste navegador (não vão para o banco da equipe) ---- */
  const temStorage = typeof window !== "undefined" && window.storage;
  const listarRascunhos = async () => {
    if (!temStorage) return;
    try {
      const r = await window.storage.list("fn_laudo:");
      setRascunhos(r?.keys || []);
    } catch { setRascunhos([]); }
  };
  useEffect(() => { listarRascunhos(); }, []);

  const salvarRascunho = async () => {
    const nome = dados.contratante.nome?.trim() || dados.imovel.empreendimento?.trim() || "Sem nome";
    const key = `fn_laudo:${Date.now()}`;
    const payload = { nome, dados, itens: itens.map(({ fotos, ...r }) => ({ ...r, nFotos: fotos.length })) };
    if (!temStorage) { notify("Rascunho salvo nesta sessão"); return; }
    try {
      await window.storage.set(key, JSON.stringify(payload));
      notify("Rascunho salvo ✓");
      listarRascunhos();
    } catch { notify("Não foi possível salvar o rascunho"); }
  };

  const carregar = async (key) => {
    try {
      const r = await window.storage.get(key);
      const p = JSON.parse(r.value);
      setDados(p.dados);
      setItens((p.itens || []).map((i) => ({ ...i, id: idCounter++, fotos: [] })));
      setShowLoad(false);
      notify("Rascunho carregado (refaça o upload das fotos)");
    } catch { notify("Falha ao carregar"); }
  };
  const excluirRascunho = async (key) => {
    try { await window.storage.delete(key); listarRascunhos(); } catch {}
  };

  /* ---- helpers de estado ---- */
  const setD = (grupo, campo, val) => setDados((d) => ({ ...d, [grupo]: { ...d[grupo], [campo]: val } }));
  const setTexto = (campo, val) => setDados((d) => ({ ...d, textos: { ...d.textos, [campo]: val } }));


  const updItem = (id, patch) => setItens((l) => l.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const escolherPatologia = (id, tipo) => {
    const b = BANCO[tipo];
    if (!b) return updItem(id, { tipo, patologia: "" });
    updItem(id, { tipo, patologia: b.label, severidade: b.sev, descricao: b.desc, recomendacao: b.rec });
  };
  const addFotos = (id, fileList) => {
    const item = itens.find((i) => i.id === id);
    const espaco = 4 - item.fotos.length;
    const files = Array.from(fileList).slice(0, espaco);
    files.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (e) => updItem(id, { fotos: [...(itens.find((x) => x.id === id)?.fotos || item.fotos), e.target.result] });
      reader.readAsDataURL(f);
    });
  };
  const removerFoto = (id, idx) => {
    const item = itens.find((i) => i.id === id);
    updItem(id, { fotos: item.fotos.filter((_, k) => k !== idx) });
  };

  const contagem = { Baixa: 0, Média: 0, Alta: 0 };
  itens.forEach((i) => { if (i.tipo) contagem[i.severidade]++; });
  const totalItens = itens.filter((i) => i.tipo).length;

  const imprimir = () => window.print();

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: "#1a2330", background: CINZA_CLARO, minHeight: "100vh" }}>
      <style>{estilos}</style>

      {/* ---------------- Barra superior ---------------- */}
      <header className="no-print" style={{ background: AZUL_MARINHO, color: "#fff", position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "12px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 9, background: "#fff", display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0 }}>
              <img src={LOGO_FN_BASE64} alt="FN Edificações" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
            <div style={{ lineHeight: 1.1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>FN Edificações</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>Sistema FN · v1.2</div>
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
            <div style={{ textAlign: "right", lineHeight: 1.2 }}>
              <div style={{ fontWeight: 700 }}>{session.usuario.nome}</div>
              <div style={{ opacity: 0.7 }}>{PERFIL_LABEL[perfil] || perfil}</div>
            </div>
            <button className="btn-ghost" onClick={onLogout} title="Sair"><X size={14} /> Sair</button>
          </div>
          {abaTop === "laudos" && (
            <>
              <button className="btn-ghost" onClick={() => { setShowLoad(true); listarRascunhos(); }}><FolderOpen size={15} /> Abrir</button>
              <button className="btn-ghost" onClick={salvarRascunho}><Save size={15} /> Salvar</button>
              <button className="btn-solid" onClick={() => { setAba("laudo"); setTimeout(imprimir, 300); }}><Printer size={15} /> Gerar PDF</button>
            </>
          )}
          {abaTop === "documentacao" && (
            <button className="btn-solid" onClick={() => addDoc(novoRegistroDoc())}><Plus size={15} /> Novo registro</button>
          )}
          {abaTop === "gerencia" && (
            <button className="btn-ghost" onClick={carregarDocs}><RefreshCcw size={15} className={docsCarregando ? "spin" : ""} /> Atualizar</button>
          )}
        </div>

        {/* Navegação de módulos (filtrada pelo perfil de acesso) */}
        <nav style={{ maxWidth: 1080, margin: "0 auto", padding: "0 18px", display: "flex", gap: 4, borderTop: "1px solid rgba(255,255,255,.12)" }}>
          {[["laudos", "Laudos", FileText], ["documentacao", "Documentação", ClipboardCheck], ["gerencia", "Gerência", BarChart3]]
            .filter(([k]) => modulosPermitidos.includes(k))
            .map(([k, label, Icon]) => (
              <button key={k} onClick={() => setAbaTop(k)} className="tab" style={{ borderBottomColor: abaTop === k ? "#fff" : "transparent", color: abaTop === k ? "#fff" : "rgba(255,255,255,.55)" }}>
                <Icon size={15} /> {label}
              </button>
            ))}
        </nav>

        {/* Sub-navegação (somente dentro do módulo Laudos) */}
        {abaTop === "laudos" && (
          <nav style={{ maxWidth: 1080, margin: "0 auto", padding: "0 18px", display: "flex", gap: 4, background: "rgba(0,0,0,.12)" }}>
            {[["dados", "Dados do laudo", ClipboardList], ["itens", `Vistoria (${totalItens})`, Camera], ["laudo", "Laudo final", FileText]].map(([k, label, Icon]) => (
              <button key={k} onClick={() => setAba(k)} className="tab" style={{ borderBottomColor: aba === k ? AZUL_MEDIO : "transparent", color: aba === k ? "#fff" : "rgba(255,255,255,.6)", fontSize: 13 }}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </nav>
        )}
      </header>

      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "22px 18px 80px" }}>
        {abaTop === "laudos" && <NotificacoesClientes clientes={clientes} preencherComCliente={preencherComCliente} style={{ marginBottom: 18 }} />}
        {abaTop === "laudos" && <FaixaIndicadoresGerais docs={docs} modo="vistorias" style={{ marginBottom: 18 }} />}
        {abaTop === "documentacao" && <FaixaIndicadoresGerais docs={docs} modo="art" style={{ marginBottom: 18 }} />}

        {abaTop === "laudos" && aba === "dados" && <AbaDados dados={dados} setD={setD} setTexto={setTexto} clientes={clientes} preencherComCliente={preencherComCliente} />}
        {abaTop === "laudos" && aba === "itens" && (
          <AbaItens itens={itens} setItens={setItens} updItem={updItem} escolherPatologia={escolherPatologia}
            addFotos={addFotos} removerFoto={removerFoto} contagem={contagem} />
        )}
        {abaTop === "laudos" && aba === "laudo" && <Laudo dados={dados} itens={itens} contagem={contagem} totalItens={totalItens} assinatura={assinatura} />}

        {abaTop === "documentacao" && (
          <AbaDocumentacao docs={docs} addDoc={addDoc} updDoc={updDoc} delDoc={delDoc} carregando={docsCarregando} notify={notify} />
        )}
        {abaTop === "gerencia" && (
          <AbaGerencia docs={docs} carregando={docsCarregando} assinatura={assinatura} salvarAssinatura={salvarAssinatura} removerAssinatura={removerAssinatura} notify={notify}
            usuarios={usuarios} usuariosCarregando={usuariosCarregando} criarUsuario={criarUsuario} atualizarUsuario={atualizarUsuario} excluirUsuario={excluirUsuario} usuarioAtualId={session.usuario.id} />
        )}
      </main>

      {/* Load modal */}
      {showLoad && (
        <div className="no-print" style={overlay} onClick={() => setShowLoad(false)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <strong>Rascunhos salvos</strong>
              <button className="icon-btn" onClick={() => setShowLoad(false)}><X size={16} /></button>
            </div>
            {rascunhos.length === 0 && <p style={{ color: "#65758b", fontSize: 14 }}>Nenhum rascunho salvo ainda.</p>}
            {rascunhos.map((k) => <RascunhoLinha key={k} k={k} onLoad={carregar} onDel={excluirRascunho} />)}
            <p style={{ fontSize: 12, color: "#8593a8", marginTop: 12 }}>As fotos não ficam no rascunho de teste — na versão em nuvem elas serão salvas junto.</p>
          </div>
        </div>
      )}

      {toast && <div className="no-print" style={toastStyle}><Check size={15} /> {toast}</div>}
    </div>
  );
}

function RascunhoLinha({ k, onLoad, onDel }) {
  const [nome, setNome] = useState("...");
  useEffect(() => { (async () => { try { const r = await window.storage.get(k); setNome(JSON.parse(r.value).nome); } catch { setNome("Rascunho"); } })(); }, [k]);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", borderBottom: `1px solid ${CINZA_BORDA}` }}>
      <FileText size={15} color={AZUL_MEDIO} />
      <span style={{ flex: 1, fontSize: 14 }}>{nome}</span>
      <button className="btn-mini" onClick={() => onLoad(k)}>Abrir</button>
      <button className="icon-btn" onClick={() => onDel(k)}><Trash2 size={14} color="#c62828" /></button>
    </div>
  );
}

/* ================= Notificações: solicitações de clientes pendentes ================= */
function NotificacoesClientes({ clientes, preencherComCliente, style }) {
  const pendentes = clientes
    .filter((c) => !c.atendido)
    .sort((a, b) => `${a.dataDesejada}${a.horarioDesejado}`.localeCompare(`${b.dataDesejada}${b.horarioDesejado}`));

  if (pendentes.length === 0) return null;

  return (
    <div style={style}>
      <Card icon={ClipboardList} titulo={`Solicitações de clientes pendentes (${pendentes.length})`}>
        <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 12px" }}>
          Esses clientes já preencheram o cadastro com todos os dados e o horário desejado. Escolha um para carregar os dados automaticamente e ir direto para a vistoria do dia.
        </p>
        <div style={{ display: "grid", gap: 10 }}>
          {pendentes.map((c) => (
            <div key={c.id} style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{c.nome}</div>
                <div style={{ fontSize: 12.5, color: "#65758b" }}>
                  {c.servico} {c.empreendimento ? `· ${c.empreendimento}` : ""}{c.complemento ? ` (${c.complemento})` : ""}
                </div>
              </div>
              <div style={{ fontSize: 12.5, color: AZUL_MARINHO, fontWeight: 700, whiteSpace: "nowrap" }}>
                {c.dataDesejada ? c.dataDesejada.split("-").reverse().join("/") : "sem data"}{c.horarioDesejado ? ` às ${c.horarioDesejado}` : ""}
              </div>
              <button className="btn-solid" style={{ width: "auto", padding: "8px 14px" }}
                onClick={() => preencherComCliente(c, { irParaItens: true })}>
                <Check size={14} /> Iniciar vistoria
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ================= Aba: Dados ================= */
function AbaDados({ dados, setD, setTexto, clientes = [], preencherComCliente }) {
  const [clienteSel, setClienteSel] = useState("");

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {clientes.length > 0 && (
        <Card icon={Users} titulo="Preencher com cadastro do cliente">
          <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 12px" }}>
            Esta seção só reúne as informações necessárias para realizar a vistoria e montar um laudo final mais completo. Escolha um cliente já cadastrado para trazer os dados dele automaticamente.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <select style={{ ...inp, flex: 1, minWidth: 220 }} value={clienteSel} onChange={(e) => setClienteSel(e.target.value)}>
              <option value="">Selecione um cliente cadastrado…</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}{c.empreendimento ? ` — ${c.empreendimento}` : ""}</option>
              ))}
            </select>
            <button className="btn-solid" style={{ width: "auto", padding: "9px 16px" }}
              onClick={() => preencherComCliente(clientes.find((c) => c.id === clienteSel))}
              disabled={!clienteSel}>
              <Check size={15} /> Usar estes dados
            </button>
          </div>
        </Card>
      )}

      <Card icon={User} titulo="Identificação do contratante (proprietário)">
        <Grid>
          <Field label="Nome" value={dados.contratante.nome} onChange={(v) => setD("contratante", "nome", v)} full />
          <Field label="CPF / CNPJ" value={dados.contratante.cpf} onChange={(v) => setD("contratante", "cpf", v)} />
        </Grid>
      </Card>

      <Card icon={Building2} titulo="Dados do imóvel">
        <Grid>
          <Field label="Construtora" value={dados.imovel.construtora} onChange={(v) => setD("imovel", "construtora", v)} />
          <Field label="Empreendimento" value={dados.imovel.empreendimento} onChange={(v) => setD("imovel", "empreendimento", v)} />
          <Field label="Endereço" value={dados.imovel.endereco} onChange={(v) => setD("imovel", "endereco", v)} full />
          <Field label="Unidade / Apartamento" value={dados.imovel.unidade} onChange={(v) => setD("imovel", "unidade", v)} />
        </Grid>
        <Area label="Descrição do imóvel" value={dados.imovel.descricao} onChange={(v) => setD("imovel", "descricao", v)} rows={2} />
      </Card>

      <Card icon={User} titulo="Responsável técnico">
        <Grid>
          <Field label="Nome" value={dados.rt.nome} onChange={(v) => setD("rt", "nome", v)} full />
          <Field label="Qualificação" value={dados.rt.qualificacao} onChange={(v) => setD("rt", "qualificacao", v)} />
          <Field label="Registro" value={dados.rt.registro} onChange={(v) => setD("rt", "registro", v)} />
        </Grid>
      </Card>

      <Card icon={ClipboardList} titulo="Dados da vistoria">
        <Grid>
          <Field label="Data" type="date" value={dados.vistoria.data} onChange={(v) => setD("vistoria", "data", v)} />
          <Field label="Início" type="time" value={dados.vistoria.inicio} onChange={(v) => setD("vistoria", "inicio", v)} />
          <Field label="Término" type="time" value={dados.vistoria.termino} onChange={(v) => setD("vistoria", "termino", v)} />
          <Field label="Cidade" value={dados.vistoria.cidade} onChange={(v) => setD("vistoria", "cidade", v)} />
          <Field label="Presentes na vistoria" value={dados.vistoria.presentes} onChange={(v) => setD("vistoria", "presentes", v)} full />
        </Grid>
      </Card>

      <Colapsavel titulo="Textos institucionais (Objetivo, Metodologia, Encerramento)">
        <Area label="Objetivo" value={dados.textos.objetivo} onChange={(v) => setTexto("objetivo", v)} rows={4} />
        <Area label="Referências técnicas" value={dados.textos.referencias} onChange={(v) => setTexto("referencias", v)} rows={3} />
        <Area label="Metodologia" value={dados.textos.metodologia} onChange={(v) => setTexto("metodologia", v)} rows={4} />
        <Area label="Encerramento" value={dados.textos.encerramento} onChange={(v) => setTexto("encerramento", v)} rows={4} />
      </Colapsavel>
    </div>
  );
}

/* ================= Aba: Itens ================= */
function AbaItens({ itens, setItens, updItem, escolherPatologia, addFotos, removerFoto, contagem }) {
  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {["Baixa", "Média", "Alta"].map((s) => {
          const m = sevMeta[s];
          return (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 7, background: m.bg, color: m.cor, padding: "7px 13px", borderRadius: 9, fontSize: 13, fontWeight: 600 }}>
              <m.icon size={15} /> {s}: {contagem[s]}
            </div>
          );
        })}
      </div>

      {itens.map((item, idx) => (
        <ItemCard key={item.id} item={item} num={idx + 1}
          onChange={(patch) => updItem(item.id, patch)}
          onPatologia={(t) => escolherPatologia(item.id, t)}
          onFotos={(fl) => addFotos(item.id, fl)}
          onRemoveFoto={(i) => removerFoto(item.id, i)}
          onDelete={() => setItens((l) => l.filter((x) => x.id !== item.id))} />
      ))}

      <button className="btn-add" onClick={() => setItens((l) => [...l, novoItem()])}>
        <Plus size={17} /> Adicionar item de vistoria
      </button>
    </div>
  );
}

function ItemCard({ item, num, onChange, onPatologia, onFotos, onRemoveFoto, onDelete }) {
  const fileRef = useRef();
  const [iaLoad, setIaLoad] = useState(false);
  const [iaErro, setIaErro] = useState("");
  const m = sevMeta[item.severidade];

  const rodarIA = async () => {
    if (item.fotos.length === 0 && !item.nota.trim()) { setIaErro("Tire uma foto ou escreva uma anotação primeiro."); return; }
    setIaErro(""); setIaLoad(true);
    try {
      const r = await gerarComIA({ nota: item.nota, fotos: item.fotos, local: item.local });
      onChange({
        patologia: r.patologia || item.patologia,
        severidade: ["Baixa", "Média", "Alta"].includes(r.severidade) ? r.severidade : item.severidade,
        descricao: r.descricao || item.descricao,
        recomendacao: r.recomendacao || item.recomendacao,
      });
    } catch (e) {
      setIaErro("Não consegui gerar agora. Escreva manualmente ou tente de novo.");
    } finally { setIaLoad(false); }
  };

  return (
    <div style={{ background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 14, padding: 18, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: AZUL_MARINHO, color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 14, fontFamily: "monospace" }}>{num}</div>
        <strong style={{ fontSize: 15 }}>Item {num}</strong>
        {item.patologia && <span style={{ fontSize: 12, color: "#65758b" }}>· {item.patologia}</span>}
        <div style={{ flex: 1 }} />
        <button className="icon-btn" onClick={onDelete}><Trash2 size={16} color="#c62828" /></button>
      </div>

      <Grid>
        <div style={cell()}>
          <label style={lab}>Local</label>
          <input list={`locais-${item.id}`} style={inp} value={item.local} onChange={(e) => onChange({ local: e.target.value })} placeholder="Ex.: Banheiro Social" />
          <datalist id={`locais-${item.id}`}>{LOCAIS.map((l) => <option key={l} value={l} />)}</datalist>
        </div>
        <div style={cell()}>
          <label style={lab}>Severidade</label>
          <select style={{ ...inp, color: m.cor, fontWeight: 600 }} value={item.severidade} onChange={(e) => onChange({ severidade: e.target.value })}>
            {["Baixa", "Média", "Alta"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </Grid>

      {/* Fotos */}
      <label style={{ ...lab, marginTop: 14, display: "block" }}>Registro fotográfico (até 4)</label>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {item.fotos.map((src, i) => (
          <div key={i} style={{ position: "relative", width: 92, height: 92, borderRadius: 9, overflow: "hidden", border: `1px solid ${CINZA_BORDA}` }}>
            <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <button className="foto-x" onClick={() => onRemoveFoto(i)}><X size={12} /></button>
          </div>
        ))}
        {item.fotos.length < 4 && (
          <button onClick={() => fileRef.current?.click()} style={{ width: 92, height: 92, borderRadius: 9, border: `1.5px dashed ${AZUL_MEDIO}`, background: "#f6f9fd", color: AZUL_MEDIO, display: "grid", placeItems: "center", cursor: "pointer" }}>
            <Camera size={22} />
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple style={{ display: "none" }} onChange={(e) => { onFotos(e.target.files); e.target.value = ""; }} />
      </div>

      {/* Bloco IA */}
      <div style={{ marginTop: 14, background: "#f4f8fd", border: `1px solid #dbe7f4`, borderRadius: 11, padding: 13 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
          <Sparkles size={15} color={AZUL_MEDIO} />
          <strong style={{ fontSize: 13, color: AZUL_MARINHO }}>Descrever com IA</strong>
        </div>
        <textarea rows={2} style={{ ...inp, width: "100%", resize: "vertical", lineHeight: 1.5 }} value={item.nota}
          onChange={(e) => onChange({ nota: e.target.value })}
          placeholder="Anotação rápida do vistoriador. Ex.: rejunte falhado em volta do ralo, com acúmulo de água" />
        <button onClick={rodarIA} disabled={iaLoad} className="btn-ia">
          {iaLoad ? <><Loader2 size={15} className="spin" /> Gerando…</> : <><Sparkles size={15} /> Gerar descrição técnica</>}
        </button>
        {iaErro && <div style={{ fontSize: 12, color: "#c62828", marginTop: 7 }}>{iaErro}</div>}
        <div style={{ fontSize: 11, color: "#8593a8", marginTop: 7 }}>Ou use o banco pronto:{" "}
          <select style={{ fontSize: 11, padding: "2px 4px", border: `1px solid ${CINZA_BORDA}`, borderRadius: 5 }} value={item.tipo} onChange={(e) => onPatologia(e.target.value)}>
            <option value="">selecionar patologia…</option>
            {Object.entries(BANCO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      <Area label="Descrição técnica" value={item.descricao} onChange={(v) => onChange({ descricao: v })} rows={3} placeholder="Verifica-se..." />
      <Area label="Recomendação técnica" value={item.recomendacao} onChange={(v) => onChange({ recomendacao: v })} rows={2} placeholder="Recomenda-se..." />
    </div>
  );
}

/* ================= Aba: Laudo final ================= */
/* ================= Gráfico de destaque: patologias encontradas ================= */
function GraficoPatologias({ contagem, totalItens }) {
  if (totalItens === 0) return null;
  const ordem = ["Alta", "Média", "Baixa"];
  const max = Math.max(...ordem.map((s) => contagem[s] || 0), 1);

  return (
    <div className="no-print-avoid" style={{
      border: `2px solid ${AZUL_MEDIO}`, borderRadius: 14, padding: "18px 20px", margin: "10px 0 22px",
      background: "linear-gradient(180deg, #F4F8FC, #FFFFFF)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <AlertTriangle size={18} color="#C62828" />
        <strong style={{ fontSize: 14, color: AZUL_MARINHO }}>Panorama das patologias encontradas</strong>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 16 }}>
        {ordem.map((s) => (
          <div key={s} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: sevMeta[s].cor, lineHeight: 1 }}>{contagem[s] || 0}</div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: sevMeta[s].cor, letterSpacing: 0.4, marginTop: 4 }}>{s.toUpperCase()}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {ordem.map((s) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 62, fontSize: 11.5, color: "#4a5a70", fontWeight: 600 }}>{s}</div>
            <div style={{ flex: 1, height: 14, borderRadius: 7, background: "#E7ECF3", overflow: "hidden" }}>
              <div style={{ width: `${((contagem[s] || 0) / max) * 100}%`, height: "100%", background: sevMeta[s].cor, borderRadius: 7, transition: "width .3s" }} />
            </div>
            <div style={{ width: 24, textAlign: "right", fontSize: 12, fontWeight: 700, color: sevMeta[s].cor }}>{contagem[s] || 0}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, fontSize: 12, color: "#65758b" }}>
        Total de {totalItens} não conformidade(s) identificada(s) durante a vistoria técnica.
      </div>
    </div>
  );
}

function Laudo({ dados, itens, contagem, totalItens, assinatura }) {
  const validos = itens.filter((i) => i.tipo || i.descricao);
  const fmtData = (d) => { if (!d) return "___/___/______"; const [a, m, dia] = d.split("-"); return `${dia}/${m}/${a}`; };

  return (
    <div className="laudo-print" style={{ background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 14, overflow: "hidden" }}>
      {/* Capa */}
      <div style={{ background: `linear-gradient(135deg, ${AZUL_MARINHO}, ${AZUL_MEDIO})`, color: "#fff", padding: "46px 40px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 34 }}>
          <div style={{ width: 46, height: 46, borderRadius: 10, background: "rgba(255,255,255,.15)", display: "grid", placeItems: "center", fontWeight: 800 }}>FN</div>
          <div style={{ fontWeight: 700, letterSpacing: 1 }}>FN EDIFICAÇÕES</div>
        </div>
        <div style={{ fontSize: 13, opacity: 0.8, letterSpacing: 2 }}>ENGENHARIA DIAGNÓSTICA</div>
        <h1 style={{ fontSize: 30, margin: "8px 0 6px", fontWeight: 800 }}>Laudo Técnico de Vistoria Imobiliária</h1>
        <div style={{ opacity: 0.9 }}>{dados.imovel.empreendimento || "Empreendimento"} {dados.imovel.unidade && `· ${dados.imovel.unidade}`}</div>
        <div style={{ marginTop: 26, fontSize: 13, opacity: 0.85 }}>{dados.contratante.nome || "Proprietário(a)"}</div>
      </div>

      <div style={{ padding: "30px 40px" }}>
        <SecTitulo n="1">Dados preliminares</SecTitulo>
        <TabelaDados rows={[
          ["Proprietário(a)", dados.contratante.nome], ["CPF/CNPJ", dados.contratante.cpf],
          ["Construtora", dados.imovel.construtora], ["Empreendimento", dados.imovel.empreendimento],
          ["Endereço", dados.imovel.endereco], ["Unidade", dados.imovel.unidade],
        ]} />
        {dados.imovel.descricao && <p style={pTexto}>{dados.imovel.descricao}</p>}
        <TabelaDados rows={[
          ["Responsável Técnico", dados.rt.nome], ["Qualificação", dados.rt.qualificacao], ["Registro", dados.rt.registro],
        ]} />

        <SecTitulo n="2">Objetivo</SecTitulo>
        <p style={pTexto}>{dados.textos.objetivo}</p>

        <SecTitulo n="3">Referências técnicas</SecTitulo>
        <p style={pTexto}>{dados.textos.referencias}</p>

        <SecTitulo n="4">Metodologia</SecTitulo>
        <p style={pTexto}>{dados.textos.metodologia}</p>

        <SecTitulo n="5">Relato da vistoria</SecTitulo>
        <p style={pTexto}>
          A vistoria foi realizada no dia {fmtData(dados.vistoria.data)}
          {dados.vistoria.inicio && `, com início às ${dados.vistoria.inicio}`}
          {dados.vistoria.termino && ` e término às ${dados.vistoria.termino}`}.
          {dados.vistoria.presentes && ` Estiveram presentes: ${dados.vistoria.presentes}.`} A vistoria ocorreu sem intercorrências.
        </p>

        <SecTitulo n="6">Registro fotográfico e não conformidades</SecTitulo>
        <GraficoPatologias contagem={contagem} totalItens={totalItens} />
        <div style={{ display: "flex", gap: 8, margin: "4px 0 18px", flexWrap: "wrap" }}>
          {["Alta", "Média", "Baixa"].map((s) => contagem[s] > 0 && (
            <span key={s} style={{ background: sevMeta[s].bg, color: sevMeta[s].cor, padding: "4px 11px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{contagem[s]} de severidade {s.toLowerCase()}</span>
          ))}
        </div>

        {validos.length === 0 && <p style={{ color: "#8593a8", fontSize: 14 }}>Nenhum item cadastrado. Adicione itens na aba “Vistoria”.</p>}
        {validos.map((item, i) => <ItemLaudo key={item.id} item={item} num={i + 1} />)}

        <SecTitulo n="7">Conclusão</SecTitulo>
        <p style={pTexto}>
          Durante a vistoria técnica {totalItens > 0 ? `foram constatadas ${totalItens} não conformidade(s)` : "não foram constatadas não conformidades"}, abrangendo falhas de acabamento, execução e/ou instalação de componentes construtivos. As inconformidades apontadas figuram sob a responsabilidade da construtora, para saná-las de imediato. Ressalta-se que o presente laudo não exime a construtora da responsabilidade por eventuais vícios ocultos que venham a se manifestar com o uso da unidade.
        </p>

        <SecTitulo n="8">Encerramento</SecTitulo>
        <p style={pTexto}>{dados.textos.encerramento}</p>

        <div style={{ marginTop: 40, paddingTop: 26, borderTop: `2px solid ${AZUL_MEDIO}`, textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "#65758b" }}>{dados.vistoria.cidade}{dados.vistoria.data && `, ${fmtData(dados.vistoria.data)}`}.</div>
          <div style={{ marginTop: 34, fontWeight: 700 }}>{dados.rt.nome}</div>
          <div style={{ fontSize: 13, color: "#65758b" }}>{dados.rt.qualificacao} · {dados.rt.registro}</div>

          {assinatura && (
            <div style={{ marginTop: 30, display: "inline-block" }}>
              <div style={{ background: "#fff", padding: "8px 14px", borderRadius: 8, display: "inline-block" }}>
                <img src={assinatura.imagem} alt="Assinatura da Gerência" style={{ maxHeight: 64, maxWidth: 220, display: "block", margin: "0 auto" }} />
              </div>
              <div style={{ borderTop: `1px solid ${CINZA_BORDA}`, marginTop: 6, paddingTop: 6, fontWeight: 700, fontSize: 13 }}>{assinatura.nome}</div>
              <div style={{ fontSize: 11.5, color: "#8593a8" }}>Aprovação da Gerência · FN Edificações</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ItemLaudo({ item, num }) {
  const m = sevMeta[item.severidade];
  return (
    <div style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 12, overflow: "hidden", marginBottom: 16, breakInside: "avoid" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: CINZA_CLARO, padding: "10px 14px" }}>
        <span style={{ fontFamily: "monospace", fontWeight: 700, color: AZUL_MARINHO }}>ITEM {String(num).padStart(2, "0")}</span>
        {item.local && <span style={{ fontSize: 13, color: "#4a5a70" }}>· {item.local}</span>}
        <div style={{ flex: 1 }} />
        <span style={{ background: m.bg, color: m.cor, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{item.severidade.toUpperCase()}</span>
      </div>
      <div style={{ padding: 14 }}>
        {item.patologia && <div style={{ fontWeight: 700, marginBottom: 6, color: AZUL_MARINHO }}>{item.patologia}</div>}
        {item.fotos.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(item.fotos.length, 2)}, 1fr)`, gap: 8, marginBottom: 12 }}>
            {item.fotos.map((s, i) => <img key={i} src={s} alt="" style={{ width: "100%", height: 150, objectFit: "cover", borderRadius: 8, border: `1px solid ${CINZA_BORDA}` }} />)}
          </div>
        )}
        {item.descricao && <p style={{ ...pTexto, margin: "0 0 8px" }}><strong style={{ color: AZUL_MEDIO }}>Descrição técnica. </strong>{item.descricao}</p>}
        {item.recomendacao && <p style={{ ...pTexto, margin: 0 }}><strong style={{ color: AZUL_MEDIO }}>Recomendação. </strong>{item.recomendacao}</p>}
      </div>
    </div>
  );
}

/* ================= Aba: Documentação (registro de vistorias/TRT) ================= */
const STATUS_COR = {
  // pagamento
  Pago: { cor: "#2E7D32", bg: "#E6F4EA" }, Parcial: { cor: "#B26A00", bg: "#FFF4E0" }, Pendente: { cor: "#C62828", bg: "#FCEAEA" },
  // vistoria
  Concluída: { cor: "#2E7D32", bg: "#E6F4EA" }, Agendada: { cor: "#2C75B5", bg: "#EAF2FB" }, Cancelada: { cor: "#65758b", bg: "#EEF1F5" },
  // art / relatório
  Elaborada: { cor: "#2E7D32", bg: "#E6F4EA" }, Entregue: { cor: "#2E7D32", bg: "#E6F4EA" },
  "Em processo": { cor: "#B26A00", bg: "#FFF4E0" }, "Não solicitada": { cor: "#65758b", bg: "#EEF1F5" },
};
function Selo({ valor }) {
  const s = STATUS_COR[valor] || { cor: "#65758b", bg: "#EEF1F5" };
  return <span style={{ background: s.bg, color: s.cor, padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{valor}</span>;
}

function AbaDocumentacao({ docs, addDoc, updDoc, delDoc, carregando, notify }) {
  const [editando, setEditando] = useState(null); // registro (cópia) em edição, ou null
  const [filtroVistoria, setFiltroVistoria] = useState("");
  const [busca, setBusca] = useState("");

  const filtrados = docs.filter((d) => {
    if (filtroVistoria && d.vistoria !== filtroVistoria) return false;
    if (busca && !(`${d.cliente} ${d.empreendimento}`.toLowerCase().includes(busca.toLowerCase()))) return false;
    return true;
  });

  const abrirNovo = () => setEditando(novoRegistroDoc());
  const abrirEdicao = (d) => setEditando({ ...d });
  const salvar = () => {
    if (!editando.cliente.trim()) { notify("Informe o nome do cliente"); return; }
    const existe = docs.some((d) => d.id === editando.id);
    if (existe) updDoc(editando.id, editando); else addDoc(editando);
    setEditando(null);
    notify("Registro salvo ✓");
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card icon={ClipboardCheck} titulo="Documentação e TRT — controle de vistorias">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <input style={{ ...inp, flex: 1, minWidth: 200 }} placeholder="Buscar por cliente ou empreendimento…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <select style={inp} value={filtroVistoria} onChange={(e) => setFiltroVistoria(e.target.value)}>
            <option value="">Todas as vistorias</option>
            {VISTORIA_OPCOES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <button className="btn-add" style={{ width: "auto", padding: "9px 16px" }} onClick={abrirNovo}><Plus size={16} /> Novo registro</button>
        </div>

        {carregando && <p style={{ color: "#8593a8", fontSize: 14 }}>Carregando registros…</p>}
        {!carregando && filtrados.length === 0 && <p style={{ color: "#8593a8", fontSize: 14 }}>Nenhum registro encontrado. Clique em “Novo registro” para começar.</p>}

        {filtrados.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: CINZA_CLARO }}>
                  {["Cliente", "Empreendimento", "Data", "Pagamento", "Valor", "Vistoria", "ART", "Relatório", ""].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: AZUL_MARINHO, borderBottom: `2px solid ${CINZA_BORDA}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((d) => (
                  <tr key={d.id} style={{ borderBottom: `1px solid ${CINZA_BORDA}` }}>
                    <td style={{ padding: "8px 10px", fontWeight: 600 }}>{d.cliente || "—"}</td>
                    <td style={{ padding: "8px 10px" }}>{d.empreendimento || "—"}{d.complemento ? ` · ${d.complemento}` : ""}</td>
                    <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{d.data ? d.data.split("-").reverse().join("/") : "—"}</td>
                    <td style={{ padding: "8px 10px" }}><Selo valor={d.pagamento} /></td>
                    <td style={{ padding: "8px 10px", whiteSpace: "nowrap", fontSize: 12, color: "#4a5a70" }}>
                      {((Number(d.valorVistoria) || 0) + (Number(d.valorTrt) || 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td style={{ padding: "8px 10px" }}><Selo valor={d.vistoria} /></td>
                    <td style={{ padding: "8px 10px" }}><Selo valor={d.art} /></td>
                    <td style={{ padding: "8px 10px" }}><Selo valor={d.relatorio} /></td>
                    <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                      <button className="icon-btn" onClick={() => abrirEdicao(d)}><Edit3 size={15} color={AZUL_MEDIO} /></button>
                      <button className="icon-btn" onClick={() => delDoc(d.id)}><Trash2 size={15} color="#c62828" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editando && (
        <div className="no-print" style={overlay} onClick={() => setEditando(null)}>
          <div style={{ ...modal, maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <strong>Registro de vistoria / TRT</strong>
              <button className="icon-btn" onClick={() => setEditando(null)}><X size={16} /></button>
            </div>
            <Grid>
              <Field label="Cliente" value={editando.cliente} onChange={(v) => setEditando({ ...editando, cliente: v })} full />
              <Field label="CPF" value={editando.cpf} onChange={(v) => setEditando({ ...editando, cpf: v })} />
              <Field label="Empreendimento" value={editando.empreendimento} onChange={(v) => setEditando({ ...editando, empreendimento: v })} />
              <Field label="Bloco / Apto / Complemento" value={editando.complemento} onChange={(v) => setEditando({ ...editando, complemento: v })} />
              <Field label="Data" type="date" value={editando.data} onChange={(v) => setEditando({ ...editando, data: v })} />
              <Field label="Hora" type="time" value={editando.hora} onChange={(v) => setEditando({ ...editando, hora: v })} />
              <div style={cell()}>
                <label style={lab}>Pagamento</label>
                <select style={inp} value={editando.pagamento} onChange={(e) => setEditando({ ...editando, pagamento: e.target.value })}>
                  {PAGAMENTO_OPCOES.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <Field label="Valor da vistoria (R$)" type="number" value={editando.valorVistoria} onChange={(v) => setEditando({ ...editando, valorVistoria: v })} />
              <Field label="Valor do TRT/documentação (R$)" type="number" value={editando.valorTrt} onChange={(v) => setEditando({ ...editando, valorTrt: v })} />
              <div style={cell()}>
                <label style={lab}>Status da vistoria</label>
                <select style={inp} value={editando.vistoria} onChange={(e) => setEditando({ ...editando, vistoria: e.target.value })}>
                  {VISTORIA_OPCOES.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div style={cell()}>
                <label style={lab}>ART / TRT</label>
                <select style={inp} value={editando.art} onChange={(e) => setEditando({ ...editando, art: e.target.value })}>
                  {ART_OPCOES.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div style={cell()}>
                <label style={lab}>Tipo de ART/TRT</label>
                <select style={inp} value={editando.tipoArt} onChange={(e) => setEditando({ ...editando, tipoArt: e.target.value })}>
                  {TIPO_ART_OPCOES.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div style={cell()}>
                <label style={lab}>Relatório</label>
                <select style={inp} value={editando.relatorio} onChange={(e) => setEditando({ ...editando, relatorio: e.target.value })}>
                  {RELATORIO_OPCOES.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </Grid>
            <Area label="Observações" value={editando.observacoes} onChange={(v) => setEditando({ ...editando, observacoes: v })} rows={2} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO }} onClick={() => setEditando(null)}>Cancelar</button>
              <button className="btn-solid" onClick={salvar}><Save size={15} /> Salvar registro</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= Aba: Gerência (indicadores) ================= */
function KpiCard({ label, valor, cor = AZUL_MARINHO, Icon }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
      {Icon && <div style={{ width: 34, height: 34, borderRadius: 9, background: CINZA_CLARO, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={16} color={cor} /></div>}
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: cor, lineHeight: 1.1 }}>{valor}</div>
        <div style={{ fontSize: 12, color: "#65758b", marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}
function BarraStatus({ titulo, contagens }) {
  const total = Object.values(contagens).reduce((a, b) => a + b, 0) || 1;
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: AZUL_MARINHO, marginBottom: 8 }}>{titulo}</div>
      <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", background: CINZA_CLARO, marginBottom: 8 }}>
        {Object.entries(contagens).map(([k, v]) => v > 0 && (
          <div key={k} style={{ width: `${(v / total) * 100}%`, background: (STATUS_COR[k] || {}).cor || "#8593a8" }} title={`${k}: ${v}`} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {Object.entries(contagens).map(([k, v]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#4a5a70" }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: (STATUS_COR[k] || {}).cor || "#8593a8" }} />
            {k} ({v})
          </div>
        ))}
      </div>
    </div>
  );
}
function CardIndicadoresGerais({ docs, modo = "completo" }) {
  const contarPor = (campo) => docs.reduce((acc, d) => { acc[d[campo]] = (acc[d[campo]] || 0) + 1; return acc; }, {});
  const porVistoria = contarPor("vistoria");
  const porArt = contarPor("art");
  const totalRegistros = docs.length;
  const concluidas = porVistoria["Concluída"] || 0;
  const artRealizadas = porArt["Elaborada"] || 0;
  const artRegistradas = docs.filter((d) => d.art !== "Não solicitada").length; // solicitadas: em processo + elaboradas

  const mostraVistoria = modo === "completo" || modo === "vistorias";
  const mostraArt = modo === "completo" || modo === "art";

  return (
    <Card icon={LayoutGrid} titulo="Indicadores gerais">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
        {mostraVistoria && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: AZUL_MARINHO, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <ClipboardCheck size={14} /> Vistorias
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <KpiCard label="Registradas" valor={totalRegistros} Icon={Users} />
              <KpiCard label="Concluídas" valor={concluidas} cor="#2E7D32" Icon={ClipboardCheck} />
            </div>
          </div>
        )}
        {mostraArt && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: AZUL_MARINHO, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <FileText size={14} /> ART / TRT
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <KpiCard label="Registradas" valor={artRegistradas} cor="#2C75B5" Icon={FileText} />
              <KpiCard label="Realizadas" valor={artRealizadas} cor="#2E7D32" Icon={FileText} />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
function FaixaIndicadoresGerais({ docs, modo = "completo", style }) {
  return <div style={style}><CardIndicadoresGerais docs={docs} modo={modo} /></div>;
}
function AbaGerencia({ docs, carregando, assinatura, salvarAssinatura, removerAssinatura, notify, usuarios, usuariosCarregando, criarUsuario, atualizarUsuario, excluirUsuario, usuarioAtualId }) {
  const somaCampo = (campo, filtro) => docs.filter(filtro).reduce((s, d) => s + (Number(d[campo]) || 0), 0);
  const pago = (d) => d.pagamento === "Pago";
  const naoPago = (d) => d.pagamento !== "Pago";

  const receitaVistoriaPaga = somaCampo("valorVistoria", pago);
  const receitaVistoriaAReceber = somaCampo("valorVistoria", naoPago);
  const receitaTrtPaga = somaCampo("valorTrt", pago);
  const receitaTrtAReceber = somaCampo("valorTrt", naoPago);

  const porVistoria = docs.reduce((acc, d) => { acc[d.vistoria] = (acc[d.vistoria] || 0) + 1; return acc; }, {});
  const porArt = docs.reduce((acc, d) => { acc[d.art] = (acc[d.art] || 0) + 1; return acc; }, {});
  const porRelatorio = docs.reduce((acc, d) => { acc[d.relatorio] = (acc[d.relatorio] || 0) + 1; return acc; }, {});
  const totalRegistros = docs.length;

  const porEmpreendimento = docs.reduce((acc, d) => {
    const k = d.empreendimento?.trim() || "(sem empreendimento)";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const rankingEmpreendimentos = Object.entries(porEmpreendimento).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const fmtReal = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {carregando && <p style={{ color: "#8593a8", fontSize: 14 }}>Carregando indicadores…</p>}

      <CardIndicadoresGerais docs={docs} />

      <Card icon={DollarSign} titulo="Financeiro (acesso restrito · Gerência)">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: AZUL_MARINHO, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <ClipboardCheck size={14} /> Vistorias
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <KpiCard label="Recebido" valor={fmtReal(receitaVistoriaPaga)} cor="#2E7D32" />
              <KpiCard label="A receber" valor={fmtReal(receitaVistoriaAReceber)} cor="#C62828" />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: AZUL_MARINHO, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <FileText size={14} /> ART / TRT · Documentação
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <KpiCard label="Recebido" valor={fmtReal(receitaTrtPaga)} cor="#2E7D32" />
              <KpiCard label="A receber" valor={fmtReal(receitaTrtAReceber)} cor="#C62828" />
            </div>
          </div>
        </div>
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${CINZA_BORDA}`, display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13.5 }}>
          <div><strong style={{ color: AZUL_MARINHO }}>Total recebido: </strong>{fmtReal(receitaVistoriaPaga + receitaTrtPaga)}</div>
          <div><strong style={{ color: AZUL_MARINHO }}>Total a receber: </strong>{fmtReal(receitaVistoriaAReceber + receitaTrtAReceber)}</div>
        </div>
      </Card>

      <Card icon={BarChart3} titulo="Status operacional">
        {totalRegistros === 0 ? (
          <p style={{ color: "#8593a8", fontSize: 14 }}>Nenhum dado ainda. Cadastre registros na aba “Documentação” para ver os indicadores aqui.</p>
        ) : (
          <>
            <BarraStatus titulo="Vistorias" contagens={porVistoria} />
            <BarraStatus titulo="ART / TRT" contagens={porArt} />
            <BarraStatus titulo="Relatórios" contagens={porRelatorio} />
          </>
        )}
      </Card>

      {rankingEmpreendimentos.length > 0 && (
        <Card icon={LayoutGrid} titulo="Empreendimentos com mais vistorias">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <tbody>
              {rankingEmpreendimentos.map(([nome, qtd]) => (
                <tr key={nome} style={{ borderBottom: `1px solid ${CINZA_BORDA}` }}>
                  <td style={{ padding: "8px 10px" }}>{nome}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: AZUL_MARINHO }}>{qtd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <CardUsuarios usuarios={usuarios} carregando={usuariosCarregando} criarUsuario={criarUsuario} atualizarUsuario={atualizarUsuario} excluirUsuario={excluirUsuario} notify={notify} usuarioAtualId={usuarioAtualId} />

      <CardAssinaturaGerencia assinatura={assinatura} salvarAssinatura={salvarAssinatura} removerAssinatura={removerAssinatura} notify={notify} />
    </div>
  );
}

const ROLE_LABEL = { vistoriador: "Vistoriador", documentacao: "Documentação", gerencia: "Gerência" };
const ROLE_DESCRICAO = {
  vistoriador: "Só acessa Laudos. Sem acesso a Documentação nem Gerência.",
  documentacao: "Só acessa Documentação/TRT. Sem acesso a Laudos nem Gerência.",
  gerencia: "Acesso completo: Laudos, Documentação, Gerência e financeiro.",
};

function CardUsuarios({ usuarios, carregando, criarUsuario, atualizarUsuario, excluirUsuario, notify, usuarioAtualId }) {
  const [novo, setNovo] = useState(null); // { nome, email, senha, role } quando o modal de criação está aberto
  const [salvando, setSalvando] = useState(false);
  const [resetandoId, setResetandoId] = useState(null);
  const [novaSenha, setNovaSenha] = useState("");

  const abrirNovo = () => setNovo({ nome: "", email: "", senha: "", role: "vistoriador" });

  const salvar = async () => {
    if (!novo.nome.trim() || !novo.email.trim() || !novo.senha.trim()) { notify("Preencha nome, e-mail e senha"); return; }
    if (novo.senha.length < 6) { notify("A senha precisa ter pelo menos 6 caracteres"); return; }
    setSalvando(true);
    try { await criarUsuario(novo); setNovo(null); }
    catch (e) { notify(`Não foi possível criar: ${e.message}`); }
    setSalvando(false);
  };

  const trocarPapel = async (id, role) => {
    try { await atualizarUsuario(id, { role }); } catch (e) { notify(`Erro: ${e.message}`); }
  };
  const alternarAtivo = async (u) => {
    try { await atualizarUsuario(u.id, { ativo: !u.ativo }); } catch (e) { notify(`Erro: ${e.message}`); }
  };
  const confirmarReset = async (id) => {
    if (novaSenha.length < 6) { notify("A senha precisa ter pelo menos 6 caracteres"); return; }
    try { await atualizarUsuario(id, { senha: novaSenha }); setResetandoId(null); setNovaSenha(""); }
    catch (e) { notify(`Erro: ${e.message}`); }
  };
  const remover = async (u) => {
    if (u.id === usuarioAtualId) { notify("Você não pode remover o próprio usuário logado"); return; }
    try { await excluirUsuario(u.id); } catch (e) { notify(`Erro: ${e.message}`); }
  };

  return (
    <Card icon={Users} titulo="Usuários da equipe (acesso ao sistema)">
      <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 14px" }}>
        Cada pessoa entra com o próprio e-mail e senha. O papel definido aqui é o que controla o que ela enxerga — não é escolhido por ela.
      </p>
      <button className="btn-add" style={{ width: "auto", padding: "9px 16px", marginBottom: 14 }} onClick={abrirNovo}><Plus size={16} /> Novo usuário</button>

      {carregando && <p style={{ color: "#8593a8", fontSize: 14 }}>Carregando…</p>}
      {!carregando && usuarios.length === 0 && <p style={{ color: "#8593a8", fontSize: 14 }}>Nenhum usuário além de você ainda.</p>}

      {usuarios.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: CINZA_CLARO }}>
                {["Nome", "E-mail", "Papel", "Status", ""].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: AZUL_MARINHO, borderBottom: `2px solid ${CINZA_BORDA}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} style={{ borderBottom: `1px solid ${CINZA_BORDA}` }}>
                  <td style={{ padding: "8px 10px", fontWeight: 600 }}>
                    {u.nome}{u.id === usuarioAtualId && <span style={{ color: "#8593a8", fontWeight: 400 }}> (você)</span>}
                  </td>
                  <td style={{ padding: "8px 10px" }}>{u.email}</td>
                  <td style={{ padding: "8px 10px" }}>
                    <select value={u.role} onChange={(e) => trocarPapel(u.id, e.target.value)} disabled={u.id === usuarioAtualId}
                      style={{ ...inp, padding: "5px 8px", fontSize: 12.5 }} title={ROLE_DESCRICAO[u.role]}>
                      {Object.entries(ROLE_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <Selo valor={u.ativo ? "Concluída" : "Cancelada"} />
                  </td>
                  <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                    <button className="icon-btn" onClick={() => alternarAtivo(u)} title={u.ativo ? "Desativar" : "Reativar"} disabled={u.id === usuarioAtualId}>
                      {u.ativo ? <X size={15} color="#c62828" /> : <Check size={15} color="#2E7D32" />}
                    </button>
                    <button className="icon-btn" onClick={() => { setResetandoId(u.id); setNovaSenha(""); }} title="Redefinir senha">
                      <Edit3 size={15} color={AZUL_MEDIO} />
                    </button>
                    {u.id !== usuarioAtualId && (
                      <button className="icon-btn" onClick={() => remover(u)} title="Remover"><Trash2 size={15} color="#c62828" /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: novo usuário */}
      {novo && (
        <div className="no-print" style={overlay} onClick={() => setNovo(null)}>
          <div style={{ ...modal, maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <strong>Novo usuário</strong>
              <button className="icon-btn" onClick={() => setNovo(null)}><X size={16} /></button>
            </div>
            <div style={cell(true)}>
              <label style={lab}>Nome</label>
              <input style={inp} value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
            </div>
            <div style={{ ...cell(true), marginTop: 10 }}>
              <label style={lab}>E-mail</label>
              <input style={inp} type="email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} />
            </div>
            <div style={{ ...cell(true), marginTop: 10 }}>
              <label style={lab}>Senha provisória</label>
              <input style={inp} type="text" value={novo.senha} onChange={(e) => setNovo({ ...novo, senha: e.target.value })} placeholder="mínimo 6 caracteres" />
            </div>
            <div style={{ ...cell(true), marginTop: 10 }}>
              <label style={lab}>Papel de acesso</label>
              <select style={inp} value={novo.role} onChange={(e) => setNovo({ ...novo, role: e.target.value })}>
                {Object.entries(ROLE_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
              <div style={{ fontSize: 12, color: "#65758b", marginTop: 4 }}>{ROLE_DESCRICAO[novo.role]}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO }} onClick={() => setNovo(null)}>Cancelar</button>
              <button className="btn-solid" onClick={salvar} disabled={salvando}>{salvando ? "Criando…" : "Criar usuário"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: redefinir senha */}
      {resetandoId && (
        <div className="no-print" style={overlay} onClick={() => setResetandoId(null)}>
          <div style={{ ...modal, maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <strong>Redefinir senha</strong>
              <button className="icon-btn" onClick={() => setResetandoId(null)}><X size={16} /></button>
            </div>
            <div style={cell(true)}>
              <label style={lab}>Nova senha</label>
              <input style={inp} type="text" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="mínimo 6 caracteres" autoFocus />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO }} onClick={() => setResetandoId(null)}>Cancelar</button>
              <button className="btn-solid" onClick={() => confirmarReset(resetandoId)}>Salvar nova senha</button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function CardAssinaturaGerencia({ assinatura, salvarAssinatura, removerAssinatura, notify }) {
  const [nome, setNome] = useState(assinatura?.nome || "");

  const onArquivo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { notify("Envie uma imagem (PNG ou JPG) da assinatura"); return; }
    const reader = new FileReader();
    reader.onload = () => salvarAssinatura({ imagem: reader.result, nome: nome || "Gerência FN Edificações" });
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <Card icon={User} titulo="Assinatura digital da Gerência">
      <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 12px" }}>
        Envie a imagem da sua assinatura uma única vez. A partir daí, ela é aplicada automaticamente em todos os laudos gerados, sem precisar assinar manualmente cada um.
      </p>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ ...cell(), minWidth: 220 }}>
          <label style={lab}>Nome exibido junto à assinatura</label>
          <input style={inp} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Felipe Nunes — Gerência" />
        </div>
        <label className="btn-solid" style={{ width: "auto", padding: "9px 16px", cursor: "pointer" }}>
          <Camera size={15} /> {assinatura ? "Trocar assinatura" : "Enviar assinatura"}
          <input type="file" accept="image/*" onChange={onArquivo} style={{ display: "none" }} />
        </label>
        {assinatura && (
          <button className="btn-ghost" style={{ color: "#c62828" }} onClick={removerAssinatura}><Trash2 size={15} /> Remover</button>
        )}
      </div>

      {assinatura && (
        <div style={{ marginTop: 16, padding: 14, border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, display: "inline-block" }}>
          <img src={assinatura.imagem} alt="Assinatura da Gerência" style={{ maxHeight: 70, maxWidth: 260, display: "block", background: "#fff" }} />
          <div style={{ fontSize: 12, color: "#65758b", marginTop: 6, borderTop: `1px solid ${CINZA_BORDA}`, paddingTop: 6 }}>{assinatura.nome}</div>
        </div>
      )}
    </Card>
  );
}

/* ================= Aba: Cliente (autocadastro e acompanhamento) ================= */
function AbaCliente({ notify }) {
  const [form, setForm] = useState(novoCadastroCliente());
  const [enviando, setEnviando] = useState(false);
  const [busca, setBusca] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [resultados, setResultados] = useState([]);

  const setF = (campo, v) => setForm((f) => ({ ...f, [campo]: v }));
  const setFMaiusc = (campo, v) => setForm((f) => ({ ...f, [campo]: v.toUpperCase() }));
  const setFCpf = (v) => setForm((f) => ({ ...f, cpf: v.replace(/\D/g, "").slice(0, 11) }));

  const enviar = async () => {
    if (!form.nome.trim() || !form.telefone.trim()) { notify("Informe pelo menos nome e telefone"); return; }
    if (form.cpf && form.cpf.length !== 11) { notify("O CPF deve ter 11 dígitos"); return; }
    setEnviando(true);
    try {
      await apiFetch("/api/clientes", { method: "POST", body: form });
      setForm(novoCadastroCliente());
      notify("Cadastro enviado! Nossa equipe entrará em contato ✓");
    } catch (e) { notify(`Não foi possível enviar: ${e.message}`); }
    setEnviando(false);
  };

  const buscar = async () => {
    const termo = busca.trim();
    if (termo.length < 3) { notify("Digite ao menos 3 caracteres"); return; }
    setBuscando(true); setBuscou(true);
    try {
      const r = await apiFetch("/api/acompanhamento", { method: "POST", body: { termo } });
      setResultados(r.resultados || []);
    } catch (e) { notify(`Não foi possível buscar: ${e.message}`); setResultados([]); }
    setBuscando(false);
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card icon={Users} titulo="Cadastre-se">
        <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 14px" }}>
          Preencha seus dados para agendar uma vistoria, laudo técnico ou outro serviço da FN Edificações. Nossa equipe entra em contato para confirmar o atendimento.
        </p>
        <Grid>
          <Field label="Nome completo" value={form.nome} onChange={(v) => setFMaiusc("nome", v)} full />
          <Field label="CPF (11 dígitos)" value={form.cpf} onChange={setFCpf} />
          <Field label="Telefone / WhatsApp" value={form.telefone} onChange={(v) => setF("telefone", v.replace(/\D/g, "").slice(0, 11))} />
          <Field label="E-mail" value={form.email} onChange={(v) => setF("email", v)} full />
          <Field label="Construtora" value={form.construtora} onChange={(v) => setFMaiusc("construtora", v)} />
          <Field label="Empreendimento" value={form.empreendimento} onChange={(v) => setFMaiusc("empreendimento", v)} />
          <Field label="Bloco / Apto" value={form.complemento} onChange={(v) => setFMaiusc("complemento", v)} />
          <div style={cell(true)}>
            <label style={lab}>Serviço desejado</label>
            <select style={inp} value={form.servico} onChange={(e) => setF("servico", e.target.value)}>
              {SERVICO_OPCOES.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <Field label="Data desejada" type="date" value={form.dataDesejada} onChange={(v) => setF("dataDesejada", v)} />
          <Field label="Horário desejado" type="time" value={form.horarioDesejado} onChange={(v) => setF("horarioDesejado", v)} />
        </Grid>
        <Area label="Observações (opcional)" value={form.observacoes} onChange={(v) => setFMaiusc("observacoes", v)} rows={2} placeholder="EX.: MELHOR HORÁRIO PARA CONTATO, DETALHES DO IMÓVEL..." />
        <button className="btn-solid" style={{ marginTop: 12 }} onClick={enviar} disabled={enviando}>
          {enviando ? <Loader2 size={15} className="spin" /> : <Plus size={15} />} Enviar cadastro
        </button>
      </Card>

      <Card icon={ClipboardCheck} titulo="Acompanhar meu atendimento">
        <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 12px" }}>
          Busque pelo seu nome ou CPF para ver o status da sua vistoria, ART/TRT e relatório.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <input style={{ ...inp, flex: 1 }} placeholder="Seu nome ou CPF…" value={busca}
            onChange={(e) => { setBusca(e.target.value); setBuscou(false); }}
            onKeyDown={(e) => e.key === "Enter" && buscar()} />
          <button className="btn-solid" onClick={buscar} disabled={buscando}>{buscando ? "Buscando…" : "Buscar"}</button>
        </div>

        {buscou && !buscando && resultados.length === 0 && (
          <p style={{ color: "#8593a8", fontSize: 14, marginTop: 14 }}>
            Nenhum atendimento encontrado ainda com esse nome/CPF. Assim que sua vistoria for agendada pela nossa equipe, ela aparecerá aqui.
          </p>
        )}

        {resultados.length > 0 && (
          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            {resultados.map((d) => (
              <div key={d.id} style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
                  <strong style={{ fontSize: 14 }}>{d.cliente || "—"}</strong>
                  <span style={{ fontSize: 12, color: "#65758b" }}>{d.empreendimento}{d.complemento ? ` · ${d.complemento}` : ""}</span>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Selo valor={d.vistoria} /> <Selo valor={d.art} /> <Selo valor={d.relatorio} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ================= UI primitivos ================= */
function Card({ icon: Icon, titulo, children }) {
  return (
    <section style={{ background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 14, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 15 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: CINZA_CLARO, display: "grid", placeItems: "center" }}><Icon size={16} color={AZUL_MEDIO} /></div>
        <h3 style={{ margin: 0, fontSize: 15, color: AZUL_MARINHO }}>{titulo}</h3>
      </div>
      {children}
    </section>
  );
}
function Colapsavel({ titulo, children }) {
  const [open, setOpen] = useState(false);
  return (
    <section style={{ background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 14 }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: 18, background: "none", border: "none", cursor: "pointer", fontSize: 15, color: AZUL_MARINHO, fontWeight: 600 }}>
        {open ? <ChevronDown size={17} /> : <ChevronRight size={17} />} {titulo}
      </button>
      {open && <div style={{ padding: "0 20px 20px" }}>{children}</div>}
    </section>
  );
}
const Grid = ({ children }) => <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>{children}</div>;
const cell = (full) => ({ display: "flex", flexDirection: "column", gap: 5, gridColumn: full ? "1 / -1" : "auto" });
const lab = { fontSize: 12, fontWeight: 600, color: "#5a6a80" };
const inp = { padding: "9px 11px", border: `1px solid ${CINZA_BORDA}`, borderRadius: 8, fontSize: 14, outline: "none", background: "#fff", fontFamily: "inherit" };
function Field({ label, value, onChange, type = "text", full }) {
  return (<div style={cell(full)}><label style={lab}>{label}</label><input type={type} style={inp} value={value} onChange={(e) => onChange(e.target.value)} /></div>);
}
function Area({ label, value, onChange, rows = 3, placeholder }) {
  return (<div style={{ ...cell(true), marginTop: 12 }}><label style={lab}>{label}</label><textarea rows={rows} style={{ ...inp, resize: "vertical", lineHeight: 1.5 }} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></div>);
}
function SecTitulo({ n, children }) {
  return (<h2 style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 16, color: AZUL_MARINHO, margin: "26px 0 12px", paddingBottom: 8, borderBottom: `2px solid ${CINZA_CLARO}` }}>
    <span style={{ fontFamily: "monospace", background: AZUL_MEDIO, color: "#fff", width: 24, height: 24, borderRadius: 6, display: "grid", placeItems: "center", fontSize: 13 }}>{n}</span>{children}</h2>);
}
const pTexto = { fontSize: 14, lineHeight: 1.65, color: "#2b3648", textAlign: "justify", margin: "0 0 12px" };
function TabelaDados({ rows }) {
  return (<table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 14, fontSize: 13.5 }}><tbody>
    {rows.filter(([, v]) => v).map(([k, v]) => (
      <tr key={k}><td style={{ background: CINZA_CLARO, fontWeight: 600, padding: "8px 12px", width: "36%", border: `1px solid ${CINZA_BORDA}`, color: AZUL_MARINHO }}>{k}</td>
        <td style={{ padding: "8px 12px", border: `1px solid ${CINZA_BORDA}` }}>{v}</td></tr>))}
  </tbody></table>);
}

/* ================= estilos globais ================= */
const overlay = { position: "fixed", inset: 0, background: "rgba(18,51,91,.45)", display: "grid", placeItems: "center", zIndex: 50, padding: 20 };
const modal = { background: "#fff", borderRadius: 14, padding: 22, width: "100%", maxWidth: 440 };
const toastStyle = { position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", background: AZUL_MARINHO, color: "#fff", padding: "10px 18px", borderRadius: 30, display: "flex", alignItems: "center", gap: 8, fontSize: 14, zIndex: 60, boxShadow: "0 8px 24px rgba(0,0,0,.2)" };

const estilos = `
  * { box-sizing: border-box; }
  .tab { background:none; border:none; border-bottom:3px solid transparent; padding:11px 14px; font-size:14px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:7px; }
  .btn-ghost { background:rgba(255,255,255,.1); color:#fff; border:none; padding:8px 13px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px; }
  .btn-ghost:hover { background:rgba(255,255,255,.2); }
  .btn-solid { background:${AZUL_MEDIO}; color:#fff; border:none; padding:8px 14px; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:6px; }
  .btn-add { width:100%; padding:14px; border:1.5px dashed ${AZUL_MEDIO}; background:#f6f9fd; color:${AZUL_MEDIO}; border-radius:12px; font-size:15px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; }
  .btn-add:hover { background:#eef4fb; }
  .btn-mini { background:${AZUL_MEDIO}; color:#fff; border:none; padding:5px 12px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; }
  .btn-ia { margin-top:9px; width:100%; background:${AZUL_MARINHO}; color:#fff; border:none; padding:10px; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:7px; }
  .btn-ia:hover { background:${AZUL_MEDIO}; }
  .btn-ia:disabled { opacity:.7; cursor:default; }
  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .icon-btn { background:none; border:none; cursor:pointer; padding:5px; border-radius:6px; display:grid; place-items:center; }
  .icon-btn:hover { background:${CINZA_CLARO}; }
  .foto-x { position:absolute; top:3px; right:3px; background:rgba(198,40,40,.92); color:#fff; border:none; border-radius:50%; width:20px; height:20px; display:grid; place-items:center; cursor:pointer; }
  select, input, textarea { font-family:inherit; }
  input:focus, textarea:focus, select:focus { border-color:${AZUL_MEDIO}; }
  @media print {
    .no-print { display:none !important; }
    body { background:#fff !important; }
    main { padding:0 !important; max-width:100% !important; }
    .laudo-print { border:none !important; border-radius:0 !important; }
  }
`;
