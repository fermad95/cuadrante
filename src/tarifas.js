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
