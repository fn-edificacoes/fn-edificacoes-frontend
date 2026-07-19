import React, { useState, useEffect, useRef } from "react";
import {
  FileText, Plus, Trash2, Camera, X, Printer, Save, FolderOpen,
  Building2, User, ClipboardList, ChevronDown, ChevronRight, ChevronLeft, Check,
  AlertTriangle, CircleAlert, Info, Copy, Sparkles, Loader2,
  ClipboardCheck, BarChart3, DollarSign, Users, Edit3, RefreshCcw, Filter, LayoutGrid, Star,
  TrendingUp, Percent, Send, CalendarDays, Eye, Mail
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
/* Converte um registro de preço de vistoria por empreendimento vindo do banco (snake_case) */
function mapPrecoDaApi(p) {
  return { id: p.id, empreendimento: p.empreendimento || "", precoVistoria: Number(p.preco_vistoria) || 0, atualizadoEm: p.atualizado_em || null };
}
const LOGO_FN_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAAEsCAYAAAB5fY51AAAKMWlDQ1BJQ0MgUHJvZmlsZQAAeJydlndUU9kWh8+9N71QkhCKlNBraFICSA29SJEuKjEJEErAkAAiNkRUcERRkaYIMijggKNDkbEiioUBUbHrBBlE1HFwFBuWSWStGd+8ee/Nm98f935rn73P3Wfvfda6AJD8gwXCTFgJgAyhWBTh58WIjYtnYAcBDPAAA2wA4HCzs0IW+EYCmQJ82IxsmRP4F726DiD5+yrTP4zBAP+flLlZIjEAUJiM5/L42VwZF8k4PVecJbdPyZi2NE3OMErOIlmCMlaTc/IsW3z2mWUPOfMyhDwZy3PO4mXw5Nwn4405Er6MkWAZF+cI+LkyviZjg3RJhkDGb+SxGXxONgAoktwu5nNTZGwtY5IoMoIt43kA4EjJX/DSL1jMzxPLD8XOzFouEiSniBkmXFOGjZMTi+HPz03ni8XMMA43jSPiMdiZGVkc4XIAZs/8WRR5bRmyIjvYODk4MG0tbb4o1H9d/JuS93aWXoR/7hlEH/jD9ld+mQ0AsKZltdn6h21pFQBd6wFQu/2HzWAvAIqyvnUOfXEeunxeUsTiLGcrq9zcXEsBn2spL+jv+p8Of0NffM9Svt3v5WF485M4knQxQ143bmZ6pkTEyM7icPkM5p+H+B8H/nUeFhH8JL6IL5RFRMumTCBMlrVbyBOIBZlChkD4n5r4D8P+pNm5lona+BHQllgCpSEaQH4eACgqESAJe2Qr0O99C8ZHA/nNi9GZmJ37z4L+fVe4TP7IFiR/jmNHRDK4ElHO7Jr8WgI0IABFQAPqQBvoAxPABLbAEbgAD+ADAkEoiARxYDHgghSQAUQgFxSAtaAYlIKtYCeoBnWgETSDNnAYdIFj4DQ4By6By2AE3AFSMA6egCnwCsxAEISFyBAVUod0IEPIHLKFWJAb5AMFQxFQHJQIJUNCSAIVQOugUqgcqobqoWboW+godBq6AA1Dt6BRaBL6FXoHIzAJpsFasBFsBbNgTzgIjoQXwcnwMjgfLoK3wJVwA3wQ7oRPw5fgEVgKP4GnEYAQETqiizARFsJGQpF4JAkRIauQEqQCaUDakB6kH7mKSJGnyFsUBkVFMVBMlAvKHxWF4qKWoVahNqOqUQdQnag+1FXUKGoK9RFNRmuizdHO6AB0LDoZnYsuRlegm9Ad6LPoEfQ4+hUGg6FjjDGOGH9MHCYVswKzGbMb0445hRnGjGGmsVisOtYc64oNxXKwYmwxtgp7EHsSewU7jn2DI+J0cLY4X1w8TogrxFXgWnAncFdwE7gZvBLeEO+MD8Xz8MvxZfhGfA9+CD+OnyEoE4wJroRIQiphLaGS0EY4S7hLeEEkEvWITsRwooC4hlhJPEQ8TxwlviVRSGYkNimBJCFtIe0nnSLdIr0gk8lGZA9yPFlM3kJuJp8h3ye/UaAqWCoEKPAUVivUKHQqXFF4pohXNFT0VFysmK9YoXhEcUjxqRJeyUiJrcRRWqVUo3RU6YbStDJV2UY5VDlDebNyi/IF5UcULMWI4kPhUYoo+yhnKGNUhKpPZVO51HXURupZ6jgNQzOmBdBSaaW0b2iDtCkVioqdSrRKnkqNynEVKR2hG9ED6On0Mvph+nX6O1UtVU9Vvuom1TbVK6qv1eaoeajx1UrU2tVG1N6pM9R91NPUt6l3qd/TQGmYaYRr5Grs0Tir8XQObY7LHO6ckjmH59zWhDXNNCM0V2ju0xzQnNbS1vLTytKq0jqj9VSbru2hnaq9Q/uE9qQOVcdNR6CzQ+ekzmOGCsOTkc6oZPQxpnQ1df11Jbr1uoO6M3rGelF6hXrtevf0Cfos/ST9Hfq9+lMGOgYhBgUGrQa3DfGGLMMUw12G/YavjYyNYow2GHUZPTJWMw4wzjduNb5rQjZxN1lm0mByzRRjyjJNM91tetkMNrM3SzGrMRsyh80dzAXmu82HLdAWThZCiwaLG0wS05OZw2xljlrSLYMtCy27LJ9ZGVjFW22z6rf6aG1vnW7daH3HhmITaFNo02Pzq62ZLde2xvbaXPJc37mr53bPfW5nbse322N3055qH2K/wb7X/oODo4PIoc1h0tHAMdGx1vEGi8YKY21mnXdCO3k5rXY65vTW2cFZ7HzY+RcXpkuaS4vLo3nG8/jzGueNueq5clzrXaVuDLdEt71uUnddd457g/sDD30PnkeTx4SnqWeq50HPZ17WXiKvDq/XbGf2SvYpb8Tbz7vEe9CH4hPlU+1z31fPN9m31XfKz95vhd8pf7R/kP82/xsBWgHcgOaAqUDHwJWBfUGkoAVB1UEPgs2CRcE9IXBIYMj2kLvzDecL53eFgtCA0O2h98KMw5aFfR+OCQ8Lrwl/GGETURDRv4C6YMmClgWvIr0iyyLvRJlESaJ6oxWjE6Kbo1/HeMeUx0hjrWJXxl6K04gTxHXHY+Oj45vipxf6LNy5cDzBPqE44foi40V5iy4s1licvvj4EsUlnCVHEtGJMYktie85oZwGzvTSgKW1S6e4bO4u7hOeB28Hb5Lvyi/nTyS5JpUnPUp2Td6ePJninlKR8lTAFlQLnqf6p9alvk4LTduf9ik9Jr09A5eRmHFUSBGmCfsytTPzMoezzLOKs6TLnJftXDYlChI1ZUPZi7K7xTTZz9SAxESyXjKa45ZTk/MmNzr3SJ5ynjBvYLnZ8k3LJ/J9879egVrBXdFboFuwtmB0pefK+lXQqqWrelfrry5aPb7Gb82BtYS1aWt/KLQuLC98uS5mXU+RVtGaorH1futbixWKRcU3NrhsqNuI2ijYOLhp7qaqTR9LeCUXS61LK0rfb+ZuvviVzVeVX33akrRlsMyhbM9WzFbh1uvb3LcdKFcuzy8f2x6yvXMHY0fJjpc7l+y8UGFXUbeLsEuyS1oZXNldZVC1tep9dUr1SI1XTXutZu2m2te7ebuv7PHY01anVVda926vYO/Ner/6zgajhop9mH05+x42Rjf2f836urlJo6m06cN+4X7pgYgDfc2Ozc0tmi1lrXCrpHXyYMLBy994f9Pdxmyrb6e3lx4ChySHHn+b+O31w0GHe4+wjrR9Z/hdbQe1o6QT6lzeOdWV0iXtjusePhp4tLfHpafje8vv9x/TPVZzXOV42QnCiaITn07mn5w+lXXq6enk02O9S3rvnIk9c60vvG/wbNDZ8+d8z53p9+w/ed71/LELzheOXmRd7LrkcKlzwH6g4wf7HzoGHQY7hxyHui87Xe4Znjd84or7ldNXva+euxZw7dLI/JHh61HXb95IuCG9ybv56Fb6ree3c27P3FlzF3235J7SvYr7mvcbfjT9sV3qID0+6j068GDBgztj3LEnP2X/9H686CH5YcWEzkTzI9tHxyZ9Jy8/Xvh4/EnWk5mnxT8r/1z7zOTZd794/DIwFTs1/lz0/NOvm1+ov9j/0u5l73TY9P1XGa9mXpe8UX9z4C3rbf+7mHcTM7nvse8rP5h+6PkY9PHup4xPn34D94Tz+6TMXDkAAF1dSURBVHja7Z13mFxV+YDfe++0nd2d7T3bUja990pogdCLIqKoIIhIEVFR8YcIgoqKCoqCgIBKESmhBQKEhFRI72177216ueX3x8xOdrMlbRMSOO/z5AHC7G177zvfOfc73yfpum4gEAgEpwGyuAQCgUAISyAQCISwBAKBEJZAIBAIYQkEAoEQlkAgEAhhCQQCISyBQCAQwhIIBEJYAoFAIIQlEAgEQlgCgUAghCUQCISwBAKBQAhLIBAIhLAEAoEQlkAgEAhhCQQCgRCWQCAQwhIIBAIhLIFAIBDCEggEQlgCgUAghCUQCARCWAKBQAhLIBAIhLAEAoFACEsgEAhhCQQCgRCWQCAQCGEJBAIhLIFAIBDCEggEAiEsgUAghCUQCARCWAKBQCCEJRAIhLAEAoFACEsgEAiEsAQCgRCWQCAQCGEJBAIhLIFAIBDCEggEAiEsgUAghCUQCARCWAKBQAhLIBAIhLAEAoFACEsgEAiEsAQCgUAISyAQCGEJBAKBEJZAIBDCEggEAiEsgUAgEMISCARCWAKBQCCEJRAIBEJYAoFACEsgEAiEsAQCgUAISyAQCISwBAKBQAhLIBAIhLAEAoFACEsgEAiEsAQCgUAISyAQCISwBAKBQAhLIBAIYQkEAoEQlkAgEAhhCQQCISyBQCAQwhIIBAIhLIFAIBDCEggEAiEsgUAghCUQCARCWAKBQCCEJRAIhLAEAoFACEsgEAiEsAQCgUAISyAQCISwBAKBQAhLIBAIYQkEAoEQlkAgEAhhCQQCgRCWQCAQwhIIBAIhLIFAIBDCEggEAiEsgUAghCUQCARCWAKBQAhLIBAIhLAEAoFACEsgEAhhCQQCgRCWQCAQCGEJBAIhLIFAIBDCEggEAiEsgUAghCUQCARCWAKBQAhLIBAIhLAEAoFACEsgEAhhCQQCgRCWQCAQCGEJBAIhLIFAIBDCEggEAiEsgUAghCUQCARCWAKBQAhLIBAIhLAEAoFACEsgEAhhCQQCgRCWQCAQCGEJBAIhLIFAIBDCEggEAiEsgUAghCUQCARCWAKBQAhLIBAIhLAEAoFACEsgEAhhCQQCgRCWQCAQCGEJBAIhLIFAIBDCEggEAiEsgUAghCUQCARCWAKBQCCEJRAIhLAEAoFACEsgEAiEsAQCgRCWQCAQCGEJBAKBEJZAIBDCEggEAiEsgUAgEMISCARCWAKBQCCEJRAIBEJYAoFACEsgEAiEsAQCgUAISyAQCGEJBAKBEJZAIBDCEpdAIBAIYQkEAoEQlkAgEMISCAQCISyBQCAQwhIIBEJYAoFAIIQlEAgEQlgCgUAISyAQCISwBAKBQAhLIBAIYQkEAoEQlkAgEAhhCQQCISyBQCAQwhIIBAIhLIFAIIQlEAgEQlgCgUAghCUQCISwBAKBQAhLIBAIhLAEAoEQlkAgEAhhCQQCgRCWQCAQwhIIBIITxP8DbxemZMbnTXYAAAAASUVORK5CYII=";

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
  fotoCliente: null, // foto do vistoriador com o cliente (opcional) — aparece na última página do laudo e na página de acompanhamento do cliente
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
const TIPO_ART_OPCOES = ["Individual", "Coletiva"];

/* ---------- Status do CLIENTE (status_cliente) — só estes 3, nesta ordem, sempre automático ----------
   O cliente NUNCA vê status internos de gerência/documentação (STATUS_INTERNO_OPCOES abaixo).
   Muda sozinho: "Agendado" -> "Laudo em análise" quando o vistoriador finaliza a vistoria
   (POST /api/vistoria/finalizar) -> "Laudo enviado por e-mail" quando a gerência aprova
   (POST /api/docs/:id/aprovar, que já gera o PDF e envia o e-mail). */
const STATUS_ATENDIMENTO_OPCOES = ["Agendado", "Laudo em análise", "Laudo enviado por e-mail"];
const STATUS_ATENDIMENTO_INFO = {
  "Agendado": "Recebemos sua solicitação e sua vistoria está agendada. Em breve nossa equipe entrará em contato.",
  "Laudo em análise": "Sua vistoria foi realizada e o laudo está em análise pela nossa equipe técnica.",
  "Laudo enviado por e-mail": "Seu laudo foi aprovado e enviado para o e-mail cadastrado. Verifique sua caixa de entrada (e o spam).",
};
/* ---------- Status INTERNO (docs.status) — uso exclusivo da equipe (Documentação/Gerência),
   nunca mostrado ao cliente. Precisa bater exatamente com STATUS_ATENDIMENTO_VALIDOS do backend. */
const STATUS_INTERNO_OPCOES = ["Agendado", "Em vistoria", "Laudo em elaboração", "Laudo pronto"];

/* ---------- Perfis de acesso (agora definidos pelo backend/login, não escolhidos na tela) ----------
   vistoriador   -> só enxerga o módulo Laudos (não vê Documentação nem Gerência)
   documentacao  -> só enxerga o módulo Documentação
   comercial     -> só enxerga o módulo Clientes (cadastro, agendamento, acompanhamento)
   qualidade     -> só enxerga o módulo Qualidade (avaliações dos clientes)
   gerencia      -> acesso restrito, mas enxerga tudo (incl. financeiro)
   O cadastro/acompanhamento de Cliente em si continua sendo uma tela pública separada, sem login.
------------------------------------------------------------------ */
const MODULOS_POR_PERFIL = {
  vistoriador: ["laudos"],
  documentacao: ["documentacao"],
  comercial: ["clientes"],
  qualidade: ["qualidade"],
  gerencia: ["laudos", "documentacao", "gerencia", "clientes", "qualidade"],
};
const PERFIL_LABEL = { vistoriador: "Vistoriador", documentacao: "Documentação", comercial: "Comercial", qualidade: "Qualidade", gerencia: "Gerência" };

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

const novoCadastroCliente = () => ({
  id: `cli_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  nome: "", cpf: "", telefone: "", email: "",
  construtora: "", empreendimento: "", blocoTorre: "", endereco: "", cep: "",
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

/* Soma horas a um horário "HH:MM", devolvendo também "HH:MM" (usado para sugerir o término
   da vistoria a partir do horário desejado pelo cliente — continua editável depois). */
function somarHora(hhmm, horas) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const total = (h * 60 + m + horas * 60 + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
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
          <img src="/logo-fn-transparente.png" alt="FN Edificações" style={{ height: "clamp(56px, 14vw, 72px)", width: "auto" }} />
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
function PortalCliente({ onIrParaLogin, onIrParaCadastroParceiro }) {
  const [toast, setToast] = useState("");
  const notify = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };

  return (
    <div style={{ minHeight: "100vh", background: CINZA_CLARO, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <header style={{ background: AZUL_MARINHO, color: "#fff" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 18px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: "clamp(36px, 9vw, 44px)", height: "clamp(36px, 9vw, 44px)", borderRadius: 9, background: "#fff", display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0 }}>
            <img src="/logo-fn-transparente.png" alt="FN Edificações" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <div style={{ lineHeight: 1.1, flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>FN Edificações</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>Área do Cliente</div>
          </div>
          {onIrParaCadastroParceiro && <button className="btn-ghost" onClick={onIrParaCadastroParceiro}>Seja um parceiro</button>}
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
  const [mostrarCadastroParceiro, setMostrarCadastroParceiro] = useState(false);

  if (!session) {
    if (mostrarCadastroParceiro) {
      return <TelaCadastroParceiro onVoltar={() => setMostrarCadastroParceiro(false)} />;
    }
    return mostrarLogin
      ? <TelaLogin onLogin={setSession} onVoltar={() => setMostrarLogin(false)} />
      : <PortalCliente onIrParaLogin={() => setMostrarLogin(true)} onIrParaCadastroParceiro={() => setMostrarCadastroParceiro(true)} />;
  }
  if (session.usuario.role === "afiliado") {
    return <PainelParceiro session={session} onLogout={() => { setSession(null); setMostrarLogin(false); }} />;
  }
  return <AppInterno session={session} onLogout={() => { setSession(null); setMostrarLogin(false); }} />;
}

function AppInterno({ session, onLogout }) {
  const perfil = session.usuario.role; // definido pelo backend/login — não é mais escolhido na tela
  const token = session.token;
  const [abaTop, setAbaTop] = useState("laudos"); // "laudos" | "documentacao" | "gerencia"
  const [aba, setAba] = useState("dados");
  const [abaGerencia, setAbaGerencia] = useState("visao-geral"); // "visao-geral" | "parceiros" | "financeiro"
  const [abaQualidade, setAbaQualidade] = useState("analise"); // "analise" | "vistoria" | "feedback"
  const [dados, setDados] = useState(DADOS_INICIAIS);
  const [itens, setItens] = useState([novoItem()]);
  const [clienteAtualId, setClienteAtualId] = useState(null); // id do cliente carregado no laudo em edição — necessário para "Enviar para gerência"
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
  const updCliente = async (id, patch) => {
    setClientes((atual) => atual.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    try { await apiFetch(`/api/clientes/${id}`, { method: "PATCH", token, body: patch }); }
    catch (e) { notify(`Não foi possível atualizar cliente: ${e.message}`); }
  };

  /* ---- Qualidade: avaliações que os clientes deixaram (nota + comentário) ---- */
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [avaliacoesCarregando, setAvaliacoesCarregando] = useState(false);
  const carregarAvaliacoes = async () => {
    if (perfil !== "qualidade" && perfil !== "gerencia") return;
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

  /* ---- Parceiros/Afiliados: homologação (somente perfil Gerência) ---- */
  const [parceiros, setParceiros] = useState([]);
  const [parceirosCarregando, setParceirosCarregando] = useState(false);
  const carregarParceiros = async () => {
    if (perfil !== "gerencia") return;
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

  /* ---- Vales (todos, para a gerência acompanhar leads/conversão de Parceiros) ---- */
  const [vales, setVales] = useState([]);
  const [valesCarregando, setValesCarregando] = useState(false);
  const carregarVales = async () => {
    if (perfil !== "gerencia") return;
    setValesCarregando(true);
    try {
      const r = await apiFetch("/api/vales", { token });
      setVales((r.vales || []).map(mapValeDaApi));
    } catch (e) { notify(`Não foi possível carregar vales: ${e.message}`); }
    setValesCarregando(false);
  };
  useEffect(() => { carregarVales(); }, []);

  /* ---- Preço de vistoria por empreendimento (alimenta o Financeiro) ---- */
  const [precos, setPrecos] = useState([]);
  const [precosCarregando, setPrecosCarregando] = useState(false);
  const carregarPrecos = async () => {
    if (perfil !== "gerencia") return;
    setPrecosCarregando(true);
    try {
      const r = await apiFetch("/api/precos-empreendimento", { token });
      setPrecos((r.precos || []).map(mapPrecoDaApi));
    } catch (e) { notify(`Não foi possível carregar preços por empreendimento: ${e.message}`); }
    setPrecosCarregando(false);
  };
  useEffect(() => { carregarPrecos(); }, []);
  const salvarPreco = async (empreendimento, precoVistoria) => {
    try {
      const r = await apiFetch("/api/precos-empreendimento", { method: "POST", token, body: { empreendimento, precoVistoria } });
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
  const removerPreco = async (id) => {
    try {
      await apiFetch(`/api/precos-empreendimento/${id}`, { method: "DELETE", token });
      setPrecos((atual) => atual.filter((p) => p.id !== id));
    } catch (e) { notify(`Não foi possível remover o preço: ${e.message}`); }
  };

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

  /* ---- Calendário do vistoriador: agendamentos atribuídos a ele ---- */
  const [agendaVistoriador, setAgendaVistoriador] = useState([]);
  const [agendaVistoriadorCarregando, setAgendaVistoriadorCarregando] = useState(false);
  const carregarAgendaVistoriador = async () => {
    if (perfil !== "vistoriador" && perfil !== "gerencia") return;
    setAgendaVistoriadorCarregando(true);
    try {
      const r = await apiFetch("/api/clientes/minha-agenda", { token });
      setAgendaVistoriador(r.agenda || []);
    } catch (e) { notify(`Não foi possível carregar sua agenda: ${e.message}`); }
    setAgendaVistoriadorCarregando(false);
  };
  useEffect(() => { carregarAgendaVistoriador(); }, []);

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
    if (perfil !== "gerencia" && perfil !== "qualidade") return;
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
      imovel: { ...d.imovel, construtora: cli.construtora || d.imovel.construtora, empreendimento: cli.empreendimento || d.imovel.empreendimento, unidade: cli.blocoTorre || d.imovel.unidade, endereco: cli.endereco || d.imovel.endereco },
      vistoria: {
        ...d.vistoria,
        data: cli.dataDesejada || d.vistoria.data,
        inicio: cli.horarioDesejado || d.vistoria.inicio,
        termino: cli.horarioDesejado ? somarHora(cli.horarioDesejado, 1) : d.vistoria.termino,
      },
    }));
    setClienteAtualId(cli.id);
    if (!cli.atendido) updCliente(cli.id, { atendido: true });
    if (irParaItens) { setAbaTop("laudos"); setAba("itens"); }
    notify("Dados do cliente aplicados ao laudo ✓");
  };

  /* ---- Finalizar vistoria: vistoriador envia o laudo (dados + itens) para a gerência
     revisar/aprovar remotamente. Redimensiona as fotos antes de enviar (evita payload
     enorme). Muda o status do cliente para "Laudo em análise" automaticamente. ---- */
  const [enviandoParaGerencia, setEnviandoParaGerencia] = useState(false);
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
      carregarDocs();
    } catch (e) { notify(`Não foi possível enviar para a gerência: ${e.message}`); }
    setEnviandoParaGerencia(false);
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
            <div style={{ width: "clamp(36px, 9vw, 44px)", height: "clamp(36px, 9vw, 44px)", borderRadius: 9, background: "#fff", display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0 }}>
              <img src="/logo-fn-transparente.png" alt="FN Edificações" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
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
              <button className="btn-solid" style={{ background: AZUL_MARINHO }} onClick={enviarParaGerencia} disabled={enviandoParaGerencia}>
                {enviandoParaGerencia ? <Loader2 size={15} className="spin" /> : <Send size={15} />} Enviar para gerência
              </button>
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
          {[["laudos", "Laudos", FileText], ["documentacao", "Documentação", ClipboardCheck], ["clientes", "Clientes", Users], ["qualidade", "Qualidade", Star], ["gerencia", "Gerência", BarChart3]]
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
            {[["dados", "Dados do laudo", ClipboardList], ["itens", `Vistoria (${totalItens})`, Camera], ["laudo", "Laudo final", FileText],
              ...((perfil === "vistoriador" || perfil === "gerencia") ? [["agenda", "Minha agenda", CalendarDays]] : [])]
              .map(([k, label, Icon]) => (
                <button key={k} onClick={() => setAba(k)} className="tab" style={{ borderBottomColor: aba === k ? AZUL_MEDIO : "transparent", color: aba === k ? "#fff" : "rgba(255,255,255,.6)", fontSize: 13 }}>
                  <Icon size={15} /> {label}
                </button>
              ))}
          </nav>
        )}

        {/* Sub-navegação (somente dentro do módulo Gerência) */}
        {abaTop === "gerencia" && (
          <nav style={{ maxWidth: 1080, margin: "0 auto", padding: "0 18px", display: "flex", gap: 4, background: "rgba(0,0,0,.12)" }}>
            {[["visao-geral", "Visão geral", LayoutGrid], ["parceiros", "Parceiros e Afiliados", Users], ["financeiro", "Financeiro", DollarSign]].map(([k, label, Icon]) => (
              <button key={k} onClick={() => setAbaGerencia(k)} className="tab" style={{ borderBottomColor: abaGerencia === k ? AZUL_MEDIO : "transparent", color: abaGerencia === k ? "#fff" : "rgba(255,255,255,.6)", fontSize: 13 }}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </nav>
        )}

        {/* Sub-navegação (somente dentro do módulo Qualidade) */}
        {abaTop === "qualidade" && (
          <nav style={{ maxWidth: 1080, margin: "0 auto", padding: "0 18px", display: "flex", gap: 4, background: "rgba(0,0,0,.12)" }}>
            {[["analise", "Análise", ClipboardCheck], ["vistoria", "Vistoria", CalendarDays], ["feedback", "Feedback", Star]].map(([k, label, Icon]) => (
              <button key={k} onClick={() => setAbaQualidade(k)} className="tab" style={{ borderBottomColor: abaQualidade === k ? AZUL_MEDIO : "transparent", color: abaQualidade === k ? "#fff" : "rgba(255,255,255,.6)", fontSize: 13 }}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </nav>
        )}
      </header>

      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "22px 18px 80px" }}>
        {abaTop === "laudos" && <NotificacoesClientes clientes={clientes} preencherComCliente={preencherComCliente} style={{ marginBottom: 18 }} />}
        {abaTop === "laudos" && <FaixaIndicadoresGerais docs={docs} clientes={clientes} modo="vistorias" style={{ marginBottom: 18 }} />}
        {abaTop === "documentacao" && <FaixaIndicadoresGerais docs={docs} clientes={clientes} modo="art" style={{ marginBottom: 18 }} />}

        {abaTop === "laudos" && aba === "dados" && <AbaDados dados={dados} setD={setD} setTexto={setTexto} clientes={clientes} preencherComCliente={preencherComCliente} docs={docs} updDoc={updDoc} notify={notify} token={token} />}
        {abaTop === "laudos" && aba === "itens" && (
          <AbaItens itens={itens} setItens={setItens} updItem={updItem} escolherPatologia={escolherPatologia}
            addFotos={addFotos} removerFoto={removerFoto} contagem={contagem}
            fotoCliente={dados.fotoCliente} setFotoCliente={setFotoCliente} notify={notify} />
        )}
        {abaTop === "laudos" && aba === "laudo" && <Laudo dados={dados} itens={itens} contagem={contagem} totalItens={totalItens} assinatura={assinatura} />}
        {abaTop === "laudos" && aba === "agenda" && (perfil === "vistoriador" || perfil === "gerencia") && (
          <CalendarioVistoriador agenda={agendaVistoriador} carregando={agendaVistoriadorCarregando} clientes={clientes} preencherComCliente={preencherComCliente} />
        )}

        {abaTop === "documentacao" && (
          <AbaDocumentacao docs={docs} addDoc={addDoc} updDoc={updDoc} delDoc={delDoc} carregando={docsCarregando} notify={notify} />
        )}
        {abaTop === "clientes" && (
          <AbaClientesComercial clientes={clientes} carregando={clientesCarregando} atualizarCliente={updCliente} notify={notify} docs={docs} />
        )}
        {abaTop === "qualidade" && (
          <AbaQualidade sub={abaQualidade} avaliacoes={avaliacoes} carregando={avaliacoesCarregando} docs={docs} docsCarregando={docsCarregando} aprovarAvaliacao={aprovarAvaliacao}
            clientes={clientes} clientesCarregando={clientesCarregando} updCliente={updCliente} usuarios={usuarios} notify={notify} preencherComCliente={preencherComCliente} />
        )}
        {abaTop === "gerencia" && (
          <AbaGerencia sub={abaGerencia} docs={docs} clientes={clientes} carregando={docsCarregando} assinatura={assinatura} salvarAssinatura={salvarAssinatura} removerAssinatura={removerAssinatura} notify={notify}
            usuarios={usuarios} usuariosCarregando={usuariosCarregando} criarUsuario={criarUsuario} atualizarUsuario={atualizarUsuario} excluirUsuario={excluirUsuario} usuarioAtualId={session.usuario.id}
            avaliacoes={avaliacoes} avaliacoesCarregando={avaliacoesCarregando}
            parceiros={parceiros} parceirosCarregando={parceirosCarregando} atualizarParceiro={atualizarParceiro}
            vales={vales} valesCarregando={valesCarregando}
            precos={precos} precosCarregando={precosCarregando} salvarPreco={salvarPreco} removerPreco={removerPreco}
            laudosPendentes={laudosPendentes} laudosPendentesCarregando={laudosPendentesCarregando} aprovarLaudo={aprovarLaudo} />
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

function CalendarioVistoriador({ agenda = [], carregando, clientes = [], preencherComCliente }) {
  const [mesRef, setMesRef] = useState(() => { const h = new Date(); return new Date(h.getFullYear(), h.getMonth(), 1); });
  const [diaSelecionado, setDiaSelecionado] = useState(null);

  const porData = agenda.reduce((acc, a) => {
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
      <Card icon={CalendarDays} titulo="Minha agenda">
        <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 14px" }}>
          Vistorias atribuídas a você. Clique num dia do calendário pra ver só os agendamentos daquela data. Apenas consulta — a atribuição e o agendamento são feitos pela Qualidade/Gerência.
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
                <div key={a.id} style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ width: 56, textAlign: "center", flexShrink: 0, fontSize: 15, fontWeight: 800, color: AZUL_MEDIO }}>
                    {a.horario_desejado || "—"}
                  </div>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{a.nome}</div>
                    <div style={{ fontSize: 12.5, color: "#65758b" }}>
                      {a.servico}{a.empreendimento ? ` · ${a.empreendimento}` : ""}{a.bloco_torre ? ` (${a.bloco_torre})` : ""}
                    </div>
                  </div>
                  <Selo valor={a.atendido ? "Concluída" : "Agendada"} />
                  {preencherComCliente && (
                    <button className="btn-solid" style={{ width: "auto", padding: "8px 14px" }}
                      onClick={() => {
                        const cli = clientes.find((c) => c.id === a.id);
                        if (cli) preencherComCliente(cli, { irParaItens: true });
                      }}>
                      <Check size={14} /> Iniciar vistoria
                    </button>
                  )}
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
/* Ordem das colunas do Kanban — mesmas etapas do status dinâmico (etapaAtualCliente),
   só numa ordem lógica de pipeline em vez da ordem que aparecem nos dados. */
const ETAPA_ORDEM = ["Em análise", "Agendamento aprovado", "Vistoria agendada", "Agendado", "Laudo em análise", "Laudo enviado por e-mail", "Cancelado"];

function KanbanClientes({ clientes, docs, onAbrir }) {
  const porEtapa = {};
  clientes.forEach((c) => {
    const et = etapaAtualCliente(c, docs);
    (porEtapa[et] = porEtapa[et] || []).push(c);
  });
  const etapas = [...ETAPA_ORDEM.filter((e) => porEtapa[e]), ...Object.keys(porEtapa).filter((e) => !ETAPA_ORDEM.includes(e))];

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

function AbaClientesComercial({ clientes, carregando, atualizarCliente, notify, docs = [] }) {
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState(null); // cópia do cliente em edição
  const [visualizacao, setVisualizacao] = useState("kanban"); // "kanban" | "tabela"

  const filtrados = clientes.filter((c) =>
    !busca || `${c.nome} ${c.empreendimento} ${c.construtora}`.toLowerCase().includes(busca.toLowerCase())
  );

  const abrirEdicao = (c) => setEditando({ ...c });
  const salvar = async () => {
    try {
      await atualizarCliente(editando.id, editando);
      setEditando(null);
      notify("Cliente atualizado ✓");
    } catch (e) { notify(`Erro: ${e.message}`); }
  };

  const contagemPorEtapa = {};
  clientes.forEach((c) => { const et = etapaAtualCliente(c, docs); contagemPorEtapa[et] = (contagemPorEtapa[et] || 0) + 1; });

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {Object.keys(contagemPorEtapa).length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {Object.entries(contagemPorEtapa).map(([etapa, qtd]) => (
            <div key={etapa} style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: "8px 12px" }}>
              <Selo valor={etapa} />
              <strong style={{ fontSize: 14 }}>{qtd}</strong>
            </div>
          ))}
        </div>
      )}
      <Card icon={Users} titulo={`Clientes cadastrados (${clientes.length})`}>
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
                    <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{c.cpf || "—"}</td>
                    <td style={{ padding: "8px 10px" }}>{c.empreendimento || "—"}{c.blocoTorre ? ` · ${c.blocoTorre}` : ""}</td>
                    <td style={{ padding: "8px 10px" }}>{c.servico || "—"}</td>
                    <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                      {c.dataDesejada ? c.dataDesejada.split("-").reverse().join("/") : "sem data"}{c.horarioDesejado ? ` · ${c.horarioDesejado}` : ""}
                    </td>
                    <td style={{ padding: "8px 10px" }}><Selo valor={etapaAtualCliente(c, docs)} /></td>
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
              <Field label="Horário desejado" type="time" value={editando.horarioDesejado} onChange={(v) => setEditando({ ...editando, horarioDesejado: v })} />
              <div style={cell(true)}>
                <label style={lab}>Status do agendamento</label>
                <select style={inp} value={editando.atendido ? "1" : "0"} onChange={(e) => setEditando({ ...editando, atendido: e.target.value === "1" })}>
                  <option value="0">Agendado / pendente</option>
                  <option value="1">Concluído</option>
                </select>
              </div>
            </Grid>
            <Area label="Observações" value={editando.observacoes} onChange={(v) => setEditando({ ...editando, observacoes: v })} rows={2} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO }} onClick={() => setEditando(null)}>Cancelar</button>
              <button className="btn-solid" onClick={salvar}><Save size={15} /> Salvar</button>
            </div>
          </div>
        </div>
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
function LinhaDoTempo({ doc, avaliacao }) {
  const etapas = [
    { label: "Solicitado", cor: "#2E7D32", ativa: true },
    { label: "Vistoria", cor: doc.vistoria === "Concluída" ? "#2E7D32" : doc.vistoria === "Cancelada" ? "#8593a8" : "#2C75B5", ativa: true },
    { label: "ART Documentações", cor: doc.statusProducao === "Realizado" ? "#2E7D32" : "#B26A00", ativa: doc.statusProducao !== "Recebido" },
    { label: "Avaliação", cor: "#F5A623", ativa: !!avaliacao },
  ];
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
function CardIndicadoresQualidade({ clientes = [], docs = [], avaliacoes = [] }) {
  const porEtapa = {};
  clientes.forEach((c) => { const et = etapaAtualCliente(c, docs); porEtapa[et] = (porEtapa[et] || 0) + 1; });

  const porStatusProducao = {};
  docs.forEach((d) => { porStatusProducao[d.statusProducao] = (porStatusProducao[d.statusProducao] || 0) + 1; });

  const totalAvaliacoes = avaliacoes.length;
  const media = totalAvaliacoes ? (avaliacoes.reduce((s, a) => s + a.nota, 0) / totalAvaliacoes) : 0;

  return (
    <Card icon={LayoutGrid} titulo="Indicadores da Qualidade">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: AZUL_MARINHO, marginBottom: 8 }}>Clientes por etapa do fluxo</div>
          <div style={{ display: "grid", gap: 6 }}>
            {Object.keys(porEtapa).length === 0 && <span style={{ fontSize: 13, color: "#8593a8" }}>Nenhum cliente ainda.</span>}
            {Object.entries(porEtapa).map(([etapa, qtd]) => (
              <div key={etapa} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Selo valor={etapa} />
                <strong style={{ fontSize: 13 }}>{qtd}</strong>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: AZUL_MARINHO, marginBottom: 8 }}>ART Documentações por status</div>
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

function AbaQualidade({ sub = "analise", clientes, clientesCarregando, updCliente, usuarios, notify, preencherComCliente, avaliacoes, carregando, docs, docsCarregando, aprovarAvaliacao }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <CardIndicadoresQualidade clientes={clientes} docs={docs} avaliacoes={avaliacoes} />
      {sub === "vistoria" && <AbaQualidadeVistoria clientes={clientes} docs={docs} carregando={clientesCarregando} updCliente={updCliente} usuarios={usuarios} notify={notify} />}
      {sub === "feedback" && <AbaQualidadeFeedback avaliacoes={avaliacoes} carregando={carregando} docs={docs} docsCarregando={docsCarregando} aprovarAvaliacao={aprovarAvaliacao} />}
      {sub === "analise" && <AbaQualidadeAnalise clientes={clientes} carregando={clientesCarregando} updCliente={updCliente} notify={notify} />}
    </div>
  );
}

function AbaQualidadeFeedback({ avaliacoes, carregando, docs, docsCarregando, aprovarAvaliacao }) {
  const [busca, setBusca] = useState("");
  const total = avaliacoes.length;
  const media = total ? (avaliacoes.reduce((s, a) => s + a.nota, 0) / total) : 0;
  const contagemPorNota = [5, 4, 3, 2, 1].map((n) => ({ n, qtd: avaliacoes.filter((a) => a.nota === n).length }));

  const avaliacaoPorDoc = {};
  avaliacoes.forEach((a) => { if (a.doc_id) avaliacaoPorDoc[a.doc_id] = a; });

  const termo = busca.trim().toLowerCase();
  const docsFiltrados = docs.filter((d) =>
    !termo || `${d.cliente} ${d.empreendimento}`.toLowerCase().includes(termo)
  );

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
                  {a.empreendimento && <div style={{ fontSize: 12, color: "#65758b", marginBottom: 6 }}>{a.empreendimento}</div>}
                  {a.comentario && <div style={{ fontSize: 13.5, color: "#334", background: CINZA_CLARO, borderRadius: 8, padding: "8px 10px", marginBottom: 8 }}>{a.comentario}</div>}
                  {aprovarAvaliacao && (
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
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <Card icon={ClipboardCheck} titulo="Acompanhamento do atendimento — do início ao fim">
        <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 12px" }}>
          Veja em que etapa está cada atendimento: solicitação, vistoria, ART/TRT, relatório e, por fim, a avaliação do cliente.
        </p>
        <input style={{ ...inp, marginBottom: 14 }} placeholder="Buscar por cliente ou empreendimento…" value={busca} onChange={(e) => setBusca(e.target.value)} />

        {docsCarregando && <p style={{ color: "#8593a8", fontSize: 14 }}>Carregando…</p>}
        {!docsCarregando && docsFiltrados.length === 0 && <p style={{ color: "#8593a8", fontSize: 14 }}>Nenhum atendimento encontrado.</p>}

        <div style={{ display: "grid", gap: 14 }}>
          {docsFiltrados.map((d) => (
            <div key={d.id} style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                <strong style={{ fontSize: 14 }}>{d.cliente || "—"}</strong>
                <span style={{ fontSize: 12, color: "#65758b" }}>{d.empreendimento}{d.blocoTorre ? ` · ${d.blocoTorre}` : ""}</span>
              </div>
              <LinhaDoTempo doc={d} avaliacao={avaliacaoPorDoc[d.id]} />
              {avaliacaoPorDoc[d.id] && (
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  <Estrelas valor={avaliacaoPorDoc[d.id].nota} tamanho={13} />
                  {avaliacaoPorDoc[d.id].comentario && <span style={{ fontSize: 12.5, color: "#65758b" }}>"{avaliacaoPorDoc[d.id].comentario}"</span>}
                </div>
              )}
            </div>
          ))}
        </div>
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

/* ================= Qualidade · Análise: valida agendamento antes de liberar (checa cruzamento de horário) ================= */
function AbaQualidadeAnalise({ clientes = [], carregando, updCliente, notify }) {
  const [mesRef, setMesRef] = useState(() => { const h = new Date(); return new Date(h.getFullYear(), h.getMonth(), 1); });
  const [diaSelecionado, setDiaSelecionado] = useState(null);

  // Todos os agendamentos (qualquer status), pra dar visão completa da agenda no calendário
  // e ajudar a enxergar cruzamento de horário antes de aprovar.
  const porDataTodos = clientes.reduce((acc, c) => {
    if (!c.dataDesejada) return acc;
    (acc[c.dataDesejada] = acc[c.dataDesejada] || []).push(c);
    return acc;
  }, {});

  const pendentesTodos = clientes.filter((c) => c.status === "Em análise");
  const pendentes = diaSelecionado ? pendentesTodos.filter((c) => c.dataDesejada === diaSelecionado) : pendentesTodos;
  const outrosNoDia = diaSelecionado ? (porDataTodos[diaSelecionado] || []).filter((c) => c.status !== "Em análise") : [];

  const aprovar = async (c) => {
    try { await updCliente(c.id, { status: "Agendamento aprovado" }); notify("Agendamento aprovado ✓"); }
    catch (e) { notify(`Erro: ${e.message}`); }
  };
  const cancelar = async (c) => {
    try { await updCliente(c.id, { status: "Cancelado" }); notify("Agendamento cancelado"); }
    catch (e) { notify(`Erro: ${e.message}`); }
  };
  return (
    <Card icon={ClipboardCheck} titulo={`Aguardando análise (${pendentesTodos.length})`}>
      <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 14px" }}>
        Confira se não há cruzamento de horário com outro agendamento antes de aprovar. Clique num dia do calendário pra ver a agenda completa daquela data.
      </p>

      <CalendarioMensal porData={porDataTodos} mesRef={mesRef} setMesRef={setMesRef} diaSelecionado={diaSelecionado} setDiaSelecionado={setDiaSelecionado} />

      {diaSelecionado && (
        <div style={{ marginBottom: 14 }}>
          <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO, marginBottom: 10 }} onClick={() => setDiaSelecionado(null)}>
            <X size={14} /> Ver todos os dias
          </button>
          {outrosNoDia.length > 0 && (
            <div style={{ background: "#EAF2FB", borderRadius: 8, padding: 10, fontSize: 12.5, color: AZUL_MARINHO }}>
              <strong>Já agendados nesse dia:</strong> {outrosNoDia.map((c) => `${c.nome} (${c.horarioDesejado || "sem horário"})`).join(", ")}
            </div>
          )}
        </div>
      )}

      {carregando && <p style={{ color: "#8593a8", fontSize: 14 }}>Carregando…</p>}
      {!carregando && pendentesTodos.length === 0 && <p style={{ color: "#8593a8", fontSize: 14 }}>Nenhum cadastro aguardando análise.</p>}
      {!carregando && pendentesTodos.length > 0 && pendentes.length === 0 && <p style={{ color: "#8593a8", fontSize: 14 }}>Nenhum cadastro aguardando análise nesse dia.</p>}
      <div style={{ display: "grid", gap: 10 }}>
        {pendentes.map((c) => {
          const conflitos = conflitosDeHorario(c, clientes);
          return (
            <div key={c.id} style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                <div>
                  <strong style={{ fontSize: 14 }}>{c.nome}</strong>
                  <div style={{ fontSize: 12, color: "#65758b" }}>{c.empreendimento || "—"}{c.blocoTorre ? ` · ${c.blocoTorre}` : ""}</div>
                </div>
                <div style={{ fontSize: 13, textAlign: "right" }}>
                  {c.dataDesejada ? c.dataDesejada.split("-").reverse().join("/") : "sem data"}{c.horarioDesejado ? ` · ${c.horarioDesejado}` : ""}
                </div>
              </div>
              {conflitos.length > 0 && (
                <div style={{ marginTop: 8, background: "#FFF4E0", color: "#B26A00", padding: "8px 10px", borderRadius: 8, fontSize: 12.5 }}>
                  <AlertTriangle size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                  Cruza com {conflitos.length} outro(s) agendamento(s) no mesmo horário: {conflitos.map((x) => x.nome).join(", ")}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <button className="btn-solid" style={{ width: "auto", padding: "8px 16px" }} onClick={() => aprovar(c)}>
                  <Check size={15} /> Aprovar agendamento
                </button>
                <button className="btn-ghost" style={{ color: "#C62828", background: "#FCEAEA" }} onClick={() => cancelar(c)}>
                  <X size={15} /> Cancelar agendamento
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
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
function AbaQualidadeVistoria({ clientes = [], docs = [], carregando, updCliente, usuarios = [], notify }) {
  const [busca, setBusca] = useState("");
  const [abertoId, setAbertoId] = useState(null);
  const [form, setForm] = useState({});
  const vistoriadores = usuarios.filter((u) => u.role === "vistoriador" && u.ativo);

  const temDoc = (c) => {
    const cpfLimpo = (c.cpf || "").replace(/\D/g, "");
    return cpfLimpo && docs.some((d) => (d.cpf || "").replace(/\D/g, "") === cpfLimpo);
  };
  const termo = busca.trim().toLowerCase();
  const combina = (c) => !termo || `${c.nome} ${c.empreendimento}`.toLowerCase().includes(termo);

  const pendentes = clientes.filter((c) => c.status === "Agendamento aprovado" && combina(c));
  const agendadas = clientes.filter((c) => c.status === "Vistoria agendada" && !temDoc(c) && combina(c));
  const realizadas = clientes.filter((c) => c.status === "Vistoria agendada" && temDoc(c) && combina(c));

  const setCampo = (id, campo, valor) => setForm((f) => ({ ...f, [id]: { ...f[id], [campo]: valor } }));
  const valorCampo = (c, campo, padrao) => form[c.id]?.[campo] ?? padrao;

  const confirmar = async (c) => {
    const vistoriadorId = valorCampo(c, "vistoriadorId", "");
    const dataDesejada = valorCampo(c, "dataDesejada", c.dataDesejada);
    const horarioDesejado = valorCampo(c, "horarioDesejado", c.horarioDesejado);
    if (!vistoriadorId) { notify("Escolha o vistoriador responsável"); return; }
    try {
      await updCliente(c.id, { vistoriadorId, dataDesejada, horarioDesejado, status: "Vistoria agendada" });
      notify("Vistoria agendada ✓ — já aparece na agenda do técnico");
    } catch (e) { notify(`Erro: ${e.message}`); }
  };

  const nomeVistoriador = (id) => vistoriadores.find((v) => v.id === id)?.nome || usuarios.find((u) => u.id === id)?.nome || "—";

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
                          <select style={inp} value={valorCampo(c, "vistoriadorId", "")} onChange={(e) => setCampo(c.id, "vistoriadorId", e.target.value)}>
                            <option value="">selecionar…</option>
                            {vistoriadores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
                          </select>
                        </div>
                        <Field label="Data" type="date" value={valorCampo(c, "dataDesejada", c.dataDesejada)} onChange={(v) => setCampo(c.id, "dataDesejada", v)} />
                        <Field label="Horário" type="time" value={valorCampo(c, "horarioDesejado", c.horarioDesejado)} onChange={(v) => setCampo(c.id, "horarioDesejado", v)} />
                      </Grid>
                      <button className="btn-solid" style={{ marginTop: 10, width: "auto", padding: "8px 16px" }} onClick={() => confirmar(c)}>
                        <Check size={15} /> Confirmar agendamento
                      </button>
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: "#4a5a70", display: "grid", gap: 4 }}>
                      <div><strong>Telefone:</strong> {c.telefone || "—"}</div>
                      <div><strong>Construtora:</strong> {c.construtora || "—"}</div>
                      <div><strong>Vistoriador:</strong> {nomeVistoriador(c.vistoriadorId)}</div>
                      <div><strong>Status:</strong> <Selo valor={etapaAtualCliente(c, docs)} /></div>
                    </div>
                  )}
                </CardVistoriaResumo>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CardAndamentoAtendimento({ cpf, docs = [], updDoc, notify, token }) {
  const cpfLimpo = (cpf || "").replace(/\D/g, "");
  const doc = docs.find((d) => cpfLimpo && (d.cpf || "").replace(/\D/g, "") === cpfLimpo);
  const [statusInterno, setStatusInterno] = useState(doc?.status || STATUS_INTERNO_OPCOES[0]);
  const [salvando, setSalvando] = useState(false);
  const [historico, setHistorico] = useState([]);

  useEffect(() => { setStatusInterno(doc?.status || STATUS_INTERNO_OPCOES[0]); }, [doc?.id, doc?.status]);

  useEffect(() => {
    if (!doc?.id) { setHistorico([]); return; }
    (async () => {
      try {
        const r = await apiFetch(`/api/docs/${doc.id}/historico`, { token });
        setHistorico(r.historico || []);
      } catch { setHistorico([]); }
    })();
  }, [doc?.id]);

  const atualizar = async () => {
    setSalvando(true);
    try {
      await updDoc(doc.id, { status: statusInterno });
      notify("Status interno atualizado ✓");
    } catch (e) { notify(`Não foi possível atualizar: ${e.message}`); }
    setSalvando(false);
  };

  return (
    <Card icon={ClipboardCheck} titulo="Andamento do atendimento">
      {!cpfLimpo && (
        <p style={{ color: "#8593a8", fontSize: 14 }}>Informe o CPF do contratante acima para localizar (ou criar) o acompanhamento deste cliente.</p>
      )}

      {cpfLimpo && !doc && (
        <p style={{ color: "#8593a8", fontSize: 14 }}>
          Nenhum registro de atendimento encontrado para este CPF ainda. Ele é criado automaticamente quando o vistoriador
          envia o laudo para a gerência, ou manualmente na aba "Documentação".
        </p>
      )}

      {cpfLimpo && doc && (
        <>
          <div style={{ marginBottom: 16 }}>
            <label style={lab}>Status visto pelo cliente (automático)</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
              <Selo valor={doc.statusCliente || "Agendado"} />
              <span style={{ fontSize: 12.5, color: "#65758b" }}>{STATUS_ATENDIMENTO_INFO[doc.statusCliente] || ""}</span>
            </div>
            <p style={{ fontSize: 11.5, color: "#8593a8", marginTop: 6 }}>
              Muda sozinho: quando o vistoriador envia o laudo para a gerência, e quando a gerência aprova (o laudo é
              enviado por e-mail automaticamente). Não é editável manualmente aqui.
            </p>
          </div>

          {historico.length > 0 && (
            <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: `1px dashed ${CINZA_BORDA}` }}>
              <label style={lab}>Histórico</label>
              <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
                {historico.map((h, i) => (
                  <div key={i} style={{ fontSize: 12, color: "#4a5a70", display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span>{h.status_cliente}</span>
                    <span style={{ color: "#8593a8", whiteSpace: "nowrap" }}>{new Date(h.criado_em).toLocaleString("pt-BR")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Grid>
            <div style={cell(true)}>
              <label style={lab}>Status interno (uso da equipe — o cliente não vê isso)</label>
              <select style={inp} value={statusInterno} onChange={(e) => setStatusInterno(e.target.value)}>
                {STATUS_INTERNO_OPCOES.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </Grid>
          {doc.atualizadoEm && (
            <div style={{ fontSize: 12, color: "#8593a8", marginTop: 8 }}>
              Última atualização: {new Date(doc.atualizadoEm).toLocaleString("pt-BR")}
            </div>
          )}
          <button className="btn-solid" style={{ marginTop: 12 }} onClick={atualizar} disabled={salvando}>
            {salvando ? <Loader2 size={15} className="spin" /> : <Check size={15} />} Atualizar status interno
          </button>
        </>
      )}
    </Card>
  );
}

function AbaDados({ dados, setD, setTexto, clientes = [], preencherComCliente, docs = [], updDoc, notify, token }) {
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

      <CardAndamentoAtendimento cpf={dados.contratante.cpf} docs={docs} updDoc={updDoc} notify={notify} token={token} />

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
function AbaItens({ itens, setItens, updItem, escolherPatologia, addFotos, removerFoto, contagem, fotoCliente, setFotoCliente, notify }) {
  const handleFotoCliente = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { notify("Envie uma imagem (PNG ou JPG)"); return; }
    const reader = new FileReader();
    reader.onload = (e) => setFotoCliente(e.target.result);
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Card icon={Camera} titulo="Foto com o cliente (obrigatória)">
          <p style={{ fontSize: 13, color: "#65758b", margin: "0 0 10px" }}>
            Uma foto sua com o cliente durante a vistoria. Necessária para enviar o laudo para a gerência. Aparece na última página do laudo final (como agradecimento) e na página de acompanhamento do cliente.
          </p>
          {fotoCliente ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img src={fotoCliente} alt="Foto com o cliente" style={{ width: 110, height: 110, objectFit: "cover", borderRadius: 8, border: `1px solid ${CINZA_BORDA}` }} />
              <button className="btn-ghost" style={{ color: "#C62828" }} onClick={() => setFotoCliente(null)}><X size={14} /> Remover foto</button>
            </div>
          ) : (
            <label className="btn-ghost" style={{ display: "inline-flex", cursor: "pointer", width: "auto" }}>
              <Camera size={15} /> Adicionar foto
              <input type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                onChange={(e) => { handleFotoCliente(e.target.files[0]); e.target.value = ""; }} />
            </label>
          )}
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

        {validos.length === 0 && <p style={{ color: "#8593a8", fontSize: 14 }}>Nenhum item cadastrado. Adicione itens na aba "Vistoria".</p>}
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
  const avancarStatusProducao = (d) => {
    const i = STATUS_PRODUCAO_OPCOES.indexOf(d.statusProducao);
    const proximo = STATUS_PRODUCAO_OPCOES[(i + 1) % STATUS_PRODUCAO_OPCOES.length];
    updDoc(d.id, { statusProducao: proximo });
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card icon={ClipboardCheck} titulo="ART Documentações — controle de vistorias e documentação">
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
function CardLaudosPendentes({ laudosPendentes = [], carregando, aprovarLaudo, assinatura, notify }) {
  const [previewId, setPreviewId] = useState(null);
  const [aprovandoId, setAprovandoId] = useState(null);
  const laudoPreview = laudosPendentes.find((l) => l.doc_id === previewId);

  const aprovar = async (docId) => {
    setAprovandoId(docId);
    await aprovarLaudo(docId);
    setAprovandoId(null);
    if (previewId === docId) setPreviewId(null);
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
              <div style={{ fontWeight: 700, fontSize: 14 }}>{l.cliente}</div>
              <div style={{ fontSize: 12.5, color: "#65758b" }}>
                {l.empreendimento}{l.bloco_torre ? ` · ${l.bloco_torre}` : ""} · enviado em {new Date(l.laudo_criado_em).toLocaleString("pt-BR")}
              </div>
            </div>
            <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO }} onClick={() => setPreviewId(l.doc_id)}>
              <Eye size={14} /> Pré-visualizar
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
              <strong>Pré-visualização do laudo</strong>
              <button className="icon-btn" onClick={() => setPreviewId(null)}><X size={16} /></button>
            </div>
            <Laudo dados={laudoPreview.dados} itens={laudoPreview.itens || []} contagem={contagemPreview} totalItens={(laudoPreview.itens || []).length} assinatura={assinatura} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO }} onClick={() => setPreviewId(null)}>Fechar</button>
              <button className="btn-solid" onClick={() => aprovar(laudoPreview.doc_id)} disabled={aprovandoId === laudoPreview.doc_id}>
                {aprovandoId === laudoPreview.doc_id ? <Loader2 size={14} className="spin" /> : <Mail size={14} />} Aprovar e enviar por e-mail
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function AbaGerenciaVisaoGeral({ docs, clientes, carregando, assinatura, salvarAssinatura, removerAssinatura, notify, usuarios, usuariosCarregando, criarUsuario, atualizarUsuario, excluirUsuario, usuarioAtualId, avaliacoes, avaliacoesCarregando, laudosPendentes, laudosPendentesCarregando, aprovarLaudo }) {
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

      <CardLaudosPendentes laudosPendentes={laudosPendentes} carregando={laudosPendentesCarregando} aprovarLaudo={aprovarLaudo} assinatura={assinatura} notify={notify} />

      <CardIndicadoresGerais docs={docs} clientes={clientes} />

      <CardCadastrosClientes clientes={clientes} />

      <Card icon={Star} titulo="Qualidade — avaliações dos clientes">
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
              <div style={{ fontSize: 13, color: "#65758b" }}>{avaliacoes.length} avaliação(ões) recebida(s). Veja os comentários completos na aba Qualidade.</div>
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

      <CardUsuarios usuarios={usuarios} carregando={usuariosCarregando} criarUsuario={criarUsuario} atualizarUsuario={atualizarUsuario} excluirUsuario={excluirUsuario} notify={notify} usuarioAtualId={usuarioAtualId} />

      <CardAssinaturaGerencia assinatura={assinatura} salvarAssinatura={salvarAssinatura} removerAssinatura={removerAssinatura} notify={notify} />
    </div>
  );
}

/* ---- Gerência · Parceiros e Afiliados ---- */
function CardIndicadoresParceiros({ parceiros, vales, valesCarregando }) {
  const ativos = parceiros.filter((p) => p.status === "aprovado").length;
  const leadsEnviados = vales.length;
  const valesUsados = vales.filter((v) => v.status === "usado").length;
  const taxaConversao = leadsEnviados > 0 ? (valesUsados / leadsEnviados) * 100 : 0;

  return (
    <Card icon={TrendingUp} titulo="Indicadores de Parceiros e Afiliados">
      {valesCarregando && <p style={{ color: "#8593a8", fontSize: 14, marginBottom: 10 }}>Carregando vales…</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        <KpiCard label="Parceiros ativos" valor={ativos} Icon={Users} />
        <KpiCard label="Leads enviados" valor={leadsEnviados} cor="#2C75B5" Icon={TrendingUp} />
        <KpiCard label="Taxa de conversão" valor={`${taxaConversao.toFixed(0)}%`} cor="#2E7D32" Icon={Percent} />
        <KpiCard label="Vendas por indicação" valor={valesUsados} cor="#2E7D32" Icon={Check} />
        <KpiCard label="Comissão gerada" valor="—" cor="#8593a8" Icon={DollarSign} />
      </div>
      <p style={{ fontSize: 12, color: "#8593a8", marginTop: 12 }}>
        "Leads enviados" e "taxa de conversão" são calculados a partir dos códigos de benefício (vales) gerados e ativados pelos clientes.
        "Comissão gerada" ainda não tem dado real — os vales não registram o valor da venda, só o benefício concedido.
      </p>
    </Card>
  );
}
function AbaGerenciaParceiros({ parceiros, parceirosCarregando, atualizarParceiro, vales, valesCarregando, notify }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <CardIndicadoresParceiros parceiros={parceiros} vales={vales} valesCarregando={valesCarregando} />
      <CardParceiros parceiros={parceiros} carregando={parceirosCarregando} atualizarParceiro={atualizarParceiro} notify={notify} />
    </div>
  );
}

/* ---- Gerência · Financeiro ---- */
function CardPrecoEmpreendimento({ precos, carregando, salvarPreco, removerPreco, clientes, notify }) {
  const [novoEmpreendimento, setNovoEmpreendimento] = useState("");
  const [novoPreco, setNovoPreco] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [editandoValor, setEditandoValor] = useState("");

  const empreendimentosConhecidos = [...new Set(clientes.map((c) => c.empreendimento?.trim()).filter(Boolean))].sort();

  const adicionar = async () => {
    if (!novoEmpreendimento.trim()) { notify("Informe o empreendimento"); return; }
    const preco = Number(novoPreco);
    if (!Number.isFinite(preco) || preco < 0) { notify("Informe um preço de vistoria válido"); return; }
    setSalvando(true);
    const ok = await salvarPreco(novoEmpreendimento.trim(), preco);
    if (ok) { setNovoEmpreendimento(""); setNovoPreco(""); notify("Preço salvo ✓"); }
    setSalvando(false);
  };
  const iniciarEdicao = (p) => { setEditandoId(p.id); setEditandoValor(String(p.precoVistoria)); };
  const salvarEdicao = async (p) => {
    const preco = Number(editandoValor);
    if (!Number.isFinite(preco) || preco < 0) { notify("Informe um preço de vistoria válido"); return; }
    const ok = await salvarPreco(p.empreendimento, preco);
    if (ok) { setEditandoId(null); notify("Preço atualizado ✓"); }
  };

  return (
    <Card icon={DollarSign} titulo="Preço de vistoria por empreendimento">
      <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 14px" }}>
        Cadastre o valor da vistoria de cada empreendimento. Esse preço alimenta automaticamente o cálculo de receita de vistoria abaixo.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <input list="empreendimentos-conhecidos" style={{ ...inp, flex: 1, minWidth: 200 }} placeholder="Empreendimento" value={novoEmpreendimento} onChange={(e) => setNovoEmpreendimento(e.target.value)} />
        <datalist id="empreendimentos-conhecidos">{empreendimentosConhecidos.map((e) => <option key={e} value={e} />)}</datalist>
        <input style={{ ...inp, width: 140 }} type="number" min="0" step="0.01" placeholder="Preço (R$)" value={novoPreco} onChange={(e) => setNovoPreco(e.target.value)} />
        <button className="btn-solid" style={{ width: "auto", padding: "9px 16px" }} onClick={adicionar} disabled={salvando}>
          {salvando ? <Loader2 size={15} className="spin" /> : <Plus size={15} />} Salvar
        </button>
      </div>

      {carregando && <p style={{ color: "#8593a8", fontSize: 14 }}>Carregando…</p>}
      {!carregando && precos.length === 0 && <p style={{ color: "#8593a8", fontSize: 14 }}>Nenhum preço cadastrado ainda.</p>}
      {precos.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: CINZA_CLARO }}>
                {["Empreendimento", "Preço da vistoria", ""].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: AZUL_MARINHO, borderBottom: `2px solid ${CINZA_BORDA}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {precos.map((p) => (
                <tr key={p.id} style={{ borderBottom: `1px solid ${CINZA_BORDA}` }}>
                  <td style={{ padding: "8px 10px", fontWeight: 600 }}>{p.empreendimento}</td>
                  <td style={{ padding: "8px 10px" }}>
                    {editandoId === p.id
                      ? <input type="number" min="0" step="0.01" style={{ ...inp, width: 120, padding: "5px 8px" }} value={editandoValor} onChange={(e) => setEditandoValor(e.target.value)} autoFocus />
                      : fmtReal(p.precoVistoria)}
                  </td>
                  <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                    {editandoId === p.id ? (
                      <>
                        <button className="icon-btn" onClick={() => salvarEdicao(p)}><Check size={15} color="#2E7D32" /></button>
                        <button className="icon-btn" onClick={() => setEditandoId(null)}><X size={15} /></button>
                      </>
                    ) : (
                      <>
                        <button className="icon-btn" onClick={() => iniciarEdicao(p)}><Edit3 size={15} color={AZUL_MEDIO} /></button>
                        <button className="icon-btn" onClick={() => removerPreco(p.id)}><Trash2 size={15} color="#c62828" /></button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
function CardReceitaVistoriaEstimada({ precos, clientes }) {
  const precoPorEmpreendimento = {};
  precos.forEach((p) => { precoPorEmpreendimento[p.empreendimento] = p.precoVistoria; });

  const vistoriasAtendidas = clientes.filter((c) => c.servico === SERVICO_VISTORIA && c.atendido);
  const porEmpreendimento = {};
  vistoriasAtendidas.forEach((c) => {
    const k = c.empreendimento?.trim() || "(sem empreendimento)";
    const temPreco = Object.prototype.hasOwnProperty.call(precoPorEmpreendimento, k);
    if (!porEmpreendimento[k]) porEmpreendimento[k] = { qtd: 0, receita: 0, temPreco };
    porEmpreendimento[k].qtd += 1;
    porEmpreendimento[k].receita += temPreco ? precoPorEmpreendimento[k] : 0;
  });

  const linhas = Object.entries(porEmpreendimento).sort((a, b) => b[1].receita - a[1].receita);
  const totalReceita = linhas.reduce((s, [, v]) => s + v.receita, 0);
  const semPreco = linhas.filter(([, v]) => !v.temPreco);

  return (
    <Card icon={TrendingUp} titulo="Receita de vistoria estimada (por empreendimento)">
      <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 14px" }}>
        Calculada automaticamente: preço cadastrado × quantidade de vistorias já atendidas em cada empreendimento.
      </p>
      {linhas.length === 0 && <p style={{ color: "#8593a8", fontSize: 14 }}>Nenhuma vistoria atendida ainda.</p>}
      {linhas.length > 0 && (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: CINZA_CLARO }}>
                  {["Empreendimento", "Vistorias atendidas", "Receita"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: AZUL_MARINHO, borderBottom: `2px solid ${CINZA_BORDA}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map(([nome, v]) => (
                  <tr key={nome} style={{ borderBottom: `1px solid ${CINZA_BORDA}` }}>
                    <td style={{ padding: "8px 10px", fontWeight: 600 }}>{nome}</td>
                    <td style={{ padding: "8px 10px" }}>{v.qtd}</td>
                    <td style={{ padding: "8px 10px", color: v.temPreco ? AZUL_MARINHO : "#B26A00", fontWeight: v.temPreco ? 700 : 400 }}>
                      {v.temPreco ? fmtReal(v.receita) : "sem preço cadastrado"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${CINZA_BORDA}`, fontSize: 14 }}>
            <strong style={{ color: AZUL_MARINHO }}>Total estimado: </strong>{fmtReal(totalReceita)}
          </div>
          {semPreco.length > 0 && (
            <div style={{ marginTop: 10, background: "#FFF4E0", color: "#B26A00", padding: "9px 12px", borderRadius: 8, fontSize: 12.5 }}>
              {semPreco.length} empreendimento(s) sem preço cadastrado — a receita desses ainda não está sendo contabilizada no total.
            </div>
          )}
        </>
      )}
    </Card>
  );
}
function AbaGerenciaFinanceiro({ docs, clientes, precos, precosCarregando, salvarPreco, removerPreco, notify }) {
  const somaCampo = (campo, filtro) => docs.filter(filtro).reduce((s, d) => s + (Number(d[campo]) || 0), 0);
  const pago = (d) => d.pagamento === "Pago";
  const naoPago = (d) => d.pagamento !== "Pago";

  const receitaVistoriaPaga = somaCampo("valorVistoria", pago);
  const receitaVistoriaAReceber = somaCampo("valorVistoria", naoPago);
  const receitaTrtPaga = somaCampo("valorTrt", pago);
  const receitaTrtAReceber = somaCampo("valorTrt", naoPago);

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
        </div>
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${CINZA_BORDA}`, display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13.5 }}>
          <div><strong style={{ color: AZUL_MARINHO }}>Total recebido: </strong>{fmtReal(receitaVistoriaPaga + receitaTrtPaga)}</div>
          <div><strong style={{ color: AZUL_MARINHO }}>Total a receber: </strong>{fmtReal(receitaVistoriaAReceber + receitaTrtAReceber)}</div>
        </div>
      </Card>

      <CardPrecoEmpreendimento precos={precos} carregando={precosCarregando} salvarPreco={salvarPreco} removerPreco={removerPreco} clientes={clientes} notify={notify} />

      <CardReceitaVistoriaEstimada precos={precos} clientes={clientes} />
    </div>
  );
}

function AbaGerencia({ sub = "visao-geral", docs, clientes = [], carregando, assinatura, salvarAssinatura, removerAssinatura, notify, usuarios, usuariosCarregando, criarUsuario, atualizarUsuario, excluirUsuario, usuarioAtualId, avaliacoes, avaliacoesCarregando, parceiros, parceirosCarregando, atualizarParceiro, vales, valesCarregando, precos, precosCarregando, salvarPreco, removerPreco, laudosPendentes, laudosPendentesCarregando, aprovarLaudo }) {
  if (sub === "parceiros") {
    return <AbaGerenciaParceiros parceiros={parceiros} parceirosCarregando={parceirosCarregando} atualizarParceiro={atualizarParceiro} vales={vales} valesCarregando={valesCarregando} notify={notify} />;
  }
  if (sub === "financeiro") {
    return <AbaGerenciaFinanceiro docs={docs} clientes={clientes} precos={precos} precosCarregando={precosCarregando} salvarPreco={salvarPreco} removerPreco={removerPreco} notify={notify} />;
  }
  return (
    <AbaGerenciaVisaoGeral docs={docs} clientes={clientes} carregando={carregando} assinatura={assinatura} salvarAssinatura={salvarAssinatura} removerAssinatura={removerAssinatura} notify={notify}
      usuarios={usuarios} usuariosCarregando={usuariosCarregando} criarUsuario={criarUsuario} atualizarUsuario={atualizarUsuario} excluirUsuario={excluirUsuario} usuarioAtualId={usuarioAtualId}
      avaliacoes={avaliacoes} avaliacoesCarregando={avaliacoesCarregando}
      laudosPendentes={laudosPendentes} laudosPendentesCarregando={laudosPendentesCarregando} aprovarLaudo={aprovarLaudo} />
  );
}

const ROLE_LABEL = { vistoriador: "Vistoriador", documentacao: "Documentação", comercial: "Comercial", qualidade: "Qualidade", gerencia: "Gerência" };
const ROLE_DESCRICAO = {
  vistoriador: "Só acessa Laudos. Sem acesso a Documentação nem Gerência.",
  documentacao: "Só acessa Documentação/TRT. Sem acesso a Laudos nem Gerência.",
  comercial: "Só acessa Clientes: cadastro, agendamento e acompanhamento.",
  qualidade: "Só acessa Qualidade: avaliações que os clientes deixaram.",
  gerencia: "Acesso completo: Laudos, Documentação, Clientes, Qualidade, Gerência e financeiro.",
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
function AvaliarServico({ doc, notify }) {
  const [aberto, setAberto] = useState(false);
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const enviar = async () => {
    if (!nota) { notify("Escolha de 1 a 5 estrelas"); return; }
    setEnviando(true);
    try {
      await apiFetch("/api/avaliacoes", {
        method: "POST",
        body: { docId: doc.id, cliente: doc.cliente, empreendimento: doc.empreendimento, nota, comentario },
      });
      setEnviado(true);
      notify("Obrigado pela avaliação! ✓");
    } catch (e) { notify(`Não foi possível enviar: ${e.message}`); }
    setEnviando(false);
  };

  if (enviado) {
    return <div style={{ marginTop: 10, fontSize: 13, color: "#2E7D32", fontWeight: 600 }}>✓ Avaliação enviada. Obrigado!</div>;
  }

  if (!aberto) {
    return (
      <button className="btn-ghost" style={{ marginTop: 10, color: AZUL_MEDIO, background: CINZA_CLARO }} onClick={() => setAberto(true)}>
        <Star size={14} /> Avaliar este atendimento
      </button>
    );
  }

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${CINZA_BORDA}` }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Como foi o atendimento?</div>
      <Estrelas valor={nota} onChange={setNota} tamanho={24} />
      <textarea style={{ ...inp, marginTop: 10, resize: "vertical" }} rows={2} placeholder="Conte como foi (opcional)"
        value={comentario} onChange={(e) => setComentario(e.target.value)} />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="btn-solid" onClick={enviar} disabled={enviando}>{enviando ? "Enviando…" : "Enviar avaliação"}</button>
        <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO }} onClick={() => setAberto(false)}>Cancelar</button>
      </div>
    </div>
  );
}

/* ================= Acesso do cliente ao laudo final (armazenado no Google Drive) =================
   O Drive nunca fica público: o backend só libera o download depois de confirmar CPF + e-mail
   cadastrados, e devolve um link com token curto (expira em minutos) que faz o backend buscar
   o arquivo no Drive e entregar diretamente — o cliente nunca vê nem precisa de conta Google. */
function AcessoLaudoFinal({ cpf, notify }) {
  const [aberto, setAberto] = useState(false);
  const [email, setEmail] = useState("");
  const [consultando, setConsultando] = useState(false);
  const [laudos, setLaudos] = useState(null); // null = ainda não confirmou o e-mail

  const consultar = async () => {
    if (!email.trim()) { notify("Informe seu e-mail cadastrado"); return; }
    setConsultando(true);
    try {
      const r = await apiFetch("/api/laudo-final/consultar", { method: "POST", body: { cpf, email } });
      setLaudos(r.laudos || []);
      if ((r.laudos || []).length === 0) notify("Não encontramos laudo disponível para esse e-mail.");
    } catch (e) { notify(`Não foi possível confirmar: ${e.message}`); setLaudos(null); }
    setConsultando(false);
  };

  if (!aberto) {
    return (
      <button className="btn-ghost" style={{ marginTop: 10, color: AZUL_MARINHO, background: CINZA_CLARO }} onClick={() => setAberto(true)}>
        <FileText size={14} /> Ver / baixar meu laudo
      </button>
    );
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${CINZA_BORDA}` }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Confirme seu e-mail para acessar o laudo</div>
      {!laudos && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input style={{ ...inp, flex: 1, minWidth: 180 }} type="email" placeholder="Seu e-mail cadastrado" value={email}
            onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && consultar()} />
          <button className="btn-solid" onClick={consultar} disabled={consultando}>{consultando ? "Confirmando…" : "Confirmar"}</button>
        </div>
      )}
      {laudos && laudos.length === 0 && (
        <p style={{ color: "#8593a8", fontSize: 13, margin: 0 }}>E-mail não confere ou nenhum laudo disponível ainda.</p>
      )}
      {laudos && laudos.length > 0 && (
        <div style={{ display: "grid", gap: 12 }}>
          {laudos.map((l) => (
            <div key={l.docId}>
              {l.fotoCliente && (
                <img src={l.fotoCliente} alt="Foto da sua vistoria com nosso vistoriador" style={{ width: "100%", maxWidth: 320, borderRadius: 10, display: "block", marginBottom: 8 }} />
              )}
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

const OUTROS = "__outros__";

function AbaCliente({ notify }) {
  const [form, setForm] = useState(novoCadastroCliente());
  const [enviando, setEnviando] = useState(false);
  const [cpfConsulta, setCpfConsulta] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [resultados, setResultados] = useState([]);

  const [refEmpreendimentos, setRefEmpreendimentos] = useState([]);
  const [construtoraSel, setConstrutoraSel] = useState("");
  const [empreendimentoSel, setEmpreendimentoSel] = useState("");
  const [construtoraOutros, setConstrutoraOutros] = useState("");
  const [empreendimentoOutros, setEmpreendimentoOutros] = useState("");
  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch("/api/empreendimentos-ref");
        setRefEmpreendimentos(r.empreendimentos || []);
      } catch { /* dropdown vira "Outros" direto se a lista não carregar */ }
    })();
  }, []);
  const construtorasDisponiveis = [...new Set(refEmpreendimentos.map((e) => e.construtora))].sort();
  const empreendimentosDisponiveis = [...new Set(
    refEmpreendimentos.filter((e) => e.construtora === construtoraSel).map((e) => e.empreendimento)
  )].sort();

  const setF = (campo, v) => setForm((f) => ({ ...f, [campo]: v }));
  const setFMaiusc = (campo, v) => setForm((f) => ({ ...f, [campo]: v.toUpperCase() }));
  const setFCpf = (v) => setForm((f) => ({ ...f, cpf: v.replace(/\D/g, "").slice(0, 11) }));

  const enviar = async () => {
    if (!form.nome.trim() || !form.telefone.trim()) { notify("Informe pelo menos nome e telefone"); return; }
    if (form.cpf && form.cpf.length !== 11) { notify("O CPF deve ter 11 dígitos"); return; }
    const construtoraFinal = construtoraSel === OUTROS ? construtoraOutros.trim() : construtoraSel;
    const empreendimentoFinal = empreendimentoSel === OUTROS ? empreendimentoOutros.trim() : empreendimentoSel;
    const precisaCadastroEmpreendimento = construtoraSel === OUTROS || empreendimentoSel === OUTROS;
    setEnviando(true);
    try {
      await apiFetch("/api/clientes", {
        method: "POST",
        body: { ...form, construtora: construtoraFinal.toUpperCase(), empreendimento: empreendimentoFinal.toUpperCase(), precisaCadastroEmpreendimento },
      });
      setForm(novoCadastroCliente());
      setConstrutoraSel(""); setEmpreendimentoSel(""); setConstrutoraOutros(""); setEmpreendimentoOutros("");
      notify("Cadastro enviado! Nossa equipe entrará em contato ✓");
    } catch (e) { notify(`Não foi possível enviar: ${e.message}`); }
    setEnviando(false);
  };

  const consultar = async () => {
    const cpfLimpo = cpfConsulta.replace(/\D/g, "");
    if (cpfLimpo.length !== 11) { notify("Digite um CPF válido (11 dígitos)"); return; }
    setBuscando(true); setBuscou(true);
    try {
      const r = await apiFetch("/api/acompanhamento", { method: "POST", body: { termo: cpfLimpo } });
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
          <div style={cell(true)}>
            <label style={lab}>Serviço desejado</label>
            <select style={inp} value={form.servico} onChange={(e) => setF("servico", e.target.value)}>
              {SERVICO_OPCOES.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <Field label="Nome completo" value={form.nome} onChange={(v) => setFMaiusc("nome", v)} full />
          <Field label="CPF (11 dígitos)" value={form.cpf} onChange={setFCpf} />
          <Field label="Telefone / WhatsApp" value={form.telefone} onChange={(v) => setF("telefone", v.replace(/\D/g, "").slice(0, 11))} />
          <Field label="E-mail" value={form.email} onChange={(v) => setF("email", v)} full />
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
            <select style={inp} value={empreendimentoSel} onChange={(e) => setEmpreendimentoSel(e.target.value)} disabled={!construtoraSel}>
              <option value="">{construtoraSel ? "selecionar…" : "escolha a construtora primeiro"}</option>
              {empreendimentosDisponiveis.map((e) => <option key={e} value={e}>{e}</option>)}
              <option value={OUTROS}>Outros (não está na lista)</option>
            </select>
            {empreendimentoSel === OUTROS && (
              <input style={{ ...inp, marginTop: 6 }} placeholder="Digite o nome do empreendimento" value={empreendimentoOutros} onChange={(e) => setEmpreendimentoOutros(e.target.value)} />
            )}
          </div>
          <Field label="Endereço completo" value={form.endereco} onChange={(v) => setFMaiusc("endereco", v)} full />
          <Field label="CEP" value={form.cep} onChange={(v) => setF("cep", v.replace(/\D/g, "").slice(0, 8))} />
          <Field label="Bloco / Apto" value={form.blocoTorre} onChange={(v) => setFMaiusc("blocoTorre", v)} />
          {form.servico === SERVICO_OPCOES[0] && (
            <>
              <Field label="Data desejada" type="date" value={form.dataDesejada} onChange={(v) => setF("dataDesejada", v)} />
              <Field label="Horário desejado" type="time" value={form.horarioDesejado} onChange={(v) => setF("horarioDesejado", v)} />
            </>
          )}
        </Grid>
        <Area label="Observações (opcional)" value={form.observacoes} onChange={(v) => setFMaiusc("observacoes", v)} rows={2} placeholder="EX.: MELHOR HORÁRIO PARA CONTATO, DETALHES DO IMÓVEL..." />
        <button className="btn-solid" style={{ marginTop: 12 }} onClick={enviar} disabled={enviando}>
          {enviando ? <Loader2 size={15} className="spin" /> : <Plus size={15} />} Enviar cadastro
        </button>
      </Card>

      <Card icon={ClipboardCheck} titulo="Acompanhar meu atendimento">
        <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 12px" }}>
          Digite seu CPF para ver o status atual do seu atendimento.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <input style={{ ...inp, flex: 1 }} placeholder="Seu CPF (somente números)" value={cpfConsulta}
            onChange={(e) => { setCpfConsulta(e.target.value.replace(/\D/g, "").slice(0, 11)); setBuscou(false); }}
            onKeyDown={(e) => e.key === "Enter" && consultar()} />
          <button className="btn-solid" onClick={consultar} disabled={buscando}>{buscando ? "Consultando…" : "Consultar"}</button>
        </div>

        {buscou && !buscando && resultados.length === 0 && (
          <p style={{ color: "#8593a8", fontSize: 14, marginTop: 14 }}>
            Nenhum atendimento encontrado ainda com esse CPF. Assim que sua vistoria for agendada pela nossa equipe, ela aparecerá aqui.
          </p>
        )}

        {resultados.length > 0 && (
          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            {resultados.map((d) => {
              const statusInfo = STATUS_ATENDIMENTO_INFO[d.status] || null;
              return (
                <div key={d.id} style={{ border: `1px solid ${CINZA_BORDA}`, borderRadius: 10, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
                    <strong style={{ fontSize: 14 }}>{d.cliente || "—"}</strong>
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
                  {d.status === "Laudo enviado por e-mail" && <AcessoLaudoFinal cpf={cpfConsulta} notify={notify} />}
                  <AvaliarServico doc={d} notify={notify} />
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${CINZA_BORDA}`, fontSize: 13 }}>
          <strong style={{ color: AZUL_MARINHO }}>Dúvidas? Fale conosco:</strong>
          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
            <a href="https://wa.me/5581983061305" target="_blank" rel="noopener noreferrer" style={{ color: "#4a5a70", textDecoration: "none" }}>
              📱 WhatsApp: (81) 9 8306-1305
            </a>
            <a href="https://www.instagram.com/fn.edificacoes/" target="_blank" rel="noopener noreferrer" style={{ color: "#4a5a70", textDecoration: "none" }}>
              📸 Instagram: @fn.edificacoes
            </a>
          </div>
        </div>
      </Card>

      <SecaoFeedbackVitrine notify={notify} />
      <SecaoParceirosVitrine notify={notify} />
    </div>
  );
}

