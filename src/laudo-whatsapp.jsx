/* Laudo pelo WhatsApp do cliente, depois da aprovação da Gerência.

   É só um link click-to-chat (wa.me/<número>?text=<mensagem>): abre o WhatsApp de quem clicou
   com a conversa e o texto prontos, e quem envia de fato é a pessoa — desde nov/2026, o
   Atendimento, na aba "Envio de laudo" (AbaEnvioLaudo, no fim deste arquivo); a Gerência ainda
   reenvia de Laudos realizados. Sem API da Meta, sem custo.
   O e-mail continua saindo pelo servidor como sempre — isto é um canal a mais, não substitui.

   O botão é um <a href> de verdade, e não window.open: o clique acontece depois do await da
   aprovação, e window.open fora do gesto do usuário é barrado pelo navegador como pop-up. */
import React, { useState, useEffect } from "react";
import { AREA_CLIENTE_URL, FN_HOME_URL } from "./links-publicos.js";

const VERDE_WHATSAPP = "#1B7F4B";

/* Só dígitos. 10 ou 11 (DDD + número) ganham o 55; com 55 na frente e 12 ou 13 dígitos fica como
   está. O resto é inválido e devolve "" — o botão fica desabilitado em vez de abrir conversa com
   um número errado. */
export function numeroWhatsapp(telefone) {
  const d = String(telefone || "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return d;
  return "";
}

function primeiroNome(nome) {
  const p = String(nome || "").trim().split(/\s+/)[0] || "";
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : "";
}

/* "Bloco" e "Apto" só entram com valor — e não se repetem quando o cadastro já traz a palavra
   ("Torre 2", "Apto 101"), o que é comum nos dados importados das planilhas. */
function linhaDoImovel({ empreendimento, bloco, apto }) {
  const b = String(bloco || "").trim();
  const a = String(apto || "").trim();
  const partes = [
    b && (/^(bloco|torre|bl\b|edif)/i.test(b) ? b : `Bloco ${b}`),
    a && (/^(ap|unid)/i.test(a) ? a : `Apto ${a}`),
  ].filter(Boolean);
  const emp = String(empreendimento || "").trim();
  if (!emp && !partes.length) return null;
  return `🏢 ${[emp, partes.join(", ")].filter(Boolean).join(" – ")}`;
}

/* O e-mail manda o laudo só como PDF anexo, e o arquivo no Drive é privado (o download sai pelo
   servidor, com token curto). Não há link que abra sem login — por isso a mensagem leva a Área do
   Cliente, onde o laudo fica para baixar. O cliente entra lá com o e-mail, não com o CPF. */
export function mensagemWhatsappLaudo({ nome, empreendimento, bloco, apto, emailEnviado }) {
  const pn = primeiroNome(nome);
  const imovel = linhaDoImovel({ empreendimento, bloco, apto });
  return [
    pn ? `Olá, ${pn}! 👋` : "Olá! 👋",
    "",
    "Aqui é da *FN Edificações*. O laudo da vistoria do seu imóvel está pronto e já foi *revisado e aprovado pela nossa equipe técnica* ✅",
    "",
    imovel,
    `📄 Acesse seu laudo: ${AREA_CLIENTE_URL} (entre com o seu e-mail cadastrado)`,
    ...(emailEnviado ? ["", "Também enviamos uma cópia para o seu e-mail cadastrado."] : []),
    "",
    "🏠 *Novidade: conheça a FN Home!*",
    `Nossa nova loja com produtos selecionados para o seu novo lar 👉 ${FN_HOME_URL}`,
    "",
    "Ficou com alguma dúvida sobre o laudo? É só responder esta mensagem.",
    "Obrigado pela confiança! 💙",
    "*Equipe FN Edificações*",
  ].filter((linha) => linha !== null).join("\n");
}

/* laudo: a linha da lista (doc_id, cliente, empreendimento, bloco_torre, apartamento).
   cliente: o cadastro dono do laudo (clienteDoDoc), de onde vem o telefone.
   O registro "WhatsApp aberto" vai para a auditoria do laudo sem esperar resposta: o link precisa
   abrir no mesmo clique, e uma falha de registro não pode impedir o envio. */
export function BotaoWhatsappLaudo({ laudo, cliente, emailEnviado, apiFetch, token, rotulo = "📲 Enviar também pelo WhatsApp", mini = false }) {
  const numero = numeroWhatsapp(cliente?.telefone);
  const classe = mini ? "btn-mini" : "btn-solid";
  if (!numero) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className={classe} disabled style={{ background: "#9aa7b8", cursor: "not-allowed" }}>{rotulo}</button>
        <span style={{ fontSize: 12, color: "#B26A00" }}>Cliente sem WhatsApp válido no cadastro</span>
      </span>
    );
  }
  const texto = mensagemWhatsappLaudo({
    nome: cliente?.nome || laudo?.cliente,
    empreendimento: laudo?.empreendimento || cliente?.empreendimento,
    /* Bloco e apto vêm do registro do laudo, que guarda os dois separados. O cadastro tem um
       campo só, muitas vezes com "Bloco A Apto 101" — misturar os dois repetiria o apto. */
    bloco: laudo?.bloco_torre,
    apto: laudo?.apartamento,
    emailEnviado,
  });
  const registrar = () => {
    if (!laudo?.doc_id || !apiFetch) return;
    apiFetch(`/api/laudos/${laudo.doc_id}/whatsapp-aberto`, { method: "POST", token })
      .catch((e) => console.warn("Não foi possível registrar o WhatsApp aberto:", e.message));
  };
  return (
    <a className={classe} href={`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`}
      target="_blank" rel="noopener" onClick={registrar}
      style={{ textDecoration: "none", background: VERDE_WHATSAPP, display: "inline-flex", alignItems: "center", gap: 6 }}>
      {rotulo}
    </a>
  );
}

