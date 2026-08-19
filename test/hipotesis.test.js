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
