/* ============================================================
   MAPA DE ATUAÇÃO — visão estratégica da FN Nacional
   ============================================================
   Brasil: cada estado pintado pela intensidade (clientes, empreendimentos ou parceiros).
   Regional: o estado aberto por município, com as cidades cadastradas em destaque.

   Os números vêm de /api/nacional/mapa (ver src/nacional.js no backend), lidos do banco a
   cada consulta, e a tela se atualiza sozinha a cada minuto. O desenho do Brasil é estático
   (src/mapa-brasil.js); o de municípios de cada UF fica em public/mapas e só é baixado
   quando alguém abre aquela regional. Ambos vêm da malha oficial do IBGE.

   Cor: mapa de calor amarelo → vermelho em 5 faixas com legenda (escala "semântica de
   calor"), e cinza neutro para "sem atuação" — zero não é a faixa mais clara. */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCcw, MapPin, Users, Building2, Handshake, Map as IconeMapa } from "lucide-react";
import { ESTADOS, MAPA_LARGURA, MAPA_ALTURA } from "./mapa-brasil.js";

const AZUL_MARINHO = "#12335B";
const AZUL_MEDIO = "#2C75B5";
const CINZA_CLARO = "#F1F4F8";
const CINZA_BORDA = "#D8DEE7";
const SEM_ATUACAO = "#E8ECF2";
const CALOR = ["#F7C460", "#F2A24A", "#EA7A37", "#D44E2C", "#9F2226"];
const ATUALIZAR_A_CADA_MS = 60 * 1000;

const METRICAS = {
  clientes: { rotulo: "Clientes atendidos", curto: "clientes", Icon: Users },
  empreendimentos: { rotulo: "Empreendimentos atendidos", curto: "empreendimentos", Icon: Building2 },
  parceiros: { rotulo: "Parceiros ativos", curto: "parceiros", Icon: Handshake },
};
const PERIODOS = [["tudo", "Todo o período"], ["12m", "Últimos 12 meses"], ["90d", "Últimos 90 dias"], ["mes", "Último mês"]];
const ROTULO_STATUS = {
  nao_iniciada: "Não iniciada", prospeccao: "Prospecção", recrutamento: "Recrutamento", piloto: "Piloto",
  ativa: "Ativa", expansao: "Expansão", consolidada: "Consolidada", suspensa: "Suspensa",
};
/* Estados pequenos do litoral não comportam a sigla dentro: o rótulo vai para o mar, com uma
   linha até o estado — como nos mapas do IBGE. */
const DESLOCAR_ROTULO = { RN: [26, -6], PB: [34, 0], PE: [40, 7], AL: [32, 9], SE: [26, 12], ES: [24, 4], RJ: [22, 12], DF: [0, -1], SC: [26, 2] };

const btn = { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: `1px solid ${CINZA_BORDA}`, background: "#fff", color: AZUL_MARINHO, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };
const sel = { padding: "7px 10px", border: `1px solid ${CINZA_BORDA}`, borderRadius: 8, fontSize: 13, background: "#fff", fontFamily: "inherit" };
const th = { textAlign: "left", fontSize: 11.5, fontWeight: 700, color: "#5a6a80", padding: "7px 8px", borderBottom: `1px solid ${CINZA_BORDA}`, whiteSpace: "nowrap" };
const td = { fontSize: 13, padding: "7px 8px", borderBottom: `1px solid ${CINZA_CLARO}`, whiteSpace: "nowrap" };
const tdNum = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };

const normalizar = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const num = (n) => Number(n || 0).toLocaleString("pt-BR");

/* Faixas da legenda a partir do maior valor: até 5 faixas, limites inteiros e crescentes.
   Com poucos dados (máximo 3, por exemplo) sobram 3 faixas, e as cores são escolhidas
   espalhadas pela escala para o contraste entre elas continuar grande. */
