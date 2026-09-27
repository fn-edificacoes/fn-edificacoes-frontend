import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

/* Service worker só para o sistema poder ser instalado como app (ver public/sw.js — ele não
   guarda cache nenhum). Em desenvolvimento fica de fora, para não atrapalhar o recarregamento. */
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
