/* Comprueba la receta de borrado del mando de maqueta (README) sobre copias en memoria:
   quita los tres bloques marcados y mira que no queda nada del mando y que el JS sigue siendo válido.
   Uso: node scripts/probar-borrado-mando.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');
const quitar = (s, re, que) => { if (!re.test(s)) throw new Error('No encuentro el bloque: ' + que); return s.replace(re, ''); };

let cabeza = leer('partes/cabeza.html');
cabeza = quitar(cabeza, /\s*\/\/ MANDO DE MAQUETA[^\n]*\n\s*try \{[\s\S]*?\n  \} catch \(e\) \{\}\n/, 'cabeza.html: try del mando');
let pie = leer('partes/pie.html');
pie = quitar(pie, /<!-- MANDO DE MAQUETA[\s\S]*?<!-- fin del MANDO DE MAQUETA -->\n?/, 'pie.html: el mando');
let main = leer('js/main.js');
main = quitar(main, /\s*\/\* =+ 13\. MANDO DE MAQUETA[\s\S]*?\/\* fin del MANDO DE MAQUETA \*\//, 'main.js: bloque 13');

const fallos = [];
if (/revision|densidad-sobria/.test(cabeza)) fallos.push('la cabeza aún habla de revision/densidad');
if (/id="mando"|data-densidad/.test(pie)) fallos.push('el pie aún tiene el mando');
if (/data-densidad|botones\.forEach|pintarMando/.test(main)) fallos.push('main.js aún tiene el mando');
try { new vm.Script(main); } catch (e) { fallos.push('main.js no se lee: ' + e.message); }
const script = cabeza.match(/<script>([\s\S]*?)<\/script>/)[1];
try { new vm.Script(script); } catch (e) { fallos.push('el script de la cabeza no se lee: ' + e.message); }
console.log(fallos.length ? 'FALLA la receta:\n - ' + fallos.join('\n - ') : 'La receta de borrado del mando funciona: sin restos y el JS se lee.');
process.exitCode = fallos.length ? 1 : 0;