/* ================= Módulo: Parceiros / Afiliados (aditivo) ================= */
const PARCEIRO_TIPO_OPCOES = [
  { valor: "servico", label: "Prestadores de Serviço" },
  { valor: "produto", label: "Venda de Produtos" },
];
const PARCEIRO_TIPO_LABEL = { servico: "Prestador de Serviço", produto: "Venda de Produtos" };

const PARCEIRO_STATUS_OPCOES = ["em_analise", "aprovado", "suspenso", "encerrado"];
const PARCEIRO_STATUS_LABEL = { em_analise: "Em análise", aprovado: "Aprovado", suspenso: "Suspenso", encerrado: "Encerrado" };
STATUS_COR["Em análise"] = { cor: "#2C75B5", bg: "#EAF2FB" };
STATUS_COR["Aprovado"] = { cor: "#2E7D32", bg: "#E6F4EA" };
STATUS_COR["Suspenso"] = { cor: "#B26A00", bg: "#FFF4E0" };
STATUS_COR["Encerrado"] = { cor: "#65758b", bg: "#EEF1F5" };
/* Etapa atual do cliente no fluxo completo (cadastro → análise → vistoria → laudo), ver etapaAtualCliente. */
STATUS_COR["Agendamento aprovado"] = { cor: "#2C75B5", bg: "#EAF2FB" };
STATUS_COR["Vistoria agendada"] = { cor: "#6A3FB2", bg: "#F1EBFB" };
STATUS_COR["Laudo em análise"] = { cor: "#B26A00", bg: "#FFF4E0" };
STATUS_COR["Laudo enviado por e-mail"] = { cor: "#2E7D32", bg: "#E6F4EA" };
STATUS_COR["Cancelado"] = { cor: "#C62828", bg: "#FCEAEA" };

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
  };
}