/* ================= Aba "Envio de laudo" (Atendimento) =================
   Desde nov/2026 a Gerência só aprova: o e-mail continua saindo sozinho na aprovação, e o
   WhatsApp passou para o Atendimento, que é quem conversa com o cliente. Aqui ficam os laudos
   já aprovados, primeiro os que ainda não tiveram o WhatsApp aberto.

   A lista vem pronta do servidor (GET /api/laudos/envio-whatsapp), com o telefone do cadastro
   dono do laudo: o Atendimento não recebe os registros de vistoria em /api/docs, então não dá
   para casar laudo e cadastro aqui no navegador como a Gerência fazia.

   "Enviado" quer dizer "WhatsApp aberto" — o sistema não vê se a pessoa apertou enviar. */
const FILTROS_ENVIO = [
  ["pendentes", "A enviar"],
  ["enviados", "Já abertos"],
  ["todos", "Todos"],
];

function dataHora(v) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function semAcento(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function AbaEnvioLaudo({ apiFetch, token, notify }) {
  const [laudos, setLaudos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState("pendentes");
  const [busca, setBusca] = useState("");

  const carregar = async () => {
    setCarregando(true);
    setErro("");
    try {
      const r = await apiFetch("/api/laudos/envio-whatsapp", { token });
      setLaudos(r.laudos || []);
    } catch (e) {
      setErro(e.message || "Não foi possível carregar os laudos.");
    }
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, []);

  /* O clique abre o WhatsApp na hora (é um <a>); aqui só marcamos a linha como aberta sem
     esperar o servidor, para ela sair de "A enviar" na mesma tela. */
  const marcarAberto = (docId) => {
    setLaudos((atual) => atual.map((l) => (l.doc_id === docId
      ? { ...l, whatsapp_aberto_em: new Date().toISOString(), whatsapp_detalhe: "Aberto agora por você", whatsapp_vezes: (l.whatsapp_vezes || 0) + 1 }
      : l)));
    notify?.("WhatsApp aberto — confira e aperte enviar na conversa.");
  };

  const pendentes = laudos.filter((l) => !l.whatsapp_aberto_em).length;
  const termo = semAcento(busca.trim());
  const visiveis = laudos
    .filter((l) => (filtro === "pendentes" ? !l.whatsapp_aberto_em : filtro === "enviados" ? !!l.whatsapp_aberto_em : true))
    .filter((l) => !termo || semAcento([l.cliente, l.cliente_nome, l.empreendimento, l.bloco_torre, l.apartamento].join(" ")).includes(termo));

  return (
    <section style={{ background: "#fff", border: "1px solid #D8DEE7", borderRadius: 14, padding: 20, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
        <h3 style={{ margin: 0, fontSize: 15, color: "#12335B", flex: 1 }}>
          📲 Envio de laudo pelo WhatsApp{pendentes > 0 ? ` · ${pendentes} a enviar` : ""}
        </h3>
        <button type="button" className="btn-mini" onClick={carregar} disabled={carregando}>
          {carregando ? "Atualizando…" : "Atualizar"}
        </button>
      </div>
      <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 14px" }}>
        Laudos que a Gerência já aprovou. O e-mail com o PDF sai sozinho na aprovação; daqui você abre a
        conversa no WhatsApp do cliente com a mensagem pronta — é só conferir e enviar.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        {FILTROS_ENVIO.map(([k, rotulo]) => (
          <button key={k} type="button" onClick={() => setFiltro(k)}
            style={{
              border: `1px solid ${filtro === k ? "#2C75B5" : "#d6dbe3"}`, background: filtro === k ? "#2C75B5" : "#fff",
              color: filtro === k ? "#fff" : "#4a5a70", borderRadius: 20, padding: "5px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
            }}>
            {rotulo}{k === "pendentes" ? ` (${pendentes})` : ""}
          </button>
        ))}
        <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente ou empreendimento"
          style={{ flex: "1 1 200px", minWidth: 0, border: "1px solid #d6dbe3", borderRadius: 8, padding: "7px 10px", fontSize: 13 }} />
      </div>

      {erro && <p style={{ color: "#C62828", fontSize: 13.5 }}>{erro}</p>}
      {carregando && !laudos.length && <p style={{ color: "#8593a8", fontSize: 14 }}>Carregando…</p>}
      {!carregando && !erro && visiveis.length === 0 && (
        <p style={{ color: "#8593a8", fontSize: 14 }}>
          {filtro === "pendentes" && !termo ? "Nenhum laudo esperando envio. 🎉" : "Nenhum laudo encontrado."}
        </p>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {visiveis.map((l) => {
          const aberto = !!l.whatsapp_aberto_em;
          const emailEnviado = !!l.email_enviado_em;
          return (
            <div key={l.doc_id} style={{ border: `1px solid ${aberto ? "#D8DEE7" : "#a5d6a7"}`, background: aberto ? "#fff" : "#F6FBF6", borderRadius: 10, padding: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{l.cliente_nome || l.cliente}</div>
                <div style={{ fontSize: 12.5, color: "#65758b" }}>
                  {[l.empreendimento, l.bloco_torre, l.apartamento].filter(Boolean).join(" · ")}
                  {l.aprovado_em ? ` · aprovado em ${dataHora(l.aprovado_em)}` : ""}
                </div>
                <div style={{ fontSize: 12, marginTop: 4, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ color: emailEnviado ? "#2E7D32" : "#B26A00" }}>
                    {emailEnviado ? "✉️ E-mail enviado" : "⚠️ E-mail não saiu"}
                  </span>
                  <span style={{ color: aberto ? "#2E7D32" : "#8593a8" }}>
                    {aberto
                      ? `✅ WhatsApp aberto${l.whatsapp_vezes > 1 ? ` ${l.whatsapp_vezes}x` : ""} · ${l.whatsapp_detalhe || dataHora(l.whatsapp_aberto_em)}`
                      : "WhatsApp ainda não enviado"}
                  </span>
                </div>
              </div>
              <span onClickCapture={(e) => { if (e.target.closest("a")) marcarAberto(l.doc_id); }}>
                <BotaoWhatsappLaudo
                  laudo={l}
                  cliente={{ nome: l.cliente_nome || l.cliente, telefone: l.cliente_telefone }}
                  emailEnviado={emailEnviado}
                  apiFetch={apiFetch} token={token}
                  rotulo={aberto ? "📲 Reenviar WhatsApp" : "📲 Enviar pelo WhatsApp"} />
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
