// Uso: node scripts/mapas/gerar-municipios.cjs public/mapas
// Gera public/mapas/municipios-XX.json (um por UF) com os contornos dos municípios em SVG,
// a partir das malhas e da lista de municípios do IBGE. Roda uma vez; o front carrega o
// arquivo da UF só quando alguém abre uma regional.
"use strict";
const fs = require("node:fs");
const path = require("node:path");

const UFS = { 11: "RO", 12: "AC", 13: "AM", 14: "RR", 15: "PA", 16: "AP", 17: "TO", 21: "MA", 22: "PI", 23: "CE", 24: "RN",
  25: "PB", 26: "PE", 27: "AL", 28: "SE", 29: "BA", 31: "MG", 32: "ES", 33: "RJ", 35: "SP", 41: "PR", 42: "SC", 43: "RS",
  50: "MS", 51: "MT", 52: "GO", 53: "DF" };
const destino = process.argv[2];
fs.mkdirSync(destino, { recursive: true });

const aneis = (geom) => (geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates);
function simplificar(pts, tol) {
  if (pts.length < 4) return pts;
  const dist = ([x, y], [x1, y1], [x2, y2]) => {
    const dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy;
    const t = l ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / l)) : 0;
    return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
  };
  let max = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) { const d = dist(pts[i], pts[0], pts[pts.length - 1]); if (d > max) { max = d; idx = i; } }
  if (max <= tol) return [pts[0], pts[pts.length - 1]];
  return [...simplificar(pts.slice(0, idx + 1), tol).slice(0, -1), ...simplificar(pts.slice(idx), tol)];
}
function centroide(anel) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < anel.length - 1; i++) {
    const [x1, y1] = anel[i], [x2, y2] = anel[i + 1];
    const c = x1 * y2 - x2 * y1; a += c; cx += (x1 + x2) * c; cy += (y1 + y2) * c;
  }
  a /= 2;
  return { area: Math.abs(a), x: cx / (6 * a), y: cy / (6 * a) };
}
const arred = (n) => Math.round(n * 10) / 10;

async function json(url) {
  for (let t = 0; t < 4; t++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch {}
    await new Promise((res) => setTimeout(res, 1500 * (t + 1)));
  }
  throw new Error(`Falhou: ${url}`);
}

(async () => {
  let total = 0;
  for (const [cod, uf] of Object.entries(UFS)) {
    const malha = await json(`https://servicodados.ibge.gov.br/api/v3/malhas/estados/${cod}?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio`);
    const lista = await json(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${cod}/municipios`);
    const nomes = Object.fromEntries(lista.map((m) => [String(m.id), m.nome]));

    let lonMin = Infinity, lonMax = -Infinity, latMin = Infinity, latMax = -Infinity;
    for (const f of malha.features) for (const p of aneis(f.geometry)) for (const r of p) for (const [lon, lat] of r) {
      lonMin = Math.min(lonMin, lon); lonMax = Math.max(lonMax, lon); latMin = Math.min(latMin, lat); latMax = Math.max(latMax, lat);
    }
    const fator = Math.cos(((latMin + latMax) / 2) * Math.PI / 180);
    // Estado comprido na horizontal (PE) ou na vertical (MG) cabe no mesmo quadro de 600.
    const k = 600 / Math.max((lonMax - lonMin) * fator, latMax - latMin);
    const largura = Math.ceil((lonMax - lonMin) * fator * k);
    const altura = Math.ceil((latMax - latMin) * k);
    const projetar = ([lon, lat]) => [(lon - lonMin) * fator * k, (latMax - lat) * k];

    const municipios = [];
    for (const f of malha.features) {
      let d = ""; let maior = { area: -1 };
      for (const poligono of aneis(f.geometry)) {
        poligono.forEach((anel, i) => {
          const proj = anel.map(projetar);
          const simples = simplificar(proj, 0.6);
          if (simples.length < 4) return;
          d += "M" + simples.map(([x, y]) => `${arred(x)},${arred(y)}`).join("L") + "Z";
          if (i === 0) { const c = centroide(proj); if (c.area > maior.area) maior = c; }
        });
      }
      if (!d) continue;
      const id = String(f.properties.codarea);
      municipios.push({ id, nome: nomes[id] || id, d, x: arred(maior.x), y: arred(maior.y) });
    }
    const arquivo = path.join(destino, `municipios-${uf}.json`);
    const conteudo = JSON.stringify({ uf, largura, altura, fonte: "IBGE — malha municipal, qualidade mínima", municipios });
    fs.writeFileSync(arquivo, conteudo);
    total += conteudo.length;
    console.log(`${uf}: ${municipios.length} municípios, ${(conteudo.length / 1024).toFixed(0)} KB`);
  }
  console.log(`total ${(total / 1024 / 1024).toFixed(2)} MB`);
})().catch((e) => { console.error(e); process.exit(1); });