const novaComissaoLinha = () => ({ name: "", p: "" });
const novoCadastroParceiro = () => ({
  email: "", senha: "", tipo: "servico", empresa: "", responsavel: "", cnpj: "",
  cidade: "", uf: "", whatsapp: "", instagram: "", site: "", logo: "",
  comissao: [novaComissaoLinha()], beneficio: "", descricaoBeneficio: "",
});

/* ---- Tela pública: cadastro de Parceiro/Afiliado (sem login) ---- */
function TelaCadastroParceiro({ onVoltar }) {
  const [form, setForm] = useState(novoCadastroParceiro());
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState(null); // { id, status }

  const setF = (campo, v) => setForm((f) => ({ ...f, [campo]: v }));
  const setComissaoLinha = (idx, patch) => setForm((f) => ({ ...f, comissao: f.comissao.map((l, i) => (i === idx ? { ...l, ...patch } : l)) }));
  const addComissaoLinha = () => setForm((f) => ({ ...f, comissao: [...f.comissao, novaComissaoLinha()] }));
  const removerComissaoLinha = (idx) => setForm((f) => ({ ...f, comissao: f.comissao.filter((_, i) => i !== idx) }));

  const onLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErro("Envie uma imagem (PNG ou JPG) para a logo"); return; }
    const reader = new FileReader();
    reader.onload = () => setF("logo", reader.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const enviar = async () => {
    setErro("");
    if (!form.email.trim() || !form.senha.trim()) { setErro("Informe e-mail e senha de acesso."); return; }
    if (form.senha.length < 6) { setErro("A senha precisa ter pelo menos 6 caracteres."); return; }
    if (!form.empresa.trim() || !form.responsavel.trim()) { setErro("Informe a empresa e o responsável."); return; }
    if (!form.cidade.trim() || !form.uf.trim()) { setErro("Informe cidade e UF."); return; }
    if (!form.whatsapp.trim()) { setErro("Informe um WhatsApp para contato."); return; }
    const comissaoValida = form.comissao.filter((l) => l.name.trim() && l.p !== "");
    if (comissaoValida.length === 0) { setErro("Adicione ao menos uma categoria de comissão com percentual."); return; }

    setEnviando(true);
    try {
      const body = { ...form, comissao: comissaoValida.map((l) => ({ name: l.name.trim(), p: Number(l.p) })) };
      const r = await apiFetch("/api/parceiros/signup", { method: "POST", body });
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
          <h2 style={{ color: AZUL_MARINHO, fontSize: 19, margin: "0 0 8px" }}>Cadastro enviado!</h2>
          <p style={{ color: "#65758b", fontSize: 13.5, margin: "0 0 16px" }}>
            Recebemos os dados da <strong>{form.empresa}</strong>. Nossa equipe vai avaliar o cadastro e entrar em contato pelo WhatsApp informado.
          </p>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
            <Selo valor={PARCEIRO_STATUS_LABEL[resultado.status] || resultado.status} />
          </div>
          <button type="button" className="btn-solid" style={{ width: "100%", justifyContent: "center" }} onClick={onVoltar}>Voltar</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: CINZA_CLARO, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <header style={{ background: AZUL_MARINHO, color: "#fff" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 18px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: "clamp(36px, 9vw, 44px)", height: "clamp(36px, 9vw, 44px)", borderRadius: 9, background: "#fff", display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0 }}>
            <img src="/logo-fn-transparente.png" alt="FN Edificações" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <div style={{ lineHeight: 1.1, flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>FN Edificações</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>Seja um Parceiro</div>
          </div>
          <button className="btn-ghost" onClick={onVoltar}>← Voltar</button>
        </div>
      </header>
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "22px 18px 80px" }}>
        <Card icon={Users} titulo="Cadastro de Parceiro / Afiliado">
          <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 14px" }}>
            Cadastre sua empresa para se tornar parceira FN Edificações e oferecer benefícios aos nossos clientes.
          </p>
          <div style={{ background: "#FFF4E0", color: "#B26A00", padding: "10px 12px", borderRadius: 8, fontSize: 12.5, marginBottom: 16, display: "flex", gap: 8, alignItems: "flex-start" }}>
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>A senha de acesso é única — guarde-a bem. Os percentuais de comissão informados abaixo ficam travados assim que o cadastro é enviado.</span>
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

          <div style={{ marginTop: 18 }}>
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

          <button type="button" className="btn-solid" style={{ marginTop: 16 }} onClick={enviar} disabled={enviando}>
            {enviando ? <><Loader2 size={15} className="spin" /> Enviando…</> : <><Check size={15} /> Enviar cadastro</>}
          </button>
        </Card>
      </main>
    </div>
  );
}

/* ---- Painel do Parceiro (área logada do afiliado, papel "afiliado") ---- */
const PARCEIRO_STATUS_INFO = {
  em_analise: "Seu cadastro está em análise pela nossa equipe. Assim que for aprovado, sua logo aparecerá para os clientes.",
  aprovado: "Sua parceria está ativa! Sua logo já aparece na vitrine para os clientes da FN Edificações.",
  suspenso: "Sua parceria está temporariamente suspensa. Entre em contato com a FN Edificações para mais informações.",
  encerrado: "Sua parceria foi encerrada. Entre em contato com a FN Edificações caso tenha dúvidas.",
};

const VALE_STATUS_LABEL = { ativo: "Ativo", usado: "Usado", expirado: "Expirado", cancelado: "Cancelado" };
STATUS_COR["Ativo"] = { cor: "#2C75B5", bg: "#EAF2FB" };
STATUS_COR["Usado"] = { cor: "#2E7D32", bg: "#E6F4EA" };
STATUS_COR["Expirado"] = { cor: "#65758b", bg: "#EEF1F5" };
STATUS_COR["Cancelado"] = { cor: "#C62828", bg: "#FCEAEA" };

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

function CardPerfilParceiro({ parceiro }) {
  const comissaoTexto = parceiro.comissao.length > 0 ? parceiro.comissao.map((c) => `${c.name}: ${c.p}%`).join(" · ") : "";
  return (
    <Card icon={User} titulo="Dados do parceiro">
      <TabelaDados rows={[
        ["Empresa", parceiro.empresa], ["Responsável", parceiro.responsavel],
        ["Categoria", PARCEIRO_TIPO_LABEL[parceiro.tipo] || parceiro.tipo],
        ["Cidade/UF", parceiro.cidade ? `${parceiro.cidade}/${parceiro.uf}` : ""],
        ["WhatsApp", parceiro.whatsapp], ["Instagram", parceiro.instagram], ["Site", parceiro.site],
        ["Comissão combinada", comissaoTexto], ["Benefício oferecido", parceiro.beneficio],
      ]} />
      {parceiro.descricaoBeneficio && <p style={{ fontSize: 13.5, color: "#4a5a70", margin: 0 }}>{parceiro.descricaoBeneficio}</p>}
    </Card>
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

function PainelParceiro({ session, onLogout }) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [parceiro, setParceiro] = useState(null);
  const [vales, setVales] = useState([]);

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

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: "#1a2330", background: CINZA_CLARO, minHeight: "100vh" }}>
      <style>{estilos}</style>

      <header className="no-print" style={{ background: AZUL_MARINHO, color: "#fff", position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "12px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: "clamp(36px, 9vw, 44px)", height: "clamp(36px, 9vw, 44px)", borderRadius: 9, background: "#fff", display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0 }}>
              <img src="/logo-fn-transparente.png" alt="FN Edificações" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
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
            <CardPerfilParceiro parceiro={parceiro} />
            <CardValesParceiro vales={vales} />
          </>
        )}
      </main>
    </div>
  );
}

