# Albergue Casa Sánchez · Grandas de Salime (Asturias) · «El cartel amarillo»

Web nueva para un albergue real del Camino Primitivo que no la ha encargado: hoy solo tiene fichas en directorios e Instagram. Es una propuesta que Álvaro les enseñará. En local, con `noindex, nofollow` en todas las páginas, sin publicar y sin commits.

- **Datos y fuentes:** `ref/DATOS-CASA-SANCHEZ.md`; fotos: `ref/FOTOS.md`. Lo que no está ahí no se afirma: va a `PENDIENTES.md` o sale como «por confirmar».
- **Encargo:** `ENCARGO.md` (cinco agentes: Web, Entrada, Jardín, Ruta y Literas). **Sin 3D** (decisión de Álvaro, 2026-10-23).
- **Una sola página** (`index.html`) más legales y 404. **Solo castellano.** Los nombres propios, como son.

## Concepto

La marca de la casa es **el cartel de la entrada**, clavado en la cerca de palos delante del jardín: panel amarillo, tres flores, «Casa Sánchez» manuscrita, una vieira con un peregrino, una flecha azul y «ALBERGUE TURÍSTICO». Ese cartel es el sistema de toda la web:

- **El amarillo** (`#E0BF50`, medido) es la superficie de la portada y de las opiniones; el **pardo** (`#412B21`) es la tinta; el **oro** (`#A37F31`), la letra manuscrita y las flores; el **azul** (`#291886`), **solo** la flecha, el foco del teclado y el botón principal.
- **La pizarra, la piedra y la madera** de la casa son las otras superficies: dentro, el embalse, el pie, y el fondo de las flechas.
- **Portada:** la pantalla es el cartel y, al bajar, resulta que está clavado delante del jardín real (módulo Entrada).
- **Hilo:** una flecha azul a brochazo guía de sección en sección (6 flechas, módulo Entrada).
- **Flores:** las tres flores del cartel se abren en «La casa», «El jardín» y al confirmar la reserva; en el pie el cartel está completo.

### La página, de arriba abajo

| # | Sección | Quién | Qué lleva |
|---|---|---|---|
| — | **Cortina «La flecha»** | Entrada | Pizarra, un brochazo azul pinta la flecha y el amarillo del cartel destapa la portada (`partes/cortina.html`). |
| 1 | **Portada «El cartel»** | Entrada + Web | El cartel vectorial que se aleja hasta la foto real; girar la flecha. Respaldo de la web: `entrada-cartel` en un marco con forma de panel, titular, «Ver fechas» y teléfono. |
| 2 | **La casa** (+ flor 1) | Web | Casa baja de piedra y pizarra junto al parque, abierta en 2016; fotos; Juan («lo mejor del albergue es Juan», con su fuente); cifras. |
| — | *De un vistazo* | Web | Solo en la sobria: plazas, baños, precios, temporada, entrada, lo que hay y lo que no, y la siguiente etapa. |
| 3 | **El jardín de hoy** (+ flor 2) | Jardín | La lámina que cambia con la estación y el tiempo. Respaldo de la web: la foto, lo que crece, el regueiro, tres citas y las cuatro estaciones en fotos. |
| 4 | **Dentro** | Web | Literas, baños, cocina, salón, lavadero; **lo que hay y lo que no hay**; el guiño de Groucho; el apartamento para dos; precios y temporada. |
| 5 | **La etapa** | Ruta | El perfil de Berducedo a Grandas con una flecha que baja con el scroll (2D). Respaldo: resumen con las cifras de Gronze. |
| 6 | **El embalse y la presa** | Web | Franja corta con la foto `embalse` y los datos de la presa (128 m, 1955, los Vaquero). |
| 7 | **El pueblo** | Web | Servicios con nombre y distancia, qué ver el día de descanso y la etapa siguiente. |
| 8 | **Lo que dicen** | Web | Seis citas literales (nombre de pila, fuente, mes y año) como carteles amarillos y la nota de Google (4,2 con 105 reseñas). |
| 9 | **Reservar · «Tu cama»** (+ flor 3) | Literas | Simulador de DEMOSTRACIÓN por cama y noche, o el apartamento. |
| 10 | **Cómo llegar** | Web | Dirección, teléfonos, correo y el mapa de Google solo al pedirlo. |
| 11 | **Pie: el cartel completo** | Entrada + Web | El cartel con las tres flores abiertas sobre la madera de la cerca; legales. |

**§5 bis:** fuera la pila sticky de tarjetas y el marquee; gesto táctil del hero (**girar la flecha**, Entrada); el objeto que se completa en el pie (**el cartel con sus tres flores**); **foco del teclado con forma propia** (contorno de 2 px y una flechita azul junto al elemento, `#foco-flecha`, lo coloca `main.js`); LCP medido abajo. Sin cursor propio.

