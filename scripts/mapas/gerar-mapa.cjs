// Uso: node scripts/mapas/gerar-mapa.cjs src/mapa-brasil.js
// Converte a malha de UFs do IBGE (GeoJSON, qualidade mínima) em contornos SVG leves para o
// frontend. Roda uma vez; o resultado vai para src/mapa-brasil.js.
// Fonte: https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=UF
"use strict";
const fs = require("node:fs");
const path = require("node:path");

(async () => {
const g = await (await fetch("https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=UF")).json();
const UF_POR_CODIGO = {
  11: ["RO", "Rondônia"], 12: ["AC", "Acre"], 13: ["AM", "Amazonas"], 14: ["RR", "Roraima"], 15: ["PA", "Pará"],
  16: ["AP", "Amapá"], 17: ["TO", "Tocantins"], 21: ["MA", "Maranhão"], 22: ["PI", "Piauí"], 23: ["CE", "Ceará"],
  24: ["RN", "Rio Grande do Norte"], 25: ["PB", "Paraíba"], 26: ["PE", "Pernambuco"], 27: ["AL", "Alagoas"],
  28: ["SE", "Sergipe"], 29: ["BA", "Bahia"], 31: ["MG", "Minas Gerais"], 32: ["ES", "Espírito Santo"],
  33: ["RJ", "Rio de Janeiro"], 35: ["SP", "São Paulo"], 41: ["PR", "Paraná"], 42: ["SC", "Santa Catarina"],
  43: ["RS", "Rio Grande do Sul"], 50: ["MS", "Mato Grosso do Sul"], 51: ["MT", "Mato Grosso"], 52: ["GO", "Goiás"],
  53: ["DF", "Distrito Federal"],
};
const REGIAO = { 1: "Norte", 2: "Nordeste", 3: "Sudeste", 4: "Sul", 5: "Centro-Oeste" };

// Limites do país para a projeção.
let lonMin = Infinity, lonMax = -Infinity, latMin = Infinity, latMax = -Infinity;
const aneis = (geom) => (geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates);
for (const f of g.features) for (const p of aneis(f.geometry)) for (const r of p) for (const [lon, lat] of r) {
  lonMin = Math.min(lonMin, lon); lonMax = Math.max(lonMax, lon); latMin = Math.min(latMin, lat); latMax = Math.max(latMax, lat);
}
// Equiretangular com o cosseno da latitude média: em escala de país, a distorção é pequena e
// o desenho fica reconhecível sem biblioteca de projeção.
const fator = Math.cos(((latMin + latMax) / 2) * Math.PI / 180);
const LARGURA = 600;
const k = LARGURA / ((lonMax - lonMin) * fator);
const ALTURA = Math.ceil((latMax - latMin) * k);
const projetar = ([lon, lat]) => [(lon - lonMin) * fator * k, (latMax - lat) * k];

// Douglas-Peucker: tira pontos que não mudam o desenho na escala da tela.
function simplificar(pts, tol) {
  if (pts.length < 4) return pts;
  const dist = ([x, y], [x1, y1], [x2, y2]) => {
    const dx = x2 - x1, dy = y2 - y1;
    const l = dx * dx + dy * dy;
    const t = l ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / l)) : 0;
    return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
  };
  let max = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) { const d = dist(pts[i], pts[0], pts[pts.length - 1]); if (d > max) { max = d; idx = i; } }
  if (max <= tol) return [pts[0], pts[pts.length - 1]];
  return [...simplificar(pts.slice(0, idx + 1), tol).slice(0, -1), ...simplificar(pts.slice(idx), tol)];
}
const arred = (n) => Math.round(n * 10) / 10;

// Centro para o rótulo: centróide do maior polígono (o arquipélago não puxa o rótulo para o mar).
function centroide(anel) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < anel.length - 1; i++) {
    const [x1, y1] = anel[i], [x2, y2] = anel[i + 1];
    const c = x1 * y2 - x2 * y1; a += c; cx += (x1 + x2) * c; cy += (y1 + y2) * c;
  }
  a /= 2;
  return { area: Math.abs(a), x: cx / (6 * a), y: cy / (6 * a) };
}

const saida = {};
let pontos = 0;
for (const f of g.features) {
  const cod = Number(f.properties.codarea);
  const [uf, nome] = UF_POR_CODIGO[cod];
  let d = "";
  let maior = { area: -1 };
  for (const poligono of aneis(f.geometry)) {
    poligono.forEach((anel, i) => {
      const proj = anel.map(projetar);
      const simples = simplificar(proj, 0.35);
      if (simples.length < 4) return;
      pontos += simples.length;
      d += "M" + simples.map(([x, y]) => `${arred(x)},${arred(y)}`).join("L") + "Z";
      if (i === 0) { const c = centroide(proj); if (c.area > maior.area) maior = c; }
    });
  }
  saida[uf] = { nome, regiao: REGIAO[Math.floor(cod / 10)], d, x: arred(maior.x), y: arred(maior.y) };
}

const js = `/* Contornos dos estados do Brasil para o Mapa de atuação (src/rede-nacional.jsx).
   Gerado a partir da malha oficial do IBGE (UFs, qualidade mínima), projetada e simplificada
   para a escala da tela. É dado estático: não depende de serviço externo em produção.
   Fonte: servicodados.ibge.gov.br/api/v3/malhas/paises/BR?intrarregiao=UF */
export const MAPA_LARGURA = ${LARGURA};
export const MAPA_ALTURA = ${ALTURA};
export const ESTADOS = ${JSON.stringify(saida, null, 0).replace(/\},"/g, '},\n  "').replace(/^\{/, "{\n  ").replace(/\}\}$/, "}\n}")};
`;
fs.writeFileSync(process.argv[2], js);
console.log(`ok: ${Object.keys(saida).length} UFs, ${pontos} pontos, ${(js.length / 1024).toFixed(1)} KB, ${LARGURA}x${ALTURA}`);
})().catch((e) => { console.error(e); process.exit(1); });
