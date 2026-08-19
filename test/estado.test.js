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
