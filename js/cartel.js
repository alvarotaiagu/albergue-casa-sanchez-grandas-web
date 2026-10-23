/* ------------------------------------------------------------------
   Albergue Casa Sánchez · «El cartel»                         (agente Entrada)
   1. PORTADA. A pantalla completa, el cartel vectorial (marca/cartel.svg, vectorizado de la foto del cartel de
      la entrada: no se redibuja). Al abrirse la cortina: las tres flores se abren pétalo a pétalo, «Casa
      Sánchez» se escribe a trazo con su propia letra, «ALBERGUE TURÍSTICO» asienta letra a letra, la vieira y
      el peregrino aparecen. Al bajar, con la sección fijada, la cámara se aleja: el cartel encoge y se coloca
      sobre el cartel de la FOTO REAL (cuatro esquinas medidas en marca/cartel-esquinas.json, con un matrix3d)
      y ahí cruza a la foto, contenida a ≤ 1,3× su detalle, en un marco con forma de panel.
      Gesto: «Girar la flecha». Arrastrar (o pulsar, o ← →) hace girar la flecha azul hacia direcciones
      reales medidas desde la casa; al soltar vuelve con muelle a apuntar abajo.
   2. FLOR. Sanchez.cartel.flor(el, { abrir }): una de las tres flores del cartel, que se abre pétalo a pétalo.
   3. PIE. data-modulo="cartel-pie": el cartel completo, pequeño, sobre la madera de la cerca, con las flores
      que se abrieron por la página (evento «sanchez:flor» con { n }); las que faltan se abren al llegar.
   Contrato: Sanchez.cartel.montar(el, { movimiento, densidad }) → { destruir() }; elige portada, flor o pie por
   data-modulo / data-flor. El HTML de `el` es el respaldo (la foto en su marco). Con movimiento:false o
   densidad «sobria»: el cartel entero ya dibujado y la foto debajo, sin sección fijada.
   La sección fijada usa position:sticky (sin ScrollTrigger): la altura de `el` es 100svh + el recorrido.
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  const S = (window.Sanchez = window.Sanchez || {});
  const BASE = (function () {
    const s = document.currentScript && document.currentScript.src;
    try { return new URL('../', s || location.href).href; } catch (e) { return './'; }
  })();
  const url = (r) => BASE + r;
  const NS = 'http://www.w3.org/2000/svg';

  /* ================= datos: los destinos de la flecha =================
     Las coordenadas son las del encargo (ref/DATOS-CASA-SANCHEZ.md): la casa (ACS) y los puntos de
     ref/raw/camino.geojson. Las distancias son SOLO las de DATOS (las de OSM, ver «Contradicciones» nº 13).
     Un destino sin distancia no sale (mostrar:false): Santiago y Oviedo, porque DATOS no da su distancia. */
  const CASA = { lat: 43.218074, lon: -6.876649 };
  const DESTINOS = [
    { id: 'presa', nombre: 'La presa de Salime', lat: 43.236487, lon: -6.8468569, km: 6.2, via: 'por el Camino' },
    { id: 'mesa', nombre: 'A Mesa', lat: 43.2183573, lon: -6.8035158, km: 15.8, via: 'por el Camino' },
    { id: 'berducedo', nombre: 'Berducedo', lat: 43.2331048, lon: -6.7672319, km: 20.0, via: 'por el Camino' },
    { id: 'castro', nombre: 'Castro', lat: 43.1994162, lon: -6.9217651, km: 5.2, via: 'por el Camino' },
    { id: 'fonsagrada', nombre: 'A Fonsagrada', lat: 43.1248311, lon: -7.0676605, km: 25.5, via: 'por el Camino' },
    // sin distancia en DATOS: no salen (si DATOS la da algún día, basta poner km y mostrar:true)
    { id: 'santiago', nombre: 'Santiago de Compostela', lat: 42.8806, lon: -8.5446, km: null, via: 'por el Camino', mostrar: false },
    { id: 'oviedo', nombre: 'Oviedo', lat: 43.3603, lon: -5.8448, km: null, via: 'por el Camino', mostrar: false },
  ];
  const rumbo = (a, b) => {                                   // rumbo inicial a→b en grados (0 = norte, 90 = este)
    const r = Math.PI / 180, f1 = a.lat * r, f2 = b.lat * r, dl = (b.lon - a.lon) * r;
    const y = Math.sin(dl) * Math.cos(f2), x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
    return (Math.atan2(y, x) / r + 360) % 360;
  };
  DESTINOS.forEach((d) => { d.rumbo = rumbo(CASA, d); });
  const VISIBLES = () => DESTINOS.filter((d) => d.mostrar !== false && d.km != null).sort((a, b) => a.rumbo - b.rumbo);
  const fkm = (km) => String(km.toFixed(1)).replace('.', ',') + ' km';
  const rotulo = (d) => d.nombre + ' · ' + fkm(d.km) + ' ' + d.via;
  // el pie: la flecha apunta a «Santiago, X km» SOLO si DATOS da la distancia
  const SANTIAGO_KM = null;

  /* ================= utilidades ================= */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const suave = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const cubInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const quieto = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const norm180 = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
  const pedir = (r) => fetch(url(r)).then((x) => (x.ok ? x.text() : null)).catch(() => null);
  const pedirJson = (r) => fetch(url(r)).then((x) => (x.ok ? x.json() : null)).catch(() => null);
  let pSvg = null, pEsq = null;
  const svgCartel = () => (pSvg = pSvg || pedir('marca/cartel.svg'));
  const esquinasFoto = () => (pEsq = pEsq || pedirJson('marca/cartel-esquinas.json'));
  // lo que se pedirá seguro: se empieza ya (la portada se monta ~1,6 s después, al abrirse la cortina)
  if (document.querySelector('[data-modulo="cartel"], [data-modulo="cartel-pie"], [data-flor]')) { svgCartel(); esquinasFoto(); }

  // homografía: 4 puntos (x,y) → 4 puntos. Devuelve [a,b,c,d,e,f,g,h] con (X,Y) = ((ax+by+c)/(gx+hy+1), (dx+ey+f)/(gx+hy+1))
  function homografia(src, dst) {
    const A = [], B = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i], [X, Y] = dst[i];
      A.push([x, y, 1, 0, 0, 0, -X * x, -X * y]); B.push(X);
      A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]); B.push(Y);
    }
    const n = 8;
    for (let i = 0; i < n; i++) {                                   // eliminación gaussiana con pivote
      let m = i;
      for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r;
      [A[i], A[m]] = [A[m], A[i]]; [B[i], B[m]] = [B[m], B[i]];
      for (let r = i + 1; r < n; r++) {
        const f = A[r][i] / A[i][i];
        for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
        B[r] -= f * B[i];
      }
    }
    const h = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let s = B[i];
      for (let c = i + 1; c < n; c++) s -= A[i][c] * h[c];
      h[i] = s / A[i][i];
    }
    return h;
  }
  const aMatrix3d = (h) => 'matrix3d(' + [h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, 1].map((v) => +v.toFixed(7)).join(',') + ')';
  const proyectar = (h, x, y) => { const w = h[6] * x + h[7] * y + 1; return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w]; };
  const LIENZO = [[0, 0], [1000, 0], [1000, 575], [0, 575]];

  // un id único por inserción: el mismo SVG puede estar dos veces en la página (portada y pie)
  let nSvg = 0;
  function svgConIds(texto) {
    const pre = 'c' + (++nSvg) + '-';
    return texto.replace(/\bid="([^"]+)"/g, (m, id) => 'id="' + pre + id + '"')
      .replace(/url\(#([^)]+)\)/g, (m, id) => 'url(#' + pre + id + ')')
      .replace(/aria-labelledby="([^"]+)"/g, (m, id) => 'aria-labelledby="' + pre + id + '"')
      // el CSS del SVG hace referencia a #albergue, #flecha…: se acota con el id del contenedor
      .replace(/#(letra-casa|letra-sanchez|apartamentos|vieira|peregrino|flecha|albergue|turistico)\b/g, '#' + pre + '$1')
      .replace('<style>', '<style>/* ' + pre + ' */');
  }
  function inyectar(contenedor, texto) {
    const t = document.createElement('template');
    t.innerHTML = svgConIds(texto).trim();
    const svg = t.content.firstElementChild;
    contenedor.appendChild(svg);
    return svg;
  }
  const $id = (svg, id) => svg.querySelector('[id$="-' + id + '"]');

  /* ================= la flor =================
     Cinco pétalos en rombo con nervios (la misma de marca/cartel.svg). Cada pétalo es un <g> con su giro y se
     abre con scale + un poco de giro desde el centro. */
  function petaloD(R) {
    const f = (a, b) => (a * R).toFixed(2) + ' ' + (-b * R).toFixed(2);
    return 'M0 0C' + f(-0.10, 0.16) + ' ' + f(-0.40, 0.36) + ' ' + f(-0.37, 0.60) + 'C' + f(-0.35, 0.78) + ' ' + f(-0.13, 0.92) + ' ' + f(0, 1.0)
      + 'C' + f(0.13, 0.92) + ' ' + f(0.35, 0.78) + ' ' + f(0.37, 0.60) + 'C' + f(0.40, 0.36) + ' ' + f(0.10, 0.16) + ' ' + f(0, 0) + 'Z';
  }
  function nerviosD(R) {
    const f = (a, b) => (a * R).toFixed(2) + ' ' + (-b * R).toFixed(2);
    let d = 'M0 ' + (-0.10 * R).toFixed(2) + 'L0 ' + (-0.84 * R).toFixed(2);
    [0.28, 0.44, 0.60, 0.74].forEach((t) => {
      const w = 0.30 * (1 - Math.abs(t - 0.5) * 0.9) * (1 - 0.35 * Math.max(0, t - 0.55));
      d += 'M0 ' + (-t * R).toFixed(2) + 'L' + f(-w, t + 0.13) + 'M0 ' + (-t * R).toFixed(2) + 'L' + f(w, t + 0.13);
    });
    return d;
  }
  const EASE_ABRE = 'cubic-bezier(.2,.9,.25,1.12)';
  // abre (o cierra) los pétalos de una flor: g.flor con .petalo
  function abrirFlor(g, abrir, retraso, rapido) {
    const pet = [...g.querySelectorAll('.petalo')];
    const out = [];
    pet.forEach((p, i) => {
      const a = parseFloat((p.getAttribute('data-giro') || (p.getAttribute('transform') || '').replace(/[^\d.\-]/g, '')) || '0') || 0;
      p.setAttribute('data-giro', String(a));
      const cerrado = 'rotate(' + (a - 38) + 'deg) scale(0.001)';
      const medio = 'rotate(' + (a - 18) + 'deg) scale(0.34)';
      const final = 'rotate(' + a + 'deg) scale(1)';
      const desde = abrir ? cerrado : final, hasta = abrir ? final : medio;
      p.style.transformOrigin = '0 0';
      if (rapido || typeof p.animate !== 'function') { p.style.transform = abrir ? final : medio; p.style.opacity = '1'; return; }
      p.style.transform = desde;
      p.style.opacity = '1';
      const an = p.animate([{ transform: desde }, { transform: hasta }], { duration: abrir ? 640 : 360, delay: (retraso || 0) + i * 85, easing: EASE_ABRE, fill: 'forwards' });
      out.push(an);
      an.onfinish = () => { p.style.transform = hasta; try { an.cancel(); } catch (e) {} };
    });
    const c = g.querySelector('.centro');
    if (c) {
      if (rapido || typeof c.animate !== 'function') c.style.opacity = '1';
      else if (abrir) { c.style.opacity = '0'; const an = c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: (retraso || 0) + 330, fill: 'forwards' }); an.onfinish = () => { c.style.opacity = '1'; try { an.cancel(); } catch (e) {} }; }
    }
    g.classList.toggle('abierta', !!abrir);
    return out;
  }
  const abiertas = new Set();
  const oyentesFlor = new Set();
  document.addEventListener('sanchez:flor', (e) => {
    const n = e.detail && +e.detail.n;
    if (!n) return;
    abiertas.add(n);
    oyentesFlor.forEach((f) => { try { f(n); } catch (x) {} });
  });

  // la flor suelta: <span data-flor="n"> (la casa, el jardín, reservar)
  function flor(el, op) {
    op = op || {};
    if (!el) return { destruir() {} };
    const n = +el.getAttribute('data-flor') || 1;
    const R = 46;
    el.innerHTML = '';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '-50 -50 100 100');
    svg.setAttribute('class', 'flor-suelta');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'flor');
    const giro = [8, -12, 24][(n - 1) % 3];
    for (let k = 0; k < 5; k++) {
      const p = document.createElementNS(NS, 'g');
      p.setAttribute('class', 'petalo');
      const a = giro + 72 * k;
      p.setAttribute('transform', 'rotate(' + a + ')');
      p.setAttribute('data-giro', String(a));
      const c1 = document.createElementNS(NS, 'path'); c1.setAttribute('d', petaloD(R));
      const c2 = document.createElementNS(NS, 'path'); c2.setAttribute('d', nerviosD(R)); c2.setAttribute('class', 'nervio');
      p.appendChild(c1); p.appendChild(c2); g.appendChild(p);
    }
    const c = document.createElementNS(NS, 'circle'); c.setAttribute('r', (R * 0.07).toFixed(2)); c.setAttribute('class', 'centro'); g.appendChild(c);
    svg.appendChild(g); el.appendChild(svg);
    el.dataset.montado = '1';
    const movimiento = op.movimiento !== false && op.densidad !== 'sobria' && !quieto();
    // cerrada (capullo) hasta que se abre
    abrirFlor(g, false, 0, true);
    let abierta = false;
    const api = {
      el,
      abrir() { if (abierta) return; abierta = true; abrirFlor(g, true, 0, !movimiento); el.dataset.abierta = '1'; },
      cerrar() { abierta = false; abrirFlor(g, false, 0, true); el.dataset.abierta = ''; },
      destruir() { svg.remove(); el.dataset.montado = ''; },
    };
    if (op.abrir !== false) {
      // en cuanto se ve (la web también la llama directamente al entrar la sección)
      if ('IntersectionObserver' in window && movimiento) {
        const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { io.disconnect(); api.abrir(); } }, { threshold: 0.3 });
        io.observe(el);
      } else api.abrir();
    }
    return api;
  }

  /* ================= la portada ================= */
  function portada(el, op) {
    op = op || {};
    if (!el || el.dataset.montado === '1') return { destruir() {} };
    const movimiento = op.movimiento !== false && op.densidad !== 'sobria' && !quieto();
    const respaldo = el.innerHTML;
    const foto = el.querySelector('picture') || el.querySelector('img');
    let vivo = true, destruidoFns = [], estado = {};
    const api = { destruir() { vivo = false; destruidoFns.forEach((f) => { try { f(); } catch (e) {} }); el.innerHTML = respaldo; el.dataset.montado = ''; el.classList.remove('cartel', 'cartel--quieto'); el.style.removeProperty('--cartel-recorrido'); }, estado: () => estado, el };
    Promise.all([svgCartel(), esquinasFoto()]).then(([texto, esq]) => {
      if (!vivo || !texto || !esq) { document.documentElement.classList.remove('con-recorrido'); return; }   // si falla, se queda el respaldo (la foto)
      construir(texto, esq);
    });

    function construir(texto, esq) {
      const escena = document.createElement('div');
      escena.className = 'cartel-escena';
      // marco de la foto con la forma del panel (la franja con su joroba): clipPath en unidades del propio marco
      const defs = document.createElementNS(NS, 'svg');
      defs.setAttribute('width', '0'); defs.setAttribute('height', '0'); defs.setAttribute('aria-hidden', 'true'); defs.style.position = 'absolute';
      const idMarco = 'cartel-marco-' + (++nSvg);
      defs.innerHTML = '<clipPath id="' + idMarco + '" clipPathUnits="objectBoundingBox"><path d="M0 .1C0 .075 .012 .06 .03 .06H.255C.30 .06 .315 .0 .365 0H.635C.685 0 .70 .06 .745 .06H.97C.988 .06 1 .075 1 .1V.985C1 .993 .993 1 .985 1H.015C.007 1 0 .993 0 .985Z"/></clipPath>';
      const marco = document.createElement('div');
      marco.className = 'cartel-marco';
      marco.style.clipPath = 'url(#' + idMarco + ')';
      marco.style.webkitClipPath = 'url(#' + idMarco + ')';
      const hojaFoto = document.createElement('div');
      hojaFoto.className = 'cartel-foto';
      if (foto) hojaFoto.appendChild(foto);
      marco.appendChild(hojaFoto);
      const vector = document.createElement('div');
      vector.className = 'cartel-vector';
      const svg = inyectar(vector, texto);
      svg.setAttribute('focusable', 'false');
      const etiqueta = document.createElement('p');
      etiqueta.className = 'cartel-rumbo';
      etiqueta.setAttribute('aria-live', 'polite');
      etiqueta.setAttribute('role', 'status');
      const girar = document.createElement('button');
      girar.type = 'button';
      girar.className = 'cartel-girar';
      girar.setAttribute('aria-label', 'Girar la flecha del cartel hacia un destino. Usa las flechas izquierda y derecha del teclado.');
      const pista = document.createElement('p');
      pista.className = 'cartel-pista';
      pista.setAttribute('aria-hidden', 'true');
      pista.innerHTML = '<span class="cartel-pista__gira">Gira la flecha</span><span class="cartel-pista__baja">Baja</span>';
      escena.append(defs, marco, vector, etiqueta, girar, pista);
      el.innerHTML = '';
      const rec = document.createElement('div');
      rec.className = 'cartel-recorrido';
      rec.appendChild(escena);
      el.appendChild(rec);
      el.classList.add('cartel');
      el.classList.toggle('cartel--quieto', !movimiento);
      el.dataset.montado = '1';

      const flechaG = $id(svg, 'flecha');
      const centroFlecha = (flechaG.getAttribute('data-centro') || '102 404').split(' ').map(Number);
      const flores = [1, 2, 3].map((n) => $id(svg, 'flor-' + n));
      const trazos = [...svg.querySelectorAll('mask .trazo')];
      const letras = [...svg.querySelectorAll('[id$="-albergue"] path, [id$="-turistico"] path')];
      const vieira = $id(svg, 'vieira'), peregrino = $id(svg, 'peregrino');

      /* ---- geometría ---- */
      let g = null;
      function medir() {
        const vw = escena.clientWidth || window.innerWidth;
        let vh = escena.clientHeight || window.innerHeight;
        const horizontal = vw >= vh * 0.9;
        if (!movimiento) {
          // sin sección fijada: el cartel entero arriba y la foto en su marco debajo, todo en el flujo
          const pw = Math.min(vw, 980), ph = pw * 0.575, fs = Math.min(832, vw / 1.06, 640 * 1.3);   // /1,06: el marco suma un 3 % por lado y no debe salirse
          const px = (vw - pw) / 2, py = Math.max(8, vw * 0.02), fx = (vw - fs) / 2, fy = py + ph + 36;
          vh = fy + fs + 28;
          escena.style.height = Math.round(vh) + 'px';
          const inicio = [[px, py], [px + pw, py], [px + pw, py + ph], [px, py + ph]];
          const fin = esq.esquinas.map((p) => [fx + (p[0] / esq.tamano_foto[0]) * fs, fy + (p[1] / esq.tamano_foto[1]) * fs]);
          g = { vw, vh, inicio, fin, fx, fy, fs, horizontal };
        } else {
          let pw = Math.min(vw * (horizontal ? 0.96 : 1), (vh * 0.94 * 1000) / 575);
          const ph = pw * 0.575;
          const px = (vw - pw) / 2, py = (vh - ph) / (horizontal ? 2 : 2.25);
          const inicio = [[px, py], [px + pw, py], [px + pw, py + ph], [px, py + ph]];
          // la foto: ≤ 1,3× su detalle real, contenida (en el móvil llena el ancho)
          const fs = Math.min(832, vw / 1.06, vh * 0.9, 640 * 1.3);
          const fx = (vw - fs) / 2, fy = (vh - fs) / 2 - (horizontal ? 0 : vh * 0.02);
          const fin = esq.esquinas.map((p) => [fx + (p[0] / esq.tamano_foto[0]) * fs, fy + (p[1] / esq.tamano_foto[1]) * fs]);
          g = { vw, vh, inicio, fin, fx, fy, fs, horizontal };
        }
        const pad = g.fs * 0.03;
        marco.style.width = (g.fs + 2 * pad).toFixed(1) + 'px';
        marco.style.height = (g.fs + 2 * pad).toFixed(1) + 'px';
        marco.style.left = (g.fx - pad).toFixed(1) + 'px';
        marco.style.top = (g.fy - pad).toFixed(1) + 'px';
        hojaFoto.style.inset = pad.toFixed(1) + 'px';
      }

      /* ---- estado de la flecha (el gesto) ---- */
      const dests = VISIBLES();
      const REPOSO = -90;                                       // apunta abajo
      let angUsuario = REPOSO, angVel = 0, objetivo = REPOSO, arrastrando = false, destActual = null, ultimoToque = 0, resorte = false;
      let progreso = 0, uz = 0, hActual = null, rafR = 0, tRep = 0, usado = false, spring = null;

      function dibujar() {
        if (!g) return;
        const t = clamp(uz, 0, 1);
        const pts = g.inicio.map((p, i) => [lerp(p[0], g.fin[i][0], t), lerp(p[1], g.fin[i][1], t)]);
        hActual = homografia(LIENZO, pts);
        vector.style.transform = aMatrix3d(hActual);
        // la foto se descubre al alejarse
        const f = movimiento ? suave(0.18, 0.7, t) : 1;
        marco.style.opacity = f.toFixed(3);
        marco.style.transform = 'scale(' + (0.9 + 0.1 * f).toFixed(4) + ')';
        // el vector cruza a la foto cuando ya está casado con sus cuatro esquinas
        const o = movimiento ? 1 - suave(0.9, 1, t) : 1;
        vector.style.opacity = o.toFixed(3);
        vector.style.visibility = o < 0.01 ? 'hidden' : 'visible';
        // la flecha: la del gesto mientras se ve grande y, al alejarse, la del cartel (apunta a la izquierda)
        const b = suave(0.16, 0.62, t);
        const ang = lerp(norm180(angUsuario), 0, b);
        flechaG.style.transformOrigin = centroFlecha[0] + 'px ' + centroFlecha[1] + 'px';
        flechaG.style.transform = 'rotate(' + ang.toFixed(2) + 'deg)';
        // el botón y la etiqueta siguen a la flecha
        const [sx, sy] = proyectar(hActual, centroFlecha[0], centroFlecha[1]);
        const [sx2] = proyectar(hActual, centroFlecha[0] + 80, centroFlecha[1]);
        const radio = Math.max(36, Math.abs(sx2 - sx) * 1.05);
        girar.style.cssText = 'width:' + (radio * 2).toFixed(1) + 'px;height:' + (radio * 2).toFixed(1) + 'px;left:' + (sx - radio).toFixed(1) + 'px;top:' + (sy - radio).toFixed(1) + 'px';
        const activo = t < 0.3 && vector.style.visibility !== 'hidden';
        girar.disabled = !activo;
        girar.tabIndex = activo ? 0 : -1;
        etiqueta.style.left = sx.toFixed(1) + 'px';
        etiqueta.style.top = (sy - radio - 8).toFixed(1) + 'px';
        pista.style.opacity = usado || t > 0.05 ? '0' : '';
        estado = { progreso, uz: t, angulo: ang, angUsuario: norm180(angUsuario), rumbo: destActual && destActual.id, esquinas: pts, centroFlecha: [sx, sy] };
        el.dataset.zoom = t.toFixed(3);
      }

      /* ---- el scroll: la cámara se aleja ---- */
      function leerScroll() {
        if (!movimiento) { progreso = 0; uz = 0; return; }
        const r = el.getBoundingClientRect();
        const total = Math.max(1, el.offsetHeight - escena.clientHeight);
        progreso = clamp(-r.top / total, 0, 1);
        uz = cubInOut(clamp((progreso - 0.03) / 0.82, 0, 1));
      }
      let pendiente = false;
      function alScroll() {
        if (pendiente) return;
        pendiente = true;
        requestAnimationFrame(() => { pendiente = false; if (!vivo) return; leerScroll(); dibujar(); });
      }
      window.addEventListener('scroll', alScroll, { passive: true });
      destruidoFns.push(() => window.removeEventListener('scroll', alScroll));
      let anchoVista = window.innerWidth, altoVista = window.innerHeight;
      const alResize = () => {
        // el resize de la barra del móvil no rehace nada: solo cambia el alto
        if (window.innerWidth === anchoVista && Math.abs(window.innerHeight - altoVista) < 160) return;
        anchoVista = window.innerWidth; altoVista = window.innerHeight;
        medir(); leerScroll(); dibujar();
      };
      window.addEventListener('resize', alResize);
      destruidoFns.push(() => window.removeEventListener('resize', alResize));

      /* ---- girar la flecha ---- */
      function nombrarRumbo(d) {
        etiqueta.textContent = d ? rotulo(d) : '';
        etiqueta.classList.toggle('es-visible', !!d);
        if (!d) etiqueta.setAttribute('data-vacia', '1'); else etiqueta.removeAttribute('data-vacia');
      }
      function irA(deg, d) {                                       // θ de la flecha, en grados (−90 = abajo)
        objetivo = deg; destActual = d || null;
        if (!movimiento) { angUsuario = deg; angVel = 0; dibujar(); return; }
        arrancarMuelle();
      }
      function arrancarMuelle() {
        if (resorte) return;
        resorte = true;
        let antes = performance.now();
        const paso = (ahora) => {
          if (!vivo) { resorte = false; return; }
          const dt = Math.min(0.032, (ahora - antes) / 1000); antes = ahora;
          const err = norm180(objetivo - angUsuario);
          // un muelle con un poco de rebote: k alto, amortiguación media
          const k = arrastrando ? 520 : 150, c = arrastrando ? 46 : 11;
          angVel += (k * err - c * angVel) * dt;
          angUsuario += angVel * dt;
          dibujar();
          if (Math.abs(err) < 0.15 && Math.abs(angVel) < 0.6) { angUsuario = objetivo; angVel = 0; resorte = false; dibujar(); return; }
          rafR = requestAnimationFrame(paso);
        };
        rafR = requestAnimationFrame(paso);
      }
      function aReposo(demora) {
        clearTimeout(tRep);
        tRep = setTimeout(() => {
          if (!vivo || arrastrando) return;
          nombrarRumbo(null);
          etiqueta.textContent = '';
          objetivo = REPOSO; destActual = null; arrancarMuelle();
          anunciar('La flecha vuelve a apuntar abajo.');
        }, demora);
      }
      function anunciar(txt) {
        // el aria-live dice siempre dónde apunta ahora la flecha
        el.dataset.anuncio = txt;
        if (!etiqueta.classList.contains('es-visible')) { etiqueta.textContent = txt; etiqueta.classList.add('solo-lectores'); }
        else etiqueta.classList.remove('solo-lectores');
      }
      function apuntarA(d, demora) {
        const deg = d.rumbo - 270;                                // la flecha base apunta a la izquierda (270º)
        irA(norm180(deg), d);
        nombrarRumbo(d); etiqueta.classList.remove('solo-lectores');
        anunciar('La flecha apunta a ' + rotulo(d) + '.');
        usado = true; dibujar();
        aReposo(demora || 2600);
      }
      function destinoMasCercano(rumboDeg) {
        let mejor = null, dm = 999;
        dests.forEach((d) => { const dd = Math.abs(norm180(d.rumbo - rumboDeg)); if (dd < dm) { dm = dd; mejor = d; } });
        return { d: mejor, dist: dm };
      }
      function siguiente(sentido) {
        if (!dests.length) return;
        let i = destActual ? dests.indexOf(destActual) : -1;
        if (i < 0) {                                              // desde el reposo: el más cercano al sur en el sentido pedido
          const sur = 180;
          const orden = dests.map((d) => ({ d, a: norm180(d.rumbo - sur) })).sort((x, y) => x.a - y.a);
          const cand = sentido > 0 ? orden.find((o) => o.a > 0) || orden[0] : [...orden].reverse().find((o) => o.a < 0) || orden[orden.length - 1];
          i = dests.indexOf(cand.d);
        } else i = (i + sentido + dests.length) % dests.length;
        apuntarA(dests[i], 8000);
      }
      // puntero: arrastrar sobre el cartel
      let inicio = null;
      function rumboDeEvento(e) {
        const r = escena.getBoundingClientRect();
        const [cx, cy] = state_centro();
        const dx = e.clientX - r.left - cx, dy = e.clientY - r.top - cy;
        const fi = (Math.atan2(dy, dx) * 180) / Math.PI;           // 0 = derecha, 90 = abajo
        return { fi, dist: Math.hypot(dx, dy) };
      }
      const state_centro = () => (estado.centroFlecha || [g.vw / 2, g.vh / 2]);
      escena.addEventListener('pointerdown', (e) => {
        if (uz > 0.3 || (e.pointerType === 'mouse' && e.button !== 0)) return;
        const r = rumboDeEvento(e);
        // se puede empezar en la flecha o en cualquier parte del cartel
        const caja = vector.getBoundingClientRect();
        if (e.clientX < caja.left || e.clientX > caja.right || e.clientY < caja.top || e.clientY > caja.bottom) return;
        inicio = { x: e.clientX, y: e.clientY, mov: false, tactil: e.pointerType !== 'mouse', id: e.pointerId };
        arrastrando = e.pointerType === 'mouse';                  // en táctil solo gira tras un gesto horizontal o una pulsación
        clearTimeout(tRep);
        if (arrastrando) { try { escena.setPointerCapture(e.pointerId); } catch (x) {} mover(e); }
      });
      function mover(e) {
        const r = rumboDeEvento(e);
        if (r.dist < 12) return;
        const b = (r.fi + 90 + 360) % 360;                         // rumbo en brújula: 0 arriba, 90 derecha
        const c = destinoMasCercano(b);
        usado = true;
        if (c.d && c.dist <= 22) {
          if (destActual !== c.d) { destActual = c.d; nombrarRumbo(c.d); etiqueta.classList.remove('solo-lectores'); anunciar('La flecha apunta a ' + rotulo(c.d) + '.'); }
          objetivo = norm180(c.d.rumbo - 270);
        } else {
          if (destActual) { destActual = null; nombrarRumbo(null); }
          objetivo = norm180(r.fi - 180);
        }
        if (!movimiento) { angUsuario = objetivo; dibujar(); } else arrancarMuelle();
      }
      escena.addEventListener('pointermove', (e) => {
        if (!inicio || inicio.id !== e.pointerId) return;
        const dx = e.clientX - inicio.x, dy = e.clientY - inicio.y;
        if (!inicio.mov && Math.hypot(dx, dy) > 6) {
          inicio.mov = true;
          if (inicio.tactil) {                                    // el gesto vertical es del scroll
            if (Math.abs(dy) > Math.abs(dx) * 1.2) { inicio = null; return; }
            arrastrando = true; try { escena.setPointerCapture(e.pointerId); } catch (x) {}
          }
        }
        if (arrastrando) mover(e);
      });
      const soltar = (e) => {
        if (!inicio || (e && inicio.id !== e.pointerId)) return;
        const toque = !inicio.mov, tactil = inicio.tactil;
        inicio = null; arrastrando = false;
        try { escena.releasePointerCapture(e.pointerId); } catch (x) {}
        if (toque && tactil && e && e.type === 'pointerup') {
          // una pulsación en la flecha pasa al siguiente destino
          const r = rumboDeEvento(e);
          if (r.dist <= (girar.offsetWidth / 2 || 40) * 1.6) { siguiente(1); return; }
        }
        if (destActual) { etiqueta.classList.add('se-va'); setTimeout(() => etiqueta.classList.remove('se-va'), 1200); }
        aReposo(destActual ? 450 : 0);
        if (!destActual) { objetivo = REPOSO; arrancarMuelle(); }
      };
      escena.addEventListener('pointerup', soltar);
      escena.addEventListener('pointercancel', soltar);
      // teclado
      girar.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); siguiente(1); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); siguiente(-1); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); siguiente(1); }
        else if (e.key === 'Escape') { clearTimeout(tRep); aReposo(0); }
      });
      girar.addEventListener('blur', () => aReposo(1200));
      girar.addEventListener('click', (e) => { if (e.detail === 0) return; });   // el ratón lo gestiona el puntero

      /* ---- la entrada: flores, letra, rótulo, vieira, peregrino ---- */
      const anims = [];
      function entrada() {
        if (!movimiento) return;
        escena.classList.add('preparando');
        const t0 = 0.05;
        // 1) flores, de izquierda a derecha, pétalo a pétalo
        flores.forEach((f, i) => { if (f) { abrirFlor(f, true, (t0 + 0.10 + i * 0.28) * 1000); } });
        // 2) «Casa Sánchez» se escribe a trazo: la duración de cada trazo, proporcional a su largo
        const lens = trazos.map((p) => { try { return p.getTotalLength(); } catch (e) { return 20; } });
        const suma = lens.reduce((a, b) => a + b, 0) || 1;
        const DUR = 2300;
        let t = (t0 + 0.55) * 1000;
        trazos.forEach((p, i) => {
          const d = Math.max(90, (lens[i] / suma) * DUR);
          const an = p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: d, delay: t, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'forwards' });
          an.onfinish = () => { p.style.strokeDashoffset = '0'; try { an.cancel(); } catch (e) {} };
          anims.push(an);
          t += d * 0.82;
        });
        // 3) ALBERGUE TURÍSTICO asienta letra a letra
        letras.forEach((p, i) => {
          const an = p.animate([{ opacity: 0, transform: 'translateY(22px)' }, { opacity: 1, transform: 'translateY(0)' }],
            { duration: 560, delay: 1500 + i * 55, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' });
          an.onfinish = () => { p.style.opacity = '1'; p.style.transform = 'none'; try { an.cancel(); } catch (e) {} };
          anims.push(an);
        });
        // 4) la vieira (abanico desde la charnela) y el peregrino (se dibuja)
        if (vieira) {
          vieira.style.transformOrigin = '310px 337px';
          const an = vieira.animate([{ opacity: 0, transform: 'scale(.55) rotate(-12deg)' }, { opacity: 1, transform: 'scale(1) rotate(0)' }],
            { duration: 800, delay: 2000, easing: 'cubic-bezier(.2,.9,.25,1.1)', fill: 'forwards' });
          an.onfinish = () => { vieira.style.opacity = '1'; vieira.style.transform = 'none'; try { an.cancel(); } catch (e) {} };
          anims.push(an);
        }
        if (peregrino) {
          peregrino.querySelectorAll('.cuerpo, .baston').forEach((p, i) => {
            p.setAttribute('pathLength', '1');
            p.style.strokeDasharray = '1 2';
            p.style.strokeDashoffset = '1';
            const an = p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 760, delay: 2300 + i * 380, easing: 'ease-out', fill: 'forwards' });
            an.onfinish = () => { p.style.strokeDasharray = 'none'; p.style.strokeDashoffset = '0'; try { an.cancel(); } catch (e) {} };
            anims.push(an);
          });
          const cab = peregrino.querySelector('.cabeza');
          if (cab) {
            cab.style.transformOrigin = '284px 443px';
            const an = cab.animate([{ opacity: 0, transform: 'scale(0)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 360, delay: 2700, easing: 'cubic-bezier(.2,.9,.25,1.4)', fill: 'forwards' });
            an.onfinish = () => { cab.style.opacity = '1'; cab.style.transform = 'none'; try { an.cancel(); } catch (e) {} };
            anims.push(an);
          }
        }
        // 5) la flecha entra desde la izquierda (ya apuntando abajo: es la del gesto)
        const an = flechaG.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 1100, easing: 'ease-out', fill: 'forwards' });
        an.onfinish = () => { flechaG.style.opacity = '1'; try { an.cancel(); } catch (e) {} };
        anims.push(an);
        setTimeout(() => { escena.classList.remove('preparando'); escena.classList.add('listo'); el.dataset.entrada = 'lista'; }, 3500);
      }

      medir();
      // el recorrido de la sección fijada lo da el CSS (--cartel-recorrido); aquí solo se lee
      leerScroll();
      dibujar();
      if (!movimiento) {
        flores.forEach((f) => { if (f) abrirFlor(f, true, 0, true); });
      }
      entrada();
      if (!movimiento) el.dataset.entrada = 'lista';
      destruidoFns.push(() => { cancelAnimationFrame(rafR); clearTimeout(tRep); anims.forEach((a) => { try { a.cancel(); } catch (e) {} }); });
      // ids de prueba
      el.dataset.dests = dests.map((d) => d.id).join(',');
    }
    return api;
  }

  /* ================= el pie: el cartel completo ================= */
  function pie(el, op) {
    op = op || {};
    if (!el || el.dataset.montado === '1') return { destruir() {} };
    const movimiento = op.movimiento !== false && op.densidad !== 'sobria' && !quieto();
    const respaldo = el.innerHTML;
    let vivo = true, io = null, oyente = null;
    const api = { destruir() { vivo = false; if (io) io.disconnect(); if (oyente) oyentesFlor.delete(oyente); el.innerHTML = respaldo; el.dataset.montado = ''; } };
    svgCartel().then((texto) => {
      if (!vivo || !texto) return;
      const madera = document.createElement('div');
      madera.className = 'pie-cerca';
      const tabla = document.createElement('div');
      tabla.className = 'pie-cartel';
      const svg = inyectar(tabla, texto);
      svg.setAttribute('focusable', 'false');
      svg.removeAttribute('width'); svg.removeAttribute('height');
      madera.appendChild(tabla);
      const clavos = document.createElement('i'); clavos.className = 'pie-clavos'; clavos.setAttribute('aria-hidden', 'true');
      madera.appendChild(clavos);
      el.innerHTML = '';
      el.appendChild(madera);
      el.classList.add('cartel-pie');
      el.dataset.montado = '1';
      const flores = [1, 2, 3].map((n) => $id(svg, 'flor-' + n));
      const flechaG = $id(svg, 'flecha');
      // la flecha del pie: a la izquierda, como en el cartel; solo apunta a Santiago si DATOS da la distancia
      if (SANTIAGO_KM != null) {
        const sant = DESTINOS.find((d) => d.id === 'santiago');
        flechaG.style.transformOrigin = '102px 404px';
        flechaG.style.transform = 'rotate(' + norm180(sant.rumbo - 270).toFixed(1) + 'deg)';
        const p = document.createElement('p'); p.className = 'pie-rumbo'; p.textContent = 'Santiago, ' + fkm(SANTIAGO_KM); el.appendChild(p);
      }
      // estado inicial: abiertas las que ya se abrieron por la página; el resto, en capullo
      flores.forEach((f, i) => { if (f) abrirFlor(f, abiertas.has(i + 1), 0, true); });
      let enPantalla = false;
      const completar = () => { flores.forEach((f, i) => { if (f && !f.classList.contains('abierta')) abrirFlor(f, true, i * 260, !movimiento); }); };
      oyente = (n) => { const f = flores[n - 1]; if (f && !f.classList.contains('abierta')) abrirFlor(f, true, 0, !movimiento || !enPantalla); };
      oyentesFlor.add(oyente);
      if ('IntersectionObserver' in window) {
        io = new IntersectionObserver((es) => { enPantalla = es[0].isIntersecting; if (enPantalla) { completar(); io.disconnect(); io = null; } }, { threshold: 0.35 });
        io.observe(el);
      } else completar();
      el.dataset.flores = flores.map((f) => (f && f.classList.contains('abierta') ? '1' : '0')).join('');
      el._floresAbiertas = () => flores.map((f) => (f && f.classList.contains('abierta') ? 1 : 0));
    });
    return api;
  }

  /* ================= API ================= */
  function montar(el, op) {
    if (!el) return { destruir() {} };
    if (el.hasAttribute('data-flor')) return flor(el, op);
    if (el.dataset.modulo === 'cartel-pie') return pie(el, op);
    return portada(el, op);
  }
  S.cartel = { montar, flor, pie, portada, DESTINOS, CASA, rumbo, homografia, aMatrix3d, proyectar, abiertas };
  S['cartel-pie'] = { montar: pie };
})();
