// src/nomina.js
import { redondear, mesDe } from "./fechas.js";
import { calcularGuardia } from "./motor.js";
import { retribucionFija, anioResidenciaEn } from "./tarifas.js";

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