**Lo que NO está aquí (lo usan otras webs del Camino):** ningún sello, tampón ni credencial; ninguna planta cenital; ninguna línea de ruta que avance en 3D; sin niebla; sin tela ni tendedero; sin luz por la hora como sistema de color.

## Paleta y letras

| Token | Color | Uso |
|---|---|---|
| `--amarillo` | `#E0BF50` (sombra `#D8B241`, sol `#E8CA5F`) | Superficie: portada, opiniones. Nunca texto pequeño sobre blanco. |
| `--pardo` | `#412B21` | La tinta. Nunca negro puro. |
| `--oro` / `--oro-texto` | `#A37F31` / `color-mix(oro 55 %, pardo)` = `#77592A` | La letra manuscrita y las flores; el acento de texto sobre cal. |
| `--azul` | `#291886` | **Solo** la flecha, el foco y el botón principal. |
| `--pizarra` / `--pizarra-2` | `#33373C` / `#4A4F55` | El tejado: «Dentro» y «Cómo llegar». |
| `--piedra` | `#B9AE9C` | El muro: el embalse. |
| `--madera` / `--madera-2` | `#7A5236` / `#5E3F29` | La cerca: fondo de las flechas / el pie. |
| `--cal` / `--cal-2` | `#F5F0E6` / `#EBE3D1` | Papel claro. |
| `--hoja` | `#4F7A3A` | El verde del jardín: solo en el módulo Jardín. |

**Letras** (Google Fonts, `display=swap`): **League Spartan** 700–800 (titulares), **Petrona** 400, 600 y cursiva (citas, voz, cifras) y **Rethink Sans** 400–600 (texto). Comprobado con `grep` de `family=`: Petrona y Rethink Sans las usan solo dos plantillas ficticias (camping y quesería); League Spartan, ninguna web. Los módulos leen `--f-titulo`, `--f-voz`, `--f-texto` y el alias `--f-txt`. «Casa Sánchez» de la cabecera **no es una fuente**: es `marca/letra.svg`, sacada del vector del cartel.

## Cómo se trabaja

- **Edita siempre los `*.src.html` o las `partes/`** (cabeza, cabecera, reserva, llegar, pie y guiones; la cortina es de Entrada). `node construir.mjs`:
  1. incluye las partes (`<!--parte:…-->`);
  2. sustituye `{{clave}}` con **`datos.json`** (precios, temporada, teléfonos, correo: **un solo sitio**);
  3. convierte `<img data-foto>` en `<picture>` AVIF/WebP/JPG;
  4. pone «Casa Sánchez» con la letra del cartel en la cabecera (`<!--marca-cabecera-->`, de `marca/letra.svg`);
  5. **quita los `<link>`/`<script>` propios que aún no existan** (con aviso);
  6. pone `?v=<huella>` (`versionar.mjs`). Recuerda «Ctrl+F5» si se publica.
- **Fotos:** `scripts/fotos-lista.json` + `node scripts/fotos.mjs` (o `node scripts/fotos.mjs cocina salon` para unas pocas). Lee de `ref/fotos/directorio` y `ref/fotos/instagram`; si de una foto de Instagram hay versión de 1080 px en `ref/fotos/instagram/grandes/`, usa esa. Gradación común (menos saturación, aún menos en verdes y fucsias, negros más suaves; las de dentro, medio balance de blancos). **Nunca amplía.** `img/fotos/fotos.json` lleva el tamaño de salida y el de origen. **`entrada-cartel` sale entera y sin recorte** (1080×1080) para que las esquinas del cartel medidas por Entrada (`marca/cartel-esquinas.json`, en píxeles de la foto original) valgan al escalarlas. El `regueiro` va recortado **solo al canal** (hay dos personas en la foto).
- **Marca:** `node scripts/marca.mjs` → desde `marca/cartel.svg`: `marca/letra.svg` + `letra.json` (solo `#letra-casa` y `#letra-sanchez`, sin las máscaras del trazo), favicons (la flor central `#flor-2` sobre amarillo) e `img/og.jpg`. Sin vector, usa el cartel de la foto y la cabecera lleva el texto. **Si cambia el vector: `node scripts/marca.mjs && node construir.mjs`.**
- **Legales y 404:** `node scripts/legales.mjs` y después `node construir.mjs`. La 404 es de Groucho **dibujado a línea** (`img/groucho.svg`), no un recorte de su retrato.
- **`node verificar.mjs`** (puerto 8891, una vez al terminar; sin capturas; navegador con `--disable-3d-apis` y la página con `?sin-webgl`).
- **`node scripts/rendimiento.mjs`** (puerto 8892): móvil de gama media (Pixel 7, 4G lento, CPU ×4).
- **`node scripts/probar-borrado-mando.mjs`**: comprueba la receta de borrado del mando.
- Antes de lanzar cualquier prueba: `Get-CimInstance Win32_Process -Filter "Name='chrome-headless-shell.exe'"`; una a la vez; matar solo por PID.

