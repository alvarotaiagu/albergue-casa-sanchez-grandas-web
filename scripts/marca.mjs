/* La marca de la web: el cartel de la entrada. NO se redibuja aquí.
   Uso: node scripts/marca.mjs [--svg ruta/al/cartel.svg]
   - Si existe marca/cartel.svg (lo vectoriza el agente Entrada, con grupos con id: #flor-1..3, #letra-casa,
     #letra-sanchez, #apartamentos, #vieira, #peregrino, #flecha, #albergue, #turistico, #panel, #franja):
       · marca/letra.svg + marca/letra.json: SOLO «Casa Sánchez» (#letra-casa + #letra-sanchez), recortada a su
         caja, para la cabecera (construir.mjs la usa en <!--marca-cabecera-->). Sale del mismo vector.
       · favicon.svg, favicon-32.png, apple-touch-icon.png, icono-512.png: la flor central (#flor-2) sobre amarillo.
       · img/og.jpg: el cartel entero.
   - Si no existe: el cartel de la foto (img/fotos/cartel-recorte-350.jpg y entrada-cartel) para los iconos y el og,
     y la cabecera lleva «Casa Sánchez» en texto.
   Necesita antes img/fotos/ (scripts/fotos.mjs). */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const sharp = require('sharp');
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const AMARILLO = '#E0BF50', PARDO = '#412B21';
const i = process.argv.indexOf('--svg');
const SVG = i > 0 ? path.resolve(process.argv[i + 1]) : path.join(RAIZ, 'marca/cartel.svg');
fs.mkdirSync(path.join(RAIZ, 'marca'), { recursive: true });
fs.mkdirSync(path.join(RAIZ, 'img'), { recursive: true });
const out = (r) => path.join(RAIZ, r);

/* ---- utilidades del SVG ---- */
function grupo(svg, id) {
  const ini = svg.search(new RegExp(`<g\\b[^>]*\\bid="${id}"`));
  if (ini < 0) return null;
  const re = /<g\b|<\/g>/g;
  re.lastIndex = ini;
  let prof = 0, m;
  while ((m = re.exec(svg))) {
    prof += m[0] === '</g>' ? -1 : 1;
    if (prof === 0) return svg.slice(ini, m.index + 4);
  }
  return null;
}
const raizSvg = (svg) => /<svg\b[^>]*>/.exec(svg)[0];
const defs = (svg) => (svg.match(/<defs[\s\S]*?<\/defs>/g) || []).join('');
const style = (svg) => (svg.match(/<style[\s\S]*?<\/style>/g) || []).join('');
const viewBox = (svg) => (/viewBox="([\d.\s-]+)"/.exec(raizSvg(svg))[1]).trim().split(/\s+/).map(Number);
const conGrupos = (svg, ids, vb) => {
  const gs = ids.map((id) => grupo(svg, id)).filter(Boolean);
  if (!gs.length) return null;
  const v = vb || viewBox(svg);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${v.join(' ')}" width="${v[2]}" height="${v[3]}">${style(svg)}${defs(svg)}${gs.join('')}</svg>`;
};
// caja de los trazos de un SVG, en unidades de su viewBox (se pinta sobre blanco y se recorta)
async function caja(svgTexto) {
  const vb = viewBox(svgTexto);
  const escala = 2400 / vb[2];
  const png = await sharp(Buffer.from(svgTexto), { density: 72 * escala }).flatten({ background: '#fff' }).png().toBuffer();
  const { data, info } = await sharp(png).trim({ background: '#fff', threshold: 12 }).toBuffer({ resolveWithObject: true });
  const pad = 4;
  return [vb[0] + (-info.trimOffsetLeft - pad) / escala, vb[1] + (-info.trimOffsetTop - pad) / escala, (info.width + 2 * pad) / escala, (info.height + 2 * pad) / escala];
}

const hay = fs.existsSync(SVG);
let svg = hay ? fs.readFileSync(SVG, 'utf8') : null;

