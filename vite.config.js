import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/* O site é servido na raiz do domínio próprio (sistema.fnedificacoes.com.br), então não
   leva prefixo de subpasta. O arquivo public/CNAME é o que diz ao GitHub Pages qual
   domínio atender. */
export default defineConfig({
  plugins: [react()],
});
