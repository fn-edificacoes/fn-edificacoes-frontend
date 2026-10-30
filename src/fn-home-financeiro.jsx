/* ============================================================
   FN HOME — FINANCEIRO (vendas, comissão da FN, repasses e cliques)
   ============================================================
   Tudo o que as vendas do FN Home deixam para a FN, lido de GET /api/financeiro/fn-home
   (src/fn-home-financeiro.js no backend, só Gerência). A conta é toda do servidor; aqui a tela só
   mostra e manda uma ação: marcar o acerto com o parceiro (PATCH /api/vendas/:id, o mesmo botão
   de Parceiros → Vendas e comissões).

   Duas origens de venda, e o acerto de cada uma vai num sentido:
     - carrinho: o cliente pagou à FN pelo Mercado Pago. A comissão já está no caixa; a FN REPASSA
       ao parceiro o valor menos a comissão;
     - orçamento: proposta aceita, e o cliente paga o parceiro. A FN RECEBE a comissão dele.
   Os produtos do Mercado Livre são à parte: a venda e a comissão de verdade só aparecem no painel
   de afiliados de lá (sem API). Aqui ficam os cliques e o ganho por venda pelo percentual que a
   Gerência informou no cadastro.

   Três lugares usam este arquivo, todos pelo App.jsx (que entrega o apiFetch):
     - AbaFinanceiroFnHome: FN Home → Vendas e comissões, e o lado "Financeiro do FN Home" da aba
       Conciliação Mercado Pago;
     - CardFnHomeNosIndicadores: o bloco do FN Home em Gerência → Indicadores, no período escolhido lá. */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Wallet, RefreshCcw, ShoppingCart, Package, Users, Receipt, ArrowRightLeft, ShoppingBag,
  Search, Check, Loader2, BarChart3, HandCoins, Store, Info,
} from "lucide-react";

const AZUL_MEDIO = "#2C75B5";
const AZUL_MARINHO = "#12335B";
const CINZA_CLARO = "#F1F4F8";
const CINZA_BORDA = "#D8DEE7";
const VERDE = "#1B7F4B";
const VERMELHO = "#C62828";
const AMBAR = "#B26A00";
const TEXTO_APOIO = "#65758b";

const inp = { padding: "8px 10px", border: `1px solid ${CINZA_BORDA}`, borderRadius: 8, fontSize: 13.5, outline: "none", background: "#fff", fontFamily: "inherit", minWidth: 0 };
const th = { textAlign: "left", fontSize: 11.5, fontWeight: 700, color: "#5a6a80", padding: "8px 8px", borderBottom: `1px solid ${CINZA_BORDA}`, whiteSpace: "nowrap" };
const thN = { ...th, textAlign: "right" };
const td = { fontSize: 13, padding: "8px 8px", borderBottom: `1px solid ${CINZA_CLARO}`, verticalAlign: "top" };
const tdN = { ...td, whiteSpace: "nowrap", textAlign: "right", fontVariantNumeric: "tabular-nums" };
const btn = { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "none", background: AZUL_MEDIO, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };
const btnLeve = { ...btn, background: "#fff", color: AZUL_MARINHO, border: `1px solid ${CINZA_BORDA}` };

const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const numero = (v) => (Number(v) || 0).toLocaleString("pt-BR");
const pct = (v) => (v == null ? "—" : `${String(v).replace(".", ",")}%`);
const dataBr = (v) => (v ? String(v).slice(0, 10).split("-").reverse().join("/") : "—");
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const rotuloMes = (mes) => { const [a, m] = mes.split("-").map(Number); return `${MESES_LONGOS[m - 1]} de ${a}`; };
const maiuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* Mês corrente de Brasília (AAAA-MM), o mesmo dia que o servidor usa. */
function mesAtual() {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 7);
}
function ultimoDia(mes) {
  const [a, m] = mes.split("-").map(Number);
  return `${mes}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}`;
}
/* O recorte da tela → de/ate da rota. "tudo" vai sem datas. */
function intervalo(periodo) {
  if (periodo.tipo === "ano") return { de: `${periodo.ano}-01-01`, ate: `${periodo.ano}-12-31` };
  if (periodo.tipo === "mes") return { de: `${periodo.mes}-01`, ate: ultimoDia(periodo.mes) };
  return { de: null, ate: null };
}
function rotuloPeriodo(periodo) {
  if (periodo.tipo === "ano") return String(periodo.ano);
  if (periodo.tipo === "mes") return rotuloMes(periodo.mes);
  return "Todo o período";
}

/* Variação contra o recorte anterior, já com o sinal. Sem base não há porcentagem honesta. */
function variacao(atual, antes) {
  if (antes == null) return null;
  if (!antes) return atual > 0 ? { texto: "novo", sobe: true } : null;
  const v = Math.round(((atual - antes) / antes) * 1000) / 10;
  return { texto: `${v > 0 ? "+" : ""}${String(v).replace(".", ",")}%`, sobe: v >= 0 };
}

