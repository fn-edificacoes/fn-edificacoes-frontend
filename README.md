# FN Edificações — Front-end (site real, fora do chat)

Este é o app completo (Laudos, Documentação, Gerência, Área do Cliente e Login) empacotado como um projeto React normal, pronto para virar um site publicado — o que resolve o bloqueio de segurança que existe dentro do artefato do chat (que impede conexões a APIs externas).

## Antes de tudo: confira a URL da API

Abra `src/App.jsx`, procure a linha:
```js
const API_URL = "https://fn-edificacoes-api.onrender.com";
```
Confirme que é exatamente a URL do seu serviço no Render.

## Testar localmente (opcional)

```bash
npm install
npm run dev
```
Abre em `http://localhost:5173`.

## Publicar de graça no Netlify (recomendado, mais simples)

1. Acesse **netlify.com**, crie uma conta (dá pra entrar com GitHub).
2. Coloque este projeto (`fn-frontend`) num repositório no GitHub, do mesmo jeito que fez com o backend (crie um repo novo, ex.: `fn-edificacoes-frontend`, e faça upload de todos os arquivos e pastas daqui).
3. No Netlify, clique em **Add new site → Import an existing project**.
4. Conecte o GitHub e escolha o repositório `fn-edificacoes-frontend`.
5. Configure:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
6. Clique em **Deploy site**.
7. Em alguns minutos, o Netlify te dá uma URL tipo `https://fn-edificacoes.netlify.app` — esse é o site de verdade que sua equipe e seus clientes vão acessar.

## Depois de publicar: liberar o CORS no backend

Agora que você tem a URL final do site (ex.: `https://fn-edificacoes.netlify.app`), volte no **Render**, no serviço do backend, em **Environment**, e troque:
```
CORS_ORIGIN=*
```
por:
```
CORS_ORIGIN=https://fn-edificacoes.netlify.app
```
(sem barra no final). Isso trava a API pra só aceitar pedidos vindos do seu site de verdade — mais seguro que deixar aberto para qualquer origem.

## Resumo da arquitetura final

```
Navegador (celular/computador de qualquer pessoa)
        │
        ▼
  Netlify (este front-end, de graça)
        │  fetch() com login
        ▼
  Render (backend/API, de graça)
        │
        ▼
  Supabase (banco Postgres, de graça)
```

Sem depender do Claude.ai para funcionar no dia a dia — o chat continua sendo só a "oficina" onde a gente monta e ajusta o código.
