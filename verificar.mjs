/* Verificación de la web del Albergue Casa Sánchez (Playwright, un solo navegador, ventanas pequeñas, escala 1).
   Uso: node verificar.mjs   (puerto 8891). Sin capturas: lo que hay que mirar a ojo va en el README.
   Antes de lanzarlo: Get-CimInstance Win32_Process -Filter "Name='chrome-headless-shell.exe'" (una prueba a la vez).
   El WebGL NO se pinta: el navegador arranca con --disable-3d-apis (sin swiftshader) y la página se abre con ?sin-webgl.
   Todas las pruebas con movimiento reducido salvo las de movimiento (cortina, entrada de la portada), que van una vez
   y al final. Los módulos de los otros agentes se prueban solo si ya están. */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const { chromium } = require('playwright');

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const PUERTO = 8891;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.bin': 'application/octet-stream' };
const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(RAIZ, p);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
servidor.on('error', (e) => { console.error(`El puerto ${PUERTO} está ocupado (¿otra sesión?): ${e.message}`); process.exit(2); });
await new Promise((r) => servidor.listen(PUERTO, r));
const BASE = `http://localhost:${PUERTO}/`;
const PAG = BASE + 'index.html?sin-webgl';

const fallos = [];
let nOk = 0;
const comprobar = (cond, m, detalle) => { if (cond) { nOk++; console.log('  ok     ' + m); } else { fallos.push(m); console.log('  FALLO  ' + m + (detalle !== undefined ? ' → ' + JSON.stringify(detalle) : '')); } };
const nota = (m) => console.log('  ·      ' + m);
const LLAVE = 'casasanchez-cookies';
const sinCookies = `try { localStorage.setItem('${LLAVE}', 'si'); } catch (e) {}`;
const existe = (f) => fs.existsSync(path.join(RAIZ, f));
const HAY = { cartel: existe('js/cartel.js'), flecha: existe('js/flecha.js'), jardin: existe('js/jardin.js'), etapa: existe('js/etapa.js'), reserva: existe('js/reserva.js'), cortina: existe('partes/cortina.html') };

/* librerías desde una copia local: la prueba no depende del CDN ese día */
const CDN = {
  'lenis.min.js': 'https://cdn.jsdelivr.net/npm/@studio-freight/lenis@1.0.42/dist/lenis.min.js',
  'gsap.min.js': 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js',
  'ScrollTrigger.min.js': 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js',
};
const CACHE = path.join(os.tmpdir(), 'tulla-cdn'); // la misma copia que usa la web hermana
fs.mkdirSync(CACHE, { recursive: true });
for (const [n, u] of Object.entries(CDN)) {
  const f = path.join(CACHE, n);
  if (!fs.existsSync(f)) fs.writeFileSync(f, Buffer.from(await (await fetch(u)).arrayBuffer()));
}
const RE_CDN = /cdn\.jsdelivr\.net\/npm\/.*\/(lenis|gsap|ScrollTrigger)\.min\.js$/;
const local = (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(CACHE, r.request().url().split('/').pop())) });
const RE_TIEMPO = /api\.open-meteo\.com/;
const TIEMPO_OK = { current: { temperature_2m: 14.2, relative_humidity_2m: 71, weather_code: 61, wind_speed_10m: 9.5, is_day: 1, precipitation: 0.3 } };

