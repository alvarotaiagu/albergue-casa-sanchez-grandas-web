/* Prepara las fotos de la web desde las del directorio y las de Instagram del albergue
   (ref/fotos/directorio, ref/fotos/instagram y ref/fotos/instagram/grandes).
   Uso: node scripts/fotos.mjs            (todas)
        node scripts/fotos.mjs cocina salon   (solo esas; el resto de fotos.json se conserva)
   - Lista y recortes: scripts/fotos-lista.json. Si una foto de Instagram tiene version en
     ref/fotos/instagram/grandes/ (1080 px), se usa esa; el recorte (`recorte`) va en los
     pixeles del fichero de origen que se use (el `regueiro` no tiene grande: 640 px).
   - Gradacion comun para que parezcan de la misma sesion (vienen de moviles de 2017-2025, del
     directorio y de recompresiones de Instagram): menos saturacion general, aun menos en el
     verde de cesped y el fucsia, negros mas suaves. Las de dentro, ademas, medio balance de
     blancos «mundo gris». `fuerza` (0-1) la suaviza; sin calor anadido: el cartel debe seguir
     siendo amarillo.
   - NUNCA amplia: anchos 480, 800, 1024 y 1280 solo si caben, mas el ancho propio.
   - Escribe img/fotos/<nombre>-<ancho>.{avif,webp,jpg} e img/fotos/fotos.json
     ({nombre, anchos, ancho, alto, origen, origenAncho, origenAlto, recorte}). */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const sharp = require('sharp');

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const REF = path.join(RAIZ, 'ref');
const SALIDA = path.join(RAIZ, 'img/fotos');
fs.mkdirSync(SALIDA, { recursive: true });

const FOTOS = JSON.parse(fs.readFileSync(path.join(RAIZ, 'scripts/fotos-lista.json'), 'utf8'));
const ANCHOS = [480, 800, 1024, 1280];
const solo = process.argv.slice(2);

function peso(h, centro, ancho) {
  let d = Math.abs(h - centro); if (d > 180) d = 360 - d;
  return d >= ancho ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * d / ancho);
}

function gradar(data, canales, interior, fuerza = 1) {
  if (fuerza <= 0) return data;
  const n = data.length / canales;
  let gr = 1, gg = 1, gb = 1;
  if (interior) {
    let sr = 0, sg = 0, sb = 0;
    for (let i = 0; i < data.length; i += canales) { sr += data[i]; sg += data[i + 1]; sb += data[i + 2]; }
    const mr = sr / n, mg = sg / n, mb = sb / n, mm = (mr + mg + mb) / 3;
    gr = 1 + 0.5 * (mm / mr - 1); gg = 1 + 0.5 * (mm / mg - 1); gb = 1 + 0.5 * (mm / mb - 1);
  }
  const LEVANTE = 0.04;
  for (let i = 0; i < data.length; i += canales) {
    let r = Math.min(1, data[i] * gr / 255), g = Math.min(1, data[i + 1] * gg / 255), b = Math.min(1, data[i + 2] * gb / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), c = max - min;
    let h = 0;
    if (c > 0) {
      if (max === r) h = 60 * (((g - b) / c) % 6);
      else if (max === g) h = 60 * ((b - r) / c + 2);
      else h = 60 * ((r - g) / c + 4);
      if (h < 0) h += 360;
    }
    let s = max === 0 ? 0 : c / max;
    const v = max;
    // menos saturacion general; aun menos en el verde de cesped (~100) y el fucsia (~330)
    s *= 0.92 * (1 - 0.2 * peso(h, 100, 50) - 0.14 * peso(h, 330, 30));
    const cc = v * s, x = cc * (1 - Math.abs(((h / 60) % 2) - 1)), m0 = v - cc;
    let rr, gg2, bb;
    if (h < 60) [rr, gg2, bb] = [cc, x, 0];
    else if (h < 120) [rr, gg2, bb] = [x, cc, 0];
    else if (h < 180) [rr, gg2, bb] = [0, cc, x];
    else if (h < 240) [rr, gg2, bb] = [0, x, cc];
    else if (h < 300) [rr, gg2, bb] = [x, 0, cc];
    else [rr, gg2, bb] = [cc, 0, x];
    r = rr + m0; g = gg2 + m0; b = bb + m0;
    const curva = (t) => LEVANTE + (1 - LEVANTE - 0.02) * t;
    r = curva(r); g = curva(g); b = curva(b);
    const o0 = data[i], o1 = data[i + 1], o2 = data[i + 2];
    data[i] = Math.round(o0 + (r * 255 - o0) * fuerza); data[i + 1] = Math.round(o1 + (g * 255 - o1) * fuerza); data[i + 2] = Math.round(o2 + (b * 255 - o2) * fuerza);
  }
  return data;
}

// Instagram: usa la grande (1080 px) si existe
function resolver(ruta) {
  const dir = path.dirname(ruta), base = path.basename(ruta);
  if (dir.split(path.sep).join('/').endsWith('instagram')) {
    const g = path.join(REF, dir, 'grandes', base);
    if (fs.existsSync(g)) return g;
  }
  return path.join(REF, ruta);
}

const previo = fs.existsSync(path.join(SALIDA, 'fotos.json')) ? JSON.parse(fs.readFileSync(path.join(SALIDA, 'fotos.json'), 'utf8')) : [];
const salida = [];
for (const f of FOTOS) {
  if (solo.length && !solo.includes(f.nombre)) { const p = previo.find((x) => x.nombre === f.nombre); if (p) salida.push(p); continue; }
  const fuente = resolver(f.ruta);
  if (!fs.existsSync(fuente)) throw new Error(`Falta ${fuente} (${f.nombre})`);
  const meta = await sharp(fuente).metadata();
  let base = sharp(fuente).rotate();
  if (f.recorte) base = base.extract(f.recorte);
  const { data, info } = await base.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  gradar(data, info.channels, !!f.interior, f.fuerza ?? 1);
  const buf = await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } }).png().toBuffer();
  const W = info.width, H = info.height;
  const tope = Math.min(W, f.maxAncho || W);
  const unicos = [...new Set([...ANCHOS.filter((w) => w < tope - 30), tope])];
  for (const w of unicos) {
    let p = sharp(buf).resize({ width: w, withoutEnlargement: true, kernel: 'lanczos3' });
    if (!f.suave) p = p.sharpen({ sigma: 0.5, m1: 0.5, m2: 1 });
    const dst = path.join(SALIDA, `${f.nombre}-${w}`);
    await p.clone().avif({ quality: f.aq ?? 52, effort: 6 }).toFile(dst + '.avif');
    await p.clone().webp({ quality: f.wq ?? 76 }).toFile(dst + '.webp');
    await p.clone().jpeg({ quality: 82, mozjpeg: true }).toFile(dst + '.jpg');
  }
  const alto = Math.round(H * tope / W);
  salida.push({
    nombre: f.nombre, anchos: unicos, ancho: tope, alto,
    origen: path.relative(REF, fuente).split(path.sep).join('/'), origenAncho: meta.width, origenAlto: meta.height,
    recorte: f.recorte || null,
  });
  console.log(f.nombre.padEnd(20), unicos.join(','), `${tope}x${alto}`, '<-', path.relative(REF, fuente).split(path.sep).join('/'));
}
fs.writeFileSync(path.join(SALIDA, 'fotos.json'), JSON.stringify(salida, null, 1));
console.log(salida.length + ' fotos');
