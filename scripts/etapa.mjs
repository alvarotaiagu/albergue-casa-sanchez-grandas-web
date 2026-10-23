/* Prepara los datos de «La etapa» (Berducedo → Albergue Casa Sánchez).
   Uso: node scripts/etapa.mjs     (desde la carpeta de la web o desde cualquier sitio)

   Lee   ref/raw/perfil.json   (altitud del MDT Copernicus GLO-90 cada 100 m sobre el trazado de OSM)
   Escribe img/terreno/etapa.json  (lo que lee js/etapa.js)

   Qué hace:
   1. Toma el perfil SUAVIZADO (alt_suav_m) de Berducedo (km 0) a Grandas (km 20,0) y añade el
      albergue (km 20,13, 564 m: MDT sin suavizar, DATOS-CASA-SANCHEZ.md).
   2. Acumula metros subidos y bajados con umbral de 5 m (como las tablas de DATOS), en cada punto.
   3. CALIBRA a las cifras de Gronze (etapa 6, Berducedo – Grandas de Salime): 20,4 km, +663 m, −1.017 m.
      El trazado de OSM mide 20,13 km hasta la puerta y el MDT suavizado da +665/−1.002 (Gronze dice
      +663/−1.017): se reparten los kilómetros y los desniveles con un factor lineal, de modo que los
      contadores acaben EXACTAMENTE en las cifras publicadas. Los factores van en el JSON.
   4. Simplifica con Ramer–Douglas–Peucker (1,2 m de error vertical), conservando las paradas.
   5. Añade las paradas con su rótulo, su ficha y su fila de tabla. Solo con dato (fuente en cada una). */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '..');
const perfil = JSON.parse(readFileSync(resolve(raiz, 'ref/raw/perfil.json'), 'utf8'));

// ---------- cifras publicadas (Gronze, etapa 6) y datos del albergue
const GRONZE = { km: 20.4, sube: 663, baja: 1017, fuente: 'Gronze, etapa 6 Berducedo – Grandas de Salime (gronze.com)' };
const KM_GRANDAS = 20.0;          // el MDT llega hasta aquí en la muestra de 100 m
const KM_ALBERGUE = 20.13;        // perfil.json: puntos_km["Albergue Casa Sánchez"]
const ALT_ALBERGUE = 564;         // MDT del punto del albergue (Open-Meteo), DATOS-CASA-SANCHEZ.md
const UMBRAL = 5;                 // m: por debajo no cuenta como subida ni bajada (como en perfil.json)

// ---------- 1. la serie
const serie = perfil.puntos.filter((p) => p.km <= KM_GRANDAS + 1e-9).map((p) => [p.km, p.alt_suav_m]);
serie.push([KM_ALBERGUE, ALT_ALBERGUE]);

// ---------- 2. acumulados con umbral de 5 m (la misma regla de las tablas de DATOS):
//    se cuenta cuando la altitud se aparta 5 m o más de la última cota contada.
function acumular(alts, T) {
  let ref = alts[0], asc = 0, desc = 0;
  const out = [[0, 0]];
  for (let i = 1; i < alts.length; i++) {
    const v = alts[i];
    if (v - ref >= T) { asc += v - ref; ref = v; } else if (ref - v >= T) { desc += ref - v; ref = v; }
    out.push([asc, desc]);
  }
  return out;
}
const cum = acumular(serie.map((p) => p[1]), UMBRAL);
const subeMdt = cum.at(-1)[0], bajaMdt = cum.at(-1)[1];

// ---------- 3. calibrado a Gronze
const fKm = GRONZE.km / KM_ALBERGUE;
const fSube = GRONZE.sube / subeMdt;
const fBaja = GRONZE.baja / bajaMdt;

let pts = serie.map((p, i) => ({ kmOsm: p[0], km: p[0] * fKm, alt: p[1], sube: cum[i][0] * fSube, baja: cum[i][1] * fBaja }));