const ORIGEM_COMISSAO = { item: "do item", categoria: "da categoria", padrao: "padrão do parceiro" };
/* [id da rota, pílula, como entra no título] */
const AREAS = [["produto", "FN Home", "FN Home"], ["servico", "FN Clube", "FN Clube"], ["todos", "Tudo", "FN Home e FN Clube"]];

/* ---------------- peças ---------------- */

function Caixa({ icon: Icon, titulo, acoes, children }) {
  return (
    <section style={{ background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 14, padding: 18, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: CINZA_CLARO, display: "grid", placeItems: "center" }}><Icon size={16} color={AZUL_MEDIO} /></div>
        <h3 style={{ margin: 0, fontSize: 15, color: AZUL_MARINHO, flex: 1, minWidth: 160 }}>{titulo}</h3>
        {acoes}
      </div>
      {children}
    </section>
  );
}

/* Cartão de número: rótulo, valor e, quando há, a variação contra o período anterior (verde
   quando subiu, que aqui é sempre bom: venda e comissão). */
function Kpi({ rotulo, valor, apoio, delta, cor = AZUL_MARINHO }) {
  return (
    <div style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 12, padding: "11px 13px", background: "#fff", minWidth: 0 }}>
      <div style={{ fontSize: 12, color: TEXTO_APOIO, fontWeight: 600 }}>{rotulo}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: cor, marginTop: 3 }}>{valor}</div>
      {(apoio || delta) && (
        <div style={{ fontSize: 11.5, color: TEXTO_APOIO, marginTop: 3, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {delta && <span style={{ fontWeight: 700, color: delta.sobe ? VERDE : VERMELHO }}>{delta.sobe ? "▲" : "▼"} {delta.texto}</span>}
          {apoio && <span>{apoio}</span>}
        </div>
      )}
    </div>
  );
}

const GradeKpi = ({ children, min = 170 }) => (
  <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 10 }}>{children}</div>
);

function Pilula({ ativo, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={ativo}
      style={{
        background: ativo ? "#EAF2FB" : "#fff", border: `1px solid ${ativo ? AZUL_MEDIO : CINZA_BORDA}`,
        color: ativo ? AZUL_MARINHO : "#4a5a70", borderRadius: 20, padding: "5px 13px",
        fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
      }}>
      {children}
    </button>
  );
}

const Vazio = ({ children }) => <p style={{ color: "#8593a8", fontSize: 13.5, margin: 0 }}>{children}</p>;
const Nota = ({ children, cor = TEXTO_APOIO }) => <p style={{ fontSize: 12.5, color: cor, margin: "10px 0 0", lineHeight: 1.5 }}>{children}</p>;

/* Barra fininha dentro da célula, para o ranking se ler de relance. O número fica ao lado,
   em texto, nunca só na cor. */
function BarraNaCelula({ valor, maximo }) {
  const largura = maximo > 0 ? Math.max(2, Math.round((valor / maximo) * 100)) : 0;
  return (
    <div style={{ height: 6, background: CINZA_CLARO, borderRadius: 3, marginTop: 5, minWidth: 60 }}>
      <div style={{ width: `${largura}%`, height: 6, background: AZUL_MEDIO, borderRadius: 3 }} />
    </div>
  );
}

/* Comissão da FN mês a mês, 12 meses. Uma série só (sem legenda: o título diz o que é), coluna
   de até 24 px com a ponta arredondada, valor escrito só no maior mês e no último. Passar o
   mouse (ou tocar) mostra o mês inteiro: comissão, vendido, vendas e cliques. "Ver em tabela"
   tem os mesmos números para quem não lê o gráfico. */
