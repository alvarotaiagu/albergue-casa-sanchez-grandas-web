/* ------------------------------------------------------------------
   Albergue Casa Sánchez · módulo «La etapa» (agente Ruta)

   El corte del terreno de la etapa Berducedo → Grandas de Salime, como el de
   una guía de papel: tinta parda sobre cal, el perfil relleno de pizarra, las
   cotas en Petrona y las cifras tabulares en Rethink Sans. NO es un mapa ni una
   línea que se ilumina. Con el scroll (la escena queda fijada, sticky) una
   flecha azul pequeña, pintada a brochazo, baja por el perfil; los contadores
   (km hechos y que quedan, altitud, metros bajados y subidos) salen de
   img/terreno/etapa.json, que genera scripts/etapa.mjs y que ya viene
   calibrado a las cifras de Gronze (20,4 km, +663 m, −1.017 m).
   El perfil acaba en la cancilla del albergue: «Has llegado. Entrada desde las 12:00».

   Contrato (ENCARGO.md): window.Sanchez.etapa.montar(el, { movimiento, densidad })
   → { destruir(), estado() }. El HTML de `el` es el respaldo (lo escribe la web):
   se oculta al montar y vuelve con destruir() o si falla la carga de los datos.
   Pone el.dataset.montado = '1'.

   Estados (data-estado en .etapa):
     fijo   escena sticky; el progreso sale del scroll (como un scrub, sin GSAP).
     libre  si un ancestro rompe el sticky o la pantalla es muy baja: la flecha
            avanza mientras la escena cruza la pantalla, sin fijar.
     quieto movimiento:false, densidad 'sobria' o movimiento reducido: el perfil
            entero, la flecha en la cancilla y los contadores en el total.
   Sin requestAnimationFrame cuando no hay scroll. El resize que solo cambia el
   alto (barra del móvil) no rehace nada (checklist punto 10).
   Tokens de la web con respaldo: --cal --pardo --pizarra --azul --madera,
   --f-txt (Rethink Sans), --f-voz (Petrona), --cab.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  var guion = document.currentScript && document.currentScript.src;
  var base = function (ruta) {
    try { return guion ? new URL(ruta, guion).href : ruta.replace(/^\.\.\//, ''); } catch (e) { return ruta.replace(/^\.\.\//, ''); }
  };
  var NS = 'http://www.w3.org/2000/svg';
  var UID = 0;

  // ---------- ajustes del dibujo (todo en un sitio)
  var YMIN = 120, YMAX = 1060;          // m: el dominio vertical del corte
  var PARADA_INI = 0.03, PARADA_FIN = 0.9; // fracción del recorrido: espera al principio, llegada al final
  var ANCHO_COMPLETO = 720;             // px del lienzo a partir de los cuales hay rótulos y no solo números

  var lim = function (v, a, b) { a = a === undefined ? 0 : a; b = b === undefined ? 1 : b; return v < a ? a : v > b ? b : v; };
  var miles = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
  var dec = function (n) { return (Math.round(n * 10) / 10).toFixed(1).replace('.', ','); };
  var el_ = function (tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  var sv = function (tag, attrs, padre) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]);
    if (padre) padre.appendChild(e);
    return e;
  };
  var texto = function (padre, cls, x, y, txt, extra) {
    var t = sv('text', Object.assign({ class: cls, x: x, y: y }, extra || {}), padre);
    t.textContent = txt;
    return t;
  };
  // PRNG con semilla fija: la flecha es siempre la misma
  var rng = function (s) {
    return function () { s |= 0; s = (s + 0x6D2B79F5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };

  var cache = {};
  var pedir = function (url) {
    if (!cache[url]) {
      cache[url] = fetch(url, { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });
      cache[url].catch(function () { delete cache[url]; });
    }
    return cache[url];
  };

  var stickyRoto = function (el) {
    // mientras la cortina tapa, <html> y <body> llevan overflow:hidden; es pasajero
    if (document.documentElement.classList.contains('cortina-activa')) return false;
    var htmlVisible = getComputedStyle(document.documentElement).overflowY === 'visible';
    for (var n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
      if (n === document.body && htmlVisible) continue;
      var cs = getComputedStyle(n);
      if (/(hidden|auto|scroll)/.test(cs.overflowX + ' ' + cs.overflowY)) return true;
    }
    return false;
  };

  // ---------- la flecha: brochazo con semilla fija, apunta a +x, centrada en (0,0)
  var dibujarFlecha = function (g) {
    var r = rng(2910);
    var j = function (a) { return (r() - 0.5) * a; };
    var pts = function (arr) { return arr.map(function (p) { return p[0].toFixed(2) + ',' + p[1].toFixed(2); }).join(' '); };
    // asta: de la cola (-24) al cuello (9); la cola se deshilacha en cerdas
    var sup = [], inf = [], w = 4.3;
    for (var x = -24; x <= 9.01; x += 3.3) {
      var f = lim((x + 24) / 11), grosor = w * (0.5 + 0.5 * f * f * (3 - 2 * f));
      var cola = x < -17 ? -j(5) - 1.2 : 0;
      sup.push([x + cola, -grosor + j(1.2)]);
      inf.push([x + (x < -17 ? -j(5) - 1.2 : 0), grosor + j(1.2)]);
    }
    sv('polygon', { points: pts(sup.concat(inf.reverse())), fill: 'currentColor' }, g);
    // cabeza: dos pinceladas desde la punta
    var ala = function (y1) {
      var a = [], b = [];
      for (var t = 0; t <= 1.001; t += 0.2) {
        var px = 5 + (25 - 5) * t, py = y1 * (1 - t);
        var gr = 2.4 * (0.82 + 0.18 * (1 - t)) + j(0.6);
        a.push([px + j(0.8), py - gr]); b.push([px + j(0.8), py + gr]);
      }
      return pts(a.concat(b.reverse()));
    };
    sv('polygon', { points: ala(-12.5), fill: 'currentColor' }, g);
    sv('polygon', { points: ala(12.5), fill: 'currentColor' }, g);
    // carga de pintura: el grumo del arranque y tres cerdas más claras
    sv('ellipse', { cx: -12, cy: j(1), rx: 4.5, ry: 2.2, fill: '#1B0F5C', opacity: '.55' }, g);
    [-2.2, 0.2, 2.4].forEach(function (y, i) {
      var x0 = -22 + i * 2 + j(2), x1 = 4 + j(6);
      sv('line', { x1: x0, y1: y + j(0.6), x2: x1, y2: y + j(0.6), stroke: '#F5F0E6', 'stroke-width': '.7', 'stroke-opacity': '.28', 'stroke-dasharray': (3 + r() * 5).toFixed(1) + ' ' + (1.5 + r() * 3).toFixed(1) }, g);
    });
  };

  // ---------- la cancilla de palos (madera + tinta), (0,0) = su pie, a la izquierda
  var dibujarCancilla = function (g) {
    var w = 38, h = 33;
    sv('line', { x1: 5, y1: -9, x2: w - 5, y2: -h + 6, class: 'et-trazo', 'stroke-width': '2.2' }, g);
    [6, 15, 24].forEach(function (y) { sv('rect', { x: 2, y: -h + y, width: w - 4, height: 3.6, rx: 1, class: 'et-trazo et-madera', 'stroke-width': '1.2' }, g); });
    sv('rect', { x: 0, y: -h - 2, width: 5, height: h + 2, rx: 1.4, class: 'et-trazo et-madera', 'stroke-width': '1.4' }, g);
    sv('rect', { x: w - 5, y: -h - 2, width: 5, height: h + 2, rx: 1.4, class: 'et-trazo et-madera', 'stroke-width': '1.4' }, g);
    return { w: w, h: h };
  };

  // ======================================================================
  function montar(el, op) {
    op = op || {};
    var reducido = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var quieto = op.movimiento === false || op.densidad === 'sobria' || (reducido && op.movimiento !== true);
    var vivo = true;
    var limpiezas = [];
    var respaldo = null;
    var estado = { p: quieto ? 1 : 0, km: 0 };
    var mano = {
      destruir: function () {
        vivo = false;
        limpiezas.forEach(function (f) { try { f(); } catch (e) { /* nada */ } });
        limpiezas = [];
        if (raiz && raiz.parentNode) raiz.parentNode.removeChild(raiz);
        if (respaldo) { while (respaldo.firstChild) el.appendChild(respaldo.firstChild); respaldo.parentNode && respaldo.parentNode.removeChild(respaldo); }
        delete el.dataset.montado;
      },
      estado: function () { return { p: estado.p, km: estado.km }; }
    };
    var raiz = null;

    var url = op.datos || base('../img/terreno/etapa.json');
    pedir(url).then(function (D) {
      if (!vivo) return;
      try { construir(D); } catch (e) { console.warn('etapa: no se pudo montar', e); mano.destruir(); }
    }).catch(function (e) { console.warn('etapa: sin datos, se queda el respaldo', e); });

    return mano;

    function construir(D) {
      var id = 'et' + (++UID);
      var P = D.puntos.map(function (p) { return { km: p[0], alt: p[1], sube: p[2], baja: p[3] }; });
      var TOTAL = D.total.km;
      var paradas = D.paradas;
      var porId = {}; paradas.forEach(function (p) { porId[p.id] = p; });

      // ---------- lectura de los datos en cualquier km (interpolación lineal)
      var en = function (km) {
        km = lim(km, 0, TOTAL);
        var i = 1; while (i < P.length - 1 && P[i].km < km) i++;
        var a = P[i - 1], b = P[i], t = b.km === a.km ? 0 : (km - a.km) / (b.km - a.km);
        return { km: km, alt: a.alt + (b.alt - a.alt) * t, sube: a.sube + (b.sube - a.sube) * t, baja: a.baja + (b.baja - a.baja) * t };
      };

      // ---------- DOM
      respaldo = el_('div', 'etapa-respaldo'); respaldo.hidden = true;
      while (el.firstChild) respaldo.appendChild(el.firstChild);
      raiz = el_('div', 'etapa');
      raiz.setAttribute('data-estado', quieto ? 'quieto' : 'fijo');
      raiz.setAttribute('data-progreso', quieto ? '1.000' : '0.000');
      raiz.setAttribute('data-km', quieto ? String(TOTAL) : '0');
      raiz.setAttribute('role', 'group');
      raiz.setAttribute('aria-label', 'La etapa de Berducedo a Grandas de Salime, en perfil');

      var resumen = el_('p', 'etapa-sr');
      resumen.textContent = 'Perfil de la etapa de ' + D.salida + ' al ' + D.llegada + ', en Grandas de Salime: ' + dec(TOTAL) + ' km, ' + miles(D.total.sube) + ' m de subida y ' + miles(D.total.baja) + ' m de bajada. ' +
        'Sale de Berducedo a ' + porId.salida.alt + ' m, sube hasta ' + miles(porId.alto.alt) + ' m en el alto de Buspol, baja hasta el embalse y la presa de Salime, hacia los ' + (Math.round(porId.presa.alt / 5) * 5) + ' m, y sube hasta Grandas, a ' + porId.grandas.alt + ' m. ' +
        'La tabla de más abajo tiene los mismos datos.';

      var pista = el_('div', 'etapa-pista');
      var escena = el_('div', 'etapa-escena');
      var cifras = el_('div', 'etapa-cifras'); cifras.setAttribute('aria-hidden', 'true');
      var C = {};
      [['hechos', 'km hechos'], ['quedan', 'km que quedan'], ['alt', 'm de altitud'], ['baja', 'm bajados'], ['sube', 'm subidos']].forEach(function (c) {
        var d = el_('div', 'cifra'); C[c[0]] = el_('b', '', '0'); d.appendChild(C[c[0]]); d.appendChild(el_('span', '', c[1])); cifras.appendChild(d);
      });
      var lienzo = el_('div', 'etapa-lienzo');
      var ficha = el_('div', 'etapa-ficha'); ficha.setAttribute('aria-hidden', 'true');
      var fichaT = el_('p', 'et-ficha-t'), fichaP = el_('p', 'et-ficha-p');
      ficha.appendChild(fichaT); ficha.appendChild(fichaP);
      escena.appendChild(cifras); escena.appendChild(lienzo); escena.appendChild(ficha);
      pista.appendChild(escena);

      var tablaCaja = construirTabla(D, en);
      raiz.appendChild(resumen); raiz.appendChild(pista); raiz.appendChild(tablaCaja);
      el.appendChild(respaldo); el.appendChild(raiz);
      el.dataset.montado = '1';

      // ---------- estado del dibujo
      var G = null;          // geometría actual
      var svg = null, flecha = null, plomada = null, aro = null, marcadores = {}, rotulos = [];
      var construcciones = 0;
      var anchoV = innerWidth, altoV = innerHeight;
      var modo = quieto ? 'quieto' : 'fijo';
      var cabSticky = 0;
      var ultimaFicha = null, ultimoLleg = null;

      function decidirModo() {
        if (quieto) return 'quieto';
        if (innerHeight < 520) return 'libre';
        if (stickyRoto(raiz)) return 'libre';
        return 'fijo';
      }
      function aplicarModo() {
        var m = decidirModo();
        if (m === modo && raiz.getAttribute('data-estado') === m) return false;
        modo = m;
        raiz.setAttribute('data-estado', m);
        return true;
      }

      // ---------- el dibujo
      function dibujar() {
        var W = lienzo.clientWidth, H = lienzo.clientHeight;
        if (!W || !H) return;
        construcciones++;
        raiz.setAttribute('data-construcciones', String(construcciones));
        if (svg && svg.parentNode) svg.parentNode.removeChild(svg);
        marcadores = {}; rotulos = [];
        var completo = W >= ANCHO_COMPLETO;
        var padL = completo ? 58 : 38, padR = completo ? 78 : 60, top = completo ? 88 : 40, bot = completo ? 32 : 28;
        var plotW = W - padL - padR;
        var avail = H - top - bot;
        var plotH = Math.max(150, Math.min(avail, W * (completo ? 0.36 : 0.6)));
        var offY = Math.max(0, (H - (top + plotH + bot)) / 2);
        var y0 = offY + top, yB = y0 + plotH;
        var sx = function (km) { return padL + km / TOTAL * plotW; };
        var sy = function (alt) { return y0 + (YMAX - alt) / (YMAX - YMIN) * plotH; };
        var xEnd = sx(TOTAL);
        var exag = (plotH / (YMAX - YMIN)) / (plotW / (TOTAL * 1000));
        var px = P.map(function (p) { return [sx(p.km), sy(p.alt)]; });
        var yEnX = function (x) {
          var i = 1; while (i < px.length - 1 && px[i][0] < x) i++;
          var a = px[i - 1], b = px[i], t = b[0] === a[0] ? 0 : lim((x - a[0]) / (b[0] - a[0]));
          return a[1] + (b[1] - a[1]) * t;
        };
        var s = completo ? 1 : 0.82;
        G = { W: W, H: H, completo: completo, padL: padL, y0: y0, yB: yB, sx: sx, sy: sy, xEnd: xEnd, s: s, yEnX: yEnX, plotW: plotW, plotH: plotH };

        svg = sv('svg', { class: 'etapa-svg', width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true', focusable: 'false' });
        lienzo.appendChild(svg);   // en el documento desde el principio: getBBox solo mide si está montado
        var defs = sv('defs', {}, svg);
        var pat = sv('pattern', { id: id + '-estratos', width: 9, height: 9, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(-28)' }, defs);
        sv('line', { x1: 0, y1: 0.5, x2: 9, y2: 0.5, stroke: '#F5F0E6', 'stroke-width': '.7', 'stroke-opacity': '.16' }, pat);

        // cotas: líneas de nivel y su altitud en Petrona
        var gc = sv('g', { class: 'et-cotas' }, svg);
        [200, 400, 600, 800, 1000].forEach(function (a) {
          var y = sy(a);
          sv('line', { x1: padL, y1: y, x2: xEnd + (padR - 12), y2: y, class: 'et-nivel' }, gc);
          texto(gc, 'et-cota', padL - 8, y + 4, miles(a) + ' m', { 'text-anchor': 'end' });
        });

        // el terreno: relleno de pizarra, estratos y filo de tinta
        var finX = W - 8, yFin = px[px.length - 1][1];
        var d = 'M' + px[0][0] + ',' + yB + ' L' + px.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' L') + ' L' + finX + ',' + yFin.toFixed(1) + ' L' + finX + ',' + yB + ' Z';
        sv('path', { d: d, class: 'et-pizarra' }, svg);
        sv('path', { d: d, fill: 'url(#' + id + '-estratos)' }, svg);
        var dl = 'M' + px.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' L') + ' L' + finX + ',' + yFin.toFixed(1);
        sv('path', { d: dl, class: 'et-filo' }, svg);

        // eje de km
        var ge = sv('g', { class: 'et-eje' }, svg);
        var paso = completo ? 2 : 4;
        for (var k = 0; k <= TOTAL + 0.01; k += paso) {
          var kx = sx(k);
          sv('line', { x1: kx, y1: yB, x2: kx, y2: yB + 5, class: 'et-trazo', 'stroke-width': '1.2' }, ge);
          texto(ge, 'et-km', kx, yB + 19, String(Math.round(k)), { 'text-anchor': 'middle' });
        }
        texto(ge, 'et-km et-km-u', xEnd + (completo ? 22 : 4), yB + 19, 'km', { 'text-anchor': completo ? 'start' : 'start' });
        if (completo) texto(ge, 'et-cota et-escala', W - 6, yB + 19, 'vertical ×' + Math.round(exag), { 'text-anchor': 'end' });

        // la cancilla, al final del terreno
        var gateX = xEnd + 30 * s;   // la punta de la flecha llega justo hasta aquí
        var gate = sv('g', { transform: 'translate(' + gateX.toFixed(1) + ',' + yFin.toFixed(1) + ') scale(' + s + ')', class: 'et-cancilla' }, svg);
        var cd = dibujarCancilla(gate);
        var gx = gateX + cd.w * s / 2, gTop = yFin - cd.h * s - 2 * s;

        // el último repecho: un corchete paralelo a la subida, por encima de la flecha
        var rp = porId.repecho, xa = sx(rp.desde), xb = sx(rp.hasta);
        var ya = yEnX(xa) - 38, yb = yEnX(xb) - 38;
        var gr = sv('g', { class: 'et-repecho' }, svg);
        sv('path', { d: 'M' + xa + ',' + (ya + 8) + ' L' + xa + ',' + ya + ' L' + xb + ',' + yb + ' L' + xb + ',' + (yb + 8), class: 'et-corchete' }, gr);
        var distCorchete = function (qx, qy) {
          var m = 1e9;
          [[xa, ya + 8, xa, ya], [xa, ya, xb, yb], [xb, yb, xb, yb + 8]].forEach(function (sg) {
            var vx = sg[2] - sg[0], vy = sg[3] - sg[1], l2 = vx * vx + vy * vy || 1, t = lim(((qx - sg[0]) * vx + (qy - sg[1]) * vy) / l2);
            var dd = Math.hypot(qx - (sg[0] + vx * t), qy - (sg[1] + vy * t));
            if (dd < m) m = dd;
          });
          return m;
        };

        // distancia de un punto al perfil (desplazado dy en vertical), para colocar los números sin pisarlo
        var distPerfil = function (qx, qy, dy) {
          var m = 1e9;
          for (var i = 1; i < px.length; i++) {
            var ax = px[i - 1][0], ay = px[i - 1][1] + dy, bx = px[i][0], by = px[i][1] + dy;
            var vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1, t = lim(((qx - ax) * vx + (qy - ay) * vy) / l2);
            var ddx = qx - (ax + vx * t), ddy = qy - (ay + vy * t), dd = Math.sqrt(ddx * ddx + ddy * ddy);
            if (dd < m) m = dd;
          }
          return m;
        };
        var angEn = function (km) {
          var k1 = Math.max(0, km - 0.5), k2 = Math.min(TOTAL, km + 0.5);
          return Math.atan2(sy(en(k2).alt) - sy(en(k1).alt), sx(k2) - sx(k1));
        };
        var puestos = [];
        var ubicarNum = function (tx, ty, ang, minD) {
          for (var d = 20; d <= 110; d += 3) {
            var cand = [[tx + Math.sin(ang) * d, ty - Math.cos(ang) * d], [tx, ty - d]];
            for (var c = 0; c < 2; c++) {
              var q = cand[c];
              if (q[1] < 11 || q[0] < 11 || q[0] > W - 11) continue;
              if (distPerfil(q[0], q[1], 0) < minD || distCorchete(q[0], q[1]) < 14) continue;
              if (puestos.some(function (h) { return Math.hypot(h[0] - q[0], h[1] - q[1]) < 23; })) continue;
              puestos.push(q); return q;
            }
          }
          var f = [tx, ty - 20]; puestos.push(f); return f;
        };

        // rótulos
        var grot = sv('g', { class: 'et-rotulos' }, svg);
        var obst = [];
        var choca = function (r, margen) {
          for (var i = 0; i < obst.length; i++) {
            var o = obst[i];
            if (r.x0 < o.x1 + margen && r.x1 > o.x0 - margen && r.y0 < o.y1 + margen && r.y1 > o.y0 - margen) return true;
          }
          return false;
        };
        var libreDelPerfil = function (r, despeje) {
          for (var x = r.x0; x <= r.x1 + 3; x += 4) if (yEnX(Math.min(x, r.x1)) - despeje < r.y1) return false;
          return true;
        };
        var medir = function (g) { var b = g.getBBox(); return { x0: b.x, x1: b.x + b.width, y0: b.y, y1: b.y + b.height }; };

        var marcar = function (p) {
          var a = en(p.km), m = sv('circle', { cx: sx(a.km), cy: sy(a.alt), r: 4.6, class: 'et-marca', 'data-id': p.id }, svg);
          marcadores[p.id] = { el: m, km: p.km };
          return { x: sx(a.km), y: sy(a.alt) };
        };

        if (completo) {
          // --- rótulos de bandera en la franja de arriba: Berducedo, A Mesa y el alto (de izquierda a derecha)
          var filas = [[], [], []];
          ['salida', 'mesa', 'alto'].forEach(function (pid) {
            var p = porId[pid], pos = marcar(p);
            var g = sv('g', { class: 'et-rotulo', 'data-id': pid }, grot);
            texto(g, 'et-r1', pos.x + 7, 12, p.rotulo[0]);
            texto(g, 'et-r2', pos.x + 7, 27, p.rotulo[1]);
            var b = medir(g), w = b.x1 - b.x0;
            var fila = 2;
            for (var r = 0; r < 3; r++) {
              var rect = { x0: pos.x + 4, x1: pos.x + 9 + w };
              var ok = filas[r].every(function (q) { return rect.x0 > q.x1 + 10 || rect.x1 < q.x0 - 10; });
              for (var rr = 0; ok && rr < r; rr++) filas[rr].forEach(function (q) { if (pos.x >= q.x0 - 3 && pos.x <= q.x1 + 3) ok = false; });
              if (ok) { fila = r; break; }
            }
            var yTop = y0 - 40 - 38 * fila;
            g.setAttribute('transform', 'translate(0,' + yTop + ')');
            sv('line', { x1: pos.x, y1: yTop, x2: pos.x, y2: pos.y - 5, class: 'et-guia' }, grot);
            var rc = { x0: pos.x + 4, x1: pos.x + 9 + w, y0: yTop, y1: yTop + 33 };
            filas[fila].push(rc); obst.push(rc);
            rotulos.push(g);
          });

          // --- la presa, en el vacío del valle
          var pp = porId.presa, pos2 = marcar(pp);
          var gp = sv('g', { class: 'et-rotulo', 'data-id': 'presa' }, grot);
          texto(gp, 'et-r1', pos2.x + 7, 12, pp.rotulo[0]);
          texto(gp, 'et-r2', pos2.x + 7, 27, pp.rotulo[1]);
          var bp = medir(gp), wp = bp.x1 - bp.x0, yTopP = pos2.y - 56;
          for (var L = 56; L < 420; L += 8) {
            yTopP = pos2.y - L;
            var rcp = { x0: pos2.x + 4, x1: pos2.x + 9 + wp, y0: yTopP, y1: yTopP + 33 };
            if (libreDelPerfil(rcp, 52) && !choca(rcp, 6)) break;   // 52: también por encima del corchete
          }
          gp.setAttribute('transform', 'translate(0,' + yTopP + ')');
          sv('line', { x1: pos2.x, y1: yTopP, x2: pos2.x, y2: pos2.y - 5, class: 'et-guia' }, grot);
          obst.push({ x0: pos2.x + 4, x1: pos2.x + 9 + wp, y0: yTopP, y1: yTopP + 33 });
          rotulos.push(gp);
        } else {
          ['salida', 'mesa', 'alto', 'presa'].forEach(function (pid, i) {
            var pos = marcar(porId[pid]);
            var c = ubicarNum(pos.x, pos.y, angEn(porId[pid].km), 15);
            numero(grot, i + 1, c[0], c[1], pos.x, pos.y - 5);
          });
        }

        // --- el último repecho: su rótulo (el corchete ya está dibujado)
        if (completo) {
          var grr = sv('g', { class: 'et-rotulo', 'data-id': 'repecho' }, grot);
          var xm = (xa + xb) / 2;
          texto(grr, 'et-r1', xm, 12, rp.rotulo[0], { 'text-anchor': 'middle' });
          texto(grr, 'et-r2', xm, 27, rp.rotulo[1], { 'text-anchor': 'middle' });
          var br = medir(grr), wr = br.x1 - br.x0, yTopR = 0;
          for (var L2 = 0; L2 < 300; L2 += 6) {
            yTopR = Math.min(ya, yb) - 40 - L2;
            var rcr = { x0: xm - wr / 2, x1: xm + wr / 2, y0: yTopR, y1: yTopR + 33 };
            var okR = true;
            for (var x = rcr.x0; x <= rcr.x1 + 3; x += 4) if (yEnX(Math.min(x, rcr.x1)) - 52 < rcr.y1) { okR = false; break; }
            if (okR && !choca(rcr, 6)) break;
          }
          grr.setAttribute('transform', 'translate(0,' + yTopR + ')');
          obst.push({ x0: xm - wr / 2, x1: xm + wr / 2, y0: yTopR, y1: yTopR + 33 });
          rotulos.push(grr);
        } else {
          var xm2 = (xa + xb) / 2;
          var c5 = ubicarNum(xm2, (ya + yb) / 2, Math.atan2(yb - ya, xb - xa), 4);
          numero(grot, 5, c5[0], c5[1], xm2, (ya + yb) / 2 - 2);
        }

        // --- la llegada: «Has llegado.» en la franja de arriba, a la derecha, con su guía hasta la cancilla
        marcadores.albergue = { el: gate, km: porId.albergue.km };
        marcadores.grandas = { el: null, km: porId.grandas.km };
        if (completo) {
          var gl = sv('g', { class: 'et-rotulo et-llegada', 'data-id': 'albergue' }, grot);
          texto(gl, 'et-r1', W - 10, 11, 'GRANDAS DE SALIME · ' + porId.grandas.alt + ' m', { 'text-anchor': 'end' });
          texto(gl, 'et-llego', W - 10, 40, porId.albergue.rotulo[0], { 'text-anchor': 'end' });
          texto(gl, 'et-r2 et-r2-f', W - 10, 60, 'Albergue Casa Sánchez · ' + porId.albergue.rotulo[1].charAt(0).toLowerCase() + porId.albergue.rotulo[1].slice(1), { 'text-anchor': 'end' });
          var yTopL = Math.max(4, y0 - 84);
          gl.setAttribute('transform', 'translate(0,' + yTopL + ')');
          sv('line', { x1: gx, y1: yTopL + 66, x2: gx, y2: gTop - 4, class: 'et-guia et-guia-llegada' }, grot);
          rotulos.push(gl);
        } else {
          var c6 = ubicarNum(gx, gTop - 4, 0, 15);
          numero(grot, 6, c6[0], c6[1], gx, gTop - 4);
        }

        // --- plomada y flecha
        plomada = sv('line', { class: 'et-plomada', x1: 0, y1: 0, x2: 0, y2: 0 }, svg);
        aro = sv('circle', { class: 'et-aro', r: 3.6, cx: 0, cy: 0 }, svg);
        var gf = sv('g', { class: 'et-flecha-g' }, svg);
        flecha = sv('g', { class: 'et-flecha' }, gf);
        var gi = sv('g', { transform: 'scale(' + (completo ? 1 : 0.85) + ')' }, flecha);
        dibujarFlecha(gi);
        document.fonts && document.fonts.ready && fuentes();
        pintar(estado.km, true);
      }

      function numero(padre, n, cx, cy, tx, ty) {
        // guía desde el borde del círculo hasta el punto; el círculo va encima
        var dx = tx - cx, dy = ty - cy, l = Math.sqrt(dx * dx + dy * dy) || 1;
        sv('line', { x1: cx + dx / l * 9, y1: cy + dy / l * 9, x2: tx, y2: ty, class: 'et-guia' }, padre);
        var g = sv('g', { class: 'et-num', 'data-n': n }, padre);
        sv('circle', { cx: cx, cy: cy, r: 9, class: 'et-num-c' }, g);
        texto(g, 'et-num-t', cx, cy + 4, String(n), { 'text-anchor': 'middle' });
      }

      var fuentesListas = false;
      function fuentes() {
        if (fuentesListas) return;
        fuentesListas = true;
        document.fonts.ready.then(function () { if (vivo) { dibujar(); frame(); } });
      }

      // ---------- pintar un km: flecha, contadores, ficha, marcas
      function pintar(km, forzar) {
        if (!G) return;
        km = lim(km, 0, TOTAL);
        estado.km = km;
        var a = en(km);
        var x = G.sx(km), y = G.sy(a.alt);
        // ángulo: tangente suavizada en ±0,6 km
        var k1 = Math.max(0, km - 0.6), k2 = Math.min(TOTAL, km + 0.6);
        var A = en(k1), B = en(k2);
        var ang = Math.atan2(G.sy(B.alt) - G.sy(A.alt), G.sx(k2) - G.sx(k1));
        var d = 15 * G.s + 5;
        var cx = x + Math.sin(ang) * d, cy = y - Math.cos(ang) * d;
        flecha.setAttribute('transform', 'translate(' + cx.toFixed(1) + ',' + cy.toFixed(1) + ') rotate(' + (ang * 180 / Math.PI).toFixed(1) + ') scale(' + G.s + ')');
        plomada.setAttribute('x1', x.toFixed(1)); plomada.setAttribute('x2', x.toFixed(1));
        plomada.setAttribute('y1', (y + 4).toFixed(1)); plomada.setAttribute('y2', (G.yB - 2).toFixed(1));
        aro.setAttribute('cx', x.toFixed(1)); aro.setAttribute('cy', y.toFixed(1));
        // contadores
        C.hechos.textContent = dec(km);
        C.quedan.textContent = dec(TOTAL - km);
        C.alt.textContent = miles(a.alt);
        C.baja.textContent = miles(a.baja);
        C.sube.textContent = miles(a.sube);
        raiz.setAttribute('data-km', km.toFixed(3));
        // paradas hechas
        for (var k in marcadores) {
          var m = marcadores[k];
          if (!m.el || !m.el.classList) continue;
          m.el.classList.toggle('on', km >= m.km - 0.02);
        }
        // ficha: la última parada cuya activación ya pasó
        var act = paradas[0];
        for (var i = 0; i < paradas.length; i++) if (km >= paradas[i].activa) act = paradas[i];
        if (forzar || act.id !== ultimaFicha) {
          ultimaFicha = act.id;
          var num = G.completo ? '' : ({ salida: '1', mesa: '2', alto: '3', presa: '4', repecho: '5', grandas: '6', albergue: '6' }[act.id] + ' · ');
          fichaT.textContent = num + (act.id === 'albergue' ? 'Has llegado.' : act.rotulo[0]);
          fichaP.textContent = act.id === 'albergue' ? act.ficha.replace(/^Has llegado\.\s*/, '') : act.ficha;
          raiz.setAttribute('data-parada', act.id);
          if (!forzar && modo !== 'quieto') { ficha.classList.remove('cambia'); void ficha.offsetWidth; ficha.classList.add('cambia'); }
        }
        var lleg = km >= TOTAL - 0.01;
        if (lleg !== ultimoLleg) { ultimoLleg = lleg; raiz.classList.toggle('llego', lleg); }
      }

      // ---------- el scroll → progreso → km
      var ticking = false;
      function progreso() {
        if (modo === 'quieto') return 1;
        if (modo === 'fijo') {
          var r = pista.getBoundingClientRect();
          var rec = pista.offsetHeight - escena.offsetHeight;
          if (rec <= 0) return 1;
          return lim((cabSticky - r.top) / rec);
        }
        var vh = innerHeight, e = escena.getBoundingClientRect();
        return lim((vh * 0.75 - e.top) / (vh * 0.25 + e.height));
      }
      function frame() {
        ticking = false;
        if (!vivo) return;
        var p = progreso();
        estado.p = p;
        raiz.setAttribute('data-progreso', p.toFixed(3));
        var t = modo === 'quieto' ? 1 : lim((p - PARADA_INI) / (PARADA_FIN - PARADA_INI));
        pintar(t * TOTAL);
      }
      function pedirFrame() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }

      function medirCab() { cabSticky = parseFloat(getComputedStyle(escena).top) || 0; }

      // ---------- arranque, resize y cortina
      aplicarModo();
      medirCab();
      dibujar();
      frame();

      if (modo !== 'quieto') {
        window.addEventListener('scroll', pedirFrame, { passive: true });
        limpiezas.push(function () { window.removeEventListener('scroll', pedirFrame); });
      }
      var alRedimensionar = function () {
        // la barra del móvil sale y entra: solo cambia el alto → no se rehace nada
        if (innerWidth === anchoV && Math.abs(innerHeight - altoV) < 160) return;
        anchoV = innerWidth; altoV = innerHeight;
        aplicarModo(); medirCab();
        dibujar(); frame();
      };
      window.addEventListener('resize', alRedimensionar);
      limpiezas.push(function () { window.removeEventListener('resize', alRedimensionar); });
      if (!quieto && 'MutationObserver' in window) {
        var mo = new MutationObserver(function () { if (aplicarModo()) { medirCab(); dibujar(); frame(); } });
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        limpiezas.push(function () { mo.disconnect(); });
      }
    }
  }

  // ---------- la tabla accesible: los mismos datos
  function construirTabla(D, en) {
    var caja = el_('div', 'etapa-tabla');
    var t = el_('table');
    var cap = el_('caption', '', 'La etapa en tabla: de Berducedo al Albergue Casa Sánchez, ' + dec(D.total.km) + ' km');
    t.appendChild(cap);
    var th = el_('thead'), trh = el_('tr');
    [['Km', 'col-km'], ['Lugar', ''], ['Altitud (m)', 'col-n'], ['Bajados (m)', 'col-n'], ['Subidos (m)', 'col-n']].forEach(function (c) {
      var h = el_('th', c[1], c[0]); h.scope = 'col'; trh.appendChild(h);
    });
    th.appendChild(trh); t.appendChild(th);
    var tb = el_('tbody');
    var fila = function (cells, lugar, nota, cls) {
      var tr = el_('tr', cls || '');
      var c0 = el_('td', 'col-km', cells[0]);
      var c1 = el_('th'); c1.scope = 'row'; c1.appendChild(document.createTextNode(lugar));
      if (nota) c1.appendChild(el_('small', '', nota));
      tr.appendChild(c0); tr.appendChild(c1);
      for (var i = 1; i < cells.length; i++) tr.appendChild(el_('td', 'col-n', cells[i]));
      tb.appendChild(tr);
    };
    D.paradas.forEach(function (p) {
      if (!p.tabla) return;
      if (p.id === 'repecho') {
        // el último repecho es un tramo: de la presa a Grandas
        var ra = en(p.desde), rb = en(p.hasta);
        fila([dec(p.desde) + ' a ' + dec(p.hasta), miles(ra.alt) + ' a ' + miles(rb.alt), '—', miles(rb.sube - ra.sube)], p.tabla.lugar, p.tabla.nota);
        return;
      }
      var a = en(p.km);
      fila([dec(p.km), miles(a.alt), miles(a.baja), miles(a.sube)], p.tabla.lugar, p.tabla.nota);
    });
    t.appendChild(tb);
    var tf = el_('tfoot'), trf = el_('tr');
    trf.appendChild(el_('td', 'col-km', dec(D.total.km)));
    var thf = el_('th'); thf.scope = 'row'; thf.appendChild(document.createTextNode('Total de la etapa')); thf.appendChild(el_('small', '', 'Cifras de Gronze'));
    trf.appendChild(thf);
    trf.appendChild(el_('td', 'col-n', 'máx. ' + miles(D.total.max.alt)));
    trf.appendChild(el_('td', 'col-n', miles(D.total.baja)));
    trf.appendChild(el_('td', 'col-n', miles(D.total.sube)));
    tf.appendChild(trf); t.appendChild(tf);
    caja.appendChild(t);
    var nota = el_('p', 'etapa-nota');
    nota.textContent = D.calibrado.nota + ' Fuentes: ' + D.fuentes.join(' ');
    caja.appendChild(nota);
    return caja;
  }

  window.Sanchez = window.Sanchez || {};
  window.Sanchez.etapa = { montar: montar };
})();
