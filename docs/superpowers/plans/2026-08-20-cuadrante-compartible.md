# Cuadrante compartible — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el cuadrante de una app con un usuario incrustado en el código a una app que cualquier residente andaluz pueda usar con sus propios datos, arreglando de paso los defectos de la revisión del 20/08/2026.

**Architecture:** El código deriva los festivos por año (fijos + Semana Santa por Computus) y aporta las tablas del anexo XVI; el estado guardado pasa a contener solo **excepciones** del usuario, no copias. Eso arregla estructuralmente el bug del merge superficial y deja el estado lo bastante pequeño para exportarlo por copiar-pegar.

**Tech Stack:** JavaScript ES2022 (módulos nativos), `node:test` + `node:assert`, sin dependencias externas. Node v24.18.0 verificado en la máquina.

**Spec:** `docs/superpowers/specs/2026-08-20-cuadrante-compartible-design.md`

## Global Constraints

- **Cero dependencias.** Ni npm install ni CDN. El HTML final debe abrirse sin red.
- **Idioma:** identificadores, comentarios y textos de interfaz en español. Sin eñes ni tildes en identificadores (`anioResidencia`, no `añoResidencia`).
- **Las cifras ya validadas no se mueven.** Los seis casos del motor y los resúmenes de junio y agosto de 2026 deben dar exactamente lo mismo al final del plan. Es el criterio que demuestra que la migración no ha roto nada.
- **Redondeo monetario:** una única función `redondear(n)` = `Math.round(n * 100) / 100`, aplicada al importe de cada tramo y a cada descuento.
- **Orden de cálculo del neto, obligatorio:** `descuento = redondear(bruto × tipo)` y después `neto = redondear(bruto − descuento)`.
- **Tipos de retención como fracción con 6 decimales.** Valores por defecto: `retencionBase: 0.089753`, `retencionGuardias: 0.032609`.
- **Tarifas del anexo XVI.2:** R1 `14.07 / 15.78 / 28.14`; R2 `15.42 / 17.28 / 30.84`; R3 `18.02 / 20.17 / 36.04`; R4 y R5 `20.22 / 22.61 / 40.44` (laborable / S-D-F / especial).
- **Sueldo base:** `1379.90` €/mes. C.G. Formación: R1 `0`, R2 `110.38`, R3 `248.41`, R4 `386.37`, R5 `524.38`.
- **Clave de `localStorage`:** pasa de `cuadrante_v5` a `cuadrante_v6`.
- **La regla del corte a medianoche sigue sin verificar.** Ningún texto de la interfaz puede presentarla como confirmada.
- **Ningún dato personal en el código** al terminar el plan.

---

## File Structure

| Archivo | Responsabilidad | Estado |
|---|---|---|
| `src/pascua.js` | Computus: domingo de Pascua de un año | **nuevo** |
| `src/fechas.js` | Aritmética de fechas y horas en texto | + `desplazar` |
| `src/festivos.js` | Calendario derivado por año y resolución de excepciones | **reescrito** |
| `src/tarifas.js` | Tablas del anexo XVI, sobrescribibles desde config | modificado |
| `src/motor.js` | Partición de la guardia a medianoche e importes | modificado |
| `src/nomina.js` | Tipos efectivos, resumen mensual y desfase | modificado |
| `src/estado.js` | Estado v6, migración desde v5 y persistencia | **reescrito** |
| `src/ui.js` | Render, modal, ajustes, primer arranque, exportar | modificado |
| `src/estilos.css` | Tema oscuro | modificado |
| `src/plantilla.html` | Esqueleto | modificado |
| `build.mjs` | Inlinea `src/` en `cuadrante.html` | + `pascua.js` en ORDEN |

`pascua.js` va aparte de `festivos.js` porque es un algoritmo cerrado con su propia
tabla de verificación: separado se prueba contra fechas conocidas sin arrastrar el
resto del calendario.

---

### Task 1: Computus y desplazamiento de fechas

**Files:**
- Create: `src/pascua.js`
- Modify: `src/fechas.js`
- Test: `test/pascua.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: `domingoDePascua(anio) → fechaISO`; `desplazar(fechaISO, dias) → fechaISO` en `fechas.js`.

Las fechas de la tabla se verificaron ejecutando el algoritmo antes de escribir este
plan. Las de 2026 coinciden con las que hoy están escritas a mano en `FESTIVOS_2026`,
lo que confirma la implementación contra los datos que ya había en el proyecto.

- [ ] **Step 1: Write the failing test**

```javascript
// test/pascua.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { domingoDePascua } from "../src/pascua.js";
import { desplazar, diaSemana } from "../src/fechas.js";

test("el domingo de Pascua sale correcto en anios conocidos", () => {
  assert.equal(domingoDePascua(2024), "2024-03-31");
  assert.equal(domingoDePascua(2025), "2025-04-20");
  assert.equal(domingoDePascua(2026), "2026-04-05");
  assert.equal(domingoDePascua(2027), "2027-03-28");
  assert.equal(domingoDePascua(2028), "2028-04-16");
  assert.equal(domingoDePascua(2029), "2029-04-01");
  assert.equal(domingoDePascua(2030), "2030-04-21");
});

test("el domingo de Pascua siempre cae en domingo", () => {
  for (let anio = 2024; anio <= 2040; anio += 1) {
    assert.equal(diaSemana(domingoDePascua(anio)), 0, `${anio}`);
  }
});

test("Jueves y Viernes Santo de 2026 coinciden con los datos ya validados", () => {
  const pascua = domingoDePascua(2026);
  assert.equal(desplazar(pascua, -3), "2026-04-02"); // Jueves Santo
  assert.equal(desplazar(pascua, -2), "2026-04-03"); // Viernes Santo
});

