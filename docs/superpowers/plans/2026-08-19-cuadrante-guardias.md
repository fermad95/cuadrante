# Cuadrante de guardias MIR — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una app HTML autocontenida que registra guardias de un residente y calcula lo que va a cobrar, partiendo cada guardia a medianoche y calibrando el neto contra nóminas reales.

**Architecture:** Motor de cálculo puro en módulos ES sin dependencias, probado con `node:test`. La interfaz consume el motor y guarda el estado en `localStorage`. Un script de build inlinea todo en un único `cuadrante.html` publicable como artifact.

**Tech Stack:** JavaScript ES2022 (módulos nativos), `node:test` + `node:assert` para pruebas, sin dependencias externas. Node v24.18.0 verificado en la máquina.

**Spec:** `docs/superpowers/specs/2026-08-19-cuadrante-guardias-design.md`

## Global Constraints

- **Cero dependencias.** Ni npm install ni CDN. El HTML final debe abrirse sin red.
- **Idioma:** identificadores, comentarios y textos de interfaz en español. Sin eñes ni tildes en nombres de identificadores para evitar problemas de codificación (`anioResidencia`, no `añoResidencia`).
- **Tarifas del anexo XVI.2, valores exactos:** R1 `14.07 / 15.78 / 28.14`; R2 `15.42 / 17.28 / 30.84`; R3 `18.02 / 20.17 / 36.04`; R4 y R5 `20.22 / 22.61 / 40.44` (laborable / S-D-F / especial).
- **Sueldo base:** `1379.90` €/mes para todos los años. C.G. Formación: R1 `0`, R2 `110.38`, R3 `248.41`, R4 `386.37`, R5 `524.38`. Anual = `(sueldo + cg) × 14`.
- **Redondeo monetario:** una única función `redondear(n)` = `Math.round(n * 100) / 100`, aplicada al importe de cada tramo y a cada descuento. Nunca comparar euros con `===` sin redondear antes.
- **Orden de cálculo del neto, obligatorio:** `descuento = redondear(bruto × tipo)` y después `neto = redondear(bruto − descuento)`. El orden inverso desvía céntimos y deja de cuadrar con la nómina.
- **Tipos de retención como fracción con 6 decimales**, no como porcentaje con 2. Refinamiento sobre el spec §5: con `8.98 %` el neto de julio sale 1255,99 y el real es 1256,05. Con `0.089753` sale exacto. Valores iniciales: `retencionBase: 0.089753`, `retencionGuardias: 0.032609`.
- **Clave de `localStorage`:** `cuadrante_v5`.
- **La regla del corte a medianoche NO está verificada** (spec §10 bis). Ningún texto de la interfaz puede presentarla como confirmada.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `src/fechas.js` | Aritmética de fechas y horas en texto, sin zonas horarias |
| `src/tarifas.js` | Tablas del anexo XVI y resolución del año de residencia |
| `src/festivos.js` | Calendario 2026 y clasificación de un día en laborable / sdf / especial |
| `src/motor.js` | Partición de la guardia a medianoche e importes |
| `src/nomina.js` | Tipos efectivos calibrados, resumen mensual y desfase de liquidación |
| `src/estado.js` | Estado inicial, carga y guardado en `localStorage` |
| `src/ui.js` | Render del calendario, modal, festivos, nóminas y resúmenes |
| `src/estilos.css` | Tema oscuro de terminal |
| `build.mjs` | Inlinea `src/` en `cuadrante.html` |
| `test/*.test.js` | Una suite por módulo del motor |

Los cinco primeros módulos no tocan el DOM ni `localStorage`: son funciones puras y se prueban enteras desde Node. `estado.js` es la única frontera con el navegador aparte de `ui.js`.

---

### Task 1: Aritmética de fechas

**Files:**
- Create: `src/fechas.js`
- Test: `test/fechas.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: `diaSemana(fechaISO) → 0..6` (0 = domingo), `diaSiguiente(fechaISO) → fechaISO`, `aMinutos("15:00") → 900`, `aHora(900) → "15:00"`, `mesDe("2026-08-02") → "2026-08"`, `diasDelMes("2026-08") → ["2026-08-01", ...]`.

`aHora` acepta valores por encima de 1440 y los marca con sufijo de día: `aHora(1440) → "24:00"`, `aHora(1920) → "08:00 +1"`. Sin esto, el modo sin corte no puede mostrar la hora de fin.

- [ ] **Step 1: Write the failing test**

```javascript
// test/fechas.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { diaSemana, diaSiguiente, aMinutos, aHora, mesDe, diasDelMes } from "../src/fechas.js";

test("diaSemana identifica el dia de la semana", () => {
  assert.equal(diaSemana("2026-08-19"), 3); // miercoles
  assert.equal(diaSemana("2026-08-02"), 0); // domingo
  assert.equal(diaSemana("2026-06-20"), 6); // sabado
});

test("diaSemana no se descoloca por la zona horaria", () => {
  assert.equal(diaSemana("2026-01-01"), 4); // jueves
  assert.equal(diaSemana("2026-12-25"), 5); // viernes
});

test("diaSiguiente cruza fin de mes y fin de anio", () => {
  assert.equal(diaSiguiente("2026-08-02"), "2026-08-03");
  assert.equal(diaSiguiente("2026-08-31"), "2026-09-01");
  assert.equal(diaSiguiente("2026-12-31"), "2027-01-01");
  assert.equal(diaSiguiente("2028-02-28"), "2028-02-29"); // bisiesto
});

test("aMinutos y aHora son inversas dentro del dia", () => {
  assert.equal(aMinutos("15:00"), 900);
  assert.equal(aMinutos("08:30"), 510);
  assert.equal(aHora(900), "15:00");
  assert.equal(aHora(510), "08:30");
});

test("aHora marca el desbordamiento al dia siguiente", () => {
  assert.equal(aHora(1440), "24:00");
  assert.equal(aHora(1920), "08:00 +1");
});

