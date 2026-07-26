/* ============================================================================
   Rascunho da vistoria guardado no próprio celular — agora com as fotos.

   Por que existe: o técnico faz a vistoria dentro do apartamento, muitas vezes sem
   sinal, e o sistema só conversa com o servidor no "Enviar para gerência". Enquanto
   isso, tudo vive na memória da página. Celular descarta aba em segundo plano o tempo
   todo (é assim que ele libera memória), e quando isso acontece a vistoria se perde.

   O rascunho antigo usava localStorage, que tem teto de ~5 MB — uma única foto de
   celular ocupa de 2 a 5 MB. Por isso ele salvava tudo MENOS as fotos, e o técnico
   recuperava o texto com os registros fotográficos vazios: justamente a parte que não
   dá para refazer depois de sair do imóvel.

   IndexedDB não tem esse teto (o navegador libera uma fatia do disco livre, tipicamente
   centenas de MB), guarda valores grandes sem serializar tudo em uma string só, e
   funciona offline. É o armazenamento certo para este caso.
   ========================================================================== */

const BANCO_NOME = "fn-vistorias";
const BANCO_VERSAO = 1;
const LOJA = "rascunhos";
const PREFIXO_ANTIGO = "fn_laudo:"; // rascunhos do formato localStorage, sem fotos

function abrirBanco() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Este navegador não guarda rascunhos."));
      return;
    }
    const req = indexedDB.open(BANCO_NOME, BANCO_VERSAO);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(LOJA)) db.createObjectStore(LOJA, { keyPath: "chave" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Não foi possível abrir o armazenamento."));
  });
}

function transacao(db, modo, executar) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(LOJA, modo);
    const loja = t.objectStore(LOJA);
    let resultado;
    try { resultado = executar(loja); } catch (e) { reject(e); return; }
    t.oncomplete = () => resolve(resultado?.result ?? resultado);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error("Gravação cancelada pelo navegador."));
  });
}

export const CHAVE_EM_ANDAMENTO = "em-andamento";

/* Grava (ou regrava) um rascunho. `chave` fixa em CHAVE_EM_ANDAMENTO é o salvamento
   automático; qualquer outra chave é um rascunho nomeado que o técnico guardou. */
export async function salvarRascunho({ chave, nome, dados, itens }) {
  const db = await abrirBanco();
  try {
    const registro = {
      chave,
      nome: nome || "Sem nome",
      salvoEm: new Date().toISOString(),
      dados,
      // As fotos vão junto: é o motivo de este arquivo existir.
      itens: (itens || []).map(({ id, ...resto }) => resto),
    };
    await transacao(db, "readwrite", (loja) => loja.put(registro));
    return { ok: true };
  } finally { db.close(); }
}

export async function listarRascunhos() {
  const lista = [];

  try {
    const db = await abrirBanco();
    try {
      const registros = await transacao(db, "readonly", (loja) => loja.getAll());
      (registros || []).forEach((r) => {
        lista.push({
          chave: r.chave,
          nome: r.nome,
          salvoEm: r.salvoEm,
          nItens: (r.itens || []).length,
          nFotos: (r.itens || []).reduce((s, i) => s + (i.fotos?.length || 0), 0),
          comFotos: true,
          automatico: r.chave === CHAVE_EM_ANDAMENTO,
        });
      });
    } finally { db.close(); }
  } catch { /* sem IndexedDB: sobra o formato antigo abaixo */ }

  // Rascunhos gravados antes desta mudança continuam abríveis — sem as fotos, como eram.
  try {
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith(PREFIXO_ANTIGO))
      .forEach((k) => {
        try {
          const p = JSON.parse(window.localStorage.getItem(k));
          lista.push({
            chave: k, nome: p.nome, salvoEm: p.salvoEm,
            nItens: (p.itens || []).length, nFotos: 0,
            comFotos: false, automatico: false, antigo: true,
          });
        } catch { /* registro corrompido, ignora */ }
      });
  } catch { /* localStorage bloqueado */ }

  return lista.sort((a, b) => String(b.salvoEm).localeCompare(String(a.salvoEm)));
}

export async function abrirRascunho(chave) {
  if (String(chave).startsWith(PREFIXO_ANTIGO)) {
    const bruto = window.localStorage.getItem(chave);
    if (!bruto) throw new Error("Rascunho não encontrado.");
    const p = JSON.parse(bruto);
    // O formato antigo nunca guardou foto; devolve a lista vazia para o técnico saber.
    return { dados: p.dados, itens: (p.itens || []).map((i) => ({ ...i, fotos: [] })), comFotos: false };
  }

  const db = await abrirBanco();
  try {
    const r = await transacao(db, "readonly", (loja) => loja.get(chave));
    if (!r) throw new Error("Rascunho não encontrado.");
    return { dados: r.dados, itens: (r.itens || []).map((i) => ({ ...i, fotos: i.fotos || [] })), comFotos: true };
  } finally { db.close(); }
}

export async function excluirRascunho(chave) {
  if (String(chave).startsWith(PREFIXO_ANTIGO)) {
    try { window.localStorage.removeItem(chave); } catch { /* nada a fazer */ }
    return;
  }
  const db = await abrirBanco();
  try { await transacao(db, "readwrite", (loja) => loja.delete(chave)); }
  finally { db.close(); }
}

/* Quanto o navegador já deixou a gente usar e quanto ainda cabe. Serve para avisar o
   técnico antes de a gravação falhar, em vez de depois. */
export async function espacoDisponivel() {
  try {
    if (!navigator.storage?.estimate) return null;
    const { usage, quota } = await navigator.storage.estimate();
    return { usadoMB: usage / 1048576, totalMB: quota / 1048576 };
  } catch { return null; }
}
