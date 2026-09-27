/* sw.js — o mínimo para o sistema ser instalável como app (tela inicial do celular).

   De propósito, NÃO guarda nada em cache:
   - dado da API (laudo, CPF, foto) não pode ficar gravado no aparelho de ninguém;
   - tela em cache faria a equipe ficar presa numa versão velha depois de cada publicação —
     o nginx já serve o index.html com "no-cache" e os arquivos de /assets com hash no nome.
   Só intercepta a abertura de página: sem internet, mostra um aviso em vez da tela de erro
   do navegador. Todo o resto (API, fotos, arquivos) passa direto, como sem service worker. */

const PAGINA_OFFLINE = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>FN Edificações</title></head>
<body style="margin:0;font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;background:#fff;color:#12335B;text-align:center">
<div style="padding:24px"><div style="font-size:28px;font-weight:800;letter-spacing:2px">FN</div>
<h1 style="font-size:20px">Sem conexão com a internet</h1>
<p style="color:#4a5a70">Confira o Wi-Fi ou os dados móveis e tente de novo.</p>
<button onclick="location.reload()" style="background:#12335B;color:#fff;border:0;border-radius:8px;padding:12px 20px;font-size:15px">Tentar de novo</button>
</div></body></html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(
    fetch(e.request).catch(() => new Response(PAGINA_OFFLINE, { headers: { "Content-Type": "text/html; charset=utf-8" } }))
  );
});
