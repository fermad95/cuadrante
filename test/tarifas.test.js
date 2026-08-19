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
