import React, { useState, useEffect, useRef } from "react";
import {
  FileText, Plus, Trash2, Camera, X, Printer, Save, FolderOpen,
  Building2, User, ClipboardList, ChevronDown, ChevronRight, Check,
  AlertTriangle, CircleAlert, Info, Copy, Sparkles, Loader2,
  Search, Instagram, MessageCircle, RefreshCw
} from "lucide-react";

/* ============================================================
   FN EDIFICAÇÕES — Gerador de Laudos (protótipo)
   Cores da marca: Azul Médio #2C75B5 / Azul Marinho #12335B
   ============================================================ */

const AZUL_MEDIO = "#2C75B5";
const AZUL_MARINHO = "#12335B";
const CINZA_CLARO = "#F1F4F8";
const CINZA_BORDA = "#D8DEE7";

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
  status: "Agendado",
};

/* ---------- Consulta pública de andamento (dado compartilhado) ---------- */
const STATUS_ATENDIMENTO = [
  "Agendado",
  "Vistoria realizada",
  "Laudo em elaboração",
  "Em revisão de qualidade",
  "TRT em andamento",
  "Concluído / Entregue",
];
const statusCor = {
  "Agendado": { cor: "#B26A00", bg: "#FFF4E0" },
  "Vistoria realizada": { cor: "#2C75B5", bg: "#E7F0FB" },
  "Laudo em elaboração": { cor: "#2C75B5", bg: "#E7F0FB" },
  "Em revisão de qualidade": { cor: "#7B3FA0", bg: "#F2E9F8" },
  "TRT em andamento": { cor: "#7B3FA0", bg: "#F2E9F8" },
  "Concluído / Entregue": { cor: "#2E7D32", bg: "#E6F4EA" },
};
const soDigitos = (v) => (v || "").replace(/\D/g, "");
const normalizarTexto = (v) => (v || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const chaveAtendimento = (nome, cpf) => {
  const digitos = soDigitos(cpf);
  if (digitos) return `fn_atendimento:${digitos}`;
  const slug = normalizarTexto(nome).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `fn_atendimento:${slug || "sem-nome"}`;
};

const sevMeta = {
  Baixa: { cor: "#2E7D32", bg: "#E6F4EA", icon: Info },
  Média: { cor: "#B26A00", bg: "#FFF4E0", icon: CircleAlert },
  Alta: { cor: "#C62828", bg: "#FCEAEA", icon: AlertTriangle },
};

let idCounter = 1;
const novoItem = () => ({ id: idCounter++, local: "", tipo: "", patologia: "", severidade: "Média", descricao: "", recomendacao: "", nota: "", fotos: [] });

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
export default function App() {
  const [aba, setAba] = useState("dados");
  const [dados, setDados] = useState(DADOS_INICIAIS);
  const [itens, setItens] = useState([novoItem()]);
  const [rascunhos, setRascunhos] = useState([]);
  const [toast, setToast] = useState("");
  const [showLoad, setShowLoad] = useState(false);

  const notify = (m) => { setToast(m); setTimeout(() => setToast(""), 2200); };

  /* ---- persistência (window.storage, texto apenas) ---- */
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
      await salvarAndamento();
      notify("Rascunho salvo ✓");
      listarRascunhos();
    } catch { notify("Não foi possível salvar o rascunho"); }
  };

  /* ---- andamento do cliente (dado COMPARTILHADO — visível na consulta pública) ---- */
  const salvarAndamento = async () => {
    if (!temStorage) return;
    const nome = dados.contratante.nome?.trim();
    const cpf = dados.contratante.cpf?.trim();
    if (!nome && !cpf) return notify("Informe nome ou CPF do cliente antes de atualizar o andamento.");
    const key = chaveAtendimento(nome, cpf);
    const registro = {
      nome: nome || "",
      cpf: cpf || "",
      empreendimento: dados.imovel.empreendimento || "",
      unidade: dados.imovel.unidade || "",
      status: dados.status || "Agendado",
      atualizadoEm: new Date().toISOString(),
    };
    try {
      await window.storage.set(key, JSON.stringify(registro), true);
      notify("Andamento atualizado para o cliente ✓");
    } catch { notify("Não foi possível atualizar o andamento."); }
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
  const setStatus = (val) => setDados((d) => ({ ...d, status: val }));

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
            <div style={{ width: 38, height: 38, borderRadius: 9, background: AZUL_MEDIO, display: "grid", placeItems: "center", fontWeight: 800, letterSpacing: 0.5 }}>FN</div>
            <div style={{ lineHeight: 1.1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>FN Edificações</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>Gerador de Laudos · v1.0</div>
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <button className="btn-ghost" onClick={() => { setShowLoad(true); listarRascunhos(); }}><FolderOpen size={15} /> Abrir</button>
          <button className="btn-ghost" onClick={salvarRascunho}><Save size={15} /> Salvar</button>
          <button className="btn-solid" onClick={() => { setAba("laudo"); setTimeout(imprimir, 300); }}><Printer size={15} /> Gerar PDF</button>
        </div>
        <nav style={{ maxWidth: 1080, margin: "0 auto", padding: "0 18px", display: "flex", gap: 4, flexWrap: "wrap" }}>
          {[["dados", "Dados do laudo", ClipboardList], ["itens", `Vistoria (${totalItens})`, Camera], ["laudo", "Laudo final", FileText], ["consulta", "Consulta do cliente", Search]].map(([k, label, Icon]) => (
            <button key={k} onClick={() => setAba(k)} className="tab" style={{ borderBottomColor: aba === k ? AZUL_MEDIO : "transparent", color: aba === k ? "#fff" : "rgba(255,255,255,.6)" }}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </nav>
      </header>

      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "22px 18px 80px" }}>
        {aba === "dados" && <AbaDados dados={dados} setD={setD} setTexto={setTexto} setStatus={setStatus} salvarAndamento={salvarAndamento} />}
        {aba === "itens" && (
          <AbaItens itens={itens} setItens={setItens} updItem={updItem} escolherPatologia={escolherPatologia}
            addFotos={addFotos} removerFoto={removerFoto} contagem={contagem} />
        )}
        {aba === "laudo" && <Laudo dados={dados} itens={itens} contagem={contagem} totalItens={totalItens} />}
        {aba === "consulta" && <ConsultaCliente />}
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

/* ================= Aba: Consulta do cliente (pública) ================= */
const STATUS_DESCRICAO_CLIENTE = {
  "Agendado": "Sua vistoria já foi agendada. Em breve nossa equipe entra em contato com a data.",
  "Vistoria realizada": "A vistoria já foi realizada e está no setor técnico para elaboração do laudo.",
  "Laudo em elaboração": "Seu atendimento está no setor de vistoria: o laudo está sendo elaborado.",
  "Em revisão de qualidade": "O laudo está em revisão de qualidade antes da entrega final.",
  "TRT em andamento": "A documentação técnica (TRT) está sendo providenciada.",
  "Concluído / Entregue": "Atendimento concluído! O laudo já foi entregue.",
};

function ConsultaCliente() {
  const [cpf, setCpf] = useState("");
  const [resultado, setResultado] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState("");
  const temStorage = typeof window !== "undefined" && window.storage;

  const pesquisar = async () => {
    const termoDigitos = soDigitos(cpf);
    if (termoDigitos.length < 6) { setErro("Digite um CPF válido para consultar."); setResultado(null); return; }
    setErro(""); setBuscando(true); setResultado(null);
    if (!temStorage) { setErro("Consulta indisponível neste ambiente de teste."); setBuscando(false); return; }
    try {
      const lista = await window.storage.list("fn_atendimento:", true);
      const chaves = lista?.keys || [];
      let achado = null;
      for (const k of chaves) {
        try {
          const r = await window.storage.get(k, true);
          const reg = JSON.parse(r.value);
          if (soDigitos(reg.cpf) === termoDigitos) { achado = reg; break; }
        } catch { /* ignora registro corrompido */ }
      }
      if (!achado) setErro("Nenhum atendimento encontrado com esse CPF. Confira o número ou fale com a gente pelo WhatsApp.");
      setResultado(achado);
    } catch {
      setErro("Não foi possível consultar agora. Tente novamente em instantes.");
    } finally { setBuscando(false); }
  };

  const fmtData = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
      " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ background: AZUL_MARINHO, padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: AZUL_MEDIO, display: "grid", placeItems: "center", color: "#fff", fontWeight: 800, fontSize: 14 }}>FN</div>
          <h3 style={{ margin: 0, fontSize: 17, color: "#fff", fontWeight: 700 }}>Consulta do cliente</h3>
        </div>

        <div style={{ padding: 20 }}>
          <p style={{ fontSize: 13.5, color: "#5a6a80", marginTop: 0 }}>
            Digite o CPF do contratante para ver em que etapa está sua vistoria ou laudo.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              style={{ ...inp, flex: 1, minWidth: 220 }}
              placeholder="CPF (só números ou com pontuação)"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && pesquisar()}
            />
            <button className="btn-solid" onClick={pesquisar} disabled={buscando}>
              {buscando ? <Loader2 size={15} className="spin" /> : <Search size={15} />} {buscando ? "Buscando…" : "Consultar"}
            </button>
          </div>
          {erro && <div style={{ fontSize: 13, color: "#c62828", marginTop: 10 }}>{erro}</div>}

          {resultado && (
            <div style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 12, padding: 16, marginTop: 16 }}>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <strong style={{ fontSize: 16, color: AZUL_MARINHO }}>{resultado.nome || "Cliente"}</strong>
                <div style={{ flex: 1 }} />
                <span style={{ background: (statusCor[resultado.status] || statusCor["Agendado"]).bg, color: (statusCor[resultado.status] || statusCor["Agendado"]).cor, padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{resultado.status}</span>
              </div>
              {resultado.empreendimento && (
                <div style={{ fontSize: 13, color: "#5a6a80", marginTop: 6 }}>
                  Empreendimento: <strong>{resultado.empreendimento}</strong>{resultado.unidade && `, ${resultado.unidade}`}
                </div>
              )}
              <p style={{ fontSize: 14, color: "#2b3648", marginTop: 10, marginBottom: 4, lineHeight: 1.5 }}>
                {STATUS_DESCRICAO_CLIENTE[resultado.status] || "Seu atendimento está em andamento."}
              </p>
              {resultado.atualizadoEm && <div style={{ fontSize: 11.5, color: "#8593a8" }}>Atualizado em {fmtData(resultado.atualizadoEm)}</div>}
            </div>
          )}
        </div>
      </div>

      <Card icon={Instagram} titulo="Ficou com alguma dúvida? Fale com a gente">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a href="https://wa.me/5581983061305" target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: AZUL_MARINHO, background: CINZA_CLARO, padding: "10px 16px", borderRadius: 10, fontSize: 14, fontWeight: 600 }}>
            <MessageCircle size={16} color={AZUL_MEDIO} /> WhatsApp (81) 98306-1305
          </a>
          <a href="https://www.instagram.com/fn.edificacoes/" target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: AZUL_MARINHO, background: CINZA_CLARO, padding: "10px 16px", borderRadius: 10, fontSize: 14, fontWeight: 600 }}>
            <Instagram size={16} color={AZUL_MEDIO} /> @fn.edificacoes
          </a>
        </div>
      </Card>
    </div>
  );
}

