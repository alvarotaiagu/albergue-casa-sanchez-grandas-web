/* ------------------------------------------------------------------
   Albergue Casa Sánchez · módulo «El jardín de hoy» (agente Jardín)

   El jardín de la casa como lámina ilustrada en capas (SVG generado aquí, con
   semilla fija: la misma casa siempre), dibujada con la tinta parda del cartel
   y manchas planas de color algo desplazadas, como un grabado mal registrado.
   Fiel a las fotos jardin-casa, casa-flor, jardin-tumbonas y porche-hamaca
   (ref/FOTOS.md): la casa baja de piedra y pizarra, la cerca de palos de
   castaño sobre el muro de pizarra, la magnolia, el cerezo, las tumbonas de
   rayas verdes, la hamaca azul turquesa y la terraza de barandas granates.
   Nada más: lo que no está en las fotos no se dibuja.

   Según la fecha real (Europa/Madrid; ?fecha=AAAA-MM-DD para probar):
     · flor (20-mar a 5-may): magnolia y cerezo en flor, caen pétalos.
     · verde (6-may a 22-sep): hoja, sombra moteada, hamaca.
     · otoño (23-sep a 3-nov): hojas que pasan a ocre y caen, luz baja.
     · desnudo (4-nov a 19-mar): ramas peladas.
   Y según la temporada de la ficha del albergue (TEMPORADA, abajo): fuera de
   ella el albergue está CERRADO y la lámina lleva el cartelito «Volvemos…».
   Según el tiempo de ahora (Sanchez.tiempo()): lluvia, viento, sol o nubes, y
   una línea de texto verdadera; con fuente 'supuesto' no se pinta nada.

   Contrato: window.Sanchez.jardin.montar(el, { movimiento, densidad, fecha?,
   tiempo? }) → { destruir(), estado() }. El HTML de `el` es el respaldo (lo
   escribe la web): se oculta al montar y vuelve con destruir() o si algo falla.
   Con movimiento:false, movimiento reducido o densidad 'sobria': lámina quieta
   en su estación, sin partículas, sin paralaje, sin gato, sin requestAnimationFrame
   (el contenido —estación, tiempo, texto— sale igual).

   Presupuesto: partículas en canvas 2D (DPR ≤ 1,5; tope 60 en escritorio y
   30 en móvil), un solo requestAnimationFrame que se para fuera de pantalla,
   con la pestaña oculta y cuando no hay nada que mover. El resize de la barra
   del móvil no rehace nada (checklist punto 10).

   Este fichero también se carga en Node (pruebas/jardin-exportar.mjs) para
   sacar la lámina a SVG: la parte de dibujo no toca `document`.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  var W = 1200, H = 700;

  /* ================================================================
     DATOS (de ref/DATOS-CASA-SANCHEZ.md). Cada supuesto, en un solo sitio.
     ================================================================ */
  // SUPUESTO / POR CONFIRMAR: la ficha del albergue (19-10-2026) dice «del 15 de abril al 3 de noviembre»;
  // otras fuentes dicen «Semana Santa – 6 de octubre» y «13 de abril – 1 de octubre». Se cambia SOLO aquí.
  var TEMPORADA = { abre: [4, 15], cierra: [11, 3], textoAbre: '15 de abril', textoCierra: '3 de noviembre', porConfirmar: true };
  // DATOS «Zonas comunes»: lavadora 4 € el lavado, secadora 4 € el secado.
  var PRECIOS = { lavado: 4, secado: 4 };

  /* ================================================================
     FECHAS: estación, aspecto del dibujo y temporada
     ================================================================ */
  function md(f) { return (f.getMonth() + 1) * 100 + f.getDate(); }
  function estacionDe(f) {
    var v = md(f);
    if (v >= 1221 || v < 320) return 'invierno';
    if (v < 621) return 'primavera';
    if (v < 923) return 'verano';
    return 'otono';
  }
  function abiertoEn(f) {
    var v = md(f), a = TEMPORADA.abre[0] * 100 + TEMPORADA.abre[1], c = TEMPORADA.cierra[0] * 100 + TEMPORADA.cierra[1];
    return v >= a && v <= c;
  }
  // lo que se dibuja: flor | verde | otono | desnudo (ver la cabecera)
  function aspectoDe(f) {
    var v = md(f);
    if (v >= 320 && v <= 505) return 'flor';
    if (v >= 506 && v <= 922) return 'verde';
    if (v >= 923 && v <= 1103) return 'otono';
    return 'desnudo';
  }
  // 0 → 1 a lo largo del otoño abierto (23-sep → 3-nov): las hojas pasan del verde al ocre
  function avanceOtono(f) {
    var ini = new Date(f.getFullYear(), 8, 23), fin = new Date(f.getFullYear(), 10, 3);
    return Math.max(0, Math.min(1, (f - ini) / (fin - ini)));
  }
  // color de los arbustos: rododendro (mayo-20 jun), hortensia (21 jun-31 ago) o solo hoja
  function arbustoDe(f) {
    var v = md(f);
    if (v >= 320 && v <= 620) return 'rodo';
    if (v >= 621 && v <= 831) return 'hortensia';
    return 'hoja';
  }
  function fechaDe(op) {
    var f = op && op.fecha;
    if (f instanceof Date && !isNaN(f)) return f;
    if (typeof f === 'string' && /^\d{4}-\d{2}-\d{2}/.test(f)) return new Date(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10), 12);
    try {
      var s = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' });   // AAAA-MM-DD
      return new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10), 12);
    } catch (e) { return new Date(); }
  }
  // todo lo que el módulo deduce de una fecha, en un objeto
  function situacion(f) {
    var est = estacionDe(f), ab = abiertoEn(f), asp = aspectoDe(f), v = md(f);
    // cerrado en pleno invierno → ramas desnudas; entre el 20-mar y el 14-abr la magnolia y el cerezo ya florecen (IG 2018-04-21, 2021-04-08)
    return { fecha: f, estacion: est, abierto: ab, aspecto: asp, avance: avanceOtono(f), arbusto: arbustoDe(f), mes: f.getMonth(), dia: f.getDate(), v: v };
  }

  /* ================================================================
     COLOR: paleta por aspecto y por tiempo
     ================================================================ */
  function rgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function hex(c) { return '#' + c.map(function (n) { n = Math.max(0, Math.min(255, Math.round(n))); return (n < 16 ? '0' : '') + n.toString(16); }).join(''); }
  function mezcla(a, b, t) { var A = rgb(a), B = rgb(b); return hex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]); }
  function oscuro(c, t) { return mezcla(c, '#1d261c', t); }

  var BASE = {
    flor: {
      cieloA: '#BCD6E6', cieloB: '#EFF0E4', lejos: '#8DA97E', lejos2: '#A9C095', seto: '#40693A', seto2: '#5C8749',
      cesped: '#8DB75B', cesped2: '#A8C86F', cespedS: '#6C9847', hoja: '#6F9E46', hoja2: '#8CBA59', hoja3: '#4F7A3A',
      flor: '#FBF6EA', flor2: '#F0CBD2', magnolia: '#F3E8B9', arb1: '#C23A78', arb2: '#FBF7EE', tronco: '#6A5040', nube: '#FBFAF5', sombra: '#2C4A2B', suelo: '#FBF6EA'
    },
    verde: {
      cieloA: '#A8CEE3', cieloB: '#E7EEE0', lejos: '#6E9269', lejos2: '#88A67E', seto: '#33602F', seto2: '#4C7D3F',
      cesped: '#80AE4B', cesped2: '#97C15F', cespedS: '#5F8C3C', hoja: '#4F8A38', hoja2: '#6BA546', hoja3: '#3A6B2C',
      flor: '#FBF6EA', flor2: '#F0CBD2', magnolia: '#F3E8B9', arb1: '#C23A78', arb2: '#4A8236', tronco: '#6A5040', nube: '#FBFAF5', sombra: '#244324', suelo: '#FBF6EA'
    },
    otono: {
      cieloA: '#CEC9BC', cieloB: '#EBDDC3', lejos: '#9A8E63', lejos2: '#B0A175', seto: '#52663A', seto2: '#6C7C45',
      cesped: '#93A157', cesped2: '#A8B263', cespedS: '#70803F', hoja: '#C7852F', hoja2: '#DDA743', hoja3: '#A5532A',
      flor: '#FBF6EA', flor2: '#F0CBD2', magnolia: '#F3E8B9', arb1: '#B4662B', arb2: '#9A8A3A', tronco: '#62493A', nube: '#F3EEE4', sombra: '#3B3A22', suelo: '#C7852F'
    },
    desnudo: {
      cieloA: '#CBD3D6', cieloB: '#E9E8E1', lejos: '#8B9A8A', lejos2: '#A3AFA0', seto: '#4A5E48', seto2: '#5F7459',
      cesped: '#8E9E72', cesped2: '#A0AE82', cespedS: '#728461', hoja: '#8C7A52', hoja2: '#A18E60', hoja3: '#6E5C3C',
      flor: '#FBF6EA', flor2: '#F0CBD2', magnolia: '#F3E8B9', arb1: '#6C5A44', arb2: '#6C5A44', tronco: '#5A4638', nube: '#F3F2EC', sombra: '#35402F', suelo: '#C7852F'
    }
  };

  // paleta final: base del aspecto, empujada por el avance del otoño y por el tiempo ('lluvia' | 'nubes' | 'sol' | null)
  function paleta(sit, clima) {
    var p = {}, b = BASE[sit.aspecto], k;
    for (k in b) p[k] = b[k];
    if (sit.aspecto === 'otono') {
      var a = sit.avance, v = BASE.verde;
      p.hoja = mezcla(v.hoja, b.hoja, a); p.hoja2 = mezcla(v.hoja2, b.hoja2, a); p.hoja3 = mezcla(v.hoja3, b.hoja3, a);
      p.cesped = mezcla(v.cesped, b.cesped, a * .9); p.cesped2 = mezcla(v.cesped2, b.cesped2, a * .9); p.cespedS = mezcla(v.cespedS, b.cespedS, a * .9);
      p.arb2 = mezcla(v.arb2, b.arb2, a); p.seto = mezcla(v.seto, b.seto, a); p.seto2 = mezcla(v.seto2, b.seto2, a);
      p.lejos = mezcla(v.lejos, b.lejos, a); p.lejos2 = mezcla(v.lejos2, b.lejos2, a);
      p.cieloA = mezcla(v.cieloA, b.cieloA, Math.min(1, a * 1.4)); p.cieloB = mezcla(v.cieloB, b.cieloB, Math.min(1, a * 1.4));
    }
    if (sit.aspecto === 'verde' || sit.aspecto === 'flor') {
      p.arb1 = sit.arbusto === 'rodo' ? '#C23A78' : (sit.arbusto === 'hortensia' ? '#7C8FD2' : p.hoja3);
      p.arb2 = sit.arbusto === 'rodo' ? (sit.aspecto === 'flor' ? '#FBF7EE' : p.hoja) : (sit.arbusto === 'hortensia' ? '#A58BC8' : p.hoja);
    }
    if (clima === 'lluvia') {
      p.cieloA = mezcla(p.cieloA, '#7F8B91', .62); p.cieloB = mezcla(p.cieloB, '#B9C0BF', .62); p.nube = '#C9CFD0';
      ['lejos', 'lejos2'].forEach(function (c) { p[c] = mezcla(p[c], '#7B878B', .42); });
      ['seto', 'seto2', 'cesped', 'cesped2', 'cespedS', 'hoja', 'hoja2', 'hoja3', 'arb2'].forEach(function (c) { p[c] = oscuro(p[c], .2); });
      p.cesped = oscuro(p.cesped, .1);
    } else if (clima === 'nubes') {
      p.cieloA = mezcla(p.cieloA, '#A9B2B6', .5); p.cieloB = mezcla(p.cieloB, '#D5D8D4', .5); p.nube = '#E4E6E3';
      ['lejos', 'lejos2', 'seto', 'seto2', 'cesped', 'cesped2', 'hoja', 'hoja2', 'arb2'].forEach(function (c) { p[c] = mezcla(p[c], '#8F9690', .16); });
    }
    return p;
  }
  var VARS = { cieloA: '--c-cielo-a', cieloB: '--c-cielo-b', lejos: '--c-lejos', lejos2: '--c-lejos2', seto: '--c-seto', seto2: '--c-seto2', cesped: '--c-cesped', cesped2: '--c-cesped2',
    cespedS: '--c-cespeds', hoja: '--c-hoja', hoja2: '--c-hoja2', hoja3: '--c-hoja3', flor: '--c-flor', flor2: '--c-flor2', magnolia: '--c-magnolia', arb1: '--c-arb1', arb2: '--c-arb2',
    tronco: '--c-tronco', nube: '--c-nube', sombra: '--c-sombra', suelo: '--c-suelo' };
  function varsEstilo(p) { var s = '', k; for (k in VARS) s += VARS[k] + ':' + p[k] + ';'; return s; }

  /* ================================================================
     DIBUJO (cadenas SVG). Semilla fija: la casa es siempre la misma.
     ================================================================ */
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function f(v) { return Math.round(v * 10) / 10; }
  function pt(p) { return f(p[0]) + ' ' + f(p[1]); }
  function mid(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }

  // polígono de aristas rectas con un pulso de mano
  function poli(pts, amp, rnd, cerrado) {
    var n = pts.length, d = 'M' + pt(pts[0]), m = cerrado === false ? n - 1 : n, i, j, a, b, len, k, t, nx, ny, o;
    for (i = 0; i < m; i++) {
      a = pts[i]; b = pts[(i + 1) % n];
      len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; k = Math.max(1, Math.round(len / 46));
      nx = -(b[1] - a[1]) / len; ny = (b[0] - a[0]) / len;
      for (j = 1; j < k; j++) { t = j / k; o = (rnd() - .5) * 2 * amp; d += 'L' + pt([a[0] + (b[0] - a[0]) * t + nx * o, a[1] + (b[1] - a[1]) * t + ny * o]); }
      d += 'L' + pt(b);
    }
    return cerrado === false ? d : d + 'Z';
  }
  // contorno redondeado por puntos medios (piedras, manchas, hojas)
  function suave(pts) {
    var n = pts.length, d = 'M' + pt(mid(pts[n - 1], pts[0])), i;
    for (i = 0; i < n; i++) d += 'Q' + pt(pts[i]) + ' ' + pt(mid(pts[i], pts[(i + 1) % n]));
    return d + 'Z';
  }
  // abierta, curva por los puntos
  function curva(pts) {
    var n = pts.length, d = 'M' + pt(pts[0]), i;
    if (n === 2) return d + 'L' + pt(pts[1]);
    for (i = 1; i < n - 1; i++) d += 'Q' + pt(pts[i]) + ' ' + pt(mid(pts[i], pts[i + 1]));
    return d + 'L' + pt(pts[n - 1]);
  }
  // mancha desplazada + tinta (grandes) y una sola ruta (pequeñas)
  function fo(cls, d, ox, oy) { return '<path class="k-' + cls + '" transform="translate(' + (ox == null ? 2.6 : ox) + ' ' + (oy == null ? 2 : oy) + ')" d="' + d + '"/><path class="t" d="' + d + '"/>'; }
  function fi(cls, d, extra) { return '<path class="k-' + cls + ' o' + (extra || '') + '" d="' + d + '"/>'; }
  function ln(d, cls) { return '<path class="' + (cls || 't') + '" d="' + d + '"/>'; }
  function lote(o) { var s = '', c; for (c in o.f) s += '<path class="k-' + c + ' o1" d="' + o.f[c].join('') + '"/>'; return s; }

  // muro de piedra a piedra (filas desencajadas)
  function muro(x0, x1, y0, y1, filas, wmin, wmax, rnd, clases) {
    var out = { f: {} }, h = (y1 - y0) / filas, r, x, y, w, xa, xb, c = 3, j, p, cls;
    j = function () { return (rnd() - .5) * 2.2; };
    for (r = 0; r < filas; r++) {
      y = y0 + r * h; x = x0 - rnd() * wmin * (r % 2 ? .9 : .3);
      while (x < x1) {
        w = wmin + rnd() * (wmax - wmin); xa = Math.max(x, x0) + 1.5; xb = Math.min(x + w, x1) - 1.5;
        if (xb - xa > 9) {
          p = [[xa + c + j(), y + 1 + j()], [xb - c + j(), y + 1 + j()], [xb + j() * .5, y + c + j()], [xb + j() * .5, y + h - c + j()], [xb - c + j(), y + h - 1 + j()], [xa + c + j(), y + h - 1 + j()], [xa + j() * .5, y + h - c + j()], [xa + j() * .5, y + c + j()]];
          cls = clases[(rnd() * clases.length) | 0]; (out.f[cls] = out.f[cls] || []).push(suave(p));
        }
        x += w;
      }
    }
    return out;
  }

  // nube de hojas o flores: contorno festoneado con arcos hacia fuera
  function nube(cx, cy, r, rnd, n, ry) {
    var rx = r * 1.12, ryy = (ry || r * .82), pts = [], i, a, g, d, p, q, ch, rr;
    n = n || 11;
    for (i = 0; i < n; i++) { a = i / n * Math.PI * 2 + rnd() * .25; g = .9 + rnd() * .22; pts.push([cx + Math.cos(a) * rx * g, cy + Math.sin(a) * ryy * g]); }
    d = 'M' + pt(pts[0]);
    for (i = 0; i < n; i++) { p = pts[i]; q = pts[(i + 1) % n]; ch = Math.hypot(q[0] - p[0], q[1] - p[1]); rr = ch * (.56 + rnd() * .12); d += 'A' + f(rr) + ' ' + f(rr) + ' 0 0 1 ' + pt(q); }
    return d + 'Z';
  }
  function yEn(pts, x) {
    for (var i = 0; i < pts.length - 1; i++) if (x >= pts[i][0] && x <= pts[i + 1][0]) return pts[i][1] + (pts[i + 1][1] - pts[i][1]) * (x - pts[i][0]) / (pts[i + 1][0] - pts[i][0]);
    return pts[pts.length - 1][1];
  }

  /* ---------------- el cielo y lo lejano ---------------- */
  function nubecita(x, y, s) {
    var d = 'M' + f(x - 80 * s) + ' ' + y + 'Q' + f(x - 84 * s) + ' ' + f(y - 26 * s) + ' ' + f(x - 50 * s) + ' ' + f(y - 28 * s) + 'Q' + f(x - 40 * s) + ' ' + f(y - 56 * s) + ' ' + f(x - 6 * s) + ' ' + f(y - 48 * s) +
      'Q' + f(x + 14 * s) + ' ' + f(y - 70 * s) + ' ' + f(x + 42 * s) + ' ' + f(y - 46 * s) + 'Q' + f(x + 84 * s) + ' ' + f(y - 50 * s) + ' ' + f(x + 84 * s) + ' ' + f(y - 16 * s) + 'Q' + f(x + 98 * s) + ' ' + y + ' ' + f(x + 80 * s) + ' ' + y + 'Z';
    return fo('nube', d, 3, 3);
  }
  function capaCielo(uid) {
    var s = '<g class="cp" data-k="2"><rect x="-100" y="-60" width="1400" height="620" style="fill:url(#' + uid + '-c)"/>';
    s += '<g class="nubes-ligeras">' + nubecita(210, 150, 1.05) + nubecita(960, 112, .8) + nubecita(600, 70, .62) + '</g>';
    s += '<g class="nubes-tapa">' + nubecita(120, 190, 2.1) + nubecita(480, 120, 2.6) + nubecita(860, 170, 2.4) + nubecita(1150, 100, 2.2) + '</g>';
    return s + '</g>';
  }
  function capaLejos(rnd) {
    var A = [[-100, 352], [60, 334], [210, 342], [350, 318], [500, 330], [640, 314], [790, 326], [940, 304], [1090, 320], [1300, 308]];
    var B = [[-100, 398], [130, 376], [310, 390], [480, 368], [700, 388], [910, 364], [1110, 386], [1300, 372]];
    var s = '<g class="cp" data-k="5">', i, x, y, t;
    s += fo('lejos', suave(A.concat([[1300, 520], [-100, 520]])), 2, 2);
    // pinos y árboles sueltos en la loma de atrás
    for (i = 0; i < 17; i++) {
      x = -40 + i * 76 + rnd() * 40; y = yEn(A, x) + 7; t = .7 + rnd() * .7;
      s += fi('seto', 'M' + f(x) + ' ' + f(y - 36 * t) + 'L' + f(x - 9 * t) + ' ' + f(y - 14 * t) + 'L' + f(x - 5 * t) + ' ' + f(y - 14 * t) + 'L' + f(x - 13 * t) + ' ' + f(y) + 'L' + f(x + 13 * t) + ' ' + f(y) + 'L' + f(x + 5 * t) + ' ' + f(y - 14 * t) + 'L' + f(x + 9 * t) + ' ' + f(y - 14 * t) + 'Z', '1');
    }
    s += fo('lejos2', suave(B.concat([[1300, 520], [-100, 520]])), 2, 2);
    // la casa blanca de más allá (se ve tras el cerezo y el seto)
    s += fo('pared2', poli([[1050, 424], [1160, 424], [1160, 368], [1050, 368]], .8, rnd), 2, 2) + fo('teja', poli([[1040, 370], [1066, 344], [1146, 344], [1172, 370]], .8, rnd), 2, 2);
    s += fi('cristal', poli([[1066, 384], [1086, 384], [1086, 404], [1066, 404]], .3, rnd), '1') + fi('cristal', poli([[1124, 384], [1144, 384], [1144, 404], [1124, 404]], .3, rnd), '1');
    return s + '</g>';
  }
  function capaSeto(rnd) {
    function seto(x0, x1, top, base) {
      var pts = [], x, i = 0;
      pts.push([x0 - 30, base]);
      for (x = x0; x <= x1; x += 27, i++) pts.push([x, top + (i % 2 ? -7 : 3) + rnd() * 6]);
      pts.push([x1 + 30, base]);
      var d = fo('seto', suave(pts), 2.4, 2), j, ex = '';
      for (j = 0; j < 30; j++) ex += '<ellipse class="k-seto2" cx="' + f(x0 + rnd() * (x1 - x0)) + '" cy="' + f(top + 14 + rnd() * (base - top - 24)) + '" rx="' + f(8 + rnd() * 13) + '" ry="' + f(4 + rnd() * 5) + '"/>';
      for (j = 0; j < 14; j++) { x = x0 + rnd() * (x1 - x0); ex += ln('M' + f(x) + ' ' + f(top + 16 + rnd() * 30) + 'q5 -5 11 -1', 'tx'); }
      return d + ex;
    }
    return '<g class="cp" data-k="9">' + seto(-80, 300, 394, 500) + seto(1010, 1290, 446, 500) + '</g>';
  }

  /* ---------------- la casa ---------------- */
  var PIEDRA = ['piedra1', 'piedra2', 'piedra3', 'piedra1'];
  function capaCasa(rnd, op) {
    var s = '<g class="cp" data-k="13">', i, x, y, d;
    // chimenea (antes que el tejado, que le tapa el pie)
    s += fo('piedra2', poli([[448, 340], [448, 298], [480, 298], [480, 340]], .8, rnd), 2, 2) + fo('piedra3', poli([[444, 298], [444, 291], [484, 291], [484, 298]], .5, rnd), 2, 2);
    // el muro de la casa: crema
    s += fo('pared', poli([[252, 396], [618, 396], [618, 484], [252, 484]], 1.1, rnd), 2.6, 2);
    // zócalo de piedra
    s += '<path class="k-piedrao1" d="M252 458L618 458L618 484L252 484Z"/>' + lote(muro(252, 618, 458, 484, 2, 26, 58, rnd, PIEDRA));
    // el alero y el tejado de pizarra (hacia fuera: sin estrechar)
    s += fo('alero', poli([[226, 396], [644, 396], [644, 405], [226, 405]], .6, rnd), 2, 2);
    s += fo('teja', poli([[226, 396], [276, 330], [594, 330], [644, 396]], 1, rnd), 2.6, 2);
    // pizarras: hiladas con juntas
    var hil = '', jun = '', r, yy, xl, xr, xx;
    for (r = 1; r <= 6; r++) {
      yy = 396 - r * 10.6; xl = 226 + (396 - yy) / 66 * 50; xr = 644 - (396 - yy) / 66 * 50;
      hil += poli([[xl + 1, yy], [xr - 1, yy]], 1, rnd, false);
      for (xx = xl + 8 + rnd() * 14 + (r % 2 ? 12 : 0); xx < xr - 8; xx += 20 + rnd() * 9) jun += 'M' + f(xx) + ' ' + f(yy) + 'L' + f(xx + rnd() * 2 - 1) + ' ' + f(yy + 10.6);
    }
    s += ln(hil, 'tl') + ln(jun, 'tl');
    s += ln('M276 330L594 330', 'tg');
    // puerta de dos hojas con cristales (la de jardin-casa)
    s += fo('madera', poli([[334, 484], [334, 416], [410, 416], [410, 484]], .7, rnd), 2, 2);
    s += fi('cristal', poli([[341, 478], [341, 424], [367, 424], [367, 478]], .3, rnd), '1') + fi('cristal', poli([[377, 478], [377, 424], [403, 424], [403, 478]], .3, rnd), '1');
    s += ln('M354 424L354 478M341 450L367 450M390 424L390 478M377 450L403 450', 'tf');
    // puerta pequeña oscura a la izquierda
    s += fo('madera2', poli([[272, 484], [272, 430], [298, 430], [298, 484]], .6, rnd), 2, 2) + fi('cristal', poli([[278, 444], [292, 444], [292, 462], [278, 462]], .3, rnd), '1');
    // ventana con marco de madera y contraventanas
    s += fo('madera', poli([[486, 470], [486, 420], [552, 420], [552, 470]], .6, rnd), 2, 2);
    s += fi('cristal', poli([[492, 465], [492, 426], [519, 426], [519, 465]], .3, rnd), '1') + fi('cristal', poli([[522, 465], [522, 426], [547, 426], [547, 465]], .3, rnd), '1');
    s += fo('piedra1', poli([[480, 472], [558, 472], [558, 480], [480, 480]], .5, rnd), 1.5, 1.5);
    // ala de la terraza y el porche
    s += '<path class="k-piedrao1" d="M620 376L664 376L664 484L620 484Z"/>' + lote(muro(620, 664, 376, 484, 5, 22, 44, rnd, PIEDRA));
    s += fo('hueco', poli([[664, 396], [842, 396], [842, 484], [664, 484]], .8, rnd), 2, 2);
    s += lote(muro(664, 842, 428, 484, 3, 30, 60, rnd, ['piedrao1', 'piedrao2', 'piedrao3']));
    s += fo('madera2', poli([[664, 396], [842, 396], [842, 428], [664, 428]], .6, rnd), 1.5, 1.5) + ln('M664 410L842 410M700 396L700 428M758 396L758 428M814 396L814 428', 'tx');
    s += fo('madera', poli([[842, 484], [842, 380], [864, 380], [864, 484]], .7, rnd), 2, 2) + fi('madera3', poli([[836, 380], [836, 372], [870, 372], [870, 380]], .4, rnd), '1');
    s += ln('M853 392L853 476', 'tx');
    if (op.aspecto === 'verde') {      // la hamaca azul turquesa del porche (porche-hamaca)
      s += ln('M742 400L738 430M796 400L800 430', 'tg');
      s += fo('hamaca', 'M738 430C732 458 746 484 768 486C790 484 806 458 800 430C788 442 752 442 738 430Z', 1.5, 1.5);
      s += ln('M744 440C760 448 780 448 796 440', 'tx');
    }
    // la terraza: suelo de tablas y barandas granates
    s += fo('madera3', poli([[620, 384], [880, 384], [880, 372], [620, 372]], .6, rnd), 1.5, 1.5) + ln('M620 378L880 378', 'tx');
    for (i = 0; i < 11; i++) { x = 626 + i * 25.4; s += fo('granate', poli([[x - 3, 372], [x - 3, 326], [x + 3, 326], [x + 3, 372]], .4, rnd), 1.3, 1.3); }
    s += fo('granate', poli([[618, 332], [882, 332], [882, 322], [618, 322]], .5, rnd), 1.5, 1.5);
    s += fo('granate', poli([[620, 354], [880, 354], [880, 348], [620, 348]], .5, rnd), 1.3, 1.3);
    return s + '</g>';
  }

  /* ---------------- los árboles ---------------- */
  // rama recursiva: guarda los trazos por profundidad y las puntas
  function rama(rnd, x, y, ang, len, prof, out, o) {
    var a = ang * Math.PI / 180, x2 = x + Math.sin(a) * len, y2 = y - Math.cos(a) * len, bend = (rnd() - .5) * len * .3;
    var cx = (x + x2) / 2 + Math.cos(a) * bend, cy = (y + y2) / 2 + Math.sin(a) * bend, n, k, da;
    out.seg[prof].push('M' + pt([x, y]) + 'Q' + pt([cx, cy]) + ' ' + pt([x2, y2]));
    if (prof >= o.max) { out.tips.push([x2, y2, ang]); return; }
    if (prof >= 3 && rnd() < o.poda) { out.tips.push([x2, y2, ang]); return; }
    n = prof < 1 ? 2 : (rnd() < .3 ? 3 : 2);
    for (k = 0; k < n; k++) {
      da = (k - (n - 1) / 2) * o.abre * (.7 + rnd() * .6) + (rnd() - .5) * 12;
      var na = Math.max(-86, Math.min(86, ang + da + o.sesgo * (rnd() - .3)));
      rama(rnd, x2, y2, na, len * (o.r + rnd() * .12), prof + 1, out, o);
    }
  }
  function ramas(rnd, troncos, o) {
    var out = { seg: [], tips: [] }, i;
    for (i = 0; i <= o.max; i++) out.seg.push([]);
    troncos.forEach(function (t) { rama(rnd, t[0], t[1], t[2], t[3], 0, out, o); });
    return out;
  }
  function dibujaRamas(out, grosores, cls) {
    var tinta = '', color = '', i;
    for (i = 0; i < out.seg.length; i++) {
      if (!out.seg[i].length) continue;
      tinta += '<path class="tr-i" style="stroke-width:' + f(grosores[i] + 2.6) + 'px" d="' + out.seg[i].join('') + '"/>';
      color += '<path class="tr-c" style="stroke-width:' + f(grosores[i]) + 'px" d="' + out.seg[i].join('') + '"/>';
    }
    return tinta + color;
  }
  function corteza(rnd, x, y, h, w) {
    var d = '', i;
    for (i = 0; i < 7; i++) { var yy = y - h * (.1 + i * .12) - rnd() * 8, xx = x + (rnd() - .5) * w * .6; d += 'M' + f(xx) + ' ' + f(yy) + 'q' + f((rnd() - .5) * 4) + ' -9 ' + f((rnd() - .5) * 5) + ' -17'; }
    return ln(d, 'tx');
  }
  function florMagnolia(x, y, s, rot) {
    return '<g transform="translate(' + f(x) + ' ' + f(y) + ') rotate(' + f(rot) + ') scale(' + f(s) + ')"><path class="k-magnolia o1" d="M-7 0C-10 -9-8 -17-3 -22C-1 -17 1 -17 3 -22C8 -17 10 -9 7 0C3 3-3 3-7 0Z"/><path class="tf" d="M0 -2C-2 -9-1 -15 0 -19"/></g>';
  }
  // copa de hojas, flores o fruto: una mancha con su reflejo y unas marcas
  function copa(rnd, cx, cy, r, cls, cls2, marcas, puntos) {
    var s = fo(cls, nube(cx, cy, r, rnd, 11), 2.8, 2.2), j;
    s += '<path class="k-' + cls2 + '" d="' + nube(cx - r * .2, cy - r * .22, r * .56, rnd, 8) + '"/>';
    if (marcas) { var d = ''; for (j = 0; j < marcas; j++) d += 'M' + f(cx + (rnd() - .5) * r * 1.4) + ' ' + f(cy + (rnd() - .35) * r * .9) + 'q4 -6 9 -2'; s += ln(d, 'tx'); }
    if (puntos) { for (j = 0; j < puntos.n; j++) s += '<circle class="k-' + puntos.cls + '" cx="' + f(cx + (rnd() - .5) * r * 1.6) + '" cy="' + f(cy + (rnd() - .4) * r * 1.0) + '" r="' + f(puntos.r * (.8 + rnd() * .5)) + '"/>'; }
    return s;
  }
  function arbustoDib(rnd, x, y, r, c1, c2, desnudo) {
    var s = '', j, d;
    if (desnudo) {
      d = '';
      for (j = 0; j < 12; j++) d += 'M' + f(x + (rnd() - .5) * r * .5) + ' ' + f(y) + 'Q' + f(x + (rnd() - .5) * r * 1.4) + ' ' + f(y - r * (.5 + rnd() * .5)) + ' ' + f(x + (rnd() - .5) * r * 2) + ' ' + f(y - r * (.7 + rnd() * .7));
      return ln(d, 'tr-fino');
    }
    s += fo(c1, nube(x, y - r * .55, r, rnd, 9, r * .72), 2.4, 2);
    s += '<path class="k-' + c2 + '" d="' + nube(x - r * .15, y - r * .7, r * .5, rnd, 7) + '"/>';
    return s;
  }
  function capaArboles(rnd, op, pal) {
    var s = '', asp = op.aspecto, desnudo = asp === 'desnudo', zonas = {}, grupos;
    // --- magnolia: tres troncos junto a la terraza, flor crema sobre ramas desnudas ---
    var mg = ramas(rnd, [[570, 560, -10, 112], [584, 560, 6, 104], [596, 560, 18, 84]], { max: desnudo ? 6 : 5, abre: 31, r: .72, sesgo: 3, poda: .06 });
    var G = [20, 12, 7.2, 4.4, 2.6, 1.6, 1];
    s += '<g class="arbol arbol-mg">';
    s += '<ellipse class="k-sombra suelo-sombra" cx="586" cy="566" rx="120" ry="14"/>';
    s += '<g class="tronco">' + dibujaRamas(mg, G) + corteza(rnd, 583, 560, 100, 18) + '</g>';
    var i, t, n, gr = [[], [], []];
    if (asp === 'flor') {
      for (i = 0; i < mg.tips.length; i++) { t = mg.tips[i]; if (rnd() < .86) gr[i % 3].push(florMagnolia(t[0] + (rnd() - .5) * 12, t[1] + (rnd() - .5) * 10, .85 + rnd() * .6, (rnd() - .5) * 70)); }
      for (i = 0; i < 18; i++) { t = mg.tips[(rnd() * mg.tips.length) | 0]; gr[i % 3].push(florMagnolia(t[0] + (rnd() - .5) * 50, t[1] + 8 + rnd() * 24, .7 + rnd() * .5, (rnd() - .5) * 90)); }
    } else if (asp !== 'desnudo') {
      var den = asp === 'otono' ? (1 - .42 * op.avance) : 1, big;
      for (i = 0; i < mg.tips.length; i++) { t = mg.tips[i]; if (rnd() > den) continue; big = 20 + rnd() * 13; gr[i % 3].push(copa(rnd, t[0], t[1] - 4, big, i % 2 ? 'hoja' : 'hoja2', 'hoja2', asp === 'otono' ? 2 : 3)); }
    }
    for (i = 0; i < 3; i++) s += '<g class="copa copa-' + (i + 1) + '">' + gr[i].join('') + '</g>';
    s += '</g>';
    zonas.mg = bbox(mg.tips, 36);
    // --- cerezo: un solo tronco grande, copa ancha sobre la terraza y las tumbonas ---
    var ce = ramas(rnd, [[930, 570, 6, 100]], { max: desnudo ? 6 : 5, abre: 34, r: .74, sesgo: 5, poda: .1 });
    var G2 = [36, 20, 10.5, 6.2, 3.6, 2.1, 1.2];
    s += '<g class="arbol arbol-ce">';
    s += '<ellipse class="k-sombra suelo-sombra" cx="930" cy="578" rx="230" ry="20"/>';
    s += '<g class="tronco">' + dibujaRamas(ce, G2) + corteza(rnd, 930, 570, 100, 30) + '</g>';
    gr = [[], [], []];
    if (asp === 'flor') {
      for (i = 0; i < ce.tips.length; i++) { t = ce.tips[i]; if (rnd() < .8) gr[i % 3].push(copa(rnd, t[0], t[1] - 2, 26 + rnd() * 16, 'flor', 'flor', 0, { n: 4, cls: 'flor2', r: 3 })); }
    } else if (asp !== 'desnudo') {
      var den2 = asp === 'otono' ? (1 - .5 * op.avance) : 1;
      for (i = 0; i < ce.tips.length; i++) {
        t = ce.tips[i]; if (rnd() > den2 * .88) continue;
        gr[i % 3].push(copa(rnd, t[0], t[1] - 2, 27 + rnd() * 17, i % 3 ? 'hoja' : 'hoja2', i % 2 ? 'hoja2' : 'hoja', asp === 'otono' ? 3 : 4, asp === 'verde' ? { n: 4, cls: 'cereza', r: 3.4 } : null));
      }
      if (asp === 'otono') gr[1].push(copa(rnd, 930, 250, 34, 'hoja3', 'hoja', 3));
    }
    for (i = 0; i < 3; i++) s += '<g class="copa copa-' + (i + 1) + '">' + gr[i].join('') + '</g>';
    s += '</g>';
    zonas.ce = bbox(ce.tips, 44);
    return { svg: '<g class="cp" data-k="22">' + s + '</g>', zonas: zonas };
  }
  function bbox(pts, m) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    pts.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
    return [f(x0 - m), f(y0 - m), f(x1 - x0 + 2 * m), f(y1 - y0 + 2 * m)];
  }

  /* ---------------- el suelo: césped, camino, banco, tumbonas ---------------- */
  function banda(y, rx, ry, cx, rnd) {
    var pts = [], i, a;
    for (i = 0; i < 12; i++) { a = i / 12 * Math.PI * 2; pts.push([cx + Math.cos(a) * rx * (.94 + rnd() * .1), y + Math.sin(a) * ry * (.9 + rnd() * .2)]); }
    return suave(pts);
  }
  function muestra(P, t) {   // punto y normal a lo largo de una polilínea, por longitud
    var L = [], tot = 0, i, d;
    for (i = 0; i < P.length - 1; i++) { d = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]); L.push(d); tot += d; }
    var q = t * tot, a;
    for (i = 0; i < L.length; i++) { if (q <= L[i] || i === L.length - 1) { a = Math.min(1, q / L[i]); var dx = P[i + 1][0] - P[i][0], dy = P[i + 1][1] - P[i][1], l = Math.hypot(dx, dy); return { x: P[i][0] + dx * a, y: P[i][1] + dy * a, nx: -dy / l, ny: dx / l }; } q -= L[i]; }
  }
  function tumbona(x, y, esc, tipo, dir, rnd) {
    // tumbona reclinada vista de lado: asiento bajo, respaldo alto y patas en A
    var P = [[-16, -34], [34, -38], [92, -82]], th = 20, s = '', i, n = 10, a, b, p;
    s += '<g transform="translate(' + x + ' ' + y + ') scale(' + f(esc * dir) + ' ' + esc + ')">';
    s += ln('M-6 0L8 -30M64 0L46 -34M88 0L80 -60', 'tg');
    var izq = [], der = [];
    for (i = 0; i <= 14; i++) { p = muestra(P, i / 14); izq.push([p.x + p.nx * th / 2, p.y + p.ny * th / 2]); der.push([p.x - p.nx * th / 2, p.y - p.ny * th / 2]); }
    var cuerpo = 'M' + izq.map(pt).join('L') + 'L' + der.slice().reverse().map(pt).join('L') + 'Z';
    if (tipo === 'rayas') {
      s += '<path class="k-blanco" d="' + cuerpo + '"/>';
      for (i = 0; i < n; i += 2) {
        a = muestra(P, i / n); b = muestra(P, (i + 1) / n);
        s += '<path class="k-rayas" d="M' + pt([a.x + a.nx * th / 2, a.y + a.ny * th / 2]) + 'L' + pt([b.x + b.nx * th / 2, b.y + b.ny * th / 2]) + 'L' + pt([b.x - b.nx * th / 2, b.y - b.ny * th / 2]) + 'L' + pt([a.x - a.nx * th / 2, a.y - a.ny * th / 2]) + 'Z"/>';
      }
      s += '<path class="t" d="' + cuerpo + '"/>';
    } else {
      s += '<path class="k-gris o" d="' + cuerpo + '"/>';
      p = muestra(P, .92); s += '<path class="k-gris2 o1" d="M' + pt([p.x + p.nx * 11, p.y + p.ny * 11]) + 'L' + pt([p.x - p.nx * 11, p.y - p.ny * 11]) + 'L' + pt([p.x - p.nx * 11 + 16, p.y - p.ny * 11 - 12]) + 'L' + pt([p.x + p.nx * 11 + 16, p.y + p.ny * 11 - 12]) + 'Z"/>';
    }
    return s + '</g>';
  }
  function capaSuelo(rnd, op, pal) {
    var s = '<g class="cp" data-k="18">', asp = op.aspecto, i, x, y, d, t, c;
    // césped y sus bandas de siega
    s += '<path class="k-cesped" d="M-100 484L1300 484L1300 660L-100 660Z"/>';
    s += '<path class="k-cesped2" d="' + banda(528, 520, 22, 260, rnd) + '"/><path class="k-cesped2" d="' + banda(580, 640, 18, 760, rnd) + '"/><path class="k-cesped2" d="' + banda(500, 380, 10, 940, rnd) + '"/>';
    s += '<path class="k-cespeds" d="' + banda(618, 600, 14, 380, rnd) + '"/>';
    // matas de hierba
    d = '';
    for (i = 0; i < 90; i++) { x = -60 + rnd() * 1360; y = 494 + rnd() * 150; d += 'M' + f(x) + ' ' + f(y) + 'l' + f(-3 + rnd()) + ' -6M' + f(x) + ' ' + f(y) + 'l' + f(rnd() * 2) + ' -8M' + f(x) + ' ' + f(y) + 'l' + f(3 + rnd() * 2) + ' -5'; }
    s += ln(d, 'tx');
    // trébol, pétalos o hojas en el suelo
    var sue = '';
    if (asp === 'flor' || asp === 'verde') for (i = 0; i < 46; i++) sue += '<circle class="k-flor" cx="' + f(rnd() * 1260 - 30) + '" cy="' + f(500 + rnd() * 130) + '" r="' + f(1.6 + rnd() * 1.6) + '"/>';
    if (asp === 'flor') for (i = 0; i < 46; i++) { x = (i % 2 ? 590 : 900) + (rnd() - .5) * (i % 2 ? 260 : 470); sue += '<ellipse class="k-suelo" cx="' + f(x) + '" cy="' + f(526 + rnd() * 84) + '" rx="' + f(3 + rnd() * 2.4) + '" ry="' + f(1.8 + rnd() * 1.2) + '" transform="rotate(' + f(rnd() * 180) + ' ' + f(x) + ' 560)"/>'; }
    if (asp === 'otono') for (i = 0; i < 70; i++) {
      x = (i % 3 ? 900 : 590) + (rnd() - .5) * (i % 3 ? 560 : 300); c = ['hoja', 'hoja2', 'hoja3'][(rnd() * 3) | 0];
      sue += '<ellipse class="k-' + c + '" cx="' + f(x) + '" cy="' + f(520 + rnd() * 98) + '" rx="' + f(4 + rnd() * 3) + '" ry="' + f(2.2 + rnd() * 1.4) + '" transform="rotate(' + f(rnd() * 180) + ' ' + f(x) + ' 560)"/>';
    }
    s += '<g class="suelo-cosas">' + sue + '</g>';
    // el camino de losas de pizarra: de la puerta hacia nosotros
    var C = [[372, 494], [396, 530], [440, 560], [500, 590]];
    for (i = 0; i < 9; i++) {
      t = i / 8; var q = muestra(C, t), w = 24 + t * 38, h = 12 + t * 15, jx = function () { return (rnd() - .5) * 5; };
      d = suave([[q.x - w + jx(), q.y - h * .4 + jx()], [q.x - w * .1 + jx(), q.y - h + jx()], [q.x + w + jx(), q.y - h * .5 + jx()], [q.x + w * .9 + jx(), q.y + h * .5 + jx()], [q.x + w * .1 + jx(), q.y + h + jx()], [q.x - w + jx(), q.y + h * .4 + jx()]]);
      s += fi(i % 3 ? 'losa' : 'losa2', d, '1');
    }
    // el banco de madera (jardin-casa), con patas de tronco
    s += fo('madera', poli([[8, 542], [186, 532], [190, 546], [10, 558]], .8, rnd), 2, 2);
    s += ln('M12 550L186 540', 'tx');
    s += fo('madera3', poli([[40, 556], [40, 588], [58, 588], [58, 556]], .5, rnd), 1.5, 1.5) + fo('madera3', poli([[138, 550], [138, 582], [156, 582], [156, 550]], .5, rnd), 1.5, 1.5);
    // arbustos de la izquierda: rododendro y copo de nieve (jardin-casa)
    s += arbustoDib(rnd, 258, 534, 54, 'arb1', 'arb1', asp === 'desnudo') + arbustoDib(rnd, 340, 538, 46, 'arb2', 'arb2', asp === 'desnudo');
    if (asp === 'flor' || asp === 'verde') { for (i = 0; i < 14; i++) s += '<circle class="k-' + (i % 2 ? 'arb1' : 'arb2') + '" cx="' + f(228 + rnd() * 140) + '" cy="' + f(482 + rnd() * 50) + '" r="' + f(2.4 + rnd()) + '"/>'; }
    // matas verdes al pie del porche
    if (asp !== 'desnudo') { s += arbustoDib(rnd, 690, 520, 30, 'hoja3', 'hoja', false) + arbustoDib(rnd, 800, 522, 28, 'hoja3', 'hoja', false) + arbustoDib(rnd, 868, 524, 32, 'hoja3', 'hoja', false); }
    else s += arbustoDib(rnd, 700, 520, 34, 'hoja3', 'hoja', true) + arbustoDib(rnd, 830, 522, 32, 'hoja3', 'hoja', true);
    // tumbonas: dos de rayas verdes y una gris (jardin-tumbonas, ACS-05)
    s += tumbona(1060, 586, 1.15, 'rayas', -1, rnd) + tumbona(700, 580, 1.15, 'rayas', 1, rnd) + tumbona(1170, 574, 1.05, 'gris', -1, rnd);
    return s + '</g>';
  }
  function capaMoteada(rnd) {
    var s = '<g class="cp" data-k="18"><g class="moteada"><g class="sombras">', i, x, y;
    for (i = 0; i < 26; i++) { x = -120 + rnd() * 1500; y = 500 + rnd() * 125; s += '<ellipse class="k-sombra mota" cx="' + f(x) + '" cy="' + f(y) + '" rx="' + f(28 + rnd() * 52) + '" ry="' + f(7 + rnd() * 11) + '"/>'; }
    s += '</g><g class="solpatch">';
    for (i = 0; i < 16; i++) { x = -120 + rnd() * 1500; y = 495 + rnd() * 130; s += '<ellipse class="k-sol" cx="' + f(x) + '" cy="' + f(y) + '" rx="' + f(36 + rnd() * 70) + '" ry="' + f(9 + rnd() * 13) + '"/>'; }
    return s + '</g></g></g>';
  }

  /* ---------------- la cerca de palos de castaño sobre el muro de pizarra ---------------- */
  function trozo(x1, x2, y, th, rnd) {
    var d = suave([[x1 - 4, y - th * .1], [(x1 + x2) / 2, y - th * .6 + (rnd() - .5) * 3], [x2 + 4, y - th * .1], [x2 + 4, y + th * .6], [(x1 + x2) / 2, y + th * .5 + (rnd() - .5) * 3], [x1 - 4, y + th * .6]]);
    return fo('madera', d, 1.8, 1.8) + ln('M' + f(x1 + 6) + ' ' + f(y - th * .12) + 'L' + f(x2 - 6) + ' ' + f(y - th * .12), 'tx') + '<ellipse class="k-madera3 o1" cx="' + f(x2 + 2) + '" cy="' + f(y + th * .2) + '" rx="3.4" ry="' + f(th * .46) + '"/>';
  }
  function capaFrente(rnd, op) {
    var s = '<g class="cp" data-k="32">', i, x, xs = [];
    for (i = 0; i < 9; i++) xs.push(-70 + i * 172 + (rnd() - .5) * 16);
    // postes
    xs.forEach(function (px) { var lean = (rnd() - .5) * 3; s += fo('madera', suave([[px - 9 + lean, 560], [px + lean, 555], [px + 9 + lean, 560], [px + 9, 644], [px - 9, 644]]), 2, 2) + '<ellipse class="k-madera3 o1" cx="' + f(px + lean) + '" cy="560" rx="8" ry="3"/>'; });
    // dos travesaños de palo
    for (i = 0; i < xs.length - 1; i++) { s += trozo(xs[i] + 4, xs[i + 1] - 4, 590 + (rnd() - .5) * 2, 14, rnd) + trozo(xs[i] + 4, xs[i + 1] - 4, 621 + (rnd() - .5) * 2, 14, rnd); }
    // el gato (dentro de un recorte: al irse baja tras el muro)
    s += '<g clip-path="url(#' + op.uid + '-g)"><g transform="translate(868 640)"><g class="gato"><g transform="scale(1.2)">' +
      '<path class="t" style="stroke-width:9px" d="M-16 -4C-34 -4-44 -16-40 -30C-38 -38-30 -38-30 -30"/><path d="M-16 -4C-34 -4-44 -16-40 -30C-38 -38-30 -38-30 -30" style="fill:none;stroke:var(--c-gato);stroke-width:5.6px;stroke-linecap:round"/>' +
      '<path class="k-gato o" d="M-20 0C-27 -18-21 -35-6 -41C6 -45 17 -37 19 -22C21 -12 18 -4 21 0Z"/>' +
      '<path class="k-gato o" d="M-3 -61L-2 -76L9 -66M13 -66L22 -76L23 -60"/>' +
      '<ellipse class="k-gato o" cx="10" cy="-52" rx="14" ry="12.5"/>' +
      '<circle cx="5" cy="-53" r="1.5" fill="#412B21"/><circle cx="15" cy="-53" r="1.5" fill="#412B21"/><path class="tf" d="M8 -47Q10 -45 12 -47"/>' +
      '</g></g></g></g>';
    // el muro de pizarra, piedra a piedra
    s += '<path class="k-mortero" d="M-100 640L1300 640L1300 720L-100 720Z"/>';
    s += lote(muro(-100, 1300, 640, 706, 3, 52, 118, rnd, ['wp1', 'wp2', 'wp3', 'wp4', 'wp2']));
    s += ln('M-100 640L1300 640', 'tg');
    // el cartelito de «fuera de temporada» cuelga del travesaño de arriba, por delante del muro
    if (op.abierto === false) {
      var cx = 566;
      s += ln('M' + (cx - 66) + ' 598L' + (cx - 66) + ' 620M' + (cx + 66) + ' 598L' + (cx + 66) + ' 620', 'tg');
      s += fo('papel', poli([[cx - 98, 616], [cx + 98, 616], [cx + 98, 688], [cx - 98, 688]], 1, rnd), 3, 3);
      s += '<text class="jd-cartel-t1" x="' + cx + '" y="650" text-anchor="middle">Volvemos</text><text class="jd-cartel-t2" x="' + cx + '" y="676" text-anchor="middle">el ' + TEMPORADA.textoAbre + '</text>';
    }
    return s + '</g>';
  }

  /* ---------------- la lámina entera ---------------- */
  function lamina(op) {
    op = op || {};
    var sit = op.situacion || situacion(fechaDe(op)), uid = op.uid || 'jd', pal = paleta(sit, op.clima || null);
    var o = { aspecto: sit.aspecto, abierto: sit.abierto, avance: sit.avance, uid: uid };
    var rnd = mulberry(20161024);
    var cielo = capaCielo(uid), lejos = capaLejos(rnd), seto = capaSeto(rnd), casa = capaCasa(rnd, o), suelo = capaSuelo(rnd, o, pal), mota = capaMoteada(rnd);
    var arb = capaArboles(rnd, o, pal), frente = capaFrente(rnd, o);
    var zonas = arb.zonas;
    var svg = '<svg class="jd-lamina" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false" style="' + varsEstilo(pal) + '">' +
      '<defs><linearGradient id="' + uid + '-c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--c-cielo-a)"/><stop offset="1" style="stop-color:var(--c-cielo-b)"/></linearGradient>' +
      '<clipPath id="' + uid + '-g"><rect x="-120" y="-120" width="1440" height="760"/></clipPath></defs>' +
      cielo + lejos + seto + casa + suelo + mota + arb.svg + frente +
      '<g class="zonas"><rect class="zona zona-mg" x="' + zonas.mg[0] + '" y="' + zonas.mg[1] + '" width="' + zonas.mg[2] + '" height="' + zonas.mg[3] + '"/><rect class="zona zona-ce" x="' + zonas.ce[0] + '" y="' + zonas.ce[1] + '" width="' + zonas.ce[2] + '" height="' + zonas.ce[3] + '"/></g></svg>';
    return { svg: svg, zonas: zonas, situacion: sit, paleta: pal };
  }

  /* ================================================================
     TEXTOS: lo que se lee, verdadero y en un solo sitio
     ================================================================ */
  function textoEscena(sit) {
    if (sit.aspecto === 'flor') return sit.abierto ? 'Primavera: la magnolia y el cerezo, en flor.' : 'La magnolia y el cerezo ya están en flor.';
    if (sit.aspecto === 'verde') return sit.estacion === 'primavera' ? 'Final de primavera: el jardín ya está verde.' : 'Verano: sombra de cerezo, las tumbonas y la hamaca del porche.';
    if (sit.aspecto === 'otono') return sit.avance < .5 ? 'Otoño: las hojas empiezan a dorarse.' : 'Otoño: el jardín se llena de hojas ocres.';
    return sit.estacion === 'otono' ? 'Otoño tardío: las ramas ya están peladas.' : 'Invierno: el jardín, con las ramas desnudas.';
  }
  function textoTemporada(sit) {
    if (sit.abierto) return 'Temporada: del ' + TEMPORADA.textoAbre + ' al ' + TEMPORADA.textoCierra + (TEMPORADA.porConfirmar ? ' (por confirmar)' : '') + '.';
    return 'Albergue cerrado: volvemos el ' + TEMPORADA.textoAbre + (TEMPORADA.porConfirmar ? ' (fecha por confirmar)' : '') + '.';
  }
  var COD = { 0: 'cielo despejado', 1: 'cielo casi despejado', 2: 'nubes y claros', 3: 'cielo cubierto', 45: 'niebla', 48: 'niebla', 51: 'llovizna', 53: 'llovizna', 55: 'llovizna', 56: 'llovizna', 57: 'llovizna',
    61: 'llueve', 63: 'llueve', 65: 'llueve', 66: 'llueve', 67: 'llueve', 71: 'nieva', 73: 'nieva', 75: 'nieva', 77: 'nieva', 80: 'chubascos', 81: 'chubascos', 82: 'chubascos',
    85: 'nieva a ratos', 86: 'nieva a ratos', 95: 'tormenta', 96: 'tormenta', 99: 'tormenta' };
  // lo que Sanchez.tiempo() trae → { clima: 'lluvia'|'nubes'|'sol'|null, viento: bool, nieva: bool, descr, temp }
  // (con fuente 'supuesto' o sin datos devuelve null: no se pinta ni se escribe nada)
  function clasifica(t) {
    if (!t || t.fuente === 'supuesto') return null;
    var cod = +t.codigo, mm = typeof t.lluvia === 'number' ? t.lluvia : (t.lluvia ? 1 : 0);
    var nub = typeof t.nubes === 'number' ? (t.nubes <= 1 ? t.nubes * 100 : t.nubes) : (t.nubes ? 80 : null);
    var llueve = mm > 0 || (cod >= 51 && cod <= 67) || (cod >= 80 && cod <= 82) || cod >= 95;
    var nieva = t.nieve === true || (cod >= 71 && cod <= 77) || cod === 85 || cod === 86;
    var dia = t.esDeDia !== false, clima = null;
    if (llueve) clima = 'lluvia';
    else if (nieva || cod === 3 || cod === 45 || cod === 48 || (nub != null && nub >= 65)) clima = 'nubes';
    else if (dia && (cod === 0 || cod === 1 || (isNaN(cod) && nub != null && nub < 40))) clima = 'sol';
    var descr = COD[cod] || (clima === 'lluvia' ? 'llueve' : (clima === 'nubes' ? 'cielo cubierto' : (clima === 'sol' ? 'cielo despejado' : '')));
    return { clima: clima, viento: +t.viento >= 28, nieva: nieva, descr: descr, temp: +t.temp };
  }
  // reglas simples que cruzan tiempo y servicio (ACS: lavadora, secadora, lavadero y tendedero). Solo con el albergue abierto.
  function consejo(k) {
    if (k.clima === 'lluvia' || k.nieva) return 'Hay secadora (' + PRECIOS.secado + ' €).';
    if (k.viento) return 'Con este viento, la ropa se seca pronto en el tendedero.';
    if (k.clima === 'nubes') return 'Si la ropa no se seca fuera, hay secadora (' + PRECIOS.secado + ' €).';
    if (k.clima === 'sol' && k.temp >= 14) return 'Buen día para tender la ropa: hay tendedero.';
    return '';
  }
  function textoTiempo(k, sit) {
    var t = isFinite(k.temp) ? Math.round(k.temp) + ' °C' : '', d = k.descr;
    var s = 'Ahora en Grandas: ' + (t && d ? t + ' y ' + d : (t || d.charAt(0).toUpperCase() + d.slice(1))) + '.';
    if (sit.abierto) { var c = consejo(k); if (c) s += ' ' + c; }
    return s;
  }

  /* ================================================================
     MONTAJE (solo navegador)
     ================================================================ */
  var contador = 0;
  // de dónde salen las fotos por nombre (por defecto, ../img/fotos/ respecto a este script)
  var FOTOS = 'img/fotos/';
  try { if (document.currentScript && document.currentScript.src) FOTOS = new URL('../img/fotos/', document.currentScript.src).href; } catch (e) {}
  function param(n) { try { return new URLSearchParams(location.search).get(n); } catch (e) { return null; } }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var NADA = { destruir: function () {}, estado: function () { return {}; } };

  function montar(el, op) {
    op = op || {};
    if (!el) return NADA;
    if (el.__jardin) el.__jardin.destruir();
    var reduce = false, tactil = false;
    try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    try { tactil = matchMedia('(pointer: coarse)').matches; } catch (e) {}
    var sobria = op.densidad === 'sobria' || document.documentElement.classList.contains('densidad-sobria');
    var movimiento = op.movimiento !== false && !reduce && !sobria;
    var movil = tactil || innerWidth < 700;
    var CAP = movil ? 30 : 60, CAP_LLUVIA = movil ? 45 : 90;

    var fecha = fechaDe({ fecha: op.fecha || param('fecha') });
    var sit = situacion(fecha);
    var uid = 'jd' + (++contador);
    var rnd = Math.random;
    var vivo = true;
    var particulas = movimiento && (sit.aspecto === 'flor' || sit.aspecto === 'otono');

    // el respaldo de la web se aparta (y vuelve con destruir())
    var respaldo = document.createElement('div');
    respaldo.className = 'jd-respaldo'; respaldo.hidden = true;
    var original = Array.prototype.slice.call(el.childNodes);
    var hayFoto = !!el.querySelector('img');
    var raiz = null;
    function restaurar() { original.forEach(function (n) { el.appendChild(n); }); if (respaldo.parentNode) respaldo.parentNode.removeChild(respaldo); }
    try {
      var L = lamina({ situacion: sit, uid: uid });
      raiz = document.createElement('figure');
      raiz.className = 'jd';
      raiz.dataset.estacion = sit.estacion; raiz.dataset.aspecto = sit.aspecto; raiz.dataset.abierto = sit.abierto ? 'si' : 'no';
      raiz.dataset.tiempo = 'ninguno'; raiz.dataset.viento = '0'; raiz.dataset.movimiento = movimiento ? 'si' : 'no'; raiz.dataset.visible = 'si';
      raiz.innerHTML =
        '<div class="jd-marco"><div class="jd-escena">' + L.svg + '</div><canvas class="jd-canvas" aria-hidden="true"></canvas><div class="jd-foto" aria-hidden="true"></div></div>' +
        '<figcaption class="jd-pie"><p class="jd-escena-txt">' + esc(textoEscena(sit)) + '</p><p class="jd-temporada">' + esc(textoTemporada(sit)) + '</p>' +
        '<p class="jd-tiempo" hidden></p>' +
        '<p class="jd-acciones">' + (particulas ? '<button type="button" class="jd-btn jd-sacudir">Sacudir los árboles</button>' : '') +
        (hayFoto ? '<button type="button" class="jd-btn jd-ver-foto" aria-pressed="false">Ver la foto de verdad</button>' : '') + '</p>' +
        '<p class="jd-nota">Dibujo hecho a partir de las fotos de la casa.</p></figcaption>';
      original.forEach(function (n) { respaldo.appendChild(n); });
      el.appendChild(respaldo); el.appendChild(raiz);
      el.dataset.montado = '1';
    } catch (e) {
      try { console.warn('jardin: sin lámina, se queda el respaldo', e); } catch (e2) {}
      restaurar(); delete el.dataset.montado;
      return NADA;
    }

    var marco = raiz.querySelector('.jd-marco'), svg = raiz.querySelector('svg'), cv = raiz.querySelector('.jd-canvas'), ctx = cv.getContext && cv.getContext('2d');
    var gato = svg.querySelector('.gato'), capas = [].slice.call(svg.querySelectorAll('.cp')).map(function (g) { return { g: g, k: +g.getAttribute('data-k') || 0 }; });
    var zonas = { mg: svg.querySelector('.zona-mg'), ce: svg.querySelector('.zona-ce') };
    var clima = null, k = null, visible = true, raf = 0, last = 0, escucha = [], timers = [];
    var par = { x: 0, y: 0, tx: 0, ty: 0 }, parts = [], gotas = [], dim = { w: 0, h: 0, s: 1, ox: 0, oy: 0, dpr: 1 }, acu = 0, acuL = 0;
    var COLORES_OTONO = ['#C7852F', '#DDA743', '#A5532A', '#B4662B', '#8E6A2A'];
    var COLORES_FLOR = ['#FBF5E8', '#FBF5E8', '#F0CBD2', '#F3E8B9'];

    function on(t, ev, fn, o) { t.addEventListener(ev, fn, o); escucha.push([t, ev, fn, o]); }
    function tm(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }

    /* --- canvas: de unidades del dibujo a píxeles del marco --- */
    function dimensiona() {
      if (!ctx) return;
      var r = marco.getBoundingClientRect(); if (!r.width) return;
      dim.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      dim.w = r.width; dim.h = r.height; dim.s = Math.max(dim.w / W, dim.h / H); dim.ox = (dim.w - W * dim.s) / 2; dim.oy = dim.h - H * dim.s;
      cv.width = Math.round(dim.w * dim.dpr); cv.height = Math.round(dim.h * dim.dpr);
      ctx.setTransform(dim.dpr, 0, 0, dim.dpr, 0, 0);
    }
    function aPx(x, y) { return [dim.ox + (x - par.x * 22) * dim.s, dim.oy + (y - par.y * 22 * .35) * dim.s]; }

    /* --- pétalos y hojas --- */
    function nuevaParticula(x, y, rafaga) {
      var flor = sit.aspecto === 'flor', p = aPx(x, y), v = k && k.viento ? 1 : 0, cols = flor ? COLORES_FLOR : COLORES_OTONO;
      parts.push({ x: p[0], y: p[1], vx: (rnd() - .35) * 16 + (v ? 55 + rnd() * 50 : 0) + (rafaga ? (rnd() - .5) * 60 : 0), vy: (flor ? 26 : 34) + rnd() * 30 + (rafaga ? rnd() * 20 : 0),
        r: (flor ? 3.6 : 6.2) * (.75 + rnd() * .6) * Math.max(.6, dim.s), rot: rnd() * 6.28, vr: (rnd() - .5) * 3.2, fase: rnd() * 6.28, f: 1.2 + rnd() * 1.6, amp: (flor ? 14 : 22) * (.6 + rnd() * .8),
        suelo: dim.oy + (520 + rnd() * 90) * dim.s, a: 1, col: cols[(rnd() * cols.length) | 0], flor: flor, t: 0 });
    }
    function brota(zona, rafaga) {
      var z = zonas[zona], b = z ? [+z.getAttribute('x'), +z.getAttribute('y'), +z.getAttribute('width'), +z.getAttribute('height')] : [36, 70, 330, 300];
      nuevaParticula(b[0] + rnd() * b[2], b[1] + b[3] * (.15 + rnd() * .6), rafaga);
    }
    function sacude(zona) {
      if (!movimiento || !vivo) return;
      var g = svg.querySelector('.arbol-' + zona);
      if (g && g.animate) g.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(1.5deg)' }, { transform: 'rotate(-1.2deg)' }, { transform: 'rotate(.6deg)' }, { transform: 'rotate(0deg)' }], { duration: 900, easing: 'ease-out' });
      if (!particulas) return;
      var n = 9 + ((rnd() * 5) | 0), i;
      for (i = 0; i < n && parts.length < CAP + 14; i++) brota(zona, true);
      pide();
    }

    /* --- el bucle: solo si hay algo que mover y se está viendo --- */
    function activo() { return movimiento && visible && !document.hidden && vivo; }
    function necesita() { return particulas || clima === 'lluvia' || parts.length || gotas.length || Math.abs(par.tx - par.x) > .002 || Math.abs(par.ty - par.y) > .002; }
    function pide() { if (!raf && activo() && necesita()) { last = performance.now(); raf = requestAnimationFrame(tick); } }
    function para() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
    function tick(t) {
      raf = 0;
      if (!activo()) return;
      var dt = Math.min(.05, (t - last) / 1000); last = t; if (dt <= 0) dt = .016;
      var mx = par.tx - par.x, my = par.ty - par.y;
      if (Math.abs(mx) > .002 || Math.abs(my) > .002) {
        par.x += mx * Math.min(1, dt * 5); par.y += my * Math.min(1, dt * 5);
        capas.forEach(function (c) { c.g.setAttribute('transform', 'translate(' + f(-par.x * c.k) + ' ' + f(-par.y * c.k * .35) + ')'); });
      }
      if (particulas) {
        acu += dt * (movil ? 1.8 : 3.4) * (k && k.viento ? 1.6 : 1);
        while (acu >= 1) { acu -= 1; if (parts.length < CAP) brota(rnd() < .55 ? 'ce' : 'mg', false); }
      }
      var i, p, g;
      for (i = parts.length - 1; i >= 0; i--) {
        p = parts[i]; p.t += dt; p.y += p.vy * dt; p.x += (p.vx + Math.sin(p.t * p.f + p.fase) * p.amp) * dt; p.rot += p.vr * dt;
        if (p.y >= p.suelo) { p.a -= dt * 2.2; p.vy = 0; p.vx *= .9; if (p.a <= 0) parts.splice(i, 1); }
      }
      if (clima === 'lluvia') {
        acuL += dt * CAP_LLUVIA * 2.2;
        while (acuL >= 1) { acuL -= 1; if (gotas.length < CAP_LLUVIA) gotas.push({ x: rnd() * (dim.w + 80) - 40, y: -10 - rnd() * 30, v: (520 + rnd() * 220) * Math.max(.6, dim.s), l: (10 + rnd() * 10) * Math.max(.6, dim.s), fin: dim.oy + (500 + rnd() * 110) * dim.s }); }
        var dx = k && k.viento ? .28 : .1;
        for (i = gotas.length - 1; i >= 0; i--) { g = gotas[i]; g.y += g.v * dt; g.x += g.v * dx * dt; if (g.y >= g.fin) gotas.splice(i, 1); }
      } else if (gotas.length) gotas.length = 0;
      pinta();
      if (necesita()) raf = requestAnimationFrame(tick);
    }
    function pinta() {
      if (!ctx) return;
      ctx.clearRect(0, 0, dim.w, dim.h);
      var i, p, g;
      for (i = 0; i < parts.length; i++) {
        p = parts[i]; ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, p.a)); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.ellipse(0, 0, p.r * (p.flor ? 1.15 : 1.5), p.r * (p.flor ? .75 : .8), 0, 0, 6.2832); ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(65,43,33,.55)'; ctx.stroke();
        ctx.restore();
      }
      if (gotas.length) {
        var dx = k && k.viento ? .28 : .1;
        ctx.save(); ctx.strokeStyle = 'rgba(52,75,92,.55)'; ctx.lineWidth = 1.2; ctx.lineCap = 'round'; ctx.beginPath();
        for (i = 0; i < gotas.length; i++) { g = gotas[i]; ctx.moveTo(g.x, g.y); ctx.lineTo(g.x - g.l * dx, g.y - g.l); }
        ctx.stroke(); ctx.restore();
      }
    }

    /* --- el gato del muro: sale a veces y se va si lo tocas --- */
    var gatoSale = false, gatoPrimera = true;
    function gatoCiclo() {
      if (!movimiento || !gato || !visible || !vivo || clima === 'lluvia' || sit.aspecto === 'desnudo') return;
      var espera = gatoPrimera ? (op.gatoInicio != null ? op.gatoInicio : 5000 + rnd() * 4000) : 24000 + rnd() * 26000;
      gatoPrimera = false;
      tm(function () {
        if (!visible || !vivo) { gatoPrimera = true; return; }
        gato.classList.add('ve'); gatoSale = true;
        tm(gatoVete, 8000 + rnd() * 5000);
      }, espera);
    }
    function gatoVete() {
      if (!gatoSale) return;
      gato.classList.remove('ve'); gatoSale = false;
      tm(gatoCiclo, 900);
    }
    function paraTimers() { timers.forEach(clearTimeout); timers.length = 0; }

    /* --- el tiempo de ahora (la web lo trae; con 'supuesto' no se pinta nada) --- */
    function aplicaTiempo(t) {
      if (!vivo) return;
      var kk = clasifica(t), linea = raiz.querySelector('.jd-tiempo'), pal = paleta(sit, kk ? kk.clima : null), key;
      k = kk; clima = kk ? kk.clima : null;
      raiz.dataset.tiempo = clima || (kk ? 'neutro' : 'ninguno');
      raiz.dataset.viento = kk && kk.viento ? '1' : '0';
      for (key in VARS) svg.style.setProperty(VARS[key], pal[key]);
      if (!kk) { linea.hidden = true; linea.textContent = ''; return; }
      linea.textContent = textoTiempo(kk, sit); linea.hidden = false;
      if (clima === 'lluvia') { paraTimers(); if (gatoSale) { gato.classList.remove('ve'); gatoSale = false; } }
      pide();
    }
    try {
      var pT = op.tiempo != null ? op.tiempo : (window.Sanchez && typeof window.Sanchez.tiempo === 'function' ? window.Sanchez.tiempo() : null);
      Promise.resolve(pT).then(aplicaTiempo, function () {});
    } catch (e) {}

    /* --- gestos: paralaje, sacudir el árbol, espantar al gato --- */
    if (movimiento) {
      on(marco, 'pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        var r = marco.getBoundingClientRect();
        par.tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - .5) * 2)); par.ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - .5) * 2));
        pide();
      });
      on(marco, 'pointerleave', function () { par.tx = 0; par.ty = 0; pide(); });
      if (tactil) on(window, 'deviceorientation', function (e) {
        if (!visible || e.gamma == null) return;
        var tx = Math.max(-1, Math.min(1, e.gamma / 25)), ty = Math.max(-1, Math.min(1, ((e.beta || 45) - 45) / 30));
        if (Math.abs(tx - par.tx) < .04 && Math.abs(ty - par.ty) < .04) return;
        par.tx = tx; par.ty = ty; pide();
      }, { passive: true });
      ['mg', 'ce'].forEach(function (z) {
        var zn = zonas[z], ult = 0, lx = null, ly = null;
        if (!zn) return;
        on(zn, 'pointermove', function (e) {
          var ahora = performance.now(), d = lx == null ? 99 : Math.hypot(e.clientX - lx, e.clientY - ly); lx = e.clientX; ly = e.clientY;
          if (d < 14 || ahora - ult < 350) return; ult = ahora; sacude(z);
        });
        on(zn, 'pointerdown', function () { var ahora = performance.now(); if (ahora - ult < 350) return; ult = ahora; sacude(z); });
        on(zn, 'pointerleave', function () { lx = null; });
      });
      if (gato) on(gato, 'pointerdown', function () { gatoVete(); });
    }
    var bSac = raiz.querySelector('.jd-sacudir');
    if (bSac) on(bSac, 'click', function () { sacude('mg'); sacude('ce'); });
    // la foto real: la del respaldo de la web (ya con su srcset) o, si aún no la ha rellenado, por nombre (img/fotos/<nombre>-<ancho>.jpg|webp|avif)
    function creaFoto() {
      var im = respaldo.querySelector('img'), c, nombre;
      if (!im) return null;
      if (im.getAttribute('src') || im.getAttribute('srcset')) {
        c = (im.closest && im.closest('picture')) || im; c = c.cloneNode(true);
        var ii = c.tagName === 'IMG' ? c : c.querySelector('img'); ii.removeAttribute('width'); ii.removeAttribute('height'); ii.removeAttribute('loading'); ii.removeAttribute('sizes'); ii.sizes = '100vw';
        return c;
      }
      nombre = im.getAttribute('data-foto'); if (!nombre) return null;
      c = document.createElement('picture');
      c.innerHTML = ['avif', 'webp'].map(function (e) { return '<source type="image/' + e + '" srcset="' + FOTOS + nombre + '-480.' + e + ' 480w, ' + FOTOS + nombre + '-800.' + e + ' 800w, ' + FOTOS + nombre + '-900.' + e + ' 900w" sizes="100vw">'; }).join('') +
        '<img src="' + FOTOS + nombre + '-900.jpg" alt="' + esc(im.getAttribute('alt') || '') + '" decoding="async">';
      return c;
    }
    var bFoto = raiz.querySelector('.jd-ver-foto'), capaFoto = raiz.querySelector('.jd-foto');
    if (bFoto) on(bFoto, 'click', function () {
      var ver = !raiz.classList.contains('ver-foto');
      if (ver && !capaFoto.firstChild) { var fc = creaFoto(); if (fc) capaFoto.appendChild(fc); }
      raiz.classList.toggle('ver-foto', ver); bFoto.setAttribute('aria-pressed', ver ? 'true' : 'false'); capaFoto.setAttribute('aria-hidden', ver ? 'false' : 'true');
      bFoto.textContent = ver ? 'Volver al dibujo' : 'Ver la foto de verdad';
    });

    /* --- nada se mueve fuera de pantalla ni con la pestaña oculta --- */
    var io = null, ro = null, anchoAnt = 0;
    function visibilidad(v) {
      visible = v; raiz.dataset.visible = v ? 'si' : 'no';
      if (v) { dimensiona(); pide(); if (!timers.length) gatoCiclo(); }
      else { para(); paraTimers(); gatoPrimera = true; if (gatoSale && gato) { gato.classList.remove('ve'); gatoSale = false; } }
    }
    if (window.IntersectionObserver) { io = new IntersectionObserver(function (es) { visibilidad(es[es.length - 1].isIntersecting); }, { rootMargin: '60px' }); io.observe(marco); }
    on(document, 'visibilitychange', function () { if (document.hidden) para(); else pide(); });
    if (window.ResizeObserver) {   // solo el ancho: el resize de la barra del móvil no rehace nada
      ro = new ResizeObserver(function () { var w = marco.clientWidth; if (Math.abs(w - anchoAnt) < 1) return; anchoAnt = w; dimensiona(); });
      ro.observe(marco);
    }
    dimensiona();

    var api = {
      destruir: function () {
        if (!vivo) return; vivo = false; para(); paraTimers();
        escucha.forEach(function (e) { e[0].removeEventListener(e[1], e[2], e[3]); });
        if (io) io.disconnect(); if (ro) ro.disconnect();
        var sigueAqui = raiz.parentNode === el;   // si la web ya cambió el contenido de `el`, no se le devuelve nada
        if (raiz.parentNode) raiz.parentNode.removeChild(raiz);
        if (sigueAqui) { restaurar(); delete el.dataset.montado; }
        delete el.__jardin;
      },
      estado: function () {
        return { estacion: sit.estacion, aspecto: sit.aspecto, abierto: sit.abierto, clima: clima, viento: !!(k && k.viento), particulas: parts.length, gotas: gotas.length, cap: CAP, capLluvia: CAP_LLUVIA,
          raf: !!raf, visible: visible, movimiento: movimiento, gato: gatoSale, paralaje: [par.x, par.y] };
      }
    };
    el.__jardin = api;
    return api;
  }

  var API = { lamina: lamina, situacion: situacion, paleta: paleta, varsEstilo: varsEstilo, fechaDe: fechaDe, clasifica: clasifica, textoTiempo: textoTiempo, textoEscena: textoEscena, textoTemporada: textoTemporada, TEMPORADA: TEMPORADA, PRECIOS: PRECIOS, W: W, H: H };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window === 'undefined') return;
  window.Sanchez = window.Sanchez || {};
  window.Sanchez.jardin = { montar: montar, _dibujo: API };
})();
