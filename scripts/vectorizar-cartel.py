#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Vectoriza el cartel de la entrada del Albergue Casa Sánchez -> marca/cartel.svg (y piezas sueltas).

NO es un cartel «parecido»: cada pieza sale de una foto y se mide contra ella.
  - Enderezar:  el panel de la foto `entrada-cartel` (Instagram 2017-12-15 Bcu68zMB-Le) se endereza con
                una homografía a 1000x575 (ESQUINAS). Las cuatro esquinas, en píxeles de la foto, van a
                marca/cartel-esquinas.json (la portada casa el cartel vectorial con ellas).
  - «Casa Sánchez» (manuscrita): la foto del cartel solo tiene ~60 px de letra, así que la FORMA sale de la
                misma letra en la historia de Instagram 2022-05-02 CdDReK7sWjc (blanca sobre el toldo, 455 px
                de ancho; solo hay que quitar el fondo por contraste de canal mínimo). Se registra contra la
                letra del cartel con ECC afín (ver «ajuste_letra») y se compara por correlación.
                El contorno sale de potrace; la línea central (el ductus, para que se escriba a trazo)
                sale de adelgazar + recorrido por giro mínimo (misma tubería que `penlib.py` de la
                asesoría Cervantes, copiada aquí abajo para que el script se baste solo).
  - «ALBERGUE TURÍSTICO»: letra de palo grueso. Se REDIBUJA con una fuente libre (Sofia Sans Condensed,
                OFL) y cada letra se ajusta a la foto (caja y peso) maximizando la IoU contra la tinta
                de la foto. El informe de IoU va a marca/cartel-iou.json.
  - Flores: 5 pétalos en rombo con nervios, como el adorno de las flores del toldo (misma casa).
  - Franja blanca con la joroba: perfil medido en la foto del directorio (ref/trabajo/cartel-dir03.png).
  - Vieira, peregrino, flecha: dibujadas a mano sobre las medidas de la foto (cajas en COORDS).

Uso (desde la raíz de la web):
    python scripts/vectorizar-cartel.py                  # escribe marca/cartel*.svg y marca/cartel-*.json
    python scripts/vectorizar-cartel.py --depurar DIR    # además guarda imágenes de comprobación en DIR
