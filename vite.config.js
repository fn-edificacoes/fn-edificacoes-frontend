import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/* O GitHub Pages serve o site numa subpasta (/fn-edificacoes-frontend/), então os caminhos
   dos arquivos precisam levar esse prefixo. Netlify e Vercel servem na raiz do domínio.
   A variável GITHUB_PAGES só é ligada pelo workflow do Pages, então os outros deploys
   continuam funcionando exatamente como antes. */
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES ? "/fn-edificacoes-frontend/" : "/",
});