/* ================= Aba: Dados ================= */
function AbaDados({ dados, setD, setTexto, setStatus, salvarAndamento }) {
  const sc = statusCor[dados.status] || statusCor["Agendado"];
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card icon={User} titulo="Identificação do contratante (proprietário)">
        <Grid>
          <Field label="Nome" value={dados.contratante.nome} onChange={(v) => setD("contratante", "nome", v)} full />
          <Field label="CPF / CNPJ" value={dados.contratante.cpf} onChange={(v) => setD("contratante", "cpf", v)} />
        </Grid>
      </Card>

      <Card icon={RefreshCw} titulo="Andamento do atendimento (visível ao cliente pelo CPF)">
        <Grid>
          <div style={cell()}>
            <label style={lab}>Status atual</label>
            <select style={{ ...inp, color: sc.cor, fontWeight: 600 }} value={dados.status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_ATENDIMENTO.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </Grid>
        <button className="btn-ia" style={{ marginTop: 12 }} onClick={salvarAndamento}>
          <RefreshCw size={15} /> Atualizar andamento para o cliente
        </button>
        <p style={{ fontSize: 11.5, color: "#8593a8", marginTop: 8, marginBottom: 0 }}>
          O cliente consulta pelo CPF informado acima, na aba "Consulta do cliente". Requer CPF preenchido.
        </p>
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
function Laudo({ dados, itens, contagem, totalItens }) {
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
