/* Genera las páginas a partir de sus fuentes *.src.html:
   1. <!--parte:partes/archivo.html--> → el contenido de ese archivo. Si no existe (la cortina mientras
      el agente Entrada no la deje), deja un comentario y la web funciona sin ella.
   2. {{clave}} → el valor de datos.json (precios, temporada, teléfonos…: UN solo sitio).
   3. <img data-foto="nombre" ...> → <picture> con AVIF, WebP y JPG en todos los anchos de
      img/fotos/fotos.json (el <img> conserva sus demás atributos).
   4. <!--marca-cabecera--> → «Casa Sánchez» con la letra del cartel (marca/letra.svg, la saca
      scripts/marca.mjs del vector marca/cartel.svg) o, mientras no exista, el texto con una letra de respaldo.
   5. Los <link> y <script> de CSS/JS propios que aún no existen (los módulos de otros agentes mientras no
      estén) se quitan con un aviso: la web no pide archivos que no hay.
   6. Ejecuta versionar.mjs para poner ?v=<huella> a CSS y JS.
   Se edita SIEMPRE el *.src.html (o la parte); el .html generado se sobrescribe. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const FOTOS = new Map(JSON.parse(fs.readFileSync(path.join(RAIZ, 'img/fotos/fotos.json'), 'utf8')).map((f) => [f.nombre, f]));
const DATOS = JSON.parse(fs.readFileSync(path.join(RAIZ, 'datos.json'), 'utf8'));
const existe = (r) => fs.existsSync(path.join(RAIZ, r));

function picture(atrs) {
  const nombre = /data-foto="([^"]+)"/.exec(atrs)[1];
  const f = FOTOS.get(nombre);
  if (!f) throw new Error('Foto desconocida: ' + nombre);
  const sizes = (/\bsizes="([^"]+)"/.exec(atrs) || [, '100vw'])[1];
  const set = (ext) => f.anchos.map((w) => `img/fotos/${nombre}-${w}.${ext} ${w}w`).join(', ');
  const base = f.anchos.includes(800) ? 800 : f.anchos[f.anchos.length - 1];
  let resto = atrs.replace(/\s*data-foto="[^"]+"/, '').replace(/\s*\bsizes="[^"]+"/, '');
  if (!/\bloading=/.test(resto) && !/fetchpriority="high"/.test(resto)) resto += ' loading="lazy"';
  if (!/\bdecoding=/.test(resto)) resto += ' decoding="async"';
  return `<picture data-foto="${nombre}">`
    + `<source type="image/avif" srcset="${set('avif')}" sizes="${sizes}">`
    + `<source type="image/webp" srcset="${set('webp')}" sizes="${sizes}">`
    + `<img src="img/fotos/${nombre}-${base}.jpg" srcset="${set('jpg')}" sizes="${sizes}" width="${f.ancho}" height="${f.alto}"${resto}>`
    + `</picture>`;
}

const partes = (html, prof = 0) => html.replace(/<!--parte:([^\s>]+)\s*-->/g, (m, ruta) => {
  const f = path.join(RAIZ, ruta);
  if (!fs.existsSync(f)) { console.warn('  (falta ' + ruta + ')'); return `<!-- sin ${ruta} -->`; }
  if (prof > 3) throw new Error('Partes anidadas de más: ' + ruta);
  return partes(fs.readFileSync(f, 'utf8').trim(), prof + 1);
});

const datos = (html, fichero) => html.replace(/\{\{([a-z_]+)\}\}/g, (m, k) => {
  if (!(k in DATOS)) throw new Error(`${fichero}: falta «${k}» en datos.json`);
  return DATOS[k];
});

// «Casa Sánchez» de la cabecera: la letra del cartel (vector) si marca.mjs ya la ha sacado
function marcaCabecera() {
  if (existe('marca/letra.svg') && existe('marca/letra.json')) {
    const { ancho, alto } = JSON.parse(fs.readFileSync(path.join(RAIZ, 'marca/letra.json'), 'utf8'));
    return `<img class="marca__letra" src="marca/letra.svg" width="${ancho}" height="${alto}" alt="Casa Sánchez">`;
  }
  console.warn('  (sin marca/letra.svg: la cabecera lleva «Casa Sánchez» en texto hasta que Entrada deje marca/cartel.svg y se ejecute scripts/marca.mjs)');
  return '<span class="marca__texto">Casa Sánchez</span>';
}

const quitarAusentes = (html) => html
  .replace(/[ \t]*<link rel="stylesheet" href="(css\/[^"?]+)"[^>]*>\r?\n?/g, (m, r) => (existe(r) ? m : (console.warn('  (sin ' + r + ': se quita su <link>)'), '')))
  .replace(/[ \t]*<script (?:type="module" )?src="(js\/[^"?]+)"[^>]*><\/script>\r?\n?/g, (m, r) => (existe(r) ? m : (console.warn('  (sin ' + r + ': se quita su <script>)'), '')));

const fuentes = fs.readdirSync(RAIZ).filter((f) => f.endsWith('.src.html'));
for (const src of fuentes) {
  let html = quitarAusentes(partes(fs.readFileSync(path.join(RAIZ, src), 'utf8')));
  html = html.replace(/<!--marca-cabecera-->/g, marcaCabecera);
  html = datos(html, src);
  html = html.replace(/<img\b([^>]*\bdata-foto="[^"]+"[^>]*)>/g, (m, a) => picture(a.replace(/\s*\/$/, '')));
  const destino = src.replace('.src.html', '.html');
  fs.writeFileSync(path.join(RAIZ, destino), html);
  console.log(`${src} → ${destino} (${(html.length / 1024).toFixed(0)} KB)`);
}
execFileSync(process.execPath, [path.join(RAIZ, 'versionar.mjs')], { stdio: 'inherit' });
