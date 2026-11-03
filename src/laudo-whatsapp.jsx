/* Laudo pelo WhatsApp do cliente, depois da aprovação da Gerência.

   É só um link click-to-chat (wa.me/<número>?text=<mensagem>): abre o WhatsApp de quem clicou
   com a conversa e o texto prontos, e quem envia de fato é a Gerência. Sem API da Meta, sem custo.
   O e-mail continua saindo pelo servidor como sempre — isto é um canal a mais, não substitui.

   O botão é um <a href> de verdade, e não window.open: o clique acontece depois do await da
   aprovação, e window.open fora do gesto do usuário é barrado pelo navegador como pop-up. */
import React from "react";
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