function montarFaixas(valores) {
  const max = Math.max(0, ...valores);
  if (max === 0) return [];
  let limites;
  if (max <= 5) limites = Array.from({ length: max }, (_, i) => i + 1);
  else {
    limites = [];
    for (const f of [0.1, 0.25, 0.5, 0.75, 1]) {
      let v = Math.ceil(max * f);
      if (limites.length && v <= limites[limites.length - 1]) v = limites[limites.length - 1] + 1;
      if (v > max) break;
      limites.push(v);
    }
    if (limites[limites.length - 1] !== max) limites.push(max);
  }
  const indices = { 1: [4], 2: [1, 4], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4] }[limites.length];
  return limites.map((hi, i) => {
    const lo = i === 0 ? 1 : limites[i - 1] + 1;
    return { lo, hi, cor: CALOR[indices[i]], rotulo: lo === hi ? num(hi) : `${num(lo)} – ${num(hi)}` };
  });
}
const corDe = (valor, faixas) => (!valor ? SEM_ATUACAO : (faixas.find((f) => valor <= f.hi) || faixas[faixas.length - 1]).cor);

function Legenda({ faixas, metrica }) {
  return (
    <div style={{ display: "grid", gap: 4, fontSize: 12, color: "#33435a" }}>
      <div style={{ fontWeight: 700, color: AZUL_MARINHO }}>{METRICAS[metrica].rotulo}</div>
      {[...faixas].reverse().map((f) => (
        <div key={f.rotulo} style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ width: 22, height: 12, borderRadius: 3, background: f.cor, border: "1px solid rgba(0,0,0,.08)" }} /> {f.rotulo}
        </div>
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ width: 22, height: 12, borderRadius: 3, background: SEM_ATUACAO, border: "1px solid rgba(0,0,0,.08)" }} /> Sem atuação
      </div>
    </div>
  );
}

function Indicador({ rotulo, valor }) {
  return (
    <div style={{ background: CINZA_CLARO, borderRadius: 10, padding: "10px 12px", minWidth: 0 }}>
      <div style={{ fontSize: 11.5, color: "#5a6a80", fontWeight: 600 }}>{rotulo}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: AZUL_MARINHO, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{valor}</div>
    </div>
  );
}

/* Dica que segue o mouse dentro do quadro do mapa. */
function useDica() {
  const caixa = useRef(null);
  const [dica, setDica] = useState(null);
  const mover = (e, conteudo) => {
    const r = caixa.current?.getBoundingClientRect();
    if (!r) return;
    setDica({ x: e.clientX - r.left, y: e.clientY - r.top, largura: r.width, conteudo });
  };
  const elemento = dica && (
    <div style={{
      position: "absolute", pointerEvents: "none", zIndex: 5, background: "#fff", border: `1px solid ${CINZA_BORDA}`,
      borderRadius: 8, padding: "8px 10px", boxShadow: "0 6px 18px rgba(18,51,91,.15)", fontSize: 12.5, color: "#1d2a3a",
      top: dica.y + 14, left: Math.min(dica.x + 14, dica.largura - 220), width: 206,
    }}>{dica.conteudo}</div>
  );
  return { caixa, mover, sair: () => setDica(null), elemento };
}

function ConteudoDica({ titulo, subtitulo, linha }) {
  return (
    <>
      <div style={{ fontWeight: 700, color: AZUL_MARINHO }}>{titulo}</div>
      {subtitulo && <div style={{ fontSize: 11.5, color: "#5a6a80", marginBottom: 4 }}>{subtitulo}</div>}
      {Object.entries(METRICAS).map(([k, m]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between" }}><span>{m.rotulo}</span><b style={{ fontVariantNumeric: "tabular-nums" }}>{num(linha?.[k])}</b></div>
      ))}
    </>
  );
}

/* Retângulo que envolve um contorno "M x,y L x,y … Z" (os números vêm aos pares). */
function caixaDoContorno(d) {
  const n = d.match(/-?\d+(?:\.\d+)?/g).map(Number);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i + 1 < n.length; i += 2) {
    x0 = Math.min(x0, n[i]); x1 = Math.max(x1, n[i]); y0 = Math.min(y0, n[i + 1]); y1 = Math.max(y1, n[i + 1]);
  }
  return { x0, y0, x1, y1 };
}