/* ---- Aba Parceiros dentro da Gerência (homologação) ---- */
function CardParceiros({ parceiros, carregando, atualizarParceiro, notify }) {
  const [editando, setEditando] = useState(null); // { id, status, avaliacao }

  const abrirEdicao = (p) => setEditando({ id: p.id, status: p.status, avaliacao: p.avaliacao || "" });
  const salvar = async () => {
    const ok = await atualizarParceiro(editando.id, { status: editando.status, avaliacao: editando.avaliacao });
    if (ok) {
      setEditando(null);
      notify("Status do parceiro atualizado ✓");
    }
  };

  return (
    <Card icon={Users} titulo={`Parceiros / Afiliados (${parceiros.length})`}>
      <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 14px" }}>
        Homologação dos parceiros cadastrados pelo portal público. Aprove, suspenda ou encerre a parceria conforme necessário.
      </p>

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
                  </td>
                  <td style={{ padding: "8px 10px" }}>{PARCEIRO_TIPO_LABEL[p.tipo] || p.tipo}</td>
                  <td style={{ padding: "8px 10px", fontSize: 12 }}>
                    {p.comissao.length > 0 ? p.comissao.map((c) => `${c.name} ${c.p}%`).join(", ") : "—"}
                  </td>
                  <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                    <button className="icon-btn" onClick={() => abrirEdicao(p)}><Edit3 size={15} color={AZUL_MEDIO} /></button>
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

function ModalBeneficioParceiro({ parceiro, onClose, notify }) {
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [gerando, setGerando] = useState(false);
  const [vale, setVale] = useState(null); // { codigo, beneficio, expiraEm }
  const [erro, setErro] = useState("");

  const gerar = async () => {
    setErro("");
    if (!nome.trim() || !whatsapp.trim()) { setErro("Informe seu nome e WhatsApp."); return; }
    setGerando(true);
    try {
      const r = await apiFetch("/api/vales", { method: "POST", body: { parceiroId: parceiro.id, clienteNome: nome, clienteWhatsapp: whatsapp } });
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

            <div style={cell(true)}>
              <label style={lab}>Seu nome</label>
              <input style={inp} value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div style={{ ...cell(true), marginTop: 10 }}>
              <label style={lab}>Seu WhatsApp</label>
              <input style={inp} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, "").slice(0, 11))} />
            </div>

            {erro && <div style={{ marginTop: 12, background: "#FCEAEA", color: "#C62828", padding: "9px 12px", borderRadius: 8, fontSize: 12.5 }}>{erro}</div>}

            <button className="btn-solid" style={{ width: "100%", justifyContent: "center", marginTop: 14 }} onClick={gerar} disabled={gerando}>
              {gerando ? <><Loader2 size={15} className="spin" /> Gerando…</> : "Quero esse benefício"}
            </button>
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
            <button className="btn-ghost" style={{ color: AZUL_MARINHO, background: CINZA_CLARO, marginTop: 16 }} onClick={onClose}>Fechar</button>
          </div>
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
            {a.empreendimento && <div style={{ fontSize: 12, color: "#65758b", marginBottom: 6 }}>{a.empreendimento}</div>}
            {a.comentario && <div style={{ fontSize: 13.5, color: "#334", background: CINZA_CLARO, borderRadius: 8, padding: "8px 10px" }}>{a.comentario}</div>}
          </div>
        ))}
      </div>
    </Card>
  );
}

