/* ============================================================
   FN CLUBE — parceiros com desconto exclusivo para clientes FN
   ============================================================
   Pedido da Gerência (nov/2026): organizar o FN Clube com parceiros homologados que dão
   desconto exclusivo — restaurantes, farmácias, academias, terapias, lanchonetes e outros —
   junto com os colaboradores do Casa Pronta.

   Duas origens, uma vitrine:
     - os parceiros do Clube de sempre (`/api/parceiros/vitrine`, tipo "servico"), agora com
       ramo. O cartão abre o ModalBeneficioParceiro do App.jsx, onde o cliente FN logado gera o
       cupom — o desconto é exclusivo de cliente, como já era;
     - os parceiros homologados no Casa Pronta (`/api/clube/casa-pronta`), que entram sozinhos
       em "Casa e reforma" (decisão da Gerência: um cadastro só). Deles vem só empresa, cidade e
       o desconto FN de cada serviço; o cliente pede pela FN, pelo WhatsApp, como no Casa Pronta.

   Arquivo à parte como o FN Home: o App.jsx encaixa e entrega o apiFetch. As chaves dos ramos
   são as de RAMOS_CLUBE no backend (src/clube-fn.js) — ramo novo precisa entrar nos dois. */
import React, { useEffect, useMemo, useState } from "react";
import { Hammer, Utensils, Sandwich, Soup, Pill, Dumbbell, Leaf, Stethoscope, Sparkles, PawPrint, GraduationCap, Store, Search, Building2, Check, MapPin, MessageCircle, Info } from "lucide-react";

const AZUL_MEDIO = "#2C75B5";
const AZUL_MARINHO = "#12335B";
const CINZA_CLARO = "#F1F4F8";
const CINZA_BORDA = "#D8DEE7";
const DOURADO = "#C8A44D";
const COR_DESCONTO = "#D93025";
const VERDE_WHATSAPP = "#1FA855";
const WHATSAPP_FN = "5581983061305";

export const RAMOS_CLUBE = [
  { chave: "casa", rotulo: "Casa e reforma", Icone: Hammer },
  { chave: "restaurantes", rotulo: "Restaurantes", Icone: Utensils },
  { chave: "lanchonetes", rotulo: "Lanchonetes", Icone: Sandwich },
  { chave: "alimentacao", rotulo: "Comidas e delivery", Icone: Soup },
  { chave: "farmacias", rotulo: "Farmácias", Icone: Pill },
  { chave: "academias", rotulo: "Academias", Icone: Dumbbell },
  { chave: "terapias", rotulo: "Terapias e bem-estar", Icone: Leaf },
  { chave: "saude", rotulo: "Saúde", Icone: Stethoscope },
  { chave: "beleza", rotulo: "Beleza e estética", Icone: Sparkles },
  { chave: "pets", rotulo: "Pets", Icone: PawPrint },
  { chave: "educacao", rotulo: "Educação e cursos", Icone: GraduationCap },
  { chave: "outros", rotulo: "Outros", Icone: Store },
];
const RAMO_POR_CHAVE = Object.fromEntries(RAMOS_CLUBE.map((r) => [r.chave, r]));
export const rotuloDoRamo = (chave) => RAMO_POR_CHAVE[chave]?.rotulo || "";

const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/* "10% de desconto", "15 % na mensalidade" → 10, 15. Só para o selo: o texto do benefício vai
   inteiro no cartão, porque "-10%" sem "na mensalidade" prometeria mais do que o parceiro dá. */
function percentualDoBeneficio(texto) {
  const m = String(texto || "").match(/(\d{1,2}(?:[.,]\d)?)\s*%/);
  return m ? Number(m[1].replace(",", ".")) : null;
}
const fmtPct = (n) => `${String(n).replace(".", ",")}%`;

