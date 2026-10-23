/* ------------------------------------------------------------------
   Albergue Casa Sánchez · Grandas de Salime · «El cartel amarillo» · lo común de la página
   - Sanchez.tiempo(): el tiempo de ahora en Grandas (Open-Meteo, caché de 30 min en sessionStorage).
   - Sanchez.fecha(): la fecha de hoy o la de ?fecha=2027-04-20 (para probar el jardín).
   - Monta los módulos (cartel, flecha, jardín, etapa, reserva y cartel-pie) con su respaldo.
     Contrato: window.Sanchez.<mod>.montar(el, { movimiento, densidad: 'cartel'|'sobria', fecha, tiempo }).
   - Las flores del cartel: Sanchez.cartel.flor(el) al entrar cada sección + evento sanchez:flor { n }.
   - La cortina es de Entrada; el puente con ella está en partes/cabeza.html
     (Sanchez.abrir, Sanchez.retirarCortina, Sanchez.alAbrirse).
   - El simulador va en js/reserva.js (módulo Literas).
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  const raiz = document.documentElement;
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // «con-movimiento» solo sin movimiento reducido: si no, los textos que entran se quedarían escondidos
  const motion = !quieto;
  if (motion) raiz.classList.add('con-movimiento');
  const sobria = () => raiz.classList.contains('densidad-sobria');
  const params = new URLSearchParams(location.search);

  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const S = (window.Sanchez = window.Sanchez || {});
  const anno = $('#anno');
  if (anno) anno.textContent = new Date().getFullYear();

  // el resize de la barra del móvil (mismo ancho, poca altura) no rehace NADA
  let anchoVista = innerWidth, altoVista = innerHeight;
  const esBarra = () => innerWidth === anchoVista && Math.abs(innerHeight - altoVista) < 160;

  /* ============ 1. la fecha y el tiempo de ahora ============ */
  // ?fecha=2027-04-20 → ese día a mediodía (hora local); sin parámetro, ahora
  const fechaFija = (() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(params.get('fecha') || '');
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0);
    return isNaN(d) ? null : d;
  })();
  S.fecha = () => (fechaFija ? new Date(fechaFija) : new Date());

  const URL_TIEMPO = 'https://api.open-meteo.com/v1/forecast?latitude=43.218074&longitude=-6.876649&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day,precipitation&timezone=Europe%2FMadrid';
  const LLAVE_TIEMPO = 'casasanchez-tiempo';
  const CADUCA = 30 * 60 * 1000;
  const NOMBRE = (c) => (c === 0 ? 'despejado' : c <= 2 ? 'poco nuboso' : c === 3 ? 'cubierto' : c === 45 || c === 48 ? 'niebla' : c >= 51 && c <= 57 ? 'llovizna' : c >= 61 && c <= 67 ? 'lluvia' : c >= 71 && c <= 77 ? 'nieve' : c >= 80 && c <= 82 ? 'chubascos' : c === 85 || c === 86 ? 'nevadas' : c >= 95 ? 'tormenta' : 'variable');
  // Open-Meteo → { temp (°C), codigo (WMO), lluvia (mm; > 0 si llueve), nieve (bool), viento (km/h), nubes (0–1),
  //   humedad (%), esDeDia (bool), nombre (texto), fuente }
  function mapear(c, fuente) {
    const cod = +c.weather_code;
    const llueveCod = (cod >= 51 && cod <= 67) || (cod >= 80 && cod <= 82) || cod >= 95;
    const nieve = (cod >= 71 && cod <= 77) || cod === 85 || cod === 86;
    const mm = +c.precipitation || 0;
    const nubes = cod === 0 ? 0 : cod === 1 ? 0.2 : cod === 2 ? 0.5 : cod === 3 ? 0.9 : cod === 45 || cod === 48 ? 0.95 : 1;
    return {
      temp: Math.round(+c.temperature_2m * 10) / 10, codigo: cod, lluvia: mm > 0 ? mm : (llueveCod ? 0.1 : 0), nieve,
      viento: Math.round(+c.wind_speed_10m * 10) / 10, nubes, humedad: +c.relative_humidity_2m, esDeDia: +c.is_day === 1,
      nombre: NOMBRE(cod), fuente,
    };
  }
  // ?tiempo=lluvia|sol|nubes|viento para probar (no hay red: fuente 'open-meteo' con `simulado: true`)
  const SIM = {
    lluvia: { temperature_2m: 11, relative_humidity_2m: 92, weather_code: 63, wind_speed_10m: 12, is_day: 1, precipitation: 1.4 },
    sol: { temperature_2m: 21, relative_humidity_2m: 45, weather_code: 0, wind_speed_10m: 6, is_day: 1, precipitation: 0 },
    nubes: { temperature_2m: 14, relative_humidity_2m: 70, weather_code: 3, wind_speed_10m: 10, is_day: 1, precipitation: 0 },
    viento: { temperature_2m: 12, relative_humidity_2m: 60, weather_code: 2, wind_speed_10m: 42, is_day: 1, precipitation: 0 },
  };
  let promesaTiempo = null;
  const SUPUESTO = { temp: null, codigo: null, lluvia: 0, nieve: false, viento: 0, nubes: 0, humedad: null, esDeDia: true, nombre: '', fuente: 'supuesto' };
  S.tiempo = () => {
    if (promesaTiempo) return promesaTiempo;
    if (params.get('tiempo') === 'supuesto') return (promesaTiempo = Promise.resolve(Object.assign({}, SUPUESTO)));   // ?tiempo=supuesto: como si Open-Meteo fallara
    const sim = SIM[params.get('tiempo')];
    if (sim) return (promesaTiempo = Promise.resolve(Object.assign(mapear(sim, 'open-meteo'), { simulado: true })));
    promesaTiempo = (async () => {
      try {
        const g = sessionStorage.getItem(LLAVE_TIEMPO);
        if (g) { const o = JSON.parse(g); if (Date.now() - o.t < CADUCA && o.d) return o.d; }
      } catch (e) {}
      try {
        const ctl = typeof AbortController === 'function' ? new AbortController() : null;
        const corte = setTimeout(() => ctl && ctl.abort(), 6000);
        const r = await fetch(URL_TIEMPO, ctl ? { signal: ctl.signal } : undefined);
        clearTimeout(corte);
        if (!r.ok) throw new Error('Open-Meteo ' + r.status);
        const j = await r.json();
        if (!j.current) throw new Error('sin datos');
        const d = mapear(j.current, 'open-meteo');
        try { sessionStorage.setItem(LLAVE_TIEMPO, JSON.stringify({ t: Date.now(), d })); } catch (e) {}
        return d;
      } catch (e) {
        // sin red o sin respuesta: «supuesto»; los módulos NO pintan ninguna línea de «ahora»
        return Object.assign({}, SUPUESTO);
      }
    })();
    return promesaTiempo;
  };
  // se pide pronto para que la tengan los módulos cuando lleguen (una sola petición)
  const tiempoYa = { v: null };
  S.tiempo().then((t) => { tiempoYa.v = t; });

  /* ============ 2. entradas con el scroll ============ */
  const rev = $$('.rev');
  if (motion && 'IntersectionObserver' in window) {
    const vistos = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('es-visto'); vistos.unobserve(e.target); }
    }), { rootMargin: '0px 0px -6% 0px' });
    rev.forEach((el) => vistos.observe(el));
  } else rev.forEach((el) => el.classList.add('es-visto'));

  /* ============ 3. Lenis (y el ScrollTrigger de los módulos) ============ */
  const G = window.gsap, ST = window.ScrollTrigger;
  if (G && ST) G.registerPlugin(ST);
  let lenis = null;
  if (typeof Lenis !== 'undefined' && !quieto) {
    lenis = new Lenis({ duration: 1.1, smoothWheel: true, lerp: 0.11 });
    if (G && ST) {
      lenis.on('scroll', ST.update);
      G.ticker.add((t) => lenis.raf(t * 1000));
    } else {
      const bucle = (t) => { lenis.raf(t); requestAnimationFrame(bucle); };
      requestAnimationFrame(bucle);
    }
  }
  const cabAlto = () => parseFloat(getComputedStyle(raiz).getPropertyValue('--cab')) || 72;
  const irA = (sel) => {
    const el = typeof sel === 'string' ? $(sel) : sel;
    if (!el) return;
    const y = el.getBoundingClientRect().top + scrollY - cabAlto() - 8;
    if (lenis) lenis.scrollTo(y, { duration: 1.3 });
    else scrollTo({ top: y, behavior: quieto ? 'auto' : 'smooth' });
  };
  // los módulos llaman aquí para reservar: baja al simulador
  S.reservar = () => irA('#reservar');

  /* ============ 4. módulos: se montan al acercarse; el cartel de la portada, al abrirse la cortina ============ */
  // Si el JS de un módulo falla o no está, se queda el respaldo del HTML. Se guarda el respaldo para
  // volver a montar al cambiar de densidad.
  const montados = new Map();     // el → { inst, respaldo }
  const esperando = new Set();    // cerca de la pantalla, pero su JS aún no ha llegado
  const MOD = { cartel: 'cartel', 'cartel-pie': 'cartel', flecha: 'flecha', jardin: 'jardin', etapa: 'etapa', reserva: 'reserva' };
  const portadaCartel = $('#portada [data-modulo="cartel"]');
  const modulo = (el) => { const m = S[MOD[el.dataset.modulo]]; return m && typeof m.montar === 'function' ? m : null; };
  const opciones = (el) => {
    const nombre = el.dataset.modulo;
    const op = { movimiento: motion, densidad: sobria() ? 'sobria' : 'cartel', fecha: S.fecha() };
    if (params.has('sin-webgl')) op.sinWebgl = true;
    if (nombre === 'cartel') op.modo = 'portada';
    if (nombre === 'cartel-pie') op.modo = 'pie';
    if (nombre === 'jardin' && tiempoYa.v) op.tiempo = tiempoYa.v;
    if (nombre === 'reserva') op.fecha = fechaFija || undefined;
    return op;
  };
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  async function montarModulo(el) {
    if (montados.has(el)) return;
    const mod = modulo(el);
    if (!mod) { esperando.add(el); return; }
    esperando.delete(el);
    const respaldo = el.innerHTML;
    montados.set(el, { inst: null, respaldo });   // reservado ya: no se monta dos veces
    // el jardín espera (un instante) al tiempo para llegar con él
    if (el.dataset.modulo === 'jardin' && !tiempoYa.v) await Promise.race([S.tiempo(), esperar(1200)]);
    try {
      const inst = mod.montar(el, opciones(el));
      montados.set(el, { inst, respaldo });
      if (el.dataset.modulo === 'cartel-pie') avisarFloresAlPie();
    } catch (er) {
      console.warn('Módulo ' + el.dataset.modulo + ': se queda el respaldo', er);
      el.innerHTML = respaldo;
    }
  }
  const reintentar = () => { if (esperando.size) [...esperando].forEach(montarModulo); };
  addEventListener('load', () => { reintentar(); envolverFlor(); });
  document.addEventListener('sanchez:listo', () => { reintentar(); envolverFlor(); });
  function remontarTodos() {
    // sobre una copia: montar otra vez mete la entrada de nuevo en el Map
    [...montados].forEach(([el, { inst, respaldo }]) => {
      try { inst && inst.destruir && inst.destruir(); } catch (er) { console.warn(er); }
      el.innerHTML = respaldo;
      delete el.dataset.montado;
      montados.delete(el);
      montarModulo(el);
    });
    if (ST) ST.refresh();
  }
  if ('IntersectionObserver' in window) {
    const ioMod = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { ioMod.unobserve(e.target); montarModulo(e.target); }
    }), { rootMargin: '900px 0px' });
    $$('[data-modulo]').forEach((el) => { if (el !== portadaCartel) ioMod.observe(el); });
  } else $$('[data-modulo]').forEach((el) => { if (el !== portadaCartel) montarModulo(el); });
  // con el cartel montado, la portada deja sitio a la pieza (.con-cartel): el texto va debajo
  if (portadaCartel && 'MutationObserver' in window) {
    const sec = $('#portada');
    const mirar = () => sec.classList.toggle('con-cartel', portadaCartel.dataset.montado === '1');
    new MutationObserver(mirar).observe(portadaCartel, { attributes: true, attributeFilter: ['data-montado'] });
  }

  /* ============ 5. las flores del cartel ============ */
  // Sanchez.cartel.flor(el, { abrir }) abre una flor; la web la llama al entrar cada sección (1: la casa, 2: el jardín)
  // y lanza sanchez:flor { n } en document. La 3 la abre «Tu cama» al confirmar. Al llegar al pie, las que falten se avisan.
  const abiertas = new Set();
  S.floresAbiertas = () => [...abiertas];
  let florEnvuelta = false;
  function envolverFlor() {
    const c = S.cartel;
    if (florEnvuelta || !c || typeof c.flor !== 'function' || c.flor.__web) return;
    const orig = c.flor;
    c.flor = function (el, op) {
      const r = orig.apply(this, arguments);
      const n = el && el.dataset ? +el.dataset.flor : 0;
      if (n && (!op || op.abrir !== false)) avisarFlor(n);
      return r;
    };
    c.flor.__web = true;
    florEnvuelta = true;
  }
  function avisarFlor(n, alLlegar) {
    abiertas.add(n);
    document.dispatchEvent(new CustomEvent('sanchez:flor', { detail: { n, alLlegar: !!alLlegar } }));
  }
  function abrirFlor(el) {
    const n = +el.dataset.flor;
    if (!n || el.dataset.abierta === '1') return;
    el.dataset.abierta = '1';
    envolverFlor();
    if (S.cartel && typeof S.cartel.flor === 'function') {
      try { S.cartel.flor(el, { abrir: true, movimiento: motion, densidad: sobria() ? 'sobria' : 'cartel' }); if (abiertas.has(n)) return; } catch (er) { console.warn(er); }
    }
    avisarFlor(n);
  }
  const flores = $$('[data-flor]');
  if ('IntersectionObserver' in window) {
    const ioFlor = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      ioFlor.unobserve(e.target);
      if (+e.target.dataset.flor < 3) abrirFlor(e.target);
      // la 3 se enseña en capullo: la abre «Tu cama» al confirmar (o el pie, al llegar)
      else if (e.target.dataset.abierta !== '1' && S.cartel && typeof S.cartel.flor === 'function') { try { S.cartel.flor(e.target, { abrir: false, movimiento: motion, densidad: sobria() ? 'sobria' : 'cartel' }); } catch (er) { console.warn(er); } }
    }), { rootMargin: '-8% 0px -20% 0px' });
    flores.forEach((el) => ioFlor.observe(el));
  }
  // al llegar al pie, el cartel se completa aunque el lector no haya pasado por todas las secciones
  function avisarFloresAlPie() { [1, 2, 3].forEach((n) => { if (abiertas.has(n) || llegoAlPie) avisarFlor(n, true); }); }
  let llegoAlPie = false;
  const pie = $('#pie');
  if (pie && 'IntersectionObserver' in window) {
    const ioPie = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      ioPie.disconnect();
      llegoAlPie = true;
      [1, 2, 3].forEach((n) => { if (!abiertas.has(n)) avisarFlor(n, true); });
    }), { threshold: 0.15 });
    ioPie.observe(pie);
  }
  function abrirTodasLasFlores() { flores.forEach((el) => { abrirFlor(el); }); [1, 2, 3].forEach((n) => { if (!abiertas.has(n)) avisarFlor(n, true); }); }

  /* ============ 6. la cortina (de Entrada): alAbrirse() y su retirada ============ */
  const cortina = $('#cortina');
  S.alAbrirse(() => {
    $('#portada').classList.add('abierta');
    if (portadaCartel) montarModulo(portadaCartel);
  });
  let fuera = false;
  function alSalir() {
    if (fuera) return;
    fuera = true;
    if (cortina && !cortina.hidden && getComputedStyle(cortina).display !== 'none') cortina.hidden = true;
    if (lenis) lenis.start();
    if (G) G.ticker.lagSmoothing(0);      // al retirar la cortina, nunca antes
    if (ST) ST.refresh();
    mostrarCookies();
  }
  document.addEventListener('sanchez:fuera', alSalir);
  const retirarCortina = () => { S.retirarCortina(); alSalir(); };
  if (S.cortinaFuera) setTimeout(alSalir, 0);
  // si la cortina se esconde o desaparece por su cuenta, también cuenta como retirada
  if (cortina && 'MutationObserver' in window) {
    const mo = new MutationObserver(() => {
      if (!document.contains(cortina) || cortina.hidden || cortina.dataset.estado === 'fuera') { mo.disconnect(); retirarCortina(); }
    });
    mo.observe(document.body, { childList: true });
    mo.observe(cortina, { attributes: true, attributeFilter: ['hidden', 'data-estado'] });
  }

  /* ============ 7. cabecera, menú y anclas ============ */
  const cab = $('#cab');
  const btnMenu = $('#menu-btn'), menu = $('#menu-movil');
  const cerrarMenu = () => {
    document.body.classList.remove('menu');
    btnMenu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
    if (lenis) lenis.start();
  };
  btnMenu.addEventListener('click', () => {
    const abierto = document.body.classList.toggle('menu');
    btnMenu.setAttribute('aria-expanded', String(abierto));
    menu.setAttribute('aria-hidden', String(!abierto));
    if (lenis) abierto ? lenis.stop() : lenis.start();
  });
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const destino = a.getAttribute('href');
    if (destino.length < 2 || !$(destino)) return;
    e.preventDefault();
    cerrarMenu();
    irA(destino);
    setTimeout(() => {
      const t = $(destino);
      if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
      t.focus({ preventScroll: true });
    }, 1000);
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('menu')) { cerrarMenu(); btnMenu.focus(); } });

  /* ============ 8. cookies (y el mando se aparta mientras están) ============ */
  const ck = $('#cookies');
  const LLAVE = 'casasanchez-cookies';
  const leer = () => { try { return localStorage.getItem(LLAVE); } catch (e) { return null; } };
  const guardar = (v) => { try { localStorage.setItem(LLAVE, v); } catch (e) {} };
  const mando = $('#mando');
  const verMando = () => { if (mando && raiz.classList.contains('revision')) mando.hidden = !ck.hidden; };
  let cookiesPendientes = !leer();
  function mostrarCookies() {
    if (!cookiesPendientes) { verMando(); return; }
    cookiesPendientes = false;
    ck.hidden = false;
    verMando();
  }
  const cerrarCk = (v) => { guardar(v); ck.hidden = true; verMando(); };
  $('#ck-si').addEventListener('click', () => cerrarCk('si'));
  $('#ck-no').addEventListener('click', () => cerrarCk('no'));
  $('#abrir-cookies').addEventListener('click', () => { ck.hidden = false; verMando(); $('#ck-si').focus(); });

  // si la cortina expone su propio objeto (Sanchez.cortina), se engancha a él (también después de las cookies: alRetirarse puede llegar ya)
  if (S.cortina && typeof S.cortina.alAbrirse === 'function') S.cortina.alAbrirse(() => S.abrir());
  if (S.cortina && typeof S.cortina.alRetirarse === 'function') S.cortina.alRetirarse(() => retirarCortina());
  // sin cortina (o con movimiento reducido): fuera ya. Va aquí, después de las cookies, que alSalir() usa.
  if (!cortina || !motion) retirarCortina();
  // red de seguridad propia por si la cortina se atasca
  setTimeout(retirarCortina, 7000);

  /* ============ 9. mapa de Google solo al pedirlo ============ */
  const btnMapa = $('#mapa-btn');
  if (btnMapa) btnMapa.addEventListener('click', () => {
    const marco = document.createElement('iframe');
    marco.src = 'https://www.google.com/maps?q=' + encodeURIComponent('43.218074,-6.876649') + '&z=16&output=embed';
    marco.loading = 'lazy';
    marco.title = 'Mapa con el Albergue Casa Sánchez en Grandas de Salime';
    marco.referrerPolicy = 'no-referrer-when-downgrade';
    $('#mapa').appendChild(marco);
    $('#mapa-consent').remove();
  });

  /* ============ 10. visor de fotos: se abre por el NOMBRE de la foto ============ */
  const visor = $('#visor');
  const vImg = $('#visor-img'), vPie = $('#visor-pie'), vN = $('#visor-n');
  // la serie se hace de la MISMA lista de miniaturas, sin repetir nombres
  function serie() {
    const vistas = new Map();
    $$('[data-visor]').forEach((b) => {
      const n = b.dataset.visor;
      if (vistas.has(n)) return;
      const img = b.querySelector('img');
      if (!img) return;
      const anchos = (img.getAttribute('srcset') || '').split(',').map((x) => parseInt(x.trim().split(/\s+/)[1], 10)).filter(Boolean).sort((a, z) => a - z);
      const pie = b.closest('figure, article, li')?.querySelector('figcaption, h3');
      vistas.set(n, { n, alt: img.alt, pie: pie ? pie.textContent.replace(/\s+/g, ' ').trim() : img.alt, anchos: anchos.length ? anchos : [800], ancho: +img.getAttribute('width') || 1024, alto: +img.getAttribute('height') || 768 });
    });
    return [...vistas.values()];
  }
  let lista = [], actual = 0, origen = null;
  function poner(i) {
    actual = (i + lista.length) % lista.length;
    const f = lista[actual];
    const peq = f.anchos.includes(800) ? 800 : f.anchos[0], gran = f.anchos[f.anchos.length - 1];
    // primero la de 800 (o la menor, ya en caché), y la grande al cargar
    vImg.src = `img/fotos/${f.n}-${peq}.jpg`;
    vImg.dataset.nombre = f.n;
    vImg.alt = f.alt;
    vImg.width = f.ancho; vImg.height = f.alto;
    vImg.style.setProperty('--nat', f.ancho + 'px');
    if (gran !== peq) {
      const grande = new Image();
      grande.onload = () => { if (vImg.dataset.nombre === f.n) vImg.src = grande.src; };
      grande.src = `img/fotos/${f.n}-${gran}.jpg`;
    }
    vPie.textContent = f.pie;
    vN.textContent = (actual + 1) + ' / ' + lista.length;
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-visor]');
    if (!b || !visor || typeof visor.showModal !== 'function') return;
    lista = serie();
    const i = lista.findIndex((f) => f.n === b.dataset.visor);
    if (i < 0) return;
    origen = b;
    poner(i);
    visor.showModal();
    if (lenis) lenis.stop();
  });
  if (visor) {
    $('#visor-ant').addEventListener('click', () => poner(actual - 1));
    $('#visor-sig').addEventListener('click', () => poner(actual + 1));
    $('#visor-cerrar').addEventListener('click', () => visor.close());
    visor.addEventListener('click', (e) => { if (e.target === visor || e.target.classList.contains('visor__fig')) visor.close(); });
    visor.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') poner(actual - 1); else if (e.key === 'ArrowRight') poner(actual + 1); });
    visor.addEventListener('close', () => { if (lenis) lenis.start(); if (origen) origen.focus({ preventScroll: true }); });
  }

  /* ============ 11. el foco del teclado: contorno de 2 px y una flechita azul a brochazo junto al elemento ============ */
  const flechaFoco = $('#foco-flecha');
  let enfocado = null;
  function ponerFlecha() {
    if (!flechaFoco) return;
    const el = enfocado;
    if (!el || !document.contains(el) || el.closest('dialog')) { flechaFoco.classList.remove('es-visible'); return; }
    const r = el.getBoundingClientRect();
    if (!r.width) { flechaFoco.classList.remove('es-visible'); return; }
    // fija en la ventana (position:fixed): a la izquierda del elemento, señalándolo; si no cabe, justo debajo
    const w = 40, h = 25;
    let x = r.left - w - 6, y = r.top + r.height / 2 - h / 2;
    if (x < 3) { x = Math.max(3, r.left); y = r.bottom + 5; }
    flechaFoco.style.transform = 'translate(' + Math.round(x) + 'px, ' + Math.round(y) + 'px)';
    flechaFoco.classList.add('es-visible');
  }
  // :focus-visible se decide al terminar de moverse el foco: se mira un instante después
  let tFoco = 0;
  const mirarFoco = () => {
    clearTimeout(tFoco);
    tFoco = setTimeout(() => {
      const el = document.activeElement;
      let visible = false;
      try { visible = !!el && el !== document.body && el.matches(':focus-visible'); } catch (er) {}
      enfocado = visible ? el : null;
      ponerFlecha();
    }, 0);
  };
  document.addEventListener('focusin', mirarFoco);
  document.addEventListener('focusout', mirarFoco);

  /* ============ 12. con el scroll: cabecera y módulos que esperan ============ */
  let pend = 0;
  function alScroll() {
    pend = 0;
    cab.classList.toggle('sc', scrollY > 24);
    reintentar();
    if (enfocado) ponerFlecha();
  }
  addEventListener('scroll', () => { if (!pend) pend = requestAnimationFrame(alScroll); }, { passive: true });
  alScroll();

  /* ============ 13. MANDO DE MAQUETA (no viaja al cliente) ============ */
  if (mando && raiz.classList.contains('revision')) {
    const botones = $$('button[data-densidad]', mando);
    const pintarMando = () => botones.forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.densidad === 'sobria') === sobria())));
    botones.forEach((b) => b.addEventListener('click', () => {
      const antes = sobria();
      raiz.classList.toggle('densidad-sobria', b.dataset.densidad === 'sobria');
      const u = new URL(location.href);
      if (b.dataset.densidad === 'sobria') u.searchParams.set('densidad', 'sobria'); else u.searchParams.delete('densidad');
      history.replaceState(null, '', u);
      pintarMando();
      if (antes === sobria()) return;
      remontarTodos();
      if (sobria()) abrirTodasLasFlores();
      document.dispatchEvent(new CustomEvent('sanchez:densidad', { detail: sobria() ? 'sobria' : 'cartel' }));
    }));
    pintarMando();
    verMando();
  }
  /* fin del MANDO DE MAQUETA */
  // la sobria: las flores ya abiertas desde el principio
  if (sobria()) abrirTodasLasFlores();

  /* ============ 14. resize de verdad (no el de la barra del móvil) ============ */
  let tRes = 0;
  addEventListener('resize', () => {
    if (esBarra()) return;
    clearTimeout(tRes);
    tRes = setTimeout(() => {
      anchoVista = innerWidth; altoVista = innerHeight;
      document.dispatchEvent(new CustomEvent('sanchez:resize'));
      ponerFlecha();
    }, 200);
  });

  // lo que pueden usar los módulos y las pruebas
  S.web = {
    motion, quieto, sobria, lenis, irA, montados, params,
    alAbrirse: S.alAbrirse, abrir: S.abrir, retirarCortina,
    get fuera() { return fuera; }, get altoVista() { return altoVista; },
  };
  document.dispatchEvent(new CustomEvent('sanchez:web'));
})();
