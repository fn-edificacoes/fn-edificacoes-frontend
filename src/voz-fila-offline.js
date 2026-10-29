/* ============================================================================
   Fila da patologia por voz guardada no próprio celular (fase 2).

   Por que existe: a vistoria é feita dentro do apartamento, muitas vezes sem sinal (ver
   rascunho-local.js, que nasceu do mesmo problema). Uma gravação que falha no envio não
   pode ficar só na memória da página: o celular descarta aba em segundo plano o tempo todo,
   e o técnico não volta ao imóvel para falar de novo. Aqui ela fica até o servidor
   confirmar que recebeu — e só então sai.

   Banco próprio, separado do "fn-vistorias" do rascunho: assim cada um evolui a versão do
   seu armazenamento sem depender do outro.

   O áudio vai como ArrayBuffer, não como Blob: Blob dentro do IndexedDB teve defeito no
   Safari do iPhone por várias versões, e ArrayBuffer sempre funcionou.
   ========================================================================== */

const BANCO_NOME = "fn-voz-fila";
const BANCO_VERSAO = 1;
const LOJA = "envios";

export function filaDisponivel() {
  return typeof indexedDB !== "undefined";
}

function abrirBanco() {
  return new Promise((resolve, reject) => {
    if (!filaDisponivel()) {
      reject(new Error("Este navegador não guarda gravações sem sinal."));
      return;
    }
    const req = indexedDB.open(BANCO_NOME, BANCO_VERSAO);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(LOJA)) db.createObjectStore(LOJA, { keyPath: "idLocal" });
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

/* Grava (ou regrava) um envio pendente. O estado "enviando" nunca é guardado: se a página
   fechar no meio, ao reabrir o envio volta a ser só "aguardando". */
export async function guardarEnvio(envio) {
  const { enviando, ...registro } = envio;
  const db = await abrirBanco();
  try { await transacao(db, "readwrite", (loja) => loja.put(registro)); }
  finally { db.close(); }
}

/* Só os envios de quem está logado: no celular compartilhado, a gravação de um técnico
   nunca sai com o login de outro. */
export async function listarEnvios(usuarioId) {
  const db = await abrirBanco();
  try {
    const todos = await transacao(db, "readonly", (loja) => loja.getAll());
    return (todos || [])
      .filter((e) => e.usuarioId === usuarioId)
      .sort((a, b) => String(a.gravadoEm).localeCompare(String(b.gravadoEm)));
  } finally { db.close(); }
}

export async function removerEnvio(idLocal) {
  const db = await abrirBanco();
  try { await transacao(db, "readwrite", (loja) => loja.delete(idLocal)); }
  finally { db.close(); }
}