/* Campo "Ramo no FN Clube" dos formulários de parceiro do App.jsx, que passa os estilos dele. */
export function SeletorRamo({ valor, aoMudar, estiloCelula, estiloRotulo, estiloCampo, rotulo = "Ramo no FN Clube" }) {
  return (
    <div style={estiloCelula}>
      <label style={estiloRotulo}>{rotulo}</label>
      <select style={estiloCampo} value={valor || ""} onChange={(e) => aoMudar(e.target.value)}>
        <option value="">Escolha o ramo…</option>
        {RAMOS_CLUBE.map((r) => <option key={r.chave} value={r.chave}>{r.rotulo}</option>)}
      </select>
    </div>
  );
}

function useCasaPronta(apiFetch) {
  const [estado, setEstado] = useState({ parceiros: [], disponivel: true, carregando: true });
  useEffect(() => {
    let vivo = true;
    apiFetch("/api/clube/casa-pronta")
      .then((r) => { if (vivo) setEstado({ parceiros: r.parceiros || [], disponivel: r.disponivel !== false, carregando: false }); })
      .catch(() => { if (vivo) setEstado({ parceiros: [], disponivel: false, carregando: false }); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return estado;
}

/* ---- Faixa de abertura da página pública (?pagina=fn-clube), irmã da FaixaLojaFnHome ---- */
const PROPOSTA_CLUBE = [
  ["Desconto de cliente FN", "Restaurantes, farmácias, academias, terapias e mais, com condição que só cliente FN tem."],
  ["Cupom na hora", "Entre no portal como cliente FN, escolha o parceiro e mostre o código no atendimento."],
  ["Parceiros aprovados pela FN", "Cada parceiro passa pela FN antes de entrar — inclusive os do Casa Pronta, para a sua casa."],
];
export function FaixaClubeFn() {
  return (
    <section style={{
      position: "relative", overflow: "hidden", color: "#fff", borderRadius: 20, padding: "clamp(22px, 4.5vw, 40px)",
      background: "radial-gradient(520px 280px at 100% 0%, rgba(200,164,77,.28), transparent 70%), linear-gradient(160deg, #12335B, #0B2140)",
    }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: DOURADO }}>
        <span style={{ width: 20, height: 2, borderRadius: 2, background: DOURADO }} /> FN Clube · benefícios de cliente FN
      </div>
      <h2 style={{ margin: "10px 0 0", fontSize: "clamp(23px, 3.4vw, 34px)", lineHeight: 1.15, fontWeight: 800, letterSpacing: "-.02em", maxWidth: 660 }}>
        Imóvel novo, bairro novo — e desconto de cliente FN por perto.
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10, marginTop: 22 }}>
        {PROPOSTA_CLUBE.map(([titulo, texto]) => (
          <div key={titulo} style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, padding: "13px 15px" }}>
            <Check size={17} color={DOURADO} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 13, lineHeight: 1.45, color: "rgba(255,255,255,.75)" }}>
              <strong style={{ display: "block", color: "#fff", fontSize: 14 }}>{titulo}</strong>{texto}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const CSS_CLUBE = `
  /* No computador os ramos quebram linha (cabem todos à vista); no celular rolam de lado. */
  .fnc-chips { display: flex; flex-wrap: wrap; gap: 8px; }
  @media (max-width: 640px) { .fnc-chips { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 6px; scrollbar-width: thin; } }
  .fnc-chip { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; padding: 7px 12px; border-radius: 999px;
    border: 1px solid ${CINZA_BORDA}; background: #fff; color: ${AZUL_MARINHO}; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
  .fnc-chip[aria-pressed="true"] { background: ${AZUL_MARINHO}; border-color: ${AZUL_MARINHO}; color: #fff; }
  .fnc-grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px; }
  .fnc-cartao { position: relative; display: flex; flex-direction: column; align-items: stretch; gap: 10px; text-align: left; background: #fff;
    border: 1px solid ${CINZA_BORDA}; border-radius: 14px; padding: 14px; cursor: pointer; font-family: inherit; min-width: 0; }
  .fnc-cartao:hover { border-color: ${AZUL_MEDIO}; box-shadow: 0 6px 18px rgba(18,51,91,.08); }
  .fnc-grade-casa { grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); }
  @media (max-width: 560px) { .fnc-grade { grid-template-columns: 1fr 1fr; gap: 10px; } .fnc-cartao { padding: 11px; } }
  /* O cartão do Casa Pronta leva a lista de serviços: em meia tela de celular cada nome virava três linhas. */
  @media (max-width: 560px) { .fnc-grade.fnc-grade-casa { grid-template-columns: 1fr; } }
  @media (max-width: 360px) { .fnc-grade { grid-template-columns: 1fr; } }
`;

function SeloDesconto({ pct, texto }) {
  return (
    <span style={{ display: "inline-block", background: COR_DESCONTO, color: "#fff", fontSize: 11.5, fontWeight: 800, padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>
      {texto || `-${fmtPct(pct)}`}
    </span>
  );
}

function CartaoParceiro({ p, aoEscolher }) {
  const ramo = RAMO_POR_CHAVE[p.ramo];
  const pct = percentualDoBeneficio(p.beneficio);
  return (
    <button className="fnc-cartao" onClick={() => aoEscolher(p)}>
      {pct !== null && <span style={{ position: "absolute", top: 10, right: 10 }}><SeloDesconto pct={pct} /></span>}
      <div style={{ width: 58, height: 58, borderRadius: 12, background: CINZA_CLARO, display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0 }}>
        {p.logo ? <img src={p.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          : ramo ? <ramo.Icone size={24} color={AZUL_MEDIO} /> : <Building2 size={24} color={AZUL_MEDIO} />}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: AZUL_MARINHO, lineHeight: 1.25 }}>{p.empresa}</div>
        <div style={{ fontSize: 12, color: "#65758b", marginTop: 3 }}>
          {[ramo?.rotulo, p.cidade].filter(Boolean).join(" · ")}
        </div>
      </div>
      {p.beneficio && (
        <div style={{ fontSize: 13, fontWeight: 700, color: COR_DESCONTO, lineHeight: 1.35 }}>{p.beneficio}</div>
      )}
      <div style={{ marginTop: "auto", fontSize: 12.5, fontWeight: 700, color: AZUL_MEDIO }}>Ver e pegar o cupom →</div>
    </button>
  );
}

function linkPedirPelaFn(parceiro, servico) {
  const texto = servico
    ? `Olá! Vi no FN Clube o serviço "${servico.nome}" do parceiro ${parceiro.empresa} (Casa Pronta) e quero saber como contratar com o desconto FN.`
    : `Olá! Vi no FN Clube o parceiro ${parceiro.empresa} (Casa Pronta) e quero saber como contratar com o desconto FN.`;
  return `https://wa.me/${WHATSAPP_FN}?text=${encodeURIComponent(texto)}`;
}

function CartaoCasaPronta({ p }) {
  const [abertos, setAbertos] = useState(false);
  const servicos = abertos ? p.servicos : p.servicos.slice(0, 4);
  return (
    <div className="fnc-cartao" style={{ cursor: "default" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#FBF4E2", color: "#8A6A1F", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6 }}>
          <Hammer size={12} /> Casa Pronta
        </span>
        {p.descontoMaximo && <SeloDesconto texto={`até ${fmtPct(p.descontoMaximo)} OFF`} />}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: AZUL_MARINHO, lineHeight: 1.25 }}>{p.empresa}</div>
        {(p.cidade || p.cobertura) && (
          <div style={{ fontSize: 12, color: "#65758b", marginTop: 3, display: "flex", gap: 4, alignItems: "flex-start" }}>
            <MapPin size={12} style={{ flexShrink: 0, marginTop: 2 }} /> <span>{p.cobertura || p.cidade}</span>
          </div>
        )}
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 5 }}>
        {servicos.map((s) => (
          <li key={s.nome} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, color: "#3d4b5f" }}>
            <span style={{ minWidth: 0 }}>{s.nome}</span>
            {s.desconto ? <strong style={{ color: COR_DESCONTO, whiteSpace: "nowrap" }}>-{fmtPct(s.desconto)}</strong> : <span style={{ color: "#8593a8", whiteSpace: "nowrap" }}>preço FN</span>}
          </li>
        ))}
      </ul>
      {p.servicos.length > 4 && (
        <button onClick={() => setAbertos((v) => !v)} style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, color: AZUL_MEDIO, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          {abertos ? "Ver menos" : `Ver os ${p.servicos.length} serviços`}
        </button>
      )}
      <a href={linkPedirPelaFn(p)} target="_blank" rel="noopener noreferrer"
        style={{ marginTop: "auto", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, background: VERDE_WHATSAPP, color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 700, padding: "9px 12px", borderRadius: 9 }}>
        <MessageCircle size={15} /> Pedir pela FN
      </a>
    </div>
  );
}