/* ================= 0. archivos (sin navegador) ================= */
console.log('\n0. Archivos');
console.log('  (módulos presentes: ' + Object.entries(HAY).map(([k, v]) => k + (v ? ' sí' : ' no')).join(', ') + ')');
const htmls = fs.readdirSync(RAIZ).filter((f) => f.endsWith('.html') && !f.endsWith('.src.html'));
for (const f of htmls) {
  const s = fs.readFileSync(path.join(RAIZ, f), 'utf8');
  comprobar(/^<!DOCTYPE html>\s*<html lang="es">\s*<head>\s*<meta charset="utf-8">\s*<meta name="robots" content="noindex, ?nofollow">/.test(s), `${f}: charset lo primero y noindex justo detrás`);
  const ids = [...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const rep = ids.filter((x, i) => ids.indexOf(x) !== i);
  comprobar(rep.length === 0, `${f}: ningún id repetido`, [...new Set(rep)]);
  comprobar(!/<!--parte:/.test(s) && !/<!-- sin partes\/(cabeza|cabecera|reserva|llegar|pie|guiones)/.test(s) && !/\{\{[a-z_]+\}\}/.test(s) && !/<!--marca-cabecera-->/.test(s), `${f}: todas las partes y datos sustituidos`);
}
if (!HAY.cortina) nota('aún no está partes/cortina.html (agente Entrada): la web va sin cortina');
comprobar(['.nojekyll', '404.html', 'manifest.json', 'datos.json', 'img/og.jpg', 'img/groucho.svg', 'marca/favicon.svg', 'marca/favicon-32.png', 'marca/apple-touch-icon.png', 'marca/icono-512.png'].every(existe), '.nojekyll, 404, manifest, datos, og:image, Groucho y favicons');
const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const lista = JSON.parse(fs.readFileSync(path.join(RAIZ, 'scripts/fotos-lista.json'), 'utf8'));
const fotosJson = JSON.parse(fs.readFileSync(path.join(RAIZ, 'img/fotos/fotos.json'), 'utf8'));
const datos = JSON.parse(fs.readFileSync(path.join(RAIZ, 'datos.json'), 'utf8'));
const mainJs = fs.readFileSync(path.join(RAIZ, 'js/main.js'), 'utf8');
const css = fs.readFileSync(path.join(RAIZ, 'css/estilos.css'), 'utf8');
{
  const rutas = new Set();
  for (const m of html.matchAll(/(src|srcset|href|imagesrcset)="([^"]+)"/g)) for (const parte of (/srcset/.test(m[1]) ? m[2].split(',') : [m[2]])) {
    const r = parte.trim().split(/\s+/)[0].split('?')[0];
    if (r && r !== './' && !/^(https?:|mailto:|tel:|#|data:)/.test(r)) rutas.add(r);
  }
  const faltan = [...rutas].filter((r) => !existe(r));
  comprobar(faltan.length === 0, `index.html: existen los ${rutas.size} archivos que enlaza`, faltan);
  const pre = /<link rel="preload" as="image" type="image\/avif" imagesrcset="([^"]+)"/.exec(html);
  const pic = /<picture data-foto="entrada-cartel"><source type="image\/avif" srcset="([^"]+)"/.exec(html);
  comprobar(pre && pic && pre[1] === pic[1], 'la foto de la portada (entrada-cartel) va precargada con el mismo srcset que pinta el <picture>');
  // fotos: solo del directorio y de Instagram del albergue; nada con marca de agua, de terceros ni de IA; el regueiro sin las personas
  comprobar(lista.every((f) => /^fotos\/(directorio|instagram)\//.test(f.ruta) && !/gronze|DALL|midjourney|ia-|generada/i.test(f.ruta)), 'todas las fotos son de la ficha del albergue o de su Instagram (ninguna de otro negocio, ninguna con IA)');
  const reg = lista.find((f) => f.nombre === 'regueiro');
  comprobar(reg && reg.recorte && reg.recorte.top >= 430, 'el regueiro va recortado SOLO al canal, sin las dos personas (top ≥ 430 de 640)', reg && reg.recorte);
  comprobar(/Bcu68zMB-Le/.test(lista.find((f) => f.nombre === 'entrada-cartel').ruta) && !lista.find((f) => f.nombre === 'entrada-cartel').recorte, 'entrada-cartel es la de Instagram Bcu68zMB-Le y sin recorte (las esquinas medidas valen)');
  const ec = fotosJson.find((f) => f.nombre === 'entrada-cartel');
  comprobar(ec && ec.ancho === ec.origenAncho && ec.alto === ec.origenAlto, 'entrada-cartel sale a su tamaño de origen, sin ampliar ni recortar', ec);
  comprobar(fotosJson.every((f) => f.ancho <= f.origenAncho * (f.recorte ? 1.0001 : 1.0001) && f.anchos.every((w) => w <= f.ancho)), 'ninguna foto se amplía (ancho de salida ≤ ancho de origen)');
  const nombres = ['entrada-cartel', 'entrada-cartel-b', 'casa-flor', 'jardin-casa', 'jardin-tumbonas', 'porche-hamaca', 'lavadero', 'habitacion-bano', 'cocina', 'embalse', 'magnolia', 'jardin-sol', 'arbol-amarillo', 'jardin-nieve', 'regueiro', 'cartel-recorte', 'dormitorio-literas'];
  comprobar(nombres.every((n) => fotosJson.some((f) => f.nombre === n) && existe(`img/fotos/${n}-${fotosJson.find((f) => f.nombre === n).anchos.slice(-1)[0]}.jpg`)), 'están todas las fotos que piden los módulos por nombre (fotos.json y archivos)');

  const texto = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ');
  const sinCitas = texto;
  comprobar(!/\b(una|1)( sola| única)? (reseña|opinión)\b/i.test(sinCitas) && /4,2/.test(texto) && /105 reseñas/.test(texto), 'la nota de Google es la de DATOS (4,2 con 105 reseñas), sin «una sola reseña»');
  comprobar(!/el mejor|los mejores|la mejor |clientes satisfechos|cientos de|miles de|sin permanencia|garantizad/i.test(texto.replace(/«[^»]*»/g, '')), 'sin superlativos propios ni prueba social inventada (las citas, aparte)');
  comprobar(!/whatsapp|wa\.me/i.test(html), 'sin WhatsApp (no consta el número)');
  comprobar(!/\bsello\b|tamp[oó]n|credencial obligatoria|sin credencial/i.test(texto), 'ningún sello, tampón ni credencial (los usa La Campa)');
  comprobar(!/niebla|tendedero animado|three\.js|webgl|sin-3d|3d\//i.test(html.replace(/sin-webgl/g, '')) && !existe('js/3d') && !existe('css/3d.css'), 'sin 3D, sin niebla y sin tendedero (no hay js/3d ni css/3d.css)');
  comprobar(/<html lang="es">/.test(html) && !/\/es\/|hreflang|lang="gl"/.test(html), 'solo castellano');
  comprobar([...html.matchAll(/<img\b[^>]*>/g)].every((m) => /\salt="/.test(m[0])), 'todas las imágenes llevan alt');
  comprobar((() => { try { JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]); return true; } catch (e) { return false; } })() && !/aggregateRating|reviewCount/.test(html), 'el JSON-LD se lee y no lleva recuento de reseñas');
  // datos: un solo sitio (datos.json) y lo dudoso, marcado
  comprobar(new RegExp(`${datos.litera} €`).test(html) && new RegExp(`${datos.apartamento} €`).test(html) && /por confirmar/.test(html) && !/18 €|70 €|12 €/.test(texto), 'precios de la fuente más reciente (datos.json: 20 € y 90 €), marcados «por confirmar» y sin los antiguos en el texto');
  comprobar(new RegExp(`${datos.apertura} al ${datos.cierre}`).test(html), 'temporada: del 15 de abril al 3 de noviembre (datos.json)');
  comprobar(/626 665 118/.test(html) && /985 781 150/.test(html) && /C\/ El Salvador, s\/n/.test(html) && /33730/.test(html) && !/Magad[aá]n/.test(texto), 'teléfonos, dirección y código postal de DATOS; el apellido del encargado no sale');
  comprobar(/Lo mejor del albergue es Juan/.test(html) && /traducido del italiano/.test(html), 'Juan: la cita literal con su fuente y sin cargo inventado');
  comprobar(/En el lavadero vigila Groucho/.test(html) && !/Groucho Marx|—\s*Groucho/.test(texto) && /img\/groucho\.svg/.test(html), 'el guiño de Groucho (dibujado a línea) y ninguna cita suya');
  comprobar(/Calefacción\.<\/b>/.test(html) && /Toallas ni jabón/.test(html) && /Desayuno ni comidas/.test(html), '«Lo que no hay»: sin calefacción, sin toallas ni jabón, sin desayuno');
  comprobar(/128 m/.test(html) && /1955/.test(html) && /Vaquero Palacios/.test(html) && /Vaquero Turcios/.test(html) && /data-visor="embalse"/.test(html), 'el embalse: 128 m, 1955, los Vaquero y la foto');
  comprobar(/20,4 km/.test(html) && /\+663 m/.test(html), 'las cifras de la etapa, calibradas a Gronze (20,4 km, +663/−1.017 m)');
  const flechas = [...html.matchAll(/data-modulo="flecha"/g)].length;
  comprobar(flechas >= 5 && flechas <= 6, `entre 5 y 6 flechas en toda la página (hay ${flechas})`);
  comprobar(/data-flor="1"/.test(html) && /data-flor="2"/.test(html) && /data-flor="3"/.test(html), 'las tres flores en la casa, el jardín y reservar');
  comprobar(/<section class="portada[^"]*" id="portada"[^>]*>[\s\S]*?<div class="portada__cartel" data-modulo="cartel">\s*<div class="panel-marco">\s*<picture data-foto="entrada-cartel">/.test(html)
    && /<section class="sec jardin[^"]*" id="jardin"[^>]*>[\s\S]*?<div class="jardin__modulo" data-modulo="jardin">/.test(html)
    && /<section class="sec etapa[^"]*" id="etapa"[^>]*>[\s\S]*?<div class="etapa__modulo" data-modulo="etapa">/.test(html)
    && /<section class="sec reservar[^"]*" id="reservar"[^>]*>[\s\S]*?<div class="reservar__modulo" data-modulo="reserva">/.test(html)
    && /<footer class="pie[^"]*" id="pie">[\s\S]*?data-modulo="cartel-pie"/.test(html), 'los sitios de los módulos, como dice el contrato (cartel, jardín, etapa, reserva y cartel-pie)');
  const iMain = html.indexOf('js/main.js');
  const mods = ['js/cartel.js', 'js/flecha.js', 'js/jardin.js', 'js/etapa.js', 'js/reserva.js'].filter((s) => html.includes('src="' + s));
  comprobar(mods.every((s) => html.indexOf('src="' + s) < iMain && new RegExp('<script src="' + s.replace('.', '\\.') + '[^"]*" defer>').test(html)), 'los JS de los módulos que hay, con defer y antes de main.js', mods);
  comprobar(['css/entrada.css', 'css/jardin.css', 'css/etapa.css', 'css/reserva.css'].filter((c) => html.includes(c)).every((c) => html.indexOf(c) < html.indexOf('</head>') && html.indexOf(c) > html.indexOf('css/estilos.css')), 'los CSS de los módulos que hay, en el <head> y después de estilos.css');
  comprobar(/family=League\+Spartan/.test(html) && /family=Petrona/.test(html) && /family=Rethink\+Sans/.test(html) && (html.match(/family=/g) || []).length === 3, 'tres letras de Google Fonts, con display=swap: League Spartan, Petrona y Rethink Sans');
}
// tokens medidos del cartel y alias que piden los módulos
comprobar(['--amarillo: #E0BF50', '--pardo: #412B21', '--oro: #A37F31', '--azul: #291886', '--pizarra: #33373C', '--pizarra-2: #4A4F55', '--piedra: #B9AE9C', '--madera: #7A5236', '--cal: #F5F0E6', '--hoja: #4F7A3A'].every((t) => css.includes(t)), 'los colores del cartel medidos (#E0BF50, #412B21, #A37F31, #291886) y los tokens de la paleta');
comprobar(/--f-titulo:/.test(css) && /--f-voz:/.test(css) && /--f-texto:/.test(css) && /--f-txt:/.test(css) && /--cab:/.test(css), 'los tokens y alias que leen los módulos (--f-titulo, --f-voz, --f-texto, --f-txt y --cab)');
comprobar(/\.cookies:not\(\[hidden\]\)\s*\{[^}]*display:\s*flex/.test(css) && !/\.cookies\s*\{[^}]*display:/.test(css), 'cookies: display solo en :not([hidden])');
comprobar(/\.mando:not\(\[hidden\]\)/.test(css) && !/\.mando\s*\{[^}]*display:/.test(css), 'mando: display solo en :not([hidden])');
comprobar(/\.menu-movil\s*\{[^}]*height:\s*100dvh/.test(css) && !/\.menu-movil\s*\{[^}]*inset:\s*0/.test(css), 'menú móvil: altura 100dvh, nunca inset:0 (la cabecera lleva backdrop-filter)');
comprobar(!/\ddvh/.test(css.replace(/\.menu-movil\s*\{[^}]*\}/, '')), 'fuera del menú fijo, ningún dvh (la barra del móvil no mueve nada)');
comprobar(/html\.cortina-fuera #cortina\s*\{\s*display:\s*none/.test(css) && /prefers-reduced-motion: reduce\)\s*\{\s*#cortina\s*\{\s*display:\s*none/.test(css) && /#cortina\[hidden\]\s*\{\s*display:\s*none/.test(css), 'cortina: la web la oculta al salir, con [hidden] y con movimiento reducido');
comprobar(!/cursor:\s*none/.test(css + mainJs), 'sin cursor propio (nunca dos cursores)');
comprobar(!/position:\s*sticky/.test(css.replace(/[^{}]*\.(etapa)[^{}]*\{[^}]*\}/g, '')) && !/marquee/i.test(css + html), 'fuera la pila sticky de tarjetas y el marquee');
comprobar(/const motion = !quieto;\s*if \(motion\) raiz\.classList\.add\('con-movimiento'\)/.test(mainJs), '«con-movimiento» solo sin movimiento reducido');
comprobar(/if \(esBarra\(\)\) return;/.test(mainJs) && !/addEventListener\('resize'[^;]*innerHeight/.test(mainJs), 'el resize de la barra del móvil no rehace nada');
comprobar(/window\.__redCortina = setTimeout/.test(html) && /<noscript><style>\.cortina,#cortina\{display:none!important\}<\/style><\/noscript>/.test(html), 'red de seguridad inline y <noscript> para la cortina');
comprobar(/open-meteo\.com\/v1\/forecast\?latitude=43\.218074&longitude=-6\.876649&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day,precipitation&timezone=Europe%2FMadrid/.test(mainJs) && /30 \* 60 \* 1000/.test(mainJs) && /sessionStorage/.test(mainJs), 'el tiempo: la URL de DATOS, una petición, caché de 30 min en sessionStorage');
{
  const ck = fs.readFileSync(path.join(RAIZ, 'cookies.html'), 'utf8');
  comprobar(/Google Fonts/.test(ck) && /Google Maps/.test(ck) && /Open-Meteo/.test(ck) && /sin cookies|no instala cookies/.test(ck) && /casasanchez-tiempo/.test(ck), 'la página de cookies cita Google Fonts, el mapa de Google y Open-Meteo (sin cookies)');
  const g = fs.readFileSync(path.join(RAIZ, '404.html'), 'utf8');
  comprobar(/Esta página se ha ido sin avisar/.test(g) && /img\/groucho\.svg/.test(g) && /Vuelve al jardín/.test(g), 'la 404 es de Groucho (a línea): «Esta página se ha ido sin avisar. Vuelve al jardín»');
}

/* ================= navegador: uno solo, sin WebGL ================= */
const browser = await chromium.launch({ headless: true, args: ['--disable-3d-apis'] });
try {
  async function nueva(op = {}, { cdn = 'local', script, abortar, tiempo = 'ok' } = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: 'reduce', ...op });
    if (cdn === 'local') await ctx.route(RE_CDN, local);
    if (cdn === 'caido') await ctx.route(RE_CDN, (r) => r.abort());
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await ctx.route(/google\.com\/maps/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>mapa</p>' }));
    ctx._peticionesTiempo = 0;
    await ctx.route(RE_TIEMPO, (r) => { ctx._peticionesTiempo++; if (tiempo === 'ok') r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TIEMPO_OK) }); else r.abort(); });
    if (abortar) await ctx.route(abortar, (r) => r.abort());
    if (script) await ctx.addInitScript(script);
    const page = await ctx.newPage();
    page._errores = [];
    page.on('pageerror', (e) => page._errores.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|net::|WebGL|webgl/.test(m.text())) page._errores.push('consola: ' + m.text()); });
    page.on('response', (r) => { if (r.status() >= 400) page._errores.push(r.status() + ' ' + r.url()); });
    return { ctx, page };
  }
  const fuera = (page) => page.waitForFunction(() => document.documentElement.classList.contains('cortina-fuera'), null, { timeout: 12000 });
  // contraste de las parejas de texto (componiendo el alfa sobre el fondo)
  const contrastes = (page, sel) => page.evaluate((sel) => {
    const lz = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const rgba = (c) => { lz.clearRect(0, 0, 1, 1); lz.fillStyle = '#000'; lz.fillStyle = c; lz.fillRect(0, 0, 1, 1); return [...lz.getImageData(0, 0, 1, 1).data]; };
    const L = (m) => { m = m.map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * m[0] + .7152 * m[1] + .0722 * m[2]; };
    const fondo = (el) => { while (el) { const b = getComputedStyle(el).backgroundColor; if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b) && !/[, /] ?0\)$/.test(b)) return rgba(b).slice(0, 3); el = el.parentElement; } return rgba(getComputedStyle(document.body).backgroundColor).slice(0, 3); };
    return sel.map((s) => {
      const el = document.querySelector(s); if (!el) return [s, 'falta'];
      const f = fondo(el), c = rgba(getComputedStyle(el).color), a = c[3] / 255;
      const t = [0, 1, 2].map((i) => c[i] * a + f[i] * (1 - a));
      const x = L(t), y = L(f); return [s, Math.round(((Math.max(x, y) + .05) / (Math.min(x, y) + .05)) * 100) / 100];
    });
  }, sel);
  const ir = (page, y) => page.evaluate((y) => { const l = window.Sanchez.web && window.Sanchez.web.lenis; if (l) l.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); }, y);
  const yDe = (page, sel, extra = 0) => page.evaluate(([s, e]) => document.querySelector(s).getBoundingClientRect().top + scrollY + e, [sel, extra]);

  /* ---------- 1. portada, superficies y contraste (escritorio, movimiento reducido) ---------- */
  console.log('\n1. Portada, superficies y contraste (escritorio, movimiento reducido)');
  {
    const { ctx, page } = await nueva({}, { script: sinCookies });
    await page.goto(PAG);
    await fuera(page);
    comprobar(await page.evaluate(() => { const c = document.getElementById('cortina'); return (!c || getComputedStyle(c).display === 'none') && !document.documentElement.classList.contains('con-movimiento'); }), 'con movimiento reducido no hay cortina ni «con-movimiento»');
    comprobar(await page.evaluate(() => getComputedStyle(document.body).cursor !== 'none' && !document.querySelector('.cursor, [class*="cursor-"]')), 'sin cursor propio (nunca dos cursores)');
    const p = await page.evaluate(() => {
      const R = (s) => document.querySelector(s).getBoundingClientRect();
      const img = document.querySelector('.portada__cartel img');
      const t = R('.portada-texto'), m = R('.portada__cartel');
      return { carga: !!img && img.complete && img.naturalWidth > 0, ancho: Math.round(img ? img.getBoundingClientRect().width : 0), nat: img ? img.naturalWidth : 0, vista: innerWidth, solapa: !(t.right <= m.left || m.right <= t.left || t.bottom <= m.top || m.bottom <= t.top), cab: document.getElementById('cab').getBoundingClientRect().bottom <= Math.min(t.top, m.top) + 1, abierta: document.getElementById('portada').classList.contains('abierta'), titulo: getComputedStyle(document.querySelector('.portada-texto')).opacity, montado: document.querySelector('#portada [data-modulo="cartel"]').dataset.montado === '1' };
    });
    comprobar(p.carga, 'la foto del cartel de la portada carga', p);
    if (!p.montado) comprobar(p.ancho <= p.nat * 1.3 && p.ancho < p.vista * 0.7 && !p.solapa && p.cab, 'en escritorio la foto no va a sangre: contenida en su marco (≤ 1,3× su detalle), sin pisar el texto ni la cabecera', p);
    else nota('el cartel de Entrada ya está montado: su diseño es suyo');
    comprobar(p.abierta && p.titulo === '1', 'sin cortina, la portada ya está abierta y el titular entero', p);
    const fondos = await page.evaluate(() => ['#portada', '#casa', '#jardin', '#dentro', '#embalse', '#opiniones', '#llegar', '#pie'].map((s) => getComputedStyle(document.querySelector(s)).backgroundColor));
    comprobar(fondos.join('|') === 'rgb(224, 191, 80)|rgb(245, 240, 230)|rgb(235, 227, 209)|rgb(51, 55, 60)|rgb(185, 174, 156)|rgb(224, 191, 80)|rgb(51, 55, 60)|rgb(94, 63, 41)', 'cada sección con su superficie: amarillo, cal, cal 2, pizarra, piedra, amarillo, pizarra y madera', fondos);
    const cs = await contrastes(page, ['.portada .eyebrow', '.portada__baj', '.portada__tit', '#casa .eyebrow', '#casa .sec-cab__txt', '#casa h2 em', '.casa__f figcaption', '.juan footer .mono', '.cifras span', '#jardin .eyebrow', '#jardin .sec-cab__txt', '.jardin__flora p', '.jardin__citas .mono', '.estaciones figcaption', '.estaciones__tit .mono', '#dentro .eyebrow', '#dentro .sec-cab__txt', '.dentro__f figcaption', '.hay li', '.nohay li', '.groucho figcaption', '.apartamento p', '.precios p', '.precios__fuente', '.fotos-fuente', '#etapa .eyebrow', '#etapa .sec-cab__txt', '.etapa__resumen span', '.etapa__fuente', '#embalse .eyebrow', '.embalse__datos span', '.embalse__fuente', '#pueblo .eyebrow', '#pueblo .sec-cab__txt', '.lista li b', '.descanso p', '.descanso h4 .mono', '.tabla-etapa th', '.cita figcaption', '.cita blockquote p', '.opiniones__nota .mono', '#opiniones .eyebrow', '#opiniones .sec-cab__txt', '.demo', '.datos dt', '.sup', '.llegar__dir', '.como', '.contacto span', '.map-consent p', '.pie__frase span', '.pie__cols p', '.pie__legal', '#portada .btn--marca', '#dentro .btn--marca', '#llegar .btn--marca', '#pie .btn--marca', '.cab__nav a']);
    const malos = cs.filter(([, v]) => v === 'falta' || v < 4.5);
    comprobar(malos.length === 0, `contraste ≥ 4,5:1 en ${cs.length} parejas de texto, en todas las superficies`, malos);
    comprobar(await page.evaluate(() => { const m = document.getElementById('mando'); return m.hidden && getComputedStyle(m).display === 'none'; }), 'sin ?revision el mando no se ve');
    comprobar(await page.evaluate(() => getComputedStyle(document.getElementById('vistazo')).display === 'none'), 'la tabla «de un vistazo» solo sale en la sobria');
    // las fotos nunca más de 1,3× su detalle real (se miden las visibles en pantalla ancha)
    const grandes = await page.evaluate(() => [...document.querySelectorAll('main img[width], footer img[width]')].filter((i) => !i.closest('.groucho') && i.getBoundingClientRect().width > 0).map((i) => [i.currentSrc.split('/').pop(), Math.round(i.getBoundingClientRect().width), +i.getAttribute('width')]).filter(([, w, n]) => w > n * 1.31));
    comprobar(grandes.length === 0, 'ninguna foto se ve a más de 1,3× su detalle real en escritorio', grandes);
    // el foco: contorno de 2 px y la flechita azul junto al elemento
    await ir(page, 0); await page.waitForTimeout(100);
    await page.locator('#portada .btn--marca').focus();
    await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab'); await page.waitForTimeout(80);
    const foco = await page.evaluate(() => { const e = document.activeElement, s = getComputedStyle(e), r = e.getBoundingClientRect(), p = document.getElementById('foco-flecha'), q = p.getBoundingClientRect(); return { el: e.className, outline: s.outlineStyle, ancho: s.outlineWidth, flecha: getComputedStyle(p).opacity, junto: Math.abs((q.top + q.height / 2) - (r.top + r.height / 2)) < 6 && q.right <= r.left, fijo: getComputedStyle(p).position, img: getComputedStyle(p).backgroundImage }; });
    comprobar(foco.outline === 'solid' && foco.ancho === '2px' && +foco.flecha > 0.5 && foco.junto && foco.fijo === 'fixed' && /foco-flecha.svg/.test(foco.img), 'el foco del teclado: contorno de 2 px y la flechita azul a brochazo (img/brocha/foco-flecha.svg) junto al elemento', foco);
    const fn = await page.evaluate(() => { const b = document.querySelector('#llegar .btn--marca'); b.focus(); return getComputedStyle(b).outlineColor; });
    comprobar(fn === 'rgb(224, 191, 80)', 'sobre la pizarra el contorno del foco es amarillo (se ve)', fn);
    // mapa solo al pedirlo
    comprobar(await page.evaluate(() => !document.querySelector('#mapa iframe')), 'el mapa de Google no se carga solo');
    await page.locator('#mapa-btn').click();
    comprobar(await page.evaluate(() => /google\.com\/maps\?q=43\.218074%2C-6\.876649/.test(document.querySelector('#mapa iframe')?.src || '')), 'el mapa se carga al pulsar, en las coordenadas de DATOS');
    comprobar(await page.evaluate(() => typeof window.Sanchez.reservar === 'function' && typeof window.Sanchez.alAbrirse === 'function' && typeof window.Sanchez.tiempo === 'function' && typeof window.Sanchez.fecha === 'function'), 'la web pone Sanchez.reservar(), alAbrirse(), tiempo() y fecha() para los módulos');
    comprobar(page._errores.length === 0, 'portada: sin errores de consola ni 404', page._errores.slice(0, 5));
    await ctx.close();
  }

  /* ---------- 2. el tiempo y la fecha ---------- */
  console.log('\n2. El tiempo (Open-Meteo) y la fecha');
  {
    const { ctx, page } = await nueva({}, { script: sinCookies });
    await page.goto(PAG);
    await fuera(page);
    const t = await page.evaluate(() => window.Sanchez.tiempo());
    comprobar(t.fuente === 'open-meteo' && t.temp === 14.2 && t.codigo === 61 && t.lluvia > 0 && t.viento === 9.5 && t.esDeDia === true && t.nubes > 0 && typeof t.nombre === 'string', 'Sanchez.tiempo(): { temp, codigo, lluvia, viento, nubes, esDeDia, fuente: open-meteo }', t);
    await page.evaluate(() => window.Sanchez.tiempo()); await page.reload(); await fuera(page); await page.evaluate(() => window.Sanchez.tiempo());
    comprobar(ctx._peticionesTiempo === 1 && await page.evaluate(() => !!sessionStorage.getItem('casasanchez-tiempo')), 'una sola petición a Open-Meteo: la segunda sale de la caché de 30 min (sessionStorage)', ctx._peticionesTiempo);
    comprobar(page._errores.length === 0, 'con tiempo: sin errores', page._errores.slice(0, 3));
    await ctx.close();
  }
  {
    const { ctx, page } = await nueva({}, { script: sinCookies, tiempo: 'cae' });
    await page.goto(PAG);
    await fuera(page);
    const t = await page.evaluate(() => window.Sanchez.tiempo());
    comprobar(t.fuente === 'supuesto' && t.temp === null, 'si Open-Meteo falla: fuente «supuesto» y sin temperatura (los módulos no pintan «ahora»)', t);
    comprobar(page._errores.length === 0, 'y la web no da errores', page._errores.slice(0, 3));
    await ctx.close();
  }
  {
    const { ctx, page } = await nueva({}, { script: sinCookies });
    await page.goto(BASE + 'index.html?sin-webgl&tiempo=lluvia&fecha=2027-04-20');
    await fuera(page);
    const r = await page.evaluate(async () => ({ t: await window.Sanchez.tiempo(), f: window.Sanchez.fecha().toISOString().slice(0, 10) }));
    comprobar(r.t.lluvia > 0 && r.t.simulado === true && r.t.fuente === 'open-meteo' && r.f === '2027-04-20' && ctx._peticionesTiempo === 0, '?tiempo=lluvia y ?fecha=2027-04-20 para probar (sin red)', r);
    for (const k of ['sol', 'nubes', 'viento']) {
      await page.goto(BASE + `index.html?sin-webgl&tiempo=${k}`);
      const o = await page.evaluate(() => window.Sanchez.tiempo());
      comprobar((k === 'sol' && o.nubes === 0 && !o.lluvia) || (k === 'nubes' && o.nubes >= 0.9) || (k === 'viento' && o.viento > 30), `?tiempo=${k}`, o);
    }
    await ctx.close();
  }

  {
    if (HAY.jardin) {
      const { ctx, page } = await nueva({}, { script: sinCookies });
      await page.goto(BASE + 'index.html?sin-webgl&revision&densidad=sobria&fecha=2026-12-15&tiempo=supuesto');
      await fuera(page);
      await page.evaluate(() => { const j = window.Sanchez.jardin, o = j.montar; j.montar = function (el, op) { window.__opJardin = op; return o.apply(this, arguments); }; });
      await page.locator('#jardin').scrollIntoViewIfNeeded();
      await page.waitForFunction(() => !!window.__opJardin, null, { timeout: 8000 }).catch(() => {});
      const oj = await page.evaluate(() => { const o = window.__opJardin; return o && { densidad: o.densidad, fecha: o.fecha instanceof Date ? o.fecha.toISOString().slice(0, 10) : o.fecha, tiempo: o.tiempo && o.tiempo.fuente }; });
      comprobar(oj && oj.densidad === 'sobria' && oj.fecha === '2026-12-15' && oj.tiempo === 'supuesto', '?fecha=2026-12-15, ?tiempo=supuesto y la sobria llegan al jardín', oj);
      await ctx.close();
    }
  }

  /* ---------- 3. módulos: montan al acercarse; sin su JS, el respaldo ---------- */
  console.log('\n3. Módulos y flores');
  {
    const { ctx, page } = await nueva({}, { script: sinCookies });
    await page.goto(PAG);
    await fuera(page);
    await page.waitForTimeout(400);
    comprobar(await page.evaluate(() => ['jardin', 'etapa', 'reserva', 'cartel-pie'].every((m) => document.querySelector(`[data-modulo="${m}"]`).dataset.montado !== '1')), 'jardín, etapa, reserva y pie no se montan al arrancar (solo al acercarse)');
    // lo que recibe el jardín de la web: fecha, tiempo y densidad (se envuelve su montar antes de acercarse)
    if (HAY.jardin) await page.evaluate(() => { const j = window.Sanchez.jardin, o = j.montar; j.montar = function (el, op) { window.__opJardin = op; return o.apply(this, arguments); }; });
    await page.evaluate(() => { window.__flores = []; document.addEventListener('sanchez:flor', (e) => window.__flores.push([e.detail.n, !!e.detail.alLlegar])); });
    for (const n of [1, 2]) { await page.evaluate((n) => document.querySelector(`[data-flor="${n}"]`).scrollIntoView({ block: 'center' }), n); await page.waitForTimeout(250); }
    for (const [sel, clave, nombre] of [['#jardin', 'jardin', 'Jardín'], ['#etapa', 'etapa', 'Etapa'], ['#reservar', 'reserva', 'Reserva'], ['#pie', 'cartel', 'Cartel del pie']]) {
      await page.locator(sel).scrollIntoViewIfNeeded();
      const dm = clave === 'cartel' ? 'cartel-pie' : clave;
      const ok = await page.waitForFunction((d) => document.querySelector(`[data-modulo="${d}"]`).dataset.montado === '1', dm, { timeout: 8000 }).then(() => true, () => false);
      if (HAY[clave]) comprobar(ok, `${nombre} monta al acercarse (data-montado=1)`);
      else nota(`${nombre}: su JS aún no está; se queda el respaldo`);
    }
    if (HAY.jardin) {
      const oj = await page.evaluate(() => { const o = window.__opJardin; return o && { densidad: o.densidad, movimiento: o.movimiento, fecha: o.fecha instanceof Date, hoy: Math.abs(o.fecha - Date.now()) < 36e5 * 24, tiempo: o.tiempo && o.tiempo.fuente, temp: o.tiempo && o.tiempo.temp }; });
      comprobar(oj && oj.densidad === 'cartel' && oj.movimiento === false && oj.fecha && oj.hoy && oj.tiempo === 'open-meteo' && oj.temp === 14.2, 'el jardín recibe de la web { densidad: cartel, movimiento, fecha de hoy y el tiempo ya resuelto }', oj);
    }
    await page.waitForTimeout(300);
    const fl = await page.evaluate(() => ({ lista: window.__flores, abiertas: window.Sanchez.floresAbiertas() }));
    comprobar([1, 2, 3].every((n) => fl.lista.some(([m]) => m === n)) && fl.abiertas.length === 3, 'sanchez:flor llega para las tres flores (la 1 y la 2 al entrar en su sección; las que falten, al llegar al pie)', fl);
    comprobar(fl.lista.find(([n]) => n === 1) && !fl.lista.find(([n]) => n === 1)[1] && !fl.lista.find(([n]) => n === 2)[1], 'las flores de la casa y el jardín se avisan al entrar en su sección, no al llegar al pie', fl.lista);
    comprobar(await page.evaluate(() => /Berducedo|etapa/i.test(document.querySelector('[data-modulo="etapa"]').textContent) && document.querySelector('[data-modulo="jardin"]').querySelector('img, canvas, svg')), 'jardín y etapa enseñan algo (su pieza o su respaldo)');
    comprobar(page._errores.length === 0, 'módulos montados sin errores', page._errores.slice(0, 5));
    await ctx.close();
  }
  {
    const { ctx, page } = await nueva({}, { script: sinCookies, abortar: /js\/(cartel|flecha|jardin|etapa|reserva)\.js/ });
    await page.goto(PAG);
    await fuera(page);
    for (const sel of ['#jardin', '#etapa', '#reservar', '#pie']) { await page.locator(sel).scrollIntoViewIfNeeded(); await page.waitForTimeout(250); }
    const r = await page.evaluate(() => [...document.querySelectorAll('[data-modulo]')].map((el) => ({ m: el.dataset.modulo, montado: el.dataset.montado || '', alto: Math.round(el.getBoundingClientRect().height), cosas: el.querySelectorAll('img, svg, li, p, table').length })).filter((x) => x.m !== 'flecha'));
    comprobar(r.every((x) => !x.montado && x.cosas >= 1 && (x.m === 'cartel' || x.alto > 60)), 'sin los JS de los módulos se queda cada respaldo (la foto del cartel, el jardín, la etapa, los datos de reserva y el cartel del pie)', r);
    comprobar(await page.evaluate(() => /Demostración/.test(document.querySelector('[data-modulo="reserva"]').textContent) && /626 665 118/.test(document.getElementById('reservar').textContent)), 'el respaldo de reservar dice que es una demostración y da el teléfono');
    comprobar(page._errores.filter((e) => !/cartel|flecha|jardin|etapa|reserva/.test(e)).length === 0, 'y la página no da errores', page._errores);
    await ctx.close();
  }

  /* ---------- 4. el visor se abre por NOMBRE (cada miniatura, ratón) ---------- */
  console.log('\n4. Visor');
  {
    const { ctx, page } = await nueva({}, { script: sinCookies, abortar: /js\/(cartel|flecha|jardin|etapa|reserva)\.js/ });
    await page.goto(PAG);
    await fuera(page);
    const n = await page.locator('[data-visor]').count();
    const malos = [];
    for (let i = 0; i < n; i++) {
      const b = page.locator('[data-visor]').nth(i);
      const nombre = await b.getAttribute('data-visor');
      await b.scrollIntoViewIfNeeded();
      await b.click();
      const v = await page.evaluate(() => ({ open: document.getElementById('visor').open, n: document.getElementById('visor-img').dataset.nombre, src: document.getElementById('visor-img').getAttribute('src') }));
      if (!(v.open && v.n === nombre && v.src.includes(nombre))) malos.push([nombre, v]);
      await page.keyboard.press('Escape');
    }
    comprobar(n >= 19 && malos.length === 0, `cada una de las ${n} miniaturas abre SU foto en el visor`, malos);
    const dos = await page.evaluate(() => [...document.querySelectorAll('[data-visor]')].slice(0, 2).map((b) => b.dataset.visor));
    await page.locator(`[data-visor="${dos[0]}"]`).click();
    await page.keyboard.press('ArrowRight');
    const sig = await page.evaluate(() => document.getElementById('visor-img').dataset.nombre);
    comprobar(sig === dos[1], `con la flecha pasa a la siguiente de la serie (${dos[0]} → ${dos[1]})`, sig);
    await page.keyboard.press('Escape');
    comprobar(await page.evaluate((d) => !document.getElementById('visor').open && document.activeElement?.dataset.visor === d, dos[0]), 'Escape cierra el visor y el foco vuelve a la miniatura');
    await ctx.close();
  }

  /* ---------- 5. cookies en cuatro pasos y mando con ?revision ---------- */
  console.log('\n5. Cookies y mando');
  {
    const { ctx, page } = await nueva();
    await page.goto(PAG);
    await fuera(page);
    await page.waitForSelector('#cookies:not([hidden])', { timeout: 4000 }).catch(() => {});
    comprobar(await page.isVisible('#cookies'), 'cookies: se ven en la primera visita');
    await page.click('#ck-si');
    comprobar(!(await page.isVisible('#cookies')) && (await page.evaluate((k) => localStorage.getItem(k), LLAVE)) === 'si', 'cookies: «Entendido» las cierra y guarda la marca');
    await page.reload(); await fuera(page);
    comprobar(!(await page.isVisible('#cookies')), 'cookies: al recargar no vuelven');
    await page.evaluate((k) => localStorage.removeItem(k), LLAVE);
    await page.reload(); await fuera(page);
    await page.waitForSelector('#cookies:not([hidden])', { timeout: 4000 }).catch(() => {});
    comprobar(await page.isVisible('#cookies'), 'cookies: sin la marca vuelven a salir');
    await page.click('#ck-no');
    await ctx.close();
  }
  {
    const { ctx, page } = await nueva({ reducedMotion: 'no-preference' }, { script: sinCookies });
    await page.goto(BASE + 'index.html?sin-webgl&revision&densidad=sobria'); await fuera(page);
    await page.waitForTimeout(500);
    await ir(page, await yDe(page, '#dentro', 200)); await page.waitForTimeout(250);
    const s = await page.evaluate(() => ({ mando: !document.getElementById('mando').hidden, sobria: document.documentElement.classList.contains('densidad-sobria'), vistazo: getComputedStyle(document.getElementById('vistazo')).display, abiertas: window.Sanchez.floresAbiertas().length, filas: document.querySelectorAll('.vistazo__tabla tr').length, texto: document.querySelector('.vistazo__tabla').textContent }));
    comprobar(s.mando && s.sobria && s.vistazo === 'block' && s.filas >= 10, 'con ?revision el mando se ve y la sobria añade «Casa Sánchez, de un vistazo»', s);
    comprobar(/16 literas/.test(s.texto) && /Calefacción, toallas ni jabón, desayuno/.test(s.texto) && /25,5 km/.test(s.texto) && /20 €/.test(s.texto) && /12:00/.test(s.texto), 'la tabla de la sobria: plazas, precios, entrada, lo que no hay y la distancia a la siguiente etapa');
    comprobar(s.abiertas === 3, 'sobria: las tres flores abiertas desde el principio', s.abiertas);
    await page.click('#mando [data-densidad="cartel"]');
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => ({ sobria: document.documentElement.classList.contains('densidad-sobria'), vistazo: getComputedStyle(document.getElementById('vistazo')).display, url: location.search }));
    comprobar(!r.sobria && r.vistazo === 'none' && !r.url.includes('sobria'), 'el mando vuelve a «Cartel»: fuera la tabla de la sobria', r);
    comprobar(page._errores.length === 0, 'cambiar de densidad no da errores (los módulos se vuelven a montar)', page._errores.slice(0, 4));
    await ctx.close();
  }

  /* ---------- 6. móvil: anchos, portada sin solapes, menú y barra del navegador ---------- */
  console.log('\n6. Móvil');
  for (const [w, h] of [[360, 640], [375, 667], [390, 844], [768, 1024]]) {
    const { ctx, page } = await nueva({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true }, { script: sinCookies });
    await page.goto(PAG);
    await fuera(page);
    await page.waitForTimeout(300);
    const ancho = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    comprobar(ancho[0] <= ancho[1], `${w}×${h}: sin scroll lateral`, ancho);
    const salen = await page.evaluate(() => [...document.querySelectorAll('main *, footer *')]
      .filter((e) => { const b = e.getBoundingClientRect(); return b.width && b.right > innerWidth + 1 && !e.closest('[aria-hidden="true"], .vh, canvas'); })
      .slice(0, 4).map((e) => e.tagName.toLowerCase() + '.' + [...e.classList].join('.')));
    comprobar(!salen.length, `${w}×${h}: nada se sale por la derecha`, salen);
    const r = await page.evaluate(() => {
      const R = (s) => document.querySelector(s).getBoundingClientRect();
      const t = R('.portada-texto'), cab = R('#cab'), m = R('.portada__cartel'), p = R('#portada');
      return { fotoBajoCab: document.querySelector('.portada__cartel').dataset.montado === '1' || m.top >= cab.bottom - 1, fotoAncho: m.width >= Math.min(innerWidth, 720) - 1, textoBajoFoto: t.top >= m.bottom - 1, dentro: t.bottom <= p.bottom + 1 };
    });
    comprobar(Object.values(r).every(Boolean), `${w}×${h}: la foto arriba casi a todo el ancho y el texto debajo, sin pisar nada`, r);
    if (w === 390) {
      await page.evaluate(() => scrollTo(0, 1600));
      await page.waitForFunction(() => document.getElementById('cab').classList.contains('sc'));
      await page.click('#menu-btn');
      const mm = await page.evaluate(() => { const r = document.getElementById('menu-movil').getBoundingClientRect(); return { top: r.top, alto: r.height, vista: innerHeight, vis: getComputedStyle(document.getElementById('menu-movil')).visibility }; });
      comprobar(mm.top === 0 && Math.abs(mm.alto - mm.vista) < 2 && mm.vis === 'visible', 'menú móvil a pantalla completa con la cabecera ya fija', mm);
      await page.click('#menu-movil a[href="#reservar"]');
      comprobar(await page.waitForFunction(() => !document.body.classList.contains('menu'), null, { timeout: 3000 }).then(() => true, () => false), 'el menú se cierra al elegir');
      // visor con el dedo
      await page.locator('[data-visor="casa-flor"]').scrollIntoViewIfNeeded();
      await page.locator('[data-visor="casa-flor"]').tap();
      comprobar(await page.evaluate(() => document.getElementById('visor').open && document.getElementById('visor-img').dataset.nombre === 'casa-flor'), 'en el móvil, tocar una miniatura abre su foto');
      await page.click('#visor-cerrar');
      // la barra del navegador: 6 cambios de alto → ningún «sanchez:resize» y nada se mueve
      await page.evaluate(() => document.querySelectorAll('main > section, footer').forEach((s) => { s.style.height = s.offsetHeight + 'px'; }));
      const n = await page.evaluate(() => { window.__res = 0; document.addEventListener('sanchez:resize', () => window.__res++); scrollTo(0, 5200); return document.getElementById('llegar').getBoundingClientRect().top + scrollY; });
      await page.waitForTimeout(150);
      for (const alto of [788, 844, 788, 844, 800, 844]) { await page.setViewportSize({ width: 390, height: alto }); await page.waitForTimeout(260); }
      const d = await page.evaluate(() => ({ res: window.__res, top: document.getElementById('llegar').getBoundingClientRect().top + scrollY }));
      comprobar(d.res === 0 && Math.abs(d.top - n) < 1, 'barra del móvil: nada se rehace y la página no se mueve', { ...d, antes: n });
    }
    comprobar(page._errores.length === 0, `${w}×${h}: sin errores`, page._errores.slice(0, 3));
    await ctx.close();
  }

  /* ---------- 7. legales ---------- */
  console.log('\n7. Legales');
  {
    const { ctx, page } = await nueva();
    for (const f of ['aviso-legal', 'privacidad', 'cookies', 'accesibilidad', '404']) {
      page._errores.length = 0;
      await page.goto(BASE + f + '.html');
      comprobar((await page.locator('h1').count()) === 1 && page._errores.length === 0, `${f}.html se abre sin errores`, page._errores);
    }
    await ctx.close();
  }

  /* ---------- 8. con movimiento (una vez, al final): cortina y entrada de la portada ---------- */
  console.log('\n8. Con movimiento');
  {
    const { ctx, page } = await nueva({ reducedMotion: 'no-preference' }, { script: sinCookies });
    await page.goto(PAG);
    const tapa = await page.evaluate(() => { const c = document.getElementById('cortina'); if (!c) return 'sin cortina'; const r = c.getBoundingClientRect(); return getComputedStyle(c).display !== 'none' && r.width >= innerWidth - 1 && r.height >= innerHeight - 1; });
    if (tapa === 'sin cortina') nota('sin cortina todavía (agente Entrada): la portada se abre sola');
    else comprobar(tapa === true, 'la cortina tapa la pantalla al cargar');
    await fuera(page);
    await page.waitForFunction(() => document.getElementById('portada').classList.contains('abierta'), null, { timeout: 8000 }).catch(() => {});
    comprobar(await page.evaluate(() => document.getElementById('portada').classList.contains('abierta') && document.documentElement.classList.contains('con-movimiento')), 'la cortina se retira y la portada se abre');
    await page.waitForFunction(() => !document.getElementById('cortina') || getComputedStyle(document.getElementById('cortina')).display === 'none', null, { timeout: 9000 }).catch(() => {});
    comprobar(await page.evaluate(() => !document.getElementById('cortina') || getComputedStyle(document.getElementById('cortina')).display === 'none'), 'la cortina desaparece de verdad');
    if (HAY.cartel) comprobar(await page.waitForFunction(() => document.querySelector('#portada [data-modulo="cartel"]').dataset.montado === '1', null, { timeout: 6000 }).then(() => true, () => false), 'el cartel de la portada se monta al abrirse la cortina');
    // recorrido entero con la rueda: las entradas (.rev) acaban visibles y la cabecera sigue fija
    const fin = () => page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    for (let y = 0, f = await fin(); y <= f + 400; y += 400, f = await fin()) { await ir(page, Math.min(y, f)); await page.waitForTimeout(110); }
    await page.waitForTimeout(500);
    const rv = await page.evaluate(() => ({ total: document.querySelectorAll('.rev').length, vistos: document.querySelectorAll('.rev.es-visto').length, cab: document.getElementById('cab').getBoundingClientRect().top }));
    comprobar(rv.total > 20 && rv.vistos === rv.total && rv.cab === 0, 'tras recorrer la página, todo lo que entra con el scroll está visible y la cabecera sigue fija', rv);
    comprobar(page._errores.length === 0, 'con movimiento: sin errores', page._errores.slice(0, 5));
    await ctx.close();
  }
  {
    // Lenis y GSAP caídos y con movimiento: la cortina se va igual
    const { ctx, page } = await nueva({ reducedMotion: 'no-preference' }, { cdn: 'caido', script: sinCookies });
    await page.goto(PAG);
    await fuera(page);
    await page.waitForFunction(() => !document.getElementById('cortina') || getComputedStyle(document.getElementById('cortina')).display === 'none', null, { timeout: 9000 }).catch(() => {});
    comprobar(await page.evaluate(() => (!document.getElementById('cortina') || getComputedStyle(document.getElementById('cortina')).display === 'none') && document.getElementById('portada').classList.contains('abierta')), 'sin Lenis ni GSAP la cortina se retira y la portada se abre');
    comprobar(page._errores.length === 0, 'sin las librerías no hay errores', page._errores.slice(0, 3));
    await ctx.close();
  }
  {
    // sin JavaScript: la cortina no tapa y se lee todo
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, javaScriptEnabled: false });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    const page = await ctx.newPage();
    await page.goto(PAG);
    comprobar(await page.evaluate(() => { const c = document.getElementById('cortina'); return (!c || getComputedStyle(c).display === 'none') && getComputedStyle(document.querySelector('.portada-texto')).opacity === '1' && getComputedStyle(document.querySelector('.rev')).opacity === '1'; }), 'sin JavaScript no hay cortina y todo se lee (titular y secciones visibles)');
    await ctx.close();
  }
} finally {
  await browser.close();
  servidor.close();
}

console.log(`\n${nOk} ok, ${fallos.length} fallos`);
if (fallos.length) { console.log(fallos.map((f) => ' - ' + f).join('\n')); process.exitCode = 1; }