// ---------- paradas (km de OSM, perfil.json → puntos_km)
const interp = (kmOsm) => {
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].kmOsm >= kmOsm - 1e-9) {
      const a = pts[i - 1], b = pts[i], t = b.kmOsm === a.kmOsm ? 0 : (kmOsm - a.kmOsm) / (b.kmOsm - a.kmOsm);
      const m = (x, y) => x + (y - x) * t;
      return { kmOsm, km: m(a.km, b.km), alt: m(a.alt, b.alt), sube: m(a.sube, b.sube), baja: m(a.baja, b.baja) };
    }
  }
  return pts.at(-1);
};
const pk = perfil.puntos_km;
const altoOsm = perfil.tramos_suavizados['A Mesa -> Buspol'].max_km;       // 5,9
const altoAlt = perfil.tramos_suavizados['A Mesa -> Buspol'].max_m;        // 1033,4
const clave = {
  salida: 0,
  mesa: pk['A Mesa'],
  alto: altoOsm,
  presa: pk['Presa de Salime'],
  grandas: KM_GRANDAS,               // el nodo de OSM está a 20,03; la muestra llega a 20,0
  albergue: KM_ALBERGUE,
};
for (const k of Object.values(clave)) {
  if (!pts.some((p) => Math.abs(p.kmOsm - k) < 1e-6)) {
    const q = interp(k);
    const i = pts.findIndex((p) => p.kmOsm > k);
    pts.splice(i < 0 ? pts.length : i, 0, q);
  }
}

// ---------- 4. RDP (error vertical), conservando las paradas
const forzados = new Set(Object.values(clave).map((k) => pts.findIndex((p) => Math.abs(p.kmOsm - k) < 1e-6)));
const quedan = new Set([0, pts.length - 1, ...forzados]);
function rdp(a, b, tol) {
  let maxd = 0, idx = -1;
  for (let i = a + 1; i < b; i++) {
    const t = (pts[i].km - pts[a].km) / (pts[b].km - pts[a].km);
    const d = Math.abs(pts[i].alt - (pts[a].alt + (pts[b].alt - pts[a].alt) * t));
    if (d > maxd) { maxd = d; idx = i; }
  }
  if (maxd > tol && idx > 0) { quedan.add(idx); rdp(a, idx, tol); rdp(idx, b, tol); }
}
const orden = [...quedan].sort((x, y) => x - y);
for (let i = 1; i < orden.length; i++) rdp(orden[i - 1], orden[i], 1.2);
const final = [...quedan].sort((x, y) => x - y).map((i) => pts[i]);

const r1 = (v) => Math.round(v * 10) / 10;
const r3 = (v) => Math.round(v * 1000) / 1000;
const puntos = final.map((p) => [r3(p.km), r1(p.alt), r1(p.sube), r1(p.baja)]);
puntos[puntos.length - 1][2] = GRONZE.sube;      // el cierre es exacto
puntos[puntos.length - 1][3] = GRONZE.baja;
puntos[puntos.length - 1][0] = GRONZE.km;