## Contrato con los módulos

- `window.Sanchez.<mod>.montar(el, { movimiento, densidad: 'cartel'|'sobria', fecha, tiempo })` → `{ destruir() }`, con `<mod>` = `cartel` (portada y `cartel-pie`), `flecha`, `jardin`, `etapa` y `reserva`. El HTML de `el` es el respaldo. `main.js` monta **al acercarse** (900 px de margen) y **el cartel de la portada, en `Sanchez.alAbrirse`**. A `cartel` y `cartel-pie` les pasa además `modo: 'portada'|'pie'`. Si el JS de un módulo no ha llegado, vuelve a intentarlo al `load`, con `sanchez:listo` y con el scroll. Al cambiar de densidad: `destruir()`, devuelve el respaldo y vuelve a montar. Con el cartel montado, la portada recibe la clase `.con-cartel` (el texto va debajo de la pieza).
- **La cortina:** el puente está en `partes/cabeza.html`: `Sanchez.alAbrirse(fn)`, `Sanchez.abrir()`, `Sanchez.retirarCortina()`; escucha `sanchez:cortina-abre` / `sanchez:cortina-fuera` y, si existe, `Sanchez.cortina.alAbrirse/alRetirarse`. Redes de seguridad: 6,5 s en la cabeza y 7 s en `main.js`.
- **El tiempo** — `Sanchez.tiempo()` → promesa con `{ temp (°C), codigo (WMO), lluvia (mm, > 0 si llueve), nieve (bool), viento (km/h), nubes (0–1), humedad (%), esDeDia (bool), nombre (texto), fuente: 'open-meteo'|'supuesto' }`. Una sola petición a Open-Meteo con la URL de DATOS, caché de 30 min en `sessionStorage` (`casasanchez-tiempo`), con `try/catch`. Si falla, `fuente: 'supuesto'` y `temp: null`: **ningún módulo pinta una línea de «ahora»**. Para probar: `?tiempo=lluvia|sol|nubes|viento` (con `simulado: true`) y `?tiempo=supuesto`. `?fecha=2027-04-20` cambia `Sanchez.fecha()` (el día a mediodía).
- **Las flores:** `Sanchez.cartel.flor(el, { abrir })`. La web la llama al entrar en «La casa» y «El jardín» y lanza `sanchez:flor` con `{ n }` en `document`; la 3 la abre «Tu cama» al confirmar (la web envuelve `cartel.flor` para avisar de toda flor que se abra). Al llegar al pie se avisan las que falten (`alLlegar: true`). `Sanchez.floresAbiertas()` dice cuáles van abiertas (para un pie que se monte tarde). En la sobria, las tres, desde el principio.
- **Reservar:** `Sanchez.reservar()` baja al simulador. Los supuestos del motor (tarifas, reparto de literas, ocupación de ejemplo, hora de salida) están en `js/reserva.js` y en `PENDIENTES.md`.
- **Fotos por nombre:** `img/fotos/<nombre>-<ancho>.jpg|webp|avif`.

## Mando de densidades (solo con `?revision`)

- **«Cartel»:** la flecha pintándose, las flores abriéndose, el jardín vivo, la cámara que se aleja.
- **«Sobria»:** el cartel ya pintado, las flechas ya pintadas, el jardín quieto en su estación y las tres flores abiertas; **añade** la tabla «Casa Sánchez, de un vistazo».

### Receta de borrado del mando

1. En `partes/cabeza.html`, en el script, el `try { … }` de `// MANDO DE MAQUETA`.
2. En `partes/pie.html`, el bloque `<!-- MANDO DE MAQUETA` … `<!-- fin del MANDO DE MAQUETA -->`.
3. En `js/main.js`, el bloque `13. MANDO DE MAQUETA` hasta `fin del MANDO DE MAQUETA`.
4. Opcional: `.mando` y `.vistazo` en `css/estilos.css` y la sección `#vistazo` de `index.src.html`.
5. `node construir.mjs`. (`node scripts/probar-borrado-mando.mjs` lo comprueba en memoria.)

## Supuestos y datos dudosos (un solo sitio: `datos.json`)

Precios y temporada son **supuestos** porque las fuentes se contradicen (`ref/DATOS-CASA-SANCHEZ.md`, «Contradicciones»): `datos.json` lleva la fuente más reciente (litera **20 €**, apartamento **90 €**, **15 de abril – 3 de noviembre**, ficha de 19-10-2026) y el texto los marca «por confirmar». El motor de reservas tiene los suyos (`TARIFAS` en `js/reserva.js`). Lo demás, en `PENDIENTES.md`.