/* ---- A vitrine do Clube: ramos, busca, parceiros e o Casa Pronta ---- */
export function VitrineClubeFn({ apiFetch, parceiros, carregando, aoEscolher, aoCarregarCasaPronta }) {
  const casaPronta = useCasaPronta(apiFetch);
  const [ramo, setRamo] = useState("");
  const [busca, setBusca] = useState("");
  /* Quem encaixa a vitrine (SecaoParceirosVitrine) decide o "em breve" do Clube vazio, e precisa
     saber se o Casa Pronta trouxe alguém. */
  useEffect(() => {
    if (!casaPronta.carregando) aoCarregarCasaPronta?.(casaPronta.parceiros.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [casaPronta.carregando, casaPronta.parceiros.length]);

  const termo = semAcento(busca.trim());
  const casaTexto = (p) => semAcento([p.empresa, p.cidade, p.cobertura, ...p.categorias, ...p.servicos.map((s) => s.nome)].join(" "));
  const parceiroTexto = (p) => semAcento([p.empresa, p.cidade, p.beneficio, p.descricaoBeneficio, rotuloDoRamo(p.ramo)].join(" "));

  const contagem = useMemo(() => {
    const c = {};
    for (const p of parceiros) if (p.ramo) c[p.ramo] = (c[p.ramo] || 0) + 1;
    if (casaPronta.parceiros.length) c.casa = (c.casa || 0) + casaPronta.parceiros.length;
    return c;
  }, [parceiros, casaPronta.parceiros]);
  const total = parceiros.length + casaPronta.parceiros.length;

  /* Os que dão desconto em número vêm primeiro (o maior na frente); o resto, por nome. */
  const lista = useMemo(() => parceiros
    .filter((p) => (!ramo || p.ramo === ramo) && (!termo || parceiroTexto(p).includes(termo)))
    .sort((a, b) => (percentualDoBeneficio(b.beneficio) ?? -1) - (percentualDoBeneficio(a.beneficio) ?? -1) || a.empresa.localeCompare(b.empresa, "pt-BR")),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [parceiros, ramo, termo]);
  const listaCasa = (!ramo || ramo === "casa") ? casaPronta.parceiros.filter((p) => !termo || casaTexto(p).includes(termo)) : [];
  const maiorDesconto = Math.max(0, ...parceiros.map((p) => percentualDoBeneficio(p.beneficio) || 0), ...casaPronta.parceiros.map((p) => p.descontoMaximo || 0));

  /* Clube vazio: o aviso "estreia em breve" é da SecaoParceirosVitrine (AvisoFnClubeEmBreve, no
     App.jsx). Com um lado ainda buscando, mostra o que o outro já trouxe. */
  if (total === 0) return carregando || casaPronta.carregando ? <p style={{ color: "#8593a8", fontSize: 14 }}>Carregando…</p> : null;

  return (
    <div style={{ display: "grid", gap: 14, minWidth: 0 }}>
      <style>{CSS_CLUBE}</style>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13.5, color: "#4a5a70" }}>
          <strong style={{ color: AZUL_MARINHO }}>{total} {total === 1 ? "parceiro" : "parceiros"}</strong>
          {maiorDesconto > 0 && <> · descontos de até <strong style={{ color: COR_DESCONTO }}>{fmtPct(maiorDesconto)}</strong></>}
        </div>
        <label style={{ position: "relative", flex: "1 1 220px", maxWidth: 320 }}>
          <Search size={15} color="#8593a8" style={{ position: "absolute", left: 10, top: 10 }} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar parceiro, serviço ou cidade"
            style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px 8px 32px", border: `1px solid ${CINZA_BORDA}`, borderRadius: 999, fontSize: 13.5, fontFamily: "inherit", outline: "none" }} />
        </label>
      </div>

      <div className="fnc-chips" role="group" aria-label="Ramos do FN Clube">
        <button className="fnc-chip" aria-pressed={!ramo} onClick={() => setRamo("")}>Todos ({total})</button>
        {RAMOS_CLUBE.filter((r) => contagem[r.chave]).map((r) => (
          <button key={r.chave} className="fnc-chip" aria-pressed={ramo === r.chave} onClick={() => setRamo(ramo === r.chave ? "" : r.chave)}>
            <r.Icone size={14} /> {r.rotulo} ({contagem[r.chave]})
          </button>
        ))}
      </div>

      {lista.length > 0 && (
        <div className="fnc-grade">
          {lista.map((p) => <CartaoParceiro key={p.id} p={p} aoEscolher={aoEscolher} />)}
        </div>
      )}

      {listaCasa.length > 0 && (
        <div style={{ display: "grid", gap: 10, marginTop: lista.length ? 8 : 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: AZUL_MARINHO }}>Casa Pronta · serviços para o seu imóvel com preço FN</div>
            <div style={{ fontSize: 13, color: "#65758b", marginTop: 3, lineHeight: 1.45 }}>
              Parceiros homologados pela FN para box, marcenaria, pintura e mais. Você pede pela FN, que combina o serviço com o parceiro.
            </div>
          </div>
          <div className="fnc-grade fnc-grade-casa">
            {listaCasa.map((p) => <CartaoCasaPronta key={p.id} p={p} />)}
          </div>
        </div>
      )}

      {lista.length === 0 && listaCasa.length === 0 && (
        <p style={{ color: "#8593a8", fontSize: 14, margin: 0 }}>
          {termo ? "Nenhum parceiro encontrado nessa busca." : "Nenhum parceiro neste ramo ainda."}
        </p>
      )}
    </div>
  );
}