test("desplazar cruza fin de mes, fin de anio y bisiesto", () => {
  assert.equal(desplazar("2026-08-31", 1), "2026-09-01");
  assert.equal(desplazar("2026-12-31", 1), "2027-01-01");
  assert.equal(desplazar("2027-01-01", -1), "2026-12-31");
  assert.equal(desplazar("2028-02-28", 1), "2028-02-29");
  assert.equal(desplazar("2026-04-05", -3), "2026-04-02");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/pascua.test.js`
Expected: FAIL, `Cannot find module '../src/pascua.js'`

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/pascua.js

// Algoritmo anonimo gregoriano.
export function domingoDePascua(anio) {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}
```

En `src/fechas.js`, añadir `desplazar` y reescribir `diaSiguiente` en términos de ella
para no repetir la aritmética:

```javascript
// src/fechas.js — sustituir diaSiguiente por estas dos funciones
export function desplazar(fechaISO, dias) {
  const { a, m, d } = partes(fechaISO);
  const x = new Date(a, m - 1, d + dias);
  return texto(x.getFullYear(), x.getMonth() + 1, x.getDate());
}

export function diaSiguiente(fechaISO) {
  return desplazar(fechaISO, 1);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, las suites existentes siguen verdes y `pascua.test.js` pasa

- [ ] **Step 5: Commit**

```bash
git add src/pascua.js src/fechas.js test/pascua.test.js
git commit -m "Anadir calculo del domingo de Pascua"
```

---

### Task 2: Calendario derivado por año

**Files:**
- Modify: `src/festivos.js`
- Test: `test/calendario.test.js`

**Interfaces:**
- Consumes: `domingoDePascua` de `src/pascua.js`; `desplazar`, `diaSemana` de `src/fechas.js`.
- Produces: `festivosDerivados(anio) → { [fechaISO]: { nombre, ambito, clase } }`.

Se añade la función nueva **sin tocar todavía** `festivosIniciales` ni `clasificarDia`,
para que las suites existentes sigan verdes. La migración de los consumidores es la
Task 3.

Ámbito: nacionales (9 fijos + Viernes Santo) y andaluces (Día de Andalucía y Jueves
Santo). Jueves Santo no es estatal: cada comunidad decide, y Andalucía lo toma.
Nochebuena y Nochevieja **no** entran: no son festivos, y con el modelo de excepciones
cualquier día se puede marcar como especial.

- [ ] **Step 1: Write the failing test**

```javascript
// test/calendario.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { festivosDerivados } from "../src/festivos.js";

test("2026 deriva los mismos 14 festivos que estaban escritos a mano", () => {
  const c = festivosDerivados(2026);
  const esperadas = [
    "2026-01-01", "2026-01-06", "2026-02-28", "2026-04-02", "2026-04-03",
    "2026-05-01", "2026-08-15", "2026-10-12", "2026-11-01", "2026-12-06",
    "2026-12-08", "2026-12-25",
  ];
  for (const f of esperadas) {
    assert.ok(c[f], `falta ${f}`);
  }
  assert.equal(Object.keys(c).length, 12);
});

test("los locales de Cordoba ya no estan en el calendario derivado", () => {
  const c = festivosDerivados(2026);
  assert.equal(c["2026-09-08"], undefined); // Fuensanta
  assert.equal(c["2026-10-24"], undefined); // San Rafael
});

test("Nochebuena y Nochevieja no son festivos", () => {
  const c = festivosDerivados(2026);
  assert.equal(c["2026-12-24"], undefined);
  assert.equal(c["2026-12-31"], undefined);
});

test("la Semana Santa se mueve con el anio", () => {
  assert.equal(festivosDerivados(2026)["2026-04-02"].nombre, "Jueves Santo");
  assert.equal(festivosDerivados(2027)["2027-03-25"].nombre, "Jueves Santo");
  assert.equal(festivosDerivados(2027)["2027-03-26"].nombre, "Viernes Santo");
  assert.equal(festivosDerivados(2027)["2027-04-02"], undefined);
});

test("los festivos existen en todos los anios de una residencia", () => {
  for (const anio of [2026, 2027, 2028, 2029, 2030]) {
    const c = festivosDerivados(anio);
    assert.ok(c[`${anio}-01-01`], `Ano Nuevo de ${anio}`);
    assert.ok(c[`${anio}-12-25`], `Navidad de ${anio}`);
    assert.ok(c[`${anio}-02-28`], `Dia de Andalucia de ${anio}`);
  }
});

test("cada festivo lleva ambito y arranca como sdf", () => {
  const c = festivosDerivados(2026);
  assert.equal(c["2026-01-01"].ambito, "nacional");
  assert.equal(c["2026-02-28"].ambito, "autonomico");
  assert.equal(c["2026-04-02"].ambito, "autonomico");
  assert.equal(c["2026-01-01"].clase, "sdf");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/calendario.test.js`
Expected: FAIL, `does not provide an export named 'festivosDerivados'`

- [ ] **Step 3: Write minimal implementation**

Añadir al principio de `src/festivos.js`, dejando lo existente por debajo:

```javascript
// src/festivos.js
import { diaSemana, desplazar } from "./fechas.js";
import { domingoDePascua } from "./pascua.js";

const FIJOS_NACIONALES = [
  ["01-01", "Ano Nuevo"],
  ["01-06", "Reyes"],
  ["05-01", "Fiesta del Trabajo"],
  ["08-15", "Asuncion"],
  ["10-12", "Fiesta Nacional"],
  ["11-01", "Todos los Santos"],
  ["12-06", "Constitucion"],
  ["12-08", "Inmaculada"],
  ["12-25", "Navidad"],
];

export function festivosDerivados(anio) {
  const mapa = {};
  for (const [diaMes, nombre] of FIJOS_NACIONALES) {
    mapa[`${anio}-${diaMes}`] = { nombre, ambito: "nacional", clase: "sdf" };
  }
  const pascua = domingoDePascua(anio);
  mapa[desplazar(pascua, -2)] = { nombre: "Viernes Santo", ambito: "nacional", clase: "sdf" };
  mapa[`${anio}-02-28`] = { nombre: "Dia de Andalucia", ambito: "autonomico", clase: "sdf" };
  mapa[desplazar(pascua, -3)] = { nombre: "Jueves Santo", ambito: "autonomico", clase: "sdf" };
  return mapa;
}

const cacheDerivados = new Map();

export function derivadosDe(anio) {
  if (!cacheDerivados.has(anio)) cacheDerivados.set(anio, festivosDerivados(anio));
  return cacheDerivados.get(anio);
}
```

`derivadosDe` memoriza porque `clasificarDia` se llama una vez por tramo y
`resumenAnio` recorre doce meses: sin caché se recalcularía el calendario miles de
veces.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, todas las suites

- [ ] **Step 5: Commit**

```bash
git add src/festivos.js test/calendario.test.js
git commit -m "Anadir calendario de festivos derivado por anio"
```

---

### Task 3: Excepciones del usuario y migración de los consumidores

**Files:**
- Modify: `src/festivos.js`, `src/motor.js`
- Test: `test/calendario.test.js`, `test/festivos.test.js`, `test/motor.test.js`, `test/resumen.test.js`, `test/hipotesis.test.js`

**Interfaces:**
- Consumes: `derivadosDe` de `src/festivos.js`.
- Produces: `clasificarDia(fechaISO, excepciones) → "laborable" | "sdf" | "especial"`; `calendarioDe(anio, excepciones) → { [fechaISO]: { nombre, ambito, clase } }`. `festivosIniciales`, `FESTIVOS_2026` y `CANDIDATOS_ESPECIALES` **desaparecen**.

Esta es la tarea que cambia la API, así que arrastra a todos los consumidores. Al
terminar, ninguna suite puede quedar roja.

**Semántica de las excepciones, idéntica a la de v5** para no mover ninguna cifra:
`clase: "especial"` → especial; `clase: "sdf"` → sdf; `clase: "laborable"` → se ignora
el derivado y manda el día de la semana; sin excepción → derivado y luego día de la
semana.

- [ ] **Step 1: Write the failing test**

Añadir a `test/calendario.test.js`:

```javascript
import { clasificarDia, calendarioDe } from "../src/festivos.js";

test("sin excepciones manda el derivado y luego el dia de la semana", () => {
  assert.equal(clasificarDia("2026-08-05", {}), "laborable"); // miercoles
  assert.equal(clasificarDia("2026-08-02", {}), "sdf");       // domingo
  assert.equal(clasificarDia("2026-06-20", {}), "sdf");       // sabado
  assert.equal(clasificarDia("2026-01-01", {}), "sdf");       // festivo derivado
  assert.equal(clasificarDia("2027-01-01", {}), "sdf");       // y en 2027 tambien
});

test("una excepcion especial gana al derivado y al dia de la semana", () => {
  assert.equal(clasificarDia("2026-01-01", { "2026-01-01": { clase: "especial" } }), "especial");
  assert.equal(clasificarDia("2026-12-24", { "2026-12-24": { clase: "especial" } }), "especial");
});

test("una excepcion laborable desmarca un festivo derivado", () => {
  assert.equal(clasificarDia("2026-01-01", { "2026-01-01": { clase: "laborable" } }), "laborable");
});

test("una excepcion laborable no convierte un domingo en laborable", () => {
  assert.equal(clasificarDia("2026-08-02", { "2026-08-02": { clase: "laborable" } }), "sdf");
});

test("un festivo local dado de alta clasifica como festivo", () => {
  const exc = { "2026-09-08": { nombre: "Fuensanta", clase: "sdf" } };
  assert.equal(clasificarDia("2026-09-08", exc), "sdf"); // martes
});

test("calendarioDe mezcla derivados, altas y reclasificaciones", () => {
  const c = calendarioDe(2026, {
    "2026-01-01": { clase: "especial" },
    "2026-09-08": { nombre: "Fuensanta", clase: "sdf" },
  });
  assert.equal(c["2026-01-01"].clase, "especial");
  assert.equal(c["2026-01-01"].nombre, "Ano Nuevo");
  assert.equal(c["2026-09-08"].nombre, "Fuensanta");
  assert.equal(c["2026-09-08"].ambito, "local");
  assert.equal(c["2026-12-25"].clase, "sdf");
});

test("calendarioDe ignora las excepciones de otros anios", () => {
  const c = calendarioDe(2026, { "2027-06-01": { nombre: "X", clase: "sdf" } });
  assert.equal(c["2027-06-01"], undefined);
});
```

En `test/festivos.test.js`, `test/motor.test.js`, `test/resumen.test.js` y
`test/hipotesis.test.js`: eliminar el import de `festivosIniciales` y sustituir cada
llamada `festivosIniciales()` por `{}` (ningún test existente dependía de los festivos
locales de Córdoba). Los tres tests de `test/festivos.test.js` que comprobaban
`FESTIVOS_2026` y `festivosIniciales` se borran: los sustituyen los de
`test/calendario.test.js`. Los que comprobaban `clasificarDia` se quedan, cambiando
`festivosIniciales()` por `{}`.

Los dos tests del motor que marcaban un festivo como especial pasan de mutar el mapa a
pasar una excepción:

```javascript
// test/motor.test.js — casos 4 y 5 del spec
test("caso 4 del spec: 24h en festivo especial cruza a laborable", () => {
  const exc = { "2026-09-08": { nombre: "Fuensanta", clase: "especial" } };
  const r = calcularGuardia(
    { fecha: "2026-09-08", horas: 24, inicio: "08:00" }, exc, CONFIG);
  assert.deepEqual(r.importePorTipo, { laborable: 112.56, sdf: 0, especial: 450.24 });
  assert.equal(r.bruto, 562.80);
});

test("caso 5 del spec: con el corte de especiales desactivado son 24h especiales", () => {
  const exc = { "2026-09-08": { nombre: "Fuensanta", clase: "especial" } };
  const r = calcularGuardia(
    { fecha: "2026-09-08", horas: 24, inicio: "08:00" },
    exc, { ...CONFIG, especialCortaAMedianoche: false });
  assert.equal(r.horasPorTipo.especial, 24);
  assert.equal(r.bruto, 675.36);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL, `does not provide an export named 'calendarioDe'` y errores de
`festivosIniciales` no definida en las suites migradas

- [ ] **Step 3: Write minimal implementation**

Sustituir en `src/festivos.js` todo lo que quedaba de v5 (`FESTIVOS_2026`,
`CANDIDATOS_ESPECIALES`, `festivosIniciales` y la vieja `clasificarDia`) por:

```javascript
export function clasificarDia(fechaISO, excepciones = {}) {
  const marcado = excepciones[fechaISO];
  if (marcado && marcado.clase === "especial") return "especial";
  if (marcado && marcado.clase === "sdf") return "sdf";
  if (!marcado || marcado.clase !== "laborable") {
    if (derivadosDe(Number(fechaISO.slice(0, 4)))[fechaISO]) return "sdf";
  }
  const dia = diaSemana(fechaISO);
  return dia === 0 || dia === 6 ? "sdf" : "laborable";
}

export function calendarioDe(anio, excepciones = {}) {
  const mapa = { ...derivadosDe(anio) };
  for (const [fecha, exc] of Object.entries(excepciones)) {
    if (Number(fecha.slice(0, 4)) !== anio) continue;
    if (mapa[fecha]) mapa[fecha] = { ...mapa[fecha], clase: exc.clase };
    else if (exc.nombre) mapa[fecha] = { nombre: exc.nombre, ambito: "local", clase: exc.clase };
  }
  return mapa;
}
```

`calendarioDe` copia el objeto de `derivadosDe` antes de mutarlo: la caché devuelve
siempre la misma referencia y sin la copia una reclasificación contaminaría el
calendario base de todas las llamadas siguientes.

`src/motor.js` no cambia de código —ya recibe el mapa por parámetro— pero sí de
significado: el segundo argumento pasa a ser el mapa de excepciones. Actualizar el
comentario de cabecera de `partirGuardia` y `calcularGuardia` para que lo diga.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS. Las cifras de los seis casos del spec y de junio y agosto de 2026 son
idénticas a las de antes del cambio.

- [ ] **Step 5: Commit**

```bash
git add src/festivos.js src/motor.js test/
git commit -m "Sustituir el calendario copiado por excepciones del usuario"
```

---

### Task 4: Retribuciones configurables

**Files:**
- Modify: `src/tarifas.js`, `src/motor.js`, `src/nomina.js`
- Test: `test/tarifas.test.js`

**Interfaces:**
- Consumes: `redondear` de `src/fechas.js`.
- Produces: `RETRIBUCIONES_ANEXO`, `retribucionesDe(config) → bloque`, `tarifaEn(fechaISO, config) → { laborable, sdf, especial }`, `retribucionFija(anioResidencia, config) → { sueldo, cg, mensual, anual }`. `TARIFAS`, `SUELDO_BASE` y `CG_FORMACION` desaparecen como exports sueltos.

`tarifaEn` y `retribucionFija` cambian de firma: reciben el objeto `config` entero en
vez de `inicioResidencia` suelto, para poder leer `config.retribuciones`.

`anioResidenciaEn` tiene que tolerar `inicioResidencia: null`, que es el estado de un
usuario nuevo antes de contestar la pregunta del primer arranque. Sin esta guarda la
app revienta al pintar el calendario vacío.

- [ ] **Step 1: Write the failing test**

Reescribir `test/tarifas.test.js`:

```javascript
// test/tarifas.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RETRIBUCIONES_ANEXO, anioResidenciaEn, tarifaEn, retribucionFija,
} from "../src/tarifas.js";

const CONFIG = { inicioResidencia: "2026-05-27", retribuciones: null };

test("las tarifas son las del anexo XVI.2", () => {
  const g = RETRIBUCIONES_ANEXO.guardias;
  assert.deepEqual(g[1], { laborable: 14.07, sdf: 15.78, especial: 28.14 });
  assert.deepEqual(g[2], { laborable: 15.42, sdf: 17.28, especial: 30.84 });
  assert.deepEqual(g[3], { laborable: 18.02, sdf: 20.17, especial: 36.04 });
  assert.deepEqual(g[4], { laborable: 20.22, sdf: 22.61, especial: 40.44 });
  assert.deepEqual(g[5], g[4]);
  assert.equal(RETRIBUCIONES_ANEXO.sueldoBase, 1379.90);
});

test("el anio de residencia avanza en la fecha de cambio", () => {
  assert.equal(anioResidenciaEn("2026-08-19", "2026-05-27"), 1);
  assert.equal(anioResidenciaEn("2027-05-26", "2026-05-27"), 1);
  assert.equal(anioResidenciaEn("2027-05-27", "2026-05-27"), 2);
  assert.equal(anioResidenciaEn("2030-06-01", "2026-05-27"), 5);
  assert.equal(anioResidenciaEn("2035-01-01", "2026-05-27"), 5);
  assert.equal(anioResidenciaEn("2026-01-01", "2026-05-27"), 1);
});

test("sin fecha de inicio se asume primer anio", () => {
  assert.equal(anioResidenciaEn("2026-08-19", null), 1);
  assert.equal(anioResidenciaEn("2026-08-19", undefined), 1);
});

test("tarifaEn cruza el cambio de anio", () => {
  assert.equal(tarifaEn("2027-05-26", CONFIG).laborable, 14.07);
  assert.equal(tarifaEn("2027-05-27", CONFIG).laborable, 15.42);
});

test("la retribucion fija reproduce el anexo XVI.1", () => {
  assert.equal(retribucionFija(1, CONFIG).anual, 19318.60);
  assert.equal(retribucionFija(2, CONFIG).anual, 20863.92);
  assert.equal(retribucionFija(3, CONFIG).anual, 22796.34);
  assert.equal(retribucionFija(4, CONFIG).anual, 24727.78);
  assert.equal(retribucionFija(5, CONFIG).anual, 26659.92);
  assert.equal(retribucionFija(2, CONFIG).mensual, 1490.28);
});

test("las retribuciones propias del usuario ganan al anexo", () => {
  const propio = {
    inicioResidencia: "2026-05-27",
    retribuciones: {
      guardias: { 1: { laborable: 20, sdf: 25, especial: 40 } },
      sueldoBase: 1500,
      cgFormacion: { 1: 100 },
    },
  };
  assert.equal(tarifaEn("2026-08-19", propio).laborable, 20);
  assert.equal(retribucionFija(1, propio).mensual, 1600);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/tarifas.test.js`
Expected: FAIL, `does not provide an export named 'RETRIBUCIONES_ANEXO'`

- [ ] **Step 3: Write minimal implementation**

Reescribir `src/tarifas.js`:

```javascript
// src/tarifas.js
import { redondear } from "./fechas.js";

export const RETRIBUCIONES_ANEXO = {
  guardias: {
    1: { laborable: 14.07, sdf: 15.78, especial: 28.14 },
    2: { laborable: 15.42, sdf: 17.28, especial: 30.84 },
    3: { laborable: 18.02, sdf: 20.17, especial: 36.04 },
    4: { laborable: 20.22, sdf: 22.61, especial: 40.44 },
    5: { laborable: 20.22, sdf: 22.61, especial: 40.44 },
  },
  sueldoBase: 1379.90,
  cgFormacion: { 1: 0, 2: 110.38, 3: 248.41, 4: 386.37, 5: 524.38 },
};

export const PAGAS = 14;

export function retribucionesDe(config) {
  return (config && config.retribuciones) || RETRIBUCIONES_ANEXO;
}

export function anioResidenciaEn(fechaISO, inicioResidencia) {
  if (!inicioResidencia) return 1;
  const [ai, mi, di] = inicioResidencia.split("-").map(Number);
  const [af, mf, df] = fechaISO.split("-").map(Number);
  let anios = af - ai;
  if (mf < mi || (mf === mi && df < di)) anios -= 1;
  return Math.min(5, Math.max(1, anios + 1));
}

export function tarifaEn(fechaISO, config) {
  const anio = anioResidenciaEn(fechaISO, config.inicioResidencia);
  return retribucionesDe(config).guardias[anio];
}

export function retribucionFija(anioResidencia, config) {
  const r = retribucionesDe(config);
  const sueldo = r.sueldoBase;
  const cg = r.cgFormacion[anioResidencia];
  const mensual = redondear(sueldo + cg);
  return { sueldo, cg, mensual, anual: redondear(mensual * PAGAS) };
}
```

En `src/motor.js`, línea de `calcularGuardia`, cambiar la llamada:

```javascript
const tarifa = tarifaEn(t.fecha, config)[t.tipo];
```

En `src/nomina.js`, dentro de `resumenMes`, cambiar:

```javascript
const brutoBase = retribucionFija(anio, estado.config).mensual;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, todas las suites

- [ ] **Step 5: Commit**

```bash
git add src/tarifas.js src/motor.js src/nomina.js test/tarifas.test.js
git commit -m "Permitir sobrescribir las retribuciones del anexo"
```

---

### Task 5: Estado v6, arranque vacío y migración

**Files:**
- Modify: `src/estado.js`
- Test: `test/estado.test.js`, `test/migracion.test.js`

**Interfaces:**
- Consumes: `festivosDerivados` de `src/festivos.js`.
- Produces: `CLAVE` (`"cuadrante_v6"`), `CLAVE_V5`, `estadoInicial() → estado`, `migrarV5(v5) → estado`, `cargar(almacen) → estado`, `guardar(almacen, estado) → void`.

Aquí desaparecen los datos personales del código. Los tests de `estado.test.js` que
afirmaban 9 guardias y 2 nóminas se reescriben: afirman lo contrario por diseño.

- [ ] **Step 1: Write the failing test**

Reescribir `test/estado.test.js`:

```javascript
// test/estado.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { CLAVE, estadoInicial, cargar, guardar } from "../src/estado.js";

function almacenFalso(contenido = {}) {
  const datos = { ...contenido };
  return {
    getItem: (k) => (k in datos ? datos[k] : null),
    setItem: (k, v) => { datos[k] = v; },
    datos,
  };
}

test("el estado inicial no lleva ningun dato personal", () => {
  const e = estadoInicial();
  assert.deepEqual(e.guardias, {});
  assert.deepEqual(e.festivos, {});
  assert.deepEqual(e.nominas, []);
  assert.equal(e.config.inicioResidencia, null);
});

test("el estado inicial arranca con el corte a medianoche activado", () => {
  const e = estadoInicial();
  assert.equal(e.version, 6);
  assert.equal(e.config.cortarAMedianoche, true);
  assert.equal(e.config.especialCortaAMedianoche, true);
  assert.equal(e.config.retribuciones, null);
  assert.equal(e.config.retencionBase, 0.089753);
});

test("cargar sin nada guardado devuelve el estado inicial", () => {
  assert.deepEqual(cargar(almacenFalso()).guardias, {});
});

test("cargar recupera lo guardado", () => {
  const almacen = almacenFalso();
  const e = estadoInicial();
  e.guardias["2026-09-08"] = { horas: 24, inicio: "08:00" };
  guardar(almacen, e);
  assert.equal(cargar(almacen).guardias["2026-09-08"].horas, 24);
});

test("cargar rellena las claves de configuracion que falten", () => {
  const guardado = JSON.stringify({
    version: 6, config: { inicioResidencia: "2025-05-27" },
    guardias: {}, festivos: {}, nominas: [],
  });
  const e = cargar(almacenFalso({ [CLAVE]: guardado }));
  assert.equal(e.config.inicioResidencia, "2025-05-27");
  assert.equal(e.config.cortarAMedianoche, true);
});

test("un JSON corrupto no rompe la carga", () => {
  assert.deepEqual(cargar(almacenFalso({ [CLAVE]: "{roto" })).guardias, {});
});
```

Crear `test/migracion.test.js`:

```javascript
// test/migracion.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { CLAVE_V5, migrarV5, cargar } from "../src/estado.js";

// El estado real de v5 tal y como quedaba en el navegador.
const V5 = {
  version: 5,
  config: {
    inicioResidencia: "2026-05-27", cortarAMedianoche: true,
    especialCortaAMedianoche: true,
    retencionBase: 0.089753, retencionGuardias: 0.032609,
  },
  guardias: {
    "2026-06-08": { horas: 7, inicio: "15:00", lugar: "", hecha: true },
    "2026-08-05": { horas: 17, inicio: "15:00", lugar: "OBS", hecha: true },
  },
  festivos: {
    "2026-01-01": { nombre: "Ano Nuevo", ambito: "nacional", clase: "sdf" },
    "2026-09-08": { nombre: "Ntra. Sra. de la Fuensanta", ambito: "local", clase: "sdf" },
    "2026-10-24": { nombre: "San Rafael", ambito: "local", clase: "sdf" },
    "2026-12-08": { nombre: "Inmaculada", ambito: "nacional", clase: "especial" },
    "2026-12-24": { nombre: "Nochebuena", ambito: "candidato", clase: "laborable" },
  },
  nominas: [{ periodo: "2026-07", clase: "base", bruto: 1379.90, neto: 1256.05 }],
};

test("la migracion conserva guardias y nominas tal cual", () => {
  const v6 = migrarV5(V5);
  assert.equal(v6.version, 6);
  assert.deepEqual(v6.guardias, V5.guardias);
  assert.deepEqual(v6.nominas, V5.nominas);
  assert.equal(v6.config.inicioResidencia, "2026-05-27");
});

test("un festivo derivado sin tocar no deja excepcion", () => {
  assert.equal(migrarV5(V5).festivos["2026-01-01"], undefined);
});

test("un festivo derivado reclasificado deja excepcion", () => {
  assert.deepEqual(migrarV5(V5).festivos["2026-12-08"], { clase: "especial" });
});

test("los festivos locales sobreviven como altas con nombre", () => {
  const f = migrarV5(V5).festivos;
  assert.equal(f["2026-09-08"].nombre, "Ntra. Sra. de la Fuensanta");
  assert.equal(f["2026-09-08"].clase, "sdf");
  assert.equal(f["2026-10-24"].nombre, "San Rafael");
});

test("los candidatos sin marcar no se arrastran", () => {
  assert.equal(migrarV5(V5).festivos["2026-12-24"], undefined);
});

test("cargar migra automaticamente si solo existe la clave v5", () => {
  const almacen = {
    getItem: (k) => (k === CLAVE_V5 ? JSON.stringify(V5) : null),
    setItem: () => {},
  };
  const e = cargar(almacen);
  assert.equal(e.version, 6);
  assert.equal(e.guardias["2026-08-05"].lugar, "OBS");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL, `does not provide an export named 'migrarV5'` y los tests de
`estado.test.js` que esperan estado vacío

- [ ] **Step 3: Write minimal implementation**

Reescribir `src/estado.js`:

```javascript
// src/estado.js
import { festivosDerivados } from "./festivos.js";

export const CLAVE = "cuadrante_v6";
export const CLAVE_V5 = "cuadrante_v5";

export function estadoInicial() {
  return {
    version: 6,
    config: {
      inicioResidencia: null,
      cortarAMedianoche: true,
      especialCortaAMedianoche: true,
      retencionBase: 0.089753,
      retencionGuardias: 0.032609,
      retribuciones: null,
    },
    guardias: {},
    festivos: {},
    nominas: [],
  };
}

export function migrarV5(v5) {
  const inicial = estadoInicial();
  const festivos = {};
  for (const [fecha, f] of Object.entries(v5.festivos || {})) {
    const derivado = festivosDerivados(Number(fecha.slice(0, 4)))[fecha];
    if (derivado) {
      if (f.clase !== derivado.clase) festivos[fecha] = { clase: f.clase };
    } else if (f.clase !== "laborable") {
      festivos[fecha] = { nombre: f.nombre, clase: f.clase };
    }
  }
  return {
    ...inicial,
    config: { ...inicial.config, ...(v5.config || {}), retribuciones: null },
    guardias: v5.guardias || {},
    festivos,
    nominas: v5.nominas || [],
  };
}

function leerJSON(almacen, clave) {
  try {
    const crudo = almacen.getItem(clave);
    if (!crudo) return null;
    const dato = JSON.parse(crudo);
    return dato && typeof dato === "object" ? dato : null;
  } catch {
    return null;
  }
}

export function cargar(almacen) {
  const inicial = estadoInicial();
  const guardado = leerJSON(almacen, CLAVE);
  if (guardado) {
    return {
      ...inicial,
      ...guardado,
      config: { ...inicial.config, ...(guardado.config || {}) },
    };
  }
  const v5 = leerJSON(almacen, CLAVE_V5);
  return v5 ? migrarV5(v5) : inicial;
}

export function guardar(almacen, estado) {
  almacen.setItem(CLAVE, JSON.stringify(estado));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, todas las suites

- [ ] **Step 5: Commit**

```bash
git add src/estado.js test/estado.test.js test/migracion.test.js
git commit -m "Vaciar el estado inicial y migrar desde v5"
```

---

### Task 6: Retención por la nómina más reciente

**Files:**
- Modify: `src/nomina.js`
- Test: `test/nomina.test.js`

**Interfaces:**
- Consumes: `redondear` de `src/fechas.js`.
- Produces: `tiposEfectivos(nominas, config) → { base, guardias, nBase, nGuardias }` (misma firma, otro criterio).

El promedio actual mezcla años con IRPF distinto: verificado, una nómina al 8,98 % y
otra al ~17 % dan 13,03 %, que no describe a ninguna de las dos. Pasa a mandar la más
reciente por periodo; en empate, la última añadida, asumiendo corrección.

- [ ] **Step 1: Write the failing test**

Sustituir en `test/nomina.test.js` el test del promedio y añadir los de desempate:

```javascript
test("con varias nominas manda la mas reciente, no la media", () => {
  const t = tiposEfectivos([
    { periodo: "2026-06", clase: "guardias", bruto: 100, neto: 96 },
    { periodo: "2026-07", clase: "guardias", bruto: 100, neto: 98 },
  ], CONFIG);
  assert.equal(t.guardias, 0.02); // la de julio, no la media de 0.03
  assert.equal(t.nGuardias, 2);
});

test("el orden en el array no altera cual es la mas reciente", () => {
  const t = tiposEfectivos([
    { periodo: "2026-07", clase: "guardias", bruto: 100, neto: 98 },
    { periodo: "2026-06", clase: "guardias", bruto: 100, neto: 96 },
  ], CONFIG);
  assert.equal(t.guardias, 0.02);
});

test("en empate de periodo gana la ultima anadida", () => {
  const t = tiposEfectivos([
    { periodo: "2026-07", clase: "base", bruto: 100, neto: 90 },
    { periodo: "2026-07", clase: "base", bruto: 100, neto: 85 },
  ], CONFIG);
  assert.equal(t.base, 0.15);
});

test("un anio nuevo no queda contaminado por el anterior", () => {
  const t = tiposEfectivos([
    { periodo: "2026-07", clase: "base", bruto: 1379.90, neto: 1256.05 },
    { periodo: "2028-07", clase: "base", bruto: 1628.31, neto: 1350.00 },
  ], CONFIG);
  assert.equal(t.base, 0.170922); // solo la de 2028
});

test("las nominas con bruto cero se ignoran", () => {
  const t = tiposEfectivos([
    { periodo: "2026-06", clase: "guardias", bruto: 100, neto: 96 },
    { periodo: "2026-08", clase: "guardias", bruto: 0, neto: 0 },
  ], CONFIG);
  assert.equal(t.guardias, 0.04);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/nomina.test.js`
Expected: FAIL, `Expected values to be strictly equal: 0.03 !== 0.02`

- [ ] **Step 3: Write minimal implementation**

Sustituir `tipoMedio` en `src/nomina.js`:

```javascript
function tipoReciente(nominas, clase) {
  const suyas = nominas.filter((n) => n.clase === clase && n.bruto > 0);
  if (suyas.length === 0) return null;
  let mejor = suyas[0];
  for (const n of suyas) {
    if (n.periodo >= mejor.periodo) mejor = n; // >= : la ultima anadida gana el empate
  }
  return Math.round(((mejor.bruto - mejor.neto) / mejor.bruto) * 1e6) / 1e6;
}
```

Y en `tiposEfectivos`, cambiar las dos llamadas de `tipoMedio` a `tipoReciente`.

`periodo` es `"AAAA-MM"`, así que la comparación de cadenas ordena bien
cronológicamente y no hace falta parsear.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS. Junio y agosto de 2026 siguen dando las mismas cifras: solo hay una
nómina de cada clase, así que la más reciente es la única.

- [ ] **Step 5: Commit**

```bash
git add src/nomina.js test/nomina.test.js
git commit -m "Usar la nomina mas reciente en vez de la media"
```

---

### Task 7: Confirmado frente a previsto, y año del resumen anual

**Files:**
- Modify: `src/nomina.js`
- Test: `test/resumen.test.js`

**Interfaces:**
- Consumes: `calcularGuardia` de `src/motor.js`.
- Produces: `resumenMes` añade `brutoConfirmado` y `brutoPrevisto` a lo que ya devolvía. `resumenAnio(anio, estado)` no cambia de firma.

Cambio aditivo: `brutoGuardias` sigue siendo el total y ninguna cifra existente se
mueve. `brutoPrevisto` se calcula **restando** al total, no sumando aparte, para que
las dos partes cuadren siempre con el total al céntimo aunque los redondeos por tipo y
por guardia difieran.

Una guardia sin `hecha` cuenta como prevista.

- [ ] **Step 1: Write the failing test**

Añadir a `test/resumen.test.js`:

```javascript
test("las guardias hechas y las previstas se separan", () => {
  const estado = {
    ...ESTADO,
    guardias: {
      "2026-08-05": { horas: 17, inicio: "15:00", hecha: true },
      "2026-08-11": { horas: 17, inicio: "15:00", hecha: false },
    },
  };
  const r = resumenMes("2026-08", estado);
  assert.equal(r.brutoConfirmado, 239.19);
  assert.equal(r.brutoPrevisto, 239.19);
  assert.equal(r.brutoGuardias, 478.38);
});

test("una guardia sin marcar cuenta como prevista", () => {
  const estado = {
    ...ESTADO,
    guardias: { "2026-08-05": { horas: 17, inicio: "15:00" } },
  };
  const r = resumenMes("2026-08", estado);
  assert.equal(r.brutoConfirmado, 0);
  assert.equal(r.brutoPrevisto, 239.19);
});

test("confirmado y previsto siempre suman el total", () => {
  const r = resumenMes("2026-08", ESTADO);
  assert.equal(redondear(r.brutoConfirmado + r.brutoPrevisto), r.brutoGuardias);
});

test("un mes sin guardias reparte ceros", () => {
  const r = resumenMes("2026-07", ESTADO);
  assert.equal(r.brutoConfirmado, 0);
  assert.equal(r.brutoPrevisto, 0);
});
```

Añadir el import de `redondear` a la cabecera de `test/resumen.test.js`:

```javascript
import { redondear } from "../src/fechas.js";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/resumen.test.js`
Expected: FAIL, `Expected values to be strictly equal: undefined !== 239.19`

- [ ] **Step 3: Write minimal implementation**

En `src/nomina.js`, dentro de `resumenMes`, declarar el acumulador junto a los otros:

```javascript
  let brutoConfirmado = 0;
```

Dentro del bucle de guardias, después de calcular `r`:

```javascript
    if (guardia.hecha) brutoConfirmado = redondear(brutoConfirmado + r.bruto);
```

Y en el objeto devuelto, añadir las dos claves nuevas junto a `brutoGuardias`:

```javascript
    brutoConfirmado,
    brutoPrevisto: redondear(brutoGuardias - brutoConfirmado),
```

En `src/ui.js`, función `vistaAnual`, sustituir el año fijo por el del mes visible:

```javascript
  function vistaAnual() {
    const anio = Number(mesVisible.slice(0, 4));
    const r = resumenAnio(anio, estado);
    return `<div class="tarjeta"><strong class="etiqueta">// ${anio}</strong><table>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, todas las suites

- [ ] **Step 5: Commit**

```bash
git add src/nomina.js src/ui.js test/resumen.test.js
git commit -m "Separar guardias confirmadas de previstas"
```

---

### Task 8: Correcciones de la revisión y accesibilidad

**Files:**
- Modify: `src/estilos.css`, `src/plantilla.html`, `src/ui.js`
- Test: comprobación manual en el navegador

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `esc(texto) → string` en `src/ui.js`, para escapar texto libre insertado en HTML.

Los tres hallazgos de la revisión del 20/08 más la accesibilidad. No hay tests
automáticos: son cambios de presentación y se verifican mirando.

- [ ] **Step 1: Arreglar el CSS**

En `src/estilos.css`, **mover** las dos reglas de `.dia.hoy` para que queden *después*
de `.dia.laborable`, `.dia.sdf`, `.dia.especial` y sus `.num`. Hoy van antes con la
misma especificidad, así que pierden y el marcador de "hoy" es invisible en cualquier
día que tenga guardia. El bloque queda en este orden:

```css
.dia.laborable { border-color: var(--laborable); border-color: color-mix(in srgb, var(--laborable) 55%, var(--borde)); background: #101a1d; background: color-mix(in srgb, var(--laborable) 10%, #0e1319); }
.dia.sdf { border-color: var(--sdf); border-color: color-mix(in srgb, var(--sdf) 55%, var(--borde)); background: #1a1712; background: color-mix(in srgb, var(--sdf) 10%, #0e1319); }
.dia.especial { border-color: var(--especial); border-color: color-mix(in srgb, var(--especial) 55%, var(--borde)); background: #1a1216; background: color-mix(in srgb, var(--especial) 12%, #0e1319); }
.dia.laborable .num { color: var(--laborable); }
.dia.sdf .num { color: var(--sdf); }
.dia.especial .num { color: var(--especial); }
.dia.hoy { border-color: var(--acento); box-shadow: 0 0 0 1px var(--acento) inset; }
.dia.hoy .num { color: var(--acento); font-weight: 600; }
.dia.prevista { border-style: dashed; }
```

La declaración plana antes de cada `color-mix` es el fallback: un navegador sin soporte
descarta la segunda y se queda con la primera, en vez de perder el color por completo.

Mismo tratamiento en `button.activo`:

```css
button.activo { border-color: var(--acento); color: var(--acento); background: #16151f; background: color-mix(in srgb, var(--acento) 14%, #0e1319); }
```

`.dia.prevista` funciona sin más cambios porque `.dia` ya declara
`border: 1px solid`: `border-style: dashed` solo sustituye el estilo y conserva grosor
y color, que los ponen las reglas de tipo de guardia.

- [ ] **Step 2: Devolver el encabezado y añadir el engranaje**

`src/plantilla.html` completo:

```html
<header class="cabecera">
  <div>
    <h1 class="marca">Cuadrante</h1>
    <p class="submarca">Guardias MIR · SAS anexo XVI</p>
  </div>
  <button id="abrir-ajustes" class="engranaje" aria-label="Ajustes">⚙</button>
</header>
<nav class="pestanas" id="pestanas"></nav>
<div id="vista"></div>
<div id="modal"><div class="caja" id="caja-modal"></div></div>
```

La submarca pierde el número de resolución, que era del expediente de un usuario
concreto.

En `src/estilos.css`, la cabecera pasa a fila y `h1` hereda el estilo que tenía `.marca`:

```css
.cabecera { padding: .25rem 0 1.1rem; display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
h1.marca { margin: 0; font-family: var(--serif); font-weight: 600; font-size: 1.9rem; letter-spacing: -.01em; text-wrap: balance; }
.engranaje { width: 2.2rem; height: 2.2rem; padding: 0; border-radius: 50%; font-size: 1rem; line-height: 1; color: var(--tenue); flex-shrink: 0; }
.engranaje:hover { color: var(--texto); border-color: var(--tenue); }
```

- [ ] **Step 3: Días accesibles, Escape y escapado**

En `src/ui.js`, añadir el helper junto a `eur`:

```javascript
const esc = (t) => String(t).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
```

Aplicarlo a los dos textos libres que hoy se insertan crudos:

```javascript
// en vistaNominas, dentro del map de filas
<tr><td>${esc(n.periodo)} ${esc(n.clase)}</td>
```

```javascript
// en vistaFestivos, dentro del map de filas
<tr><td>${fecha} ${esc(f.nombre)}</td>
```

Cambiar la celda del día de `div` a `button` en `vistaCalendario`, para que se llegue
con teclado y la anuncie un lector de pantalla:

```javascript
      celdas.push(`<button type="button" class="${clases}" data-fecha="${fecha}"
        aria-label="${fecha}"><span class="num">${num}</span>${detalle}</button>`);
```

Los huecos iniciales pasan de `<div></div>` a `<div aria-hidden="true"></div>`.

Cerrar el modal con Escape, registrando el manejador una sola vez al final de
`iniciar`, junto a los otros listeners:

```javascript
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") cerrarModal();
  });
```

En `src/estilos.css`, `.dia` necesita neutralizar los estilos de `button`, porque el
reset de controles le daría el padding y el fondo de un botón normal:

```css
.dia { font: inherit; color: inherit; }
```

Esta línea va **después** del bloque `button, input, select` para ganarle.

- [ ] **Step 4: Comprobar en el navegador**

`node build.mjs`, abrir `cuadrante.html` y verificar los seis puntos:

1. El día de hoy se distingue aunque tenga guardia.
2. Tabulando se recorren los días del calendario y Enter abre el modal.
3. Escape cierra el modal.
4. El título "Cuadrante" es un `h1` (comprobar en el inspector).
5. Los días con guardia conservan su color.
6. La rejilla sigue entrando a 420 px de ancho.

- [ ] **Step 5: Commit**

```bash
git add src/estilos.css src/plantilla.html src/ui.js
git commit -m "Corregir hallazgos de la revision y accesibilidad"
```

---

### Task 9: Primer arranque y pantalla de ajustes

**Files:**
- Modify: `src/ui.js`, `src/estilos.css`
- Test: comprobación manual en el navegador

**Interfaces:**
- Consumes: `RETRIBUCIONES_ANEXO`, `retribucionesDe` de `src/tarifas.js`; `estadoInicial` de `src/estado.js`.
- Produces: nada que consuman otras tareas.

Si `config.inicioResidencia` es `null`, la app enseña una sola pregunta antes que nada.
Los ajustes reutilizan el modal existente en vez de añadir una pestaña, porque cinco no
caben a 420 px.

- [ ] **Step 1: Pantalla de primer arranque**

En `src/ui.js`, dentro de `iniciar`, al principio de `pintar()`:

```javascript
  function pintar() {
    if (!estado.config.inicioResidencia) return pintarBienvenida();
    raiz.querySelector("#pestanas").hidden = false;
    // ...resto igual
  }

  function pintarBienvenida() {
    raiz.querySelector("#pestanas").hidden = true;
    raiz.querySelector("#vista").innerHTML = `
      <div class="tarjeta">
        <strong class="etiqueta">// bienvenida</strong>
        <p>Para calcular tus guardias necesito saber cuando empezaste la residencia.
           De esa fecha salen tu anio (R1 a R5) y las tarifas que te corresponden.</p>
        <p class="etiqueta-campo">Fecha de inicio</p>
        <input type="date" id="b-inicio" value="">
        <div class="acciones-modal">
          <button class="primario" id="b-empezar">Empezar</button>
        </div>
        <p class="aviso">Puedes cambiarla despues en Ajustes.</p>
      </div>`;
  }
```

Y en el delegador de clicks de `raiz`, añadir la rama:

```javascript
    else if (b.id === "b-empezar") {
      const valor = raiz.querySelector("#b-inicio").value;
      if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        estado.config.inicioResidencia = valor;
        mesVisible = valor.slice(0, 7);
        persistir(); pintar();
      }
    }
```

Añadir `#b-empezar` y `#abrir-ajustes` al selector del delegador:

```javascript
    const b = ev.target.closest("[data-pestana], [data-mes], [data-fecha], [data-festivo], [data-borrar-nomina], #n-anadir, #b-empezar, #abrir-ajustes");
```

`mesVisible` deja de estar fijo en `"2026-08"`. Su valor inicial pasa a ser el mes en
curso:

```javascript
  let mesVisible = hoyISO().slice(0, 7);
```

- [ ] **Step 2: Pantalla de ajustes**

Añadir a `src/ui.js`:

```javascript
  function abrirAjustes() {
    const caja = raiz.querySelector("#caja-modal");
    const c = estado.config;
    const r = retribucionesDe(c);
    const anioEnCurso = Number(hoyISO().slice(0, 4));
    const filas = [1, 2, 3, 4, 5].map((n) => `
      <tr><td>R${n}</td><td class="cifra">
        <input data-tarifa="${n}.laborable" value="${r.guardias[n].laborable}" size="5">
        <input data-tarifa="${n}.sdf" value="${r.guardias[n].sdf}" size="5">
        <input data-tarifa="${n}.especial" value="${r.guardias[n].especial}" size="5">
      </td></tr>`).join("");

    caja.innerHTML = `
      <strong class="modal-fecha">Ajustes</strong>

      <p class="etiqueta-campo">Inicio de residencia</p>
      <input type="date" id="a-inicio" value="${c.inicioResidencia || ""}">

      <p class="etiqueta-campo">Reparto de la guardia a medianoche</p>
      <label><input type="checkbox" id="a-corte" ${c.cortarAMedianoche ? "checked" : ""}>
        Partir las guardias a medianoche</label><br>
      <label><input type="checkbox" id="a-corte-esp" ${c.especialCortaAMedianoche ? "checked" : ""}>
        Partir tambien las de festivo especial</label>
      <p class="aviso">${AVISO_SIN_VERIFICAR}</p>

      <p class="etiqueta-campo">Retenciones por defecto</p>
      <label>Base <input id="a-ret-base" value="${(c.retencionBase * 100).toFixed(4)}" size="7"> %</label>
      <label>Guardias <input id="a-ret-guardias" value="${(c.retencionGuardias * 100).toFixed(4)}" size="7"> %</label>
      <p class="aviso">Solo se usan mientras no registres ninguna nomina de esa clase.
        En cuanto registras una, manda la mas reciente.</p>

      <p class="etiqueta-campo">Valor hora (laborable / S-D-F / especial)</p>
      <table>${filas}</table>
      <p class="etiqueta-campo">Sueldo base</p>
      <input id="a-sueldo" value="${r.sueldoBase}" size="8">
      <p class="aviso">Valores del anexo XVI, 2026.${
        anioEnCurso > 2026
          ? " Estamos en " + anioEnCurso + ": contrastalos con tu nomina, el SAS los actualiza por convenio."
          : ""}</p>

      <div class="acciones-modal">
        <button id="a-cancelar">Cancelar</button>
        <button class="primario" id="a-guardar">Guardar</button>
      </div>`;

    caja.onclick = (ev) => {
      const b = ev.target.closest("button");
      if (!b) return;
      if (b.id === "a-cancelar") cerrarModal();
      else if (b.id === "a-guardar") {
        const inicio = caja.querySelector("#a-inicio").value;
        if (/^\d{4}-\d{2}-\d{2}$/.test(inicio)) c.inicioResidencia = inicio;
        c.cortarAMedianoche = caja.querySelector("#a-corte").checked;
        c.especialCortaAMedianoche = caja.querySelector("#a-corte-esp").checked;
        c.retencionBase = leerPorcentaje(caja, "#a-ret-base", c.retencionBase);
        c.retencionGuardias = leerPorcentaje(caja, "#a-ret-guardias", c.retencionGuardias);
        c.retribuciones = leerRetribuciones(caja, r);
        persistir(); cerrarModal(); pintar();
      }
    };
    caja.oninput = null;
    raiz.querySelector("#modal").classList.add("abierto");
  }

  function leerPorcentaje(caja, selector, actual) {
    const valor = Number(caja.querySelector(selector).value.replace(",", "."));
    return valor >= 0 && valor < 100 ? Math.round((valor / 100) * 1e6) / 1e6 : actual;
  }

  function leerRetribuciones(caja, actuales) {
    const guardias = {};
    let cambiado = false;
    for (const n of [1, 2, 3, 4, 5]) {
      guardias[n] = { ...actuales.guardias[n] };
      for (const tipo of ["laborable", "sdf", "especial"]) {
        const campo = caja.querySelector(`[data-tarifa="${n}.${tipo}"]`);
        const valor = Number(campo.value.replace(",", "."));
        if (valor > 0) guardias[n][tipo] = valor;
        if (valor > 0 && valor !== RETRIBUCIONES_ANEXO.guardias[n][tipo]) cambiado = true;
      }
    }
    const sueldo = Number(caja.querySelector("#a-sueldo").value.replace(",", "."));
    const sueldoBase = sueldo > 0 ? sueldo : actuales.sueldoBase;
    if (sueldoBase !== RETRIBUCIONES_ANEXO.sueldoBase) cambiado = true;
    return cambiado
      ? { guardias, sueldoBase, cgFormacion: { ...actuales.cgFormacion } }
      : null;
  }
```

`leerRetribuciones` devuelve `null` si todo coincide con el anexo, para que el usuario
que no toca nada siga recibiendo las correcciones futuras del código en vez de
congelar una copia.

Añadir los imports en la cabecera de `src/ui.js`. `estadoInicial` hace falta en la
Task 10 (importar y borrar todo), así que entra ya en la misma línea que los otros dos:

```javascript
import { RETRIBUCIONES_ANEXO, retribucionesDe } from "./tarifas.js";
import { cargar, guardar, estadoInicial } from "./estado.js";  // sustituye al import existente
```

Y la rama del delegador:

```javascript
    else if (b.id === "abrir-ajustes") abrirAjustes();
```

- [ ] **Step 3: Comprobar en el navegador**

`node build.mjs`, borrar `localStorage` desde la consola
(`localStorage.clear()`), recargar y verificar:

1. Aparece la bienvenida, no el calendario.
2. Al meter una fecha y pulsar Empezar, entra al calendario del mes en curso.
3. El engranaje abre Ajustes con la fecha ya puesta.
4. Desmarcar "Partir las guardias a medianoche" cambia las cifras del resumen.
5. Editar una tarifa y guardar cambia el bruto; dejarla igual no guarda `retribuciones`
   (comprobar en la consola que sigue a `null`).

- [ ] **Step 4: Commit**

```bash
git add src/ui.js src/estilos.css
git commit -m "Anadir primer arranque y pantalla de ajustes"
```

---

### Task 10: Exportar e importar

**Files:**
- Modify: `src/ui.js`
- Test: comprobación manual en el navegador

**Interfaces:**
- Consumes: `estadoInicial` de `src/estado.js`.
- Produces: nada que consuman otras tareas.

Se hace por `<textarea>` y no por descarga de fichero porque **el sandbox de los
artifacts bloquea las descargas que inicia la propia página**: `<a download>`, blobs y
guardados por script quedan inertes para quien lo abre. Además resuelve el paso de
datos entre móvil y portátil, que hoy no existe.

- [ ] **Step 1: Añadir el bloque a la pantalla de ajustes**

En `abrirAjustes`, antes del `div.acciones-modal`:

```javascript
      <p class="etiqueta-campo">Copia de seguridad</p>
      <textarea id="a-datos" rows="4" spellcheck="false">${esc(JSON.stringify(estado))}</textarea>
      <div class="chips">
        <button id="a-copiar">Copiar</button>
        <button id="a-importar">Importar lo pegado</button>
        <button class="peligro" id="a-borrar-todo">Borrar todo</button>
      </div>
      <p class="aviso">Tus datos viven solo en este navegador. Copia este texto para
        guardarlos o pasarlos a otro dispositivo.</p>
```

- [ ] **Step 2: Añadir las tres ramas**

Dentro del `caja.onclick` de `abrirAjustes`:

```javascript
      else if (b.id === "a-copiar") {
        const campo = caja.querySelector("#a-datos");
        campo.select();
        navigator.clipboard.writeText(campo.value).then(
          () => { b.textContent = "Copiado"; },
          () => { b.textContent = "Copialo a mano"; });
      }
      else if (b.id === "a-importar") {
        const resultado = importar(caja.querySelector("#a-datos").value);
        if (resultado) { persistir(); cerrarModal(); pintar(); }
        else caja.querySelector("#a-error").textContent =
          "Ese texto no es una copia valida del cuadrante.";
      }
      else if (b.id === "a-borrar-todo") {
        if (b.dataset.confirmado) {
          Object.assign(estado, estadoInicial());
          persistir(); cerrarModal(); pintar();
        } else {
          b.dataset.confirmado = "1";
          b.textContent = "Pulsa otra vez para confirmar";
        }
      }
```

Añadir un hueco para el error justo debajo del `div.chips`:

```javascript
      <p class="aviso" id="a-error"></p>
```

Y la función de importación, junto a las demás de `iniciar`:

```javascript
  function importar(texto) {
    let dato;
    try {
      dato = JSON.parse(texto);
    } catch {
      return false;
    }
    if (!dato || typeof dato !== "object" || !dato.config || !dato.guardias) return false;
    const limpio = estadoInicial();
    Object.assign(estado, {
      ...limpio,
      ...dato,
      config: { ...limpio.config, ...dato.config },
    });
    return true;
  }
```

El borrado pide confirmación en dos pulsaciones en vez de con `confirm()`, porque un
diálogo modal del navegador bloquea la página y no se puede recuperar desde el
artifact.

- [ ] **Step 3: Estilo del textarea**

En `src/estilos.css`, junto al bloque de controles:

```css
textarea {
  width: 100%; background: #0e1319; color: var(--texto); border: 1px solid var(--borde);
  border-radius: 9px; padding: .5rem .75rem; font-family: var(--mono); font-size: 12px;
  resize: vertical;
}
```

- [ ] **Step 4: Comprobar en el navegador**

`node build.mjs`, abrir y verificar:

1. Copiar devuelve el JSON y el botón dice "Copiado".
2. Pegar ese JSON en otro navegador e importar reproduce guardias y nóminas.
3. Pegar basura muestra el error y no borra nada.
4. Borrar todo pide dos pulsaciones y deja la app en la bienvenida.

- [ ] **Step 5: Commit**

```bash
git add src/ui.js src/estilos.css
git commit -m "Anadir copia de seguridad por copiar y pegar"
```

---

### Task 11: Guardias previstas y festivos por año

**Files:**
- Modify: `src/ui.js`
- Test: comprobación manual en el navegador

**Interfaces:**
- Consumes: `calendarioDe` de `src/festivos.js`; `resumenMes` con `brutoConfirmado` y `brutoPrevisto` de la Task 7.
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Marcar las previstas en el calendario y el resumen**

En `vistaCalendario`, dentro del `if (g)`:

```javascript
        if (!g.hecha) clases += " prevista";
```

Y en la tabla del resumen del mes, sustituir la fila `neto_guardias` por las tres:

```javascript
          <tr><td>guardias confirmadas</td><td class="cifra">${eur(r.brutoConfirmado)}</td></tr>
          <tr><td>guardias previstas</td><td class="cifra">${eur(r.brutoPrevisto)}</td></tr>
          <tr><td>neto_guardias</td><td class="cifra">${eur(r.netoGuardias)}</td></tr>
```

Añadir la leyenda debajo de la rejilla del calendario:

```javascript
        <p class="aviso">Las guardias con borde punteado aun no estan marcadas como
          realizadas: cuentan como prevision.</p>
```

- [ ] **Step 2: Pestaña de festivos por año y alta de locales**

Sustituir `vistaFestivos` entera:

```javascript
  function vistaFestivos() {
    const anio = Number(mesVisible.slice(0, 4));
    const calendario = calendarioDe(anio, estado.festivos);
    const locales = Object.values(calendario).filter((f) => f.ambito === "local").length;
    const filas = Object.entries(calendario).sort().map(([fecha, f]) => `
      <tr><td>${fecha} ${esc(f.nombre)}</td><td class="cifra">
        <button data-festivo="${fecha}" data-clase="sdf" class="${f.clase === "sdf" ? "activo" : ""}">S-D-F</button>
        <button data-festivo="${fecha}" data-clase="especial" class="${f.clase === "especial" ? "activo" : ""}">especial</button>
      </td></tr>`).join("");
    return `<div class="tarjeta">
      <strong class="etiqueta">// festivos ${anio}</strong>
      <table>${filas}</table>
      <p class="aviso">Marca como especial los que se retribuyan a la tarifa doble.
        Tienes ${locales} festivo${locales === 1 ? "" : "s"} local${locales === 1 ? "" : "es"}
        dado${locales === 1 ? "" : "s"} de alta para ${anio}; cada municipio tiene dos.</p>
      <p class="etiqueta-campo">Anadir festivo local</p>
      <div class="formulario">
        <input type="date" id="f-fecha">
        <input id="f-nombre" placeholder="nombre" size="14">
        <button class="primario" id="f-anadir">anadir</button>
      </div></div>`;
  }
```

La clasificación de un festivo pasa a escribirse como excepción, no a mutar un mapa
copiado. En el delegador, sustituir la rama `data-festivo`:

```javascript
    else if (b.dataset.festivo) {
      const fecha = b.dataset.festivo;
      const anio = Number(fecha.slice(0, 4));
      const actual = calendarioDe(anio, estado.festivos)[fecha];
      const nueva = actual.clase === b.dataset.clase ? "laborable" : b.dataset.clase;
      const derivado = calendarioDe(anio, {})[fecha];
      if (derivado && derivado.clase === nueva) delete estado.festivos[fecha];
      else if (derivado) estado.festivos[fecha] = { clase: nueva };
      else estado.festivos[fecha] = { nombre: actual.nombre, clase: nueva };
      persistir(); pintar();
    }
```

Cuando la clase vuelve a coincidir con la derivada, la excepción se **borra** en vez de
guardarse: así el estado solo contiene diferencias de verdad y no engorda con
reclasificaciones que no cambian nada.

Y la rama del alta:

```javascript
    else if (b.id === "f-anadir") {
      const fecha = raiz.querySelector("#f-fecha").value;
      const nombre = raiz.querySelector("#f-nombre").value.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(fecha) && nombre) {
        estado.festivos[fecha] = { nombre, clase: "sdf" };
        persistir(); pintar();
      }
    }
```

Añadir `#f-anadir` al selector del delegador y el import de `calendarioDe`:

```javascript
import { calendarioDe } from "./festivos.js";
```

- [ ] **Step 3: Validar el formulario de nóminas**

En la rama `#n-anadir` del delegador, sustituir la condición:

```javascript
    else if (b.id === "n-anadir") {
      const leer = (id) => raiz.querySelector(id).value.replace(",", ".");
      const periodo = raiz.querySelector("#n-periodo").value.trim();
      const bruto = Number(leer("#n-bruto"));
      const neto = Number(leer("#n-neto"));
      const error = raiz.querySelector("#n-error");
      if (!/^\d{4}-\d{2}$/.test(periodo)) {
        error.textContent = "El periodo se escribe como 2026-09.";
      } else if (!(bruto > 0) || !(neto > 0)) {
        error.textContent = "Bruto y neto tienen que ser mayores que cero.";
      } else if (neto > bruto) {
        error.textContent = "El neto no puede ser mayor que el bruto.";
      } else {
        estado.nominas.push({
          periodo, clase: raiz.querySelector("#n-clase").value,
          bruto: redondear(bruto), neto: redondear(neto),
        });
        persistir(); pintar();
      }
    }
```

Y añadir el hueco del error en `vistaNominas`, después del `div.formulario`:

```javascript
      <p class="aviso" id="n-error"></p>
```

- [ ] **Step 4: Comprobar en el navegador**

`node build.mjs`, abrir y verificar:

1. Una guardia sin marcar sale con borde punteado; al marcarla, sólido.
2. El resumen separa confirmadas de previstas y las dos suman el bruto.
3. La pestaña Festivos sigue al año del calendario: navegar a 2027 muestra la Semana
   Santa de 2027.
4. Marcar Navidad como especial y volver a pulsar la deja en laborable; el contador de
   locales cuenta solo los dados de alta.
5. Añadir un festivo local aparece en la lista y tiñe el día en el calendario.
6. Meter una nómina con neto mayor que el bruto muestra el error y no la añade.

- [ ] **Step 5: Commit**

```bash
git add src/ui.js
git commit -m "Marcar guardias previstas y gestionar festivos por anio"
```

---

### Task 12: Empaquetado, datos del usuario y publicación

**Files:**
- Modify: `build.mjs`, `test/build.test.js`
- Test: `test/build.test.js`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: `cuadrante.html` autocontenido.

`pascua.js` es un módulo nuevo y hay que meterlo en `ORDEN` antes de `festivos.js`, que
lo importa. Sin eso el bundle sale con `domingoDePascua` sin definir.

- [ ] **Step 1: Write the failing test**

Añadir a `test/build.test.js`:

```javascript
test("el bundle lleva el calculo de la Pascua antes de los festivos", () => {
  const html = construir();
  assert.ok(html.includes("domingoDePascua"), "falta el modulo de Pascua");
  assert.ok(
    html.indexOf("function domingoDePascua") < html.indexOf("function festivosDerivados"),
    "pascua.js debe ir antes que festivos.js");
});

test("el bundle no lleva datos personales", () => {
  const html = construir();
  assert.ok(!html.includes("1256.05"), "no puede llevar netos de nominas reales");
  assert.ok(!html.includes("484.83"), "no puede llevar brutos de nominas reales");
  assert.ok(!html.includes("2026-05-27"), "no puede llevar la fecha de inicio de nadie");
  assert.ok(!html.includes("Fuensanta"), "no puede llevar festivos locales de un municipio");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/build.test.js`
Expected: FAIL, `falta el modulo de Pascua`

- [ ] **Step 3: Write minimal implementation**

En `build.mjs`, línea 6:

```javascript
const ORDEN = ["fechas.js", "pascua.js", "tarifas.js", "festivos.js", "motor.js", "nomina.js", "estado.js", "ui.js"];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test` y después `node build.mjs`
Expected: PASS todas las suites; se genera `cuadrante.html`

- [ ] **Step 5: Entregar los datos actuales del usuario**

**Antes de publicar.** Los datos del usuario vivían como valores por defecto del
código y este plan los ha borrado. Generar la cadena de importación con el estado v5
que tenía la app, para que pueda pegarla en Ajustes → Importar en cada dispositivo:

```bash
node -e "
const estado = {
  version: 6,
  config: {
    inicioResidencia: '2026-05-27', cortarAMedianoche: true,
    especialCortaAMedianoche: true,
    retencionBase: 0.089753, retencionGuardias: 0.032609, retribuciones: null,
  },
  guardias: {
    '2026-06-08': { horas: 7, inicio: '15:00', lugar: '', hecha: true },
    '2026-06-15': { horas: 7, inicio: '15:00', lugar: '', hecha: true },
    '2026-06-20': { horas: 12, inicio: '08:00', lugar: '', hecha: true },
    '2026-06-26': { horas: 7, inicio: '15:00', lugar: '', hecha: true },
    '2026-08-02': { horas: 15, inicio: '17:00', lugar: '', hecha: true },
    '2026-08-03': { horas: 8, inicio: '08:00', lugar: '', hecha: true },
    '2026-08-05': { horas: 17, inicio: '15:00', lugar: 'OBS', hecha: true },
    '2026-08-11': { horas: 17, inicio: '15:00', lugar: '', hecha: true },
    '2026-08-13': { horas: 17, inicio: '15:00', lugar: '', hecha: true },
  },
  festivos: {
    '2026-09-08': { nombre: 'Ntra. Sra. de la Fuensanta', clase: 'sdf' },
    '2026-10-24': { nombre: 'San Rafael', clase: 'sdf' },
  },
  nominas: [
    { periodo: '2026-07', clase: 'base', bruto: 1379.90, neto: 1256.05 },
    { periodo: '2026-06', clase: 'guardias', bruto: 484.83, neto: 469.02 },
  ],
};
console.log(JSON.stringify(estado));
" > mis-datos.json
```

`mis-datos.json` **no se commitea**: añadirlo a `.gitignore` si no está. Entregar su
contenido al usuario por el canal que prefiera y confirmar que lo ha importado antes de
seguir.

- [ ] **Step 6: Verificar en el navegador y publicar**

Abrir `cuadrante.html` con `localStorage` limpio y recorrer las comprobaciones de las
Tasks 8, 9, 10 y 11. Después importar `mis-datos.json` y verificar que agosto de 2026
da **1.053,15 €** de bruto de guardias, la misma cifra que daba antes del plan. Es la
prueba de que la migración no ha movido nada.

Republicar el artifact con la MISMA url
`https://claude.ai/code/artifact/cbb21680-8d4b-4748-91b9-370a18ec9b19`, título
`cuadrante` y favicon `🩺`.

- [ ] **Step 7: Commit**

```bash
git add build.mjs test/build.test.js cuadrante.html .gitignore
git commit -m "Empaquetar la version compartible"
```

---

## Cierre

Queda pendiente, fuera de este plan, lo que ya arrastraba el anterior: validar la regla
del corte a medianoche contra la nómina de septiembre de 2026. Con este plan la
hipótesis ya es configurable desde Ajustes, así que la comprobación se hace sin tocar
código: registrar la nómina, comparar con las dos cifras que muestra el aviso y dejar el
interruptor en la posición que cuadre.

Si el SAS liquida 67h laborables y 7h S-D-F en agosto, la regla del corte queda
confirmada y se puede retirar el aviso de `AVISO_SIN_VERIFICAR`. Si liquida 59h y 15h,
hay que dejar el interruptor desactivado por defecto en `estadoInicial()`.
