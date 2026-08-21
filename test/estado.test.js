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

test("el estado inicial no lleva marca de tiempo: nada le gana a un remoto real", () => {
  assert.equal(estadoInicial().actualizadoEn, 0);
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
