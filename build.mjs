import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = dirname(fileURLToPath(import.meta.url));
const ORDEN = ["fechas.js", "pascua.js", "tarifas.js", "festivos.js", "motor.js", "nomina.js", "estado.js", "ui.js"];

function leer(nombre) {
  return readFileSync(join(raiz, "src", nombre), "utf8");
}

function desmodularizar(codigo) {
  return codigo
    .replace(/^import[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm, "")
    .replace(/^export\s+/gm, "")
    .trim();
}

export function construir() {
  const js = ORDEN.map((n) => desmodularizar(leer(n))).join("\n\n");
  return `<meta charset="utf-8">
<title>cuadrante</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
${leer("estilos.css").trim()}
</style>
${leer("plantilla.html").trim()}
<script type="module">
${js}

iniciar(document.body, localStorage);
</script>`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(join(raiz, "cuadrante.html"), construir(), "utf8");
  console.log("cuadrante.html generado");
}
