/* ============================================================================
   Contratos anexados a cada fornecedor do FN Casa Pronta.

   Por que IndexedDB e não localStorage: um contrato é um PDF, geralmente alguns
   megabytes — localStorage tem teto de ~5 MB pra chave+valor juntos, e serializar um
   PDF em base64 ainda infla o tamanho em ~33%. IndexedDB guarda o Blob direto, sem
   conversão, e libera uma fatia do disco livre (tipicamente centenas de MB).

   Mesmo padrão do rascunho-local.js (fotos da vistoria), banco separado porque o
   contrato é outro tipo de dado, com outro ciclo de vida.
   ========================================================================== */

const BANCO_NOME = "fn-casa-pronta";
const BANCO_VERSAO = 1;
const LOJA = "contratos";

function abrirBanco() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Este navegador não guarda arquivos."));
      return;
    }
    const req = indexedDB.open(BANCO_NOME, BANCO_VERSAO);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(LOJA)) {
        const loja = db.createObjectStore(LOJA, { keyPath: "id" });
        loja.createIndex("porFornecedor", "fornecedorId");
      }
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

/* Lista só os metadados (sem o blob) — é o que a tela de listagem precisa, e evita
   carregar o conteúdo de todo PDF só pra mostrar nome e data. */
export async function listarContratos(fornecedorId) {
  const db = await abrirBanco();
  try {
    const registros = await transacao(db, "readonly", (loja) => loja.index("porFornecedor").getAll(fornecedorId));
    return (registros || [])
      .map(({ blob, ...meta }) => meta)
      .sort((a, b) => String(b.adicionadoEm).localeCompare(String(a.adicionadoEm)));
  } finally { db.close(); }
}

export async function salvarContrato(fornecedorId, arquivo) {
  const db = await abrirBanco();
  try {
    const registro = {
      id: `ctr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      fornecedorId,
      nome: arquivo.name,
      tipo: arquivo.type || "",
      tamanho: arquivo.size,
      blob: arquivo,
      adicionadoEm: new Date().toISOString(),
    };
    await transacao(db, "readwrite", (loja) => loja.put(registro));
    return { ok: true };
  } finally { db.close(); }
}

/* Devolve o registro completo (com o blob) — só na hora de abrir/baixar, não na listagem. */
export async function abrirContrato(id) {
  const db = await abrirBanco();
  try {
    const r = await transacao(db, "readonly", (loja) => loja.get(id));
    if (!r) throw new Error("Arquivo não encontrado.");
    return r;
  } finally { db.close(); }
}

export async function excluirContrato(id) {
  const db = await abrirBanco();
  try { await transacao(db, "readwrite", (loja) => loja.delete(id)); }
  finally { db.close(); }
}

/* Chamado quando o fornecedor é excluído do cadastro — sem isso, os contratos dele
   ficam presos no IndexedDB pra sempre, sem nenhuma tela que os liste de novo. */
export async function excluirContratosDoFornecedor(fornecedorId) {
  const db = await abrirBanco();
  try {
    const ids = await transacao(db, "readonly", (loja) => loja.index("porFornecedor").getAllKeys(fornecedorId));
    await transacao(db, "readwrite", (loja) => { (ids || []).forEach((id) => loja.delete(id)); });
  } finally { db.close(); }
}