/* ---- Gerência: o que entra sozinho do Casa Pronta ---- */
export function AvisoCasaProntaNoClube({ apiFetch }) {
  const casaPronta = useCasaPronta(apiFetch);
  if (casaPronta.carregando) return null;
  const n = casaPronta.parceiros.length;
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: casaPronta.disponivel ? "#EAF2FB" : "#FFF4E0", color: casaPronta.disponivel ? AZUL_MARINHO : "#8a5300", border: `1px solid ${casaPronta.disponivel ? "#cfe0f3" : "#f0d9a8"}`, borderRadius: 12, padding: "12px 14px", fontSize: 13, lineHeight: 1.5 }}>
      <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
      <div>
        <strong>Casa Pronta no FN Clube.</strong>{" "}
        {!casaPronta.disponivel
          ? "O Clube não conseguiu ler o Casa Pronta agora (o FN Projetos não respondeu). Os parceiros de lá voltam a aparecer sozinhos quando ele responder."
          : n === 0
            ? "Nenhum parceiro homologado no Casa Pronta no momento. Quem for homologado lá aparece sozinho no Clube, em Casa e reforma."
            : `${n} ${n === 1 ? "parceiro homologado aparece" : "parceiros homologados aparecem"} sozinhos no Clube, em Casa e reforma, com o desconto FN de cada serviço.`}
        {" "}Para incluir ou tirar alguém de lá, homologue ou suspenda no FN Projetos → Casa Pronta (Gerência → Reformas). O cliente pede esses serviços pela FN.
      </div>
    </div>
  );
}
