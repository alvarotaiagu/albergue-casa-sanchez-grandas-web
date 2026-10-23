/* ------------------------------------------------------------------
   Albergue Casa Sánchez · reserva.js · «Tu cama»
   Reserva de DEMOSTRACIÓN. Base: el motor de A Casa da Tulla (calendario de
   12 meses, noches ocupadas inventadas pero siempre las mismas, resumen y
   localizador), llevado a un albergue: se reserva por CAMA y NOCHE, o el
   apartamento entero. No hay servidor: no se envía, no se guarda ni se cobra
   nada, y la página lo dice junto al botón.

   Contrato (ENCARGO.md): window.Sanchez.reserva.montar(el, opciones)
     opciones = { movimiento: bool, densidad: 'cartel'|'sobria', fecha?: Date|'AAAA-MM-DD', cartel?: fn(el, datos) }
   Pone el.dataset.montado = '1' y devuelve { destruir() }. El HTML previo de `el`
   es el respaldo: si algo falla al pintar, se queda.

   Pasos: fechas -> cama (o apartamento) -> datos -> confirmación (cartel de bienvenida + .ics).
   Elegir cama SIN planta cenital: 4 puertas en fila; al abrir una, la pared del
   fondo vista de frente con sus literas; se toca el colchón (arriba o abajo).

   TODO LO SUPUESTO ESTÁ EN `TARIFAS` y `CASA` (y se marca «supuesto» en pantalla):
   - Precios: 20 € la litera y 90 € el apartamento: lo más reciente de la ficha de
     alberguescaminosantiago.com («datos facilitados por la propiedad», 19-10-2026). Antes: 18 € y 20 € en
     verano / 60-70 € y 90 € en verano. Sin tarifa propia publicada por el albergue.
   - Temporada: abierto del 15 de abril al 3 de noviembre (misma ficha). Otras fuentes: Semana Santa-6 de
     octubre (Gronze) o 13 de abril-1 de octubre (Wise Pilgrim). La noche del 3 de noviembre es la última.
   - Habitaciones: las fichas dicen 4 dormitorios de 4 plazas; las reseñas cuentan salas de 8, de 5 y privadas.
     Aquí: 4 puertas con 2 literas (= 4 camas) cada una.
   - Apartamento: 2 plazas (ficha); sus detalles (camas, baño, cocina, calefacción) NO constan.
   - Las camas y noches «ocupadas» son inventadas y fijas (función `camaOcupada`).
   Al conectar un motor real, solo cambian camaOcupada()/aptoOcupado() y el envío del formulario.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  const Sanchez = (window.Sanchez = window.Sanchez || {});

  /* =================== SUPUESTOS EN UN SOLO SITIO =================== */
  const TARIFAS = {
    litera: 20,            // € por cama y noche · SUPUESTO
    apartamento: 90,       // € por noche (todo el apartamento) · SUPUESTO
    abre: '04-15',         // primera noche reservable · SUPUESTO (mes-día)
    cierra: '11-03',       // última noche reservable · SUPUESTO (mes-día)
    entrada: '12:00',      // «Registro a partir de las 12:00» (ficha)
    maxNoches: 7,
    ventanaMeses: 12
  };
  const CASA = { habitaciones: 4, literasPorHab: 2, maxPersonas: 4, plazasApto: 2 }; // SUPUESTO (ver arriba)
  const DIRECCION = 'C/ El Salvador, s/n, 33730 Grandas de Salime, Asturias';

  /* =================== camas =================== */
  // p: 'a' = arriba, 'b' = abajo. id: «habitación-litera-posición», p. ej. «2-1-b».
  const CAMAS = [];
  for (let h = 1; h <= CASA.habitaciones; h++) {
    for (let l = 1; l <= CASA.literasPorHab; l++) {
      ['a', 'b'].forEach((p) => CAMAS.push({ id: `${h}-${l}-${p}`, h, l, p, idx: CAMAS.length }));
    }
  }
  const POS = { a: 'arriba', b: 'abajo' };
  const camaPorId = (id) => CAMAS.find((c) => c.id === id);

  /* =================== fechas =================== */
  const pad = (n) => String(n).padStart(2, '0');
  const clave = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const deClave = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const mas = (k, n) => { const d = deClave(k); d.setDate(d.getDate() + n); return clave(d); };
  const dnum = (k) => { const [y, m, d] = k.split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 864e5); };
  const dsem = (k) => new Date(dnum(k) * 864e5).getUTCDay(); // 0 = domingo
  const fCorta = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  const fLarga = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const fDia = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' });
  const fEur = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const corta = (k) => fCorta.format(deClave(k));
  const larga = (k) => fLarga.format(deClave(k));
  const dia = (k) => fDia.format(deClave(k));
  const eur = (n) => fEur.format(Math.round(n * 100) / 100) + '\u00a0€';
  const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /* =================== temporada y ocupación (inventadas, fijas) =================== */
  const abierta = (k) => { const md = k.slice(5); return md >= TARIFAS.abre && md <= TARIFAS.cierra; };

  function h2(a, b) {
    let t = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35);
    t ^= t >>> 15; t = Math.imul(t, 0x2c1b3c6d); t ^= t >>> 12; t = Math.imul(t, 0x297a2d39); t ^= t >>> 15;
    return (t >>> 0) / 4294967296;
  }
  const TASA_MES = { 4: 0.28, 5: 0.45, 6: 0.55, 7: 0.72, 8: 0.86, 9: 0.6, 10: 0.38, 11: 0.15 };
  function tasa(k) {
    const w = dsem(k);
    return Math.min(0.95, (TASA_MES[+k.slice(5, 7)] || 0.2) + (w === 5 || w === 6 ? 0.1 : 0));
  }
  // noche entera completa (todas las camas ocupadas)
  function completa(k) { const m = +k.slice(5, 7); return h2(dnum(k), 999) < (m === 7 || m === 8 ? 0.12 : 0.035); }
  function camaOcupada(k, idx) { return completa(k) || h2(dnum(k), idx + 1) < tasa(k); }
  function aptoOcupado(k) { return h2(dnum(k), 777) < tasa(k) * 0.6; }
  const libresNoche = (k) => CAMAS.filter((c) => !camaOcupada(k, c.idx)).length;

  /* =================== ICS =================== */
  const icsEsc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  function icsPlegar(linea) {
    // líneas de 75 octetos como máximo; los trozos siguientes empiezan con un espacio
    const enc = new TextEncoder();
    let out = '', cur = '', bytes = 0, limite = 75;
    for (const ch of linea) {
      const b = enc.encode(ch).length;
      if (bytes + b > limite) { out += cur + '\r\n '; cur = ''; bytes = 1; limite = 75; }
      cur += ch; bytes += b;
    }
    return out + cur;
  }
  function crearICS(d) {
    const t = (k) => k.replace(/-/g, '');
    const ahora = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const lineas = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Albergue Casa Sanchez//Reserva de demostracion//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${d.loc.toLowerCase()}@casa-sanchez.demostracion`,
      `DTSTAMP:${ahora}`,
      `DTSTART;VALUE=DATE:${t(d.ini)}`,
      `DTEND;VALUE=DATE:${t(d.fin)}`,
      `SUMMARY:${icsEsc(d.resumen)}`,
      `LOCATION:${icsEsc('Albergue Casa Sánchez, ' + DIRECCION)}`,
      `DESCRIPTION:${icsEsc(d.descripcion)}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
      'END:VCALENDAR'
    ];
    return lineas.map(icsPlegar).join('\r\n') + '\r\n';
  }

  /* =================== dibujos (una sola vez, en el sprite) =================== */
  const PETALOS = (n, r0) => Array.from({ length: n }, (_, i) =>
    `<g transform="rotate(${Math.round((360 / n) * i)})"><ellipse class="p" cx="0" cy="-10" rx="3.3" ry="9" style="--d:${i * 70}ms"/></g>`).join('');
  const SPRITE = `<svg class="r-sprite" width="0" height="0" focusable="false" aria-hidden="true" style="position:absolute">
    <defs>
      <filter id="sanchez-r-aspero" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.4"/></filter>
    </defs>
    <symbol id="sanchez-r-flor" viewBox="-20 -20 40 40">${PETALOS(8)}<circle r="3.2" class="fc"/></symbol>
    <symbol id="sanchez-r-mochila" viewBox="0 0 40 40">
      <path class="m-asa" d="M14 13 Q20 3 26 13"/>
      <path class="m-tira" d="M9 19 Q4 26 10 34 M31 19 Q36 26 30 34"/>
      <rect class="m-cuerpo" x="9" y="12" width="22" height="24" rx="7"/>
      <rect class="m-bolsillo" x="13" y="24" width="14" height="9" rx="3"/>
      <path class="m-asa" d="M13 18 H27"/>
    </symbol>
    <symbol id="sanchez-r-sabana" viewBox="0 0 40 26">
      <rect class="s-tela" x="3" y="4" width="34" height="18" rx="3"/>
      <path class="s-pliegue" d="M3 13 H37 M21 4 V22"/>
    </symbol>
  </svg>`;

  // números pintados a mano en la puerta (azul, a brochazo)
  const NUMEROS = {
    1: 'M12 17 Q18 12 23 8 Q22 28 24 49',
    2: 'M10 19 Q11 7 22 8 Q33 10 30 21 Q26 29 11 47 Q21 44 32 47',
    3: 'M10 13 Q20 4 30 12 Q33 22 18 26 Q35 29 31 41 Q22 53 9 43',
    4: 'M27 49 L26 8 L8 35 L35 34'
  };

  /* =================== el módulo =================== */
  function montar(el, opciones) {
    opciones = opciones || {};
    const original = el.innerHTML;
    const f = opciones.fecha;
    const hoy = f instanceof Date ? clave(f) : (typeof f === 'string' && /^\d{4}-\d{2}-\d{2}/.test(f) ? f.slice(0, 10) : clave(new Date()));
    const reducido = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const movimiento = opciones.movimiento !== false && opciones.densidad !== 'sobria' && !reducido;

    const b0 = deClave(hoy);
    const minMes = b0.getFullYear() * 12 + b0.getMonth(), maxMes = minMes + TARIFAS.ventanaMeses - 1;
    const limite = clave(new Date(b0.getFullYear(), b0.getMonth() + TARIFAS.ventanaMeses, 0));

    const st = {
      tipo: 'litera', pers: 1, ini: null, n: 1, y: b0.getFullYear(), m: b0.getMonth(),
      paso: 'fechas', hab: null, camas: [], msg: '', datos: { nombre: '', hora: '18:00', bici: false }, loc: '', ics: ''
    };
    const personas = () => (st.tipo === 'apto' ? CASA.plazasApto : st.pers);

    /* ---------- reglas ---------- */
    const nocheValida = (k) => k >= hoy && k <= limite && abierta(k);
    const nochesDe = (ini, n) => { const r = []; for (let i = 0; i < n; i++) r.push(mas(ini, i)); return r; };
    const camasLibres = (ns) => CAMAS.filter((c) => ns.every((k) => !camaOcupada(k, c.idx)));
    function estanciaOK(ini, n, pers, tipo) {
      if (!ini || n < 1) return false;
      const ns = nochesDe(ini, n);
      if (!ns.every(nocheValida)) return false;
      return tipo === 'apto' ? ns.every((k) => !aptoOcupado(k)) : camasLibres(ns).length >= pers;
    }
    function maxNochesDesde(k, pers, tipo) {
      let mx = 0;
      for (let n = 1; n <= TARIFAS.maxNoches; n++) { if (estanciaOK(k, n, pers, tipo)) mx = n; else break; }
      return mx;
    }
    const salida = () => mas(st.ini, st.n);
    const noches = () => (st.ini ? nochesDe(st.ini, st.n) : []);
    const libresEstancia = () => new Set(camasLibres(noches()).map((c) => c.id));
    const libresHab = (h) => { const s = libresEstancia(); return CAMAS.filter((c) => c.h === h && s.has(c.id)).length; };

    // si lo elegido ya no cabe (más personas, otro tipo…), se acerca a lo más parecido que sí cabe
    function ajustar() {
      const pers = personas();
      if (!estanciaOK(st.ini, st.n, pers, st.tipo)) {
        const mx = st.ini ? maxNochesDesde(st.ini, pers, st.tipo) : 0;
        if (mx >= 1) { st.n = mx; st.msg = `Para ${st.tipo === 'apto' ? 'el apartamento' : plural(pers, 'cama', 'camas')} solo caben ${plural(mx, 'noche', 'noches')} desde esa llegada.`; }
        else {
          const antes = st.ini;
          st.ini = null;
          for (let k = antes ? mas(antes, 1) : hoy; k <= limite; k = mas(k, 1)) if (estanciaOK(k, 1, pers, st.tipo)) { st.ini = k; st.n = 1; break; }
          st.msg = st.ini ? `Esa noche ya no tiene sitio: pasamos a la siguiente libre, ${corta(st.ini)}.` : 'No queda ninguna noche libre en el calendario con esas condiciones.';
          if (st.ini) { const d = deClave(st.ini); st.y = d.getFullYear(); st.m = d.getMonth(); }
        }
      }
      const libres = libresEstancia();
      st.camas = st.tipo === 'apto' ? [] : st.camas.filter((id) => libres.has(id)).slice(0, pers);
      if (st.hab && st.tipo === 'apto') st.hab = null;
    }

    function cuenta() {
      const n = st.ini ? st.n : 0, pers = personas();
      if (st.tipo === 'apto') return { n, pers, unit: TARIFAS.apartamento, total: n * TARIFAS.apartamento };
      return { n, pers, unit: TARIFAS.litera, total: n * pers * TARIFAS.litera };
    }
    function textoCamas(cortoSi) {
      const sel = st.camas.map(camaPorId).sort((a, b) => a.idx - b.idx);
      if (!sel.length) return '';
      if (sel.length === 1) return `Habitación ${sel[0].h}, litera de ${POS[sel[0].p] === 'abajo' ? 'abajo' : 'arriba'}`;
      const porHab = new Map();
      sel.forEach((c) => { if (!porHab.has(c.h)) porHab.set(c.h, []); porHab.get(c.h).push(c); });
      return [...porHab].map(([h, cs]) => cortoSi
        ? `Hab. ${h} (${plural(cs.length, 'cama', 'camas')})`
        : `Habitación ${h}: ${cs.map((c) => `litera ${c.l} ${POS[c.p]}`).join(' y ')}`).join(cortoSi ? ' y ' : '; ');
    }

    /* ---------- pintar ---------- */
    const DSEM = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    const PASOS = [['fechas', 'Fechas'], ['cama', 'Tu cama'], ['datos', 'Tus datos'], ['hecho', 'Confirmación']];
    const SUP = '<span class="r-sup">supuesto</span>';
    const AVISO = '<p class="r-fino r-aviso"><b>Demostración:</b> no se envía, no se guarda ni se cobra nada.</p>';

    function estadoDia(k) {
      const pers = personas();
      const o = { cls: [], dis: false, et: larga(k), libres: -1 };
      if (k < hoy || k > limite) { o.cls.push('pasado'); o.dis = true; o.et += k < hoy ? ', ya pasó' : ', fuera del calendario'; return o; }
      if (!abierta(k)) { o.cls.push('cerrado'); o.dis = true; o.et += ', cerrado (fuera de temporada)'; return o; }
      if (st.tipo === 'apto') {
        if (aptoOcupado(k)) { o.cls.push('completo'); o.dis = true; o.et += ', apartamento ocupado (de ejemplo)'; } else o.et += ', apartamento libre';
        return o;
      }
      o.libres = libresNoche(k);
      if (o.libres === 0) { o.cls.push('completo'); o.dis = true; o.et += ', completo (de ejemplo)'; }
      else if (o.libres < pers) { o.cls.push('corto'); o.dis = true; o.et += `, ${plural(o.libres, 'cama libre', 'camas libres')}: menos de las ${pers} que necesitáis`; }
      else o.et += `, ${plural(o.libres, 'cama libre', 'camas libres')}`;
      return o;
    }

    function mesHTML(y, m, tabK) {
      const primero = new Date(y, m, 1), dias = new Date(y, m + 1, 0).getDate();
      const off = (primero.getDay() + 6) % 7;
      const nombre = primero.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      let h = `<div class="r-mes"><h4 class="r-mes__tit">${nombre[0].toUpperCase() + nombre.slice(1)}</h4><div class="r-dias" role="group" aria-label="${nombre}">`;
      h += DSEM.map((d) => `<span class="r-dsem" aria-hidden="true">${d}</span>`).join('');
      for (let i = 0; i < off; i++) h += '<span class="r-vacio"></span>';
      const ns = new Set(noches());
      const fin = st.ini ? salida() : null;
      for (let d = 1; d <= dias; d++) {
        const k = `${y}-${pad(m + 1)}-${pad(d)}`;
        const e = estadoDia(k);
        const c = ['r-dia', ...e.cls];
        let et = e.et;
        if (ns.has(k)) { c.push('en-estancia'); if (k === st.ini) { c.push('ini'); et += ', llegada'; } else et += ', noche de vuestra estancia'; }
        if (k === fin) { c.push('sal'); et += ', día de salida'; }
        const barra = e.libres > 0 ? `<span class="r-dia__barra" style="--libre:${(e.libres / CAMAS.length).toFixed(2)}"></span>` : '';
        const tab = !e.dis && k === tabK ? '' : ' tabindex="-1"';
        h += `<button type="button" class="${c.join(' ')}" data-k="${k}" aria-label="${et}"${e.dis ? ' aria-disabled="true"' : ''}${ns.has(k) ? ' aria-pressed="true"' : ''}${tab}><span class="r-dia__n">${d}</span>${barra}</button>`;
      }
      return h + '</div></div>';
    }

    function desglose() {
      const c = cuenta();
      let d = '<div class="r-desglose">';
      if (!c.n) d += '<div class="r-nada">Elige una noche en el calendario.</div>';
      else {
        if (st.tipo === 'apto') d += `<div><span>${plural(c.n, 'noche', 'noches')} × ${eur(TARIFAS.apartamento)}</span><span>${eur(c.total)}</span></div>`;
        else d += `<div><span>${plural(c.n, 'noche', 'noches')} × ${plural(c.pers, 'cama', 'camas')} × ${eur(TARIFAS.litera)}</span><span>${eur(c.total)}</span></div>`;
        d += `<div class="r-tot"><span>Total estimado</span><span data-total data-eur="${c.total}" aria-live="polite">${eur(c.total)}</span></div>`;
      }
      return d + '</div>';
    }

    function resumen() {
      const c = cuenta();
      const alo = st.tipo === 'apto' ? 'Apartamento para dos' : `${plural(personas(), 'cama', 'camas')} en literas`;
      const camas = st.tipo === 'litera' && st.paso !== 'fechas'
        ? `<div><dt>Camas</dt><dd>${st.camas.length ? esc(textoCamas(false)) : '<i>aún sin elegir</i>'}</dd></div>` : '';
      return `<aside class="r-res" aria-label="Resumen de la estancia"><h3>Tu estancia</h3>
        <dl class="r-dl">
          <div><dt>Llegada</dt><dd>${st.ini ? `${corta(st.ini)} · desde las ${TARIFAS.entrada}` : '—'}</dd></div>
          <div><dt>Salida</dt><dd>${st.ini ? corta(salida()) : '—'}</dd></div>
          <div><dt>Noches</dt><dd>${c.n || '—'}</dd></div>
          <div><dt>Dónde</dt><dd>${alo}</dd></div>
          ${camas}
        </dl>
        ${desglose()}
        <p class="r-fino">Precios: ${eur(TARIFAS.litera)} la cama y ${eur(TARIFAS.apartamento)} el apartamento, por noche ${SUP}.</p>
      </aside>`;
    }

    function panelFechas() {
      const pers = personas(), apto = st.tipo === 'apto';
      const tabK = (() => {
        const vis = [[st.y, st.m], st.m === 11 ? [st.y + 1, 0] : [st.y, st.m + 1]];
        const dentro = (k) => vis.some(([y, m]) => +k.slice(0, 4) === y && +k.slice(5, 7) - 1 === m);
        if (st.ini && dentro(st.ini)) return st.ini;
        for (const [y, m] of vis) for (let d = 1; d <= new Date(y, m + 1, 0).getDate(); d++) { const k = `${y}-${pad(m + 1)}-${pad(d)}`; if (!estadoDia(k).dis) return k; }
        return null;
      })();
      const y2 = st.m === 11 ? st.y + 1 : st.y, m2 = (st.m + 1) % 12, actual = st.y * 12 + st.m;
      const maxN = st.ini ? maxNochesDesde(st.ini, pers, st.tipo) : 0;
      const listo = !!st.ini && estanciaOK(st.ini, st.n, pers, st.tipo);
      return `<h3 id="r-tit-paso" tabindex="-1">¿Cuándo y dónde duermes?</h3>
        <fieldset class="r-tipo"><legend>Dónde</legend>
          <button type="button" class="r-op" data-acc="tipo-litera" aria-pressed="${!apto}"><b>Una cama en literas</b><span>${eur(TARIFAS.litera)} por cama y noche ${SUP}</span></button>
          <button type="button" class="r-op" data-acc="tipo-apto" aria-pressed="${apto}"><b>Apartamento para dos</b><span>${eur(TARIFAS.apartamento)} por noche ${SUP}</span></button>
        </fieldset>
        <div class="r-fila">
          ${apto ? `<div class="r-cuenta"><small>Personas</small><b>2</b><span>el apartamento es para dos</span></div>`
          : `<div class="r-cuenta"><small>Camas · de 1 a ${CASA.maxPersonas}</small><b id="r-pers" aria-live="polite">${st.pers}</b>
            <button type="button" data-acc="menos" aria-label="Una cama menos"${st.pers <= 1 ? ' aria-disabled="true"' : ''}>−</button>
            <button type="button" data-acc="mas" aria-label="Una cama más"${st.pers >= CASA.maxPersonas ? ' aria-disabled="true"' : ''}>+</button></div>`}
          <div class="r-cuenta"><small>Noches</small><b id="r-noches" aria-live="polite">${st.ini ? st.n : '—'}</b>
            <button type="button" data-acc="menos-n" aria-label="Una noche menos"${st.n <= 1 ? ' aria-disabled="true"' : ''}>−</button>
            <button type="button" data-acc="mas-n" aria-label="Una noche más"${!st.ini || st.n >= maxN ? ' aria-disabled="true"' : ''}>+</button></div>
        </div>
        <div class="r-cal">
          <div class="r-top"><h4>Noches</h4>
            <button type="button" class="r-nav" data-acc="prev" aria-label="Mes anterior"${actual <= minMes ? ' aria-disabled="true"' : ''}>‹</button>
            <button type="button" class="r-nav" data-acc="next" aria-label="Mes siguiente"${actual + 1 >= maxMes ? ' aria-disabled="true"' : ''}>›</button></div>
          <div class="r-meses">${mesHTML(st.y, st.m, tabK)}${mesHTML(y2, m2, tabK)}</div>
          <div class="r-ley" aria-hidden="true"><span><i class="l-sel"></i>Tu estancia</span><span><i class="l-cerrado"></i>Cerrado (fuera de temporada)</span><span><i class="l-completo"></i>Completo (de ejemplo)</span>${apto ? '' : '<span><i class="l-barra"></i>Camas libres</span>'}</div>
          <p class="r-msg" aria-live="polite">${esc(st.msg)}</p>
        </div>
        <p class="r-fino">Abierto del 15 de abril al 3 de noviembre ${SUP}. Entrada desde las ${TARIFAS.entrada}. Las noches y camas ocupadas son de ejemplo.</p>
        <div class="r-acciones"><button type="button" class="r-btn" data-acc="seguir" aria-disabled="${!listo}">${apto ? 'Seguir: el apartamento' : (pers > 1 ? 'Seguir: elegir camas' : 'Seguir: elegir cama')}</button></div>`;
    }

    function puertaHTML(h) {
      const libres = libresHab(h), abierta_ = st.hab === h, sin = libres === 0;
      const num = `<svg viewBox="0 0 42 58" aria-hidden="true" focusable="false"><path d="${NUMEROS[h]}" filter="url(#sanchez-r-aspero)"/></svg>`;
      return `<button type="button" class="r-puerta${abierta_ ? ' abierta' : ''}${sin ? ' sin-camas' : ''}" data-hab="${h}" aria-expanded="${abierta_}" aria-controls="r-hab" aria-label="Habitación ${h}, ${sin ? 'sin camas libres esas noches' : plural(libres, 'cama libre', 'camas libres')}${abierta_ ? ', abierta' : ''}">
        <span class="r-puerta__marco"><span class="r-puerta__fondo" aria-hidden="true"></span><span class="r-puerta__hoja" aria-hidden="true"><span class="r-puerta__placa">${num}</span><span class="r-puerta__pomo"></span></span></span>
        <span class="r-puerta__txt"><b>Habitación ${h}</b><i>${sin ? 'completa' : plural(libres, 'cama libre', 'camas libres')}</i></span>
      </button>`;
    }
    function camaHTML(c, libres) {
      const libre = libres.has(c.id), sel = st.camas.includes(c.id);
      const estado = !libre ? 'ocupada' : sel ? 'elegida' : 'libre';
      return `<button type="button" class="r-cama${sel ? ' elegida' : ''}${!libre ? ' ocupada' : ''}" data-cama="${c.id}" data-l="${c.l}" data-p="${c.p}" aria-pressed="${sel}"${!libre ? ' aria-disabled="true"' : ''} aria-label="Habitación ${c.h}, litera ${c.l}, ${POS[c.p]}, ${estado}">
        <svg class="r-cama__ico" aria-hidden="true" focusable="false"><use href="#sanchez-r-${libre ? 'sabana' : 'mochila'}"/></svg>
        <span class="r-cama__txt"><b>${POS[c.p][0].toUpperCase() + POS[c.p].slice(1)}</b><i>${estado}</i></span>
      </button>`;
    }
    function habitacionHTML(h) {
      const libres = libresEstancia();
      let lit = '';
      for (let l = 1; l <= CASA.literasPorHab; l++) {
        lit += `<div class="r-lit" role="group" aria-label="Habitación ${h}, litera ${l}">${['a', 'b'].map((p) => camaHTML(camaPorId(`${h}-${l}-${p}`), libres)).join('')}</div>`;
      }
      return `<div class="r-hab__in" role="group" aria-label="Habitación ${h}, la pared del fondo vista de frente">
        <p class="r-hab__tit"><b>Habitación ${h}</b> · la pared del fondo, de frente · ${plural(CASA.literasPorHab, 'litera', 'literas')}, ${CASA.literasPorHab * 2} camas ${SUP}</p>
        <div class="r-pared"><span class="r-bombilla" aria-hidden="true"></span>
          <div class="r-literas"><span class="r-taq r-taq--a" aria-hidden="true"></span>${lit}<span class="r-taq r-taq--b" aria-hidden="true"></span></div>
          <span class="r-suelo" aria-hidden="true"></span></div>
      </div>`;
    }

    function panelCama() {
      const pers = personas();
      if (st.tipo === 'apto') {
        return `<h3 id="r-tit-paso" tabindex="-1">El apartamento</h3>
          <div class="r-apto"><p><b>Apartamento para dos personas</b>, para vosotros solos las ${plural(st.n, 'noche', 'noches')} que habéis elegido.</p>
          <p class="r-fino">Sus detalles (camas, baño, cocina, calefacción) <span class="r-sup">por confirmar</span> con el albergue: ahora mismo no constan.</p></div>
          <div class="r-acciones"><button type="button" class="r-btn" data-acc="a-datos">Seguir: tus datos</button><button type="button" class="r-btn r-btn--linea" data-acc="volver">Cambiar fechas</button></div>`;
      }
      const falta = pers - st.camas.length;
      return `<h3 id="r-tit-paso" tabindex="-1">${pers > 1 ? 'Vuestras camas' : 'Tu cama'}</h3>
        <p class="r-fino">Hay cuatro habitaciones. Abre una puerta y toca el colchón que quieras, arriba o abajo. ${pers > 1 ? `Necesitáis ${pers} camas (pueden estar en habitaciones distintas).` : ''}</p>
        <div class="r-puertas" role="group" aria-label="Habitaciones">${[1, 2, 3, 4].map(puertaHTML).join('')}</div>
        <div class="r-hab" id="r-hab">${st.hab ? habitacionHTML(st.hab) : '<p class="r-hab__vacio">Abre una puerta para ver sus literas.</p>'}</div>
        <p class="r-msg" aria-live="polite">${esc(st.msg)}</p>
        <p class="r-elegidas" aria-live="polite" data-elegidas="${st.camas.length}">${falta > 0 ? `Elegidas ${st.camas.length} de ${pers}.` : `Listo: ${plural(pers, 'cama elegida', 'camas elegidas')}.`}</p>
        <p class="r-fino">Dos literas por habitación (4 camas) ${SUP}: las fichas dicen cuatro dormitorios de cuatro plazas, pero las reseñas cuentan otra distribución. Las camas con mochila están ocupadas (de ejemplo).</p>
        <div class="r-acciones"><button type="button" class="r-btn" data-acc="a-datos" aria-disabled="${falta > 0}">Seguir: tus datos</button><button type="button" class="r-btn r-btn--linea" data-acc="volver">Cambiar fechas</button></div>`;
    }

    function horas() {
      const o = [];
      for (let h = 12; h <= 21; h++) for (const mm of ['00', '30']) { o.push(`${h}:${mm}`); }
      o.push('22:00');
      return o.map((v) => `<option value="${v}"${st.datos.hora === v ? ' selected' : ''}>${v}</option>`).join('') + `<option value="tarde"${st.datos.hora === 'tarde' ? ' selected' : ''}>Más tarde de las 22:00 (avisaré)</option>`;
    }
    function panelDatos() {
      const c = cuenta(), v = st.datos;
      return `<h3 id="r-tit-paso" tabindex="-1">Tus datos</h3>
        <p class="r-fino">${corta(st.ini)} → ${corta(salida())} · ${plural(c.n, 'noche', 'noches')} · ${st.tipo === 'apto' ? 'apartamento para dos' : esc(textoCamas(false))} · <b>${eur(c.total)}</b></p>
        <form class="r-form" id="r-form" novalidate>
          <label for="r-nombre">Nombre<input type="text" id="r-nombre" autocomplete="given-name" required value="${esc(v.nombre)}"></label>
          <label for="r-hora">Hora estimada de llegada <span>(se entra desde las ${TARIFAS.entrada})</span><select id="r-hora">${horas()}</select></label>
          <label class="r-check" for="r-bici"><input type="checkbox" id="r-bici"${v.bici ? ' checked' : ''}><span>Llevo bicicleta <small>(hay un lugar cerrado para guardarlas)</small></span></label>
          <p class="r-msg" id="r-error" aria-live="assertive"></p>
          <button type="submit" class="r-btn">Pedir la reserva</button>
          ${AVISO}
          <button type="button" class="r-btn r-btn--linea" data-acc="volver-cama">Volver</button>
        </form>`;
    }

    // el cartel de bienvenida: forma del de la entrada (panel amarillo de borde de arriba curvo, franja
    // blanca con tres flores, flecha azul). Si la web pasa `opciones.cartel`, ese lo sustituye.
    function datosCartel() {
      return {
        cuando: `Te esperamos el ${dia(st.ini)}`,
        donde: st.tipo === 'apto' ? 'Apartamento para dos' : textoCamas(true),
        entrada: `Entrada desde las ${TARIFAS.entrada}`
      };
    }
    function cartelHTML() {
      const t = datosCartel();
      const larga_ = t.donde.length > 34;
      return `<figure class="r-cartel${larga_ ? ' r-cartel--larga' : ''}" id="r-cartel">
        <svg viewBox="0 0 400 250" role="group" aria-label="Cartel de bienvenida" focusable="false">
          <path class="c-canto" d="M24 46 Q210 8 396 46 L396 232 Q396 244 384 244 L36 244 Q24 244 24 232 Z"/>
          <path class="c-panel" d="M14 46 Q200 8 386 46 L386 226 Q386 238 374 238 L26 238 Q14 238 14 226 Z"/>
          <path class="c-franja" d="M14 46 Q200 8 386 46 L386 74 Q200 38 14 74 Z"/>
          <use class="c-flor" href="#sanchez-r-flor" x="82" y="34" width="26" height="26"/>
          <use class="c-flor" href="#sanchez-r-flor" x="182" y="22" width="36" height="36"/>
          <foreignObject x="285" y="27" width="40" height="40"><span class="r-flor3" data-flor="3" aria-hidden="true"></span></foreignObject>
          <foreignObject x="30" y="78" width="340" height="132"><div class="r-cartel__txt">
            <p class="c1">${esc(t.cuando)}</p><p class="c2">${esc(t.donde)}</p><p class="c3">${esc(t.entrada)}</p></div></foreignObject>
          <path class="c-flecha" d="M98 219 Q74 217 50 220 M50 220 Q60 212 68 206 M50 220 Q62 225 70 232"/>
          <text class="c-rotulo" x="368" y="227" text-anchor="end">ALBERGUE TURÍSTICO</text>
        </svg></figure>`;
    }
    function panelHecho() {
      const c = cuenta();
      const camas = st.tipo === 'apto' ? 'Apartamento para dos' : textoCamas(false);
      return `<div class="r-conf"><h3 id="r-tit-paso" tabindex="-1">Reserva pedida <small>(de demostración)</small></h3>
        <div id="r-cartel-sitio">${cartelHTML()}</div>
        <p class="r-loc">Localizador <b id="r-loc">${st.loc}</b></p>
        <p>${larga(st.ini)} → ${larga(salida())}<br>${esc(camas)} · ${plural(c.n, 'noche', 'noches')} · ${eur(c.total)} ${SUP}${st.datos.bici ? '<br>Con bicicleta.' : ''}<br>Llegada estimada: ${st.datos.hora === 'tarde' ? 'más tarde de las 22:00' : st.datos.hora}</p>
        <div class="r-acciones"><button type="button" class="r-btn" data-acc="ics">Añadir al calendario</button><button type="button" class="r-btn r-btn--linea" data-acc="otra">Hacer otra reserva</button></div>
        <p class="r-fino" id="r-demo-hecho"><b>Demostración:</b> no se ha enviado, guardado ni cobrado nada, y esta reserva no existe en el albergue. El archivo del calendario se crea aquí, en tu navegador, y no se envía a ningún sitio.</p>
      </div>`;
    }

    function pintar(foco) {
      const iPaso = PASOS.findIndex((p) => p[0] === st.paso);
      const pasos = '<ol class="r-pasos" aria-label="Pasos">' + PASOS.map(([k, t], i) => `<li${i === iPaso ? ' aria-current="step"' : ''}${i < iPaso ? ' class="hecho"' : ''}>${t}</li>`).join('') + '</ol>';
      const panel = { fechas: panelFechas, cama: panelCama, datos: panelDatos, hecho: panelHecho }[st.paso]();
      const abrirAnim = movimiento && st.animarHab && st.hab;
      el.innerHTML = SPRITE + pasos + `<div class="r-in"><div class="r-main">${panel}</div>${resumen()}</div>`;
      el.dataset.movimiento = movimiento ? '1' : '0';
      el.dataset.paso = st.paso;
      if (abrirAnim) {
        const p = el.querySelector(`.r-puerta[data-hab="${st.hab}"]`), h = el.querySelector('.r-hab__in');
        if (p) p.classList.remove('abierta');
        if (h) h.classList.add('entra');
        requestAnimationFrame(() => requestAnimationFrame(() => { if (p) p.classList.add('abierta'); if (h) h.classList.remove('entra'); }));
      }
      st.animarHab = false;
      if (foco) {
        const x = el.querySelector(foco);
        if (x) x.focus({ preventScroll: true });
      }
      if (st.paso === 'hecho' && st.abrirFlor) { st.abrirFlor = false; abrirTerceraFlor(); }
    }

    /* ---------- tercera flor ---------- */
    function abrirTerceraFlor() {
      const sitio = el.querySelector('#r-cartel-sitio');
      const flor = sitio && sitio.querySelector('[data-flor="3"]');
      if (typeof opciones.cartel === 'function' && sitio) {
        try { opciones.cartel(sitio, Object.assign({ loc: st.loc, ini: st.ini, fin: salida() }, datosCartel())); } catch (e) { /* queda el cartel propio */ }
      }
      if (flor && flor.isConnected) {
        let hecho = false;
        if (Sanchez.cartel && typeof Sanchez.cartel.flor === 'function') {
          try { Sanchez.cartel.flor(flor, { abrir: true }); hecho = true; } catch (e) { hecho = false; }
        }
        if (!hecho || !flor.firstChild) {
          flor.innerHTML = `<svg viewBox="-20 -20 40 40" class="r-flor-abre" focusable="false">${PETALOS(8)}<circle r="3.2" class="fc"/></svg>`;
        }
        flor.dataset.abierta = '1';
      }
      try { document.dispatchEvent(new CustomEvent('sanchez:flor', { detail: { n: 3 } })); } catch (e) { /* sin eventos */ }
    }

    /* ---------- acciones ---------- */
    function irArriba() {
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.top > innerHeight * 0.6) el.scrollIntoView({ block: 'start', behavior: movimiento ? 'smooth' : 'auto' });
    }
    function guardarDatos() {
      const n = el.querySelector('#r-nombre');
      if (!n) return;
      st.datos.nombre = n.value;
      st.datos.hora = el.querySelector('#r-hora').value;
      st.datos.bici = el.querySelector('#r-bici').checked;
    }
    const deshabilitado = (b) => b.getAttribute('aria-disabled') === 'true' || b.disabled;

    function alClick(e) {
      const b = e.target.closest('button');
      if (!b || !el.contains(b)) return;
      if (b.dataset.k) { // un día
        if (st.paso !== 'fechas') return;
        if (deshabilitado(b)) { st.msg = 'Esa noche no se puede elegir: está cerrado, completo o no hay sitio para vosotros.'; pintar(`[data-k="${b.dataset.k}"]`); return; }
        const k = b.dataset.k, pers = personas();
        const mx = maxNochesDesde(k, pers, st.tipo);
        if (!mx) return;
        st.ini = k;
        st.msg = '';
        if (st.n > mx) { st.msg = `Desde esa noche solo caben ${plural(mx, 'noche', 'noches')}: lo hemos ajustado.`; st.n = mx; }
        ajustar();
        pintar(`[data-k="${k}"]`);
        return;
      }
      if (b.dataset.hab) { // una puerta
        const h = +b.dataset.hab;
        if (b.classList.contains('sin-camas')) { st.msg = `La habitación ${h} no tiene camas libres esas noches.`; st.hab = null; }
        else { st.msg = ''; st.hab = st.hab === h ? null : h; st.animarHab = !!st.hab; }
        pintar(`[data-hab="${h}"]`);
        return;
      }
      if (b.dataset.cama) { // un colchón
        if (deshabilitado(b)) { st.msg = 'Esa cama está ocupada (de ejemplo).'; pintar(`[data-cama="${b.dataset.cama}"]`); return; }
        const id = b.dataset.cama, pers = personas(), i = st.camas.indexOf(id);
        st.msg = '';
        if (i >= 0) st.camas.splice(i, 1);
        else if (pers === 1) st.camas = [id];
        else if (st.camas.length < pers) st.camas.push(id);
        else st.msg = `Ya habéis elegido ${pers} camas: quitad una para cambiarla.`;
        pintar(`[data-cama="${id}"]`);
        return;
      }
      const a = b.dataset.acc;
      if (!a) return;
      let foco = `[data-acc="${a}"]`;
      let irA = false;
      const pers = personas();
      if (a === 'prev') { if (st.y * 12 + st.m <= minMes) return; if (st.m === 0) { st.m = 11; st.y--; } else st.m--; }
      else if (a === 'next') { if (st.y * 12 + st.m + 1 >= maxMes) return; if (st.m === 11) { st.m = 0; st.y++; } else st.m++; }
      else if (a === 'tipo-litera' || a === 'tipo-apto') {
        const nuevo = a === 'tipo-apto' ? 'apto' : 'litera';
        if (nuevo !== st.tipo) { st.tipo = nuevo; st.msg = ''; ajustar(); }
      }
      else if (a === 'menos') { if (st.pers <= 1) return; st.pers--; st.msg = ''; ajustar(); }
      else if (a === 'mas') { if (st.pers >= CASA.maxPersonas) return; st.pers++; st.msg = ''; ajustar(); }
      else if (a === 'menos-n') { if (st.n <= 1) return; st.n--; st.msg = ''; ajustar(); }
      else if (a === 'mas-n') {
        if (!st.ini) return;
        if (st.n >= maxNochesDesde(st.ini, pers, st.tipo)) { st.msg = st.n >= TARIFAS.maxNoches ? `Aquí puedes reservar hasta ${TARIFAS.maxNoches} noches seguidas.` : 'La noche siguiente está cerrada o sin sitio: no se puede alargar.'; }
        else { st.n++; st.msg = ''; ajustar(); }
      }
      else if (a === 'seguir') {
        if (!st.ini || !estanciaOK(st.ini, st.n, pers, st.tipo)) { st.msg = 'Elige primero una noche libre en el calendario.'; }
        else { st.paso = 'cama'; st.msg = ''; foco = '#r-tit-paso'; irA = true; }
      }
      else if (a === 'a-datos') {
        if (st.tipo === 'litera' && st.camas.length < pers) { st.msg = `Faltan ${plural(pers - st.camas.length, 'cama', 'camas')} por elegir.`; foco = '[data-acc="a-datos"]'; }
        else { st.paso = 'datos'; st.msg = ''; foco = '#r-tit-paso'; irA = true; }
      }
      else if (a === 'volver') { st.paso = 'fechas'; st.msg = ''; foco = '#r-tit-paso'; irA = true; }
      else if (a === 'volver-cama') { guardarDatos(); st.paso = 'cama'; foco = '#r-tit-paso'; irA = true; }
      else if (a === 'otra') { Object.assign(st, { paso: 'fechas', camas: [], hab: null, msg: '', loc: '' }); st.datos = { nombre: '', hora: '18:00', bici: false }; foco = '#r-tit-paso'; irA = true; }
      else if (a === 'ics') { descargarICS(); return; }
      else return;
      pintar(foco);
      if (irA) irArriba();
    }

    function descargarICS() {
      const camas = st.tipo === 'apto' ? 'Apartamento para dos' : textoCamas(false);
      const hora = st.datos.hora === 'tarde' ? 'más tarde de las 22:00' : st.datos.hora;
      const texto = crearICS({
        loc: st.loc, ini: st.ini, fin: salida(),
        resumen: `Albergue Casa Sánchez (Grandas de Salime) · ${camas} · DEMOSTRACIÓN`,
        descripcion: `Reserva de DEMOSTRACIÓN: no existe en el albergue.\nLocalizador ${st.loc}.\n${camas}.\nEntrada desde las ${TARIFAS.entrada}; llegada estimada: ${hora}.\n${st.datos.bici ? 'Con bicicleta.\n' : ''}Albergue Casa Sánchez, ${DIRECCION}.`
      });
      st.ics = texto;
      const api = Sanchez.reserva;
      if (api) api.ultimoICS = texto;
      const url = URL.createObjectURL(new Blob([texto], { type: 'text/calendar;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url; a.download = `casa-sanchez-${st.loc.toLowerCase()}.ics`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }

    function alEnviar(e) {
      e.preventDefault();
      const f = e.target; if (f.id !== 'r-form') return;
      guardarDatos();
      const err = f.querySelector('#r-error'), campo = f.querySelector('#r-nombre');
      campo.removeAttribute('aria-invalid');
      if (!st.datos.nombre.trim()) {
        campo.setAttribute('aria-invalid', 'true');
        err.textContent = 'Falta tu nombre.';
        campo.focus();
        return;
      }
      // localizador CSA-AAMMDD-NNN (de la llegada). Demostración: no se guarda en ningún sitio.
      const semilla = dnum(st.ini) * 31 + st.n * 17 + personas() * 11 + st.datos.nombre.trim().length * 7 + st.camas.join('').length;
      st.loc = 'CSA-' + st.ini.slice(2).replace(/-/g, '') + '-' + String(Math.floor(h2(semilla, 4242) * 1000)).padStart(3, '0');
      st.paso = 'hecho';
      st.abrirFlor = true;
      pintar('#r-tit-paso');
      irArriba();
    }

    /* ---------- teclado ---------- */
    function alTeclado(e) {
      const t = e.target;
      const flechas = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      const mov = flechas[e.key];
      if (!mov) return;
      if (t.classList && t.classList.contains('r-dia')) { // calendario: ±1 día, ±7 días
        e.preventDefault();
        const k = mas(t.dataset.k, mov[0] + mov[1] * 7);
        const d = deClave(k), mes = d.getFullYear() * 12 + d.getMonth();
        if (mes < minMes || mes > maxMes) return;
        const vis0 = st.y * 12 + st.m;
        if (mes < vis0) { st.y = d.getFullYear(); st.m = d.getMonth(); }
        else if (mes > vis0 + 1) { st.y = d.getFullYear(); st.m = d.getMonth(); if (st.y * 12 + st.m + 1 > maxMes) { st.m--; if (st.m < 0) { st.m = 11; st.y--; } } }
        pintar(`[data-k="${k}"]`);
      } else if (t.classList && t.classList.contains('r-puerta')) {
        if (!mov[0]) return;
        e.preventDefault();
        const hs = [...el.querySelectorAll('.r-puerta')], i = hs.indexOf(t) + mov[0];
        if (hs[i]) hs[i].focus();
      } else if (t.classList && t.classList.contains('r-cama')) {
        e.preventDefault();
        const l = +t.dataset.l + mov[0], p = mov[1] ? (mov[1] < 0 ? 'a' : 'b') : t.dataset.p;
        const dest = el.querySelector(`.r-cama[data-l="${l}"][data-p="${p}"]`);
        if (dest) dest.focus();
      }
    }

    el.addEventListener('click', alClick);
    el.addEventListener('submit', alEnviar);
    el.addEventListener('keydown', alTeclado);

    /* ---------- arranque: la primera noche libre desde hoy, para una cama ---------- */
    for (let k = hoy; k <= limite; k = mas(k, 1)) {
      if (estanciaOK(k, 1, 1, 'litera')) { st.ini = k; const d = deClave(k); st.y = d.getFullYear(); st.m = d.getMonth(); break; }
    }
    if (st.y * 12 + st.m + 1 > maxMes) { st.m--; if (st.m < 0) { st.m = 11; st.y--; } }
    try { pintar(); } catch (err) { el.innerHTML = original; el.removeEventListener('click', alClick); el.removeEventListener('submit', alEnviar); el.removeEventListener('keydown', alTeclado); throw err; }
    el.dataset.montado = '1';

    const instancia = {
      destruir() {
        el.removeEventListener('click', alClick);
        el.removeEventListener('submit', alEnviar);
        el.removeEventListener('keydown', alTeclado);
        el.innerHTML = original;
        delete el.dataset.montado; delete el.dataset.movimiento; delete el.dataset.paso;
      },
      // para las pruebas (pruebas/reserva-prueba.mjs)
      prueba: { st, hoy, limite, cuenta, estanciaOK, nocheValida, libresNoche, camaOcupada, aptoOcupado, abierta, maxNochesDesde, crearICS, libresEstancia }
    };
    Sanchez.reserva.ultima = instancia;
    return instancia;
  }

  Sanchez.reserva = Object.assign(Sanchez.reserva || {}, { montar, TARIFAS, CASA, CAMAS, crearICS, ultima: null, ultimoICS: '' });
})();