// ---------- paradas con dato
const en = (k) => interp(k);
const altDe = (k) => Math.round(en(k).alt);
const kmDe = (k) => r1(en(k).km);
// subida del último repecho: la misma regla de 5 m, contada solo en ese tramo (sin calibrar), redondeada a 10 m
const subidaFinal = (() => {
  const t = perfil.puntos.filter((p) => p.km >= pk['Presa de Salime'] && p.km <= KM_GRANDAS);
  let ref = t[0].alt_suav_m, a = 0;
  for (const p of t) { const v = p.alt_suav_m; if (v - ref >= UMBRAL) { a += v - ref; ref = v; } else if (ref - v >= UMBRAL) ref = v; }
  return Math.round(a / 10) * 10;
})();
const alturaPresa = 128;
const miles = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const paradas = [
  {
    id: 'salida', km: 0, alt: altDe(0), activa: 0,
    rotulo: ['Berducedo', 'salida · ' + altDe(0) + ' m'], corto: 'Salida',
    ficha: 'Salida en Berducedo, a ' + altDe(0) + ' m. Las dos primeras subidas son suaves: unos 100 m a la salida de Berducedo y 175 m a la de A Mesa (Gronze).',
    tabla: { lugar: 'Berducedo', nota: 'Salida de la etapa' },
    fuente: 'Altitud: MDT Copernicus (OSM nodo 209305770). Subidas: Gronze.',
  },
  {
    id: 'mesa', km: kmDe(clave.mesa), alt: altDe(clave.mesa), activa: kmDe(clave.mesa) - 0.05,
    rotulo: ['A Mesa', altDe(clave.mesa) + ' m'], corto: 'A Mesa',
    ficha: 'A Mesa, a ' + altDe(clave.mesa) + ' m: la iglesia de Santa María Magdalena, del siglo XVII, y un albergue de 14 plazas (Wikipedia). Desde aquí se sube hacia la peña de Buspol.',
    tabla: { lugar: 'A Mesa', nota: 'Iglesia de Santa María Magdalena; albergue de 14 plazas' },
    fuente: 'Altitud: MDT Copernicus. Iglesia y albergue: Wikipedia, «Ruta Jacobea Primitiva».',
  },
  {
    id: 'alto', km: kmDe(clave.alto), alt: Math.round(altoAlt), activa: kmDe(clave.alto) - 0.05,
    rotulo: ['El alto de Buspol', Math.round(altoAlt).toLocaleString('es-ES').replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' m'], corto: 'El alto',
    ficha: 'El alto: ' + String(Math.round(altoAlt)).replace(/(\d)(\d{3})$/, '$1.$2') + ' m al bordear la peña de Buspol, el punto más alto de la etapa (Gronze dice 1.040 m). Empieza la larga bajada al embalse: según Gronze, de 1.040 a 210 m en 8,2 km.',
    tabla: { lugar: 'El alto, peña de Buspol', nota: 'Punto más alto de la etapa (Gronze: 1.040 m)' },
    fuente: 'MDT Copernicus suavizado; Gronze, etapa 6.',
  },
  {
    id: 'presa', km: kmDe(clave.presa), alt: altDe(clave.presa), activa: kmDe(clave.presa) - 0.5,
    rotulo: ['Embalse y presa de Salime', alturaPresa + ' m de alto · 1955'], corto: 'Presa',
    ficha: 'Embalse y presa de Salime, hacia los ' + (Math.round(altDe(clave.presa) / 5) * 5) + ' m: el fondo de la etapa. La presa mide ' + alturaPresa + ' m de altura y se inauguró en 1955; el camino cruza el Navia por la carretera de la presa. El embalse dejó bajo el agua varios pueblos, el de Salime entre ellos.',
    tabla: { lugar: 'Embalse y presa de Salime', nota: 'Presa de ' + alturaPresa + ' m de altura, inaugurada en 1955; punto más bajo de la etapa' },
    fuente: 'Presa: Wikipedia, «Embalse de Salime» (128 m; 132 m sobre cimientos; inauguración 24-08-1955) y Ayuntamiento de Grandas. Altitud: MDT; Gronze dice 210 m.',
  },
  {
    id: 'repecho', km: kmDe(pk['Presa de Salime']) , alt: null, activa: kmDe(clave.presa) + 0.5, desde: kmDe(clave.presa), hasta: kmDe(clave.grandas),
    rotulo: ['Último repecho', 'unos ' + subidaFinal + ' m de subida'], corto: 'Repecho',
    ficha: 'El último repecho: unos ' + subidaFinal + ' m de subida desde la presa hasta Grandas, casi todo por carretera con algunos atajos de bosque (Gronze).',
    tabla: { lugar: 'Último repecho', nota: 'Unos ' + subidaFinal + ' m de subida, de la presa a Grandas' },
    fuente: 'Subida: MDT Copernicus suavizado entre la presa y Grandas. Carretera y atajos: Gronze.',
  },
  {
    id: 'grandas', km: kmDe(clave.grandas), alt: altDe(clave.grandas), activa: kmDe(clave.grandas) - 0.35,
    rotulo: ['Grandas de Salime', altDe(clave.grandas) + ' m'], corto: 'Grandas',
    ficha: 'Grandas de Salime, a ' + altDe(clave.grandas) + ' m. El albergue está a unos 100 m, en la calle El Salvador.',
    tabla: { lugar: 'Grandas de Salime', nota: 'El albergue queda a unos 100 m' },
    fuente: 'MDT Copernicus. Distancia al albergue: trazado de OSM y coordenadas de ACS.',
  },
  {
    id: 'albergue', km: GRONZE.km, alt: ALT_ALBERGUE, activa: GRONZE.km - 0.05,
    rotulo: ['Has llegado.', 'Entrada desde las 12:00'], corto: 'Albergue',
    ficha: 'Has llegado. Albergue Casa Sánchez, calle El Salvador, a ' + ALT_ALBERGUE + ' m. Entrada desde las 12:00.',
    tabla: { lugar: 'Albergue Casa Sánchez', nota: 'Calle El Salvador. Entrada desde las 12:00' },
    fuente: 'Entrada: alberguescaminosantiago.com (19-10-2026). Altitud: MDT Copernicus.',
  },
];
// el km del repecho es el de su inicio (la presa)
paradas.find((p) => p.id === 'repecho').km = paradas.find((p) => p.id === 'presa').km;