test("mesDe y diasDelMes", () => {
  assert.equal(mesDe("2026-08-02"), "2026-08");
  const dias = diasDelMes("2026-08");
  assert.equal(dias.length, 31);
  assert.equal(dias[0], "2026-08-01");
  assert.equal(dias[30], "2026-08-31");
  assert.equal(diasDelMes("2026-02").length, 28);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/fechas.test.js`
Expected: FAIL, `Cannot find module '../src/fechas.js'`

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/fechas.js

function partes(fechaISO) {
  const [a, m, d] = fechaISO.split("-").map(Number);
  return { a, m, d };
}

function texto(a, m, d) {
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function diaSemana(fechaISO) {
  const { a, m, d } = partes(fechaISO);
  return new Date(a, m - 1, d).getDay();
}

export function diaSiguiente(fechaISO) {
  const { a, m, d } = partes(fechaISO);
  const siguiente = new Date(a, m - 1, d + 1);
  return texto(siguiente.getFullYear(), siguiente.getMonth() + 1, siguiente.getDate());
}

export function aMinutos(hora) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

export function aHora(minutos) {
  const dias = Math.floor(minutos / 1440);
  const resto = minutos - dias * 1440;
  if (resto === 0 && dias > 0) {
    return dias === 1 ? "24:00" : `24:00 +${dias - 1}`;
  }
  const h = String(Math.floor(resto / 60)).padStart(2, "0");
  const m = String(resto % 60).padStart(2, "0");
  return dias > 0 ? `${h}:${m} +${dias}` : `${h}:${m}`;
}

export function mesDe(fechaISO) {
  return fechaISO.slice(0, 7);
}

export function diasDelMes(anioMes) {
  const [a, m] = anioMes.split("-").map(Number);
  const cuantos = new Date(a, m, 0).getDate();
  return Array.from({ length: cuantos }, (_, i) => texto(a, m, i + 1));
}
```

Se construyen las fechas con el constructor local `new Date(a, m - 1, d)`, no con `new Date("2026-08-19")`. La segunda forma se interpreta como UTC y en horario de verano español devuelve el día anterior.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/fechas.test.js`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/fechas.js test/fechas.test.js
git commit -m "Anadir aritmetica de fechas del cuadrante"
```

---

### Task 2: Tarifas y año de residencia

**Files:**
- Create: `src/tarifas.js`
- Test: `test/tarifas.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: `TARIFAS` (objeto indexado por año 1..5), `SUELDO_BASE`, `CG_FORMACION`, `anioResidenciaEn(fechaISO, inicioResidencia) → 1..5`, `tarifaEn(fechaISO, inicioResidencia) → { laborable, sdf, especial }`, `retribucionFija(anioResidencia) → { sueldo, cg, mensual, anual }`.

Refinamiento sobre el spec §4: en vez de guardar `anioResidencia` + `fechaCambioAno` por separado, se guarda una sola fecha `inicioResidencia` (`"2026-05-27"`, cuando empezó R1) y el año se deriva de ella. Un dato en vez de dos que pueden contradecirse.

- [ ] **Step 1: Write the failing test**

```javascript
// test/tarifas.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { TARIFAS, SUELDO_BASE, anioResidenciaEn, tarifaEn, retribucionFija } from "../src/tarifas.js";

const INICIO = "2026-05-27";

test("las tarifas son las del anexo XVI.2", () => {
  assert.deepEqual(TARIFAS[1], { laborable: 14.07, sdf: 15.78, especial: 28.14 });
  assert.deepEqual(TARIFAS[2], { laborable: 15.42, sdf: 17.28, especial: 30.84 });
  assert.deepEqual(TARIFAS[3], { laborable: 18.02, sdf: 20.17, especial: 36.04 });
  assert.deepEqual(TARIFAS[4], { laborable: 20.22, sdf: 22.61, especial: 40.44 });
  assert.deepEqual(TARIFAS[5], TARIFAS[4]);
});

test("el anio de residencia avanza en la fecha de cambio", () => {
  assert.equal(anioResidenciaEn("2026-08-19", INICIO), 1);
  assert.equal(anioResidenciaEn("2027-05-26", INICIO), 1);
  assert.equal(anioResidenciaEn("2027-05-27", INICIO), 2);
  assert.equal(anioResidenciaEn("2030-06-01", INICIO), 5);
});

test("el anio de residencia se topa en 5", () => {
  assert.equal(anioResidenciaEn("2035-01-01", INICIO), 5);
});

test("antes de empezar la residencia se considera primer anio", () => {
  assert.equal(anioResidenciaEn("2026-01-01", INICIO), 1);
});

test("tarifaEn cruza el cambio de anio", () => {
  assert.equal(tarifaEn("2027-05-26", INICIO).laborable, 14.07);
  assert.equal(tarifaEn("2027-05-27", INICIO).laborable, 15.42);
});

test("la retribucion fija reproduce el anexo XVI.1", () => {
  assert.equal(SUELDO_BASE, 1379.90);
  assert.equal(retribucionFija(1).anual, 19318.60);
  assert.equal(retribucionFija(2).anual, 20863.92);
  assert.equal(retribucionFija(3).anual, 22796.34);
  assert.equal(retribucionFija(4).anual, 24727.78);
  assert.equal(retribucionFija(5).anual, 26659.92);
  assert.equal(retribucionFija(2).mensual, 1490.28);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/tarifas.test.js`
Expected: FAIL, `Cannot find module '../src/tarifas.js'`

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/tarifas.js
import { redondear } from "./fechas.js";

export const TARIFAS = {
  1: { laborable: 14.07, sdf: 15.78, especial: 28.14 },
  2: { laborable: 15.42, sdf: 17.28, especial: 30.84 },
  3: { laborable: 18.02, sdf: 20.17, especial: 36.04 },
  4: { laborable: 20.22, sdf: 22.61, especial: 40.44 },
  5: { laborable: 20.22, sdf: 22.61, especial: 40.44 },
};

export const SUELDO_BASE = 1379.90;

export const CG_FORMACION = { 1: 0, 2: 110.38, 3: 248.41, 4: 386.37, 5: 524.38 };

export const PAGAS = 14;

export function anioResidenciaEn(fechaISO, inicioResidencia) {
  const [ai, mi, di] = inicioResidencia.split("-").map(Number);
  const [af, mf, df] = fechaISO.split("-").map(Number);
  let anios = af - ai;
  if (mf < mi || (mf === mi && df < di)) anios -= 1;
  return Math.min(5, Math.max(1, anios + 1));
}

export function tarifaEn(fechaISO, inicioResidencia) {
  return TARIFAS[anioResidenciaEn(fechaISO, inicioResidencia)];
}

export function retribucionFija(anioResidencia) {
  const sueldo = SUELDO_BASE;
  const cg = CG_FORMACION[anioResidencia];
  const mensual = redondear(sueldo + cg);
  return { sueldo, cg, mensual, anual: redondear(mensual * PAGAS) };
}
```

`redondear` vive en `fechas.js` como utilidad compartida. Añádela ahí:

```javascript
// src/fechas.js — añadir al final
export function redondear(n) {
  return Math.round(n * 100) / 100;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/tarifas.test.js`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/tarifas.js src/fechas.js test/tarifas.test.js
git commit -m "Anadir tarifas del anexo XVI y anio de residencia"
```

---

### Task 3: Festivos y clasificación de días

**Files:**
- Create: `src/festivos.js`
- Test: `test/festivos.test.js`

**Interfaces:**
- Consumes: `diaSemana` de `src/fechas.js`.
- Produces: `FESTIVOS_2026` (array de `{ fecha, nombre, ambito }`), `CANDIDATOS_ESPECIALES` (array igual), `festivosIniciales() → { [fecha]: { nombre, ambito, clase } }`, `clasificarDia(fechaISO, festivos) → "laborable" | "sdf" | "especial"`.

Todos los festivos arrancan con `clase: "sdf"`. Los candidatos (24 y 31 de diciembre) arrancan con `clase: "laborable"`: están en la lista para que el usuario los pueda marcar, pero no son festivos oficiales y no deben cobrarse como tales sin que los marque.

- [ ] **Step 1: Write the failing test**

```javascript
// test/festivos.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { FESTIVOS_2026, festivosIniciales, clasificarDia } from "../src/festivos.js";
import { diaSemana } from "../src/fechas.js";

test("el calendario 2026 tiene las 14 festividades oficiales", () => {
  assert.equal(FESTIVOS_2026.length, 14);
  const fechas = FESTIVOS_2026.map((f) => f.fecha);
  assert.ok(fechas.includes("2026-09-08")); // Fuensanta
  assert.ok(fechas.includes("2026-10-24")); // San Rafael
  assert.ok(fechas.includes("2026-02-28")); // Dia de Andalucia
  assert.ok(fechas.includes("2026-04-02")); // Jueves Santo
  assert.ok(fechas.includes("2026-04-03")); // Viernes Santo
});

test("los dias de la semana del calendario son correctos", () => {
  const esperados = {
    "2026-01-01": 4, "2026-01-06": 2, "2026-02-28": 6, "2026-04-02": 4,
    "2026-04-03": 5, "2026-05-01": 5, "2026-08-15": 6, "2026-09-08": 2,
    "2026-10-12": 1, "2026-10-24": 6, "2026-11-01": 0, "2026-12-06": 0,
    "2026-12-08": 2, "2026-12-25": 5,
  };
  for (const f of FESTIVOS_2026) {
    assert.equal(diaSemana(f.fecha), esperados[f.fecha], `${f.fecha} ${f.nombre}`);
  }
});

test("todos los festivos arrancan como sdf y los candidatos como laborable", () => {
  const iniciales = festivosIniciales();
  assert.equal(iniciales["2026-09-08"].clase, "sdf");
  assert.equal(iniciales["2026-12-24"].clase, "laborable");
  assert.equal(iniciales["2026-12-31"].clase, "laborable");
});

test("clasificarDia distingue los tres tipos", () => {
  const festivos = festivosIniciales();
  assert.equal(clasificarDia("2026-08-05", festivos), "laborable"); // miercoles
  assert.equal(clasificarDia("2026-08-02", festivos), "sdf");       // domingo
  assert.equal(clasificarDia("2026-06-20", festivos), "sdf");       // sabado
  assert.equal(clasificarDia("2026-09-08", festivos), "sdf");       // festivo sin marcar
});

test("un festivo marcado como especial se clasifica como especial", () => {
  const festivos = festivosIniciales();
  festivos["2026-09-08"].clase = "especial";
  assert.equal(clasificarDia("2026-09-08", festivos), "especial");
});

test("un martes cualquiera marcado como especial gana al dia de la semana", () => {
  const festivos = { "2026-12-24": { nombre: "Nochebuena", clase: "especial" } };
  assert.equal(clasificarDia("2026-12-24", festivos), "especial");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/festivos.test.js`
Expected: FAIL, `Cannot find module '../src/festivos.js'`

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/festivos.js
import { diaSemana } from "./fechas.js";

export const FESTIVOS_2026 = [
  { fecha: "2026-01-01", nombre: "Ano Nuevo", ambito: "nacional" },
  { fecha: "2026-01-06", nombre: "Reyes", ambito: "nacional" },
  { fecha: "2026-02-28", nombre: "Dia de Andalucia", ambito: "autonomico" },
  { fecha: "2026-04-02", nombre: "Jueves Santo", ambito: "nacional" },
  { fecha: "2026-04-03", nombre: "Viernes Santo", ambito: "nacional" },
  { fecha: "2026-05-01", nombre: "Fiesta del Trabajo", ambito: "nacional" },
  { fecha: "2026-08-15", nombre: "Asuncion", ambito: "nacional" },
  { fecha: "2026-09-08", nombre: "Ntra. Sra. de la Fuensanta", ambito: "local" },
  { fecha: "2026-10-12", nombre: "Fiesta Nacional", ambito: "nacional" },
  { fecha: "2026-10-24", nombre: "San Rafael", ambito: "local" },
  { fecha: "2026-11-01", nombre: "Todos los Santos", ambito: "nacional" },
  { fecha: "2026-12-06", nombre: "Constitucion", ambito: "nacional" },
  { fecha: "2026-12-08", nombre: "Inmaculada", ambito: "nacional" },
  { fecha: "2026-12-25", nombre: "Navidad", ambito: "nacional" },
];

export const CANDIDATOS_ESPECIALES = [
  { fecha: "2026-12-24", nombre: "Nochebuena", ambito: "candidato" },
  { fecha: "2026-12-31", nombre: "Nochevieja", ambito: "candidato" },
];

export function festivosIniciales() {
  const mapa = {};
  for (const f of FESTIVOS_2026) {
    mapa[f.fecha] = { nombre: f.nombre, ambito: f.ambito, clase: "sdf" };
  }
  for (const f of CANDIDATOS_ESPECIALES) {
    mapa[f.fecha] = { nombre: f.nombre, ambito: f.ambito, clase: "laborable" };
  }
  return mapa;
}

export function clasificarDia(fechaISO, festivos) {
  const marcado = festivos[fechaISO];
  if (marcado && marcado.clase === "especial") return "especial";
  if (marcado && marcado.clase === "sdf") return "sdf";
  const dia = diaSemana(fechaISO);
  if (dia === 0 || dia === 6) return "sdf";
  return "laborable";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/festivos.test.js`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/festivos.js test/festivos.test.js
git commit -m "Anadir calendario 2026 y clasificacion de dias"
```

---

### Task 4: Partición de la guardia a medianoche

**Files:**
- Create: `src/motor.js`
- Test: `test/motor.test.js`

**Interfaces:**
- Consumes: `aMinutos`, `aHora`, `diaSiguiente`, `redondear` de `src/fechas.js`; `clasificarDia` de `src/festivos.js`; `tarifaEn` de `src/tarifas.js`.
- Produces: `INICIO_POR_DURACION`, `inicioSugerido(horas) → "15:00"`, `partirGuardia(guardia, festivos, opciones) → [{ fecha, desde, hasta, horas, tipo }]`, `calcularGuardia(guardia, festivos, config) → { tramos, horasPorTipo, importePorTipo, bruto }`.

Una `guardia` es `{ fecha, horas, inicio, lugar, hecha }`. `opciones` es `{ cortarAMedianoche, especialCortaAMedianoche }`, ambas por defecto `true`. `config` añade `inicioResidencia`.

`horasPorTipo` e `importePorTipo` son siempre objetos con las tres claves `laborable`, `sdf`, `especial`, aunque valgan cero: quien los consume no tiene que comprobar existencia.

- [ ] **Step 1: Write the failing test**

```javascript
// test/motor.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { inicioSugerido, partirGuardia, calcularGuardia } from "../src/motor.js";
import { festivosIniciales } from "../src/festivos.js";

const CONFIG = { inicioResidencia: "2026-05-27" };

test("el inicio sugerido sale de la duracion", () => {
  assert.equal(inicioSugerido(7), "15:00");
  assert.equal(inicioSugerido(12), "08:00");
  assert.equal(inicioSugerido(15), "17:00");
  assert.equal(inicioSugerido(17), "15:00");
  assert.equal(inicioSugerido(24), "08:00");
  assert.equal(inicioSugerido(9), "15:00"); // duracion desconocida
});

test("una guardia que no cruza medianoche da un solo tramo", () => {
  const tramos = partirGuardia(
    { fecha: "2026-06-08", horas: 7, inicio: "15:00" }, festivosIniciales(), {});
  assert.equal(tramos.length, 1);
  assert.deepEqual(tramos[0], {
    fecha: "2026-06-08", desde: "15:00", hasta: "22:00", horas: 7, tipo: "laborable",
  });
});

test("una guardia de 17h parte en la medianoche", () => {
  const tramos = partirGuardia(
    { fecha: "2026-08-07", horas: 17, inicio: "15:00" }, festivosIniciales(), {});
  assert.equal(tramos.length, 2);
  assert.deepEqual(tramos[0], {
    fecha: "2026-08-07", desde: "15:00", hasta: "24:00", horas: 9, tipo: "laborable",
  });
  assert.deepEqual(tramos[1], {
    fecha: "2026-08-08", desde: "00:00", hasta: "08:00", horas: 8, tipo: "sdf",
  });
});

test("una guardia de domingo pasa a laborable en la medianoche del lunes", () => {
  const tramos = partirGuardia(
    { fecha: "2026-08-02", horas: 15, inicio: "17:00" }, festivosIniciales(), {});
  assert.deepEqual(tramos.map((t) => [t.horas, t.tipo]), [[7, "sdf"], [8, "laborable"]]);
});

test("una guardia de 24h que empieza a las 08:00 no cruza dos medianoches", () => {
  const tramos = partirGuardia(
    { fecha: "2026-08-15", horas: 24, inicio: "08:00" }, festivosIniciales(), {});
  assert.equal(tramos.length, 2);
  assert.deepEqual(tramos.map((t) => [t.horas, t.tipo]), [[16, "sdf"], [8, "sdf"]]);
});

test("sin corte a medianoche la guardia entera va a la tarifa del dia de inicio", () => {
  const tramos = partirGuardia(
    { fecha: "2026-08-02", horas: 15, inicio: "17:00" },
    festivosIniciales(), { cortarAMedianoche: false });
  assert.equal(tramos.length, 1);
  assert.deepEqual(tramos[0], {
    fecha: "2026-08-02", desde: "17:00", hasta: "08:00 +1", horas: 15, tipo: "sdf",
  });
});

test("caso 1 del spec: 17h en miercoles, todo laborable", () => {
  const r = calcularGuardia(
    { fecha: "2026-08-05", horas: 17, inicio: "15:00" }, festivosIniciales(), CONFIG);
  assert.equal(r.horasPorTipo.laborable, 17);
  assert.equal(r.horasPorTipo.sdf, 0);
  assert.equal(r.bruto, 239.19);
});

test("caso 2 del spec: 17h en viernes cruza a sabado", () => {
  const r = calcularGuardia(
    { fecha: "2026-08-07", horas: 17, inicio: "15:00" }, festivosIniciales(), CONFIG);
  assert.deepEqual(r.importePorTipo, { laborable: 126.63, sdf: 126.24, especial: 0 });
  assert.equal(r.bruto, 252.87);
});

test("caso 3 del spec: 15h en domingo cruza a lunes", () => {
  const r = calcularGuardia(
    { fecha: "2026-08-02", horas: 15, inicio: "17:00" }, festivosIniciales(), CONFIG);
  assert.deepEqual(r.importePorTipo, { laborable: 112.56, sdf: 110.46, especial: 0 });
  assert.equal(r.bruto, 223.02);
});

test("caso 4 del spec: 24h en festivo especial cruza a laborable", () => {
  const festivos = festivosIniciales();
  festivos["2026-09-08"].clase = "especial";
  const r = calcularGuardia(
    { fecha: "2026-09-08", horas: 24, inicio: "08:00" }, festivos, CONFIG);
  assert.deepEqual(r.importePorTipo, { laborable: 112.56, sdf: 0, especial: 450.24 });
  assert.equal(r.bruto, 562.80);
});

test("caso 5 del spec: con el corte de especiales desactivado son 24h especiales", () => {
  const festivos = festivosIniciales();
  festivos["2026-09-08"].clase = "especial";
  const r = calcularGuardia(
    { fecha: "2026-09-08", horas: 24, inicio: "08:00" },
    festivos, { ...CONFIG, especialCortaAMedianoche: false });
  assert.equal(r.horasPorTipo.especial, 24);
  assert.equal(r.bruto, 675.36);
});

test("el corte de especiales desactivado no afecta a una guardia normal", () => {
  const r = calcularGuardia(
    { fecha: "2026-08-02", horas: 15, inicio: "17:00" },
    festivosIniciales(), { ...CONFIG, especialCortaAMedianoche: false });
  assert.equal(r.bruto, 223.02);
});

test("caso 6 del spec: sin lugar y sin marcar computa igual", () => {
  const a = calcularGuardia(
    { fecha: "2026-08-05", horas: 17, inicio: "15:00" }, festivosIniciales(), CONFIG);
  const b = calcularGuardia(
    { fecha: "2026-08-05", horas: 17, inicio: "15:00", lugar: "OBS", hecha: true },
    festivosIniciales(), CONFIG);
  assert.equal(a.bruto, b.bruto);
});

test("las tarifas siguen al anio de residencia", () => {
  const r = calcularGuardia(
    { fecha: "2027-06-10", horas: 17, inicio: "15:00" }, festivosIniciales(), CONFIG);
  assert.equal(r.bruto, 262.14); // 17 x 15.42, R2
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/motor.test.js`
Expected: FAIL, `Cannot find module '../src/motor.js'`

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/motor.js
import { aMinutos, aHora, diaSiguiente, redondear } from "./fechas.js";
import { clasificarDia } from "./festivos.js";
import { tarifaEn } from "./tarifas.js";

export const INICIO_POR_DURACION = { 7: "15:00", 8: "08:00", 12: "08:00", 15: "17:00", 17: "15:00", 24: "08:00" };

export function inicioSugerido(horas) {
  return INICIO_POR_DURACION[horas] || "15:00";
}

export function partirGuardia(guardia, festivos, opciones = {}) {
  const cortar = opciones.cortarAMedianoche !== false;
  const cortarEspecial = opciones.especialCortaAMedianoche !== false;
  const inicio = aMinutos(guardia.inicio || inicioSugerido(guardia.horas));
  const total = Math.round(guardia.horas * 60);
  const tipoInicial = clasificarDia(guardia.fecha, festivos);

  const enteraComoInicio =
    !cortar || (!cortarEspecial && tipoInicial === "especial");

  if (enteraComoInicio) {
    return [{
      fecha: guardia.fecha,
      desde: aHora(inicio),
      hasta: aHora(inicio + total),
      horas: guardia.horas,
      tipo: tipoInicial,
    }];
  }

  const tramos = [];
  let fecha = guardia.fecha;
  let desde = inicio;
  let restante = total;
  while (restante > 0) {
    const enEsteDia = Math.min(restante, 1440 - desde);
    tramos.push({
      fecha,
      desde: aHora(desde),
      hasta: aHora(desde + enEsteDia),
      horas: enEsteDia / 60,
      tipo: clasificarDia(fecha, festivos),
    });
    restante -= enEsteDia;
    desde = 0;
    fecha = diaSiguiente(fecha);
  }
  return tramos;
}

export function calcularGuardia(guardia, festivos, config) {
  const tramos = partirGuardia(guardia, festivos, config);
  const horasPorTipo = { laborable: 0, sdf: 0, especial: 0 };
  const importePorTipo = { laborable: 0, sdf: 0, especial: 0 };

  const detallados = tramos.map((t) => {
    const tarifa = tarifaEn(t.fecha, config.inicioResidencia)[t.tipo];
    const importe = redondear(t.horas * tarifa);
    horasPorTipo[t.tipo] += t.horas;
    importePorTipo[t.tipo] = redondear(importePorTipo[t.tipo] + importe);
    return { ...t, tarifa, importe };
  });

  const bruto = redondear(
    importePorTipo.laborable + importePorTipo.sdf + importePorTipo.especial);
  return { tramos: detallados, horasPorTipo, importePorTipo, bruto };
}
```

Nota sobre `hasta` en el tramo que termina a medianoche: `aHora(1440)` devuelve `"24:00"`, no `"00:00"`. Un tramo que va de `"15:00"` a `"00:00"` se leería como de duración negativa.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/motor.test.js`
Expected: PASS, 14 tests

- [ ] **Step 5: Commit**

```bash
git add src/motor.js test/motor.test.js
git commit -m "Anadir motor de particion de guardias a medianoche"
```

---

### Task 5: Calibración del neto

**Files:**
- Create: `src/nomina.js`
- Test: `test/nomina.test.js`

**Interfaces:**
- Consumes: `redondear` de `src/fechas.js`.
- Produces: `tiposEfectivos(nominas, config) → { base, guardias, nBase, nGuardias }`, `aplicarRetencion(bruto, tipo) → { descuento, neto }`.

Una nómina registrada es `{ periodo, clase, bruto, neto }` con `clase` en `"base"` o `"guardias"`. El tipo efectivo de una clase es la media de `descuento / bruto` de sus nóminas, redondeada a 6 decimales. Si no hay ninguna de esa clase, se usa el valor de `config`.

- [ ] **Step 1: Write the failing test**

```javascript
// test/nomina.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { tiposEfectivos, aplicarRetencion } from "../src/nomina.js";

const CONFIG = { retencionBase: 0.089753, retencionGuardias: 0.032609 };

const NOMINAS = [
  { periodo: "2026-07", clase: "base", bruto: 1379.90, neto: 1256.05 },
  { periodo: "2026-06", clase: "guardias", bruto: 484.83, neto: 469.02 },
];

test("sin nominas se usan los tipos de configuracion", () => {
  const t = tiposEfectivos([], CONFIG);
  assert.equal(t.base, 0.089753);
  assert.equal(t.guardias, 0.032609);
  assert.equal(t.nBase, 0);
  assert.equal(t.nGuardias, 0);
});

test("con nominas el tipo sale de ellas", () => {
  const t = tiposEfectivos(NOMINAS, CONFIG);
  assert.equal(t.base, 0.089753);
  assert.equal(t.guardias, 0.032609);
  assert.equal(t.nBase, 1);
  assert.equal(t.nGuardias, 1);
});

test("varias nominas de una clase promedian", () => {
  const t = tiposEfectivos([
    { periodo: "2026-06", clase: "guardias", bruto: 100, neto: 96 },
    { periodo: "2026-07", clase: "guardias", bruto: 100, neto: 98 },
  ], CONFIG);
  assert.equal(t.guardias, 0.03);
  assert.equal(t.nGuardias, 2);
});

test("una clase sin nominas no contamina a la otra", () => {
  const t = tiposEfectivos(
    [{ periodo: "2026-07", clase: "base", bruto: 100, neto: 90 }], CONFIG);
  assert.equal(t.base, 0.1);
  assert.equal(t.guardias, 0.032609);
});

test("aplicarRetencion reproduce la nomina de julio al centimo", () => {
  const r = aplicarRetencion(1379.90, 0.089753);
  assert.equal(r.descuento, 123.85);
  assert.equal(r.neto, 1256.05);
});

test("aplicarRetencion reproduce la complementaria de junio al centimo", () => {
  const r = aplicarRetencion(484.83, 0.032609);
  assert.equal(r.descuento, 15.81);
  assert.equal(r.neto, 469.02);
});

test("un bruto de cero no da NaN", () => {
  assert.deepEqual(aplicarRetencion(0, 0.032609), { descuento: 0, neto: 0 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/nomina.test.js`
Expected: FAIL, `Cannot find module '../src/nomina.js'`

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/nomina.js
import { redondear } from "./fechas.js";

function tipoMedio(nominas, clase) {
  const suyas = nominas.filter((n) => n.clase === clase && n.bruto > 0);
  if (suyas.length === 0) return null;
  const suma = suyas.reduce((acc, n) => acc + (n.bruto - n.neto) / n.bruto, 0);
  return Math.round((suma / suyas.length) * 1e6) / 1e6;
}

export function tiposEfectivos(nominas, config) {
  const base = tipoMedio(nominas, "base");
  const guardias = tipoMedio(nominas, "guardias");
  return {
    base: base === null ? config.retencionBase : base,
    guardias: guardias === null ? config.retencionGuardias : guardias,
    nBase: nominas.filter((n) => n.clase === "base").length,
    nGuardias: nominas.filter((n) => n.clase === "guardias").length,
  };
}

export function aplicarRetencion(bruto, tipo) {
  const descuento = redondear(bruto * tipo);
  return { descuento, neto: redondear(bruto - descuento) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/nomina.test.js`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit**

```bash
git add src/nomina.js test/nomina.test.js
git commit -m "Anadir calibracion del neto contra nominas reales"
```

---

### Task 6: Resumen mensual y desfase de liquidación

**Files:**
- Modify: `src/nomina.js`
- Test: `test/resumen.test.js`

**Interfaces:**
- Consumes: `calcularGuardia` de `src/motor.js`; `retribucionFija`, `anioResidenciaEn` de `src/tarifas.js`; `mesDe` de `src/fechas.js`.
- Produces: `resumenMes(anioMes, estado) → { anioMes, brutoBase, horasPorTipo, importePorTipo, brutoGuardias, netoBase, netoGuardias, bruto, neto, nGuardias }`, `mesAnterior(anioMes) → anioMes`, `previsionIngreso(anioMes, estado) → { anioMes, base, guardiasDe, importeGuardias, total }`, `resumenAnio(anio, estado) → { meses, horasPorTipo, bruto, neto }`.

`estado` es `{ config, guardias, festivos, nominas }`, la misma forma que persiste en `localStorage`.

La previsión del mes M suma el neto base de M y el neto de las guardias de M−1, según el desfase del spec §6.

- [ ] **Step 1: Write the failing test**

```javascript
// test/resumen.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { resumenMes, mesAnterior, previsionIngreso, resumenAnio } from "../src/nomina.js";
import { festivosIniciales } from "../src/festivos.js";

const ESTADO = {
  config: {
    inicioResidencia: "2026-05-27",
    retencionBase: 0.089753,
    retencionGuardias: 0.032609,
  },
  festivos: festivosIniciales(),
  nominas: [],
  guardias: {
    "2026-06-08": { horas: 7, inicio: "15:00", hecha: true },
    "2026-06-15": { horas: 7, inicio: "15:00", hecha: true },
    "2026-06-20": { horas: 12, inicio: "08:00", hecha: true },
    "2026-06-26": { horas: 7, inicio: "15:00", hecha: true },
    "2026-08-02": { horas: 15, inicio: "17:00", lugar: "PTA" },
    "2026-08-03": { horas: 8, inicio: "08:00" },
    "2026-08-05": { horas: 17, inicio: "15:00", lugar: "OBS" },
    "2026-08-11": { horas: 17, inicio: "15:00", lugar: "PTA" },
    "2026-08-13": { horas: 17, inicio: "15:00" },
  },
};

test("mesAnterior cruza el cambio de anio", () => {
  assert.equal(mesAnterior("2026-08"), "2026-07");
  assert.equal(mesAnterior("2026-01"), "2025-12");
});

test("junio reproduce la nomina real: 21h laborables y 12h festivas", () => {
  const r = resumenMes("2026-06", ESTADO);
  assert.equal(r.horasPorTipo.laborable, 21);
  assert.equal(r.horasPorTipo.sdf, 12);
  assert.equal(r.horasPorTipo.especial, 0);
  assert.equal(r.importePorTipo.laborable, 295.47);
  assert.equal(r.importePorTipo.sdf, 189.36);
  assert.equal(r.brutoGuardias, 484.83);
  assert.equal(r.netoGuardias, 469.02);
});

test("el sueldo base entra en todos los meses", () => {
  const r = resumenMes("2026-07", ESTADO);
  assert.equal(r.brutoBase, 1379.90);
  assert.equal(r.netoBase, 1256.05);
  assert.equal(r.brutoGuardias, 0);
  assert.equal(r.nGuardias, 0);
});

test("agosto con corte a medianoche", () => {
  const r = resumenMes("2026-08", ESTADO);
  assert.equal(r.horasPorTipo.laborable, 67);
  assert.equal(r.horasPorTipo.sdf, 7);
  assert.equal(r.brutoGuardias, 1053.15);
});

test("agosto sin corte a medianoche", () => {
  const estado = { ...ESTADO, config: { ...ESTADO.config, cortarAMedianoche: false } };
  const r = resumenMes("2026-08", estado);
  assert.equal(r.horasPorTipo.laborable, 59);
  assert.equal(r.horasPorTipo.sdf, 15);
  assert.equal(r.brutoGuardias, 1066.83);
});

test("una guardia que cruza de mes cuenta en el mes en que empieza", () => {
  const estado = {
    ...ESTADO,
    guardias: { "2026-07-31": { horas: 17, inicio: "15:00" } },
  };
  assert.equal(resumenMes("2026-07", estado).nGuardias, 1);
  assert.equal(resumenMes("2026-08", estado).nGuardias, 0);
  assert.equal(resumenMes("2026-07", estado).horasPorTipo.laborable, 17);
});

test("la prevision de ingreso cobra las guardias del mes anterior", () => {
  const p = previsionIngreso("2026-07", ESTADO);
  assert.equal(p.guardiasDe, "2026-06");
  assert.equal(p.base, 1256.05);
  assert.equal(p.importeGuardias, 469.02);
  assert.equal(p.total, 1725.07);
});

test("las guardias de agosto se cobran en septiembre", () => {
  const p = previsionIngreso("2026-09", ESTADO);
  assert.equal(p.guardiasDe, "2026-08");
  assert.ok(p.importeGuardias > 1000);
});

test("el resumen anual suma los doce meses", () => {
  const r = resumenAnio(2026, ESTADO);
  assert.equal(r.meses.length, 12);
  assert.equal(r.horasPorTipo.laborable, 88); // 21 de junio + 67 de agosto
  assert.equal(r.horasPorTipo.sdf, 19);       // 12 de junio + 7 de agosto
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/resumen.test.js`
Expected: FAIL, `The requested module '../src/nomina.js' does not provide an export named 'resumenMes'`

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/nomina.js — añadir a lo ya existente
import { redondear, mesDe } from "./fechas.js";
import { calcularGuardia } from "./motor.js";
import { retribucionFija, anioResidenciaEn } from "./tarifas.js";

export function mesAnterior(anioMes) {
  const [a, m] = anioMes.split("-").map(Number);
  return m === 1
    ? `${a - 1}-12`
    : `${a}-${String(m - 1).padStart(2, "0")}`;
}

export function resumenMes(anioMes, estado) {
  const tipos = tiposEfectivos(estado.nominas, estado.config);
  const anio = anioResidenciaEn(`${anioMes}-15`, estado.config.inicioResidencia);
  const brutoBase = retribucionFija(anio).mensual;

  const horasPorTipo = { laborable: 0, sdf: 0, especial: 0 };
  const importePorTipo = { laborable: 0, sdf: 0, especial: 0 };
  let nGuardias = 0;

  for (const [fecha, guardia] of Object.entries(estado.guardias)) {
    if (mesDe(fecha) !== anioMes) continue;
    nGuardias += 1;
    const r = calcularGuardia({ ...guardia, fecha }, estado.festivos, estado.config);
    for (const tipo of ["laborable", "sdf", "especial"]) {
      horasPorTipo[tipo] += r.horasPorTipo[tipo];
      importePorTipo[tipo] = redondear(importePorTipo[tipo] + r.importePorTipo[tipo]);
    }
  }

  const brutoGuardias = redondear(
    importePorTipo.laborable + importePorTipo.sdf + importePorTipo.especial);
  const base = aplicarRetencion(brutoBase, tipos.base);
  const guardias = aplicarRetencion(brutoGuardias, tipos.guardias);

  return {
    anioMes, nGuardias, horasPorTipo, importePorTipo,
    brutoBase, brutoGuardias, bruto: redondear(brutoBase + brutoGuardias),
    netoBase: base.neto, netoGuardias: guardias.neto,
    neto: redondear(base.neto + guardias.neto),
  };
}

export function previsionIngreso(anioMes, estado) {
  const deEsteMes = resumenMes(anioMes, estado);
  const guardiasDe = mesAnterior(anioMes);
  const delAnterior = resumenMes(guardiasDe, estado);
  return {
    anioMes,
    base: deEsteMes.netoBase,
    guardiasDe,
    importeGuardias: delAnterior.netoGuardias,
    total: redondear(deEsteMes.netoBase + delAnterior.netoGuardias),
  };
}

export function resumenAnio(anio, estado) {
  const meses = Array.from({ length: 12 }, (_, i) =>
    resumenMes(`${anio}-${String(i + 1).padStart(2, "0")}`, estado));
  const horasPorTipo = { laborable: 0, sdf: 0, especial: 0 };
  let bruto = 0;
  let neto = 0;
  for (const m of meses) {
    for (const tipo of ["laborable", "sdf", "especial"]) {
      horasPorTipo[tipo] += m.horasPorTipo[tipo];
    }
    bruto = redondear(bruto + m.bruto);
    neto = redondear(neto + m.neto);
  }
  return { meses, horasPorTipo, bruto, neto };
}
```

Cuidado con el import: `mesDe` se añade a la línea de import de `fechas.js` que ya existe en el archivo, no se duplica el import.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/`
Expected: PASS, todas las suites

- [ ] **Step 5: Commit**

```bash
git add src/nomina.js test/resumen.test.js
git commit -m "Anadir resumen mensual y desfase de liquidacion"
```

---

### Task 7: Estado, datos iniciales y persistencia

**Files:**
- Create: `src/estado.js`
- Test: `test/estado.test.js`

**Interfaces:**
- Consumes: `festivosIniciales` de `src/festivos.js`.
- Produces: `CLAVE`, `estadoInicial() → estado`, `cargar(almacen) → estado`, `guardar(almacen, estado) → void`.

`almacen` es cualquier objeto con `getItem` y `setItem`; en el navegador se le pasa `localStorage` y en las pruebas un doble. Así el módulo se prueba sin navegador.

`cargar` fusiona lo guardado sobre `estadoInicial()`, de forma que una versión futura que añada una clave de configuración no rompa los datos existentes.

- [ ] **Step 1: Write the failing test**

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

test("el estado inicial trae las guardias de junio y agosto", () => {
  const e = estadoInicial();
  assert.equal(Object.keys(e.guardias).length, 9);
  assert.equal(e.guardias["2026-06-20"].horas, 12);
  assert.equal(e.guardias["2026-08-05"].lugar, "OBS");
  assert.equal(e.guardias["2026-06-08"].hecha, true);
});

test("el estado inicial trae las dos nominas conocidas", () => {
  const e = estadoInicial();
  assert.equal(e.nominas.length, 2);
  const junio = e.nominas.find((n) => n.clase === "guardias");
  assert.equal(junio.bruto, 484.83);
  assert.equal(junio.neto, 469.02);
});

test("el estado inicial arranca con el corte a medianoche activado", () => {
  const e = estadoInicial();
  assert.equal(e.config.cortarAMedianoche, true);
  assert.equal(e.config.especialCortaAMedianoche, true);
  assert.equal(e.config.inicioResidencia, "2026-05-27");
});

test("cargar sin nada guardado devuelve el estado inicial", () => {
  const e = cargar(almacenFalso());
  assert.equal(Object.keys(e.guardias).length, 9);
});

test("cargar recupera lo guardado", () => {
  const almacen = almacenFalso();
  const e = estadoInicial();
  e.guardias["2026-09-08"] = { horas: 24, inicio: "08:00" };
  guardar(almacen, e);
  assert.equal(cargar(almacen).guardias["2026-09-08"].horas, 24);
});

test("cargar rellena las claves de configuracion que falten", () => {
  const guardado = JSON.stringify({ version: 5, config: { inicioResidencia: "2025-05-27" }, guardias: {}, festivos: {}, nominas: [] });
  const e = cargar(almacenFalso({ [CLAVE]: guardado }));
  assert.equal(e.config.inicioResidencia, "2025-05-27");
  assert.equal(e.config.cortarAMedianoche, true);
  assert.deepEqual(e.guardias, {});
});

test("un JSON corrupto no rompe la carga", () => {
  const e = cargar(almacenFalso({ [CLAVE]: "{roto" }));
  assert.equal(Object.keys(e.guardias).length, 9);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/estado.test.js`
Expected: FAIL, `Cannot find module '../src/estado.js'`

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/estado.js
import { festivosIniciales } from "./festivos.js";

export const CLAVE = "cuadrante_v5";

export function estadoInicial() {
  return {
    version: 5,
    config: {
      inicioResidencia: "2026-05-27",
      cortarAMedianoche: true,
      especialCortaAMedianoche: true,
      retencionBase: 0.089753,
      retencionGuardias: 0.032609,
    },
    guardias: {
      "2026-06-08": { horas: 7, inicio: "15:00", lugar: "", hecha: true },
      "2026-06-15": { horas: 7, inicio: "15:00", lugar: "", hecha: true },
      "2026-06-20": { horas: 12, inicio: "08:00", lugar: "", hecha: true },
      "2026-06-26": { horas: 7, inicio: "15:00", lugar: "", hecha: true },
      "2026-08-02": { horas: 15, inicio: "17:00", lugar: "PTA", hecha: true },
      "2026-08-03": { horas: 8, inicio: "08:00", lugar: "", hecha: true },
      "2026-08-05": { horas: 17, inicio: "15:00", lugar: "OBS", hecha: true },
      "2026-08-11": { horas: 17, inicio: "15:00", lugar: "PTA", hecha: true },
      "2026-08-13": { horas: 17, inicio: "15:00", lugar: "", hecha: true },
    },
    festivos: festivosIniciales(),
    nominas: [
      { periodo: "2026-07", clase: "base", bruto: 1379.90, neto: 1256.05 },
      { periodo: "2026-06", clase: "guardias", bruto: 484.83, neto: 469.02 },
    ],
  };
}

export function cargar(almacen) {
  const inicial = estadoInicial();
  let guardado;
  try {
    guardado = JSON.parse(almacen.getItem(CLAVE));
  } catch {
    return inicial;
  }
  if (!guardado || typeof guardado !== "object") return inicial;
  return {
    ...inicial,
    ...guardado,
    config: { ...inicial.config, ...(guardado.config || {}) },
  };
}

export function guardar(almacen, estado) {
  almacen.setItem(CLAVE, JSON.stringify(estado));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/`
Expected: PASS, todas las suites

- [ ] **Step 5: Commit**

```bash
git add src/estado.js test/estado.test.js
git commit -m "Anadir estado inicial y persistencia"
```

---

### Task 8: Contraste de las dos hipótesis

**Files:**
- Modify: `src/nomina.js`
- Test: `test/hipotesis.test.js`

**Interfaces:**
- Consumes: `resumenMes` de `src/nomina.js`.
- Produces: `compararHipotesis(anioMes, estado) → { conCorte, sinCorte, difieren, diferencia }`, donde `conCorte` y `sinCorte` son `{ horasPorTipo, brutoGuardias }`.

Esta es la función que hace barato el contraste con la nómina de septiembre (spec §10 bis). Devuelve `difieren: false` cuando ninguna guardia del mes cruza a un día de distinta tarifa — el caso de junio, y la razón por la que junio no valida la regla.

- [ ] **Step 1: Write the failing test**

```javascript
// test/hipotesis.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { compararHipotesis } from "../src/nomina.js";
import { estadoInicial } from "../src/estado.js";

const ESTADO = estadoInicial();

test("junio no distingue las hipotesis: ninguna guardia cruza de tarifa", () => {
  const c = compararHipotesis("2026-06", ESTADO);
  assert.equal(c.difieren, false);
  assert.equal(c.diferencia, 0);
  assert.equal(c.conCorte.brutoGuardias, 484.83);
  assert.equal(c.sinCorte.brutoGuardias, 484.83);
});

test("agosto si las distingue", () => {
  const c = compararHipotesis("2026-08", ESTADO);
  assert.equal(c.difieren, true);
  assert.equal(c.conCorte.brutoGuardias, 1053.15);
  assert.equal(c.sinCorte.brutoGuardias, 1066.83);
  assert.equal(c.diferencia, 13.68);
  assert.deepEqual(c.conCorte.horasPorTipo, { laborable: 67, sdf: 7, especial: 0 });
  assert.deepEqual(c.sinCorte.horasPorTipo, { laborable: 59, sdf: 15, especial: 0 });
});

test("comparar no altera la configuracion del estado", () => {
  const estado = estadoInicial();
  compararHipotesis("2026-08", estado);
  assert.equal(estado.config.cortarAMedianoche, true);
});

test("un mes sin guardias no difiere", () => {
  assert.equal(compararHipotesis("2026-07", ESTADO).difieren, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/hipotesis.test.js`
Expected: FAIL, `does not provide an export named 'compararHipotesis'`

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/nomina.js — añadir al final
export function compararHipotesis(anioMes, estado) {
  const con = resumenMes(anioMes, {
    ...estado, config: { ...estado.config, cortarAMedianoche: true },
  });
  const sin = resumenMes(anioMes, {
    ...estado, config: { ...estado.config, cortarAMedianoche: false },
  });
  const diferencia = redondear(Math.abs(con.brutoGuardias - sin.brutoGuardias));
  return {
    conCorte: { horasPorTipo: con.horasPorTipo, brutoGuardias: con.brutoGuardias },
    sinCorte: { horasPorTipo: sin.horasPorTipo, brutoGuardias: sin.brutoGuardias },
    difieren: diferencia !== 0,
    diferencia,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/`
Expected: PASS, todas las suites

- [ ] **Step 5: Commit**

```bash
git add src/nomina.js test/hipotesis.test.js
git commit -m "Anadir contraste entre las dos hipotesis de corte"
```

---

### Task 9: Estilos y esqueleto de la interfaz

**Files:**
- Create: `src/estilos.css`, `src/plantilla.html`
- Test: manual, en navegador

**Interfaces:**
- Consumes: nada.
- Produces: `plantilla.html` con los contenedores que `ui.js` rellena: `#pestanas`, `#calendario`, `#festivos`, `#nominas`, `#resumen`, `#modal`. `estilos.css` con las variables de color del tema.

Paleta tomada de las capturas de la versión anterior: fondo `#05080a`, tarjetas `#0d1418`, texto `#c8d6db`, cian `#22d3ee` (laborable), ámbar `#eab308` (S-D-F), rosa `#ec4899` (especial), verde `#22c55e` (hoy y totales). Tipografía monoespaciada del sistema.

- [ ] **Step 1: Escribir los estilos**

```css
/* src/estilos.css */
:root {
  --fondo: #05080a;
  --tarjeta: #0d1418;
  --borde: #1c2b33;
  --texto: #c8d6db;
  --tenue: #5b7280;
  --laborable: #22d3ee;
  --sdf: #eab308;
  --especial: #ec4899;
  --acento: #22c55e;
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 1rem;
  background: var(--fondo); color: var(--texto);
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  font-size: 15px; line-height: 1.5;
}
.tarjeta {
  background: var(--tarjeta); border: 1px solid var(--borde);
  border-radius: 12px; padding: 1rem; margin-bottom: 1rem;
}
.rejilla { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
.dia {
  aspect-ratio: 1; border: 1px solid var(--borde); border-radius: 8px;
  background: #0a1114; padding: 6px; text-align: center; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.dia:hover { border-color: var(--tenue); }
.dia.hoy { border-color: var(--acento); color: var(--acento); }
.dia .horas { font-size: 11px; }
.dia.laborable { border-color: var(--laborable); }
.dia.sdf { border-color: var(--sdf); }
.dia.especial { border-color: var(--especial); }
.dia .lugar { font-size: 10px; color: var(--sdf); }
.dia .cruza { font-size: 9px; color: var(--tenue); }
.cabecera-semana { color: var(--tenue); font-size: 12px; text-align: center; }
.aviso {
  border-left: 3px solid var(--sdf); padding-left: .75rem;
  color: var(--tenue); font-size: 13px; margin: .75rem 0;
}
#modal {
  position: fixed; inset: 0; background: #000c; display: none;
  align-items: center; justify-content: center; padding: 1rem; z-index: 10;
}
#modal.abierto { display: flex; }
#modal .caja {
  background: var(--tarjeta); border: 1px solid var(--borde); border-radius: 12px;
  padding: 1.25rem; max-width: 480px; width: 100%; max-height: 90vh; overflow-y: auto;
}
button, input, select {
  background: #0a1114; color: var(--texto); border: 1px solid var(--borde);
  border-radius: 8px; padding: .5rem .75rem; font: inherit;
}
button { cursor: pointer; }
button.activo { border-color: var(--laborable); color: var(--laborable); }
button.primario { background: var(--laborable); color: #05080a; border-color: var(--laborable); }
table { width: 100%; border-collapse: collapse; }
td { padding: .25rem 0; }
td.cifra { text-align: right; }
.total { color: var(--acento); font-weight: bold; }
.pestanas { display: flex; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap; }
.pestanas button { border: none; background: none; color: var(--tenue); padding: .25rem 0; }
.pestanas button.activo { color: var(--laborable); border-bottom: 2px solid var(--laborable); }
```

- [ ] **Step 2: Escribir la plantilla**

```html
<!-- src/plantilla.html -->
<h1>cuadrante_</h1>
<p class="tenue">MIR · SAS R. 0002/2026</p>
<div class="pestanas" id="pestanas"></div>
<div id="vista"></div>
<div id="modal"><div class="caja" id="caja-modal"></div></div>
```

- [ ] **Step 3: Commit**

```bash
git add src/estilos.css src/plantilla.html
git commit -m "Anadir estilos y esqueleto de la interfaz"
```

---

### Task 10: Interfaz — calendario y modal

**Files:**
- Create: `src/ui.js`
- Test: manual, en navegador, con los pasos indicados

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: `iniciar(raiz, almacen)`, que monta la app.

Requisito del spec §9 que no se puede omitir: en el modal, el desglose por tramos se recalcula en vivo al cambiar duración u hora, antes de guardar. Y en el calendario, un día cuya guardia cruza a otra tarifa lo indica.

Requisito del spec §10 bis: donde el corte a medianoche cambia el importe, la interfaz dice que la regla no está verificada. El texto exacto a usar es:

> Regla del corte a medianoche sin verificar. Se confirma con la nómina de septiembre.

- [ ] **Step 1: Escribir el módulo de interfaz**

```javascript
// src/ui.js
import { diasDelMes, diaSemana, redondear } from "./fechas.js";
import { inicioSugerido, calcularGuardia } from "./motor.js";
import { resumenMes, previsionIngreso, resumenAnio, compararHipotesis, tiposEfectivos } from "./nomina.js";
import { cargar, guardar } from "./estado.js";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DURACIONES = [7, 8, 12, 15, 17, 24];
const LUGARES = ["PTA", "OBS", "INT", "RS", "HP"];
const AVISO_SIN_VERIFICAR =
  "Regla del corte a medianoche sin verificar. Se confirma con la nomina de septiembre.";

const eur = (n) => `${n.toFixed(2).replace(".", ",")} €`;

export function iniciar(raiz, almacen) {
  const estado = cargar(almacen);
  let pestana = "calendario";
  let mesVisible = "2026-08";

  const persistir = () => guardar(almacen, estado);

  function pintar() {
    raiz.querySelector("#pestanas").innerHTML = ["calendario", "festivos", "nominas", "anual"]
      .map((p) => `<button data-pestana="${p}" class="${p === pestana ? "activo" : ""}">${p}</button>`)
      .join("");
    const vista = raiz.querySelector("#vista");
    if (pestana === "calendario") vista.innerHTML = vistaCalendario();
    if (pestana === "festivos") vista.innerHTML = vistaFestivos();
    if (pestana === "nominas") vista.innerHTML = vistaNominas();
    if (pestana === "anual") vista.innerHTML = vistaAnual();
  }

  function vistaCalendario() {
    const [anio, mes] = mesVisible.split("-").map(Number);
    const dias = diasDelMes(mesVisible);
    const hueco = (diaSemana(dias[0]) + 6) % 7; // lunes primero
    const celdas = ["<div></div>".repeat(hueco)];
    for (const fecha of dias) {
      const g = estado.guardias[fecha];
      const num = Number(fecha.slice(8));
      let clases = "dia";
      let detalle = "";
      if (g) {
        const r = calcularGuardia({ ...g, fecha }, estado.festivos, estado.config);
        const tipos = [...new Set(r.tramos.map((t) => t.tipo))];
        clases += ` ${tipos[0]}`;
        detalle = `<span class="horas">${g.horas}h</span>`;
        if (g.lugar) detalle += `<span class="lugar">${g.lugar}</span>`;
        if (tipos.length > 1) detalle += `<span class="cruza">cruza</span>`;
      }
      celdas.push(`<div class="${clases}" data-fecha="${fecha}">${num}${detalle}</div>`);
    }
    const r = resumenMes(mesVisible, estado);
    const p = previsionIngreso(mesVisible, estado);
    const c = compararHipotesis(mesVisible, estado);

    return `
      <div class="tarjeta">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <button data-mes="-1">‹</button>
          <strong>${MESES[mes - 1]} ${anio}</strong>
          <button data-mes="1">›</button>
        </div>
        <div class="rejilla" style="margin:.75rem 0">
          ${["L", "M", "X", "J", "V", "S", "D"].map((d) => `<div class="cabecera-semana">${d}</div>`).join("")}
        </div>
        <div class="rejilla">${celdas.join("")}</div>
      </div>
      <div class="tarjeta">
        <strong>// ${MESES[mes - 1]} ${anio}</strong>
        <table>
          <tr><td>sueldo_base</td><td class="cifra">${eur(r.brutoBase)}</td></tr>
          ${filaTipo("laborable", r)}${filaTipo("sdf", r)}${filaTipo("especial", r)}
          <tr><td>bruto_total</td><td class="cifra">${eur(r.bruto)}</td></tr>
          <tr><td>neto_base</td><td class="cifra">${eur(r.netoBase)}</td></tr>
          <tr><td>neto_guardias</td><td class="cifra">${eur(r.netoGuardias)}</td></tr>
          <tr><td class="total">total_neto</td><td class="cifra total">${eur(r.neto)}</td></tr>
        </table>
        ${c.difieren ? `<p class="aviso">${AVISO_SIN_VERIFICAR}<br>
          Con corte: ${eur(c.conCorte.brutoGuardias)} · sin corte: ${eur(c.sinCorte.brutoGuardias)}
          · difieren en ${eur(c.diferencia)}.</p>` : ""}
      </div>
      <div class="tarjeta">
        <strong>// se ingresa este mes</strong>
        <table>
          <tr><td>nomina base</td><td class="cifra">${eur(p.base)}</td></tr>
          <tr><td>guardias de ${p.guardiasDe}</td><td class="cifra">${eur(p.importeGuardias)}</td></tr>
          <tr><td class="total">total</td><td class="cifra total">${eur(p.total)}</td></tr>
        </table>
        <p class="aviso">Las guardias se cobran en la nomina del mes siguiente.</p>
      </div>`;
  }

  function filaTipo(tipo, r) {
    if (r.horasPorTipo[tipo] === 0) return "";
    const nombre = { laborable: "Laborable", sdf: "Festiva (S-D-F)", especial: "Festivo especial" }[tipo];
    return `<tr><td>${nombre} <span style="color:var(--tenue)">(${r.horasPorTipo[tipo]}h)</span></td>
      <td class="cifra">${eur(r.importePorTipo[tipo])}</td></tr>`;
  }

  function vistaFestivos() {
    const filas = Object.entries(estado.festivos).sort().map(([fecha, f]) => `
      <tr><td>${fecha} ${f.nombre}</td><td class="cifra">
        <button data-festivo="${fecha}" data-clase="sdf" class="${f.clase === "sdf" ? "activo" : ""}">S-D-F</button>
        <button data-festivo="${fecha}" data-clase="especial" class="${f.clase === "especial" ? "activo" : ""}">especial</button>
      </td></tr>`).join("");
    return `<div class="tarjeta"><strong>// festivos</strong><table>${filas}</table>
      <p class="aviso">Marca como especial los que se retribuyan a ${eur(28.14)}/h.</p></div>`;
  }

  function vistaNominas() {
    const t = tiposEfectivos(estado.nominas, estado.config);
    const filas = estado.nominas.map((n, i) => `
      <tr><td>${n.periodo} ${n.clase}</td><td class="cifra">${eur(n.bruto)} → ${eur(n.neto)}
      <button data-borrar-nomina="${i}">×</button></td></tr>`).join("");
    return `<div class="tarjeta"><strong>// nominas registradas</strong>
      <table>${filas}</table>
      <p>Tipo efectivo base: ${(t.base * 100).toFixed(2)} % (${t.nBase} nominas)<br>
         Tipo efectivo guardias: ${(t.guardias * 100).toFixed(2)} % (${t.nGuardias} nominas)</p>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.75rem">
        <input id="n-periodo" placeholder="2026-09" size="8">
        <select id="n-clase"><option value="base">base</option><option value="guardias">guardias</option></select>
        <input id="n-bruto" placeholder="bruto" size="8">
        <input id="n-neto" placeholder="neto" size="8">
        <button class="primario" id="n-anadir">anadir</button>
      </div></div>`;
  }

  function vistaAnual() {
    const r = resumenAnio(2026, estado);
    return `<div class="tarjeta"><strong>// 2026</strong><table>
      <tr><td>horas laborables</td><td class="cifra">${r.horasPorTipo.laborable}h</td></tr>
      <tr><td>horas S-D-F</td><td class="cifra">${r.horasPorTipo.sdf}h</td></tr>
      <tr><td>horas especiales</td><td class="cifra">${r.horasPorTipo.especial}h</td></tr>
      <tr><td>bruto</td><td class="cifra">${eur(r.bruto)}</td></tr>
      <tr><td class="total">neto</td><td class="cifra total">${eur(r.neto)}</td></tr>
    </table></div>`;
  }

  function abrirModal(fecha) {
    const g = estado.guardias[fecha] || { horas: 17, inicio: inicioSugerido(17), lugar: "", hecha: false };
    const caja = raiz.querySelector("#caja-modal");

    function pintarModal() {
      const r = calcularGuardia({ ...g, fecha }, estado.festivos, estado.config);
      const tramos = r.tramos.map((t) => `<tr><td>${t.fecha} ${t.desde}–${t.hasta}</td>
        <td class="cifra">${t.horas}h × ${eur(t.tarifa)} = ${eur(t.importe)}</td></tr>`).join("");
      caja.innerHTML = `
        <strong>${fecha}</strong>
        <p>Duracion</p>
        <div>${DURACIONES.map((h) => `<button data-horas="${h}" class="${g.horas === h ? "activo" : ""}">${h}h</button>`).join(" ")}</div>
        <p>Hora de inicio <input id="m-inicio" value="${g.inicio}" size="5"></p>
        <p>Lugar</p>
        <div>${LUGARES.map((l) => `<button data-lugar="${l}" class="${g.lugar === l ? "activo" : ""}">${l}</button>`).join(" ")}
             <button data-lugar="" class="${g.lugar === "" ? "activo" : ""}">sin especificar</button></div>
        <p><label><input type="checkbox" id="m-hecha" ${g.hecha ? "checked" : ""}> Guardia ya realizada</label></p>
        <table style="margin-top:.75rem">${tramos}
          <tr><td class="total">bruto</td><td class="cifra total">${eur(r.bruto)}</td></tr></table>
        ${r.tramos.length > 1 ? `<p class="aviso">${AVISO_SIN_VERIFICAR}</p>` : ""}
        <div style="display:flex;gap:.5rem;margin-top:1rem">
          <button id="m-borrar">Borrar</button>
          <button id="m-cancelar">Cancelar</button>
          <button class="primario" id="m-guardar">Guardar</button>
        </div>`;
    }

    caja.onclick = (ev) => {
      const b = ev.target.closest("button");
      if (!b) return;
      if (b.dataset.horas) { g.horas = Number(b.dataset.horas); g.inicio = inicioSugerido(g.horas); pintarModal(); }
      else if ("lugar" in b.dataset) { g.lugar = b.dataset.lugar; pintarModal(); }
      else if (b.id === "m-cancelar") cerrarModal();
      else if (b.id === "m-borrar") { delete estado.guardias[fecha]; persistir(); cerrarModal(); pintar(); }
      else if (b.id === "m-guardar") {
        g.inicio = caja.querySelector("#m-inicio").value;
        g.hecha = caja.querySelector("#m-hecha").checked;
        estado.guardias[fecha] = g; persistir(); cerrarModal(); pintar();
      }
    };
    caja.oninput = (ev) => {
      if (ev.target.id === "m-inicio" && /^\d{2}:\d{2}$/.test(ev.target.value)) {
        g.inicio = ev.target.value;
        const foco = ev.target.selectionStart;
        pintarModal();
        const campo = caja.querySelector("#m-inicio");
        campo.focus();
        campo.setSelectionRange(foco, foco);
      }
    };
    pintarModal();
    raiz.querySelector("#modal").classList.add("abierto");
  }

  function cerrarModal() {
    raiz.querySelector("#modal").classList.remove("abierto");
  }

  raiz.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-pestana], [data-mes], [data-fecha], [data-festivo], [data-borrar-nomina], #n-anadir");
    if (!b) return;
    if (b.dataset.pestana) { pestana = b.dataset.pestana; pintar(); }
    else if (b.dataset.mes) {
      const [a, m] = mesVisible.split("-").map(Number);
      const d = new Date(a, m - 1 + Number(b.dataset.mes), 1);
      mesVisible = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      pintar();
    }
    else if (b.dataset.fecha) abrirModal(b.dataset.fecha);
    else if (b.dataset.festivo) {
      const f = estado.festivos[b.dataset.festivo];
      f.clase = f.clase === b.dataset.clase ? "laborable" : b.dataset.clase;
      persistir(); pintar();
    }
    else if (b.dataset.borrarNomina) {
      estado.nominas.splice(Number(b.dataset.borrarNomina), 1); persistir(); pintar();
    }
    else if (b.id === "n-anadir") {
      const leer = (id) => raiz.querySelector(id).value.replace(",", ".");
      const bruto = Number(leer("#n-bruto"));
      const neto = Number(leer("#n-neto"));
      if (bruto > 0 && neto > 0) {
        estado.nominas.push({
          periodo: raiz.querySelector("#n-periodo").value,
          clase: raiz.querySelector("#n-clase").value,
          bruto: redondear(bruto), neto: redondear(neto),
        });
        persistir(); pintar();
      }
    }
  });

  raiz.querySelector("#modal").addEventListener("click", (ev) => {
    if (ev.target.id === "modal") cerrarModal();
  });

  pintar();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui.js
git commit -m "Anadir interfaz de calendario, modal y resumenes"
```

- [ ] **Step 3: Comprobación manual en el navegador**

Se hace tras la Task 11, cuando exista el HTML. Lista de comprobación:

1. Agosto muestra guardias los días 2, 3, 5, 11 y 13.
2. El día 2 muestra la marca `cruza`; el día 5 no la muestra pese a ser de 17h, porque va de laborable a laborable.
3. Al abrir el día 2, el desglose muestra dos tramos: 7h a 15,78 y 8h a 14,07, bruto 223,02 €.
4. Cambiar la duración a 24h actualiza el desglose sin cerrar el modal.
5. El resumen de agosto da 1.053,15 € de bruto en guardias y muestra el aviso de regla sin verificar.
6. La pestaña de festivos marca el 8 de septiembre como especial y el resumen de septiembre cambia.
7. Recargar la página conserva todos los cambios.

---

### Task 11: Empaquetado en un HTML autocontenido

**Files:**
- Create: `build.mjs`, `package.json`
- Test: `test/build.test.js`

**Interfaces:**
- Consumes: todos los `src/`.
- Produces: `cuadrante.html` en la raíz del repo.

El build concatena los módulos en un único `<script type="module">`. Como los módulos se inlinean en orden de dependencia, se eliminan las líneas `import` y `export` con una sustitución: no hay resolución de módulos en el resultado, es un único ámbito.

- [ ] **Step 1: Write the failing test**

```javascript
// test/build.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { construir } from "../build.mjs";

test("el html generado es autocontenido", () => {
  const html = construir();
  assert.ok(html.includes("<title>cuadrante</title>"));
  assert.ok(html.includes("14.07"), "debe llevar las tarifas dentro");
  assert.ok(!html.includes("import "), "no puede quedar ningun import");
  assert.ok(!html.match(/^export /m), "no puede quedar ningun export");
  assert.ok(!html.includes("src=\"http"), "no puede pedir nada por red");
  assert.ok(!html.includes("<link"), "el css va inlineado");
});

test("el html arranca la app", () => {
  assert.ok(construir().includes("iniciar(document.body, localStorage)"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/build.test.js`
Expected: FAIL, `Cannot find module '../build.mjs'`

- [ ] **Step 3: Write minimal implementation**

```javascript
// build.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = dirname(fileURLToPath(import.meta.url));
const ORDEN = ["fechas.js", "tarifas.js", "festivos.js", "motor.js", "nomina.js", "estado.js", "ui.js"];

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
  return `<title>cuadrante</title>
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
```

`leer` antepone `src/`, así que el CSS y la plantilla se piden por su nombre a
secas. La expresión regular de `desmodularizar` borra el import completo aunque
ocupe varias líneas, que es el caso de `ui.js`.

```json
{
  "name": "cuadrante",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test test/",
    "build": "node build.mjs"
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/` y después `node build.mjs`
Expected: PASS todas las suites; se genera `cuadrante.html`

- [ ] **Step 5: Verificar el resultado en el navegador**

Abrir `cuadrante.html` y recorrer la lista de comprobación de la Task 10, paso 3. Los siete puntos deben cumplirse.

- [ ] **Step 6: Commit**

```bash
git add build.mjs package.json test/build.test.js cuadrante.html
git commit -m "Anadir empaquetado en un HTML autocontenido"
```

---

## Cierre

Tras la Task 11, publicar `cuadrante.html` como Artifact para que sea accesible desde el móvil, con título `cuadrante` y favicon `🩺`.

Queda pendiente, fuera de este plan, la validación de la Task 8 contra la nómina de septiembre de 2026: registrarla en la pestaña de nóminas y comparar sus horas con `compararHipotesis("2026-08", estado)`. Si el SAS liquida 67h laborables y 7h S-D-F, la regla del corte queda confirmada y se retira el aviso. Si liquida 59h y 15h, hay que poner `cortarAMedianoche: false` por defecto y revisar el spec §4.