function SecaoParceirosVitrine({ notify }) {
  const [parceiros, setParceiros] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [abaTipo, setAbaTipo] = useState("servico");
  const [selecionado, setSelecionado] = useState(null);

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

  const filtrados = parceiros.filter((p) => p.tipo === abaTipo);

  return (
    <Card icon={Building2} titulo="Parceiros FN">
      <p style={{ fontSize: 13.5, color: "#65758b", margin: "0 0 14px" }}>
        Empresas parceiras da FN Edificações que oferecem benefícios exclusivos para nossos clientes.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {PARCEIRO_TIPO_OPCOES.map((o) => (
          <button key={o.valor} onClick={() => setAbaTipo(o.valor)}
            className={abaTipo === o.valor ? "btn-solid" : "btn-ghost"}
            style={abaTipo === o.valor ? {} : { color: AZUL_MARINHO, background: CINZA_CLARO }}>
            {o.label}
          </button>
        ))}
      </div>

      {carregando && <p style={{ color: "#8593a8", fontSize: 14 }}>Carregando…</p>}
      {!carregando && filtrados.length === 0 && <p style={{ color: "#8593a8", fontSize: 14 }}>Nenhum parceiro disponível nesta categoria no momento.</p>}

      {filtrados.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 12 }}>
          {filtrados.map((p) => <LogoParceiro key={p.id} p={p} onClick={() => setSelecionado(p)} />)}
        </div>
      )}

      {selecionado && <ModalBeneficioParceiro parceiro={selecionado} onClose={() => setSelecionado(null)} notify={notify} />}
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
