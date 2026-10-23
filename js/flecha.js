/* ------------------------------------------------------------------
   Albergue Casa Sánchez · «La flecha»                         (agente Entrada)
   1. CORTINA. Un brochazo azul pinta la flecha del cartel con cerdas, carga de pintura y una gota. La flecha
      gira sobre sí misma y apunta abajo; de su punta sale el amarillo del cartel (pintura que cubre, borde de
      rodillo, no un círculo limpio) y destapa la portada. ~2,4 s. Canvas 2D, sin WebGL ni librerías.
      Lo que aparece en el paso 2 no está pintado en el paso 1: el amarillo es un agujero con anillo de pintura
      en una capa de pizarra; lo que se ve dentro es la portada de verdad.
   2. HILO. Sanchez.flecha.montar(el): una flecha azul a brochazo se pinta con el scroll sobre pizarra, piedra
      o madera (data-superficie) y señala lo siguiente (data-hacia). Cada una tiene forma propia (semilla fija).
   3. Sanchez.brocha: el modelo de pincel (cerdas, carga, secado, gota) que comparten la cortina y el hilo.
   Contrato: Sanchez.flecha.montar(el, { movimiento, densidad }) → { destruir() }. El HTML de `el` es el
   respaldo (vacío: decorativas, aria-hidden). Con movimiento:false o densidad «sobria», la flecha sale ya
   pintada. La cortina la arranca sola este fichero con Sanchez.cortina (partes/cortina.html).
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  const S = (window.Sanchez = window.Sanchez || {});
  const BASE = (function () {
    const s = document.currentScript && document.currentScript.src;
    try { return new URL('../', s || location.href).href; } catch (e) { return './'; }
  })();
  const url = (r) => BASE + r;

  /* ================= utilidades ================= */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const suave = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const expoInOut = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2);
  const cubicOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const cuadOut = (t) => 1 - (1 - clamp(t, 0, 1)) * (1 - clamp(t, 0, 1));
  const cuadInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  function azar(semilla) {                     // mulberry32: la misma brocha siempre
    let a = semilla >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const quieto = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const hex = (h) => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

  // colores: los de la web (--azul…) si existen; si no, los medidos en el cartel
  function token(nombre, defecto) {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
      return v || defecto;
    } catch (e) { return defecto; }
  }
  const AZUL_CARTEL = '#291886';            // medido en la foto
  const AZUL_SOBRE_OSCURO = '#6552E0';      // el mismo azul, subido de luz, para que se lea sobre pizarra
  const AMARILLO = '#E0BF50';

  /* ================= el pincel de cerdas =================
     Un pincel es una fila de cerdas a lo ancho. Cada cerda tiene su sitio, su grosor, su carga de pintura,
     su rapidez en secarse y un arranque y un final un poco distintos: de ahí salen los bordes con flecos,
     las rayas de pincel seco al acabar el trazo y que cada brochazo sea otro. Todo con semilla fija. */
  function crearPincel(ancho, n, semilla, rgb) {
    const r = azar(semilla), sep = ancho / n, cerdas = [];
    for (let i = 0; i < n; i++) {
      const tono = (r() - 0.5) * 0.16;
      cerdas.push({
        u: (i + 0.5) * sep - ancho / 2 + (r() - 0.5) * sep * 0.5,
        w: Math.max(1.1, sep * (1.25 + r() * 0.35)),
        carga: 0.66 + r() * 0.34,
        seca: 0.08 + r() * 0.85,
        ini: r() * 0.05,
        fin: 0.94 + r() * 0.06,
        fase: r() * 6.283,
        col: rgb.map((c) => clamp(Math.round(c * (1 + tono)), 0, 255)),
      });
    }
    return { ancho, cerdas };
  }
  // un trazo = pincel + puntos. Devuelve segmentos {x0,y0,x1,y1,w,a,c,o} (o = orden de pintado 0..1)
  function segmentosDeTrazo(pincel, pts, o0, o1, pasos, ond) {
    const largos = [0];
    for (let i = 1; i < pts.length; i++) largos.push(largos[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = largos[largos.length - 1] || 1;
    const en = (s) => {                         // punto y normal a distancia s (0..1)
      const d = s * total;
      let k = 1;
      while (k < largos.length - 1 && largos[k] < d) k++;
      const a = pts[k - 1], b = pts[k], f = (d - largos[k - 1]) / ((largos[k] - largos[k - 1]) || 1);
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      return { x: a[0] + dx * f, y: a[1] + dy * f, nx: -dy / l, ny: dx / l };
    };
    const segs = [];
    pincel.cerdas.forEach((c) => {
      let prev = null;
      for (let k = 0; k <= pasos; k++) {
        const s = k / pasos;
        if (s < c.ini || s > c.fin) { prev = null; continue; }
        const p = en(s);
        const off = c.u + Math.sin(c.fase + s * 9) * ond;
        const x = p.x + p.nx * off, y = p.y + p.ny * off;
        const sec = suave(0.3, 1, s);
        const a = c.carga * (1 - c.seca * Math.pow(sec, 1.25));
        if (prev && a > 0.05) segs.push({ x0: prev.x, y0: prev.y, x1: x, y1: y, w: c.w, a, c: c.col, o: lerp(o0, o1, s) });
        prev = { x, y };
      }
    });
    return segs;
  }
  function pintarSegmentos(ctx, segs, hasta, desde) {
    ctx.lineCap = 'round';
    for (let i = 0; i < segs.length; i++) {
      const g = segs[i];
      if (g.o > hasta || g.o <= (desde || -1)) continue;
      ctx.strokeStyle = 'rgba(' + g.c[0] + ',' + g.c[1] + ',' + g.c[2] + ',' + g.a.toFixed(3) + ')';
      ctx.lineWidth = g.w;
      ctx.beginPath(); ctx.moveTo(g.x0, g.y0); ctx.lineTo(g.x1, g.y1); ctx.stroke();
    }
  }
  /* La flecha del cartel, a brochazos. Se pinta apuntando a la IZQUIERDA (como en el cartel) en un lienzo
     cuadrado de lado `lado` centrado en (0,0) y de largo L. Devuelve los segmentos y el polígono (para recortar). */
  function flechaABrochazos(L, semilla, rgb, v) {
    v = v || {};
    const r = azar(semilla);
    const sh = 0.31 * L * (v.grosor || 1), hl = 0.31 * L * (v.cabeza || 1), hh = 0.345 * L * (v.cabeza || 1);
    const x0 = L / 2, x1 = -L / 2;
    const curva = (v.curva || 0) * L;                     // el astil no es recto del todo
    const pts = {
      astil: [[x0, 0], [lerp(x0, x1 + hl, 0.5), curva], [x1 + hl * 0.92, 0]],
      sup: [[x1 + hl * 1.02, -hh * 0.96], [x1 + 0.02 * L, 0.0]],
      inf: [[x1 + hl * 1.02, hh * 0.96], [x1 + 0.02 * L, 0.0]],
      relleno: [[x1 + hl * 1.1, 0], [x1 + hl * 0.2, 0]],
    };
    const trazos = [
      { p: pts.astil, ancho: sh * 1.02, o: [0, 0.46], n: 34 },
      { p: pts.sup, ancho: sh * 0.62, o: [0.46, 0.64], n: 22 },
      { p: pts.inf, ancho: sh * 0.62, o: [0.62, 0.8], n: 22 },
      { p: pts.relleno, ancho: sh * 0.9, o: [0.8, 1], n: 26 },
    ];
    let segs = [];
    trazos.forEach((t, i) => {
      const pin = crearPincel(t.ancho, t.n, semilla * 31 + i * 977, rgb);
      segs = segs.concat(segmentosDeTrazo(pin, t.p, t.o[0], t.o[1], 26, 0.006 * L));
    });
    // recorte: la silueta de la flecha, un poco abultada y con borde de pintura (no recta)
    const poli = [[x1, 0], [x1 + hl, -hh], [x1 + hl, -sh / 2], [x0, -sh / 2], [x0, sh / 2], [x1 + hl, sh / 2], [x1 + hl, hh]];
    const cx = poli.reduce((a, p) => a + p[0], 0) / poli.length, cy = 0;
    const inflar = 0.045 * L;
    const borde = [];
    poli.forEach((p, i) => {
      const q = poli[(i + 1) % poli.length], n = 5;
      for (let k = 0; k < n; k++) {
        const f = k / n, px = lerp(p[0], q[0], f), py = lerp(p[1], q[1], f);
        const dx = px - cx, dy = py - cy, l = Math.hypot(dx, dy) || 1;
        const j = (r() - 0.35) * 0.012 * L;
        borde.push([px + (dx / l) * (inflar + j), py + (dy / l) * (inflar + j)]);
      }
    });
    return { segs, borde, L, sh, hh, hl };
  }

  /* ================= 1. la cortina «La flecha» ================= */
  function iniciarCortina() {
    const C = S.cortina;
    if (!C || C.fuera || C.enMarcha) return;
    const nodo = document.getElementById('cortina');
    const lienzo = nodo && nodo.querySelector('.cortina__lienzo');
    if (!nodo || !lienzo || quieto()) { if (C.retirar) C.retirar(); return; }
    // si la página tardó más de 2 s en llegar aquí, la cortina ya no se enseña
    if (performance.now() > 2000) { C.retirar(); return; }
    const ctx = lienzo.getContext('2d');
    if (!ctx) return;                                       // se queda el respaldo CSS de la parte
    C.enMarcha = true;
    const vw = Math.max(320, nodo.clientWidth || window.innerWidth), vh = Math.max(320, nodo.clientHeight || window.innerHeight);
    const k = Math.min(window.devicePixelRatio || 1, 1.25, Math.sqrt(2.4e6 / (vw * vh)));
    lienzo.width = Math.round(vw * k); lienzo.height = Math.round(vh * k);
    nodo.classList.add('es-lienzo');

    // la flecha y su pintura
    const L = clamp(Math.min(vw, vh) * 0.42, 160, 400);
    const cx = vw / 2, cy = vh * 0.45;
    const Pd = Math.ceil(L * 1.55);
    const pintura = document.createElement('canvas');
    pintura.width = pintura.height = Math.ceil(Pd * k);
    const pc = pintura.getContext('2d');
    pc.setTransform(k, 0, 0, k, 0, 0);
    const AZUL_VIVO = hex(AZUL_SOBRE_OSCURO);
    const fl = flechaABrochazos(L, 20261023, AZUL_VIVO, { curva: 0.004 });
    pc.translate(Pd / 2, Pd / 2);
    pc.beginPath();
    fl.borde.forEach((p, i) => (i ? pc.lineTo(p[0], p[1]) : pc.moveTo(p[0], p[1])));
    pc.closePath(); pc.clip();
    pc.setTransform(k, 0, 0, k, 0, 0);
    // (el clip se hizo con la matriz de traslación; se vuelve a poner para pintar con la misma)
    pc.translate(Pd / 2, Pd / 2);

    // la pizarra (textura generada: img/brocha/pizarra.webp)
    const img = new Image();
    let patron = null;
    img.onload = () => { try { patron = ctx.createPattern(img, 'repeat'); } catch (e) { patron = null; } };
    img.src = url('img/brocha/pizarra.webp');
    const ph1 = Math.random() * 6.283, ph2 = Math.random() * 6.283, ph3 = Math.random() * 6.283;
    const R = azar(8);
    const f1 = R() * 6.283, f2 = R() * 6.283, f3 = R() * 6.283, f4 = R() * 6.283;

    // línea de tiempo (s)
    const T = { pinta: [0.12, 0.92], gira: [0.98, 1.58], gota: [1.42, 1.9], inunda: [1.6, 2.4], fuera: 2.46 };
    const tip = { x: cx, y: cy + L / 2 * 1.06 };               // la punta, ya girada hacia abajo
    const esquinas = [[0, 0], [vw, 0], [0, vh], [vw, vh]];
    const Rmax = Math.max.apply(null, esquinas.map((e) => Math.hypot(e[0] - tip.x, e[1] - tip.y))) * 1.1 + 40;
    const rimW = clamp(vw * 0.013, 10, 22);
    let t0 = null, pintadoHasta = -1, abierta = false, terminado = false, raf = 0;

    function radio(th, r) {                                    // borde de rodillo: ondas + flecos, siempre los mismos
      const w = 1 + 0.035 * Math.sin(5 * th + f1) + 0.02 * Math.sin(11 * th + f2) + 0.012 * Math.sin(23 * th + f3)
        + 0.007 * Math.abs(Math.sin(37 * th + f4)) + 0.004 * Math.sin(71 * th + ph1 * 0 + ph2);
      return r * w;
    }
    function poligono(r) {
      ctx.beginPath();
      const n = 168;
      for (let i = 0; i <= n; i++) {
        const th = (i / n) * 6.2832, rr = radio(th, r);
        const x = tip.x + Math.cos(th) * rr, y = tip.y + Math.sin(th) * rr;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.closePath();
    }
    function fondo() {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = patron || '#2E3338';
      ctx.fillRect(0, 0, vw, vh);
      // un velo de luz arriba y sombra abajo: no es un fondo plano
      const g = ctx.createLinearGradient(0, 0, 0, vh);
      g.addColorStop(0, 'rgba(255,255,255,.035)'); g.addColorStop(1, 'rgba(0,0,0,.28)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
    }
    function dibujar(t) {
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.clearRect(0, 0, vw, vh);
      fondo();
      // 1) pintar el trazo: solo lo nuevo, sobre el lienzo de la pintura
      const u = clamp((t - T.pinta[0]) / (T.pinta[1] - T.pinta[0]), 0, 1);
      const o = cuadInOut(u) * 0.55 + u * 0.45;
      if (o > pintadoHasta) { pintarSegmentos(pc, fl.segs, o, pintadoHasta); pintadoHasta = o; }
      // 2) la flecha: gira sobre sí misma y queda apuntando abajo
      const ug = clamp((t - T.gira[0]) / (T.gira[1] - T.gira[0]), 0, 1);
      const ang = -Math.PI * 2.5 * cubicOut(ug);                // −450º: una vuelta y un cuarto, hacia abajo
      const esc = 1 + 0.07 * Math.sin(Math.PI * clamp(ug * 1.25, 0, 1)) + 0.06 * cubicOut(ug);
      // la mancha de pintura mojada: sombra suave bajo la flecha
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang); ctx.scale(esc, esc);
      ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
      ctx.drawImage(pintura, -Pd / 2, -Pd / 2, Pd, Pd);
      ctx.restore();
      // 3) la gota que resbala desde la punta
      const ugo = clamp((t - T.gota[0]) / (T.gota[1] - T.gota[0]), 0, 1);
      if (ugo > 0 && t < T.inunda[0] + 0.5) {
        const largo = L * 0.2 * cuadOut(ugo), ancho = clamp(L * 0.022, 3, 7);
        const px = tip.x + L * 0.004, py = tip.y - 3;
        ctx.fillStyle = AZUL_SOBRE_OSCURO;
        ctx.beginPath();
        ctx.moveTo(px - ancho * 0.9, py);
        ctx.quadraticCurveTo(px - ancho * 0.35, py + largo * 0.5, px - ancho * 0.45, py + largo);
        ctx.arc(px, py + largo, ancho * 0.6 + ugo * 1.8, Math.PI, 0, true);
        ctx.quadraticCurveTo(px + ancho * 0.35, py + largo * 0.5, px + ancho * 0.9, py);
        ctx.closePath(); ctx.fill();
      }
      // 4) el amarillo: anillo de pintura + agujero que deja ver la portada
      const ui = clamp((t - T.inunda[0]) / (T.inunda[1] - T.inunda[0]), 0, 1);
      if (ui > 0) {
        if (!abierta) { abierta = true; nodo.classList.add('es-abriendo'); C.abrir(); }
        const r = expoInOut(ui) * Rmax;
        poligono(r + rimW);
        ctx.fillStyle = AMARILLO; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(160,120,20,.55)'; ctx.stroke();
        // lomo de pintura gruesa en el borde: un trazo más claro, un poco desplazado
        poligono(r + rimW * 0.55);
        ctx.lineWidth = 2.4; ctx.strokeStyle = 'rgba(255,238,170,.55)'; ctx.stroke();
        ctx.globalCompositeOperation = 'destination-out';
        poligono(r);
        ctx.fillStyle = '#000'; ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    function fotograma(ahora) {
      if (terminado) return;
      if (t0 === null) t0 = ahora;
      const t = (ahora - t0) / 1000;
      dibujar(t);
      if (t >= T.fuera) { terminado = true; C.retirar(); return; }
      raf = requestAnimationFrame(fotograma);
    }
    // si la pestaña no pinta (oculta), la red de seguridad de la parte retira la cortina; aquí no hay nada más que hacer
    const ya = () => { raf = requestAnimationFrame(fotograma); };
    if (img.complete) ya(); else { img.addEventListener('load', ya, { once: true }); img.addEventListener('error', ya, { once: true }); setTimeout(() => { if (!raf) ya(); }, 260); }
    C.cancelar = () => { terminado = true; cancelAnimationFrame(raf); };
  }

  /* ================= 2. el hilo: flechas que se pintan con el scroll ================= */
  let cuenta = 0;
  const SUPERFICIES = {
    pizarra: { img: 'img/brocha/pizarra.webp', color: '#33373C', azul: AZUL_SOBRE_OSCURO },
    piedra: { img: 'img/brocha/piedra.webp', color: '#B9AE9C', azul: '#2A1C8E' },
    madera: { img: 'img/brocha/madera.webp', color: '#7A5236', azul: '#3A2CB0' },
  };

  function montar(el, op) {
    op = op || {};
    if (!el || el.dataset.montado === '1') return { destruir() {} };
    const nombre = SUPERFICIES[el.dataset.superficie] ? el.dataset.superficie : 'pizarra';
    const sup = SUPERFICIES[nombre];
    const idx = cuenta++;
    const semilla = 4000 + idx * 131 + (nombre.length * 17);
    const movimiento = op.movimiento !== false && op.densidad !== 'sobria' && !quieto();
    el.setAttribute('aria-hidden', 'true');
    el.classList.add('hilo', 'hilo--' + nombre);
    el.style.setProperty('--hilo-img', 'url(' + url(sup.img) + ')');
    const lienzo = document.createElement('canvas');
    lienzo.className = 'hilo__lienzo';
    el.appendChild(lienzo);
    const ctx = lienzo.getContext('2d');
    if (!ctx) return { destruir() {} };

    let w = 0, h = 0, k = 1, flecha = null, patron = null, ultimoP = -1, vivo = true, visible = true, raf = 0;
    const color = hex(sup.azul);
    const textura = new Image();
    textura.onload = () => { try { patron = ctx.createPattern(textura, 'repeat'); } catch (e) { patron = null; } ultimoP = -1; pedir(); };
    textura.src = url(sup.img);

    function construir() {
      const rect = el.getBoundingClientRect();
      w = Math.max(200, Math.round(rect.width)); h = Math.max(120, Math.round(rect.height));
      k = Math.min(window.devicePixelRatio || 1, 1.5);
      lienzo.width = Math.round(w * k); lienzo.height = Math.round(h * k);
      const r = azar(semilla);
      const L = Math.min(h * 0.82, w * 0.5) * (0.86 + r() * 0.2);
      // posición a lo ancho: una de las tres zonas centrales, siempre la misma para cada flecha
      const cx = w * (0.34 + r() * 0.32);
      // inclinación: hacia el destino si se sabe, más un poco de mano
      let incl = (r() - 0.5) * 0.5;
      const hacia = el.dataset.hacia && document.querySelector(el.dataset.hacia);
      if (hacia) {
        const a = hacia.getBoundingClientRect();
        const dx = (a.left + a.width / 2) - (rect.left + cx), dy = Math.max(120, a.top - rect.bottom + 140);
        incl = clamp(Math.atan2(dx, dy) * 0.6 + incl * 0.4, -0.5, 0.5);
      }
      flecha = flechaABrochazos(L, semilla, color, { grosor: 0.92 + r() * 0.2, cabeza: 0.9 + r() * 0.22, curva: (r() - 0.5) * 0.06 });
      flecha.cx = cx; flecha.cy = h * 0.5; flecha.ang = -Math.PI / 2 - incl + (r() - 0.5) * 0.08;   // apunta hacia abajo (−90º) y se inclina hacia el destino
      flecha.gota = { cuando: 0.78, largo: (0.1 + r() * 0.14) * h, x: 0.2 + r() * 0.5 };
      ultimoP = -1;
    }
    function pintar(p) {
      if (!flecha) return;
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (p <= 0.001) return;
      const { L } = flecha;
      // la pintura va sobre un lienzo aparte para dejar que el grano de la superficie la atraviese
      const t = pintura(w, h, k);
      const c = t.getContext('2d');
      c.setTransform(k, 0, 0, k, 0, 0); c.clearRect(0, 0, w, h);
      c.save();
      c.translate(flecha.cx, flecha.cy); c.rotate(flecha.ang);
      c.beginPath();
      flecha.borde.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])));
      c.closePath(); c.clip();
      pintarSegmentos(c, flecha.segs, p);
      c.restore();
      // la gota: sale de la punta (la flecha apunta abajo) y resbala al acabar
      const pg = clamp((p - flecha.gota.cuando) / (1 - flecha.gota.cuando), 0, 1);
      if (pg > 0) {
        const largo = flecha.gota.largo * cuadOut(pg);
        const ca = Math.cos(flecha.ang), sa = Math.sin(flecha.ang);
        const px = flecha.cx + (-L / 2 * 1.03) * ca + (flecha.gota.x - 0.45) * 5, py = flecha.cy + (-L / 2 * 1.03) * sa - 2;
        const ancho = clamp(L * 0.02, 2.4, 5);
        c.fillStyle = 'rgb(' + color.join(',') + ')';
        c.beginPath();
        c.moveTo(px - ancho * 0.8, py);
        c.quadraticCurveTo(px - ancho * 0.3, py + largo * 0.6, px - ancho * 0.4, py + largo);
        c.arc(px, py + largo, ancho * 0.55 + pg * 1.4, Math.PI, 0, true);
        c.quadraticCurveTo(px + ancho * 0.3, py + largo * 0.6, px + ancho * 0.8, py);
        c.closePath(); c.fill();
      }
      // grano de la superficie sobre la pintura
      if (patron) {
        c.globalCompositeOperation = 'source-atop';
        c.globalAlpha = 0.3;
        c.fillStyle = patron; c.fillRect(0, 0, w, h);
        c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      }
      ctx.drawImage(t, 0, 0, w, h);
    }
    let lienzoPintura = null;
    function pintura(ww, hh, kk) {
      if (!lienzoPintura) lienzoPintura = document.createElement('canvas');
      if (lienzoPintura.width !== Math.round(ww * kk) || lienzoPintura.height !== Math.round(hh * kk)) {
        lienzoPintura.width = Math.round(ww * kk); lienzoPintura.height = Math.round(hh * kk);
      }
      return lienzoPintura;
    }
    // progreso: 0 → 1 mientras el centro de la franja cruza del 70 % al 30 % de la pantalla
    function progreso() {
      if (!movimiento) return 1;
      const r = el.getBoundingClientRect(), vh = window.innerHeight;
      const centro = r.top + r.height / 2;
      return clamp((vh * 0.7 - centro) / (vh * 0.4), 0, 1);
    }
    function paso() {
      raf = 0;
      if (!vivo) return;
      const p = progreso();
      if (Math.abs(p - ultimoP) > 0.002 || ultimoP < 0) { ultimoP = p; pintar(p); el.dataset.progreso = p.toFixed(3); }
    }
    function pedir() { if (!raf && vivo && visible) raf = requestAnimationFrame(paso); }
    construir();
    pintar(movimiento ? 0 : 1);
    const onScroll = () => pedir();
    window.addEventListener('scroll', onScroll, { passive: true });
    let anchoVista = window.innerWidth, altoVista = window.innerHeight;
    const onResize = () => {
      // el resize de la barra del móvil no rehace nada (solo cambia el alto)
      if (window.innerWidth === anchoVista && Math.abs(window.innerHeight - altoVista) < 160) return;
      anchoVista = window.innerWidth; altoVista = window.innerHeight;
      construir(); pedir();
    };
    window.addEventListener('resize', onResize);
    // fuera de pantalla no se pinta nada (ni hay requestAnimationFrame)
    let io = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) pedir(); }, { rootMargin: '10% 0px' });
      io.observe(el);
    }
    el.dataset.montado = '1';
    pedir();
    return {
      destruir() {
        vivo = false; cancelAnimationFrame(raf);
        window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize);
        if (io) io.disconnect();
        lienzo.remove(); el.dataset.montado = '';
      },
    };
  }

  S.brocha = { azar, crearPincel, segmentosDeTrazo, pintarSegmentos, flechaABrochazos };
  S.flecha = { montar, AZUL_CARTEL, AZUL_SOBRE_OSCURO };

  // la cortina arranca sola en cuanto este fichero se ejecuta (llega con `defer`: el DOM ya está)
  iniciarCortina();
})();
