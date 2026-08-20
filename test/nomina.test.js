import { test } from "node:test";
import assert from "node:assert/strict";
import { tiposEfectivos, aplicarRetencion, historialTipos } from "../src/nomina.js";

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
  assert.equal(t.base, 0.17092); // solo la de 2028
});

test("las nominas con bruto cero se ignoran", () => {
  const t = tiposEfectivos([
    { periodo: "2026-06", clase: "guardias", bruto: 100, neto: 96 },
    { periodo: "2026-08", clase: "guardias", bruto: 0, neto: 0 },
  ], CONFIG);
  assert.equal(t.guardias, 0.04);
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

test("el historial ordena por periodo y calcula el tipo de cada nomina", () => {
  const h = historialTipos([
    { periodo: "2026-07", clase: "base", bruto: 100, neto: 91 },
    { periodo: "2026-06", clase: "base", bruto: 100, neto: 90 },
    { periodo: "2026-06", clase: "guardias", bruto: 100, neto: 97 },
  ], "base");
  assert.deepEqual(h.map((x) => x.periodo), ["2026-06", "2026-07"]);
  assert.equal(h[0].tipo, 0.1);
  assert.equal(h[1].tipo, 0.09);
});

test("la primera nomina no tiene salto", () => {
  const h = historialTipos([{ periodo: "2026-06", clase: "base", bruto: 100, neto: 90 }], "base");
  assert.equal(h[0].salto, null);
  assert.equal(h[0].esSalto, false);
});

test("una variacion pequena no se marca como salto", () => {
  const h = historialTipos([
    { periodo: "2026-06", clase: "base", bruto: 100, neto: 90 },
    { periodo: "2026-07", clase: "base", bruto: 100, neto: 89.5 },
  ], "base");
  assert.equal(h[1].esSalto, false);
  assert.equal(h[1].salto, 0.005);
});

test("una regularizacion se marca como salto", () => {
  const h = historialTipos([
    { periodo: "2026-06", clase: "base", bruto: 100, neto: 90 },
    { periodo: "2026-07", clase: "base", bruto: 100, neto: 84 },
  ], "base");
  assert.equal(h[1].esSalto, true);
  assert.equal(h[1].salto, 0.06);
});

test("un salto a la baja tambien se marca", () => {
  const h = historialTipos([
    { periodo: "2026-06", clase: "base", bruto: 100, neto: 84 },
    { periodo: "2026-07", clase: "base", bruto: 100, neto: 90 },
  ], "base");
  assert.equal(h[1].esSalto, true);
  assert.equal(h[1].salto, -0.06);
});

test("sin nominas de esa clase el historial esta vacio", () => {
  assert.deepEqual(historialTipos([{ periodo: "2026-06", clase: "guardias", bruto: 100, neto: 97 }], "base"), []);
});