## Qué mirar en Chrome

(La comprobación automática no mira nada con la tarjeta gráfica ni hace capturas: esto lo ves tú.)

- **Portada y cortina** (Entrada): la flecha que se pinta, el amarillo que destapa, el cartel vectorial que se aleja hasta la foto real y encaja con sus cuatro esquinas, girar la flecha con el ratón, el dedo y las flechas del teclado. En móvil, que la sección fijada no pase de 1,6 pantallas. Sin su módulo, el respaldo es la foto en su marco.
- **La cabecera:** «Casa Sánchez» con la letra del cartel (sale del mismo vector) y, en móvil, el menú con blur.
- **El hilo:** las 6 flechas azules sobre pizarra, piedra y madera; que no parezcan copiadas.
- **Las flores:** que se abran en «La casa» y «El jardín», que la tercera se abra al confirmar la reserva y que el pie las tenga abiertas las tres, incluso bajando de golpe.
- **El jardín** (la lámina): el parecido con las fotos (dudas: la hamaca, las tumbonas y las flores de la magnolia), el paralaje y sacudir los árboles; con `?fecha=2027-04-20`, `2026-07-15`, `2026-10-23`, `2026-12-15` (cerrado: «Volvemos…») y `2027-03-28`; con `?tiempo=lluvia|sol|nubes|viento|supuesto` (con `supuesto` no sale la línea de «ahora»); el botón «Ver la foto de verdad»; y que la lámina quede cuadrada en el móvil.
- **«La etapa»:** que la flecha baje con el scroll por el perfil y los contadores cuadren con la tabla (con `file://` no monta: usa un servidor).
- **«Tu cama»:** las 4 puertas, abrir una y elegir arriba o abajo, el apartamento, el cartel de bienvenida y la tercera flor.
- **«Dentro»:** las fotos de dentro son de 2017 y pequeñas (si alguna se ve rara), y el guiño de Groucho (dibujado a línea).
- **El embalse:** la franja corta con la foto y los datos de la presa.
- **«Lo que dicen»:** las citas como carteles amarillos.
- **El mando** con `?revision`: las dos versiones; la sobria con su tabla.
- **El foco del teclado** (Tab): el contorno de 2 px y la flechita azul, también sobre la pizarra y la madera.
- **Fotos pequeñas:** casi todas son de 640 o 900 px; si alguna se ve blanda, hay que pedir fotos nuevas (PENDIENTES).
- **Sin JavaScript** y **con movimiento reducido**: que se lea todo.

## Comprobaciones

- **`verificar.mjs`:** archivos (charset y noindex, ids, partes y datos sustituidos), fotos (solo de la ficha y del Instagram del albergue, ninguna ampliada, `entrada-cartel` sin recorte, el regueiro sin personas), textos prohibidos (WhatsApp, sellos, 3D, niebla, superlativos, recuento de reseñas), los datos de DATOS en su sitio, la paleta medida, los tokens y alias de los módulos, CSS de cookies/mando/menú/dvh/cortina, el contraste (≥ 4,5:1 en cada superficie), el foco, el mapa, el tiempo (con red, sin red, caché, `?tiempo=`, `?fecha=`), módulos (montan al acercarse; sin sus JS queda cada respaldo; el jardín recibe fecha, tiempo y densidad), las flores, el visor por nombre, cookies en 4 pasos, mando y sobria, móvil a 360/375/390/768 (sin scroll lateral, menú con la cabecera fija, barra del navegador sin rehacer nada), legales y, al final y con movimiento, la cortina, sin Lenis ni GSAP y sin JavaScript.
- **Resultado (2026-10-23, con los cinco módulos y la cortina ya puestos): 148/148.**
- **`scripts/rendimiento.mjs`** (Pixel 7, 4G lento, CPU ×4, sin WebGL): **LCP 1,9–2,0 s** (la foto `entrada-cartel-800.avif`, de 63 KB; con la de 1080 y 161 KB eran 3,2–3,5 s: por eso el AVIF de esa foto va a calidad 34 y sin afinar, y su `sizes` móvil es 66vw). ~700 KB y 25 peticiones (sin las letras de Google). Ojo: en dos de tres pasadas la cortina tarda 4,5 s en irse, con una tira de tareas largas de 100–300 ms mientras pinta (CPU ×4); en la otra, 2,8 s.

## Para publicar

Repo propio y GitHub Pages sobre la rama real (como las anteriores). Antes, `PENDIENTES.md` y la receta de borrado del mando si se entrega. Quitar el `noindex` solo si se vende. El albergue no ha encargado esta web: no se publica ni se manda nada sin que Álvaro lo decida.