const maximo = puntos.reduce((m, p) => (p[1] > m[1] ? p : m), puntos[0]);
const minimo = puntos.reduce((m, p) => (p[1] < m[1] ? p : m), puntos[0]);

const salida = {
  version: 1,
  salida: 'Berducedo',
  llegada: 'Albergue Casa Sánchez',
  entrada: 'Entrada desde las 12:00',
  total: { km: GRONZE.km, sube: GRONZE.sube, baja: GRONZE.baja, max: { km: maximo[0], alt: Math.round(maximo[1]) }, min: { km: minimo[0], alt: Math.round(minimo[1]) } },
  calibrado: {
    fuente: GRONZE.fuente,
    nota: 'El perfil se dibuja con el MDT Copernicus de 90 m (suavizado) sobre el trazado de OpenStreetMap. Los kilómetros y los desniveles se reparten linealmente sobre las cifras de Gronze, para que los contadores acaben en 20,4 km, +663 m y −1.017 m. Los kilómetros intermedios son aproximados.',
    km_osm: KM_ALBERGUE, km_gronze: GRONZE.km, factor_km: r3(fKm),
    sube_mdt: Math.round(subeMdt), baja_mdt: Math.round(bajaMdt),
    sube_gronze: GRONZE.sube, baja_gronze: GRONZE.baja,
    factor_sube: r3(fSube), factor_baja: r3(fBaja),
    umbral_m: UMBRAL,
  },
  fuentes: [
    'Trazado: OpenStreetMap, relaciones 19586859, 19586857 y 19586856 del Camino Primitivo (23-10-2026).',
    'Altitud: Copernicus DEM GLO-90 vía Open-Meteo Elevation API, una muestra cada 100 m, suavizada (mediana de 5 y media móvil de 5).',
    'Distancia y desnivel totales: Gronze, etapa 6 Berducedo – Grandas de Salime.',
    'Presa y embalse: Wikipedia («Embalse de Salime») y Ayuntamiento de Grandas de Salime.',
  ],
  puntos,      // [km, altitud m, subidos acumulados m, bajados acumulados m]
  paradas,
};

const destino = resolve(raiz, 'img/terreno/etapa.json');
mkdirSync(dirname(destino), { recursive: true });
writeFileSync(destino, JSON.stringify(salida, null, 1).replace(/\[\n\s+([-\d.]+),\n\s+([-\d.]+),\n\s+([-\d.]+),\n\s+([-\d.]+)\n\s+\]/g, '[$1, $2, $3, $4]'));
console.log('etapa.json: ' + puntos.length + ' puntos');
console.log('MDT: +' + Math.round(subeMdt) + ' / −' + Math.round(bajaMdt) + ' en ' + KM_ALBERGUE + ' km  →  Gronze: +' + GRONZE.sube + ' / −' + GRONZE.baja + ' en ' + GRONZE.km + ' km');
console.log('factores: km ×' + fKm.toFixed(4) + ', sube ×' + fSube.toFixed(4) + ', baja ×' + fBaja.toFixed(4));
for (const p of paradas) console.log('  ' + p.id.padEnd(9) + 'km ' + String(p.km).padEnd(5) + ' alt ' + p.alt);