const cacheMunicipios = new Map();
async function carregarMunicipios(uf) {
  if (!cacheMunicipios.has(uf)) {
    cacheMunicipios.set(uf, fetch(`${import.meta.env.BASE_URL}mapas/municipios-${uf}.json`).then((r) => {
      if (!r.ok) throw new Error("Mapa do estado indisponível.");
      return r.json();
    }).catch((e) => { cacheMunicipios.delete(uf); throw e; }));
  }
  return cacheMunicipios.get(uf);
}

export default function AbaMapaAtuacao({ token, apiFetch, notify }) {
  const [periodo, setPeriodo] = useState("tudo");
  const [metrica, setMetrica] = useState("clientes");
  const [vista, setVista] = useState(null); // null = Brasil; senão, a UF aberta
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState(null);

  const carregar = async () => {
    setCarregando(true);
    try {
      setDados(await apiFetch(`/api/nacional/mapa?periodo=${periodo}`, { token }));
      setAtualizadoEm(new Date());
    } catch (e) { notify(`Não foi possível carregar o mapa: ${e.message}`); }
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, [periodo]);
  /* Tempo real: relê o banco a cada minuto enquanto a tela está aberta. Aba escondida não
     consulta — o servidor não precisa responder para ninguém olhando. */
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") carregar(); }, ATUALIZAR_A_CADA_MS);
    return () => clearInterval(t);
  }, [periodo]);

  /* Gestor regional não tem visão Brasil: abre direto na regional dele. */
  useEffect(() => {
    if (dados && !dados.nacional && !vista && dados.regionais[0]) setVista(dados.regionais[0].uf);
  }, [dados]);

  const regionalDaUf = useMemo(() => Object.fromEntries((dados?.regionais || []).map((r) => [r.uf, r])), [dados]);

  return (
    <div>
      <section style={{ background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 14, padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 14 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: CINZA_CLARO, display: "grid", placeItems: "center" }}><IconeMapa size={16} color={AZUL_MEDIO} /></div>
          <h3 style={{ margin: 0, fontSize: 15, color: AZUL_MARINHO, flex: 1 }}>Mapa de atuação</h3>
          <span style={{ fontSize: 12, color: "#5a6a80" }}>
            {atualizadoEm ? `Atualizado às ${atualizadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · atualiza sozinho a cada minuto` : "Carregando…"}
          </span>
          <button style={btn} onClick={carregar}><RefreshCcw size={14} className={carregando ? "spin" : ""} /> Atualizar</button>
        </div>

        {/* Filtros numa linha só, acima do mapa */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {dados?.nacional && (
            <button style={{ ...btn, background: vista === null ? AZUL_MARINHO : "#fff", color: vista === null ? "#fff" : AZUL_MARINHO }} onClick={() => setVista(null)}>
              Brasil
            </button>
          )}
          {(dados?.regionais || []).map((r) => (
            <button key={r.id} style={{ ...btn, background: vista === r.uf ? AZUL_MARINHO : "#fff", color: vista === r.uf ? "#fff" : AZUL_MARINHO }} onClick={() => setVista(r.uf)}>
              {r.nome} · <span style={{ fontWeight: 500, opacity: 0.8 }}>{ROTULO_STATUS[r.status] || r.status}</span>
            </button>
          ))}
          {vista && !regionalDaUf[vista] && <span style={{ ...btn, background: AZUL_MARINHO, color: "#fff", cursor: "default" }}>{ESTADOS[vista]?.nome} · sem regional</span>}
          <span style={{ flex: 1 }} />
          <div role="radiogroup" aria-label="Medida" style={{ display: "inline-flex", border: `1px solid ${CINZA_BORDA}`, borderRadius: 8, overflow: "hidden" }}>
            {Object.entries(METRICAS).map(([k, m]) => (
              <button key={k} role="radio" aria-checked={metrica === k} onClick={() => setMetrica(k)}
                style={{ ...btn, border: "none", borderRadius: 0, background: metrica === k ? AZUL_MEDIO : "#fff", color: metrica === k ? "#fff" : AZUL_MARINHO }}>
                <m.Icon size={14} /> {m.rotulo.split(" ")[0]}
              </button>
            ))}
          </div>
          <select style={sel} value={periodo} onChange={(e) => setPeriodo(e.target.value)} title="Período dos clientes e empreendimentos">
            {PERIODOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
      </section>

      {!dados ? null : vista === null
        ? <VisaoBrasil dados={dados} metrica={metrica} regionalDaUf={regionalDaUf} abrir={setVista} />
        : <VisaoRegional key={vista} uf={vista} dados={dados} metrica={metrica} regional={regionalDaUf[vista]} />}

      {dados && (dados.semLocal.clientes > 0 || dados.semLocal.clientesSemCidade > 0 || dados.semLocal.parceiros > 0) && (
        <p style={{ fontSize: 12, color: "#5a6a80", margin: "4px 2px 0" }}>
          Fora do mapa: {num(dados.semLocal.clientes)} cliente(s) sem estado, {num(dados.semLocal.clientesSemCidade)} sem cidade e {num(dados.semLocal.parceiros)} parceiro(s) sem localização.
          Defina regional, cidade e UF do empreendimento em <b>Rede Nacional → Empreendimentos</b> e a cidade do parceiro no perfil dele.
        </p>
      )}
    </div>
  );
}

/* ---------------- Brasil ---------------- */
function VisaoBrasil({ dados, metrica, regionalDaUf, abrir }) {
  const porUf = useMemo(() => Object.fromEntries(dados.ufs.map((u) => [u.uf, u])), [dados]);
  const faixas = useMemo(() => montarFaixas(dados.ufs.map((u) => u[metrica])), [dados, metrica]);
  const dica = useDica();
  const total = (k) => dados.ufs.reduce((s, u) => s + u[k], 0);
  const ufsComAtuacao = dados.ufs.filter((u) => u.clientes || u.parceiros).length;
  const cidadesComAtuacao = dados.cidades.filter((c) => c.clientes || c.parceiros).length;
  const ranking = [...dados.ufs].filter((u) => u.clientes || u.empreendimentos || u.parceiros)
    .sort((a, b) => b[metrica] - a[metrica] || b.clientes - a.clientes);

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
        <Indicador rotulo="Estados com atuação" valor={num(ufsComAtuacao)} />
        <Indicador rotulo="Cidades com atuação" valor={num(cidadesComAtuacao)} />
        <Indicador rotulo="Clientes atendidos" valor={num(total("clientes"))} />
        <Indicador rotulo="Empreendimentos atendidos" valor={num(total("empreendimentos"))} />
        <Indicador rotulo="Parceiros ativos" valor={num(total("parceiros"))} />
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
        <section ref={dica.caixa} style={{ position: "relative", flex: "3 1 420px", background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 14, padding: 14, minWidth: 0 }}>
          <svg viewBox={`-10 -10 ${MAPA_LARGURA + 70} ${MAPA_ALTURA + 20}`} style={{ width: "100%", height: "auto", display: "block" }} role="img"
            aria-label={`Mapa do Brasil por estado: ${METRICAS[metrica].rotulo}`}>
            {Object.entries(ESTADOS).map(([uf, e]) => {
              const linha = porUf[uf];
              const reg = regionalDaUf[uf];
              return (
                <path key={uf} d={e.d} fill={corDe(linha?.[metrica], faixas)} stroke="#fff" strokeWidth={0.8} strokeLinejoin="round"
                  style={{ cursor: "pointer" }} tabIndex={0} aria-label={`${e.nome}: ${num(linha?.[metrica])} ${METRICAS[metrica].curto}`}
                  onMouseMove={(ev) => dica.mover(ev, <ConteudoDica titulo={e.nome} subtitulo={reg ? `${reg.nome} · ${ROTULO_STATUS[reg.status] || reg.status}` : "Sem regional"} linha={linha} />)}
                  onMouseLeave={dica.sair} onClick={() => abrir(uf)} onKeyDown={(ev) => ev.key === "Enter" && abrir(uf)} />
              );
            })}
            {/* Contorno de quem tem regional, por cima de todos — senão o vizinho cobre a borda. */}
            {Object.entries(ESTADOS).filter(([uf]) => regionalDaUf[uf]).map(([uf, e]) => (
              <path key={`r-${uf}`} d={e.d} fill="none" stroke={AZUL_MARINHO} strokeWidth={1.8} strokeLinejoin="round" pointerEvents="none" />
            ))}
            {Object.entries(ESTADOS).map(([uf, e]) => {
              const [dx, dy] = DESLOCAR_ROTULO[uf] || [0, 0];
              const destaque = !!regionalDaUf[uf];
              return (
                <g key={`t-${uf}`} pointerEvents="none">
                  {(dx || dy) ? <line x1={e.x} y1={e.y} x2={e.x + dx - 6} y2={e.y + dy - 3} stroke="#7a889c" strokeWidth={0.6} /> : null}
                  <text x={e.x + dx} y={e.y + dy} textAnchor={dx ? "start" : "middle"} dominantBaseline="middle"
                    style={{ fontSize: destaque ? 12.5 : 10.5, fontWeight: destaque ? 800 : 600, fill: destaque ? AZUL_MARINHO : "#4a5a70", paintOrder: "stroke", stroke: "#fff", strokeWidth: 3, strokeLinejoin: "round" }}>
                    {uf}
                  </text>
                </g>
              );
            })}
          </svg>
          <div style={{ position: "absolute", left: 18, bottom: 18, background: "rgba(255,255,255,.92)", borderRadius: 8, padding: 8 }}>
            <Legenda faixas={faixas} metrica={metrica} />
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, marginTop: 6, color: "#33435a" }}>
              <span style={{ width: 22, height: 12, borderRadius: 3, border: `2px solid ${AZUL_MARINHO}` }} /> Estado com regional
            </div>
          </div>
          {dica.elemento}
        </section>

        <section style={{ flex: "2 1 300px", background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 14, padding: 14, minWidth: 0 }}>
          <h4 style={{ margin: "0 0 8px", color: AZUL_MARINHO, fontSize: 14 }}>Estados</h4>
          <p style={{ fontSize: 12, color: "#5a6a80", marginTop: 0 }}>Clique num estado (no mapa ou aqui) para ver os municípios.</p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>Estado</th><th style={th}>Regional</th><th style={{ ...th, textAlign: "right" }}>Clientes</th><th style={{ ...th, textAlign: "right" }}>Empreend.</th><th style={{ ...th, textAlign: "right" }}>Parceiros</th></tr></thead>
              <tbody>
                {ranking.map((u) => {
                  const reg = regionalDaUf[u.uf];
                  return (
                    <tr key={u.uf} onClick={() => abrir(u.uf)} style={{ cursor: "pointer" }}>
                      <td style={td}><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: corDe(u[metrica], faixas), marginRight: 6 }} /><b>{u.uf}</b> {ESTADOS[u.uf]?.nome}</td>
                      <td style={td}>{reg ? ROTULO_STATUS[reg.status] || reg.status : "—"}</td>
                      <td style={tdNum}>{num(u.clientes)}</td><td style={tdNum}>{num(u.empreendimentos)}</td><td style={tdNum}>{num(u.parceiros)}</td>
                    </tr>
                  );
                })}
                {/* Regional aberta (prospecção, recrutamento) ainda sem nenhum número também aparece: é para onde a FN vai. */}
                {Object.values(regionalDaUf).filter((r) => !ranking.some((u) => u.uf === r.uf)).map((r) => (
                  <tr key={`v-${r.uf}`} onClick={() => abrir(r.uf)} style={{ cursor: "pointer" }}>
                    <td style={td}><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: SEM_ATUACAO, marginRight: 6 }} /><b>{r.uf}</b> {ESTADOS[r.uf]?.nome}</td>
                    <td style={td}>{ROTULO_STATUS[r.status] || r.status}</td>
                    <td style={tdNum}>0</td><td style={tdNum}>0</td><td style={tdNum}>0</td>
                  </tr>
                ))}
                {!ranking.length && !Object.keys(regionalDaUf).length && <tr><td style={td} colSpan={5}>Nenhum dado com estado definido ainda.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

/* ---------------- Regional (municípios) ---------------- */
function VisaoRegional({ uf, dados, metrica, regional }) {
  const [malha, setMalha] = useState(null);
  const [erroMalha, setErroMalha] = useState("");
  const dica = useDica();
  useEffect(() => {
    setMalha(null); setErroMalha("");
    carregarMunicipios(uf).then(setMalha).catch((e) => setErroMalha(e.message));
  }, [uf]);

  const cidadesUf = useMemo(() => dados.cidades.filter((c) => c.uf === uf), [dados, uf]);
  /* Casa o nome digitado no cadastro com o município do IBGE sem acento nem caixa. O que não
     casar vai para a lista "não localizadas", para alguém corrigir a grafia. */
  const { porMunicipio, naoLocalizadas } = useMemo(() => {
    const porNome = new Map((malha?.municipios || []).map((m) => [normalizar(m.nome), m.id]));
    const mapa = {}; const fora = [];
    for (const c of cidadesUf) {
      const id = porNome.get(normalizar(c.cidade));
      if (!id) { if (malha) fora.push(c); continue; }
      const atual = mapa[id] || { clientes: 0, empreendimentos: 0, parceiros: 0 };
      mapa[id] = { clientes: atual.clientes + c.clientes, empreendimentos: atual.empreendimentos + c.empreendimentos, parceiros: atual.parceiros + c.parceiros };
    }
    return { porMunicipio: mapa, naoLocalizadas: fora };
  }, [malha, cidadesUf]);
  const cadastradas = useMemo(() => new Set(dados.cidadesCadastradas.filter((c) => c.uf === uf && c.ativa).map((c) => normalizar(c.nome))), [dados, uf]);
  const faixas = useMemo(() => montarFaixas(Object.values(porMunicipio).map((l) => l[metrica])), [porMunicipio, metrica]);

  const linhaUf = dados.ufs.find((u) => u.uf === uf) || { clientes: 0, empreendimentos: 0, parceiros: 0 };
  const nomeMunicipio = Object.fromEntries((malha?.municipios || []).map((m) => [m.id, m.nome]));
  const ranking = Object.entries(porMunicipio).map(([id, l]) => ({ id, nome: nomeMunicipio[id], ...l }))
    .sort((a, b) => b[metrica] - a[metrica] || b.clientes - a.clientes);
  const municipiosComAtuacao = ranking.filter((r) => r.clientes || r.parceiros).length;

  /* Zoom na atuação. A operação costuma ficar numa região metropolitana que, no estado
     inteiro, vira um punhado de pontos (Recife, Olinda e Jaboatão somem no desenho de PE).
     O quadro abre ajustado aos municípios com atuação e às cidades cadastradas; o botão
     "Estado inteiro" volta para o estado todo. */
  const [zoom, setZoom] = useState("atuacao");
  const caixas = useMemo(() => Object.fromEntries((malha?.municipios || []).map((m) => [m.id, caixaDoContorno(m.d)])), [malha]);
  const quadro = useMemo(() => {
    if (!malha) return null;
    const inteiro = { x: -6, y: -6, w: malha.largura + 12, h: malha.altura + 12 };
    const ids = malha.municipios.filter((m) => {
      const l = porMunicipio[m.id];
      return (l && (l.clientes || l.empreendimentos || l.parceiros)) || cadastradas.has(normalizar(m.nome));
    }).map((m) => m.id);
    if (zoom === "estado" || !ids.length) return inteiro;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const id of ids) { const c = caixas[id]; x0 = Math.min(x0, c.x0); y0 = Math.min(y0, c.y0); x1 = Math.max(x1, c.x1); y1 = Math.max(y1, c.y1); }
    // Folga em volta e um tamanho mínimo, para uma cidade só não virar um borrão de tela cheia.
    const lado = Math.max(x1 - x0, y1 - y0, 90);
    const folga = lado * 0.22;
    const w = Math.max(x1 - x0, lado * 0.9) + folga * 2;
    const h = Math.max(y1 - y0, lado * 0.55) + folga * 2;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }, [malha, porMunicipio, cadastradas, zoom, caixas]);
  /* Texto com tamanho constante na tela, qualquer que seja o zoom (o quadro tem ~640px). */
  const escala = quadro ? quadro.w / 640 : 1;

  /* Nomes dos municípios com mais atuação, sem sobrepor: o maior entra primeiro e quem
     esbarraria num nome já posto fica só no tooltip e na tabela. */
  const rotulos = useMemo(() => {
    if (!malha || !quadro) return [];
    const postos = [];
    const porId = Object.fromEntries(malha.municipios.map((m) => [m.id, m]));
    for (const r of ranking.filter((x) => x[metrica] > 0).slice(0, 12)) {
      const m = porId[r.id];
      if (!m) continue;
      const w = m.nome.length * 6.6 * escala, h = 14 * escala;
      if (m.y - h / 2 < quadro.y || m.y + h / 2 > quadro.y + quadro.h) continue;
      /* Cidade do litoral fica colada na borda do quadro (João Pessoa, Recife): o nome é
         empurrado para dentro em vez de sumir. */
      const margem = 4 * escala;
      const x = Math.min(Math.max(m.x, quadro.x + w / 2 + margem), quadro.x + quadro.w - w / 2 - margem);
      const caixa = { x0: x - w / 2, x1: x + w / 2, y0: m.y - h / 2, y1: m.y + h / 2 };
      if (!postos.some((p) => caixa.x0 < p.x1 && caixa.x1 > p.x0 && caixa.y0 < p.y1 && caixa.y1 > p.y0)) postos.push({ ...caixa, m, x });
    }
    return postos.map((p) => ({ ...p.m, x: p.x }));
  }, [malha, quadro, ranking, metrica, escala]);

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
        <Indicador rotulo={regional ? `${regional.nome} · ${ROTULO_STATUS[regional.status] || regional.status}` : `${ESTADOS[uf]?.nome} · sem regional`} valor={uf} />
        <Indicador rotulo="Municípios com atuação" valor={num(municipiosComAtuacao)} />
        <Indicador rotulo="Clientes atendidos" valor={num(linhaUf.clientes)} />
        <Indicador rotulo="Empreendimentos atendidos" valor={num(linhaUf.empreendimentos)} />
        <Indicador rotulo="Parceiros ativos" valor={num(linhaUf.parceiros)} />
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
        <section ref={dica.caixa} style={{ position: "relative", flex: "3 1 420px", background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 14, padding: 14, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <h4 style={{ margin: 0, color: AZUL_MARINHO, fontSize: 14, flex: 1 }}>{ESTADOS[uf]?.nome} por município</h4>
            <div style={{ display: "inline-flex", border: `1px solid ${CINZA_BORDA}`, borderRadius: 8, overflow: "hidden" }}>
              {[["atuacao", "Zoom na atuação"], ["estado", "Estado inteiro"]].map(([k, l]) => (
                <button key={k} onClick={() => setZoom(k)} aria-pressed={zoom === k}
                  style={{ ...btn, border: "none", borderRadius: 0, padding: "5px 10px", fontSize: 12, background: zoom === k ? AZUL_MEDIO : "#fff", color: zoom === k ? "#fff" : AZUL_MARINHO }}>{l}</button>
              ))}
            </div>
          </div>
          {erroMalha && <p style={{ fontSize: 13, color: "#C62828" }}>{erroMalha}</p>}
          {!malha && !erroMalha && <p style={{ fontSize: 13, color: "#5a6a80" }}>Carregando o mapa de {ESTADOS[uf]?.nome}…</p>}
          {malha && quadro && (
            <svg viewBox={`${quadro.x} ${quadro.y} ${quadro.w} ${quadro.h}`} style={{ width: "100%", height: "auto", maxHeight: 560, display: "block", background: "#F7F9FC", borderRadius: 10 }} role="img"
              aria-label={`Mapa de ${ESTADOS[uf]?.nome} por município: ${METRICAS[metrica].rotulo}`}>
              {malha.municipios.map((m) => {
                const linha = porMunicipio[m.id];
                return (
                  <path key={m.id} d={m.d} fill={corDe(linha?.[metrica], faixas)} stroke="#fff" strokeWidth={0.7} vectorEffect="non-scaling-stroke" strokeLinejoin="round"
                    onMouseMove={(ev) => dica.mover(ev, <ConteudoDica titulo={m.nome} subtitulo={cadastradas.has(normalizar(m.nome)) ? "Cidade cadastrada na regional" : null} linha={linha} />)}
                    onMouseLeave={dica.sair} />
                );
              })}
              {malha.municipios.filter((m) => cadastradas.has(normalizar(m.nome))).map((m) => (
                <path key={`c-${m.id}`} d={m.d} fill="none" stroke={AZUL_MARINHO} strokeWidth={1.8} vectorEffect="non-scaling-stroke" strokeLinejoin="round" pointerEvents="none" />
              ))}
              {rotulos.map((m) => (
                <text key={`t-${m.id}`} x={m.x} y={m.y} textAnchor="middle" dominantBaseline="middle" pointerEvents="none"
                  style={{ fontSize: 11.5 * escala, fontWeight: 700, fill: "#1d2a3a", paintOrder: "stroke", stroke: "#fff", strokeWidth: 3 * escala, strokeLinejoin: "round" }}>
                  {m.nome}
                </text>
              ))}
            </svg>
          )}
          {/* Legenda embaixo, e não por cima: no mapa regional não há "mar vazio" garantido,
              e por cima ela cobria justamente a região metropolitana. */}
          {malha && (
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginTop: 10, fontSize: 12, color: "#33435a" }}>
              <b style={{ color: AZUL_MARINHO }}>{METRICAS[metrica].rotulo}:</b>
              {faixas.map((f) => (
                <span key={f.rotulo} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 18, height: 11, borderRadius: 3, background: f.cor, border: "1px solid rgba(0,0,0,.08)" }} />{f.rotulo}
                </span>
              ))}
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 18, height: 11, borderRadius: 3, background: SEM_ATUACAO, border: "1px solid rgba(0,0,0,.08)" }} />Sem atuação</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 18, height: 11, borderRadius: 3, border: `2px solid ${AZUL_MARINHO}` }} />Cidade cadastrada</span>
            </div>
          )}
          {dica.elemento}
          <div style={{ fontSize: 11, color: "#7a889c", marginTop: 6 }}>Malha municipal: IBGE.</div>
        </section>

        <section style={{ flex: "2 1 300px", background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 14, padding: 14, minWidth: 0 }}>
          <h4 style={{ margin: "0 0 8px", color: AZUL_MARINHO, fontSize: 14 }}>Municípios</h4>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>Município</th><th style={{ ...th, textAlign: "right" }}>Clientes</th><th style={{ ...th, textAlign: "right" }}>Empreend.</th><th style={{ ...th, textAlign: "right" }}>Parceiros</th></tr></thead>
              <tbody>
                {ranking.map((r) => (
                  <tr key={r.id}>
                    <td style={td}><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: corDe(r[metrica], faixas), marginRight: 6 }} />{r.nome}</td>
                    <td style={tdNum}>{num(r.clientes)}</td><td style={tdNum}>{num(r.empreendimentos)}</td><td style={tdNum}>{num(r.parceiros)}</td>
                  </tr>
                ))}
                {!ranking.length && <tr><td style={td} colSpan={4}>{malha ? "Nenhum cliente ou parceiro com cidade neste estado ainda." : "…"}</td></tr>}
              </tbody>
            </table>
          </div>
          {naoLocalizadas.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 12.5, background: "#FFF4E0", border: "1px solid #F2D49B", borderRadius: 8, padding: 10 }}>
              <b><MapPin size={12} style={{ verticalAlign: -1 }} /> Cidades não localizadas no mapa</b> (grafia diferente da oficial):{" "}
              {naoLocalizadas.map((c) => `${c.cidade} (${num(c[metrica])})`).join(", ")}.
            </div>
          )}
        </section>
      </div>
    </>
  );
}
