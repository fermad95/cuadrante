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
