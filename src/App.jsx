import React, { useState, useEffect, useRef, useMemo } from "react";
import * as Rascunho from "./rascunho-local.js";
import { listarAmbientes, paraItemDeLaudo, todasParaImportacao } from "./patologias-consulta.js";
import {
  FileText, Plus, Trash2, Camera, X, Printer, Save, FolderOpen,
  Building2, User, ClipboardList, ChevronDown, ChevronRight, ChevronLeft, Check,
  AlertTriangle, CircleAlert, Info, Copy, Sparkles, Loader2,
  ClipboardCheck, BarChart3, DollarSign, Users, Edit3, RefreshCcw, Filter, LayoutGrid, Star,
  TrendingUp, Percent, Send, CalendarDays, Eye, Mail, EyeOff, UserCheck, UserX, Search, Lock, Bell,
  ExternalLink, Undo2, Handshake, ShoppingCart, Minus
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

/* Caminho da logo montado a partir da base do site: na raiz (Netlify/Vercel) vira
   "/logo-...png" e no GitHub Pages, "/fn-edificacoes-frontend/logo-...png". Caminho
   absoluto fixo quebrava no Pages, que serve o site dentro de uma subpasta. */
const LOGO_URL = `${import.meta.env.BASE_URL}logo-fn-transparente.png`;

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

/* Registra um acesso ao sistema, uma vez por aba do navegador (por área). O identificador é
   aleatório e mora só no navegador da pessoa — serve para separar "acessos" de "visitantes",
   nunca para identificar alguém. Se der qualquer problema, apenas não conta: o acesso do
   usuário nunca pode quebrar por causa da métrica. */
function registrarAcesso(area) {
  try {
    const chaveSessao = `fn_acesso_registrado:${area}`;
    if (sessionStorage.getItem(chaveSessao)) return;
    let visitanteId = localStorage.getItem("fn_visitante_id");
    if (!visitanteId) {
      visitanteId = crypto.randomUUID?.() || `v_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem("fn_visitante_id", visitanteId);
    }
    sessionStorage.setItem(chaveSessao, "1");
    apiFetch("/api/acessos", { method: "POST", body: { visitanteId, area } }).catch(() => {});
  } catch { /* navegador sem storage (aba anônima restrita, etc.) — só não conta */ }
}

/* Converte um registro de Documentação vindo do banco (snake_case) para o formato usado no app (camelCase) */
function mapDocDaApi(d) {
  return {
    id: d.id, cliente: d.cliente || "", cpf: d.cpf || "", empreendimento: d.empreendimento || "",
    blocoTorre: d.bloco_torre || "", data: d.data || "", hora: d.hora || "",
    pagamento: d.pagamento || "Pendente", valorVistoria: d.valor_vistoria ?? 0, valorTrt: d.valor_trt ?? 0,
    vistoria: d.vistoria || "Agendada", art: d.art || "Não solicitada", tipoArt: d.tipo_art || "Individual",
    relatorio: d.relatorio || "Pendente", observacoes: d.observacoes || "",
    status: d.status || "Agendado", statusCliente: d.status_cliente || "Agendado",
    vistoriadorId: d.vistoriador_id || null, atualizadoEm: d.atualizado_em || d.atualizadoEm || null,
    statusProducao: d.status_producao || "Recebido",
  };
}
/* Converte um cadastro de Cliente vindo do banco (snake_case) para o formato usado no app (camelCase) */
function mapClienteDaApi(c) {
  return {
    id: c.id, nome: c.nome || "", cpf: c.cpf || "", telefone: c.telefone || "", email: c.email || "",
    construtora: c.construtora || "", empreendimento: c.empreendimento || "", blocoTorre: c.bloco_torre || "", endereco: c.endereco || "",
    servico: c.servico || "", dataDesejada: c.data_desejada || "", horarioDesejado: c.horario_desejado || "",
    observacoes: c.observacoes || "", atendido: !!c.atendido,
    status: c.status || "Em análise", cep: c.cep || "", vistoriadorId: c.vistoriador_id || "",
    precisaCadastroEmpreendimento: !!c.precisa_cadastro_empreendimento,
    pagamento: c.pagamento || "Pendente", areaPrivativa: c.area_privativa || "",
    encaminhadoDocumentacao: !!c.encaminhado_documentacao,
  };
}
/* Etapa atual de um cliente no fluxo completo (cadastro → análise → vistoria → laudo → feedback).
   Antes de existir um "docs" pra esse CPF, quem manda é cliente.status (Em análise/Agendamento
   aprovado/Vistoria agendada). Depois que a vistoria é finalizada, o docs.statusCliente assume
   (Agendado/Laudo em análise/Laudo enviado por e-mail) — cliente.status não é mais tocado. */
function etapaAtualCliente(cliente, docs = []) {
  const cpfLimpo = (cliente.cpf || "").replace(/\D/g, "");
  const doc = cpfLimpo ? docs.find((d) => (d.cpf || "").replace(/\D/g, "") === cpfLimpo) : null;
  if (doc) return doc.statusCliente || "Agendado";
  return cliente.status || "Em análise";
}
/* As 4 etapas operacionais do fluxo de vistoria, na ordem em que acontecem. Diferente de
   etapaAtualCliente (que detalha também o pós-vistoria: laudo, e-mail), aqui o objetivo é
   só responder "quantas vistorias estão em cada fase do trabalho de campo". */
const ETAPAS_VISTORIA = ["Solicitação de vistoria", "Vistoria agendada", "Em vistoria", "Vistoriado"];
function etapaVistoriaCliente(cliente, docs = []) {
  // Documentação ART/TRT não tem vistoria — fica fora deste fluxo (vai direto pra Documentação).
  if (ehServicoDocumentacao(cliente)) return null;
  const cpfLimpo = (cliente.cpf || "").replace(/\D/g, "");
  const doc = cpfLimpo ? docs.find((d) => (d.cpf || "").replace(/\D/g, "") === cpfLimpo) : null;
  // Assim que existe um doc, a vistoria já foi finalizada pelo técnico e virou laudo.
  if (doc) return "Vistoriado";
  if (cliente.status === "Em vistoria") return "Em vistoria";
  if (cliente.status === "Vistoria agendada") return "Vistoria agendada";
  if (cliente.status === "Cancelado" || cliente.status === "Cancelamento solicitado") return null;
  return "Solicitação de vistoria";
}
/* Converte um registro de preço de vistoria por empreendimento vindo do banco (snake_case) */
function mapPrecoDaApi(p) {
  return {
    id: p.id, empreendimento: p.empreendimento || "",
    precoVistoria: Number(p.preco_vistoria) || 0,
    precoDocumentacao: Number(p.preco_documentacao) || 0,
    custoVistoria: Number(p.custo_vistoria) || 0,
    atualizadoEm: p.atualizado_em || null,
  };
}
/* Mascara um CPF/CNPJ deixando visível só o início e o fim (ex.: 123.***.***-45) */
function mascararCpf(cpf) {
  const digitos = (cpf || "").replace(/\D/g, "");
  if (digitos.length !== 11) return cpf || "—";
  return `${digitos.slice(0, 3)}.***.***-${digitos.slice(9)}`;
}
const LOGO_FN_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAAEsCAYAAAB5fY51AAAKMWlDQ1BJQ0MgUHJvZmlsZQAAeJydlndUU9kWh8+9N71QkhCKlNBraFICSA29SJEuKjEJEErAkAAiNkRUcERRkaYIMijggKNDkbEiioUBUbHrBBlE1HFwFBuWSWStGd+8ee/Nm98f935rn73P3Wfvfda6AJD8gwXCTFgJgAyhWBTh58WIjYtnYAcBDPAAA2wA4HCzs0IW+EYCmQJ82IxsmRP4F726DiD5+yrTP4zBAP+flLlZIjEAUJiM5/L42VwZF8k4PVecJbdPyZi2NE3OMErOIlmCMlaTc/IsW3z2mWUPOfMyhDwZy3PO4mXw5Nwn4405Er6MkWAZF+cI+LkyviZjg3RJhkDGb+SxGXxONgAoktwu5nNTZGwtY5IoMoIt43kA4EjJX/DSL1jMzxPLD8XOzFouEiSniBkmXFOGjZMTi+HPz03ni8XMMA43jSPiMdiZGVkc4XIAZs/8WRR5bRmyIjvYODk4MG0tbb4o1H9d/JuS93aWXoR/7hlEH/jD9ld+mQ0AsKZltdn6h21pFQBd6wFQu/2HzWAvAIqyvnUOfXEeunxeUsTiLGcrq9zcXEsBn2spL+jv+p8Of0NffM9Svt3v5WF485M4knQxQ143bmZ6pkTEyM7icPkM5p+H+B8H/nUeFhH8JL6IL5RFRMumTCBMlrVbyBOIBZlChkD4n5r4D8P+pNm5lona+BHQllgCpSEaQH4eACgqESAJe2Qr0O99C8ZHA/nNi9GZmJ37z4L+fVe4TP7IFiR/jmNHRDK4ElHO7Jr8WgI0IABFQAPqQBvoAxPABLbAEbgAD+ADAkEoiARxYDHgghSQAUQgFxSAtaAYlIKtYCeoBnWgETSDNnAYdIFj4DQ4By6By2AE3AFSMA6egCnwCsxAEISFyBAVUod0IEPIHLKFWJAb5AMFQxFQHJQIJUNCSAIVQOugUqgcqobqoWboW+godBq6AA1Dt6BRaBL6FXoHIzAJpsFasBFsBbNgTzgIjoQXwcnwMjgfLoK3wJVwA3wQ7oRPw5fgEVgKP4GnEYAQETqiizARFsJGQpF4JAkRIauQEqQCaUDakB6kH7mKSJGnyFsUBkVFMVBMlAvKHxWF4qKWoVahNqOqUQdQnag+1FXUKGoK9RFNRmuizdHO6AB0LDoZnYsuRlegm9Ad6LPoEfQ4+hUGg6FjjDGOGH9MHCYVswKzGbMb0445hRnGjGGmsVisOtYc64oNxXKwYmwxtgp7EHsSewU7jn2DI+J0cLY4X1w8TogrxFXgWnAncFdwE7gZvBLeEO+MD8Xz8MvxZfhGfA9+CD+OnyEoE4wJroRIQiphLaGS0EY4S7hLeEEkEvWITsRwooC4hlhJPEQ8TxwlviVRSGYkNimBJCFtIe0nnSLdIr0gk8lGZA9yPFlM3kJuJp8h3ye/UaAqWCoEKPAUVivUKHQqXFF4pohXNFT0VFysmK9YoXhEcUjxqRJeyUiJrcRRWqVUo3RU6YbStDJV2UY5VDlDebNyi/IF5UcULMWI4kPhUYoo+yhnKGNUhKpPZVO51HXURupZ6jgNQzOmBdBSaaW0b2iDtCkVioqdSrRKnkqNynEVKR2hG9ED6On0Mvph+nX6O1UtVU9Vvuom1TbVK6qv1eaoeajx1UrU2tVG1N6pM9R91NPUt6l3qd/TQGmYaYRr5Grs0Tir8XQObY7LHO6ckjmH59zWhDXNNCM0V2ju0xzQnNbS1vLTytKq0jqj9VSbru2hnaq9Q/uE9qQOVcdNR6CzQ+ekzmOGCsOTkc6oZPQxpnQ1df11Jbr1uoO6M3rGelF6hXrtevf0Cfos/ST9Hfq9+lMGOgYhBgUGrQa3DfGGLMMUw12G/YavjYyNYow2GHUZPTJWMw4wzjduNb5rQjZxN1lm0mByzRRjyjJNM91tetkMNrM3SzGrMRsyh80dzAXmu82HLdAWThZCiwaLG0wS05OZw2xljlrSLYMtCy27LJ9ZGVjFW22z6rf6aG1vnW7daH3HhmITaFNo02Pzq62ZLde2xvbaXPJc37mr53bPfW5nbse322N3055qH2K/wb7X/oODo4PIoc1h0tHAMdGx1vEGi8YKY21mnXdCO3k5rXY65vTW2cFZ7HzY+RcXpkuaS4vLo3nG8/jzGueNueq5clzrXaVuDLdEt71uUnddd457g/sDD30PnkeTx4SnqWeq50HPZ17WXiKvDq/XbGf2SvYpb8Tbz7vEe9CH4hPlU+1z31fPN9m31XfKz95vhd8pf7R/kP82/xsBWgHcgOaAqUDHwJWBfUGkoAVB1UEPgs2CRcE9IXBIYMj2kLvzDecL53eFgtCA0O2h98KMw5aFfR+OCQ8Lrwl/GGETURDRv4C6YMmClgWvIr0iyyLvRJlESaJ6oxWjE6Kbo1/HeMeUx0hjrWJXxl6K04gTxHXHY+Oj45vipxf6LNy5cDzBPqE44foi40V5iy4s1licvvj4EsUlnCVHEtGJMYktie85oZwGzvTSgKW1S6e4bO4u7hOeB28Hb5Lvyi/nTyS5JpUnPUp2Td6ePJninlKR8lTAFlQLnqf6p9alvk4LTduf9ik9Jr09A5eRmHFUSBGmCfsytTPzMoezzLOKs6TLnJftXDYlChI1ZUPZi7K7xTTZz9SAxESyXjKa45ZTk/MmNzr3SJ5ynjBvYLnZ8k3LJ/J9879egVrBXdFboFuwtmB0pefK+lXQqqWrelfrry5aPb7Gb82BtYS1aWt/KLQuLC98uS5mXU+RVtGaorH1futbixWKRcU3NrhsqNuI2ijYOLhp7qaqTR9LeCUXS61LK0rfb+ZuvviVzVeVX33akrRlsMyhbM9WzFbh1uvb3LcdKFcuzy8f2x6yvXMHY0fJjpc7l+y8UGFXUbeLsEuyS1oZXNldZVC1tep9dUr1SI1XTXutZu2m2te7ebuv7PHY01anVVda926vYO/Ner/6zgajhop9mH05+x42Rjf2f836urlJo6m06cN+4X7pgYgDfc2Ozc0tmi1lrXCrpHXyYMLBy994f9Pdxmyrb6e3lx4ChySHHn+b+O31w0GHe4+wjrR9Z/hdbQe1o6QT6lzeOdWV0iXtjusePhp4tLfHpafje8vv9x/TPVZzXOV42QnCiaITn07mn5w+lXXq6enk02O9S3rvnIk9c60vvG/wbNDZ8+d8z53p9+w/ed71/LELzheOXmRd7LrkcKlzwH6g4wf7HzoGHQY7hxyHui87Xe4Znjd84or7ldNXva+euxZw7dLI/JHh61HXb95IuCG9ybv56Fb6ree3c27P3FlzF3235J7SvYr7mvcbfjT9sV3qID0+6j068GDBgztj3LEnP2X/9H686CH5YcWEzkTzI9tHxyZ9Jy8/Xvh4/EnWk5mnxT8r/1z7zOTZd794/DIwFTs1/lz0/NOvm1+ov9j/0u5l73TY9P1XGa9mXpe8UX9z4C3rbf+7mHcTM7nvse8rP5h+6PkY9PHup4xPn34D94Tz+6TMXDkAAF1dSURBVHja7Z13mFxV+YDfe++0nd2d7T3bUja990pogdCLIqKoIIhIEVFR8YcIgoqKCoqCgIBKESmhBQKEhFRI72177216ueX3x8xOdrMlbRMSOO/z5AHC7G177zvfOfc73yfpum4gEAgEpwGyuAQCgUAISyAQCISwBAKBEJZAIBAIYQkEAoEQlkAgEAhhCQQCISyBQCAQwhIIBEJYAoFAIIQlEAgEQlgCgUAghCUQCISwBAKBQAhLIBAIhLAEAoEQlkAgEAhhCQQCgRCWQCAQwhIIBAIhLIFAIBDCEggEQlgCgUAghCUQCARCWAKBQAhLIBAIhLAEAoFACEsgEAhhCQQCgRCWQCAQCGEJBAIhLIFAIBDCEggEAiEsgUAghCUQCARCWAKBQCCEJRAIhLAEAoFACEsgEAiEsAQCgRCWQCAQCGEJBAIhLIFAIBDCEggEAiEsgUAghCUQCARCWAKBQAhLIBAIhLAEAoFACEsgEAiEsAQCgUAISyAQCGEJBAKBEJZAIBDCEggEAiEsgUAgEMISCARCWAKBQCCEJRAIBEJYAoFACEsgEAiEsAQCgUAISyAQCISwBAKBQAhLIBAIhLAEAoFACEsgEAiEsAQCgUAISyAQCISwBAKBQAhLIBAIYQkEAoEQlkAgEAhhCQQCISyBQCAQwhIIBAIhLIFAIBDCEggEAiEsgUAghCUQCARCWAKBQCCEJRAIhLAEAoFACEsgEAiEsAQCgUAISyAQCISwBAKBQAhLIBAIYQkEAoEQlkAgEAhhCQQCgRCWQCAQwhIIBAIhLIFAIBDCEggEAiEsgUAghCUQCARCWAKBQAhLIBAIhLAEAoFACEsgEAhhCQQCgRCWQCAQCGEJBAIhLIFAIBDCEggEAiEsgUAghCUQCARCWAKBQAhLIBAIhLAEAoFACEsgEAhhCQQCgRCWQCAQCGEJBAIhLIFAIBDCEggEAiEsgUAghCUQCARCWAKBQAhLIBAIhLAEAoFACEsgEAhhCQQCgRCWQCAQCGEJBAIhLIFAIBDCEggEAiEsgUAghCUQCARCWAKBQAhLIBAIhLAEAoFACEsgEAhhCQQCgRCWQCAQCGEJBAIhLIFAIBDCEggEAiEsgUAghCUQCARCWAKBQCCEJRAIhLAEAoFACEsgEAiEsAQCgRCWQCAQCGEJBAKBEJZAIBDCEggEAiEsgUAgEMISCARCWAKBQCCEJRAIBEJYAoFACEsgEAiEsAQCgUAISyAQCGEJBAKBEJZAIBDCEpdAIBAIYQkEAoEQlkAgEMISCAQCISyBQCAQwhIIBEJYAoFAIIQlEAgEQlgCgUAISyAQCISwBAKBQAhLIBAIYQkEAoEQlkAgEAhhCQQCISyBQCAQwhIIBAIhLIFAIIQlEAgEQlgCgUAghCUQCISwBAKBQAhLIBAIhLAEAoEQlkAgEAhhCQQCgRCWQCAQwhIIBIITxP8DbxemZMbnTXYAAAAASUVORK5CYII=";

/* ---------- Banco de Patologias (autopreenchimento) ---------- */
const BANCO = {
  rejunte: {
    label: "Rejunte",
    categoria: "Revestimento cerâmico",
    norma: "ABNT NBR 13753:1996 — assentamento e rejuntamento",
    sev: "Média",
    desc: "Verifica-se a execução irregular e desuniforme do rejuntamento cerâmico, apresentando falhas de preenchimento, variação de espessura e acabamento inadequado nas juntas entre as peças.",
    rec: "Recomenda-se a remoção do rejunte comprometido e a reaplicação com produto adequado, garantindo preenchimento uniforme, alinhamento e vedação das juntas conforme boas práticas construtivas.",
  },
  pintura: {
    label: "Pintura",
    categoria: "Pintura e gesso",
    norma: "ABNT NBR 13245:2011 — execução de pinturas",
    sev: "Baixa",
    desc: "Verifica-se acabamento de pintura executado de forma irregular e desuniforme, com presença de manchas, variação de tonalidade, escorrimentos e cobertura insuficiente da superfície.",
    rec: "Recomenda-se a correção do substrato e a reaplicação da pintura em demãos uniformes, assegurando cobertura homogênea e acabamento conforme especificação do memorial descritivo.",
  },
  gesso: {
    label: "Gesso / Forro",
    categoria: "Pintura e gesso",
    norma: "ABNT NBR 13867:1997 — revestimento interno com gesso",
    sev: "Média",
    desc: "Verifica-se a execução irregular do revestimento em gesso, apresentando fissuras superficiais, desníveis e acabamento desuniforme nas juntas e emendas.",
    rec: "Recomenda-se o tratamento das juntas, a correção dos desníveis e a regularização do acabamento, garantindo planicidade e uniformidade da superfície.",
  },
  silicone: {
    label: "Silicone / Vedação",
    categoria: "Impermeabilização",
    norma: "ABNT NBR 15575-1:2021 — estanqueidade à água",
    sev: "Média",
    desc: "Verifica-se aplicação irregular de silicone/vedante, com cordão descontínuo, excesso de material e falhas de aderência que comprometem a estanqueidade da junta.",
    rec: "Recomenda-se a remoção do vedante existente e a reaplicação de cordão contínuo e uniforme, assegurando a estanqueidade e o acabamento adequado da junta.",
  },
  porta: {
    label: "Portas / Fechaduras",
    categoria: "Esquadrias e vidros",
    norma: "ABNT NBR 15930-2:2022 — portas de madeira",
    sev: "Média",
    desc: "Verifica-se funcionamento inadequado do conjunto de porta, apresentando desalinhamento, folga excessiva e/ou fechadura com acionamento irregular.",
    rec: "Recomenda-se o ajuste do batente e das dobradiças, bem como a regulagem ou substituição da fechadura, garantindo o correto funcionamento e travamento.",
  },
  alizar: {
    label: "Alizares / Guarnições",
    categoria: "Esquadrias e vidros",
    norma: "ABNT NBR 15930-2:2022 — acabamento e fixação",
    sev: "Baixa",
    desc: "Verifica-se instalação irregular dos alizares/guarnições, com desalinhamento, frestas e fixação inadequada em relação ao vão.",
    rec: "Recomenda-se o reassentamento das guarnições, corrigindo o alinhamento e a fixação, com vedação das frestas remanescentes.",
  },
  esquadria: {
    label: "Esquadrias",
    categoria: "Esquadrias e vidros",
    norma: "ABNT NBR 10821-2:2017 — esquadrias externas",
    sev: "Média",
    desc: "Verifica-se irregularidade na instalação da esquadria, com aplicação inadequada de PU/vedação ao redor do vão, folgas e acabamento comprometido.",
    rec: "Recomenda-se a correção da fixação e da vedação perimetral da esquadria, assegurando estanqueidade, alinhamento e funcionamento adequado das folhas.",
  },
  vidro: {
    label: "Vidros",
    categoria: "Esquadrias e vidros",
    norma: "ABNT NBR 7199:2016 — vidros na construção civil",
    sev: "Média",
    desc: "Verifica-se a presença de vidro trincado/riscado e/ou fixação inadequada, com folgas nos baguetes e comprometimento da vedação.",
    rec: "Recomenda-se a substituição da peça danificada e a correção da fixação e vedação, conforme especificação técnica.",
  },
  pedra: {
    label: "Pedras / Bancadas",
    categoria: "Pedras e bancadas",
    norma: "ABNT NBR 15844:2015 — rochas ornamentais",
    sev: "Média",
    desc: "Verifica-se dano na superfície da pedra (bancada/soleira/peitoril), com trincas, lascas ou riscos que comprometem a integridade e o acabamento.",
    rec: "Recomenda-se o reparo ou a substituição da peça comprometida, garantindo nivelamento, acabamento e adequada fixação.",
  },
  vazamento: {
    label: "Vazamentos",
    categoria: "Hidrossanitário",
    norma: "ABNT NBR 5626:2020 — estanqueidade de peças de utilização",
    sev: "Alta",
    desc: "Verifica-se a ocorrência de vazamento na instalação hidráulica, evidenciado por umidade, gotejamento e/ou manchas nas superfícies adjacentes ao ponto.",
    rec: "Recomenda-se a identificação e correção imediata do ponto de vazamento, com teste de estanqueidade e recuperação das áreas afetadas.",
  },
  registro: {
    label: "Registros / Metais",
    categoria: "Hidrossanitário",
    norma: "ABNT NBR 5626:2020 — instalação de água fria",
    sev: "Média",
    desc: "Verifica-se funcionamento inadequado do registro/metal sanitário, apresentando vazamento, dificuldade de acionamento e/ou fixação insuficiente.",
    rec: "Recomenda-se o ajuste, reaperto ou substituição do componente, assegurando vedação e correto funcionamento.",
  },
  sifao: {
    label: "Sifões",
    categoria: "Hidrossanitário",
    norma: "ABNT NBR 8160:1999 — esgoto sanitário predial",
    sev: "Média",
    desc: "Verifica-se instalação inadequada do sifão, com ausência de fecho hídrico eficiente e/ou vazamentos nas conexões.",
    rec: "Recomenda-se a correção da instalação do sifão, garantindo a vedação das conexões e o adequado fecho hídrico.",
  },
  ralo: {
    label: "Ralos",
    categoria: "Hidrossanitário",
    norma: "ABNT NBR 8160:1999 — coleta e condução de efluentes",
    sev: "Média",
    desc: "Verifica-se execução irregular ao redor do ralo, com caimento inadequado, rejunte deficiente e/ou vedação comprometida, favorecendo o acúmulo de água.",
    rec: "Recomenda-se a correção do caimento e da vedação ao redor do ralo, assegurando o adequado escoamento e a estanqueidade da região.",
  },
  quadro: {
    label: "Quadro Elétrico",
    categoria: "Elétrico",
    norma: "ABNT NBR 5410:2004 — instalações elétricas de baixa tensão",
    sev: "Alta",
    desc: "Verifica-se irregularidade no quadro de distribuição, com identificação insuficiente dos circuitos, fixação inadequada e/ou ausência de dispositivos de proteção conforme previsto.",
    rec: "Recomenda-se a adequação do quadro elétrico, com identificação dos circuitos e verificação dos dispositivos de proteção conforme as normas vigentes.",
  },
  tomada: {
    label: "Tomadas / Interruptores",
    categoria: "Elétrico",
    norma: "ABNT NBR 5410:2004 — dispositivos de tomada",
    sev: "Média",
    desc: "Verifica-se instalação inadequada de tomada/interruptor, com fixação insuficiente, desalinhamento e/ou funcionamento irregular.",
    rec: "Recomenda-se a correção da fixação e a verificação do funcionamento do dispositivo, assegurando conformidade e segurança da instalação.",
  },
  ferrugem: {
    label: "Ferrugem / Oxidação",
    categoria: "Serralheria e metais",
    norma: "ABNT NBR 15575-1:2021 — durabilidade dos componentes",
    sev: "Média",
    desc: "Verifica-se a presença de processo de oxidação/ferrugem em elemento metálico, com comprometimento superficial e risco de evolução do quadro.",
    rec: "Recomenda-se o tratamento da superfície oxidada, com remoção da ferrugem e aplicação de proteção anticorrosiva adequada.",
  },
  fissura: {
    label: "Fissuras",
    categoria: "Vedações e estrutura",
    norma: "ABNT NBR 15575-4:2021 — fissuras em vedações verticais",
    sev: "Média",
    desc: "Verifica-se a presença de fissuras no revestimento/alvenaria, com abertura reduzida, decorrentes de acomodação e/ou movimentação dos elementos construtivos.",
    rec: "Recomenda-se o monitoramento e o tratamento das fissuras com material adequado, prevenindo infiltrações e a evolução do quadro patológico.",
  },
  trinca: {
    label: "Trincas",
    categoria: "Vedações e estrutura",
    norma: "ABNT NBR 15575-4:2021 — desempenho de vedações verticais",
    sev: "Alta",
    desc: "Verifica-se a presença de trincas com abertura significativa no elemento construtivo, indicando possível esforço estrutural ou movimentação relevante.",
    rec: "Recomenda-se avaliação técnica específica para identificação da causa, com posterior tratamento e monitoramento da manifestação.",
  },
  infiltracao: {
    label: "Infiltrações",
    categoria: "Impermeabilização",
    norma: "ABNT NBR 9575:2010 — projeto de impermeabilização",
    sev: "Alta",
    desc: "Verifica-se a ocorrência de infiltração, evidenciada por manchas de umidade, eflorescências e/ou desprendimento de revestimento na região afetada.",
    rec: "Recomenda-se a identificação da origem da infiltração e a execução dos reparos de impermeabilização, com recuperação das áreas comprometidas.",
  },
  impermeabilizacao: {
    label: "Impermeabilização",
    categoria: "Impermeabilização",
    norma: "ABNT NBR 9574:2008 — execução de impermeabilização",
    sev: "Alta",
    desc: "Verifica-se deficiência na impermeabilização da área, com sinais de umidade e comprometimento da estanqueidade do sistema.",
    rec: "Recomenda-se a revisão e/ou refação da impermeabilização conforme o sistema especificado, garantindo a estanqueidade da área.",
  },
  outro: { label: "Outro (personalizado)", categoria: "Outros", norma: "", sev: "Média", desc: "Verifica-se ", rec: "Recomenda-se " },
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
  imovel: { construtora: "", empreendimento: "", endereco: "", unidade: "", descricao: "", tipologia: "", areaPrivativa: "" },
  /* Vazio de propósito: antes vinha fixo com o nome e o registro profissional (CFT) de uma
     pessoa específica, atribuídos a toda vistoria — mesmo as feitas por outro técnico. Quem
     está fazendo a vistoria preenche o próprio nome/qualificação/registro em "Dados do
     imóvel vistoriado"; o nome já vem sugerido a partir do login (ver AppInterno). */
  rt: { nome: "", qualificacao: "", registro: "" },
  vistoria: { data: "", inicio: "", termino: "", presentes: "", cidade: "Paulista - PE", ambientesVistoriados: "" },
  textos: { ...TEXTOS_PADRAO },
  fotoCliente: null, // foto do vistoriador com o cliente (opcional) — aparece na última página do laudo e na página de acompanhamento do cliente
};

const sevMeta = {
  Baixa: { cor: "#2E7D32", bg: "#E6F4EA", icon: Info },
  Média: { cor: "#B26A00", bg: "#FFF4E0", icon: CircleAlert },
  Alta: { cor: "#C62828", bg: "#FCEAEA", icon: AlertTriangle },
};

/* ---- Banco de patologias (agora editável, vem da API — ver src/patologias.js no backend).
   Estas duas funções fazem localmente o mesmo filtro que antes vinha pronto de
   patologias-consulta.js, só que sobre o array que a API devolve em vez do arquivo estático. */
function patologiasPorAmbiente(bancos, slug) {
  return bancos
    .filter((p) => !p.escopoUnidadeInteira && (p.aplicaTodosAmbientes || (p.ambientes || []).includes(slug)))
    .map((p) => ({ ...p, especificaDoAmbiente: (p.ambientes || []).includes(slug) }))
    .sort((a, b) => {
      if (a.especificaDoAmbiente !== b.especificaDoAmbiente) return a.especificaDoAmbiente ? -1 : 1;
      const peso = { Alta: 0, Média: 1, Baixa: 2 };
      return (peso[a.severidade] ?? 1) - (peso[b.severidade] ?? 1);
    });
}
function patologiasUnidadeInteira(bancos) {
  return bancos.filter((p) => p.escopoUnidadeInteira);
}

let idCounter = 1;
/* Campos "categoria", "norma", "titulo" e "status" atendem o modelo novo de laudo:
   os três primeiros vêm prontos do BANCO ao escolher a patologia; o status nasce
   "pendente" e serve para acompanhar a construtora corrigindo (ver revistoria). */
/* Situação de cada não conformidade — enum exigido pelo modelo de laudo. Marcar como
   "corrigido" faz o índice de conformidade subir, o que permite reusar o mesmo laudo
   para acompanhar a construtora ao longo dos reparos. */
const STATUS_ITEM_OPCOES = [
  { valor: "pendente", label: "Pendente" },
  { valor: "corrigido", label: "Corrigido" },
  { valor: "reincidente", label: "Reincidente" },
];

const novoItem = () => ({ id: idCounter++, local: "", tipo: "", patologia: "", categoria: "", norma: "",
  titulo: "", status: "pendente", severidade: "Média", descricao: "", recomendacao: "", fotos: [] });

/* ---------- Documentação / Gerência (registro de vistorias e TRT) ---------- */

const PAGAMENTO_OPCOES = ["Pendente", "Pago", "Parcial"];
const VISTORIA_OPCOES = ["Agendada", "Concluída", "Cancelada"];
const TIPO_ART_OPCOES = ["Individual", "Coletiva"];

/* ---------- Status do CLIENTE (status_cliente) — sempre automático, nunca editado manualmente ----------
   O cliente NUNCA vê status internos de gerência/documentação (STATUS_INTERNO_OPCOES abaixo).
   Antes de existir um "docs", quem manda é clientes.status: "Em análise" (cadastro acabou de
   chegar, aguardando o Atendimento aprovar) -> "Agendado" (Atendimento aprovou o agendamento).
   Depois que a vistoria é finalizada, o docs.status_cliente assume: "Agendado" -> "Laudo em análise"
   quando o vistoriador finaliza a vistoria (POST /api/vistoria/finalizar) -> "Laudo enviado por
   e-mail" quando a gerência aprova (POST /api/docs/:id/aprovar, que já gera o PDF e envia o e-mail). */
const STATUS_ATENDIMENTO_OPCOES = ["Em análise", "Agendado", "Vistoria realizada", "Laudo enviado por e-mail"];
/* Documentação ART/TRT tem fluxo próprio (sem vistoria): ver STATUS_DOC_* no backend. */
const STATUS_DOC_PROCESSANDO = "Elaborando";
const STATUS_DOC_CONCLUIDA = "Documentação pronta";
const TIPOS_DOCUMENTO_ART = ["Documentação assinada", "Placa de identificação de obra"];
const STATUS_ATENDIMENTO_INFO = {
  "Em análise": "Recebemos seu cadastro e ele está em análise pelo nosso setor de Atendimento. Em breve confirmaremos seu agendamento.",
  "Agendado": "Recebemos sua solicitação e sua vistoria está agendada. Em breve nossa equipe entrará em contato.",
  "Vistoria realizada": "Sua vistoria foi realizada com sucesso. Estamos finalizando seu laudo e avisaremos assim que ele for enviado.",
  "Laudo enviado por e-mail": "Seu laudo foi aprovado e enviado para o e-mail cadastrado. Verifique sua caixa de entrada (e o spam).",
  [STATUS_DOC_PROCESSANDO]: "Recebemos seu cadastro e sua documentação ART/TRT está sendo elaborada pela nossa equipe técnica.",
  [STATUS_DOC_CONCLUIDA]: "Sua documentação está pronta! Confirme seu e-mail no botão abaixo para baixar os dois arquivos: a documentação assinada e a placa de identificação de obra.",
};
/* ---------- Status INTERNO (docs.status) — uso exclusivo da equipe (Documentação/Gerência),
   nunca mostrado ao cliente. Precisa bater exatamente com STATUS_ATENDIMENTO_VALIDOS do backend. */
const STATUS_INTERNO_OPCOES = ["Agendado", "Em vistoria", "Laudo em elaboração", "Laudo pronto"];

/* ---------- Perfis de acesso (agora definidos pelo backend/login, não escolhidos na tela) ----------
   vistoriador   -> só enxerga o módulo Laudos (não vê Documentação nem Gerência)
   documentacao  -> só enxerga o módulo Documentação
   atendimento   -> enxerga Clientes (cadastro, agendamento, acompanhamento, aprovação) e Agendamento
                    (aprova agendamento/feedback — item 3.24; substitui o antigo perfil "comercial")
   qualidade     -> enxerga o módulo Agendamento (chave interna "qualidade"), mas só leitura (não
                    aprova nada — isso agora é exclusivo do Atendimento; ver "podeAgir" nos
                    componentes de Agendamento)
   vendas        -> só enxerga Parceiros e Afiliados: analisa/aprova cadastros, acompanha cupons
                    (vales) e cadastra parceiro manualmente. NÃO calcula nem controla comissão
                    individual de vendedor — vendedor recebe fixo, fora do sistema (ajuste de
                    modelo comercial, ver ROLE_DESCRICAO.vendas). Reaproveita o mesmo componente
                    que a Gerência já usava (AbaGerenciaParceiros), sem duplicar tela.
   gerencia      -> acesso restrito, mas enxerga tudo (incl. financeiro)
   O cadastro/acompanhamento de Cliente em si continua sendo uma tela pública separada, sem login.
------------------------------------------------------------------ */
const MODULOS_POR_PERFIL = {
  vistoriador: ["laudos"],
  documentacao: ["documentacao"],
  atendimento: ["clientes", "qualidade", "vendas"],
  qualidade: ["qualidade"],
  vendas: ["vendas"],
  gerencia: ["laudos", "documentacao", "gerencia", "clientes", "qualidade"],
};
const PERFIL_LABEL = { vistoriador: "Vistoriador", documentacao: "Documentação", atendimento: "Atendimento", qualidade: "Agendamento", vendas: "Vendas", gerencia: "Gerência" };

/* ---------- Cor fixa por técnico (vistoriador) no calendário do Agendamento ----------
   Não existe campo "cor"/"sigla" cadastrado no técnico (nem no front, nem no backend).
   Pra não inventar campo novo no banco, a cor é calculada de forma determinística a
   partir do id do vistoriador — nunca sorteada — então a mesma pessoa sempre recebe a
   mesma cor em qualquer dia. A paleta tem só as 5 cores testadas p/ contraste 4.5:1 com
   texto branco; com mais de 5 técnicos ela se repete (ver aviso na tela de Usuários). */
const PALETA_TECNICOS = ["#2159C7", "#0F7259", "#B85E10", "#6E36BE", "#C01F52"];
function hashTexto(txt) {
  let h = 0;
  const s = String(txt ?? "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function corDoTecnico(id) {
  return PALETA_TECNICOS[hashTexto(id) % PALETA_TECNICOS.length];
}
/* Sigla de até 2 letras a partir do nome (ex.: "Carlos Mendes" -> "CM"). Sempre exibida
   junto da cor — acessibilidade: quem não distingue cor lê a sigla (nunca cor sozinha). */
function siglaDoNome(nome) {
  const partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "—";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

const novoRegistroDoc = () => ({
  id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  cliente: "", cpf: "", empreendimento: "", blocoTorre: "", data: "", hora: "",
  pagamento: "Pendente", valorVistoria: "", valorTrt: "",
  vistoria: "Agendada", art: "Não solicitada", tipoArt: "Individual",
  relatorio: "Pendente", observacoes: "",
  status: "Agendado", atualizadoEm: null,
  statusProducao: "Recebido",
});
const STATUS_PRODUCAO_OPCOES = ["Recebido", "Em produção", "Realizado"];

/* ---------- Cliente (autocadastro e acompanhamento) ---------- */
const SERVICO_OPCOES = ["Vistoria de entrega de chaves", "Documentação ART/TRT", "Outro"];
/* Documentação ART/TRT não passa por vistoria: o cadastro vai direto para a área de
   Documentação, sem aprovação nem agendamento no setor de Agendamento. */
/* Horário comercial de atendimento: 07:00 às 18:00, de meia em meia hora. O cliente escolhe
   numa lista em vez de digitar, pra não marcar fora do expediente. */
const HORARIOS_COMERCIAIS = (() => {
  const lista = [];
  for (let h = 7; h <= 18; h++) {
    lista.push(`${String(h).padStart(2, "0")}:00`);
    if (h !== 18) lista.push(`${String(h).padStart(2, "0")}:30`);
  }
  return lista;
})();

/* Nome: só letras (com acento) e espaço, sempre em maiúsculas. */
const somenteLetras = (v) => (v || "").replace(/[^A-Za-zÀ-ÿ\s]/g, "").toUpperCase();

/* Sugestões de e-mail: completa o domínio a partir do que a pessoa já digitou. */
const DOMINIOS_EMAIL = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com.br", "icloud.com", "bol.com.br", "uol.com.br", "live.com"];
function sugestoesEmail(valor) {
  const v = (valor || "").trim();
  if (!v) return [];
  const [usuario, dominioParcial = ""] = v.split("@");
  if (!usuario) return [];
  const candidatos = v.includes("@")
    ? DOMINIOS_EMAIL.filter((d) => d.startsWith(dominioParcial.toLowerCase()))
    : DOMINIOS_EMAIL;
  return candidatos.map((d) => `${usuario}@${d}`).slice(0, 6);
}

const SERVICO_DOCUMENTACAO = SERVICO_OPCOES[1];
const ehServicoDocumentacao = (c) => c?.servico === SERVICO_DOCUMENTACAO;

/* Etapa usada na aba Clientes: as mesmas 4 etapas dos "Indicadores do Agendamento", mais
   as situações que ficam fora do fluxo de vistoria (documentação ART/TRT e cancelamentos).
   Sem esses extras, esses cadastros sumiriam da lista — aqui a visão precisa ser completa. */
const ETAPAS_CLIENTE = [...ETAPAS_VISTORIA, SERVICO_DOCUMENTACAO, "Cancelamento solicitado", "Cancelado"];

/* Fluxo do ponto de vista do técnico, na agenda dele. "Concluída" só depois que ele manda o
   laudo pra gerência — começar a vistoria não conclui nada. */
const ETAPAS_TECNICO = ["Agendada", "Em vistoria", "Concluída"];
function etapaTecnico(item) {
  if (item?.laudo_enviado) return "Concluída";
  if (item?.status === "Em vistoria") return "Em vistoria";
  return "Agendada";
}
function etapaClienteCompleta(cliente, docs = []) {
  if (ehServicoDocumentacao(cliente)) return SERVICO_DOCUMENTACAO;
  if (cliente.status === "Cancelamento solicitado") return "Cancelamento solicitado";
  if (cliente.status === "Cancelado") return "Cancelado";
  return etapaVistoriaCliente(cliente, docs) || "Solicitação de vistoria";
}

const novoCadastroCliente = () => ({
  id: `cli_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  nome: "", cpf: "", telefone: "", email: "", senha: "",
  construtora: "", empreendimento: "", blocoTorre: "", endereco: "", cep: "",
  servico: SERVICO_OPCOES[0], dataDesejada: "", horarioDesejado: "", areaPrivativa: "", observacoes: "",
  atendido: false,
  criadoEm: new Date().toISOString(),
});

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

/* Soma horas a um horário "HH:MM", devolvendo também "HH:MM" (usado para sugerir o término
   da vistoria a partir do horário desejado pelo cliente — continua editável depois). */
function somarHora(hhmm, horas) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const total = (h * 60 + m + horas * 60 + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/* ---------- Validação de CPF (dígitos verificadores) ----------
   Confere se o CPF é matematicamente válido, sem consultar nada: os dois últimos dígitos
   são calculados a partir dos nove primeiros. Pega erro de digitação e número inventado.
   NÃO diz se o CPF existe na Receita nem de quem é — isso exige convênio e não é público. */
function cpfValido(cpf) {
  const d = String(cpf || "").replace(/\D/g, "");
  if (d.length !== 11) return false;
  // 111.111.111-11 e afins passam na conta dos digitos, mas nao sao CPFs validos.
  if (new RegExp("^(\\d)\\1{10}$").test(d)) return false;

  const digito = (ateIndice) => {
    let soma = 0;
    let peso = ateIndice + 2;
    for (let i = 0; i < ateIndice + 1; i++) soma += Number(d[i]) * peso--;
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(8) === Number(d[9]) && digito(9) === Number(d[10]);
}

/* ---------- Busca de endereço pelo CEP (ViaCEP) ----------
   Serviço público e gratuito dos Correios, sem chave de acesso. Se estiver fora do ar ou o
   CEP não existir, devolve null e o cliente simplesmente digita o endereço à mão — a busca
   nunca pode impedir o cadastro. */
async function buscarEnderecoPorCep(cep) {
  const limpo = String(cep || "").replace(/\D/g, "");
  if (limpo.length !== 8) return null;
  try {
    const resp = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
    if (!resp.ok) return null;
    const d = await resp.json();
    if (d?.erro) return null;
    const partes = [d.logradouro, d.bairro, [d.localidade, d.uf].filter(Boolean).join("/")].filter(Boolean);
    return { endereco: partes.join(", "), cidade: d.localidade || "", uf: d.uf || "" };
  } catch { return null; }
}

/* ---------- Monta o objeto que o modelo novo de laudo consome ----------
   Estrutura documentada em modelo-laudo/AUTOMACAO.md: o modelo recebe este objeto e
   refaz sozinho capa, indicadores, gráficos, quadro-resumo, fichas e conclusão. Aqui só
   traduzimos o que o sistema já tem — nada de total, índice ou percentual, que o próprio
   modelo calcula. */
const SEVERIDADE_PARA_MODELO = { "Baixa": "baixa", "Média": "media", "Alta": "alta" };

function formatarDataPorExtenso(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

/* Protocolo legível e estável: FN-ano-mêsdia-unidade (ex.: FN-2026-0725-A602). */
function gerarProtocolo(dados) {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mesDia = `${String(hoje.getMonth() + 1).padStart(2, "0")}${String(hoje.getDate()).padStart(2, "0")}`;
  const unidade = (dados?.imovel?.unidade || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6);
  return `FN-${ano}-${mesDia}${unidade ? `-${unidade}` : ""}`;
}

function montarLaudoModelo(dados = {}, itens = []) {
  const imovel = dados.imovel || {};
  const vistoria = dados.vistoria || {};
  const contratante = dados.contratante || {};
  const rt = dados.rt || {};
  const paraHora = (h) => (h ? h.replace(":", "h") : "");

  return {
    protocolo: gerarProtocolo(dados),
    dataEmissao: formatarDataPorExtenso(new Date().toISOString().slice(0, 10)),
    local: vistoria.cidade || "",
    proprietario: contratante.nome || "",
    cpf: contratante.cpf || "",
    construtora: imovel.construtora || "",
    empreendimento: imovel.empreendimento || "",
    endereco: imovel.endereco || "",
    unidade: imovel.unidade || "",
    tipologia: imovel.tipologia || "",
    areaPrivativa: imovel.areaPrivativa || "",
    dataVistoria: vistoria.data ? vistoria.data.split("-").reverse().join("/") : "",
    horaInicio: paraHora(vistoria.inicio),
    horaFim: paraHora(vistoria.termino),
    presentes: vistoria.presentes || "",
    ambientesVistoriados: Number(vistoria.ambientesVistoriados) || 0,
    /* Esta linha faltava, e era a causa de a foto com o cliente sumir do laudo: o técnico
       anexava a foto, o envio exigia ela e o PDF do backend a desenhava — mas a prévia da
       tela (e qualquer impressão pelo navegador) montava o laudo sem o campo. O gêmeo desta
       função no backend (laudo-modelo.js) sempre teve. */
    fotoCliente: dados.fotoCliente || "",
    responsavel: { nome: rt.nome || "", qualificacao: rt.qualificacao || "", registro: rt.registro || "" },
    itens: itens.map((item, i) => ({
      n: String(i + 1).padStart(2, "0"),
      ambiente: item.local || "",
      categoria: item.categoria || "",
      severidade: SEVERIDADE_PARA_MODELO[item.severidade] || "media",
      status: item.status || "pendente",
      // Sem título preenchido, cai no nome da patologia — o modelo exige a linha.
      titulo: (item.titulo || item.patologia || "").trim(),
      descricao: item.descricao || "",
      recomendacao: item.recomendacao || "",
      norma: item.norma || "",
      fotos: item.fotos || [],
    })),
  };
}

/* ---------- Indicadores do laudo (regras do modelo, ver modelo-laudo/AUTOMACAO.md) ----------
   Nada aqui e digitado pelo tecnico: tudo sai dos itens. Funcao pura, para poder ser
   conferida sem abrir a tela. */
const PESO_SEVERIDADE = { alta: 3, media: 2, baixa: 1 };
const REFERENCIA_ICC_PADRAO = 120;

const FAIXAS_ICC = [
  { min: 85, label: "Conforme", cor: "#2E7D32", bg: "#E6F4EA" },
  { min: 70, label: "Conformidade parcial", cor: "#B26A00", bg: "#FFF4E0" },
  { min: 50, label: "Requer reparos", cor: "#C25E00", bg: "#FFEDD9" },
  { min: 0, label: "Crítico", cor: "#C62828", bg: "#FCEAEA" },
];
const ROTULO_SEVERIDADE = { alta: "Alta", media: "Média", baixa: "Baixa" };
const ROTULO_STATUS = { pendente: "Pendente", corrigido: "Corrigido", reincidente: "Reincidente" };

function calcularIndicadoresLaudo(laudo, referenciaIcc = REFERENCIA_ICC_PADRAO) {
  const itens = laudo?.itens || [];
  const porSeveridade = { alta: 0, media: 0, baixa: 0 };
  const porAmbiente = {};
  const porCategoria = {};
  let corrigidos = 0;

  itens.forEach((i) => {
    if (porSeveridade[i.severidade] !== undefined) porSeveridade[i.severidade] += 1;
    const amb = (i.ambiente || "").trim() || "(sem ambiente)";
    const cat = (i.categoria || "").trim() || "(sem categoria)";
    porAmbiente[amb] = (porAmbiente[amb] || 0) + 1;
    porCategoria[cat] = (porCategoria[cat] || 0) + 1;
    if (i.status === "corrigido") corrigidos += 1;
  });

  // So o que ainda nao foi corrigido pontua — e o que faz o indice subir na revistoria.
  const pontos = itens.reduce((soma, i) => soma + (i.status === "corrigido" ? 0 : (PESO_SEVERIDADE[i.severidade] || 0)), 0);
  const ref = Number(referenciaIcc) || REFERENCIA_ICC_PADRAO;
  const icc = Math.max(0, Math.min(100, Math.round(100 - (pontos / ref) * 100)));
  const faixa = FAIXAS_ICC.find((f) => icc >= f.min) || FAIXAS_ICC[FAIXAS_ICC.length - 1];
  const ordenar = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]);

  return {
    total: itens.length,
    porSeveridade,
    porAmbiente: ordenar(porAmbiente),
    porCategoria: ordenar(porCategoria),
    corrigidos,
    pendentes: itens.length - corrigidos,
    ambientesAfetados: Object.keys(porAmbiente).length,
    ambientesVistoriados: Number(laudo?.ambientesVistoriados) || 0,
    pontos,
    icc,
    faixa,
  };
}

/* Paragrafo de abertura da conclusao, montado a partir dos numeros. */
function textoConclusaoLaudo(ind) {
  if (ind.total === 0) return "A vistoria não identificou não conformidades aparentes nos ambientes verificados.";
  const partes = [];
  if (ind.porSeveridade.alta) partes.push(`${ind.porSeveridade.alta} de severidade alta`);
  if (ind.porSeveridade.media) partes.push(`${ind.porSeveridade.media} de severidade média`);
  if (ind.porSeveridade.baixa) partes.push(`${ind.porSeveridade.baixa} de severidade baixa`);
  const distribuicao = partes.length ? `, sendo ${partes.join(", ").replace(/, ([^,]*)$/, " e $1")}` : "";
  const ambientes = ind.ambientesVistoriados
    ? ` distribuídas em ${ind.ambientesAfetados} dos ${ind.ambientesVistoriados} ambientes vistoriados`
    : ` distribuídas em ${ind.ambientesAfetados} ambiente(s)`;
  const sanadas = ind.corrigidos
    ? (ind.corrigidos === 1 ? " Até o momento, 1 já foi sanada." : ` Até o momento, ${ind.corrigidos} já foram sanadas.`)
    : "";
  return `A vistoria identificou ${ind.total} não conformidade(s)${distribuicao}${ambientes}.${sanadas}`;
}

/* Cancelar vistoria: a Gerência decide sozinha, então cancela na hora. Os outros perfis
   pedem, e a Gerência confirma depois — ver CardCancelamentosPendentes. */
async function cancelarVistoria({ cliente, ehGerencia, updCliente, notify }) {
  if (ehGerencia) {
    await updCliente(cliente.id, { status: "Cancelado" });
    notify("Vistoria cancelada ✓");
  } else {
    await updCliente(cliente.id, { status: "Cancelamento solicitado" });
    notify("Cancelamento solicitado à gerência");
  }
}

/* ================= Laudo no modelo novo =================
   Reconstruído dentro do sistema (em vez de usar o arquivo do modelo, que depende do
   runtime de autoria). Mesma estrutura: capa, sumário com indicadores e ICC, gráficos,
   quadro-resumo, fichas com duas fotos e conclusão. Impressão A4 pelo CSS de print. */

function BarraProporcao({ rotulo, valor, total, cor }) {
  const pct = total ? Math.round((valor / total) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
      <span style={{ fontSize: 10.5, color: "#4a5a70", width: 130, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rotulo}</span>
      <div style={{ flex: 1, height: 9, background: "#EEF1F5", borderRadius: 5, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: cor || AZUL_MEDIO, borderRadius: 5 }} />
      </div>
      <strong style={{ fontSize: 10.5, width: 22, textAlign: "right" }}>{valor}</strong>
    </div>
  );
}

function CartaoIndicador({ titulo, valor, apoio, cor }) {
  return (
    <div style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: "10px 12px", flex: 1, minWidth: 110 }}>
      <div style={{ fontSize: 9.5, color: "#8593a8", textTransform: "uppercase", letterSpacing: .4, marginBottom: 3 }}>{titulo}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: cor || AZUL_MARINHO, lineHeight: 1 }}>{valor}</div>
      {apoio && <div style={{ fontSize: 10, color: "#65758b", marginTop: 3 }}>{apoio}</div>}
    </div>
  );
}

function LaudoModelo({ laudo, assinatura, assinaturaVistoriador, aprovado = true }) {
  const ind = calcularIndicadoresLaudo(laudo);
  /* Se a foto com o cliente não decodificar, a página final inteira some — no laudo do
     cliente não pode sobrar o ícone de imagem quebrada nem um quadro vazio. Mesma regra
     do PDF, que valida a imagem antes de criar a página (ver laudo-pdf.js). */
  const [fotoQuebrada, setFotoQuebrada] = useState(false);
  useEffect(() => { setFotoQuebrada(false); }, [laudo.fotoCliente]);
  const itens = laudo.itens || [];
  const corSeveridade = { alta: "#C62828", media: "#B26A00", baixa: "#2C75B5" };
  const corStatus = { pendente: "#B26A00", corrigido: "#2E7D32", reincidente: "#C62828" };
  const linha = { display: "flex", gap: 6, fontSize: 11.5, padding: "3px 0" };
  const chave = { color: "#65758b", width: 120, flexShrink: 0 };

  const Campo = ({ k, v }) => (v ? <div style={linha}><span style={chave}>{k}</span><strong style={{ fontWeight: 600 }}>{v}</strong></div> : null);

  return (
    <div className={`laudo-modelo${aprovado ? "" : " laudo-rascunho"}`} style={{ background: "#fff", color: "#1a2330" }}>
      {/* Só a Gerência emite o laudo oficial. Antes da aprovação, qualquer impressão sai
          marcada — não dá para impedir o Ctrl+P do navegador, mas dá para deixar claro
          que aquele papel não é o documento final. */}
      {!aprovado && (
        <div className="laudo-aviso-rascunho">
          Versão preliminar — aguardando aprovação da Gerência. Não vale como laudo oficial.
        </div>
      )}

      {/* ---------- Capa ---------- */}
      <section className="laudo-pagina">
        <div style={{ display: "flex", alignItems: "center", gap: 12, borderBottom: `3px solid ${AZUL_MARINHO}`, paddingBottom: 12 }}>
          <img src={LOGO_URL} alt="FN Edificações" style={{ height: 54 }} />
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: AZUL_MARINHO }}>FN Edificações</div>
            <div style={{ fontSize: 11, color: "#65758b" }}>Engenharia diagnóstica e vistorias</div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right", fontSize: 10.5, color: "#65758b" }}>
            <div>Protocolo</div>
            <strong style={{ fontFamily: "monospace", fontSize: 12, color: AZUL_MARINHO }}>{laudo.protocolo}</strong>
          </div>
        </div>

        <h1 style={{ fontSize: 26, color: AZUL_MARINHO, margin: "26px 0 4px", letterSpacing: -.5 }}>Laudo Técnico de Vistoria</h1>
        <div style={{ fontSize: 13, color: "#65758b", marginBottom: 22 }}>Vistoria de entrega de chaves</div>

        <div style={{ background: CINZA_CLARO, borderRadius: 12, padding: 16, marginBottom: 18 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: AZUL_MARINHO }}>{laudo.empreendimento || "—"}</div>
          {laudo.unidade && <div style={{ fontSize: 13.5, color: "#4a5a70", marginTop: 2 }}>{laudo.unidade}</div>}
        </div>

        <Campo k="Proprietário" v={laudo.proprietario} />
        <Campo k="CPF/CNPJ" v={laudo.cpf} />
        <Campo k="Construtora" v={laudo.construtora} />
        <Campo k="Endereço" v={laudo.endereco} />
        <Campo k="Tipologia" v={laudo.tipologia} />
        <Campo k="Área privativa" v={laudo.areaPrivativa} />
        <Campo k="Data da vistoria" v={[laudo.dataVistoria, laudo.horaInicio && `das ${laudo.horaInicio}${laudo.horaFim ? ` às ${laudo.horaFim}` : ""}`].filter(Boolean).join(" · ")} />
        <Campo k="Emissão" v={laudo.dataEmissao} />

        <div style={{ marginTop: 26, paddingTop: 14, borderTop: `1px solid ${CINZA_BORDA}`, fontSize: 11.5 }}>
          <div style={{ color: "#65758b", marginBottom: 3 }}>Responsável técnico</div>
          <strong>{laudo.responsavel?.nome}</strong>
          <div style={{ color: "#4a5a70" }}>{laudo.responsavel?.qualificacao}</div>
          <div style={{ color: "#4a5a70" }}>{laudo.responsavel?.registro}</div>
        </div>
      </section>

      {/* ---------- Sumário executivo ---------- */}
      <section className="laudo-pagina">
        <h2 style={{ fontSize: 15, color: AZUL_MARINHO, borderBottom: `2px solid ${CINZA_CLARO}`, paddingBottom: 7, marginBottom: 14 }}>Sumário executivo</h2>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
          <CartaoIndicador titulo="Não conformidades" valor={ind.total} apoio={`${ind.pendentes} pendente(s)`} />
          <CartaoIndicador titulo="Severidade alta" valor={ind.porSeveridade.alta} cor={corSeveridade.alta} />
          <CartaoIndicador titulo="Severidade média" valor={ind.porSeveridade.media} cor={corSeveridade.media} />
          <CartaoIndicador titulo="Severidade baixa" valor={ind.porSeveridade.baixa} cor={corSeveridade.baixa} />
          <CartaoIndicador titulo="Ambientes afetados"
            valor={ind.ambientesVistoriados ? `${ind.ambientesAfetados}/${ind.ambientesVistoriados}` : ind.ambientesAfetados}
            apoio={ind.ambientesVistoriados ? "de vistoriados" : ""} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, background: ind.faixa.bg, borderRadius: 12, padding: "14px 16px", marginBottom: 20 }}>
          <div style={{ textAlign: "center", minWidth: 92 }}>
            <div style={{ fontSize: 34, fontWeight: 800, color: ind.faixa.cor, lineHeight: 1 }}>{ind.icc}</div>
            <div style={{ fontSize: 9.5, color: ind.faixa.cor, letterSpacing: .4 }}>ÍNDICE</div>
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: ind.faixa.cor }}>{ind.faixa.label}</div>
            <div style={{ fontSize: 11, color: "#4a5a70", marginTop: 3, maxWidth: 420 }}>
              Índice de Conformidade Construtiva. Calculado pelo peso das não conformidades ainda não sanadas
              (alta 3, média 2, baixa 1). Itens corrigidos deixam de pontuar e o índice sobe.
            </div>
          </div>
        </div>

        {ind.porAmbiente.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: AZUL_MARINHO, marginBottom: 7 }}>Por ambiente</div>
            {ind.porAmbiente.map(([nome, qtd]) => <BarraProporcao key={nome} rotulo={nome} valor={qtd} total={ind.total} />)}
          </div>
        )}

        {ind.porCategoria.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: AZUL_MARINHO, marginBottom: 7 }}>Por sistema construtivo</div>
            {ind.porCategoria.map(([nome, qtd]) => <BarraProporcao key={nome} rotulo={nome} valor={qtd} total={ind.total} cor="#5B7C99" />)}
          </div>
        )}
      </section>

      {/* ---------- Quadro-resumo ---------- */}
      {itens.length > 0 && (
        <section className="laudo-pagina">
          <h2 style={{ fontSize: 15, color: AZUL_MARINHO, borderBottom: `2px solid ${CINZA_CLARO}`, paddingBottom: 7, marginBottom: 12 }}>Quadro-resumo das não conformidades</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}>
            <thead>
              <tr style={{ background: CINZA_CLARO }}>
                {["#", "Ambiente", "Sistema", "Constatação", "Severidade", "Situação"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "6px 7px", color: AZUL_MARINHO, borderBottom: `2px solid ${CINZA_BORDA}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {itens.map((i) => (
                <tr key={i.n} style={{ borderBottom: `1px solid ${CINZA_BORDA}` }}>
                  <td style={{ padding: "5px 7px", fontFamily: "monospace" }}>{i.n}</td>
                  <td style={{ padding: "5px 7px" }}>{i.ambiente}</td>
                  <td style={{ padding: "5px 7px" }}>{i.categoria}</td>
                  <td style={{ padding: "5px 7px" }}>{i.titulo}</td>
                  <td style={{ padding: "5px 7px", color: corSeveridade[i.severidade], fontWeight: 700 }}>{ROTULO_SEVERIDADE[i.severidade]}</td>
                  <td style={{ padding: "5px 7px", color: corStatus[i.status], fontWeight: 600 }}>{ROTULO_STATUS[i.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ---------- Fichas ---------- */}
      {itens.map((i) => (
        <section key={i.n} className="laudo-ficha">
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 8 }}>
            <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 800, color: "#fff", background: AZUL_MARINHO, borderRadius: 6, padding: "2px 8px" }}>ITEM {i.n}</span>
            <strong style={{ fontSize: 12.5, color: AZUL_MARINHO }}>{i.ambiente}</strong>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              {i.categoria && <span style={{ fontSize: 9.5, border: `1px solid ${CINZA_BORDA}`, borderRadius: 20, padding: "2px 8px", color: "#4a5a70" }}>{i.categoria}</span>}
              <span style={{ fontSize: 9.5, borderRadius: 20, padding: "2px 8px", color: "#fff", background: corSeveridade[i.severidade], fontWeight: 700 }}>{ROTULO_SEVERIDADE[i.severidade]}</span>
              <span style={{ fontSize: 9.5, borderRadius: 20, padding: "2px 8px", color: "#fff", background: corStatus[i.status], fontWeight: 700 }}>{ROTULO_STATUS[i.status]}</span>
            </div>
          </div>

          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 9 }}>{i.titulo}</div>

          {(i.fotos || []).length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
              {(i.fotos || []).slice(0, 2).map((f, idx) => (
                <figure key={idx} style={{ margin: 0 }}>
                  <img src={f} alt={`Item ${i.n} — ${idx === 0 ? "visão geral" : "detalhe"}`}
                    style={{ width: "100%", height: 170, objectFit: "cover", borderRadius: 8, border: `1px solid ${CINZA_BORDA}` }} />
                  <figcaption style={{ fontSize: 9.5, color: "#8593a8", marginTop: 3 }}>{idx === 0 ? "Foto A — visão geral" : "Foto B — detalhe"}</figcaption>
                </figure>
              ))}
            </div>
          )}
          {/* Fotos além das duas principais entram menores, para nenhuma se perder. */}
          {(i.fotos || []).length > 2 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {(i.fotos || []).slice(2).map((f, idx) => (
                <img key={idx} src={f} alt={`Item ${i.n} — complementar ${idx + 1}`}
                  style={{ width: 104, height: 78, objectFit: "cover", borderRadius: 6, border: `1px solid ${CINZA_BORDA}` }} />
              ))}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <div style={{ fontSize: 9.5, color: "#8593a8", textTransform: "uppercase", letterSpacing: .4, marginBottom: 2 }}>Descrição técnica</div>
              <div style={{ fontSize: 11.5, lineHeight: 1.55 }}>{i.descricao}</div>
            </div>
            <div>
              <div style={{ fontSize: 9.5, color: "#8593a8", textTransform: "uppercase", letterSpacing: .4, marginBottom: 2 }}>Recomendação</div>
              <div style={{ fontSize: 11.5, lineHeight: 1.55 }}>{i.recomendacao}</div>
            </div>
          </div>

          {i.norma && (
            <div style={{ marginTop: 8, paddingTop: 7, borderTop: `1px solid ${CINZA_BORDA}`, fontSize: 10, color: "#65758b" }}>
              Referência normativa · {i.norma}
            </div>
          )}
        </section>
      ))}

      {/* ---------- Conclusão e assinaturas ---------- */}
      <section className="laudo-pagina">
        <h2 style={{ fontSize: 15, color: AZUL_MARINHO, borderBottom: `2px solid ${CINZA_CLARO}`, paddingBottom: 7, marginBottom: 12 }}>Conclusão</h2>
        <p style={{ fontSize: 12, lineHeight: 1.65, textAlign: "justify" }}>{textoConclusaoLaudo(ind)}</p>
        <p style={{ fontSize: 12, lineHeight: 1.65, textAlign: "justify" }}>
          O índice de conformidade apurado é de <strong>{ind.icc}</strong>, classificado como <strong>{ind.faixa.label}</strong>.
          Recomenda-se o encaminhamento das não conformidades à construtora para correção e posterior revistoria.
        </p>

        <div style={{ marginTop: 34, display: "flex", gap: 30, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 160, textAlign: "center" }}>
            {assinaturaVistoriador?.imagem && <img src={assinaturaVistoriador.imagem} alt="" style={{ height: 46, marginBottom: 4 }} />}
            <div style={{ borderTop: `1px solid ${AZUL_MARINHO}`, paddingTop: 5, fontSize: 11.5 }}>
              <strong>{laudo.responsavel?.nome}</strong>
              <div style={{ color: "#65758b", fontSize: 10.5 }}>{laudo.responsavel?.registro}</div>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 160, textAlign: "center" }}>
            {assinatura?.imagem && <img src={assinatura.imagem} alt="" style={{ height: 46, marginBottom: 4 }} />}
            <div style={{ borderTop: `1px solid ${AZUL_MARINHO}`, paddingTop: 5, fontSize: 11.5 }}>
              <strong>{assinatura?.nome || "Gerência FN Edificações"}</strong>
              <div style={{ color: "#65758b", fontSize: 10.5 }}>Gerência</div>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 160, textAlign: "center", alignSelf: "flex-end" }}>
            <div style={{ borderTop: `1px solid ${AZUL_MARINHO}`, paddingTop: 5, fontSize: 11.5 }}>
              <strong>{laudo.proprietario}</strong>
              <div style={{ color: "#65758b", fontSize: 10.5 }}>Proprietário(a)</div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 30, fontSize: 10, color: "#8593a8", textAlign: "center" }}>
          {laudo.local}{laudo.local && laudo.dataEmissao ? ", " : ""}{laudo.dataEmissao} · Protocolo {laudo.protocolo}
        </div>
      </section>

      {/* ---------- Página final: foto com o cliente ----------
          Só existe se houver foto — sem ela a página inteira some, em vez de sobrar um
          quadro vazio no documento. Espelha a última página do PDF (laudo-pdf.js). */}
      {laudo.fotoCliente && !fotoQuebrada && (
        <section className="laudo-pagina">
          <div style={{ background: AZUL_MARINHO, margin: "-28px -28px 0", padding: "22px 28px", textAlign: "center" }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>Agradecemos a confiança</div>
          </div>

          <div style={{ display: "grid", placeItems: "center", marginTop: 26 }}>
            {/* objectFit "contain" e não "cover": a foto é um retrato, cortar a borda corta rosto. */}
            <img
              src={laudo.fotoCliente}
              alt="Foto da vistoria com o cliente"
              onError={() => setFotoQuebrada(true)}
              style={{ maxWidth: "100%", maxHeight: 360, objectFit: "contain", borderRadius: 10, border: `1px solid ${CINZA_BORDA}` }}
            />
          </div>

          <div style={{ marginTop: 26, background: CINZA_CLARO, borderRadius: 9, padding: "14px 18px" }}>
            {[
              ["Cliente", laudo.proprietario],
              ["Vistoriador", laudo.responsavel?.nome],
              ["Data da vistoria", laudo.dataVistoria],
              ["Condomínio", laudo.empreendimento],
              ["Bloco / unidade", laudo.unidade],
            ].filter(([, v]) => (v || "").toString().trim()).map(([rotulo, valor]) => (
              <div key={rotulo} style={{ display: "flex", gap: 8, fontSize: 11.5, padding: "3px 0" }}>
                <span style={{ color: "#65758b", width: 120, flexShrink: 0 }}>{rotulo}</span>
                <strong style={{ fontWeight: 600 }}>{valor}</strong>
              </div>
            ))}
          </div>

          <p style={{ marginTop: 26, fontSize: 12, fontStyle: "italic", color: AZUL_MARINHO, textAlign: "center", lineHeight: 1.6 }}>
            Vistoria concluída com segurança, responsabilidade técnica e o compromisso da
            FN Edificações com a tranquilidade do cliente.
          </p>
        </section>
      )}
    </div>
  );
}

/* ================= Notificações da equipe =================
   Sino no cabeçalho mostrando o que espera ação de quem está logado. Cada perfil vê só o
   que é dele. Tudo sai dos dados que o sistema já carrega — não há consulta nova nem
   tabela de notificação: o que vale é o estado atual, então nada fica desatualizado. */
/* Depois de quantos dias um laudo parado na gerência vira cobrança. Três dias úteis é o que
   a equipe pratica hoje; está aqui em cima, num lugar só, para mudar sem caçar pelo código. */
const PRAZO_ANALISE_DIAS = 3;

function diasDesde(quando) {
  if (!quando) return 0;
  const d = new Date(quando);
  if (Number.isNaN(d.getTime())) return 0;
  return (Date.now() - d.getTime()) / 86400000;
}

function calcularNotificacoes({ perfil, clientes = [], laudosPendentes = [], avaliacoes = [], documentosArt = [], agendaVistoriador = [], meusLaudos = [], parceiros = [] }) {
  const itens = [];
  const hojeISO = paraChaveISO(new Date());

  /* --- Fila do Agendamento --- Atendimento e Gerência agem; o perfil Agendamento só
     acompanha, então recebe o mesmo aviso sem a marcação de urgência. */
  if (["atendimento", "gerencia", "qualidade"].includes(perfil)) {
    const podeAgir = perfil !== "qualidade";
    const aguardando = clientes.filter((c) => c.status === "Em análise" && !ehServicoDocumentacao(c));
    if (aguardando.length) {
      itens.push({
        id: "aprovacao", urgente: podeAgir,
        texto: `${aguardando.length} cliente(s) aguardando aprovação`,
        onde: { aba: "qualidade", sub: "analise" },
      });
    }
    const aprovados = clientes.filter((c) => c.status === "Agendamento aprovado");
    if (aprovados.length) {
      itens.push({
        id: "sem-tecnico",
        texto: `${aprovados.length} vistoria(s) sem técnico atribuído`,
        onde: { aba: "qualidade", sub: "vistoria" },
      });
    }
    const emVistoria = clientes.filter((c) => c.status === "Em vistoria");
    if (emVistoria.length) {
      itens.push({
        id: "em-vistoria",
        texto: `${emVistoria.length} vistoria(s) em andamento agora`,
        onde: { aba: "qualidade", sub: "vistoria" },
      });
    }
  }

  // --- Gerência: decisões que só ela pode tomar ---
  if (perfil === "gerencia") {
    if (laudosPendentes.length) {
      itens.push({
        id: "laudos", urgente: true,
        texto: `${laudosPendentes.length} laudo(s) aguardando sua aprovação`,
        onde: { aba: "gerencia", sub: "visao-geral" },
      });
    }
    /* Reenvio é retrabalho já analisado uma vez — merece aviso próprio, senão some no meio
       da fila junto com os laudos que a gerência nunca viu. */
    const reenviados = laudosPendentes.filter((l) => l.ehReenvio);
    if (reenviados.length) {
      itens.push({
        id: "reenviados", urgente: true,
        texto: `${reenviados.length} laudo(s) corrigido(s) e reenviado(s) para nova análise`,
        onde: { aba: "gerencia", sub: "visao-geral" },
      });
    }
    /* Arquivo que não subiu ao Drive impede o laudo de ser dado como finalizado, então
       precisa chegar à gerência — é ela quem reenvia. */
    const comErroDrive = laudosPendentes.filter((l) => l.drive?.comErro > 0);
    if (comErroDrive.length) {
      itens.push({
        id: "drive-erro", urgente: true,
        texto: `${comErroDrive.length} laudo(s) com erro de sincronização no Google Drive`,
        onde: { aba: "gerencia", sub: "visao-geral" },
      });
    }
    /* Laudo parado além do prazo. O limite é do fluxo, não do relógio de ninguém: passou de
       PRAZO_ANALISE_DIAS, a gerência é quem está segurando. */
    const parados = laudosPendentes.filter((l) => diasDesde(l.laudo_criado_em) > PRAZO_ANALISE_DIAS);
    if (parados.length) {
      itens.push({
        id: "parados", urgente: true,
        texto: `${parados.length} laudo(s) aguardando análise há mais de ${PRAZO_ANALISE_DIAS} dias`,
        onde: { aba: "gerencia", sub: "visao-geral" },
      });
    }
    const cancelamentos = clientes.filter((c) => c.status === "Cancelamento solicitado");
    if (cancelamentos.length) {
      itens.push({
        id: "cancelamentos", urgente: true,
        texto: `${cancelamentos.length} cancelamento(s) de vistoria para decidir`,
        onde: { aba: "gerencia", sub: "visao-geral" },
      });
    }
    const exclusoes = avaliacoes.filter((a) => a.exclusao_solicitada);
    if (exclusoes.length) {
      itens.push({
        id: "exclusoes",
        texto: `${exclusoes.length} exclusão(ões) de avaliação para decidir`,
        onde: { aba: "qualidade", sub: "feedback" },
      });
    }
  }

  // --- Parceiros novos aguardando homologação: sem isto, ninguém era avisado — o cadastro
  // só aparecia se alguém abrisse a aba "Parceiros" por conta própria e reparasse na tabela. ---
  if (["gerencia", "vendas", "atendimento"].includes(perfil)) {
    const aguardandoHomologacao = parceiros.filter((p) => p.status === "em_analise");
    if (aguardandoHomologacao.length) {
      itens.push({
        id: "parceiros-em-analise", urgente: true,
        texto: `${aguardandoHomologacao.length} parceiro(s) aguardando homologação`,
        // Gerência acessa parceiros dentro da própria aba (sub-nav); vendas/atendimento têm
        // uma aba própria "vendas" sem sub-nav — cada perfil precisa do destino certo.
        onde: perfil === "gerencia" ? { aba: "gerencia", sub: "parceiros" } : { aba: "vendas" },
      });
    }
  }

  // --- Documentação: ART/TRT sem os dois anexos ---
  if (perfil === "documentacao" || perfil === "gerencia") {
    const art = clientes.filter((c) => ehServicoDocumentacao(c) && c.status !== "Cancelado");
    const incompletos = art.filter((c) => {
      const meus = documentosArt.filter((d) => d.clienteId === c.id);
      return !TIPOS_DOCUMENTO_ART.every((t) => meus.some((d) => d.tipo === t));
    });
    if (incompletos.length) {
      itens.push({
        id: "art", urgente: true,
        texto: `${incompletos.length} documentação(ões) ART/TRT pendente(s)`,
        onde: { aba: "documentacao" },
      });
    }
  }

  // --- Vistoriador: a agenda dele ---
  if (perfil === "vistoriador") {
    const deHoje = agendaVistoriador.filter((a) => a.data_desejada === hojeISO && !a.laudo_enviado);
    if (deHoje.length) {
      itens.push({
        id: "hoje", urgente: true,
        texto: `${deHoje.length} vistoria(s) marcada(s) para hoje`,
        onde: { aba: "laudos", sub: "agenda" },
      });
    }
    const atrasadas = agendaVistoriador.filter((a) => a.data_desejada && a.data_desejada < hojeISO && !a.laudo_enviado);
    if (atrasadas.length) {
      itens.push({
        id: "atrasadas", urgente: true,
        texto: `${atrasadas.length} vistoria(s) de dias anteriores sem laudo enviado`,
        onde: { aba: "laudos", sub: "agenda" },
      });
    }
    const proximas = agendaVistoriador.filter((a) => a.data_desejada && a.data_desejada > hojeISO && !a.laudo_enviado);
    if (proximas.length) {
      itens.push({
        id: "proximas",
        texto: `${proximas.length} vistoria(s) agendada(s) para os próximos dias`,
        onde: { aba: "laudos", sub: "agenda" },
      });
    }

    /* Devolvido é a única coisa desta tela que está parada esperando o técnico. Antes ele
       não tinha como saber: no status voltado ao cliente, laudo devolvido e laudo intocado
       apareciam os dois como "Laudo em análise". */
    const devolvidos = meusLaudos.filter((l) => l.laudo_status === "devolvido_correcao");
    if (devolvidos.length) {
      itens.push({
        id: "devolvidos", urgente: true,
        texto: `${devolvidos.length} laudo(s) devolvido(s) pela gerência para correção`,
        onde: { aba: "laudos", sub: "realizados" },
      });
    }
    const aprovadosRecentes = meusLaudos.filter((l) =>
      ["aprovado", "laudo_finalizado", "enviado_cliente"].includes(l.laudo_status)
      && l.aprovado_em && diasDesde(l.aprovado_em) <= 3
    );
    if (aprovadosRecentes.length) {
      itens.push({
        id: "aprovados",
        texto: `${aprovadosRecentes.length} laudo(s) seu(s) aprovado(s) nos últimos dias`,
        onde: { aba: "laudos", sub: "realizados" },
      });
    }
    /* Foto que não subiu é problema do técnico saber: a vistoria fica sem registro
       fotográfico arquivado, e refazer depois é impossível — ele já saiu do imóvel. */
    const comFalhaDeFoto = meusLaudos.filter((l) => l.drive?.comErro > 0);
    if (comFalhaDeFoto.length) {
      itens.push({
        id: "fotos-falharam", urgente: true,
        texto: `${comFalhaDeFoto.length} laudo(s) com falha no envio de fotos`,
        onde: { aba: "laudos", sub: "realizados" },
      });
    }
  }

  return itens;
}

function SinoNotificacoes({ itens = [], onIr }) {
  const [aberto, setAberto] = useState(false);
  const urgentes = itens.filter((i) => i.urgente).length;

  return (
    <div style={{ position: "relative" }}>
      <button className={`btn-ghost${urgentes ? " sino-alerta" : ""}`} onClick={() => setAberto((v) => !v)}
        title={itens.length ? `${itens.length} aviso(s)` : "Nada pendente"}
        aria-label={`Notificações: ${itens.length} aviso(s)`}
        style={{
          position: "relative", padding: "6px 10px",
          // O cabeçalho é azul-escuro; sem forçar o branco, o ícone herda preto e some.
          color: "#fff",
          background: itens.length ? "rgba(255,255,255,.16)" : "transparent",
        }}>
        <Bell size={16} />
        {itens.length > 0 && (
          <span style={{
            position: "absolute", top: -3, right: -3, minWidth: 18, height: 18, padding: "0 4px",
            borderRadius: 10, background: urgentes ? "#E53935" : AZUL_MEDIO, color: "#fff",
            fontSize: 10.5, fontWeight: 800, display: "grid", placeItems: "center", lineHeight: 1,
            border: `2px solid ${AZUL_MARINHO}`, boxShadow: "0 1px 4px rgba(0,0,0,.3)",
          }}>
            {itens.length}
          </span>
        )}
      </button>

      {aberto && (
        <>
          {/* Camada invisível: clicar fora fecha o painel. */}
          <div onClick={() => setAberto(false)}
            style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{
            position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 41, width: 300,
            background: "#fff", color: "#1a2330", borderRadius: 12, border: `1px solid ${CINZA_BORDA}`,
            boxShadow: "0 10px 30px rgba(0,0,0,.16)", overflow: "hidden",
          }}>
            <div style={{ padding: "10px 13px", borderBottom: `1px solid ${CINZA_BORDA}`, fontSize: 13, fontWeight: 700, color: AZUL_MARINHO }}>
              Avisos
            </div>

            {itens.length === 0 && (
              <div style={{ padding: "16px 13px", fontSize: 13, color: "#65758b" }}>
                Nada pendente por aqui. ✓
              </div>
            )}

            {itens.map((i) => (
              <button key={i.id}
                onClick={() => { setAberto(false); onIr?.(i.onde); }}
                style={{
                  width: "100%", textAlign: "left", background: "none", border: "none",
                  borderBottom: `1px solid ${CINZA_CLARO}`, padding: "11px 13px", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 9, fontSize: 13,
                }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: i.urgente ? "#C62828" : AZUL_MEDIO, flexShrink: 0 }} />
                <span style={{ flex: 1, color: "#1a2330" }}>{i.texto}</span>
                <ChevronRight size={14} color="#8593a8" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ================= Trocar a própria senha =================
   Antes não existia: só a Gerência redefinia senha, o que obrigava ela a criar e comunicar a
   senha de cada pessoa (ficando sabendo dela), ninguém podia trocar depois, e se a própria
   Gerência esquecesse a dela não havia saída dentro do sistema. */
function ModalTrocarSenha({ token, onFechar, notify }) {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [repetir, setRepetir] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const salvar = async () => {
    setErro("");
    if (!atual || !nova) { setErro("Preencha a senha atual e a nova."); return; }
    if (nova.length < 8) { setErro("A nova senha precisa ter pelo menos 8 caracteres."); return; }
    if (nova !== repetir) { setErro("A nova senha e a repetição não são iguais."); return; }
    if (nova === atual) { setErro("A nova senha precisa ser diferente da atual."); return; }
    setSalvando(true);
    try {
      await apiFetch("/api/auth/trocar-senha", { method: "POST", token, body: { senhaAtual: atual, senhaNova: nova } });
      notify("Senha alterada ✓");
      onFechar();
    } catch (e) { setErro(e.message); }
    setSalvando(false);
  };

  return (
    <div className="no-print" style={overlay} onClick={onFechar}>
      <div style={{ ...modal, maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <strong>Alterar minha senha</strong>
          <button className="icon-btn" onClick={onFechar} aria-label="Fechar"><X size={16} /></button>
        </div>
        <div style={cell(true)}>
          <label style={lab}>Senha atual</label>
          <input style={inp} type="password" value={atual} onChange={(e) => setAtual(e.target.value)} autoFocus />
        </div>
        <div style={{ ...cell(true), marginTop: 10 }}>
          <label style={lab}>Nova senha</label>
          <input style={inp} type="password" value={nova} onChange={(e) => setNova(e.target.value)} placeholder="mínimo 8 caracteres" />
        </div>
        <div style={{ ...cell(true), marginTop: 10 }}>
          <label style={lab}>Repita a nova senha</label>
          <input style={inp} type="password" value={repetir} onChange={(e) => setRepetir(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && salvar()} />
        </div>
        {erro && <div style={{ marginTop: 12, background: "#FCEAEA", color: "#C62828", padding: "9px 12px", borderRadius: 8, fontSize: 12.5 }}>{erro}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO }} onClick={onFechar}>Cancelar</button>
          <button className="btn-solid" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar senha"}</button>
        </div>
      </div>
    </div>
  );
}

/* ================= Componente principal ================= */
/* ================= Login (equipe, clientes e parceiros) ================= */
function TelaLogin({ onLogin, onVoltar, onCadastroParceiro }) {
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
          <img src={LOGO_URL} alt="FN Edificações" style={{ height: "clamp(56px, 14vw, 72px)", width: "auto" }} />
        </div>
        <h2 style={{ textAlign: "center", color: AZUL_MARINHO, fontSize: 18, margin: "0 0 4px" }}>Entrar no sistema</h2>
        {/* A porta é a mesma para todo mundo: equipe, cliente e parceiro/filiado entram com
            e-mail e senha, e o papel gravado no login decide qual painel abre. Dizer só
            "equipe" aqui fazia parceiro e cliente acharem que a tela não era para eles. */}
        <p style={{ textAlign: "center", color: "#65758b", fontSize: 13, margin: "0 0 20px" }}>Acesso da equipe, clientes e parceiros FN</p>

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

        {/* Todo cliente já cadastrado (mesmo de antes de existir senha própria) já tem acesso
           liberado com a senha padrão — só falta ele saber disso, já que não existe mais uma
           tela separada de "primeiro acesso" pedindo pra criar a dele. */}
        <p style={{ textAlign: "center", color: "#8593a8", fontSize: 12, margin: "14px 0 0" }}>
          Primeiro acesso? Use o e-mail cadastrado e a senha <strong>12345678</strong> — você troca assim que entrar.
        </p>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 6, fontSize: 12.5 }}>
          <a href="https://wa.me/5581983061305" target="_blank" rel="noopener noreferrer" style={{ color: "#8593a8", textDecoration: "none" }}>
            Esqueci minha senha
          </a>
        </div>

        <button type="button" onClick={onVoltar} style={{ width: "100%", marginTop: 14, background: "none", border: "none", color: AZUL_MEDIO, fontSize: 13, cursor: "pointer" }}>
          ← Sou cliente e quero me cadastrar
        </button>

        {/* Parceiro/filiado se cadastra por aqui também. Antes o cadastro só existia atrás do
            link privado ?parceiro-cadastro=1, então quem chegava na tela de login não tinha
            por onde começar — e nem sabia que era nesta mesma tela que ele entra depois. */}
        <div style={{ borderTop: `1px solid ${CINZA_BORDA}`, marginTop: 16, paddingTop: 14, textAlign: "center" }}>
          <button type="button" onClick={onCadastroParceiro}
            style={{ background: "none", border: "none", color: AZUL_MARINHO, fontSize: 13, fontWeight: 700, cursor: "pointer", padding: 0 }}>
            Sou parceiro ou filiado e quero me cadastrar
          </button>
          <p style={{ color: "#8593a8", fontSize: 12, margin: "6px 0 0" }}>
            Já é parceiro? Entre com o mesmo e-mail e senha do cadastro.
          </p>
        </div>
      </div>
    </div>
  );
}

/* Tela do link enviado por e-mail (?criar-senha=<token>) — primeiro acesso do cliente ao
   portal, ou recuperação depois que a Gerência já reabriu o caminho (ver rota no backend). */
function TelaCriarSenhaCliente({ token, onConcluido }) {
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const confirmar = async () => {
    if (senha.length < 6) { setErro("A senha precisa ter no mínimo 6 caracteres."); return; }
    if (senha !== confirmacao) { setErro("As senhas não conferem."); return; }
    setErro(""); setEnviando(true);
    try {
      const r = await apiFetch("/api/clientes/confirmar-senha", { method: "POST", body: { token, senha } });
      onConcluido({ token: r.token, usuario: r.usuario });
    } catch (e) { setErro(e.message); }
    setEnviando(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: CINZA_CLARO, display: "grid", placeItems: "center", padding: 18, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "32px 30px", width: "100%", maxWidth: 380, boxShadow: "0 10px 30px rgba(18,51,91,.12)" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <img src={LOGO_URL} alt="FN Edificações" style={{ height: "clamp(56px, 14vw, 72px)", width: "auto" }} />
        </div>
        <h2 style={{ textAlign: "center", color: AZUL_MARINHO, fontSize: 18, margin: "0 0 4px" }}>Criar sua senha</h2>
        <p style={{ textAlign: "center", color: "#65758b", fontSize: 13, margin: "0 0 20px" }}>Portal do Cliente FN Edificações</p>

        <div style={cell(true)}>
          <label style={lab}>Nova senha</label>
          <input style={inp} type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoFocus />
        </div>
        <div style={{ ...cell(true), marginTop: 12 }}>
          <label style={lab}>Confirme a senha</label>
          <input style={inp} type="password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirmar()} />
        </div>

        {erro && (
          <div style={{ marginTop: 12, background: "#FCEAEA", color: "#C62828", padding: "9px 12px", borderRadius: 8, fontSize: 12.5 }}>{erro}</div>
        )}

        <button type="button" className="btn-solid" style={{ width: "100%", justifyContent: "center", marginTop: 18, padding: "11px" }} disabled={enviando} onClick={confirmar}>
          {enviando ? <><Loader2 size={15} className="spin" /> Salvando…</> : "Criar senha e entrar"}
        </button>
      </div>
    </div>
  );
}

/* ================= Portal público do cliente (sem login) ================= */
function PortalCliente({ onIrParaLogin, onLogin }) {
  const [toast, setToast] = useState("");
  const notify = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };

  return (
    <div style={{ minHeight: "100vh", background: CINZA_CLARO, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <header style={{ background: AZUL_MARINHO, color: "#fff" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 18px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: "clamp(36px, 9vw, 44px)", height: "clamp(36px, 9vw, 44px)", borderRadius: 9, background: "#fff", display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0 }}>
            <img src={LOGO_URL} alt="FN Edificações" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <div style={{ lineHeight: 1.1, flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>FN Edificações</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>Área do Cliente</div>
          </div>
          <button className="btn-ghost" onClick={onIrParaLogin}>Sou da equipe →</button>
        </div>
        {/* Acesso rápido às 3 áreas da FN Serviços direto na barra — sem precisar rolar
            até os blocos explicativos mais abaixo. */}
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 18px 14px", display: "flex", gap: 20, fontSize: 13, fontWeight: 700 }}>
          <a href="#solicitar-servico" style={{ color: "#fff", opacity: 0.85, textDecoration: "none" }}>Serviços FN</a>
          <a href="?pagina=fn-clube" style={{ color: "#fff", opacity: 0.85, textDecoration: "none" }}>FN Clube</a>
          <a href="?pagina=fn-home" style={{ color: "#fff", opacity: 0.85, textDecoration: "none" }}>FN Home</a>
        </div>
      </header>
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "22px 18px 80px" }}>
        {/* CTA principal, bem em cima: quem já é cliente não devia ter que rolar a página
            inteira do cadastro pra achar onde entrar. */}
        <button onClick={onIrParaLogin} style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          background: "#fff", color: AZUL_MARINHO, border: `2px solid ${AZUL_MARINHO}`, borderRadius: 14,
          padding: "18px 20px", marginBottom: 18, fontSize: 18, fontWeight: 800, cursor: "pointer",
        }}>
          <Lock size={20} /> SOU CLIENTE — ENTRAR
        </button>

        {/* FN Serviços é a marca guarda-chuva das 3 áreas: contratando um serviço técnico, o
            cliente também passa a ter acesso ao FN Clube e ao FN Home. A navegação entre elas
            fica só na barra azul do topo — sem repetir os blocos aqui embaixo. */}
        <div style={{ textAlign: "center", margin: "6px 0 26px" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: AZUL_MARINHO }}>FN Serviços</div>
          <p style={{ fontSize: 13.5, color: "#65758b", margin: "4px 0 0" }}>
            Contratando a FN, você não recebe apenas um serviço técnico — você passa a ter acesso a um ecossistema de benefícios para cuidar, reformar e equipar seu imóvel.
          </p>
        </div>

        <div id="solicitar-servico">
          <AbaCliente notify={notify} onLogin={onLogin} onIrParaLogin={onIrParaLogin} />
        </div>
      </main>
      <footer style={{ background: "#fff", borderTop: `1px solid ${CINZA_BORDA}`, padding: "22px 18px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", fontSize: 13 }}>
          <strong style={{ color: AZUL_MARINHO }}>Dúvidas? Fale conosco:</strong>
          <div style={{ marginTop: 8, display: "flex", gap: 20, flexWrap: "wrap" }}>
            <a href="https://wa.me/5581983061305" target="_blank" rel="noopener noreferrer" style={{ color: "#4a5a70", textDecoration: "none" }}>
              📱 WhatsApp: (81) 9 8306-1305
            </a>
            <a href="https://www.instagram.com/fn.edificacoes/" target="_blank" rel="noopener noreferrer" style={{ color: "#4a5a70", textDecoration: "none" }}>
              📸 Instagram: @fn.edificacoes
            </a>
          </div>
        </div>
      </footer>
      {toast && (
        <div className="no-print" style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: AZUL_MARINHO, color: "#fff", padding: "10px 18px", borderRadius: 10, fontSize: 13.5, boxShadow: "0 6px 20px rgba(0,0,0,.2)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}

/* ================= App: decide entre Portal do Cliente, Login e App interno ================= */
/* ---------- Sessão guardada no navegador ----------
   A sessão vivia só na memória da aba: qualquer F5 — sem querer, ou o navegador do celular
   reciclando a aba em segundo plano — derrubava o login e levava junto a vistoria em edição.
   sessionStorage resolve isso (sobrevive a F5/navegação) sem o risco do localStorage: fechou
   a aba ou o navegador, a sessão some sozinha — computador compartilhado não fica logado
   depois que a pessoa sai. Continua descartada sozinha quando o token vence (12h). */
const CHAVE_SESSAO = "fn_sessao";

function lerValidadeDoToken(token) {
  try {
    const payload = JSON.parse(atob(String(token).split(".")[0].replace(/-/g, "+").replace(/_/g, "/")));
    return Number(payload?.exp) || 0;
  } catch { return 0; }
}
function carregarSessaoSalva() {
  try {
    const bruto = window.sessionStorage.getItem(CHAVE_SESSAO);
    if (!bruto) return null;
    const s = JSON.parse(bruto);
    if (!s?.token || !s?.usuario) return null;
    // Token vencido não adianta: seria erro em toda chamada até a pessoa perceber.
    if (lerValidadeDoToken(s.token) <= Date.now()) {
      window.sessionStorage.removeItem(CHAVE_SESSAO);
      return null;
    }
    return s;
  } catch { return null; }
}
function guardarSessao(s) {
  try {
    if (s) window.sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(s));
    else window.sessionStorage.removeItem(CHAVE_SESSAO);
  } catch { /* navegador sem storage: segue só na memória, como era antes */ }
}

/* ---------- Carrinho de compras (marketplace de parceiros/afiliados) ----------
   localStorage de propósito (diferente da sessão de login): o carrinho não é dado sensível,
   e continuar disponível entre abas/depois de fechar o navegador é o comportamento esperado
   de um carrinho — perguntar de novo toda vez espantaria cliente no meio da escolha.
   Guardado por CPF/sessão nenhum: é por navegador mesmo, igual qualquer loja funciona sem
   login até a hora de fechar a compra. */
const CHAVE_CARRINHO = "fn_carrinho";
function lerCarrinho() {
  try {
    const bruto = window.localStorage.getItem(CHAVE_CARRINHO);
    const itens = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(itens) ? itens : [];
  } catch { return []; }
}
function gravarCarrinho(itens) {
  try { window.localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(itens)); } catch { /* sem storage, carrinho só dura a sessão da aba */ }
}
/* Hook usado em cada página que pode vender (vitrine, portfólio do parceiro, painel do
   cliente) — cada uma lê o mesmo localStorage ao montar; como nunca duas dessas páginas
   ficam montadas ao mesmo tempo (a navegação troca a página inteira), não precisa sincronizar
   entre componentes em tempo real. */
function useCarrinho() {
  const [itens, setItens] = useState(() => lerCarrinho());
  useEffect(() => { gravarCarrinho(itens); }, [itens]);

  const adicionar = (item) => setItens((atual) => {
    const existe = atual.find((i) => i.servicoId === item.servicoId);
    if (existe) {
      return atual.map((i) => i.servicoId === item.servicoId ? { ...i, quantidade: i.quantidade + 1 } : i);
    }
    return [...atual, { ...item, quantidade: 1 }];
  });
  const remover = (servicoId) => setItens((atual) => atual.filter((i) => i.servicoId !== servicoId));
  const alterarQuantidade = (servicoId, quantidade) => setItens((atual) => {
    if (quantidade <= 0) return atual.filter((i) => i.servicoId !== servicoId);
    return atual.map((i) => i.servicoId === servicoId ? { ...i, quantidade: Math.min(20, quantidade) } : i);
  });
  const esvaziar = () => setItens([]);
  const total = itens.reduce((s, i) => s + (Number(i.precoUnitario) || 0) * i.quantidade, 0);
  const quantidadeTotal = itens.reduce((s, i) => s + i.quantidade, 0);
  return { itens, adicionar, remover, alterarQuantidade, esvaziar, total, quantidadeTotal };
}

/* Botão do carrinho para o cabeçalho — usado em toda página que vende (vitrine pública,
   portfólio do parceiro, painel do cliente). */
function BotaoCarrinho({ quantidade, onClick }) {
  return (
    <button type="button" onClick={onClick} className="btn-ghost" style={{ position: "relative", padding: "8px 10px" }} title="Carrinho">
      <ShoppingCart size={16} />
      {quantidade > 0 && (
        <span style={{
          position: "absolute", top: -4, right: -4, background: "#C62828", color: "#fff",
          borderRadius: 999, fontSize: 10, fontWeight: 700, minWidth: 16, height: 16,
          display: "grid", placeItems: "center", padding: "0 3px",
        }}>
          {quantidade}
        </span>
      )}
    </button>
  );
}

/* Carrinho aberto: revisa itens, ajusta quantidade, finaliza a compra (redireciona pro
   Checkout Pro do Mercado Pago — PIX e cartão, a FN nunca vê o dado do cartão). Login exigido
   só aqui, na hora de fechar — até então dá pra navegar e escolher sem conta nenhuma. */
function ModalCarrinho({ itens, alterarQuantidade, remover, total, onFechar, token, notify, onIrParaLogin, esvaziar }) {
  const [finalizando, setFinalizando] = useState(false);
  /* Soma só o que tem "de" maior que o preço cobrado: item sem preço anterior não inventa
     economia. Itens que já estavam no carrinho antes desta versão não têm precoDe gravado —
     ficam de fora da conta em vez de quebrar. */
  const economiaTotal = itens.reduce((soma, i) => {
    const de = Number(i.precoDe) || 0;
    const por = Number(i.precoUnitario) || 0;
    return soma + (de > por ? (de - por) * i.quantidade : 0);
  }, 0);

  const finalizarCompra = async () => {
    if (!token) { onFechar(); onIrParaLogin?.(); return; }
    setFinalizando(true);
    try {
      const r = await apiFetch("/api/pedidos/checkout", {
        method: "POST", token,
        body: { itens: itens.map((i) => ({ servicoId: i.servicoId, quantidade: i.quantidade })) },
      });
      esvaziar?.();
      window.location.href = r.initPoint;
    } catch (e) {
      notify(`Não foi possível iniciar o pagamento: ${e.message}`);
      setFinalizando(false);
    }
  };

  return (
    <div className="no-print" style={overlay} onClick={onFechar}>
      <div style={{ ...modal, maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <strong>Meu carrinho</strong>
          <button className="icon-btn" onClick={onFechar}><X size={16} /></button>
        </div>

        {itens.length === 0 ? (
          <p style={{ color: "#8593a8", fontSize: 14 }}>Seu carrinho está vazio.</p>
        ) : (
          <>
            <div style={{ display: "grid", gap: 10, maxHeight: "50vh", overflowY: "auto" }}>
              {itens.map((i) => (
                <div key={i.servicoId} style={{ display: "flex", gap: 10, alignItems: "center", border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: 10 }}>
                  {i.foto && <img src={i.foto} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{i.titulo}</div>
                    <div style={{ fontSize: 11.5, color: "#8593a8" }}>{i.parceiroEmpresa}</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                      {i.precoDe > i.precoUnitario && (
                        <span style={{ fontSize: 11.5, color: "#8593a8", textDecoration: "line-through" }}>{fmtReal(i.precoDe)}</span>
                      )}
                      <span style={{ fontSize: 12.5, color: "#2E7D32", fontWeight: 700 }}>{fmtReal(i.precoUnitario)}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button className="icon-btn" onClick={() => alterarQuantidade(i.servicoId, i.quantidade - 1)}><Minus size={13} /></button>
                    <span style={{ fontSize: 13, fontWeight: 700, minWidth: 16, textAlign: "center" }}>{i.quantidade}</span>
                    <button className="icon-btn" onClick={() => alterarQuantidade(i.servicoId, i.quantidade + 1)}><Plus size={13} /></button>
                    <button className="icon-btn" onClick={() => remover(i.servicoId)} title="Remover"><Trash2 size={13} color="#c62828" /></button>
                  </div>
                </div>
              ))}
            </div>
            {economiaTotal > 0 && (
              <div style={{ marginTop: 12, background: "#FCEAEA", color: "#C62828", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontWeight: 700, textAlign: "center" }}>
                Você economizou {fmtReal(economiaTotal)} nesta compra
              </div>
            )}
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${CINZA_BORDA}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ color: AZUL_MARINHO }}>Total: {fmtReal(total)}</strong>
              <button className="btn-solid" style={{ width: "auto", padding: "10px 18px" }} disabled={finalizando} onClick={finalizarCompra}>
                {finalizando ? <><Loader2 size={15} className="spin" /> Redirecionando…</> : (token ? "Finalizar compra" : "Entrar e finalizar")}
              </button>
            </div>
            <p style={{ fontSize: 11.5, color: "#8593a8", marginTop: 10, textAlign: "center" }}>
              Pagamento seguro via Mercado Pago (PIX ou cartão). A FN não recebe nem guarda dado do seu cartão.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSessionEstado] = useState(() => carregarSessaoSalva());
  const [mostrarLogin, setMostrarLogin] = useState(false);
  const [linkParceiroFechado, setLinkParceiroFechado] = useState(false);
  const [mostrarCadastroParceiro, setMostrarCadastroParceiro] = useState(false);

  const setSession = (s) => { guardarSessao(s); setSessionEstado(s); };

  /* Quando o token vence, encerra a sessão avisando — antes o sistema seguia aberto
     disparando "Erro 401" em cada tela, e a pessoa achava que o sistema tinha quebrado. */
  useEffect(() => {
    if (!session?.token) return;
    const faltam = lerValidadeDoToken(session.token) - Date.now();
    if (faltam <= 0) { setSession(null); return; }
    const t = setTimeout(() => {
      setSession(null);
      alert("Sua sessão expirou por segurança. Entre novamente para continuar.");
    }, Math.min(faltam, 2 ** 31 - 1));
    return () => clearTimeout(t);
  }, [session?.token]);

  // Conta o acesso uma vez por aba: "portal" quando é o site público, "equipe" quando
  // alguém entra logado. Precisa ficar antes dos returns abaixo (regra dos hooks).
  useEffect(() => { registrarAcesso(session ? "equipe" : "portal"); }, [!!session]);

  // Link público do portfólio de um parceiro (?portfolio=<id>) — funciona sem login,
  // então intercepta antes de qualquer outra checagem de sessão.
  const portfolioId = new URLSearchParams(window.location.search).get("portfolio");
  if (portfolioId) return <PaginaPortfolioParceiro parceiroId={portfolioId} />;

  // Páginas próprias das duas áreas de benefícios da FN Serviços (?pagina=fn-clube /
  // ?pagina=fn-home) — também públicas, mesmo padrão do link de portfólio acima.
  const paginaFn = new URLSearchParams(window.location.search).get("pagina");
  if (paginaFn === "fn-clube") return <PaginaBeneficiosFn tipo="servico" />;
  if (paginaFn === "fn-home") return <PaginaBeneficiosFn tipo="produto" />;

  // Link de criação de senha do portal do cliente (?criar-senha=<token>), vindo do e-mail de
  // "primeiro acesso" — também funciona sem sessão, e tem prioridade sobre ela.
  const criarSenhaToken = new URLSearchParams(window.location.search).get("criar-senha");
  if (criarSenhaToken) {
    return (
      <TelaCriarSenhaCliente token={criarSenhaToken}
        onConcluido={(s) => {
          setSession(s);
          const url = new URL(window.location.href);
          url.searchParams.delete("criar-senha");
          window.history.replaceState({}, "", url.toString());
        }} />
    );
  }

  /* Cadastro de parceiro/filiado: chega aqui de dois jeitos — pelo link direto que a FN manda
     por WhatsApp/e-mail (?parceiro-cadastro=1) ou pelo botão da própria tela de login, que é
     onde o parceiro entra depois de aprovado. */
  const linkCadastroParceiro = new URLSearchParams(window.location.search).get("parceiro-cadastro");

  if (!session) {
    if ((linkCadastroParceiro && !linkParceiroFechado) || mostrarCadastroParceiro) {
      /* Voltar cai onde a pessoa estava: no login, se ela veio de lá (mostrarLogin segue
         ligado); no portal do cliente, se ela abriu o link direto. */
      const fecharCadastro = () => { setLinkParceiroFechado(true); setMostrarCadastroParceiro(false); };
      return (
        <TelaCadastroParceiro
          onVoltar={fecharCadastro}
          onIrParaLogin={() => { fecharCadastro(); setMostrarLogin(true); }}
        />
      );
    }
    return mostrarLogin
      ? <TelaLogin onLogin={setSession} onVoltar={() => setMostrarLogin(false)}
          onCadastroParceiro={() => setMostrarCadastroParceiro(true)} />
      : <PortalCliente onIrParaLogin={() => setMostrarLogin(true)} onLogin={setSession} />;
  }
  if (session.usuario.role === "afiliado") {
    return <PainelParceiro session={session} onLogout={() => { setSession(null); setMostrarLogin(false); }} />;
  }
  if (session.usuario.role === "cliente") {
    return <PainelCliente session={session} onLogout={() => { setSession(null); setMostrarLogin(false); }} onSessaoAtualizada={setSession} />;
  }
  return <AppInterno session={session} onLogout={() => { setSession(null); setMostrarLogin(false); }} />;
}

function AppInterno({ session, onLogout }) {
  const perfil = session.usuario.role; // definido pelo backend/login — não é mais escolhido na tela
  const token = session.token;
  const [abaTop, setAbaTop] = useState("laudos"); // "laudos" | "documentacao" | "gerencia"
  // Vistoriador começa na agenda (é de lá que ele inicia a vistoria, já com os dados
  // preenchidos); os demais caem direto na vistoria.
  const [aba, setAba] = useState("itens");
  const [abaGerencia, setAbaGerencia] = useState("visao-geral"); // "visao-geral" | "parceiros" | "financeiro" | "prospeccao"
  const [abaQualidade, setAbaQualidade] = useState("analise"); // "analise" | "vistoria" | "feedback"
  const [agendarAgoraId, setAgendarAgoraId] = useState(null); // id do cliente recém-aprovado, pra abrir direto o card dele em "Vistoria"
  // Sugere o nome de quem está logado como responsável técnico — evita repetir o bug
  // antigo de sair com o nome de outra pessoa fixo. Qualificação e registro (CFT) o
  // sistema não tem como saber automaticamente; quem faz a vistoria confirma/preenche.
  const [dados, setDados] = useState(() => ({ ...DADOS_INICIAIS, rt: { ...DADOS_INICIAIS.rt, nome: session.usuario.nome || "" } }));
  const [itens, setItens] = useState(() => [novoItem()]);
  const [clienteAtualId, setClienteAtualId] = useState(null); // id do cliente carregado no laudo em edição — necessário para "Enviar para gerência"
  /* Trava do laudo após o envio à gerência.
     Isto já existiu como useState solto com um botão de "desbloquear" ao lado: o próprio
     técnico reabria o laudo que tinha acabado de enviar, e um F5 destravava sozinho. Como o
     backend também aceitava o reenvio (e ainda zerava a aprovação), a trava não segurava
     nada. Agora quem decide é o servidor — aqui só refletimos a resposta dele, e a única
     forma de reabrir a edição é a gerência devolver o laudo para correção. */
  const [confirmandoDesbloqueio, setConfirmandoDesbloqueio] = useState(false);
  const [rascunhos, setRascunhos] = useState([]);
  const [toast, setToast] = useState("");
  const [showLoad, setShowLoad] = useState(false);
  const [trocandoSenha, setTrocandoSenha] = useState(false);

  const modulosPermitidos = MODULOS_POR_PERFIL[perfil] || [];
  useEffect(() => {
    if (!modulosPermitidos.includes(abaTop)) setAbaTop(modulosPermitidos[0]);
    // O vistoriador entra direto na agenda dele — é o ponto de partida do trabalho.
    if (perfil === "vistoriador") setAba("agenda");
  }, [perfil]);

  const [docs, setDocs] = useState([]);
  const [docsCarregando, setDocsCarregando] = useState(false);

  const notify = (m) => { setToast(m); setTimeout(() => setToast(""), 2200); };

  /* ---- Documentação/Gerência: carregar e persistir via API real ---- */
  const podeVerDocs = perfil === "gerencia" || perfil === "documentacao" || perfil === "qualidade";
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
  const [clientesCarregando, setClientesCarregando] = useState(false);
  const carregarClientes = async () => {
    setClientesCarregando(true);
    try {
      const r = await apiFetch("/api/clientes", { token });
      setClientes((r.clientes || []).map(mapClienteDaApi));
    } catch (e) { notify(`Não foi possível carregar clientes: ${e.message}`); }
    setClientesCarregando(false);
  };
  useEffect(() => { carregarClientes(); }, []);
  // Novo cadastro (feito na tela pública) precisa aparecer no bloco de aprovação do
  // Agendamento sem precisar recarregar a página — busca de novo a cada 20s.
  useEffect(() => {
    const t = setInterval(carregarClientes, 20000);
    return () => clearInterval(t);
  }, []);
  const updCliente = async (id, patch) => {
    setClientes((atual) => atual.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    try { await apiFetch(`/api/clientes/${id}`, { method: "PATCH", token, body: patch }); }
    catch (e) { notify(`Não foi possível atualizar cliente: ${e.message}`); }
  };
  /* Manutenção da lista oficial de empreendimentos (só Gerência). */
  const adicionarEmpreendimento = async (empreendimento, construtora) => {
    try {
      await apiFetch("/api/empreendimentos-ref", { method: "POST", token, body: { empreendimento, construtora } });
      notify("Empreendimento adicionado ✓");
      await carregarEmpreendimentosRef();
      return true;
    } catch (e) { notify(`Não foi possível adicionar: ${e.message}`); return false; }
  };
  const removerEmpreendimento = async (empreendimento) => {
    try {
      const r = await apiFetch("/api/empreendimentos-ref", { method: "DELETE", token, body: { empreendimento } });
      notify(r.cadastrosUsando
        ? `Removido da lista. Atenção: ${r.cadastrosUsando} cadastro(s) ainda usam esse nome — trate em "Padronização".`
        : "Empreendimento removido ✓");
      await Promise.all([carregarEmpreendimentosRef(), carregarPrecos()]);
    } catch (e) { notify(`Não foi possível remover: ${e.message}`); }
  };

  /* Unifica a grafia de um empreendimento em todos os cadastros (só Gerência). */
  const padronizarEmpreendimento = async (de, para) => {
    try {
      const r = await apiFetch("/api/clientes/padronizar-empreendimento", { method: "POST", token, body: { de, para } });
      notify(`${r.atualizados} cadastro(s) atualizado(s) para "${para}" ✓`);
      await carregarClientes();
    } catch (e) { notify(`Não foi possível padronizar: ${e.message}`); }
  };

  /* Exclusão definitiva — só Gerência tem essa opção na tela. */
  const delCliente = async (id) => {
    setClientes((atual) => atual.filter((c) => c.id !== id));
    try { await apiFetch(`/api/clientes/${id}`, { method: "DELETE", token }); notify("Cliente excluído"); }
    catch (e) { notify(`Não foi possível excluir: ${e.message}`); carregarClientes(); }
  };
  /* "Esqueci minha senha" do cliente não é self-service — ele fala com o suporte pelo
     WhatsApp e a Gerência define a senha nova aqui (cria a conta na hora, se ele nunca
     tinha tido uma). */
  const resetarSenhaCliente = async (id, senha) => {
    try { await apiFetch(`/api/clientes/${id}/senha`, { method: "PATCH", token, body: { senha } }); return true; }
    catch (e) { notify(`Não foi possível resetar a senha: ${e.message}`); return false; }
  };

  /* ---- Documentação ART/TRT: os dois arquivos finais de cada cliente (ficam no Drive) ---- */
  const [documentosArt, setDocumentosArt] = useState([]);
  const carregarDocumentosArt = async () => {
    if (!["documentacao", "gerencia", "atendimento"].includes(perfil)) return;
    try {
      const r = await apiFetch("/api/documentos-art", { token });
      setDocumentosArt(r.documentos || []);
    } catch (e) { notify(`Não foi possível carregar documentos: ${e.message}`); }
  };
  useEffect(() => { carregarDocumentosArt(); }, []);
  const enviarDocumentoArt = async (dados) => {
    await apiFetch("/api/documentos-art", { method: "POST", token, body: dados });
    notify("Documento anexado ✓");
    await Promise.all([carregarDocumentosArt(), carregarClientes()]);
  };
  const excluirDocumentoArt = async (id) => {
    try {
      await apiFetch(`/api/documentos-art/${id}`, { method: "DELETE", token });
      notify("Documento removido");
      await Promise.all([carregarDocumentosArt(), carregarClientes()]);
    } catch (e) { notify(`Não foi possível remover: ${e.message}`); }
  };

  /* ---- Qualidade: avaliações que os clientes deixaram (nota + comentário) ---- */
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [avaliacoesCarregando, setAvaliacoesCarregando] = useState(false);
  const carregarAvaliacoes = async () => {
    if (perfil !== "qualidade" && perfil !== "gerencia" && perfil !== "atendimento") return;
    setAvaliacoesCarregando(true);
    try {
      const r = await apiFetch("/api/avaliacoes", { token });
      setAvaliacoes(r.avaliacoes || []);
    } catch (e) { notify(`Não foi possível carregar avaliações: ${e.message}`); }
    setAvaliacoesCarregando(false);
  };
  useEffect(() => { carregarAvaliacoes(); }, []);
  const aprovarAvaliacao = async (id, aprovado) => {
    setAvaliacoes((atual) => atual.map((a) => (a.id === id ? { ...a, aprovado } : a)));
    try { await apiFetch(`/api/avaliacoes/${id}/aprovar`, { method: "PATCH", token, body: { aprovado } }); }
    catch (e) { notify(`Não foi possível atualizar: ${e.message}`); carregarAvaliacoes(); }
  };
  /* Atendimento só pede a exclusão; quem decide se apaga de vez é a Gerência. */
  const solicitarExclusaoAvaliacao = async (id) => {
    setAvaliacoes((atual) => atual.map((a) => (a.id === id ? { ...a, exclusao_solicitada: true } : a)));
    try { await apiFetch(`/api/avaliacoes/${id}/solicitar-exclusao`, { method: "PATCH", token }); notify("Exclusão solicitada à gerência"); }
    catch (e) { notify(`Não foi possível solicitar: ${e.message}`); carregarAvaliacoes(); }
  };
  const manterAvaliacao = async (id) => {
    setAvaliacoes((atual) => atual.map((a) => (a.id === id ? { ...a, exclusao_solicitada: false } : a)));
    try { await apiFetch(`/api/avaliacoes/${id}/cancelar-exclusao`, { method: "PATCH", token }); notify("Avaliação mantida"); }
    catch (e) { notify(`Não foi possível atualizar: ${e.message}`); carregarAvaliacoes(); }
  };
  const excluirAvaliacao = async (id) => {
    setAvaliacoes((atual) => atual.filter((a) => a.id !== id));
    try { await apiFetch(`/api/avaliacoes/${id}`, { method: "DELETE", token }); notify("Avaliação excluída"); }
    catch (e) { notify(`Não foi possível excluir: ${e.message}`); carregarAvaliacoes(); }
  };

  /* ---- Parceiros/Afiliados: homologação (perfis Gerência e Vendas) ---- */
  const [parceiros, setParceiros] = useState([]);
  const [parceirosCarregando, setParceirosCarregando] = useState(false);
  const carregarParceiros = async () => {
    if (!["gerencia", "vendas", "atendimento"].includes(perfil)) return;
    setParceirosCarregando(true);
    try {
      const r = await apiFetch("/api/parceiros", { token });
      setParceiros((r.parceiros || []).map(mapParceiroDaApi));
    } catch (e) { notify(`Não foi possível carregar parceiros: ${e.message}`); }
    setParceirosCarregando(false);
  };
  useEffect(() => { carregarParceiros(); }, []);
  const atualizarParceiro = async (id, patch) => {
    try {
      await apiFetch(`/api/parceiros/${id}`, { method: "PATCH", token, body: patch });
      setParceiros((atual) => atual.map((p) => (p.id === id ? { ...p, ...patch } : p)));
      return true;
    } catch (e) {
      notify(`Não foi possível atualizar parceiro: ${e.message}`);
      return false;
    }
  };
  const excluirParceiro = async (id) => {
    try {
      await apiFetch(`/api/parceiros/${id}`, { method: "DELETE", token });
      setParceiros((atual) => atual.filter((p) => p.id !== id));
      notify("Parceiro apagado ✓");
      return true;
    } catch (e) {
      notify(`Não foi possível apagar o parceiro: ${e.message}`);
      return false;
    }
  };
  /* Aprova ou recusa a comissão que o parceiro propôs para um item do portfólio. Recarrega
     a lista porque é dela que sai o aviso de quantas ainda esperam decisão. */
  const decidirComissaoItem = async (itemId, acao) => {
    try {
      await apiFetch(`/api/parceiros/servicos/${itemId}`, { method: "PATCH", token, body: { comissao_pendente_acao: acao } });
      await carregarParceiros();
      notify(acao === "aprovar" ? "Nova comissão aprovada ✓" : "Alteração de comissão recusada");
      return true;
    } catch (e) {
      notify(`Não foi possível decidir a comissão: ${e.message}`);
      return false;
    }
  };

  /* Cadastro manual de parceiro (feito por Vendas/Gerência já logados, ex.: parceiro que
     negociou por telefone) — reaproveita a MESMA rota pública do autocadastro, já que ela
     não exige token; só embute o formulário direto no sistema em vez da tela pública. */
  const criarParceiroManual = async (dadosParceiro) => {
    try {
      const r = await apiFetch("/api/parceiros/signup", { method: "POST", body: dadosParceiro });
      await carregarParceiros();
      return { ok: true, status: r.status };
    } catch (e) {
      notify(`Não foi possível cadastrar o parceiro: ${e.message}`);
      return { ok: false };
    }
  };
  /* Vendas/Gerência edita o portfólio ("catálogo de vendas") de um parceiro qualquer, em
     nome dele — precisa informar parceiroId (diferente do próprio parceiro logado, que
     nunca passa parceiroId porque o backend já resolve pelo token). */
  const salvarItemCatalogoAdmin = async (parceiroId, item) => {
    try {
      const body = { parceiroId, titulo: item.titulo || "", categoria: item.categoria || "", preco: item.preco || "", preco_de: item.preco_de || "", descricao: item.descricao || "", foto: item.foto || "" };
      // Só vai no corpo se o editor tinha o campo: mandar vazio apagaria a comissão combinada
      // (ou tiraria o item do carrinho, no caso do preço de venda).
      if (item.comissao_percentual !== undefined) body.comissao_percentual = item.comissao_percentual;
      if (item.preco_venda !== undefined) body.preco_venda = item.preco_venda;
      if (item.id) await apiFetch(`/api/parceiros/servicos/${item.id}`, { method: "PATCH", token, body });
      else await apiFetch("/api/parceiros/servicos", { method: "POST", token, body });
      return true;
    } catch (e) { notify(`Não foi possível salvar: ${e.message}`); return false; }
  };
  const excluirItemCatalogoAdmin = async (id) => {
    try { await apiFetch(`/api/parceiros/servicos/${id}`, { method: "DELETE", token }); return true; }
    catch (e) { notify(`Não foi possível excluir: ${e.message}`); return false; }
  };

  /* ---- Banco de patologias por ambiente — editável pela gerência; o vistoriador só lê,
     pra preencher o item da vistoria e o "Conferir por ambiente". */
  const [patologiasBanco, setPatologiasBanco] = useState([]);
  const [patologiasBancoCarregando, setPatologiasBancoCarregando] = useState(false);
  const carregarPatologiasBanco = async () => {
    if (perfil !== "gerencia" && perfil !== "vistoriador") return;
    setPatologiasBancoCarregando(true);
    try {
      const r = await apiFetch("/api/patologias", { token });
      setPatologiasBanco(r.patologias || []);
    } catch (e) { notify(`Não foi possível carregar o banco de patologias: ${e.message}`); }
    setPatologiasBancoCarregando(false);
  };
  useEffect(() => { carregarPatologiasBanco(); }, []);
  const criarPatologia = async (dadosPatologia) => {
    try {
      await apiFetch("/api/patologias", { method: "POST", token, body: dadosPatologia });
      await carregarPatologiasBanco();
      return true;
    } catch (e) { notify(`Não foi possível cadastrar a patologia: ${e.message}`); return false; }
  };
  const atualizarPatologia = async (id, patch) => {
    try {
      await apiFetch(`/api/patologias/${id}`, { method: "PATCH", token, body: patch });
      await carregarPatologiasBanco();
      return true;
    } catch (e) { notify(`Não foi possível salvar a patologia: ${e.message}`); return false; }
  };
  const excluirPatologia = async (id) => {
    try {
      await apiFetch(`/api/patologias/${id}`, { method: "DELETE", token });
      setPatologiasBanco((atual) => atual.filter((p) => p.id !== id));
      return true;
    } catch (e) { notify(`Não foi possível excluir a patologia: ${e.message}`); return false; }
  };
  /* Roda uma única vez: traz o catálogo que já existia no arquivo estático (gerado de
     planilha) pra dentro do banco editável. O backend recusa se já houver alguma
     cadastrada, então não precisa de trava extra aqui. */
  const importarPatologiasEstaticas = async () => {
    try {
      const r = await apiFetch("/api/patologias/importar-lote", { method: "POST", token, body: { patologias: todasParaImportacao() } });
      await carregarPatologiasBanco();
      notify(`${r.importadas} patologia(s) importada(s) ✓`);
      return true;
    } catch (e) { notify(`Não foi possível importar: ${e.message}`); return false; }
  };

  /* ---- Vales (todos, para Gerência/Vendas acompanharem leads/conversão de Parceiros) ---- */
  const [vales, setVales] = useState([]);
  const [valesCarregando, setValesCarregando] = useState(false);
  const carregarVales = async () => {
    if (!["gerencia", "vendas", "atendimento"].includes(perfil)) return;
    setValesCarregando(true);
    try {
      const r = await apiFetch("/api/vales", { token });
      setVales((r.vales || []).map(mapValeDaApi));
    } catch (e) { notify(`Não foi possível carregar vales: ${e.message}`); }
    setValesCarregando(false);
  };
  useEffect(() => { carregarVales(); }, []);

  /* ---- Vendas e comissão (Gerência/Vendas/Atendimento acompanham) ----
     Cada linha nasce sozinha quando um cliente aceita uma proposta de um parceiro
     (POST /api/propostas/:id/responder, no backend). Aqui é acompanhamento + marcar pago. */
  const [vendas, setVendas] = useState([]);
  const [vendasCarregando, setVendasCarregando] = useState(false);
  const carregarVendas = async () => {
    if (!["gerencia", "vendas", "atendimento"].includes(perfil)) return;
    setVendasCarregando(true);
    try {
      const r = await apiFetch("/api/vendas", { token });
      setVendas(r.vendas || []);
    } catch (e) { notify(`Não foi possível carregar vendas: ${e.message}`); }
    setVendasCarregando(false);
  };
  useEffect(() => { carregarVendas(); }, []);
  const atualizarVenda = async (id, corpo) => {
    try {
      await apiFetch(`/api/vendas/${id}`, { method: "PATCH", token, body: corpo });
      await carregarVendas();
      return true;
    } catch (e) { notify(`Não foi possível atualizar a venda: ${e.message}`); return false; }
  };

  /* ---- Preço de vistoria por empreendimento (alimenta o Financeiro) ---- */
  const [precos, setPrecos] = useState([]);
  const [precosCarregando, setPrecosCarregando] = useState(false);
  /* Lista oficial de empreendimentos (vem da planilha do Drive, tabela empreendimentos_ref).
     É ela que a Gerência usa para fixar os preços — em vez de digitar o nome na mão. */
  const [empreendimentosRef, setEmpreendimentosRef] = useState([]);
  const carregarEmpreendimentosRef = async () => {
    try {
      const r = await apiFetch("/api/empreendimentos-ref");
      setEmpreendimentosRef(r.empreendimentos || []);
    } catch { /* sem a lista, o card de preços mostra só o que já foi cadastrado */ }
  };
  useEffect(() => { carregarEmpreendimentosRef(); }, []);
  const carregarPrecos = async () => {
    // Documentação também lê (só leitura), pra ver o valor fixado pela Gerência.
    if (perfil !== "gerencia" && perfil !== "documentacao") return;
    setPrecosCarregando(true);
    try {
      const r = await apiFetch("/api/precos-empreendimento", { token });
      setPrecos((r.precos || []).map(mapPrecoDaApi));
    } catch (e) { notify(`Não foi possível carregar preços por empreendimento: ${e.message}`); }
    setPrecosCarregando(false);
  };
  useEffect(() => { carregarPrecos(); }, []);
  /* precos: { precoVistoria?, precoDocumentacao? } — o que não vier mantém o valor atual. */
  const salvarPreco = async (empreendimento, precos) => {
    try {
      const r = await apiFetch("/api/precos-empreendimento", { method: "POST", token, body: { empreendimento, ...precos } });
      setPrecos((atual) => {
        const existe = atual.some((p) => p.id === r.id);
        const item = mapPrecoDaApi(r);
        return existe ? atual.map((p) => (p.id === r.id ? item : p)) : [...atual, item];
      });
      return true;
    } catch (e) {
      notify(`Não foi possível salvar o preço: ${e.message}`);
      return false;
    }
  };

  /* ---- Prospecção: carteira comercial de empreendimentos (só Gerência) ---- */
  const [prospeccao, setProspeccao] = useState([]);
  const [prospeccaoCarregando, setProspeccaoCarregando] = useState(false);
  const carregarProspeccao = async () => {
    if (perfil !== "gerencia") return;
    setProspeccaoCarregando(true);
    try {
      const r = await apiFetch("/api/prospeccao", { token });
      setProspeccao(r.prospeccao || []);
    } catch (e) { notify(`Não foi possível carregar a prospecção: ${e.message}`); }
    setProspeccaoCarregando(false);
  };
  useEffect(() => { carregarProspeccao(); }, []);
  /* Atualiza na tela na hora e grava atrás; texto livre não avisa a cada tecla. */
  /* Publica a carteira na planilha do Drive. Mão única: o sistema manda, a planilha
     recebe — quem edita é sempre aqui. Devolve o link para abrir a planilha. */
  const publicarProspeccaoDrive = async () => {
    const r = await apiFetch("/api/prospeccao/publicar-drive", { method: "POST", token });
    return r;
  };

  const atualizarProspeccao = async (id, patch, { silencioso = false } = {}) => {
    setProspeccao((atual) => atual.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    try {
      await apiFetch(`/api/prospeccao/${id}`, { method: "PATCH", token, body: patch });
      if (!silencioso) notify("Prospecção atualizada ✓");
    } catch (e) { notify(`Não foi possível salvar: ${e.message}`); carregarProspeccao(); }
  };

  /* ---- Acessos ao sistema (indicador da Gerência) ---- */
  const [acessos, setAcessos] = useState(null);
  const [acessosCarregando, setAcessosCarregando] = useState(false);
  useEffect(() => {
    if (perfil !== "gerencia") return;
    (async () => {
      setAcessosCarregando(true);
      try {
        const r = await apiFetch("/api/acessos/resumo", { token });
        setAcessos(r);
      } catch (e) { notify(`Não foi possível carregar os acessos: ${e.message}`); }
      setAcessosCarregando(false);
    })();
  }, []);

  /* ---- Laudos aguardando aprovação da Gerência ---- */
  const [laudosPendentes, setLaudosPendentes] = useState([]);
  const [laudosPendentesCarregando, setLaudosPendentesCarregando] = useState(false);
  const carregarLaudosPendentes = async () => {
    if (perfil !== "gerencia") return;
    setLaudosPendentesCarregando(true);
    try {
      const r = await apiFetch("/api/laudos/pendentes", { token });
      setLaudosPendentes(r.pendentes || []);
    } catch (e) { notify(`Não foi possível carregar laudos pendentes: ${e.message}`); }
    setLaudosPendentesCarregando(false);
  };
  useEffect(() => { carregarLaudosPendentes(); }, []);
  const aprovarLaudo = async (docId) => {
    try {
      const r = await apiFetch(`/api/docs/${docId}/aprovar`, { method: "POST", token });
      notify(`Laudo aprovado e enviado para ${r.emailEnviadoPara} ✓`);
      setLaudosPendentes((atual) => atual.filter((p) => p.doc_id !== docId));
      carregarDocs();
      return true;
    } catch (e) {
      notify(`Não foi possível aprovar: ${e.message}`);
      return false;
    }
  };
  /* ---- Painel da gerência: indicadores e tempos médios, com filtros ----
     Os números são contados no banco. Trazer os laudos para contar no navegador significaria
     baixar as fotos em JSONB junto — megabytes por laudo, para exibir um total. */
  const [painel, setPainel] = useState(null);
  const [painelCarregando, setPainelCarregando] = useState(false);
  const carregarPainel = async (filtros = {}) => {
    if (perfil !== "gerencia") return;
    setPainelCarregando(true);
    try {
      const qs = new URLSearchParams(
        Object.entries(filtros).filter(([, v]) => String(v || "").trim())
      ).toString();
      setPainel(await apiFetch(`/api/painel/laudos${qs ? `?${qs}` : ""}`, { token }));
    } catch (e) { notify(`Não foi possível carregar o painel: ${e.message}`); }
    setPainelCarregando(false);
  };
  useEffect(() => { carregarPainel(); }, []);

  /* Abrir o laudo marca "Em análise": o técnico passa a saber que o documento saiu da fila
     e alguém está olhando, em vez de ficar dias vendo "Enviado". O backend ignora a chamada
     quando o laudo já passou desse ponto, então abrir um aprovado não o faz retroceder. */
  const marcarEmAnalise = async (docId) => {
    try {
      const r = await apiFetch(`/api/laudos/${docId}/em-analise`, { method: "POST", token });
      if (r.alterado) carregarLaudosPendentes();
    } catch { /* silencioso: é um efeito colateral de abrir, não pode atrapalhar a leitura */ }
  };
  /* Reenvio manual do que falhou ao subir para o Drive. Fica com a gerência porque um erro
     que sobreviveu às 3 tentativas automáticas costuma ser credencial ou cota. */
  const reenviarDrive = async (docId) => {
    try {
      const r = await apiFetch(`/api/laudos/${docId}/drive/reenviar`, { method: "POST", token });
      notify(r.recolocados ? `${r.recolocados} arquivo(s) recolocados na fila do Drive ✓` : "Nada pendente para reenviar.");
      setTimeout(carregarLaudosPendentes, 1500); // dá um instante para a fila andar
      return true;
    } catch (e) {
      notify(`Não foi possível reenviar: ${e.message}`);
      return false;
    }
  };
  /* Devolver é o único caminho que reabre a edição para o vistoriador — sem isto, um laudo
     enviado ficaria travado para sempre, já que o técnico não destrava mais o próprio laudo. */
  const devolverLaudo = async (docId, motivo) => {
    try {
      await apiFetch(`/api/laudos/${docId}/devolver`, { method: "POST", token, body: { motivo } });
      notify("Laudo devolvido ao vistoriador para correção ✓");
      setLaudosPendentes((atual) => atual.filter((p) => p.doc_id !== docId));
      carregarDocs();
      return true;
    } catch (e) {
      notify(`Não foi possível devolver: ${e.message}`);
      return false;
    }
  };
  /* Gerência corrige o laudo direto na tela de aprovação, sem devolver pro vistoriador —
     evita a ida e volta quando o ajuste é pequeno (texto, severidade etc.).
     PRECISA de uma rota nova no backend: PATCH /api/laudos/:docId/editar, body {dados, itens}. */
  const editarLaudo = async (docId, patch) => {
    try {
      await apiFetch(`/api/laudos/${docId}/editar`, { method: "PATCH", token, body: patch });
      setLaudosPendentes((atual) => atual.map((p) => (p.doc_id === docId ? { ...p, ...patch } : p)));
      return true;
    } catch (e) {
      notify(`Não foi possível salvar as correções: ${e.message}`);
      return false;
    }
  };

  /* Cliente cancelado sai das telas de trabalho: ele não é mais atendimento, e ficar
     no meio dos ativos faz a equipe contar errado e clicar no lugar errado. A Gerência
     continua vendo o histórico completo (ela recebe `clientes` inteiro), porque é ela
     quem decide cancelamento e precisa poder conferir depois. */
  const clientesAtivos = clientes.filter((c) => c.status !== "Cancelado");

  /* ---- Laudos que o técnico já realizou, com o retorno do cliente ---- */
  const [meusLaudos, setMeusLaudos] = useState([]);
  const [meusLaudosCarregando, setMeusLaudosCarregando] = useState(false);
  const carregarMeusLaudos = async () => {
    if (perfil !== "vistoriador" && perfil !== "gerencia") return;
    setMeusLaudosCarregando(true);
    try {
      const r = await apiFetch("/api/meus-laudos", { token });
      setMeusLaudos(r.laudos || []);
    } catch (e) { notify(`Não foi possível carregar seus laudos: ${e.message}`); }
    setMeusLaudosCarregando(false);
  };
  useEffect(() => { carregarMeusLaudos(); }, []);

  /* ---- Estado do laudo em edição, do ponto de vista do servidor ----
     "editavelPeloTecnico" vem do backend (ver LAUDO_STATUS em server.js): é verdadeiro só
     enquanto o laudo nunca foi enviado ou foi devolvido para correção. A gerência não é
     travada aqui — é ela quem corrige o laudo depois da análise. */
  const laudoNoServidor = meusLaudos.find((l) => l.cliente_id && l.cliente_id === clienteAtualId) || null;
  const laudoBloqueado = perfil === "vistoriador" && !!laudoNoServidor && !laudoNoServidor.editavelPeloTecnico;
  const laudoDevolvido = laudoNoServidor?.laudo_status === "devolvido_correcao";

  /* ---- Calendário do vistoriador: agendamentos atribuídos a ele ---- */
  const [agendaVistoriador, setAgendaVistoriador] = useState([]);
  const [agendaVistoriadorCarregando, setAgendaVistoriadorCarregando] = useState(false);
  const carregarAgendaVistoriador = async ({ silencioso = false } = {}) => {
    // Só o vistoriador tem vistorias atribuídas a ele; a Gerência acompanha pelo Agendamento.
    if (perfil !== "vistoriador") return;
    if (!silencioso) setAgendaVistoriadorCarregando(true);
    try {
      const r = await apiFetch("/api/clientes/minha-agenda", { token });
      setAgendaVistoriador(r.agenda || []);
    } catch (e) { if (!silencioso) notify(`Não foi possível carregar sua agenda: ${e.message}`); }
    if (!silencioso) setAgendaVistoriadorCarregando(false);
  };
  useEffect(() => {
    carregarAgendaVistoriador();
    // Recarrega em segundo plano pra que uma vistoria cancelada pela Gerência suma da
    // agenda do técnico sem ele precisar recarregar a página.
    const t = setInterval(() => carregarAgendaVistoriador({ silencioso: true }), 20000);
    return () => clearInterval(t);
  }, []);

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

  /* ---- Assinatura própria do vistoriador — aparece no laudo final ao lado da da Gerência ---- */
  const [minhaAssinatura, setMinhaAssinatura] = useState(null); // { imagem }
  const [meuPerfilTecnico, setMeuPerfilTecnico] = useState({ qualificacao: "", registro: "" });
  const carregarMinhaAssinatura = async () => {
    if (perfil !== "vistoriador" && perfil !== "gerencia") return;
    try {
      const r = await apiFetch("/api/usuarios/me/assinatura", { token });
      setMinhaAssinatura(r.assinatura || null);
      setMeuPerfilTecnico({ qualificacao: r.qualificacao || "", registro: r.registro || "" });
    } catch { setMinhaAssinatura(null); }
  };
  useEffect(() => { carregarMinhaAssinatura(); }, []);
  /* Qualificação e registro cadastrados pela Gerência preenchem o laudo sozinhos — o técnico
     só digita se precisar corrigir para uma vistoria específica, não em toda vez. Só entra
     quando o campo ainda está vazio, para não sobrescrever o que já foi ajustado à mão. */
  useEffect(() => {
    if (!meuPerfilTecnico.qualificacao && !meuPerfilTecnico.registro) return;
    setDados((d) => ({
      ...d,
      rt: {
        ...d.rt,
        qualificacao: d.rt.qualificacao || meuPerfilTecnico.qualificacao,
        registro: d.rt.registro || meuPerfilTecnico.registro,
      },
    }));
  }, [meuPerfilTecnico]);
  const salvarMinhaAssinatura = async (obj) => {
    setMinhaAssinatura(obj);
    try { await apiFetch("/api/usuarios/me/assinatura", { method: "POST", token, body: obj }); notify("Assinatura salva ✓"); }
    catch (e) { notify(`Não foi possível salvar a assinatura: ${e.message}`); }
  };
  const removerMinhaAssinatura = async () => {
    setMinhaAssinatura(null);
    try { await apiFetch("/api/usuarios/me/assinatura", { method: "DELETE", token }); } catch {}
  };

  /* ---- Gerenciar usuários da equipe (somente perfil Gerência) ---- */
  const [usuarios, setUsuarios] = useState([]);
  const [usuariosCarregando, setUsuariosCarregando] = useState(false);
  const carregarUsuarios = async () => {
    if (perfil !== "gerencia" && perfil !== "qualidade" && perfil !== "atendimento") return;
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
  /* Qualificação, registro e assinatura do vistoriador — a Gerência cadastra uma vez aqui e
     o laudo já nasce preenchido sozinho, sem o técnico digitar em toda vistoria. */
  const salvarPerfilTecnico = async (id, patch) => {
    await apiFetch(`/api/users/${id}/perfil-tecnico`, { method: "PATCH", token, body: patch });
    notify("Perfil técnico atualizado ✓");
    carregarUsuarios();
  };

  const preencherComCliente = (cli, { irParaItens = false } = {}) => {
    if (!cli) return;
    /* Troca de cliente: sem isto, itens/fotoCliente da vistoria anterior continuavam no
       estado — o laudo do novo cliente nascia com não conformidades e foto de outro imóvel,
       e a validação de "foto obrigatória" passava porque o campo já estava preenchido (com a
       foto errada). Se o laudo deste cliente foi devolvido pela gerência para correção, retoma
       o que foi de fato enviado ao servidor — não o que sobrou na memória do navegador, que
       pode já ter sido sobrescrito por outra vistoria feita nesse meio tempo. */
    const trocouDeCliente = clienteAtualId !== null && clienteAtualId !== cli.id;
    const laudoDoCliente = meusLaudos.find((l) => l.cliente_id === cli.id) || null;
    if (laudoDoCliente?.laudo_status === "devolvido_correcao") {
      setDados(laudoDoCliente.dados);
      setItens((laudoDoCliente.itens || []).map((i) => ({ ...i, id: idCounter++, fotos: i.fotos || [] })));
    } else if (trocouDeCliente) {
      setItens([novoItem()]);
      setDados((d) => ({ ...d, fotoCliente: null }));
    }
    setDados((d) => ({
      ...d,
      contratante: { ...d.contratante, nome: cli.nome || d.contratante.nome, cpf: cli.cpf || d.contratante.cpf },
      imovel: { ...d.imovel, construtora: cli.construtora || d.imovel.construtora, empreendimento: cli.empreendimento || d.imovel.empreendimento, unidade: cli.blocoTorre || d.imovel.unidade, endereco: cli.endereco || d.imovel.endereco, areaPrivativa: cli.areaPrivativa || d.imovel.areaPrivativa },
      vistoria: {
        ...d.vistoria,
        data: cli.dataDesejada || d.vistoria.data,
        inicio: cli.horarioDesejado || d.vistoria.inicio,
        termino: cli.horarioDesejado ? somarHora(cli.horarioDesejado, 1) : d.vistoria.termino,
      },
    }));
    setClienteAtualId(cli.id);
    // "Iniciar vistoria" (agenda do técnico) marca o cliente como em campo; abrir o cadastro
    // por outros caminhos só marca como atendido, sem mexer na etapa do fluxo.
    const patch = {};
    if (!cli.atendido) patch.atendido = true;
    if (irParaItens && cli.status === "Vistoria agendada") patch.status = "Em vistoria";
    if (Object.keys(patch).length > 0) updCliente(cli.id, patch);
    if (irParaItens) { setAbaTop("laudos"); setAba("itens"); }
    notify("Dados do cliente aplicados ao laudo ✓");
  };

  /* ---- Finalizar vistoria: vistoriador envia o laudo (dados + itens) para a gerência
     revisar/aprovar remotamente. Redimensiona as fotos antes de enviar (evita payload
     enorme). Muda o status do cliente para "Laudo em análise" automaticamente. ---- */
  const [enviandoParaGerencia, setEnviandoParaGerencia] = useState(false);
  /* Editor pontual de "dados" — usado pelos campos do imóvel/vistoria que ficaram na
     tela da vistoria depois que a aba "Dados do laudo" saiu. */
  const setD = (grupo, campo, val) => setDados((d) => ({ ...d, [grupo]: { ...d[grupo], [campo]: val } }));
  const setFotoCliente = (foto) => setDados((d) => ({ ...d, fotoCliente: foto }));
  const enviarParaGerencia = async () => {
    if (!clienteAtualId) { notify("Selecione um cliente cadastrado em \"Dados do laudo\" antes de enviar."); return; }
    if (!dados.fotoCliente) { notify("Anexe a foto com o cliente antes de enviar (obrigatória)."); return; }
    setEnviandoParaGerencia(true);
    try {
      const itensComprimidos = await Promise.all(itens.map(async (item) => ({
        ...item,
        fotos: await Promise.all(item.fotos.map((f) => redimensionar(f))),
      })));
      const dadosComprimidos = { ...dados, fotoCliente: dados.fotoCliente ? await redimensionar(dados.fotoCliente) : null };
      await apiFetch("/api/vistoria/finalizar", {
        method: "POST", token,
        body: { clienteId: clienteAtualId, dados: dadosComprimidos, itens: itensComprimidos },
      });
      notify("Laudo enviado para a gerência ✓");
      /* A trava agora vem do servidor: recarregar a lista é o que a aplica na tela. */
      await carregarMeusLaudos();
      carregarDocs();
    } catch (e) { notify(`Não foi possível enviar para a gerência: ${e.message}`); }
    setEnviandoParaGerencia(false);
  };
  /* O técnico não destrava mais o próprio laudo — quem reabre a edição é a gerência, ao
     devolver para correção (POST /api/laudos/:docId/devolver). O modal virou explicação. */
  const fecharAvisoBloqueio = () => setConfirmandoDesbloqueio(false);

  /* ---- Rascunhos de laudo em andamento: guardados neste navegador ----
     Isto usava `window.storage`, que NÃO existe em navegador nenhum — era uma API do
     ambiente de protótipo onde o sistema nasceu. Como o código avisava "Rascunho salvo"
     antes de conferir se havia onde salvar, o técnico recebia confirmação de um salvamento
     que nunca acontecia: fechou a aba, perdeu a vistoria inteira.
     Agora usa localStorage, que é o armazenamento padrão do navegador, e a mensagem de
     sucesso só aparece depois de gravar de fato. */
  /* O rascunho agora mora no IndexedDB (ver rascunho-local.js): guarda as fotos junto,
     que era o que se perdia quando o celular descartava a aba em segundo plano. */
  const listarRascunhos = async () => {
    try { setRascunhos(await Rascunho.listarRascunhos()); }
    catch { setRascunhos([]); }
  };
  useEffect(() => { listarRascunhos(); }, []);

  const nomeDoRascunho = () =>
    dados.contratante.nome?.trim() || dados.imovel.empreendimento?.trim() || "Sem nome";

  const salvarRascunho = async () => {
    try {
      await Rascunho.salvarRascunho({
        chave: `manual-${Date.now()}`, nome: nomeDoRascunho(), dados, itens,
      });
      const espaco = await Rascunho.espacoDisponivel();
      const aviso = espaco && espaco.totalMB - espaco.usadoMB < 60
        ? " — atenção: o celular está com pouco espaço."
        : "";
      notify(`Rascunho salvo com as fotos ✓${aviso}`);
      listarRascunhos();
    } catch (e) {
      notify(e?.name === "QuotaExceededError"
        ? "Sem espaço no celular. Exclua rascunhos antigos em \"Abrir\" e tente de novo."
        : "Não foi possível salvar o rascunho.");
    }
  };

  /* Salvamento automático: o técnico não precisa lembrar de apertar "Salvar". Grava
     alguns segundos depois da última alteração, sempre na mesma chave, para não encher
     o aparelho com uma cópia por toque. */
  const salvandoAuto = useRef(false);
  useEffect(() => {
    if (itens.length === 0 && !dados.contratante?.nome) return;
    const t = setTimeout(async () => {
      if (salvandoAuto.current) return;
      salvandoAuto.current = true;
      try {
        await Rascunho.salvarRascunho({
          chave: Rascunho.CHAVE_EM_ANDAMENTO,
          nome: `${nomeDoRascunho()} (automático)`, dados, itens,
        });
      } catch { /* sem espaço ou navegador restrito: o salvamento manual avisa */ }
      salvandoAuto.current = false;
    }, 4000);
    return () => clearTimeout(t);
  }, [dados, itens]);

  const carregar = async (chave) => {
    try {
      const r = await Rascunho.abrirRascunho(chave);
      setDados(r.dados);
      setItens((r.itens || []).map((i) => ({ ...i, id: idCounter++, fotos: i.fotos || [] })));
      setShowLoad(false);
      notify(r.comFotos ? "Rascunho carregado com as fotos ✓" : "Rascunho antigo carregado — refaça o envio das fotos");
    } catch { notify("Falha ao carregar o rascunho."); }
  };

  const excluirRascunho = async (chave) => {
    try { await Rascunho.excluirRascunho(chave); listarRascunhos(); } catch {}
  };

  /* ---- helpers de estado ---- */


  const updItem = (id, patch) => setItens((l) => l.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  /* "bp-<id>" vem do banco de patologias por ambiente (mesmo catálogo usado em "Conferir
     por ambiente"), agora também disponível aqui, item a item — o técnico não precisa
     abrir a tela separada só pra aproveitar o catálogo. Prefixo "bp-" distingue do id do
     BANCO antigo (chaves como "rejunte", "pintura"), que continua funcionando do mesmo jeito. */
  const escolherPatologia = (id, tipo) => {
    const item = itens.find((i) => i.id === id);
    const tituloAtual = (item?.titulo || "").trim();
    const eraAutoPreenchido = !tituloAtual || tituloAtual === item?.patologia;

    if (tipo.startsWith("bp-")) {
      const p = patologiasBanco.find((x) => x.id === tipo.slice(3));
      if (!p) return updItem(id, { tipo, patologia: "" });
      const gerado = paraItemDeLaudo(p, item?.local || "");
      updItem(id, { ...gerado, ...(eraAutoPreenchido ? {} : { titulo: tituloAtual }) });
      return;
    }

    const b = BANCO[tipo];
    if (!b) return updItem(id, { tipo, patologia: "" });
    // O título fica editável: começa com o rótulo da patologia e o técnico detalha se quiser.
    updItem(id, {
      tipo, patologia: b.label, severidade: b.sev, descricao: b.desc, recomendacao: b.rec,
      categoria: b.categoria || "", norma: b.norma || "",
      ...(eraAutoPreenchido ? { titulo: b.label } : {}),
    });
  };
  /* Selecionar várias fotos de uma vez precisa acrescentar TODAS.
     Antes, cada foto que terminava de carregar montava a lista nova a partir da lista antiga
     (a que existia quando o técnico clicou), porque `itens` vinha congelado da renderização.
     Como as fotos carregam em paralelo, uma sobrescrevia a outra: escolher 3 salvava 1 — e o
     técnico só descobria conferindo foto a foto, com o laudo já fechado.
     Agora: lê todas primeiro, depois acrescenta de uma vez usando a forma funcional do
     setItens, que sempre enxerga a lista atual. */
  const MAX_FOTOS_ITEM = 4;
  const addFotos = async (id, fileList) => {
    const item = itens.find((i) => i.id === id);
    if (!item) return;
    const espaco = MAX_FOTOS_ITEM - item.fotos.length;
    if (espaco <= 0) { notify(`Cada item aceita no máximo ${MAX_FOTOS_ITEM} fotos.`); return; }

    const escolhidas = Array.from(fileList);
    if (escolhidas.length > espaco) notify(`Cabem mais ${espaco} foto(s) neste item — as demais não foram anexadas.`);

    const lidas = await Promise.all(
      escolhidas.slice(0, espaco).map((f) => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => { notify(`Não foi possível carregar a foto "${f.name}". Tente novamente.`); resolve(null); };
        reader.readAsDataURL(f);
      }))
    );
    const validas = lidas.filter(Boolean);
    if (validas.length === 0) return;
    setItens((lista) => lista.map((i) =>
      i.id === id ? { ...i, fotos: [...i.fotos, ...validas].slice(0, MAX_FOTOS_ITEM) } : i
    ));
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
            <div style={{ width: "clamp(36px, 9vw, 44px)", height: "clamp(36px, 9vw, 44px)", borderRadius: 9, background: "#fff", display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0 }}>
              <img src={LOGO_URL} alt="FN Edificações" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
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
            <SinoNotificacoes
              itens={calcularNotificacoes({ perfil, clientes: clientesAtivos, laudosPendentes, avaliacoes, documentosArt, agendaVistoriador, meusLaudos, parceiros })}
              onIr={({ aba, sub }) => {
                if (aba) setAbaTop(aba);
                if (sub && aba === "qualidade") setAbaQualidade(sub);
                if (sub && aba === "gerencia") setAbaGerencia(sub);
                if (sub && aba === "laudos") setAba(sub);
              }} />
            <button className="btn-ghost" onClick={() => setTrocandoSenha(true)} title="Alterar minha senha">
              <Lock size={14} /> Senha
            </button>
            <button className="btn-ghost" onClick={onLogout} title="Sair"><X size={14} /> Sair</button>
          </div>
          {trocandoSenha && <ModalTrocarSenha token={token} notify={notify} onFechar={() => setTrocandoSenha(false)} />}
          {abaTop === "laudos" && (
            <>
              <button className="btn-ghost" onClick={() => { setShowLoad(true); listarRascunhos(); }}><FolderOpen size={15} /> Abrir</button>
              <button className="btn-ghost" onClick={salvarRascunho}><Save size={15} /> Salvar</button>
              {/* Gerar PDF é da Gerência: quem aprova é quem emite. O vistoriador vê o laudo
                  na tela e envia para aprovação — assim nenhuma versão não aprovada circula. */}
              {perfil === "gerencia" && (
                <button className="btn-solid" onClick={() => { setAba("laudo"); setTimeout(imprimir, 300); }}><Printer size={15} /> Gerar PDF</button>
              )}
              {/* Só o vistoriador envia: a Gerência é quem aprova, não teria a quem enviar. */}
              {perfil === "vistoriador" && (
                <button className="btn-solid" style={{ background: AZUL_MARINHO }} onClick={enviarParaGerencia} disabled={enviandoParaGerencia || laudoBloqueado} title={laudoBloqueado ? "Este laudo já foi enviado — desbloqueie para corrigir e reenviar" : ""}>
                  {enviandoParaGerencia ? <Loader2 size={15} className="spin" /> : laudoBloqueado ? <Lock size={15} /> : <Send size={15} />} {laudoBloqueado ? "Laudo enviado" : "Enviar para gerência"}
                </button>
              )}
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
        <nav style={{ maxWidth: 1080, margin: "0 auto", padding: "0 18px", display: "flex", gap: 4, borderTop: "1px solid rgba(255,255,255,.12)", overflowX: "auto" }}>
          {[["laudos", "Laudos", FileText], ["documentacao", "Documentação", ClipboardCheck], ["clientes", "Clientes", Users], ["qualidade", "Agendamento", Star], ["vendas", "Vendas", Handshake], ["gerencia", "Gerência", BarChart3]]
            .filter(([k]) => modulosPermitidos.includes(k))
            .map(([k, label, Icon]) => (
              <button key={k} onClick={() => setAbaTop(k)} className="tab" style={{ borderBottomColor: abaTop === k ? "#fff" : "transparent", color: abaTop === k ? "#fff" : "rgba(255,255,255,.55)", whiteSpace: "nowrap", flexShrink: 0 }}>
                <Icon size={15} /> {label}
              </button>
            ))}
        </nav>

        {/* Sub-navegação (somente dentro do módulo Laudos) */}
        {abaTop === "laudos" && (
          <nav style={{ maxWidth: 1080, margin: "0 auto", padding: "0 18px", display: "flex", gap: 4, background: "rgba(0,0,0,.12)", overflowX: "auto" }}>
            {[...(perfil === "vistoriador" ? [["agenda", "Minha agenda", CalendarDays]] : []),
              ["itens", `Vistoria (${totalItens})`, Camera], ["laudo", "Laudo final", FileText],
              ...(perfil === "vistoriador" || perfil === "gerencia" ? [["realizados", "Laudos realizados", ClipboardCheck]] : [])]
              .map(([k, label, Icon]) => (
                <button key={k} onClick={() => setAba(k)} className="tab" style={{ borderBottomColor: aba === k ? AZUL_MEDIO : "transparent", color: aba === k ? "#fff" : "rgba(255,255,255,.6)", fontSize: 13, whiteSpace: "nowrap", flexShrink: 0 }}>
                  <Icon size={15} /> {label}
                </button>
              ))}
          </nav>
        )}

        {/* Sub-navegação (somente dentro do módulo Gerência) */}
        {abaTop === "gerencia" && (
          <nav style={{ maxWidth: 1080, margin: "0 auto", padding: "0 18px", display: "flex", gap: 4, background: "rgba(0,0,0,.12)", overflowX: "auto" }}>
            {[["visao-geral", "Visão geral", LayoutGrid], ["acompanhamento", "Acompanhamento", ClipboardList], ["parceiros", "Parceiros e Afiliados", Users], ["financeiro", "Financeiro", DollarSign], ["prospeccao", "Prospecção", TrendingUp], ["patologias", "Banco de patologias", AlertTriangle]].map(([k, label, Icon]) => (
              <button key={k} onClick={() => setAbaGerencia(k)} className="tab" style={{ borderBottomColor: abaGerencia === k ? AZUL_MEDIO : "transparent", color: abaGerencia === k ? "#fff" : "rgba(255,255,255,.6)", fontSize: 13, whiteSpace: "nowrap", flexShrink: 0 }}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </nav>
        )}

        {/* Sub-navegação (somente dentro do módulo Qualidade) */}
        {abaTop === "qualidade" && (
          <nav style={{ maxWidth: 1080, margin: "0 auto", padding: "0 18px", display: "flex", gap: 4, background: "rgba(0,0,0,.12)", overflowX: "auto" }}>
            {[["analise", "Análise", ClipboardCheck], ["vistoria", "Vistoria", CalendarDays], ["feedback", "Feedback", Star], ["acompanhamento", "Acompanhamento", ClipboardList]].map(([k, label, Icon]) => (
              <button key={k} onClick={() => setAbaQualidade(k)} className="tab" style={{ borderBottomColor: abaQualidade === k ? AZUL_MEDIO : "transparent", color: abaQualidade === k ? "#fff" : "rgba(255,255,255,.6)", fontSize: 13, whiteSpace: "nowrap", flexShrink: 0 }}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </nav>
        )}
      </header>

      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "22px 18px 80px" }}>
        {abaTop === "laudos" && <NotificacoesClientes clientes={clientesAtivos} preencherComCliente={preencherComCliente} style={{ marginBottom: 18 }} />}
        {abaTop === "documentacao" && <FaixaIndicadoresGerais docs={docs} clientes={clientesAtivos} modo="art" style={{ marginBottom: 18 }} />}

        {abaTop === "laudos" && aba === "itens" && (
          <AbaItens itens={itens} setItens={setItens} updItem={updItem} escolherPatologia={escolherPatologia}
            addFotos={addFotos} removerFoto={removerFoto} contagem={contagem} dados={dados} setD={setD}
            fotoCliente={dados.fotoCliente} setFotoCliente={setFotoCliente} notify={notify} setAba={setAba}
            bloqueado={laudoBloqueado} onPedirDesbloqueio={() => setConfirmandoDesbloqueio(true)}
            statusLaudo={laudoNoServidor?.laudoStatusLabel} devolvido={laudoDevolvido}
            motivoDevolucao={laudoNoServidor?.motivo_devolucao} patologiasBanco={patologiasBanco}
            minhaAssinatura={minhaAssinatura} salvarMinhaAssinatura={salvarMinhaAssinatura} removerMinhaAssinatura={removerMinhaAssinatura} />
        )}
        {abaTop === "laudos" && aba === "laudo" && <LaudoModelo laudo={montarLaudoModelo(dados, itens)} assinatura={assinatura} assinaturaVistoriador={minhaAssinatura} aprovado={perfil === "gerencia"} />}
        {abaTop === "laudos" && aba === "realizados" && (
          <AbaLaudosRealizados laudos={meusLaudos} carregando={meusLaudosCarregando}
            recarregar={carregarMeusLaudos} assinatura={assinatura} ehGerencia={perfil === "gerencia"}
            clientes={clientesAtivos} docs={docs} usuarios={usuarios} />
        )}
        {abaTop === "laudos" && aba === "agenda" && perfil === "vistoriador" && (
          <CalendarioVistoriador agenda={agendaVistoriador} carregando={agendaVistoriadorCarregando} clientes={clientesAtivos} preencherComCliente={preencherComCliente} />
        )}

        {abaTop === "documentacao" && (
          <AbaDocumentacao docs={docs} addDoc={addDoc} updDoc={updDoc} delDoc={delDoc} carregando={docsCarregando} notify={notify} clientes={clientesAtivos} updCliente={updCliente} excluirCliente={delCliente} perfil={perfil}
            documentosArt={documentosArt} enviarDocumentoArt={enviarDocumentoArt} excluirDocumentoArt={excluirDocumentoArt} precos={precos} />
        )}
        {abaTop === "clientes" && (
          <AbaClientesComercial clientes={clientesAtivos} carregando={clientesCarregando} atualizarCliente={updCliente} excluirCliente={delCliente}
            resetarSenhaCliente={resetarSenhaCliente} notify={notify} docs={docs} perfil={perfil} />
        )}
        {abaTop === "qualidade" && (
          <AbaQualidade sub={abaQualidade} setSub={setAbaQualidade} avaliacoes={avaliacoes} carregando={avaliacoesCarregando} docs={docs} docsCarregando={docsCarregando} aprovarAvaliacao={aprovarAvaliacao}
            solicitarExclusaoAvaliacao={solicitarExclusaoAvaliacao} manterAvaliacao={manterAvaliacao} excluirAvaliacao={excluirAvaliacao}
            clientes={clientesAtivos} clientesCarregando={clientesCarregando} updCliente={updCliente} usuarios={usuarios} notify={notify} preencherComCliente={preencherComCliente}
            agendarAgoraId={agendarAgoraId} setAgendarAgoraId={setAgendarAgoraId}
            podeAgir={perfil === "atendimento" || perfil === "gerencia"} ehGerencia={perfil === "gerencia"} />
        )}
        {abaTop === "vendas" && (
          <AbaGerenciaParceiros parceiros={parceiros} parceirosCarregando={parceirosCarregando} atualizarParceiro={atualizarParceiro}
            vales={vales} valesCarregando={valesCarregando} vendas={vendas} vendasCarregando={vendasCarregando} atualizarVenda={atualizarVenda}
            criarParceiroManual={criarParceiroManual} token={token} perfil={perfil} decidirComissaoItem={decidirComissaoItem}
            salvarItemCatalogo={salvarItemCatalogoAdmin} excluirItemCatalogo={excluirItemCatalogoAdmin} notify={notify}
            podeExcluir={perfil === "gerencia"} excluirParceiro={excluirParceiro} />
        )}
        {abaTop === "gerencia" && (
          <AbaGerencia sub={abaGerencia} token={token} perfil={perfil} decidirComissaoItem={decidirComissaoItem} docs={docs} addDoc={addDoc} updDoc={updDoc} delDoc={delDoc} clientes={clientes} updCliente={updCliente} carregando={docsCarregando} assinatura={assinatura} salvarAssinatura={salvarAssinatura} removerAssinatura={removerAssinatura} notify={notify}
            usuarios={usuarios} usuariosCarregando={usuariosCarregando} criarUsuario={criarUsuario} atualizarUsuario={atualizarUsuario} excluirUsuario={excluirUsuario} salvarPerfilTecnico={salvarPerfilTecnico} usuarioAtualId={session.usuario.id}
            avaliacoes={avaliacoes} avaliacoesCarregando={avaliacoesCarregando}
            parceiros={parceiros} parceirosCarregando={parceirosCarregando} atualizarParceiro={atualizarParceiro} criarParceiroManual={criarParceiroManual}
            excluirParceiro={excluirParceiro}
            salvarItemCatalogo={salvarItemCatalogoAdmin} excluirItemCatalogo={excluirItemCatalogoAdmin}
            vales={vales} valesCarregando={valesCarregando}
            vendas={vendas} vendasCarregando={vendasCarregando} atualizarVenda={atualizarVenda}
            precos={precos} precosCarregando={precosCarregando} salvarPreco={salvarPreco} empreendimentosRef={empreendimentosRef}
            padronizarEmpreendimento={padronizarEmpreendimento} excluirCliente={delCliente}
            prospeccao={prospeccao} prospeccaoCarregando={prospeccaoCarregando} atualizarProspeccao={atualizarProspeccao}
            publicarProspeccaoDrive={publicarProspeccaoDrive}
            adicionarEmpreendimento={adicionarEmpreendimento} removerEmpreendimento={removerEmpreendimento}
            laudosPendentes={laudosPendentes} laudosPendentesCarregando={laudosPendentesCarregando} aprovarLaudo={aprovarLaudo} devolverLaudo={devolverLaudo} editarLaudo={editarLaudo} reenviarDrive={reenviarDrive} marcarEmAnalise={marcarEmAnalise}
      painel={painel} painelCarregando={painelCarregando} carregarPainel={carregarPainel}
            acessos={acessos} acessosCarregando={acessosCarregando}
            patologiasBanco={patologiasBanco} patologiasBancoCarregando={patologiasBancoCarregando}
            criarPatologia={criarPatologia} atualizarPatologia={atualizarPatologia} excluirPatologia={excluirPatologia}
            importarPatologiasEstaticas={importarPatologiasEstaticas} />
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
            {rascunhos.map((r) => <RascunhoLinha key={r.chave} r={r} onLoad={carregar} onDel={excluirRascunho} />)}
            <p style={{ fontSize: 12, color: "#8593a8", marginTop: 12 }}>
              As fotos ficam salvas no rascunho, no próprio aparelho. O rascunho automático é
              gravado sozinho enquanto você trabalha, mesmo sem internet.
            </p>
          </div>
        </div>
      )}

      {toast && <div className="no-print" style={toastStyle}><Check size={15} /> {toast}</div>}

      <ConfirmModal aberto={confirmandoDesbloqueio} titulo="Laudo em análise pela gerência"
        mensagem={"Este laudo já foi enviado e está sob responsabilidade da gerência, por isso não pode mais ser editado aqui. "
          + "Se algo precisa ser corrigido, peça à gerência que devolva o laudo para correção — assim a edição é reaberta "
          + "e o motivo da devolução fica registrado no histórico."}
        onConfirm={fecharAvisoBloqueio} onCancel={fecharAvisoBloqueio} />
    </div>
  );
}

function RascunhoLinha({ r, onLoad, onDel }) {
  const d = r.salvoEm ? new Date(r.salvoEm) : null;
  const quando = d && !Number.isNaN(d.getTime())
    ? d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", borderBottom: `1px solid ${CINZA_BORDA}` }}>
      <FileText size={15} color={r.automatico ? "#2E7D32" : AZUL_MEDIO} />
      <span style={{ flex: 1, fontSize: 14, minWidth: 0, overflowWrap: "anywhere" }}>
        {r.nome || "Rascunho"}
        {quando && <span style={{ color: "#8593a8", fontSize: 12 }}> · {quando}</span>}
        <span style={{ display: "block", fontSize: 11.5, color: "#8593a8" }}>
          {r.nItens} item(ns)
          {r.comFotos ? ` · ${r.nFotos} foto(s)` : " · sem fotos (rascunho antigo)"}
        </span>
      </span>
      <button className="btn-mini" onClick={() => onLoad(r.chave)}>Abrir</button>
      <button className="icon-btn" onClick={() => onDel(r.chave)}><Trash2 size={14} color="#c62828" /></button>
    </div>
  );
}


/* ================= Notificações: solicitações de clientes pendentes ================= */
function NotificacoesClientes({ clientes, preencherComCliente, style }) {
  // Documentação ART/TRT não tem vistoria: vai do cadastro direto para a Documentação.
  // Sem este filtro esses clientes apareciam aqui com "Iniciar vistoria", que não existe
  // para eles. Cancelado também sai — não faz sentido oferecer vistoria de algo cancelado.
  const pendentes = clientes
    .filter((c) => !c.atendido && !ehServicoDocumentacao(c) && c.status !== "Cancelado")
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
              {/* minWidth precisa ser 0 aqui: com o padrão (auto) o item flex nunca encolhe
                  abaixo do próprio conteúdo, e um nome muito longo empurrava a tela toda. */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{c.nome}</div>
                <div style={{ fontSize: 12.5, color: "#65758b" }}>
                  {c.servico} {c.empreendimento ? `· ${c.empreendimento}` : ""}{c.blocoTorre ? ` (${c.blocoTorre})` : ""}
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

/* ================= Calendário de acompanhamento do vistoriador ================= */
function paraChaveISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* Dashboard de calendário (visão mensal) — clicar num dia filtra a lista abaixo pra
   só os agendamentos daquele dia; sem dia selecionado, mostra tudo agrupado por data. */
function CalendarioMensal({ porData, mesRef, setMesRef, diaSelecionado, setDiaSelecionado }) {
  const ano = mesRef.getFullYear(), mes = mesRef.getMonth();
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const hojeISO = paraChaveISO(new Date());

  const celulas = [];
  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null);
  for (let dia = 1; dia <= totalDias; dia++) celulas.push(dia);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button className="icon-btn" onClick={() => setMesRef(new Date(ano, mes - 1, 1))}><ChevronLeft size={18} /></button>
        <strong style={{ fontSize: 14, color: AZUL_MARINHO, textTransform: "capitalize" }}>
          {mesRef.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
        </strong>
        <button className="icon-btn" onClick={() => setMesRef(new Date(ano, mes + 1, 1))}><ChevronRight size={18} /></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, fontSize: 11, color: "#8593a8", textAlign: "center", marginBottom: 4 }}>
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {celulas.map((dia, i) => {
          if (dia === null) return <div key={`vazio-${i}`} />;
          const chave = paraChaveISO(new Date(ano, mes, dia));
          const qtd = (porData[chave] || []).length;
          const selecionado = diaSelecionado === chave;
          const hoje = chave === hojeISO;
          return (
            <button key={chave} onClick={() => setDiaSelecionado(selecionado ? null : chave)}
              style={{
                aspectRatio: "1", border: `1px solid ${selecionado ? AZUL_MEDIO : CINZA_BORDA}`, borderRadius: 8,
                background: selecionado ? AZUL_MEDIO : hoje ? CINZA_CLARO : "#fff", color: selecionado ? "#fff" : "#1a2330",
                cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, padding: 2,
              }}>
              <span style={{ fontSize: 12.5, fontWeight: hoje ? 800 : 500 }}>{dia}</span>
              {qtd > 0 && (
                <span style={{ fontSize: 9.5, fontWeight: 700, color: selecionado ? "#fff" : AZUL_MEDIO }}>{qtd}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* Linha do tempo da vistoria como o técnico enxerga: Agendada → Em vistoria → Concluída
   (concluída = laudo já enviado para a gerência). Mesmo formato usado no Agendamento. */
function LinhaDoTempoTecnico({ etapaAtual }) {
  const indiceAtual = ETAPAS_TECNICO.indexOf(etapaAtual);
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 0, marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${CINZA_BORDA}` }}>
      {ETAPAS_TECNICO.map((label, i) => (
        <React.Fragment key={label}>
          <EtapaTempo label={label} cor={STATUS_COR[label]?.cor || AZUL_MEDIO} ativa={indiceAtual >= 0 && i <= indiceAtual} />
          {i < ETAPAS_TECNICO.length - 1 && <div style={{ height: 2, background: "#D8DEE7", flex: 0.6, marginTop: 6 }} />}
        </React.Fragment>
      ))}
    </div>
  );
}

/* Resumo da agenda do técnico: quantas vistorias em cada etapa do fluxo dele. */
function CardIndicadoresTecnico({ agenda = [] }) {
  const porEtapa = {};
  agenda.forEach((a) => { const e = etapaTecnico(a); porEtapa[e] = (porEtapa[e] || 0) + 1; });
  const hojeISO = paraChaveISO(new Date());
  const hoje = agenda.filter((a) => a.data_desejada === hojeISO).length;

  return (
    <Card icon={LayoutGrid} titulo="Minhas vistorias">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: AZUL_MARINHO, marginBottom: 8 }}>Por etapa</div>
          <div style={{ display: "grid", gap: 6 }}>
            {ETAPAS_TECNICO.map((etapa) => (
              <div key={etapa} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Selo valor={etapa} />
                <strong style={{ fontSize: 13 }}>{porEtapa[etapa] || 0}</strong>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: AZUL_MARINHO, marginBottom: 8 }}>Hoje</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: AZUL_MARINHO, lineHeight: 1 }}>{hoje}</div>
          <div style={{ fontSize: 12, color: "#65758b", marginTop: 4 }}>vistoria(s) marcada(s) para hoje</div>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: AZUL_MARINHO, marginBottom: 8 }}>Total atribuído</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: AZUL_MARINHO, lineHeight: 1 }}>{agenda.length}</div>
          <div style={{ fontSize: 12, color: "#65758b", marginTop: 4 }}>encaminhadas pelo Atendimento</div>
        </div>
      </div>
    </Card>
  );
}

function CalendarioVistoriador({ agenda = [], carregando, clientes = [], preencherComCliente }) {
  const [mesRef, setMesRef] = useState(() => { const h = new Date(); return new Date(h.getFullYear(), h.getMonth(), 1); });
  const [diaSelecionado, setDiaSelecionado] = useState(null);

  // O backend já exclui cancelados; aqui é só proteção contra dados carregados antes do
  // cancelamento (a agenda não fica recarregando sozinha).
  const porData = agenda.reduce((acc, a) => {
    if (a.status === "Cancelado" || a.status === "Cancelamento solicitado") return acc;
    const k = a.data_desejada || "(sem data)";
    (acc[k] = acc[k] || []).push(a);
    return acc;
  }, {});
  const datasOrdenadas = Object.keys(porData).filter((d) => !diaSelecionado || d === diaSelecionado).sort();

  const fmtDataLonga = (d) => {
    if (!d || d === "(sem data)") return "Sem data definida";
    return new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <CardIndicadoresTecnico agenda={agenda} />

      <Card icon={CalendarDays} titulo="Minha agenda">
        <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 14px" }}>
          Vistorias que o Atendimento encaminhou para você. Clique num dia do calendário pra ver só os agendamentos daquela data.
          Uma vistoria só fica "Concluída" depois que você envia o laudo para a gerência.
        </p>

        <CalendarioMensal porData={porData} mesRef={mesRef} setMesRef={setMesRef} diaSelecionado={diaSelecionado} setDiaSelecionado={setDiaSelecionado} />

        {diaSelecionado && (
          <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO, marginBottom: 14 }} onClick={() => setDiaSelecionado(null)}>
            <X size={14} /> Ver todos os dias
          </button>
        )}

        {carregando && <p style={{ color: "#8593a8", fontSize: 14 }}>Carregando…</p>}
        {!carregando && agenda.length === 0 && <p style={{ color: "#8593a8", fontSize: 14 }}>Nenhuma vistoria atribuída a você ainda.</p>}
        {!carregando && agenda.length > 0 && datasOrdenadas.length === 0 && <p style={{ color: "#8593a8", fontSize: 14 }}>Nenhum agendamento nesse dia.</p>}

        {datasOrdenadas.map((data) => (
          <div key={data} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: AZUL_MARINHO, marginBottom: 8, textTransform: "capitalize", borderBottom: `2px solid ${CINZA_CLARO}`, paddingBottom: 6 }}>
              {fmtDataLonga(data)}
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {porData[data].map((a) => (
                <div key={a.id} style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ width: 56, textAlign: "center", flexShrink: 0, fontSize: 15, fontWeight: 800, color: AZUL_MEDIO }}>
                      {a.horario_desejado || "—"}
                    </div>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{a.nome}</div>
                      <div style={{ fontSize: 12.5, color: "#65758b" }}>
                        {a.servico}{a.empreendimento ? ` · ${a.empreendimento}` : ""}{a.bloco_torre ? ` (${a.bloco_torre})` : ""}
                      </div>
                    </div>
                    <Selo valor={etapaTecnico(a)} />
                    {preencherComCliente && !a.laudo_enviado && (
                      <button className="btn-solid" style={{ width: "auto", padding: "8px 14px" }}
                        onClick={() => {
                          const cli = clientes.find((c) => c.id === a.id);
                          if (cli) preencherComCliente(cli, { irParaItens: true });
                        }}>
                        <Check size={14} /> {a.status === "Em vistoria" ? "Continuar vistoria" : "Iniciar vistoria"}
                      </button>
                    )}
                  </div>
                  <LinhaDoTempoTecnico etapaAtual={etapaTecnico(a)} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ================= Aba: Clientes (perfil Comercial) ================= */
/* A ordem das colunas do Kanban e dos contadores vem de ETAPAS_CLIENTE, que segue as mesmas
   etapas dos "Indicadores do Agendamento". */

function KanbanClientes({ clientes, docs, onAbrir }) {
  const porEtapa = {};
  clientes.forEach((c) => {
    const et = etapaClienteCompleta(c, docs);
    (porEtapa[et] = porEtapa[et] || []).push(c);
  });
  const etapas = [...ETAPAS_CLIENTE.filter((e) => porEtapa[e]), ...Object.keys(porEtapa).filter((e) => !ETAPAS_CLIENTE.includes(e))];

  return (
    <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
      {etapas.map((etapa) => (
        <div key={etapa} style={{ minWidth: 260, width: 260, flexShrink: 0, background: CINZA_CLARO, borderRadius: 12, padding: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, padding: "0 4px" }}>
            <Selo valor={etapa} />
            <strong style={{ fontSize: 13, color: "#65758b" }}>{porEtapa[etapa].length}</strong>
          </div>
          <div style={{ display: "grid", gap: 8, maxHeight: 560, overflowY: "auto" }}>
            {porEtapa[etapa].map((c) => (
              <button key={c.id} onClick={() => onAbrir(c)}
                style={{ textAlign: "left", background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: 10, cursor: "pointer" }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{c.nome}</div>
                <div style={{ fontSize: 12, color: "#65758b", marginTop: 2 }}>
                  {c.empreendimento || "—"}{c.blocoTorre ? ` · ${c.blocoTorre}` : ""}
                </div>
                <div style={{ fontSize: 11.5, color: "#8593a8", marginTop: 4 }}>
                  {c.dataDesejada ? c.dataDesejada.split("-").reverse().join("/") : "sem data"}{c.horarioDesejado ? ` · ${c.horarioDesejado}` : ""}
                </div>
                {c.observacoes && (
                  <div style={{ fontSize: 11.5, color: "#9AA6B5", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.observacoes}
                  </div>
                )}
              </button>
            ))}
            {porEtapa[etapa].length === 0 && <span style={{ fontSize: 12, color: "#9AA6B5", padding: "0 4px" }}>Vazio</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ================= Repasse de ART/TRT para a Documentação =================
   Documentação ART/TRT não tem vistoria, então esses cadastros não entram na fila do
   Atendimento. Mas alguém precisa reparar que chegaram e passar adiante — antes eles
   simplesmente apareciam na aba da Documentação sem que ninguém do Atendimento soubesse.
   Aqui o Atendimento vê o que chegou, confere e repassa. O repasse fica registrado. */
function CardEncaminharDocumentacao({ clientes = [], atualizarCliente, notify }) {
  const [enviando, setEnviando] = useState(null);

  const art = clientes.filter((c) => ehServicoDocumentacao(c) && c.status !== "Cancelado");
  const aguardando = art.filter((c) => !c.encaminhadoDocumentacao);
  const jaEncaminhados = art.filter((c) => c.encaminhadoDocumentacao);

  if (art.length === 0) return null;

  const encaminhar = async (c) => {
    setEnviando(c.id);
    try {
      await atualizarCliente(c.id, { encaminhadoDocumentacao: true });
      notify(`${c.nome} encaminhado para a Documentação \u2713`);
    } catch (e) { notify(`Não foi possível encaminhar: ${e.message}`); }
    setEnviando(null);
  };

  return (
    <Card icon={ClipboardList} titulo={`Documentação ART/TRT (${aguardando.length} a encaminhar)`}>
      <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 14px" }}>
        Estes clientes pediram Documentação ART/TRT. Eles não passam por vistoria, por isso
        ficam fora da fila acima. Confira os dados e repasse para o setor de Documentação.
      </p>

      {aguardando.length === 0 && (
        <p style={{ fontSize: 13.5, color: "#2E7D32", margin: "0 0 12px" }}>
          ✓ Todos os cadastros de ART/TRT já foram encaminhados.
        </p>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        {aguardando.map((c) => (
          <div key={c.id} style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 190 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{c.nome}</div>
              <div style={{ fontSize: 12.5, color: "#65758b" }}>
                {c.empreendimento || c.endereco || "—"}{c.blocoTorre ? ` · ${c.blocoTorre}` : ""}
                {c.telefone ? ` · ${c.telefone}` : ""}
              </div>
            </div>
            <button className="btn-solid" style={{ width: "auto", padding: "8px 14px" }}
              onClick={() => encaminhar(c)} disabled={enviando === c.id}>
              {enviando === c.id ? <Loader2 size={14} className="spin" /> : <Send size={14} />} Encaminhar
            </button>
          </div>
        ))}
      </div>

      {jaEncaminhados.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${CINZA_BORDA}`, fontSize: 12.5, color: "#65758b" }}>
          <strong style={{ color: "#2E7D32" }}>{jaEncaminhados.length}</strong> já encaminhado(s):{" "}
          {jaEncaminhados.map((c) => c.nome).join(" · ")}
        </div>
      )}
    </Card>
  );
}

/* Caminho manual de "esqueci minha senha": o cliente liga no WhatsApp, a Gerência define uma
   senha nova aqui e passa por telefone/WhatsApp. Funciona também pra quem nunca teve senha
   (cria a conta na hora, sem precisar do fluxo de e-mail). */
function ModalResetarSenhaCliente({ cliente, resetarSenhaCliente, notify, onFechar }) {
  const [senha, setSenha] = useState("");
  const [salvando, setSalvando] = useState(false);

  const confirmar = async () => {
    if (senha.length < 6) { notify("A senha precisa ter no mínimo 6 caracteres"); return; }
    setSalvando(true);
    const ok = await resetarSenhaCliente(cliente.id, senha);
    setSalvando(false);
    if (ok) { notify("Senha do portal atualizada ✓"); onFechar(); }
  };

  return (
    <div className="no-print" style={overlay} onClick={onFechar}>
      <div style={{ ...modal, maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <strong>Resetar senha do portal</strong>
          <button className="icon-btn" onClick={onFechar}><X size={16} /></button>
        </div>
        <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 14px" }}>
          Defina uma senha nova para <strong>{cliente.nome}</strong> e passe para ele por telefone
          ou WhatsApp. Ela substitui a anterior imediatamente.
        </p>
        <div style={cell(true)}>
          <label style={lab}>Nova senha</label>
          <input style={inp} type="text" placeholder="mínimo 6 caracteres" value={senha} onChange={(e) => setSenha(e.target.value)} autoFocus />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO }} onClick={onFechar}>Cancelar</button>
          <button className="btn-solid" onClick={confirmar} disabled={salvando}>
            {salvando ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function AbaClientesComercial({ clientes, carregando, atualizarCliente, excluirCliente, resetarSenhaCliente, notify, docs = [], perfil }) {
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState(null); // cópia do cliente em edição
  const [visualizacao, setVisualizacao] = useState("kanban"); // "kanban" | "tabela"
  const [cpfsRevelados, setCpfsRevelados] = useState({}); // { [clienteId]: true } — revelação é por sessão, não persiste
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(null); // cliente a excluir definitivamente
  const [resetandoSenha, setResetandoSenha] = useState(null); // cliente cuja senha do portal está sendo resetada
  const podeVerCpfDireto = perfil === "gerencia";
  const podeExcluir = perfil === "gerencia";
  const alternarCpfRevelado = (id) => setCpfsRevelados((s) => ({ ...s, [id]: !s[id] }));

  /* Ordem da lista: por data de agendamento, da mais próxima para a mais distante.
     Quem não tem data marcada (o caso da Documentação ART/TRT, que não passa por
     vistoria) vai para o fim — não é atraso, é serviço de outro fluxo. */
  const chaveData = (c) =>
    c.dataDesejada ? `${c.dataDesejada} ${c.horarioDesejado || "00:00"}` : null;

  /* Documentação ART/TRT não entra aqui: esse serviço não tem vistoria, então não tem dia
     nem horário para ordenar, e ficava no meio da fila sem significar nada. O setor de
     Documentação tem a aba própria dele, que é onde esses cadastros são trabalhados. */
  const daVistoria = clientes.filter((c) => !ehServicoDocumentacao(c));

  const filtrados = daVistoria
    .filter((c) =>
      !busca || `${c.nome} ${c.empreendimento} ${c.construtora}`.toLowerCase().includes(busca.toLowerCase())
    )
    .sort((a, b) => {
      const da = chaveData(a), db = chaveData(b);
      if (da && db) return da.localeCompare(db);
      if (da) return -1;
      if (db) return 1;
      return (a.nome || "").localeCompare(b.nome || "", "pt-BR");
    });

  const abrirEdicao = (c) => setEditando({ ...c });
  const salvar = async () => {
    try {
      await atualizarCliente(editando.id, editando);
      setEditando(null);
      notify("Cliente atualizado ✓");
    } catch (e) { notify(`Erro: ${e.message}`); }
  };
  const confirmarExclusao = async () => {
    const c = confirmandoExclusao;
    setConfirmandoExclusao(null);
    if (editando?.id === c.id) setEditando(null);
    try { await excluirCliente(c.id); } catch (e) { notify(`Erro: ${e.message}`); }
  };

  // Mesmas etapas dos "Indicadores do Agendamento", na mesma ordem, mais os casos fora do
  // fluxo de vistoria (ART/TRT e cancelados) — ver ETAPAS_CLIENTE.
  const contagemPorEtapa = {};
  daVistoria.forEach((c) => { const et = etapaClienteCompleta(c, docs); contagemPorEtapa[et] = (contagemPorEtapa[et] || 0) + 1; });
  const etapasComClientes = ETAPAS_CLIENTE.filter((e) => contagemPorEtapa[e]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {etapasComClientes.length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {etapasComClientes.map((etapa) => (
            <div key={etapa} style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: "8px 12px" }}>
              <Selo valor={etapa} />
              <strong style={{ fontSize: 14 }}>{contagemPorEtapa[etapa]}</strong>
            </div>
          ))}
        </div>
      )}
      <CardEncaminharDocumentacao clientes={clientes} atualizarCliente={atualizarCliente} notify={notify} />

      <Card icon={Users} titulo={`Clientes cadastrados (${daVistoria.length})`}>
        <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 12px" }}>
          Cadastro, agendamento e acompanhamento de todos os clientes que já se cadastraram (pelo portal público) ou foram cadastrados pela equipe.
        </p>
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <input style={{ ...inp, flex: 1, minWidth: 200 }} placeholder="Buscar por nome, empreendimento ou construtora…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <div style={{ display: "flex", border: `1px solid ${CINZA_BORDA}`, borderRadius: 8, overflow: "hidden" }}>
            <button onClick={() => setVisualizacao("kanban")} style={{ padding: "8px 14px", border: "none", cursor: "pointer", fontSize: 13, background: visualizacao === "kanban" ? AZUL_MEDIO : "#fff", color: visualizacao === "kanban" ? "#fff" : "#4a5a70" }}>
              <LayoutGrid size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} /> Kanban
            </button>
            <button onClick={() => setVisualizacao("tabela")} style={{ padding: "8px 14px", border: "none", cursor: "pointer", fontSize: 13, background: visualizacao === "tabela" ? AZUL_MEDIO : "#fff", color: visualizacao === "tabela" ? "#fff" : "#4a5a70" }}>
              <ClipboardList size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} /> Tabela
            </button>
          </div>
        </div>

        {carregando && <p style={{ color: "#8593a8", fontSize: 14 }}>Carregando…</p>}
        {!carregando && filtrados.length === 0 && <p style={{ color: "#8593a8", fontSize: 14 }}>Nenhum cliente encontrado.</p>}

        {filtrados.length > 0 && visualizacao === "kanban" && (
          <KanbanClientes clientes={filtrados} docs={docs} onAbrir={abrirEdicao} />
        )}

        {filtrados.length > 0 && visualizacao === "tabela" && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: CINZA_CLARO }}>
                  {["Cliente", "CPF", "Empreendimento", "Serviço", "Agendamento", "Status", ""].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: AZUL_MARINHO, borderBottom: `2px solid ${CINZA_BORDA}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr key={c.id} style={{ borderBottom: `1px solid ${CINZA_BORDA}` }}>
                    <td style={{ padding: "8px 10px", fontWeight: 600 }}>{c.nome}<div style={{ fontWeight: 400, fontSize: 12, color: "#8593a8" }}>{c.telefone}</div></td>
                    <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                      {c.cpf ? (
                        podeVerCpfDireto || cpfsRevelados[c.id] ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                            {c.cpf}
                            {!podeVerCpfDireto && (
                              <button className="icon-btn" style={{ padding: 2 }} title="Ocultar CPF" onClick={() => alternarCpfRevelado(c.id)}>
                                <EyeOff size={13} color="#8593a8" />
                              </button>
                            )}
                          </span>
                        ) : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                            {mascararCpf(c.cpf)}
                            <button className="icon-btn" style={{ padding: 2 }} title="Revelar CPF completo" onClick={() => alternarCpfRevelado(c.id)}>
                              <Eye size={13} color={AZUL_MEDIO} />
                            </button>
                          </span>
                        )
                      ) : "—"}
                    </td>
                    <td style={{ padding: "8px 10px" }}>{c.empreendimento || "—"}{c.blocoTorre ? ` · ${c.blocoTorre}` : ""}</td>
                    <td style={{ padding: "8px 10px" }}>{c.servico || "—"}</td>
                    <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                      {c.dataDesejada ? c.dataDesejada.split("-").reverse().join("/") : "sem data"}{c.horarioDesejado ? ` · ${c.horarioDesejado}` : ""}
                    </td>
                    <td style={{ padding: "8px 10px" }}><Selo valor={etapaClienteCompleta(c, docs)} /></td>
                    <td style={{ padding: "8px 10px" }}>
                      <button className="icon-btn" onClick={() => abrirEdicao(c)}><Edit3 size={15} color={AZUL_MEDIO} /></button>
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
          <div style={{ ...modal, maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <strong>Editar cliente</strong>
              <button className="icon-btn" onClick={() => setEditando(null)}><X size={16} /></button>
            </div>
            <Grid>
              <Field label="Nome" value={editando.nome} onChange={(v) => setEditando({ ...editando, nome: v })} full />
              <Field label="CPF" value={editando.cpf} onChange={(v) => setEditando({ ...editando, cpf: v })} />
              <Field label="Telefone" value={editando.telefone} onChange={(v) => setEditando({ ...editando, telefone: v })} />
              <Field label="E-mail" value={editando.email} onChange={(v) => setEditando({ ...editando, email: v })} />
              <div style={cell(true)}>
                <label style={lab}>Serviço desejado</label>
                <select style={inp} value={editando.servico} onChange={(e) => setEditando({ ...editando, servico: e.target.value })}>
                  {SERVICO_OPCOES.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <Field label="Construtora" value={editando.construtora} onChange={(v) => setEditando({ ...editando, construtora: v })} />
              <Field label="Empreendimento" value={editando.empreendimento} onChange={(v) => setEditando({ ...editando, empreendimento: v })} />
              <Field label="Endereço completo" value={editando.endereco} onChange={(v) => setEditando({ ...editando, endereco: v })} full />
              <Field label="CEP" value={editando.cep} onChange={(v) => setEditando({ ...editando, cep: v })} />
              <Field label="Bloco / Apto" value={editando.blocoTorre} onChange={(v) => setEditando({ ...editando, blocoTorre: v })} />
              <Field label="Data desejada" type="date" value={editando.dataDesejada} onChange={(v) => setEditando({ ...editando, dataDesejada: v })} />
              <div style={cell(false)}>
                <label style={lab}>Horário desejado</label>
                <select style={inp} value={editando.horarioDesejado || ""} onChange={(e) => setEditando({ ...editando, horarioDesejado: e.target.value })}>
                  <option value="">selecionar…</option>
                  {/* Mantém um horário fora do comercial que já esteja salvo, pra não perder dado. */}
                  {editando.horarioDesejado && !HORARIOS_COMERCIAIS.includes(editando.horarioDesejado) && (
                    <option value={editando.horarioDesejado}>{editando.horarioDesejado} (fora do horário comercial)</option>
                  )}
                  {HORARIOS_COMERCIAIS.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div style={cell(true)}>
                <label style={lab}>Status do agendamento</label>
                <select style={inp} value={editando.atendido ? "1" : "0"} onChange={(e) => setEditando({ ...editando, atendido: e.target.value === "1" })}>
                  <option value="0">Agendado / pendente</option>
                  <option value="1">Concluído</option>
                </select>
              </div>
            </Grid>
            <Area label="Observações" value={editando.observacoes} onChange={(v) => setEditando({ ...editando, observacoes: v })} rows={2} />
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 8 }}>
                {podeExcluir && (
                  <button className="btn-ghost" style={{ color: "#C62828" }} onClick={() => setConfirmandoExclusao(editando)}>
                    <Trash2 size={15} /> Excluir cliente
                  </button>
                )}
                {podeExcluir && resetarSenhaCliente && (
                  <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO }} onClick={() => setResetandoSenha(editando)}>
                    <Lock size={15} /> Resetar senha do portal
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO }} onClick={() => setEditando(null)}>Cancelar</button>
                <button className="btn-solid" onClick={salvar}><Save size={15} /> Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal aberto={!!confirmandoExclusao}
        titulo="Excluir cliente"
        mensagem={`Tem certeza que deseja excluir o cadastro de "${confirmandoExclusao?.nome || ""}"? Essa ação não pode ser desfeita.`}
        onConfirm={confirmarExclusao} onCancel={() => setConfirmandoExclusao(null)} />

      {resetandoSenha && (
        <ModalResetarSenhaCliente cliente={resetandoSenha} resetarSenhaCliente={resetarSenhaCliente}
          notify={notify} onFechar={() => setResetandoSenha(null)} />
      )}
    </div>
  );
}

/* ================= Estrelas (exibição e seleção) ================= */
function Estrelas({ valor, onChange, tamanho = 18 }) {
  const interativo = !!onChange;
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={tamanho}
          fill={n <= valor ? "#F5A623" : "none"} color={n <= valor ? "#F5A623" : "#C9D2DE"}
          style={{ cursor: interativo ? "pointer" : "default" }}
          onClick={() => interativo && onChange(n)} />
      ))}
    </div>
  );
}

/* ================= Aba: Qualidade (avaliações dos clientes) ================= */
function EtapaTempo({ label, cor, ativa }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1, minWidth: 70 }}>
      <div style={{ width: 14, height: 14, borderRadius: "50%", background: ativa ? cor : "#E3E8EF", border: `2px solid ${ativa ? cor : "#C9D2DE"}` }} />
      <div style={{ fontSize: 10.5, color: ativa ? AZUL_MARINHO : "#9AA6B5", textAlign: "center", fontWeight: ativa ? 700 : 400 }}>{label}</div>
    </div>
  );
}
/* Linha do tempo com as mesmas 4 etapas dos "Indicadores do Agendamento" (ETAPAS_VISTORIA),
   pra que o acompanhamento conte a mesma história que os números lá de cima. As etapas já
   percorridas ficam acesas; as que faltam, apagadas. */
function LinhaDoTempo({ etapaAtual }) {
  const indiceAtual = ETAPAS_VISTORIA.indexOf(etapaAtual);
  const etapas = ETAPAS_VISTORIA.map((label, i) => ({
    label,
    cor: STATUS_COR[label]?.cor || AZUL_MEDIO,
    ativa: indiceAtual >= 0 && i <= indiceAtual,
  }));
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 0, marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${CINZA_BORDA}` }}>
      {etapas.map((e, i) => (
        <React.Fragment key={e.label}>
          <EtapaTempo {...e} />
          {i < etapas.length - 1 && <div style={{ height: 2, background: "#D8DEE7", flex: 0.6, marginTop: 6 }} />}
        </React.Fragment>
      ))}
    </div>
  );
}

/* Dispatcher das 3 sub-abas do setor Qualidade (mesmo padrão de "sub" já usado em AbaGerencia). */
/* Dashboard de indicadores visível nas 3 sub-abas de Qualidade: etapa do fluxo dos
   clientes, status do bloco ART Documentações, e média das avaliações dos clientes. */
function CardIndicadoresQualidade({ clientes = [], docs = [], avaliacoes = [], filtroEtapa, aoTrocarEtapa }) {
  const porEtapa = {};
  clientes.forEach((c) => { const et = etapaVistoriaCliente(c, docs); if (et) porEtapa[et] = (porEtapa[et] || 0) + 1; });

  const porStatusProducao = {};
  docs.forEach((d) => { porStatusProducao[d.statusProducao] = (porStatusProducao[d.statusProducao] || 0) + 1; });

  const totalAvaliacoes = avaliacoes.length;
  const media = totalAvaliacoes ? (avaliacoes.reduce((s, a) => s + a.nota, 0) / totalAvaliacoes) : 0;

  return (
    <Card icon={LayoutGrid} titulo="Indicadores do Agendamento">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: AZUL_MARINHO }}>Clientes por etapa do fluxo</div>
            {filtroEtapa && (
              <button className="btn-ghost" style={{ color: AZUL_MEDIO, background: CINZA_CLARO, padding: "2px 8px", fontSize: 11.5 }}
                onClick={() => aoTrocarEtapa(null)}>
                <X size={11} /> Limpar
              </button>
            )}
          </div>
          {/* Clicar numa etapa filtra a lista logo abaixo; clicar de novo na mesma limpa. */}
          <div style={{ display: "grid", gap: 6 }}>
            {ETAPAS_VISTORIA.map((etapa) => {
              const ativo = filtroEtapa === etapa;
              const clicavel = !!aoTrocarEtapa;
              return (
                <button key={etapa} onClick={() => clicavel && aoTrocarEtapa(ativo ? null : etapa)}
                  aria-pressed={ativo} disabled={!clicavel}
                  title={clicavel ? (ativo ? "Clique para mostrar todas" : `Mostrar só: ${etapa}`) : undefined}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, width: "100%",
                    background: ativo ? "#EAF2FB" : "transparent",
                    border: `1.5px solid ${ativo ? AZUL_MEDIO : "transparent"}`,
                    borderRadius: 8, padding: "3px 6px", cursor: clicavel ? "pointer" : "default", textAlign: "left",
                  }}>
                  <Selo valor={etapa} />
                  <strong style={{ fontSize: 13, color: ativo ? AZUL_MARINHO : "inherit" }}>{porEtapa[etapa] || 0}</strong>
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: AZUL_MARINHO, marginBottom: 8 }}>ART/TRT Documentações por status</div>
          <div style={{ display: "grid", gap: 6 }}>
            {STATUS_PRODUCAO_OPCOES.map((s) => (
              <div key={s} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Selo valor={s} />
                <strong style={{ fontSize: 13 }}>{porStatusProducao[s] || 0}</strong>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: AZUL_MARINHO, marginBottom: 8 }}>Avaliações dos clientes</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: AZUL_MARINHO }}>{media.toFixed(1)}</div>
            <div>
              <Estrelas valor={Math.round(media)} tamanho={16} />
              <div style={{ fontSize: 12, color: "#65758b" }}>{totalAvaliacoes} avaliação(ões)</div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function AbaQualidade({ sub = "analise", setSub, clientes, clientesCarregando, updCliente, usuarios, notify, preencherComCliente, avaliacoes, carregando, docs, docsCarregando, aprovarAvaliacao, solicitarExclusaoAvaliacao, manterAvaliacao, excluirAvaliacao, agendarAgoraId, setAgendarAgoraId, podeAgir = false, ehGerencia = false }) {
  const [diaParaAbrir, setDiaParaAbrir] = useState(null); // data (ISO) que o calendário da Análise deve abrir já selecionada
  // Etapa escolhida nos indicadores — filtra a lista da sub-aba aberta. Fica aqui (e não em
  // cada sub-aba) pra que o filtro continue valendo ao trocar de sub-aba.
  const [filtroEtapa, setFiltroEtapa] = useState(null);
  const irParaAgendamento = (clienteId) => {
    setAgendarAgoraId(clienteId);
    setSub("vistoria");
  };
  // Confirmou a vistoria na sub-aba Vistoria -> volta pra Análise já com o calendário
  // no mês certo e o painel do dia aberto, sem precisar navegar manualmente.
  const aoConfirmarVistoria = (dataISO) => {
    setDiaParaAbrir(dataISO);
    setSub("analise");
  };
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <CardIndicadoresQualidade clientes={clientes} docs={docs} avaliacoes={avaliacoes}
        filtroEtapa={filtroEtapa} aoTrocarEtapa={setFiltroEtapa} />
      {!podeAgir && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#EAF2FB", color: AZUL_MARINHO, borderRadius: 8, padding: "8px 12px", fontSize: 12.5 }}>
          <Info size={14} /> Modo leitura — aprovar agendamento, encaminhar técnico e aprovar feedback agora é exclusivo do perfil Atendimento.
        </div>
      )}
      {sub === "vistoria" && <AbaQualidadeVistoria clientes={clientes} docs={docs} carregando={clientesCarregando} updCliente={updCliente} usuarios={usuarios} notify={notify} podeAgir={podeAgir} abrirAutomaticoId={agendarAgoraId} aoAbrirAutomatico={() => setAgendarAgoraId(null)} aoConfirmar={aoConfirmarVistoria} filtroEtapa={filtroEtapa} />}
      {sub === "acompanhamento" && <AbaQualidadeAcompanhamento clientes={clientes} clientesCarregando={clientesCarregando}
        docs={docs} avaliacoes={avaliacoes} filtroEtapa={filtroEtapa} />}
      {sub === "feedback" && <AbaQualidadeFeedback avaliacoes={avaliacoes} carregando={carregando} clientes={clientes} clientesCarregando={clientesCarregando} docs={docs} docsCarregando={docsCarregando} aprovarAvaliacao={aprovarAvaliacao}
        solicitarExclusaoAvaliacao={solicitarExclusaoAvaliacao} manterAvaliacao={manterAvaliacao} excluirAvaliacao={excluirAvaliacao} podeAgir={podeAgir} ehGerencia={ehGerencia} filtroEtapa={filtroEtapa} />}
      {sub === "analise" && <AbaQualidadeAnalise clientes={clientes} docs={docs} carregando={clientesCarregando} updCliente={updCliente} usuarios={usuarios} notify={notify} podeAgir={podeAgir} onAgendarAgora={irParaAgendamento} diaParaAbrir={diaParaAbrir} aoAbrirDia={() => setDiaParaAbrir(null)} filtroEtapa={filtroEtapa} aoTrocarEtapa={setFiltroEtapa} />}
    </div>
  );
}

/* ================= Acompanhamento do atendimento =================
   Saiu de dentro do Feedback e virou aba própria. Era a lista mais consultada do
   Agendamento e ficava enterrada embaixo das avaliações: quem queria só ver em que pé
   está cada cliente precisava rolar a página inteira. As duas coisas não têm relação —
   uma é a satisfação de quem já foi atendido, a outra é a fila de quem está sendo. */
/* Rótulo curto de cada critério, para a equipe ler a nota detalhada sem decorar chave. */
const ROTULO_CRITERIO = {
  pontualidade: "Pontualidade", atendimento: "Atendimento",
  clareza: "Clareza", prazo: "Prazo",
};

/* Notas por critério de uma avaliação. Só aparece nas avaliações novas — as antigas
   guardaram uma nota única e continuam mostrando só ela. */
function NotasPorCriterio({ notas }) {
  const itens = notas && typeof notas === "object" ? Object.entries(notas) : [];
  if (itens.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
      {itens.map(([chave, valor]) => (
        <span key={chave} style={{ fontSize: 12, color: "#65758b", display: "flex", alignItems: "center", gap: 4 }}>
          {ROTULO_CRITERIO[chave] || chave}
          <strong style={{ color: AZUL_MARINHO }}>{valor}</strong>
          <Star size={11} color="#E8A317" fill="#E8A317" />
        </span>
      ))}
    </div>
  );
}

function AbaQualidadeAcompanhamento({ clientes = [], clientesCarregando, docs = [], avaliacoes = [], filtroEtapa = null }) {
  const [busca, setBusca] = useState("");

  const avaliacaoPorDoc = {};
  avaliacoes.forEach((a) => { if (a.doc_id) avaliacaoPorDoc[a.doc_id] = a; });
  const docDoCliente = (c) => {
    const cpfLimpo = (c.cpf || "").replace(/\D/g, "");
    return cpfLimpo ? docs.find((d) => (d.cpf || "").replace(/\D/g, "") === cpfLimpo) : null;
  };

  const termo = busca.trim().toLowerCase();
  const clientesPorEtapa = {};
  clientes.forEach((c) => {
    if (termo && !`${c.nome} ${c.empreendimento}`.toLowerCase().includes(termo)) return;
    const etapa = etapaVistoriaCliente(c, docs);
    if (!etapa) return;
    if (filtroEtapa && etapa !== filtroEtapa) return; // filtro vindo do clique nos indicadores
    (clientesPorEtapa[etapa] = clientesPorEtapa[etapa] || []).push(c);
  });
  const totalAcompanhamento = Object.values(clientesPorEtapa).reduce((s, l) => s + l.length, 0);

  return (
    <div style={{ display: "grid", gap: 16 }}>
        <Card icon={ClipboardCheck} titulo="Acompanhamento do atendimento — do início ao fim">
          <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 12px" }}>
            Cada cliente separado pela etapa em que está agora — as mesmas etapas contadas nos indicadores acima.
          </p>
          <input style={{ ...inp, marginBottom: 14 }} placeholder="Buscar por cliente ou empreendimento…" value={busca} onChange={(e) => setBusca(e.target.value)} />

          {clientesCarregando && <p style={{ color: "#8593a8", fontSize: 14 }}>Carregando…</p>}
          {!clientesCarregando && totalAcompanhamento === 0 && <p style={{ color: "#8593a8", fontSize: 14 }}>Nenhum atendimento encontrado.</p>}

          <div style={{ display: "grid", gap: 20 }}>
            {ETAPAS_VISTORIA.map((etapa) => {
              const daEtapa = clientesPorEtapa[etapa] || [];
              if (daEtapa.length === 0) return null;
              return (
                <div key={etapa}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, borderBottom: `2px solid ${CINZA_CLARO}`, paddingBottom: 6 }}>
                    <Selo valor={etapa} />
                    <strong style={{ fontSize: 13, color: AZUL_MARINHO }}>{daEtapa.length}</strong>
                  </div>
                  <div style={{ display: "grid", gap: 14 }}>
                    {daEtapa.map((c) => {
                      const doc = docDoCliente(c);
                      const avaliacao = doc ? avaliacaoPorDoc[doc.id] : null;
                      return (
                        <div key={c.id} style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                            <strong style={{ fontSize: 14 }}>{c.nome || "—"}</strong>
                            <span style={{ fontSize: 12, color: "#65758b" }}>{c.empreendimento}{c.blocoTorre ? ` · ${c.blocoTorre}` : ""}</span>
                          </div>
                          <LinhaDoTempo etapaAtual={etapa} />
                          {avaliacao && (
                            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                              <Estrelas valor={avaliacao.nota} tamanho={13} />
                              {avaliacao.comentario && <span style={{ fontSize: 12.5, color: "#65758b" }}>"{avaliacao.comentario}"</span>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
    </div>
  );
}

function AbaQualidadeFeedback({ avaliacoes, carregando, aprovarAvaliacao, solicitarExclusaoAvaliacao, manterAvaliacao, excluirAvaliacao, podeAgir = false, ehGerencia = false }) {
  const total = avaliacoes.length;
  const media = total ? (avaliacoes.reduce((s, a) => s + a.nota, 0) / total) : 0;
  const contagemPorNota = [5, 4, 3, 2, 1].map((n) => ({ n, qtd: avaliacoes.filter((a) => a.nota === n).length }));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card icon={Star} titulo="Avaliações dos clientes">
        {carregando && <p style={{ color: "#8593a8", fontSize: 14 }}>Carregando…</p>}
        {!carregando && total === 0 && <p style={{ color: "#8593a8", fontSize: 14 }}>Nenhuma avaliação recebida ainda. Elas aparecem aqui assim que o cliente avalia o atendimento pelo portal público.</p>}

        {total > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 34, fontWeight: 800, color: AZUL_MARINHO, lineHeight: 1 }}>{media.toFixed(1)}</div>
                <Estrelas valor={Math.round(media)} />
                <div style={{ fontSize: 12, color: "#65758b", marginTop: 4 }}>{total} avaliação(ões)</div>
              </div>
              <div style={{ flex: 1, minWidth: 200, display: "grid", gap: 4 }}>
                {contagemPorNota.map(({ n, qtd }) => (
                  <div key={n} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, width: 14 }}>{n}</span>
                    <div style={{ flex: 1, height: 8, background: CINZA_CLARO, borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${total ? (qtd / total) * 100 : 0}%`, height: "100%", background: "#F5A623" }} />
                    </div>
                    <span style={{ fontSize: 12, width: 20, textAlign: "right" }}>{qtd}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {avaliacoes.map((a) => (
                <div key={a.id} style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
                    <strong style={{ fontSize: 14 }}>{a.cliente || "Cliente"}</strong>
                    <Estrelas valor={a.nota} tamanho={15} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                    {a.servico && (
                      <span style={{ background: "#EAF2FB", color: AZUL_MARINHO, borderRadius: 20, padding: "2px 10px", fontSize: 11.5, fontWeight: 700 }}>
                        {a.servico}
                      </span>
                    )}
                    {a.empreendimento && <span style={{ fontSize: 12, color: "#65758b" }}>{a.empreendimento}</span>}
                  </div>
                  <NotasPorCriterio notas={a.notas} />
                  {a.comentario && <div style={{ fontSize: 13.5, color: "#334", background: CINZA_CLARO, borderRadius: 8, padding: "8px 10px", marginBottom: 8 }}>{a.comentario}</div>}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {podeAgir && aprovarAvaliacao ? (
                      a.aprovado ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                          <span style={{ fontSize: 12, color: "#2E7D32", fontWeight: 600 }}>✓ Exibida na página inicial</span>
                          <button className="btn-ghost" style={{ color: "#C62828", padding: "4px 10px" }} onClick={() => aprovarAvaliacao(a.id, false)}>Remover da vitrine</button>
                        </div>
                      ) : (
                        <button className="btn-ghost" style={{ color: AZUL_MEDIO, padding: "4px 10px", marginTop: 4 }} onClick={() => aprovarAvaliacao(a.id, true)}>
                          <Check size={14} /> Aprovar para a página inicial
                        </button>
                      )
                    ) : (
                      <span style={{ fontSize: 12, color: a.aprovado ? "#2E7D32" : "#8593a8", fontWeight: a.aprovado ? 600 : 400 }}>
                        {a.aprovado ? "✓ Exibida na página inicial" : "Somente leitura — o Atendimento decide isso."}
                      </span>
                    )}
                  </div>

                  {a.exclusao_solicitada ? (
                    ehGerencia ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${CINZA_BORDA}`, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, color: "#B26A00", fontWeight: 600 }}><AlertTriangle size={12} style={{ verticalAlign: "-1px", marginRight: 3 }} />Exclusão solicitada pelo Atendimento</span>
                        <button className="btn-ghost" style={{ color: "#C62828", padding: "4px 10px" }} onClick={() => excluirAvaliacao(a.id)}>Apagar avaliação</button>
                        <button className="btn-ghost" style={{ color: AZUL_MEDIO, padding: "4px 10px" }} onClick={() => manterAvaliacao(a.id)}>Manter avaliação</button>
                      </div>
                    ) : (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${CINZA_BORDA}` }}>
                        <span style={{ fontSize: 12, color: "#B26A00", fontWeight: 600 }}><AlertTriangle size={12} style={{ verticalAlign: "-1px", marginRight: 3 }} />Exclusão solicitada — aguardando decisão da Gerência</span>
                      </div>
                    )
                  ) : (
                    podeAgir && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${CINZA_BORDA}`, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {ehGerencia ? (
                          <button className="btn-ghost" style={{ color: "#C62828", padding: "4px 10px" }} onClick={() => excluirAvaliacao(a.id)}>
                            <Trash2 size={13} /> Apagar avaliação
                          </button>
                        ) : (
                          <button className="btn-ghost" style={{ color: "#C62828", padding: "4px 10px" }} onClick={() => solicitarExclusaoAvaliacao(a.id)}>
                            <Trash2 size={13} /> Solicitar exclusão
                          </button>
                        )}
                      </div>
                    )
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}


function minutosDoHorario(hhmm) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
/* Lista de outros clientes com a mesma data e horário desejado a menos de 1h de distância
   (checagem de cruzamento de horário — item "Análise" do fluxo de Qualidade). */
function conflitosDeHorario(cliente, todos) {
  if (!cliente.dataDesejada || !cliente.horarioDesejado) return [];
  const minCliente = minutosDoHorario(cliente.horarioDesejado);
  if (minCliente === null) return [];
  return todos.filter((c) => {
    if (c.id === cliente.id || c.dataDesejada !== cliente.dataDesejada) return false;
    const minOutro = minutosDoHorario(c.horarioDesejado);
    return minOutro !== null && Math.abs(minOutro - minCliente) < 60;
  });
}

/* ================= Bloco de aprovação de clientes (item 2 do Agendamento) =================
   Fica acima do calendário. Só cliente "aprovado" pode ser agendado (status "Agendamento
   aprovado"); "Recusar" reaproveita o status "Cancelado" já existente no fluxo — não existe
   (nem no backend) um status "Recusado" à parte. */
function CardClientePendente({ c, todos, podeAgir, onAprovar, onRecusar }) {
  const conflitos = conflitosDeHorario(c, todos);
  return (
    <div style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: 12, minWidth: 250, maxWidth: 270, flexShrink: 0, display: "flex", flexDirection: "column", gap: 5 }}>
      <strong style={{ fontSize: 14 }}>{c.nome}</strong>
      <div style={{ fontSize: 12, color: "#65758b" }}>{mascararCpf(c.cpf)}</div>
      <div style={{ fontSize: 12, color: "#65758b" }}>{c.endereco || c.empreendimento || "Endereço não informado"}</div>
      <div style={{ fontSize: 12, color: AZUL_MARINHO, fontWeight: 700 }}>{c.servico}</div>
      <div style={{ fontSize: 12, color: "#4a5a70" }}>
        {c.dataDesejada ? c.dataDesejada.split("-").reverse().join("/") : "sem data"}{c.horarioDesejado ? ` · ${c.horarioDesejado}` : ""}
      </div>
      <div style={{ fontSize: 11, color: "#8593a8" }}>
        Cadastrado em {c.criadoEm ? new Date(c.criadoEm).toLocaleDateString("pt-BR") : "—"}
      </div>
      {conflitos.length > 0 && (
        <div style={{ background: "#FFF4E0", color: "#B26A00", padding: "6px 8px", borderRadius: 8, fontSize: 11.5 }}>
          <AlertTriangle size={12} style={{ verticalAlign: "-2px", marginRight: 3 }} />
          Cruza com {conflitos.length} outro(s) no mesmo horário: {conflitos.map((x) => x.nome).join(", ")}
        </div>
      )}
      {podeAgir ? (
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <button className="btn-solid" style={{ flex: 1, padding: "7px 10px", fontSize: 12.5 }} onClick={() => onAprovar(c)}>
            <Check size={13} /> Aprovar
          </button>
          <button className="btn-ghost" style={{ flex: 1, color: "#C62828", background: "#FCEAEA", padding: "7px 10px", fontSize: 12.5 }} onClick={() => onRecusar(c)}>
            <X size={13} /> Recusar
          </button>
        </div>
      ) : (
        <span style={{ fontSize: 11.5, color: "#8593a8", marginTop: 4 }}>Somente leitura — o Atendimento decide isso.</span>
      )}
    </div>
  );
}

function BlocoAprovacaoClientes({ clientes = [], carregando, podeAgir, onAprovar, onRecusar, clienteAprovado, onAgendarAgora, onFecharAviso }) {
  const pendentes = clientes.filter((c) => c.status === "Em análise" && !ehServicoDocumentacao(c));

  if (!carregando && pendentes.length === 0 && !clienteAprovado) {
    return (
      <div style={{ fontSize: 12.5, color: "#8593a8", padding: "4px 2px" }}>
        Nenhum cliente aguardando aprovação.
      </div>
    );
  }

  return (
    <Card icon={ClipboardList} titulo={pendentes.length > 0 ? `${pendentes.length} aguardando aprovação` : "Aprovação de clientes"}>
      {clienteAprovado && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", background: "#E6F4EA", color: "#2E7D32", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12 }}>
          <span><Check size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} /> Cliente aprovado: {clienteAprovado.nome}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-solid" style={{ width: "auto", padding: "6px 12px", fontSize: 12.5 }} onClick={() => onAgendarAgora(clienteAprovado.id)}>Agendar agora</button>
            <button className="icon-btn" onClick={onFecharAviso}><X size={14} /></button>
          </div>
        </div>
      )}
      {carregando && <p style={{ color: "#8593a8", fontSize: 14 }}>Carregando…</p>}
      {!carregando && pendentes.length === 0 && <p style={{ color: "#8593a8", fontSize: 14 }}>Nenhum cliente aguardando aprovação.</p>}
      {pendentes.length > 0 && (
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
          {pendentes.map((c) => (
            <CardClientePendente key={c.id} c={c} todos={clientes} podeAgir={podeAgir} onAprovar={onAprovar} onRecusar={onRecusar} />
          ))}
        </div>
      )}
    </Card>
  );
}

/* ================= Calendário interativo do Agendamento (item 3 e 4) =================
   Mostra, por dia: número (destaque hoje), faixa de presença por técnico (ordem fixa) e
   até 3 barras de agendamento coloridas por técnico com sigla + horário + cliente. Clicar
   num dia abre o painel lateral com a agenda completa daquele dia. */
function CalendarioAgendamento({ clientes = [], vistoriadores = [], docs = [], mesRef, setMesRef, diaSelecionado, setDiaSelecionado, filtroTecnicos, aoTrocarFiltro, filtroEtapa, aoTrocarEtapa }) {
  const ano = mesRef.getFullYear(), mes = mesRef.getMonth();
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const hojeISO = paraChaveISO(new Date());
  const gridRef = useRef(null);

  // Mostra todo cliente já cadastrado com data desejada (não só quem já tem técnico
  // confirmado) — "Cancelado" fica de fora por não ser mais um compromisso ativo.
  const agendadosPorDia = {};
  clientes.forEach((c) => {
    if (!c.dataDesejada || c.status === "Cancelado" || ehServicoDocumentacao(c)) return;
    if (filtroTecnicos && filtroTecnicos.size > 0 && !filtroTecnicos.has(String(c.vistoriadorId))) return;
    if (filtroEtapa && etapaVistoriaCliente(c, docs) !== filtroEtapa) return;
    (agendadosPorDia[c.dataDesejada] = agendadosPorDia[c.dataDesejada] || []).push(c);
  });

  const celulas = [];
  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null);
  for (let dia = 1; dia <= totalDias; dia++) celulas.push(dia);

  return (
    <div>
      {/* Etapa filtrada pelo clique nos "Indicadores do Agendamento", acima. */}
      {filtroEtapa && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, background: "#EAF2FB", borderRadius: 8, padding: "6px 10px", fontSize: 12.5, color: AZUL_MARINHO }}>
          <Filter size={13} /> Mostrando só: <Selo valor={filtroEtapa} />
          <button className="btn-ghost" style={{ color: AZUL_MEDIO, background: "#fff", padding: "2px 8px", fontSize: 11.5, marginLeft: "auto" }}
            onClick={() => aoTrocarEtapa?.(null)}>
            <X size={11} /> Limpar
          </button>
        </div>
      )}

      {vistoriadores.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {vistoriadores.map((v) => {
            const ativo = !filtroTecnicos || filtroTecnicos.size === 0 || filtroTecnicos.has(String(v.id));
            const cor = corDoTecnico(v.id);
            return (
              <button key={v.id} className="chip-tecnico" onClick={() => aoTrocarFiltro(String(v.id))}
                aria-pressed={ativo}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px 5px 5px", borderRadius: 20, border: `1.5px solid ${cor}`, background: ativo ? cor : "#fff", color: ativo ? "#fff" : cor, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                <span style={{ width: 18, height: 18, borderRadius: "50%", background: ativo ? "rgba(255,255,255,.25)" : cor, color: "#fff", display: "grid", placeItems: "center", fontSize: 9 }}>{siglaDoNome(v.nome)}</span>
                {v.nome}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <button className="icon-btn" onClick={() => setMesRef(new Date(ano, mes - 1, 1))} aria-label="Mês anterior"><ChevronLeft size={18} /></button>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <strong style={{ fontSize: 14, color: AZUL_MARINHO, textTransform: "capitalize" }}>
            {mesRef.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </strong>
          <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO, padding: "5px 10px", fontSize: 12 }}
            onClick={() => { const h = new Date(); setMesRef(new Date(h.getFullYear(), h.getMonth(), 1)); setDiaSelecionado(paraChaveISO(h)); }}>
            Hoje
          </button>
        </div>
        <button className="icon-btn" onClick={() => setMesRef(new Date(ano, mes + 1, 1))} aria-label="Próximo mês"><ChevronRight size={18} /></button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, fontSize: 11, color: "#8593a8", textAlign: "center", marginBottom: 4 }}>
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div ref={gridRef} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {celulas.map((dia, i) => {
          if (dia === null) return <div key={`vazio-${i}`} />;
          const chave = paraChaveISO(new Date(ano, mes, dia));
          const doDia = agendadosPorDia[chave] || [];
          const selecionado = diaSelecionado === chave;
          const hoje = chave === hojeISO;
          const temAgendamento = doDia.length > 0;
          return (
            <button key={chave} className="dia-cel" data-dia-idx={i}
              onKeyDown={(e) => {
                const passos = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
                if (!passos) return;
                e.preventDefault();
                gridRef.current?.querySelector(`[data-dia-idx="${i + passos}"]`)?.focus();
              }}
              onClick={() => setDiaSelecionado(selecionado ? null : chave)}
              title={doDia.length > 0 ? `${doDia.length} vistoria(s) marcada(s) neste dia` : "Nenhuma vistoria marcada"}
              style={{
                minHeight: 88,
                // Dia com vistoria marcada fica visualmente destacado (fundo e borda azuis),
                // pra dar pra bater o olho no mês e ver onde tem compromisso.
                border: selecionado ? `2px solid ${AZUL_MEDIO}` : temAgendamento ? `1.5px solid ${AZUL_MEDIO}` : `1px solid ${CINZA_BORDA}`,
                borderRadius: 8,
                background: temAgendamento ? "#EAF2FB" : hoje ? CINZA_CLARO : "#fff",
                cursor: "pointer", display: "flex", flexDirection: "column",
                alignItems: "stretch", gap: 3, padding: 4, textAlign: "left",
              }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: hoje ? 800 : 600, color: hoje ? AZUL_MARINHO : "#1a2330" }}>{dia}</span>
                {temAgendamento && (
                  <span style={{ background: AZUL_MEDIO, color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 9, fontWeight: 800, whiteSpace: "nowrap" }}>
                    {doDia.length} {doDia.length === 1 ? "vistoria" : "vistorias"}
                  </span>
                )}
              </div>
              {vistoriadores.length > 0 && (
                <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                  {vistoriadores.map((v) => {
                    const presente = doDia.some((c) => (c.status === "Vistoria agendada" || c.status === "Em vistoria") && String(c.vistoriadorId) === String(v.id));
                    return <span key={v.id} title={`${v.nome}${presente ? " — tem vistoria" : " — livre"}`} style={{ width: 7, height: 7, borderRadius: 2, background: presente ? corDoTecnico(v.id) : "#E3E8EF", flexShrink: 0 }} />;
                  })}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {doDia.slice(0, 3).map((c) => {
                  const tecnico = vistoriadores.find((v) => String(v.id) === String(c.vistoriadorId));
                  const cor = tecnico ? corDoTecnico(tecnico.id) : "#8593a8";
                  const sigla = tecnico ? siglaDoNome(tecnico.nome) : "—";
                  return (
                    <div key={c.id} style={{ background: cor, color: "#fff", borderRadius: 4, padding: "1px 4px", fontSize: 9, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {sigla} {c.horarioDesejado || ""} {(c.nome || "").split(" ")[0]}
                    </div>
                  );
                })}
                {doDia.length > 3 && (
                  <div style={{ fontSize: 9, color: AZUL_MARINHO, fontWeight: 700 }}>
                    +{doDia.length - 3} {doDia.length - 3 === 1 ? "outra" : "outras"}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* Painel lateral: agenda completa do dia clicado + atalho pra agendar uma nova vistoria. */
function PainelDiaAgendamento({ diaISO, clientes = [], todosClientes = [], vistoriadores = [], onFechar, onAgendarNovo, podeAgir, ehGerencia = false, updCliente, notify }) {
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(null);
  const [trocandoId, setTrocandoId] = useState(null);
  const dataFmt = new Date(`${diaISO}T00:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  // Mostra todo cliente já cadastrado com vistoria desejada nesse dia, não só os que já
  // têm técnico confirmado — "Cancelado" fica de fora por não ser mais um compromisso ativo.
  const agenda = clientes.filter((c) => c.status !== "Cancelado" && !ehServicoDocumentacao(c)).sort((a, b) => (a.horarioDesejado || "").localeCompare(b.horarioDesejado || ""));
  const nomeVistoriador = (id) => vistoriadores.find((v) => String(v.id) === String(id))?.nome || null;

  /* Trocar o técnico direto no painel do dia — é aqui que a remanejada acontece, olhando a
     agenda inteira da data. Mesma regra da sub-aba Vistoria: não desmarca nada e recusa
     quem já tem outra vistoria no mesmo horário. O conflito é conferido contra a agenda
     completa (todosClientes), porque o painel pode estar filtrado por etapa. */
  const trocarTecnico = async (c, novoId) => {
    if (!novoId || String(novoId) === String(c.vistoriadorId)) return;
    const universo = todosClientes.length ? todosClientes : clientes;
    const conflito = universo.find((o) =>
      o.id !== c.id && (o.status === "Vistoria agendada" || o.status === "Em vistoria") &&
      String(o.vistoriadorId) === String(novoId) &&
      o.dataDesejada === c.dataDesejada && o.horarioDesejado === c.horarioDesejado
    );
    const nomeNovo = vistoriadores.find((v) => String(v.id) === String(novoId))?.nome || "O técnico";
    if (conflito) {
      notify(`${nomeNovo} já tem vistoria às ${c.horarioDesejado} nesse dia (${conflito.nome}). Escolha outro.`);
      return;
    }
    setTrocandoId(c.id);
    try {
      await updCliente(c.id, { vistoriadorId: novoId });
      notify(`Vistoria transferida para ${nomeNovo} ✓`);
    } catch (e) { notify(`Não foi possível trocar o técnico: ${e.message}`); }
    setTrocandoId(null);
  };

  return (
    <div className="no-print" style={{ ...overlay, justifyItems: "end" }} onClick={onFechar}>
      <div className="painel-lateral" style={{ ...modal, maxWidth: 420, height: "100%", maxHeight: "100%", overflowY: "auto", borderRadius: 0 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <strong style={{ textTransform: "capitalize", fontSize: 15 }}>{dataFmt}</strong>
          <button className="icon-btn" onClick={onFechar}><X size={18} /></button>
        </div>

        {agenda.length === 0 ? (
          <div style={{ textAlign: "center", padding: "26px 10px" }}>
            <p style={{ color: "#8593a8", fontSize: 14, marginBottom: 14 }}>Nenhuma vistoria neste dia.</p>
            {podeAgir && (
              <button className="btn-solid" style={{ width: "auto", padding: "9px 16px", margin: "0 auto" }} onClick={onAgendarNovo}>
                <Plus size={15} /> Agendar a primeira
              </button>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
              {agenda.map((c) => {
                const nomeTecnico = nomeVistoriador(c.vistoriadorId);
                return (
                  <div key={c.id} style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: 12 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                      <span style={{ background: nomeTecnico ? corDoTecnico(c.vistoriadorId) : "#EEF1F5", color: nomeTecnico ? "#fff" : "#65758b", borderRadius: 6, padding: "2px 7px", fontSize: 11, fontWeight: 800 }}>
                        {nomeTecnico ? siglaDoNome(nomeTecnico) : "—"}
                      </span>
                      <strong style={{ fontSize: 14 }}>{c.horarioDesejado || "sem horário"}</strong>
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{c.nome}</div>
                    <div style={{ fontSize: 12.5, color: "#65758b" }}>{c.endereco || c.empreendimento || "—"}</div>
                    <div style={{ fontSize: 12.5, color: "#65758b" }}>{c.servico}</div>
                    {podeAgir && (c.status === "Vistoria agendada" || c.status === "Em vistoria") ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                        <span style={{ fontSize: 12, color: "#65758b" }}>Técnico:</span>
                        <select style={{ ...inp, width: "auto", minWidth: 165, padding: "5px 8px", fontSize: 12.5 }}
                          value={c.vistoriadorId || ""} disabled={trocandoId === c.id}
                          onChange={(e) => trocarTecnico(c, e.target.value)}>
                          <option value="">ainda não atribuído</option>
                          {vistoriadores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
                        </select>
                        {trocandoId === c.id && <Loader2 size={13} className="spin" />}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: "#65758b" }}>Técnico: {nomeTecnico || "ainda não atribuído"}</div>
                    )}
                    <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <Selo valor={c.status} />
                      {podeAgir && c.status === "Vistoria agendada" && (
                        <button className="btn-ghost" style={{ color: "#C62828", padding: "3px 8px", fontSize: 12 }}
                          onClick={() => setConfirmandoCancelamento(c)}>
                          Cancelar vistoria
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {podeAgir && (
              <button className="btn-solid" style={{ width: "auto", padding: "9px 16px" }} onClick={onAgendarNovo}>
                <Plus size={15} /> Agendar vistoria
              </button>
            )}
          </>
        )}

      <ConfirmModal aberto={!!confirmandoCancelamento}
        titulo={ehGerencia ? "Cancelar vistoria" : "Solicitar cancelamento"}
        mensagem={confirmandoCancelamento
          ? (ehGerencia
              ? `Cancelar a vistoria de "${confirmandoCancelamento.nome}"? Ela sai da agenda do técnico imediatamente.`
              : `Solicitar o cancelamento da vistoria de "${confirmandoCancelamento.nome}"? A gerência decide se confirma.`)
          : ""}
        onConfirm={async () => {
          const alvo = confirmandoCancelamento;
          setConfirmandoCancelamento(null);
          await cancelarVistoria({ cliente: alvo, ehGerencia, updCliente, notify });
        }}
        onCancel={() => setConfirmandoCancelamento(null)} />
      </div>
    </div>
  );
}

/* Formulário "Agendar vistoria": escolhe um cliente já aprovado + técnico + data/hora.
   Bloqueia o envio se o técnico já tiver outra vistoria confirmada no mesmo horário. */
function FormAgendarVistoria({ diaInicial, vistoriadores = [], clientesAprovados = [], todosClientes = [], onFechar, onConfirmar }) {
  const listaClientes = diaInicial ? clientesAprovados.filter((c) => c.dataDesejada === diaInicial) : clientesAprovados;
  const [clienteId, setClienteId] = useState("");
  const [vistoriadorId, setVistoriadorId] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const clienteEscolhido = listaClientes.find((c) => c.id === clienteId);
  const data = clienteEscolhido?.dataDesejada || "";
  const hora = clienteEscolhido?.horarioDesejado || "";

  const confirmar = async () => {
    setErro("");
    if (!clienteId) { setErro("Escolha o cliente aprovado."); return; }
    if (!vistoriadorId) { setErro("Escolha o técnico responsável."); return; }
    if (!data || !hora) { setErro("Este cliente não definiu data/horário no cadastro."); return; }
    const conflito = todosClientes.find((c) =>
      c.id !== clienteId && c.status === "Vistoria agendada" &&
      c.vistoriadorId === vistoriadorId && c.dataDesejada === data && c.horarioDesejado === hora
    );
    if (conflito) {
      const nomeTecnico = vistoriadores.find((v) => String(v.id) === String(vistoriadorId))?.nome || "O técnico";
      setErro(`${nomeTecnico} já tem vistoria às ${hora}. Escolha outro técnico.`);
      return;
    }
    setSalvando(true);
    await onConfirmar({ clienteId, vistoriadorId, dataDesejada: data, horarioDesejado: hora });
    setSalvando(false);
  };

  return (
    <div className="no-print" style={overlay} onClick={onFechar}>
      <div style={{ ...modal, maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <strong>Agendar vistoria</strong>
          <button className="icon-btn" onClick={onFechar}><X size={16} /></button>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <div style={cell(true)}>
            <label style={lab}>Cliente aprovado</label>
            <select style={inp} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">selecionar…</option>
              {listaClientes.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.empreendimento ? ` · ${c.empreendimento}` : ""}</option>)}
            </select>
            {listaClientes.length === 0 && <span style={{ fontSize: 12, color: "#8593a8" }}>Nenhum cliente aprovado aguardando agendamento{diaInicial ? " neste dia" : ""}.</span>}
          </div>
          {clienteEscolhido && (
            <div style={{ fontSize: 12.5, color: "#65758b" }}>
              {clienteEscolhido.servico} · {clienteEscolhido.endereco || clienteEscolhido.empreendimento || "sem endereço"}
            </div>
          )}
          <div style={cell(true)}>
            <label style={lab}>Técnico</label>
            <select style={inp} value={vistoriadorId} onChange={(e) => setVistoriadorId(e.target.value)}>
              <option value="">selecionar…</option>
              {vistoriadores.map((v) => <option key={v.id} value={v.id}>{siglaDoNome(v.nome)} · {v.nome}</option>)}
            </select>
          </div>
          <Grid>
            <div style={cell(false)}>
              <label style={lab}>Data (definida pelo cliente)</label>
              <div style={{ ...inp, background: CINZA_CLARO, color: "#4a5a70" }}>{data ? data.split("-").reverse().join("/") : "não definida"}</div>
            </div>
            <div style={cell(false)}>
              <label style={lab}>Horário (definido pelo cliente)</label>
              <div style={{ ...inp, background: CINZA_CLARO, color: "#4a5a70" }}>{hora || "não definido"}</div>
            </div>
          </Grid>

          {erro && (
            <div style={{ background: "#FCEAEA", color: "#C62828", padding: "8px 10px", borderRadius: 8, fontSize: 12.5 }}>
              <AlertTriangle size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} /> {erro}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO }} onClick={onFechar}>Cancelar</button>
          <button className="btn-solid" onClick={confirmar} disabled={salvando}>{salvando ? "Agendando…" : "Confirmar agendamento"}</button>
        </div>
      </div>
    </div>
  );
}

/* ================= Agendamento · Análise: aprovação de clientes + calendário operacional ================= */
function AbaQualidadeAnalise({ clientes = [], docs = [], carregando, updCliente, usuarios = [], notify, podeAgir = false, ehGerencia = false, onAgendarAgora, diaParaAbrir, aoAbrirDia, filtroEtapa = null, aoTrocarEtapa }) {
  const [mesRef, setMesRef] = useState(() => { const h = new Date(); return new Date(h.getFullYear(), h.getMonth(), 1); });
  const [diaSelecionado, setDiaSelecionado] = useState(null);
  const [filtroTecnicos, setFiltroTecnicos] = useState(() => new Set());
  const [clienteAprovado, setClienteAprovado] = useState(null);
  const [agendando, setAgendando] = useState(null); // { dataDesejada } quando o form "Agendar vistoria" está aberto

  const vistoriadores = usuarios.filter((u) => u.role === "vistoriador" && u.ativo);
  const aprovadosSemVistoria = clientes.filter((c) => c.status === "Agendamento aprovado" && !ehServicoDocumentacao(c));
  // O painel do dia respeita o mesmo filtro de etapa aplicado ao calendário.
  const doDiaSelecionado = diaSelecionado
    ? clientes.filter((c) => c.dataDesejada === diaSelecionado && (!filtroEtapa || etapaVistoriaCliente(c, docs) === filtroEtapa))
    : [];

  // Veio de uma confirmação de vistoria feita na sub-aba Vistoria — pula direto pro
  // mês/dia certo e já abre o painel lateral, sem precisar navegar manualmente.
  useEffect(() => {
    if (diaParaAbrir) {
      const [ano, mes] = diaParaAbrir.split("-").map(Number);
      setMesRef(new Date(ano, mes - 1, 1));
      setDiaSelecionado(diaParaAbrir);
      aoAbrirDia?.();
    }
  }, [diaParaAbrir]);

  const aprovar = async (c) => {
    try {
      await updCliente(c.id, { status: "Agendamento aprovado" });
      setClienteAprovado(c);
      notify("Agendamento aprovado ✓");
    } catch (e) { notify(`Erro: ${e.message}`); }
  };
  const recusar = async (c) => {
    try { await updCliente(c.id, { status: "Cancelado" }); notify("Cadastro recusado"); }
    catch (e) { notify(`Erro: ${e.message}`); }
  };
  const toggleFiltroTecnico = (id) => {
    setFiltroTecnicos((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  };
  const aoClicarAgendarAgora = (clienteId) => {
    setClienteAprovado(null);
    onAgendarAgora?.(clienteId);
  };
  const confirmarAgendamento = async (dados) => {
    try {
      await updCliente(dados.clienteId, { vistoriadorId: dados.vistoriadorId, dataDesejada: dados.dataDesejada, horarioDesejado: dados.horarioDesejado, status: "Vistoria agendada" });
      notify("Vistoria agendada ✓");
      setAgendando(null);
    } catch (e) { notify(`Erro: ${e.message}`); }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <BlocoAprovacaoClientes clientes={clientes} carregando={carregando} podeAgir={podeAgir}
        onAprovar={aprovar} onRecusar={recusar}
        clienteAprovado={clienteAprovado} onAgendarAgora={aoClicarAgendarAgora} onFecharAviso={() => setClienteAprovado(null)} />

      <Card icon={CalendarDays} titulo="Calendário de vistorias">
        <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 14px" }}>
          Veja quem está vistoriando o quê em cada dia. Clique num dia pra ver a agenda completa e agendar uma nova vistoria.
        </p>
        <CalendarioAgendamento clientes={clientes} vistoriadores={vistoriadores} docs={docs}
          mesRef={mesRef} setMesRef={setMesRef} diaSelecionado={diaSelecionado} setDiaSelecionado={setDiaSelecionado}
          filtroTecnicos={filtroTecnicos} aoTrocarFiltro={toggleFiltroTecnico}
          filtroEtapa={filtroEtapa} aoTrocarEtapa={aoTrocarEtapa} />
      </Card>

      {diaSelecionado && (
        <PainelDiaAgendamento diaISO={diaSelecionado} clientes={doDiaSelecionado} todosClientes={clientes} vistoriadores={vistoriadores} podeAgir={podeAgir} ehGerencia={ehGerencia}
          updCliente={updCliente} notify={notify}
          onFechar={() => setDiaSelecionado(null)}
          onAgendarNovo={() => setAgendando({ dataDesejada: diaSelecionado })} />
      )}

      {agendando && (
        <FormAgendarVistoria diaInicial={agendando.dataDesejada} vistoriadores={vistoriadores}
          clientesAprovados={aprovadosSemVistoria} todosClientes={clientes}
          onFechar={() => setAgendando(null)} onConfirmar={confirmarAgendamento} />
      )}
    </div>
  );
}

/* ================= Qualidade · Vistoria: agenda o técnico responsável e a data/hora final ================= */
/* Card resumido de uma vistoria — colapsado por padrão, expande ao clicar pra reduzir
   a quantidade de informação exibida de uma vez (item 3.19). */
function CardVistoriaResumo({ c, aberto, onToggle, children }) {
  return (
    <div style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, overflow: "hidden" }}>
      <button onClick={onToggle} style={{ width: "100%", background: "#fff", border: "none", cursor: "pointer", padding: 12, display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{c.nome}</div>
          <div style={{ fontSize: 12, color: "#65758b" }}>{c.empreendimento || "—"}{c.blocoTorre ? ` · ${c.blocoTorre}` : ""}</div>
        </div>
        <div style={{ fontSize: 12.5, color: AZUL_MARINHO, fontWeight: 700, whiteSpace: "nowrap" }}>
          {c.dataDesejada ? c.dataDesejada.split("-").reverse().join("/") : "sem data"}{c.horarioDesejado ? ` · ${c.horarioDesejado}` : ""}
        </div>
        {aberto ? <ChevronDown size={16} color="#8593a8" /> : <ChevronRight size={16} color="#8593a8" />}
      </button>
      {aberto && <div style={{ padding: "0 12px 12px" }}>{children}</div>}
    </div>
  );
}

/* Sub-aba Vistoria: agrupa por status (pendente de agendamento / já agendada / já
   realizada), com busca e cards resumidos que expandem ao clicar — antes mostrava
   tudo (formulário completo) de uma vez pra cada cliente, o que ficava confuso. */
function AbaQualidadeVistoria({ clientes = [], docs = [], carregando, updCliente, usuarios = [], notify, podeAgir = false, ehGerencia = false, abrirAutomaticoId = null, aoAbrirAutomatico, aoConfirmar, filtroEtapa = null }) {
  const [busca, setBusca] = useState("");
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(null);
  const [abertoId, setAbertoId] = useState(null);
  const [form, setForm] = useState({});
  const vistoriadores = usuarios.filter((u) => u.role === "vistoriador" && u.ativo);

  // Veio do atalho "Agendar agora" (aprovação em Análise) — abre o card já direto.
  useEffect(() => {
    if (abrirAutomaticoId) {
      setAbertoId(abrirAutomaticoId);
      setBusca("");
      aoAbrirAutomatico?.();
    }
  }, [abrirAutomaticoId]);

  const temDoc = (c) => {
    const cpfLimpo = (c.cpf || "").replace(/\D/g, "");
    return cpfLimpo && docs.some((d) => (d.cpf || "").replace(/\D/g, "") === cpfLimpo);
  };
  const termo = busca.trim().toLowerCase();
  // Documentação ART/TRT não passa por vistoria — não aparece nesta aba. O filtroEtapa vem
  // do clique nos indicadores acima.
  const combina = (c) =>
    (!termo || `${c.nome} ${c.empreendimento}`.toLowerCase().includes(termo)) &&
    !ehServicoDocumentacao(c) &&
    (!filtroEtapa || etapaVistoriaCliente(c, docs) === filtroEtapa);

  const emAgenda = (c) => c.status === "Vistoria agendada" || c.status === "Em vistoria";
  /* Da data mais próxima para a mais distante; quem ainda não tem data vai para o fim
     (a API devolve por ordem de cadastro, que não ajuda a organizar o dia a dia). */
  const porDataMaisProxima = (a, b) => {
    if (!a.dataDesejada && !b.dataDesejada) return (a.nome || "").localeCompare(b.nome || "", "pt-BR");
    if (!a.dataDesejada) return 1;
    if (!b.dataDesejada) return -1;
    return `${a.dataDesejada} ${a.horarioDesejado || ""}`.localeCompare(`${b.dataDesejada} ${b.horarioDesejado || ""}`);
  };

  const pendentes = clientes.filter((c) => c.status === "Agendamento aprovado" && combina(c)).sort(porDataMaisProxima);
  const agendadas = clientes.filter((c) => emAgenda(c) && !temDoc(c) && combina(c)).sort(porDataMaisProxima);
  const realizadas = clientes.filter((c) => emAgenda(c) && temDoc(c) && combina(c)).sort(porDataMaisProxima);

  const [trocandoId, setTrocandoId] = useState(null);
  const setCampo = (id, campo, valor) => setForm((f) => ({ ...f, [id]: { ...f[id], [campo]: valor } }));
  const valorCampo = (c, campo, padrao) => form[c.id]?.[campo] ?? padrao;

  /* Trocar o técnico de uma vistoria já agendada. Acontece bastante: alguém adoece, a rota
     do dia muda, entra um encaixe. Antes disso, a única saída era cancelar e agendar de
     novo — o que tirava a vistoria da agenda e assustava o cliente, que acompanha o status.
     A checagem de choque de horário é a mesma do agendamento inicial. */
  const trocarTecnico = async (c, novoId) => {
    if (!novoId || String(novoId) === String(c.vistoriadorId)) return;
    const conflito = clientes.find((o) =>
      o.id !== c.id && (o.status === "Vistoria agendada" || o.status === "Em vistoria") &&
      String(o.vistoriadorId) === String(novoId) &&
      o.dataDesejada === c.dataDesejada && o.horarioDesejado === c.horarioDesejado
    );
    const nomeNovo = vistoriadores.find((v) => String(v.id) === String(novoId))?.nome || "O técnico";
    if (conflito) {
      notify(`${nomeNovo} já tem vistoria às ${c.horarioDesejado} nesse dia. Escolha outro.`);
      return;
    }
    setTrocandoId(c.id);
    try {
      await updCliente(c.id, { vistoriadorId: novoId });
      notify(`Vistoria transferida para ${nomeNovo} \u2713`);
    } catch (e) { notify(`Não foi possível trocar o técnico: ${e.message}`); }
    setTrocandoId(null);
  };

  const confirmar = async (c) => {
    const vistoriadorId = valorCampo(c, "vistoriadorId", "");
    if (!vistoriadorId) { notify("Escolha o vistoriador responsável"); return; }
    if (!c.dataDesejada || !c.horarioDesejado) { notify("Este cliente não definiu data/horário no cadastro."); return; }
    const conflito = clientes.find((o) =>
      o.id !== c.id && o.status === "Vistoria agendada" &&
      o.vistoriadorId === vistoriadorId && o.dataDesejada === c.dataDesejada && o.horarioDesejado === c.horarioDesejado
    );
    if (conflito) {
      const nomeTecnico = vistoriadores.find((v) => String(v.id) === String(vistoriadorId))?.nome || "O técnico";
      notify(`${nomeTecnico} já tem vistoria às ${c.horarioDesejado}. Escolha outro técnico.`);
      return;
    }
    try {
      await updCliente(c.id, { vistoriadorId, status: "Vistoria agendada" });
      notify("Vistoria agendada ✓ — já aparece na agenda do técnico");
      aoConfirmar?.(c.dataDesejada);
    } catch (e) { notify(`Erro: ${e.message}`); }
  };

  const nomeVistoriador = (id) => vistoriadores.find((v) => String(v.id) === String(id))?.nome || usuarios.find((u) => String(u.id) === String(id))?.nome || "—";

  const grupos = [
    { chave: "pendente", titulo: "Aguardando agendamento", lista: pendentes },
    { chave: "agendada", titulo: "Vistoria agendada", lista: agendadas },
    { chave: "realizada", titulo: "Vistoria já realizada", lista: realizadas },
  ];

  return (
    <Card icon={CalendarDays} titulo="Vistorias">
      <input style={{ ...inp, marginBottom: 16 }} placeholder="Buscar por cliente ou empreendimento…" value={busca} onChange={(e) => setBusca(e.target.value)} />
      {carregando && <p style={{ color: "#8593a8", fontSize: 14 }}>Carregando…</p>}
      {!carregando && grupos.every((g) => g.lista.length === 0) && <p style={{ color: "#8593a8", fontSize: 14 }}>Nenhuma vistoria encontrada.</p>}

      <div style={{ display: "grid", gap: 20 }}>
        {grupos.map((g) => g.lista.length > 0 && (
          <div key={g.chave}>
            <div style={{ fontSize: 13, fontWeight: 700, color: AZUL_MARINHO, marginBottom: 8, borderBottom: `2px solid ${CINZA_CLARO}`, paddingBottom: 6 }}>
              {g.titulo} ({g.lista.length})
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {g.lista.map((c) => (
                <CardVistoriaResumo key={c.id} c={c} aberto={abertoId === c.id} onToggle={() => setAbertoId(abertoId === c.id ? null : c.id)}>
                  {g.chave === "pendente" ? (
                    <>
                      <Grid>
                        <div style={cell(false)}>
                          <label style={lab}>Vistoriador</label>
                          <select style={inp} value={valorCampo(c, "vistoriadorId", "")} onChange={(e) => setCampo(c.id, "vistoriadorId", e.target.value)} disabled={!podeAgir}>
                            <option value="">selecionar…</option>
                            {vistoriadores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
                          </select>
                        </div>
                        <div style={cell(false)}>
                          <label style={lab}>Data (definida pelo cliente)</label>
                          <div style={{ ...inp, background: CINZA_CLARO, color: "#4a5a70" }}>{c.dataDesejada ? c.dataDesejada.split("-").reverse().join("/") : "não definida"}</div>
                        </div>
                        <div style={cell(false)}>
                          <label style={lab}>Horário (definido pelo cliente)</label>
                          <div style={{ ...inp, background: CINZA_CLARO, color: "#4a5a70" }}>{c.horarioDesejado || "não definido"}</div>
                        </div>
                      </Grid>
                      {podeAgir ? (
                        <button className="btn-solid" style={{ marginTop: 10, width: "auto", padding: "8px 16px" }} onClick={() => confirmar(c)}>
                          <Check size={15} /> Confirmar agendamento
                        </button>
                      ) : (
                        <span style={{ fontSize: 12, color: "#8593a8" }}>Somente leitura — o Atendimento decide isso.</span>
                      )}
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: "#4a5a70", display: "grid", gap: 4 }}>
                      <div><strong>Telefone:</strong> {c.telefone || "—"}</div>
                      <div><strong>Construtora:</strong> {c.construtora || "—"}</div>
                      {g.chave === "agendada" && podeAgir ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <strong>Vistoriador:</strong>
                          <select style={{ ...inp, width: "auto", minWidth: 190, padding: "6px 10px" }}
                            value={c.vistoriadorId || ""} disabled={trocandoId === c.id}
                            onChange={(e) => trocarTecnico(c, e.target.value)}>
                            <option value="">selecionar…</option>
                            {vistoriadores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
                          </select>
                          {trocandoId === c.id && <Loader2 size={14} className="spin" />}
                          <span style={{ fontSize: 11.5, color: "#8593a8" }}>trocar não desmarca a vistoria</span>
                        </div>
                      ) : (
                        <div><strong>Vistoriador:</strong> {nomeVistoriador(c.vistoriadorId)}</div>
                      )}
                      <div><strong>Status:</strong> <Selo valor={etapaAtualCliente(c, docs)} /></div>
                      {g.chave === "agendada" && (
                        podeAgir ? (
                          <button className="btn-ghost" style={{ color: "#C62828", padding: "4px 10px", width: "auto", marginTop: 4 }}
                            onClick={() => setConfirmandoCancelamento(c)}>
                            <Trash2 size={13} /> Cancelar vistoria
                          </button>
                        ) : null
                      )}
                    </div>
                  )}
                </CardVistoriaResumo>
              ))}
            </div>
          </div>
        ))}
      </div>

      <ConfirmModal aberto={!!confirmandoCancelamento}
        titulo={ehGerencia ? "Cancelar vistoria" : "Solicitar cancelamento"}
        mensagem={confirmandoCancelamento
          ? (ehGerencia
              ? `Cancelar a vistoria de "${confirmandoCancelamento.nome}"? Ela sai da agenda do técnico imediatamente.`
              : `Solicitar o cancelamento da vistoria de "${confirmandoCancelamento.nome}"? A gerência decide se confirma.`)
          : ""}
        onConfirm={async () => {
          const alvo = confirmandoCancelamento;
          setConfirmandoCancelamento(null);
          await cancelarVistoria({ cliente: alvo, ehGerencia, updCliente, notify });
        }}
        onCancel={() => setConfirmandoCancelamento(null)} />

    </Card>
  );
}

/* ---- Conferir por ambiente ----
   O técnico escolhe o cômodo e marca o que encontrou, em vez de lembrar de cabeça o que
   conferir. A lista sai do banco de patologias gerado da planilha: as específicas daquele
   ambiente primeiro, depois as que valem em qualquer lugar. */
function SeletorAmbientePatologias({ onFechar, onAdicionar, patologiasBanco = [] }) {
  const ambientes = useMemo(() => listarAmbientes(), []);
  const [ambiente, setAmbiente] = useState(ambientes[0]?.slug || "");
  const [busca, setBusca] = useState("");
  const [marcados, setMarcados] = useState({}); // { "slug:id": patologia }
  const [verUnidade, setVerUnidade] = useState(false);

  const nomeAmbiente = ambientes.find((a) => a.slug === ambiente)?.nome || "";
  const lista = useMemo(
    () => (verUnidade ? patologiasUnidadeInteira(patologiasBanco) : patologiasPorAmbiente(patologiasBanco, ambiente)),
    [patologiasBanco, ambiente, verUnidade]
  );

  const termo = busca.trim().toLowerCase();
  const visiveis = termo
    ? lista.filter((p) => `${p.nome} ${p.sistema} ${p.elemento} ${p.manifestacao}`.toLowerCase().includes(termo))
    : lista;

  /* A marcação é por ambiente + patologia: a mesma patologia em dois cômodos são duas não
     conformidades diferentes no laudo, e o técnico troca de ambiente sem perder o que já
     marcou no anterior. */
  const chaveDe = (p) => `${verUnidade ? "unidade" : ambiente}:${p.id}`;
  const alternar = (p) => setMarcados((m) => {
    const k = chaveDe(p);
    if (m[k]) { const { [k]: _, ...resto } = m; return resto; }
    return { ...m, [k]: { patologia: p, ambienteNome: verUnidade ? "Unidade" : nomeAmbiente } };
  });

  const total = Object.keys(marcados).length;
  const confirmar = () => {
    if (!total) return;
    onAdicionar(Object.values(marcados).map(({ patologia, ambienteNome }) => paraItemDeLaudo(patologia, ambienteNome)));
  };

  const corSev = { Alta: "#C62828", "Média": "#B26A00", Baixa: "#2E7D32" };
  const bgSev = { Alta: "#FCEAEA", "Média": "#FFF4E0", Baixa: "#E6F4EA" };

  return (
    <div className="no-print" style={overlay} onClick={onFechar}>
      <div style={{ ...modal, maxWidth: 720, maxHeight: "88vh", display: "flex", flexDirection: "column", padding: 0 }}
        onClick={(e) => e.stopPropagation()}>

        <div style={{ padding: "16px 18px 12px", borderBottom: `1px solid ${CINZA_BORDA}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <strong style={{ fontSize: 15.5 }}>Conferir por ambiente</strong>
            <button className="icon-btn" onClick={onFechar}><X size={16} /></button>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {ambientes.map((a) => {
              const ativo = !verUnidade && a.slug === ambiente;
              const nesteAmbiente = Object.keys(marcados).filter((k) => k.startsWith(`${a.slug}:`)).length;
              return (
                <button key={a.slug} onClick={() => { setVerUnidade(false); setAmbiente(a.slug); }} aria-pressed={ativo}
                  style={{ padding: "5px 11px", borderRadius: 20, cursor: "pointer", fontSize: 12.5, fontWeight: 600,
                    border: `1.5px solid ${ativo ? AZUL_MARINHO : CINZA_BORDA}`,
                    background: ativo ? AZUL_MARINHO : "#fff", color: ativo ? "#fff" : "#4a5a70" }}>
                  {a.nome}{nesteAmbiente ? ` · ${nesteAmbiente}` : ""}
                </button>
              );
            })}
            {/* Manual do proprietário, pé-direito, medidores: não pertencem a cômodo nenhum. */}
            <button onClick={() => setVerUnidade(true)} aria-pressed={verUnidade}
              style={{ padding: "5px 11px", borderRadius: 20, cursor: "pointer", fontSize: 12.5, fontWeight: 600,
                border: `1.5px dashed ${verUnidade ? AZUL_MARINHO : CINZA_BORDA}`,
                background: verUnidade ? AZUL_MARINHO : "#fff", color: verUnidade ? "#fff" : "#4a5a70" }}>
              Unidade inteira
            </button>
          </div>

          <input value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder={`Buscar em ${visiveis.length} item(ns) de ${verUnidade ? "unidade inteira" : nomeAmbiente}…`}
            style={{ width: "100%", padding: "8px 11px", border: `1px solid ${CINZA_BORDA}`, borderRadius: 9, fontSize: 13, fontFamily: "inherit" }} />
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: "10px 18px" }}>
          {visiveis.length === 0 && (
            <p style={{ color: "#8593a8", fontSize: 13.5, textAlign: "center", padding: "24px 0" }}>
              Nada encontrado para “{busca}”.
            </p>
          )}
          <div style={{ display: "grid", gap: 6 }}>
            {visiveis.map((p) => {
              const marcado = !!marcados[chaveDe(p)];
              return (
                <label key={p.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer",
                  border: `1px solid ${marcado ? AZUL_MEDIO : CINZA_BORDA}`, background: marcado ? "#f4f8fd" : "#fff",
                  borderRadius: 9, padding: "9px 11px" }}>
                  <input type="checkbox" checked={marcado} onChange={() => alternar(p)} style={{ marginTop: 3, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 13.5, fontWeight: 600 }}>{p.nome}</strong>
                      <span style={{ fontSize: 10, fontWeight: 800, color: corSev[p.severidade], background: bgSev[p.severidade], borderRadius: 20, padding: "1px 7px" }}>
                        {p.severidade}
                      </span>
                      {/* Distingue o que aquele cômodo cobra do que vale em qualquer lugar. */}
                      {p.especificaDoAmbiente && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: AZUL_MARINHO, background: CINZA_CLARO, borderRadius: 20, padding: "1px 7px" }}>
                          deste ambiente
                        </span>
                      )}
                      {p.exigeEspecialista && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#6E36BE", background: "#F1EAFB", borderRadius: 20, padding: "1px 7px" }}>
                          exige especialista
                        </span>
                      )}
                    </span>
                    <span style={{ display: "block", fontSize: 11.5, color: "#65758b", marginTop: 2 }}>{p.sistema}</span>
                    {p.comoVerificar && (
                      <span style={{ display: "block", fontSize: 11.5, color: "#8593a8", marginTop: 3, lineHeight: 1.45 }}>
                        Como verificar: {p.comoVerificar}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div style={{ padding: "12px 18px", borderTop: `1px solid ${CINZA_BORDA}`, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: "#65758b", flex: 1, minWidth: 140 }}>
            {total ? `${total} marcada(s) — vira(m) item(ns) do laudo` : "Marque o que foi encontrado na vistoria"}
          </span>
          <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO }} onClick={onFechar}>Cancelar</button>
          <button className="btn-solid" onClick={confirmar} disabled={!total}>
            <Plus size={14} /> Adicionar {total || ""}
          </button>
        </div>
      </div>
    </div>
  );
}

function AbaItens({ itens, setItens, updItem, escolherPatologia, addFotos, removerFoto, contagem, dados, setD, fotoCliente, setFotoCliente, notify, setAba, bloqueado, onPedirDesbloqueio, statusLaudo, devolvido, motivoDevolucao, patologiasBanco = [], minhaAssinatura, salvarMinhaAssinatura, removerMinhaAssinatura }) {
  const fotoClienteRef = useRef();
  const [seletorAberto, setSeletorAberto] = useState(false);
  const handleFotoCliente = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { notify("Envie uma imagem (PNG ou JPG)"); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      setFotoCliente(e.target.result);
      notify("Foto registrada ✓ — indo para o laudo final");
      if (setAba) setAba("laudo");
    };
    reader.onerror = () => notify("Não foi possível carregar a foto. Verifique sua conexão e tente novamente.");
    reader.readAsDataURL(file);
  };

  return (
    <div>
      {bloqueado && (
        <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 10, background: "#FFF4E0", border: "1px solid #f0c987", borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
          <Lock size={16} color="#B26A00" />
          <span style={{ fontSize: 13, color: "#7a4e00", flex: 1 }}>
            Este laudo está com a gerência{statusLaudo ? ` (${statusLaudo})` : ""} e não pode mais ser editado aqui.
          </span>
          <button className="btn-ghost" style={{ color: "#B26A00", background: "#fff", padding: "6px 12px" }} onClick={onPedirDesbloqueio}>
            Entenda
          </button>
        </div>
      )}

      {/* Devolvido: a edição está liberada de novo, e o técnico precisa ver o que corrigir
          sem ter de procurar. Por isso o motivo aparece aqui, no topo do formulário. */}
      {devolvido && motivoDevolucao && (
        <div className="no-print" style={{ display: "flex", gap: 10, background: "#FCEAEA", border: "1px solid #e8a9a9", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
          <AlertTriangle size={16} color="#C62828" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#8f2020", marginBottom: 3 }}>
              Laudo devolvido pela gerência para correção
            </div>
            <div style={{ fontSize: 12.5, color: "#7a2323", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{motivoDevolucao}</div>
            <div style={{ fontSize: 11.5, color: "#a05252", marginTop: 6 }}>
              Depois de ajustar, envie novamente para a gerência.
            </div>
          </div>
        </div>
      )}
      <div style={{ pointerEvents: bloqueado ? "none" : "auto", opacity: bloqueado ? 0.55 : 1 }}>
      {/* Três dados do imóvel que só o técnico tem na hora da vistoria — o resto do
          cabeçalho do laudo já vem do cadastro do cliente. Se ficarem vazios, o laudo
          simplesmente omite. */}
      <div style={{ marginBottom: 16 }}>
        <Card icon={Building2} titulo="Dados do imóvel vistoriado">
          <p style={{ fontSize: 13, color: "#65758b", margin: "0 0 10px" }}>
            Complementam o laudo. O restante (cliente, endereço, unidade, data, horário e área privativa) já veio do cadastro automaticamente.
          </p>
          <Grid>
            <Field label="Tipologia" value={dados?.imovel?.tipologia || ""} onChange={(v) => setD("imovel", "tipologia", v)}
              placeholder="Ex.: 2 quartos (1 suíte) com varanda" />
            <Field label="Ambientes vistoriados" type="number" value={dados?.vistoria?.ambientesVistoriados || ""}
              onChange={(v) => setD("vistoria", "ambientesVistoriados", v)} placeholder="Ex.: 10" />
          </Grid>
        </Card>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Card icon={User} titulo="Responsável técnico">
          <p style={{ fontSize: 13, color: "#65758b", margin: "0 0 10px" }}>
            Aparece na última página do laudo, como quem assina a vistoria.
          </p>
          {/* Fixo, não editável: nome vem do próprio login, qualificação e registro vêm do
              cadastro que a Gerência já preencheu (ver ModalPerfilTecnicoVistoriador). Antes
              dava pra digitar aqui de novo em cada laudo — sem necessidade, já que cada
              vistoriador só assina com o que está no próprio cadastro. Se algo estiver errado
              (nome, qualificação, registro), é a Gerência quem corrige, não o campo aqui. */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11.5, color: "#8593a8", marginBottom: 2 }}>Nome</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{dados?.rt?.nome || "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: "#8593a8", marginBottom: 2 }}>Qualificação</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{dados?.rt?.qualificacao || "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: "#8593a8", marginBottom: 2 }}>Registro profissional</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{dados?.rt?.registro || "—"}</div>
            </div>
          </div>
          {(!dados?.rt?.qualificacao || !dados?.rt?.registro) && (
            <p style={{ fontSize: 12, color: "#B26A00", background: "#FFF4E0", borderRadius: 8, padding: "9px 12px", margin: "10px 0 0" }}>
              Qualificação ou registro ainda não cadastrados pela Gerência. Avise a Gerência pra completar seu cadastro.
            </p>
          )}

          {salvarMinhaAssinatura && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${CINZA_BORDA}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Minha assinatura</div>
              <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                <label className="btn-ghost" style={{ color: AZUL_MEDIO, background: CINZA_CLARO, cursor: "pointer" }}>
                  <Camera size={15} /> {minhaAssinatura ? "Trocar assinatura" : "Enviar assinatura"}
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (!file.type.startsWith("image/")) { notify("Envie uma imagem (PNG ou JPG) da assinatura"); return; }
                    const reader = new FileReader();
                    reader.onload = () => salvarMinhaAssinatura({ imagem: reader.result });
                    reader.readAsDataURL(file);
                    e.target.value = "";
                  }} />
                </label>
                {minhaAssinatura && (
                  <>
                    <img src={minhaAssinatura.imagem} alt="Sua assinatura" style={{ height: 44, background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 6, padding: 4 }} />
                    <button className="btn-ghost" style={{ color: "#c62828" }} onClick={removerMinhaAssinatura}><Trash2 size={15} /> Remover</button>
                  </>
                )}
              </div>
              <p style={{ fontSize: 12, color: "#8593a8", margin: "8px 0 0" }}>
                Aparece no laudo final ao lado da assinatura da Gerência. Envie uma única vez — fica salva para todos os seus próximos laudos.
              </p>
            </div>
          )}
        </Card>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Card icon={Camera} titulo="Foto com o cliente (obrigatória)">
          <p style={{ fontSize: 13, color: "#65758b", margin: "0 0 10px" }}>
            Tire uma foto sua com o cliente durante a vistoria, igual às fotos dos itens. Necessária pra enviar o laudo para a gerência — assim que tirar, você já vai direto pro laudo final.
          </p>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            {fotoCliente ? (
              <div style={{ position: "relative", width: 160, height: 160, borderRadius: 10, overflow: "hidden", border: `1px solid ${CINZA_BORDA}` }}>
                <img src={fotoCliente} alt="Foto com o cliente" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button className="foto-x" onClick={() => setFotoCliente(null)}><X size={12} /></button>
              </div>
            ) : (
              <button onClick={() => fotoClienteRef.current?.click()}
                style={{ width: 160, height: 160, borderRadius: 10, border: `1.5px dashed ${AZUL_MEDIO}`, background: "#f6f9fd", color: AZUL_MEDIO, display: "flex", flexDirection: "column", gap: 6, alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <Camera size={28} />
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>Tirar foto</span>
              </button>
            )}
            <input ref={fotoClienteRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
              onChange={(e) => { handleFotoCliente(e.target.files[0]); e.target.value = ""; }} />
          </div>
        </Card>
      </div>

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
          onDelete={() => setItens((l) => l.filter((x) => x.id !== item.id))}
          patologiasBanco={patologiasBanco} />
      ))}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn-add" style={{ flex: 1, minWidth: 200 }} onClick={() => setItens((l) => [...l, novoItem()])}>
          <Plus size={17} /> Adicionar item de vistoria
        </button>
        {/* Caminho guiado: em vez de lembrar o que conferir em cada cômodo, o técnico escolhe
            o ambiente e marca na lista. O botão acima continua, para o item que não está
            no banco. */}
        <button className="btn-add" style={{ flex: 1, minWidth: 200, borderStyle: "solid", borderColor: AZUL_MEDIO, color: AZUL_MEDIO }}
          onClick={() => setSeletorAberto(true)}>
          <ClipboardList size={17} /> Conferir por ambiente
        </button>
      </div>
      </div>

      {seletorAberto && (
        <SeletorAmbientePatologias
          patologiasBanco={patologiasBanco}
          onFechar={() => setSeletorAberto(false)}
          onAdicionar={(novos) => {
            setItens((l) => {
              /* O primeiro item nasce vazio junto com o formulário. Se o técnico não tocou
                 nele, é ele que deve ser preenchido — senão sobra uma linha em branco no
                 laudo, que o modelo cobra como não conformidade sem descrição. */
              const soVazio = l.length === 1 && !l[0].patologia && !l[0].local && !l[0].descricao && !l[0].fotos?.length;
              const base = soVazio ? [] : l;
              return [...base, ...novos.map((n) => ({ ...novoItem(), ...n }))];
            });
            setSeletorAberto(false);
            notify(`${novos.length} não conformidade(s) adicionada(s) ✓`);
          }}
        />
      )}
    </div>
  );
}

function ItemCard({ item, num, onChange, onPatologia, onFotos, onRemoveFoto, onDelete, patologiasBanco = [] }) {
  const fileRef = useRef();
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const m = sevMeta[item.severidade] || sevMeta.Média;

  /* Casa o "Local" digitado (texto livre, com sugestão da datalist) com um ambiente do
     banco de patologias — quando bate, o dropdown abaixo já entra filtrado para aquele
     cômodo, na frente das que valem em qualquer lugar. */
  const ambienteSlug = useMemo(() => {
    const termo = (item.local || "").trim().toLowerCase();
    if (!termo) return "";
    return listarAmbientes().find((a) => a.nome.toLowerCase() === termo)?.slug || "";
  }, [item.local]);
  const opcoesPatologia = useMemo(() => patologiasPorAmbiente(patologiasBanco, ambienteSlug), [patologiasBanco, ambienteSlug]);
  const especificasDoAmbiente = opcoesPatologia.filter((p) => p.especificaDoAmbiente);
  const genericasQualquerAmbiente = opcoesPatologia.filter((p) => !p.especificaDoAmbiente);

  return (
    <div style={{ background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 14, padding: 18, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: AZUL_MARINHO, color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 14, fontFamily: "monospace" }}>{num}</div>
        <strong style={{ fontSize: 15 }}>Item {num}</strong>
        {item.patologia && <span style={{ fontSize: 12, color: "#65758b" }}>· {item.patologia}</span>}
        <div style={{ flex: 1 }} />
        <button className="icon-btn" onClick={() => setConfirmandoExclusao(true)}><Trash2 size={16} color="#c62828" /></button>
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
      {/* Escolher a patologia preenche sozinho severidade, categoria, norma, descrição e
          recomendação — tudo continua editável depois. */}
      <div style={{ marginTop: 14, background: "#f4f8fd", border: `1px solid #dbe7f4`, borderRadius: 11, padding: 13 }}>
        <label style={{ ...lab, display: "block", marginBottom: 6 }}>Patologia (preenche o restante automaticamente)</label>
        <select style={{ ...inp, width: "100%" }} value={item.tipo} onChange={(e) => onPatologia(e.target.value)}>
          <option value="">selecionar patologia…</option>
          {especificasDoAmbiente.length > 0 && (
            <optgroup label={`Específicas de ${item.local}`}>
              {especificasDoAmbiente.map((p) => <option key={`bp-${p.id}`} value={`bp-${p.id}`}>{p.nome}</option>)}
            </optgroup>
          )}
          <optgroup label="Aplicam-se a qualquer ambiente">
            {genericasQualquerAmbiente.map((p) => <option key={`bp-${p.id}`} value={`bp-${p.id}`}>{p.nome}</option>)}
          </optgroup>
          <optgroup label="Modelos rápidos">
            {Object.entries(BANCO).filter(([k]) => k !== "outro").map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </optgroup>
          <option value="outro">Outro (personalizado)</option>
        </select>
        {item.categoria && (
          <div style={{ fontSize: 11.5, color: "#65758b", marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span style={{ background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 20, padding: "2px 9px", fontWeight: 700, color: AZUL_MARINHO }}>
              {item.categoria}
            </span>
            {item.norma && <span style={{ alignSelf: "center" }}>{item.norma}</span>}
          </div>
        )}
      </div>

      <Grid>
        <Field label="Título (uma linha, aparece no resumo do laudo)" value={item.titulo} onChange={(v) => onChange({ titulo: v })} full />
        <div style={cell(false)}>
          <label style={lab}>Situação</label>
          <select style={inp} value={item.status} onChange={(e) => onChange({ status: e.target.value })}>
            {STATUS_ITEM_OPCOES.map((o) => <option key={o.valor} value={o.valor}>{o.label}</option>)}
          </select>
        </div>
        <Field label="Norma técnica" value={item.norma} onChange={(v) => onChange({ norma: v })} />
      </Grid>

      <Area label="Descrição técnica" value={item.descricao} onChange={(v) => onChange({ descricao: v })} rows={3} placeholder="Verifica-se..." />
      <Area label="Recomendação técnica" value={item.recomendacao} onChange={(v) => onChange({ recomendacao: v })} rows={2} placeholder="Recomenda-se..." />

      <ConfirmModal aberto={confirmandoExclusao} titulo="Excluir item"
        mensagem={`Tem certeza que deseja excluir o Item ${num}${item.patologia ? ` (${item.patologia})` : ""}? Essa ação não pode ser desfeita.`}
        onConfirm={() => { onDelete(); setConfirmandoExclusao(false); }} onCancel={() => setConfirmandoExclusao(false)} />
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

function ItemLaudo({ item, num }) {
  /* item pode vir direto do banco (laudo antigo, campo ausente/fora do padrão) — sem
     fallback aqui, um severidade/fotos inesperado derrubava a tela inteira em branco. */
  const m = sevMeta[item.severidade] || sevMeta.Média;
  const fotos = item.fotos || [];
  const pTexto = { fontSize: 13, color: "#4a5a70", lineHeight: 1.6 };
  return (
    <div style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 12, overflow: "hidden", marginBottom: 16, breakInside: "avoid" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: CINZA_CLARO, padding: "10px 14px" }}>
        <span style={{ fontFamily: "monospace", fontWeight: 700, color: AZUL_MARINHO }}>ITEM {String(num).padStart(2, "0")}</span>
        {item.local && <span style={{ fontSize: 13, color: "#4a5a70" }}>· {item.local}</span>}
        <div style={{ flex: 1 }} />
        <span style={{ background: m.bg, color: m.cor, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{(item.severidade || "média").toUpperCase()}</span>
      </div>
      <div style={{ padding: 14 }}>
        {item.patologia && <div style={{ fontWeight: 700, marginBottom: 6, color: AZUL_MARINHO }}>{item.patologia}</div>}
        {fotos.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(fotos.length, 2)}, 1fr)`, gap: 8, marginBottom: 12 }}>
            {fotos.map((s, i) => <img key={i} src={s} alt="" style={{ width: "100%", height: 150, objectFit: "cover", borderRadius: 8, border: `1px solid ${CINZA_BORDA}` }} />)}
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
  // status de produção do bloco "ART Documentações"
  "Recebido": { cor: "#2C75B5", bg: "#EAF2FB" }, "Em produção": { cor: "#B26A00", bg: "#FFF4E0" }, "Realizado": { cor: "#2E7D32", bg: "#E6F4EA" },
  // status do cliente (status_cliente) — os 3 únicos que o cliente vê
  "Agendado": { cor: "#2C75B5", bg: "#EAF2FB" },
  "Laudo em análise": { cor: "#B26A00", bg: "#FFF4E0" },
  "Laudo enviado por e-mail": { cor: "#2E7D32", bg: "#E6F4EA" },
  // status interno (docs.status) — uso exclusivo da equipe
  "Em vistoria": { cor: "#B26A00", bg: "#FFF4E0" },
  "Laudo em elaboração": { cor: "#B26A00", bg: "#FFF4E0" },
  "Laudo pronto": { cor: "#2E7D32", bg: "#E6F4EA" },
  // status do cliente (clientes.status) — cancelamento pedido pelo Atendimento, aguardando a Gerência
  "Cancelamento solicitado": { cor: "#B26A00", bg: "#FFF4E0" },
};
function Selo({ valor }) {
  const s = STATUS_COR[valor] || { cor: "#65758b", bg: "#EEF1F5" };
  return <span style={{ background: s.bg, color: s.cor, padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{valor}</span>;
}

/* ================= Confirmação de exclusão (reutilizável) ================= */
function ConfirmModal({ aberto, titulo = "Confirmar exclusão", mensagem = "Tem certeza que deseja excluir? Essa ação não pode ser desfeita.", onConfirm, onCancel }) {
  if (!aberto) return null;
  return (
    <div className="no-print" style={overlay} onClick={onCancel}>
      <div style={{ ...modal, maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <AlertTriangle size={20} color="#c62828" />
          <strong>{titulo}</strong>
        </div>
        <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 18px" }}>{mensagem}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO }} onClick={onCancel}>Cancelar</button>
          <button className="btn-solid" style={{ background: "#c62828" }} onClick={onConfirm}>Excluir</button>
        </div>
      </div>
    </div>
  );
}

/* Anexo dos dois documentos finais de um cliente de Documentação ART/TRT. O arquivo vai
   para o Drive (via backend) e o status do cliente só vira "Documentação pronta" quando
   os dois estão anexados — é aí que ele consegue baixar pelo portal. */
/* Endereço onde a equipe emite a ART/TRT. Fica no código (e não escrito em cada card)
   para trocar num lugar só se o SINCETI mudar de endereço. */
const URL_EMISSAO_ART = "https://servicos.sinceti.net.br/index.php";

/* Dados do cadastro do cliente, do jeito que a pessoa da Documentação precisa deles:
   tudo visível de uma vez e copiável, porque esses campos são redigitados no sistema
   externo de emissão. Sem isso ela teria que abrir o cadastro em outra aba e ir e voltar. */
function DadosParaDocumentacao({ cliente, notify }) {
  const [aberto, setAberto] = useState(false);

  const campos = [
    ["Nome", cliente.nome],
    ["CPF", cliente.cpf],
    ["E-mail", cliente.email],
    ["Telefone", cliente.telefone],
    ["Construtora", cliente.construtora],
    ["Empreendimento", cliente.empreendimento],
    ["Bloco / Torre / Apto", cliente.blocoTorre],
    ["Endereço", cliente.endereco],
    ["CEP", cliente.cep],
    ["Área privativa", cliente.areaPrivativa],
    ["Observações", cliente.observacoes],
  ].filter(([, v]) => v);

  const copiarTudo = async () => {
    const texto = campos.map(([k, v]) => `${k}: ${v}`).join("\n");
    try {
      await navigator.clipboard.writeText(texto);
      notify("Dados copiados ✓");
    } catch { notify("Não foi possível copiar — selecione e copie manualmente."); }
  };

  return (
    <div style={{ marginTop: 10, borderTop: `1px solid ${CINZA_BORDA}`, paddingTop: 10 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn-ghost" style={{ color: AZUL_MEDIO, background: CINZA_CLARO }} onClick={() => setAberto((v) => !v)}>
          {aberto ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Dados do cadastro ({campos.length})
        </button>
        <a href={URL_EMISSAO_ART} target="_blank" rel="noopener noreferrer"
          className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO, textDecoration: "none" }}>
          <ExternalLink size={14} /> Emitir no SINCETI
        </a>
      </div>

      {aberto && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "grid", gap: 4 }}>
            {campos.map(([k, v]) => (
              <div key={k} style={{ display: "flex", gap: 8, fontSize: 12.5, flexWrap: "wrap" }}>
                <span style={{ color: "#8593a8", width: 150, flexShrink: 0 }}>{k}</span>
                <strong style={{ color: "#1a2330", fontWeight: 600, userSelect: "all" }}>{v}</strong>
              </div>
            ))}
          </div>
          <button className="btn-ghost" style={{ marginTop: 10, color: AZUL_MEDIO, background: CINZA_CLARO }} onClick={copiarTudo}>
            <ClipboardList size={14} /> Copiar todos os dados
          </button>
        </div>
      )}
    </div>
  );
}

function CardDocumentosArt({ cliente, documentos = [], precoDocumentacao = 0, enviarDocumento, excluirDocumento, atualizarPagamento, atualizarEmpreendimento, empreendimentosComPreco = [], notify, onExcluirCadastro }) {
  const [enviandoTipo, setEnviandoTipo] = useState(null);
  const [editandoEmpreendimento, setEditandoEmpreendimento] = useState(false);
  const [novoEmpreendimento, setNovoEmpreendimento] = useState(cliente.empreendimento || "");
  const doTipo = (tipo) => documentos.find((d) => d.tipo === tipo);
  const completo = TIPOS_DOCUMENTO_ART.every((t) => doTipo(t));

  const salvarEmpreendimento = async () => {
    if (!novoEmpreendimento.trim()) { notify("Informe o empreendimento"); return; }
    await atualizarEmpreendimento(cliente.id, novoEmpreendimento.trim());
    setEditandoEmpreendimento(false);
  };

  const aoEscolherArquivo = async (tipo, arquivo) => {
    if (!arquivo) return;
    if (arquivo.size > 7 * 1024 * 1024) { notify("Arquivo muito grande (máx. 7 MB)."); return; }
    setEnviandoTipo(tipo);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const leitor = new FileReader();
        leitor.onload = () => resolve(leitor.result);
        leitor.onerror = () => reject(new Error("Não foi possível ler o arquivo"));
        leitor.readAsDataURL(arquivo);
      });
      await enviarDocumento({ clienteId: cliente.id, tipo, nomeArquivo: arquivo.name, mimeType: arquivo.type || "application/pdf", arquivoBase64: base64 });
    } catch (e) { notify(`Erro ao anexar: ${e.message}`); }
    setEnviandoTipo(null);
  };

  return (
    <div style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{cliente.nome}</div>
          {editandoEmpreendimento ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
              <input style={{ ...inp, padding: "4px 8px", fontSize: 12.5, width: 200 }} value={novoEmpreendimento}
                onChange={(e) => setNovoEmpreendimento(e.target.value)} list={`empreendimentos-precos-${cliente.id}`}
                placeholder="Empreendimento" autoFocus onKeyDown={(e) => e.key === "Enter" && salvarEmpreendimento()} />
              <datalist id={`empreendimentos-precos-${cliente.id}`}>
                {empreendimentosComPreco.map((e) => <option key={e} value={e} />)}
              </datalist>
              <button className="icon-btn" onClick={salvarEmpreendimento} title="Salvar"><Check size={14} color="#2E7D32" /></button>
              <button className="icon-btn" onClick={() => { setEditandoEmpreendimento(false); setNovoEmpreendimento(cliente.empreendimento || ""); }} title="Cancelar"><X size={14} /></button>
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: "#65758b", display: "flex", alignItems: "center", gap: 4 }}>
              {cliente.empreendimento || cliente.endereco || "sem empreendimento"}{cliente.blocoTorre ? ` · ${cliente.blocoTorre}` : ""}
              {cliente.telefone ? ` · ${cliente.telefone}` : ""}
              {/* Sem empreendimento cadastrado, o preço não casa com nada em "Preços por
                  empreendimento" e fica "sem preço fixado" mesmo que o valor já esteja lá —
                  a lista abaixo só sugere os que já têm preço, para não repetir o erro de digitação. */}
              {atualizarEmpreendimento && (
                <button className="icon-btn" style={{ padding: 2 }} onClick={() => setEditandoEmpreendimento(true)} title="Editar empreendimento">
                  <Edit3 size={12} color={AZUL_MEDIO} />
                </button>
              )}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Valor fixado pela Gerência para o empreendimento deste cliente. */}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#8593a8" }}>Valor do serviço</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: precoDocumentacao ? AZUL_MARINHO : "#B26A00" }}>
              {precoDocumentacao ? fmtReal(precoDocumentacao) : "sem preço fixado"}
            </div>
          </div>
          <Selo valor={completo ? STATUS_DOC_CONCLUIDA : STATUS_DOC_PROCESSANDO} />
          {onExcluirCadastro && (
            <button className="icon-btn" onClick={() => onExcluirCadastro(cliente)} title="Apagar cadastro deste pedido">
              <Trash2 size={15} color="#c62828" />
            </button>
          )}
        </div>
      </div>

      <DadosParaDocumentacao cliente={cliente} notify={notify} />

      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
        {TIPOS_DOCUMENTO_ART.map((tipo) => {
          const doc = doTipo(tipo);
          const enviando = enviandoTipo === tipo;
          return (
            <div key={tipo} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: CINZA_CLARO, borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: AZUL_MARINHO }}>{tipo}</div>
                <div style={{ fontSize: 12, color: doc ? "#2E7D32" : "#8593a8" }}>
                  {doc ? `✓ ${doc.nomeArquivo}` : "Nenhum arquivo anexado"}
                </div>
              </div>
              <label className="btn-ghost" style={{ color: AZUL_MEDIO, background: "#fff", cursor: enviando ? "default" : "pointer", padding: "6px 12px", margin: 0 }}>
                {enviando ? <Loader2 size={14} className="spin" /> : <Plus size={14} />} {doc ? "Substituir" : "Anexar"}
                <input type="file" accept="application/pdf,image/*" style={{ display: "none" }} disabled={enviando}
                  onChange={(e) => { aoEscolherArquivo(tipo, e.target.files?.[0]); e.target.value = ""; }} />
              </label>
              {doc && (
                <button className="icon-btn" title="Remover anexo" onClick={() => excluirDocumento(doc.id)}>
                  <Trash2 size={15} color="#c62828" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagamento é responsabilidade deste setor — por isso fica editável aqui. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${CINZA_BORDA}` }}>
        <label style={{ ...lab, margin: 0 }}>Pagamento</label>
        <select style={{ ...inp, width: "auto", padding: "6px 10px" }} value={cliente.pagamento || "Pendente"}
          onChange={(e) => atualizarPagamento(cliente.id, e.target.value)}>
          {PAGAMENTO_OPCOES.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <Selo valor={cliente.pagamento || "Pendente"} />
      </div>

      {!completo && (
        <div style={{ fontSize: 12, color: "#B26A00", marginTop: 8 }}>
          <AlertTriangle size={12} style={{ verticalAlign: "-1px", marginRight: 4 }} />
          O cliente só consegue baixar depois que os dois documentos estiverem anexados.
        </div>
      )}
    </div>
  );
}

function AbaDocumentacao({ docs, addDoc, updDoc, delDoc, carregando, notify, clientes = [], updCliente, excluirCliente, perfil, documentosArt = [], enviarDocumentoArt, excluirDocumentoArt, precos = [] }) {
  const [removendoCliente, setRemovendoCliente] = useState(null); // cadastro (clientes) do pedido a apagar

  /* Cadastros de "Documentação ART/TRT" vêm direto do portal do cliente pra cá (pulam o
     Agendamento, porque não têm vistoria). É aqui que a equipe anexa os dois documentos. */
  const clientesArt = clientes.filter((c) => ehServicoDocumentacao(c) && c.status !== "Cancelado");

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {clientesArt.length > 0 && (
        <Card icon={ClipboardList} titulo={`Documentação ART/TRT (${clientesArt.length})`}>
          <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 14px" }}>
            Clientes que pediram Documentação ART/TRT pelo portal — vêm direto pra cá, sem passar pelo Agendamento (não têm vistoria).
            Anexe os dois documentos finais: eles ficam guardados no Drive e o cliente baixa pelo portal informando CPF e e-mail.
          </p>
          <div style={{ display: "grid", gap: 12 }}>
            {clientesArt.map((c) => (
              <CardDocumentosArt key={c.id} cliente={c}
                documentos={documentosArt.filter((d) => d.clienteId === c.id)}
                precoDocumentacao={precos.find((p) => p.empreendimento === (c.empreendimento || "").trim())?.precoDocumentacao || 0}
                enviarDocumento={enviarDocumentoArt} excluirDocumento={excluirDocumentoArt}
                atualizarPagamento={(id, pagamento) => updCliente(id, { pagamento })}
                atualizarEmpreendimento={(id, empreendimento) => updCliente(id, { empreendimento })}
                empreendimentosComPreco={precos.filter((p) => p.precoDocumentacao > 0).map((p) => p.empreendimento)}
                notify={notify}
                onExcluirCadastro={perfil === "gerencia" ? setRemovendoCliente : null} />
            ))}
          </div>
        </Card>
      )}

      {/* Esta tela é só de Documentação: mostra apenas os registros do serviço "Documentação
          ART/TRT" (via somenteDocumentacao), mesmo para Gerência. O acompanhamento cruzado com
          vistoria fica na aba própria da Gerência (AbaGerenciaAcompanhamento), que reaproveita
          este mesmo componente sem esse filtro. */}
      <TabelaRegistrosVistoriaDoc docs={docs} addDoc={addDoc} updDoc={updDoc} delDoc={delDoc} carregando={carregando}
        notify={notify} clientes={clientes} somenteDocumentacao />

      <ConfirmModal aberto={!!removendoCliente} titulo="Apagar cadastro do pedido"
        mensagem={removendoCliente ? `Tem certeza que deseja apagar o cadastro de "${removendoCliente.nome || "cliente sem nome"}"? Os documentos já anexados também somem. Essa ação não pode ser desfeita.` : ""}
        onConfirm={() => { excluirCliente(removendoCliente.id); setRemovendoCliente(null); }} onCancel={() => setRemovendoCliente(null)} />
    </div>
  );
}

/* Tabela de registros de vistoria/TRT (tabela "docs"), reaproveitada em dois lugares:
   - AbaDocumentacao: só documentação (somenteDocumentacao=true), inclusive para Gerência.
   - AbaGerenciaAcompanhamento: os dois juntos (somenteDocumentacao=false) — visão cruzada
     que só a Gerência tem, pensada pra acompanhar vistoria e documentação lado a lado. */
function TabelaRegistrosVistoriaDoc({ docs, addDoc, updDoc, delDoc, carregando, notify, clientes = [], somenteDocumentacao = false }) {
  const [editando, setEditando] = useState(null); // registro (cópia) em edição, ou null
  const [filtroVistoria, setFiltroVistoria] = useState("");
  const [busca, setBusca] = useState("");
  const [removendo, setRemovendo] = useState(null);

  /* Registro sem cliente correspondente (criado na mão aqui) continua aparecendo mesmo
     filtrando por documentação — não tem como saber a que serviço pertence. */
  const clientePorCpf = (cpf) => {
    const cpfLimpo = (cpf || "").replace(/\D/g, "");
    return cpfLimpo ? clientes.find((c) => (c.cpf || "").replace(/\D/g, "") === cpfLimpo) : null;
  };

  const filtrados = docs.filter((d) => {
    if (somenteDocumentacao) {
      const cli = clientePorCpf(d.cpf);
      if (cli && !ehServicoDocumentacao(cli)) return false;
    }
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
  const avancarStatusProducao = (d) => {
    const i = STATUS_PRODUCAO_OPCOES.indexOf(d.statusProducao);
    const proximo = STATUS_PRODUCAO_OPCOES[(i + 1) % STATUS_PRODUCAO_OPCOES.length];
    updDoc(d.id, { statusProducao: proximo });
  };

  return (
    <>
      <Card icon={ClipboardCheck} titulo={somenteDocumentacao ? "Controle de Documentação ART/TRT" : "Acompanhamento — vistorias e documentação"}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <input style={{ ...inp, flex: 1, minWidth: 200 }} placeholder="Buscar por cliente ou empreendimento…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <select style={inp} value={filtroVistoria} onChange={(e) => setFiltroVistoria(e.target.value)}>
            <option value="">Todas as vistorias</option>
            {VISTORIA_OPCOES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <button className="btn-add" style={{ width: "auto", padding: "9px 16px" }} onClick={abrirNovo}><Plus size={16} /> Novo registro</button>
        </div>

        {carregando && <p style={{ color: "#8593a8", fontSize: 14 }}>Carregando registros…</p>}
        {!carregando && filtrados.length === 0 && <p style={{ color: "#8593a8", fontSize: 14 }}>Nenhum registro encontrado. Clique em "Novo registro" para começar.</p>}

        {filtrados.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: CINZA_CLARO }}>
                  {["Cliente", "Empreendimento", "Data", "Pagamento", "Valor", "Vistoria", "Status", ""].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: AZUL_MARINHO, borderBottom: `2px solid ${CINZA_BORDA}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((d) => (
                  <tr key={d.id} style={{ borderBottom: `1px solid ${CINZA_BORDA}` }}>
                    <td style={{ padding: "8px 10px", fontWeight: 600 }}>{d.cliente || "—"}</td>
                    <td style={{ padding: "8px 10px" }}>{d.empreendimento || "—"}{d.blocoTorre ? ` · ${d.blocoTorre}` : ""}</td>
                    <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{d.data ? d.data.split("-").reverse().join("/") : "—"}</td>
                    <td style={{ padding: "8px 10px" }}><Selo valor={d.pagamento} /></td>
                    <td style={{ padding: "8px 10px", whiteSpace: "nowrap", fontSize: 12, color: "#4a5a70" }}>
                      {((Number(d.valorVistoria) || 0) + (Number(d.valorTrt) || 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td style={{ padding: "8px 10px" }}><Selo valor={d.vistoria} /></td>
                    <td style={{ padding: "8px 10px" }}>
                      <button className="icon-btn" style={{ padding: 0 }} title="Clique para avançar o status" onClick={() => avancarStatusProducao(d)}>
                        <Selo valor={d.statusProducao} />
                      </button>
                    </td>
                    <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                      <button className="icon-btn" onClick={() => abrirEdicao(d)}><Edit3 size={15} color={AZUL_MEDIO} /></button>
                      <button className="icon-btn" onClick={() => setRemovendo(d)}><Trash2 size={15} color="#c62828" /></button>
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
              <Field label="Bloco / Apto / Complemento" value={editando.blocoTorre} onChange={(v) => setEditando({ ...editando, blocoTorre: v })} />
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
                <label style={lab}>Tipo de ART/TRT</label>
                <select style={inp} value={editando.tipoArt} onChange={(e) => setEditando({ ...editando, tipoArt: e.target.value })}>
                  {TIPO_ART_OPCOES.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div style={cell()}>
                <label style={lab}>Status</label>
                <select style={inp} value={editando.statusProducao} onChange={(e) => setEditando({ ...editando, statusProducao: e.target.value })}>
                  {STATUS_PRODUCAO_OPCOES.map((o) => <option key={o} value={o}>{o}</option>)}
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

      <ConfirmModal aberto={!!removendo} titulo="Excluir registro"
        mensagem={removendo ? `Tem certeza que deseja excluir o registro de "${removendo.cliente || "cliente sem nome"}"? Essa ação não pode ser desfeita.` : ""}
        onConfirm={() => { delDoc(removendo.id); setRemovendo(null); }} onCancel={() => setRemovendo(null)} />
    </>
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
const fmtReal = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const SERVICO_VISTORIA = "Vistoria de entrega de chaves";

/* Indicadores de "Vistorias" agora vêm de clientes (cadastros reais do portal público),
   não de docs — docs só ganha uma linha quando a equipe cria manualmente um registro em
   Documentação, o que deixava esses números zerados mesmo com cadastros reais existindo. */
function CardIndicadoresGerais({ docs, clientes = [], modo = "completo" }) {
  const vistoriasClientes = clientes.filter((c) => c.servico === SERVICO_VISTORIA);
  const totalRegistros = vistoriasClientes.length;
  const concluidas = vistoriasClientes.filter((c) => c.atendido).length;

  const contarPor = (campo) => docs.reduce((acc, d) => { acc[d[campo]] = (acc[d[campo]] || 0) + 1; return acc; }, {});
  const porStatusProducao = contarPor("statusProducao");

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
              <FileText size={14} /> ART Documentações
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              <KpiCard label="Recebido" valor={porStatusProducao["Recebido"] || 0} cor="#2C75B5" Icon={FileText} />
              <KpiCard label="Em produção" valor={porStatusProducao["Em produção"] || 0} cor="#B26A00" Icon={FileText} />
              <KpiCard label="Realizado" valor={porStatusProducao["Realizado"] || 0} cor="#2E7D32" Icon={FileText} />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
function FaixaIndicadoresGerais({ docs, clientes = [], modo = "completo", style }) {
  return <div style={style}><CardIndicadoresGerais docs={docs} clientes={clientes} modo={modo} /></div>;
}

/* ---- Gerência · Visão geral ---- */
function CardCadastrosClientes({ clientes }) {
  const total = clientes.length;
  const atendidos = clientes.filter((c) => c.atendido).length;
  const pendentes = total - atendidos;
  const porServico = clientes.reduce((acc, c) => {
    const k = c.servico?.trim() || "(sem serviço)";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  return (
    <Card icon={Users} titulo="Cadastros de clientes (portal público)">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: porServico && Object.keys(porServico).length ? 16 : 0 }}>
        <KpiCard label="Total de cadastros" valor={total} Icon={Users} />
        <KpiCard label="Atendidos" valor={atendidos} cor="#2E7D32" Icon={Check} />
        <KpiCard label="Pendentes" valor={pendentes} cor="#B26A00" Icon={ClipboardList} />
      </div>
      {Object.keys(porServico).length > 0 && (
        <div style={{ display: "grid", gap: 6 }}>
          {Object.entries(porServico).sort((a, b) => b[1] - a[1]).map(([servico, qtd]) => (
            <div key={servico} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#4a5a70", padding: "6px 0", borderBottom: `1px solid ${CINZA_BORDA}` }}>
              <span>{servico}</span>
              <strong style={{ color: AZUL_MARINHO }}>{qtd}</strong>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ---- Laudos aguardando aprovação da Gerência: pré-visualiza (reaproveita o componente
   Laudo já existente) e aprova (gera PDF + envia por e-mail automaticamente). ---- */
/* ---- Painel de laudos da Gerência ----
   Os oito estados do fluxo, o que está travado no Drive e quanto tempo a operação leva.
   É uma tela de operação, não de leitura: o que exige ação vem primeiro e com cor própria,
   e o resto fica quieto. */
function CardPainelLaudos({ painel, carregando, recarregar, usuarios = [], notify }) {
  const vazio = { de: "", ate: "", empreendimento: "", cliente: "", vistoriador: "", status: "", bloco: "", unidade: "" };
  const [filtros, setFiltros] = useState(vazio);
  const [abertos, setAbertos] = useState(false);
  const set = (k, v) => setFiltros((f) => ({ ...f, [k]: v }));
  const ativos = Object.entries(filtros).filter(([, v]) => String(v || "").trim()).length;

  const i = painel?.indicadores;
  const t = painel?.tempos;

  /* Ordem por urgência, não por etapa do fluxo: o que espera decisão da gerência primeiro.
     "Precisa de ação" ganha cor; o resto é acompanhamento e fica neutro. */
  const cartoes = [
    { r: "Aguardando análise", v: i?.aguardandoAnalise, cor: "#B26A00", acao: true },
    { r: "Reenviadas", v: i?.reenviadas, cor: "#B26A00", acao: true },
    { r: "Erro no Drive", v: i?.arquivosComErro, cor: "#C62828", acao: true,
      apoio: i?.laudosComErroDrive ? `em ${i.laudosComErroDrive} laudo(s)` : null },
    { r: "Em análise", v: i?.emAnalise, cor: AZUL_MEDIO },
    { r: "Devolvidas", v: i?.devolvidas, cor: "#C62828" },
    { r: "Aprovadas", v: i?.aprovadas, cor: "#2E7D32" },
    { r: "Finalizados", v: i?.finalizados, cor: "#2E7D32" },
    { r: "Enviados ao cliente", v: i?.enviadosAoCliente, cor: "#2E7D32" },
    { r: "Sem laudo ainda", v: i?.emRascunho, cor: "#65758b", apoio: "vistorias atribuídas" },
  ];

  const campo = { padding: "7px 9px", border: `1px solid ${CINZA_BORDA}`, borderRadius: 8, fontSize: 12.5, width: "100%", fontFamily: "inherit" };
  const rotulo = { fontSize: 11, fontWeight: 600, color: "#65758b", display: "block", marginBottom: 3 };

  return (
    <Card icon={BarChart3} titulo="Painel de laudos">
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <p style={{ fontSize: 13.5, color: "#65758b", margin: 0, flex: 1, minWidth: 200 }}>
          Onde está cada laudo, o que travou no arquivamento e quanto tempo a operação leva.
        </p>
        <button className="btn-ghost" onClick={() => setAbertos((a) => !a)}>
          <Filter size={14} /> Filtros{ativos ? ` (${ativos})` : ""}
        </button>
        <button className="btn-ghost" onClick={() => recarregar(filtros)}>
          {carregando ? <Loader2 size={14} className="spin" /> : <RefreshCcw size={14} />} Atualizar
        </button>
      </div>

      {abertos && (
        <div style={{ background: CINZA_CLARO, borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
            <div><label style={rotulo}>Vistoria de</label><input type="date" style={campo} value={filtros.de} onChange={(e) => set("de", e.target.value)} /></div>
            <div><label style={rotulo}>até</label><input type="date" style={campo} value={filtros.ate} onChange={(e) => set("ate", e.target.value)} /></div>
            {/* Condomínio e empreendimento são o mesmo campo no cadastro — um filtro só. */}
            <div><label style={rotulo}>Empreendimento / condomínio</label><input style={campo} value={filtros.empreendimento} onChange={(e) => set("empreendimento", e.target.value)} placeholder="parte do nome" /></div>
            <div><label style={rotulo}>Cliente</label><input style={campo} value={filtros.cliente} onChange={(e) => set("cliente", e.target.value)} placeholder="parte do nome" /></div>
            <div><label style={rotulo}>Bloco / torre</label><input style={campo} value={filtros.bloco} onChange={(e) => set("bloco", e.target.value)} /></div>
            <div><label style={rotulo}>Unidade</label><input style={campo} value={filtros.unidade} onChange={(e) => set("unidade", e.target.value)} /></div>
            <div>
              <label style={rotulo}>Vistoriador</label>
              <select style={campo} value={filtros.vistoriador} onChange={(e) => set("vistoriador", e.target.value)}>
                <option value="">todos</option>
                {usuarios.filter((u) => u.role === "vistoriador").map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
            <div>
              <label style={rotulo}>Situação</label>
              <select style={campo} value={filtros.status} onChange={(e) => set("status", e.target.value)}>
                <option value="">todas</option>
                {(painel?.statusDisponiveis || []).map((s) => <option key={s.valor} value={s.valor}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
            <button className="btn-ghost" onClick={() => { setFiltros(vazio); recarregar({}); }}>Limpar</button>
            <button className="btn-solid" onClick={() => recarregar(filtros)}>Aplicar</button>
          </div>
        </div>
      )}

      {!painel && carregando && <p style={{ color: "#8593a8", fontSize: 14 }}>Carregando…</p>}

      {painel && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))", gap: 9 }}>
            {cartoes.map((c) => (
              <div key={c.r} style={{
                border: `1px solid ${c.acao && c.v > 0 ? `${c.cor}55` : CINZA_BORDA}`,
                background: c.acao && c.v > 0 ? `${c.cor}0d` : "#fff",
                borderRadius: 10, padding: "11px 13px",
              }}>
                <div style={{ fontSize: 23, fontWeight: 800, lineHeight: 1.1, color: c.v > 0 ? c.cor : "#c2cbd8", fontVariantNumeric: "tabular-nums" }}>
                  {c.v ?? 0}
                </div>
                <div style={{ fontSize: 11.5, color: "#65758b", marginTop: 2 }}>{c.r}</div>
                {c.apoio && <div style={{ fontSize: 10.5, color: "#8593a8", marginTop: 1 }}>{c.apoio}</div>}
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10, marginTop: 12 }}>
            {[
              { r: "Da vistoria à aprovação", v: t?.diasVistoriaAteAprovacao, apoio: "inclui o tempo do técnico redigindo" },
              { r: "Do envio à aprovação", v: t?.diasEnvioAteAprovacao, apoio: "só a revisão da gerência" },
            ].map((m) => (
              <div key={m.r} style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: "11px 13px" }}>
                <div style={{ fontSize: 19, fontWeight: 800, color: AZUL_MARINHO, fontVariantNumeric: "tabular-nums" }}>
                  {m.v === null || m.v === undefined ? "—" : `${String(m.v).replace(".", ",")} dia(s)`}
                </div>
                <div style={{ fontSize: 11.5, color: "#65758b", marginTop: 2 }}>{m.r}</div>
                <div style={{ fontSize: 10.5, color: "#8593a8", marginTop: 1 }}>{m.apoio}</div>
              </div>
            ))}
          </div>

          {/* Média sem base é número solto: 12 dias apurados sobre 1 laudo parecem iguais a
              12 dias sobre 200. A base fica escrita junto. */}
          <p style={{ fontSize: 11.5, color: "#8593a8", margin: "9px 0 0" }}>
            {t?.base
              ? `Médias apuradas sobre ${t.base} laudo(s) já aprovado(s).`
              : "Ainda não há laudo aprovado no recorte selecionado — sem base para calcular as médias."}
          </p>
        </>
      )}
    </Card>
  );
}

/* Estado do arquivamento no Drive, em uma linha. O laudo não deve ser aprovado como
   "finalizado" enquanto houver obrigatório pendente — então a gerência precisa ver isso
   antes de clicar em aprovar, não depois. */
function SeloSincronizacao({ drive }) {
  if (!drive || !drive.total) {
    return <span style={{ fontSize: 11.5, color: "#8593a8" }}>Drive: aguardando envio</span>;
  }
  const { sincronizados, total, comErro, completo, linkPasta } = drive;
  const cor = comErro ? "#C62828" : completo ? "#2E7D32" : "#B26A00";
  const fundo = comErro ? "#FCEAEA" : completo ? "#E6F4EA" : "#FFF4E0";
  const texto = comErro
    ? `Erro de sincronização (${comErro} de ${total})`
    : completo ? `Sincronizado (${sincronizados}/${total})`
    : `Enviando para o Drive (${sincronizados}/${total})`;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: cor, background: fundo, border: `1px solid ${cor}33`, borderRadius: 20, padding: "1px 9px" }}>
        {texto}
      </span>
      {/* Abrir a pasta do cliente direto do sistema. O link não torna nada público: só
          quem já tem acesso à conta do Drive da FN consegue abrir. */}
      {linkPasta && (
        <a href={linkPasta} target="_blank" rel="noreferrer"
          style={{ fontSize: 11.5, color: AZUL_MEDIO, display: "inline-flex", alignItems: "center", gap: 3 }}>
          <ExternalLink size={12} /> pasta no Drive
        </a>
      )}
    </span>
  );
}

/* Edição do laudo pela própria Gerência (sem devolver pro vistoriador) — pensada pra
   ajuste pontual de texto/severidade, não pra trocar foto. Trabalha em cópia local e só
   grava (via editarLaudo) quando a gerência clica em salvar. */
function EditorLaudoGerencia({ laudo, onSalvar, onCancelar, salvando, patologiasBanco = [] }) {
  const [dados, setDadosEdit] = useState(() => JSON.parse(JSON.stringify(laudo.dados || {})));
  const [itens, setItensEdit] = useState(() => (laudo.itens || []).map((i) => ({ ...i })));
  const [excluindoItemId, setExcluindoItemId] = useState(null);

  const setD = (grupo, campo, val) => setDadosEdit((d) => ({ ...d, [grupo]: { ...(d[grupo] || {}), [campo]: val } }));
  const setItemCampo = (id, campo, val) => setItensEdit((arr) => arr.map((i) => (i.id === id ? { ...i, [campo]: val } : i)));
  /* Mesmo banco de patologias do item de vistoria (ver ItemCard) — a gerência troca a
     patologia do item direto por aqui, sem precisar devolver pro vistoriador. */
  const escolherPatologiaItem = (itemId, tipo) => {
    if (!tipo.startsWith("bp-")) return;
    const p = patologiasBanco.find((x) => x.id === tipo.slice(3));
    if (!p) return;
    setItensEdit((arr) => arr.map((i) => (i.id === itemId ? { ...i, ...paraItemDeLaudo(p, i.local || "") } : i)));
  };
  /* A gerência remove um item direto na correção (ex.: item sem descrição/recomendação,
     duplicado, ou lançado por engano) — sem precisar devolver pro vistoriador só por isso.
     A exclusão só existe na cópia local; só vira definitiva quando "Salvar correções". */
  const excluirItem = (itemId) => setItensEdit((arr) => arr.filter((i) => i.id !== itemId));

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <p style={{ fontSize: 13, color: "#65758b", margin: 0, lineHeight: 1.55 }}>
        Corrija texto, local ou severidade diretamente aqui. Fotos não são editáveis por aqui — se precisar trocar foto, use "Devolver para correção".
      </p>

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: AZUL_MARINHO, marginBottom: 8 }}>Dados do laudo</div>
        <Grid>
          <Field label="Contratante" value={dados.contratante?.nome || ""} onChange={(v) => setD("contratante", "nome", v)} />
          <Field label="CPF" value={dados.contratante?.cpf || ""} onChange={(v) => setD("contratante", "cpf", v)} />
          <Field label="Construtora" value={dados.imovel?.construtora || ""} onChange={(v) => setD("imovel", "construtora", v)} />
          <Field label="Empreendimento" value={dados.imovel?.empreendimento || ""} onChange={(v) => setD("imovel", "empreendimento", v)} />
          <Field label="Unidade" value={dados.imovel?.unidade || ""} onChange={(v) => setD("imovel", "unidade", v)} />
          <Field label="Endereço" value={dados.imovel?.endereco || ""} onChange={(v) => setD("imovel", "endereco", v)} full />
        </Grid>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: AZUL_MARINHO, marginBottom: 8 }}>Responsável técnico</div>
        <Grid>
          <Field label="Nome" value={dados.rt?.nome || ""} onChange={(v) => setD("rt", "nome", v)} />
          <Field label="Qualificação" value={dados.rt?.qualificacao || ""} onChange={(v) => setD("rt", "qualificacao", v)} />
          <Field label="Registro profissional" value={dados.rt?.registro || ""} onChange={(v) => setD("rt", "registro", v)} full />
        </Grid>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: AZUL_MARINHO, marginBottom: 8 }}>Itens da vistoria ({itens.length})</div>
        {itens.length === 0 && <p style={{ color: "#8593a8", fontSize: 13 }}>Nenhum item registrado.</p>}
        <div style={{ display: "grid", gap: 12 }}>
          {itens.map((item, i) => {
            const termoLocal = (item.local || "").trim().toLowerCase();
            const ambienteSlugItem = listarAmbientes().find((a) => a.nome.toLowerCase() === termoLocal)?.slug || "";
            const opcoesItem = patologiasPorAmbiente(patologiasBanco, ambienteSlugItem);
            const especificasItem = opcoesItem.filter((p) => p.especificaDoAmbiente);
            const genericasItem = opcoesItem.filter((p) => !p.especificaDoAmbiente);
            return (
            <div key={item.id} style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#8593a8", flex: 1 }}>Item {i + 1}</div>
                <button type="button" className="icon-btn" onClick={() => setExcluindoItemId(item.id)} title="Excluir item">
                  <Trash2 size={14} color="#c62828" />
                </button>
              </div>
              {/* Mesmo cartão que aparece no laudo final, com as fotos — atualiza junto com a
                  edição abaixo, pra a gerência ver exatamente o que está corrigindo. */}
              <div style={{ marginBottom: 12 }}>
                <ItemLaudo item={item} num={i + 1} />
              </div>
              <Grid>
                <Field label="Local" value={item.local} onChange={(v) => setItemCampo(item.id, "local", v)} />
                <Field label="Patologia" value={item.patologia} onChange={(v) => setItemCampo(item.id, "patologia", v)} />
                <div style={cell(false)}>
                  <label style={lab}>Severidade</label>
                  <select style={inp} value={item.severidade} onChange={(e) => setItemCampo(item.id, "severidade", e.target.value)}>
                    {["Baixa", "Média", "Alta"].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </Grid>
              {/* Troca a patologia inteira (texto, severidade, norma, recomendação) pela do
                  banco — a gerência não precisa reescrever tudo na mão pra corrigir um item
                  que só tem a patologia errada. Sempre volta pro placeholder depois de
                  escolher: é uma ação de substituição, não um campo que reflete o item. */}
              <div style={{ marginTop: 10, background: "#f4f8fd", border: "1px solid #dbe7f4", borderRadius: 11, padding: 13 }}>
                <label style={{ ...lab, display: "block", marginBottom: 6 }}>Trocar por outra patologia do banco (opcional)</label>
                <select style={{ ...inp, width: "100%" }} value="" onChange={(e) => escolherPatologiaItem(item.id, e.target.value)}>
                  <option value="">selecionar patologia…</option>
                  {especificasItem.length > 0 && (
                    <optgroup label={`Específicas de ${item.local}`}>
                      {especificasItem.map((p) => <option key={`bp-${p.id}`} value={`bp-${p.id}`}>{p.nome}</option>)}
                    </optgroup>
                  )}
                  <optgroup label="Aplicam-se a qualquer ambiente">
                    {genericasItem.map((p) => <option key={`bp-${p.id}`} value={`bp-${p.id}`}>{p.nome}</option>)}
                  </optgroup>
                </select>
              </div>
              <Area label="Descrição" value={item.descricao} onChange={(v) => setItemCampo(item.id, "descricao", v)} rows={3} />
              <Area label="Recomendação" value={item.recomendacao} onChange={(v) => setItemCampo(item.id, "recomendacao", v)} rows={2} />
            </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
        <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO }} onClick={onCancelar} disabled={salvando}>Cancelar edição</button>
        <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: "#EAF2FB" }} onClick={() => onSalvar({ dados, itens }, false)} disabled={salvando}>
          {salvando ? <Loader2 size={14} className="spin" /> : <Save size={14} />} Salvar correções
        </button>
        <button className="btn-solid" onClick={() => onSalvar({ dados, itens }, true)} disabled={salvando}>
          {salvando ? <Loader2 size={14} className="spin" /> : <Mail size={14} />} Salvar e enviar por e-mail
        </button>
      </div>

      <ConfirmModal aberto={!!excluindoItemId} titulo="Excluir item"
        mensagem={`Tem certeza que deseja excluir este item do laudo? A exclusão só é definitiva ao clicar em "Salvar correções" ou "Salvar e enviar por e-mail".`}
        onConfirm={() => { excluirItem(excluindoItemId); setExcluindoItemId(null); }}
        onCancel={() => setExcluindoItemId(null)} />
    </div>
  );
}

function CardLaudosPendentes({ laudosPendentes = [], carregando, aprovarLaudo, devolverLaudo, editarLaudo, reenviarDrive, marcarEmAnalise, assinatura, notify, patologiasBanco = [] }) {
  const [previewId, setPreviewId] = useState(null);
  const [aprovandoId, setAprovandoId] = useState(null);
  /* Devolver exige motivo: é ele que o técnico vê no topo do formulário ao reabrir o laudo. */
  const [devolvendoId, setDevolvendoId] = useState(null);
  const [motivoDevolucao, setMotivoDevolucao] = useState("");
  const [enviandoDevolucao, setEnviandoDevolucao] = useState(false);
  const [editando, setEditando] = useState(false);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const laudoPreview = laudosPendentes.find((l) => l.doc_id === previewId);

  const abrirPreview = (docId) => { setPreviewId(docId); setEditando(false); marcarEmAnalise?.(docId); };

  const aprovar = async (docId) => {
    setAprovandoId(docId);
    await aprovarLaudo(docId);
    setAprovandoId(null);
    if (previewId === docId) setPreviewId(null);
  };

  /* Gerência corrige direto (sem devolver pro vistoriador). "enviarTambem" já aprova em
     seguida — evita salvar e ter que clicar de novo em Aprovar com os dados na tela. */
  const salvarEdicao = async (patch, enviarTambem) => {
    setSalvandoEdicao(true);
    const ok = await editarLaudo(previewId, patch);
    setSalvandoEdicao(false);
    if (!ok) return;
    notify("Correções salvas ✓");
    setEditando(false);
    if (enviarTambem) await aprovar(previewId);
  };

  const abrirDevolucao = (docId) => { setDevolvendoId(docId); setMotivoDevolucao(""); };
  const confirmarDevolucao = async () => {
    const motivo = motivoDevolucao.trim();
    if (!motivo) { notify("Descreva o que precisa ser corrigido."); return; }
    setEnviandoDevolucao(true);
    const ok = await devolverLaudo(devolvendoId, motivo);
    setEnviandoDevolucao(false);
    if (ok) {
      if (previewId === devolvendoId) setPreviewId(null);
      setDevolvendoId(null);
      setMotivoDevolucao("");
    }
  };

  const contagemPreview = { Baixa: 0, Média: 0, Alta: 0 };
  (laudoPreview?.itens || []).forEach((i) => { if (i.tipo && contagemPreview[i.severidade] !== undefined) contagemPreview[i.severidade]++; });

  return (
    <Card icon={Mail} titulo={`Laudos aguardando aprovação (${laudosPendentes.length})`}>
      <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 14px" }}>
        Ao aprovar, o sistema gera o PDF final e envia automaticamente por e-mail para o endereço já cadastrado do cliente — sem precisar digitar nada.
      </p>

      {carregando && <p style={{ color: "#8593a8", fontSize: 14 }}>Carregando…</p>}
      {!carregando && laudosPendentes.length === 0 && <p style={{ color: "#8593a8", fontSize: 14 }}>Nenhum laudo aguardando aprovação no momento.</p>}

      <div style={{ display: "grid", gap: 10 }}>
        {laudosPendentes.map((l) => (
          <div key={l.doc_id} style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                {l.cliente}
                {/* Reenvio é retrabalho: já passou por aqui e voltou corrigido. */}
                {l.ehReenvio && (
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: "#B26A00", background: "#FFF4E0", border: "1px solid #f0c987", borderRadius: 20, padding: "1px 8px" }}>
                    Reenviado · v{l.laudo_versao}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12.5, color: "#65758b" }}>
                {l.empreendimento}{l.bloco_torre ? ` · ${l.bloco_torre}` : ""} · enviado em {new Date(l.laudo_criado_em).toLocaleString("pt-BR")}
              </div>
              <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <SeloSincronizacao drive={l.drive} />
                {l.drive?.comErro > 0 && (
                  <button className="btn-ghost" style={{ color: "#C62828", background: "#fff", padding: "2px 9px", fontSize: 11.5 }}
                    onClick={() => reenviarDrive(l.doc_id)}>
                    <RefreshCcw size={12} /> Reenviar ao Drive
                  </button>
                )}
              </div>
            </div>
            <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO }} onClick={() => abrirPreview(l.doc_id)}>
              <Eye size={14} /> Pré-visualizar
            </button>
            <button className="btn-ghost" style={{ color: "#B26A00", background: "#FFF4E0" }} onClick={() => abrirDevolucao(l.doc_id)}>
              <Undo2 size={14} /> Devolver para correção
            </button>
            <button className="btn-solid" onClick={() => aprovar(l.doc_id)} disabled={aprovandoId === l.doc_id}>
              {aprovandoId === l.doc_id ? <Loader2 size={14} className="spin" /> : <Mail size={14} />} Aprovar e enviar por e-mail
            </button>
          </div>
        ))}
      </div>

      {laudoPreview && (
        <div className="no-print" style={overlay} onClick={() => setPreviewId(null)}>
          <div style={{ ...modal, maxWidth: 780, maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <strong>{editando ? "Corrigir laudo" : "Pré-visualização do laudo"}</strong>
              <button className="icon-btn" onClick={() => setPreviewId(null)}><X size={16} /></button>
            </div>

            {editando ? (
              <EditorLaudoGerencia laudo={laudoPreview} salvando={salvandoEdicao}
                onCancelar={() => setEditando(false)}
                onSalvar={(patch, enviarTambem) => salvarEdicao(patch, enviarTambem)}
                patologiasBanco={patologiasBanco} />
            ) : (
              <>
                {/* Mesma peça que o cliente recebe — a gerência aprova vendo o resultado final. */}
                <LaudoModelo laudo={montarLaudoModelo(laudoPreview.dados, laudoPreview.itens || [])} assinatura={assinatura}
                  assinaturaVistoriador={laudoPreview.vistoriador_assinatura ? { imagem: laudoPreview.vistoriador_assinatura } : null} />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                  <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO }} onClick={() => setPreviewId(null)}>Fechar</button>
                  <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: "#EAF2FB" }} onClick={() => setEditando(true)}>
                    <Edit3 size={14} /> Editar e corrigir
                  </button>
                  <button className="btn-ghost" style={{ color: "#B26A00", background: "#FFF4E0" }} onClick={() => abrirDevolucao(laudoPreview.doc_id)}>
                    <Undo2 size={14} /> Devolver para correção
                  </button>
                  <button className="btn-solid" onClick={() => aprovar(laudoPreview.doc_id)} disabled={aprovandoId === laudoPreview.doc_id}>
                    {aprovandoId === laudoPreview.doc_id ? <Loader2 size={14} className="spin" /> : <Mail size={14} />} Aprovar e enviar por e-mail
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Motivo da devolução: o texto vai para o topo do formulário do técnico, então
          precisa dizer o que corrigir — não é um campo de registro interno. */}
      {devolvendoId && (
        <div className="no-print" style={overlay} onClick={() => setDevolvendoId(null)}>
          <div style={{ ...modal, maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <strong>Devolver laudo para correção</strong>
              <button className="icon-btn" onClick={() => setDevolvendoId(null)}><X size={16} /></button>
            </div>
            <p style={{ fontSize: 13, color: "#65758b", margin: "0 0 12px", lineHeight: 1.55 }}>
              O vistoriador volta a poder editar este laudo e vê o motivo abaixo em destaque no
              formulário. Depois de corrigir, ele reenvia e o laudo aparece de novo nesta fila.
            </p>
            <label style={{ fontSize: 12, fontWeight: 600, color: AZUL_MARINHO, display: "block", marginBottom: 5 }}>
              O que precisa ser corrigido
            </label>
            <textarea
              value={motivoDevolucao}
              onChange={(e) => setMotivoDevolucao(e.target.value)}
              rows={5}
              autoFocus
              placeholder="Ex.: A foto do item 3 está desfocada e a descrição da infiltração do banheiro não cita a norma."
              style={{ width: "100%", padding: "10px 12px", border: `1px solid ${CINZA_BORDA}`, borderRadius: 9, fontSize: 13.5, fontFamily: "inherit", resize: "vertical" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO }} onClick={() => setDevolvendoId(null)}>Cancelar</button>
              <button className="btn-solid" style={{ background: "#B26A00" }} onClick={confirmarDevolucao} disabled={enviandoDevolucao || !motivoDevolucao.trim()}>
                {enviandoDevolucao ? <Loader2 size={14} className="spin" /> : <Undo2 size={14} />} Devolver ao vistoriador
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

/* Atendimento pediu pra cancelar uma vistoria já agendada — só a Gerência decide se
   apaga o compromisso de vez (libera o horário) ou mantém como estava. */
function CardCancelamentosPendentes({ clientes = [], usuarios = [], updCliente, notify }) {
  const pendentes = clientes.filter((c) => c.status === "Cancelamento solicitado");
  const nomeVistoriador = (id) => usuarios.find((u) => String(u.id) === String(id))?.nome || "—";

  const apagar = async (c) => {
    try { await updCliente(c.id, { status: "Cancelado" }); notify("Vistoria cancelada ✓"); }
    catch (e) { notify(`Erro: ${e.message}`); }
  };
  const manter = async (c) => {
    try { await updCliente(c.id, { status: "Vistoria agendada" }); notify("Agendamento mantido"); }
    catch (e) { notify(`Erro: ${e.message}`); }
  };

  if (pendentes.length === 0) return null;

  return (
    <Card icon={AlertTriangle} titulo={`Cancelamentos de vistoria pendentes (${pendentes.length})`}>
      <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 14px" }}>
        O Atendimento pediu para cancelar estas vistorias já agendadas. Decida se apaga o compromisso ou mantém como estava.
      </p>
      <div style={{ display: "grid", gap: 10 }}>
        {pendentes.map((c) => (
          <div key={c.id} style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{c.nome}</div>
              <div style={{ fontSize: 12.5, color: "#65758b" }}>
                {c.empreendimento || c.endereco || "—"} · {c.dataDesejada ? c.dataDesejada.split("-").reverse().join("/") : "sem data"}{c.horarioDesejado ? ` · ${c.horarioDesejado}` : ""} · técnico: {nomeVistoriador(c.vistoriadorId)}
              </div>
            </div>
            <button className="btn-ghost" style={{ color: "#C62828", background: CINZA_CLARO }} onClick={() => apagar(c)}>
              <Trash2 size={14} /> Apagar
            </button>
            <button className="btn-solid" onClick={() => manter(c)}>Manter agendamento</button>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* Quantas pessoas abriram o sistema. "Acessos" conta cada vez que alguém abriu;
   "visitantes" conta navegadores diferentes (uma pessoa que volta várias vezes conta 1). */
function CardAcessos({ dados, carregando }) {
  const r = dados?.resumo;
  const porDia = dados?.porDia || [];
  const porArea = dados?.porArea || [];

  const nomeArea = { portal: "Portal do cliente", equipe: "Área da equipe" };
  const maxDia = Math.max(1, ...porDia.map((d) => d.acessos));
  const ultimos = porDia.slice(-14);

  const Numero = ({ titulo, acessos, visitantes, destaque }) => (
    <div>
      <div style={{ fontSize: 12.5, color: "#65758b", marginBottom: 4 }}>{titulo}</div>
      <div style={{ fontSize: destaque ? 30 : 22, fontWeight: 800, color: AZUL_MARINHO, lineHeight: 1 }}>{acessos ?? 0}</div>
      <div style={{ fontSize: 11.5, color: "#8593a8", marginTop: 3 }}>{visitantes ?? 0} pessoa(s)</div>
    </div>
  );

  return (
    <Card icon={TrendingUp} titulo="Acessos ao sistema">
      <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 14px" }}>
        Quantas vezes o link foi aberto e quantas pessoas diferentes abriram. A contagem é anônima —
        o sistema não guarda IP nem nada que identifique quem acessou.
      </p>

      {carregando && <p style={{ color: "#8593a8", fontSize: 14 }}>Carregando…</p>}
      {!carregando && !r && <p style={{ color: "#8593a8", fontSize: 14 }}>Ainda não há acessos registrados.</p>}

      {r && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 16, marginBottom: 18 }}>
            <Numero titulo="Hoje" acessos={r.acessos_hoje} visitantes={r.visitantes_hoje} destaque />
            <Numero titulo="Últimos 7 dias" acessos={r.acessos_7d} visitantes={r.visitantes_7d} />
            <Numero titulo="Últimos 30 dias" acessos={r.acessos_30d} visitantes={r.visitantes_30d} />
            <Numero titulo="Desde o início" acessos={r.acessos} visitantes={r.visitantes} />
          </div>

          {ultimos.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: AZUL_MARINHO, marginBottom: 8 }}>Últimos dias</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 90 }}>
                {ultimos.map((d) => {
                  const dia = new Date(`${String(d.dia).slice(0, 10)}T00:00:00`);
                  return (
                    <div key={d.dia} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
                      title={`${dia.toLocaleDateString("pt-BR")} — ${d.acessos} acesso(s), ${d.visitantes} pessoa(s)`}>
                      <div style={{ fontSize: 9.5, color: "#65758b", fontWeight: 700 }}>{d.acessos}</div>
                      <div style={{ width: "100%", height: `${Math.round((d.acessos / maxDia) * 58)}px`, minHeight: 3, background: AZUL_MEDIO, borderRadius: 3 }} />
                      <div style={{ fontSize: 9, color: "#8593a8" }}>{dia.getDate()}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {porArea.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: AZUL_MARINHO, marginBottom: 8 }}>Por área</div>
              <div style={{ display: "grid", gap: 6 }}>
                {porArea.map((a) => (
                  <div key={a.area} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                    <span style={{ color: "#4a5a70" }}>{nomeArea[a.area] || a.area}</span>
                    <span><strong>{a.acessos}</strong> <span style={{ color: "#8593a8", fontSize: 12 }}>· {a.visitantes} pessoa(s)</span></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

/* Padronização dos nomes de empreendimento nos cadastros.
   O nome foi digitado livremente por muito tempo, então convivem variações da mesma coisa
   ("VILA DAS PALMEIRAS" e "RESIDENCIAL VILA DAS PALMEIRAS") e entradas de teste. Isso
   quebra indicadores, preços e a busca por tipologia. Aqui a Gerência unifica cada nome,
   sempre confirmando — nada é renomeado automaticamente, porque mexe em cadastro real. */
function semAcento(v) {
  return String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/* Quantas letras diferem entre duas palavras — pega erro de digitação ("palneiras"). */
function distanciaTexto(a, b) {
  const m = a.length, n = b.length;
  let anterior = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const atual = [i];
    for (let j = 1; j <= n; j++) {
      atual[j] = Math.min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    anterior = atual;
  }
  return anterior[n];
}

/* Melhor palpite entre os nomes oficiais. Primeiro quem contém ou está contido no digitado
   ("vila das palmeiras" x "residencial vila das palmeiras"); depois, o mais parecido em
   letras, para pegar digitação errada ("villa", "palneiras"). Sem palpite razoável devolve
   null — é o caso das entradas de teste, que devem ser excluídas e não renomeadas. */
function sugerirOficial(nome, oficiais) {
  const alvo = semAcento(nome);
  if (!alvo) return null;

  let porConteudo = null;
  for (const o of oficiais) {
    const c = semAcento(o);
    if (c === alvo) return o;
    if (c.includes(alvo) || alvo.includes(c)) {
      if (!porConteudo || Math.abs(c.length - alvo.length) < Math.abs(semAcento(porConteudo).length - alvo.length)) porConteudo = o;
    }
  }
  if (porConteudo) return porConteudo;

  let melhor = null, menor = Infinity;
  for (const o of oficiais) {
    const d = distanciaTexto(alvo, semAcento(o));
    if (d < menor) { menor = d; melhor = o; }
  }
  // Tolerância proporcional: nomes longos podem errar mais letras que nomes curtos.
  const limite = Math.max(2, Math.floor(alvo.length * 0.25));
  return menor <= limite ? melhor : null;
}

function CardPadronizarEmpreendimentos({ clientes = [], empreendimentosRef = [], padronizar, excluirCliente, notify }) {
  const [escolhas, setEscolhas] = useState({}); // { nomeAtual: nomeOficial }
  const [aplicando, setAplicando] = useState(null);
  const [confirmandoLimpeza, setConfirmandoLimpeza] = useState(null);

  const oficiais = [...new Set(empreendimentosRef.map((e) => e.empreendimento).filter(Boolean))].sort();
  const oficiaisNormalizados = new Set(oficiais.map(semAcento));

  // Agrupa os nomes usados nos cadastros que não batem com a lista oficial.
  const usados = {};
  clientes.forEach((c) => {
    const nome = (c.empreendimento || "").trim();
    if (!nome) return;
    (usados[nome] = usados[nome] || []).push(c);
  });
  const foraDoPadrao = Object.entries(usados)
    .filter(([nome]) => !oficiaisNormalizados.has(semAcento(nome)))
    .map(([nome, lista]) => ({ nome, qtd: lista.length, clientes: lista, sugestao: sugerirOficial(nome, oficiais) }))
    .sort((a, b) => b.qtd - a.qtd);

  const aplicar = async (linha) => {
    const destino = escolhas[linha.nome] || linha.sugestao;
    if (!destino) { notify("Escolha o nome oficial primeiro"); return; }
    setAplicando(linha.nome);
    await padronizar(linha.nome, destino);
    setAplicando(null);
  };

  if (foraDoPadrao.length === 0) {
    return (
      <Card icon={Building2} titulo="Padronização de empreendimentos">
        <p style={{ fontSize: 13.5, color: "#2E7D32", margin: 0 }}>
          ✓ Todos os cadastros usam nomes da lista oficial.
        </p>
      </Card>
    );
  }

  return (
    <Card icon={Building2} titulo={`Padronização de empreendimentos (${foraDoPadrao.length})`}>
      <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 14px" }}>
        Estes nomes aparecem nos cadastros mas não estão na lista oficial. Unificar corrige os
        indicadores, os preços e a busca por tipologia. Escolha o nome correto e aplique — ou
        exclua, se for cadastro de teste.
      </p>

      <div style={{ display: "grid", gap: 10 }}>
        {foraDoPadrao.map((l) => (
          <div key={l.nome} style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <strong style={{ fontSize: 14 }}>{l.nome}</strong>
              <span style={{ fontSize: 11.5, color: "#65758b", background: CINZA_CLARO, borderRadius: 20, padding: "2px 9px" }}>
                {l.qtd} cadastro(s)
              </span>
              {l.sugestao && (
                <span style={{ fontSize: 11.5, color: "#2E7D32" }}>sugestão: {l.sugestao}</span>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <select style={{ ...inp, flex: 1, minWidth: 220 }}
                value={escolhas[l.nome] ?? l.sugestao ?? ""}
                onChange={(e) => setEscolhas((s) => ({ ...s, [l.nome]: e.target.value }))}>
                <option value="">renomear para…</option>
                {oficiais.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <button className="btn-solid" style={{ width: "auto", padding: "8px 14px" }}
                onClick={() => aplicar(l)} disabled={aplicando === l.nome}>
                {aplicando === l.nome ? <Loader2 size={14} className="spin" /> : <Check size={14} />} Aplicar
              </button>
              {excluirCliente && (
                <button className="btn-ghost" style={{ color: "#C62828" }}
                  onClick={() => setConfirmandoLimpeza(l)}>
                  <Trash2 size={14} /> Excluir cadastros
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <ConfirmModal aberto={!!confirmandoLimpeza}
        titulo="Excluir cadastros de teste"
        mensagem={confirmandoLimpeza
          ? `Excluir os ${confirmandoLimpeza.qtd} cadastro(s) de "${confirmandoLimpeza.nome}"? Os clientes serão apagados junto. Essa ação não pode ser desfeita.`
          : ""}
        onConfirm={async () => {
          const alvo = confirmandoLimpeza;
          setConfirmandoLimpeza(null);
          for (const c of alvo.clientes) await excluirCliente(c.id);
          notify(`${alvo.qtd} cadastro(s) excluído(s)`);
        }}
        onCancel={() => setConfirmandoLimpeza(null)} />
    </Card>
  );
}

/* Carteira de prospecção — quais empreendimentos entram no funil comercial, com que
   prioridade e qual a ação recomendada. Base: pesquisa "Mapa Total de Empreendimentos".
   A prioridade é editável, porque a realidade muda mais rápido que a pesquisa. */
const PRIORIDADES_PROSPECCAO = ["Imediata", "Alta", "Média", "Baixa", "Futura", "Pós-entrega", "Fora do escopo", "A confirmar"];

const COR_PRIORIDADE = {
  "Imediata": { cor: "#C62828", bg: "#FCEAEA" },
  "Alta": { cor: "#C25E00", bg: "#FFEDD9" },
  "Média": { cor: "#B26A00", bg: "#FFF4E0" },
  "Baixa": { cor: "#65758b", bg: "#EEF1F5" },
  "Futura": { cor: "#2C75B5", bg: "#EAF2FB" },
  "Pós-entrega": { cor: "#0F766E", bg: "#E3F3F1" },
  "Fora do escopo": { cor: "#8593a8", bg: "#F4F6F8" },
  "A confirmar": { cor: "#8593a8", bg: "#F4F6F8" },
};

/* ================= Laudos realizados pelo técnico =================
   Duas coisas que o vistoriador não tinha como acompanhar: o que aconteceu com o laudo
   depois que ele enviou, e o que o cliente achou do atendimento dele. Aqui ele abre o
   documento exatamente como o cliente recebe — aprovado, sem tarja de rascunho - e vê a
   nota que aquele cliente deu. O servidor só devolve os laudos dele: cada técnico
   acompanha o próprio feedback, não o dos colegas. */
const ETAPAS_LAUDO = {
  "Laudo em análise": { rotulo: "Aguardando a Gerência", cor: "#B26A00", bg: "#FFF4E0" },
  "Laudo enviado por e-mail": { rotulo: "Entregue ao cliente", cor: "#2E7D32", bg: "#E8F5E9" },
};

function EstrelasNota({ nota }) {
  return (
    <span style={{ whiteSpace: "nowrap", color: "#E8A317", fontSize: 14, letterSpacing: 1 }}
      aria-label={`Nota ${nota} de 5`}>
      {"★".repeat(nota)}<span style={{ color: "#d6dbe3" }}>{"★".repeat(5 - nota)}</span>
    </span>
  );
}

function AbaLaudosRealizados({ laudos = [], carregando, recarregar, assinatura, ehGerencia, clientes = [], docs = [], usuarios = [] }) {
  const [abertoId, setAbertoId] = useState(null);
  const [filtro, setFiltro] = useState("");
  const nomePorVistoriadorId = {};
  usuarios.forEach((u) => { if (u.role === "vistoriador") nomePorVistoriadorId[u.id] = u.nome; });

  const entregues = laudos.filter((l) => l.status_cliente === "Laudo enviado por e-mail");
  const emAnalise = laudos.filter((l) => l.status_cliente === "Laudo em análise");
  const avaliados = laudos.filter((l) => l.avaliacao_nota);
  const media = avaliados.length
    ? avaliados.reduce((soma, l) => soma + Number(l.avaliacao_nota), 0) / avaliados.length
    : 0;

  /* Vistoria "sem laudo": já chegou a ser agendada ou iniciada, mas não existe nenhum "docs"
     para o CPF dela — ou seja, o técnico nunca chegou a enviar o laudo pra Gerência. Não dá
     pra usar cliente.status sozinho: uma vez que o docs nasce, o status do cliente congela
     (quem manda a partir daí é docs.statusCliente), então "Em vistoria" continua aparecendo
     mesmo depois do laudo enviado — só a ausência de um docs correspondente é confiável. */
  const temDocEnviado = (c) => {
    const cpfLimpo = (c.cpf || "").replace(/\D/g, "");
    return cpfLimpo ? docs.some((d) => (d.cpf || "").replace(/\D/g, "") === cpfLimpo) : false;
  };
  const vistoriasSemLaudo = ehGerencia
    ? clientes.filter((c) =>
        c.servico === SERVICO_VISTORIA &&
        ["Vistoria agendada", "Em vistoria"].includes(c.status) &&
        !temDocEnviado(c))
    : [];

  /* Por vistoriador: quantos laudos já entregou (vem pronto em cada laudo, vistoriador_nome)
     e quantas vistorias dele ainda não viraram laudo nenhum. */
  const porVistoriador = {};
  if (ehGerencia) {
    laudos.forEach((l) => {
      const nome = l.vistoriador_nome || "(sem técnico)";
      if (!porVistoriador[nome]) porVistoriador[nome] = { nome, feitos: 0, faltando: 0 };
      porVistoriador[nome].feitos += 1;
    });
    vistoriasSemLaudo.forEach((c) => {
      const nome = c.vistoriadorId ? (nomePorVistoriadorId[c.vistoriadorId] || "(técnico não identificado)") : "(sem técnico atribuído)";
      if (!porVistoriador[nome]) porVistoriador[nome] = { nome, feitos: 0, faltando: 0 };
      porVistoriador[nome].faltando += 1;
    });
  }
  const listaPorVistoriador = Object.values(porVistoriador).sort((a, b) => b.feitos - a.feitos);

  const lista = laudos.filter((l) =>
    filtro === "entregues" ? l.status_cliente === "Laudo enviado por e-mail"
    : filtro === "devolvidos" ? l.laudo_status === "devolvido_correcao"
    : filtro === "analise" ? l.status_cliente === "Laudo em análise"
    : filtro === "avaliados" ? !!l.avaliacao_nota
    : true
  );

  /* Devolvido é a única situação desta lista que exige ação do técnico, então ganha filtro
     próprio — no status voltado ao cliente ("Laudo em análise") ela fica invisível. */
  const devolvidos = laudos.filter((l) => l.laudo_status === "devolvido_correcao");

  const indicadores = [
    { k: "", rotulo: "Todos", valor: laudos.length, cor: AZUL_MEDIO },
    ...(devolvidos.length ? [{ k: "devolvidos", rotulo: "Devolvidos para correção", valor: devolvidos.length, cor: "#C62828" }] : []),
    { k: "analise", rotulo: "Aguardando Gerência", valor: emAnalise.length, cor: "#B26A00" },
    { k: "entregues", rotulo: "Entregues ao cliente", valor: entregues.length, cor: "#2E7D32" },
    { k: "avaliados", rotulo: "Com feedback", valor: avaliados.length, cor: "#E8A317" },
  ];

  return (
    <Card icon={ClipboardCheck} titulo={`Laudos realizados (${laudos.length})`}>
      <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 14px" }}>
        {ehGerencia
          ? "Todos os laudos enviados, por técnico, com o retorno do cliente."
          : "Seus laudos e o que o cliente achou. Abrindo um laudo entregue você vê o documento exatamente como ele chegou ao cliente."}
      </p>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
        {indicadores.map((i) => {
          const ativo = filtro === i.k;
          return (
            <button key={i.rotulo} onClick={() => setFiltro(i.k)} aria-pressed={ativo}
              style={{ padding: "7px 13px", borderRadius: 20, border: `1.5px solid ${i.cor}`, cursor: "pointer",
                background: ativo ? i.cor : "#fff", color: ativo ? "#fff" : i.cor, fontSize: 12.5, fontWeight: 700 }}>
              {i.rotulo} ({i.valor})
            </button>
          );
        })}
        <button className="btn-ghost" onClick={recarregar} style={{ marginLeft: "auto" }}>
          {carregando ? <Loader2 size={14} className="spin" /> : <Check size={14} />} Atualizar
        </button>
      </div>

      {avaliados.length > 0 && (
        <div style={{ background: "#FFFBF0", border: "1px solid #f0dfae", borderRadius: 10, padding: "11px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <strong style={{ fontSize: 20, color: "#B26A00" }}>{media.toFixed(1)}</strong>
          <EstrelasNota nota={Math.round(media)} />
          <span style={{ fontSize: 12.5, color: "#65758b" }}>
            média de {avaliados.length} avaliação(ões) {ehGerencia ? "da equipe" : "dos seus clientes"}
          </span>
        </div>
      )}

      {ehGerencia && listaPorVistoriador.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: AZUL_MARINHO, marginBottom: 6 }}>
            Por vistoriador
            {vistoriasSemLaudo.length > 0 && (
              <span style={{ marginLeft: 8, background: "#FCEAEA", color: "#C62828", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 800 }}>
                {vistoriasSemLaudo.length} vistoria(s) sem laudo enviado
              </span>
            )}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: CINZA_CLARO }}>
                  {["Vistoriador", "Laudos feitos", "Vistorias sem laudo"].map((h, i) => (
                    <th key={h} style={{ textAlign: i >= 1 ? "right" : "left", padding: "8px 10px", color: AZUL_MARINHO, borderBottom: `2px solid ${CINZA_BORDA}`, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listaPorVistoriador.map((v) => (
                  <tr key={v.nome} style={{ borderBottom: `1px solid ${CINZA_BORDA}` }}>
                    <td style={{ padding: "8px 10px", fontWeight: 600 }}>{v.nome}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>{v.feitos}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: v.faltando ? "#C62828" : "#8593a8", fontWeight: v.faltando ? 700 : 400 }}>
                      {v.faltando || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {carregando && <p style={{ color: "#8593a8", fontSize: 14 }}>Carregando…</p>}
      {!carregando && lista.length === 0 && (
        <p style={{ color: "#8593a8", fontSize: 14 }}>Nenhum laudo por aqui ainda.</p>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        {lista.map((l) => {
          const etapa = ETAPAS_LAUDO[l.status_cliente] || { rotulo: l.status_cliente, cor: "#65758b", bg: CINZA_CLARO };
          const entregue = l.status_cliente === "Laudo enviado por e-mail";
          const aberto = abertoId === l.doc_id;
          const unidade = [l.bloco_torre, l.apartamento].filter(Boolean).join(" · ");
          return (
            <div key={l.doc_id} style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, overflow: "hidden" }}>
              <button onClick={() => setAbertoId(aberto ? null : l.doc_id)}
                style={{ width: "100%", background: "#fff", border: "none", cursor: "pointer", padding: 12, display: "flex", alignItems: "center", gap: 10, textAlign: "left", flexWrap: "wrap" }}>
                <span style={{ background: etapa.bg, color: etapa.cor, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}>
                  {etapa.rotulo}
                </span>
                {/* Etapa acima é o que o CLIENTE vê; esta é a situação interna do laudo.
                    Só aparece enquanto o documento está em trânsito na equipe — depois de
                    entregue as duas diriam a mesma coisa e virariam ruído. */}
                {l.laudo_status && !entregue && (
                  <span style={{
                    borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 800, whiteSpace: "nowrap",
                    ...(l.laudo_status === "devolvido_correcao"
                      ? { background: "#FCEAEA", color: "#C62828" }
                      : { background: CINZA_CLARO, color: "#65758b" }),
                  }}>
                    {l.laudoStatusLabel}{l.laudo_versao > 1 ? ` · v${l.laudo_versao}` : ""}
                  </span>
                )}
                <span style={{ flex: 1, minWidth: 160 }}>
                  <strong style={{ fontSize: 13.5, display: "block" }}>{l.cliente}</strong>
                  <span style={{ fontSize: 12, color: "#65758b" }}>
                    {l.empreendimento}{unidade ? ` · ${unidade}` : ""}
                    {ehGerencia && l.vistoriador_nome ? ` · téc.: ${l.vistoriador_nome}` : ""}
                  </span>
                </span>
                {l.avaliacao_nota ? <EstrelasNota nota={Number(l.avaliacao_nota)} />
                  : <span style={{ fontSize: 11.5, color: "#8593a8" }}>sem feedback</span>}
                {aberto ? <ChevronDown size={16} color="#8593a8" /> : <ChevronRight size={16} color="#8593a8" />}
              </button>

              {aberto && (
                <div style={{ padding: "0 12px 12px" }}>
                  {/* O que a gerência pediu para corrigir. Fica no topo do laudo aberto
                      porque é a única informação aqui que exige ação. */}
                  {l.laudo_status === "devolvido_correcao" && l.motivo_devolucao && (
                    <div style={{ display: "flex", gap: 9, background: "#FCEAEA", border: "1px solid #e8a9a9", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
                      <AlertTriangle size={15} color="#C62828" style={{ flexShrink: 0, marginTop: 2 }} />
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8f2020", marginBottom: 3 }}>
                          A gerência devolveu este laudo para correção
                        </div>
                        <div style={{ fontSize: 12.5, color: "#7a2323", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{l.motivo_devolucao}</div>
                        <div style={{ fontSize: 11.5, color: "#a05252", marginTop: 6 }}>
                          Abra a vistoria deste cliente na aba "Vistoria" para corrigir e reenviar.
                        </div>
                      </div>
                    </div>
                  )}
                  {l.avaliacao_nota && (
                    <div style={{ background: "#FFFBF0", border: "1px solid #f0dfae", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                        <EstrelasNota nota={Number(l.avaliacao_nota)} />
                        <span style={{ fontSize: 12, color: "#65758b" }}>{l.avaliacao_em ? new Date(l.avaliacao_em).toLocaleDateString("pt-BR") : ""}</span>
                        {l.avaliacao_aprovada && (
                          <span style={{ fontSize: 11, color: "#2E7D32", fontWeight: 700 }}>✓ publicado na vitrine</span>
                        )}
                      </div>
                      {l.avaliacao_comentario && (
                        <p style={{ margin: 0, fontSize: 13, color: "#4a5a70", fontStyle: "italic" }}>&ldquo;{l.avaliacao_comentario}&rdquo;</p>
                      )}
                    </div>
                  )}

                  {!entregue && (
                    <div style={{ background: "#FFF4E0", color: "#B26A00", borderRadius: 8, padding: "10px 12px", marginBottom: 12, fontSize: 12.5 }}>
                      Este laudo ainda está com a Gerência. O cliente só recebe depois da aprovação.
                    </div>
                  )}

                  {/* Mesmo documento que o cliente recebe. Só marcamos como aprovado o que já
                      foi entregue — o que está em análise continua saindo como preliminar. */}
                  <div style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 8, overflow: "hidden" }}>
                    <LaudoModelo laudo={montarLaudoModelo(l.dados || {}, l.itens || [])}
                      assinatura={assinatura}
                      assinaturaVistoriador={l.vistoriador_assinatura ? { imagem: l.vistoriador_assinatura } : null}
                      aprovado={entregue} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function CardProspeccao({ prospeccao = [], carregando, atualizar, publicarNoDrive, clientes = [], notify }) {
  const [busca, setBusca] = useState("");
  const [publicando, setPublicando] = useState(false);
  const [linkPlanilha, setLinkPlanilha] = useState(null);

  const publicar = async () => {
    setPublicando(true);
    try {
      const r = await publicarNoDrive();
      setLinkPlanilha(r.url || null);
      notify(`Planilha atualizada no Drive com ${r.total} empreendimento(s) \u2713`);
    } catch (e) { notify(`Não foi possível publicar: ${e.message}`); }
    setPublicando(false);
  };
  const [filtro, setFiltro] = useState("");
  const [abertoId, setAbertoId] = useState(null);

  // Empreendimento que já virou cliente sai do "a prospectar" e vira prova de conversão.
  const jaAtendidos = new Set(
    clientes.filter((c) => c.status !== "Cancelado").map((c) => (c.empreendimento || "").trim().toLowerCase()).filter(Boolean)
  );

  const contagem = {};
  prospeccao.forEach((p) => { contagem[p.prioridade] = (contagem[p.prioridade] || 0) + 1; });
  const convertidos = prospeccao.filter((p) => jaAtendidos.has((p.empreendimento || "").trim().toLowerCase())).length;

  const termo = busca.trim().toLowerCase();
  const lista = prospeccao
    .filter((p) => !filtro || p.prioridade === filtro)
    .filter((p) => !termo || `${p.empreendimento} ${p.acao} ${p.observacoes}`.toLowerCase().includes(termo))
    .sort((a, b) => PRIORIDADES_PROSPECCAO.indexOf(a.prioridade) - PRIORIDADES_PROSPECCAO.indexOf(b.prioridade)
      || a.empreendimento.localeCompare(b.empreendimento, "pt-BR"));

  return (
    <Card icon={TrendingUp} titulo={`Prospecção — carteira de empreendimentos (${prospeccao.length})`}>
      <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 14px" }}>
        Base do planejamento comercial. Clique num empreendimento para ver a situação da obra e
        ajustar a prioridade — as datas das construtoras mudam, então a carteira precisa acompanhar.
      </p>

      {/* Ligação com o Drive: esta tela é a carteira de verdade; a planilha é uma cópia
          publicada, para consultar no celular ou mandar para alguém. Por isso o botão
          empurra daqui para lá, e nunca o contrário. */}
      {publicarNoDrive && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", background: CINZA_CLARO, borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
          <span style={{ fontSize: 12.5, color: "#4a5a70", flex: 1, minWidth: 190 }}>
            Publicar esta carteira na planilha do Drive (sempre o mesmo arquivo).
          </span>
          {linkPlanilha && (
            <a href={linkPlanilha} target="_blank" rel="noopener noreferrer" className="btn-ghost"
              style={{ color: AZUL_MARINHO, background: "#fff", textDecoration: "none" }}>
              <ExternalLink size={14} /> Abrir planilha
            </a>
          )}
          <button className="btn-solid" style={{ width: "auto", padding: "8px 14px" }} onClick={publicar} disabled={publicando}>
            {publicando ? <Loader2 size={14} className="spin" /> : <Send size={14} />} Publicar no Drive
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
        <button onClick={() => setFiltro("")} aria-pressed={!filtro}
          style={{ padding: "5px 11px", borderRadius: 20, border: `1.5px solid ${filtro ? CINZA_BORDA : AZUL_MEDIO}`, background: filtro ? "#fff" : AZUL_MEDIO, color: filtro ? "#65758b" : "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          Todas
        </button>
        {PRIORIDADES_PROSPECCAO.filter((p) => contagem[p]).map((p) => {
          const ativo = filtro === p;
          const c = COR_PRIORIDADE[p] || COR_PRIORIDADE["A confirmar"];
          return (
            <button key={p} onClick={() => setFiltro(ativo ? "" : p)} aria-pressed={ativo}
              style={{ padding: "5px 11px", borderRadius: 20, border: `1.5px solid ${c.cor}`, background: ativo ? c.cor : "#fff", color: ativo ? "#fff" : c.cor, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {p} ({contagem[p]})
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <input style={{ ...inp, flex: 1, minWidth: 200 }} placeholder="Buscar empreendimento, ação ou observação…"
          value={busca} onChange={(e) => setBusca(e.target.value)} />
        <span style={{ fontSize: 12.5, color: "#2E7D32", fontWeight: 600 }}>{convertidos} já viraram cliente</span>
      </div>

      {carregando && <p style={{ color: "#8593a8", fontSize: 14 }}>Carregando…</p>}
      {!carregando && lista.length === 0 && <p style={{ color: "#8593a8", fontSize: 14 }}>Nenhum empreendimento com esse filtro.</p>}

      <div style={{ display: "grid", gap: 8 }}>
        {lista.map((p) => {
          const c = COR_PRIORIDADE[p.prioridade] || COR_PRIORIDADE["A confirmar"];
          const convertido = jaAtendidos.has((p.empreendimento || "").trim().toLowerCase());
          const aberto = abertoId === p.id;
          return (
            <div key={p.id} style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, overflow: "hidden" }}>
              <button onClick={() => setAbertoId(aberto ? null : p.id)}
                style={{ width: "100%", background: "#fff", border: "none", cursor: "pointer", padding: 12, display: "flex", alignItems: "center", gap: 10, textAlign: "left", flexWrap: "wrap" }}>
                <span style={{ background: c.bg, color: c.cor, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}>
                  {p.prioridade}
                </span>
                <strong style={{ fontSize: 13.5, flex: 1, minWidth: 150 }}>{p.empreendimento}</strong>
                {convertido && (
                  <span style={{ fontSize: 11, color: "#2E7D32", fontWeight: 700, whiteSpace: "nowrap" }}>✓ já é cliente</span>
                )}
                {aberto ? <ChevronDown size={16} color="#8593a8" /> : <ChevronRight size={16} color="#8593a8" />}
              </button>

              {aberto && (
                <div style={{ padding: "0 12px 12px", display: "grid", gap: 8 }}>
                  {p.estrutura && (
                    <div style={{ fontSize: 12.5, color: "#4a5a70" }}>
                      <strong style={{ color: "#65758b" }}>Obra: </strong>{p.estrutura}
                    </div>
                  )}
                  <div style={cell(true)}>
                    <label style={lab}>Prioridade</label>
                    <select style={inp} value={p.prioridade}
                      onChange={(e) => atualizar(p.id, { prioridade: e.target.value })}>
                      {PRIORIDADES_PROSPECCAO.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                    {p.prioridadeOriginal && p.prioridadeOriginal !== p.prioridade && (
                      <span style={{ fontSize: 11, color: "#8593a8" }}>na pesquisa: “{p.prioridadeOriginal}”</span>
                    )}
                  </div>
                  <Area label="Ação recomendada" value={p.acao} rows={2}
                    onChange={(v) => atualizar(p.id, { acao: v }, { silencioso: true })} />
                  <Area label="Observações" value={p.observacoes} rows={2}
                    onChange={(v) => atualizar(p.id, { observacoes: v }, { silencioso: true })} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function AbaGerenciaVisaoGeral({ docs, clientes, updCliente, padronizarEmpreendimento, excluirCliente, empreendimentosRef = [], carregando, assinatura, salvarAssinatura, removerAssinatura, notify, usuarios, usuariosCarregando, criarUsuario, atualizarUsuario, excluirUsuario, salvarPerfilTecnico, usuarioAtualId, avaliacoes, avaliacoesCarregando, laudosPendentes, laudosPendentesCarregando, aprovarLaudo, devolverLaudo, editarLaudo, reenviarDrive, marcarEmAnalise, painel, painelCarregando, carregarPainel, acessos, acessosCarregando, patologiasBanco }) {
  const porVistoria = docs.reduce((acc, d) => { acc[d.vistoria] = (acc[d.vistoria] || 0) + 1; return acc; }, {});
  const porStatusProducao = docs.reduce((acc, d) => { acc[d.statusProducao] = (acc[d.statusProducao] || 0) + 1; return acc; }, {});
  const totalRegistrosDocs = docs.length;

  // Ranking por cadastros reais (clientes), não por docs — mesma causa raiz dos indicadores gerais.
  const porEmpreendimento = clientes.reduce((acc, c) => {
    const k = c.empreendimento?.trim() || "(sem empreendimento)";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const rankingEmpreendimentos = Object.entries(porEmpreendimento).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {carregando && <p style={{ color: "#8593a8", fontSize: 14 }}>Carregando indicadores…</p>}

      <CardPainelLaudos painel={painel} carregando={painelCarregando} recarregar={carregarPainel} usuarios={usuarios} notify={notify} />
      <CardLaudosPendentes laudosPendentes={laudosPendentes} carregando={laudosPendentesCarregando} aprovarLaudo={aprovarLaudo} devolverLaudo={devolverLaudo} editarLaudo={editarLaudo} reenviarDrive={reenviarDrive} marcarEmAnalise={marcarEmAnalise}
      painel={painel} painelCarregando={painelCarregando} carregarPainel={carregarPainel} assinatura={assinatura} notify={notify} patologiasBanco={patologiasBanco} />

      <CardCancelamentosPendentes clientes={clientes} usuarios={usuarios} updCliente={updCliente} notify={notify} />

      <CardAcessos dados={acessos} carregando={acessosCarregando} />

      <CardPadronizarEmpreendimentos clientes={clientes} empreendimentosRef={empreendimentosRef}
        padronizar={padronizarEmpreendimento} excluirCliente={excluirCliente} notify={notify} />

      <CardIndicadoresGerais docs={docs} clientes={clientes} />

      <CardCadastrosClientes clientes={clientes} />

      <Card icon={Star} titulo="Agendamento — avaliações dos clientes">
        {avaliacoesCarregando && <p style={{ color: "#8593a8", fontSize: 14 }}>Carregando…</p>}
        {!avaliacoesCarregando && avaliacoes.length === 0 && <p style={{ color: "#8593a8", fontSize: 14 }}>Nenhuma avaliação recebida ainda.</p>}
        {avaliacoes.length > 0 && (() => {
          const media = avaliacoes.reduce((s, a) => s + a.nota, 0) / avaliacoes.length;
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 30, fontWeight: 800, color: AZUL_MARINHO, lineHeight: 1 }}>{media.toFixed(1)}</div>
                <Estrelas valor={Math.round(media)} tamanho={16} />
              </div>
              <div style={{ fontSize: 13, color: "#65758b" }}>{avaliacoes.length} avaliação(ões) recebida(s). Veja os comentários completos na aba Agendamento.</div>
            </div>
          );
        })()}
      </Card>

      <Card icon={BarChart3} titulo="Status operacional">
        {totalRegistrosDocs === 0 ? (
          <p style={{ color: "#8593a8", fontSize: 14 }}>Nenhum dado ainda. Cadastre registros na aba "Documentação" para ver os indicadores aqui.</p>
        ) : (
          <>
            <BarraStatus titulo="Vistorias" contagens={porVistoria} />
            <BarraStatus titulo="ART Documentações" contagens={porStatusProducao} />
          </>
        )}
      </Card>

      {rankingEmpreendimentos.length > 0 && (
        <Card icon={LayoutGrid} titulo="Empreendimentos com mais cadastros">
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

      <CardUsuarios usuarios={usuarios} carregando={usuariosCarregando} criarUsuario={criarUsuario} atualizarUsuario={atualizarUsuario} excluirUsuario={excluirUsuario} salvarPerfilTecnico={salvarPerfilTecnico} notify={notify} usuarioAtualId={usuarioAtualId} />

      <CardAssinaturaGerencia assinatura={assinatura} salvarAssinatura={salvarAssinatura} removerAssinatura={removerAssinatura} notify={notify} />
    </div>
  );
}

/* ---- Gerência · Parceiros e Afiliados ---- */
function CardIndicadoresParceiros({ parceiros, vales, valesCarregando, vendas = [] }) {
  const ativos = parceiros.filter((p) => p.status === "aprovado").length;
  const leadsEnviados = vales.length;
  const valesUsados = vales.filter((v) => v.status === "usado").length;
  const taxaConversao = leadsEnviados > 0 ? (valesUsados / leadsEnviados) * 100 : 0;
  const comissaoGerada = vendas.reduce((s, v) => s + (Number(v.comissao_valor) || 0), 0);

  return (
    <Card icon={TrendingUp} titulo="Indicadores de Parceiros e Afiliados">
      {valesCarregando && <p style={{ color: "#8593a8", fontSize: 14, marginBottom: 10 }}>Carregando vales…</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        <KpiCard label="Parceiros ativos" valor={ativos} Icon={Users} />
        <KpiCard label="Leads enviados" valor={leadsEnviados} cor="#2C75B5" Icon={TrendingUp} />
        <KpiCard label="Taxa de conversão" valor={`${taxaConversao.toFixed(0)}%`} cor="#2E7D32" Icon={Percent} />
        <KpiCard label="Vendas por indicação" valor={valesUsados} cor="#2E7D32" Icon={Check} />
        <KpiCard label="Vendas do funil de orçamento" valor={vendas.length} cor="#2E7D32" Icon={Check} />
        <KpiCard label="Comissão gerada" valor={fmtReal(comissaoGerada)} cor={AZUL_MARINHO} Icon={DollarSign} />
      </div>
      <p style={{ fontSize: 12, color: "#8593a8", marginTop: 12 }}>
        "Leads enviados" e "taxa de conversão" vêm dos códigos de benefício (vales) gerados e ativados pelos clientes.
        "Vendas do funil de orçamento" e "Comissão gerada" vêm das propostas aceitas no funil de Leads + Propostas.
      </p>
    </Card>
  );
}
/* ---- Banco de patologias por ambiente — CRUD da gerência ----
   O catálogo nasce vazio no banco: o botão "Importar catálogo atual" traz de uma vez as
   patologias que já existiam no arquivo estático (gerado de planilha). Dali em diante, o
   cadastro é feito por aqui — o mesmo banco alimenta o dropdown do item de vistoria, o
   "Conferir por ambiente" e a correção de laudo da gerência. */
function CardBancoPatologias({ patologias = [], carregando, onCriar, onAtualizar, onExcluir, onImportar, notify }) {
  const ambientes = useMemo(() => listarAmbientes(), []);
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState(null); // objeto da patologia, ou {} pra nova
  const [salvando, setSalvando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [excluindoId, setExcluindoId] = useState(null);

  const termo = busca.trim().toLowerCase();
  const visiveis = termo
    ? patologias.filter((p) => `${p.nome} ${p.sistema} ${p.elemento}`.toLowerCase().includes(termo))
    : patologias;

  const importar = async () => {
    setImportando(true);
    await onImportar();
    setImportando(false);
  };

  const iniciarNova = () => setEditando({
    sistema: "", elemento: "", nome: "", manifestacao: "", causas: "", comoVerificar: "",
    severidade: "Média", criticidade: "", norma: "", normasComplementares: "", acaoRecomendada: "",
    exigeEspecialista: false, registroMinimo: "", aplicaTodosAmbientes: false, escopoUnidadeInteira: false,
    ambientes: [],
  });

  const salvar = async () => {
    if (!editando.nome?.trim()) { notify("Informe o nome da patologia."); return; }
    setSalvando(true);
    const ok = editando.id ? await onAtualizar(editando.id, editando) : await onCriar(editando);
    setSalvando(false);
    if (ok) setEditando(null);
  };

  const excluir = async (id) => {
    setExcluindoId(id);
    await onExcluir(id);
    setExcluindoId(null);
  };

  const alternarAmbiente = (slug) => setEditando((ed) => ({
    ...ed,
    ambientes: ed.ambientes.includes(slug) ? ed.ambientes.filter((s) => s !== slug) : [...ed.ambientes, slug],
  }));

  return (
    <Card icon={AlertTriangle} titulo={`Banco de patologias (${patologias.length})`}>
      <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 14px" }}>
        Catálogo que alimenta o item de vistoria, o "Conferir por ambiente" e a correção de laudo — ajuste, adicione ou remova entradas aqui.
      </p>

      {!carregando && patologias.length === 0 && (
        <div style={{ background: "#FFF4E0", border: "1px solid #f0c987", borderRadius: 10, padding: 14, marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <AlertTriangle size={16} color="#B26A00" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "#7a4e00", flex: 1, minWidth: 200 }}>
            O banco ainda está vazio. Importe o catálogo que já existe (feito uma única vez) pra começar a editar a partir dele.
          </span>
          <button className="btn-solid" onClick={importar} disabled={importando}>
            {importando ? <Loader2 size={14} className="spin" /> : <RefreshCcw size={14} />} Importar catálogo atual
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <input style={{ ...inp, flex: 1, minWidth: 200 }} value={busca} onChange={(e) => setBusca(e.target.value)}
          placeholder={`Buscar em ${patologias.length} patologia(s)…`} />
        <button className="btn-solid" style={{ width: "auto", padding: "9px 16px" }} onClick={iniciarNova}>
          <Plus size={15} /> Nova patologia
        </button>
      </div>

      {carregando && <p style={{ color: "#8593a8", fontSize: 14 }}>Carregando…</p>}
      {!carregando && visiveis.length === 0 && patologias.length > 0 && (
        <p style={{ color: "#8593a8", fontSize: 14 }}>Nada encontrado para "{busca}".</p>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        {visiveis.map((p) => (
          <div key={p.id} style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{p.nome}</div>
              <div style={{ fontSize: 12, color: "#65758b" }}>
                {p.sistema}{p.elemento ? ` · ${p.elemento}` : ""}
                {p.aplicaTodosAmbientes && " · qualquer ambiente"}
                {p.escopoUnidadeInteira && " · unidade inteira"}
                {p.ambientes.length > 0 && ` · ${p.ambientes.length} ambiente(s) específico(s)`}
              </div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: sevMeta[p.severidade]?.cor, background: sevMeta[p.severidade]?.bg, borderRadius: 20, padding: "2px 10px" }}>
              {p.severidade}
            </span>
            <button className="icon-btn" onClick={() => setEditando({ ...p })} title="Editar"><Edit3 size={15} color={AZUL_MEDIO} /></button>
            <button className="icon-btn" onClick={() => excluir(p.id)} title="Excluir" disabled={excluindoId === p.id}>
              {excluindoId === p.id ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} color="#c62828" />}
            </button>
          </div>
        ))}
      </div>

      {editando && (
        <div className="no-print" style={overlay} onClick={() => setEditando(null)}>
          <div style={{ ...modal, maxWidth: 640, maxHeight: "88vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <strong>{editando.id ? "Editar patologia" : "Nova patologia"}</strong>
              <button className="icon-btn" onClick={() => setEditando(null)}><X size={16} /></button>
            </div>
            <Grid>
              <Field label="Nome" value={editando.nome} onChange={(v) => setEditando((ed) => ({ ...ed, nome: v }))} full />
              <Field label="Sistema" value={editando.sistema} onChange={(v) => setEditando((ed) => ({ ...ed, sistema: v }))} />
              <Field label="Elemento" value={editando.elemento} onChange={(v) => setEditando((ed) => ({ ...ed, elemento: v }))} />
              <div style={cell(false)}>
                <label style={lab}>Severidade</label>
                <select style={inp} value={editando.severidade} onChange={(e) => setEditando((ed) => ({ ...ed, severidade: e.target.value }))}>
                  {["Baixa", "Média", "Alta"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <Field label="Norma" value={editando.norma} onChange={(v) => setEditando((ed) => ({ ...ed, norma: v }))} />
              <Field label="Normas complementares" value={editando.normasComplementares} onChange={(v) => setEditando((ed) => ({ ...ed, normasComplementares: v }))} />
            </Grid>
            <Area label="Manifestação (vira a descrição técnica do item)" value={editando.manifestacao} onChange={(v) => setEditando((ed) => ({ ...ed, manifestacao: v }))} rows={2} />
            <Area label="Ação recomendada (vira a recomendação técnica do item)" value={editando.acaoRecomendada} onChange={(v) => setEditando((ed) => ({ ...ed, acaoRecomendada: v }))} rows={2} />
            <Area label="Como verificar" value={editando.comoVerificar} onChange={(v) => setEditando((ed) => ({ ...ed, comoVerificar: v }))} rows={2} />

            <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={editando.exigeEspecialista} onChange={(e) => setEditando((ed) => ({ ...ed, exigeEspecialista: e.target.checked }))} />
                Exige especialista
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={editando.aplicaTodosAmbientes} onChange={(e) => setEditando((ed) => ({ ...ed, aplicaTodosAmbientes: e.target.checked, escopoUnidadeInteira: false }))} />
                Aplica-se a qualquer ambiente
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={editando.escopoUnidadeInteira} onChange={(e) => setEditando((ed) => ({ ...ed, escopoUnidadeInteira: e.target.checked, aplicaTodosAmbientes: false }))} />
                Escopo de unidade inteira (não é de um cômodo)
              </label>
            </div>

            {!editando.aplicaTodosAmbientes && !editando.escopoUnidadeInteira && (
              <div style={{ marginTop: 14 }}>
                <label style={lab}>Específica destes ambientes</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                  {ambientes.map((a) => {
                    const marcado = editando.ambientes.includes(a.slug);
                    return (
                      <button key={a.slug} type="button" onClick={() => alternarAmbiente(a.slug)} aria-pressed={marcado}
                        style={{ padding: "5px 11px", borderRadius: 20, cursor: "pointer", fontSize: 12.5, fontWeight: 600,
                          border: `1.5px solid ${marcado ? AZUL_MARINHO : CINZA_BORDA}`,
                          background: marcado ? AZUL_MARINHO : "#fff", color: marcado ? "#fff" : "#4a5a70" }}>
                        {a.nome}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO }} onClick={() => setEditando(null)} disabled={salvando}>Cancelar</button>
              <button className="btn-solid" onClick={salvar} disabled={salvando}>
                {salvando ? <Loader2 size={14} className="spin" /> : <Save size={14} />} Salvar patologia
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function AbaGerenciaParceiros({ parceiros, parceirosCarregando, atualizarParceiro, criarParceiroManual, podeExcluir = false, excluirParceiro, salvarItemCatalogo, excluirItemCatalogo, vales, valesCarregando, vendas = [], vendasCarregando, atualizarVenda, notify, token, perfil, decidirComissaoItem }) {
  const [cadastrando, setCadastrando] = useState(false);
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <CardIndicadoresParceiros parceiros={parceiros} vales={vales} valesCarregando={valesCarregando} vendas={vendas} />
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn-solid" style={{ width: "auto", padding: "9px 16px" }} onClick={() => setCadastrando(true)}>
          <Plus size={15} /> Cadastrar parceiro
        </button>
      </div>
      <CardParceiros parceiros={parceiros} carregando={parceirosCarregando} atualizarParceiro={atualizarParceiro}
        podeExcluir={podeExcluir} excluirParceiro={excluirParceiro} token={token} perfil={perfil}
        salvarItemCatalogo={salvarItemCatalogo} excluirItemCatalogo={excluirItemCatalogo}
        decidirComissaoItem={decidirComissaoItem} notify={notify} />
      <CardVendasComissoes vendas={vendas} carregando={vendasCarregando} atualizarVenda={atualizarVenda} notify={notify} />
      {cadastrando && (
        <ModalCriarParceiroManual onFechar={() => setCadastrando(false)} criarParceiroManual={criarParceiroManual} notify={notify} />
      )}
    </div>
  );
}

/* Vendas fechadas pelo funil de Leads + Propostas, com a comissão calculada — Gerência/Vendas
   acompanha e marca quando a comissão foi paga ao parceiro (ou ajusta o valor, quando o
   cálculo automático não bateu por falta de categoria cadastrada na comissão do parceiro). */
function CardVendasComissoes({ vendas, carregando, atualizarVenda, notify }) {
  const [salvandoId, setSalvandoId] = useState(null);
  const comissaoGerada = vendas.reduce((s, v) => s + (Number(v.comissao_valor) || 0), 0);
  const comissaoPaga = vendas.filter((v) => v.status_comissao === "paga").reduce((s, v) => s + (Number(v.comissao_valor) || 0), 0);

  const marcarPaga = async (id) => {
    setSalvandoId(id);
    const ok = await atualizarVenda(id, { statusComissao: "paga" });
    setSalvandoId(null);
    if (ok) notify("Comissão marcada como paga ✓");
  };
  const marcarPendente = async (id) => {
    setSalvandoId(id);
    const ok = await atualizarVenda(id, { statusComissao: "pendente" });
    setSalvandoId(null);
    if (ok) notify("Comissão marcada como pendente ✓");
  };

  return (
    <Card icon={DollarSign} titulo={`Vendas e comissões (${vendas.length})`}>
      {carregando && <p style={{ color: "#8593a8", fontSize: 14 }}>Carregando…</p>}
      {!carregando && vendas.length === 0 && <p style={{ color: "#8593a8", fontSize: 14 }}>Nenhuma venda fechada pelo funil de orçamento até o momento.</p>}
      {vendas.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 13.5, marginBottom: 12 }}>
            <div><strong style={{ color: AZUL_MARINHO }}>Comissão gerada: </strong>{fmtReal(comissaoGerada)}</div>
            <div><strong style={{ color: "#2E7D32" }}>Comissão paga: </strong>{fmtReal(comissaoPaga)}</div>
            <div><strong style={{ color: "#C62828" }}>Comissão a pagar: </strong>{fmtReal(comissaoGerada - comissaoPaga)}</div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: CINZA_CLARO }}>
                  {["Parceiro", "Cliente", "Serviço", "Valor da venda", "Comissão", "Status", ""].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: AZUL_MARINHO, borderBottom: `2px solid ${CINZA_BORDA}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vendas.map((v) => (
                  <tr key={v.id} style={{ borderBottom: `1px solid ${CINZA_BORDA}` }}>
                    <td style={{ padding: "8px 10px" }}>{v.parceiro_empresa || "—"}</td>
                    <td style={{ padding: "8px 10px" }}>{v.cliente_nome || "—"}</td>
                    <td style={{ padding: "8px 10px" }}>{v.servico_titulo || "—"}</td>
                    <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{fmtReal(v.valor_venda)}</td>
                    <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                      {v.comissao_valor != null ? `${fmtReal(v.comissao_valor)} (${Number(v.comissao_percentual)}%)` : <span style={{ color: "#C62828" }}>sem comissão cadastrada</span>}
                    </td>
                    <td style={{ padding: "8px 10px" }}><Selo valor={STATUS_COMISSAO_LABEL[v.status_comissao] || v.status_comissao} /></td>
                    <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                      {salvandoId === v.id ? <Loader2 size={15} className="spin" /> : v.status_comissao === "paga" ? (
                        <button className="btn-ghost" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => marcarPendente(v.id)}>Desfazer</button>
                      ) : (
                        <button className="btn-solid" style={{ width: "auto", padding: "5px 10px", fontSize: 12 }} onClick={() => marcarPaga(v.id)}>Marcar paga</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}

/* ---- Gerência · Financeiro ---- */
/* Uma linha da tabela de preços: o empreendimento vem da lista oficial (planilha do Drive)
   e a Gerência fixa os dois valores — vistoria e documentação ART/TRT. */
function LinhaPrecoEmpreendimento({ empreendimento, construtora, preco, salvarPreco, onRemover, notify }) {
  const [editando, setEditando] = useState(false);
  const [vistoria, setVistoria] = useState("");
  const [documentacao, setDocumentacao] = useState("");
  const [custoVistoria, setCustoVistoria] = useState("");
  const [salvando, setSalvando] = useState(false);

  const abrir = () => {
    setVistoria(preco ? String(preco.precoVistoria) : "");
    setDocumentacao(preco ? String(preco.precoDocumentacao) : "");
    setCustoVistoria(preco ? String(preco.custoVistoria) : "");
    setEditando(true);
  };
  const confirmar = async () => {
    const corpo = {};
    if (vistoria !== "") corpo.precoVistoria = Number(vistoria);
    if (documentacao !== "") corpo.precoDocumentacao = Number(documentacao);
    if (custoVistoria !== "") corpo.custoVistoria = Number(custoVistoria);
    if (Object.keys(corpo).length === 0) { notify("Informe pelo menos um valor"); return; }
    if (Object.values(corpo).some((v) => !Number.isFinite(v) || v < 0)) { notify("Informe valores válidos"); return; }
    setSalvando(true);
    const ok = await salvarPreco(empreendimento, corpo);
    setSalvando(false);
    if (ok) { setEditando(false); notify("Preço salvo ✓"); }
  };

  const semPreco = !preco || (!preco.precoVistoria && !preco.precoDocumentacao);
  return (
    <tr style={{ borderBottom: `1px solid ${CINZA_BORDA}` }}>
      <td style={{ padding: "8px 10px" }}>
        <div style={{ fontWeight: 600 }}>{empreendimento}</div>
        {construtora && <div style={{ fontSize: 11.5, color: "#8593a8" }}>{construtora}</div>}
      </td>
      <td style={{ padding: "8px 10px" }}>
        {editando
          ? <input type="number" min="0" step="0.01" style={{ ...inp, width: 120, padding: "5px 8px" }} placeholder="0,00" value={vistoria} onChange={(e) => setVistoria(e.target.value)} autoFocus />
          : (preco?.precoVistoria ? fmtReal(preco.precoVistoria) : <span style={{ color: "#9AA6B5" }}>—</span>)}
      </td>
      <td style={{ padding: "8px 10px" }}>
        {editando
          ? <input type="number" min="0" step="0.01" style={{ ...inp, width: 120, padding: "5px 8px" }} placeholder="0,00" value={documentacao} onChange={(e) => setDocumentacao(e.target.value)} />
          : (preco?.precoDocumentacao ? fmtReal(preco.precoDocumentacao) : <span style={{ color: "#9AA6B5" }}>—</span>)}
      </td>
      <td style={{ padding: "8px 10px" }}>
        {editando
          ? <input type="number" min="0" step="0.01" style={{ ...inp, width: 120, padding: "5px 8px" }} placeholder="0,00" value={custoVistoria} onChange={(e) => setCustoVistoria(e.target.value)} />
          : (preco?.custoVistoria ? fmtReal(preco.custoVistoria) : <span style={{ color: "#9AA6B5" }}>—</span>)}
      </td>
      <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
        {editando ? (
          <>
            <button className="icon-btn" onClick={confirmar} disabled={salvando}>
              {salvando ? <Loader2 size={15} className="spin" /> : <Check size={15} color="#2E7D32" />}
            </button>
            <button className="icon-btn" onClick={() => setEditando(false)}><X size={15} /></button>
          </>
        ) : (
          <>
            <button className="icon-btn" title={semPreco ? "Definir preços" : "Editar preços"} onClick={abrir}>
              <Edit3 size={15} color={AZUL_MEDIO} />
            </button>
            {onRemover && (
              <button className="icon-btn" title="Remover da lista" onClick={() => onRemover(empreendimento)}>
                <Trash2 size={15} color="#c62828" />
              </button>
            )}
          </>
        )}
      </td>
    </tr>
  );
}

function CardPrecoEmpreendimento({ precos, carregando, salvarPreco, empreendimentosRef = [], clientes = [], adicionarEmpreendimento, removerEmpreendimento, notify }) {
  const [busca, setBusca] = useState("");
  const [soComPreco, setSoComPreco] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novaConstrutora, setNovaConstrutora] = useState("");
  const [salvandoNovo, setSalvandoNovo] = useState(false);
  const [removendo, setRemovendo] = useState(null);

  /* A lista de empreendimentos vem da planilha do Drive (empreendimentos_ref). Junta com
     qualquer empreendimento que já tenha preço salvo ou que apareça em cadastros de cliente,
     pra não sumir nada que já estava em uso antes desta tela existir. */
  const porNome = new Map();
  empreendimentosRef.forEach((e) => {
    const nome = (e.empreendimento || "").trim();
    if (nome && !porNome.has(nome)) porNome.set(nome, e.construtora || "");
  });
  precos.forEach((p) => { if (p.empreendimento && !porNome.has(p.empreendimento)) porNome.set(p.empreendimento, ""); });
  clientes.forEach((c) => {
    const nome = (c.empreendimento || "").trim();
    if (nome && !porNome.has(nome)) porNome.set(nome, c.construtora || "");
  });

  const precoPorNome = {};
  precos.forEach((p) => { precoPorNome[p.empreendimento] = p; });

  const termo = busca.trim().toLowerCase();
  const linhas = [...porNome.entries()]
    .map(([empreendimento, construtora]) => ({ empreendimento, construtora, preco: precoPorNome[empreendimento] }))
    .filter((l) => !termo || `${l.empreendimento} ${l.construtora}`.toLowerCase().includes(termo))
    .filter((l) => !soComPreco || (l.preco && (l.preco.precoVistoria || l.preco.precoDocumentacao)))
    .sort((a, b) => a.empreendimento.localeCompare(b.empreendimento, "pt-BR"));

  const comPreco = [...porNome.keys()].filter((n) => precoPorNome[n] && (precoPorNome[n].precoVistoria || precoPorNome[n].precoDocumentacao)).length;

  return (
    <Card icon={DollarSign} titulo="Preços por empreendimento">
      <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 14px" }}>
        Empreendimentos da lista oficial (planilha do Drive). Defina o valor da vistoria e o da documentação ART/TRT —
        o setor de Documentação vê o preço fixado aqui ao trabalhar no serviço, e os valores alimentam a receita no Financeiro.
      </p>

      {adicionarEmpreendimento && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "flex-end", background: CINZA_CLARO, borderRadius: 10, padding: 12 }}>
          <div style={{ ...cell(false), flex: 1, minWidth: 180 }}>
            <label style={lab}>Novo empreendimento</label>
            <input style={inp} placeholder="Nome do empreendimento" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} />
          </div>
          <div style={{ ...cell(false), flex: 1, minWidth: 150 }}>
            <label style={lab}>Construtora</label>
            <input list="construtoras-conhecidas" style={inp} placeholder="Construtora" value={novaConstrutora} onChange={(e) => setNovaConstrutora(e.target.value)} />
            <datalist id="construtoras-conhecidas">
              {[...new Set(empreendimentosRef.map((e) => e.construtora).filter(Boolean))].sort().map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <button className="btn-solid" style={{ width: "auto", padding: "9px 16px" }} disabled={salvandoNovo}
            onClick={async () => {
              if (!novoNome.trim()) { notify("Informe o nome do empreendimento"); return; }
              setSalvandoNovo(true);
              const ok = await adicionarEmpreendimento(novoNome.trim(), novaConstrutora.trim());
              setSalvandoNovo(false);
              if (ok) { setNovoNome(""); setNovaConstrutora(""); }
            }}>
            {salvandoNovo ? <Loader2 size={15} className="spin" /> : <Plus size={15} />} Adicionar
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <input style={{ ...inp, flex: 1, minWidth: 200 }} placeholder="Buscar empreendimento ou construtora…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#4a5a70", cursor: "pointer" }}>
          <input type="checkbox" checked={soComPreco} onChange={(e) => setSoComPreco(e.target.checked)} />
          Só com preço definido
        </label>
        <span style={{ fontSize: 12.5, color: "#8593a8" }}>{comPreco} de {porNome.size} com preço</span>
      </div>

      {carregando && <p style={{ color: "#8593a8", fontSize: 14 }}>Carregando…</p>}
      {!carregando && linhas.length === 0 && (
        <p style={{ color: "#8593a8", fontSize: 14 }}>
          {porNome.size === 0 ? "A lista de empreendimentos ainda não foi carregada." : "Nenhum empreendimento encontrado com esse filtro."}
        </p>
      )}
      <ConfirmModal aberto={!!removendo}
        titulo="Remover da lista de empreendimentos"
        mensagem={removendo
          ? `Remover "${removendo}" da lista oficial? O preço e as tipologias dele também saem. Cadastros de clientes não são apagados.`
          : ""}
        onConfirm={() => { const alvo = removendo; setRemovendo(null); removerEmpreendimento(alvo); }}
        onCancel={() => setRemovendo(null)} />

      {linhas.length > 0 && (
        <div style={{ overflowX: "auto", maxHeight: 480, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: CINZA_CLARO }}>
                {["Empreendimento", "Vistoria", "Documentação ART/TRT", "Custo vistoria (por vistoriador)", ""].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: AZUL_MARINHO, borderBottom: `2px solid ${CINZA_BORDA}`, position: "sticky", top: 0, background: CINZA_CLARO }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <LinhaPrecoEmpreendimento key={l.empreendimento} empreendimento={l.empreendimento} construtora={l.construtora}
                  preco={l.preco} salvarPreco={salvarPreco} notify={notify}
                  onRemover={removerEmpreendimento ? (nome) => setRemovendo(nome) : null} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
/* Receita cruzando empreendimento x tipo de serviço: uma linha por combinação, com o valor
   unitário ao lado, o total da linha e o total geral no rodapé. Conta só o que foi
   efetivamente entregue — vistoria atendida e documentação concluída. */
/* "Vila das Palmeiras", "VILA DAS PALMEIRAS" e "Residencial Vila das Palmeiras" são o mesmo
   prédio digitado de formas diferentes — sem isso, cada variação virava uma linha própria no
   relatório, duplicando quantidade e diluindo o total. Além de ignorar maiúscula/minúscula,
   acento e espaço, remove qualificadores genéricos do começo do nome ("residencial",
   "condomínio", "edifício") — pedido explícito da Gerência, ciente de que isso pode juntar
   dois empreendimentos que só coincidentemente têm o mesmo nome-base. Continua sem resolver
   nomes de fato diferentes ("Vila das Palmeiras" x "Vila das Flores") — pra isso existe a
   tela "Padronização de empreendimentos" (aba Clientes), que corrige na origem. */
function normalizarChaveEmpreendimento(s) {
  const semAcento = String(s || "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return semAcento.replace(/^(residencial|condominio|edificio|cond\.?|ed\.?|res\.?)\s+/, "").trim();
}

// Taxa de emissão que a FN paga por documentação ART/TRT — fixa, não varia por empreendimento.
const CUSTO_UNITARIO_DOCUMENTACAO = 69;
// Pagamento ao vistoriador por vistoria entregue: varia por empreendimento — definido em
// "Preços por empreendimento" (custoVistoria). Sem valor cadastrado ali, entra como zero.

function CardReceitaEstimada({ precos, clientes, docs = [], usuarios = [] }) {
  const nomeVistoriadorPorId = {};
  usuarios.forEach((u) => { if (u.role === "vistoriador") nomeVistoriadorPorId[u.id] = u.nome; });

  const precoPorChave = {};
  const nomeCanonicoPorChave = {};
  precos.forEach((p) => {
    const chave = normalizarChaveEmpreendimento(p.empreendimento);
    precoPorChave[chave] = p;
    nomeCanonicoPorChave[chave] = p.empreendimento;
  });

  /* O que conta como serviço entregue.
     Antes a vistoria entrava na receita quando o cadastro estava marcado como "atendido" —
     só que essa marca é ligada automaticamente ao ABRIR o cadastro na tela, mesmo sem
     ninguém ter ido ao imóvel. Consultar um cliente somava dinheiro no relatório.
     Agora o marco é o laudo aprovado e enviado ao cliente, que é quando o serviço de fato
     terminou (e é o mesmo momento em que o sistema já grava a data de aprovação). */
  const LAUDO_ENTREGUE = "Laudo enviado por e-mail";
  const cpfsComLaudoEntregue = new Set(
    docs.filter((d) => d.statusCliente === LAUDO_ENTREGUE)
        .map((d) => String(d.cpf || "").replace(/\D/g, ""))
        .filter(Boolean)
  );
  const vistoriaEntregue = (c) => cpfsComLaudoEntregue.has(String(c.cpf || "").replace(/\D/g, ""));

  const SERVICOS = [
    { chave: "vistoria", rotulo: "Vistoria de entrega de chaves", campoPreco: "precoVistoria" },
    { chave: "documentacao", rotulo: SERVICO_DOCUMENTACAO, campoPreco: "precoDocumentacao" },
  ];

  // chave "empreendimento-normalizado||servico" -> { qtd, recebidos }
  const cruzamento = {};
  const registrar = (c, servico) => {
    const bruto = c.empreendimento?.trim() || "(sem empreendimento)";
    const chaveEmp = normalizarChaveEmpreendimento(bruto);
    const k = `${chaveEmp}||${servico}`;
    if (!cruzamento[k]) {
      // Nome exibido: prioriza a grafia cadastrada em "Preço por empreendimento" (é a que a
      // Gerência definiu como padrão); sem isso, a primeira grafia que aparecer decide.
      cruzamento[k] = { chaveEmp, empreendimento: nomeCanonicoPorChave[chaveEmp] || bruto, servico, qtd: 0, qtdPagos: 0 };
    }
    cruzamento[k].qtd += 1;
    if (c.pagamento === "Pago") cruzamento[k].qtdPagos += 1;
  };

  // "vistoriadorId||chaveEmpreendimento" -> qtd de vistorias entregues ali por aquele técnico
  // (o custo por vistoria varia por empreendimento, então precisa saber onde, não só quem).
  const vistoriasPorTecnicoEmp = {};

  let foraDoRelatorio = 0;
  clientes.forEach((c) => {
    if (c.status === "Cancelado") return;
    if (ehServicoDocumentacao(c)) {
      if (c.status === STATUS_DOC_CONCLUIDA) registrar(c, "documentacao");
    } else if (c.servico === SERVICO_VISTORIA) {
      if (vistoriaEntregue(c)) {
        registrar(c, "vistoria");
        if (c.vistoriadorId) {
          const chaveEmp = normalizarChaveEmpreendimento(c.empreendimento?.trim() || "(sem empreendimento)");
          const k2 = `${c.vistoriadorId}||${chaveEmp}`;
          vistoriasPorTecnicoEmp[k2] = (vistoriasPorTecnicoEmp[k2] || 0) + 1;
        }
      }
    } else if (c.servico) {
      // Serviço "Outro" não tem preço de tabela e sumia daqui sem avisar ninguém.
      foraDoRelatorio += 1;
    }
  });

  const porTecnico = {};
  let vistoriasSemCustoDefinido = 0;
  Object.entries(vistoriasPorTecnicoEmp).forEach(([k, qtd]) => {
    const [vistoriadorId, chaveEmp] = k.split("||");
    const custoUnit = Number(precoPorChave[chaveEmp]?.custoVistoria) || 0;
    if (!custoUnit) vistoriasSemCustoDefinido += qtd;
    if (!porTecnico[vistoriadorId]) porTecnico[vistoriadorId] = { qtd: 0, valor: 0 };
    porTecnico[vistoriadorId].qtd += qtd;
    porTecnico[vistoriadorId].valor += custoUnit * qtd;
  });
  const pagamentosTecnicos = Object.entries(porTecnico)
    .map(([id, v]) => ({ id, nome: nomeVistoriadorPorId[id] || "(vistoriador removido)", ...v }))
    .sort((a, b) => b.valor - a.valor);
  const totalPagamentosTecnicos = pagamentosTecnicos.reduce((s, p) => s + p.valor, 0);

  const linhas = Object.values(cruzamento)
    .map((l) => {
      const def = SERVICOS.find((s) => s.chave === l.servico);
      const unitario = Number(precoPorChave[l.chaveEmp]?.[def.campoPreco]) || 0;
      const custo = l.servico === "documentacao" ? CUSTO_UNITARIO_DOCUMENTACAO * l.qtd
        : l.servico === "vistoria" ? (Number(precoPorChave[l.chaveEmp]?.custoVistoria) || 0) * l.qtd : 0;
      const total = unitario * l.qtd;
      return { ...l, rotulo: def.rotulo, unitario, total, recebido: unitario * l.qtdPagos, custo, lucro: total - custo };
    })
    .sort((a, b) => b.total - a.total || a.empreendimento.localeCompare(b.empreendimento, "pt-BR"));

  const totalGeral = linhas.reduce((s, l) => s + l.total, 0);
  const totalRecebido = linhas.reduce((s, l) => s + l.recebido, 0);
  const totalServicos = linhas.reduce((s, l) => s + l.qtd, 0);
  const totalCusto = linhas.reduce((s, l) => s + l.custo, 0);
  const totalLucro = totalGeral - totalCusto;
  const semPreco = linhas.filter((l) => l.unitario === 0);

  const num = { textAlign: "right", whiteSpace: "nowrap" };

  return (
    <>
    <Card icon={TrendingUp} titulo="Receita por empreendimento e serviço">
      <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 14px" }}>
        Uma linha por empreendimento e tipo de serviço, com o valor unitário cadastrado acima.
        Entram só os serviços entregues: vistorias com <strong>laudo já enviado ao cliente</strong> e
        documentações concluídas. Cada documentação ART/TRT tem custo fixo de {fmtReal(CUSTO_UNITARIO_DOCUMENTACAO)}
        (taxa de emissão) e cada vistoria tem o custo (pagamento ao vistoriador) definido por empreendimento
        em "Preços por empreendimento" — a coluna "Lucro" já desconta isso do total.
      </p>

      {linhas.length === 0 && <p style={{ color: "#8593a8", fontSize: 14 }}>Nenhum serviço concluído ainda.</p>}

      {linhas.length > 0 && (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: CINZA_CLARO }}>
                  {["Empreendimento", "Serviço", "Qtd", "Valor unitário", "Total", "Custo", "Lucro", "Recebido"].map((h, i) => (
                    <th key={h} style={{ textAlign: i >= 2 ? "right" : "left", padding: "8px 10px", color: AZUL_MARINHO, borderBottom: `2px solid ${CINZA_BORDA}`, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={`${l.empreendimento}||${l.servico}`} style={{ borderBottom: `1px solid ${CINZA_BORDA}` }}>
                    <td style={{ padding: "8px 10px", fontWeight: 600 }}>{l.empreendimento}</td>
                    <td style={{ padding: "8px 10px", color: "#4a5a70" }}>{l.rotulo}</td>
                    <td style={{ padding: "8px 10px", ...num }}>{l.qtd}</td>
                    <td style={{ padding: "8px 10px", ...num, color: l.unitario ? "#4a5a70" : "#B26A00" }}>
                      {l.unitario ? fmtReal(l.unitario) : "sem preço"}
                    </td>
                    <td style={{ padding: "8px 10px", ...num, fontWeight: 700, color: AZUL_MARINHO }}>{fmtReal(l.total)}</td>
                    <td style={{ padding: "8px 10px", ...num, color: l.custo ? "#C62828" : "#8593a8" }}>
                      {l.custo ? fmtReal(l.custo) : "—"}
                    </td>
                    <td style={{ padding: "8px 10px", ...num, fontWeight: 700, color: "#2E7D32" }}>{fmtReal(l.lucro)}</td>
                    <td style={{ padding: "8px 10px", ...num, color: l.recebido >= l.total && l.total > 0 ? "#2E7D32" : "#65758b" }}>
                      {fmtReal(l.recebido)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: `2px solid ${CINZA_BORDA}`, background: CINZA_CLARO }}>
                  <td style={{ padding: "9px 10px", fontWeight: 800, color: AZUL_MARINHO }} colSpan={2}>Total</td>
                  <td style={{ padding: "9px 10px", ...num, fontWeight: 700 }}>{totalServicos}</td>
                  <td />
                  <td style={{ padding: "9px 10px", ...num, fontWeight: 800, color: AZUL_MARINHO }}>{fmtReal(totalGeral)}</td>
                  <td style={{ padding: "9px 10px", ...num, fontWeight: 800, color: "#C62828" }}>{fmtReal(totalCusto)}</td>
                  <td style={{ padding: "9px 10px", ...num, fontWeight: 800, color: "#2E7D32" }}>{fmtReal(totalLucro)}</td>
                  <td style={{ padding: "9px 10px", ...num, fontWeight: 800, color: "#2E7D32" }}>{fmtReal(totalRecebido)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div style={{ marginTop: 12, fontSize: 12.5, color: "#65758b" }}>
            A receber: <strong style={{ color: "#B26A00" }}>{fmtReal(totalGeral - totalRecebido)}</strong>
          </div>

          {semPreco.length > 0 && (
            <div style={{ marginTop: 10, background: "#FFF4E0", color: "#B26A00", padding: "9px 12px", borderRadius: 8, fontSize: 12.5 }}>
              {semPreco.length} combinação(ões) sem preço cadastrado — esses serviços não entram no total.
            </div>
          )}

          {foraDoRelatorio > 0 && (
            <div style={{ marginTop: 10, background: "#FFF4E0", color: "#B26A00", padding: "9px 12px", borderRadius: 8, fontSize: 12.5 }}>
              {foraDoRelatorio} cadastro(s) com serviço "Outro" ficam fora deste relatório: esse tipo não
              tem preço de tabela. Combine o valor com o cliente e registre em Documentação.
            </div>
          )}
        </>
      )}
    </Card>

    {pagamentosTecnicos.length > 0 && (
      <Card icon={Users} titulo="Pagamento aos vistoriadores">
        <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 14px" }}>
          Por vistoria entregue (laudo já enviado ao cliente), no valor de custo fixado por empreendimento
          em "Preços por empreendimento".
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: CINZA_CLARO }}>
                {["Vistoriador", "Vistorias entregues", "A pagar"].map((h, i) => (
                  <th key={h} style={{ textAlign: i >= 1 ? "right" : "left", padding: "8px 10px", color: AZUL_MARINHO, borderBottom: `2px solid ${CINZA_BORDA}`, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagamentosTecnicos.map((p) => (
                <tr key={p.id} style={{ borderBottom: `1px solid ${CINZA_BORDA}` }}>
                  <td style={{ padding: "8px 10px", fontWeight: 600 }}>{p.nome}</td>
                  <td style={{ padding: "8px 10px", ...num }}>{p.qtd}</td>
                  <td style={{ padding: "8px 10px", ...num, fontWeight: 700, color: AZUL_MARINHO }}>{fmtReal(p.valor)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `2px solid ${CINZA_BORDA}`, background: CINZA_CLARO }}>
                <td style={{ padding: "9px 10px", fontWeight: 800, color: AZUL_MARINHO }}>Total</td>
                <td style={{ padding: "9px 10px", ...num, fontWeight: 700 }}>{pagamentosTecnicos.reduce((s, p) => s + p.qtd, 0)}</td>
                <td style={{ padding: "9px 10px", ...num, fontWeight: 800, color: AZUL_MARINHO }}>{fmtReal(totalPagamentosTecnicos)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {vistoriasSemCustoDefinido > 0 && (
          <div style={{ marginTop: 10, background: "#FFF4E0", color: "#B26A00", padding: "9px 12px", borderRadius: 8, fontSize: 12.5 }}>
            {vistoriasSemCustoDefinido} vistoria(s) sem "Custo vistoria" cadastrado para o empreendimento —
            não entram no valor a pagar. Defina o custo em "Preços por empreendimento".
          </div>
        )}
      </Card>
    )}
    </>
  );
}

function AbaGerenciaFinanceiro({ docs, clientes, precos, precosCarregando, salvarPreco, empreendimentosRef = [], adicionarEmpreendimento, removerEmpreendimento, notify, usuarios = [] }) {
  const somaCampo = (campo, filtro) => docs.filter(filtro).reduce((s, d) => s + (Number(d[campo]) || 0), 0);
  const pago = (d) => d.pagamento === "Pago";
  const naoPago = (d) => d.pagamento !== "Pago";

  const receitaVistoriaPaga = somaCampo("valorVistoria", pago);
  const receitaVistoriaAReceber = somaCampo("valorVistoria", naoPago);
  const receitaTrtPaga = somaCampo("valorTrt", pago);
  const receitaTrtAReceber = somaCampo("valorTrt", naoPago);

  /* Custo operacional, não receita: o que a FN paga pra entregar o serviço, não o que cobra
     do cliente. Documentação tem custo fixo por unidade (CUSTO_UNITARIO_DOCUMENTACAO);
     vistoria varia por empreendimento (precos_empreendimento.custoVistoria — é o que a
     Gerência define na tabela "Preços por empreendimento" logo abaixo). Mesmo critério de
     "serviço entregue" que CardReceitaEstimada usa: documentação concluída, vistoria com
     laudo enviado por e-mail — senão contaria custo de serviço ainda não prestado. */
  const qtdDocumentacaoConcluida = clientes.filter((c) => ehServicoDocumentacao(c) && c.status === STATUS_DOC_CONCLUIDA).length;
  const custoDocumentacaoTotal = CUSTO_UNITARIO_DOCUMENTACAO * qtdDocumentacaoConcluida;

  const precoPorChave = {};
  precos.forEach((p) => { precoPorChave[normalizarChaveEmpreendimento(p.empreendimento)] = p; });
  const cpfsComLaudoEntregue = new Set(
    docs.filter((d) => d.statusCliente === "Laudo enviado por e-mail")
        .map((d) => String(d.cpf || "").replace(/\D/g, "")).filter(Boolean)
  );
  const custoVistoriadoresTotal = clientes
    .filter((c) => c.servico === SERVICO_VISTORIA && c.status !== "Cancelado" && cpfsComLaudoEntregue.has(String(c.cpf || "").replace(/\D/g, "")))
    .reduce((s, c) => {
      const chave = normalizarChaveEmpreendimento(c.empreendimento?.trim() || "(sem empreendimento)");
      return s + (Number(precoPorChave[chave]?.custoVistoria) || 0);
    }, 0);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card icon={DollarSign} titulo="Financeiro (acesso restrito · Gerência)">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: AZUL_MARINHO, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <ClipboardCheck size={14} /> Vistorias (valores lançados em Documentação)
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
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: AZUL_MARINHO, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <Users size={14} /> Custos operacionais
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <KpiCard label="Custo de documentação" valor={fmtReal(custoDocumentacaoTotal)} cor="#C62828" />
              <KpiCard label="Custo dos vistoriadores" valor={fmtReal(custoVistoriadoresTotal)} cor="#C62828" />
            </div>
          </div>
        </div>
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${CINZA_BORDA}`, display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13.5 }}>
          <div><strong style={{ color: AZUL_MARINHO }}>Total recebido: </strong>{fmtReal(receitaVistoriaPaga + receitaTrtPaga)}</div>
          <div><strong style={{ color: AZUL_MARINHO }}>Total a receber: </strong>{fmtReal(receitaVistoriaAReceber + receitaTrtAReceber)}</div>
          <div><strong style={{ color: AZUL_MARINHO }}>Total de custos: </strong>{fmtReal(custoDocumentacaoTotal + custoVistoriadoresTotal)}</div>
        </div>
      </Card>

      <CardPrecoEmpreendimento precos={precos} carregando={precosCarregando} salvarPreco={salvarPreco} empreendimentosRef={empreendimentosRef} clientes={clientes}
        adicionarEmpreendimento={adicionarEmpreendimento} removerEmpreendimento={removerEmpreendimento} notify={notify} />

      <CardReceitaEstimada precos={precos} clientes={clientes} docs={docs} usuarios={usuarios} />
    </div>
  );
}

function AbaGerencia({ sub = "visao-geral", token, perfil, decidirComissaoItem, docs, addDoc, updDoc, delDoc, clientes = [], updCliente, padronizarEmpreendimento, excluirCliente, adicionarEmpreendimento, removerEmpreendimento, prospeccao, prospeccaoCarregando, atualizarProspeccao, publicarProspeccaoDrive, carregando, assinatura, salvarAssinatura, removerAssinatura, notify, usuarios, usuariosCarregando, criarUsuario, atualizarUsuario, excluirUsuario, salvarPerfilTecnico, usuarioAtualId, avaliacoes, avaliacoesCarregando, parceiros, parceirosCarregando, atualizarParceiro, criarParceiroManual, excluirParceiro, salvarItemCatalogo, excluirItemCatalogo, vales, valesCarregando, vendas, vendasCarregando, atualizarVenda, precos, precosCarregando, salvarPreco, empreendimentosRef = [], laudosPendentes, laudosPendentesCarregando, aprovarLaudo, devolverLaudo, editarLaudo, reenviarDrive, marcarEmAnalise, painel, painelCarregando, carregarPainel, acessos, acessosCarregando, patologiasBanco, patologiasBancoCarregando, criarPatologia, atualizarPatologia, excluirPatologia, importarPatologiasEstaticas }) {
  if (sub === "acompanhamento") {
    return <TabelaRegistrosVistoriaDoc docs={docs} addDoc={addDoc} updDoc={updDoc} delDoc={delDoc}
      carregando={carregando} notify={notify} clientes={clientes} />;
  }
  if (sub === "parceiros") {
    return <AbaGerenciaParceiros parceiros={parceiros} parceirosCarregando={parceirosCarregando} atualizarParceiro={atualizarParceiro} criarParceiroManual={criarParceiroManual}
      salvarItemCatalogo={salvarItemCatalogo} excluirItemCatalogo={excluirItemCatalogo} vales={vales} valesCarregando={valesCarregando}
      vendas={vendas} vendasCarregando={vendasCarregando} atualizarVenda={atualizarVenda} notify={notify}
      token={token} perfil={perfil} decidirComissaoItem={decidirComissaoItem}
      podeExcluir excluirParceiro={excluirParceiro} />;
  }
  if (sub === "patologias") {
    return <CardBancoPatologias patologias={patologiasBanco} carregando={patologiasBancoCarregando}
      onCriar={criarPatologia} onAtualizar={atualizarPatologia} onExcluir={excluirPatologia}
      onImportar={importarPatologiasEstaticas} notify={notify} />;
  }
  if (sub === "prospeccao") {
    return <CardProspeccao prospeccao={prospeccao} carregando={prospeccaoCarregando} atualizar={atualizarProspeccao}
      publicarNoDrive={publicarProspeccaoDrive}
      clientes={clientes} notify={notify} />;
  }
  if (sub === "financeiro") {
    return <AbaGerenciaFinanceiro docs={docs} clientes={clientes} precos={precos} precosCarregando={precosCarregando} salvarPreco={salvarPreco} empreendimentosRef={empreendimentosRef}
      adicionarEmpreendimento={adicionarEmpreendimento} removerEmpreendimento={removerEmpreendimento} notify={notify} usuarios={usuarios} />;
  }
  return (
    <AbaGerenciaVisaoGeral docs={docs} clientes={clientes} updCliente={updCliente} carregando={carregando}
      padronizarEmpreendimento={padronizarEmpreendimento} excluirCliente={excluirCliente} empreendimentosRef={empreendimentosRef} assinatura={assinatura} salvarAssinatura={salvarAssinatura} removerAssinatura={removerAssinatura} notify={notify}
      usuarios={usuarios} usuariosCarregando={usuariosCarregando} criarUsuario={criarUsuario} atualizarUsuario={atualizarUsuario} excluirUsuario={excluirUsuario} salvarPerfilTecnico={salvarPerfilTecnico} usuarioAtualId={usuarioAtualId}
      avaliacoes={avaliacoes} avaliacoesCarregando={avaliacoesCarregando}
      laudosPendentes={laudosPendentes} laudosPendentesCarregando={laudosPendentesCarregando} aprovarLaudo={aprovarLaudo} devolverLaudo={devolverLaudo} editarLaudo={editarLaudo} reenviarDrive={reenviarDrive} marcarEmAnalise={marcarEmAnalise}
      painel={painel} painelCarregando={painelCarregando} carregarPainel={carregarPainel}
      acessos={acessos} acessosCarregando={acessosCarregando} patologiasBanco={patologiasBanco} />
  );
}

const ROLE_LABEL = { vistoriador: "Vistoriador", documentacao: "Documentação", atendimento: "Atendimento", qualidade: "Agendamento", vendas: "Vendas", gerencia: "Gerência" };
const ROLE_DESCRICAO = {
  vistoriador: "Só acessa Laudos. Sem acesso a Documentação nem Gerência.",
  documentacao: "Só acessa Documentação/TRT. Sem acesso a Laudos nem Gerência.",
  atendimento: "Acessa Clientes (cadastro, agendamento, aprovação e encaminhamento ao técnico) e Agendamento (aprova avaliações que entram na vitrine).",
  qualidade: "Só acessa Agendamento, em modo leitura: acompanha avaliações e agendamentos, mas não aprova nada — isso é do Atendimento.",
  vendas: "Só acessa Parceiros e Afiliados: analisa/aprova cadastros, cadastra parceiro manualmente e acompanha cupons. Recebe salário fixo — o sistema não calcula comissão individual.",
  gerencia: "Acesso completo: Laudos, Documentação, Clientes, Agendamento, Vendas, Gerência e financeiro.",
};

function CardUsuarios({ usuarios, carregando, criarUsuario, atualizarUsuario, excluirUsuario, salvarPerfilTecnico, notify, usuarioAtualId }) {
  const [novo, setNovo] = useState(null); // { nome, email, senha, role } quando o modal de criação está aberto
  const [salvando, setSalvando] = useState(false);
  const [resetandoId, setResetandoId] = useState(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroPapel, setFiltroPapel] = useState("");
  const [perfilTecnicoDe, setPerfilTecnicoDe] = useState(null); // usuário sendo editado

  const usuariosFiltrados = usuarios.filter((u) => {
    if (filtroPapel && u.role !== filtroPapel) return false;
    if (busca && !`${u.nome} ${u.email}`.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  });

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
  const [removendo, setRemovendo] = useState(null);
  const pedirRemocao = (u) => {
    if (u.id === usuarioAtualId) { notify("Você não pode remover o próprio usuário logado"); return; }
    setRemovendo(u);
  };
  const remover = async () => {
    try { await excluirUsuario(removendo.id); } catch (e) { notify(`Erro: ${e.message}`); }
    setRemovendo(null);
  };

  return (
    <Card icon={Users} titulo="Usuários da equipe (acesso ao sistema)">
      <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 14px" }}>
        Cada pessoa entra com o próprio e-mail e senha. O papel definido aqui é o que controla o que ela enxerga — não é escolhido por ela.
      </p>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn-add" style={{ width: "auto", padding: "9px 16px" }} onClick={abrirNovo}><Plus size={16} /> Novo usuário</button>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={14} color="#8593a8" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
          <input style={{ ...inp, paddingLeft: 30 }} placeholder="Buscar por nome ou e-mail…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <select style={{ ...inp, width: "auto", minWidth: 160 }} value={filtroPapel} onChange={(e) => setFiltroPapel(e.target.value)}>
          <option value="">Todos os papéis</option>
          {Object.entries(ROLE_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </div>

      {carregando && <p style={{ color: "#8593a8", fontSize: 14 }}>Carregando…</p>}
      {!carregando && usuarios.length === 0 && <p style={{ color: "#8593a8", fontSize: 14 }}>Nenhum usuário além de você ainda.</p>}
      {!carregando && usuarios.length > 0 && usuariosFiltrados.length === 0 && <p style={{ color: "#8593a8", fontSize: 14 }}>Nenhum usuário encontrado com esses filtros.</p>}

      {usuariosFiltrados.length > 0 && (
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
              {usuariosFiltrados.map((u) => (
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
                    <button className="icon-btn" onClick={() => alternarAtivo(u)} title={u.ativo ? "Desativar acesso" : "Reativar acesso"} disabled={u.id === usuarioAtualId}>
                      {u.ativo ? <UserX size={15} color="#c62828" /> : <UserCheck size={15} color="#2E7D32" />}
                    </button>
                    <button className="icon-btn" onClick={() => { setResetandoId(u.id); setNovaSenha(""); }} title="Redefinir senha">
                      <Edit3 size={15} color={AZUL_MEDIO} />
                    </button>
                    {u.role === "vistoriador" && salvarPerfilTecnico && (
                      <button className="icon-btn" onClick={() => setPerfilTecnicoDe(u)} title="Qualificação, registro e assinatura para o laudo">
                        <FileText size={15} color={AZUL_MEDIO} />
                      </button>
                    )}
                    {u.id !== usuarioAtualId && (
                      <button className="icon-btn" onClick={() => pedirRemocao(u)} title="Remover do sistema"><Trash2 size={15} color="#c62828" /></button>
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

      {/* O laudo é documento com responsabilidade técnica registrada: apagar o usuário
          deixaria os laudos dele sem vínculo com quem os assinou. Por isso o servidor
          desativa em vez de excluir — e o texto abaixo diz exatamente o que acontece. */}
      <ConfirmModal aberto={!!removendo} titulo="Remover do sistema"
        mensagem={removendo ? `"${removendo.nome}" perde o acesso imediatamente. O histórico e os laudos assinados por essa pessoa continuam guardados, como exige a responsabilidade técnica. Você pode reativar o acesso depois.` : ""}
        onConfirm={remover} onCancel={() => setRemovendo(null)} />

      {perfilTecnicoDe && (
        <ModalPerfilTecnicoVistoriador usuario={perfilTecnicoDe} salvarPerfilTecnico={salvarPerfilTecnico}
          notify={notify} onFechar={() => setPerfilTecnicoDe(null)} />
      )}
    </Card>
  );
}

/* A Gerência cadastra qualificação, registro e assinatura do vistoriador uma única vez —
   o laudo passa a vir preenchido sozinho em toda vistoria dele, sem precisar digitar de novo. */
function ModalPerfilTecnicoVistoriador({ usuario, salvarPerfilTecnico, notify, onFechar }) {
  const [qualificacao, setQualificacao] = useState(usuario.qualificacao_tecnica || "");
  const [registro, setRegistro] = useState(usuario.registro_profissional || "");
  const [novaAssinatura, setNovaAssinatura] = useState(null); // data URL escolhida agora, ou null = mantém a atual
  const [salvando, setSalvando] = useState(false);

  const onArquivo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { notify("Envie uma imagem (PNG ou JPG) da assinatura"); return; }
    const reader = new FileReader();
    reader.onload = () => setNovaAssinatura(reader.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      const patch = { qualificacao, registro };
      if (novaAssinatura !== null) patch.assinaturaImagem = novaAssinatura;
      await salvarPerfilTecnico(usuario.id, patch);
      onFechar();
    } catch (e) { notify(`Não foi possível salvar: ${e.message}`); }
    setSalvando(false);
  };

  return (
    <div className="no-print" style={overlay} onClick={onFechar}>
      <div style={{ ...modal, maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <strong>Perfil técnico de {usuario.nome}</strong>
          <button className="icon-btn" onClick={onFechar}><X size={16} /></button>
        </div>
        <p style={{ fontSize: 13, color: "#65758b", margin: "0 0 14px" }}>
          Preenche o laudo sozinho em toda vistoria deste técnico — ele não precisa mais digitar isso a cada vez.
        </p>
        <div style={cell(true)}>
          <label style={lab}>Qualificação</label>
          <input style={inp} value={qualificacao} onChange={(e) => setQualificacao(e.target.value)} placeholder="Ex.: Técnico em Edificações" />
        </div>
        <div style={{ ...cell(true), marginTop: 10 }}>
          <label style={lab}>Registro profissional</label>
          <input style={inp} value={registro} onChange={(e) => setRegistro(e.target.value)} placeholder="Ex.: CFT-03 nº 00000000000" />
        </div>
        <div style={{ marginTop: 14 }}>
          <label style={lab}>Assinatura</label>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 5, flexWrap: "wrap" }}>
            <label className="btn-ghost" style={{ color: AZUL_MEDIO, background: CINZA_CLARO, cursor: "pointer" }}>
              <Camera size={15} /> {usuario.tem_assinatura || novaAssinatura ? "Trocar" : "Enviar"}
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={onArquivo} />
            </label>
            {novaAssinatura ? (
              <img src={novaAssinatura} alt="Nova assinatura" style={{ height: 40, background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 6, padding: 4 }} />
            ) : usuario.tem_assinatura ? (
              <span style={{ fontSize: 12.5, color: "#2E7D32" }}>✓ Já tem assinatura cadastrada</span>
            ) : (
              <span style={{ fontSize: 12.5, color: "#8593a8" }}>Nenhuma assinatura cadastrada ainda</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO }} onClick={onFechar}>Cancelar</button>
          <button className="btn-solid" onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Salvar
          </button>
        </div>
      </div>
    </div>
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
/* Critérios de avaliação por serviço — os mesmos nomes que o backend valida.
   Uma nota só não diz onde melhorar: quem achou o técnico ótimo e o laudo confuso
   dá 3, e a equipe nunca descobre o quê. */
const CRITERIOS_AVALIACAO = {
  [SERVICO_VISTORIA]: [
    ["pontualidade", "Pontualidade e agendamento"],
    ["atendimento", "Atendimento do técnico"],
    ["clareza", "Clareza do laudo"],
  ],
  [SERVICO_DOCUMENTACAO]: [
    ["prazo", "Prazo de entrega"],
    ["atendimento", "Atendimento da equipe"],
    ["clareza", "Clareza da documentação"],
  ],
};

function AvaliarServico({ doc, notify, fotoCliente, cpf }) {
  const [aberto, setAberto] = useState(false);
  const [notas, setNotas] = useState({});
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const criterios = CRITERIOS_AVALIACAO[doc.servico] || CRITERIOS_AVALIACAO[SERVICO_VISTORIA];
  const respondidos = criterios.filter(([chave]) => notas[chave]).length;

  const enviar = async () => {
    if (respondidos < criterios.length) { notify("Dê uma nota para cada item"); return; }
    setEnviando(true);
    try {
      await apiFetch("/api/avaliacoes", {
        method: "POST",
        body: {
          // ART/TRT não gera registro em "docs": nesse caso a avaliação aponta para o cadastro.
          ...(doc.origem === "cliente" ? { clienteId: doc.id } : { docId: doc.id }),
          // O CPF vai junto porque o servidor confere se quem avalia é mesmo o cliente
          // daquele atendimento — sem isso, qualquer um postaria nota apontando para um
          // atendimento inventado, e avaliação aprovada vira vitrine no site.
          cpf,
          notas,
          comentario,
        },
      });
      setEnviado(true);
      notify("Obrigado pela avaliação! ✓");
    } catch (e) { notify(`Não foi possível enviar: ${e.message}`); }
    setEnviando(false);
  };

  // A avaliação só existe depois do serviço entregue — quem ainda está esperando não avalia.
  if (!doc.podeAvaliar) return null;

  if (enviado) {
    return <div style={{ marginTop: 10, fontSize: 13, color: "#2E7D32", fontWeight: 600 }}>✓ Avaliação enviada. Obrigado!</div>;
  }

  if (!aberto) {
    return (
      <div style={{ marginTop: 12 }}>
        {/* A foto da vistoria fica aqui, junto do convite para avaliar: é a lembrança do
            atendimento, e é o que faz o cliente parar e responder. */}
        {fotoCliente && (
          <img src={fotoCliente} alt="Foto da sua vistoria com nosso vistoriador"
            style={{ width: "100%", maxWidth: 460, borderRadius: 12, display: "block", marginBottom: 10 }} />
        )}
        <div style={{ fontSize: 13.5, color: AZUL_MARINHO, fontWeight: 600, marginBottom: 8 }}>
          Como foi o seu atendimento? Leva menos de um minuto e ajuda muito a nossa equipe.
        </div>
        <button className="btn-ghost" style={{ color: AZUL_MEDIO, background: CINZA_CLARO }} onClick={() => setAberto(true)}>
          <Star size={14} /> Avaliar este atendimento
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${CINZA_BORDA}` }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: AZUL_MARINHO }}>
        {doc.servico || "Atendimento"}
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {criterios.map(([chave, rotulo]) => (
          <div key={chave} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: "#4a5a70" }}>{rotulo}</span>
            <Estrelas valor={notas[chave] || 0} tamanho={22}
              onChange={(n) => setNotas((v) => ({ ...v, [chave]: n }))} />
          </div>
        ))}
      </div>

      <textarea style={{ ...inp, marginTop: 12, resize: "vertical" }} rows={2} placeholder="Quer contar mais alguma coisa? (opcional)"
        value={comentario} onChange={(e) => setComentario(e.target.value)} />

      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn-solid" onClick={enviar} disabled={enviando}>{enviando ? "Enviando…" : "Enviar avaliação"}</button>
        <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO }} onClick={() => setAberto(false)}>Cancelar</button>
        <span style={{ fontSize: 12, color: "#8593a8" }}>{respondidos} de {criterios.length} respondidos</span>
      </div>
    </div>
  );
}

/* ================= Acesso do cliente aos documentos de ART/TRT (Google Drive) =================
   Mesma proteção do laudo final: só libera depois de conferir CPF + e-mail cadastrados, e o
   download é sempre proxy do backend com token curto. São dois arquivos (documentação
   assinada e placa de identificação de obra). */
function AcessoDocumentosArt({ cpf, notify, emailConhecido }) {
  const [aberto, setAberto] = useState(!!emailConhecido);
  const [email, setEmail] = useState("");
  const [consultando, setConsultando] = useState(false);
  const [documentos, setDocumentos] = useState(null); // null = ainda não confirmou o e-mail

  const consultar = async (emailParaUsar) => {
    const alvo = emailParaUsar || email;
    if (!alvo.trim()) { notify("Informe seu e-mail cadastrado"); return; }
    setConsultando(true);
    try {
      const r = await apiFetch("/api/documentos-art/consultar", { method: "POST", body: { cpf, email: alvo } });
      setDocumentos(r.documentos || []);
      if ((r.documentos || []).length === 0 && !emailConhecido) notify("Ainda não há documentos disponíveis para esse e-mail.");
    } catch (e) { notify(`Não foi possível confirmar: ${e.message}`); setDocumentos(null); }
    setConsultando(false);
  };

  /* Já logado no portal: o e-mail é o do próprio cadastro, não precisa confirmar de novo —
     era um passo redundante, autenticação já fez essa parte. */
  useEffect(() => { if (emailConhecido) consultar(emailConhecido); }, [emailConhecido]);

  if (!aberto) {
    return (
      <button className="btn-ghost" style={{ marginTop: 10, color: AZUL_MARINHO, background: CINZA_CLARO }} onClick={() => setAberto(true)}>
        <FileText size={14} /> Baixar minha documentação ART/TRT
      </button>
    );
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${CINZA_BORDA}` }}>
      {!emailConhecido && <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Confirme seu e-mail para acessar a documentação</div>}
      {!emailConhecido && !documentos && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input style={{ ...inp, flex: 1, minWidth: 180 }} type="email" placeholder="Seu e-mail cadastrado" value={email}
            onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && consultar()} />
          <button className="btn-solid" onClick={() => consultar()} disabled={consultando}>{consultando ? "Confirmando…" : "Confirmar"}</button>
        </div>
      )}
      {consultando && emailConhecido && <p style={{ color: "#8593a8", fontSize: 13, margin: 0 }}>Carregando…</p>}
      {documentos && documentos.length === 0 && (
        <p style={{ color: "#8593a8", fontSize: 13, margin: 0 }}>
          {emailConhecido ? "Os documentos ainda não foram anexados." : "E-mail não confere ou os documentos ainda não foram anexados."}
        </p>
      )}
      {documentos && documentos.length > 0 && (
        <div style={{ display: "grid", gap: 8 }}>
          {documentos.map((d) => (
            <a key={d.id} href={`${API_URL}/api/documentos-art/download?token=${encodeURIComponent(d.tokenDownload)}`}
              target="_blank" rel="noopener noreferrer" className="btn-solid" style={{ textDecoration: "none", justifyContent: "center" }}>
              <FileText size={14} /> {d.tipo}
            </a>
          ))}
          <p style={{ fontSize: 11, color: "#8593a8", margin: 0 }}>O link expira em alguns minutos por segurança — se der erro, confirme de novo.</p>
        </div>
      )}
    </div>
  );
}

/* ================= Acesso do cliente ao laudo final (armazenado no Google Drive) =================
   O Drive nunca fica público: o backend só libera o download depois de confirmar CPF + e-mail
   cadastrados, e devolve um link com token curto (expira em minutos) que faz o backend buscar
   o arquivo no Drive e entregar diretamente — o cliente nunca vê nem precisa de conta Google. */
function AcessoLaudoFinal({ cpf, notify, aoDescobrirFoto, emailConhecido }) {
  const [aberto, setAberto] = useState(!!emailConhecido);
  const [email, setEmail] = useState("");
  const [consultando, setConsultando] = useState(false);
  const [laudos, setLaudos] = useState(null); // null = ainda não confirmou o e-mail

  const consultar = async (emailParaUsar) => {
    const alvo = emailParaUsar || email;
    if (!alvo.trim()) { notify("Informe seu e-mail cadastrado"); return; }
    setConsultando(true);
    try {
      const r = await apiFetch("/api/laudo-final/consultar", { method: "POST", body: { cpf, email: alvo } });
      setLaudos(r.laudos || []);
      // A foto vem junto com o laudo, mas quem a exibe é o convite de avaliação, logo abaixo.
      const comFoto = (r.laudos || []).find((l) => l.fotoCliente);
      if (comFoto) aoDescobrirFoto?.(comFoto.fotoCliente);
      if ((r.laudos || []).length === 0 && !emailConhecido) notify("Não encontramos laudo disponível para esse e-mail.");
    } catch (e) { notify(`Não foi possível confirmar: ${e.message}`); setLaudos(null); }
    setConsultando(false);
  };

  /* Já logado no portal: o e-mail é o do próprio cadastro, não precisa confirmar de novo. */
  useEffect(() => { if (emailConhecido) consultar(emailConhecido); }, [emailConhecido]);

  if (!aberto) {
    return (
      <button className="btn-ghost" style={{ marginTop: 10, color: AZUL_MARINHO, background: CINZA_CLARO }} onClick={() => setAberto(true)}>
        <FileText size={14} /> Ver / baixar meu laudo
      </button>
    );
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${CINZA_BORDA}` }}>
      {!emailConhecido && <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Confirme seu e-mail para acessar o laudo</div>}
      {!emailConhecido && !laudos && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input style={{ ...inp, flex: 1, minWidth: 180 }} type="email" placeholder="Seu e-mail cadastrado" value={email}
            onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && consultar()} />
          <button className="btn-solid" onClick={() => consultar()} disabled={consultando}>{consultando ? "Confirmando…" : "Confirmar"}</button>
        </div>
      )}
      {consultando && emailConhecido && <p style={{ color: "#8593a8", fontSize: 13, margin: 0 }}>Carregando…</p>}
      {laudos && laudos.length === 0 && (
        <p style={{ color: "#8593a8", fontSize: 13, margin: 0 }}>
          {emailConhecido ? "Nenhum laudo disponível ainda." : "E-mail não confere ou nenhum laudo disponível ainda."}
        </p>
      )}
      {laudos && laudos.length > 0 && (
        <div style={{ display: "grid", gap: 12 }}>
          {laudos.map((l) => (
            <div key={l.docId}>
              <a href={`${API_URL}/api/laudo-final/download?token=${encodeURIComponent(l.tokenDownload)}`}
                target="_blank" rel="noopener noreferrer" className="btn-solid" style={{ textDecoration: "none", justifyContent: "center" }}>
                <FileText size={14} /> Baixar laudo{l.empreendimento ? ` — ${l.empreendimento}` : ""}
              </a>
            </div>
          ))}
          <p style={{ fontSize: 11, color: "#8593a8", margin: 0 }}>O link expira em alguns minutos por segurança — se der erro, confirme de novo.</p>
        </div>
      )}
    </div>
  );
}

/* Um atendimento na tela do cliente: acesso aos arquivos e convite para avaliar.
   Existe como componente separado porque precisa guardar a foto da vistoria — ela chega
   junto com o laudo, mas quem a mostra é o convite de avaliação, logo abaixo. */
function CartaoAtendimentoCliente({ doc, cpf, notify, emailConhecido }) {
  const [fotoCliente, setFotoCliente] = useState(null);

  return (
    <>
      {doc.status === "Laudo enviado por e-mail" && (
        <AcessoLaudoFinal cpf={cpf} notify={notify} aoDescobrirFoto={setFotoCliente} emailConhecido={emailConhecido} />
      )}
      {doc.status === STATUS_DOC_CONCLUIDA && <AcessoDocumentosArt cpf={cpf} notify={notify} emailConhecido={emailConhecido} />}
      <AvaliarServico doc={doc} notify={notify} fotoCliente={fotoCliente} cpf={cpf} />
    </>
  );
}

const OUTROS = "__outros__";

function AbaCliente({ notify, onLogin, onIrParaLogin }) {
  const [form, setForm] = useState(novoCadastroCliente());
  const [enviando, setEnviando] = useState(false);

  const [refEmpreendimentos, setRefEmpreendimentos] = useState([]);
  const [refTipologias, setRefTipologias] = useState([]);
  const [tipologiaSel, setTipologiaSel] = useState("");
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [avisoEmail, setAvisoEmail] = useState(null); // { mensagem, sugestao } ou null
  const [construtoraSel, setConstrutoraSel] = useState("");
  const [empreendimentoSel, setEmpreendimentoSel] = useState("");
  const [construtoraOutros, setConstrutoraOutros] = useState("");
  const [empreendimentoOutros, setEmpreendimentoOutros] = useState("");
  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch("/api/empreendimentos-ref");
        setRefEmpreendimentos(r.empreendimentos || []);
        // Tipologias do empreendimento: é o que faz a área privativa vir sozinha.
        try {
          const t = await apiFetch("/api/tipologias-ref");
          setRefTipologias(t.tipologias || []);
        } catch { /* sem tipologias, o campo de área continua manual */ }
      } catch { /* dropdown vira "Outros" direto se a lista não carregar */ }
    })();
  }, []);
  const construtorasDisponiveis = [...new Set(refEmpreendimentos.map((e) => e.construtora))].sort();
  const empreendimentosDisponiveis = [...new Set(
    refEmpreendimentos.filter((e) => e.construtora === construtoraSel).map((e) => e.empreendimento)
  )].sort();
  const tipologiasDoEmpreendimento = refTipologias.filter((t) => t.empreendimento === empreendimentoSel);
  const refDoEmpreendimento = refEmpreendimentos.find((e) => e.empreendimento === empreendimentoSel);

  /* Escolher a tipologia preenche a área; trocar de empreendimento limpa a escolha e
     traz endereço/CEP quando a base tiver. O cliente pode corrigir tudo depois. */
  const escolherEmpreendimento = (nome) => {
    setEmpreendimentoSel(nome);
    setTipologiaSel("");
    const ref = refEmpreendimentos.find((e) => e.empreendimento === nome);
    setForm((f) => ({
      ...f,
      areaPrivativa: "",
      endereco: ref?.endereco ? String(ref.endereco).toUpperCase() : f.endereco,
      cep: ref?.cep ? String(ref.cep).replace(/\D/g, "").slice(0, 8) : f.cep,
    }));
  };
  const escolherTipologia = (nome) => {
    setTipologiaSel(nome);
    const t = tipologiasDoEmpreendimento.find((x) => x.tipologia === nome);
    if (t) setForm((f) => ({ ...f, areaPrivativa: t.areaPrivativa || f.areaPrivativa }));
  };

  const setF = (campo, v) => setForm((f) => ({ ...f, [campo]: v }));
  const setFMaiusc = (campo, v) => setForm((f) => ({ ...f, [campo]: v.toUpperCase() }));
  const setFCpf = (v) => setForm((f) => ({ ...f, cpf: v.replace(/\D/g, "").slice(0, 11) }));

  // Confirmação de "cadastro realizado" mostrada acima do formulário depois do envio —
  // guarda o serviço escolhido, porque o texto muda para Documentação ART/TRT (que já
  // entra direto na fila da Documentação, sem agendamento).
  const [cadastroRealizado, setCadastroRealizado] = useState(null);

  const enviar = async () => {
    if (!form.nome.trim() || !form.telefone.trim()) { notify("Informe pelo menos nome e telefone"); return; }
    if (form.cpf && form.cpf.length !== 11) { notify("O CPF deve ter 11 dígitos"); return; }
    if (form.cpf && !cpfValido(form.cpf)) { notify("CPF inválido — confira os números digitados"); return; }
    if (!form.senha.trim() || form.senha.length < 6) { notify("Crie uma senha de no mínimo 6 caracteres para acessar seu portal"); return; }
    if (!form.email.trim()) { notify("Informe um e-mail para criar a senha do portal"); return; }
    const construtoraFinal = construtoraSel === OUTROS ? construtoraOutros.trim() : construtoraSel;
    const empreendimentoFinal = empreendimentoSel === OUTROS ? empreendimentoOutros.trim() : empreendimentoSel;
    const precisaCadastroEmpreendimento = construtoraSel === OUTROS || empreendimentoSel === OUTROS;
    setEnviando(true);
    try {
      const r = await apiFetch("/api/clientes", {
        method: "POST",
        body: { ...form, construtora: construtoraFinal.toUpperCase(), empreendimento: empreendimentoFinal.toUpperCase(), precisaCadastroEmpreendimento },
      });
      setCadastroRealizado(form.servico);
      setForm(novoCadastroCliente());
      setConstrutoraSel(""); setEmpreendimentoSel(""); setConstrutoraOutros(""); setEmpreendimentoOutros("");
      // Já criou senha no cadastro: entra direto no portal, sem precisar logar de novo.
      if (r.token && onLogin) {
        onLogin({ token: r.token, usuario: r.usuario });
      } else {
        notify("Cadastro realizado ✓");
      }
    } catch (e) { notify(`Não foi possível enviar: ${e.message}`); }
    setEnviando(false);
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card icon={Users} titulo="Cadastre-se">
        {cadastroRealizado && (
          <div style={{ background: "#E6F4EA", border: "1px solid #A5D6B0", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#2E7D32", fontWeight: 700, fontSize: 14.5, marginBottom: 4 }}>
              <Check size={16} /> Cadastro realizado!
            </div>
            <div style={{ fontSize: 13.5, color: "#33683c" }}>
              {cadastroRealizado === SERVICO_DOCUMENTACAO
                ? "Sua solicitação de Documentação ART/TRT já foi para a nossa equipe de Documentação. Entre com seu e-mail e senha para acompanhar — quando ficar pronta, você baixa os documentos por lá."
                : "Recebemos seus dados. Nossa equipe entra em contato para confirmar o atendimento. Entre com seu e-mail e senha para acompanhar."}
            </div>
            <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: "#fff", marginTop: 10, padding: "6px 12px" }} onClick={() => setCadastroRealizado(null)}>
              Fazer outro cadastro
            </button>
          </div>
        )}
        <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 14px" }}>
          Preencha seus dados para agendar uma vistoria, laudo técnico ou outro serviço da FN Edificações. Nossa equipe entra em contato para confirmar o atendimento.
        </p>
        <Grid>
          <div style={cell(true)}>
            <label style={lab}>Serviço desejado</label>
            <select style={inp} value={form.servico} onChange={(e) => setF("servico", e.target.value)}>
              {SERVICO_OPCOES.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <Field label="Nome completo" value={form.nome} onChange={(v) => setF("nome", somenteLetras(v))} full />
          <div style={cell(false)}>
            <label style={lab}>CPF (11 dígitos)</label>
            <input style={inp} value={form.cpf} inputMode="numeric" onChange={(e) => setFCpf(e.target.value)} />
            {/* Só avisa depois de completar os 11 dígitos, para não acusar erro enquanto digita. */}
            {form.cpf.length === 11 && !cpfValido(form.cpf) && (
              <span style={{ fontSize: 11.5, color: "#C62828" }}>CPF inválido — confira os números.</span>
            )}
            {form.cpf.length === 11 && cpfValido(form.cpf) && (
              <span style={{ fontSize: 11.5, color: "#2E7D32" }}>CPF válido</span>
            )}
          </div>
          <Field label="Telefone / WhatsApp" value={form.telefone} onChange={(v) => setF("telefone", v.replace(/\D/g, "").slice(0, 11))} />
          {/* Sugere o domínio conforme digita (@gmail.com, @hotmail.com…), mas continua
              aceitando qualquer e-mail escrito à mão. */}
          <div style={cell(true)}>
            <label style={lab}>E-mail</label>
            <input list="sugestoes-email" style={inp} type="email" placeholder="seunome@gmail.com"
              value={form.email}
              onChange={(e) => { setF("email", e.target.value); setAvisoEmail(null); }}
              onBlur={async (e) => {
                // Confere só ao sair do campo, para não incomodar enquanto digita.
                const valor = e.target.value.trim();
                if (!valor) { setAvisoEmail(null); return; }
                try {
                  const r = await apiFetch("/api/verificar-email", { method: "POST", body: { email: valor } });
                  setAvisoEmail(r.valido && !r.sugestao ? null : { mensagem: r.mensagem, sugestao: r.sugestao });
                } catch { setAvisoEmail(null); } // verificação fora do ar não atrapalha o cadastro
              }} />
            <datalist id="sugestoes-email">
              {sugestoesEmail(form.email).map((s) => <option key={s} value={s} />)}
            </datalist>
            {avisoEmail && (
              <span style={{ fontSize: 11.5, color: "#B26A00" }}>
                {avisoEmail.mensagem}
                {avisoEmail.sugestao && (
                  <>
                    {avisoEmail.mensagem ? " " : ""}Você quis dizer{" "}
                    <button type="button"
                      onClick={() => {
                        const usuario = (form.email.split("@")[0] || "").trim();
                        setF("email", `${usuario}@${avisoEmail.sugestao}`);
                        setAvisoEmail(null);
                      }}
                      style={{ background: "none", border: "none", padding: 0, color: AZUL_MEDIO, fontWeight: 700, cursor: "pointer", fontSize: 11.5, textDecoration: "underline" }}>
                      @{avisoEmail.sugestao}
                    </button>?
                  </>
                )}
              </span>
            )}
          </div>
          <div style={cell(true)}>
            <label style={lab}>Crie uma senha</label>
            <input style={inp} type="password" placeholder="mínimo 6 caracteres" value={form.senha}
              onChange={(e) => setF("senha", e.target.value)} />
            <span style={{ fontSize: 11.5, color: "#8593a8" }}>
              Com ela você acessa o portal do cliente: acompanha seu atendimento, baixa a documentação
              pronta e vê os benefícios exclusivos dos nossos parceiros.
            </span>
          </div>
          <div style={cell(false)}>
            <label style={lab}>Construtora</label>
            <select style={inp} value={construtoraSel} onChange={(e) => { setConstrutoraSel(e.target.value); setEmpreendimentoSel(""); }}>
              <option value="">selecionar…</option>
              {construtorasDisponiveis.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value={OUTROS}>Outros (não está na lista)</option>
            </select>
            {construtoraSel === OUTROS && (
              <input style={{ ...inp, marginTop: 6 }} placeholder="Digite o nome da construtora" value={construtoraOutros} onChange={(e) => setConstrutoraOutros(e.target.value)} />
            )}
          </div>
          <div style={cell(false)}>
            <label style={lab}>Empreendimento</label>
            <select style={inp} value={empreendimentoSel} onChange={(e) => escolherEmpreendimento(e.target.value)} disabled={!construtoraSel}>
              <option value="">{construtoraSel ? "selecionar…" : "escolha a construtora primeiro"}</option>
              {empreendimentosDisponiveis.map((e) => <option key={e} value={e}>{e}</option>)}
              <option value={OUTROS}>Outros (não está na lista)</option>
            </select>
            {empreendimentoSel === OUTROS && (
              <input style={{ ...inp, marginTop: 6 }} placeholder="Digite o nome do empreendimento" value={empreendimentoOutros} onChange={(e) => setEmpreendimentoOutros(e.target.value)} />
            )}
          </div>
          {/* Só aparece quando conhecemos as tipologias do empreendimento escolhido. */}
          {tipologiasDoEmpreendimento.length > 0 && (
            <div style={cell(false)}>
              <label style={lab}>Tipologia do seu imóvel</label>
              <select style={inp} value={tipologiaSel} onChange={(e) => escolherTipologia(e.target.value)}>
                <option value="">selecionar…</option>
                {[...new Set(tipologiasDoEmpreendimento.map((t) => t.tipologia).filter(Boolean))].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <span style={{ fontSize: 11.5, color: "#8593a8" }}>Preenche a área privativa automaticamente.</span>
            </div>
          )}
          <Field label="Endereço completo" value={form.endereco} onChange={(v) => setFMaiusc("endereco", v)} full />
          <div style={cell(false)}>
            <label style={lab}>CEP</label>
            <input style={inp} value={form.cep} inputMode="numeric" placeholder="Só números"
              onChange={async (e) => {
                const cep = e.target.value.replace(/\D/g, "").slice(0, 8);
                setF("cep", cep);
                // Ao completar o CEP, busca e preenche o endereço — que continua editável.
                if (cep.length === 8) {
                  setBuscandoCep(true);
                  const achado = await buscarEnderecoPorCep(cep);
                  setBuscandoCep(false);
                  if (achado) setF("endereco", achado.endereco.toUpperCase());
                }
              }} />
            <span style={{ fontSize: 11.5, color: "#8593a8" }}>
              {buscandoCep ? "Buscando endereço…" : "Preenche o endereço automaticamente."}
            </span>
          </div>
          <Field label="Bloco / Apto" value={form.blocoTorre} onChange={(v) => setFMaiusc("blocoTorre", v)} />
          {form.servico === SERVICO_OPCOES[0] && (
            <>
              <Field label="Data desejada" type="date" value={form.dataDesejada} onChange={(v) => setF("dataDesejada", v)} />
              <div style={cell(false)}>
                <label style={lab}>Horário desejado</label>
                <select style={inp} value={form.horarioDesejado} onChange={(e) => setF("horarioDesejado", e.target.value)}>
                  <option value="">selecionar…</option>
                  {HORARIOS_COMERCIAIS.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
                <span style={{ fontSize: 11.5, color: "#8593a8" }}>Atendemos das 07:00 às 18:00.</span>
              </div>
              <Field label="Área privativa do imóvel (opcional)" value={form.areaPrivativa}
                onChange={(v) => setF("areaPrivativa", v)} placeholder="Ex.: 58,40 m²" />
            </>
          )}
        </Grid>
        <Area label="Observações (opcional)" value={form.observacoes} onChange={(v) => setFMaiusc("observacoes", v)} rows={2} placeholder="EX.: MELHOR HORÁRIO PARA CONTATO, DETALHES DO IMÓVEL..." />
        <button className="btn-solid" style={{ marginTop: 12 }} onClick={enviar} disabled={enviando}>
          {enviando ? <Loader2 size={15} className="spin" /> : <Plus size={15} />} Enviar cadastro
        </button>
      </Card>

      <SecaoFeedbackVitrine notify={notify} />
      <SecaoParceirosVitrine notify={notify} onIrParaLogin={onIrParaLogin} somenteLogos />
    </div>
  );
}

/* ================= Módulo: Parceiros / Afiliados (aditivo) =================
   Nomenclatura: "Parceiro" é quem presta um serviço; "Afiliado" é quem vende produto.
   É o mesmo cadastro/tabela por baixo (campo "tipo" já distinguia isso) — só os rótulos
   exibidos que precisavam deixar essa distinção clara. */
const PARCEIRO_TIPO_OPCOES = [
  { valor: "servico", label: "Parceiro (presta serviço)" },
  { valor: "produto", label: "Afiliado (vende produto)" },
];
const PARCEIRO_TIPO_LABEL = { servico: "Parceiro", produto: "Afiliado" };

/* FN Serviços é a marca guarda-chuva; FN Clube (parceiros que prestam serviço) e FN Home
   (afiliados que vendem produto) são as duas áreas de benefícios dentro dela — mesmo
   cadastro de sempre (campo "tipo"), só a apresentação ao cliente muda por área. */
const FN_AREA_INFO = {
  servico: { titulo: "FN Clube", descricao: "Serviços selecionados para seu imóvel, com benefícios exclusivos para clientes FN." },
  produto: { titulo: "FN Home", descricao: "Produtos e vantagens para transformar seu imóvel em lar, com condições exclusivas FN." },
};

const PARCEIRO_STATUS_OPCOES = ["em_analise", "aprovado", "suspenso", "encerrado"];
const PARCEIRO_STATUS_LABEL = { em_analise: "Em análise", aprovado: "Aprovado", suspenso: "Suspenso", encerrado: "Encerrado" };
const LEAD_STATUS_LABEL = {
  novo: "Aguardando o parceiro", visualizado: "Parceiro visualizou", orcamento_enviado: "Proposta recebida",
  proposta_aceita: "Proposta aceita", perdido: "Encerrado",
};
/* Pedido do carrinho (marketplace, pago via Mercado Pago) — ver pedidos.js no backend. */
const PEDIDO_STATUS_LABEL = { aguardando_pagamento: "Aguardando pagamento", pago: "Pago", cancelado: "Cancelado" };
STATUS_COR["Aguardando pagamento"] = { cor: "#B26A00", bg: "#FFF4E0" };
STATUS_COR["Aguardando o parceiro"] = { cor: "#B26A00", bg: "#FFF4E0" };
STATUS_COR["Parceiro visualizou"] = { cor: "#2C75B5", bg: "#EAF2FB" };
STATUS_COR["Proposta recebida"] = { cor: "#2C75B5", bg: "#EAF2FB" };
STATUS_COR["Proposta aceita"] = { cor: "#2E7D32", bg: "#E6F4EA" };
// "Encerrado" já tem cor definida mais abaixo, junto de PARCEIRO_STATUS_LABEL.
STATUS_COR["Em análise"] = { cor: "#2C75B5", bg: "#EAF2FB" };
STATUS_COR["Aprovado"] = { cor: "#2E7D32", bg: "#E6F4EA" };
STATUS_COR["Suspenso"] = { cor: "#B26A00", bg: "#FFF4E0" };
STATUS_COR["Encerrado"] = { cor: "#65758b", bg: "#EEF1F5" };
/* Etapa atual do cliente no fluxo completo (cadastro → análise → vistoria → laudo), ver etapaAtualCliente. */
STATUS_COR["Agendamento aprovado"] = { cor: "#2C75B5", bg: "#EAF2FB" };
STATUS_COR["Vistoria agendada"] = { cor: "#6A3FB2", bg: "#F1EBFB" };
STATUS_COR["Laudo em análise"] = { cor: "#B26A00", bg: "#FFF4E0" };
/* Rótulo que o cliente vê no lugar de "Laudo em análise" — ver ROTULO_PUBLICO no backend. */
STATUS_COR["Vistoria realizada"] = { cor: "#2E7D32", bg: "#E6F4EA" };
STATUS_COR["Laudo enviado por e-mail"] = { cor: "#2E7D32", bg: "#E6F4EA" };
STATUS_COR["Cancelado"] = { cor: "#C62828", bg: "#FCEAEA" };
/* Etapas operacionais da vistoria (ETAPAS_VISTORIA), usadas nos indicadores do Agendamento. */
STATUS_COR["Solicitação de vistoria"] = { cor: "#65758b", bg: "#EEF1F5" };
STATUS_COR["Vistoriado"] = { cor: "#2E7D32", bg: "#E6F4EA" };
/* Etapa extra da aba Clientes: cadastro que não passa por vistoria (ver ETAPAS_CLIENTE). */
STATUS_COR["Documentação ART/TRT"] = { cor: "#0F766E", bg: "#E3F3F1" };
/* Fluxo próprio da Documentação ART/TRT, visto também pelo cliente no acompanhamento. */
STATUS_COR[STATUS_DOC_PROCESSANDO] = { cor: "#B26A00", bg: "#FFF4E0" };
STATUS_COR[STATUS_DOC_CONCLUIDA] = { cor: "#2E7D32", bg: "#E6F4EA" };

function safeParseArray(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
}
/* Converte um registro de Parceiro vindo do banco (snake_case) para o formato usado no app (camelCase) */
function mapParceiroDaApi(p) {
  return {
    id: p.id, status: p.status || "em_analise", tipo: p.tipo || "servico",
    empresa: p.empresa || "", responsavel: p.responsavel || "", cnpj: p.cnpj || "",
    cidade: p.cidade || "", uf: p.uf || "", whatsapp: p.whatsapp || "",
    instagram: p.instagram || "", site: p.site || "", logo: p.logo || "", email: p.email || "",
    comissao: safeParseArray(p.comissao),
    beneficio: p.beneficio || "", descricaoBeneficio: p.descricao_beneficio || p.descricaoBeneficio || "",
    avaliacao: p.avaliacao || "",
    comissoesPendentes: Number(p.comissoes_pendentes || 0),
  };
}

const novaComissaoLinha = () => ({ name: "", p: "" });
const novoCadastroParceiro = () => ({
  email: "", senha: "", tipo: "servico", empresa: "", responsavel: "", cnpj: "",
  cidade: "", uf: "", whatsapp: "", instagram: "", site: "", logo: "",
  comissao: [novaComissaoLinha()], beneficio: "", descricaoBeneficio: "",
});

/* ---- Modal interno: Vendas/Gerência cadastra um parceiro em nome dele (ex.: negociou por
   telefone) — mesmos campos e mesma rota pública de autocadastro (/api/parceiros/signup),
   só que preenchidos por quem já está logado, em vez do próprio parceiro pelo portal. */
function ModalCriarParceiroManual({ onFechar, criarParceiroManual, notify }) {
  const [form, setForm] = useState(novoCadastroParceiro());
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const setF = (campo, v) => setForm((f) => ({ ...f, [campo]: v }));
  const setComissaoLinha = (idx, patch) => setForm((f) => ({ ...f, comissao: f.comissao.map((l, i) => (i === idx ? { ...l, ...patch } : l)) }));
  const addComissaoLinha = () => setForm((f) => ({ ...f, comissao: [...f.comissao, novaComissaoLinha()] }));
  const removerComissaoLinha = (idx) => setForm((f) => ({ ...f, comissao: f.comissao.filter((_, i) => i !== idx) }));

  const enviar = async () => {
    setErro("");
    if (!form.email.trim() || !form.senha.trim()) { setErro("Informe e-mail e senha de acesso do parceiro."); return; }
    if (form.senha.length < 6) { setErro("A senha precisa ter pelo menos 6 caracteres."); return; }
    if (!form.empresa.trim() || !form.responsavel.trim()) { setErro("Informe a empresa e o responsável."); return; }
    if (!form.cidade.trim() || !form.uf.trim()) { setErro("Informe cidade e UF."); return; }
    if (!form.whatsapp.trim()) { setErro("Informe um WhatsApp para contato."); return; }
    const comissaoValida = form.comissao.filter((l) => l.name.trim() && l.p !== "");
    if (comissaoValida.length === 0) { setErro("Adicione ao menos uma categoria de comissão com percentual."); return; }

    setEnviando(true);
    const body = { ...form, comissao: comissaoValida.map((l) => ({ name: l.name.trim(), p: Number(l.p) })) };
    const r = await criarParceiroManual(body);
    setEnviando(false);
    if (r.ok) { notify("Parceiro cadastrado ✓"); onFechar(); }
  };

  return (
    <div className="no-print" style={overlay} onClick={onFechar}>
      <div style={{ ...modal, maxWidth: 560, maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <strong>Cadastrar parceiro</strong>
          <button className="icon-btn" onClick={onFechar}><X size={16} /></button>
        </div>
        <p style={{ fontSize: 12.5, color: "#65758b", margin: "0 0 14px" }}>
          A senha de acesso é do próprio parceiro (ele usa pra entrar na área dele). Combine com ele antes de cadastrar.
        </p>

        <Grid>
          <Field label="E-mail de acesso" type="email" value={form.email} onChange={(v) => setF("email", v)} />
          <Field label="Senha de acesso" type="password" value={form.senha} onChange={(v) => setF("senha", v)} />
          <div style={cell()}>
            <label style={lab}>Tipo de parceria</label>
            <select style={inp} value={form.tipo} onChange={(e) => setF("tipo", e.target.value)}>
              {PARCEIRO_TIPO_OPCOES.map((o) => <option key={o.valor} value={o.valor}>{o.label}</option>)}
            </select>
          </div>
          <Field label="CNPJ" value={form.cnpj} onChange={(v) => setF("cnpj", v)} />
          <Field label="Empresa" value={form.empresa} onChange={(v) => setF("empresa", v)} full />
          <Field label="Responsável" value={form.responsavel} onChange={(v) => setF("responsavel", v)} />
          <Field label="WhatsApp" value={form.whatsapp} onChange={(v) => setF("whatsapp", v)} />
          <Field label="Cidade" value={form.cidade} onChange={(v) => setF("cidade", v)} />
          <Field label="UF" value={form.uf} onChange={(v) => setF("uf", v.toUpperCase().slice(0, 2))} />
          <Field label="Instagram" value={form.instagram} onChange={(v) => setF("instagram", v)} />
          <Field label="Site" value={form.site} onChange={(v) => setF("site", v)} />
        </Grid>

        <div style={{ marginTop: 16 }}>
          <label style={lab}>Categorias e percentual de comissão</label>
          <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
            {form.comissao.map((linha, idx) => (
              <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input style={{ ...inp, flex: 1 }} placeholder="Categoria (ex.: Mão de obra)" value={linha.name}
                  onChange={(e) => setComissaoLinha(idx, { name: e.target.value })} />
                <input style={{ ...inp, width: 90 }} type="number" min="0" max="100" placeholder="%" value={linha.p}
                  onChange={(e) => setComissaoLinha(idx, { p: e.target.value })} />
                <button type="button" className="icon-btn" onClick={() => removerComissaoLinha(idx)} disabled={form.comissao.length === 1}>
                  <Trash2 size={15} color="#c62828" />
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn-add" style={{ marginTop: 10, padding: 10, fontSize: 13 }} onClick={addComissaoLinha}>
            <Plus size={15} /> Adicionar categoria de comissão
          </button>
        </div>

        <Field label="Benefício oferecido (resumo)" value={form.beneficio} onChange={(v) => setF("beneficio", v)} full />
        <Area label="Descrição do benefício" value={form.descricaoBeneficio} onChange={(v) => setF("descricaoBeneficio", v)} rows={3} placeholder="Explique as condições do benefício oferecido aos clientes FN" />

        {erro && <div style={{ marginTop: 12, background: "#FCEAEA", color: "#C62828", padding: "9px 12px", borderRadius: 8, fontSize: 12.5 }}>{erro}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO }} onClick={onFechar}>Cancelar</button>
          <button className="btn-solid" onClick={enviar} disabled={enviando}>
            {enviando ? <><Loader2 size={15} className="spin" /> Cadastrando…</> : <><Check size={15} /> Cadastrar parceiro</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- Página pública: portfólio do parceiro ("mini site de vendas"), acessível pelo link
   individual (?portfolio=<id>) sem precisar de login — é o que atrai o cliente. ---- */
/* Comissão informada? 0% é um valor legítimo ("não pago comissão neste item"), então não
   dá para testar por veracidade — só vazio e nulo é que significam "não informado". */
function temComissao(v) {
  return v !== null && v !== undefined && v !== "";
}

/* O parceiro digita "de" e "por" como texto livre ("R$ 500", "500,00", "500"), então o
   número precisa ser extraído antes de qualquer conta — inclusive para comparar com o
   preço de venda online, que esse sim é numérico. */
function precoParaNumero(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = parseFloat(String(valor).replace(/[^0-9,.-]/g, "").replace(/\.(?=.*\.)/g, "").replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

function calcularDesconto(precoDe, preco) {
  const de = precoParaNumero(precoDe);
  const por = precoParaNumero(preco);
  if (de === null || por === null || de <= por || de <= 0) return null;
  return Math.round((1 - por / de) * 100);
}

/* Preço de um item comprável. O cliente precisa ver que ganhou desconto, e não só o valor
   final: sem o "de" riscado ao lado, o benefício de ser cliente FN fica invisível
   justamente na hora de decidir a compra. O riscado só aparece quando o "de" é um número
   de verdade e maior que o preço cobrado — desconto inventado seria propaganda enganosa. */
function PrecoDeVenda({ precoDe, precoVenda, compacto }) {
  const de = precoParaNumero(precoDe);
  const por = Number(precoVenda);
  const temDesconto = de !== null && de > por;
  return (
    <div>
      {temDesconto && (
        <div style={{ fontSize: compacto ? 11 : 12, color: "#8593a8", textDecoration: "line-through" }}>{fmtReal(de)}</div>
      )}
      <div style={{ fontSize: compacto ? 13 : 15, fontWeight: compacto ? 700 : 800, color: "#2E7D32" }}>{fmtReal(por)}</div>
      {temDesconto && (
        <div style={{ fontSize: compacto ? 10.5 : 11.5, color: "#C62828", fontWeight: 700 }}>
          Você economiza {fmtReal(de - por)}
        </div>
      )}
    </div>
  );
}

/* ---- Resgate do cupom na página do parceiro ----
   O cliente gerava o código na Área do Cliente e ficava sem onde usar: a rota de resgate
   existia no servidor, mas nenhuma tela chamava. É aqui que o ciclo fecha — na hora da
   compra, o cliente digita o código e o parceiro vê o benefício confirmado na tela.
   O parceiroId vai junto na chamada: cupom da Loja A não pode ser aceito na página da
   Loja B, senão a B dá o desconto e a comissão fica registrada para a A. */
function ResgateCupom({ parceiroId, empresa }) {
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [resgate, setResgate] = useState(null);

  const resgatar = async () => {
    const cod = codigo.trim().toUpperCase();
    if (!cod) { setErro("Digite o código do seu cupom."); return; }
    setErro(""); setEnviando(true);
    try {
      const r = await apiFetch(`/api/vales/${encodeURIComponent(cod)}/ativar`, {
        method: "POST", body: { parceiroId },
      });
      setResgate(r);
    } catch (e) { setErro(e.message); }
    setEnviando(false);
  };

  if (resgate) {
    return (
      <div style={{ background: "#fff", border: "1px solid #a5d6b0", borderRadius: 12, padding: 18, marginBottom: 22, textAlign: "center" }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#E6F4EA", display: "grid", placeItems: "center", margin: "0 auto 12px" }}>
          <Check size={22} color="#2E7D32" />
        </div>
        <div style={{ fontSize: 15.5, fontWeight: 800, color: "#2E7D32" }}>Cupom resgatado</div>
        {resgate.beneficio && (
          <div style={{ fontSize: 14, fontWeight: 700, color: AZUL_MARINHO, marginTop: 8 }}>{resgate.beneficio}</div>
        )}
        <div style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: "#4a5a70", background: CINZA_CLARO, borderRadius: 8, padding: "8px 12px", margin: "12px auto 0", display: "inline-block", letterSpacing: 1 }}>
          {resgate.codigo}
        </div>
        <p style={{ fontSize: 12.5, color: "#65758b", margin: "12px 0 0", lineHeight: 1.55 }}>
          Mostre esta tela para {empresa} aplicar o benefício.
          {resgate.cliente?.nome ? ` Cupom em nome de ${resgate.cliente.nome}.` : ""}
        </p>
        {/* O código só vale uma vez — deixar isso explícito evita a pessoa achar que
            perdeu o benefício se fechar a página e voltar. */}
        <p style={{ fontSize: 11.5, color: "#8593a8", margin: "8px 0 0" }}>
          Este código já foi usado e não pode ser resgatado de novo.
        </p>
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 12, padding: 16, marginBottom: 22 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: AZUL_MARINHO, marginBottom: 4, textTransform: "uppercase", letterSpacing: .3 }}>
        Já tem seu cupom?
      </div>
      <p style={{ fontSize: 13, color: "#65758b", margin: "0 0 12px" }}>
        Digite o código que você gerou na Área do Cliente para resgatar o benefício aqui na {empresa}.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={codigo}
          onChange={(e) => { setCodigo(e.target.value.toUpperCase()); setErro(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") resgatar(); }}
          placeholder="FN-EMPRESA-0000"
          autoCapitalize="characters"
          spellCheck={false}
          style={{ flex: 1, minWidth: 180, padding: "11px 13px", border: `1px solid ${CINZA_BORDA}`, borderRadius: 9,
            fontSize: 15, fontFamily: "monospace", letterSpacing: 1, textTransform: "uppercase" }}
        />
        <button className="btn-solid" onClick={resgatar} disabled={enviando || !codigo.trim()} style={{ padding: "11px 20px" }}>
          {enviando ? <Loader2 size={15} className="spin" /> : <Check size={15} />} Resgatar
        </button>
      </div>
      {erro && (
        <div style={{ marginTop: 10, background: "#FCEAEA", color: "#C62828", padding: "9px 12px", borderRadius: 8, fontSize: 12.5 }}>
          {erro}
        </div>
      )}
    </div>
  );
}

function PaginaPortfolioParceiro({ parceiroId }) {
  const [parceiro, setParceiro] = useState(null);
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);
  const [toast, setToast] = useState("");
  const notify = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };
  const carrinho = useCarrinho();
  /* Página pública, fora do fluxo normal de login do App() — lê a sessão salva direto do
     armazenamento pra saber se quem está navegando já está logado como cliente (ex.: outra
     aba). Sem isso "Finalizar compra" nunca teria token nenhum pra usar, mesmo logado. */
  const sessaoAtual = carregarSessaoSalva();
  const tokenCliente = sessaoAtual?.usuario?.role === "cliente" ? sessaoAtual.token : undefined;

  useEffect(() => {
    (async () => {
      setCarregando(true);
      try {
        const [rVitrine, rServicos] = await Promise.all([
          apiFetch("/api/parceiros/vitrine"),
          apiFetch(`/api/parceiros/${parceiroId}/servicos`),
        ]);
        const p = (rVitrine.parceiros || []).find((x) => x.id === parceiroId);
        if (!p) setErro("Portfólio não encontrado ou a parceria não está mais ativa.");
        setParceiro(p || null);
        setItens(rServicos.servicos || []);
      } catch {
        setErro("Não foi possível carregar este portfólio. Verifique sua internet e tente novamente.");
      }
      setCarregando(false);
    })();
  }, [parceiroId]);

  if (carregando) {
    return <div style={{ minHeight: "100vh", background: CINZA_CLARO, display: "grid", placeItems: "center", color: "#8593a8", fontFamily: "'Inter', system-ui, sans-serif" }}>Carregando…</div>;
  }
  if (erro || !parceiro) {
    return (
      <div style={{ minHeight: "100vh", background: CINZA_CLARO, display: "grid", placeItems: "center", padding: 18, fontFamily: "'Inter', system-ui, sans-serif" }}>
        <p style={{ color: "#65758b", fontSize: 14, textAlign: "center", maxWidth: 320 }}>{erro || "Portfólio não encontrado."}</p>
      </div>
    );
  }

  const linkWhatsapp = parceiro.whatsapp ? `https://wa.me/55${String(parceiro.whatsapp).replace(/\D/g, "")}` : null;

  return (
    <div style={{ minHeight: "100vh", background: CINZA_CLARO, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <header style={{ background: AZUL_MARINHO, color: "#fff" }}>
        <div style={{ maxWidth: 780, margin: "0 auto", padding: "26px 18px", display: "flex", alignItems: "center", gap: 14 }}>
          {parceiro.logo && <img src={parceiro.logo} alt={parceiro.empresa} style={{ width: 56, height: 56, borderRadius: 10, background: "#fff", objectFit: "contain", flexShrink: 0 }} />}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{parceiro.empresa}</div>
            <div style={{ fontSize: 12.5, opacity: .75 }}>
              {PARCEIRO_TIPO_LABEL[parceiro.tipo] || parceiro.tipo}{parceiro.cidade ? ` · ${parceiro.cidade}/${parceiro.uf}` : ""}
            </div>
          </div>
          <BotaoCarrinho quantidade={carrinho.quantidadeTotal} onClick={() => setCarrinhoAberto(true)} />
        </div>
      </header>

      <main style={{ maxWidth: 780, margin: "0 auto", padding: "24px 18px 60px" }}>
        {parceiro.beneficio && (
          <div style={{ background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 12, padding: 16, marginBottom: 22 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: AZUL_MARINHO, marginBottom: 4, textTransform: "uppercase", letterSpacing: .3 }}>Benefício para clientes FN</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{parceiro.beneficio}</div>
            {parceiro.descricao_beneficio && <p style={{ fontSize: 13, color: "#65758b", margin: "6px 0 0" }}>{parceiro.descricao_beneficio}</p>}
          </div>
        )}

        <ResgateCupom parceiroId={parceiroId} empresa={parceiro.empresa} />

        {itens.length === 0 ? (
          <p style={{ color: "#8593a8", fontSize: 14, textAlign: "center", marginTop: 40 }}>Este portfólio ainda não tem itens cadastrados.</p>
        ) : (
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
            {itens.map((s) => {
              /* Quando o item é comprável, o selo tem de bater com o valor que vai ser
                 cobrado — senão a vitrine anuncia -10% e cobra outro desconto. */
              const desconto = calcularDesconto(s.preco_de, s.preco_venda || s.preco);
              return (
                <div key={s.id} style={{ background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 12, overflow: "hidden", position: "relative" }}>
                  {desconto && (
                    <span style={{ position: "absolute", top: 10, left: 10, background: "#C62828", color: "#fff", fontSize: 20, fontWeight: 800, padding: "6px 14px", borderRadius: 8, zIndex: 1, boxShadow: "0 3px 10px rgba(0,0,0,.25)" }}>
                      -{desconto}%
                    </span>
                  )}
                  {/* "contain", não "cover": a foto do portfólio é material de venda pronto —
                      arte com preço, antes e depois, print de catálogo. Cortar a borda para
                      preencher o card comia justamente o que o parceiro quis mostrar. */}
                  {s.foto && <img src={s.foto} alt={s.titulo || ""} style={{ width: "100%", height: 190, objectFit: "contain", display: "block", background: CINZA_CLARO }} />}
                  <div style={{ padding: 12 }}>
                    {s.categoria && <div style={{ fontSize: 10.5, fontWeight: 700, color: AZUL_MEDIO, textTransform: "uppercase", marginBottom: 4 }}>{s.categoria}</div>}
                    {s.titulo && <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 4 }}>{s.titulo}</div>}
                    {s.descricao && <p style={{ fontSize: 13, color: "#65758b", margin: "0 0 6px" }}>{s.descricao}</p>}
                    {s.preco_venda ? (
                      <PrecoDeVenda precoDe={s.preco_de} precoVenda={s.preco_venda} />
                    ) : (
                      <>
                        {s.preco_de && <div style={{ fontSize: 12, color: "#8593a8", textDecoration: "line-through" }}>{s.preco_de}</div>}
                        {s.preco && <div style={{ fontSize: 13, fontWeight: 700, color: "#2E7D32" }}>{s.preco}</div>}
                      </>
                    )}
                    {s.preco_venda > 0 && (
                      <button className="btn-solid" style={{ width: "100%", justifyContent: "center", marginTop: 10, padding: "8px" }}
                        onClick={() => { carrinho.adicionar({ servicoId: s.id, titulo: s.titulo || "Serviço", precoUnitario: Number(s.preco_venda), precoDe: precoParaNumero(s.preco_de), parceiroEmpresa: parceiro.empresa, foto: s.foto }); notify("Adicionado ao carrinho ✓"); }}>
                        <ShoppingCart size={14} /> Comprar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {linkWhatsapp && (
          <a href={linkWhatsapp} target="_blank" rel="noreferrer" className="btn-solid"
            style={{ marginTop: 26, width: "auto", padding: "12px 22px", textDecoration: "none", display: "inline-flex" }}>
            Falar no WhatsApp
          </a>
        )}
      </main>

      {carrinhoAberto && (
        <ModalCarrinho itens={carrinho.itens} alterarQuantidade={carrinho.alterarQuantidade} remover={carrinho.remover}
          total={carrinho.total} onFechar={() => setCarrinhoAberto(false)} token={tokenCliente} notify={notify}
          onIrParaLogin={() => { window.location.href = `${window.location.origin}${window.location.pathname}`; }}
          esvaziar={carrinho.esvaziar} />
      )}
      {toast && (
        <div className="no-print" style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: AZUL_MARINHO, color: "#fff", padding: "10px 18px", borderRadius: 10, fontSize: 13.5, boxShadow: "0 6px 20px rgba(0,0,0,.2)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}

/* ---- Página pública: FN Clube (?pagina=fn-clube) e FN Home (?pagina=fn-home) ----
   Mesma vitrine de sempre (SecaoParceirosVitrine, tipo "servico"/"produto"), só que como
   página própria, dentro da marca FN Serviços — é o que o resto do site linka quando fala
   em "VER BENEFÍCIOS" ou "VER PRODUTOS". Funciona sem login, igual ao portfólio do parceiro. */
function PaginaBeneficiosFn({ tipo }) {
  const info = FN_AREA_INFO[tipo] || FN_AREA_INFO.servico;
  const [toast, setToast] = useState("");
  const notify = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };
  const home = `${window.location.origin}${window.location.pathname}`;
  /* Página fora do fluxo normal de login do App() — lê a sessão salva direto do
     armazenamento pra saber se quem está navegando já está logado como cliente. */
  const sessaoAtual = carregarSessaoSalva();
  const clienteLogado = sessaoAtual?.usuario?.role === "cliente" ? sessaoAtual.usuario : null;
  const tokenCliente = clienteLogado ? sessaoAtual.token : undefined;
  return (
    <div style={{ minHeight: "100vh", background: CINZA_CLARO, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <header style={{ background: AZUL_MARINHO, color: "#fff" }}>
        <div style={{ maxWidth: 780, margin: "0 auto", padding: "16px 18px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: "clamp(36px, 9vw, 44px)", height: "clamp(36px, 9vw, 44px)", borderRadius: 9, background: "#fff", display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0 }}>
            <img src={LOGO_URL} alt="FN Edificações" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <div style={{ lineHeight: 1.1, flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>FN Serviços</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>{info.titulo}</div>
          </div>
          <a href={home} className="btn-ghost" style={{ textDecoration: "none" }}>← Início</a>
        </div>
        <div style={{ maxWidth: 780, margin: "0 auto", padding: "0 18px 14px", display: "flex", gap: 20, fontSize: 13, fontWeight: 700 }}>
          <a href={`${home}#solicitar-servico`} style={{ color: "#fff", opacity: 0.85, textDecoration: "none" }}>Serviços FN</a>
          <a href="?pagina=fn-clube" style={{ color: "#fff", opacity: tipo === "servico" ? 1 : 0.85, textDecoration: "none" }}>FN Clube</a>
          <a href="?pagina=fn-home" style={{ color: "#fff", opacity: tipo === "produto" ? 1 : 0.85, textDecoration: "none" }}>FN Home</a>
        </div>
      </header>
      <main style={{ maxWidth: 780, margin: "0 auto", padding: "22px 18px 80px" }}>
        <SecaoParceirosVitrine notify={notify} tipoInicial={tipo} clienteLogado={clienteLogado} token={tokenCliente}
          onIrParaLogin={() => { window.location.href = `${window.location.origin}${window.location.pathname}`; }} />
      </main>
      {toast && (
        <div className="no-print" style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: AZUL_MARINHO, color: "#fff", padding: "10px 18px", borderRadius: 10, fontSize: 13.5, boxShadow: "0 6px 20px rgba(0,0,0,.2)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}

/* ---- Tela pública: cadastro de Parceiro/Afiliado (sem login) ---- */
function TelaCadastroParceiro({ onVoltar, onIrParaLogin }) {
  const [form, setForm] = useState(novoCadastroParceiro());
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState(null); // { id, status }

  const setF = (campo, v) => setForm((f) => ({ ...f, [campo]: v }));

  const onLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErro("Envie uma imagem (PNG ou JPG) para a logo"); return; }
    const reader = new FileReader();
    reader.onload = () => setF("logo", reader.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  /* Comissão e benefício saíram daqui: quem chega nesta tela ainda está decidindo se vira
     parceiro, e a proposta comercial é justamente a parte que exige pensar. Agora ele cria
     o acesso com o essencial e completa proposta e portfólio já logado, no painel, com
     tempo — a homologação da gerência acontece depois, sobre o conjunto pronto. */
  const enviar = async () => {
    setErro("");
    if (!form.email.trim() || !form.senha.trim()) { setErro("Informe e-mail e senha de acesso."); return; }
    if (form.senha.length < 6) { setErro("A senha precisa ter pelo menos 6 caracteres."); return; }
    if (!form.empresa.trim() || !form.responsavel.trim()) { setErro("Informe a empresa e o responsável."); return; }
    if (!form.cidade.trim() || !form.uf.trim()) { setErro("Informe cidade e UF."); return; }
    if (!form.whatsapp.trim()) { setErro("Informe um WhatsApp para contato."); return; }

    setEnviando(true);
    try {
      const { comissao, beneficio, descricaoBeneficio, ...dadosDoCadastro } = form;
      const r = await apiFetch("/api/parceiros/signup", { method: "POST", body: dadosDoCadastro });
      setResultado({ id: r.id, status: r.status || "em_analise" });
    } catch (e) {
      setErro(e.message === "Failed to fetch" ? "Não foi possível conectar à API. Verifique sua internet e tente novamente." : e.message);
    }
    setEnviando(false);
  };

  if (resultado) {
    return (
      <div style={{ minHeight: "100vh", background: CINZA_CLARO, display: "grid", placeItems: "center", padding: 18, fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: "36px 30px", width: "100%", maxWidth: 440, boxShadow: "0 10px 30px rgba(18,51,91,.12)", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#E6F4EA", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <Check size={28} color="#2E7D32" />
          </div>
          <h2 style={{ color: AZUL_MARINHO, fontSize: 19, margin: "0 0 8px" }}>Acesso criado!</h2>
          <p style={{ color: "#65758b", fontSize: 13.5, margin: "0 0 16px" }}>
            Recebemos os dados da <strong>{form.empresa}</strong>. O próximo passo é seu: entre com
            <strong> {form.email}</strong> e a senha que acabou de cadastrar para completar a proposta
            (comissão e benefício) e montar seu portfólio.
          </p>
          {/* Antes o cadastro terminava aqui e a pessoa ia embora esperar um contato. O que
              decide se a parceria entra no ar é o perfil completo, e quem monta é ela — por
              isso o botão principal agora leva direto para o login. */}
          <p style={{ color: "#65758b", fontSize: 13, margin: "0 0 16px" }}>
            Quando estiver pronto, nossa equipe homologa e sua empresa passa a aparecer para os
            clientes FN.
          </p>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
            <Selo valor={PARCEIRO_STATUS_LABEL[resultado.status] || resultado.status} />
          </div>
          <button type="button" className="btn-solid" style={{ width: "100%", justifyContent: "center" }} onClick={onIrParaLogin}>
            <Lock size={14} /> Entrar e completar meu perfil
          </button>
          <button type="button" onClick={onVoltar}
            style={{ width: "100%", marginTop: 10, background: "none", border: "none", color: AZUL_MEDIO, fontSize: 13, cursor: "pointer" }}>
            Depois eu completo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: CINZA_CLARO, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <header style={{ background: AZUL_MARINHO, color: "#fff" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 18px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: "clamp(36px, 9vw, 44px)", height: "clamp(36px, 9vw, 44px)", borderRadius: 9, background: "#fff", display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0 }}>
            <img src={LOGO_URL} alt="FN Edificações" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <div style={{ lineHeight: 1.1, flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>FN Edificações</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>Seja um Parceiro</div>
          </div>
          <button className="btn-ghost" onClick={onIrParaLogin}><Lock size={13} /> Entrar</button>
          <button className="btn-ghost" onClick={onVoltar}>← Voltar</button>
        </div>
      </header>
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "22px 18px 80px" }}>
        <Card icon={Users} titulo="Cadastro de Parceiro / Afiliado">
          <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 14px" }}>
            Cadastre sua empresa para se tornar parceira FN Edificações e oferecer benefícios aos nossos clientes.
            Já é cadastrado? <a onClick={onIrParaLogin} style={{ color: AZUL_MARINHO, fontWeight: 600, cursor: "pointer" }}>Entre com seu e-mail e senha</a>.
          </p>
          <div style={{ background: "#FFF4E0", color: "#B26A00", padding: "10px 12px", borderRadius: 8, fontSize: 12.5, marginBottom: 16, display: "flex", gap: 8, alignItems: "flex-start" }}>
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>A senha de acesso é única — guarde-a bem. Comissão, benefício e portfólio você preenche depois, já logado no painel.</span>
          </div>

          <Grid>
            <Field label="E-mail de acesso" type="email" value={form.email} onChange={(v) => setF("email", v)} />
            <Field label="Senha de acesso" type="password" value={form.senha} onChange={(v) => setF("senha", v)} />
            <div style={cell()}>
              <label style={lab}>Tipo de parceria</label>
              <select style={inp} value={form.tipo} onChange={(e) => setF("tipo", e.target.value)}>
                {PARCEIRO_TIPO_OPCOES.map((o) => <option key={o.valor} value={o.valor}>{o.label}</option>)}
              </select>
            </div>
            <Field label="CNPJ" value={form.cnpj} onChange={(v) => setF("cnpj", v)} />
            <Field label="Empresa" value={form.empresa} onChange={(v) => setF("empresa", v)} full />
            <Field label="Responsável" value={form.responsavel} onChange={(v) => setF("responsavel", v)} />
            <Field label="WhatsApp" value={form.whatsapp} onChange={(v) => setF("whatsapp", v)} />
            <Field label="Cidade" value={form.cidade} onChange={(v) => setF("cidade", v)} />
            <Field label="UF" value={form.uf} onChange={(v) => setF("uf", v.toUpperCase().slice(0, 2))} />
            <Field label="Instagram" value={form.instagram} onChange={(v) => setF("instagram", v)} />
            <Field label="Site" value={form.site} onChange={(v) => setF("site", v)} />
          </Grid>

          <div style={{ ...cell(true), marginTop: 12 }}>
            <label style={lab}>Logo da empresa</label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {form.logo && <img src={form.logo} alt="Logo" style={{ width: 52, height: 52, objectFit: "contain", border: `1px solid ${CINZA_BORDA}`, borderRadius: 8, background: "#fff" }} />}
              <label className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO, cursor: "pointer" }}>
                <Camera size={14} /> {form.logo ? "Trocar logo" : "Enviar logo"}
                <input type="file" accept="image/*" onChange={onLogo} style={{ display: "none" }} />
              </label>
            </div>
          </div>

          <p style={{ fontSize: 12.5, color: "#8593a8", margin: "18px 0 0" }}>
            Depois de criar o acesso, você entra no painel e monta a proposta comercial (categorias
            de comissão e o benefício aos clientes FN) e o portfólio dos seus serviços.
          </p>

          {erro && <div style={{ marginTop: 12, background: "#FCEAEA", color: "#C62828", padding: "9px 12px", borderRadius: 8, fontSize: 12.5 }}>{erro}</div>}

          <button type="button" className="btn-solid" style={{ marginTop: 16 }} onClick={enviar} disabled={enviando}>
            {enviando ? <><Loader2 size={15} className="spin" /> Criando…</> : <><Check size={15} /> Criar meu acesso</>}
          </button>
        </Card>
      </main>
    </div>
  );
}

/* ---- Painel do Parceiro (área logada do afiliado, papel "afiliado") ---- */
const PARCEIRO_STATUS_INFO = {
  em_analise: "Complete seus dados, a comissão, o benefício e o portfólio aqui embaixo. Com o perfil pronto, nossa equipe homologa e sua logo passa a aparecer para os clientes.",
  aprovado: "Sua parceria está ativa! Sua logo já aparece na vitrine para os clientes da FN Edificações.",
  suspenso: "Sua parceria está temporariamente suspensa. Entre em contato com a FN Edificações para mais informações.",
  encerrado: "Sua parceria foi encerrada. Entre em contato com a FN Edificações caso tenha dúvidas.",
};

const VALE_STATUS_LABEL = { ativo: "Ativo", usado: "Usado", expirado: "Expirado", cancelado: "Cancelado" };
STATUS_COR["Ativo"] = { cor: "#2C75B5", bg: "#EAF2FB" };
STATUS_COR["Usado"] = { cor: "#2E7D32", bg: "#E6F4EA" };
STATUS_COR["Expirado"] = { cor: "#65758b", bg: "#EEF1F5" };
STATUS_COR["Cancelado"] = { cor: "#C62828", bg: "#FCEAEA" };

/* Comissão da venda gerada por uma proposta aceita — reaproveita os selos "Pago"/"Pendente"/
   "Cancelada" já usados no financeiro, é o mesmo conceito. */
const STATUS_COMISSAO_LABEL = { pendente: "Pendente", paga: "Pago", cancelada: "Cancelada" };

/* Converte um vale vindo do banco (snake_case) para o formato usado no app (camelCase) */
function mapValeDaApi(v) {
  return {
    id: v.id || v.codigo,
    codigo: v.codigo || "",
    clienteNome: v.cliente_nome || v.clienteNome || "",
    status: v.status || "ativo",
    criadoEm: v.criado_em || v.criadoEm || null,
    usadoEm: v.usado_em || v.usadoEm || null,
  };
}

function CardStatusParceiro({ parceiro }) {
  const info = PARCEIRO_STATUS_INFO[parceiro.status] || "";
  return (
    <Card icon={Building2} titulo="Status da parceria">
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: AZUL_MARINHO }}>{parceiro.empresa || "Sua empresa"}</div>
        <Selo valor={PARCEIRO_STATUS_LABEL[parceiro.status] || parceiro.status} />
      </div>
      {info && <div style={{ fontSize: 13.5, color: "#334", background: CINZA_CLARO, borderRadius: 8, padding: "10px 12px" }}>{info}</div>}
    </Card>
  );
}

function CardPerfilParceiro({ parceiro, token, onSalvo }) {
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const comissaoTexto = parceiro.comissao.length > 0 ? parceiro.comissao.map((c) => `${c.name}: ${c.p}%`).join(" · ") : "";
  const setF = (campo, v) => setForm((f) => ({ ...f, [campo]: v }));

  /* A proposta comercial (comissão e benefício) saiu do cadastro público e é montada aqui,
     enquanto o cadastro está em análise — é o que a gerência homologa. Depois de aprovada
     ela trava, e mudar desconto combinado vira conversa com a FN: o backend recusa a
     alteração, então nem mostramos os campos. */
  const propostaEditavel = parceiro.status === "em_analise";
  const setComissaoLinha = (idx, patch) => setForm((f) => ({ ...f, comissao: f.comissao.map((l, i) => (i === idx ? { ...l, ...patch } : l)) }));
  const addComissaoLinha = () => setForm((f) => ({ ...f, comissao: [...f.comissao, novaComissaoLinha()] }));
  const removerComissaoLinha = (idx) => setForm((f) => ({ ...f, comissao: f.comissao.filter((_, i) => i !== idx) }));

  const iniciarEdicao = () => {
    setForm({
      responsavel: parceiro.responsavel || "", whatsapp: parceiro.whatsapp || "", instagram: parceiro.instagram || "",
      site: parceiro.site || "", cidade: parceiro.cidade || "", uf: parceiro.uf || "", logo: parceiro.logo || "",
      comissao: parceiro.comissao.length > 0 ? parceiro.comissao.map((c) => ({ name: c.name || "", p: c.p ?? "" })) : [novaComissaoLinha()],
      beneficio: parceiro.beneficio || "", descricaoBeneficio: parceiro.descricaoBeneficio || "",
    });
    setErro("");
    setEditando(true);
  };

  const onLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErro("Envie uma imagem (PNG ou JPG) para a logo."); return; }
    const reader = new FileReader();
    reader.onload = () => setF("logo", reader.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const salvar = async () => {
    setErro("");
    if (!form.whatsapp.trim()) { setErro("Informe um WhatsApp para contato."); return; }
    if (!form.cidade.trim() || !form.uf.trim()) { setErro("Informe cidade e UF."); return; }
    setEnviando(true);
    try {
      const { comissao, beneficio, descricaoBeneficio, ...contato } = form;
      // Parceiro já aprovado não manda a proposta de volta: o backend recusaria a chamada
      // inteira, e ele perderia também a edição de contato que estava fazendo.
      const body = propostaEditavel
        ? { ...contato, comissao: comissao.filter((l) => l.name.trim() && l.p !== "").map((l) => ({ name: l.name.trim(), p: Number(l.p) })), beneficio, descricaoBeneficio }
        : contato;
      await apiFetch("/api/parceiros/me", { method: "PATCH", token, body });
      setEditando(false);
      await onSalvo();
    } catch (e) { setErro(e.message); }
    setEnviando(false);
  };

  if (editando && form) {
    return (
      <Card icon={User} titulo="Dados do parceiro">
        {erro && <p style={{ color: "#C62828", fontSize: 13, margin: "0 0 10px" }}>{erro}</p>}
        <Grid>
          <Field label="Responsável" value={form.responsavel} onChange={(v) => setF("responsavel", v)} />
          <Field label="WhatsApp" value={form.whatsapp} onChange={(v) => setF("whatsapp", v)} />
          <Field label="Cidade" value={form.cidade} onChange={(v) => setF("cidade", v)} />
          <Field label="UF" value={form.uf} onChange={(v) => setF("uf", v.toUpperCase().slice(0, 2))} />
          <Field label="Instagram" value={form.instagram} onChange={(v) => setF("instagram", v)} />
          <Field label="Site" value={form.site} onChange={(v) => setF("site", v)} />
        </Grid>
        <div style={{ ...cell(true), marginTop: 12 }}>
          <label style={lab}>Logo da empresa</label>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {form.logo && <img src={form.logo} alt="Logo" style={{ width: 52, height: 52, objectFit: "contain", border: `1px solid ${CINZA_BORDA}`, borderRadius: 8, background: "#fff" }} />}
            <label className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO, cursor: "pointer" }}>
              <Camera size={14} /> {form.logo ? "Trocar logo" : "Enviar logo"}
              <input type="file" accept="image/*" onChange={onLogo} style={{ display: "none" }} />
            </label>
          </div>
        </div>

        {propostaEditavel && (
          <>
            <div style={{ background: "#FFF4E0", color: "#B26A00", padding: "10px 12px", borderRadius: 8, fontSize: 12.5, margin: "18px 0 0", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Comissão e benefício travam quando a FN homologar sua parceria — revise antes de pedir a aprovação.</span>
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={lab}>Categorias e percentual de comissão</label>
              <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
                {form.comissao.map((linha, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input style={{ ...inp, flex: 1 }} placeholder="Categoria (ex.: Mão de obra)" value={linha.name}
                      onChange={(e) => setComissaoLinha(idx, { name: e.target.value })} />
                    <input style={{ ...inp, width: 90 }} type="number" min="0" max="100" placeholder="%" value={linha.p}
                      onChange={(e) => setComissaoLinha(idx, { p: e.target.value })} />
                    <button type="button" className="icon-btn" onClick={() => removerComissaoLinha(idx)} disabled={form.comissao.length === 1}>
                      <Trash2 size={15} color="#c62828" />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className="btn-add" style={{ marginTop: 10, padding: 10, fontSize: 13 }} onClick={addComissaoLinha}>
                <Plus size={15} /> Adicionar categoria de comissão
              </button>
            </div>

            <Field label="Benefício oferecido (resumo)" value={form.beneficio} onChange={(v) => setF("beneficio", v)} full />
            <Area label="Descrição do benefício" value={form.descricaoBeneficio} onChange={(v) => setF("descricaoBeneficio", v)} rows={3}
              placeholder="Explique as condições do benefício oferecido aos clientes FN" />
          </>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button type="button" className="btn-solid" onClick={salvar} disabled={enviando}>{enviando ? "Salvando…" : "Salvar alterações"}</button>
          <button type="button" className="btn-ghost" onClick={() => setEditando(false)} disabled={enviando}>Cancelar</button>
        </div>
      </Card>
    );
  }

  return (
    <Card icon={User} titulo="Dados do parceiro">
      <TabelaDados rows={[
        ["Empresa", parceiro.empresa], ["Responsável", parceiro.responsavel],
        ["Categoria", PARCEIRO_TIPO_LABEL[parceiro.tipo] || parceiro.tipo],
        ["Cidade/UF", parceiro.cidade ? `${parceiro.cidade}/${parceiro.uf}` : ""],
        ["WhatsApp", parceiro.whatsapp], ["Instagram", parceiro.instagram], ["Site", parceiro.site],
        ["Comissão combinada", comissaoTexto], ["Benefício oferecido", parceiro.beneficio],
      ]} />
      {parceiro.descricaoBeneficio && <p style={{ fontSize: 13.5, color: "#4a5a70", margin: "0 0 12px" }}>{parceiro.descricaoBeneficio}</p>}
      {propostaEditavel && (!comissaoTexto || !parceiro.beneficio) && (
        <p style={{ fontSize: 12.5, color: "#B26A00", background: "#FFF4E0", borderRadius: 8, padding: "9px 12px", margin: "0 0 12px" }}>
          Falta informar {[!comissaoTexto && "a comissão", !parceiro.beneficio && "o benefício"].filter(Boolean).join(" e ")} — é o que a FN analisa para homologar a parceria.
        </p>
      )}
      <button type="button" className="btn-ghost" onClick={iniciarEdicao}>
        <Edit3 size={14} /> {propostaEditavel ? "Completar meu perfil" : "Editar meus dados"}
      </button>
    </Card>
  );
}

/* Pedidos de orçamento dirigidos a este parceiro. O contato do cliente (telefone/e-mail) só
   vem preenchido depois que uma proposta é aceita — antes disso o backend nem manda esse
   dado (ver mapLeadParaParceiro em parceiros.js), então aqui é só exibir o que chegou. */
function CardOportunidadesParceiro({ leads, carregando, onVisualizar, onEnviarProposta }) {
  const [abertoId, setAbertoId] = useState(null);
  const [propondoLead, setPropondoLead] = useState(null);

  const abrir = (l) => {
    setAbertoId(abertoId === l.id ? null : l.id);
    if (l.status === "novo") onVisualizar(l.id);
  };

  const pendentes = leads.filter((l) => !["proposta_aceita", "perdido"].includes(l.status));

  return (
    <Card icon={ClipboardList} titulo={`Oportunidades (${pendentes.length})`}>
      {carregando && <p style={{ color: "#8593a8", fontSize: 14 }}>Carregando…</p>}
      {!carregando && leads.length === 0 && <p style={{ color: "#8593a8", fontSize: 14 }}>Nenhum pedido de orçamento ainda.</p>}
      {!carregando && leads.length > 0 && (
        <div style={{ display: "grid", gap: 8 }}>
          {leads.map((l) => {
            const propostaPendente = l.propostas.find((p) => p.status === "enviada");
            const propostaAceita = l.propostas.find((p) => p.status === "aceita");
            const aberto = abertoId === l.id;
            return (
              <div key={l.id} style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, overflow: "hidden" }}>
                <button onClick={() => abrir(l)}
                  style={{ width: "100%", background: "#fff", border: "none", cursor: "pointer", padding: 12, display: "flex", alignItems: "center", gap: 10, textAlign: "left", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 14 }}>{l.clienteNome || "Cliente FN"}</strong>
                  {l.servicoTitulo && <span style={{ fontSize: 12.5, color: "#65758b" }}>· {l.servicoTitulo}</span>}
                  <span style={{ marginLeft: "auto" }}><Selo valor={LEAD_STATUS_LABEL[l.status] || l.status} /></span>
                </button>
                {aberto && (
                  <div style={{ padding: "0 12px 12px" }}>
                    {l.mensagem && <p style={{ fontSize: 13, color: "#4a5a70", margin: "0 0 10px" }}>&ldquo;{l.mensagem}&rdquo;</p>}
                    {(l.clienteTelefone || l.clienteEmail) && (
                      <div style={{ fontSize: 12.5, color: "#65758b", marginBottom: 10 }}>
                        {l.clienteTelefone && <div>📱 {l.clienteTelefone}</div>}
                        {l.clienteEmail && <div>✉️ {l.clienteEmail}</div>}
                      </div>
                    )}
                    {!l.clienteTelefone && !l.clienteEmail && !propostaAceita && (
                      <p style={{ fontSize: 12, color: "#8593a8", margin: "0 0 10px" }}>
                        O contato do cliente libera depois que ele aceitar uma proposta.
                      </p>
                    )}
                    {propostaAceita && (
                      <div style={{ fontSize: 13.5, background: "#E6F4EA", color: "#2E7D32", borderRadius: 8, padding: "8px 10px", marginBottom: 8 }}>
                        Proposta aceita: {fmtReal(propostaAceita.valor_final)}
                      </div>
                    )}
                    {propostaPendente && (
                      <div style={{ fontSize: 13, color: "#65758b", marginBottom: 8 }}>
                        Proposta enviada: {fmtReal(propostaPendente.valor_final)} — aguardando resposta do cliente.
                      </div>
                    )}
                    {l.status !== "proposta_aceita" && l.status !== "perdido" && !propostaPendente && (
                      <button className="btn-solid" style={{ padding: "7px 16px" }} onClick={() => setPropondoLead(l)}>
                        Enviar proposta
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {propondoLead && (
        <ModalEnviarProposta lead={propondoLead} onFechar={() => setPropondoLead(null)}
          onEnviar={async (dados) => { const ok = await onEnviarProposta({ leadId: propondoLead.id, ...dados }); if (ok) setPropondoLead(null); }} />
      )}
    </Card>
  );
}

function ModalEnviarProposta({ lead, onFechar, onEnviar }) {
  const [valorNormal, setValorNormal] = useState("");
  const [descontoPercentual, setDescontoPercentual] = useState("");
  const [valorFinal, setValorFinal] = useState("");
  const [prazo, setPrazo] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    if (!valorFinal || Number(valorFinal) <= 0) { alert("Informe o valor final da proposta."); return; }
    setEnviando(true);
    await onEnviar({ valorNormal, descontoPercentual, valorFinal, prazo, formaPagamento, observacoes });
    setEnviando(false);
  };

  return (
    <div className="no-print" style={overlay} onClick={onFechar}>
      <div style={{ ...modal, maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <strong>Proposta para {lead.clienteNome || "cliente"}</strong>
          <button className="icon-btn" onClick={onFechar}><X size={16} /></button>
        </div>
        <Grid>
          <Field label="Valor normal (R$)" type="number" value={valorNormal} onChange={setValorNormal} />
          <Field label="Desconto (%)" type="number" value={descontoPercentual} onChange={setDescontoPercentual} />
          <Field label="Valor final (R$)" type="number" value={valorFinal} onChange={setValorFinal} full />
          <Field label="Prazo" value={prazo} onChange={setPrazo} placeholder="Ex.: 10 dias úteis" />
          <Field label="Forma de pagamento" value={formaPagamento} onChange={setFormaPagamento} placeholder="Ex.: 50% entrada + 50% na entrega" />
        </Grid>
        <Area label="Observações (opcional)" value={observacoes} onChange={setObservacoes} rows={2} />
        <button className="btn-solid" style={{ width: "100%", justifyContent: "center", marginTop: 14 }} onClick={enviar} disabled={enviando}>
          {enviando ? <><Loader2 size={15} className="spin" /> Enviando…</> : "Enviar proposta"}
        </button>
      </div>
    </div>
  );
}

function CardValesParceiro({ vales }) {
  return (
    <Card icon={ClipboardList} titulo={`Vales gerados (${vales.length})`}>
      {vales.length === 0 && <p style={{ color: "#8593a8", fontSize: 14 }}>Nenhum vale gerado até o momento.</p>}
      {vales.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: CINZA_CLARO }}>
                {["Código", "Cliente", "Status", "Criado em", "Usado em"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: AZUL_MARINHO, borderBottom: `2px solid ${CINZA_BORDA}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vales.map((v) => (
                <tr key={v.id} style={{ borderBottom: `1px solid ${CINZA_BORDA}` }}>
                  <td style={{ padding: "8px 10px", fontFamily: "monospace", fontWeight: 700, color: AZUL_MARINHO }}>{v.codigo}</td>
                  <td style={{ padding: "8px 10px" }}>{v.clienteNome || "—"}</td>
                  <td style={{ padding: "8px 10px" }}><Selo valor={VALE_STATUS_LABEL[v.status] || v.status} /></td>
                  <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{v.criadoEm ? new Date(v.criadoEm).toLocaleString("pt-BR") : "—"}</td>
                  <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{v.usadoEm ? new Date(v.usadoEm).toLocaleString("pt-BR") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* Vendas fechadas a partir de propostas aceitas, com a comissão que a FN calculou —
   o parceiro só acompanha aqui, quem muda o status de pagamento é a Gerência/Vendas. */
function CardVendasParceiro({ vendas, carregando }) {
  const totalComissao = vendas.reduce((s, v) => s + (Number(v.comissao_valor) || 0), 0);
  return (
    <Card icon={DollarSign} titulo={`Vendas e comissão (${vendas.length})`}>
      {carregando && <p style={{ color: "#8593a8", fontSize: 14 }}>Carregando…</p>}
      {!carregando && vendas.length === 0 && <p style={{ color: "#8593a8", fontSize: 14 }}>Nenhuma venda fechada até o momento.</p>}
      {vendas.length > 0 && (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: CINZA_CLARO }}>
                  {["Cliente", "Serviço", "Valor da venda", "Comissão", "Status"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: AZUL_MARINHO, borderBottom: `2px solid ${CINZA_BORDA}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vendas.map((v) => (
                  <tr key={v.id} style={{ borderBottom: `1px solid ${CINZA_BORDA}` }}>
                    <td style={{ padding: "8px 10px" }}>{v.cliente_nome || "—"}</td>
                    <td style={{ padding: "8px 10px" }}>{v.servico_titulo || "—"}</td>
                    <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{fmtReal(v.valor_venda)}</td>
                    <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                      {v.comissao_valor != null ? `${fmtReal(v.comissao_valor)} (${Number(v.comissao_percentual)}%)` : "—"}
                    </td>
                    <td style={{ padding: "8px 10px" }}><Selo valor={STATUS_COMISSAO_LABEL[v.status_comissao] || v.status_comissao} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12, fontSize: 13.5 }}>
            <strong style={{ color: AZUL_MARINHO }}>Comissão total gerada: </strong>{fmtReal(totalComissao)}
          </div>
        </>
      )}
    </Card>
  );
}

/* Editor do portfólio ("mini site de vendas") do parceiro — usado tanto pelo próprio
   parceiro (PainelParceiro, sem precisar informar parceiroId) quanto por Vendas/Gerência
   editando em nome dele (CardParceiros). Puramente de apresentação: quem chama decide como
   carregar/salvar/excluir (onSalvar/onExcluir), pra não duplicar a lógica de autenticação. */
function EditorCatalogoParceiro({ itens = [], carregando, onSalvar, onExcluir, linkPortfolio, notify, ehEquipe = false, onDecidirComissao = null }) {
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const onFoto = (e, cb) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { notify("Envie uma imagem (PNG ou JPG)"); return; }
    const reader = new FileReader();
    reader.onload = () => cb(reader.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const salvar = async () => {
    if (!editando.titulo?.trim() && !editando.descricao?.trim() && !editando.foto) {
      notify("Informe ao menos título, foto ou descrição."); return;
    }
    setSalvando(true);
    const ok = await onSalvar(editando);
    setSalvando(false);
    if (ok) setEditando(null);
  };

  const copiarLink = () => {
    navigator.clipboard?.writeText(linkPortfolio);
    notify("Link copiado ✓");
  };

  const descontoItem = editando ? calcularDesconto(editando.preco_de, editando.preco) : null;
  /* "Já acertada" é o item que existe e tem comissão vigente — item novo, ou item sem
     comissão nenhuma, o parceiro ainda define sozinho. */
  const comissaoVigente = editando?._comissaoVigente ?? null;
  const comissaoJaAcertada = temComissao(comissaoVigente);

  return (
    <Card icon={Camera} titulo={`Portfólio (${itens.length} ${itens.length === 1 ? "item" : "itens"})`}>
      <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 12px" }}>
        Fotos e descrições dos serviços/produtos que aparecem na página pública do parceiro — o "catálogo de vendas" que atrai o cliente.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap", background: CINZA_CLARO, borderRadius: 8, padding: "8px 10px" }}>
        <span style={{ fontSize: 12, color: "#4a5a70", flex: 1, minWidth: 180, wordBreak: "break-all" }}>
          Link público: <a href={linkPortfolio} target="_blank" rel="noreferrer" style={{ color: AZUL_MEDIO }}>{linkPortfolio}</a>
        </span>
        <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: "#fff" }} onClick={copiarLink}><Copy size={13} /> Copiar link</button>
      </div>

      {carregando && <p style={{ color: "#8593a8", fontSize: 14 }}>Carregando…</p>}
      {!carregando && itens.length === 0 && <p style={{ color: "#8593a8", fontSize: 14 }}>Nenhum item no portfólio ainda.</p>}

      {itens.length > 0 && (
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", marginBottom: 14 }}>
          {itens.map((s) => (
            <div key={s.id} style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, overflow: "hidden" }}>
              {/* Mesma regra da página pública: a foto aparece inteira, para o parceiro
                  conferir aqui exatamente o que o cliente vai ver. */}
              {s.foto && <img src={s.foto} alt="" style={{ width: "100%", height: 150, objectFit: "contain", display: "block", background: CINZA_CLARO }} />}
              <div style={{ padding: 10 }}>
                {s.categoria && <div style={{ fontSize: 10.5, fontWeight: 700, color: AZUL_MEDIO, textTransform: "uppercase" }}>{s.categoria}</div>}
                {s.titulo && <div style={{ fontWeight: 700, fontSize: 13 }}>{s.titulo}</div>}
                {s.preco_de && <div style={{ fontSize: 11, color: "#8593a8", textDecoration: "line-through" }}>{s.preco_de}</div>}
                {s.preco && <div style={{ fontSize: 12, color: "#2E7D32", fontWeight: 700 }}>{s.preco}</div>}
                {/* Os dois percentuais do item, lado a lado: o que o cliente ganha e o que a
                    FN recebe. O segundo só existe aqui e no acompanhamento da equipe. */}
                <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap", fontSize: 11, fontWeight: 700 }}>
                  {calcularDesconto(s.preco_de, s.preco) && (
                    <span style={{ background: "#FDECEA", color: "#C62828", padding: "2px 7px", borderRadius: 6 }}>
                      -{calcularDesconto(s.preco_de, s.preco)}% cliente
                    </span>
                  )}
                  {temComissao(s.comissao_percentual) && (
                    <span style={{ background: "#EAF2FB", color: AZUL_MEDIO, padding: "2px 7px", borderRadius: 6 }}>
                      {Number(s.comissao_percentual)}% FN
                    </span>
                  )}
                  {temComissao(s.comissao_percentual_pendente) && (
                    <span style={{ background: "#FFF4E0", color: "#B26A00", padding: "2px 7px", borderRadius: 6 }}>
                      {Number(s.comissao_percentual_pendente)}% aguardando aprovação
                    </span>
                  )}
                </div>

                {/* A decisão fica onde o número aparece: a Gerência abre o portfólio, vê o
                    valor proposto ao lado do vigente e resolve ali, sem outra tela. */}
                {onDecidirComissao && temComissao(s.comissao_percentual_pendente) && (
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    <button className="btn-solid" style={{ padding: "5px 10px", fontSize: 11.5 }}
                      onClick={() => onDecidirComissao(s.id, "aprovar")}>
                      <Check size={12} /> Aprovar {Number(s.comissao_percentual_pendente)}%
                    </button>
                    <button className="btn-ghost" style={{ padding: "5px 10px", fontSize: 11.5, color: "#c62828", background: "#FCEAEA" }}
                      onClick={() => onDecidirComissao(s.id, "recusar")}>
                      Recusar
                    </button>
                  </div>
                )}
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <button className="icon-btn" onClick={() => setEditando({ ...s, _comissaoVigente: s.comissao_percentual ?? null })} title="Editar"><Edit3 size={13} color={AZUL_MEDIO} /></button>
                  <button className="icon-btn" onClick={() => onExcluir(s.id)} title="Excluir"><Trash2 size={13} color="#c62828" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="btn-add" style={{ padding: 10, fontSize: 13 }} onClick={() => setEditando({})}>
        <Plus size={15} /> Adicionar item ao portfólio
      </button>

      {editando && (
        <div className="no-print" style={overlay} onClick={() => setEditando(null)}>
          <div style={{ ...modal, maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <strong>{editando.id ? "Editar item" : "Novo item do portfólio"}</strong>
              <button className="icon-btn" onClick={() => setEditando(null)}><X size={16} /></button>
            </div>
            <div style={{ ...cell(true), marginBottom: 10 }}>
              <label style={lab}>Foto</label>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {editando.foto && <img src={editando.foto} alt="" style={{ width: 52, height: 52, objectFit: "contain", borderRadius: 8, border: `1px solid ${CINZA_BORDA}`, background: CINZA_CLARO }} />}
                <label className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO, cursor: "pointer" }}>
                  <Camera size={14} /> {editando.foto ? "Trocar foto" : "Enviar foto"}
                  <input type="file" accept="image/*" onChange={(e) => onFoto(e, (v) => setEditando((ed) => ({ ...ed, foto: v })))} style={{ display: "none" }} />
                </label>
              </div>
            </div>
            <div style={{ ...cell(true), marginBottom: 10 }}>
              <label style={lab}>Título</label>
              <input style={inp} value={editando.titulo || ""} onChange={(e) => setEditando((ed) => ({ ...ed, titulo: e.target.value }))} placeholder="Ex.: Instalação de vidro temperado" />
            </div>
            <Grid>
              <Field label="Categoria" value={editando.categoria || ""} onChange={(v) => setEditando((ed) => ({ ...ed, categoria: v }))} />
              <Field label="De (opcional)" value={editando.preco_de || ""} onChange={(v) => setEditando((ed) => ({ ...ed, preco_de: v }))} placeholder="R$ 450,00" />
              <Field label="Por / condições" value={editando.preco || ""} onChange={(v) => setEditando((ed) => ({ ...ed, preco: v }))} placeholder="R$ 380,00" />
            </Grid>

            {/* O desconto não é digitado: sai do "de" e do "por" que ele acabou de informar,
                pela mesma conta que o cliente vê na vitrine. Mostrado aqui para o parceiro
                conferir o percentual antes de salvar, em vez de descobrir depois. */}
            <div style={{ background: descontoItem ? "#FDECEA" : CINZA_CLARO, color: descontoItem ? "#C62828" : "#8593a8", borderRadius: 8, padding: "9px 12px", fontSize: 12.5, marginTop: 10 }}>
              {descontoItem
                ? <>Desconto para o cliente: <strong>{descontoItem}%</strong> — é esse selo que aparece na vitrine.</>
                : "Preencha \"De\" e \"Por\" para o desconto em porcentagem aparecer na vitrine."}
            </div>

            {/* "Preço" acima é texto livre (às vezes é "a combinar"); este aqui é o número de
                verdade que habilita o botão "Comprar" no carrinho — sem ele o item continua
                só como vitrine/orçamento, igual sempre foi. */}
            <div style={{ ...cell(true), marginTop: 10 }}>
              <label style={lab}>Preço de venda online (opcional)</label>
              <input style={{ ...inp, maxWidth: 160 }} type="number" min="0" step="0.01" placeholder="Ex.: 380,00"
                value={editando.preco_venda ?? ""}
                onChange={(e) => setEditando((ed) => ({ ...ed, preco_venda: e.target.value }))} />
              <p style={{ fontSize: 12, color: "#8593a8", margin: "6px 0 0" }}>
                Preenchido, o cliente pode comprar este item direto pelo carrinho (PIX/cartão, via Mercado Pago). Em branco, o item continua só sob consulta/orçamento.
              </p>
            </div>

            {/* Comissão do item, e não da parceria: o percentual do cadastro vale por
                categoria, mas a negociação costuma acontecer serviço a serviço. Fica só
                entre o parceiro e a FN — a rota pública não devolve este campo. */}
            <div style={{ ...cell(true), marginTop: 10 }}>
              <label style={lab}>Comissão para a FN neste item (%)</label>
              <input style={{ ...inp, maxWidth: 140 }} type="number" min="0" max="100" placeholder="Ex.: 12"
                value={editando.comissao_percentual ?? ""}
                onChange={(e) => setEditando((ed) => ({ ...ed, comissao_percentual: e.target.value }))} />
              <p style={{ fontSize: 12, color: "#8593a8", margin: "6px 0 0" }}>
                Percentual que você repassa à FN quando este item é vendido. O cliente não vê.
                Em branco, vale a comissão da categoria combinada no seu cadastro.
              </p>
              {/* Comissão acertada é acordo, não configuração: o parceiro propõe o valor novo,
                  a FN aprova, e até lá o vigente continua valendo. Sem este aviso ele salvaria
                  achando que já mudou. */}
              {!ehEquipe && comissaoJaAcertada && (
                <p style={{ fontSize: 12, color: "#B26A00", background: "#FFF4E0", borderRadius: 8, padding: "9px 12px", margin: "8px 0 0" }}>
                  A comissão deste item já foi acertada em <strong>{Number(comissaoVigente)}%</strong>. Alterar aqui
                  envia o novo valor para aprovação da FN — até a resposta, vale o percentual atual.
                </p>
              )}
              {temComissao(editando.comissao_percentual_pendente) && (
                <p style={{ fontSize: 12, color: "#B26A00", margin: "8px 0 0" }}>
                  Já existe uma alteração para <strong>{Number(editando.comissao_percentual_pendente)}%</strong> aguardando
                  {ehEquipe ? " sua aprovação." : " aprovação da FN."}
                </p>
              )}
            </div>

            <Area label="Descrição" value={editando.descricao || ""} onChange={(v) => setEditando((ed) => ({ ...ed, descricao: v }))} rows={3} placeholder="O que torna esse serviço/produto atrativo pro cliente" />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO }} onClick={() => setEditando(null)}>Cancelar</button>
              <button className="btn-solid" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar item"}</button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ================= Portal do cliente (área logada, papel "cliente") =================
   Reaproveita ao máximo o que já existia na consulta pública: CartaoAtendimentoCliente
   (laudo/documentação/avaliação) e a vitrine de parceiros — só troca "CPF digitado" por
   "CPF do próprio login". */
function PainelCliente({ session, onLogout, onSessaoAtualizada }) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [cliente, setCliente] = useState(null);
  const [resultados, setResultados] = useState([]);
  const [toast, setToast] = useState("");
  const notify = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };

  /* Cliente já cadastrado ganhou a senha padrão "12345678", provisória — o portal trava numa
     troca obrigatória antes de mostrar qualquer coisa. A senha atual já é sabida (é a
     padrão), então só pede a nova, sem repetir a "12345678" pro cliente digitar. */
  const trocarSenhaObrigatoria = async (senhaNova) => {
    try {
      await apiFetch("/api/auth/trocar-senha", { method: "POST", token: session.token, body: { senhaAtual: "12345678", senhaNova } });
      onSessaoAtualizada({ ...session, usuario: { ...session.usuario, senhaProvisoria: false } });
      return true;
    } catch (e) { notify(e.message); return false; }
  };

  const carregar = async () => {
    setCarregando(true); setErro("");
    try {
      const r = await apiFetch("/api/clientes/me", { token: session.token });
      setCliente(r.cliente || null);
      setResultados(r.resultados || []);
    } catch (e) { setErro(e.message); }
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, []);

  /* Pedidos de orçamento e as propostas recebidas — funil comercial de parceiros, separado
     do cupom/desconto instantâneo (que continua na vitrine). */
  const [leads, setLeads] = useState([]);
  const [leadsCarregando, setLeadsCarregando] = useState(true);
  const carregarLeads = async () => {
    setLeadsCarregando(true);
    try {
      const r = await apiFetch("/api/leads/meus", { token: session.token });
      setLeads(r.leads || []);
    } catch { /* mostra vazio; o card de erro geral já cobre falha de sessão */ }
    setLeadsCarregando(false);
  };
  useEffect(() => { carregarLeads(); }, []);
  const responderProposta = async (propostaId, decisao) => {
    try {
      await apiFetch(`/api/propostas/${propostaId}/responder`, { method: "POST", token: session.token, body: { decisao } });
      notify(decisao === "aceita" ? "Proposta aceita ✓" : "Resposta registrada ✓");
      await carregarLeads();
    } catch (e) { notify(`Não foi possível responder: ${e.message}`); }
  };
  const desistirLead = async (leadId) => {
    try {
      await apiFetch(`/api/leads/${leadId}/desistir`, { method: "PATCH", token: session.token });
      notify("Pedido encerrado");
      await carregarLeads();
    } catch (e) { notify(`Não foi possível encerrar: ${e.message}`); }
  };

  /* Compras do carrinho (marketplace): pedidos pagos via Mercado Pago. Quem volta do
     pagamento chega com ?pedido=<id> na URL — o pagamento aprovado costuma levar alguns
     segundos até o webhook do Mercado Pago confirmar aqui, então essa lista é recarregada
     algumas vezes sozinha logo depois de um retorno de pagamento. */
  const [pedidos, setPedidos] = useState([]);
  const [pedidosCarregando, setPedidosCarregando] = useState(true);
  const pedidoRetorno = new URLSearchParams(window.location.search).get("pedido");
  const carregarPedidos = async () => {
    setPedidosCarregando(true);
    try {
      const r = await apiFetch("/api/pedidos/meus", { token: session.token });
      setPedidos(r.pedidos || []);
    } catch { /* mostra vazio; o card de erro geral já cobre falha de sessão */ }
    setPedidosCarregando(false);
  };
  useEffect(() => { carregarPedidos(); }, []);
  useEffect(() => {
    if (!pedidoRetorno) return;
    // Confere de novo em 3s e 8s — tempo típico do webhook confirmar o pagamento aprovado.
    const t1 = setTimeout(carregarPedidos, 3000);
    const t2 = setTimeout(carregarPedidos, 8000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoRetorno]);

  /* Cross-sell: quem já é cliente (fez vistoria, por ex.) pede Documentação ART/TRT sem
     preencher o cadastro de novo — os dados vêm do cadastro já existente. */
  const [solicitandoDoc, setSolicitandoDoc] = useState(false);
  const jaTemDocumentacao = resultados.some((r) => r.servico === SERVICO_DOCUMENTACAO);
  const solicitarDocumentacao = async () => {
    setSolicitandoDoc(true);
    try {
      await apiFetch("/api/clientes/nova-solicitacao", { method: "POST", token: session.token });
      notify("Solicitação enviada ✓ Nossa equipe já foi avisada.");
      await carregar();
    } catch (e) { notify(`Não foi possível solicitar: ${e.message}`); }
    setSolicitandoDoc(false);
  };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: "#1a2330", background: CINZA_CLARO, minHeight: "100vh" }}>
      <style>{estilos}</style>

      <header className="no-print" style={{ background: AZUL_MARINHO, color: "#fff", position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "12px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: "clamp(36px, 9vw, 44px)", height: "clamp(36px, 9vw, 44px)", borderRadius: 9, background: "#fff", display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0 }}>
              <img src={LOGO_URL} alt="FN Edificações" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
            <div style={{ lineHeight: 1.1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>FN Edificações</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>Área do Cliente</div>
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
            <div style={{ textAlign: "right", lineHeight: 1.2 }}>
              <div style={{ fontWeight: 700 }}>{session.usuario.nome}</div>
              <div style={{ opacity: 0.7 }}>{cliente?.cpfMascarado || ""}</div>
            </div>
            <button className="btn-ghost" onClick={onLogout} title="Sair"><X size={14} /> Sair</button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "22px 18px 80px", display: "grid", gap: 16 }}>
        {erro && (
          <div style={{ background: "#FCEAEA", color: "#C62828", padding: "12px 14px", borderRadius: 10, fontSize: 13.5 }}>{erro}</div>
        )}

        <Card icon={ClipboardCheck} titulo="Meu atendimento">
          {carregando && <p style={{ color: "#8593a8", fontSize: 14 }}>Carregando…</p>}
          {!carregando && resultados.length === 0 && (
            <p style={{ color: "#8593a8", fontSize: 14 }}>
              Nenhum atendimento encontrado ainda. Assim que sua vistoria ou documentação for agendada pela nossa equipe, ela aparece aqui.
            </p>
          )}
          {resultados.length > 0 && (
            <div style={{ display: "grid", gap: 10 }}>
              {resultados.map((d) => {
                const statusInfo = STATUS_ATENDIMENTO_INFO[d.status] || null;
                return (
                  <div key={d.id} style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
                      <strong style={{ fontSize: 14 }}>{d.servico || "Atendimento"}</strong>
                      {d.status && <Selo valor={d.status} />}
                    </div>
                    {(d.empreendimento || d.blocoTorre) && (
                      <div style={{ fontSize: 12.5, color: "#65758b", marginBottom: 8 }}>
                        {d.empreendimento}{d.blocoTorre ? ` · ${d.blocoTorre}` : ""}
                      </div>
                    )}
                    {statusInfo && (
                      <div style={{ fontSize: 13.5, color: "#334", background: CINZA_CLARO, borderRadius: 8, padding: "8px 10px", marginBottom: 8 }}>
                        {statusInfo}
                      </div>
                    )}
                    {d.atualizadoEm && (
                      <div style={{ fontSize: 11.5, color: "#8593a8" }}>
                        Atualizado em {new Date(d.atualizadoEm).toLocaleString("pt-BR")}
                      </div>
                    )}
                    <CartaoAtendimentoCliente doc={d} cpf={cliente?.cpf || ""} notify={notify} emailConhecido={cliente?.email || ""} />
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {!leadsCarregando && leads.length > 0 && (
          <Card icon={FileText} titulo="Meus orçamentos">
            <div style={{ display: "grid", gap: 10 }}>
              {leads.map((l) => {
                const propostaPendente = l.propostas.find((p) => p.status === "enviada");
                const propostaAceita = l.propostas.find((p) => p.status === "aceita");
                return (
                  <div key={l.id} style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                      <strong style={{ fontSize: 14 }}>{l.parceiro.empresa}</strong>
                      <Selo valor={LEAD_STATUS_LABEL[l.status] || l.status} />
                    </div>
                    {l.servicoTitulo && <div style={{ fontSize: 12.5, color: "#65758b", marginBottom: 6 }}>{l.servicoTitulo}</div>}

                    {propostaAceita && (
                      <div style={{ fontSize: 13.5, background: "#E6F4EA", color: "#2E7D32", borderRadius: 8, padding: "8px 10px", marginTop: 6 }}>
                        Proposta aceita: {fmtReal(propostaAceita.valor_final)}
                        {propostaAceita.prazo ? ` · prazo: ${propostaAceita.prazo}` : ""}
                      </div>
                    )}

                    {propostaPendente && (
                      <div style={{ background: CINZA_CLARO, borderRadius: 8, padding: 10, marginTop: 6 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: AZUL_MARINHO }}>{fmtReal(propostaPendente.valor_final)}</div>
                        {propostaPendente.prazo && <div style={{ fontSize: 12, color: "#65758b" }}>Prazo: {propostaPendente.prazo}</div>}
                        {propostaPendente.forma_pagamento && <div style={{ fontSize: 12, color: "#65758b" }}>Pagamento: {propostaPendente.forma_pagamento}</div>}
                        {propostaPendente.observacoes && <p style={{ fontSize: 12.5, color: "#4a5a70", margin: "6px 0 0" }}>{propostaPendente.observacoes}</p>}
                        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                          <button className="btn-solid" style={{ padding: "6px 14px" }} onClick={() => responderProposta(propostaPendente.id, "aceita")}>
                            <Check size={14} /> Aceitar
                          </button>
                          <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: "#fff", padding: "6px 14px" }}
                            onClick={() => responderProposta(propostaPendente.id, "ajuste_solicitado")}>
                            Pedir ajuste
                          </button>
                          <button className="btn-ghost" style={{ color: "#c62828", padding: "6px 14px" }}
                            onClick={() => responderProposta(propostaPendente.id, "recusada")}>
                            Recusar
                          </button>
                        </div>
                      </div>
                    )}

                    {l.status === "novo" && (
                      <button className="btn-ghost" style={{ color: "#c62828", marginTop: 8, padding: "4px 10px", fontSize: 12.5 }}
                        onClick={() => desistirLead(l.id)}>
                        Não tenho mais interesse
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {!pedidosCarregando && pedidos.length > 0 && (
          <Card icon={ShoppingCart} titulo="Meus pedidos">
            {pedidoRetorno && (
              <div style={{ background: "#EAF2FB", border: `1px solid ${AZUL_MEDIO}`, borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 12.5, color: AZUL_MARINHO, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span>Voltando do pagamento — a confirmação pode levar alguns segundos.</span>
                <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: "#fff", padding: "4px 10px", fontSize: 12 }} onClick={carregarPedidos}>
                  <RefreshCcw size={12} /> Atualizar
                </button>
              </div>
            )}
            <div style={{ display: "grid", gap: 10 }}>
              {pedidos.map((p) => (
                <div key={p.id} style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                    <strong style={{ fontSize: 14 }}>{fmtReal(p.valor_total)}</strong>
                    <Selo valor={PEDIDO_STATUS_LABEL[p.status] || p.status} />
                  </div>
                  <div style={{ fontSize: 12, color: "#8593a8", marginBottom: 6 }}>
                    {new Date(p.criado_em).toLocaleString("pt-BR")}
                  </div>
                  <div style={{ display: "grid", gap: 4 }}>
                    {(p.itens || []).map((i) => (
                      <div key={i.id} style={{ fontSize: 12.5, color: "#4a5a70" }}>
                        {i.quantidade}x {i.titulo} — {fmtReal(i.preco_unitario * i.quantidade)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {!carregando && resultados.length > 0 && !jaTemDocumentacao && (
          <Card icon={FileText} titulo="Precisa de mais um serviço?">
            <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 14px" }}>
              Peça a Documentação ART/TRT do seu imóvel sem preencher o cadastro de novo —
              usamos os mesmos dados que você já enviou.
            </p>
            <button className="btn-solid" onClick={solicitarDocumentacao} disabled={solicitandoDoc}>
              {solicitandoDoc ? <Loader2 size={15} className="spin" /> : <Plus size={15} />} Solicitar Documentação ART/TRT
            </button>
          </Card>
        )}

        <SecaoParceirosVitrine notify={notify} clienteLogado={cliente} token={session.token} />
      </main>

      {toast && (
        <div className="no-print" style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: AZUL_MARINHO, color: "#fff", padding: "10px 18px", borderRadius: 10, fontSize: 13.5, boxShadow: "0 6px 20px rgba(0,0,0,.2)" }}>
          {toast}
        </div>
      )}

      {session.usuario.senhaProvisoria && (
        <ModalTrocarSenhaObrigatoria onTrocar={trocarSenhaObrigatoria} />
      )}
    </div>
  );
}

/* Bloqueia o portal até quem entrou com a senha padrão ("123456", do Primeiro acesso) trocar
   por uma senha só dele — sem botão de fechar/cancelar, de propósito. A senha atual já é
   sabida (a própria "123456"), então só pede a nova. */
function ModalTrocarSenhaObrigatoria({ onTrocar }) {
  const [senhaNova, setSenhaNova] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    setErro("");
    if (senhaNova.length < 8) { setErro("A nova senha precisa ter pelo menos 8 caracteres."); return; }
    if (senhaNova === "123456") { setErro("Escolha uma senha diferente da temporária."); return; }
    if (senhaNova !== confirmacao) { setErro("As senhas não conferem."); return; }
    setSalvando(true);
    const ok = await onTrocar(senhaNova);
    setSalvando(false);
    if (!ok) setErro("Não foi possível trocar a senha. Tente novamente.");
  };

  return (
    <div className="no-print" style={{ ...overlay, zIndex: 300 }}>
      <div style={{ ...modal, maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: "0 0 6px", color: AZUL_MARINHO, fontSize: 17 }}>Crie sua senha</h3>
        <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 18px" }}>
          Você entrou com a senha temporária. Escolha uma senha só sua para continuar.
        </p>
        <div style={cell(true)}>
          <label style={lab}>Nova senha</label>
          <input style={inp} type="password" value={senhaNova} onChange={(e) => setSenhaNova(e.target.value)} placeholder="mínimo 8 caracteres" autoFocus />
        </div>
        <div style={{ ...cell(true), marginTop: 12 }}>
          <label style={lab}>Repita a senha</label>
          <input style={inp} type="password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && salvar()} />
        </div>
        {erro && <div style={{ marginTop: 12, background: "#FCEAEA", color: "#C62828", padding: "9px 12px", borderRadius: 8, fontSize: 12.5 }}>{erro}</div>}
        <button className="btn-solid" style={{ width: "100%", justifyContent: "center", marginTop: 18, padding: "11px" }} disabled={salvando} onClick={salvar}>
          {salvando ? <><Loader2 size={15} className="spin" /> Salvando…</> : "Salvar e continuar"}
        </button>
      </div>
    </div>
  );
}

function PainelParceiro({ session, onLogout }) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [parceiro, setParceiro] = useState(null);
  const [vales, setVales] = useState([]);
  const [itensCatalogo, setItensCatalogo] = useState([]);
  const [itensCarregando, setItensCarregando] = useState(true);

  const carregar = async () => {
    setCarregando(true); setErro("");
    try {
      const r = await apiFetch("/api/parceiros/me", { token: session.token });
      setParceiro(r.parceiro ? mapParceiroDaApi(r.parceiro) : null);
      setVales((r.vales || []).map(mapValeDaApi).sort((a, b) => new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0)));
    } catch (e) { setErro(e.message); }
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, []);

  const carregarCatalogo = async () => {
    setItensCarregando(true);
    try {
      const r = await apiFetch("/api/parceiros/servicos", { token: session.token });
      setItensCatalogo(r.servicos || []);
    } catch { /* mostra vazio; o card de erro geral já cobre falha de sessão */ }
    setItensCarregando(false);
  };
  useEffect(() => { carregarCatalogo(); }, []);

  const salvarItemCatalogo = async (item) => {
    try {
      const body = { titulo: item.titulo || "", categoria: item.categoria || "", preco: item.preco || "", preco_de: item.preco_de || "", descricao: item.descricao || "", foto: item.foto || "" };
      if (item.comissao_percentual !== undefined) body.comissao_percentual = item.comissao_percentual;
      if (item.preco_venda !== undefined) body.preco_venda = item.preco_venda;
      if (item.id) await apiFetch(`/api/parceiros/servicos/${item.id}`, { method: "PATCH", token: session.token, body });
      else await apiFetch("/api/parceiros/servicos", { method: "POST", token: session.token, body });
      await carregarCatalogo();
      return true;
    } catch (e) { alert(`Não foi possível salvar: ${e.message}`); return false; }
  };
  const excluirItemCatalogo = async (id) => {
    try { await apiFetch(`/api/parceiros/servicos/${id}`, { method: "DELETE", token: session.token }); await carregarCatalogo(); }
    catch (e) { alert(`Não foi possível excluir: ${e.message}`); }
  };

  /* Oportunidades (leads): pedidos de orçamento dirigidos a este parceiro. */
  const [leads, setLeads] = useState([]);
  const [leadsCarregando, setLeadsCarregando] = useState(true);
  const carregarLeads = async () => {
    setLeadsCarregando(true);
    try {
      const r = await apiFetch("/api/parceiros/me/leads", { token: session.token });
      setLeads(r.leads || []);
    } catch { /* mostra vazio; o card de erro geral já cobre falha de sessão */ }
    setLeadsCarregando(false);
  };
  useEffect(() => { carregarLeads(); }, []);
  const visualizarLead = async (id) => {
    try { await apiFetch(`/api/leads/${id}/visualizar`, { method: "PATCH", token: session.token }); carregarLeads(); } catch {}
  };
  const enviarProposta = async (proposta) => {
    try {
      await apiFetch("/api/propostas", { method: "POST", token: session.token, body: proposta });
      await carregarLeads();
      return true;
    } catch (e) { alert(`Não foi possível enviar a proposta: ${e.message}`); return false; }
  };

  /* Vendas: nascem sozinhas quando o cliente aceita uma proposta (ver enviarProposta acima
     e o fluxo do cliente) — aqui é só leitura, com a comissão já calculada pela FN. */
  const [vendas, setVendas] = useState([]);
  const [vendasCarregando, setVendasCarregando] = useState(true);
  const carregarVendas = async () => {
    setVendasCarregando(true);
    try {
      const r = await apiFetch("/api/parceiros/me/vendas", { token: session.token });
      setVendas(r.vendas || []);
    } catch { /* mostra vazio; o card de erro geral já cobre falha de sessão */ }
    setVendasCarregando(false);
  };
  useEffect(() => { carregarVendas(); }, []);

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: "#1a2330", background: CINZA_CLARO, minHeight: "100vh" }}>
      <style>{estilos}</style>

      <header className="no-print" style={{ background: AZUL_MARINHO, color: "#fff", position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "12px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: "clamp(36px, 9vw, 44px)", height: "clamp(36px, 9vw, 44px)", borderRadius: 9, background: "#fff", display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0 }}>
              <img src={LOGO_URL} alt="FN Edificações" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
            <div style={{ lineHeight: 1.1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>FN Edificações</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>Painel do Parceiro</div>
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
            <div style={{ textAlign: "right", lineHeight: 1.2 }}>
              <div style={{ fontWeight: 700 }}>{session.usuario.nome || session.usuario.email}</div>
              <div style={{ opacity: 0.7 }}>Parceiro FN</div>
            </div>
            <button className="btn-ghost" onClick={onLogout} title="Sair"><X size={14} /> Sair</button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "22px 18px 80px", display: "grid", gap: 16 }}>
        {carregando && <p style={{ color: "#8593a8", fontSize: 14 }}>Carregando…</p>}

        {!carregando && erro && (
          <Card icon={AlertTriangle} titulo="Não foi possível carregar seus dados">
            <p style={{ color: "#C62828", fontSize: 14, margin: "0 0 10px" }}>{erro}</p>
            <button className="btn-solid" onClick={carregar}><RefreshCcw size={15} /> Tentar novamente</button>
          </Card>
        )}

        {!carregando && !erro && parceiro && (
          <>
            <CardStatusParceiro parceiro={parceiro} />
            <CardOportunidadesParceiro leads={leads} carregando={leadsCarregando}
              onVisualizar={visualizarLead} onEnviarProposta={enviarProposta} />
            <CardVendasParceiro vendas={vendas} carregando={vendasCarregando} />
            <CardPerfilParceiro parceiro={parceiro} token={session.token} onSalvo={carregar} />
            <EditorCatalogoParceiro itens={itensCatalogo} carregando={itensCarregando}
              onSalvar={salvarItemCatalogo} onExcluir={excluirItemCatalogo}
              linkPortfolio={`${window.location.origin}${window.location.pathname}?portfolio=${parceiro.id}`}
              notify={(msg) => alert(msg)} />
            <CardValesParceiro vales={vales} />
          </>
        )}
      </main>
    </div>
  );
}

/* ---- Perfil de venda do parceiro, editado pela equipe ----
   O parceiro edita o dele pelo login de afiliado; aqui a Gerência/Atendimento edita o de
   qualquer um. Existe porque na prática o parceiro manda a logo e o texto pelo WhatsApp e
   pede pra equipe montar — e antes disso a equipe só conseguia aprovar/suspender, sem
   conseguir arrumar uma logo torta ou um WhatsApp errado.

   Benefício e descrição ficam aqui, e não no editor do afiliado, porque são o que a FN
   negociou com o parceiro: quem promete o desconto é a FN, não o parceiro sozinho. */
function ModalPerfilParceiroAdmin({ parceiro, onFechar, atualizarParceiro, notify }) {
  const [form, setForm] = useState({
    empresa: parceiro.empresa || "",
    responsavel: parceiro.responsavel || "",
    whatsapp: parceiro.whatsapp || "",
    cidade: parceiro.cidade || "",
    uf: parceiro.uf || "",
    instagram: parceiro.instagram || "",
    site: parceiro.site || "",
    logo: parceiro.logo || "",
    beneficio: parceiro.beneficio || "",
    descricao_beneficio: parceiro.descricaoBeneficio ?? parceiro.descricao_beneficio ?? "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErro("Envie uma imagem (PNG ou JPG) para a logo."); return; }
    const reader = new FileReader();
    reader.onload = () => set("logo", reader.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const salvar = async () => {
    if (!form.empresa.trim()) { setErro("A empresa não pode ficar sem nome."); return; }
    setErro(""); setSalvando(true);
    /* atualizarParceiro devolve false e já avisa o usuário quando falha — não lança. Fechar
       o modal aqui faria a edição parecer salva justamente quando não foi. */
    const ok = await atualizarParceiro(parceiro.id, form);
    setSalvando(false);
    if (!ok) { setErro("Não foi possível salvar. Confira sua conexão e tente de novo."); return; }
    notify("Perfil do parceiro atualizado ✓");
    onFechar();
  };

  return (
    <div className="no-print" style={overlay} onClick={onFechar}>
      <div style={{ ...modal, maxWidth: 520, maxHeight: "88vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <strong>Perfil de venda — {parceiro.empresa}</strong>
          <button className="icon-btn" onClick={onFechar}><X size={16} /></button>
        </div>
        <p style={{ fontSize: 12.5, color: "#65758b", margin: "0 0 14px" }}>
          É o que o cliente vê na página pública deste parceiro.
        </p>

        <div style={{ ...cell(true), marginBottom: 12 }}>
          <label style={lab}>Logo</label>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 56, height: 56, borderRadius: 10, background: CINZA_CLARO, display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0 }}>
              {form.logo ? <img src={form.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                : <Building2 size={22} color={AZUL_MEDIO} />}
            </div>
            <label className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO, cursor: "pointer" }}>
              <Camera size={14} /> {form.logo ? "Trocar logo" : "Enviar logo"}
              <input type="file" accept="image/*" onChange={onLogo} style={{ display: "none" }} />
            </label>
          </div>
        </div>

        <Grid>
          <Field label="Empresa" value={form.empresa} onChange={(v) => set("empresa", v)} />
          <Field label="Responsável" value={form.responsavel} onChange={(v) => set("responsavel", v)} />
          <Field label="WhatsApp" value={form.whatsapp} onChange={(v) => set("whatsapp", v)} />
          <Field label="Cidade" value={form.cidade} onChange={(v) => set("cidade", v)} />
          <Field label="UF" value={form.uf} onChange={(v) => set("uf", v.toUpperCase().slice(0, 2))} />
          <Field label="Instagram" value={form.instagram} onChange={(v) => set("instagram", v)} />
          <Field label="Site" value={form.site} onChange={(v) => set("site", v)} />
        </Grid>

        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${CINZA_BORDA}` }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: AZUL_MARINHO, textTransform: "uppercase", letterSpacing: .3, marginBottom: 8 }}>
            Benefício para clientes FN
          </div>
          <Field label="Benefício" value={form.beneficio} onChange={(v) => set("beneficio", v)} placeholder="Ex.: 10% de desconto" />
          <Area label="Como funciona" value={form.descricao_beneficio} onChange={(v) => set("descricao_beneficio", v)} rows={3}
            placeholder="Regras: primeira compra, não acumulável, prazo…" />
          {/* O texto do benefício é copiado para dentro do cupom na hora em que ele é gerado.
              Mudar aqui vale para os próximos, não para quem já tem o código na mão. */}
          <p style={{ fontSize: 11.5, color: "#8593a8", margin: "6px 0 0" }}>
            Cupons já gerados mantêm o benefício que foi prometido na época.
          </p>
        </div>

        {erro && <div style={{ marginTop: 12, background: "#FCEAEA", color: "#C62828", padding: "9px 12px", borderRadius: 8, fontSize: 12.5 }}>{erro}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO }} onClick={onFechar}>Cancelar</button>
          <button className="btn-solid" onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Salvar perfil
          </button>
        </div>
      </div>
    </div>
  );
}

/* Wrapper do EditorCatalogoParceiro pra uso da Gerência/Vendas: carrega o catálogo público
   de um parceiro específico e liga onSalvar/onExcluir nas versões "admin" (que informam
   parceiroId, diferente do fluxo do próprio parceiro logado). */
function ModalCatalogoParceiro({ parceiro, onFechar, salvarItemCatalogo, excluirItemCatalogo, notify, token, decidirComissaoItem, podeDecidirComissao }) {
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = async () => {
    setCarregando(true);
    try {
      /* Com token: a rota pública devolve a comissão do item para a equipe, e sem ela o
         editor salvaria de volta um campo vazio, apagando o combinado com o parceiro. */
      const r = await apiFetch(`/api/parceiros/${parceiro.id}/servicos`, { token });
      setItens(r.servicos || []);
    } catch (e) { notify(`Não foi possível carregar o portfólio: ${e.message}`); }
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, [parceiro.id]);

  const onSalvar = async (item) => { const ok = await salvarItemCatalogo(parceiro.id, item); if (ok) await carregar(); return ok; };
  const onExcluir = async (id) => { const ok = await excluirItemCatalogo(id); if (ok) await carregar(); };

  return (
    <div className="no-print" style={overlay} onClick={onFechar}>
      <div style={{ ...modal, maxWidth: 640, maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <strong>Portfólio de {parceiro.empresa}</strong>
          <button className="icon-btn" onClick={onFechar}><X size={16} /></button>
        </div>
        <EditorCatalogoParceiro itens={itens} carregando={carregando} onSalvar={onSalvar} onExcluir={onExcluir}
          linkPortfolio={`${window.location.origin}${window.location.pathname}?portfolio=${parceiro.id}`} notify={notify}
          ehEquipe onDecidirComissao={podeDecidirComissao
            ? async (id, acao) => { const ok = await decidirComissaoItem(id, acao); if (ok) await carregar(); return ok; }
            : null} />
      </div>
    </div>
  );
}

/* ---- Aba Parceiros dentro da Gerência (homologação) ---- */
function CardParceiros({ parceiros, carregando, atualizarParceiro, podeExcluir = false, excluirParceiro, salvarItemCatalogo, excluirItemCatalogo, notify, token, perfil, decidirComissaoItem }) {
  const [editando, setEditando] = useState(null); // { id, status, avaliacao }
  const [catalogoDe, setCatalogoDe] = useState(null); // parceiro cujo portfólio está aberto
  const [perfilDe, setPerfilDe] = useState(null); // parceiro cujo perfil de venda está sendo editado
  const [excluindo, setExcluindo] = useState(null); // parceiro sendo confirmado para exclusão

  const abrirEdicao = (p) => setEditando({ id: p.id, status: p.status, avaliacao: p.avaliacao || "" });
  const salvar = async () => {
    const ok = await atualizarParceiro(editando.id, { status: editando.status, avaliacao: editando.avaliacao });
    if (ok) {
      setEditando(null);
      notify("Status do parceiro atualizado ✓");
    }
  };
  const confirmarExclusao = async () => {
    const alvo = excluindo;
    setExcluindo(null);
    if (alvo) await excluirParceiro(alvo.id);
  };
  const totalComissoesPendentes = parceiros.reduce((soma, p) => soma + (p.comissoesPendentes || 0), 0);

  return (
    <Card icon={Users} titulo={`Parceiros / Afiliados (${parceiros.length})`}>
      <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 14px" }}>
        Homologação dos parceiros cadastrados pelo portal público. Aprove, suspenda ou encerre a parceria conforme necessário.
      </p>

      {/* Comissão acertada só muda com aprovação, então a proposta do parceiro precisa
          esbarrar em alguém: sem este aviso ela ficaria esperando dentro do portfólio, que
          ninguém abre um a um. O número leva direto ao lugar de decidir. */}
      {totalComissoesPendentes > 0 && (
        <div style={{ background: "#FFF4E0", color: "#B26A00", borderRadius: 8, padding: "10px 12px", fontSize: 13, marginBottom: 14, display: "flex", gap: 8, alignItems: "flex-start" }}>
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            {totalComissoesPendentes === 1
              ? "1 item de portfólio com nova comissão aguardando sua aprovação"
              : `${totalComissoesPendentes} itens de portfólio com nova comissão aguardando sua aprovação`} —
            abra o portfólio (ícone da câmera) do parceiro marcado para aprovar ou recusar.
          </span>
        </div>
      )}

      {carregando && <p style={{ color: "#8593a8", fontSize: 14 }}>Carregando…</p>}
      {!carregando && parceiros.length === 0 && <p style={{ color: "#8593a8", fontSize: 14 }}>Nenhum parceiro cadastrado ainda.</p>}

      {parceiros.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: CINZA_CLARO }}>
                {["Status", "Empresa", "Categoria", "Comissão", ""].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: AZUL_MARINHO, borderBottom: `2px solid ${CINZA_BORDA}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parceiros.map((p) => (
                <tr key={p.id} style={{ borderBottom: `1px solid ${CINZA_BORDA}` }}>
                  <td style={{ padding: "8px 10px" }}><Selo valor={PARCEIRO_STATUS_LABEL[p.status] || p.status} /></td>
                  <td style={{ padding: "8px 10px", fontWeight: 600 }}>
                    {p.empresa}<div style={{ fontWeight: 400, fontSize: 12, color: "#8593a8" }}>{p.responsavel}{p.cidade ? ` · ${p.cidade}/${p.uf}` : ""}</div>
                    {p.comissoesPendentes > 0 && (
                      <div style={{ marginTop: 4, display: "inline-block", background: "#FFF4E0", color: "#B26A00", fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 6 }}>
                        {p.comissoesPendentes} comissão(ões) a aprovar
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "8px 10px" }}>{PARCEIRO_TIPO_LABEL[p.tipo] || p.tipo}</td>
                  <td style={{ padding: "8px 10px", fontSize: 12 }}>
                    {p.comissao.length > 0 ? p.comissao.map((c) => `${c.name} ${c.p}%`).join(", ") : "—"}
                  </td>
                  <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                    <button className="icon-btn" onClick={() => setPerfilDe(p)} title="Editar perfil de venda"><User size={15} color={AZUL_MEDIO} /></button>
                    <button className="icon-btn" onClick={() => setCatalogoDe(p)} title="Portfólio"><Camera size={15} color={AZUL_MEDIO} /></button>
                    <button className="icon-btn" onClick={() => abrirEdicao(p)} title="Homologação"><Edit3 size={15} color={AZUL_MEDIO} /></button>
                    {podeExcluir && (
                      <button className="icon-btn" onClick={() => setExcluindo(p)} title="Apagar parceiro"><Trash2 size={15} color="#c62828" /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <div className="no-print" style={overlay} onClick={() => setEditando(null)}>
          <div style={{ ...modal, maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <strong>Homologação do parceiro</strong>
              <button className="icon-btn" onClick={() => setEditando(null)}><X size={16} /></button>
            </div>
            <div style={cell(true)}>
              <label style={lab}>Status</label>
              <select style={inp} value={editando.status} onChange={(e) => setEditando({ ...editando, status: e.target.value })}>
                {PARCEIRO_STATUS_OPCOES.map((o) => <option key={o} value={o}>{PARCEIRO_STATUS_LABEL[o]}</option>)}
              </select>
            </div>
            <Area label="Avaliação / observações internas" value={editando.avaliacao} onChange={(v) => setEditando({ ...editando, avaliacao: v })} rows={3} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO }} onClick={() => setEditando(null)}>Cancelar</button>
              <button className="btn-solid" onClick={salvar}><Save size={15} /> Salvar</button>
            </div>
          </div>
        </div>
      )}

      {catalogoDe && (
        <ModalCatalogoParceiro parceiro={catalogoDe} onFechar={() => setCatalogoDe(null)} token={token}
          salvarItemCatalogo={salvarItemCatalogo} excluirItemCatalogo={excluirItemCatalogo}
          decidirComissaoItem={decidirComissaoItem} podeDecidirComissao={["gerencia", "vendas"].includes(perfil)} notify={notify} />
      )}

      {perfilDe && (
        <ModalPerfilParceiroAdmin parceiro={perfilDe} onFechar={() => setPerfilDe(null)}
          atualizarParceiro={atualizarParceiro} notify={notify} />
      )}

      <ConfirmModal aberto={!!excluindo} titulo="Apagar parceiro"
        mensagem={`Tem certeza que deseja apagar "${excluindo?.empresa}"? O login do afiliado também será removido. Essa ação não pode ser desfeita.`}
        onConfirm={confirmarExclusao} onCancel={() => setExcluindo(null)} />
    </Card>
  );
}

/* ---- Vitrine de parceiros dentro da Área do Cliente ---- */
function LogoParceiro({ p, onClick }) {
  return (
    <button onClick={onClick} style={{ background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, cursor: "pointer" }}>
      <div style={{ width: 64, height: 64, borderRadius: 10, background: CINZA_CLARO, display: "grid", placeItems: "center", overflow: "hidden" }}>
        {p.logo ? <img src={p.logo} alt={p.empresa} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Building2 size={24} color={AZUL_MEDIO} />}
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, textAlign: "center", color: AZUL_MARINHO }}>{p.empresa}</div>
    </button>
  );
}

function ModalBeneficioParceiro({ parceiro, onClose, notify, clienteLogado, token, onIrParaLogin, adicionarAoCarrinho }) {
  const [gerando, setGerando] = useState(false);
  const [vale, setVale] = useState(null); // { codigo, beneficio, expiraEm }
  const [erro, setErro] = useState("");
  const [servicos, setServicos] = useState([]);
  const [pedindoOrcamentoDe, setPedindoOrcamentoDe] = useState(null); // serviço selecionado, ou null

  /* Link da página do parceiro: é onde o cliente vê os serviços e resgata. Vai junto na
     criação para o e-mail poder levá-lo — antes o código aparecia só nesta tela, e quem
     fechava a aba ficava sem benefício e sem para onde ir. */
  const linkParceiro = `${window.location.origin}${window.location.pathname}?portfolio=${parceiro.id}`;

  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch(`/api/parceiros/${parceiro.id}/servicos`);
        setServicos(r.servicos || []);
      } catch { /* sem catálogo, o benefício genérico continua disponível */ }
    })();
  }, [parceiro.id]);

  const gerar = async () => {
    setErro("");
    setGerando(true);
    try {
      const r = await apiFetch("/api/vales", {
        method: "POST", token,
        body: { parceiroId: parceiro.id, linkParceiro },
      });
      setVale(r);
      notify("Código do benefício gerado ✓");
    } catch (e) { setErro(e.message); }
    setGerando(false);
  };

  return (
    <div className="no-print" style={overlay} onClick={onClose}>
      <div style={{ ...modal, maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <strong>{parceiro.empresa}</strong>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>

        {!vale && (
          <>
            {parceiro.logo && <img src={parceiro.logo} alt={parceiro.empresa} style={{ maxHeight: 64, display: "block", margin: "0 auto 14px" }} />}
            {parceiro.beneficio && <div style={{ fontWeight: 700, color: AZUL_MARINHO, marginBottom: 6, textAlign: "center" }}>{parceiro.beneficio}</div>}
            {parceiro.descricaoBeneficio && <p style={{ fontSize: 13.5, color: "#4a5a70", textAlign: "center", margin: "0 0 16px" }}>{parceiro.descricaoBeneficio}</p>}

            {!clienteLogado ? (
              /* Resgatar é exclusivo de cliente cadastrado — a vitrine em si continua aberta
                 para qualquer visitante navegar e conhecer os parceiros. */
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 13.5, color: "#4a5a70", margin: "0 0 14px" }}>
                  Esse benefício é exclusivo para clientes cadastrados. Entre com seu e-mail e senha
                  (ou cadastre-se) para resgatar o desconto.
                </p>
                <button className="btn-solid" style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => { onClose(); onIrParaLogin?.(); }}>
                  <Lock size={14} /> Entrar ou cadastrar-se
                </button>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 13, color: "#65758b", textAlign: "center", margin: "0 0 14px" }}>
                  O código vai gerado em nome de <strong>{clienteLogado.nome}</strong>.
                </p>
                {erro && <div style={{ marginBottom: 12, background: "#FCEAEA", color: "#C62828", padding: "9px 12px", borderRadius: 8, fontSize: 12.5 }}>{erro}</div>}
                <button className="btn-solid" style={{ width: "100%", justifyContent: "center" }} onClick={gerar} disabled={gerando}>
                  {gerando ? <><Loader2 size={15} className="spin" /> Gerando…</> : "Quero esse benefício"}
                </button>
              </>
            )}

            {/* Catálogo do parceiro: comprar direto (quando o item tem preço definido) não
                exige login — só na hora de fechar a compra. Pedir orçamento sob medida exige,
                porque a proposta que volta é vinculada ao cadastro do cliente. */}
            {servicos.length > 0 && (
              <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${CINZA_BORDA}` }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: AZUL_MARINHO, marginBottom: 10 }}>
                  Serviços e produtos:
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {servicos.map((s) => (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, border: `1px solid ${CINZA_BORDA}`, borderRadius: 8, padding: "8px 10px", flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{s.titulo || "Serviço"}</div>
                        {s.preco_venda ? (
                          <PrecoDeVenda precoDe={s.preco_de} precoVenda={s.preco_venda} compacto />
                        ) : s.preco && <div style={{ fontSize: 11.5, color: "#8593a8" }}>a partir de {s.preco}</div>}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {s.preco_venda > 0 && (
                          <button className="btn-solid" style={{ width: "auto", padding: "7px 12px", fontSize: 12.5, whiteSpace: "nowrap" }}
                            onClick={() => { adicionarAoCarrinho({ servicoId: s.id, titulo: s.titulo || "Serviço", precoUnitario: Number(s.preco_venda), precoDe: precoParaNumero(s.preco_de), parceiroEmpresa: parceiro.empresa, foto: s.foto }); notify("Adicionado ao carrinho ✓"); }}>
                            <ShoppingCart size={13} /> Comprar
                          </button>
                        )}
                        {clienteLogado && (
                          <button className="btn-ghost" style={{ color: AZUL_MEDIO, background: CINZA_CLARO, whiteSpace: "nowrap", padding: "7px 12px", fontSize: 12.5 }}
                            onClick={() => setPedindoOrcamentoDe(s)}>
                            Solicitar orçamento
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {vale && (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#E6F4EA", display: "grid", placeItems: "center", margin: "0 auto 14px" }}>
              <Check size={24} color="#2E7D32" />
            </div>
            <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 12px" }}>Apresente este código para o parceiro:</p>
            <div style={{ fontFamily: "monospace", fontSize: 26, fontWeight: 800, color: AZUL_MARINHO, background: CINZA_CLARO, borderRadius: 10, padding: "14px", letterSpacing: 2 }}>
              {vale.codigo}
            </div>
            {vale.beneficio && <div style={{ fontSize: 13, color: "#4a5a70", marginTop: 10 }}>{vale.beneficio}</div>}
            {vale.expiraEm && <div style={{ fontSize: 12, color: "#8593a8", marginTop: 6 }}>Válido até {new Date(vale.expiraEm).toLocaleDateString("pt-BR")}</div>}
            {vale.emailEnviadoPara && (
              <div style={{ fontSize: 12, color: "#2E7D32", marginTop: 8 }}>
                Enviamos o cupom para {vale.emailEnviadoPara}
              </div>
            )}
            {/* O passo que faltava: daqui o cliente vai para a página onde vê os serviços
                e digita o código para resgatar. Antes o fluxo terminava no código na tela. */}
            <a href={linkParceiro} className="btn-solid"
              style={{ marginTop: 16, width: "100%", justifyContent: "center", textDecoration: "none", display: "inline-flex" }}>
              Ver serviços e resgatar
            </a>
            <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO, marginTop: 8, width: "100%", justifyContent: "center" }} onClick={onClose}>Fechar</button>
          </div>
        )}
      </div>

      {pedindoOrcamentoDe && (
        <ModalPedirOrcamento parceiro={parceiro} servico={pedindoOrcamentoDe} token={token} notify={notify}
          onFechar={() => setPedindoOrcamentoDe(null)} />
      )}
    </div>
  );
}

/* Pedido de orçamento sob medida — diferente do cupom (desconto instantâneo): aqui o parceiro
   ainda vai mandar uma proposta com valor e prazo, que o cliente acompanha em "Meus orçamentos". */
function ModalPedirOrcamento({ parceiro, servico, token, notify, onFechar }) {
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const enviar = async () => {
    setEnviando(true);
    try {
      await apiFetch("/api/leads", { method: "POST", token, body: { parceiroId: parceiro.id, servicoId: servico.id, mensagem } });
      setEnviado(true);
    } catch (e) { notify(`Não foi possível enviar: ${e.message}`); }
    setEnviando(false);
  };

  return (
    <div className="no-print" style={{ ...overlay, zIndex: 90 }} onClick={onFechar}>
      <div style={{ ...modal, maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <strong>Pedir orçamento</strong>
          <button className="icon-btn" onClick={onFechar}><X size={16} /></button>
        </div>
        {enviado ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#E6F4EA", display: "grid", placeItems: "center", margin: "0 auto 12px" }}>
              <Check size={22} color="#2E7D32" />
            </div>
            <p style={{ fontSize: 13.5, color: "#4a5a70", margin: "0 0 4px" }}>Pedido enviado para {parceiro.empresa}!</p>
            <p style={{ fontSize: 12.5, color: "#8593a8", margin: 0 }}>Acompanhe a resposta em "Meus orçamentos", no seu portal.</p>
            <button className="btn-solid" style={{ marginTop: 16, width: "100%", justifyContent: "center" }} onClick={onFechar}>Fechar</button>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13, color: "#65758b", margin: "0 0 12px" }}>
              <strong>{servico.titulo}</strong> · {parceiro.empresa} vai enviar uma proposta com valor e prazo.
            </p>
            <Area label="Conte mais detalhes (opcional)" value={mensagem} onChange={setMensagem} rows={3}
              placeholder="Ex.: apartamento de 48m², preciso pintar até o fim do mês…" />
            <button className="btn-solid" style={{ width: "100%", justifyContent: "center", marginTop: 14 }} onClick={enviar} disabled={enviando}>
              {enviando ? <><Loader2 size={15} className="spin" /> Enviando…</> : "Enviar pedido"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* Vitrine pública de avaliações — só as que a Qualidade aprovou pra exibir (GET /api/avaliacoes/vitrine). */
function SecaoFeedbackVitrine({ notify }) {
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    (async () => {
      setCarregando(true);
      try {
        const r = await apiFetch("/api/avaliacoes/vitrine");
        setAvaliacoes(r.avaliacoes || []);
      } catch (e) { notify(`Não foi possível carregar as avaliações: ${e.message}`); }
      setCarregando(false);
    })();
  }, []);

  if (carregando || avaliacoes.length === 0) return null;

  return (
    <Card icon={Star} titulo="O que nossos clientes dizem">
      <div style={{ display: "grid", gap: 10 }}>
        {avaliacoes.map((a, i) => (
          <div key={i} style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
              <strong style={{ fontSize: 14 }}>{a.cliente || "Cliente"}</strong>
              <Estrelas valor={a.nota} tamanho={15} />
            </div>
            {/* Serviço em destaque: ajuda quem lê a saber a que tipo de atendimento a nota se refere. */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
              {a.servico && (
                <span style={{ background: "#EAF2FB", color: AZUL_MARINHO, borderRadius: 20, padding: "2px 10px", fontSize: 11.5, fontWeight: 700 }}>
                  {a.servico}
                </span>
              )}
              {a.empreendimento && <span style={{ fontSize: 12, color: "#65758b" }}>{a.empreendimento}</span>}
            </div>
            {a.comentario && <div style={{ fontSize: 13.5, color: "#334", background: CINZA_CLARO, borderRadius: 8, padding: "8px 10px" }}>{a.comentario}</div>}
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---- "Meus cupons" ----
   O cliente gerava o código e ele aparecia uma única vez, na tela. Fechou a aba, perdeu:
   não havia onde reencontrar, nem como saber se ainda valia ou se já tinha sido usado.
   Aqui ele volta pelo WhatsApp (ou e-mail) que digitou ao pedir o benefício — a mesma
   informação que ele já deu, sem inventar login para quem não é da equipe. */
function SecaoMeusCupons({ notify }) {
  const [contato, setContato] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [cupons, setCupons] = useState(null);
  const [erro, setErro] = useState("");

  const ehEmail = contato.includes("@");

  const buscar = async () => {
    const v = contato.trim();
    if (!v) { setErro("Digite seu WhatsApp ou o e-mail que você usou."); return; }
    setErro(""); setBuscando(true);
    try {
      const r = await apiFetch("/api/vales/meus", {
        method: "POST",
        body: ehEmail ? { email: v } : { whatsapp: v },
      });
      setCupons(r.cupons || []);
    } catch (e) { setErro(e.message); }
    setBuscando(false);
  };

  const visual = {
    ativo: { rotulo: "Disponível", cor: "#2E7D32", bg: "#E6F4EA" },
    usado: { rotulo: "Já resgatado", cor: "#65758b", bg: CINZA_CLARO },
    expirado: { rotulo: "Expirado", cor: "#C62828", bg: "#FCEAEA" },
    cancelado: { rotulo: "Cancelado", cor: "#C62828", bg: "#FCEAEA" },
  };

  return (
    <Card icon={Sparkles} titulo="Meus cupons">
      <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 14px" }}>
        Já pediu um benefício de parceiro? Veja aqui seus códigos, onde usar e se ainda estão valendo.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={contato}
          onChange={(e) => { setContato(e.target.value); setErro(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") buscar(); }}
          placeholder="WhatsApp com DDD ou seu e-mail"
          style={{ flex: 1, minWidth: 190, padding: "10px 12px", border: `1px solid ${CINZA_BORDA}`, borderRadius: 9, fontSize: 14, fontFamily: "inherit" }}
        />
        <button className="btn-solid" onClick={buscar} disabled={buscando || !contato.trim()}>
          {buscando ? <Loader2 size={15} className="spin" /> : <Search size={15} />} Buscar
        </button>
      </div>

      {erro && <div style={{ marginTop: 10, background: "#FCEAEA", color: "#C62828", padding: "9px 12px", borderRadius: 8, fontSize: 12.5 }}>{erro}</div>}

      {cupons !== null && cupons.length === 0 && (
        <p style={{ color: "#8593a8", fontSize: 13.5, marginTop: 14 }}>
          Nenhum cupom encontrado para esse contato. Use o mesmo WhatsApp ou e-mail que você
          informou ao pedir o benefício.
        </p>
      )}

      {cupons !== null && cupons.length > 0 && (
        <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
          {cupons.map((c) => {
            const v = visual[c.situacao] || visual.ativo;
            const link = `${window.location.origin}${window.location.pathname}?portfolio=${c.parceiro.id}`;
            return (
              <div key={c.codigo} style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 11, padding: 13 }}>
                <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 9, background: CINZA_CLARO, display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0 }}>
                    {c.parceiro.logo ? <img src={c.parceiro.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      : <Building2 size={19} color={AZUL_MEDIO} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 14 }}>{c.parceiro.empresa}</strong>
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: v.cor, background: v.bg, borderRadius: 20, padding: "1px 9px" }}>
                        {v.rotulo}
                      </span>
                    </div>
                    {c.beneficio && <div style={{ fontSize: 13, color: "#4a5a70", marginTop: 3 }}>{c.beneficio}</div>}
                    {c.parceiro.cidade && (
                      <div style={{ fontSize: 11.5, color: "#8593a8", marginTop: 2 }}>{c.parceiro.cidade}/{c.parceiro.uf}</div>
                    )}
                  </div>
                </div>

                <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 800, color: c.situacao === "ativo" ? AZUL_MARINHO : "#8593a8",
                  background: CINZA_CLARO, borderRadius: 8, padding: "9px 12px", marginTop: 11, letterSpacing: 1.5, textAlign: "center",
                  textDecoration: c.situacao === "ativo" ? "none" : "line-through" }}>
                  {c.codigo}
                </div>

                <div style={{ fontSize: 11.5, color: "#8593a8", marginTop: 7 }}>
                  {c.situacao === "usado" && c.usadoEm && `Resgatado em ${new Date(c.usadoEm).toLocaleDateString("pt-BR")}`}
                  {c.situacao === "ativo" && c.expiraEm && `Válido até ${new Date(c.expiraEm).toLocaleDateString("pt-BR")}`}
                  {c.situacao === "expirado" && c.expiraEm && `Venceu em ${new Date(c.expiraEm).toLocaleDateString("pt-BR")}`}
                </div>

                {/* Ver os serviços vale mesmo com o cupom usado — o cliente pode querer
                    comprar de novo. O que muda é o texto do botão, não o acesso. */}
                <a href={link} className={c.situacao === "ativo" ? "btn-solid" : "btn-ghost"}
                  style={{ marginTop: 10, width: "100%", justifyContent: "center", textDecoration: "none", display: "inline-flex",
                    ...(c.situacao === "ativo" ? {} : { color: AZUL_MARINHO, background: CINZA_CLARO }) }}>
                  {c.situacao === "ativo" ? "Ver serviços e resgatar" : "Ver serviços do parceiro"}
                </a>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function SecaoParceirosVitrine({ notify, clienteLogado, token, onIrParaLogin, somenteLogos = false, tipoInicial = "servico" }) {
  const [parceiros, setParceiros] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [abaTipo, setAbaTipo] = useState(tipoInicial);
  const [selecionado, setSelecionado] = useState(null);
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);
  const carrinho = useCarrinho();

  useEffect(() => {
    (async () => {
      setCarregando(true);
      try {
        const r = await apiFetch("/api/parceiros/vitrine");
        setParceiros((r.parceiros || []).map(mapParceiroDaApi));
      } catch (e) { notify(`Não foi possível carregar os parceiros: ${e.message}`); }
      setCarregando(false);
    })();
  }, []);

  // Na página pública é só a vitrine de logos, sem separar por tipo — quem quer o detalhe
  // (e resgatar) entra no portal do cliente, onde a área continua disponível.
  const filtrados = somenteLogos ? parceiros : parceiros.filter((p) => p.tipo === abaTipo);
  const info = FN_AREA_INFO[abaTipo] || FN_AREA_INFO.servico;

  return (
    <Card icon={Building2} titulo={somenteLogos ? "Benefícios Exclusivos FN" : info.titulo}>
      {!somenteLogos && (
        <>
          <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 14px" }}>{info.descricao}</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={() => setAbaTipo("servico")}
              className={abaTipo === "servico" ? "btn-solid" : "btn-ghost"}
              style={abaTipo === "servico" ? {} : { color: AZUL_MARINHO, background: CINZA_CLARO }}>
              FN Clube
            </button>
            <button onClick={() => setAbaTipo("produto")}
              className={abaTipo === "produto" ? "btn-solid" : "btn-ghost"}
              style={abaTipo === "produto" ? {} : { color: AZUL_MARINHO, background: CINZA_CLARO }}>
              FN Home
            </button>
            <div style={{ flex: 1 }} />
            <BotaoCarrinho quantidade={carrinho.quantidadeTotal} onClick={() => setCarrinhoAberto(true)} />
          </div>
        </>
      )}

      {carregando && <p style={{ color: "#8593a8", fontSize: 14 }}>Carregando…</p>}
      {!carregando && filtrados.length === 0 && <p style={{ color: "#8593a8", fontSize: 14 }}>Nenhum parceiro disponível no momento.</p>}

      {filtrados.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 12 }}>
          {filtrados.map((p) => <LogoParceiro key={p.id} p={p} onClick={() => setSelecionado(p)} />)}
        </div>
      )}

      {selecionado && (
        <ModalBeneficioParceiro parceiro={selecionado} onClose={() => setSelecionado(null)} notify={notify}
          clienteLogado={clienteLogado} token={token} onIrParaLogin={onIrParaLogin} adicionarAoCarrinho={carrinho.adicionar} />
      )}

      {carrinhoAberto && (
        <ModalCarrinho itens={carrinho.itens} alterarQuantidade={carrinho.alterarQuantidade} remover={carrinho.remover}
          total={carrinho.total} onFechar={() => setCarrinhoAberto(false)} token={token} notify={notify} onIrParaLogin={onIrParaLogin}
          esvaziar={carrinho.esvaziar} />
      )}
    </Card>
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
const Grid = ({ children }) => <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>{children}</div>;
const cell = (full) => ({ display: "flex", flexDirection: "column", gap: 5, gridColumn: full ? "1 / -1" : "auto" });
const lab = { fontSize: 12, fontWeight: 600, color: "#5a6a80" };
const inp = { padding: "9px 11px", border: `1px solid ${CINZA_BORDA}`, borderRadius: 8, fontSize: 14, outline: "none", background: "#fff", fontFamily: "inherit" };
function Field({ label, value, onChange, type = "text", full, disabled, placeholder }) {
  return (<div style={cell(full)}><label style={lab}>{label}</label><input type={type} style={inp} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} disabled={disabled} /></div>);
}
function Area({ label, value, onChange, rows = 3, placeholder }) {
  return (<div style={{ ...cell(true), marginTop: 12 }}><label style={lab}>{label}</label><textarea rows={rows} style={{ ...inp, resize: "vertical", lineHeight: 1.5 }} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></div>);
}
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
  /* Rede de segurança de layout: um nome muito longo (ou colado sem espaços) esticava a
     linha para os lados e empurrava a tela inteira — vimos isso acontecer na agenda do
     técnico. O servidor passou a limitar o tamanho dos campos, mas os dados já gravados
     continuam aí, então a tela também precisa aguentar. */
  /* overflow-wrap:anywhere é herdado, então vale para toda a tela de uma vez. Diferente de
     break-word, ele também deixa o bloco ENCOLHER abaixo do tamanho da palavra — que é o
     que faz um item flex parar de empurrar a página inteira para a direita. */
  body { overflow-wrap: anywhere; }
  .quebra-texto { overflow-wrap: anywhere; min-width: 0; }
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
  /* Aviso de versão preliminar: fica visível na tela e vira marca d'água na impressão. */
  .laudo-aviso-rascunho {
    background: #FFF4E0; color: #B26A00; border: 1px solid #f0c987; border-radius: 10px;
    padding: 10px 14px; margin-bottom: 14px; font-size: 13px; font-weight: 700; text-align: center;
  }
  .laudo-rascunho { position: relative; }
  @media print {
    .laudo-rascunho::before {
      content: "VERSÃO PRELIMINAR — NÃO APROVADA";
      position: fixed; inset: 0; display: grid; place-items: center;
      transform: rotate(-32deg); font-size: 52px; font-weight: 800;
      color: rgba(198, 40, 40, .16); letter-spacing: 3px; pointer-events: none; z-index: 999;
    }
    .laudo-aviso-rascunho { border: 2px solid #C62828; color: #C62828; background: #fff; }
  }

  /* Laudo no modelo novo: cada seção é uma página A4 na impressão. */
  .laudo-modelo { max-width: 820px; margin: 0 auto; }
  .laudo-pagina, .laudo-ficha { background: #fff; border: 1px solid ${CINZA_BORDA}; border-radius: 12px; padding: 30px 34px; margin-bottom: 16px; }
  @media print {
    @page { size: A4; margin: 12mm; }
    .laudo-modelo { max-width: none; }
    .laudo-pagina { break-after: page; page-break-after: always; }
    .laudo-pagina, .laudo-ficha { border: none; border-radius: 0; padding: 0 0 10px; margin: 0; box-shadow: none; }
    .laudo-ficha { break-inside: avoid; page-break-inside: avoid; }
    .laudo-modelo img { max-width: 100%; }
  }
  .dia-cel:focus-visible, .chip-tecnico:focus-visible { outline: 2.5px solid ${AZUL_MARINHO}; outline-offset: 2px; }
  /* Sino com pendência urgente pulsa de leve, para ser notado sem incomodar. */
  .sino-alerta { animation: pulsa-sino 2s ease-in-out infinite; }
  @keyframes pulsa-sino {
    0%, 100% { box-shadow: 0 0 0 0 rgba(229, 57, 53, .55); }
    50%      { box-shadow: 0 0 0 7px rgba(229, 57, 53, 0); }
  }
  .painel-lateral { animation: entra-painel .18s ease-out; }
  @keyframes entra-painel { from { transform: translateX(24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  @media (prefers-reduced-motion: reduce) {
    .painel-lateral { animation: none !important; }
    .spin { animation: none !important; }
    .sino-alerta { animation: none !important; }
  }
  @media print {
    .no-print { display:none !important; }
    body { background:#fff !important; }
    main { padding:0 !important; max-width:100% !important; }
    .laudo-print { border:none !important; border-radius:0 !important; }
  }
  @media (max-width: 640px) {
    .icon-btn { padding:8px; }
    .btn-ghost, .btn-solid, .btn-mini { padding:9px 12px; font-size:13px; }
    .tab { padding:10px 11px; font-size:13px; }
    table { font-size:12.5px; }
    input, select, textarea { font-size:16px; } /* evita zoom automático em iOS ao focar o campo */
  }
`;
