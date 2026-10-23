/* Genera los *.src.html de las páginas legales y el 404 con una plantilla común.
   Uso: node scripts/legales.mjs  (después, node construir.mjs)
   La titular NO consta (las fichas dicen «Particular» y nombran a Juan Magadán como encargado, pero
   ninguna fuente es del albergue): va como PENDIENTE visible, igual que el NIF y el registro. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const TITULAR = `<dl>
  <dt>Titular</dt><dd><span class="aviso-corto">PENDIENTE</span></dd>
  <dt>NIF</dt><dd><span class="aviso-corto">PENDIENTE</span></dd>
  <dt>Nombre comercial</dt><dd>Albergue Casa Sánchez</dd>
  <dt>Dirección</dt><dd>C/ El Salvador, s/n · 33730 Grandas de Salime (Asturias)</dd>
  <dt>Teléfonos</dt><dd><a href="tel:{{telefono_movil_tel}}">{{telefono_movil}}</a> · <a href="tel:{{telefono_fijo_tel}}">{{telefono_fijo}}</a></dd>
  <dt>Correo</dt><dd><a href="mailto:{{correo}}">{{correo}}</a> <span class="aviso-corto">por confirmar</span></dd>
  <dt>Actividad</dt><dd>Alojamiento turístico (albergue) y apartamento</dd>
  <dt>Registro de turismo</dt><dd><span class="aviso-corto">PENDIENTE</span></dd>
</dl>
<p class="aviso">PENDIENTE: confirmar quién es la titular y su NIF, cuál es el correo bueno (hay cuatro distintos en las fichas) y el número de registro de turismo del Principado de Asturias (no consta en ninguna fuente).</p>`;

const paginas = {
  'aviso-legal': {
    titulo: 'Aviso legal',
    cuerpo: `
<p>En cumplimiento del artículo 10 de la Ley 34/2002, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), estos son los datos de la titular de esta web:</p>
${TITULAR}
<h2>Uso de la web</h2>
<p>Esta web informa sobre el Albergue Casa Sánchez, en Grandas de Salime (Asturias). Los precios y las condiciones pueden cambiar: los que valen son los que se confirman al reservar.</p>
<p>Por ahora, la reserva de esta web es una demostración: las noches libres son de ejemplo, los precios son supuestos y no se envía, se guarda ni se cobra nada.</p>
<h2>Propiedad intelectual</h2>
<p>Los textos y las fotografías son del albergue o se usan con su permiso. Las letras League Spartan, Petrona y Rethink Sans se usan con su licencia libre (SIL Open Font License). Los datos de la etapa salen de OpenStreetMap (ODbL) y el tiempo de Open-Meteo.</p>
<p class="aviso">PENDIENTE: confirmar que todas las fotos son del albergue y se pueden usar (vienen de su ficha en un directorio y de su cuenta de Instagram) y el permiso de las personas que salen en alguna.</p>
<h2>Responsabilidad</h2>
<p>Los enlaces a otras webs (Google Maps, las reseñas de Google) llevan a servicios de terceros con sus propias condiciones. Las citas de huéspedes son literales y llevan su fuente.</p>
<h2>Ley aplicable</h2>
<p>Estas condiciones se rigen por la ley española. Para cualquier reclamación, llámanos: buscaremos siempre una solución amistosa.</p>`,
  },
  privacidad: {
    titulo: 'Política de privacidad',
    cuerpo: `
<h2>Responsable</h2>
${TITULAR}
<h2>Qué datos tratamos y para qué</h2>
<p>Los que nos das al reservar, al escribirnos o al llamarnos: nombre, teléfono, correo, las fechas y lo que quieras contarnos. Los usamos para gestionar tu reserva y atenderte.</p>
<p>Al alojarte, la ley obliga a registrar los datos de los viajeros y comunicarlos a las autoridades (Real Decreto 933/2021).</p>
<p>La reserva de esta web es, por ahora, una demostración: lo que escribas en ella no sale de tu navegador ni se guarda.</p>
<h2>Base legal y plazos</h2>
<p>La base es tu consentimiento al reservar, la ejecución de la reserva y, para el registro de viajeros, una obligación legal. Los datos se conservan mientras dura la relación y, después, el tiempo que exige la ley.</p>
<h2>Con quién se comparten</h2>
<p>Con nadie, salvo obligación legal (el registro de viajeros) y siempre con lo imprescindible.</p>
<h2>Tus derechos</h2>
<p>Puedes pedir el acceso, la rectificación, la supresión, la oposición, la limitación o la portabilidad de tus datos escribiendo a <a href="mailto:{{correo}}">{{correo}}</a> o llamando al <a href="tel:{{telefono_movil_tel}}">{{telefono_movil}}</a>. Si crees que no se han respetado, puedes reclamar ante la Agencia Española de Protección de Datos (<a href="https://www.aepd.es">aepd.es</a>).</p>
<h2>Lo que guarda esta web en tu navegador</h2>
<p>Dos cosas: <code>casasanchez-cookies</code> en el almacenamiento local, para recordar que ya has visto el aviso de cookies, y <code>casasanchez-tiempo</code> en el almacenamiento de la sesión, con el tiempo de ahora en Grandas durante 30 minutos. Más detalles en <a href="cookies.html">cookies</a>.</p>`,
  },
  cookies: {
    titulo: 'Política de cookies',
    cuerpo: `
<p>Esta web no usa cookies propias de análisis ni de publicidad.</p>
<h2>Lo que se guarda en tu navegador</h2>
<ul>
  <li><b>casasanchez-cookies</b> (almacenamiento local): recuerda que has visto el aviso, para no enseñártelo en cada visita. Es técnica y no caduca sola; puedes borrarla desde tu navegador.</li>
  <li><b>casasanchez-tiempo</b> (almacenamiento de la sesión): guarda 30 minutos el tiempo de ahora en Grandas, para no pedirlo en cada sección. Se borra al cerrar la pestaña.</li>
</ul>
<h2>Servicios de terceros</h2>
<ul>
  <li><b>Google Fonts</b>: las letras de la web (League Spartan, Petrona y Rethink Sans) se cargan desde los servidores de Google, que reciben tu dirección IP.</li>
  <li><b>Google Maps</b>: el mapa de «Cómo llegar» solo se carga si pulsas «Ver el mapa». A partir de ese momento, Google puede instalar sus cookies.</li>
  <li><b>Open-Meteo</b>: el jardín enseña el tiempo de ahora en Grandas. Tu navegador le pregunta a Open-Meteo por las coordenadas del albergue (no por las tuyas); Open-Meteo recibe tu dirección IP y no instala cookies.</li>
  <li><b>jsDelivr</b>: las librerías que suavizan el desplazamiento y mueven las animaciones (Lenis y GSAP) se descargan de jsDelivr, que recibe tu dirección IP. No instalan cookies.</li>
</ul>
<p>Puedes volver a ver el aviso desde «Preferencias de cookies», en el pie de la página.</p>`,
  },
  accesibilidad: {
    titulo: 'Declaración de accesibilidad',
    cuerpo: `
<p>La titular se compromete a que esta web sea accesible conforme a la norma UNE-EN 301 549 (nivel AA de las WCAG 2.1).</p>
<h2>Situación de cumplimiento</h2>
<p class="aviso">PENDIENTE: completar tras la revisión de accesibilidad previa a la publicación.</p>
<p>La web se ha construido para poder usarse entera con el teclado y con lector de pantalla: contrastes de al menos 4,5:1, foco visible (un contorno de 2 px y una flechita azul junto al elemento), textos alternativos en las fotos, formularios con etiquetas y animaciones que se desactivan si tu sistema pide reducir el movimiento. La flecha, el cartel y el jardín dibujado son un adorno: la información está también en el texto.</p>
<h2>La casa</h2>
<p class="aviso">PENDIENTE: confirmar la accesibilidad de la casa. La ficha del albergue dice «No hay información confirmada» y una reseña avisa de un escalón en un baño.</p>
<h2>Contacto</h2>
<p>Si encuentras una barrera, escribe a <a href="mailto:{{correo}}">{{correo}}</a> o llama al <a href="tel:{{telefono_movil_tel}}">{{telefono_movil}}</a>. Te responderemos y te daremos la información en un formato accesible.</p>`,
  },
};

const cabeza = (titulo) => `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo} · Albergue Casa Sánchez</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=League+Spartan:wght@700;800&family=Petrona:ital,wght@0,400;0,600;1,400&family=Rethink+Sans:wght@400;500;600&display=swap">
<link rel="stylesheet" href="css/estilos.css">
<link rel="stylesheet" href="css/legal.css">
<link rel="icon" href="marca/favicon.svg" type="image/svg+xml">
<link rel="icon" href="marca/favicon-32.png" sizes="32x32" type="image/png">
</head>`;

const MARCA = `<a class="marca" href="./" aria-label="Albergue Casa Sánchez, a la portada"><!--marca-cabecera--></a>`;

for (const [nombre, p] of Object.entries(paginas)) {
  const html = `${cabeza(p.titulo)}
<body>
<header class="legal-cab">
  <div class="env">
    ${MARCA}
    <a class="volver" href="./">Volver a la portada</a>
  </div>
</header>
<main class="legal">
  <div class="env">
    <h1>${p.titulo}</h1>
${p.cuerpo}
  </div>
</main>
<footer class="legal-pie">
  <div class="env">
    <a href="aviso-legal.html">Aviso legal</a>
    <a href="privacidad.html">Privacidad</a>
    <a href="cookies.html">Cookies</a>
    <a href="accesibilidad.html">Accesibilidad</a>
  </div>
</footer>
</body>
</html>
`;
  fs.writeFileSync(path.join(RAIZ, `${nombre}.src.html`), html);
  console.log(`${nombre}.src.html`);
}

// la 404 es de Groucho (dibujado a línea: img/groucho.svg, no un recorte de su foto)
fs.writeFileSync(path.join(RAIZ, '404.src.html'), `${cabeza('Página no encontrada')}
<body class="no-hay">
  <main class="no">
    <img class="no__groucho" src="img/groucho.svg" width="200" height="240" alt="Groucho, dibujado a línea: gafas redondas, cejas arqueadas, bigote y un puro">
    <h1>Esta página se ha ido sin avisar</h1>
    <p>No la encontramos. El albergue sigue donde estaba, en la calle El Salvador, y el jardín también.</p>
    <a class="btn btn--marca" href="./#jardin">Vuelve al jardín</a>
    <a href="./#reservar">Ver fechas</a>
  </main>
</body>
</html>
`);
console.log('404.src.html');
