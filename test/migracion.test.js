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