Necesita: numpy, opencv-python, scipy, fonttools, svgpathtools, potracer (`pip install potracer`) y red
la primera vez (baja Sofia Sans Condensed de google/fonts a --cache).
"""
import argparse, json, math, os, sys, tempfile, urllib.request
from pathlib import Path
import cv2
import numpy as np

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
FOTO_IG = RAIZ / 'ref/fotos/instagram/2017-12-15_Bcu68zMB-Le.jpg'       # entrada-cartel
FOTO_D3 = RAIZ / 'ref/trabajo/cartel-dir03.png'                          # recorte ampliado del directorio _03
HISTORIA = RAIZ / 'ref/fotos/instagram/2022-05-02_CdDReK7sWjc.jpg'       # «Casa Sánchez» en blanco, grande
FOLLETO = RAIZ / 'ref/fotos/instagram/2017-10-02_BZv49ZEBoFF.jpg'        # la misma letra en granate (parche)
W, H = 1000, 575                                                          # lienzo canónico del cartel

# colores medidos (ref/FOTOS.md)
AMARILLO, PARDO, ORO, AZUL, BLANCO = '#E0BF50', '#412B21', '#A37F31', '#291886', '#F7F4EA'

# esquinas del panel en la foto entrada-cartel (640x640): arriba-izq, arriba-der, abajo-der, abajo-izq.
# Las de abajo las tapa la cerca: la derecha se mide donde empieza la cerca y la izquierda
# sigue la inclinación del borde de arriba (0,75 º).
ESQUINAS_IG = [[207.0, 119.0], [403.6, 121.6], [403.0, 232.0], [207.4, 229.2]]
# esquinas del panel en el recorte ampliado del directorio (solo para el perfil de la franja)
ESQUINAS_D3 = [[52, 180], [607, 42], [633, 493], [66, 524]]


# ---------------------------------------------------------------- utilidades
def rectificar(img, esq):
    M = cv2.getPerspectiveTransform(np.float32(esq), np.float32([[0, 0], [W, 0], [W, H], [0, H]]))
    return cv2.warpPerspective(img, M, (W, H), flags=cv2.INTER_CUBIC)


def num(v, d=1):
    s = f'{v:.{d}f}'.rstrip('0').rstrip('.')
    return s if s not in ('-0', '') else '0'


def guardar(dirdep, nombre, img):
    if dirdep:
        cv2.imwrite(str(Path(dirdep) / nombre), img)


# ---------------------------------------------------------------- tubería de trazos de pluma (de penlib.py)
CIRC = [(-1, -1), (-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1), (0, -1)]


def adelgazar(I, max_it=200):
    """Zhang-Suen: deja la línea central a un píxel de ancho."""
    I = I.astype(np.uint8).copy()

    def vec(P):
        return [np.roll(np.roll(P, dy, 0), dx, 1) for dy, dx in
                [(1, 0), (1, -1), (0, -1), (-1, -1), (-1, 0), (-1, 1), (0, 1), (1, 1)]]
    for _ in range(max_it):
        cambio = False
        for paso in (0, 1):
            P2, P3, P4, P5, P6, P7, P8, P9 = vec(I)
            B = P2 + P3 + P4 + P5 + P6 + P7 + P8 + P9
            seq = [P2, P3, P4, P5, P6, P7, P8, P9, P2]
            A = sum(((seq[i] == 0) & (seq[i + 1] == 1)).astype(np.uint8) for i in range(8))
            c1, c2 = (P2 * P4 * P6, P4 * P6 * P8) if paso == 0 else (P2 * P4 * P8, P2 * P6 * P8)
            m = (I == 1) & (B >= 2) & (B <= 6) & (A == 1) & (c1 == 0) & (c2 == 0)
            if m.any():
                I[m] = 0
                cambio = True
        if not cambio:
            break
    return I


def _vec(p, pts):
    y, x = p
    v = [(y + dy, x + dx) for dy, dx in CIRC if (y + dy, x + dx) in pts]
    return sorted(v, key=lambda q: abs(q[0] - y) + abs(q[1] - x))


def _ramas(p, pts):
    # el grado de un píxel es el número de RAMAS (rachas circulares de vecinos), no de vecinos
    y, x = p
    m = [((y + dy, x + dx) in pts) for dy, dx in CIRC]
    if all(m):
        return 1
    return sum(1 for i in range(8) if m[i] and not m[i - 1])


def _podar(pts, umbral):
    pts = set(pts)
    for _ in range(30):
        quitar = set()
        for p in [q for q in pts if _ramas(q, pts) == 1]:
            cam = [p]
            prev = None
            act = p
            while len(cam) <= umbral:
                sig = [q for q in _vec(act, pts) if q != prev and q not in cam]
                if len(sig) != 1:
                    break
                prev, act = act, sig[0]
                if _ramas(act, pts) > 2:
                    break
                cam.append(act)
            if len(cam) <= umbral and _ramas(cam[-1], pts) <= 2:
                quitar.update(cam)
        quitar = {q for q in quitar if _ramas(q, pts) <= 2}
        if not quitar:
            break
        pts -= quitar
    return pts


def trazos_de(S, podar_umbral=6, corte_giro=1.9, min_pts=12):
    """S: esqueleto booleano. Devuelve listas de puntos (y, x), recorridas por giro mínimo y de izq. a der."""
    P = _podar(set(zip(*np.where(S))), podar_umbral)
    nodos = {p for p in P if _ramas(p, P) != 2}
    usado, edges, nn = set(), [], set()
    for n in sorted(nodos):
        for v in _vec(n, P):
            if v in nodos:
                k = frozenset((n, v))
                if k not in nn:
                    nn.add(k)
                    edges.append([n, v])
                continue
            if v in usado:
                continue
            cam = [n, v]
            usado.add(v)
            prev, act = n, v
            while True:
                sig = [q for q in _vec(act, P) if q != prev and q not in usado]
                nd = [q for q in sig if q in nodos]
                if nd:
                    cam.append(nd[0])
                    break
                sig = [q for q in sig if q not in nodos]
                if not sig:
                    break
                q = sig[0]
                usado.add(q)
                cam.append(q)
                prev, act = act, q
            edges.append(cam)
    rest = {p for p in P if p not in nodos and p not in usado}
    while rest:
        p = min(rest)
        cam = [p]
        usado.add(p)
        rest.discard(p)
        prev, act = None, p
        while True:
            sig = [q for q in _vec(act, P) if q != prev and q not in usado]
            if not sig:
                break
            q = sig[0]
            usado.add(q)
            rest.discard(q)
            cam.append(q)
            prev, act = act, q
        if len(cam) > 8:
            edges.append(cam)
    edges = [e for e in edges if len(e) >= 3]
    if not edges:
        return []

    def ang(a, b):
        return math.atan2(b[0] - a[0], b[1] - a[1])

    def d_sal(e, ini):
        q = e if ini else e[::-1]
        k = min(9, len(q) - 1)
        return ang(q[0], q[k])

    def d_ent(e, ini):
        q = e if ini else e[::-1]
        k = min(9, len(q) - 1)
        return ang(q[-1 - k], q[-1])
    incid = {}
    for i, e in enumerate(edges):
        incid.setdefault(e[0], []).append((i, True))
        incid.setdefault(e[-1], []).append((i, False))
    libre = set(range(len(edges)))

    def trazar(i, ini):
        out = []
        while True:
            libre.discard(i)
            e = edges[i] if ini else edges[i][::-1]
            out.extend(e if not out else e[1:])
            d_in = d_ent(edges[i], ini)
            cand = []
            for j, di in incid.get(e[-1], []):
                if j not in libre:
                    continue
                g = abs((d_sal(edges[j], di) - d_in + math.pi) % (2 * math.pi) - math.pi)
                cand.append((g, j, di))
            if not cand:
                break
            cand.sort()
            if cand[0][0] > corte_giro:
                break
            _, i, ini = cand[0]
        return out
    arr = []
    for i, e in enumerate(edges):
        for p, ini in ((e[0], True), (e[-1], False)):
            if len(incid.get(p, [])) == 1:
                arr.append((p[1], p[0], i, ini))
    arr.sort()
    out = []
    for _, _, i, ini in arr:
        if i in libre:
            out.append(trazar(i, ini))
    while libre:
        out.append(trazar(min(libre), True))
    return [t for t in out if len(t) > min_pts]


def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = math.hypot(dx, dy)
    peor, k = -1, 0
    for i in range(1, len(pts) - 1):
        p = pts[i]
        d = abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / n if n else math.hypot(p[0] - a[0], p[1] - a[1])
        if d > peor:
            peor, k = d, i
    if peor > eps:
        return rdp(pts[:k + 1], eps)[:-1] + rdp(pts[k:], eps)
    return [a, b]


def a_bezier(pts, t=0.22):
    """Catmull-Rom -> bézier cúbica."""
    if len(pts) < 2:
        return ''
    P = [pts[0]] + list(pts) + [pts[-1]]
    d = [f'M{num(pts[0][0])} {num(pts[0][1])}']
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        c1 = (p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t)
        c2 = (p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t)
        d.append('C' + ' '.join(num(v) for v in (c1[0], c1[1], c2[0], c2[1], p2[0], p2[1])))
    return ''.join(d)


def largo(pts):
    return sum(math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) for i in range(len(pts) - 1))


# ---------------------------------------------------------------- potrace -> path
def potrace_d(mask, mapa, opttol=1.2, alphamax=1.15, turd=20, dec=1):
    """mask: bool (True = tinta). mapa(x, y) -> (X, Y) en el lienzo canónico."""
    import potrace
    bm = potrace.Bitmap(~mask)
    pl = bm.trace(turdsize=turd, turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY, alphamax=alphamax,
                  opticurve=True, opttolerance=opttol)
    partes = []
    for c in pl:
        sp = mapa(c.start_point.x, c.start_point.y)
        d = [f'M{num(sp[0], dec)} {num(sp[1], dec)}']
        for s in c.segments:
            if s.is_corner:
                a = mapa(s.c.x, s.c.y)
                b = mapa(s.end_point.x, s.end_point.y)
                d.append(f'L{num(a[0], dec)} {num(a[1], dec)}L{num(b[0], dec)} {num(b[1], dec)}')
            else:
                a = mapa(s.c1.x, s.c1.y)
                b = mapa(s.c2.x, s.c2.y)
                e = mapa(s.end_point.x, s.end_point.y)
                d.append('C' + ' '.join(num(v, dec) for v in (a[0], a[1], b[0], b[1], e[0], e[1])))
        partes.append(''.join(d) + 'Z')
    return ''.join(partes)


def contornos(path, escala, ancho_paso=2.0):
    """Lista de (polígono Nx2 en píxeles, área con signo) de cada subtrazo de un path de svgpathtools."""
    out = []
    for sub in path.continuous_subpaths():
        pts = []
        for seg in sub:
            n = max(3, int(seg.length() * escala / ancho_paso))
            for t in np.linspace(0, 1, n, endpoint=False):
                p = seg.point(t)
                pts.append([p.real * escala, p.imag * escala])
        if len(pts) < 3:
            continue
        a = np.array(pts)
        area = 0.5 * float(np.sum(a[:, 0] * np.roll(a[:, 1], -1) - np.roll(a[:, 0], -1) * a[:, 1]))
        out.append((a, area))
    return out


def rasterizar(path, forma, escala=1.0, nonzero=True, margen=0.0):
    """Rasteriza un path de svgpathtools. nonzero=True: regla del SVG por defecto (los contornos que se
    solapan en el mismo sentido se unen, como en las fuentes); False: par-impar."""
    alto, ancho = forma
    wind = np.zeros((alto, ancho), np.int16)
    for a, area in contornos(path, escala):
        t = np.zeros((alto, ancho), np.uint8)
        cv2.fillPoly(t, [np.round((a + margen) * 16).astype(np.int32)], 1, shift=4)
        wind += t.astype(np.int16) * (1 if area > 0 else -1) if nonzero else 0
        if not nonzero:
            wind ^= t.astype(np.int16)
    return wind != 0


def d_a_mascara(d, caja=(W, H), escala=1.0, nonzero=True):
    """Rasteriza un path d (M/L/C/Q/Z) a booleana, para medir IoU."""
    from svgpathtools import parse_path
    return rasterizar(parse_path(d), (int(caja[1] * escala), int(caja[0] * escala)), escala, nonzero)


# ---------------------------------------------------------------- 1. «Casa Sánchez» manuscrita
def mascara_historia(dirdep=None):
    """Tinta blanca de la historia, fondo quitado por contraste (canal mínimo + sombrero de copa)."""
    s = cv2.imread(str(HISTORIA))
    mn = s.min(axis=2)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13))
    th = cv2.morphologyEx(mn, cv2.MORPH_TOPHAT, k)
    PAD = 30
    S0 = np.clip((th[0:135, :].astype(np.float32) - 30) / 30, 0, 1)
    S = np.zeros((135 + PAD, s.shape[1]), np.float32)
    S[PAD:] = S0
    # el folleto (granate sobre blanco, mismo dibujo) rellena lo que la historia corta por arriba (la S)
    f = cv2.imread(str(FOLLETO))
    gf = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY).astype(np.float32)
    Fd = np.clip((235 - gf) / (235 - 70), 0, 1)
    F = Fd[80:150, 0:200]
    a = 2.2
    warp = np.array([[a, 0, 222 - a * 55], [0, a, PAD - 8 * a]], np.float32)
    Fw0 = cv2.warpAffine(F, warp, (S.shape[1], S.shape[0]), flags=cv2.INTER_CUBIC)
    mask = np.zeros(S.shape, np.uint8)
    mask[PAD + 16:, 222:500] = 1
    crit = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 500, 1e-8)
    w = np.eye(2, 3, dtype=np.float32)
    try:
        _, w = cv2.findTransformECC(cv2.GaussianBlur(S, (0, 0), 1.5), cv2.GaussianBlur(Fw0, (0, 0), 1.5), w,
                                    cv2.MOTION_AFFINE, crit, mask, 5)
        Fw = cv2.warpAffine(Fw0, w, (S.shape[1], S.shape[0]), flags=cv2.INTER_CUBIC + cv2.WARP_INVERSE_MAP)
    except cv2.error:
        Fw = Fw0
    M = S.copy()
    M[:PAD + 8, 250:330] = np.maximum(M[:PAD + 8, 250:330], np.clip(Fw[:PAD + 8, 250:330] * 1.2, 0, 1))
    M[:, :36] = 0                  # borde del marco de la historia
    M[:PAD + 50, 364:382] = 0      # un destello vertical del toldo, no es tinta
    n, lab, st, _ = cv2.connectedComponentsWithStats((M > 0.5).astype(np.uint8), connectivity=8)
    for i in range(1, n):
        if st[i, 4] < 25:
            M[lab == i] = 0
    K = 4
    Mb = cv2.resize(M, None, fx=K, fy=K, interpolation=cv2.INTER_CUBIC)
    Mb = cv2.GaussianBlur(Mb, (0, 0), K * 0.45)
    return Mb > 0.45, K


def ajuste_letra(B, K, dirdep=None):
    """Registra la letra (de la historia) contra la letra de la foto del cartel. Devuelve (mapa, corr)."""
    im = cv2.imread(str(FOTO_IG))
    a = rectificar(im, ESQUINAS_IG)
    bl = a[..., 0].astype(np.float32)
    T = np.clip((cv2.GaussianBlur(bl, (0, 0), 25) - bl) / 45, 0, 1)
    ys, xs = np.where(B)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    Lm = B[y0:y1, x0:x1].astype(np.float32)
    sc = 425 / (Lm.shape[1] / K)
    Lc = cv2.resize(Lm, None, fx=sc / K, fy=sc / K, interpolation=cv2.INTER_AREA)
    ox, oy = 287, 135
    canvas = np.zeros((H, W), np.float32)
    canvas[oy:oy + Lc.shape[0], ox:ox + Lc.shape[1]] = Lc
    mask = np.zeros((H, W), np.uint8)
    mask[125:244, 270:735] = 1
    crit = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 600, 1e-8)
    w = np.eye(2, 3, dtype=np.float32)
    corr, w = cv2.findTransformECC(cv2.GaussianBlur(T, (0, 0), 2.0), cv2.GaussianBlur(canvas, (0, 0), 2.0), w,
                                   cv2.MOTION_AFFINE, crit, mask, 5)
    Wd = cv2.invertAffineTransform(w)          # lienzo -> panel de la foto

    def mapa(bx, by):
        cx = (bx - x0) / K * sc + ox
        cy = (by - y0) / K * sc + oy
        return (Wd[0, 0] * cx + Wd[0, 1] * cy + Wd[0, 2], Wd[1, 0] * cx + Wd[1, 1] * cy + Wd[1, 2])
    if dirdep:
        Cw = cv2.warpAffine(canvas, Wd, (W, H), flags=cv2.INTER_LINEAR)
        o = np.zeros((H, W, 3), np.uint8)
        o[..., 2] = (T * 255).astype(np.uint8)
        o[..., 1] = (Cw * 255).astype(np.uint8)
        guardar(dirdep, 'letra-vs-foto.png', o[100:290, 250:760])
    return mapa, float(corr)


def letra_manuscrita(dirdep=None):
    B, K = mascara_historia(dirdep)
    mapa, corr = ajuste_letra(B, K, dirdep)
    ys, xs = np.where(B)
    CORTE = 836            # hueco entre «Casa» y «Sánchez» en la máscara a 4x
    medidas = {}
    salida = {}
    for nombre, (a, b) in (('casa', (0, CORTE)), ('sanchez', (CORTE, B.shape[1]))):
        Bm = np.zeros_like(B)
        Bm[:, a:b] = B[:, a:b]
        ys, xs = np.where(Bm)
        x0, y0, x1, y1 = xs.min() - 8, ys.min() - 8, xs.max() + 9, ys.max() + 9
        Bc = Bm[y0:y1, x0:x1]
        mp = lambda x, y, x0=x0, y0=y0: mapa(x + x0, y + y0)
        # un alisado leve antes de trazar quita los dientes del JPG y baja el peso del path a la mitad
        d = potrace_d(cv2.GaussianBlur(Bc.astype(np.float32), (0, 0), 1.5) > 0.5, mp, opttol=1.4, alphamax=1.2, turd=30)
        # el ductus
        sk = adelgazar(Bc.astype(np.uint8))
        tr = trazos_de(sk.astype(bool), podar_umbral=10, corte_giro=1.9, min_pts=12)
        trazos = []
        for q in tr:
            pts = [mp(x, y) for (y, x) in q]
            pts = rdp(pts, 0.35)
            if len(pts) >= 3:
                trazos.append(pts)
        # los trazos más cortos que ~5 unidades no se pueden animar: se descartan
        trazos = [t for t in trazos if largo(t) > 5]
        # orden de escritura: de izquierda a derecha por el punto de arranque
        trazos.sort(key=lambda t: (min(t[0][0], t[-1][0])))
        salida[nombre] = {'d': d, 'trazos': trazos}
        medidas[nombre] = int(Bc.sum())
    # control de calidad: el contorno rasterizado cubre la máscara (IoU contra la máscara de la historia)
    return salida, corr


# ---------------------------------------------------------------- 2. «ALBERGUE TURÍSTICO»
URL_SOFIA = 'https://raw.githubusercontent.com/google/fonts/main/ofl/sofiasanscondensed/SofiaSansCondensed%5Bwght%5D.ttf'
PESOS = (450, 500, 525, 550, 575, 600, 625, 650)
RUNS = {'ALBERGUE': [(365, 431), (448, 497), (512, 569), (585, 635), (650, 706), (721, 779), (792, 846), (863, 913)],
        'TURÍSTICO': [(355, 414), (429, 487), (503, 562), (579, 595), (611, 671), (680, 737), (751, 768), (784, 843), (857, 916)]}
CAJAS = {'ALBERGUE': (345, 285, 940, 410), 'TURÍSTICO': (345, 405, 940, 562)}


def fuentes_sofia(cache):
    from fontTools.ttLib import TTFont
    from fontTools.varLib import instancer
    cache = Path(cache)
    cache.mkdir(parents=True, exist_ok=True)
    var = cache / 'SofiaSansCondensed[wght].ttf'
    if not var.exists():
        print('bajando Sofia Sans Condensed…')
        urllib.request.urlretrieve(URL_SOFIA, var)
    out = {}
    for w in PESOS:
        f = cache / f'Sofia-{w}.ttf'
        if not f.exists():
            g = instancer.instantiateVariableFont(TTFont(var), {'wght': w})
            g.save(f)
        out[w] = TTFont(f)
    return out


def glifo(font, car):
    """Devuelve (path d en unidades de la fuente con y hacia arriba, caja, máscara a 0,6 px/unidad)."""
    from fontTools.pens.svgPathPen import SVGPathPen
    cmap = font.getBestCmap()
    nombre = cmap[ord(car)]
    gs = font.getGlyphSet()
    pen = SVGPathPen(gs)
    gs[nombre].draw(pen)
    d = pen.getCommands()
    from svgpathtools import parse_path
    path = parse_path(d)
    xmin, xmax, ymin, ymax = path.bbox()
    sc = 0.6
    ancho, alto = int((xmax - xmin) * sc) + 4, int((ymax - ymin) * sc) + 4
    # misma regla que el SVG (no-cero): la barra de la A y las patas se solapan y no deben hacer agujero
    wind = np.zeros((alto, ancho), np.int16)
    for a, area in contornos(path, 1.0):
        pts = np.column_stack([(a[:, 0] - xmin) * sc + 2, (ymax - a[:, 1]) * sc + 2])
        t = np.zeros((alto, ancho), np.uint8)
        cv2.fillPoly(t, [np.round(pts * 16).astype(np.int32)], 1, shift=4)
        wind += t.astype(np.int16) * (1 if area > 0 else -1)
    img = (wind != 0).astype(np.uint8)
    return d, (xmin, ymin, xmax, ymax), img


def desplazamiento(yn, sh, sh2):
    """Cuánto se mueve hacia la derecha una fila del glifo (yn: 0 arriba, 1 abajo): una cizalla general (sh,
    el glifo inclinado) y otra solo en el tercio de abajo (sh2: la pata de la R, más vertical en el cartel)."""
    return sh * (0.5 - yn) + sh2 * np.clip((yn - 0.55) / 0.45, 0, 1)


def pegar_glifo(rs, p, forma=(H, W)):
    """Dibuja la máscara del glifo `rs` (a 0,6 px/unidad) en la caja p = (x0, x1, y0, y1, cizalla, cizalla de abajo)."""
    x0, x1, y0, y1, sh, sh2 = p
    bw, bh = int(round(x1 - x0)), int(round(y1 - y0))
    if bw < 6 or bh < 20:
        return None
    gm = cv2.resize(rs, (bw, bh), interpolation=cv2.INTER_AREA)
    pad = int(math.ceil(max(abs(sh) / 2 + abs(sh2), 1))) + 1
    yn = (np.arange(bh) + 0.5) / bh
    mx = (np.arange(bw + 2 * pad, dtype=np.float32)[None, :] - pad) - desplazamiento(yn, sh, sh2).astype(np.float32)[:, None]
    my = np.repeat(np.arange(bh, dtype=np.float32)[:, None], bw + 2 * pad, axis=1)
    gm = cv2.remap(gm, mx, my, cv2.INTER_LINEAR, borderValue=0)
    xa, ya = int(round(x0)) - pad, int(round(y0))
    if xa < 0 or ya < 0 or xa + gm.shape[1] > forma[1] or ya + bh > forma[0]:
        return None
    m = np.zeros(forma, bool)
    m[ya:ya + bh, xa:xa + gm.shape[1]] = gm > 127
    return m


def ajustar_rotulo(cache, dirdep=None):
    """Ajusta cada letra de ALBERGUE y de TURÍSTICO (caja, cizalla y peso) a la tinta de la foto y devuelve
    paths en el lienzo canónico + informe de IoU."""
    from scipy.optimize import minimize
    from svgpathtools import parse_path
    fuentes = fuentes_sofia(cache)
    im = cv2.imread(str(FOTO_IG))
    g = cv2.cvtColor(rectificar(im, ESQUINAS_IG), cv2.COLOR_BGR2GRAY)
    informe, palabras = {}, {}
    for palabra in ('ALBERGUE', 'TURÍSTICO'):
        x0c, y0c, x1c, y1c = CAJAS[palabra]
        sub = g[y0c:y1c, x0c:x1c]
        t_otsu, _ = cv2.threshold(sub, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        glifos_p = [{w: glifo(fuentes[w], car) for w in PESOS} for car in palabra]
        mejor_palabra = None
        # el umbral de la tinta es un parámetro de la medida: se prueba alrededor del de Otsu
        for dt in (-10, 0, 10):
            t = t_otsu + dt
            tinta = np.zeros((H, W), bool)
            tinta[y0c:y1c, x0c:x1c] = sub < t
            letras, ious = [], []
            for i, car in enumerate(palabra):
                a0, a1 = RUNS[palabra][i]
                ys = np.where(tinta[:, a0:a1].sum(1) > 0)[0]
                ya, yb = ys.min(), ys.max() + 1
                mejor = None
                for w, (d, caja, img) in glifos_p[i].items():
                    rs = img * 255

                    def iou(p, rs=rs):
                        pm = pegar_glifo(rs, p)
                        if pm is None:
                            return 1
                        wx0, wx1 = max(0, a0 - 7), min(W, a1 + 7)
                        tw, pw = tinta[:, wx0:wx1], pm[:, wx0:wx1]
                        return -((tw & pw).sum() / max(1, (tw | pw).sum()))
                    simplex = np.array([[a0, a1, ya, yb, 0, 0], [a0 + 3, a1, ya, yb, 0, 0], [a0, a1 + 3, ya, yb, 0, 0],
                                        [a0, a1, ya + 3, yb, 0, 0], [a0, a1, ya, yb + 3, 0, 0], [a0, a1, ya, yb, 3, 0], [a0, a1, ya, yb, 0, 4]], float)
                    r = minimize(iou, [a0, a1, ya, yb, 0, 0], method='Nelder-Mead',
                                 options={'xatol': .15, 'fatol': 1e-5, 'maxiter': 900, 'initial_simplex': simplex})
                    # Nelder-Mead se queda en óptimos locales: se reinicia dos veces desde su propio resultado
                    for _ in range(2):
                        x = r.x
                        sx_ = np.array([x] + [x + np.eye(6)[k] * paso for k, paso in enumerate((2, 2, 2, 2, 1.5, 2.5))])
                        r2 = minimize(iou, x, method='Nelder-Mead', options={'xatol': .1, 'fatol': 1e-6, 'maxiter': 700, 'initial_simplex': sx_})
                        if r2.fun < r.fun:
                            r = r2
                    if mejor is None or -r.fun > mejor[0]:
                        mejor = (-r.fun, w, r.x, d, caja)
                val, w, (x0, x1, y0, y1, sh, sh2), d, (gx0, gy0, gx1, gy1) = mejor
                sx, sy = (x1 - x0) / (gx1 - gx0), (y1 - y0) / (gy1 - gy0)
                path = parse_path(d)
                partes = []

                def pt(c):
                    ysc = y0 + (gy1 - c.imag) * sy                      # y en pantalla
                    xs = x0 + (c.real - gx0) * sx + float(desplazamiento((ysc - y0) / (y1 - y0), sh, sh2))
                    return f'{num(xs)} {num(ysc)}'
                for sub_ in path.continuous_subpaths():
                    partes.append('M' + pt(sub_[0].start))
                    for seg in sub_:
                        nm = type(seg).__name__
                        if nm == 'Line':
                            partes.append('L' + pt(seg.end))
                        elif nm == 'QuadraticBezier':
                            partes.append('Q' + pt(seg.control) + ' ' + pt(seg.end))
                        elif nm == 'CubicBezier':
                            partes.append('C' + pt(seg.control1) + ' ' + pt(seg.control2) + ' ' + pt(seg.end))
                    partes.append('Z')
                letras.append({'c': car, 'd': ''.join(partes), 'peso': w, 'iou': round(float(val), 3),
                               'cizalla': round(float(sh), 1), 'cizalla_pata': round(float(sh2), 1)})
                ious.append(float(val))
            pm = np.zeros((H, W), bool)
            for l in letras:
                pm |= d_a_mascara(l['d'])
            iou_p = float((tinta & pm).sum() / (tinta | pm).sum())
            if mejor_palabra is None or iou_p > mejor_palabra[0]:
                mejor_palabra = (iou_p, letras, ious, int(t), tinta, pm)
        iou_p, letras, ious, t, tinta, pm = mejor_palabra
        palabras[palabra] = letras
        # la foto está ampliada 5× desde ~200 px: sus esquinas salen redondeadas por el desenfoque. Se mide también
        # contra el vector con ese mismo desenfoque (σ = 2 px del lienzo), que es la comparación justa.
        pb = cv2.GaussianBlur(pm.astype(np.float32), (0, 0), 2.0) > 0.5
        iou_b = float((tinta & pb).sum() / (tinta | pb).sum())
        informe[palabra] = {'media_por_letra': round(float(np.mean(ious)), 3), 'iou_palabra': round(iou_p, 3),
                            'iou_palabra_desenfocada': round(iou_b, 3), 'umbral': t,
                            'letras': [(l['c'], l['iou'], l['peso'], l['cizalla']) for l in letras]}
        if dirdep:
            o = np.zeros((H, W, 3), np.uint8)
            o[..., 2] = tinta * 255
            o[..., 1] = pm * 255
            guardar(dirdep, f'rotulo-{palabra}.png', o[y0c:y1c, x0c:x1c])
    return palabras, informe


def apartamentos(cache):
    """«APARTAMENTOS RURALES»: capitales diminutas con la misma letra, a la caja medida en la foto."""
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.pens.transformPen import TransformPen
    f = fuentes_sofia(cache)[500]
    cmap = f.getBestCmap()
    gs = f.getGlyphSet()
    em = f['head'].unitsPerEm
    cap = 12.0                        # alto de mayúscula en el lienzo
    esc = cap / 700.0                 # 700 = altura de mayúscula de la fuente
    pistas = {'APARTAMENTOS': (345.0, 505.0), 'RURALES': (545.0, 651.0)}
    base_y = 262.0
    partes = []
    for palabra, (xa, xb) in pistas.items():
        ancho_nat = sum(gs[cmap[ord(c)]].width for c in palabra) * esc
        track = (xb - xa - ancho_nat) / (len(palabra) - 1)
        x = xa
        for c in palabra:
            nm = cmap[ord(c)]
            sp = SVGPathPen(gs)
            tp = TransformPen(sp, (esc, 0, 0, -esc, x, base_y))
            gs[nm].draw(tp)
            partes.append(sp.getCommands())
            x += gs[nm].width * esc + track
    return ''.join(partes)


# ---------------------------------------------------------------- 3. el resto de piezas
def franja_d():
    """Franja blanca de arriba: su borde de abajo sube en una joroba suave en el centro, donde van las flores.
    El perfil se midió en la foto del directorio (ref/trabajo/cartel-dir03.png, borde azul-blanco contra amarillo) y
    en la de Instagram: llano a y=84 hasta x~265, sube en curva (empieza empinado y se redondea) hasta la meseta
    y=13 en x~470-554 y baja simétrica respecto al eje x=512. Ajuste con dos bézier cúbicas por lado (error < 3 px
    contra las muestras de la foto)."""
    return 'M0 0H1000V84H759C741 64 694 13 554 13H470C330 13 283 64 265 84H0Z'


def petalo_d(R):
    """Un pétalo en rombo apuntando hacia arriba, base en el centro, de radio R."""
    f = lambda a, b: f'{num(a * R, 2)} {num(-b * R, 2)}'
    return ('M0 0' +
            'C' + f(-.10, .16) + ' ' + f(-.40, .36) + ' ' + f(-.37, .60) +
            'C' + f(-.35, .78) + ' ' + f(-.13, .92) + ' ' + f(0, 1.0) +
            'C' + f(.13, .92) + ' ' + f(.35, .78) + ' ' + f(.37, .60) +
            'C' + f(.40, .36) + ' ' + f(.10, .16) + ' ' + f(0, 0) + 'Z')


def nervios_d(R):
    """Nervios del pétalo (espina de pez), para pintarlos en el color del panel como recortes."""
    f = lambda a, b: f'{num(a * R, 2)} {num(-b * R, 2)}'
    d = 'M0 ' + num(-0.10 * R, 2) + 'L0 ' + num(-0.84 * R, 2)
    for t in (0.28, 0.44, 0.60, 0.74):
        w = 0.30 * (1 - abs(t - 0.5) * 0.9) * (1 - 0.35 * max(0, t - 0.55))
        d += f'M0 {num(-t * R, 2)}L{f(-w, t + 0.13)}M0 {num(-t * R, 2)}L{f(w, t + 0.13)}'
    return d


FLORES = [  # id, cx, cy, R, giro (º)  — medidos en las fotos (rectificadas)
    ('flor-1', 435.0, 108.0, 34.0, -12.0),
    ('flor-2', 518.0, 70.0, 46.0, 8.0),
    ('flor-3', 592.0, 118.0, 25.0, 24.0),
]


def flor_svg(id_, cx, cy, R, giro, con_transform=True):
    petalos = []
    for k in range(5):
        a = giro + 72 * k
        petalos.append(f'<g class="petalo" transform="rotate({num(a, 1)})"><path d="{petalo_d(R)}"/>'
                       f'<path class="nervio" d="{nervios_d(R)}"/></g>')
    centro = f'<circle class="centro" r="{num(R * 0.07, 2)}"/>'
    tr = f' transform="translate({num(cx)} {num(cy)})"' if con_transform else ''
    return f'<g id="{id_}" class="flor"{tr}>{"".join(petalos)}{centro}</g>'


VIEIRA_C = (310.0, 337.0)


def vieira_svg():
    """Vieira como sol: la charnela oscura a la derecha y once rayos abiertos hacia la izquierda."""
    cx, cy = VIEIRA_C
    rayos = []
    n = 11
    for i in range(n):
        a = math.radians(180 + (i - (n - 1) / 2) * 13.5)          # 180º = hacia la izquierda
        r0, r1 = 14.0, 88.0 - abs(i - (n - 1) / 2) * 3.2
        x0, y0 = cx + r0 * math.cos(a) * 0.72, cy + r0 * math.sin(a)
        x1, y1 = cx + r1 * math.cos(a), cy + r1 * math.sin(a)
        nx, ny = -math.sin(a), math.cos(a)
        w0, w1 = 3.4, 1.0
        rayos.append(f'M{num(x0 + nx * w0)} {num(y0 + ny * w0)}L{num(x1 + nx * w1)} {num(y1 + ny * w1)}'
                     f'L{num(x1 - nx * w1)} {num(y1 - ny * w1)}L{num(x0 - nx * w0)} {num(y0 - ny * w0)}Z')
    charnela = (f'M{num(cx - 8)} {num(cy - 24)}C{num(cx + 4)} {num(cy - 30)} {num(cx + 14)} {num(cy - 14)} '
                f'{num(cx + 15)} {num(cy)}C{num(cx + 14)} {num(cy + 14)} {num(cx + 4)} {num(cy + 30)} '
                f'{num(cx - 8)} {num(cy + 24)}C{num(cx - 14)} {num(cy + 12)} {num(cx - 14)} {num(cy - 12)} '
                f'{num(cx - 8)} {num(cy - 24)}Z')
    return ('<g id="vieira"><path class="rayos" d="' + ''.join(rayos) + '"/><path class="charnela" d="' + charnela + '"/></g>')


def peregrino_svg():
    """Peregrino de palo con bastón: silueta de trazo (no relleno)."""
    cuerpo = ('M283 453L277 468L269 488'          # cuello -> cadera
              'M277 462L292 458L301 446'           # brazo del bastón
              'M277 462L263 470'                   # brazo de atrás
              'M269 488L252 507L243 531'           # pierna de delante
              'M269 488L277 510L270 531')          # pierna de atrás
    bastón = 'M302 468L309 437L314 392'
    return ('<g id="peregrino"><circle class="cabeza" cx="284" cy="442" r="8.2"/>'
            f'<path class="cuerpo" d="{cuerpo}"/><path class="baston" d="{bastón}"/></g>')


def flecha_d():
    """Flecha hacia la izquierda, medida en la foto rectificada."""
    return 'M22 404L72 349V378H182V427H72V459Z'



# ---------------------------------------------------------------- 4. texturas de superficie y flecha del foco (img/brocha/)
# Todo con semilla fija: salen siempre las mismas. Las usan la cortina (pizarra), el hilo de flechas
# (pizarra, piedra, madera) y el foco del teclado (foco-flecha.svg).
def ruido(n, beta, rng, ax=1.0, ay=1.0):
    """Ruido 1/f^beta con solape perfecto (filtrado en Fourier => baldosa sin costuras)."""
    f=np.fft.fftfreq(n)
    fx,fy=np.meshgrid(f*ax,f*ay)
    r=np.sqrt(fx**2+fy**2); r[0,0]=1
    esp=1/np.power(r,beta); esp[0,0]=0
    z=rng.standard_normal((n,n))
    a=np.real(np.fft.ifft2(np.fft.fft2(z)*esp))
    a-=a.mean(); a/=a.std()+1e-9
    return a
def hexc(h): h=h.lstrip('#'); return np.array([int(h[i:i+2],16) for i in (0,2,4)],np.float32)
def pizarra(n=512,seed=7):
    rng=np.random.default_rng(seed)
    base=hexc('#33373C')
    v=ruido(n,2.0,rng)*5.0+ruido(n,1.0,rng,ax=0.35,ay=1.0)*3.5+ruido(n,0.2,rng)*2.2   # vetas: estiradas en horizontal
    # pequenos reflejos de laminas
    g=ruido(n,1.6,rng,ax=0.25,ay=1.0); v+=np.clip(g-1.2,0,None)*9
    img=np.clip(base[None,None,:]+v[...,None]*np.array([1.0,1.0,1.05],np.float32),0,255)
    return img.astype(np.uint8)
def piedra(n=512,seed=11):
    """Muro de piedra seca: piedras planas (Voronoi con baldosa, aplastado en vertical) y juntas oscuras."""
    from scipy.spatial import cKDTree
    rng=np.random.default_rng(seed)
    base=hexc('#B9AE9C')
    k=118
    pts=rng.random((k,2))*n
    # filas: se estira el eje y para que las piedras salgan alargadas en horizontal
    sy=2.1
    rep=[]
    for dx in (-n,0,n):
        for dy in (-n,0,n):
            rep.append(pts+np.array([dx,dy]))
    rep=np.vstack(rep); idx=np.tile(np.arange(k),9)
    tree=cKDTree(rep*np.array([1,sy]))
    yy,xx=np.mgrid[0:n,0:n]
    q=np.column_stack([xx.ravel(),yy.ravel()*sy])
    d,ii=tree.query(q,k=2)
    borde=(d[:,1]-d[:,0]).reshape(n,n)
    cel=idx[ii[:,0]].reshape(n,n)
    tono=(rng.random(k)-0.5)*26
    tono2=(rng.random(k)-0.5)*10
    junta=np.clip(1-borde/5.0,0,1)**1.4
    v=tono[cel]+ruido(n,1.4,rng)*5+ruido(n,0.4,rng)*3
    img=base[None,None,:]+v[...,None]*np.array([1,1,0.9],np.float32)+tono2[cel][...,None]*np.array([0.6,0.3,-0.4],np.float32)
    img=img*(1-0.45*junta[...,None])
    return np.clip(img,0,255).astype(np.uint8)
def madera(n=512,seed=5):
    rng=np.random.default_rng(seed)
    base=hexc('#7A5236')
    v=ruido(n,1.5,rng,ax=1.0,ay=0.07)*9+ruido(n,0.5,rng,ax=1.0,ay=0.12)*4+ruido(n,2.0,rng)*3
    img=base[None,None,:]+v[...,None]*np.array([1.0,0.9,0.7],np.float32)
    return np.clip(img,0,255).astype(np.uint8)


def foco_flecha_svg(seed=3):
    """Flechita azul a brochazo (apunta a la derecha) para el foco del teclado: borde irregular y cerdas secas."""
    rng = np.random.default_rng(seed)
    base = [(2, 8.5), (24, 8.5), (24, 2), (38, 12.5), (24, 23), (24, 16.5), (2, 16.5)]
    pts = []
    for i, (x, y) in enumerate(base):
        x2, y2 = base[(i + 1) % len(base)]
        n = 4
        for k in range(n):
            f = k / n
            pts.append((x + (x2 - x) * f + rng.normal(0, 0.45), y + (y2 - y) * f + rng.normal(0, 0.45)))
    d = 'M' + 'L'.join(f'{num(x, 2)} {num(y, 2)}' for x, y in pts) + 'Z'
    # cerdas secas: tres rayas finas que se comen la pintura en el astil
    rayas = ''.join(f'<path d="M{num(2 + rng.random() * 3, 1)} {num(y, 1)}L{num(12 + rng.random() * 9, 1)} {num(y + rng.normal(0, .25), 1)}" '
                    'stroke="#000" stroke-width=".55" stroke-linecap="round"/>' for y in (10.4, 12.6, 14.6))
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 25" width="40" height="25" aria-hidden="true">'
            '<defs><mask id="m"><rect width="40" height="25" fill="#fff"/>' + rayas + '</mask></defs>'
            f'<path mask="url(#m)" fill="{AZUL}" d="{d}"/></svg>')


def generar_brocha(destino):
    destino = Path(destino)
    destino.mkdir(parents=True, exist_ok=True)
    pesos = {}
    for nombre, f in (('pizarra', pizarra), ('piedra', piedra), ('madera', madera)):
        im = f()
        ruta = destino / f'{nombre}.webp'
        cv2.imwrite(str(ruta), im[..., ::-1], [cv2.IMWRITE_WEBP_QUALITY, 62])
        pesos[nombre] = ruta.stat().st_size
    (destino / 'foco-flecha.svg').write_text(foco_flecha_svg(), encoding='utf-8')
    (destino / 'brocha.json').write_text(json.dumps({
        'nota': 'Generado por scripts/vectorizar-cartel.py --brocha. Texturas de 512 px sin costuras (ruido filtrado en Fourier; la piedra es un Voronoi aplastado).',
        'semillas': {'pizarra': 7, 'piedra': 11, 'madera': 5, 'foco-flecha': 3},
        'bytes': pesos,
        'pincel': {'semilla_cortina': 20261023, 'cerdas': 34, 'descripcion': 'El modelo de cerdas (carga, secado, gota) vive en js/flecha.js con estas semillas.'},
    }, ensure_ascii=False, indent=2), encoding='utf-8')
    return pesos


# ---------------------------------------------------------------- ensamblado
def ensamblar(letra, rotulo, apart, informe, ruta_salida):
    defs = []
    for nombre in ('casa', 'sanchez'):
        trazos = letra[nombre]['trazos']
        ps = ''.join(f'<path class="trazo" pathLength="1" d="{a_bezier(t)}"/>' for t in trazos)
        defs.append(f'<mask id="trazo-{nombre}" maskUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}">{ps}</mask>')
    css = (
        '<style>'
        f'.panel{{fill:{AMARILLO}}}.canto{{fill:#C9A63A}}.canto-linea{{fill:#8A6D22}}.franja{{fill:{BLANCO}}}'
        f'.flor .petalo>path:first-child{{fill:{ORO}}}.flor .nervio{{fill:none;stroke:{AMARILLO};stroke-width:1.1;stroke-linecap:round}}'
        f'.flor .centro{{fill:{PARDO}}}'
        f'#letra-casa path,#letra-sanchez path{{fill:{ORO};fill-rule:evenodd}}'
        f'.trazo{{fill:none;stroke:#fff;stroke-width:8;stroke-linecap:butt;stroke-linejoin:round}}'
        f'#apartamentos path{{fill:{ORO}}}'
        f'#vieira .rayos,#vieira .charnela{{fill:{PARDO}}}'
        f'#peregrino .cabeza{{fill:{PARDO}}}#peregrino .cuerpo{{fill:none;stroke:{PARDO};stroke-width:7;stroke-linecap:round;stroke-linejoin:round}}'
        f'#peregrino .baston{{fill:none;stroke:#F5EBC8;stroke-width:2.4;stroke-linecap:round}}'
        f'#flecha path{{fill:{AZUL};stroke:{AZUL};stroke-width:3;stroke-linejoin:round}}#flecha circle{{fill:#CFC6F0}}'
        f'#albergue path,#turistico path{{fill:{PARDO}}}'
        '</style>')
    franja = franja_d()
    flores = ''.join(flor_svg(*f) for f in FLORES)
    albergue = ''.join(f'<path data-i="{i}" data-c="{l["c"]}" d="{l["d"]}"/>' for i, l in enumerate(rotulo['ALBERGUE']))
    turistico = ''.join(f'<path data-i="{i}" data-c="{l["c"]}" d="{l["d"]}"/>' for i, l in enumerate(rotulo['TURÍSTICO']))
    cx = 22 + (182 - 22) / 2
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" '
        'aria-labelledby="cartel-t"><title id="cartel-t">Cartel del Albergue Casa Sánchez: «Casa Sánchez, apartamentos rurales», '
        'una flecha y «Albergue turístico»</title>'
        f'<defs>{"".join(defs)}</defs>{css}'
        f'<g id="cartel">'
        f'<g id="panel"><rect class="panel" width="{W}" height="{H}"/><rect class="canto" x="991" width="9" height="{H}"/>'
        f'<rect class="canto-linea" x="998" width="2" height="{H}"/></g>'
        f'<path id="franja" class="franja" d="{franja}"/>'
        f'{flores}'
        f'<g id="letra-casa" mask="url(#trazo-casa)"><path d="{letra["casa"]["d"]}"/></g>'
        f'<g id="letra-sanchez" mask="url(#trazo-sanchez)"><path d="{letra["sanchez"]["d"]}"/></g>'
        f'<g id="apartamentos"><path d="{apart}"/></g>'
        f'{vieira_svg()}{peregrino_svg()}'
        f'<g id="flecha" data-centro="{num(cx)} 404"><path d="{flecha_d()}"/><circle cx="78" cy="404" r="3"/></g>'
        f'<g id="albergue">{albergue}</g><g id="turistico">{turistico}</g>'
        '</g></svg>')
    return svg


def svgs_sueltos(letra, flecha_cx=102.0):
    """Piezas sueltas para la cabecera, el favicon y las flores del resto de la web."""
    letras = ''.join(letra[n]['d'] for n in ('casa', 'sanchez'))
    ys = [p[1] for n in ('casa', 'sanchez') for t in letra[n]['trazos'] for p in t]
    xs = [p[0] for n in ('casa', 'sanchez') for t in letra[n]['trazos'] for p in t]
    x0, x1, y0, y1 = min(xs) - 6, max(xs) + 6, min(ys) - 10, max(ys) + 8
    cabecera = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{num(x0)} {num(y0)} {num(x1 - x0)} {num(y1 - y0)}" role="img" '
                f'aria-label="Casa Sánchez"><path fill="currentColor" fill-rule="evenodd" d="{letras}"/></svg>')
    flecha = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 340 185 130" role="img" aria-label="Flecha">'
              f'<path fill="{AZUL}" stroke="{AZUL}" stroke-width="3" stroke-linejoin="round" d="{flecha_d()}"/></svg>')
    flor = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100" role="img" aria-label="Flor del cartel">'
            f'<style>.flor .petalo>path:first-child{{fill:{ORO}}}.flor .nervio{{fill:none;stroke:{AMARILLO};stroke-width:1.1;stroke-linecap:round}}.flor .centro{{fill:{PARDO}}}</style>'
            f'{flor_svg("flor", 0, 0, 46.0, 8.0, con_transform=False)}</svg>')
    return cabecera, flecha, flor


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--salida', default=str(RAIZ / 'marca'))
    ap.add_argument('--cache', default=str(Path(tempfile.gettempdir()) / 'cartel-vec-cache'))
    ap.add_argument('--brocha', action='store_true', help='solo regenera img/brocha/ (texturas y flecha del foco)')
    ap.add_argument('--depurar', default=None, help='carpeta donde guardar imágenes de comprobación')
    a = ap.parse_args()
    if a.brocha:
        print('texturas:', generar_brocha(RAIZ / 'img/brocha'))
        return
    salida = Path(a.salida)
    salida.mkdir(parents=True, exist_ok=True)
    if a.depurar:
        Path(a.depurar).mkdir(parents=True, exist_ok=True)

    print('1/4 letra manuscrita…')
    letra, corr = letra_manuscrita(a.depurar)
    print(f'    registro contra la foto: correlación ECC {corr:.3f}; '
          f'trazos: casa {len(letra["casa"]["trazos"])}, sanchez {len(letra["sanchez"]["trazos"])}')
    print('2/4 ALBERGUE TURÍSTICO…')
    rotulo, informe = ajustar_rotulo(a.cache, a.depurar)
    for p, v in informe.items():
        print(f'    {p}: IoU media por letra {v["media_por_letra"]}, de la palabra {v["iou_palabra"]} (con el desenfoque de la foto: {v["iou_palabra_desenfocada"]}; umbral {v["umbral"]})')
    print('3/4 resto de piezas…')
    apart = apartamentos(a.cache)
    print('4/4 escribiendo…')
    svg = ensamblar(letra, rotulo, apart, informe, salida)
    (salida / 'cartel.svg').write_text(svg, encoding='utf-8')
    cab, fle, flo = svgs_sueltos(letra)
    (salida / 'cartel-letra.svg').write_text(cab, encoding='utf-8')
    (salida / 'cartel-flecha.svg').write_text(fle, encoding='utf-8')
    (salida / 'cartel-flor.svg').write_text(flo, encoding='utf-8')
    esq = {
        'foto': 'entrada-cartel',
        'origen': 'ref/fotos/instagram/2017-12-15_Bcu68zMB-Le.jpg',
        'tamano_foto': [640, 640],
        'lienzo': [W, H],
        'esquinas': ESQUINAS_IG,
        'orden': 'arriba-izquierda, arriba-derecha, abajo-derecha, abajo-izquierda (px de la foto original)',
        'nota': 'Las dos de abajo las tapa la cerca: la derecha es donde empieza la cerca; la izquierda sigue la inclinación del borde de arriba.',
        'flecha': {'centro': [102.0, 404.0], 'punta': [22.0, 404.0]},
        'iou': informe,
        'ecc_letra': round(corr, 3),
    }
    (salida / 'cartel-esquinas.json').write_text(json.dumps(esq, ensure_ascii=False, indent=2), encoding='utf-8')
    (salida / 'cartel-iou.json').write_text(json.dumps(informe, ensure_ascii=False, indent=2), encoding='utf-8')
    generar_brocha(RAIZ / 'img/brocha')
    print('listo:', ', '.join(sorted(p.name for p in salida.glob('cartel*'))))


if __name__ == '__main__':
    main()