/* ---- 1. la letra de la cabecera ---- */
if (hay) {
  const solo = conGrupos(svg, ['letra-casa', 'letra-sanchez']);
  if (solo) {
    const c = await caja(solo);
    const v = viewBox(svg);
    // sin las máscaras del trazo (son para animar la escritura): la letra queda entera y el fichero, pequeño
    const gs = ['letra-casa', 'letra-sanchez'].map((id) => grupo(svg, id)).filter(Boolean).join('').replace(/\smask="url\(#[^)]*\)"/g, '');
    const letra = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${c.map((x) => +x.toFixed(2)).join(' ')}">${style(svg)}${/url\(#/.test(gs) ? defs(svg) : ''}${gs}</svg>\n`;
    fs.writeFileSync(out('marca/letra.svg'), letra);
    const alto = 34;
    fs.writeFileSync(out('marca/letra.json'), JSON.stringify({ alto, ancho: Math.round(alto * c[2] / c[3]), nota: 'caja de #letra-casa + #letra-sanchez en unidades del viewBox ' + v.join(' ') }) + '\n');
    console.log('marca/letra.svg: caja', c.map((x) => x.toFixed(1)).join(' '));
  } else console.warn('El cartel.svg no tiene #letra-casa ni #letra-sanchez: la cabecera se queda con el texto.');
} else {
  for (const f of ['marca/letra.svg', 'marca/letra.json']) if (fs.existsSync(out(f))) fs.rmSync(out(f));
}

/* ---- 2. iconos: la flor central (o, sin vector, el cartel de la foto) sobre amarillo ---- */
async function imagenIcono() {
  if (hay) {
    const flor = conGrupos(svg, ['flor-2']);
    if (flor) {
      const c = await caja(flor);
      const f2 = conGrupos(svg, ['flor-2'], c);
      return sharp(Buffer.from(f2), { density: 72 * (512 / c[2]) }).png().toBuffer();
    }
  }
  return sharp(out('img/fotos/cartel-recorte-350.jpg')).png().toBuffer();
}
const base = await imagenIcono();
async function icono(tam, radio = 0) {
  const marco = Math.round(tam * 0.1), ancho = tam - 2 * marco;
  const dib = await sharp(base).resize({ width: ancho, height: ancho, fit: 'inside', kernel: 'lanczos3' }).toBuffer();
  const m = await sharp(dib).metadata();
  const fondo = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tam}" height="${tam}"><rect width="${tam}" height="${tam}" rx="${radio}" fill="${AMARILLO}"/></svg>`);
  return sharp(fondo).composite([{ input: dib, left: Math.round((tam - m.width) / 2), top: Math.round((tam - m.height) / 2) }]).png().toBuffer();
}
await sharp(await icono(64, 12)).resize(32, 32).png().toFile(out('marca/favicon-32.png'));
await sharp(await icono(180)).png().toFile(out('marca/apple-touch-icon.png'));
await sharp(await icono(512)).png().toFile(out('marca/icono-512.png'));
const b64 = (await icono(96, 18)).toString('base64');
fs.writeFileSync(out('marca/favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="64" height="64" viewBox="0 0 96 96"><image width="96" height="96" href="data:image/png;base64,${b64}"/></svg>\n`);

/* ---- 3. og:image 1200×630: el titular a la izquierda y el cartel a la derecha ---- */
let cartel;
if (hay) {
  const todo = svg;
  cartel = await sharp(Buffer.from(todo), { density: 72 * (460 / viewBox(todo)[2]) }).resize({ width: 460, withoutEnlargement: false }).png().toBuffer();
} else {
  // el cartel de la foto de la entrada, entero (1080 px), recortado a un cuadrado de 460
  cartel = await sharp(out('img/fotos/entrada-cartel-1024.jpg')).resize(460, 460, { fit: 'cover', position: 'centre' }).png().toBuffer();
}
const cm = await sharp(cartel).metadata();
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="${AMARILLO}"/>
  <text x="60" y="200" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="700" letter-spacing="2" fill="${PARDO}">ALBERGUE · CAMINO PRIMITIVO</text>
  <text x="60" y="290" font-family="Arial, Helvetica, sans-serif" font-size="68" font-weight="800" fill="${PARDO}">Casa Sánchez</text>
  <text x="60" y="360" font-family="Georgia, serif" font-size="32" font-style="italic" fill="${PARDO}">Un albergue con jardín en el centro</text>
  <text x="60" y="402" font-family="Georgia, serif" font-size="32" font-style="italic" fill="${PARDO}">de Grandas de Salime</text>
  <text x="60" y="490" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="${PARDO}">16 literas · 4 habitaciones</text>
  <text x="60" y="522" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="${PARDO}">y un apartamento para dos</text>
</svg>`;
await sharp(Buffer.from(og)).composite([{ input: cartel, left: 1200 - 60 - cm.width, top: Math.round((630 - cm.height) / 2) }]).jpeg({ quality: 84, mozjpeg: true }).toFile(out('img/og.jpg'));
console.log(`marca/ e img/og.jpg listos (${hay ? 'desde marca/cartel.svg' : 'sin vector todavía: del cartel de la foto'})`);
