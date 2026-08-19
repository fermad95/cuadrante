// src/nomina.js
import { redondear } from "./fechas.js";

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
