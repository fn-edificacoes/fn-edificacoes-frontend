/* ============================================================
   LEVANTAMENTOS DE PROSPECÇÃO (.md) — o anexo da carteira, por regional
   ============================================================
   Cada estado tem o seu levantamento de prospecção em .md (MRV, Tenda, Econ… com endereço,
   % da obra e prioridade), refeito de tempos em tempos. Aqui a Gerência envia o arquivo, vê
   a prévia do que entra e do que muda, e só então confirma. O arquivo fica guardado no estado
   (regional) dele, e os empreendimentos vão para a carteira de Prospecção e para o Mapa de
   atuação → Empreendimentos prospectados.

   Quem lê o arquivo é o servidor (src/prospeccao-levantamentos.js no backend). A tela não tem
   regra de leitura nenhuma: mostra o que ele devolveu, e a prévia é o próprio servidor
   simulando a importação.

   Também moram aqui a lista de prioridades da carteira e a cor de cada uma: o App.jsx e o
   Mapa de atuação usam as mesmas. */
import React, { useEffect, useRef, useState } from "react";
import { FileText, FileUp, Download, Eye, Trash2, X, Loader2, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";

const AZUL_MEDIO = "#2C75B5";
const AZUL_MARINHO = "#12335B";
const CINZA_CLARO = "#F1F4F8";
const CINZA_BORDA = "#D8DEE7";

/* Carteira de prospecção — quais empreendimentos entram no funil comercial, com que
   prioridade e qual a ação recomendada. A prioridade é editável, porque a realidade muda mais
   rápido que a pesquisa. */
export const PRIORIDADES_PROSPECCAO = ["Imediata", "Alta", "Média", "Baixa", "Futura", "Pós-entrega", "Fora do escopo", "A confirmar"];

export const COR_PRIORIDADE = {
  "Imediata": { cor: "#C62828", bg: "#FCEAEA" },
  "Alta": { cor: "#C25E00", bg: "#FFEDD9" },
  "Média": { cor: "#B26A00", bg: "#FFF4E0" },
  "Baixa": { cor: "#65758b", bg: "#EEF1F5" },
  "Futura": { cor: "#2C75B5", bg: "#EAF2FB" },
  "Pós-entrega": { cor: "#0F766E", bg: "#E3F3F1" },
  "Fora do escopo": { cor: "#8593a8", bg: "#F4F6F8" },
  "A confirmar": { cor: "#8593a8", bg: "#F4F6F8" },
};

export const NOME_UF = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal",
  ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

const ROTULO_STATUS_REGIONAL = {
  nao_iniciada: "Não iniciada", prospeccao: "Prospecção", recrutamento: "Recrutamento", piloto: "Piloto",
  ativa: "Ativa", expansao: "Expansão", consolidada: "Consolidada", suspensa: "Suspensa",
};

export function ChipPrioridade({ prioridade }) {
  const c = COR_PRIORIDADE[prioridade] || COR_PRIORIDADE["A confirmar"];
  return (
    <span style={{ background: c.bg, color: c.cor, borderRadius: 20, padding: "2px 9px", fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}>
      {prioridade || "A confirmar"}
    </span>
  );
}

const btn = { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "none", background: AZUL_MEDIO, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit" };
const btnLeve = { ...btn, background: "#fff", color: AZUL_MARINHO, border: `1px solid ${CINZA_BORDA}`, fontWeight: 600 };
const btnMini = { ...btnLeve, padding: "4px 9px", fontSize: 12 };
const th = { textAlign: "left", fontSize: 11.5, fontWeight: 700, color: "#5a6a80", padding: "7px 8px", borderBottom: `1px solid ${CINZA_BORDA}`, whiteSpace: "nowrap" };
const td = { fontSize: 12.5, padding: "7px 8px", borderBottom: `1px solid ${CINZA_CLARO}`, verticalAlign: "top" };
const overlay = { position: "fixed", inset: 0, background: "rgba(18,51,91,.45)", display: "grid", placeItems: "center", zIndex: 50, padding: 16 };

const dataHora = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
const pct = (n) => (n == null ? "—" : `${Number(n).toLocaleString("pt-BR")}%`);

function baixarTexto(nome, conteudo) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = nome || "levantamento.md";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function CardLevantamentosProspeccao({ token, apiFetch, notify, aoImportar }) {
  const [arquivos, setArquivos] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [previas, setPrevias] = useState([]);
  const [vendo, setVendo] = useState(null);
  const [fechadas, setFechadas] = useState({});
  const entrada = useRef(null);

  const carregar = async () => {
    setCarregando(true);
    try { setArquivos((await apiFetch("/api/prospeccao/arquivos", { token })).arquivos || []); }
    catch (e) { notify(`Não foi possível carregar os levantamentos: ${e.message}`); }
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, []);

  const mudarPrevia = (chave, patch) => setPrevias((atual) => atual.map((p) => (p.chave === chave ? { ...p, ...patch } : p)));

  /* A prévia é o servidor lendo o arquivo e comparando com a carteira, sem gravar nada. */
  const simular = async (previa, uf) => {
    mudarPrevia(previa.chave, { carregando: true, erro: "" });
    try {
      const dados = await apiFetch("/api/prospeccao/arquivos", {
        method: "POST", token, body: { nomeArquivo: previa.nomeArquivo, conteudo: previa.conteudo, uf: uf || undefined, simular: true },
      });
      mudarPrevia(previa.chave, { carregando: false, dados, uf: dados.uf || "" });
    } catch (e) { mudarPrevia(previa.chave, { carregando: false, erro: e.message, dados: null }); }
  };

  const escolherArquivos = async (lista) => {
    const novos = [];
    for (const arquivo of lista) {
      const previa = { chave: `${arquivo.name}-${Date.now()}-${Math.random()}`, nomeArquivo: arquivo.name, conteudo: await arquivo.text(), uf: "", dados: null, carregando: true, erro: "" };
      novos.push(previa);
    }
    setPrevias((atual) => [...novos, ...atual]);
    for (const p of novos) simular(p);
  };

  const importar = async (previa) => {
    mudarPrevia(previa.chave, { gravando: true });
    try {
      const r = await apiFetch("/api/prospeccao/arquivos", {
        method: "POST", token, body: { nomeArquivo: previa.nomeArquivo, conteudo: previa.conteudo, uf: previa.uf },
      });
      notify(`Levantamento de ${NOME_UF[r.uf] || r.uf} importado: ${r.novos} novo(s), ${r.atualizados} atualizado(s) ✓`);
      setPrevias((atual) => atual.filter((p) => p.chave !== previa.chave));
      await carregar();
      aoImportar?.();
    } catch (e) {
      mudarPrevia(previa.chave, { gravando: false });
      notify(`Não foi possível importar: ${e.message}`);
    }
  };

  const abrir = async (a, acao) => {
    try {
      const r = await apiFetch(`/api/prospeccao/arquivos/${a.id}`, { token });
      if (acao === "baixar") baixarTexto(r.nomeArquivo, r.conteudo);
      else setVendo(r);
    } catch (e) { notify(`Não foi possível abrir o arquivo: ${e.message}`); }
  };

  const excluir = async (a) => {
    if (!window.confirm(`Excluir o arquivo "${a.nomeArquivo}"? Os empreendimentos que ele trouxe continuam na carteira.`)) return;
    try {
      await apiFetch(`/api/prospeccao/arquivos/${a.id}`, { method: "DELETE", token });
      setArquivos((atual) => atual.filter((x) => x.id !== a.id));
      notify("Arquivo excluído ✓");
    } catch (e) { notify(`Não foi possível excluir: ${e.message}`); }
  };

  /* Separados por estado — é o estado que liga o arquivo à regional da Rede Nacional. */
  const porUf = {};
  for (const a of arquivos) (porUf[a.uf] = porUf[a.uf] || []).push(a);
  const ufs = Object.keys(porUf).sort((x, y) => (NOME_UF[x] || x).localeCompare(NOME_UF[y] || y, "pt-BR"));

  return (
    <section style={{ background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 14, padding: 18, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 8 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: CINZA_CLARO, display: "grid", placeItems: "center" }}><FileText size={16} color={AZUL_MEDIO} /></div>
        <h3 style={{ margin: 0, fontSize: 15, color: AZUL_MARINHO, flex: 1, minWidth: 200 }}>Levantamentos de prospecção (.md) por regional</h3>
        <input ref={entrada} type="file" accept=".md,.markdown,text/markdown,text/plain" multiple style={{ display: "none" }}
          onChange={(e) => { const lista = [...(e.target.files || [])]; e.target.value = ""; if (lista.length) escolherArquivos(lista); }} />
        <button style={btn} onClick={() => entrada.current?.click()}><FileUp size={14} /> Enviar levantamento (.md)</button>
      </div>
      <p style={{ fontSize: 12.5, color: "#5a6a80", margin: "0 0 14px", lineHeight: 1.55 }}>
        Mande aqui o .md de cada estado — o primeiro levantamento e as atualizações. Cada arquivo fica guardado na regional
        do estado, e os empreendimentos entram na carteira de Prospecção e no Mapa de atuação. Quem já está na carteira é
        atualizado (situação, % da obra, endereço); o que você mudou à mão — prioridade, ação, observações — não é sobrescrito.
      </p>

      {previas.map((p) => <Previa key={p.chave} previa={p} aoMudarUf={(uf) => simular(p, uf)} aoImportar={() => importar(p)}
        aoDescartar={() => setPrevias((atual) => atual.filter((x) => x.chave !== p.chave))} />)}

      {carregando && !arquivos.length && <p style={{ fontSize: 13, color: "#8593a8" }}>Carregando…</p>}
      {!carregando && !arquivos.length && !previas.length && (
        <p style={{ fontSize: 13, color: "#8593a8", margin: 0 }}>Nenhum levantamento enviado ainda.</p>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {ufs.map((uf) => {
          const lista = porUf[uf];
          const regionais = lista[0].regionais || [];
          const aberta = !fechadas[uf];
          return (
            <div key={uf} style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, overflow: "hidden" }}>
              <button onClick={() => setFechadas((f) => ({ ...f, [uf]: aberta }))} aria-expanded={aberta}
                style={{ width: "100%", background: CINZA_CLARO, border: "none", cursor: "pointer", padding: "9px 12px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", textAlign: "left", fontFamily: "inherit" }}>
                {aberta ? <ChevronDown size={15} color="#5a6a80" /> : <ChevronRight size={15} color="#5a6a80" />}
                <b style={{ fontSize: 13.5, color: AZUL_MARINHO }}>{uf} · {NOME_UF[uf] || uf}</b>
                <span style={{ fontSize: 12, color: "#5a6a80", flex: 1, minWidth: 160 }}>
                  {regionais.length
                    /* O nome cadastrado costuma já ser "Regional Ceará": sem o teste, a tela dizia "Regional Regional Ceará". */
                    ? regionais.map((r) => `${/^regional\b/i.test(r.nome) ? "" : "Regional "}${r.nome} (${ROTULO_STATUS_REGIONAL[r.status] || r.status})`).join(" · ")
                    : "sem regional cadastrada na Rede Nacional"}
                </span>
                <span style={{ fontSize: 12, color: "#5a6a80" }}>{lista.length} arquivo(s) · último em {dataHora(lista[0].enviadoEm)}</span>
              </button>
              {aberta && (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr><th style={th}>Arquivo</th><th style={th}>Data-base</th><th style={th}>Enviado</th><th style={{ ...th, textAlign: "right" }}>Empreend.</th><th style={th} /></tr></thead>
                    <tbody>
                      {lista.map((a, i) => (
                        <tr key={a.id}>
                          <td style={{ ...td, minWidth: 200 }}>
                            <b>{a.nomeArquivo}</b>{i === 0 && lista.length > 1 && <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 800, color: "#0F766E", background: "#E3F3F1", borderRadius: 20, padding: "1px 7px" }}>mais recente</span>}
                            {a.titulo && <div style={{ fontSize: 11.5, color: "#8593a8" }}>{a.titulo}</div>}
                          </td>
                          <td style={{ ...td, whiteSpace: "nowrap" }}>{a.dataBase || "—"}</td>
                          <td style={{ ...td, whiteSpace: "nowrap" }}>{dataHora(a.enviadoEm)}{a.enviadoPor && <div style={{ fontSize: 11.5, color: "#8593a8" }}>{a.enviadoPor}</div>}</td>
                          <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                            {a.totalItens}<div style={{ fontSize: 11.5, color: "#8593a8" }}>{a.novos} novo(s) · {a.atualizados} atualiz.</div>
                          </td>
                          <td style={{ ...td, whiteSpace: "nowrap", textAlign: "right" }}>
                            <span style={{ display: "inline-flex", gap: 6 }}>
                              <button style={btnMini} onClick={() => abrir(a, "ver")} title="Ver o arquivo"><Eye size={13} /> Ver</button>
                              <button style={btnMini} onClick={() => abrir(a, "baixar")} title="Baixar o .md"><Download size={13} /></button>
                              <button style={{ ...btnMini, color: "#C62828" }} onClick={() => excluir(a)} title="Excluir o arquivo"><Trash2 size={13} /></button>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {vendo && (
        <div style={overlay} onClick={() => setVendo(null)}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 18, width: "100%", maxWidth: 900, maxHeight: "88vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <strong style={{ flex: 1, color: AZUL_MARINHO, fontSize: 14 }}>{vendo.nomeArquivo}</strong>
              <button style={btnMini} onClick={() => baixarTexto(vendo.nomeArquivo, vendo.conteudo)}><Download size={13} /> Baixar</button>
              <button style={{ ...btnMini, border: "none" }} onClick={() => setVendo(null)} aria-label="Fechar"><X size={16} /></button>
            </div>
            <pre style={{ margin: 0, overflow: "auto", background: CINZA_CLARO, borderRadius: 8, padding: 12, fontSize: 12, lineHeight: 1.5, whiteSpace: "pre-wrap", fontFamily: "ui-monospace, Consolas, monospace" }}>
              {vendo.conteudo}
            </pre>
          </div>
        </div>
      )}
    </section>
  );
}

/* O que o servidor leu do arquivo e o que vai acontecer na carteira, antes de gravar. */
function Previa({ previa, aoMudarUf, aoImportar, aoDescartar }) {
  const [verItens, setVerItens] = useState(false);
  const d = previa.dados;
  return (
    <div style={{ border: `1.5px solid ${AZUL_MEDIO}`, background: "#F6F9FD", borderRadius: 10, padding: 12, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <FileText size={15} color={AZUL_MEDIO} />
        <b style={{ fontSize: 13.5, color: AZUL_MARINHO, flex: 1, minWidth: 180 }}>{previa.nomeArquivo}</b>
        <label style={{ fontSize: 12, color: "#5a6a80", display: "inline-flex", alignItems: "center", gap: 6 }}>
          Estado
          <select value={previa.uf} onChange={(e) => aoMudarUf(e.target.value)} disabled={previa.carregando || previa.gravando}
            style={{ padding: "6px 8px", border: `1px solid ${CINZA_BORDA}`, borderRadius: 8, fontSize: 13, background: "#fff", fontFamily: "inherit" }}>
            <option value="">Escolha…</option>
            {Object.entries(NOME_UF).map(([uf, nome]) => <option key={uf} value={uf}>{uf} · {nome}</option>)}
          </select>
        </label>
      </div>
      {d?.titulo && <div style={{ fontSize: 12, color: "#5a6a80", marginTop: 4 }}>{d.titulo}{d.dataBase ? ` · data-base ${d.dataBase}` : ""}</div>}

      {previa.carregando && <p style={{ fontSize: 13, color: "#5a6a80", margin: "10px 0 0" }}><Loader2 size={13} className="spin" style={{ verticalAlign: -2 }} /> Lendo o arquivo…</p>}
      {previa.erro && <p style={{ fontSize: 13, color: "#C62828", margin: "10px 0 0" }}>{previa.erro}</p>}
      {d?.precisaUf && <p style={{ fontSize: 13, color: "#B26A00", margin: "10px 0 0" }}>Não deu para saber o estado pelo título nem pelo nome do arquivo — escolha acima.</p>}

      {d && !d.precisaUf && (
        <>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13, margin: "10px 0 6px" }}>
            <span><b>{d.itens.length}</b> empreendimento(s)</span>
            <span style={{ color: "#0F766E" }}><b>{d.novos}</b> novo(s) na carteira</span>
            <span style={{ color: AZUL_MEDIO }}><b>{d.atualizados}</b> já existente(s), atualizado(s)</span>
            {d.foraDoArquivo > 0 && <span style={{ color: "#5a6a80" }}>{d.foraDoArquivo} da carteira de {d.uf} não constam aqui e ficam como estão</span>}
          </div>
          {(d.avisos || []).map((a) => (
            <div key={a} style={{ fontSize: 12.5, color: "#7a4b00", background: "#FFF4E0", border: "1px solid #F2D49B", borderRadius: 8, padding: "6px 9px", marginBottom: 6 }}>
              <AlertTriangle size={12} style={{ verticalAlign: -1 }} /> {a}
            </div>
          ))}
          <button style={{ ...btnMini, border: "none", background: "transparent", color: AZUL_MEDIO, padding: "4px 0" }} onClick={() => setVerItens((v) => !v)}>
            {verItens ? <ChevronDown size={14} /> : <ChevronRight size={14} />} {verItens ? "Esconder" : "Ver"} os empreendimentos
          </button>
          {verItens && (
            <div style={{ overflowX: "auto", maxHeight: 360, overflowY: "auto", background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 8, marginTop: 6 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={th}>Empreendimento</th><th style={th}>Construtora</th><th style={th}>Município</th><th style={th}>Obra</th><th style={th}>Prioridade</th><th style={th}>Na carteira</th></tr></thead>
                <tbody>
                  {d.itens.map((it) => (
                    <tr key={`${it.construtora}|${it.empreendimento}`}>
                      <td style={{ ...td, minWidth: 160 }}><b>{it.empreendimento}</b>{it.regional && <div style={{ fontSize: 11.5, color: "#8593a8" }}>{it.regional}</div>}</td>
                      <td style={td}>{it.construtora || "—"}</td>
                      <td style={td}>{it.municipio || <span style={{ color: "#B26A00" }}>sem município</span>}</td>
                      <td style={{ ...td, minWidth: 120 }}>{it.situacao || "—"}{it.referencia && <div style={{ fontSize: 11.5, color: "#8593a8" }}>{it.referencia}</div>}</td>
                      <td style={td}>
                        <ChipPrioridade prioridade={it.prioridade} />
                        {it.prioridadeMantida && <div style={{ fontSize: 11, color: "#8593a8", marginTop: 3 }}>a sua, mantida</div>}
                      </td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>
                        {it.acao === "novo"
                          ? <span style={{ color: "#0F766E", fontWeight: 700 }}>novo</span>
                          : <span style={{ color: AZUL_MEDIO, fontWeight: 700 }}>atualiza{it.percentualAnterior !== it.percentual && (it.percentualAnterior != null || it.percentual != null) ? ` · ${pct(it.percentualAnterior)} → ${pct(it.percentual)}` : ""}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10, flexWrap: "wrap" }}>
        <button style={btnLeve} onClick={aoDescartar} disabled={previa.gravando}>Descartar</button>
        <button style={{ ...btn, opacity: !d || d.precisaUf || !previa.uf || previa.carregando ? 0.55 : 1 }} onClick={aoImportar}
          disabled={!d || d.precisaUf || !previa.uf || previa.carregando || previa.gravando}>
          {previa.gravando ? <Loader2 size={14} className="spin" /> : <FileUp size={14} />} Importar para a carteira
        </button>
      </div>
    </div>
  );
}
