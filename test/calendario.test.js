// test/calendario.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { festivosDerivados } from "../src/festivos.js";

test("2026 deriva los mismos festivos nacionales y andaluces que estaban a mano", () => {
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