function GraficoMeses({ serie, comCliques }) {
  const [foco, setFoco] = useState(null);
  const [tabela, setTabela] = useState(false);
  const L = 720, A = 230, esq = 56, dir = 10, topo = 22, base = 30;
  const larguraUtil = L - esq - dir, alturaUtil = A - topo - base;
  const maior = Math.max(0, ...serie.map((m) => m.comissao));
  /* Escala de números redondos: 1, 2, 2,5 ou 5 vezes uma potência de 10. */
  const passo = (() => {
    if (maior <= 0) return 25;
    const bruto = maior / 4;
    const p = 10 ** Math.floor(Math.log10(bruto));
    return [1, 2, 2.5, 5, 10].map((f) => f * p).find((s) => s >= bruto);
  })();
  const teto = passo * 4;
  const y = (v) => topo + alturaUtil - (v / teto) * alturaUtil;
  const faixa = larguraUtil / serie.length;
  const larguraBarra = Math.min(24, faixa * 0.6);
  const iMaior = serie.reduce((melhor, m, i) => (m.comissao > (serie[melhor]?.comissao ?? -1) ? i : melhor), 0);
  const rotular = (i) => serie[i].comissao > 0 && (i === iMaior || i === serie.length - 1);
  const compacto = (v) => (v >= 1000 ? `${String(Math.round(v / 100) / 10).replace(".", ",")} mil` : numero(Math.round(v)));
  const m = foco != null ? serie[foco] : null;

  const coluna = (v, x) => {
    const alto = y(0) - y(v);
    if (alto <= 0) return null;
    const r = Math.min(4, alto, larguraBarra / 2);
    const x0 = x - larguraBarra / 2, x1 = x + larguraBarra / 2, yb = y(0), yt = y(v);
    return `M${x0},${yb} V${yt + r} Q${x0},${yt} ${x0 + r},${yt} H${x1 - r} Q${x1},${yt} ${x1},${yt + r} V${yb} Z`;
  };

  return (
    <div>
      <div style={{ position: "relative" }}>
        <svg viewBox={`0 0 ${L} ${A}`} width="100%" role="img" style={{ display: "block", maxHeight: 260 }}
          aria-label={`Comissão da FN por mês, de ${rotuloMes(serie[0].mes)} a ${rotuloMes(serie[serie.length - 1].mes)}`}
          onMouseLeave={() => setFoco(null)}>
          {[0, 1, 2, 3, 4].map((k) => (
            <g key={k}>
              <line x1={esq} x2={L - dir} y1={y(passo * k)} y2={y(passo * k)} stroke={k === 0 ? "#C3CCD8" : "#E8EDF3"} strokeWidth="1" />
              <text x={esq - 8} y={y(passo * k) + 4} textAnchor="end" fontSize="11" fill="#8593a8" style={{ fontVariantNumeric: "tabular-nums" }}>
                {k === 0 ? "0" : `R$ ${compacto(passo * k)}`}
              </text>
            </g>
          ))}
          {serie.map((mes, i) => {
            const x = esq + faixa * i + faixa / 2;
            const [ano, mm] = mes.mes.split("-");
            const d = coluna(mes.comissao, x);
            return (
              <g key={mes.mes}>
                {foco === i && <rect x={esq + faixa * i + 2} y={topo} width={faixa - 4} height={alturaUtil} fill="#F1F4F8" rx="4" />}
                {d && <path d={d} fill={AZUL_MEDIO} />}
                {rotular(i) && (
                  <text x={x} y={y(mes.comissao) - 6} textAnchor="middle" fontSize="11" fontWeight="700" fill={AZUL_MARINHO}>{brl(mes.comissao)}</text>
                )}
                <text x={x} y={A - 10} textAnchor="middle" fontSize="11" fill="#65758b">
                  {MESES_CURTOS[Number(mm) - 1]}{mm === "01" || i === 0 ? `/${ano.slice(2)}` : ""}
                </text>
                {/* Alvo do mouse: a faixa inteira do mês, maior que a coluna. */}
                <rect x={esq + faixa * i} y={topo} width={faixa} height={alturaUtil + base} fill="transparent"
                  onMouseEnter={() => setFoco(i)} onClick={() => setFoco(i)} style={{ cursor: "pointer" }} />
              </g>
            );
          })}
        </svg>
        {m && (
          <div style={{
            position: "absolute", top: 0, left: `${Math.min(78, Math.max(2, ((esq + faixa * foco + faixa / 2) / L) * 100 - 11))}%`,
            background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: "8px 11px",
            boxShadow: "0 6px 18px rgba(18,51,91,.12)", fontSize: 12.5, pointerEvents: "none", minWidth: 170, color: "#2b3a4f",
          }}>
            <div style={{ fontWeight: 700, color: AZUL_MARINHO, marginBottom: 4 }}>{maiuscula(rotuloMes(m.mes))}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: AZUL_MEDIO, display: "inline-block" }} />
              Comissão: <strong>{brl(m.comissao)}</strong>
            </div>
            <div>Vendido: {brl(m.faturamento)}</div>
            <div>{numero(m.vendas)} venda(s) · {numero(m.itens)} item(ns)</div>
            {comCliques && <div>Cliques no Mercado Livre: {numero(m.cliquesMl)}</div>}
          </div>
        )}
      </div>
      {maior <= 0 && <Nota>Nenhuma comissão nos últimos 12 meses.</Nota>}
      <button type="button" onClick={() => setTabela((t) => !t)} style={{ ...btnLeve, marginTop: 8, padding: "5px 10px", fontSize: 12 }}>
        {tabela ? "Esconder tabela" : "Ver em tabela"}
      </button>
      {tabela && (
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={th}>Mês</th><th style={thN}>Vendas</th><th style={thN}>Itens</th><th style={thN}>Vendido</th><th style={thN}>Comissão</th>
              {comCliques && <th style={thN}>Cliques ML</th>}
            </tr></thead>
            <tbody>
              {serie.map((mes) => (
                <tr key={mes.mes}>
                  <td style={td}>{maiuscula(rotuloMes(mes.mes))}</td>
                  <td style={tdN}>{numero(mes.vendas)}</td><td style={tdN}>{numero(mes.itens)}</td>
                  <td style={tdN}>{brl(mes.faturamento)}</td><td style={tdN}>{brl(mes.comissao)}</td>
                  {comCliques && <td style={tdN}>{numero(mes.cliquesMl)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* Busca o resumo da rota. Cada pedido leva um número; a resposta de um recorte antigo que
   chegue depois do novo é descartada (trocar de mês rápido mostraria o mês errado). */
function useResumoFnHome({ apiFetch, token, de, ate, area }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [falha, setFalha] = useState("");
  const atual = useRef(0);
  const carregar = async () => {
    const meu = ++atual.current;
    setCarregando(true);
    setFalha("");
    try {
      const qs = new URLSearchParams({ area });
      if (de) qs.set("de", de);
      if (ate) qs.set("ate", ate);
      const r = await apiFetch(`/api/financeiro/fn-home?${qs}`, { token });
      if (meu === atual.current) setDados(r);
    } catch (e) {
      if (meu === atual.current) setFalha(e.message);
    }
    if (meu === atual.current) setCarregando(false);
  };
  useEffect(() => { carregar(); }, [de, ate, area]);
  return { dados, carregando, falha, carregar };
}

/* ---------------- tela inteira ---------------- */

export default function AbaFinanceiroFnHome({ token, apiFetch, notify }) {
  const [periodo, setPeriodo] = useState(() => ({ tipo: "mes", mes: mesAtual() }));
  const [area, setArea] = useState("produto");
  const [buscaItem, setBuscaItem] = useState("");
  const [soAbertas, setSoAbertas] = useState(false);
  const [mexendo, setMexendo] = useState(null);
  const { de, ate } = intervalo(periodo);
  const { dados, carregando, falha, carregar } = useResumoFnHome({ apiFetch, token, de, ate, area });

  const anoAtual = Number(mesAtual().slice(0, 4));
  const t = dados?.totais;
  const antes = dados?.totaisAnteriores;
  const ml = dados?.mercadoLivre;
  const nomeArea = AREAS.find(([id]) => id === area)[2];

  const acertar = async (v, feito) => {
    setMexendo(v.id);
    try {
      await apiFetch(`/api/vendas/${v.id}`, { method: "PATCH", token, body: { statusComissao: feito ? "paga" : "pendente" } });
      notify(feito
        ? (v.acerto.tipo === "repassar" ? "Repasse ao parceiro marcado como feito ✓" : "Comissão marcada como recebida ✓")
        : "Acerto desfeito: a venda voltou para em aberto ✓");
      await carregar();
    } catch (e) {
      notify(`Não foi possível salvar: ${e.message}`);
    }
    setMexendo(null);
  };

  const termo = buscaItem.trim().toLowerCase();
  const catalogo = useMemo(() => (dados?.catalogo || [])
    .filter((i) => !termo || `${i.titulo} ${i.parceiro} ${i.categoria}`.toLowerCase().includes(termo)), [dados, termo]);
  const semComissaoNoCatalogo = (dados?.catalogo || []).filter((i) => i.comissaoPercentual == null).length;
  const vendasVisiveis = (dados?.vendas || []).filter((v) => !soAbertas || (!v.cancelada && !v.acerto.feito && v.acerto.valor > 0));
  const maiorQtd = Math.max(0, ...(dados?.maisVendidos || []).map((i) => i.quantidade));
  const maiorCliques = Math.max(0, ...(ml?.produtos || []).map((p) => p.cliquesNoPeriodo));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Caixa icon={Wallet} titulo={`Financeiro do ${nomeArea} — ${rotuloPeriodo(periodo)}`}
        acoes={<button type="button" style={btnLeve} onClick={carregar} disabled={carregando}>
          {carregando ? <Loader2 size={14} className="spin" /> : <RefreshCcw size={14} />} Atualizar
        </button>}>
        <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#8593a8", marginRight: 2 }}>Período:</span>
            <Pilula ativo={periodo.tipo === "mes" && periodo.mes === mesAtual()} onClick={() => setPeriodo({ tipo: "mes", mes: mesAtual() })}>Este mês</Pilula>
            <Pilula ativo={periodo.tipo === "ano" && periodo.ano === anoAtual} onClick={() => setPeriodo({ tipo: "ano", ano: anoAtual })}>{anoAtual}</Pilula>
            <Pilula ativo={periodo.tipo === "tudo"} onClick={() => setPeriodo({ tipo: "tudo" })}>Todo o período</Pilula>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#4a5a70" }}>
              Mês:
              <input type="month" style={{ ...inp, padding: "5px 8px" }} value={periodo.tipo === "mes" ? periodo.mes : ""}
                max={mesAtual()} onChange={(e) => e.target.value && setPeriodo({ tipo: "mes", mes: e.target.value })} />
            </label>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#8593a8", marginRight: 2 }}>Vendas de:</span>
            {AREAS.map(([id, rotulo]) => <Pilula key={id} ativo={area === id} onClick={() => setArea(id)}>{rotulo}</Pilula>)}
          </div>
        </div>

        {falha && <p style={{ color: VERMELHO, fontSize: 13.5, margin: "0 0 12px" }}>Não foi possível carregar: {falha}</p>}
        {!dados && carregando && <Vazio>Carregando…</Vazio>}

        {t && (
          <>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 12.5, color: TEXTO_APOIO, fontWeight: 600 }}>Comissão da FN no período</div>
                <div style={{ fontSize: 48, fontWeight: 700, color: AZUL_MARINHO, lineHeight: 1.05 }}>{brl(t.comissao)}</div>
                <div style={{ fontSize: 12.5, color: TEXTO_APOIO, marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {(() => {
                    const d = variacao(t.comissao, antes?.comissao);
                    return d && <span style={{ fontWeight: 700, color: d.sobe ? VERDE : VERMELHO }}>{d.sobe ? "▲" : "▼"} {d.texto} sobre {dataBr(antes.de)} a {dataBr(antes.ate)}</span>;
                  })()}
                  <span>média de {pct(t.percentualMedio)} sobre o vendido</span>
                </div>
              </div>
            </div>

            <GradeKpi>
              <Kpi rotulo="Vendido" valor={brl(t.faturamento)} delta={variacao(t.faturamento, antes?.faturamento)} apoio={`ticket médio ${brl(t.ticketMedio)}`} />
              <Kpi rotulo="Vendas" valor={numero(t.vendas)} delta={variacao(t.vendas, antes?.vendas)} apoio={`${numero(t.itens)} item(ns) · ${numero(t.compras)} compra(s)`} />
              <Kpi rotulo="Tarifa do Mercado Pago" valor={brl(t.tarifa)} cor={AMBAR}
                apoio={t.pedidosSemTarifa ? `${t.pedidosSemTarifa} pedido(s) antigo(s) sem tarifa gravada` : "do carrinho, já descontada abaixo"} />
              <Kpi rotulo="Fica para a FN" valor={brl(t.resultado)} cor={t.resultado < 0 ? VERMELHO : VERDE} apoio="comissão menos a tarifa" />
              <Kpi rotulo="A repassar aos parceiros" valor={brl(dados.emAberto.repassar)} cor={dados.emAberto.repassar > 0 ? VERMELHO : AZUL_MARINHO}
                apoio={`${dados.emAberto.vendasRepassar} venda(s) do carrinho, todas as datas`} />
              <Kpi rotulo="A receber dos parceiros" valor={brl(dados.emAberto.receber)} cor={dados.emAberto.receber > 0 ? AMBAR : AZUL_MARINHO}
                apoio={`${dados.emAberto.vendasReceber} comissão(ões) de orçamento, todas as datas`} />
            </GradeKpi>
            {(t.semComissao > 0 || t.canceladas > 0) && (
              <Nota cor={AMBAR}>
                {t.semComissao > 0 && `${t.semComissao} venda(s) do período sem comissão cadastrada — ajuste em Parceiros → Vendas e comissões. `}
                {t.canceladas > 0 && `${t.canceladas} venda(s) cancelada(s) ficaram fora das somas.`}
              </Nota>
            )}
          </>
        )}
      </Caixa>

      {dados && (
        <>
          <Caixa icon={BarChart3} titulo="Comissão da FN mês a mês (12 meses)">
            <GraficoMeses serie={dados.serie} comCliques={Boolean(ml)} />
          </Caixa>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
            <Caixa icon={Package} titulo="Itens mais vendidos">
              {dados.maisVendidos.length === 0 ? <Vazio>Nenhuma venda no período.</Vazio> : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr><th style={th}>#</th><th style={th}>Item</th><th style={thN}>Qtd.</th><th style={thN}>Vendido</th><th style={thN}>Comissão</th></tr></thead>
                    <tbody>
                      {dados.maisVendidos.map((i, n) => (
                        <tr key={i.chave}>
                          <td style={{ ...td, color: TEXTO_APOIO }}>{n + 1}</td>
                          <td style={td}>
                            <div style={{ fontWeight: 600, color: AZUL_MARINHO }}>{i.titulo}</div>
                            <div style={{ fontSize: 11.5, color: TEXTO_APOIO }}>{i.parceiro}</div>
                            <BarraNaCelula valor={i.quantidade} maximo={maiorQtd} />
                          </td>
                          <td style={tdN}>{numero(i.quantidade)}</td>
                          <td style={tdN}>{brl(i.faturamento)}</td>
                          <td style={{ ...tdN, fontWeight: 700 }}>{brl(i.comissao)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Caixa>

            <Caixa icon={Users} titulo="Por parceiro">
              {dados.porParceiro.length === 0 ? <Vazio>Nenhuma venda no período.</Vazio> : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr><th style={th}>Parceiro</th><th style={thN}>Vendido</th><th style={thN}>Comissão</th><th style={thN}>A repassar</th><th style={thN}>A receber</th></tr></thead>
                    <tbody>
                      {dados.porParceiro.map((p) => (
                        <tr key={p.parceiroId}>
                          <td style={td}><div style={{ fontWeight: 600, color: AZUL_MARINHO }}>{p.parceiro}</div><div style={{ fontSize: 11.5, color: TEXTO_APOIO }}>{p.vendas} venda(s)</div></td>
                          <td style={tdN}>{brl(p.faturamento)}</td>
                          <td style={{ ...tdN, fontWeight: 700 }}>{brl(p.comissao)}</td>
                          <td style={{ ...tdN, color: p.repassar > 0 ? VERMELHO : TEXTO_APOIO }}>{brl(p.repassar)}</td>
                          <td style={{ ...tdN, color: p.receber > 0 ? AMBAR : TEXTO_APOIO }}>{brl(p.receber)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Nota>"A repassar" e "a receber" contam tudo o que está em aberto com o parceiro, de qualquer data.</Nota>
                </div>
              )}
            </Caixa>
          </div>

          <Caixa icon={HandCoins} titulo={`Comissão de cada item (${(dados.catalogo || []).length})`}
            acoes={<div style={{ position: "relative", flex: "1 1 220px", maxWidth: 320 }}>
              <Search size={14} color="#8593a8" style={{ position: "absolute", left: 9, top: 10 }} />
              <input style={{ ...inp, width: "100%", paddingLeft: 28, boxSizing: "border-box" }} placeholder="Buscar item ou parceiro…"
                value={buscaItem} onChange={(e) => setBuscaItem(e.target.value)} />
            </div>}>
            <p style={{ fontSize: 13, color: TEXTO_APOIO, margin: "0 0 10px" }}>
              Todos os itens dos parceiros aprovados, com o que a FN ganha a cada venda. A comissão é a do próprio item;
              sem ela, a da categoria na tabela do parceiro; sem categoria, a primeira linha da tabela — a mesma regra do carrinho.
            </p>
            {catalogo.length === 0 ? <Vazio>{termo ? "Nenhum item com esse nome." : "Nenhum item cadastrado pelos parceiros."}</Vazio> : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>
                    <th style={th}>Item</th><th style={th}>Parceiro</th><th style={thN}>Preço</th><th style={thN}>Comissão</th>
                    <th style={thN}>Você ganha por venda</th><th style={thN}>Vendidos no período</th><th style={thN}>Comissão no período</th>
                  </tr></thead>
                  <tbody>
                    {catalogo.map((i) => (
                      <tr key={i.id}>
                        <td style={td}><div style={{ fontWeight: 600, color: AZUL_MARINHO }}>{i.titulo}</div>{i.categoria && <div style={{ fontSize: 11.5, color: TEXTO_APOIO }}>{i.categoria}</div>}</td>
                        <td style={td}>{i.parceiro}</td>
                        <td style={tdN}>{i.preco != null ? brl(i.preco) : <span style={{ color: TEXTO_APOIO }}>por orçamento</span>}</td>
                        <td style={tdN}>
                          {i.comissaoPercentual != null
                            ? <><div>{pct(i.comissaoPercentual)}</div><div style={{ fontSize: 11, color: TEXTO_APOIO }}>{ORIGEM_COMISSAO[i.origemComissao]}</div></>
                            : <span style={{ color: VERMELHO }}>sem comissão</span>}
                        </td>
                        <td style={{ ...tdN, fontWeight: 700, color: AZUL_MARINHO }}>{i.comissaoPorVenda != null ? brl(i.comissaoPorVenda) : "—"}</td>
                        <td style={tdN}>{numero(i.vendidosNoPeriodo)}<div style={{ fontSize: 11, color: TEXTO_APOIO }}>{numero(i.vendidosSempre)} desde sempre</div></td>
                        <td style={tdN}>{brl(i.comissaoNoPeriodo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {semComissaoNoCatalogo > 0 && (
              <Nota cor={AMBAR}>{semComissaoNoCatalogo} item(ns) sem comissão: a venda deles não deixa nada para a FN até a comissão ser cadastrada no parceiro ou no item.</Nota>
            )}
          </Caixa>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
            <Caixa icon={ShoppingCart} titulo="Carrinho (pagamento pelo Mercado Pago)">
              <GradeKpi min={120}>
                <Kpi rotulo="Pedidos abertos" valor={numero(dados.funil.iniciados)} />
                <Kpi rotulo="Pagos" valor={numero(dados.funil.pagos)} cor={VERDE} />
                <Kpi rotulo="Aguardando pagamento" valor={numero(dados.funil.aguardando)} cor={AMBAR} />
                <Kpi rotulo="Cancelados" valor={numero(dados.funil.cancelados)} cor={VERMELHO} />
              </GradeKpi>
              <Nota>
                Conversão do carrinho: <strong>{pct(dados.funil.conversao)}</strong> dos pedidos abertos no período foram pagos.
                No carrinho a FN recebe tudo na conta do Mercado Pago e repassa ao parceiro o valor menos a comissão.
              </Nota>
            </Caixa>

            <Caixa icon={ArrowRightLeft} titulo="Orçamentos (o cliente paga o parceiro)">
              {t && (
                <GradeKpi min={130}>
                  <Kpi rotulo="Vendido" valor={brl(t.orcamento.faturamento)} apoio={`${t.orcamento.vendas} venda(s)`} />
                  <Kpi rotulo="Comissão" valor={brl(t.orcamento.comissao)} />
                  <Kpi rotulo="Recebida" valor={brl(t.orcamento.recebido)} cor={VERDE} />
                  <Kpi rotulo="Falta receber" valor={brl(t.orcamento.receber)} cor={t.orcamento.receber > 0 ? AMBAR : AZUL_MARINHO} />
                </GradeKpi>
              )}
              <Nota>Proposta aceita pelo cliente: ele paga o parceiro, e a comissão da FN é cobrada do parceiro.</Nota>
            </Caixa>
          </div>

          {ml && (
            <Caixa icon={ShoppingBag} titulo="Mercado Livre (link de afiliado da FN)">
              <GradeKpi min={150}>
                <Kpi rotulo="Produtos na vitrine" valor={numero(ml.ativos)} />
                <Kpi rotulo="Cliques no período" valor={numero(ml.cliquesNoPeriodo)} />
                <Kpi rotulo="Cliques desde sempre" valor={numero(ml.cliques)} />
                <Kpi rotulo="Sem comissão (%) informada" valor={numero(ml.semPercentual)} cor={ml.semPercentual > 0 ? AMBAR : AZUL_MARINHO} />
              </GradeKpi>
              {ml.produtos.length > 0 && (
                <div style={{ overflowX: "auto", marginTop: 12 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr>
                      <th style={th}>Produto</th><th style={thN}>Preço</th><th style={thN}>Comissão</th><th style={thN}>Você ganha por venda</th>
                      <th style={thN}>Cliques no período</th><th style={thN}>Desde sempre</th>
                    </tr></thead>
                    <tbody>
                      {ml.produtos.map((p) => (
                        <tr key={p.id} style={{ opacity: p.ativo ? 1 : 0.6 }}>
                          <td style={td}>
                            <div style={{ fontWeight: 600, color: AZUL_MARINHO }}>{p.titulo}</div>
                            <div style={{ fontSize: 11.5, color: TEXTO_APOIO }}>{[p.categoria, p.ativo ? null : "fora da vitrine"].filter(Boolean).join(" · ")}</div>
                            <BarraNaCelula valor={p.cliquesNoPeriodo} maximo={maiorCliques} />
                          </td>
                          <td style={tdN}>{p.preco != null ? brl(p.preco) : "—"}</td>
                          <td style={tdN}>{p.comissaoPercentual != null ? pct(p.comissaoPercentual) : <span style={{ color: AMBAR }}>não informada</span>}</td>
                          <td style={{ ...tdN, fontWeight: 700, color: AZUL_MARINHO }}>{p.ganhoPorVenda != null ? brl(p.ganhoPorVenda) : "—"}</td>
                          <td style={tdN}>{numero(p.cliquesNoPeriodo)}</td>
                          <td style={tdN}>{numero(p.cliques)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Nota>
                <Info size={12} style={{ verticalAlign: "-2px" }} /> A compra é feita no Mercado Livre: quantas vendas houve e a comissão que caiu aparecem
                só no painel de afiliados de lá, que não tem integração. Aqui fica o que o sistema sabe — os cliques no botão da
                vitrine e o ganho por venda pelo percentual informado em FN Home → Produtos Mercado Livre.
                {ml.cliquesDesde ? ` Cliques por mês contados desde ${dataBr(ml.cliquesDesde)}; antes disso só existe o total.` : " Os cliques por mês começam a contar a partir do primeiro clique depois desta versão."}
              </Nota>
            </Caixa>
          )}

          <Caixa icon={Receipt} titulo={`Vendas do período (${dados.vendasNoPeriodo})`}
            acoes={<Pilula ativo={soAbertas} onClick={() => setSoAbertas((s) => !s)}>Só o que está em aberto</Pilula>}>
            {vendasVisiveis.length === 0 ? <Vazio>{soAbertas ? "Nada em aberto no período." : "Nenhuma venda no período."}</Vazio> : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>
                    <th style={th}>Data</th><th style={th}>Item</th><th style={th}>Parceiro</th><th style={th}>Cliente</th>
                    <th style={thN}>Valor</th><th style={thN}>Comissão</th><th style={thN}>Tarifa</th><th style={th}>Acerto com o parceiro</th>
                  </tr></thead>
                  <tbody>
                    {vendasVisiveis.map((v) => (
                      <tr key={v.id} style={{ opacity: v.cancelada ? 0.55 : 1 }}>
                        <td style={{ ...td, whiteSpace: "nowrap" }}>
                          {dataBr(v.dia)}
                          <div style={{ fontSize: 11, color: TEXTO_APOIO }}>{v.origem === "carrinho" ? "Carrinho" : "Orçamento"}</div>
                        </td>
                        <td style={td}>{v.titulo}{v.quantidade > 1 && <span style={{ color: TEXTO_APOIO }}> × {v.quantidade}</span>}</td>
                        <td style={td}>{v.parceiro}</td>
                        <td style={td}>{v.cliente || "—"}</td>
                        <td style={tdN}>{brl(v.valor)}</td>
                        <td style={tdN}>
                          {v.comissao != null ? <>{brl(v.comissao)}<div style={{ fontSize: 11, color: TEXTO_APOIO }}>{pct(v.comissaoPercentual)}</div></> : <span style={{ color: VERMELHO }}>sem comissão</span>}
                        </td>
                        <td style={tdN}>{v.tarifa != null ? brl(v.tarifa) : "—"}</td>
                        <td style={{ ...td, minWidth: 190 }}>
                          {v.cancelada ? <span style={{ color: TEXTO_APOIO }}>Cancelada</span> : (
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              <span style={{ color: v.acerto.feito ? VERDE : (v.acerto.tipo === "repassar" ? VERMELHO : AMBAR), fontWeight: 600 }}>
                                {v.acerto.feito
                                  ? (v.acerto.tipo === "repassar" ? `Repassado ${brl(v.acerto.valor)}` : `Recebido ${brl(v.acerto.valor)}`)
                                  : (v.acerto.tipo === "repassar" ? `Repassar ${brl(v.acerto.valor)}` : `Receber ${brl(v.acerto.valor)}`)}
                              </span>
                              {mexendo === v.id ? <Loader2 size={14} className="spin" /> : v.acerto.feito ? (
                                <button type="button" style={{ ...btnLeve, padding: "4px 9px", fontSize: 12 }} onClick={() => acertar(v, false)}>Desfazer</button>
                              ) : v.acerto.valor > 0 && (
                                <button type="button" style={{ ...btn, padding: "4px 9px", fontSize: 12 }} onClick={() => acertar(v, true)}>
                                  <Check size={13} /> {v.acerto.tipo === "repassar" ? "Repassei" : "Recebi"}
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {dados.vendasNoPeriodo > dados.vendas.length && (
              <Nota>Mostrando as {dados.vendas.length} mais recentes. Escolha um período menor para ver as outras.</Nota>
            )}
          </Caixa>
        </>
      )}
    </div>
  );
}

/* ---------------- bloco dos Indicadores ---------------- */

/* O FN Home em Gerência → Indicadores, no mesmo período escolhido lá (de/ate vêm prontos do
   App). Só os números de cabeça; o resto está a um clique, na tela inteira. */
export function CardFnHomeNosIndicadores({ token, apiFetch, de = null, ate = null, rotulo, aoAbrir }) {
  const { dados, carregando, falha } = useResumoFnHome({ apiFetch, token, de, ate, area: "produto" });
  const t = dados?.totais;
  const antes = dados?.totaisAnteriores;
  return (
    <section style={{ background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 14, padding: 20, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 15, flexWrap: "wrap" }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: CINZA_CLARO, display: "grid", placeItems: "center" }}><Store size={16} color={AZUL_MEDIO} /></div>
        <h3 style={{ margin: 0, fontSize: 15, color: AZUL_MARINHO, flex: 1 }}>FN Home — vendas e comissões · {rotulo}</h3>
        {aoAbrir && <button type="button" style={btnLeve} onClick={aoAbrir}><Wallet size={14} /> Abrir o financeiro do FN Home</button>}
      </div>
      {falha && <p style={{ color: VERMELHO, fontSize: 13.5, margin: 0 }}>Não foi possível carregar: {falha}</p>}
      {!t && carregando && <Vazio>Carregando…</Vazio>}
      {t && (
        <GradeKpi>
          <Kpi rotulo="Comissão da FN" valor={brl(t.comissao)} delta={variacao(t.comissao, antes?.comissao)} apoio={`média de ${pct(t.percentualMedio)}`} />
          <Kpi rotulo="Vendido" valor={brl(t.faturamento)} delta={variacao(t.faturamento, antes?.faturamento)} />
          <Kpi rotulo="Itens vendidos" valor={numero(t.itens)} apoio={`${numero(t.vendas)} venda(s)`} />
          <Kpi rotulo="Fica para a FN" valor={brl(t.resultado)} cor={t.resultado < 0 ? VERMELHO : VERDE} apoio="comissão menos a tarifa do Mercado Pago" />
          <Kpi rotulo="Em aberto com parceiros" valor={brl(dados.emAberto.repassar + dados.emAberto.receber)}
            apoio={`${brl(dados.emAberto.repassar)} a repassar · ${brl(dados.emAberto.receber)} a receber`}
            cor={dados.emAberto.repassar + dados.emAberto.receber > 0 ? AMBAR : AZUL_MARINHO} />
          {dados.mercadoLivre && (
            <Kpi rotulo="Cliques no Mercado Livre" valor={numero(dados.mercadoLivre.cliquesNoPeriodo)} apoio={`${numero(dados.mercadoLivre.cliques)} desde sempre`}
              cor={AZUL_MARINHO} />
          )}
        </GradeKpi>
      )}
      {dados?.maisVendidos?.[0] && (
        <p style={{ fontSize: 12.5, color: TEXTO_APOIO, margin: "12px 0 0" }}>
          <Package size={12} style={{ verticalAlign: "-2px" }} /> Mais vendido: <strong style={{ color: AZUL_MARINHO }}>{dados.maisVendidos[0].titulo}</strong>
          {" "}({numero(dados.maisVendidos[0].quantidade)} un., {brl(dados.maisVendidos[0].comissao)} de comissão)
        </p>
      )}
    </section>
  );
}
